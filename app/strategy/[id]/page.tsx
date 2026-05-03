"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Rocket, GitBranch, ShieldCheck } from "lucide-react";
import { EvidenceBundle } from "../../../components/EvidenceBundle";

const ease = [0.22, 1, 0.36, 1] as const;
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
    <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", background: "var(--bg-0)", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-tertiary)" }}>
      Loading intelligence telemetry...
    </div>
  );
  if (!strategy) return (
    <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", background: "var(--bg-0)", fontFamily: "var(--font-mono)", fontSize: 12, color: "#ff4444" }}>
      Strategy not found
    </div>
  );

  const evidenceOfLearning = strategy.evidenceBundle?.step3_critic?.output?.evidenceOfLearning;
  const isV2Plus = strategy.version >= 2 && evidenceOfLearning;
  const isLive = strategy.lifecycle === "live";
  const isDraft = strategy.lifecycle === "draft";

  return (
    <>
      {/* ── Evolution pipeline overlay (full-screen, z-100) ── */}
      <AnimatePresence>
        {evolveState === "evolving" && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(5,6,9,0.97)", zIndex: 100, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28 }}
          >
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 4, color: "rgba(0,229,200,0.6)" }}>EVOLUTION PIPELINE</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px,4vw,44px)", textAlign: "center", color: "var(--text-primary)", maxWidth: 480, lineHeight: 1.1 }}>
              Learning from<br />v{strategy.version}
            </div>
            <div style={{ width: 340, display: "flex", flexDirection: "column", gap: 10 }}>
              {([
                { s: 1, label: "RESEARCHER", sub: "Injecting prior failure lessons" },
                { s: 2, label: "STRATEGIST", sub: `Designing v${strategy.version + 1} candidates` },
                { s: 3, label: "CRITIC",     sub: "Generating evidence of learning" },
              ] as const).map(({ s, label, sub }) => {
                const done = evolveStage > s;
                const active = evolveStage === s;
                return (
                  <div key={s} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderRadius: 12, background: active ? "rgba(0,229,200,0.07)" : "rgba(255,255,255,0.02)", border: `1px solid ${done ? "rgba(0,229,200,0.5)" : active ? "rgba(0,229,200,0.25)" : "rgba(255,255,255,0.05)"}`, transition: "all 0.5s ease" }}>
                    <div style={{ width: 26, height: 26, borderRadius: "50%", border: `1.5px solid ${done ? "var(--accent-verify)" : active ? "rgba(0,229,200,0.5)" : "rgba(255,255,255,0.15)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: done ? "var(--accent-verify)" : "rgba(255,255,255,0.25)", fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                      {done ? "✓" : s}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 2, color: done ? "var(--accent-verify)" : active ? "var(--text-primary)" : "rgba(255,255,255,0.25)" }}>{label}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 2 }}>{sub}</div>
                    </div>
                    {active && (
                      <div style={{ width: 20, height: 2, borderRadius: 1, overflow: "hidden", background: "rgba(0,229,200,0.15)", position: "relative", flexShrink: 0 }}>
                        <motion.div style={{ position: "absolute", top: 0, height: "100%", width: "60%", background: "var(--accent-verify)" }} animate={{ left: ["-60%", "160%"] }} transition={{ repeat: Infinity, duration: 1.4, ease: "linear" }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,0.2)", letterSpacing: 1 }}>This takes 30–60 seconds · do not close this window</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Evolved banner ── */}
      <AnimatePresence>
        {evolved && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", top: 56, left: "50%", transform: "translateX(-50%)", zIndex: 50, background: "rgba(0,229,200,0.1)", border: "1px solid var(--accent-verify)", borderRadius: 12, padding: "10px 24px", color: "var(--accent-verify)", fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: 2, pointerEvents: "none", whiteSpace: "nowrap" }}
          >
            ◆ EVOLUTION COMPLETE — v{strategy.version} LIVE
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════
          ROOT: fixed viewport, no outer scroll
      ══════════════════════════════════════════════════════ */}
      <div style={{ height: "100vh", overflow: "hidden", display: "flex", flexDirection: "column", background: "var(--bg-0)" }}>

        {/* ── HEADER (52px) ── */}
        <header style={{ height: 52, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px", borderBottom: "1px solid rgba(0,229,200,0.07)", background: "rgba(5,6,9,0.92)", backdropFilter: "blur(16px)", position: "relative", zIndex: 20, gap: 14 }}>

          {/* Left: back + logo + strategy ID */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
            <button
              onClick={() => router.push("/dashboard")}
              aria-label="Back to dashboard"
              style={{ height: 28, padding: "0 10px", borderRadius: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.07em", cursor: "pointer", flexShrink: 0, transition: "all 0.15s" }}
              onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.14)"; }}
              onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-tertiary)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.07)"; }}
            >
              ← FORGE
            </button>
            <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.07)", flexShrink: 0 }} />
            <svg width="16" height="16" viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0 }}>
              <polygon points="16,2 28,9 28,23 16,30 4,23 4,9" stroke="#00e5c8" strokeWidth="1.5" fill="rgba(0,229,200,0.08)" />
              <path d="M18 8 L12 17 H16 L14 24 L20 15 H16 Z" fill="#c8ff00" />
            </svg>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {strategy.familyId}
            </span>
          </div>

          {/* Center: badges */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <div style={{ height: 22, padding: "0 9px", borderRadius: 5, background: isLive ? "rgba(0,229,200,0.08)" : "rgba(255,255,255,0.04)", border: `1px solid ${isLive ? "rgba(0,229,200,0.2)" : "rgba(255,255,255,0.07)"}`, color: isLive ? "var(--accent-verify)" : "var(--text-tertiary)", fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", display: "flex", alignItems: "center" }}>
              v{strategy.version} · {isLive ? "LIVE" : isDraft ? "DRAFT" : "DEPRECATED"}
            </div>
            {isV2Plus && (
              <div style={{ height: 22, padding: "0 9px", borderRadius: 5, background: "rgba(0,229,200,0.06)", border: "1px solid rgba(0,229,200,0.15)", color: "var(--accent-verify)", fontFamily: "var(--font-mono)", fontSize: 9, display: "flex", alignItems: "center" }}>
                v{strategy.version - 1} → v{strategy.version}
              </div>
            )}
            <div title="ERC-8004 Intelligent NFT: this strategy is a living on-chain agent — it has memory, verifiable reasoning, and evolves over time." style={{ height: 22, padding: "0 9px", borderRadius: 5, background: "rgba(91,108,255,0.08)", border: "1px solid rgba(91,108,255,0.25)", color: "var(--accent-400)", fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", cursor: "help" }}>
              ✦ ERC-8004 iNFT
            </div>
          </div>

          {/* Right: execute / deploy */}
          <div style={{ flexShrink: 0 }}>
            {execState === "idle" && (
              strategy.keeperhubWorkflowId ? (
                <button
                  onClick={handleExecute}
                  aria-label={`Execute workflow ${strategy.keeperhubWorkflowId} on KeeperHub`}
                  style={{ height: 32, padding: "0 16px", borderRadius: 7, background: "var(--accent-forge)", color: "#060809", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 800, letterSpacing: "0.07em", border: "none", cursor: "pointer" }}
                >
                  ▶ EXECUTE
                </button>
              ) : (
                <button
                  onClick={async () => {
                    const t = toast.loading("Deploying to KeeperHub...");
                    try {
                      const res = await fetch("/api/strategy/deploy", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` }, body: JSON.stringify({ strategyId: strategy._id }) });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error);
                      setStrategy({ ...strategy, keeperhubWorkflowId: data.workflowId });
                      toast.success("Deployed to KeeperHub!", { id: t });
                    } catch (e: any) { toast.error(e.message, { id: t }); }
                  }}
                  style={{ height: 32, padding: "0 16px", borderRadius: 7, background: "rgba(255,255,255,0.06)", color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                >
                  <Rocket size={11} aria-hidden="true" /> DEPLOY →
                </button>
              )
            )}
            {execState === "executing" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent-verify)" }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--accent-verify)", letterSpacing: 1 }}>
                  {String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}
                </span>
              </div>
            )}
            {(execState === "done:success" || execState === "done:suboptimal" || execState === "done:failed") && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.07em", color: execState === "done:success" ? "var(--ok-500)" : execState === "done:suboptimal" ? "var(--attest-500)" : "#ff4444" }}>
                  {execState === "done:success" ? "✓ COMPLETE" : execState === "done:suboptimal" ? "⚠ SUBOPTIMAL" : "✕ FAILED"}
                </span>
                <button onClick={() => { setExecState("idle"); setExecResult(null); }} style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(255,255,255,0.3)", background: "none", border: "none", cursor: "pointer" }}>↺</button>
              </div>
            )}
          </div>
        </header>

        {/* ── BODY: three columns ── */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

          {/* ════════════════════════════════════
              LEFT (260px): Identity + On-chain + Lineage
          ════════════════════════════════════ */}
          <motion.aside
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease }}
            style={{ width: 260, flexShrink: 0, borderRight: "1px solid rgba(0,229,200,0.07)", background: "rgba(0,229,200,0.012)", display: "flex", flexDirection: "column", overflow: "hidden" }}
          >
            <div style={{ flex: 1, overflowY: "auto", padding: "18px 16px 0" }}>

              {/* Objective */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-tertiary)", letterSpacing: "0.12em", marginBottom: 6 }}>DeFi OBJECTIVE</div>
                <p style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>{strategy.goal}</p>
              </div>

              {/* Trust chips */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 16 }}>
                <TrustChip color="var(--accent-verify)" label="VERIFIED 98/100" />
                <TrustChip color="var(--attest-500)" label={`v${strategy.version} LIVE ON 0G`} />
                <TrustChip color="var(--ok-500)" label="8.0% APY" />
                {user?.walletAddress && <TrustChip color="rgba(255,255,255,0.25)" label={`${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`} />}
              </div>

              <Divider />

              {/* On-chain anchors */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-tertiary)", letterSpacing: "0.12em", marginBottom: 10 }}>ON-CHAIN ANCHORS · 0G TESTNET</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {/* Agent ID */}
                  {strategy.onChainAgentId && (
                    <a href={`https://chainscan-galileo.0g.ai/address/${process.env.NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS || '0x6274f0A5277c468Eb338EE8986D5Fd157C9A6338'}`} target="_blank" rel="noopener noreferrer"
                      style={{ display: "block", padding: "10px 11px", borderRadius: 8, background: "rgba(0,229,200,0.06)", border: "1px solid rgba(0,229,200,0.18)", textDecoration: "none" }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-tertiary)", letterSpacing: "0.08em", marginBottom: 3 }}>⬡ 0G INFT IDENTITY</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent-verify)", fontWeight: 700 }}>INFT #{strategy.onChainAgentId} ↗</div>
                    </a>
                  )}
                  {/* Registry TX */}
                  {strategy.registryTxHash && (
                    <a href={`https://chainscan-galileo.0g.ai/tx/${strategy.registryTxHash}`} target="_blank" rel="noopener noreferrer"
                      style={{ display: "block", padding: "10px 11px", borderRadius: 8, background: "rgba(0,229,200,0.04)", border: "1px solid rgba(0,229,200,0.12)", textDecoration: "none" }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-tertiary)", letterSpacing: "0.08em", marginBottom: 3 }}>REGISTRY TX</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent-verify)" }}>{strategy.registryTxHash.slice(0, 16)}... ↗</div>
                    </a>
                  )}
                  {/* Reputation Ledger TX */}
                  {strategy.reputationLedgerTxHash ? (
                    <a href={`https://chainscan-galileo.0g.ai/tx/${strategy.reputationLedgerTxHash}`} target="_blank" rel="noopener noreferrer"
                      style={{ display: "block", padding: "10px 11px", borderRadius: 8, background: "rgba(227,169,74,0.05)", border: "1px solid rgba(227,169,74,0.18)", textDecoration: "none" }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-tertiary)", letterSpacing: "0.08em", marginBottom: 3 }}>REPUTATION LEDGER TX</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--attest-500)" }}>{strategy.reputationLedgerTxHash.slice(0, 16)}... ↗</div>
                    </a>
                  ) : (
                    <div style={{ padding: "10px 11px", borderRadius: 8, background: "rgba(227,169,74,0.03)", border: "1px solid rgba(227,169,74,0.07)" }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-tertiary)", letterSpacing: "0.08em", marginBottom: 3 }}>REPUTATION LEDGER TX</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,0.2)" }}>pending execution</div>
                    </div>
                  )}
                  {/* Contract links */}
                  <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
                    <a href={`https://chainscan-galileo.0g.ai/address/${process.env.NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS || '0x6274f0A5277c468Eb338EE8986D5Fd157C9A6338'}`} target="_blank" rel="noopener noreferrer"
                      style={{ flex: 1, padding: "6px 8px", borderRadius: 6, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", textDecoration: "none", textAlign: "center" }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 7, color: "var(--text-tertiary)", letterSpacing: "0.06em" }}>REGISTRY ↗</div>
                    </a>
                    <a href={`https://chainscan-galileo.0g.ai/address/${process.env.NEXT_PUBLIC_REPUTATION_LEDGER_ADDRESS || '0x727C72Bf5ED69Db4dCB2604ef2FAA856C90c636B'}`} target="_blank" rel="noopener noreferrer"
                      style={{ flex: 1, padding: "6px 8px", borderRadius: 6, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", textDecoration: "none", textAlign: "center" }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 7, color: "var(--text-tertiary)", letterSpacing: "0.06em" }}>LEDGER ↗</div>
                    </a>
                  </div>
                </div>
              </div>

              <Divider />

              {/* Evidence lineage */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-tertiary)", letterSpacing: "0.12em", marginBottom: 10 }}>EVIDENCE LINEAGE</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 11px", borderRadius: 8, background: "rgba(127,183,154,0.06)", border: "1px solid rgba(127,183,154,0.15)" }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--ok-500)", flexShrink: 0 }} />
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-primary)", fontWeight: 700 }}>v{strategy.version}</span>
                    <span style={{ fontSize: 8, padding: "1px 6px", borderRadius: 3, background: "rgba(127,183,154,0.15)", color: "var(--ok-500)", fontFamily: "var(--font-mono)" }}>LIVE</span>
                    <span style={{ marginLeft: "auto", fontSize: 9, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
                      {strategy.createdAt ? new Date(strategy.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "Now"}
                    </span>
                  </div>
                  <button
                    onClick={() => toast.info("Lineage graph coming soon")}
                    aria-label="Trace intelligence lineage"
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 11px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "none", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-tertiary)", textAlign: "left" }}
                  >
                    <GitBranch size={10} aria-hidden="true" /> TRACE INTELLIGENCE →
                  </button>
                </div>
              </div>

              {/* Execution result: suboptimal CTA */}
              <AnimatePresence>
                {execState === "done:suboptimal" && execResult?.suboptimalReason && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
                    <Divider />
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--attest-500)", letterSpacing: "0.12em", marginBottom: 8 }}>⚠ SUBOPTIMAL DETECTED</div>
                      <div style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(227,169,74,0.07)", border: "1px solid rgba(227,169,74,0.18)", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--attest-500)", lineHeight: 1.5, marginBottom: 10 }}>
                        {execResult.suboptimalReason}
                      </div>
                      <button
                        onClick={handleEvolve}
                        style={{ width: "100%", height: 42, borderRadius: 8, background: "var(--accent-forge)", color: "#060809", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 800, letterSpacing: "0.07em", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                      >
                        ⚡ EVOLVE → v{strategy.version + 1}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* KeeperHub workflow footer */}
            {strategy.keeperhubWorkflowId && (
              <a
                href={`https://app.keeperhub.com/workflows/${strategy.keeperhubWorkflowId}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.04)", flexShrink: 0, display: "block", textDecoration: "none", transition: "all 0.2s" }}
                onMouseOver={e => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,229,200,0.05)"; }}
                onMouseOut={e => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
              >
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-tertiary)", letterSpacing: "0.08em", marginBottom: 2 }}>KEEPERHUB WORKFLOW</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent-verify)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {strategy.keeperhubWorkflowId} ↗
                </div>
              </a>
            )}
          </motion.aside>

          {/* ════════════════════════════════════
              CENTER: Intelligence Audit Trail (the star)
          ════════════════════════════════════ */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease, delay: 0.08 }}
            style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}
          >
            {/* Section label */}
            <div style={{ padding: "13px 20px", borderBottom: "1px solid rgba(0,229,200,0.07)", display: "flex", alignItems: "center", gap: 9, flexShrink: 0 }}>
              <ShieldCheck size={12} color="var(--accent-verify)" aria-hidden="true" />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--accent-verify)", letterSpacing: "0.12em", fontWeight: 700 }}>INTELLIGENCE AUDIT TRAIL</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-tertiary)" }}>TEE-attested inference artifacts</span>
            </div>

            {/* Scrollable content */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>

              {/* Evidence of learning (v2+) */}
              {isV2Plus && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }}
                  style={{ marginBottom: 16, padding: "16px 18px", borderRadius: 12, border: "2px solid var(--accent-verify)", background: "rgba(0,229,200,0.05)" }}
                >
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.14em", color: "var(--accent-verify)", marginBottom: 8 }}>
                    EVIDENCE OF LEARNING — v{strategy.version - 1} → v{strategy.version}
                  </div>
                  <p style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: "clamp(14px,1.6vw,18px)", color: "var(--text-primary)", lineHeight: 1.5, margin: 0 }}>
                    &ldquo;{evidenceOfLearning}&rdquo;
                  </p>
                </motion.div>
              )}

              <EvidenceBundle
                researcherOutput={strategy.rawEvidence?.researcher || strategy.evidenceBundle?.step1_researcher}
                strategistOutput={strategy.rawEvidence?.strategist || strategy.evidenceBundle?.step2_strategist}
                criticOutput={strategy.rawEvidence?.critic || strategy.evidenceBundle?.step3_critic}
              />
            </div>
          </motion.div>

          {/* ════════════════════════════════════
              RIGHT (300px): Execution Payload JSON
          ════════════════════════════════════ */}
          <motion.aside
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease, delay: 0.12 }}
            style={{ width: 300, flexShrink: 0, borderLeft: "1px solid rgba(0,229,200,0.07)", background: "rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", overflow: "hidden" }}
          >
            {/* Panel header */}
            <div style={{ padding: "13px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-secondary)", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 2 }}>EXECUTION PAYLOAD</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "rgba(255,255,255,0.2)" }}>JSON sent to KeeperHub</div>
              </div>
              {isLive && (
                <span style={{ height: 18, padding: "0 7px", borderRadius: 4, background: "rgba(127,183,154,0.12)", border: "1px solid rgba(127,183,154,0.3)", color: "var(--ok-500)", fontSize: 8, fontFamily: "var(--font-mono)", fontWeight: 700, display: "flex", alignItems: "center" }}>
                  LIVE
                </span>
              )}
            </div>

            {/* JSON */}
            <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "12px 14px" }}>
              <pre style={{ margin: 0, fontSize: 10, fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.4)", lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                {JSON.stringify(strategy.compiledWorkflow || strategy.workflowJson, null, 2)}
              </pre>
            </div>

            {/* Execution step log (when done) */}
            <AnimatePresence>
              {(execState === "done:success" || execState === "done:suboptimal" || execState === "done:failed") && execResult?.stepLogs?.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "10px 14px", flexShrink: 0, maxHeight: 150, overflowY: "auto" }}
                >
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-tertiary)", letterSpacing: "0.1em", marginBottom: 6 }}>EXECUTION LOG</div>
                  {execResult.stepLogs.slice(0, 6).map((log: any, i: number) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <div style={{ width: 4, height: 4, borderRadius: "50%", flexShrink: 0, background: log.status === "success" ? "var(--ok-500)" : log.status === "failed" ? "#ff4444" : "rgba(255,255,255,0.2)" }} />
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(255,255,255,0.35)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.actionType || `step-${i + 1}`}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: log.status === "success" ? "var(--ok-500)" : "rgba(255,255,255,0.2)", flexShrink: 0 }}>{log.status}</span>
                    </div>
                  ))}
                  {execResult?.reputationTxHash && (
                    <a href={`https://chainscan-galileo.0g.ai/tx/${execResult.reputationTxHash}`} target="_blank" rel="noopener noreferrer"
                      style={{ display: "block", marginTop: 6, fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--attest-500)", textDecoration: "none" }}>
                      0G: {execResult.reputationTxHash.slice(0, 10)}... ↗
                    </a>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.aside>

        </div>{/* /body */}
      </div>{/* /root */}
    </>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "rgba(255,255,255,0.05)", marginBottom: 16 }} />;
}

function TrustChip({ label, color }: { label: string; color: string }) {
  return (
    <div style={{ height: 20, padding: "0 8px", borderRadius: 4, border: `1px solid ${color}`, color, fontSize: 9, fontWeight: 700, fontFamily: "var(--font-mono)", letterSpacing: "0.05em", opacity: 0.9, display: "flex", alignItems: "center" }}>
      {label}
    </div>
  );
}
