"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

const ease = [0.22, 1, 0.36, 1] as const;

interface LiveEvent {
  id: string;
  type: "attestation" | "onchain";
  label: string;
  value: string;
  ts: string;
}

interface LiveStats {
  totalStrategies: number;
  totalAttestations: number;
  lastStrategyAt: string | null;
  block: number | null;
  bestYield: number | null;
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function truncate(s: string, n = 22) {
  return s.length <= n ? s : s.slice(0, 10) + "…" + s.slice(-6);
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

function Nav({ onConnect }: { onConnect: () => void }) {
  const [stats, setStats] = useState<LiveStats | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const r = await fetch("/api/live/stats");
        if (r.ok) setStats(await r.json());
      } catch {}
    }
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, height: "52px",
      zIndex: 100, display: "flex", alignItems: "center",
      justifyContent: "space-between", padding: "0 32px",
      borderBottom: "1px solid rgba(0,229,200,0.08)",
      background: "rgba(5,6,9,0.9)", backdropFilter: "blur(16px)",
    }}>
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700,
        letterSpacing: "0.14em", color: "var(--accent-verify)",
      }}>
        STRATEGYFORGE
      </span>

      <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
        {stats && (
          <>
            <Stat label="ATTESTATIONS" value={String(stats.totalAttestations)} color="var(--accent-verify)" />
            <Stat label="STRATEGIES" value={String(stats.totalStrategies)} color="var(--accent-verify)" />
            {stats.bestYield && <Stat label="BEST YIELD" value={`${stats.bestYield.toFixed(2)}%`} color="var(--ok-500)" />}
          </>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity }}
            style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--ok-500)", boxShadow: "0 0 6px var(--ok-500)", display: "inline-block" }} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--ok-500)", letterSpacing: "0.1em" }}>LIVE</span>
        </div>
      </div>

      <button
        onClick={onConnect}
        style={{
          padding: "8px 20px", borderRadius: "6px", border: "1px solid rgba(0,229,200,0.3)",
          background: "rgba(0,229,200,0.08)", color: "var(--accent-verify)",
          fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 700,
          letterSpacing: "0.1em", cursor: "pointer", transition: "all 0.2s",
        }}
        onMouseOver={(e) => { e.currentTarget.style.background = "rgba(0,229,200,0.15)"; }}
        onMouseOut={(e) => { e.currentTarget.style.background = "rgba(0,229,200,0.08)"; }}
      >
        CONNECT →
      </button>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--text-tertiary)", letterSpacing: "0.1em" }}>{label}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700, color, letterSpacing: "0.02em" }}>{value}</span>
    </div>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: "◆", label: "Inference Attestations", desc: "Every LLM call gets a cryptographic ID. Independently verifiable." },
  { icon: "⬡", label: "0G Chain Anchors", desc: "Strategy evidence stored on-chain. Tamper-proof audit trail." },
  { icon: "↺", label: "Self-Evolving Strategies", desc: "Agents learn from execution failures. v2 explicitly cites v1's mistakes." },
];

const PIPELINE_STEPS = [
  { n: "01", label: "Researcher", desc: "Analyzes market conditions, priors, failures", tag: "TEE ATTESTED" },
  { n: "02", label: "Strategist", desc: "Designs candidate KeeperHub workflows", tag: "TEE ATTESTED" },
  { n: "03", label: "Critic",     desc: "Selects best candidate, demands evidence of learning", tag: "TEE ATTESTED" },
  { n: "04", label: "Compiler",   desc: "Deterministic JSON → KeeperHub WorkflowSpec", tag: "DETERMINISTIC" },
];

