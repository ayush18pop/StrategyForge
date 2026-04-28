import { randomUUID } from 'node:crypto';

export type PipelineRunStage =
  | 'request_received'
  | 'pipeline_started'
  | 'discovery'
  | 'researcher'
  | 'strategist'
  | 'critic'
  | 'compiler'
  | 'risk_validator'
  | 'storage'
  | 'pipeline_completed'
  | 'deployment'
  | 'kv_save'
  | 'metadata_sync'
  | 'completed'
  | 'failed';

export type PipelineRunEvent = {
  runId: string;
  stage: PipelineRunStage;
  status: 'start' | 'progress' | 'done' | 'error';
  message: string;
  timestamp: number;
};

type Subscriber = (event: PipelineRunEvent) => void;

type PipelineRunRecord = {
  events: PipelineRunEvent[];
  subscribers: Set<Subscriber>;
  expiresAt: number;
};

const RUN_TTL_MS = 1000 * 60 * 15;
const runs = new Map<string, PipelineRunRecord>();

export function createPipelineRun(): string {
  const runId = randomUUID();
  runs.set(runId, {
    events: [],
    subscribers: new Set<Subscriber>(),
    expiresAt: Date.now() + RUN_TTL_MS,
  });
  return runId;
}

export function appendPipelineRunEvent(
  runId: string,
  event: Omit<PipelineRunEvent, 'runId' | 'timestamp'>,
): void {
  const record = runs.get(runId);
  if (!record) {
    return;
  }
  const next: PipelineRunEvent = {
    runId,
    timestamp: Date.now(),
    ...event,
  };
  record.events.push(next);
  record.expiresAt = Date.now() + RUN_TTL_MS;
  record.subscribers.forEach((fn) => fn(next));
}

export function getPipelineRunEvents(runId: string): PipelineRunEvent[] {
  const record = runs.get(runId);
  if (!record) {
    return [];
  }
  return [...record.events];
}

export function subscribePipelineRun(runId: string, subscriber: Subscriber): () => void {
  const record = runs.get(runId);
  if (!record) {
    return () => {};
  }
  record.subscribers.add(subscriber);
  return () => {
    record.subscribers.delete(subscriber);
  };
}

export function hasPipelineRun(runId: string): boolean {
  return runs.has(runId);
}

setInterval(() => {
  const now = Date.now();
  for (const [runId, record] of runs.entries()) {
    if (record.expiresAt <= now) {
      runs.delete(runId);
    }
  }
}, 60_000).unref();

