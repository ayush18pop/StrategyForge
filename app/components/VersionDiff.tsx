"use client";

import React from "react";

interface VersionDiffProps {
  v1: {
    version: number;
    goal: string;
    suboptimalReason?: string;
    executionId?: string;
  };
  v2: {
    version: number;
    goal: string;
    evidenceOfLearning?: string;
  };
}

export function VersionDiff({ v1, v2 }: VersionDiffProps) {
  return (
    <div className="flex flex-col md:flex-row gap-4 items-stretch">
      {/* V1 Card */}
      <div className="flex-1 glass-card p-5 relative" style={{ borderColor: "rgba(255, 61, 113, 0.2)" }}>
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-hot-red/40" />
        <div className="flex items-center gap-2 mb-3">
          <span className="badge badge-deprecated">v{v1.version}</span>
        </div>
        <p className="text-xs text-text-secondary mb-4">{v1.goal}</p>
        {v1.suboptimalReason && (
          <div className="p-3 rounded-lg bg-hot-red/5 border border-hot-red/20">
            <p className="text-[10px] uppercase tracking-widest text-hot-red font-semibold mb-1">Suboptimal</p>
            <p className="text-xs text-hot-red/80 leading-relaxed">{v1.suboptimalReason}</p>
          </div>
        )}
      </div>

      {/* Bridge Arrow */}
      <div className="flex flex-col items-center justify-center gap-1 py-4 md:py-0">
        <div className="text-[10px] text-text-secondary uppercase tracking-widest whitespace-nowrap">
          learned from
        </div>
        <div className="flex items-center gap-1">
          <div className="w-8 h-[2px] bg-gradient-to-r from-hot-red to-acid-green" />
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6H10M10 6L7 3M10 6L7 9" stroke="var(--acid-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        {v1.executionId && (
          <div className="text-[9px] text-muted-metal">exec #{v1.executionId.slice(0, 8)}</div>
        )}
      </div>

      {/* V2 Card */}
      <div className="flex-1 glass-card p-5 relative" style={{ borderColor: "rgba(57, 255, 20, 0.2)" }}>
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-acid-green/40" />
        <div className="flex items-center gap-2 mb-3">
          <span className="badge badge-live">v{v2.version}</span>
        </div>
        <p className="text-xs text-text-secondary mb-4">{v2.goal}</p>
        {v2.evidenceOfLearning && (
          <div className="insight-box">
            <p className="text-[10px] uppercase tracking-widest text-acid-green font-semibold mb-1">Evidence of Learning</p>
            <p className="text-xs text-text-primary leading-relaxed">{v2.evidenceOfLearning}</p>
          </div>
        )}
      </div>
    </div>
  );
}
