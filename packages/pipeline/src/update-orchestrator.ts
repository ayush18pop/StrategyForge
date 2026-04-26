import { ok, err } from '@strategyforge/core';
import type {
  UpdateTrigger,
  TriggerReason,
  EvidenceBundle,
  Result,
} from '@strategyforge/core';
import type { PipelineOrchestrator, PipelineOutput } from './pipeline-orchestrator.js';
import type { EvidenceStore, KVStore } from '@strategyforge/storage';
import { AnalyticsOutcomeFetcher } from './analytics-outcome.js';

// ─── UpdateOrchestrator ───────────────────────────────────────────
// Entry point for strategy updates triggered by drift/underperformance.
// Called by the server-side monitor cron; never directly from user input.

export interface UpdateOrchestratorConfig {
  keeperhubApiUrl: string;
  keeperhubApiKey: string;
}

export class UpdateOrchestrator {
  constructor(
    private readonly pipeline: PipelineOrchestrator,
    private readonly evidenceStore: EvidenceStore,
    private readonly kvStore: KVStore,
    private readonly config: UpdateOrchestratorConfig,
  ) {}

  async update(params: {
    familyId: string;
    trigger: UpdateTrigger;
  }): Promise<Result<PipelineOutput>> {
    const { familyId, trigger } = params;

    // 1. Load family state from KV: latest CID chain
    const familyKeyResult = await this.kvStore.get(`family:${familyId}:latest`);
    if (!familyKeyResult.ok) {
      return err(new Error(`Failed to load family state: ${familyKeyResult.error.message}`));
    }
    const familyData = familyKeyResult.value
      ? (JSON.parse(familyKeyResult.value) as { priorCids: string[]; goal: unknown; keeperhubWorkflowId?: string })
      : null;
    if (!familyData) {
      return err(new Error(`Family ${familyId} not found in KV store`));
    }

    const priorCids = familyData.priorCids ?? [];

    // 2. Load all prior EvidenceBundles from 0G Storage
    const priorVersions: EvidenceBundle[] = [];
    for (const cid of priorCids) {
      const readResult = await this.evidenceStore.readBundle(cid);
      if (!readResult.ok) {
        console.warn(`[UpdateOrchestrator] Could not load prior bundle ${cid}: ${readResult.error.message}`);
        continue;
      }
      priorVersions.push(readResult.value);
    }
    priorVersions.sort((a, b) => a.version - b.version);

    // 3. Fetch actual outcomes from KeeperHub analytics
    const workflowId = familyData.keeperhubWorkflowId ?? '';
    const analyticsFetcher = new AnalyticsOutcomeFetcher({
      apiUrl: this.config.keeperhubApiUrl,
      apiKey: this.config.keeperhubApiKey,
      workflowId,
    });
    const analyticsResult = await analyticsFetcher.fetch();
    const actualOutcomes = analyticsResult.ok ? analyticsResult.value : null;
    if (!analyticsResult.ok) {
      console.warn('[UpdateOrchestrator] Analytics fetch failed (continuing without outcomes):', analyticsResult.error.message);
    }

    // 4. Map trigger to TriggerReason
    const triggerReason = mapTrigger(trigger);
    const emergencyUpdate = trigger.reason === 'protocol_incident';

    // 5. The goal is stored in the first prior bundle
    const goal = priorVersions[0]
      ? (priorVersions[0] as unknown as { goal?: unknown }).goal
        ?? (familyData.goal as unknown)
      : familyData.goal as unknown;

    if (!goal) {
      return err(new Error(`Could not reconstruct StrategyGoal for family ${familyId}`));
    }

    // 6. Run pipeline with full prior context
    return this.pipeline.run({
      goal: goal as Parameters<typeof this.pipeline.run>[0]['goal'],
      familyId,
      priorCids,
      priorVersions,
      actualOutcomes,
      triggerReason,
      emergencyUpdate,
    });
  }
}

function mapTrigger(trigger: UpdateTrigger): TriggerReason {
  switch (trigger.reason) {
    case 'apy_drift':        return 'apy_drift';
    case 'underperformance': return 'underperformance';
    case 'protocol_incident': return 'protocol_incident';
    case 'scheduled_review': return 'scheduled_review';
  }
}
