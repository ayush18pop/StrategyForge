import type { AnalyticsOutcome, FailedRun, StepFailure, Result } from '@strategyforge/core';
import { ok, err } from '@strategyforge/core';

// ─── Types ───────────────────────────────────────────────────────

export interface AnalyticsConfig {
  apiUrl: string;
  apiKey: string;
  workflowId: string;
}

// ─── AnalyticsOutcomeFetcher ──────────────────────────────────────

export class AnalyticsOutcomeFetcher {
  constructor(private readonly config: AnalyticsConfig) {}

  async fetch(): Promise<Result<AnalyticsOutcome>> {
    try {
      const [summaryResult, failedRunsResult, networksResult] = await Promise.all([
        this.get<SummaryResponse>(`/api/analytics/summary?range=7d`),
        this.get<RunListResponse>(`/api/analytics/runs?status=error`),
        this.get<NetworkBreakdownResponse>(`/api/analytics/networks`),
      ]);

      if (!summaryResult.ok) return err(summaryResult.error);
      if (!failedRunsResult.ok) return err(failedRunsResult.error);
      if (!networksResult.ok) return err(networksResult.error);

      // Fetch step-level failures for each failed run
      const failedRuns: FailedRun[] = [];
      const allStepFailures: StepFailure[] = [];

      for (const run of failedRunsResult.value.runs ?? []) {
        const stepsResult = await this.get<StepListResponse>(
          `/api/analytics/runs/${run.executionId}/steps`,
        );
        const steps: StepFailure[] = stepsResult.ok
          ? mapStepFailures(stepsResult.value.steps ?? [])
          : [];

        failedRuns.push({
          executionId: run.executionId,
          failedAt: run.failedAt,
          steps,
        });
        allStepFailures.push(...steps);
      }

      return ok({
        successRate: summaryResult.value.successRate ?? 1,
        failedRuns,
        stepFailures: allStepFailures,
        networkBreakdown: (networksResult.value.networks ?? []).map(n => ({
          network: n.network,
          successRate: n.successRate ?? 1,
        })),
      });
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  private async get<T>(path: string): Promise<Result<T>> {
    try {
      const baseUrl = this.config.apiUrl.replace(/\/$/, '');
      const response = await fetch(`${baseUrl}${path}`, {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          'x-workflow-id': this.config.workflowId,
        },
      });
      if (!response.ok) {
        return err(new Error(`Analytics API ${path}: HTTP ${response.status} ${response.statusText}`));
      }
      return ok(await response.json() as T);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }
}

// ─── API response shapes (KeeperHub analytics) ────────────────────

interface SummaryResponse {
  successRate?: number;
  totalRuns?: number;
  successfulRuns?: number;
  failedRuns?: number;
}

interface RunListResponse {
  runs?: Array<{
    executionId: string;
    failedAt: string;
    workflowId?: string;
  }>;
}

interface StepListResponse {
  steps?: Array<{
    nodeId?: string;
    nodeName?: string;
    errorMessage?: string;
    protocol?: string;
    status?: string;
  }>;
}

interface NetworkBreakdownResponse {
  networks?: Array<{
    network: string;
    successRate?: number;
  }>;
}

function mapStepFailures(
  steps: NonNullable<StepListResponse['steps']>,
): StepFailure[] {
  return steps
    .filter(s => s.status === 'failed' || s.errorMessage)
    .map(s => ({
      nodeId: s.nodeId ?? 'unknown',
      nodeName: s.nodeName ?? 'unknown',
      errorMessage: s.errorMessage ?? 'no error message',
      protocol: s.protocol,
    }));
}
