"use client";

import React from "react";

interface PipelineStep {
  name: string;
  icon: string;
  status: "pending" | "running" | "completed" | "error";
  attestationId?: string;
  output?: any;
}

interface PipelineRunnerProps {
  steps: PipelineStep[];
  onStepClick?: (index: number) => void;
}

export function PipelineRunner({ steps, onStepClick }: PipelineRunnerProps) {
  return (
    <div className="flex flex-col items-center gap-0">
      {steps.map((step, i) => (
        <React.Fragment key={i}>
          {/* Node */}
          <div
            className={`pipeline-node cursor-pointer ${step.status}`}
            onClick={() => onStepClick?.(i)}
            title={step.name}
          >
            <span className="text-lg">{step.icon}</span>
          </div>

          {/* Label */}
          <div className="text-center mt-2 mb-1">
            <div className="text-xs uppercase tracking-widest font-semibold" style={{
              color: step.status === "completed" ? "var(--neon-cyan)" :
                     step.status === "running" ? "var(--neon-cyan)" :
                     step.status === "error" ? "var(--hot-red)" :
                     "var(--muted-metal)"
            }}>
              {step.name}
            </div>
            {step.attestationId && (
              <div className="text-[10px] text-text-secondary mt-1 font-mono opacity-60 truncate max-w-[160px]">
                {step.attestationId}
              </div>
            )}
          </div>

          {/* Connector */}
          {i < steps.length - 1 && (
            <div className={`pipeline-connector ${step.status === "completed" ? "active" : ""}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

interface PipelineTerminalProps {
  logs: string[];
  isRunning: boolean;
}

export function PipelineTerminal({ logs, isRunning }: PipelineTerminalProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="code-block max-h-[300px] overflow-y-auto" ref={containerRef}>
      <div className="flex items-center gap-2 mb-3 text-xs text-text-secondary">
        <span className={`w-2 h-2 rounded-full ${isRunning ? "bg-acid-green animate-pulse" : "bg-muted-metal"}`} />
        <span className="uppercase tracking-widest">{isRunning ? "Pipeline Active" : "Pipeline Idle"}</span>
      </div>
      {logs.map((log, i) => (
        <div key={i} className="text-xs font-mono leading-relaxed" style={{ color: log.startsWith("✓") ? "var(--acid-green)" : log.startsWith("✗") ? "var(--hot-red)" : "var(--text-secondary)" }}>
          <span className="text-muted-metal mr-2 select-none">{String(i + 1).padStart(3, "0")}</span>
          {log}
        </div>
      ))}
      {isRunning && (
        <div className="text-xs text-neon-cyan mt-1 animate-pulse">▋</div>
      )}
    </div>
  );
}
