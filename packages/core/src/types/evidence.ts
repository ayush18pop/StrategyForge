export interface EvidenceBundle {
  strategyFamily: string;
  version: number;
  priorCids: string[];
  pipeline: PipelineEvidence;
  outcomes?: OutcomeRecord;
  createdAt: number;
}

export interface PipelineEvidence {
  researcher: StepEvidence;
  strategist: StepEvidence;
  critic: StepEvidence;
  compiler: { workflowSpec: Record<string, unknown> };
  riskValidator: { passed: boolean; warnings: string[] };
  simulator: { estimatedNetAPY: number; estimatedGasCost: number };
}

export interface StepEvidence {
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  attestationHash: string;
  timestamp: number;
}

export interface OutcomeRecord {
  startedAt: number;
  checkpoints: OutcomeCheckpoint[];
  finalYield?: number;
  finalStatus?: 'success' | 'underperformed' | 'emergency_stopped';
}

export interface OutcomeCheckpoint {
  timestamp: number;
  currentYield: number;
  notes: string;
}
