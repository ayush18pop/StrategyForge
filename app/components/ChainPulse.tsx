"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ChainData {
  block: number;
  chainId: number;
  network: string;
  contracts: {
    agentRegistry: string | null;
    reputationLedger: string | null;
  };
  agentCount: number | null;
  reputationRecords: number | null;
  fetchedAt: string;
}

const POLL_INTERVAL = 12000;

function truncAddr(addr: string) {
  if (!addr || addr.length < 12) return addr;
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

export function ChainPulse() {
  const [data, setData] = useState<ChainData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [prevBlock, setPrevBlock] = useState<number | null>(null);

  async function fetchChain() {
    try {
      const res = await fetch("/api/live/chain");
      if (!res.ok) throw new Error("fetch failed");
      const d: ChainData = await res.json();

      setData((prev) => {
        if (prev && prev.block !== d.block) {
          setPulse(true);
          setTimeout(() => setPulse(false), 800);
        }
        return d;
      });
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchChain();
    const id = setInterval(fetchChain, POLL_INTERVAL);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.div
      animate={{
        boxShadow: pulse
          ? "0 0 0 2px rgba(227,169,74,0.35), 0 0 16px rgba(227,169,74,0.12)"
          : "0 0 0 1px rgba(227,169,74,0.12)",
        borderColor: pulse ? "rgba(227,169,74,0.5)" : "rgba(227,169,74,0.14)",
      }}
      transition={{ duration: 0.4 }}
      style={{
        borderRadius: "12px",
        border: "1px solid rgba(227,169,74,0.14)",
        background: "rgba(227,169,74,0.025)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.12em",
            color: "var(--attest-500)",
            fontWeight: 700,
          }}
        >
          0G CHAIN · LIVE
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            color: "var(--text-tertiary)",
            letterSpacing: "0.06em",
          }}
        >
          <motion.span
            animate={{
              opacity: error ? 1 : [1, 0.3, 1],
              backgroundColor: error ? "var(--warn-500)" : "var(--attest-500)",
            }}
            transition={{ duration: 1.8, repeat: error ? 0 : Infinity }}
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              display: "inline-block",
            }}
          />
          {error ? "OFFLINE" : loading ? "SYNCING" : data?.network ?? "0G TESTNET"}
        </span>
      </div>

      <div style={{ padding: "14px 16px" }}>
        {loading && (
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--text-tertiary)",
              textAlign: "center",
              padding: "8px 0",
            }}
          >
            CONNECTING TO 0G RPC...
          </div>
        )}

        {!loading && error && (
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--warn-500)",
              textAlign: "center",
              padding: "8px 0",
            }}
          >
            RPC UNAVAILABLE
          </div>
        )}

        {data && !error && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {/* Block number — hero */}
            <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  color: "var(--text-tertiary)",
                  letterSpacing: "0.08em",
                  minWidth: "40px",
                }}
              >
                BLOCK
              </span>
              <AnimatePresence mode="wait">
                <motion.span
                  key={data.block}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.25 }}
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "22px",
                    fontWeight: 700,
                    color: "var(--attest-500)",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {data.block.toLocaleString()}
                </motion.span>
              </AnimatePresence>
            </div>

            {/* Divider */}
            <div style={{ height: "1px", background: "rgba(255,255,255,0.05)" }} />

            {/* Contract rows */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {[
                {
                  label: "AGENT REGISTRY",
                  addr: data.contracts.agentRegistry,
                  stat: data.agentCount !== null ? `${data.agentCount} agent${data.agentCount !== 1 ? "s" : ""}` : null,
                },
                {
                  label: "REPUTATION LEDGER",
                  addr: data.contracts.reputationLedger,
                  stat: data.reputationRecords !== null ? `${data.reputationRecords} record${data.reputationRecords !== 1 ? "s" : ""}` : null,
                },
              ].map(({ label, addr, stat }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "9px",
                        color: "var(--text-tertiary)",
                        letterSpacing: "0.08em",
                        marginBottom: "2px",
                      }}
                    >
                      {label}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "11px",
                        color: addr ? "rgba(227,169,74,0.75)" : "var(--text-tertiary)",
                      }}
                    >
                      {addr ? truncAddr(addr) : "NOT DEPLOYED"}
                    </div>
                  </div>
                  {stat && (
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "11px",
                        color: "var(--text-secondary)",
                        background: "rgba(227,169,74,0.08)",
                        border: "1px solid rgba(227,169,74,0.18)",
                        borderRadius: "6px",
                        padding: "2px 8px",
                      }}
                    >
                      {stat}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
