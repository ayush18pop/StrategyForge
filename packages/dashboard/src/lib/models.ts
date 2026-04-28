export interface StrategyVersion {
  familyId: string;
  version: number;
  cid: string;
  priorCids: string[];
  lifecycle: 'draft' | 'live' | 'deprecated';
  workflowSpec: Record<string, unknown>;
  createdAt: number;
  keeperhubWorkflowId?: string;
  evidenceBundleCid: string;
}

export interface WorkflowSpec {
  name?: string;
  description?: string;
  trigger?: {
    type?: string;
    config?: Record<string, unknown>;
  };
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
}

export interface WorkflowNode {
  id: string;
  type: string;
  config: Record<string, unknown>;
  label?: string;
}

export interface WorkflowEdge {
  source: string;
  target: string;
  sourceHandle?: string;
}
