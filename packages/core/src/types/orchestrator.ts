import type { StrategyGoal } from './strategy.js';
import type { EvidenceBundle } from './evidence.js';

export type TriggerReason =
  | 'user_request'
  | 'apy_drift'
  | 'underperformance'
  | 'protocol_incident'
  | 'scheduled_review';

export type UpdateTrigger =
  | { reason: 'apy_drift'; delta: number }
  | { reason: 'underperformance'; actualVsPredicted: number }
  | { reason: 'protocol_incident'; protocol: string; description: string }
  | { reason: 'scheduled_review' };

export interface StepFailure {
  nodeId: string;
  nodeName: string;
  errorMessage: string;
  protocol?: string;
}

export interface FailedRun {
  executionId: string;
  failedAt: string;
  steps: StepFailure[];
}

export interface AnalyticsOutcome {
  successRate: number;
  failedRuns: FailedRun[];
  stepFailures: StepFailure[];
  networkBreakdown: { network: string; successRate: number }[];
}

// Input handed to PipelineOrchestrator by either CreateOrchestrator or UpdateOrchestrator
export interface PipelineInput {
  goal: StrategyGoal;
  familyId: string;
  priorCids: string[];
  priorVersions: EvidenceBundle[];
  actualOutcomes: AnalyticsOutcome | null;  // null on creation
  triggerReason: TriggerReason;
  emergencyUpdate: boolean;                 // true → deploy immediately, skip any user review window
}
