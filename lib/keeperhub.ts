export class KeeperHubClient {
  constructor(private apiKey: string) { }

  private async request(method: string, path: string, body?: object) {
    const res = await fetch(`https://app.keeperhub.com${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok)
      throw new Error(
        `KeeperHub ${method} ${path}: ${res.status} ${await res.text()}`,
      );
    return res.json();
  }

  async getUser(): Promise<{
    id: string;
    name: string;
    email: string;
    walletAddress: string;
  }> {
    return this.request("GET", "/api/user");
  }

  async getUserInfo() {
    return this.getUser();
  }

  async listActionSchemas() {
    return this.request("GET", "/api/mcp/schemas");
  }

  async createWorkflow(workflow: object) {
    return this.request("POST", "/api/workflows/create", workflow);
  }

  async updateWorkflow(workflowId: string, workflow: object) {
    return this.request("PUT", `/api/workflows/${workflowId}`, workflow);
  }

  async executeWorkflow(workflowId: string) {
    // Note: singular /workflow/ not /workflows/
    return this.request("POST", `/api/workflows/${workflowId}/execute`, {});
  }

  async getExecutionStatus(executionId: string) {
    return this.request(
      "GET",
      `/api/workflows/executions/${executionId}/status`,
    );
  }

  async getExecutionLogs(executionId: string) {
    return this.request("GET", `/api/workflows/executions/${executionId}/logs`);
  }

  async listWorkflows() {
    return this.request("GET", "/api/workflows");
  }

  async getAnalyticsSummary(range = "7d") {
    return this.request("GET", `/api/analytics/summary?range=${range}`);
  }

  async getExecutionRuns(params: { status?: string; range?: string } = {}) {
    const q = new URLSearchParams(params as Record<string, string>).toString();
    return this.request("GET", `/api/analytics/runs?${q}`);
  }

  async validatePluginConfig(actionType: string, config: object) {
    return this.request("POST", "/api/mcp/validate", { actionType, config });
  }
}
