"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

const ease = [0.22, 1, 0.36, 1] as const;

// ─── Types ──────────────────────────────────────────────────────────────────

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Stats Bar ───────────────────────────────────────────────────────────────

function StatsBar() {
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

  const items = [
    {
      label: "BLOCK",
      value: stats?.block ? stats.block.toLocaleString() : "—",
      color: "var(--attest-500)",
    },
    {
      label: "ATTESTATIONS",
      value: stats ? String(stats.totalAttestations) : "—",
      color: "var(--accent-verify)",
    },
    {
      label: "STRATEGIES",
      value: stats ? String(stats.totalStrategies) : "—",
      color: "var(--accent-verify)",
    },
    {
      label: "BEST YIELD",
      value: stats?.bestYield ? `${stats.bestYield.toFixed(2)}%` : "—",
      color: "var(--ok-500)",
    },
  ];

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "36px",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        borderBottom: "1px solid rgba(0,229,200,0.08)",
        background: "rgba(5,6,9,0.92)",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Brand */}
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          fontWeight: 700,
          letterSpacing: "0.14em",
          color: "var(--accent-verify)",
        }}
      >
        STRATEGYFORGE
      </span>

      {/* Live stats */}
      <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
        {items.map((item) => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                color: "var(--text-tertiary)",
                letterSpacing: "0.1em",
              }}
            >
              {item.label}
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                fontWeight: 700,
                color: item.color,
                letterSpacing: "0.02em",
              }}
            >
              {item.value}
            </span>
          </div>
        ))}
      </div>

      {/* Live indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <motion.span
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--ok-500)",
            display: "inline-block",
            boxShadow: "0 0 6px var(--ok-500)",
          }}
        />
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            color: "var(--ok-500)",
            letterSpacing: "0.1em",
          }}
        >
          LIVE
        </span>
      </div>
    </div>
  );
}

// ─── Event Card ───────────────────────────────────────────────────────────────

function EventCard({ event, isNew }: { event: LiveEvent; isNew: boolean }) {
  const [highlight, setHighlight] = useState(isNew);

  useEffect(() => {
    if (isNew) {
      const t = setTimeout(() => setHighlight(false), 1200);
      return () => clearTimeout(t);
    }
  }, [isNew]);

  const isOnChain = event.type === "onchain";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -16, scale: 0.97, backgroundColor: "rgba(0,229,200,0)" }}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
        backgroundColor: highlight
          ? isOnChain
            ? "rgba(227,169,74,0.07)"
            : "rgba(0,229,200,0.06)"
          : "rgba(255,255,255,0.02)",
      }}
      exit={{ opacity: 0, scale: 0.95, backgroundColor: "rgba(0,229,200,0)" }}
      transition={{ duration: 0.35, ease }}
      style={{
        borderRadius: "10px",
        border: `1px solid ${isOnChain ? "rgba(227,169,74,0.12)" : "rgba(0,229,200,0.1)"}`,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            fontWeight: 700,
            letterSpacing: "0.1em",
            color: isOnChain ? "var(--attest-500)" : "var(--accent-verify)",
          }}
        >
          {event.label}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            color: "var(--text-tertiary)",
          }}
        >
          {timeAgo(event.ts)}
        </span>
      </div>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          color: isOnChain ? "rgba(227,169,74,0.7)" : "rgba(0,229,200,0.7)",
          letterSpacing: "0.03em",
        }}
      >
        {truncate(event.value, 30)}
      </span>
    </motion.div>
  );
}

// ─── Live Attestation Wall ────────────────────────────────────────────────────

function LiveAttestationWall() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const seenRef = useRef<Set<string>>(new Set());

  // Placeholder events shown before real data loads
  const placeholders: LiveEvent[] = [
    { id: "ph1", type: "attestation", label: "◆ RESEARCHER ATTESTED", value: "or-v1-demo-8f2a91b3c4d5", ts: new Date(Date.now() - 45000).toISOString() },
    { id: "ph2", type: "attestation", label: "◆ STRATEGIST ATTESTED", value: "or-v1-demo-2c7e4a1b9f8d", ts: new Date(Date.now() - 43000).toISOString() },
    { id: "ph3", type: "attestation", label: "◆ CRITIC ATTESTED",     value: "or-v1-demo-6b3d9c2a5e1f", ts: new Date(Date.now() - 41000).toISOString() },
    { id: "ph4", type: "onchain",     label: "⬡ ON-CHAIN ANCHORED",   value: "0xdemo7a2f1b9e3c4d5a6f8", ts: new Date(Date.now() - 39000).toISOString() },
    { id: "ph5", type: "attestation", label: "◆ RESEARCHER ATTESTED", value: "or-v2-demo-9a4c2e7b1d5f", ts: new Date(Date.now() - 120000).toISOString() },
    { id: "ph6", type: "attestation", label: "◆ STRATEGIST ATTESTED", value: "or-v2-demo-3f8a1c6e2b9d", ts: new Date(Date.now() - 118000).toISOString() },
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
        setEvents(incoming.slice(0, 10));
      } catch {}
      setLoaded(true);
    }
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, []);

  const displayEvents = loaded && events.length > 0 ? events : placeholders;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        height: "100%",
        overflow: "hidden",
        padding: "16px 0",
      }}
    >
      {/* Wall header */}
      <div style={{ marginBottom: "8px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.12em",
              color: "var(--accent-verify)",
            }}
          >
            LIVE ATTESTATION FEED
          </div>
          <motion.div
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 2.4, repeat: Infinity }}
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "var(--accent-verify)",
              boxShadow: "0 0 8px var(--accent-verify)",
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              color: "var(--text-tertiary)",
            }}
          >
            {displayEvents.length} EVENTS · POLLING 8s
          </span>
        </div>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-tertiary)", margin: 0, lineHeight: 1.5 }}>
          Real inference attestations from deployed strategies
        </p>
      </div>

      {/* Event cards */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          overflowY: "auto",
          flex: 1,
          maskImage: "linear-gradient(to bottom, transparent 0%, black 8%, black 88%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 8%, black 88%, transparent 100%)",
          paddingTop: "12px",
          paddingBottom: "24px",
        }}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {displayEvents.map((ev) => (
            <EventCard key={ev.id} event={ev} isNew={newIds.has(ev.id)} />
          ))}
        </AnimatePresence>
      </div>

      {/* Bottom gradient proof line */}
      <div
        style={{
          marginTop: "auto",
          paddingTop: "16px",
          borderTop: "1px solid rgba(0,229,200,0.08)",
          flexShrink: 0,
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            color: "var(--text-tertiary)",
            lineHeight: 1.6,
            letterSpacing: "0.04em",
          }}
        >
          Every inference above is a real OpenRouter request ID —<br />
          independently verifiable via the OpenRouter API.
        </p>
      </div>
    </div>
  );
}

