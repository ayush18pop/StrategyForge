import type { StrategyFamilyResponse, StrategyGoal } from './api';
import type { StrategyVersion, WorkflowEdge, WorkflowNode, WorkflowSpec } from './models';
import { relativeTime, titleCaseFromSlug, workflowHeadline } from './format';

export interface StrategySearchView {
  familyId: string;
  slug: string;
  name: string;
  lifecycle: StrategyVersion['lifecycle'];
  averageYieldPct: number;
  verifiedRuns: number;
  strategyFamiliesManaged: number;
  reputationScore: number;
  riskLevel: StrategyGoal['riskLevel'];
  asset: string;
  targetYieldBps: number;
  protocols: string[];
  chains: string[];
  thesis: string;
  evidenceCid: string;
  workflowId: string;
  updatedAtLabel: string;
  featured?: boolean;
}

export interface VersionView extends StrategyVersion {
  workflow: WorkflowSpec;
  workflowName: string;
  workflowDescription: string;
  workflowNodes: WorkflowNode[];
  workflowEdges: WorkflowEdge[];
  protocols: string[];
  proofScore: number;
}

export function buildSearchView(
  familyId: string,
  goal: StrategyGoal,
  versionCount: number,
  latestVersion: StrategyVersion,
): StrategySearchView {
  const workflow = asWorkflowSpec(latestVersion.workflowSpec);
  const protocols = extractProtocols(workflow.nodes ?? []);
  const score = proofScoreForVersion(latestVersion, versionCount);

  return {
    familyId,
    slug: `${familyId}-v${latestVersion.version}`,
    name: titleCaseFromSlug(familyId),
    lifecycle: latestVersion.lifecycle,
    averageYieldPct: goal.targetYield / 100,
    verifiedRuns: Math.max((versionCount - 1) * 8 + latestVersion.priorCids.length * 3, latestVersion.lifecycle === 'live' ? 3 : 0),
    strategyFamiliesManaged: 1,
    reputationScore: score,
    riskLevel: goal.riskLevel,
    asset: goal.asset,
    targetYieldBps: goal.targetYield,
    protocols: protocols.length > 0 ? protocols : ['KeeperHub Workflow'],
    chains: goal.chains.map((chain) => titleCaseFromSlug(chain)),
    thesis: buildThesis(goal, workflow),
    evidenceCid: latestVersion.evidenceBundleCid,
    workflowId: latestVersion.keeperhubWorkflowId ?? 'Pending deployment',
    updatedAtLabel: latestVersion.createdAt > 0 ? `Updated ${relativeTime(latestVersion.createdAt)}` : 'Awaiting pipeline output',
    featured: latestVersion.lifecycle === 'live',
  };
}

export function buildVersionViews(versions: StrategyVersion[]): VersionView[] {
  return versions
    .slice()
    .sort((left, right) => right.version - left.version)
    .map((version, index, arr) => {
      const workflow = asWorkflowSpec(version.workflowSpec);
      const workflowNodes = workflow.nodes ?? [];
      const protocols = extractProtocols(workflowNodes);

      return {
        ...version,
        workflow,
        workflowName: workflowHeadline(workflow.name),
        workflowDescription: workflow.description ?? 'No workflow description was published with this version.',
        workflowNodes,
        workflowEdges: workflow.edges ?? [],
        protocols: protocols.length > 0 ? protocols : ['KeeperHub Workflow'],
        proofScore: proofScoreForVersion(version, arr.length - index),
      };
    });
}

export function latestVersion(versions: StrategyVersion[]): StrategyVersion | undefined {
  return versions.slice().sort((left, right) => right.version - left.version)[0];
}

export function latestLiveVersion(versions: StrategyVersion[]): StrategyVersion | undefined {
  return versions
    .filter((version) => version.lifecycle === 'live')
    .sort((left, right) => right.version - left.version)[0];
}

export function familySummaryMetrics(family: StrategyFamilyResponse): {
  proofScore: number;
  liveCount: number;
  draftCount: number;
  deprecatedCount: number;
} {
  const liveCount = family.versions.filter((version) => version.lifecycle === 'live').length;
  const draftCount = family.versions.filter((version) => version.lifecycle === 'draft').length;
  const deprecatedCount = family.versions.filter((version) => version.lifecycle === 'deprecated').length;

  return {
    proofScore: Math.min(99, 62 + liveCount * 9 + family.versions.length * 5),
    liveCount,
    draftCount,
    deprecatedCount,
  };
}

export function asWorkflowSpec(input: Record<string, unknown>): WorkflowSpec {
  return input as WorkflowSpec;
}

function proofScoreForVersion(version: StrategyVersion, versionCount: number): number {
  return Math.min(
    99,
    58
      + (version.lifecycle === 'live' ? 18 : version.lifecycle === 'draft' ? 8 : 4)
      + Math.min(version.priorCids.length * 4, 12)
      + Math.min(versionCount * 3, 12)
      + (version.keeperhubWorkflowId ? 6 : 0),
  );
}

function extractProtocols(nodes: WorkflowNode[]): string[] {
  const protocols = new Set<string>();

  for (const node of nodes) {
    const prefix = node.type.split(/[./:-]/)[0];
    if (prefix && prefix !== 'condition' && prefix !== 'http' && prefix !== 'run' && prefix !== 'trigger') {
      protocols.add(titleCaseFromSlug(prefix));
    }
  }

  return Array.from(protocols);
}

function buildThesis(goal: StrategyGoal, workflow: WorkflowSpec): string {
  const workflowCopy = workflow.description?.trim();
  if (workflowCopy) {
    return workflowCopy;
  }

  const chainText = goal.chains.map((chain) => titleCaseFromSlug(chain)).join(', ');
  return `${goal.riskLevel === 'balanced' ? 'Balanced' : 'Conservative'} ${goal.asset} automation across ${chainText} for a ${goal.horizon} horizon.`;
}
