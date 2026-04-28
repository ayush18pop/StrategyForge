import type { Result } from './result.js';

// KeeperHub's native workflow format — used directly with create_workflow MCP tool.
// Node `type` values MUST be discovered via list_action_schemas on day 1.
// Do NOT hardcode type strings without verifying them first.
export interface WorkflowSpec {
  name: string;
  description: string;
  trigger: {
    type: "schedule" | "manual" | "webhook" | "event";
    config: Record<string, unknown>; // e.g. { cron: "0 */6 * * *" } for schedule
  };
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface WorkflowNode {
  id: string; // unique within workflow, e.g. "node-aave-supply"
  type: string; // action type from list_action_schemas, e.g. "aave.supply"
  config: Record<string, unknown>; // action-specific config, schema from list_action_schemas
  label?: string; // optional human-readable label for UI
}

export interface WorkflowEdge {
  source: string; // node id or "trigger"
  target: string; // node id
  sourceHandle?: string; // e.g. "true", "false", "loop", "done"
}

export interface WorkflowStatus {
  workflowId: string;
  status: "active" | "paused" | "stopped";
  lastRunAt?: number;
  totalRuns: number;
}

export interface ExecutionLog {
  executionId: string;
  timestamp: number;
  stepId: string;
  status: "success" | "failed" | "skipped";
  gasUsed?: string;
  txHash?: string;
  error?: string;
}

export interface ActionSchema {
  type: string;
  label?: string;
  description?: string;
  category?: string;
  integration?: string;
  requiresCredentials?: boolean;
  requiredFields?: Record<string, string>;
  optionalFields?: Record<string, string>;
  outputFields?: Record<string, string>;
}

export interface ActionSchemaSource {
  listActionSchemas(): Promise<Result<ActionSchema[]>>;
}
