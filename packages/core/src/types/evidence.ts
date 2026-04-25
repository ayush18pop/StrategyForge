import type { KellyPrior, MarketRegime } from './pipeline.js';

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

// Researcher evidence includes Kelly priors so they're in the audit trail
export interface ResearcherEvidence extends StepEvidence {
  output: {
    regime: MarketRegime;
    survivingProtocols: string[];
    kellyPriors: KellyPrior[];
    signals: { protocol: string; signal: string; severity: 'low' | 'medium' | 'high' }[];
  };
}

// Critic evidence includes updated priors that feed the next version
export interface CriticEvidence extends StepEvidence {
  output: {
    verdicts: Record<string, unknown>[];
    selectedCandidateId: string;
    selectionRationale: string;
    mandatoryConstraints: string[];
    updatedKellyPriors: KellyPrior[];   // loaded by Researcher in v(n+1)
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
