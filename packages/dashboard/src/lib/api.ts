                import type { StrategyVersion } from './models';

export interface SearchResponse {
  matches: Array<{
    familyId: string;
    goal: StrategyGoal;
    versionCount: number;
    latestVersionCid: string;
    latestVersion: StrategyVersion;
  }>;
  total: number;
}

export interface StrategyGoal {
  asset: string;
  amount: number;
  riskLevel: 'balanced' | 'conservative';
  horizon: string;
  chains: string[];
  targetYield: number;
}

export interface StrategyFamilyResponse {
  familyId: string;
  goal: StrategyGoal;
  userWalletAddress: string;
  versions: StrategyVersion[];
  createdAt: number;
}

export interface CreateStrategyPayload {
  goal: StrategyGoal;
  userWalletAddress: string;
  runId?: string;
}

export interface PipelineRunEvent {
  runId: string;
  stage: string;
  status: 'start' | 'progress' | 'done' | 'error';
  message: string;
  timestamp: number;
}

export interface CreateStrategyResponse {
  familyId: string;
  goal: StrategyGoal;
  userWalletAddress: string;
  strategy: StrategyVersion;
  deployment: {
    attempted: boolean;
    deployed: boolean;
    workflowId?: string;
    error?: string;
  };
}

export interface UpdateResponse {
  familyId: string;
  strategy: StrategyVersion;
  workflowId?: string;
  deployment?: {
    attempted: boolean;
    deployed: boolean;
    workflowId?: string;
    error?: string;
  };
}

export interface ExecutionLog {
  executionId: string;
  timestamp: number;
  stepId: string;
  status: 'success' | 'failed' | 'skipped';
  gasUsed?: string;
  txHash?: string;
  error?: string;
}

export interface WorkflowStatus {
  workflowId: string;
  status: 'active' | 'paused' | 'stopped';
  lastRunAt?: number;
  totalRuns: number;
}

export interface ExecutionResponse {
  workflowId: string;
  executionId: string;
  status: WorkflowStatus | null;
  logs: ExecutionLog[];
  workflowStatusError?: string;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? '';
const REQUEST_TIMEOUT_MS = readRequestTimeoutMs();

export async function fetchHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/health');
}

export async function searchFamilies(params: URLSearchParams): Promise<SearchResponse> {
  const query = params.toString();
  return request<SearchResponse>(`/api/strategies/search${query ? `?${query}` : ''}`);
}

export async function fetchFamily(familyId: string): Promise<StrategyFamilyResponse> {
  return request<StrategyFamilyResponse>(`/api/strategies/${familyId}`);
}

export async function createStrategy(payload: CreateStrategyPayload): Promise<CreateStrategyResponse> {
  return request<CreateStrategyResponse>('/api/strategies', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createPipelineRun(): Promise<{ runId: string }> {
  return request<{ runId: string }>('/api/strategies/runs', {
    method: 'POST',
  });
}

export function buildPipelineRunStreamUrl(runId: string): string {
  return `${API_BASE}/api/strategies/runs/${encodeURIComponent(runId)}/stream`;
}

export async function deployFamily(familyId: string): Promise<UpdateResponse> {
  return request<UpdateResponse>(`/api/strategies/${familyId}/deploy`, {
    method: 'POST',
  });
}

export async function requestScheduledUpdate(familyId: string): Promise<CreateStrategyResponse> {
  return request<CreateStrategyResponse>(`/api/strategies/${familyId}/update`, {
    method: 'POST',
    body: JSON.stringify({ reason: 'scheduled_review' }),
  });
}

export async function requestIncidentUpdate(
  familyId: string,
  protocol: string,
  description: string,
): Promise<CreateStrategyResponse> {
  return request<CreateStrategyResponse>(`/api/strategies/${familyId}/update`, {
    method: 'POST',
    body: JSON.stringify({ reason: 'protocol_incident', protocol, description }),
  });
}

export async function fetchExecution(workflowId: string): Promise<ExecutionResponse> {
  return request<ExecutionResponse>(`/api/executions/${workflowId}`);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(
        `Request timed out after ${Math.round(REQUEST_TIMEOUT_MS / 1000)}s while waiting for server pipeline completion.`,
      );
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? `${response.status} ${response.statusText}`;
  } catch {
    return `${response.status} ${response.statusText}`;
  }
}

function readRequestTimeoutMs(): number {
  const raw = import.meta.env.VITE_API_REQUEST_TIMEOUT_MS;
  if (!raw) {
    return 180_000;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 180_000;
  }

  return parsed;
}
