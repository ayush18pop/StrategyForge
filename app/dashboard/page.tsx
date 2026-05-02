"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import { AmbientLight } from "../../components/glass/AmbientLight";
import { ambientPresets } from "../../components/glass/ambient-presets";
import { PipelineLoadingScreen } from "../../components/pipeline/PipelineLoadingScreen";
import { ActivityTicker } from "../../components/ActivityTicker";
import { LiveYieldBoard } from "../../components/LiveYieldBoard";
import { ChainPulse } from "../../components/ChainPulse";

const easeOut = [0.22, 1, 0.36, 1] as const;

export default function DashboardPage() {
  const router = useRouter();
  const [asset, setAsset] = useState("USDC");
  const [amount, setAmount] = useState("50000");
  const [riskLevel, setRiskLevel] = useState<"balanced" | "conservative">("balanced");
  const [computePlatform, setComputePlatform] = useState<"0g" | "gemini" | "laguna">("gemini");
  const [horizon, setHorizon] = useState("6 months");
  const [chains, setChains] = useState("sepolia");
  const [targetYield, setTargetYield] = useState("800");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [isPending, setIsPending] = useState(false);
  const [liveRunId, setLiveRunId] = useState<string | null>(null);

  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (!savedUser) {
      router.push("/");
    } else {
      setUser(JSON.parse(savedUser));
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsPending(true);
    setLiveRunId(`run-${Date.now()}`); // Start loading screen

    try {
      const res = await fetch("/api/strategy/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.userId,
          walletAddress: user.walletAddress,
          goal: `Deposit ${amount} ${asset} into a yield bearing protocol on ${chains} aiming for ${targetYield} bps over ${horizon}. Risk level: ${riskLevel}.`,
          mockMode: false
        })
      });

      const data = await res.json();

      // We give the loading screen 8-10 seconds to finish its visual steps
      setTimeout(() => {
        setIsPending(false);
        if (res.ok) {
          toast.success("Strategy family created");
          // Navigate to strategy detail
          // Using strategyId returned from generate
          router.push(`/strategy/${data.strategyId || data.candidates?.[0]?.id || "latest"}`);
        } else {
          setLiveRunId(null);
          toast.error(data.error || "Failed to generate strategy");
        }
      }, 8500); // Wait for the visual loading to finish

    } catch (error: any) {
      setIsPending(false);
      setLiveRunId(null);
      toast.error(error.message);
    }
  };

  if (!user) return null;

  return (
    <>
      <PipelineLoadingScreen
        runId={liveRunId}
        isRunning={isPending}
        onComplete={() => {
          // Navigating in setTimeout above
        }}
      />

      <div className="generate-page" style={{ position: "relative", padding: "0 24px 64px" }}>
        <AmbientLight blobs={ambientPresets.hero} />

        {/* Top nav */}
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "20px 0 0", position: "relative", zIndex: 50 }}>
          <button
            onClick={() => router.push("/profile")}
            style={{ display: "inline-flex", alignItems: "center", gap: "8px", height: "32px", padding: "0 14px", borderRadius: "999px", background: "rgba(255,255,255,0.04)", color: "var(--text-secondary)", fontSize: "12px", fontWeight: 600, border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", fontFamily: "var(--font-mono)", letterSpacing: "0.05em" }}
          >
            ACCOUNT PROFILE
          </button>
        </div>

        {/* Two-column layout */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,480px) 1fr", gap: "48px", maxWidth: "1100px", margin: "0 auto", alignItems: "start", paddingTop: "32px" }}>
          {/* LEFT: Form + strategy list */}
          <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: easeOut }}
            >
              <span className="generate-hero__eyebrow" style={{ color: "var(--accent-verify)", letterSpacing: "0.1em", display: "block", marginBottom: "8px" }}>STRATEGY SYNTHESIS</span>
              <h1 className="generate-hero__title" style={{ fontSize: "clamp(28px, 4vw, 40px)", marginBottom: "8px" }}>
                What is your DeFi objective?
              </h1>
              <p className="generate-hero__subtitle" style={{ fontSize: "14px", marginBottom: "24px" }}>
                The agent reasons in three attested steps. Every inference is inspectable.
              </p>
            </motion.div>

            <form className="generate-form glass-card" onSubmit={handleSubmit}>
              <div className="generate-form__row">
                <div className="generate-form__field">
                  <label className="generate-form__label" htmlFor="gen-asset">
                    TARGET ASSET
                  </label>
                  <input
                    id="gen-asset"
                    className="generate-form__input"
                    value={asset}
                    onChange={(e) => setAsset(e.target.value.toUpperCase())}
                    placeholder="USDC"
                  />
                </div>
                <div className="generate-form__field">
                  <label className="generate-form__label" htmlFor="gen-amount">
                    POSITION SIZE
                  </label>
                  <input
                    id="gen-amount"
                    className="generate-form__input"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="50000"
                  />
                </div>
              </div>

              <div className="generate-form__field">
                <span className="generate-form__label">RISK POSTURE</span>
                <div className="generate-form__risk-group">
                  <button
                    type="button"
                    className={riskLevel === "balanced" ? "segmented-active" : "segmented-button"}
                    onClick={() => setRiskLevel("balanced")}
                  >
                    Balanced
                  </button>
                  <button
                    type="button"
                    className={riskLevel === "conservative" ? "segmented-active" : "segmented-button"}
                    onClick={() => setRiskLevel("conservative")}
                  >
                    Conservative
                  </button>
                </div>
              </div>

              <div className="generate-form__field">
                <span className="generate-form__label">AI Model</span>
                <div className="generate-form__risk-group">
                  <button
                    type="button"
                    className={computePlatform === "0g" ? "segmented-active" : "segmented-button"}
                    onClick={() => setComputePlatform("0g")}
                  >
                    0G Network
                  </button>
                  <button
                    type="button"
                    className={computePlatform === "gemini" ? "segmented-active" : "segmented-button"}
                    onClick={() => setComputePlatform("gemini")}
                  >
                    Gemini 2.0 Flash
                  </button>
                  <button
                    type="button"
                    className={computePlatform === "laguna" ? "segmented-active" : "segmented-button"}
                    onClick={() => setComputePlatform("laguna")}
                  >
                    Laguna Model
                  </button>
                </div>
              </div>

              <button
                type="button"
                className="generate-form__advanced-toggle"
                aria-expanded={advancedOpen}
                onClick={() => setAdvancedOpen(!advancedOpen)}
              >
                <ChevronDown size={14} />
                Advanced options
              </button>

              <div className="generate-form__advanced-fields" data-open={advancedOpen}>
                <div className="generate-form__advanced-inner">
                  <div className="generate-form__row">
                    <div className="generate-form__field">
                      <label className="generate-form__label" htmlFor="gen-horizon">Horizon</label>
                      <input
                        id="gen-horizon"
                        className="generate-form__input"
                        value={horizon}
                        onChange={(e) => setHorizon(e.target.value)}
                      />
                    </div>
                    <div className="generate-form__field">
                      <label className="generate-form__label" htmlFor="gen-yield">Target yield (bps)</label>
                      <input
                        id="gen-yield"
                        className="generate-form__input"
                        value={targetYield}
                        onChange={(e) => setTargetYield(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="generate-form__field">
                    <label className="generate-form__label" htmlFor="gen-chains">Chains</label>
                    <input
                      id="gen-chains"
                      className="generate-form__input"
                      value={chains}
                      onChange={(e) => setChains(e.target.value)}
                    />
                  </div>

                  <div className="generate-form__field">
                    <label className="generate-form__label">Turnkey Wallet (Auto-Provisioned)</label>
                    <div style={{
                      padding: "10px 14px",
                      borderRadius: "10px",
                      border: "1px solid var(--edge-sides)",
                      background: "var(--bg-3)",
                      color: "var(--text-primary)",
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--fs-sm)",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--color-ok)", flexShrink: 0 }} />
                      {user.walletAddress || "Connecting..."}
                    </div>
                  </div>
                </div>
              </div>

              <button type="submit" className="generate-form__submit" disabled={isPending}
                style={{ letterSpacing: "0.07em", textAlign: "left", borderRadius: "8px" }}
              >
                {isPending ? "SYNTHESIZING..." : "INITIATE FORGE"}
              </button>
            </form>

            {!isPending && <SavedStrategies userId={user.userId} />}
          </div>

          {/* RIGHT: Vertical pipeline station column */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: easeOut, delay: 0.15 }}
            style={{ paddingTop: "72px" }}
          >
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--accent-verify)", letterSpacing: "0.1em", fontWeight: 700, marginBottom: "20px" }}>
              INFERENCE PIPELINE
            </div>

            {/* Animated SVG connector running down the left edge */}
            <div style={{ position: "relative" }}>
              <svg
                style={{ position: "absolute", left: "19px", top: "20px", width: "2px", height: "calc(100% - 40px)", overflow: "visible", pointerEvents: "none" }}
                viewBox="0 0 2 100"
                preserveAspectRatio="none"
              >
                <style>{`
                  @keyframes flow-down { from { stroke-dashoffset: 12; } to { stroke-dashoffset: 0; } }
                  .connector-line { animation: flow-down 1.8s linear infinite; }
                `}</style>
                <line x1="1" y1="0" x2="1" y2="100" stroke="rgba(0,229,200,0.18)" strokeWidth="1.5" strokeDasharray="4 4" className="connector-line" vectorEffect="non-scaling-stroke" />
              </svg>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {[
                  { n: 1, label: "Discovery", badge: "deterministic", desc: "Fetches live action schemas" },
                  { n: 2, label: "Researcher", badge: "tee", desc: "Gathers market signals" },
                  { n: 3, label: "Strategist", badge: "tee", desc: "Proposes candidate workflows" },
                  { n: 4, label: "Critic", badge: "tee", desc: "Stress-tests candidates" },
                  { n: 5, label: "Compiler", badge: "deterministic", desc: "Compiles to deployable JSON" },
                  { n: 6, label: "Risk Validator", badge: "deterministic", desc: "Validates safety bounds" },
                ].map(({ n, label, badge, desc }, i) => (
                  <motion.div
                    key={label}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 0.6, x: 0 }}
                    transition={{ duration: 0.35, ease: easeOut, delay: 0.3 + i * 0.06 }}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: "14px",
                      padding: "14px 16px 14px 0",
                    }}
                  >
                    {/* Station number dot */}
                    <div style={{
                      width: "40px", height: "40px", flexShrink: 0,
                      borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                      border: badge === "tee" ? "1px solid rgba(0,229,200,0.3)" : "1px solid rgba(255,255,255,0.1)",
                      background: badge === "tee" ? "rgba(0,229,200,0.06)" : "rgba(255,255,255,0.03)",
                      fontFamily: "var(--font-mono)", fontSize: "13px", fontWeight: 700,
                      color: badge === "tee" ? "var(--accent-verify)" : "var(--text-tertiary)",
                      position: "relative", zIndex: 1,
                    }}>
                      {n}
                    </div>

                    <div style={{ paddingTop: "2px", minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                        <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>{label}</span>
                        <span style={{
                          fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.06em", padding: "1px 6px", borderRadius: "4px",
                          background: badge === "tee" ? "rgba(0,229,200,0.1)" : "rgba(255,255,255,0.05)",
                          color: badge === "tee" ? "var(--accent-verify)" : "var(--text-tertiary)",
                          border: badge === "tee" ? "1px solid rgba(0,229,200,0.2)" : "1px solid rgba(255,255,255,0.08)",
                        }}>
                          {badge === "tee" ? "◆ TEE" : "⚙ DET"}
                        </span>
                      </div>
                      <p style={{ fontSize: "12px", color: "var(--text-tertiary)", margin: 0, lineHeight: 1.4 }}>{desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>


          </motion.div>
        </div>

        {/* ── Live Intelligence Strip ────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: easeOut, delay: 0.35 }}
          style={{ maxWidth: "1100px", margin: "48px auto 0" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              marginBottom: "20px",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                color: "var(--accent-verify)",
                letterSpacing: "0.12em",
                fontWeight: 700,
              }}
            >
              LIVE INTELLIGENCE
            </span>
            <div style={{ flex: 1, height: "1px", background: "rgba(0,229,200,0.1)" }} />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                color: "var(--text-tertiary)",
                letterSpacing: "0.08em",
              }}
            >
              REAL-TIME · POLLING 8s
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "16px",
            }}
          >
            <ActivityTicker />
            <LiveYieldBoard />
            <ChainPulse />
          </div>
        </motion.div>
      </div>
    </>
  );
}

function SavedStrategies({ userId }: { userId: string }) {
  const [strategies, setStrategies] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetch(`/api/strategies/list?userId=${userId}`)
      .then(res => res.json())
      .then(data => {
        if (data.strategies) setStrategies(data.strategies);
      })
      .catch(console.error);
  }, [userId]);

  if (strategies.length === 0) return null;

  return (
    <div style={{ marginTop: '48px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent-verify)', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
          ACTIVE EVIDENCE CHAINS
        </h2>
        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
          {strategies.length} RECORDS
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
        {strategies.map(s => (
          <div
            key={s._id}
            onClick={() => router.push(`/strategy/${s._id}`)}
            className="liquid-glass-shell"
            style={{ padding: '20px', borderRadius: '16px', cursor: 'pointer', transition: 'transform 0.2s', background: 'rgba(255,255,255,0.02)', position: 'relative', overflow: 'hidden' }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            {/* Teal edge line for live strategies */}
            {s.lifecycle === 'live' && (
              <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '2px', background: 'var(--accent-verify)', borderRadius: '16px 0 0 16px' }} />
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{s.familyId}</span>
                {s.version >= 2 && (
                  <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--accent-verify)', letterSpacing: '0.04em' }}>
                    v{s.version - 1} → v{s.version}
                  </span>
                )}
              </div>
              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', background: s.lifecycle === 'live' ? 'rgba(0,229,200,0.12)' : 'rgba(255,255,255,0.07)', color: s.lifecycle === 'live' ? 'var(--accent-verify)' : 'var(--text-secondary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', flexShrink: 0 }}>
                {s.lifecycle.toUpperCase()}
              </span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.45 }}>
              {s.goal}
            </p>
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                v{s.version} · {new Date(s.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--accent-verify)', fontFamily: 'var(--font-mono)', opacity: 0.7 }}>
                ◆ attested
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
