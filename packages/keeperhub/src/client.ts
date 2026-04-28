import { err, ok } from "@strategyforge/core";
import type {
  ActionSchema,
  ExecutionLog,
  Result,
  WorkflowSpec,
  WorkflowStatus,
} from "@strategyforge/core";

export interface KeeperHubClientConfig {
  apiKey: string;
  apiUrl: string;
}

export interface KeeperHubClient {
  listActionSchemas(): Promise<Result<ActionSchema[]>>;
  createWorkflow(spec: WorkflowSpec): Promise<Result<{ workflowId: string }>>;
  getWorkflow(workflowId: string): Promise<Result<WorkflowStatus>>;
  runWorkflow(workflowId: string): Promise<Result<{ executionId: string }>>;
  pauseWorkflow(workflowId: string): Promise<Result<void>>;
  getExecutionLogs(executionId: string): Promise<Result<ExecutionLog[]>>;
  publishWorkflow(params: {
    workflowId: string;
    pricePerRun: string;
    paymentNetwork: string;
  }): Promise<Result<void>>;
  listProtocols(): Promise<Result<Array<{ name: string; chain: string }>>>;
}

export class HttpKeeperHubClient implements KeeperHubClient {
  private readonly apiUrl: string;

  constructor(private readonly config: KeeperHubClientConfig) {
    this.apiUrl = config.apiUrl.replace(/\/$/, "");
  }

  async listActionSchemas(): Promise<Result<ActionSchema[]>> {
    // Different deployments may expose schemas under slightly different routes
    // depending on whether apiUrl already includes `/api`.
    const endpointCandidates = [
      "/mcp/schemas",
      "/api/mcp/schemas",
      "/mcp/schema",
    ];

    let lastError: Error | null = null;

    for (const path of endpointCandidates) {
      const response = await this.request<{
        actions?: Record<string, ActionSchema>;
        schemas?: Record<string, ActionSchema> | ActionSchema[];
      }>("GET", path);

      if (!response.ok) {
        lastError = response.error;
        continue;
      }

      const { actions, schemas } = response.value;

      // The API returns `actionType` as the field name, not `type`.
      // We normalize here so callers always read `schema.type`.
      const normalize = (key: string, raw: ActionSchema): ActionSchema => ({
        ...raw,
        type:
          raw.type ??
          ((raw as unknown as Record<string, unknown>).actionType as string) ??
          key,
      });

      if (actions && typeof actions === "object" && !Array.isArray(actions)) {
        return ok(
          Object.entries(actions)
            .map(([k, v]) => normalize(k, v))
            .filter((s) => typeof s.type === "string" && s.type.length > 0),
        );
      }

      if (schemas) {
        if (Array.isArray(schemas)) {
          return ok(
            schemas
              .map((s) => normalize(s.type ?? "", s))
              .filter((s) => s.type),
          );
        }
        if (typeof schemas === "object") {
          return ok(
            Object.entries(schemas as Record<string, ActionSchema>)
              .map(([k, v]) => normalize(k, v))
              .filter((s) => s.type),
          );
        }
      }
    }

    return err(
      lastError ??
        new Error(
          `list_action_schemas failed for all known endpoints. apiUrl=${this.apiUrl}`,
        ),
    );
  }

  async createWorkflow(
    spec: WorkflowSpec,
  ): Promise<Result<{ workflowId: string }>> {
    const payload = this.buildCreateWorkflowPayload(spec);
    const response = await this.request<{
      id?: string;
      workflowId?: string;
      data?: { id?: string; workflowId?: string };
    }>("POST", "/workflows/create", payload);
    if (!response.ok) {
      return response;
    }

    const workflowId =
      response.value.workflowId ??
      response.value.id ??
      response.value.data?.workflowId ??
      response.value.data?.id;
    if (!workflowId) {
      return err(new Error("KeeperHub response missing workflowId"));
    }

    return ok({ workflowId });
  }

  private buildCreateWorkflowPayload(spec: WorkflowSpec): {
    name: string;
    description?: string;
    nodes: Array<{
      id: string;
      type: string;
      data: {
        type: string;
        label: string;
        config: Record<string, unknown>;
        status: "idle";
      };
      position: { x: number; y: number };
    }>;
    edges: Array<{
      id: string;
      source: string;
      target: string;
      sourceHandle?: string;
    }>;
  } {
    // KeeperHub trigger nodes use a capitalized triggerType and scheduleCron (not "cron").
    // Our WorkflowSpec.trigger.config uses { cron } so we map it here.
    const triggerConfig = this.buildTriggerConfig(spec.trigger);

    const triggerNode = {
      id: "trigger",
      type: "trigger",
      data: {
        type: "trigger",
        label: `${triggerConfig.triggerType} Trigger`,
        config: triggerConfig,
        status: "idle" as const,
      },
      position: { x: 120, y: 80 },
    };

    // KeeperHub expects action nodes as:
    // - outer type: "action"
    // - data.type: "action"
    // - data.config.actionType: selected action slug (e.g. "aave-v3/supply")
    const actionNodes = spec.nodes.map((node, index) => {
      const config: Record<string, unknown> = {
        ...node.config,
      };

      if (!config.actionType) {
        config.actionType = node.type;
      }

      return {
        id: node.id,
        type: "action",
        data: {
          type: "action",
          label:
            node.label ??
            node.id
              .replace(/[-_]/g, " ")
              .replace(/\b\w/g, (c) => c.toUpperCase()),
          config,
          status: "idle" as const,
        },
        position: { x: 120, y: 240 + index * 160 },
      };
    });

    const edges = spec.edges.map((edge) => {
      const sourceHandle =
        typeof edge.sourceHandle === "string" && edge.sourceHandle.length > 0
          ? edge.sourceHandle
          : undefined;

      return {
        id: `${edge.source}:${sourceHandle ?? "default"}->${edge.target}`,
        source: edge.source,
        target: edge.target,
        ...(sourceHandle ? { sourceHandle } : {}),
      };
    });

    return {
      name: spec.name,
      description: spec.description,
      nodes: [triggerNode, ...actionNodes],
      edges,
    };
  }

