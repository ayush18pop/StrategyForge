"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Rocket, GitBranch, ShieldCheck, CheckCircle2, AlertTriangle } from "lucide-react";
import { AmbientLight } from "../../../components/glass/AmbientLight";
import { ambientPresets } from "../../../components/glass/ambient-presets";
import { EvidenceBundle } from "../../../components/EvidenceBundle";

const easeOut = [0.22, 1, 0.36, 1] as const;
type ExecState = "idle" | "executing" | "done:success" | "done:suboptimal" | "done:failed";
type EvolveState = "idle" | "evolving";

export default function StrategyDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [strategy, setStrategy] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [evolved, setEvolved] = useState(false);

  const [execState, setExecState] = useState<ExecState>("idle");
  const [execResult, setExecResult] = useState<any>(null);
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [evolveState, setEvolveState] = useState<EvolveState>("idle");
  const [evolveStage, setEvolveStage] = useState(0);
  const evolveTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setEvolved(new URLSearchParams(window.location.search).get("evolved") === "true");
    }
  }, []);

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (!savedUser) { router.push("/"); return; }
    const u = JSON.parse(savedUser);
    setUser(u);

    fetch(`/api/strategy/${id}`, { headers: { Authorization: `Bearer ${u.token}` } })
      .then(r => r.json())
      .then(d => { if (d.strategy) setStrategy(d.strategy); else toast.error(d.error || "Failed to load"); })
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [id, router]);

  async function handleExecute() {
    setExecState("executing");
    setElapsed(0);
    elapsedRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    try {
      const res = await fetch("/api/strategy/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
        body: JSON.stringify({ strategyId: strategy._id }),
      });
      const data = await res.json();
      if (elapsedRef.current) clearInterval(elapsedRef.current);
      if (!res.ok) throw new Error(data.error);
      setExecResult(data);
      setExecState(data.suboptimal ? "done:suboptimal" : data.status === "failed" ? "done:failed" : "done:success");
    } catch (e: any) {
      if (elapsedRef.current) clearInterval(elapsedRef.current);
      setExecState("done:failed");
      toast.error(e.message);
    }
  }

  async function handleEvolve() {
    setEvolveState("evolving");
    setEvolveStage(1);
    const t1 = setTimeout(() => setEvolveStage(2), 9000);
    const t2 = setTimeout(() => setEvolveStage(3), 22000);
    evolveTimersRef.current = [t1, t2];
    try {
      const res = await fetch("/api/strategy/update", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
        body: JSON.stringify({ strategyId: strategy._id }),
      });
      const data = await res.json();
      evolveTimersRef.current.forEach(clearTimeout);
      if (!res.ok) {
        setEvolveState("idle");
        setEvolveStage(0);
        throw new Error(data.error);
      }
      setEvolveStage(3);
      setTimeout(() => router.push(`/strategy/${data.newStrategyId}?evolved=true`), 1200);
    } catch (e: any) {
      setEvolveState("idle");
      setEvolveStage(0);
      toast.error(e.message);
    }
  }

  if (loading) return (
    <div className="flex h-screen items-center justify-center text-text-secondary font-mono text-sm">
      Loading strategy telemetry...
    </div>
  );
  if (!strategy) return (
    <div className="flex h-screen items-center justify-center text-hot-red font-mono text-sm">
      Strategy not found
    </div>
  );

  const evidenceOfLearning = strategy.evidenceBundle?.step3_critic?.output?.evidenceOfLearning;
  const isV2Plus = strategy.version >= 2 && evidenceOfLearning;

  return (
    <div className="app-page" style={{ position: "relative", minHeight: "100vh", padding: "var(--space-6) var(--space-8)" }}>
      <AmbientLight blobs={ambientPresets.hero} />

      {/* ─── Evolution Complete Banner ─── */}
      <AnimatePresence>
        {evolved && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
              zIndex: 50, background: "rgba(0,229,200,0.1)", border: "1px solid var(--accent-verify)",
              borderRadius: 12, padding: "10px 24px", color: "var(--accent-verify)",
              fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: 2,
              pointerEvents: "none", whiteSpace: "nowrap",
            }}
          >
            ◆ EVOLUTION COMPLETE — v{strategy.version} LIVE
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Evolution Pipeline Overlay ─── */}
      <AnimatePresence>
        {evolveState === "evolving" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed", inset: 0, background: "rgba(5,6,9,0.97)", zIndex: 100,
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", gap: 28,
            }}
          >
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 4, color: "rgba(0,229,200,0.6)" }}>
              EVOLUTION PIPELINE
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px,4vw,44px)", textAlign: "center", color: "var(--text-primary)", maxWidth: 480, lineHeight: 1.1 }}>
              Learning from<br />v{strategy.version}
            </div>
            <div style={{ width: 340, display: "flex", flexDirection: "column", gap: 10 }}>
              {([
                { s: 1, label: "RESEARCHER", sub: "Injecting prior failure lessons" },
                { s: 2, label: "STRATEGIST", sub: `Designing v${strategy.version + 1} candidates` },
                { s: 3, label: "CRITIC", sub: "Generating evidence of learning" },
              ] as const).map(({ s, label, sub }) => {
                const done = evolveStage > s;
                const active = evolveStage === s;
                return (
                  <div key={s} style={{
                    display: "flex", alignItems: "center", gap: 14, padding: "12px 16px",
                    borderRadius: 12,
                    background: active ? "rgba(0,229,200,0.07)" : "rgba(255,255,255,0.02)",
                    border: `1px solid ${done ? "rgba(0,229,200,0.5)" : active ? "rgba(0,229,200,0.25)" : "rgba(255,255,255,0.05)"}`,
                    transition: "all 0.5s ease",
                  }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: "50%",
                      border: `1.5px solid ${done ? "var(--accent-verify)" : active ? "rgba(0,229,200,0.5)" : "rgba(255,255,255,0.15)"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, color: done ? "var(--accent-verify)" : "rgba(255,255,255,0.25)",
                      fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700,
                    }}>
                      {done ? "✓" : s}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 2,
                        color: done ? "var(--accent-verify)" : active ? "var(--text-primary)" : "rgba(255,255,255,0.25)",
                      }}>
                        {label}
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 2 }}>{sub}</div>
                    </div>
                    {active && (
                      <div style={{ width: 20, height: 2, borderRadius: 1, overflow: "hidden", background: "rgba(0,229,200,0.15)", position: "relative", flexShrink: 0 }}>
                        <motion.div
                          style={{ position: "absolute", top: 0, height: "100%", width: "60%", background: "var(--accent-verify)" }}
                          animate={{ left: ["-60%", "160%"] }}
                          transition={{ repeat: Infinity, duration: 1.4, ease: "linear" }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,0.2)", letterSpacing: 1 }}>
              This takes 30–60 seconds · do not close this window
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Evidence of Learning Callout (v2+) ─── */}
      {isV2Plus && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: easeOut }}
          style={{
            maxWidth: "800px", margin: "0 auto 36px auto", padding: "24px 28px",
            borderRadius: "20px", border: "2px solid var(--accent-verify)",
            background: "rgba(0,229,200,0.05)",
          }}
        >
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 3, color: "var(--accent-verify)", marginBottom: 10 }}>
            EVIDENCE OF LEARNING — v{strategy.version - 1} → v{strategy.version}
          </div>
          <p style={{ fontFamily: "var(--font-display)", fontSize: "clamp(16px,2vw,21px)", color: "var(--text-primary)", lineHeight: 1.5, margin: 0 }}>
            &ldquo;{evidenceOfLearning}&rdquo;
          </p>
        </motion.div>
      )}

      {/* ─── Page Intro ─── */}
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: easeOut }}
        style={{ marginBottom: "40px", maxWidth: "800px", margin: "0 auto 40px auto" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
          <span style={{ color: "var(--text-tertiary)", fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            STRATEGY FAMILY
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              title="ERC-8004 Intelligent NFT: this strategy is a living on-chain agent — it has memory, verifiable reasoning, and evolves over time."
              style={{
                padding: "4px 12px", borderRadius: "6px",
                background: "rgba(91,108,255,0.12)", border: "1px solid rgba(91,108,255,0.4)",
                color: "var(--accent-400)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.05em",
                cursor: "help",
              }}
            >
              ✦ ERC-8004 iNFT
            </span>
            <button
              onClick={() => router.push("/dashboard")}
              aria-label="Back to Strategy Synthesis dashboard"
              style={{ display: "inline-flex", alignItems: "center", gap: "8px", height: "32px", padding: "0 12px", borderRadius: "999px", background: "rgba(255,255,255,0.04)", color: "var(--text-secondary)", fontSize: "12px", fontWeight: 600, border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}
            >
              ← FORGE
            </button>
          </div>
        </div>
        <h1 style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)", fontSize: "clamp(36px,5vw,56px)", lineHeight: "1.05", letterSpacing: "-0.02em", marginTop: "4px" }}>
          {strategy.familyId}
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "16px", lineHeight: "1.6", marginTop: "16px" }}>
          {strategy.goal}
        </p>
      </motion.section>

      {/* ─── Trust Bar ─── */}
      <motion.div
        style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center", maxWidth: "800px", margin: "0 auto 40px auto" }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: easeOut, delay: 0.08 }}
      >
        <TrustChip color="var(--accent-verify)" label="VERIFIED  Trust Score 98/100" />
        <TrustChip color="var(--attest-500)" label={`v${strategy.version}  LIVE ON 0G`} />
        <TrustChip color="var(--ok-500)" label="8.0% APY TARGET" />
        {user?.walletAddress && (
          <TrustChip color="rgba(255,255,255,0.3)" label={`${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`} mono />
        )}
      </motion.div>

      {/* ─── Execute Panel ─── */}
      <motion.div
        className="liquid-glass-shell"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: easeOut, delay: 0.12 }}
        style={{ maxWidth: "800px", margin: "0 auto 40px auto", borderRadius: "24px", overflow: "hidden" }}
      >
        <AnimatePresence mode="wait">
          {execState === "idle" && (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ padding: "28px 32px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
                <div>
                  <h2 style={{ fontSize: "18px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
                    {strategy.keeperhubWorkflowId ? "EXECUTE WORKFLOW" : "Deploy this strategy"}
                  </h2>
                  <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                    {strategy.keeperhubWorkflowId
                      ? `Workflow ${strategy.keeperhubWorkflowId} · Executes autonomously via Turnkey wallet`
                      : "Compiled workflow is ready. Deploy it to KeeperHub to begin execution."}
                  </p>
                </div>
                {strategy.keeperhubWorkflowId ? (
                  <button
                    onClick={handleExecute}
                    aria-label={`Execute workflow ${strategy.keeperhubWorkflowId} on KeeperHub`}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: "8px", height: "44px",
                      padding: "0 24px", borderRadius: "10px", background: "var(--accent-forge)",
                      color: "#060809", fontSize: "13px", fontWeight: 800,
                      fontFamily: "var(--font-mono)", letterSpacing: 1,
                      border: "none", cursor: "pointer", flexShrink: 0, textTransform: "uppercase",
                    }}
                  >
                    ▶ EXECUTE WORKFLOW
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      const t = toast.loading("Deploying to KeeperHub...");
                      try {
                        const res = await fetch("/api/strategy/deploy", {
                          method: "POST",
                          headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
                          body: JSON.stringify({ strategyId: strategy._id }),
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error);
                        setStrategy({ ...strategy, keeperhubWorkflowId: data.workflowId });
                        toast.success("Deployed to KeeperHub!", { id: t });
                      } catch (e: any) {
                        toast.error(e.message, { id: t });
                      }
                    }}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: "8px", height: "44px",
                      padding: "0 22px", borderRadius: "10px", background: "rgba(255,255,255,0.06)",
                      color: "var(--text-primary)", fontSize: "13px", fontWeight: 700,
                      border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", flexShrink: 0,
                    }}
                  >
                    <Rocket size={13} aria-hidden="true" /> Deploy to KeeperHub
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {execState === "executing" && (
            <motion.div key="executing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ padding: "28px 32px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 3, color: "var(--accent-verify)" }}>
                  EXECUTING...
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 28, color: "var(--text-primary)", letterSpacing: -1 }}>
                  {String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}
                </div>
              </div>
              <div style={{ position: "relative", height: 2, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden", marginBottom: 16 }}>
                <motion.div
                  style={{ position: "absolute", top: 0, height: "100%", width: "35%", background: "linear-gradient(90deg, transparent, var(--accent-verify), transparent)" }}
                  animate={{ left: ["-35%", "135%"] }}
                  transition={{ repeat: Infinity, duration: 2.6, ease: "linear" }}
                />
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(255,255,255,0.25)", letterSpacing: 1 }}>
                Awaiting KeeperHub execution result
              </div>
            </motion.div>
          )}

          {(execState === "done:success" || execState === "done:suboptimal" || execState === "done:failed") && (
            <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: "28px 32px" }}>
              {/* Outcome header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {execState === "done:success" && <CheckCircle2 size={16} color="var(--ok-500)" aria-hidden="true" />}
                  {execState !== "done:success" && <AlertTriangle size={16} color={execState === "done:suboptimal" ? "var(--attest-500)" : "#ff4444"} aria-hidden="true" />}
                  <span style={{
                    fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: 2,
                    color: execState === "done:success" ? "var(--ok-500)" : execState === "done:suboptimal" ? "var(--attest-500)" : "#ff4444",
                  }}>
                    {execState === "done:success" ? "EXECUTION COMPLETE" : execState === "done:suboptimal" ? "SUBOPTIMAL DETECTED" : "EXECUTION FAILED"}
                  </span>
                </div>
                {execResult?.reputationTxHash && (
                  <a
                    href={`https://chainscan-galileo.0g.ai/tx/${execResult.reputationTxHash}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--attest-500)", textDecoration: "none", opacity: 0.8 }}
                  >
                    0G tx: {execResult.reputationTxHash.slice(0, 10)}... ↗
                  </a>
                )}
              </div>

              {/* Suboptimal reason pill */}
              {execState === "done:suboptimal" && execResult?.suboptimalReason && (
                <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(227,169,74,0.07)", border: "1px solid rgba(227,169,74,0.2)", marginBottom: 16, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--attest-500)" }}>
                  {execResult.suboptimalReason}
                </div>
              )}

              {/* Step logs */}
              {execResult?.stepLogs?.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: execState === "done:suboptimal" ? 20 : 0 }}>
                  {execResult.stepLogs.slice(0, 8).map((log: any, i: number) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                      <div style={{ width: 5, height: 5, borderRadius: "50%", background: log.status === "success" ? "var(--ok-500)" : log.status === "failed" ? "#ff4444" : "rgba(255,255,255,0.2)", flexShrink: 0 }} />
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(255,255,255,0.45)", flex: 1 }}>
                        {log.actionType || `step-${i + 1}`}
                      </span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: log.status === "success" ? "var(--ok-500)" : "rgba(255,255,255,0.3)" }}>
                        {log.status}
                      </span>
                      {log.txHash && (
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--attest-500)" }}>
                          {log.txHash.slice(0, 8)}...
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Evolve CTA — the money button */}
              {execState === "done:suboptimal" && (
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, ease: easeOut }}
                  onClick={handleEvolve}
                  style={{
                    width: "100%", height: "52px", borderRadius: "12px",
                    background: "var(--accent-forge)", color: "#060809",
                    fontSize: "13px", fontWeight: 800, fontFamily: "var(--font-mono)",
                    letterSpacing: 2, border: "none", cursor: "pointer",
                    textTransform: "uppercase", display: "flex", alignItems: "center",
                    justifyContent: "flex-start", paddingLeft: 20, gap: 12, marginTop: 4,
                  }}
                >
                  <span>⚡ EVOLVE STRATEGY →</span>
                  <span style={{ fontSize: 11, opacity: 0.55, fontWeight: 400, letterSpacing: 0 }}>
                    Generate v{strategy.version + 1} using v{strategy.version}&apos;s failure as training data
                  </span>
                </motion.button>
              )}

              {/* Reset for non-suboptimal */}
              {execState !== "done:suboptimal" && (
                <button
                  onClick={() => { setExecState("idle"); setExecResult(null); }}
                  style={{ marginTop: 14, fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(255,255,255,0.3)", background: "none", border: "none", cursor: "pointer", letterSpacing: 1 }}
                >
                  ↺ RUN AGAIN
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ─── Two Col Layout ─── */}
      <motion.div
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px", maxWidth: "1200px", margin: "0 auto" }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: easeOut, delay: 0.2 }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "24px", minWidth: 0 }}>
          {/* Workflow JSON */}
          <div className="liquid-glass-shell" style={{ padding: "24px", borderRadius: "24px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
              <div>
                <h2 style={{ fontSize: "18px", fontWeight: 600, color: "var(--text-primary)" }}>EXECUTION PAYLOAD</h2>
                <p style={{ fontSize: "13px", color: "var(--text-tertiary)", marginTop: "4px" }}>JSON payload executed by KeeperHub</p>
              </div>
              <span style={{ padding: "4px 10px", borderRadius: "999px", background: "rgba(127,183,154,0.12)", border: "1px solid rgba(127,183,154,0.3)", color: "var(--ok-500)", fontSize: "10px", fontWeight: 700, textTransform: "uppercase" }}>
                LIVE
              </span>
            </div>
            <pre style={{ background: "rgba(0,0,0,0.4)", padding: "20px", borderRadius: "16px", overflowX: "auto", fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--text-secondary)", border: "1px solid rgba(255,255,255,0.05)", maxHeight: "400px" }}>
              {JSON.stringify(strategy.compiledWorkflow || strategy.workflowJson, null, 2)}
            </pre>
          </div>

          {/* Evidence Bundle */}
          <div className="liquid-glass-shell" style={{ padding: "24px", borderRadius: "24px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
              <ShieldCheck className="text-acid-green" size={20} aria-hidden="true" />
              <div>
                <h2 style={{ fontSize: "18px", fontWeight: 600, color: "var(--text-primary)" }}>INTELLIGENCE AUDIT TRAIL</h2>
                <p style={{ fontSize: "13px", color: "var(--text-tertiary)", marginTop: "2px" }}>TEE-attested artifacts from the inference pipeline</p>
              </div>
            </div>
            <EvidenceBundle
              researcherOutput={strategy.rawEvidence?.researcher || strategy.evidenceBundle?.step1_researcher}
              strategistOutput={strategy.rawEvidence?.strategist || strategy.evidenceBundle?.step2_strategist}
              criticOutput={strategy.rawEvidence?.critic || strategy.evidenceBundle?.step3_critic}
            />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* On-chain attestations */}
          <div className="liquid-glass-shell" style={{ padding: "24px", borderRadius: "24px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "16px" }}>ON-CHAIN ATTESTATIONS</h2>
            <div style={{ display: "grid", gap: "10px" }}>
              {strategy.reputationLedgerTxHash ? (
                <a
                  href={`https://chainscan-galileo.0g.ai/tx/${strategy.reputationLedgerTxHash}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: "10px", background: "rgba(227,169,74,0.05)", border: "1px solid rgba(227,169,74,0.2)", textDecoration: "none" }}
                >
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--attest-500)", letterSpacing: 1 }}>REPUTATION LEDGER TX</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
                    {strategy.reputationLedgerTxHash.slice(0, 10)}... ↗
                  </span>
                </a>
              ) : null}
              {strategy.agentRegistryCid ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: "10px", background: "rgba(0,229,200,0.04)", border: "1px solid rgba(0,229,200,0.15)" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent-verify)", letterSpacing: 1 }}>AGENT REGISTRY CID</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
                    {String(strategy.agentRegistryCid).slice(0, 12)}...
                  </span>
                </div>
              ) : null}
              {!strategy.reputationLedgerTxHash && !strategy.agentRegistryCid && (
                <p style={{ fontSize: 12, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
                  Execute workflow to write on-chain attestation.
                </p>
              )}
            </div>
          </div>

          {/* Evidence Lineage */}
          <div className="liquid-glass-shell" style={{ padding: "24px", borderRadius: "24px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "8px" }}>EVIDENCE LINEAGE</h2>
            <p style={{ fontSize: "13px", color: "var(--text-tertiary)", marginBottom: "16px" }}>
              On-chain anchors. Independently verifiable on 0G Chain.
            </p>
            <div style={{ display: "grid", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "14px 16px", borderRadius: "12px", background: "rgba(127,183,154,0.06)", border: "1px solid rgba(127,183,154,0.15)" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--ok-500)", flexShrink: 0 }} />
                <span style={{ color: "var(--text-primary)", fontWeight: 700, fontSize: "13px", fontFamily: "var(--font-mono)" }}>
                  v{strategy.version}
                </span>
                <span style={{ padding: "2px 8px", borderRadius: "999px", background: "rgba(127,183,154,0.15)", color: "var(--ok-500)", fontSize: "10px", fontWeight: 700 }}>
                  LIVE
                </span>
                <span style={{ marginLeft: "auto", color: "var(--text-tertiary)", fontSize: "11px", fontFamily: "var(--font-mono)" }}>
                  {strategy.createdAt ? new Date(strategy.createdAt).toLocaleDateString() : "Now"}
                </span>
              </div>
              <button
                onClick={() => toast.info("Lineage graph coming soon")}
                aria-label="Trace intelligence lineage across strategy versions"
                style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--text-secondary)", fontSize: "13px", padding: "12px 14px", borderRadius: "10px", background: "rgba(255,255,255,0.02)", border: "none", cursor: "pointer", textAlign: "left" }}
              >
                <GitBranch size={14} aria-hidden="true" /> TRACE INTELLIGENCE →
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function TrustChip({ label, color, mono }: { label: string; color: string; mono?: boolean }) {
  return (
    <div style={{
      padding: "6px 14px", borderRadius: "999px",
      border: `1px solid ${color}`, color,
      fontSize: "11px", fontWeight: 700,
      fontFamily: mono ? "var(--font-mono)" : undefined,
      letterSpacing: mono ? 0 : "0.05em", opacity: 0.9,
    }}>
      {label}
    </div>
  );
}
