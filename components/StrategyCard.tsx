"use client";

import React from "react";
import { StatusBadge } from "./ui";

interface StrategyCardProps {
  id: string;
  familyId: string;
  version: number;
  lifecycle: "draft" | "live" | "deprecated";
  goal: string;
  createdAt: string;
  keeperhubWorkflowId?: string;
  onClick?: () => void;
}

export function StrategyCard({
  familyId,
  version,
  lifecycle,
  goal,
  createdAt,
  keeperhubWorkflowId,
  onClick,
}: StrategyCardProps) {
  return (
    <div
      className="glass-card p-5 cursor-pointer group relative overflow-hidden"
      onClick={onClick}
    >
      {/* Deprecated watermark */}
      {lifecycle === "deprecated" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span
            className="text-hot-red text-4xl font-bold uppercase opacity-10 tracking-[0.3em]"
            style={{ transform: "rotate(-15deg)" }}
          >
            DEPRECATED
          </span>
        </div>
      )}

      {/* Top row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <StatusBadge status={lifecycle} />
          <span className="text-xs text-text-secondary">v{version}</span>
        </div>
        {keeperhubWorkflowId && (
          <a
            href={`https://app.keeperhub.com/workflows/${keeperhubWorkflowId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-neon-cyan hover:underline truncate max-w-[120px]"
            onClick={(e) => e.stopPropagation()}
          >
            KH: {keeperhubWorkflowId.slice(0, 8)}…
          </a>
        )}
      </div>

      {/* Family ID */}
      <h3 className="text-sm font-bold text-text-primary mb-2 uppercase tracking-wider group-hover:text-neon-cyan transition-colors">
        {familyId}
      </h3>

      {/* Goal */}
      <p className="text-xs text-text-secondary leading-relaxed line-clamp-2 mb-4">
        {goal}
      </p>

      {/* Bottom */}
      <div className="text-[10px] text-muted-metal">
        {new Date(createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </div>

      {/* Hover scanline */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none overflow-hidden">
        <div
          className="absolute left-0 right-0 h-[2px] bg-neon-cyan/20"
          style={{ animation: "scan-sweep 1.5s ease-in-out infinite", top: 0 }}
        />
      </div>

      <style jsx>{`
        @keyframes scan-sweep {
          0% {
            top: 0;
          }
          100% {
            top: 100%;
          }
        }
      `}</style>
    </div>
  );
}
