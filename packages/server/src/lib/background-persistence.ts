/**
 * Fire-and-forget persistence scheduler.
 *
 * Runs 0G persistence tasks (KV save, metadata sync) in the background
 * so API responses are never blocked by slow/flaky network operations.
 */

import { appendPipelineRunEvent } from './pipeline-runs.js';

interface PersistenceTask {
    name: string;
    fn: () => Promise<{ ok: boolean; error?: Error }>;
}

interface PersistenceJob {
    /** Human-readable label for log messages, e.g. "family:abc123" */
    label: string;
    /** If set, SSE events are pushed to this pipeline run */
    runId?: string | null;
    /** Tasks to run sequentially */
    tasks: PersistenceTask[];
}

/**
 * Schedule persistence work to run in the background.
 * Returns immediately — never throws, never blocks.
 */
export function schedulePersistence(job: PersistenceJob): void {
    // Detached promise — intentionally not awaited.
    void runPersistenceJob(job);
}

async function runPersistenceJob(job: PersistenceJob): Promise<void> {
    for (const task of job.tasks) {
        try {
            const result = await task.fn();
            if (result.ok) {
                console.log(`[Persistence] ${job.label} → ${task.name}: OK`);
            } else {
                console.warn(
                    `[Persistence] ${job.label} → ${task.name}: FAILED — ${result.error?.message ?? 'unknown'}`,
                );
            }

            if (job.runId) {
                appendPipelineRunEvent(job.runId, {
                    stage: task.name as Parameters<typeof appendPipelineRunEvent>[1]['stage'],
                    status: result.ok ? 'done' : 'error',
                    message: result.ok
                        ? `${task.name} completed`
                        : (result.error?.message ?? `${task.name} failed`),
                });
            }
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            console.warn(`[Persistence] ${job.label} → ${task.name}: THREW — ${msg}`);

            if (job.runId) {
                appendPipelineRunEvent(job.runId, {
                    stage: task.name as Parameters<typeof appendPipelineRunEvent>[1]['stage'],
                    status: 'error',
                    message: msg,
                });
            }
        }
    }

    if (job.runId) {
        appendPipelineRunEvent(job.runId, {
            stage: 'completed',
            status: 'done',
            message: `Background persistence for ${job.label} finished`,
        });
    }
}
