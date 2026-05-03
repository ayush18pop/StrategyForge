"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ChevronDown, Zap } from "lucide-react";
import { PipelineLoadingScreen } from "../../components/pipeline/PipelineLoadingScreen";
import { ActivityTicker } from "../../components/ActivityTicker";
import { LiveYieldBoard } from "../../components/LiveYieldBoard";
import { ChainPulse } from "../../components/ChainPulse";

const ease = [0.22, 1, 0.36, 1] as const;

const STAGES = [
  { n: 1, label: "Discovery",  tee: false },
  { n: 2, label: "Researcher", tee: true  },
  { n: 3, label: "Strategist", tee: true  },
  { n: 4, label: "Critic",     tee: true  },
  { n: 5, label: "Compiler",   tee: false },
  { n: 6, label: "Validator",  tee: false },
];

export default function DashboardPage() {
  const router = useRouter();
  const [asset, setAsset] = useState("USDC");
  const [amount, setAmount] = useState("50000");
  const [riskLevel, setRiskLevel] = useState<"safe" | "cautious" | "balanced" | "aggressive" | "degen">("balanced");
  const [horizon, setHorizon] = useState("6 months");
  const [chains, setChains] = useState("sepolia");
  const [targetYield, setTargetYield] = useState("800");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [isPending, setIsPending] = useState(false);
  const [liveRunId, setLiveRunId] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [strategies, setStrategies] = useState<any[]>([]);
  const [strategiesLoaded, setStrategiesLoaded] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (!savedUser) { router.push("/"); return; }
    const u = JSON.parse(savedUser);
    setUser(u);
    fetch(`/api/strategies/list?userId=${u.userId}`)
      .then(r => r.json())
      .then(d => { if (d.strategies) setStrategies(d.strategies); })
      .catch(console.error)
      .finally(() => setStrategiesLoaded(true));
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsPending(true);
    setLiveRunId(`run-${Date.now()}`);
    try {
      const res = await fetch("/api/strategy/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.userId,
          walletAddress: user.walletAddress,
          goal: `Deposit ${amount} ${asset} into a yield bearing protocol on ${chains} aiming for ${targetYield} bps over ${horizon}. Risk level: ${riskLevel}.`,
          mockMode: false,
        }),
      });
      const data = await res.json();
      setTimeout(() => {
        setIsPending(false);
        if (res.ok) {
          toast.success("Strategy forged");
          router.push(`/strategy/${data.strategyId || "latest"}`);
        } else {
          setLiveRunId(null);
          toast.error(data.error || "Failed to generate strategy");
        }
      }, 8500);
    } catch (err: any) {
      setIsPending(false);
      setLiveRunId(null);
      toast.error(err.message);
    }
  };

  if (!user) return null;

  return (
    <>
      <PipelineLoadingScreen runId={liveRunId} isRunning={isPending} onComplete={() => {}} />

      {/* ── ROOT: full viewport, no scroll ── */}
      <div style={{
        height: "100vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-0)",
      }}>

        {/* ── HEADER ── */}
        <header style={{
          height: 44,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 18px",
          borderBottom: "1px solid rgba(0,229,200,0.07)",
          background: "rgba(5,6,9,0.92)",
          backdropFilter: "blur(16px)",
          position: "relative",
          zIndex: 20,
        }}>
          {/* Brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <svg width="18" height="18" viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0 }}>
              <polygon points="16,2 28,9 28,23 16,30 4,23 4,9"
                stroke="#00e5c8" strokeWidth="1.5" fill="rgba(0,229,200,0.08)" />
              <path d="M18 8 L12 17 H16 L14 24 L20 15 H16 Z" fill="#c8ff00" />
            </svg>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--text-primary)" }}>
              STRATEGYFORGE
            </span>
            {/* live pulse */}
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: 6, padding: "2px 8px", borderRadius: 999, border: "1px solid rgba(0,229,200,0.15)", background: "rgba(0,229,200,0.05)" }}>
              <motion.div
                animate={{ opacity: [1, 0.25, 1] }}
                transition={{ duration: 2.2, repeat: Infinity }}
                style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--accent-verify)" }}
              />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--accent-verify)", letterSpacing: "0.1em" }}>
                LIVE
              </span>
            </div>
          </div>

          <button
            onClick={() => router.push("/profile")}
            style={{
              height: 26, padding: "0 11px", borderRadius: 999,
              background: "rgba(255,255,255,0.04)", color: "var(--text-tertiary)",
              fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: "0.07em",
              border: "1px solid rgba(255,255,255,0.07)", cursor: "pointer",
              transition: "color 0.15s, border-color 0.15s",
            }}
            onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.14)"; }}
            onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-tertiary)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.07)"; }}
          >
            ACCOUNT PROFILE
          </button>
        </header>

        {/* ── BODY: two columns ── */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

          {/* ══════════════════════════════════════
              LEFT COLUMN — FORGE PANEL (fixed 330px)
          ══════════════════════════════════════ */}
          <motion.aside
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, ease }}
            style={{
              width: 330,
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              borderRight: "1px solid rgba(0,229,200,0.08)",
              background: "rgba(0,229,200,0.014)",
              overflow: "hidden",
            }}
          >
            {/* Scrollable inner so it doesn't break on short screens */}
            <div style={{ flex: 1, overflowY: "auto", padding: "18px 18px 0" }}>

              {/* Eyebrow + headline */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--accent-verify)", letterSpacing: "0.14em", fontWeight: 700, marginBottom: 6 }}>
                  STRATEGY SYNTHESIS
                </div>
                <h1 style={{
                  fontFamily: "var(--font-display)", fontStyle: "italic",
                  fontSize: "clamp(18px, 2.4vw, 24px)", lineHeight: 1.12,
                  letterSpacing: "-0.02em", color: "var(--text-primary)", margin: 0,
                }}>
                  What is your<br />DeFi objective?
                </h1>
                <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 5, lineHeight: 1.4 }}>
                  Three attested steps. Every inference inspectable.
                </p>
              </div>

              {/* ── FORM ── */}
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 9 }}>

                {/* Asset + Size */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                  {[
                    { label: "TARGET ASSET", value: asset, onChange: (v: string) => setAsset(v.toUpperCase()), placeholder: "USDC" },
                    { label: "POSITION SIZE", value: amount, onChange: (v: string) => setAmount(v), placeholder: "50000" },
                  ].map(f => (
                    <div key={f.label}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-tertiary)", letterSpacing: "0.1em", marginBottom: 3 }}>
                        {f.label}
                      </div>
                      <input
                        value={f.value}
                        onChange={e => f.onChange(e.target.value)}
                        placeholder={f.placeholder}
                        className="generate-form__input"
                        style={{ width: "100%", height: 32, fontSize: 12, padding: "0 9px" }}
                      />
                    </div>
                  ))}
                </div>

                {/* Risk */}
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-tertiary)", letterSpacing: "0.1em", marginBottom: 4 }}>
                    RISK POSTURE
                  </div>
                  {(() => {
                    const levels = [
                      { id: "safe" as const,       label: "SAFE",       color: "#4ade80", bg: "rgba(74,222,128,0.1)",  border: "rgba(74,222,128,0.28)"  },
                      { id: "cautious" as const,    label: "CAUTIOUS",   color: "#67e8f9", bg: "rgba(103,232,249,0.08)", border: "rgba(103,232,249,0.22)" },
                      { id: "balanced" as const,    label: "BALANCED",   color: "#00e5c8", bg: "rgba(0,229,200,0.1)",  border: "rgba(0,229,200,0.28)"  },
                      { id: "aggressive" as const,  label: "AGGR",       color: "#e3a94a", bg: "rgba(227,169,74,0.1)", border: "rgba(227,169,74,0.28)"  },
                      { id: "degen" as const,       label: "DEGEN",      color: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.28)" },
                    ];
                    const selected = levels.find(l => l.id === riskLevel)!;
                    return (
                      <div>
                        <div style={{ display: "flex", gap: 4 }}>
                          {levels.map(l => {
                            const active = riskLevel === l.id;
                            return (
                              <button
                                key={l.id} type="button" onClick={() => setRiskLevel(l.id)}
                                style={{
                                  flex: 1, height: 28, borderRadius: 6, padding: 0,
                                  fontFamily: "var(--font-mono)", fontSize: 8, fontWeight: 700, letterSpacing: "0.04em",
                                  background: active ? l.bg : "rgba(255,255,255,0.03)",
                                  border: `1px solid ${active ? l.border : "rgba(255,255,255,0.06)"}`,
                                  color: active ? l.color : "rgba(255,255,255,0.2)",
                                  cursor: "pointer", transition: "all 0.14s",
                                }}
                              >
                                {l.label}
                              </button>
                            );
                          })}
                        </div>
                        <div style={{ marginTop: 4, fontFamily: "var(--font-mono)", fontSize: 8, color: selected.color, opacity: 0.7, letterSpacing: "0.05em" }}>
                          {selected.id === "safe" && "Capital preservation first"}
                          {selected.id === "cautious" && "Minimal volatility exposure"}
                          {selected.id === "balanced" && "Risk-adjusted returns"}
                          {selected.id === "aggressive" && "Higher yield, higher risk"}
                          {selected.id === "degen" && "Max yield, uncapped risk"}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Advanced toggle */}
                <button
                  type="button" onClick={() => setAdvancedOpen(!advancedOpen)}
                  style={{
                    display: "flex", alignItems: "center", gap: 4,
                    background: "none", border: "none", cursor: "pointer", padding: 0,
                    fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-tertiary)", letterSpacing: "0.09em",
                  }}
                >
                  <ChevronDown size={9} style={{ transform: advancedOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                  ADVANCED OPTIONS
                </button>

                <AnimatePresence>
                  {advancedOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease }}
                      style={{ overflow: "hidden" }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: 7, paddingBottom: 2 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                          {[
                            { label: "HORIZON", value: horizon, set: setHorizon },
                            { label: "TARGET BPS", value: targetYield, set: setTargetYield },
                          ].map(f => (
                            <div key={f.label}>
                              <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-tertiary)", letterSpacing: "0.1em", marginBottom: 3 }}>{f.label}</div>
                              <input value={f.value} onChange={e => f.set(e.target.value)} className="generate-form__input" style={{ width: "100%", height: 28, fontSize: 11, padding: "0 8px" }} />
                            </div>
                          ))}
                        </div>
                        <div>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-tertiary)", letterSpacing: "0.1em", marginBottom: 3 }}>CHAIN</div>
                          <input value={chains} onChange={e => setChains(e.target.value)} className="generate-form__input" style={{ width: "100%", height: 28, fontSize: 11, padding: "0 8px" }} />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isPending}
                  className="generate-form__submit"
                  style={{
                    height: 42, borderRadius: 8, marginTop: 2,
                    fontSize: 11, letterSpacing: "0.09em",
                    background: isPending ? "rgba(255,255,255,0.06)" : "var(--accent-forge)",
                    textAlign: "left", paddingLeft: 16,
                  }}
                >
                  {isPending ? "SYNTHESIZING..." : "INITIATE FORGE"}
                </button>
              </form>

              {/* ── PIPELINE STAGES ── */}
              <div style={{ marginTop: 20, paddingBottom: 16 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--accent-verify)", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 10 }}>
                  INFERENCE PIPELINE
                </div>

                {/* Animated vertical connector */}
                <div style={{ position: "relative" }}>
                  <svg
                    style={{ position: "absolute", left: 13, top: 14, width: 2, height: "calc(100% - 28px)", overflow: "visible", pointerEvents: "none" }}
                    viewBox="0 0 2 100" preserveAspectRatio="none"
                  >
                    <style>{`
                      @keyframes sf-flow { from { stroke-dashoffset: 8 } to { stroke-dashoffset: 0 } }
                      .sf-line { animation: sf-flow 1.6s linear infinite }
                    `}</style>
                    <line x1="1" y1="0" x2="1" y2="100"
                      stroke="rgba(0,229,200,0.14)" strokeWidth="1.5" strokeDasharray="3 3"
                      className="sf-line" vectorEffect="non-scaling-stroke"
                    />
                  </svg>

                  <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    {STAGES.map(({ n, label, tee }, i) => (
                      <motion.div
                        key={label}
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.28, ease, delay: 0.35 + i * 0.05 }}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0" }}
                      >
                        <div style={{
                          width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          border: tee ? "1px solid rgba(0,229,200,0.3)" : "1px solid rgba(255,255,255,0.09)",
                          background: tee ? "rgba(0,229,200,0.07)" : "rgba(255,255,255,0.03)",
                          fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
                          color: tee ? "var(--accent-verify)" : "var(--text-tertiary)",
                          position: "relative", zIndex: 1,
                        }}>
                          {n}
                        </div>
                        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 7 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>{label}</span>
                          <span style={{
                            fontFamily: "var(--font-mono)", fontSize: 8, padding: "1px 5px", borderRadius: 3, letterSpacing: "0.04em",
                            background: tee ? "rgba(0,229,200,0.08)" : "rgba(255,255,255,0.04)",
                            color: tee ? "var(--accent-verify)" : "var(--text-tertiary)",
                            border: tee ? "1px solid rgba(0,229,200,0.18)" : "1px solid rgba(255,255,255,0.06)",
                          }}>
                            {tee ? "◆ TEE" : "⚙ DET"}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>

            </div>{/* /scrollable inner */}
          </motion.aside>

          {/* ══════════════════════════════════════
              RIGHT COLUMN — INTELLIGENCE PANEL
          ══════════════════════════════════════ */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

            {/* ── TOP: ACTIVE EVIDENCE CHAINS ── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease, delay: 0.1 }}
              style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: "14px 18px 0" }}
            >
              {/* Section label row */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexShrink: 0 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--accent-verify)", letterSpacing: "0.12em", fontWeight: 700 }}>
                  ACTIVE EVIDENCE CHAINS
                </span>
                {strategiesLoaded && (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-tertiary)" }}>
                    {strategies.length} records · {(() => {
                      const fams = new Map<string, number>();
                      strategies.forEach((s: any) => { fams.set(s.familyId, (fams.get(s.familyId) || 0) + 1); });
                      return fams.size;
                    })()} families
                  </span>
                )}
                <div style={{ flex: 1, height: 1, background: "rgba(0,229,200,0.07)" }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-tertiary)", letterSpacing: "0.06em" }}>
                  CLICK TO INSPECT →
                </span>
              </div>

              {/* Cards area — internal scroll only */}
              <div style={{ flex: 1, overflowY: "auto", paddingBottom: 12 }}>
                {!strategiesLoaded ? (
                  // Skeleton
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 9 }}>
                    {[1, 2, 3].map(i => (
                      <div key={i} style={{ height: 92, borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }} />
                    ))}
                  </div>
                ) : strategies.length === 0 ? (
                  // Empty state
                  <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: "50%",
                      border: "1px solid rgba(0,229,200,0.12)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Zap size={16} color="rgba(0,229,200,0.25)" />
                    </div>
                    <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-tertiary)", textAlign: "center", lineHeight: 1.6, margin: 0 }}>
                      No evidence chains yet.<br />Forge your first strategy.
                    </p>
                  </div>
                ) : (() => {
                  // Deduplicate: only show latest version per family
                  const familyMap = new Map<string, any>();
                  strategies.forEach((s: any) => {
                    const existing = familyMap.get(s.familyId);
                    if (!existing || s.version > existing.version) {
                      familyMap.set(s.familyId, s);
                    }
                  });
                  const latestStrategies = Array.from(familyMap.values());

                  return (
                  // Strategy cards grid
                  <motion.div
                    initial="hidden"
                    animate="show"
                    variants={{ show: { transition: { staggerChildren: 0.04 } } }}
                    style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 9, alignContent: "start" }}
                  >
                    {latestStrategies.map(s => {
                      const isLive = s.lifecycle === "live";
                      const isDep = s.lifecycle === "deprecated";
                      return (
                        <motion.div
                          key={s._id}
                          variants={{
                            hidden: { opacity: 0, y: 10 },
                            show: { opacity: 1, y: 0, transition: { duration: 0.3, ease } },
                          }}
                          onClick={() => router.push(`/strategy/${s._id}`)}
                          style={{
                            padding: "13px 14px",
                            borderRadius: 12,
                            background: "rgba(255,255,255,0.025)",
                            border: "1px solid rgba(255,255,255,0.06)",
                            cursor: "pointer",
                            position: "relative",
                            overflow: "hidden",
                            transition: "border-color 0.18s, transform 0.18s, background 0.18s",
                          }}
                          onMouseOver={e => {
                            const el = e.currentTarget as HTMLDivElement;
                            el.style.borderColor = isLive ? "rgba(0,229,200,0.22)" : "rgba(255,255,255,0.1)";
                            el.style.transform = "translateY(-2px)";
                            el.style.background = "rgba(255,255,255,0.035)";
                          }}
                          onMouseOut={e => {
                            const el = e.currentTarget as HTMLDivElement;
                            el.style.borderColor = "rgba(255,255,255,0.06)";
                            el.style.transform = "translateY(0)";
                            el.style.background = "rgba(255,255,255,0.025)";
                          }}
                        >
                          {/* Left accent bar */}
                          {isLive && (
                            <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 2, background: "var(--accent-verify)", borderRadius: "12px 0 0 12px" }} />
                          )}
                          {isDep && (
                            <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 2, background: "rgba(255,255,255,0.1)", borderRadius: "12px 0 0 12px" }} />
                          )}

                          {/* Card header */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 5 }}>
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)", letterSpacing: "0.02em", lineHeight: 1.3 }}>
                                {s.familyId}
                              </div>
                              {s.version >= 2 && (
                                <div style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--accent-verify)", letterSpacing: "0.04em", marginTop: 2 }}>
                                  v{s.version - 1} → v{s.version}
                                </div>
                              )}
                            </div>
                            <span style={{
                              fontSize: 8, padding: "2px 7px", borderRadius: 999, fontFamily: "var(--font-mono)", letterSpacing: "0.05em", flexShrink: 0,
                              background: isLive ? "rgba(0,229,200,0.1)" : isDep ? "rgba(255,255,255,0.04)" : "rgba(200,255,0,0.07)",
                              color: isLive ? "var(--accent-verify)" : isDep ? "var(--text-tertiary)" : "var(--accent-forge)",
                              border: `1px solid ${isLive ? "rgba(0,229,200,0.2)" : isDep ? "rgba(255,255,255,0.06)" : "rgba(200,255,0,0.15)"}`,
                            }}>
                              {s.lifecycle.toUpperCase()}
                            </span>
                          </div>

                          {/* Goal text */}
                          <p style={{
                            fontSize: 10, color: "var(--text-tertiary)", lineHeight: 1.45, margin: 0,
                            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                          }}>
                            {s.goal}
                          </p>

                          {/* Footer */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                            <span style={{ fontSize: 9, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
                              {new Date(s.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}
                            </span>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              {s.onChainAgentId && (
                                <a
                                  href={`https://chainscan-galileo.0g.ai/address/0x6274f0A5277c468Eb338EE8986D5Fd157C9A6338`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  style={{
                                    fontSize: 8, padding: "1px 6px", borderRadius: 4,
                                    background: "rgba(227,169,74,0.08)", border: "1px solid rgba(227,169,74,0.18)",
                                    color: "var(--attest-500)", fontFamily: "var(--font-mono)",
                                    textDecoration: "none", letterSpacing: "0.04em",
                                  }}
                                >
                                  ⬡ 0G INFT #{s.onChainAgentId}
                                </a>
                              )}
                              <span style={{ fontSize: 9, color: isLive ? "var(--accent-verify)" : "rgba(255,255,255,0.2)", fontFamily: "var(--font-mono)" }}>
                                ◆ {s.version >= 2 ? "evolved" : "attested"}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                  );
                })()}
              </div>
            </motion.div>

            {/* ── BOTTOM: LIVE INTELLIGENCE STRIP ── */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease, delay: 0.25 }}
              style={{
                height: 208,
                flexShrink: 0,
                borderTop: "1px solid rgba(0,229,200,0.07)",
                display: "flex",
                overflow: "hidden",
              }}
            >
              {/* Panel label strip */}
              <div style={{ position: "absolute", pointerEvents: "none" }} />

              <div style={{ flex: 1, borderRight: "1px solid rgba(255,255,255,0.04)", overflow: "hidden" }}>
                <ActivityTicker />
              </div>
              <div style={{ flex: 1, borderRight: "1px solid rgba(255,255,255,0.04)", overflow: "hidden" }}>
                <LiveYieldBoard />
              </div>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <ChainPulse />
              </div>
            </motion.div>

          </div>{/* /right column */}
        </div>{/* /body */}
      </div>{/* /root */}
    </>
  );
}