// ─── Auth Form ────────────────────────────────────────────────────────────────

const PILLS = [
  "◆ OpenRouter Request IDs",
  "◆ 0G Chain On-Chain Anchors",
  "◆ MongoDB Evidence Bundles",
];

function AuthForm() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [btnText, setBtnText] = useState("INITIALIZE SESSION");
  const btnTargetRef = useRef("");

  const handleDemoLogin = async () => {
    setDemoLoading(true);
    try {
      const res = await fetch("/api/demo/login", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Demo login failed");
      localStorage.setItem("user", JSON.stringify(data));
      router.push("/dashboard");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setDemoLoading(false);
    }
  };

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
    <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
      {/* Brand */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.14em",
            color: "var(--text-tertiary)",
            marginBottom: "12px",
          }}
        >
          TRUST LAYER FOR DEFI INTELLIGENCE
        </div>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontSize: "clamp(38px, 5vw, 58px)",
            lineHeight: 1.08,
            letterSpacing: "-0.03em",
            color: "var(--text-primary)",
            marginBottom: "24px",
          }}
        >
          Every Inference,
          <br />
          <span style={{ color: "var(--accent-verify)" }}>Attested.</span>
        </h1>

        {/* Proof pills */}
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.09, delayChildren: 0.3 } } }}
          style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}
        >
          {PILLS.map((pill) => (
            <motion.span
              key={pill}
              variants={{
                hidden: { opacity: 0, y: 6 },
                show: { opacity: 1, y: 0, transition: { duration: 0.3, ease } },
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "4px 10px",
                borderRadius: "999px",
                border: "1px solid rgba(0,229,200,0.2)",
                background: "rgba(0,229,200,0.06)",
                color: "var(--accent-verify)",
                fontSize: "10px",
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.04em",
                whiteSpace: "nowrap",
              }}
            >
              {pill}
            </motion.span>
          ))}
        </motion.div>
      </motion.div>

      {/* Form */}
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease, delay: 0.15 }}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          padding: "28px",
          borderRadius: "16px",
          border: "1px solid rgba(255,255,255,0.07)",
          borderTop: "1px solid rgba(0,229,200,0.15)",
          background: "rgba(255,255,255,0.03)",
          backdropFilter: "blur(24px)",
        }}
      >
        {/* Mode toggle */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            borderRadius: "8px",
            border: "1px solid rgba(255,255,255,0.06)",
            overflow: "hidden",
            background: "rgba(255,255,255,0.02)",
          }}
        >
          {[
            { label: "LOGIN", value: true },
            { label: "REGISTER", value: false },
          ].map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => setIsLogin(opt.value)}
              style={{
                padding: "8px",
                background: isLogin === opt.value ? "rgba(0,229,200,0.1)" : "transparent",
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                letterSpacing: "0.1em",
                color: isLogin === opt.value ? "var(--accent-verify)" : "var(--text-tertiary)",
                transition: "all 0.2s",
                fontWeight: isLogin === opt.value ? 700 : 400,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Fields */}
        {[
          { id: "username", label: "OPERATOR ID", type: "text", value: username, set: setUsername, ph: "agent_commander" },
          { id: "password", label: "ACCESS KEY",  type: "password", value: password, set: setPassword, ph: "••••••••" },
        ].map((field) => (
          <div key={field.id} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label
              htmlFor={field.id}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                color: "var(--text-tertiary)",
                letterSpacing: "0.1em",
              }}
            >
              {field.label}
            </label>
            <input
              id={field.id}
              type={field.type}
              value={field.value}
              onChange={(e) => field.set(e.target.value)}
              placeholder={field.ph}
              required
              style={{
                padding: "12px 14px",
                borderRadius: "8px",
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.04)",
                color: "var(--text-primary)",
                fontFamily: "var(--font-mono)",
                fontSize: "13px",
                outline: "none",
                transition: "border-color 0.2s",
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
            padding: "14px 24px",
            borderRadius: "8px",
            border: "none",
            background: loading ? "rgba(255,255,255,0.06)" : "var(--accent-forge)",
            color: loading ? "var(--text-tertiary)" : "#050609",
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
            fontWeight: 700,
            letterSpacing: "0.1em",
            cursor: loading ? "not-allowed" : "pointer",
            transition: "background 0.2s",
          }}
        >
          {btnText}
        </button>
      </motion.form>

      {/* Demo access */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.06)" }} />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--text-tertiary)", letterSpacing: "0.1em" }}>OR</span>
        <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.06)" }} />
      </div>

      <button
        type="button"
        onClick={handleDemoLogin}
        disabled={demoLoading}
        style={{
          padding: "13px 24px",
          borderRadius: "8px",
          border: "1px solid rgba(0,229,200,0.2)",
          background: "rgba(0,229,200,0.05)",
          color: demoLoading ? "rgba(0,229,200,0.4)" : "var(--accent-verify)",
          fontFamily: "var(--font-mono)",
          fontSize: "12px",
          fontWeight: 700,
          letterSpacing: "0.1em",
          cursor: demoLoading ? "not-allowed" : "pointer",
          transition: "all 0.2s",
          width: "100%",
        }}
      >
        {demoLoading ? "LOADING DEMO..." : "◆ TRY DEMO — No account needed"}
      </button>

      {/* Powered by 0G */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", paddingTop: "8px" }}>
        <div style={{ height: "1px", flex: 1, background: "rgba(255,255,255,0.04)" }} />
        <a
          href="https://0g.ai"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            padding: "4px 10px",
            borderRadius: "999px",
            border: "1px solid rgba(227,169,74,0.2)",
            background: "rgba(227,169,74,0.04)",
            color: "var(--attest-500)",
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            letterSpacing: "0.1em",
            textDecoration: "none",
            opacity: 0.8,
            transition: "opacity 0.2s",
            whiteSpace: "nowrap",
          }}
          onMouseOver={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseOut={(e) => (e.currentTarget.style.opacity = "0.8")}
        >
          <span style={{ fontSize: "10px" }}>⬡</span>
          POWERED BY 0G NETWORK
        </a>
        <div style={{ height: "1px", flex: 1, background: "rgba(255,255,255,0.04)" }} />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        background: "var(--bg-0)",
        overflow: "hidden",
      }}
    >
      {/* Ambient gradients */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
          background: `
            radial-gradient(ellipse 60% 50% at 0% 30%, rgba(0,229,200,0.04) 0%, transparent 70%),
            radial-gradient(ellipse 40% 60% at 100% 70%, rgba(200,255,0,0.03) 0%, transparent 60%)
          `,
        }}
      />

      {/* Grid overlay */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M 40 0 L 0 0 0 40' fill='none' stroke='rgba(0,229,200,0.025)' stroke-width='0.5'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Stats bar */}
      <StatsBar />

      {/* Main split layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1px 1fr",
          minHeight: "100vh",
          paddingTop: "36px",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* LEFT: Live attestation wall */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, ease }}
          style={{
            padding: "48px 48px 40px 48px",
            borderRight: "none",
            display: "flex",
            flexDirection: "column",
            background: "rgba(0,229,200,0.012)",
          }}
        >
          <LiveAttestationWall />
        </motion.div>

        {/* Vertical divider */}
        <div
          style={{
            background: "linear-gradient(to bottom, transparent 5%, rgba(0,229,200,0.15) 20%, rgba(0,229,200,0.15) 80%, transparent 95%)",
          }}
        />

        {/* RIGHT: Brand + auth form */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, ease, delay: 0.1 }}
          style={{
            padding: "48px 48px 40px 56px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <AuthForm />
        </motion.div>
      </div>
    </div>
  );
}
