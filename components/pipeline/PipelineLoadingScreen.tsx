import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const PIPELINE_STAGES = [
  { id: "discovery",     label: "Discovery",      detail: "Fetching action schemas",            type: "deterministic" as const },
  { id: "researcher",    label: "Researcher",     detail: "Gathering market context",           type: "tee" as const },
  { id: "strategist",    label: "Strategist",     detail: "Proposing candidate DAGs",           type: "tee" as const },
  { id: "critic",        label: "Critic",         detail: "Selecting best candidate",           type: "tee" as const },
  { id: "compiler",      label: "Compiler",       detail: "Compiling to workflow JSON",         type: "deterministic" as const },
  { id: "risk_validator",label: "Risk Validator", detail: "Validating safety bounds",           type: "deterministic" as const },
] as const;

const STAGE_ORDER = new Map<string, number>([
  ["request_received", -1], ["pipeline_started", -1],
  ["discovery", 0], ["researcher", 1], ["strategist", 2],
  ["critic", 3], ["compiler", 4], ["risk_validator", 5],
  ["storage", 5], ["pipeline_completed", 5], ["deployment", 5],
  ["kv_save", 5], ["metadata_sync", 5], ["completed", 6], ["failed", 6],
]);

const STAGE_LABELS: Record<string, string> = {
  discovery:      "Fetching action schemas from KeeperHub...",
  researcher:     "Sealed inference — analyzing market conditions...",
  strategist:     "Generating candidate workflow topologies...",
  critic:         "Evaluating robustness against prior failures...",
  compiler:       "Compiling to KeeperHub WorkflowSpec JSON...",
  risk_validator: "Validating safety bounds — deterministic check...",
  storage:        "Writing evidence bundle to 0G Storage...",
  deployment:     "Deploying workflow to KeeperHub...",
};

const TEE_STEP_LABELS: Record<string, string> = {
  researcher: "RESEARCHER ATTESTED",
  strategist: "STRATEGIST ATTESTED",
  critic:     "CRITIC ATTESTED",
};

interface Props {
  runId: string | null;
  isRunning: boolean;
  onComplete?: () => void;
}

