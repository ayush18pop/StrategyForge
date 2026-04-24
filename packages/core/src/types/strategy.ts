export type Lifecycle = 'draft' | 'paper' | 'canary' | 'stable' | 'deprecated';
export type RiskLevel = 'conservative' | 'balanced';
export type Protocol = 'aave' | 'morpho' | 'spark';
export type Chain = 'ethereum' | 'base';

export interface StrategyGoal {
  asset: string;
  amount: number;
  riskLevel: RiskLevel;
  horizon: string;
  chains: Chain[];
}

export interface AllocationEntry {
  protocol: Protocol;
  chain: Chain;
  asset: string;
  percentage: number;
}

export interface StrategyVersion {
  familyId: string;
  version: number;
  cid: string;
  priorCids: string[];
  lifecycle: Lifecycle;
  allocation: AllocationEntry[];
  createdAt: number;
  keeperhubWorkflowId?: string;
  evidenceBundleCid: string;
}

export interface StrategyFamily {
  familyId: string;
  goal: StrategyGoal;
  versions: StrategyVersion[];
  latestStable?: string;
}