  private buildTriggerConfig(
    trigger: WorkflowSpec["trigger"],
  ): Record<string, unknown> {
    const triggerType =
      trigger.type.charAt(0).toUpperCase() + trigger.type.slice(1);

    if (trigger.type === "schedule") {
      const { cron, ...rest } = trigger.config as { cron?: string } & Record<
        string,
        unknown
      >;
      return {
        triggerType,
        ...(cron ? { scheduleCron: cron } : {}),
        ...rest,
      };
    }

    return { triggerType, ...trigger.config };
  }

  async getWorkflow(workflowId: string): Promise<Result<WorkflowStatus>> {
    return this.request<WorkflowStatus>("GET", `/workflows/${workflowId}`);
  }

  async runWorkflow(
    workflowId: string,
  ): Promise<Result<{ executionId: string }>> {
    const endpointCandidates = [
      `/workflow/${workflowId}/execute`,
      `/workflows/${workflowId}/execute`,
      `/workflows/${workflowId}/run`,
    ];

    let lastError: Error | null = null;
    for (const path of endpointCandidates) {
      const response = await this.request<{
        executionId?: string;
        runId?: string;
        data?: { executionId?: string; runId?: string };
      }>("POST", path);

      if (!response.ok) {
        lastError = response.error;
        continue;
      }

      const executionId =
        response.value.executionId ??
        response.value.runId ??
        response.value.data?.executionId ??
        response.value.data?.runId;

      if (!executionId) {
        return err(new Error("KeeperHub response missing executionId"));
      }

      return ok({ executionId });
    }

    return err(lastError ?? new Error("KeeperHub run workflow request failed"));
  }

  async pauseWorkflow(workflowId: string): Promise<Result<void>> {
    const response = await this.request<unknown>(
      "POST",
      `/workflows/${workflowId}/pause`,
    );
    return response.ok ? ok(undefined) : response;
  }

  async getExecutionLogs(executionId: string): Promise<Result<ExecutionLog[]>> {
    const endpointCandidates = [
      `/workflows/executions/${executionId}/logs`,
      `/executions/${executionId}/logs`,
    ];

    let lastError: Error | null = null;
    for (const path of endpointCandidates) {
      const response = await this.request<ExecutionLog[]>("GET", path);
      if (response.ok) {
        return response;
      }
      lastError = response.error;
    }

    return err(
      lastError ?? new Error("KeeperHub execution log request failed"),
    );
  }

  async publishWorkflow(params: {
    workflowId: string;
    pricePerRun: string;
    paymentNetwork: string;
  }): Promise<Result<void>> {
    const endpointCandidates = [
      {
        method: "PUT" as const,
        path: `/workflows/${params.workflowId}/go-live`,
        body: {
          pricePerRun: params.pricePerRun,
          paymentNetwork: params.paymentNetwork,
        },
      },
      {
        method: "POST" as const,
        path: `/workflows/${params.workflowId}/publish`,
        body: {
          pricePerRun: params.pricePerRun,
          paymentNetwork: params.paymentNetwork,
        },
      },
      {
        method: "POST" as const,
        path: "/workflows/publish",
        body: params,
      },
    ];

    let lastError: Error | null = null;
    for (const candidate of endpointCandidates) {
      const response = await this.request<unknown>(
        candidate.method,
        candidate.path,
        candidate.body,
      );
      if (response.ok) {
        return ok(undefined);
      }
      lastError = response.error;
      if (!isMethodNotAllowed(response.error)) {
        break;
      }
    }

    return err(lastError ?? new Error("KeeperHub publish request failed"));
  }

  async listProtocols(): Promise<
    Result<Array<{ name: string; chain: string }>>
  > {
    return this.request<Array<{ name: string; chain: string }>>(
      "GET",
      "/protocols",
    );
  }

  private async request<T>(
    method: "GET" | "POST" | "PUT",
    path: string,
    body?: unknown,
  ): Promise<Result<T>> {
    try {
      const response = await fetch(`${this.apiUrl}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const errorText = await response.text();
        return err(
          new Error(
            `KeeperHub API error: ${response.status} ${response.statusText}${
              errorText ? ` - ${errorText}` : ""
            }`,
          ),
        );
      }

      if (response.status === 204) {
        return ok(undefined as T);
      }

      const data = (await response.json()) as T;
      return ok(data);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }
}

function isMethodNotAllowed(error: Error): boolean {
  return /405\b|Method Not Allowed/i.test(error.message);
}