function Hero({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <section style={{ paddingTop: "140px", paddingBottom: "80px", textAlign: "center", position: "relative", zIndex: 1 }}>
      {/* Eyebrow */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        style={{ marginBottom: "24px" }}
      >
        <span style={{
          display: "inline-flex", alignItems: "center", gap: "8px",
          padding: "5px 14px", borderRadius: "999px",
          border: "1px solid rgba(227,169,74,0.25)", background: "rgba(227,169,74,0.06)",
          fontFamily: "var(--font-mono)", fontSize: "10px",
          color: "var(--attest-500)", letterSpacing: "0.08em",
        }}>
          <span style={{ fontSize: "11px" }}>⬡</span>
          POWERED BY 0G COMPUTE NETWORK
        </span>
      </motion.div>

      {/* Headline */}
      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease, delay: 0.1 }}
        style={{
          fontFamily: "var(--font-display)", fontStyle: "italic",
          fontSize: "clamp(52px, 8vw, 96px)", lineHeight: 0.95,
          letterSpacing: "-0.03em", color: "var(--text-primary)",
          margin: "0 auto 24px", maxWidth: "900px",
        }}
      >
        Every Inference,<br />
        <span style={{ color: "var(--accent-verify)" }}>Attested.</span>
      </motion.h1>

      {/* Sub */}
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease, delay: 0.2 }}
        style={{
          fontFamily: "var(--font-sans)", fontSize: "clamp(15px, 2vw, 18px)",
          color: "var(--text-secondary)", lineHeight: 1.6,
          maxWidth: "560px", margin: "0 auto 40px",
        }}
      >
        StrategyForge generates KeeperHub DeFi workflows using a 3-step attested LLM pipeline.
        Strategies self-improve from execution failures. Every step is cryptographically provable.
      </motion.p>

      {/* CTAs */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease, delay: 0.3 }}
        style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}
      >
        <button
          onClick={onGetStarted}
          style={{
            padding: "14px 32px", borderRadius: "8px", border: "none",
            background: "var(--accent-forge)", color: "#050609",
            fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: 700,
            letterSpacing: "0.1em", cursor: "pointer", transition: "opacity 0.2s",
          }}
          onMouseOver={(e) => { e.currentTarget.style.opacity = "0.85"; }}
          onMouseOut={(e) => { e.currentTarget.style.opacity = "1"; }}
        >
          LAUNCH FORGE →
        </button>
        <DemoButton />
      </motion.div>

      {/* Feature pills */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        style={{ display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap", marginTop: "32px" }}
      >
        {FEATURES.map((f) => (
          <span key={f.label} style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            padding: "5px 12px", borderRadius: "999px",
            border: "1px solid rgba(0,229,200,0.18)", background: "rgba(0,229,200,0.05)",
            color: "var(--accent-verify)", fontFamily: "var(--font-mono)",
            fontSize: "10px", letterSpacing: "0.04em",
          }}>
            <span>{f.icon}</span>{f.label}
          </span>
        ))}
      </motion.div>
    </section>
  );
}

function DemoButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const handleDemo = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/demo/login", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Demo login failed");
      localStorage.setItem("user", JSON.stringify(data));
      router.push("/dashboard");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <button
      onClick={handleDemo}
      disabled={loading}
      style={{
        padding: "14px 32px", borderRadius: "8px",
        border: "1px solid rgba(0,229,200,0.25)", background: "rgba(0,229,200,0.06)",
        color: loading ? "rgba(0,229,200,0.4)" : "var(--accent-verify)",
        fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: 700,
        letterSpacing: "0.1em", cursor: loading ? "not-allowed" : "pointer", transition: "all 0.2s",
      }}
    >
      {loading ? "LOADING..." : "◆ TRY DEMO"}
    </button>
  );
}

// ─── Pipeline Section ─────────────────────────────────────────────────────────

