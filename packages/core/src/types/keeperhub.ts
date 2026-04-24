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
