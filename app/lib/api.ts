const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "";

export type PipelineRunEvent = {
  runId: string;
  stage: string;
  status: "start" | "progress" | "done" | "error";
  message: string;
  timestamp: number;
};

export function buildPipelineRunStreamUrl(runId: string): string {
  return `${API_BASE}/api/strategies/runs/${encodeURIComponent(runId)}/stream`;
}