function PipelineSection() {
  return (
    <section style={{ padding: "80px 40px", maxWidth: "1100px", margin: "0 auto", position: "relative", zIndex: 1 }}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease }}
        style={{ textAlign: "center", marginBottom: "56px" }}
      >
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.12em", color: "var(--text-tertiary)", marginBottom: "12px" }}>
          HOW IT WORKS
        </div>
        <h2 style={{
          fontFamily: "var(--font-display)", fontStyle: "italic",
          fontSize: "clamp(28px, 4vw, 42px)", letterSpacing: "-0.02em",
          color: "var(--text-primary)", margin: 0,
        }}>
          Three attested steps. One deployable strategy.
        </h2>
      </motion.div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "2px" }}>
        {PIPELINE_STEPS.map((step, i) => (
          <motion.div
            key={step.n}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, ease, delay: i * 0.08 }}
            style={{
              padding: "28px 24px",
              border: "1px solid rgba(255,255,255,0.06)",
              borderTop: "2px solid rgba(0,229,200,0.2)",
              background: "rgba(255,255,255,0.02)",
              position: "relative",
            }}
          >
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "rgba(0,229,200,0.3)", marginBottom: "12px", letterSpacing: "0.06em" }}>
              {step.n}
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: "20px", color: "var(--text-primary)", marginBottom: "10px" }}>
              {step.label}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-tertiary)", lineHeight: 1.55, marginBottom: "16px" }}>
              {step.desc}
            </div>
            <span style={{
              display: "inline-block", padding: "3px 8px", borderRadius: "4px",
              border: `1px solid ${step.tag === "TEE ATTESTED" ? "rgba(0,229,200,0.2)" : "rgba(227,169,74,0.2)"}`,
              background: step.tag === "TEE ATTESTED" ? "rgba(0,229,200,0.06)" : "rgba(227,169,74,0.06)",
              fontFamily: "var(--font-mono)", fontSize: "8px", letterSpacing: "0.1em",
              color: step.tag === "TEE ATTESTED" ? "var(--accent-verify)" : "var(--attest-500)",
            }}>
              {step.tag}
            </span>
            {i < PIPELINE_STEPS.length - 1 && (
              <div style={{
                position: "absolute", right: "-12px", top: "50%", transform: "translateY(-50%)",
                fontFamily: "var(--font-mono)", fontSize: "14px", color: "rgba(0,229,200,0.3)", zIndex: 2,
              }}>→</div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Evolution callout */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.45, ease, delay: 0.3 }}
        style={{
          marginTop: "24px", padding: "20px 28px",
          borderRadius: "12px", border: "1px solid rgba(0,229,200,0.15)",
          background: "rgba(0,229,200,0.03)",
          display: "flex", alignItems: "center", gap: "20px",
        }}
      >
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "20px", color: "var(--accent-verify)" }}>↺</span>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.1em", color: "var(--accent-verify)", marginBottom: "4px" }}>
            SELF-EVOLUTION
          </div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
            When a strategy fails in execution, the agent reads the failure reason and runs the pipeline again with prior lessons injected.
            v2's Critic <em>must</em> cite what v1 got wrong — the learning is provable and inspectable in the evidence bundle.
          </div>
        </div>
      </motion.div>
    </section>
  );
}

// ─── Live Feed Section ────────────────────────────────────────────────────────