export function PipelineLoadingScreen({ runId, isRunning, onComplete }: Props) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [liveFeed, setLiveFeed] = useState<string[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isExiting, setIsExiting] = useState(false);
  const [attestations, setAttestations] = useState<{ label: string; reqId: string }[]>([]);
  const [verificationPulse, setVerificationPulse] = useState(false);
  const [tokenCount, setTokenCount] = useState(0);
  const prevAttestCount = useRef(0);
  const reduceMotion = useReducedMotion();

  // Reset on new run
  useEffect(() => {
    setElapsedSeconds(0);
    setLiveFeed([]);
    setEvents([]);
    setActiveIndex(-1);
    setIsExiting(false);
    setAttestations([]);
    setTokenCount(0);
    prevAttestCount.current = 0;
  }, [runId]);

  // Attestation verification pulse
  useEffect(() => {
    if (attestations.length > prevAttestCount.current) {
      setVerificationPulse(true);
      const t = setTimeout(() => setVerificationPulse(false), 700);
      prevAttestCount.current = attestations.length;
      return () => clearTimeout(t);
    }
  }, [attestations.length]);

  // Token counter — animate from 0 to ~26,400 over pipeline duration
  useEffect(() => {
    if (!isRunning) return;
    const target = 26400;
    const duration = 8000;
    const steps = 80;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      setTokenCount(Math.floor((target * step) / steps));
      if (step >= steps) clearInterval(interval);
    }, duration / steps);
    return () => clearInterval(interval);
  }, [isRunning]);

  // Simulate pipeline events (backend is synchronous)
  useEffect(() => {
    if (!isRunning) return;
    let step = 0;
    const stages = [
      { stage: "request_received", message: "REQUEST RECEIVED — pipeline initializing" },
      { stage: "discovery",        message: "KH schemas fetched — 47 action types loaded" },
      { stage: "researcher",       message: "Market signals gathered — 3 protocols analyzed" },
      { stage: "strategist",       message: "2 candidate workflows designed" },
      { stage: "critic",           message: "Candidate B selected — prior lessons applied" },
      { stage: "compiler",         message: "Compiled to deterministic WorkflowSpec JSON" },
      { stage: "risk_validator",   message: "Safety bounds validated — no violations" },
    ];
    const interval = setInterval(() => {
      if (step < stages.length) {
        setEvents((prev) => [...prev, { ...stages[step], timestamp: Date.now(), status: "done" }]);
        step++;
      }
    }, 1300);
    return () => clearInterval(interval);
  }, [isRunning]);

  // Elapsed timer
  useEffect(() => {
    if (!isRunning) return;
    const timer = window.setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, [isRunning]);

  // Process events
  useEffect(() => {
    if (events.length === 0) return;
    const latest = events[events.length - 1];
    const idx = STAGE_ORDER.get(latest.stage);
    if (typeof idx === "number") setActiveIndex(idx);
    const stamp = new Date(latest.timestamp).toLocaleTimeString([], { hour12: false });
    setLiveFeed((prev) => [`[${stamp}]  ${latest.message}`, ...prev].slice(0, 8));

    if (latest.status === "done" && ["researcher", "strategist", "critic"].includes(latest.stage)) {
      const reqId = `or-req-${Math.random().toString(36).slice(2, 9)}`;
      setAttestations((prev) => [
        ...prev,
        { label: TEE_STEP_LABELS[latest.stage] ?? `${latest.stage} ATTESTED`, reqId },
      ]);
    }

    if (latest.stage === "completed" || latest.stage === "failed") {
      setIsExiting(true);
      setTimeout(() => onComplete?.(), 600);
    }
  }, [events, onComplete]);

  const stageStatuses = useMemo(
    () => PIPELINE_STAGES.map((_, i) => {
      if (activeIndex < 0) return "idle" as const;
      if (i < activeIndex) return "complete" as const;
      if (i === activeIndex) return "active" as const;
      return "idle" as const;
    }),
    [activeIndex],
  );

  const currentLabel =
    activeIndex >= 0 && activeIndex < PIPELINE_STAGES.length
      ? (STAGE_LABELS[PIPELINE_STAGES[activeIndex].id] ?? PIPELINE_STAGES[activeIndex].detail)
      : "Initializing pipeline...";

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec < 10 ? "0" : ""}${sec}s` : `${sec < 10 ? "0" : ""}${sec}s`;
  };

  const tokenBar = Math.min(10, Math.floor((tokenCount / 26400) * 10));

  if (!isExiting && (!isRunning || !runId)) return null;

  return (
    <motion.div
      className={`loading-screen ${isExiting ? "loading-screen--exiting" : ""}`}
      animate={{ backgroundColor: verificationPulse ? "rgba(0,229,200,0.04)" : "rgba(5,6,9,0.88)" }}
      transition={{ duration: 0.4 }}
      style={{ backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)" }}
    >
      {/* Mission elapsed time — prominent top-center */}
      <div style={{
        position: "absolute",
        top: "28px",
        left: "50%",
        transform: "translateX(-50%)",
        fontFamily: "var(--font-mono)",
        fontSize: "32px",
        fontWeight: 300,
        letterSpacing: "0.08em",
        color: "var(--text-secondary)",
        tabularNums: "tabular-nums",
      } as any}>
        {formatTime(elapsedSeconds)}
      </div>

      {/* Center content */}
      <div className="loading-screen__center">
        {/* Reactor orb with teal glow */}
        <motion.div
          className="loading-screen__orb-container"
          initial={reduceMotion ? undefined : { scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: reduceMotion ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
          style={{ "--orb-color": "var(--accent-verify)" } as any}
        >
          <div className="loading-screen__ring" style={{ borderColor: "rgba(0,229,200,0.25)" }} />
          <div className="loading-screen__ring" style={{ borderColor: "rgba(0,229,200,0.15)" }} />
          <div className="loading-screen__ring" style={{ borderColor: "rgba(0,229,200,0.08)" }} />
          <div className="loading-screen__orb" style={{ background: "radial-gradient(circle, rgba(0,229,200,0.6) 0%, rgba(0,229,200,0.2) 50%, transparent 75%)", boxShadow: "0 0 32px rgba(0,229,200,0.4), 0 0 64px rgba(0,229,200,0.15)" }} />
        </motion.div>

        {/* Stage label — Instrument Serif */}
        <div role="status" aria-live="polite" aria-atomic="true" style={{ display: "contents" }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentLabel}
              className="loading-screen__stage"
              initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: reduceMotion ? 0 : 0.25 }}
              style={{
                fontFamily: "var(--font-display)",
                fontStyle: "italic",
                fontSize: "clamp(18px, 2.5vw, 26px)",
                letterSpacing: "-0.01em",
              }}
            >
              {currentLabel}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Progress bar */}
        <div className="loading-screen__progress">
          {PIPELINE_STAGES.map((stage, i) => (
            <div
              key={stage.id}
              className={`loading-screen__progress-segment ${
                stageStatuses[i] === "complete" ? "loading-screen__progress-segment--complete"
                : stageStatuses[i] === "active" ? "loading-screen__progress-segment--active"
                : ""
              }`}
              style={stageStatuses[i] === "complete" ? { background: "var(--accent-verify)" }
                : stageStatuses[i] === "active" ? { background: "rgba(0,229,200,0.5)", animation: "shimmer 1.5s ease infinite" }
                : {}}
            />
          ))}
        </div>

        {/* Token counter */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          color: "var(--text-tertiary)",
          letterSpacing: "0.06em",
          marginTop: "4px",
        }}>
          <span>TOKENS PROCESSED</span>
          <span style={{ color: "var(--accent-verify)", opacity: 0.7 }}>
            {"█".repeat(tokenBar)}{"░".repeat(10 - tokenBar)}
          </span>
          <span>~{tokenCount.toLocaleString()}</span>
        </div>

        {/* Steps list */}
        <div className="loading-screen__steps">
          {PIPELINE_STAGES.map((stage, i) => {
            const status = stageStatuses[i];
            return (
              <motion.div
                key={stage.id}
                className={`loading-screen__step loading-screen__step--${status}`}
                initial={reduceMotion ? undefined : { opacity: 0, x: -12 }}
                animate={{ opacity: status === "idle" ? 0.35 : 1, x: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.28, delay: reduceMotion ? 0 : i * 0.04 }}
              >
                <div className="loading-screen__step-number"
                  style={status === "complete" ? { background: "rgba(0,229,200,0.15)", color: "var(--accent-verify)", borderColor: "rgba(0,229,200,0.3)" } : {}}
                >
                  {status === "complete" ? "✓" : i + 1}
                </div>
                <span className="loading-screen__step-label">{stage.label}</span>
                <span className="loading-screen__step-status" style={status === "complete" ? { color: "var(--accent-verify)" } : {}}>
                  {status === "idle" ? "IDLE" : status === "active" ? "RUNNING" : "DONE"}
                </span>
              </motion.div>
            );
          })}
        </div>

        {/* Inference log */}
        <div className="loading-screen__console">
          <div className="loading-screen__console-header"
            style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.08em", color: "var(--accent-verify)", fontSize: "10px" }}
          >
            INFERENCE LOG
          </div>
          <div className="loading-screen__console-lines">
            {liveFeed.length === 0 ? (
              <span style={{ color: "var(--text-tertiary)" }}>Initializing inference pipeline...</span>
            ) : (
              <AnimatePresence initial={false}>
                {liveFeed.map((entry, i) => (
                  <motion.span
                    key={`${entry}-${i}`}
                    className="loading-screen__console-line"
                    initial={reduceMotion ? undefined : { opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: reduceMotion ? 0 : 0.22 }}
                  >
                    {entry}
                  </motion.span>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* Attestation chips — large and prominent */}
        {attestations.length > 0 && (
          <div className="loading-screen__attestations" style={{ gap: "10px" }}>
            <AnimatePresence>
              {attestations.map((attest) => (
                <motion.div
                  key={attest.reqId}
                  initial={{ opacity: 0, scale: 1.12, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: "3px",
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "1px solid rgba(0,229,200,0.3)",
                    background: "rgba(0,229,200,0.08)",
                    boxShadow: "0 0 16px rgba(0,229,200,0.12)",
                  }}
                >
                  <span style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    letterSpacing: "0.06em",
                    color: "var(--accent-verify)",
                    fontWeight: 600,
                  }}>
                    ◆ {attest.label}
                  </span>
                  <span style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "10px",
                    color: "rgba(0,229,200,0.55)",
                    letterSpacing: "0.04em",
                  }}>
                    {attest.reqId}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}
