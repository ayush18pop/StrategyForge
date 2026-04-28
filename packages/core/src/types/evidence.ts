import type { MarketRegime } from './pipeline.js';

export interface EvidenceBundle {
  strategyFamily: string;
  version: number;
  priorCids: string[];
  pipeline: PipelineEvidence;
  outcomes?: OutcomeRecord;
  createdAt: number;
}

export interface PipelineEvidence {
  researcher: ResearcherEvidence;
  strategist: StepEvidence;
  critic: CriticEvidence;
  compiler: {
    workflowSpec: Record<string, unknown>;
    gasEstimate: number;           // monthly USD — gas estimation moved here from Simulator
  };
  riskValidator: { passed: boolean; warnings: string[] };
}

export interface ResearcherEvidence extends StepEvidence {
  output: {
    regime: MarketRegime;
    survivingProtocols: string[];
    contextType: string;
    suitableActions: string[];
    signals: { subject?: string; protocol?: string; signal: string; severity: 'low' | 'medium' | 'high' }[];
  };
}

export interface CriticEvidence extends StepEvidence {
  output: {
    verdicts: Record<string, unknown>[];
    selectedCandidateId: string;
    selectionRationale: string;
    mandatoryConstraints: string[];
  };
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