function LiveFeedSection() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const seenRef = useRef<Set<string>>(new Set());

  const placeholders: LiveEvent[] = [
    { id: "ph1", type: "attestation", label: "◆ RESEARCHER ATTESTED", value: "att-v1-8f2a91b3c4d5e6f7g8h", ts: new Date(Date.now() - 45000).toISOString() },
    { id: "ph2", type: "attestation", label: "◆ STRATEGIST ATTESTED", value: "att-v1-2c7e4a1b9f8d3e2a1c", ts: new Date(Date.now() - 43000).toISOString() },
    { id: "ph3", type: "attestation", label: "◆ CRITIC ATTESTED",     value: "att-v1-6b3d9c2a5e1f4d7a9b", ts: new Date(Date.now() - 41000).toISOString() },
    { id: "ph4", type: "onchain",     label: "⬡ ON-CHAIN ANCHORED",   value: "0xdemo7a2f1b9e3c4d5a6f8", ts: new Date(Date.now() - 39000).toISOString() },
    { id: "ph5", type: "attestation", label: "◆ RESEARCHER ATTESTED", value: "att-v2-9a4c2e7b1d5f8c2e4a", ts: new Date(Date.now() - 120000).toISOString() },
    { id: "ph6", type: "attestation", label: "◆ STRATEGIST ATTESTED", value: "att-v2-3f8a1c6e2b9d5a7c3e", ts: new Date(Date.now() - 118000).toISOString() },
  ];

  useEffect(() => {
    async function load() {
      try {
        const r = await fetch("/api/live/events");
        if (!r.ok) return;
        const { events: incoming } = await r.json();
        const fresh = incoming.filter((e: LiveEvent) => !seenRef.current.has(e.id));
        if (fresh.length) {
          setNewIds(new Set(fresh.map((e: LiveEvent) => e.id)));
          setTimeout(() => setNewIds(new Set()), 1400);
          fresh.forEach((e: LiveEvent) => seenRef.current.add(e.id));
        }
        incoming.forEach((e: LiveEvent) => seenRef.current.add(e.id));
        setEvents(incoming.slice(0, 8));
      } catch {}
      setLoaded(true);
    }
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, []);

  const displayEvents = loaded && events.length > 0 ? events : placeholders;

  return (
    <section style={{ padding: "80px 40px", maxWidth: "1100px", margin: "0 auto", position: "relative", zIndex: 1 }}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease }}
        style={{ marginBottom: "40px" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.12em", color: "var(--accent-verify)", fontWeight: 700 }}>
            LIVE ATTESTATION FEED
          </div>
          <motion.div
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 2.4, repeat: Infinity }}
            style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent-verify)", boxShadow: "0 0 8px var(--accent-verify)" }}
          />
        </div>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-tertiary)", margin: 0 }}>
          Real inference attestations from deployed strategies — independently verifiable on 0G Chain
        </p>
      </motion.div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "8px" }}>
        <AnimatePresence initial={false}>
          {displayEvents.map((ev, i) => {
            const isOnChain = ev.type === "onchain";
            const isNew = newIds.has(ev.id);
            return (
              <motion.div
                key={ev.id}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease, delay: i * 0.04 }}
                style={{
                  padding: "14px 16px",
                  borderRadius: "10px",
                  border: `1px solid ${isOnChain ? "rgba(227,169,74,0.12)" : "rgba(0,229,200,0.1)"}`,
                  background: isNew
                    ? (isOnChain ? "rgba(227,169,74,0.07)" : "rgba(0,229,200,0.06)")
                    : "rgba(255,255,255,0.02)",
                  display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em", color: isOnChain ? "var(--attest-500)" : "var(--accent-verify)" }}>
                    {ev.label}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: isOnChain ? "rgba(227,169,74,0.7)" : "rgba(0,229,200,0.7)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {truncate(ev.value, 32)}
                  </span>
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--text-tertiary)", flexShrink: 0 }}>
                  {timeAgo(ev.ts)}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </section>
  );
}

// ─── Auth Section ─────────────────────────────────────────────────────────────

function AuthSection({ id }: { id?: string }) {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [btnText, setBtnText] = useState("INITIALIZE SESSION");
  const btnTargetRef = useRef("");

  const typewriterEffect = (text: string) => {
    btnTargetRef.current = text;
    setBtnText("");
    let i = 0;
    const interval = setInterval(() => {
      if (i >= text.length || btnTargetRef.current !== text) { clearInterval(interval); return; }
      setBtnText(text.slice(0, ++i));
    }, 55);
  };

  useEffect(() => {
    setBtnText(isLogin ? "INITIALIZE SESSION" : "REGISTER OPERATOR");
  }, [isLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    typewriterEffect("INITIALIZING...");
    try {
      const res = await fetch(isLogin ? "/api/auth/login" : "/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Authentication failed");
      localStorage.setItem("user", JSON.stringify(data));
      toast.success(isLogin ? "Session initialized" : "Operator registered");
      router.push(data.walletAddress ? "/dashboard" : "/profile");
    } catch (error: any) {
      toast.error(error.message);
      setBtnText(isLogin ? "INITIALIZE SESSION" : "REGISTER OPERATOR");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id={id} style={{ padding: "80px 40px 120px", position: "relative", zIndex: 1 }}>
      <div style={{
        maxWidth: "480px", margin: "0 auto",
        padding: "40px", borderRadius: "20px",
        border: "1px solid rgba(255,255,255,0.07)",
        borderTop: "2px solid rgba(0,229,200,0.2)",
        background: "rgba(255,255,255,0.03)",
        backdropFilter: "blur(24px)",
      }}>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, ease }}
        >
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.12em", color: "var(--text-tertiary)", marginBottom: "8px" }}>
              OPERATOR ACCESS
            </div>
            <h3 style={{
              fontFamily: "var(--font-display)", fontStyle: "italic",
              fontSize: "28px", letterSpacing: "-0.02em",
              color: "var(--text-primary)", margin: 0,
            }}>
              Connect to the Forge
            </h3>
          </div>

          {/* Mode toggle */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr",
            borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)",
            overflow: "hidden", background: "rgba(255,255,255,0.02)", marginBottom: "24px",
          }}>
            {[{ label: "LOGIN", value: true }, { label: "REGISTER", value: false }].map((opt) => (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => setIsLogin(opt.value)}
                style={{
                  padding: "9px", background: isLogin === opt.value ? "rgba(0,229,200,0.1)" : "transparent",
                  border: "none", cursor: "pointer",
                  fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.1em",
                  color: isLogin === opt.value ? "var(--accent-verify)" : "var(--text-tertiary)",
                  transition: "all 0.2s", fontWeight: isLogin === opt.value ? 700 : 400,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {[
              { id: "username", label: "OPERATOR ID", type: "text", value: username, set: setUsername, ph: "agent_commander" },
              { id: "password", label: "ACCESS KEY", type: "password", value: password, set: setPassword, ph: "••••••••" },
            ].map((field) => (
              <div key={field.id} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label htmlFor={field.id} style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--text-tertiary)", letterSpacing: "0.1em" }}>
                  {field.label}
                </label>
                <input
                  id={field.id} type={field.type} value={field.value}
                  onChange={(e) => field.set(e.target.value)}
                  placeholder={field.ph} required
                  style={{
                    padding: "12px 14px", borderRadius: "8px",
                    border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)",
                    color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: "13px",
                    outline: "none", transition: "border-color 0.2s",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(0,229,200,0.4)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
                />
              </div>
            ))}

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "14px 24px", borderRadius: "8px", border: "none",
                background: loading ? "rgba(255,255,255,0.06)" : "var(--accent-forge)",
                color: loading ? "var(--text-tertiary)" : "#050609",
                fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: 700,
                letterSpacing: "0.1em", cursor: loading ? "not-allowed" : "pointer",
                transition: "background 0.2s", marginTop: "4px",
              }}
            >
              {btnText}
            </button>
          </form>

          <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "20px 0" }}>
            <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.06)" }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--text-tertiary)", letterSpacing: "0.1em" }}>OR</span>
            <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.06)" }} />
          </div>

          <DemoButton />
        </motion.div>
      </div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const scrollToAuth = () => {
    document.getElementById("auth")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div style={{ position: "relative", minHeight: "100vh", background: "var(--bg-0)" }}>
      {/* Ambient gradients */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        background: `
          radial-gradient(ellipse 70% 50% at 50% -10%, rgba(0,229,200,0.06) 0%, transparent 60%),
          radial-gradient(ellipse 40% 60% at 100% 70%, rgba(200,255,0,0.03) 0%, transparent 60%)
        `,
      }} />

      {/* Grid overlay */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M 40 0 L 0 0 0 40' fill='none' stroke='rgba(0,229,200,0.025)' stroke-width='0.5'/%3E%3C/svg%3E")`,
      }} />

      <Nav onConnect={scrollToAuth} />

      <Hero onGetStarted={scrollToAuth} />

      <PipelineSection />

      <LiveFeedSection />

      <AuthSection id="auth" />
    </div>
  );
}
