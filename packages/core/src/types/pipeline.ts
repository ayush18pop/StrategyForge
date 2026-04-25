import type { StrategyGoal, AllocationEntry } from './strategy.js';
import type { EvidenceBundle } from './evidence.js';

export interface MarketSnapshot {
  protocols: ProtocolData[];
  fetchedAt: number;
}

export interface ProtocolData {
  name: string;
  chain: string;
  pool: string;
  apy: number;
  apySigma: number;          // 30-day APY standard deviation — used for VaR + Sharpe
  tvl: number;
  utilization: number;
  auditStatus: 'audited' | 'unaudited';
  exploitHistory: { date: number; severity: string }[];
}

// Kelly Criterion inputs + computed fraction per protocol
// f_kelly = (p * r - q * l) / r
// where p = P(success), q = P(loss), r = APY, l = loss magnitude
export interface KellyPrior {
  protocol: string;
  p: number;          // P(protocol achieves stated APY)
  q: number;          // P(exploit / loss event) = 1 - p
  r: number;          // APY (payoff ratio)
  l: number;          // expected loss magnitude if exploit (0.01–0.20)
  f_kelly: number;    // optimal Kelly fraction: (p * r - q * l) / r
  sigma: number;      // historical APY std deviation (for Sharpe + VaR)
  source: 'default' | 'prior-critic';  // whether this came from a prior Critic update
}

export type MarketRegime = 'stable' | 'rising' | 'declining' | 'volatile';

export interface PipelineContext {
  goal: StrategyGoal;
  priorVersions: EvidenceBundle[];
  marketSnapshot: MarketSnapshot;
}

export interface CandidateAllocation {
  id: string;
  allocation: AllocationEntry[];
  kellyBaseline: { protocol: string; f_kelly: number; pctKelly: number }[];
  deviations: { protocol: string; from: number; to: number; reason: string }[];
  hypothesis: string;
  confidence: number;
}

export interface VaRResult {
  candidateId: string;
  portfolioSigma: number;
  expectedReturn: number;   // Kelly-weighted expected return
  var95: number;            // expectedReturn - 1.645 * portfolioSigma
  passed: boolean;
}

export interface CandidateVerdict {
  candidateId: string;
  varCheck: VaRResult;
  approved: boolean;
  risks: string[];
  constraints: string[];
}

export interface SealedInferenceResult {
  response: string;
  attestationHash: string;
  model: string;
  provider: string;
}
