import { ok, err } from '@strategyforge/core';
import type { StrategyGoal, Result } from '@strategyforge/core';
import { randomUUID } from 'crypto';
import type { PipelineOrchestrator, PipelineOutput } from './pipeline-orchestrator.js';

// ─── CreateOrchestrator ───────────────────────────────────────────
// Entry point for new strategy creation (no prior versions).
// Called by the server layer; never directly from user input.

export class CreateOrchestrator {
  constructor(private readonly pipeline: PipelineOrchestrator) {}

  async create(
    goal: StrategyGoal,
    options?: {
      onStep?: (step: string, status: 'start' | 'done' | 'error', message: string) => void;
    },
  ): Promise<Result<PipelineOutput>> {
    const familyId = randomUUID();

    return this.pipeline.run({
      goal,
      familyId,
      priorCids: [],
      priorVersions: [],
      actualOutcomes: null,
      triggerReason: 'user_request',
      emergencyUpdate: false,
      ...(options?.onStep ? ({ onStep: options.onStep } as { onStep: NonNullable<typeof options.onStep> }) : {}),
    });
  }
}
