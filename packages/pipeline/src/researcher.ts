import { ok, err } from '@strategyforge/core';
import type {
  StrategyGoal,
  MarketSnapshot,
  MarketRegime,
  EvidenceBundle,
  StepEvidence,
  AnalyticsOutcome,
  TriggerReason,
  ProtocolData,
  ActionSchema,
  Result,
  SealedInferenceResult,
} from '@strategyforge/core';
import type { DefiLlamaClient } from '@strategyforge/data';
import { matchLlamaProject, PROTOCOL_REGISTRY } from './protocol-registry.js';
export interface ResearcherOutput {
  snapshot: MarketSnapshot;
  regime: MarketRegime;
  contextType: string;
  suitableActions: string[];
  signals: { subject?: string; protocol?: string; signal: string; severity: 'low' | 'medium' | 'high' }[];
  filteredOut: { protocol: string; reason: string }[];
  evidence: StepEvidence;
}

// Duck-typed so both SealedInference and ProxyInference satisfy it
export interface InferenceClient {
  infer(params: {
    systemPrompt: string;
    userPrompt: string;
    jsonMode?: boolean;
    maxRetries?: number;
  }): Promise<Result<SealedInferenceResult>>;
}

const MIN_TVL_USD = 10_000_000;

// ─── Researcher ──────────────────────────────────────────────────

export class Researcher {
  constructor(
    private readonly llama: DefiLlamaClient,
    private readonly inference: InferenceClient,
  ) { }

