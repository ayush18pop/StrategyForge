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

// Learning: what failed in prior versions so Critic can avoid repeating it
export interface FailurePattern {
  version: number;
  reason: string;           // Why it failed: "Aave governance", "insufficient liquidity", etc.
  affectedProtocols: string[];  // Which protocols caused the problem
  targetYield: number;      // BPS: what was the goal?
  actualYield: number;      // BPS: what did it achieve?
  gap: number;              // BPS: how much it missed by
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
  failurePatterns?: FailurePattern[];       // Extracted from priorVersions; Critic learns from these
}
