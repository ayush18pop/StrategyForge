import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type Event = {
  station:
    | "Discovery"
    | "Researcher"
    | "Strategist"
    | "Critic"
    | "Compiler"
    | "Risk";
  type: "start" | "log" | "attest" | "end" | "candidate";
  text?: string;
  hash?: string;
  timestamp?: string;
};

const STATIONS = [
  "Discovery",
  "Researcher",
  "Strategist",
  "Critic",
  "Compiler",
  "Risk",
] as const;

type StationState = {
  status: "idle" | "running" | "done";
  lines: string[];
  attest?: string;
  candidates?: string[];
};

export function PipelineVisualizer({ sourceUrl }: { sourceUrl: string }) {
  const [stations, setStations] = useState<Record<string, StationState>>({
    Discovery: { status: "idle", lines: [] },
    Researcher: { status: "idle", lines: [] },
    Strategist: { status: "idle", lines: [] },
    Critic: { status: "idle", lines: [] },
    Compiler: { status: "idle", lines: [] },
    Risk: { status: "idle", lines: [] },
  });

  useEffect(() => {
    if (!sourceUrl) return;

    // Check if we are in browser environment
    if (typeof window === "undefined") return;

    const es = new EventSource(sourceUrl);
    es.onmessage = (ev) => {
      try {
        const d: Event = JSON.parse(ev.data);

        setStations((prev) => {
          const copy = { ...prev };
          const st = d.station;
          if (!copy[st]) return prev;

          // Mutable updates for performance in this stream
          const currentLines = [...copy[st].lines];

          if (d.type === "start") {
            copy[st] = { ...copy[st], status: "running" };
          } else if (d.type === "log" && d.text) {
            currentLines.push(d.text);
            copy[st] = { ...copy[st], lines: currentLines.slice(-8) };
          } else if (d.type === "candidate" && d.text) {
            const cands = copy[st].candidates
              ? [...copy[st].candidates, d.text]
              : [d.text];
            copy[st] = { ...copy[st], candidates: cands };
          } else if (d.type === "attest" && d.hash) {
            copy[st] = { ...copy[st], attest: d.hash };
          } else if (d.type === "end") {
            copy[st] = { ...copy[st], status: "done" };
          }

          return copy;
        });
      } catch (e) {
        console.error("Failed to parse pipeline event", e);
      }
    };

    es.onerror = (e) => {
      console.error("SSE Error", e);
    };

    return () => es.close();
  }, [sourceUrl]);

  return (
    <div className="pipeline-root w-full max-w-6xl mx-auto space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {STATIONS.map((key, index) => {
          const st = stations[key];
          const isRunning = st.status === "running";
          const isDone = st.status === "done";
          const isIdle = st.status === "idle";

          return (
            <motion.div
              layout
              key={key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`relative overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                isIdle ? "glass-thin opacity-60" : "glass-thick"
              } p-5 min-h-[220px] flex flex-col`}
              style={{
                transform: isRunning ? "translateY(-4px)" : "translateY(0)",
                boxShadow: isRunning
                  ? "0 12px 40px rgba(91, 108, 255, 0.15)"
                  : "none",
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5">
                <h3 className="font-geist tracking-tight font-medium text-lg flex items-center gap-2">
                  <span className="opacity-50 text-xs font-mono">
                    {index + 1}
                  </span>
                  {key}
                </h3>

                {/* Status indicator */}
                <div className="flex items-center gap-2">
                  {isRunning && (
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-500"></span>
                    </span>
                  )}
                  <span
                    className={`text-[11px] font-medium tracking-wide uppercase ${
                      isDone
                        ? "text-sage-400"
                        : isRunning
                          ? "text-accent-400"
                          : "text-white/30"
                    }`}
                  >
                    {st.status}
                  </span>
                </div>
              </div>

              {/* Log Lines Area */}
              <div
                className="flex-1 overflow-hidden pointer-events-none relative"
                style={{
                  maskImage:
                    "linear-gradient(to bottom, transparent, black 10%, black 80%, transparent)",
                }}
              >
                <div className="absolute inset-0 flex flex-col justify-end gap-1.5 pb-2">
                  <AnimatePresence initial={false}>
                    {st.lines.map((l, i) => (
                      <motion.div
                        key={i + l}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="text-xs font-mono text-white/70 truncate"
                      >
                        {l}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>

              {/* Candidates Fan (Strategist specific) */}
              {st.candidates && st.candidates.length > 0 && (
                <div className="mt-2 flex -space-x-4">
                  {st.candidates.map((cand, i) => (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8, x: -20 }}
                      animate={{ opacity: 1, scale: 1, x: 0 }}
                      transition={{ delay: i * 0.1, duration: 0.4 }}
                      key={i}
                      className="h-16 w-24 glass-regular rounded-lg border border-white/10 flex items-center justify-center text-[10px] p-2 truncate"
                      style={{ zIndex: st.candidates!.length - i }}
                    >
                      {cand}
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Attestation Hash */}
              <AnimatePresence>
                {st.attest && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, y: 10 }}
                    animate={{ opacity: 1, height: "auto", y: 0 }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    className="mt-4 pt-3 border-t border-white/5"
                  >
                    <div className="attest-block flex flex-col gap-1">
                      <span className="text-[10px] uppercase tracking-wide text-amber-500/80 font-medium">
                        TEE Attestation
                      </span>
                      <div className="font-mono text-xs text-amber-400 bg-amber-500/10 px-2 py-1.5 rounded-md flex items-center justify-between group cursor-pointer hover:bg-amber-500/20 transition-colors">
                        <span>
                          {st.attest.slice(0, 10)}...{st.attest.slice(-8)}
                        </span>
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px]">
                          Copy
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export default PipelineVisualizer;
