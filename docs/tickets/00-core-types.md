# Ticket: Core Types Package

> **Package:** `packages/core`
> **Priority:** Day 0 — create FIRST, everything depends on this
> **Dependencies:** none
> **Read first:** `CLAUDE.md`, `docs/architecture.md`

## What to Build

Create all shared TypeScript types in `packages/core/src/types/`. These are imported by every other package.

## Files to Create

### `packages/core/src/types/strategy.ts`

```typescript
export type Lifecycle = 'draft' | 'paper' | 'canary' | 'stable' | 'deprecated';
export type RiskLevel = 'conservative' | 'balanced';
export type Protocol = 'aave' | 'morpho' | 'spark';
export type Chain = 'ethereum' | 'base';

export interface StrategyGoal {
  asset: string;               // e.g. "USDC"
  amount: number;              // e.g. 50000
  riskLevel: RiskLevel;
  horizon: string;             // e.g. "6mo"
  chains: Chain[];
}

export interface AllocationEntry {
  protocol: Protocol;
  chain: Chain;
  asset: string;
  percentage: number;          // 0-100
}

export interface StrategyVersion {
  familyId: string;            // e.g. "conservative-stablecoin-yield"
  version: number;
  cid: string;                 // 0G Storage root hash
  priorCids: string[];         // root hashes of prior versions
  lifecycle: Lifecycle;
  allocation: AllocationEntry[];
  createdAt: number;           // unix ms
  keeperhubWorkflowId?: string;
  evidenceBundleCid: string;   // CID of the evidence bundle
}

export interface StrategyFamily {
  familyId: string;
  goal: StrategyGoal;
  versions: StrategyVersion[];
  latestStable?: string;       // CID
}
```

### `packages/core/src/types/evidence.ts`

```typescript
export interface EvidenceBundle {
  strategyFamily: string;
  version: number;
  priorCids: string[];
  pipeline: PipelineEvidence;
  outcomes?: OutcomeRecord;
  createdAt: number;
}

export interface PipelineEvidence {
  researcher: StepEvidence;
  strategist: StepEvidence;
  critic: StepEvidence;
  compiler: { workflowSpec: Record<string, unknown> };
  riskValidator: { passed: boolean; warnings: string[] };
  simulator: { estimatedNetAPY: number; estimatedGasCost: number };
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
```

### `packages/core/src/types/pipeline.ts`

```typescript
import type { StrategyGoal, AllocationEntry } from './strategy.js';
import type { EvidenceBundle } from './evidence.js';

export interface MarketSnapshot {
  protocols: ProtocolData[];
  fetchedAt: number;
}

export interface ProtocolData {
  name: string;
  chain: string;
  pool: string;
  apy: number;
  tvl: number;
  utilization: number;
  auditStatus: 'audited' | 'unaudited';
  exploitHistory: { date: number; severity: string }[];
}

export interface PipelineContext {
  goal: StrategyGoal;
  priorVersions: EvidenceBundle[];
  marketSnapshot: MarketSnapshot;
}

export interface CandidateAllocation {
  id: string;
  allocation: AllocationEntry[];
  hypothesis: string;
  confidence: number;
}

export interface CandidateVerdict {
  candidateId: string;
  approved: boolean;
  risks: string[];
  constraints: string[];
}

export interface SealedInferenceResult {
  response: string;
  attestationHash: string;
  model: string;
  provider: string;
}
```

### `packages/core/src/types/keeperhub.ts`

```typescript
export interface WorkflowSpec {
  name: string;
  description: string;
  trigger: {
    type: 'cron';
    schedule: string;
  };
  steps: WorkflowStep[];
}

export interface WorkflowStep {
  id: string;
  type: 'condition' | 'action' | 'notification';
  condition?: {
    check: string;
    threshold: number;
    actionIfFalse: 'skip' | 'defer';
  };
  action?: {
    protocol: string;
    method: string;
    params: Record<string, unknown>;
    chain: string;
  };
  dependsOn?: string[];
}

export interface WorkflowStatus {
  workflowId: string;
  status: 'active' | 'paused' | 'stopped';
  lastRunAt?: number;
  totalRuns: number;
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
```

### `packages/core/src/types/result.ts`

```typescript
// Result type for error handling without exceptions
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
```

### `packages/core/src/types/index.ts`

```typescript
export * from './strategy.js';
export * from './evidence.js';
export * from './pipeline.js';
export * from './keeperhub.js';
export * from './result.js';
```

### `packages/core/src/index.ts`

```typescript
export * from './types/index.js';
```

## Do NOT

- Do NOT add any business logic to this package — types only + Result helpers
- Do NOT import from any other `@strategyforge/*` package
- Do NOT use `any` — use `Record<string, unknown>` for flexible objects
