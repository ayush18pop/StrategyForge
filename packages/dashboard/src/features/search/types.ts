export type StrategyLifecycle = 'live' | 'draft' | 'deprecated';
export type StrategyRiskLevel = 'conservative' | 'balanced';
export type SearchChipKind = 'amount' | 'asset' | 'risk' | 'horizon' | 'chain' | 'target';

export interface SearchChip {
  kind: SearchChipKind;
  label: string;
}

export interface ParsedGoal {
  raw: string;
  amountUsd?: number;
  asset?: string;
  riskLevel?: StrategyRiskLevel;
  horizon?: string;
  chain?: string;
  targetYieldBps?: number;
  chips: SearchChip[];
  confidence: number;
  missing: string[];
  note?: string;
}

export interface StrategySearchRecord {
  familyId: string;
  slug: string;
  name: string;
  lifecycle: StrategyLifecycle;
  averageYieldPct: number;
  verifiedRuns: number;
  strategyFamiliesManaged: number;
  reputationScore: number;
  riskLevel: StrategyRiskLevel;
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

export interface LiveStat {
  value: string;
  label: string;
  tone: 'attest' | 'accent' | 'ok';
}
