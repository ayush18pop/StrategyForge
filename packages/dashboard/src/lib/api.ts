import type { StrategyVersion } from './models';
import { PaymentRequiredError } from './payment';
export type { PaymentDetails } from './payment';
export { PaymentRequiredError } from './payment';

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

export interface UserAccountResponse {
  user: {
    wallet: string;
    displayName: string | null;
    createdAt: number;
    updatedAt: number;
    lastActiveAt: number;
  };
  stats: {
    familyCount: number;
    liveFamilyCount: number;
    versionCount: number;
    attestationCount: number;
    anchoredAttestationCount: number;
    pendingAttestationCount: number;
    stepCounts: {
      researcher: number;
      strategist: number;
      critic: number;
    };
  };
  families: Array<{
    familyId: string;
    goal: StrategyGoal;
    createdAt: number;
    updatedAt: number;
    versionCount: number;
    liveVersionCount: number;
    latestVersion: {
      version: number;
      lifecycle: 'draft' | 'live' | 'deprecated';
      createdAt: number;
      cid: string;
      evidenceBundleCid: string;
      keeperhubWorkflowId?: string;
    } | null;
  }>;
  recentAttestations: Array<{
    id: number;
    familyId: string;
    version: number;
    wallet: string;
    step: 'researcher' | 'strategist' | 'critic';
    attestationHash: string;
    strategyCid: string;
    evidenceBundleCid: string;
    storageStatus: 'anchored' | 'pending';
    createdAt: number;
  }>;
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

export type TelemetryWeightingMode = 'configured-amounts' | 'equal-fallback';
export type TelemetryDegradedMode =
  | 'healthy'
  | 'no-live-version'
  | 'no-protocol-match'
  | 'market-unavailable'
  | 'partial-history'
  | 'stale-market-data';

export interface StrategyYieldPoint {
  timestamp: number;
  estimatedStrategyApyPct: number;
  estimatedCumulativeYieldPct: number;
  targetCumulativeYieldPct: number;
}

export interface ReviewWindowTelemetry {
  nextReviewAt: number;
  monitorIntervalMs: number;
  source: 'latest-record' | 'created-at-fallback';
}

export interface TelemetryDegradedState {
  mode: TelemetryDegradedMode;
  message: string;
  notes: string[];
}

export interface LiveVersionTelemetry {
  version: number;
  createdAt: number;
  keeperhubWorkflowId?: string;
}

export interface ProtocolSparklinePoint {
  timestamp: number;
  apyPct: number;
}

export interface ProtocolTelemetry {
  protocolKey: string;
  protocolName: string;
  chain: string;
  asset: string;
  allocationWeightPct: number;
  currentApyPct: number | null;
  currentTvlUsd: number | null;
  marketAvailable: boolean;
  stale: boolean;
  sparkline: ProtocolSparklinePoint[];
  sourceProject?: string;
  sourcePoolId?: string;
}

export interface StrategyTelemetryBootstrap {
  familyId: string;
  liveVersion: LiveVersionTelemetry | null;
  telemetryPinnedVersion: number | null;
  targetYieldPct: number;
  estimatedStrategyApyPct: number | null;
  estimatedCumulativeYieldPct: number | null;
  weightingMode: TelemetryWeightingMode;
  reviewWindow: ReviewWindowTelemetry;
  protocols: ProtocolTelemetry[];
  chartPoints: StrategyYieldPoint[];
  degradedState: TelemetryDegradedState;
}

export interface StrategyTelemetrySnapshot {
  familyId: string;
  liveVersion: LiveVersionTelemetry | null;
  telemetryPinnedVersion: number | null;
  sampledAt: number;
  estimatedStrategyApyPct: number | null;
  estimatedCumulativeYieldPct: number | null;
  targetYieldPct: number;
  weightingMode: TelemetryWeightingMode;
  reviewWindow: ReviewWindowTelemetry;
  protocols: ProtocolTelemetry[];
  chartPoint: StrategyYieldPoint | null;
  stale: boolean;
  degradedState: TelemetryDegradedState;
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

export async function fetchUserAccount(wallet: string): Promise<UserAccountResponse> {
  return request<UserAccountResponse>(`/api/users/${encodeURIComponent(wallet)}`);
}

export async function searchFamilies(params: URLSearchParams): Promise<SearchResponse> {
  const query = params.toString();
  return request<SearchResponse>(`/api/strategies/search${query ? `?${query}` : ''}`);
}

export async function fetchFamily(familyId: string): Promise<StrategyFamilyResponse> {
  return request<StrategyFamilyResponse>(`/api/strategies/${familyId}`);
}

export async function fetchStrategyTelemetry(familyId: string): Promise<StrategyTelemetryBootstrap> {
  return request<StrategyTelemetryBootstrap>(`/api/strategies/${familyId}/telemetry`);
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

export interface MigrationResponse {
  migrationWorkflowId: string;
  executionId: string | null;
  warning?: string;
  withdraws: number;
  deposits: number;
  from: { version: number; workflowId?: string };
  to: { version: number; workflowId?: string };
}

export async function migrateFamily(familyId: string): Promise<MigrationResponse> {
  return request<MigrationResponse>(`/api/strategies/${familyId}/migrate`, {
    method: 'POST',
  });
}

export interface SubscriptionInfo {
  familyId: string;
  asset: string;
  principalAmount: number;
  accessFeeAmount: string;
  accessFeeRecipient: string;
  accessFeeNetwork: string;
  accessFeeCurrency: string;
  turnkeyWallet: string;
  keeperhubWorkflowId: string | null;
}

export interface SubscribeResponse {
  familyId: string;
  depositorAddress: string;
  turnkeyWallet: string;
  asset: string;
  expectedAmount: number;
  subscribedAt: number;
}

export async function fetchSubscriptionInfo(familyId: string): Promise<SubscriptionInfo> {
  return request<SubscriptionInfo>(`/api/strategies/${familyId}/subscription-info`);
}

export async function subscribeToStrategy(
  familyId: string,
  paymentHeader: string,
  depositorAddress: string,
  expectedAmount?: number,
): Promise<SubscribeResponse> {
  return request<SubscribeResponse>(`/api/strategies/${familyId}/subscribe`, {
    method: 'POST',
    headers: { 'X-Payment': paymentHeader },
    body: JSON.stringify({ depositorAddress, expectedAmount }),
  });
}

export async function fetchExecution(workflowId: string): Promise<ExecutionResponse> {
  return request<ExecutionResponse>(`/api/executions/${workflowId}`);
}

export async function requestWithPayment<T>(path: string, paymentHeader: string, init?: RequestInit): Promise<T> {
  return request<T>(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      'X-Payment': paymentHeader,
    },
  });
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
        { cause: error },
      );
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }

  if (response.status === 402) {
    const paymentDetails = await response.json() as import('./payment').PaymentDetails;
    throw new PaymentRequiredError(paymentDetails);
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
