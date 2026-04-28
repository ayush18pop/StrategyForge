import { Contract } from 'ethers';
import type { Signer } from 'ethers';
import { err, ok } from '@strategyforge/core';
import type {
  EvidenceBundle,
  Result,
  RiskLevel,
  StrategyGoal,
  StrategyVersion,
} from '@strategyforge/core';
import type { EvidenceStore } from '@strategyforge/storage';

const AGENT_REGISTRY_ABI = [
  'function getAgent(uint256 agentId) view returns (string)',
  'function updateAgent(uint256 agentId, string agentURI)',
] as const;

interface AgentRegistryContract {
  getAgent(agentId: number): Promise<string>;
  updateAgent(agentId: number, agentURI: string): Promise<unknown>;
}

export interface FamilySummary {
  familyId: string;
  goal: StrategyGoal;
  versions: StrategyVersion[];
}

export interface AgentMetadata {
  agentId: number;
  families: FamilySummary[];
  updatedAt: number;
}

export interface SearchQuery {
  asset?: string;
  riskLevel?: RiskLevel;
  targetYield?: number;
  chains?: string[];
}

export interface AgentMetadataContext {
  evidenceStore: EvidenceStore;
  agentRegistryAddress: string;
  signer: Signer;
  agentId: number;
}

export async function loadAgentMetadata(
  context: AgentMetadataContext,
): Promise<Result<AgentMetadata>> {
  try {
    const contract = createRegistryContract(context);

    let cid: string;
    try {
      cid = (await contract.getAgent(context.agentId)) as string;
    } catch (contractError) {
      const err = contractError instanceof Error ? contractError : new Error(String(contractError));
      if (err.message.includes('NonexistentToken') || err.message.includes('execution reverted')) {
        return ok(emptyAgentMetadata(context.agentId));
      }
      throw err;
    }

    if (!cid) {
      return ok(emptyAgentMetadata(context.agentId));
    }

    const readResult = await context.evidenceStore.readBundle(cid);
    if (!readResult.ok) {
      return err(readResult.error);
    }

    const metadata = normalizeAgentMetadata(readResult.value);
    if (!metadata) {
      return err(new Error(`Agent metadata CID ${cid} does not contain valid agent metadata JSON`));
    }

    return ok(metadata);
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

export async function saveAgentMetadata(
  context: AgentMetadataContext,
  metadata: AgentMetadata,
): Promise<Result<string>> {
  try {
    const writeResult = await context.evidenceStore.writeBundle(
      metadata as unknown as EvidenceBundle,
    );
    if (!writeResult.ok) {
      return err(writeResult.error);
    }

    const contract = createRegistryContract(context);
    const transaction = await contract.updateAgent(
      context.agentId,
      writeResult.value.cid,
    );
    await waitForTransactionIfPresent(transaction);

    return ok(writeResult.value.cid);
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

function createRegistryContract(context: AgentMetadataContext): AgentRegistryContract {
  return new Contract(
    context.agentRegistryAddress,
    AGENT_REGISTRY_ABI,
    context.signer,
  ) as unknown as AgentRegistryContract;
}

export async function syncFamilySummary(
  context: AgentMetadataContext,
  family: FamilySummary,
): Promise<Result<string>> {
  const metadataResult = await loadAgentMetadata(context);
  if (!metadataResult.ok) {
    return metadataResult;
  }

  const metadata = metadataResult.value;
  const nextFamilies = metadata.families.filter(
    (existingFamily) => existingFamily.familyId !== family.familyId,
  );
  nextFamilies.push({
    ...family,
    versions: family.versions.slice().sort((left, right) => left.version - right.version),
  });

  return saveAgentMetadata(context, {
    agentId: metadata.agentId,
    families: nextFamilies.sort((left, right) => left.familyId.localeCompare(right.familyId)),
    updatedAt: Date.now(),
  });
}

export function matchesGoal(
  family: FamilySummary,
  query: SearchQuery,
): boolean {
  const goal = family.goal;

  if (query.asset && goal.asset.toLowerCase() !== query.asset.toLowerCase()) {
    return false;
  }

  if (query.riskLevel && goal.riskLevel !== query.riskLevel) {
    return false;
  }

  if (
    query.chains &&
    query.chains.length > 0 &&
    !query.chains.some((chain) =>
      goal.chains.some((goalChain) => goalChain.toLowerCase() === chain.toLowerCase()),
    )
  ) {
    return false;
  }

  if (typeof query.targetYield === 'number') {
    const delta = Math.abs(goal.targetYield - query.targetYield);
    if (delta > 200) {
      return false;
    }
  }

  return true;
}

export function latestLiveVersion(family: FamilySummary): StrategyVersion | undefined {
  const liveVersions = family.versions
    .filter((version) => version.lifecycle === 'live')
    .sort((left, right) => right.version - left.version);
  return liveVersions[0];
}

function emptyAgentMetadata(agentId: number): AgentMetadata {
  return {
    agentId,
    families: [],
    updatedAt: 0,
  };
}

function normalizeAgentMetadata(input: unknown): AgentMetadata | null {
  if (typeof input !== 'object' || input === null) {
    return null;
  }

  const record = input as Record<string, unknown>;
  const { agentId, families, updatedAt } = record;

  if (
    typeof agentId !== 'number' ||
    !Array.isArray(families) ||
    typeof updatedAt !== 'number'
  ) {
    return null;
  }

  const parsedFamilies: FamilySummary[] = [];
  for (const family of families) {
    const parsed = normalizeFamilySummary(family);
    if (!parsed) {
      return null;
    }
    parsedFamilies.push(parsed);
  }

  return {
    agentId,
    families: parsedFamilies,
    updatedAt,
  };
}

function normalizeFamilySummary(input: unknown): FamilySummary | null {
  if (typeof input !== 'object' || input === null) {
    return null;
  }

  const record = input as Record<string, unknown>;
  const familyId = record.familyId;
  const goal = record.goal;
  const versions = record.versions;

  if (typeof familyId !== 'string' || !Array.isArray(versions)) {
    return null;
  }

  const parsedGoal = goal as StrategyGoal;
  const parsedVersions = versions as StrategyVersion[];

  return {
    familyId,
    goal: parsedGoal,
    versions: parsedVersions.slice().sort((left, right) => left.version - right.version),
  };
}

async function waitForTransactionIfPresent(transaction: unknown): Promise<void> {
  if (
    typeof transaction === 'object' &&
    transaction !== null &&
    'wait' in transaction &&
    typeof (transaction as { wait: unknown }).wait === 'function'
  ) {
    await (transaction as { wait: () => Promise<unknown> }).wait();
  }
}
