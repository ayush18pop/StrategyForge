# Ticket: KeeperHub MCP Client

> **Package:** `packages/keeperhub`
> **Priority:** Day 1
> **Dependencies:** `@strategyforge/core` (types)
> **Read first:** `CLAUDE.md`, `docs/keeperhub_reference.md`

## What to Build

A typed client wrapping KeeperHub's MCP tools for workflow CRUD and publishing.

## File: `packages/keeperhub/src/client.ts`

### Interface

```typescript
import type { WorkflowSpec, WorkflowStatus, ExecutionLog } from '@strategyforge/core';
import type { Result } from '@strategyforge/core';

export interface KeeperHubConfig {
  apiKey: string;
  apiUrl: string;
}

export interface KeeperHubClient {
  // Workflow CRUD
  createWorkflow(spec: WorkflowSpec): Promise<Result<{ workflowId: string }>>;
  getWorkflow(workflowId: string): Promise<Result<WorkflowStatus>>;
  runWorkflow(workflowId: string): Promise<Result<{ executionId: string }>>;
  pauseWorkflow(workflowId: string): Promise<Result<void>>;

  // Execution
  getExecutionLogs(executionId: string): Promise<Result<ExecutionLog[]>>;

  // Marketplace
  publishWorkflow(params: {
    workflowId: string;
    pricePerRun: string;       // in USDC, e.g. "0.01"
    paymentNetwork: string;    // e.g. "ethereum"
  }): Promise<Result<void>>;

  // Data
  listProtocols(): Promise<Result<{ name: string; chain: string }[]>>;
}
```

### Implementation Notes

- Start with REST/HTTP wrapper (most flexible)
- Can switch to MCP protocol later if needed
- All methods return `Result<T>` — never throw

## Do NOT

- Do NOT build workflow templates here — that's the compiler (pipeline package)
- Do NOT handle x402 payments here — separate ticket
