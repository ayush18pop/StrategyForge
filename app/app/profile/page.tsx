"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

const ease = [0.22, 1, 0.36, 1] as const;

// ─── Connection Visualization ─────────────────────────────────────────────────

function ConnectionViz({ state }: { state: "idle" | "connecting" | "connected" }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0",
        margin: "0 auto 40px",
        width: "100%",
        maxWidth: "520px",
      }}
    >
      {/* KeeperHub node */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
        <motion.div
          animate={{
            borderColor:
              state === "connected"
                ? "rgba(0,229,200,0.6)"
                : state === "connecting"
                ? "rgba(0,229,200,0.3)"
                : "rgba(255,255,255,0.12)",
            boxShadow:
              state === "connected"
                ? "0 0 20px rgba(0,229,200,0.2)"
                : "none",
          }}
          transition={{ duration: 0.5 }}
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "16px",
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.04)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect x="4" y="8" width="20" height="12" rx="2" stroke="rgba(0,229,200,0.7)" strokeWidth="1.5" fill="none" />
            <path d="M4 12h20" stroke="rgba(0,229,200,0.4)" strokeWidth="1" />
            <circle cx="8" cy="16" r="1.5" fill="rgba(0,229,200,0.6)" />
            <circle cx="14" cy="16" r="1.5" fill="rgba(0,229,200,0.4)" />
            <circle cx="20" cy="16" r="1.5" fill="rgba(0,229,200,0.3)" />
          </svg>
        </motion.div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--text-tertiary)", letterSpacing: "0.1em" }}>
          KEEPERHUB
        </span>
      </div>

      {/* Connection line */}
      <div style={{ flex: 1, position: "relative", height: "2px", margin: "0 -1px", marginBottom: "20px" }}>
        <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.06)", borderRadius: "1px" }} />
        {state !== "idle" && (
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: state === "connected" ? 1 : [0, 0.4, 0.4, 1] }}
            transition={{
              duration: state === "connected" ? 0.4 : 1.5,
              ease: state === "connected" ? ease : [0.4, 0, 0.6, 1],
            }}
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(to right, rgba(0,229,200,0.6), rgba(0,229,200,0.3))",
              borderRadius: "1px",
              transformOrigin: "left",
            }}
          />
        )}
        {state === "connecting" && (
          <motion.div
            animate={{ left: ["-20%", "120%"] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
            style={{
              position: "absolute",
              width: "20%",
              height: "100%",
              background: "linear-gradient(to right, transparent, rgba(0,229,200,0.8), transparent)",
              top: 0,
            }}
          />
        )}
      </div>

      {/* StrategyForge node */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
        <motion.div
          animate={{
            borderColor:
              state === "connected"
                ? "rgba(200,255,0,0.5)"
                : "rgba(255,255,255,0.12)",
            boxShadow:
              state === "connected"
                ? "0 0 20px rgba(200,255,0,0.12)"
                : "none",
          }}
          transition={{ duration: 0.5, delay: 0.2 }}
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "16px",
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.04)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <polygon points="14,4 24,20 4,20" stroke="rgba(200,255,0,0.7)" strokeWidth="1.5" fill="none" />
            <line x1="14" y1="4" x2="14" y2="20" stroke="rgba(200,255,0,0.3)" strokeWidth="1" />
            <circle cx="14" cy="14" r="2" fill="rgba(200,255,0,0.6)" />
          </svg>
        </motion.div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--text-tertiary)", letterSpacing: "0.1em" }}>
          STRATEGYFORGE
        </span>
      </div>

      {/* Connection line 2 */}
      <div style={{ flex: 1, position: "relative", height: "2px", margin: "0 -1px", marginBottom: "20px" }}>
        <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.06)", borderRadius: "1px" }} />
        {state === "connected" && (
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.4, ease, delay: 0.3 }}
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(to right, rgba(200,255,0,0.4), rgba(227,169,74,0.5))",
              borderRadius: "1px",
              transformOrigin: "left",
            }}
          />
        )}
      </div>

      {/* 0G Chain node */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
        <motion.div
          animate={{
            borderColor:
              state === "connected"
                ? "rgba(227,169,74,0.6)"
                : "rgba(255,255,255,0.08)",
            boxShadow:
              state === "connected"
                ? "0 0 20px rgba(227,169,74,0.15)"
                : "none",
          }}
          transition={{ duration: 0.5, delay: 0.4 }}
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.03)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="8" stroke="rgba(227,169,74,0.6)" strokeWidth="1.5" fill="none" />
            <circle cx="14" cy="14" r="3" fill="rgba(227,169,74,0.5)" />
            <line x1="14" y1="6" x2="14" y2="4" stroke="rgba(227,169,74,0.4)" strokeWidth="1.5" />
            <line x1="14" y1="22" x2="14" y2="24" stroke="rgba(227,169,74,0.4)" strokeWidth="1.5" />
            <line x1="6" y1="14" x2="4" y2="14" stroke="rgba(227,169,74,0.4)" strokeWidth="1.5" />
            <line x1="22" y1="14" x2="24" y2="14" stroke="rgba(227,169,74,0.4)" strokeWidth="1.5" />
          </svg>
        </motion.div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--text-tertiary)", letterSpacing: "0.1em" }}>
          0G CHAIN
        </span>
      </div>
    </div>
  );
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  const steps = ["REGISTERED", "CONNECT", "ACTIVE"];
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0", marginBottom: "48px" }}>
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={step} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: `1px solid ${done ? "rgba(0,229,200,0.5)" : active ? "rgba(200,255,0,0.5)" : "rgba(255,255,255,0.1)"}`,
                  background: done ? "rgba(0,229,200,0.12)" : active ? "rgba(200,255,0,0.08)" : "transparent",
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  fontWeight: 700,
                  color: done ? "var(--accent-verify)" : active ? "var(--accent-forge)" : "var(--text-tertiary)",
                  transition: "all 0.3s",
                }}
              >
                {done ? "✓" : i + 1}
              </div>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "8px",
                  letterSpacing: "0.1em",
                  color: done ? "var(--accent-verify)" : active ? "var(--accent-forge)" : "var(--text-tertiary)",
                }}
              >
                {step}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                style={{
                  width: "80px",
                  height: "1px",
                  background: done ? "rgba(0,229,200,0.3)" : "rgba(255,255,255,0.06)",
                  margin: "0 8px",
                  marginBottom: "20px",
                  transition: "background 0.4s",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter();
  const [keeperhubApiKey, setKeeperhubApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [connState, setConnState] = useState<"idle" | "connecting" | "connected">("idle");
  const [user, setUser] = useState<any>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("user");
    if (!saved) { router.push("/"); return; }
    setUser(JSON.parse(saved));
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setConnState("connecting");

    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
        body: JSON.stringify({ keeperhubApiKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      setConnState("connected");
      await new Promise((r) => setTimeout(r, 1200));

      const updated = { ...user, walletAddress: data.walletAddress, keeperhubApiKey: data.keeperhubApiKey };
      localStorage.setItem("user", JSON.stringify(updated));
      toast.success("Integration activated");
      router.push("/dashboard");
    } catch (error: any) {
      toast.error(error.message);
      setConnState("idle");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        background: "var(--bg-0)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        overflow: "hidden",
      }}
    >
      {/* Ambient */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          background: `
            radial-gradient(ellipse 50% 60% at 50% 30%, rgba(0,229,200,0.04) 0%, transparent 70%),
            radial-gradient(ellipse 40% 40% at 80% 80%, rgba(200,255,0,0.02) 0%, transparent 60%)
          `,
        }}
      />

      {/* Grid */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M 40 0 L 0 0 0 40' fill='none' stroke='rgba(0,229,200,0.025)' stroke-width='0.5'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Back link */}
      <button
        onClick={() => router.push("/")}
        style={{
          position: "fixed",
          top: "20px",
          left: "24px",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          color: "var(--text-tertiary)",
          letterSpacing: "0.08em",
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        ← BACK
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        style={{ width: "100%", maxWidth: "560px", position: "relative", zIndex: 1 }}
      >
        {/* Step indicator */}
        <StepIndicator current={1} />

        {/* Connection visualization */}
        <ConnectionViz state={connState} />

        {/* Card */}
        <div
          style={{
            padding: "32px",
            borderRadius: "20px",
            border: "1px solid rgba(255,255,255,0.07)",
            borderTop: "1px solid rgba(0,229,200,0.15)",
            background: "rgba(255,255,255,0.03)",
            backdropFilter: "blur(24px)",
          }}
        >
          {/* Operator identity */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "24px",
              paddingBottom: "20px",
              borderBottom: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                background: "rgba(0,229,200,0.08)",
                border: "1px solid rgba(0,229,200,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--font-mono)",
                fontSize: "14px",
                fontWeight: 700,
                color: "var(--accent-verify)",
                flexShrink: 0,
              }}
            >
              {user.username?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div>
              <div style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "2px" }}>
                {user.username}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-tertiary)", letterSpacing: "0.06em" }}>
                OPERATOR · {user.userId?.slice(-8) ?? "—"} · SESSION ACTIVE
              </div>
            </div>
            <div
              style={{
                marginLeft: "auto",
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                color: "var(--ok-500)",
                letterSpacing: "0.06em",
                display: "flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--ok-500)", display: "inline-block" }} />
              AUTHENTICATED
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.1em", color: "var(--text-tertiary)", marginBottom: "8px" }}>
                KEEPERHUB API KEY
              </div>
              <input
                type="password"
                value={keeperhubApiKey}
                onChange={(e) => setKeeperhubApiKey(e.target.value)}
                onFocus={() => { setFocused(true); setConnState("idle"); }}
                onBlur={() => setFocused(false)}
                placeholder="kh_..."
                required
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  borderRadius: "10px",
                  border: `1px solid ${focused ? "rgba(0,229,200,0.4)" : "rgba(255,255,255,0.08)"}`,
                  borderLeft: `2px solid ${focused ? "var(--accent-verify)" : "rgba(255,255,255,0.06)"}`,
                  background: "rgba(255,255,255,0.04)",
                  color: "var(--text-primary)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "14px",
                  outline: "none",
                  transition: "border-color 0.2s",
                  letterSpacing: "0.04em",
                }}
              />
              <div style={{ marginTop: "6px", fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--text-tertiary)", letterSpacing: "0.04em" }}>
                KeeperHub → Settings → API Keys
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !keeperhubApiKey}
              style={{
                padding: "16px 24px",
                borderRadius: "10px",
                border: "none",
                background:
                  loading
                    ? "rgba(255,255,255,0.04)"
                    : !keeperhubApiKey
                    ? "rgba(255,255,255,0.06)"
                    : connState === "connected"
                    ? "var(--accent-verify)"
                    : "var(--accent-forge)",
                color:
                  loading || !keeperhubApiKey
                    ? "var(--text-tertiary)"
                    : "#050609",
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.1em",
                cursor: loading || !keeperhubApiKey ? "not-allowed" : "pointer",
                transition: "background 0.3s, color 0.3s",
              }}
            >
              <AnimatePresence mode="wait">
                <motion.span
                  key={connState}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                >
                  {connState === "connected"
                    ? "✓ CONNECTED — REDIRECTING"
                    : connState === "connecting"
                    ? "VERIFYING CONNECTION..."
                    : "ACTIVATE INTEGRATION →"}
                </motion.span>
              </AnimatePresence>
            </button>

            {/* Security line */}
            <div style={{ display: "flex", justifyContent: "center", gap: "20px" }}>
              {["Encrypted at rest", "Never logged", "Revocable anytime"].map((t) => (
                <span
                  key={t}
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "9px",
                    color: "var(--text-tertiary)",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    letterSpacing: "0.04em",
                  }}
                >
                  <span style={{ color: "var(--ok-500)" }}>✓</span> {t}
                </span>
              ))}
            </div>
          </form>
        </div>

        {/* Skip */}
        <div style={{ textAlign: "center", marginTop: "20px" }}>
          <button
            onClick={() => router.push("/dashboard")}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              color: "var(--text-tertiary)",
              letterSpacing: "0.06em",
            }}
          >
            Skip — configure later in Account Profile
          </button>
        </div>
      </motion.div>
    </div>
  );
}
