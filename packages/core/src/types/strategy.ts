export type Lifecycle = 'draft' | 'live' | 'deprecated';
export type RiskLevel = 'conservative' | 'balanced';

// All protocols discoverable via KeeperHub list_action_schemas — not a closed set.
// Known values listed for documentation/autocomplete; the actual constraint is
// "has a supply/deposit action in KeeperHub schemas AND a DefiLlama pool".
export type KnownProtocol =
  | 'aave-v3' | 'aave-v4' | 'morpho' | 'spark'
  | 'compound' | 'sky' | 'ethena' | 'yearn'
  | 'aerodrome' | 'curve' | 'lido' | 'rocket-pool';
export type Protocol = KnownProtocol | (string & {});

export type KnownChain =
  | 'ethereum' | 'base' | 'arbitrum' | 'optimism' | 'polygon' | 'avalanche';
export type Chain = KnownChain | (string & {});

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
  workflowSpec: Record<string, unknown>;
  createdAt: number;
  keeperhubWorkflowId?: string;
  evidenceBundleCid: string;
}

export interface StrategyFamily {
  familyId: string;
  goal: StrategyGoal;
  versions: StrategyVersion[];
  latestLive?: string;
}