  async run(params: {
    goal: StrategyGoal;
    priorVersions: EvidenceBundle[];
    actualOutcomes: AnalyticsOutcome | null;
    triggerReason: TriggerReason;
    actionSchemas: ActionSchema[];
  }): Promise<Result<ResearcherOutput>> {
    const { goal, priorVersions, actualOutcomes, triggerReason, actionSchemas } = params;

    // 1. Fetch stablecoin pools matching goal chains
    const poolsResult = await this.llama.getYieldPools({
      chains: goal.chains,
      stablecoinsOnly: true,
      minTvl: MIN_TVL_USD,
    });
    if (!poolsResult.ok) return err(new Error(poolsResult.error));

    const filteredOut: { protocol: string; reason: string }[] = [];

    // 2. Match pools to the protocol registry; pick best APY per protocol+chain
    const bestByKey = new Map<string, { pool: (typeof poolsResult.value)[0]; registryId: string }>();
    for (const pool of poolsResult.value) {
      const entry = matchLlamaProject(pool.project);
      if (!entry) {
        filteredOut.push({ protocol: pool.project, reason: 'no KeeperHub action type' });
        continue;
      }
      const key = `${entry.id}-${pool.chain.toLowerCase()}`;
      const existing = bestByKey.get(key);
      if (!existing || pool.apy > existing.pool.apy) {
        bestByKey.set(key, { pool, registryId: entry.id });
      }
    }

    // 3. Populate surviving pool details
    const protocols: ProtocolData[] = [];
    for (const [, { pool, registryId }] of bestByKey) {
      protocols.push({
        name: registryId,
        chain: pool.chain.toLowerCase(),
        pool: pool.pool,
        apy: pool.apy / 100,   // pct → decimal
        tvl: pool.tvlUsd,
        utilization: 0.7,      // approximation; not in DefiLlama yield API
        auditStatus: 'audited',
        exploitHistory: [],
      });
    }

    if (protocols.length === 0) {
      return err(new Error('No surviving protocols after filter'));
    }

    const snapshot: MarketSnapshot = { protocols, fetchedAt: Date.now() };

    // 4. Determine base context state
    const currentState = {
      protocols: protocols.map(p => ({
        name: p.name,
        chain: p.chain,
        apy: p.apy,
        tvl: p.tvl
      }))
    };

    // 6. Classify market regime deterministically
    const computedRegime = classifyRegime(protocols);

    const inferResult = await this.inference.infer({
      systemPrompt: RESEARCHER_SYSTEM_PROMPT,
      userPrompt: buildUserPrompt(goal, actionSchemas, priorVersions, currentState),
      jsonMode: true,
    });
    if (!inferResult.ok) return err(inferResult.error);

    let llmOut: any = {};
    try {
      llmOut = JSON.parse(inferResult.value.response);
    } catch { /* non-fatal */ }

    const contextType = typeof llmOut.contextType === 'string' ? llmOut.contextType : 'yield';
    let suitableActions: string[] = Array.isArray(llmOut.suitableActions)
      ? llmOut.suitableActions.filter((a: unknown): a is string => typeof a === 'string')
      : [];

    // CURATE the LLM's choices: hard cap at 12 to prevent the dump-of-actions bug
    // downstream. If the LLM ignored the rule and returned 80 actions, slice it.
    if (suitableActions.length > 12) {
      // Prefer actions that are present in the registered schemas + always keep
      // Condition + a notification + at least one read action.
      const known = new Set(actionSchemas.map(s => s.type));
      const filtered = suitableActions.filter(a => known.has(a));
      const head = filtered.slice(0, 10);
      const mustHave = ['Condition', 'discord/send-message'];
      for (const m of mustHave) if (!head.includes(m)) head.push(m);
      suitableActions = head.slice(0, 12);
    }

    // If LLM gave us nothing usable, fall back to a conservative default set
    // for the contextType (NOT a dump of all 80 actions).
    if (suitableActions.length === 0) {
      suitableActions = defaultActionsFor(contextType, protocols);
    }

    const signals = Array.isArray(llmOut.signals) ? llmOut.signals : [];

    const evidence: StepEvidence = {
      input: { goal: goal as unknown as Record<string, unknown>, triggerReason, actionSchemas: actionSchemas.map(s => s.type) },
      output: {
        regime: computedRegime,
        survivingProtocols: protocols.map(p => p.name),
        contextType,
        suitableActions,
        signals,
      },
      attestationHash: inferResult.value.attestationHash,
      timestamp: Date.now(),
    };

    return ok({ snapshot, regime: computedRegime, contextType, suitableActions, signals, filteredOut, evidence });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────

function classifyRegime(protocols: ProtocolData[]): MarketRegime {
  const avgApy = protocols.reduce((s, p) => s + p.apy, 0) / protocols.length;

  if (avgApy > 0.07) return 'rising';
  if (avgApy < 0.02) return 'declining';
  return 'stable';
}

function buildUserPrompt(
  goal: StrategyGoal,
  actionSchemas: ActionSchema[],
  priorVersions: EvidenceBundle[],
  currentState: any,
): string {
  const withOutcomes = priorVersions.filter(v => v.outcomes);
  const priorOutcomes = withOutcomes.map(v => ({ version: v.version, outcomes: v.outcomes, pipeline: v.pipeline }));

  return `USER GOAL:
Parameters: ${JSON.stringify(goal, null, 2)}

CURRENT STATE:
${JSON.stringify(currentState, null, 2)}

AVAILABLE ACTION TYPES:
${actionSchemas.map(s => s.type).join(', ')}

${priorOutcomes.length > 0 ? `PRIOR VERSION OUTCOMES:\n${priorOutcomes.map(p => `v${p.version}: ${JSON.stringify(p.outcomes)}\nCritic rationale: ${(p.pipeline as any).critic?.output?.selectionRationale}`).join('\n\n')}` : 'No prior versions.'}`;
}

// Default action set per contextType — used only as a last-resort fallback
// when the LLM returns nothing usable. Conservative on purpose.
function defaultActionsFor(contextType: string, protocols: ProtocolData[]): string[] {
  const top = protocols[0]?.name ?? 'aave-v3';
  const supplyByProto: Record<string, string[]> = {
    'aave-v3': ['aave-v3/supply', 'aave-v3/withdraw', 'aave-v3/get-user-account-data'],
    'aave-v4': ['aave-v4/supply', 'aave-v4/withdraw', 'aave-v4/get-user-account-data'],
    'spark':   ['spark/supply', 'spark/withdraw', 'spark/get-user-account-data'],
    'morpho':  ['morpho/vault-deposit', 'morpho/vault-withdraw', 'morpho/vault-balance'],
    'compound': ['compound/supply', 'compound/withdraw', 'compound/get-balance', 'compound/get-supply-rate'],
    'sky':     ['sky/vault-deposit', 'sky/vault-withdraw', 'sky/vault-balance'],
    'ethena':  ['ethena/vault-deposit', 'ethena/vault-withdraw', 'ethena/vault-balance'],
    'yearn':   ['yearn/vault-deposit', 'yearn/vault-withdraw', 'yearn/vault-balance'],
  };
  const lendingActions = supplyByProto[top] ?? supplyByProto['aave-v3']!;

  switch (contextType) {
    case 'monitoring':
      return ['web3/check-token-balance', 'aave-v3/get-user-account-data', 'Condition', 'discord/send-message'];
    case 'protection':
      return [
        'aave-v3/get-user-account-data', 'aave-v3/get-user-reserve-data', 'aave-v3/repay',
        'Condition', 'discord/send-message', 'sendgrid/send-email',
      ];
    case 'reporting':
      return [
        'aave-v3/get-user-reserve-data', 'compound/get-supply-rate', 'compound/get-utilization',
        'sky/vault-total-assets', 'sky/vault-total-supply', 'Code', 'discord/send-message',
      ];
    case 'automation':
      return ['web3/check-token-balance', 'web3/approve-token', ...lendingActions, 'Condition', 'discord/send-message'];
    case 'yield':
    default:
      return [
        'web3/check-token-balance', 'web3/approve-token',
        ...lendingActions,
        'Condition', 'discord/send-message',
      ];
  }
}

// Mirrors docs/prompts.md → Researcher Prompt (system part).
const RESEARCHER_SYSTEM_PROMPT = `You are a DeFi workflow researcher. You do NOT design workflows. You classify the user's intent, gather relevant on-chain context, and recommend which KeeperHub action schemas the Strategist should consider.

Your task:

1. Classify the workflow intent into exactly ONE contextType:
     "monitoring"  — watch a position/market and notify
     "protection"  — watch a position and intervene when in danger
     "yield"       — deposit idle funds into yield-bearing protocols
     "automation"  — recurring on-chain task (claim, wrap, vote, distribute)
     "reporting"   — periodic read-only dashboard
     "arbitrage"   — cross-venue rate/price comparison with execution
     "liquidation" — watch borrowers and bid/kick

2. Identify the SHORT LIST of KeeperHub actions the Strategist should use.
   This is NOT a dump of every available action. Pick the SPECIFIC actions a real
   workflow of this category needs.
     - "yield" on stablecoins: 1-3 deposit actions for the highest-quality protocols on
       the user's chains, plus matching balance/approve/get-rate reads, plus a notification.
     - "protection" on a borrow: relevant get-user-account-data + matching repay/withdraw
       + a notification.
     - "monitoring": read actions + a notification — NEVER any state-changing action.
     - Always include "Condition" if branching is needed, "Code" for normalisation,
       "For Each" for watchlists, and one notification (discord/send-message,
       sendgrid/send-email, or telegram/send-message).

3. List concrete signals from the market data the Strategist should react to.

4. If prior outcomes are provided, extract lessons.

Return JSON:
{
  "contextType": "yield" | "monitoring" | "protection" | "automation" | "reporting" | "arbitrage" | "liquidation",
  "currentState": { "topProtocols": [{ "name": string, "chain": string, "apy": number, "tvl": number, "note": string }] },
  "signals": [{ "subject": string, "signal": string, "severity": "low"|"medium"|"high" }],
  "suitableActions": [string],
  "priorLessons": [string]
}

HARD RULES:
- suitableActions length MUST be ≤ 12. Curate ruthlessly. The pipeline will reject
  workflows that try to use every action — your job is to prevent that.
- For non-monitoring intents, suitableActions MUST include at least one read action
  AND the matching write action AND a notification action.
- Always include "Condition" in suitableActions unless the workflow is unconditional.
- Never include actions whose protocol does not appear in the snapshot, unless the
  user's goal explicitly names them.`;
