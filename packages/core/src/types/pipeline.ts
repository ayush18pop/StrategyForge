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
  tvl: number;
  utilization: number;
  auditStatus: 'audited' | 'unaudited';
  exploitHistory: { date: number; severity: string }[];
}

export interface PipelineContext {
  goal: StrategyGoal;
  priorVersions: EvidenceBundle[];
  marketSnapshot: MarketSnapshot;
}

export interface CandidateAllocation {
  id: string;
  allocation: AllocationEntry[];
  hypothesis: string;
  confidence: number;
}

export interface CandidateVerdict {
  candidateId: string;
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
