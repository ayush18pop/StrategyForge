import type { StrategyGoal, AllocationEntry } from './strategy.js';
import type { EvidenceBundle } from './evidence.js';
import type { WorkflowNode, WorkflowEdge } from './keeperhub.js';

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



export type MarketRegime = 'stable' | 'rising' | 'declining' | 'volatile';

export interface LogicNodeConfig {
  nodeType: string;
  config: Record<string, unknown>;
}

export interface PipelineContext {
  goal: StrategyGoal;
  priorVersions: EvidenceBundle[];
  marketSnapshot: MarketSnapshot;
}

export interface CandidateWorkflow {
  id: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  trigger?: { type: string; config: Record<string, unknown> };
  hypothesis: string;
  confidence: number;
}

export interface BoundsResult {
  candidateId: string;
  boundsViolations: string[];
  passed: boolean;
}

export interface CandidateVerdict {
  candidateId: string;
  boundsCheck: BoundsResult;
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
