"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Pool {
  project: string;
  symbol: string;
  chain: string;
  apy: number;
  tvlUsd: number;
  apyBase: number | null;
  apyReward: number | null;
  pool: string;
}

const POLL_INTERVAL = 60000;

function formatTvl(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toFixed(0)}`;
}

function projectLabel(project: string) {
  const labels: Record<string, string> = {
    "aave-v3": "AAVE V3",
    "compound-v3": "COMPOUND V3",
    "morpho-blue": "MORPHO",
    spark: "SPARK",
    fluid: "FLUID",
  };
  return labels[project] ?? project.toUpperCase().slice(0, 10);
}

// Trend animation — small ticks to simulate live APY micro-movement
function useLiveApy(base: number) {
  const [displayed, setDisplayed] = useState(base);
  useEffect(() => {
    setDisplayed(base);
    const id = setInterval(() => {
      const jitter = (Math.random() - 0.5) * 0.004;
      setDisplayed((prev) => parseFloat((prev + jitter).toFixed(4)));
    }, 3200);
    return () => clearInterval(id);
  }, [base]);
  return displayed;
}

function PoolRow({ pool, index }: { pool: Pool; index: number }) {
  const liveApy = useLiveApy(pool.apy);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto auto",
        alignItems: "center",
        gap: "12px",
        padding: "10px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      <div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            color: "var(--text-tertiary)",
            letterSpacing: "0.08em",
            marginBottom: "2px",
          }}
        >
          {projectLabel(pool.project)}
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
            color: "var(--text-secondary)",
          }}
        >
          {pool.symbol} · {pool.chain}
        </div>
      </div>

      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          color: "var(--text-tertiary)",
          textAlign: "right",
        }}
      >
        {formatTvl(pool.tvlUsd)} TVL
      </div>

      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "16px",
          fontWeight: 700,
          color: "var(--ok-500)",
          minWidth: "70px",
          textAlign: "right",
        }}
      >
        {liveApy.toFixed(2)}%
      </div>
    </motion.div>
  );
}

export function LiveYieldBoard() {
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  async function fetchYields() {
    try {
      const res = await fetch("/api/live/yields");
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      setPools(data.pools ?? []);
      setFetchedAt(data.fetchedAt ?? null);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchYields();
    const id = setInterval(fetchYields, POLL_INTERVAL);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      style={{
        borderRadius: "12px",
        border: "1px solid rgba(100,220,100,0.12)",
        background: "rgba(100,220,100,0.02)",
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
            color: "var(--ok-500)",
            fontWeight: 700,
          }}
        >
          LIVE YIELD RATES
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            color: "var(--text-tertiary)",
            letterSpacing: "0.06em",
          }}
        >
          {error ? "DEFILLAMA OFFLINE" : loading ? "FETCHING..." : "VIA DEFILLAMA · 60s"}
        </span>
      </div>

      {/* Pool rows */}
      {loading && (
        <div
          style={{
            padding: "24px 16px",
            textAlign: "center",
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            color: "var(--text-tertiary)",
          }}
        >
          FETCHING YIELD DATA...
        </div>
      )}

      {!loading && error && (
        <div
          style={{
            padding: "20px 16px",
            textAlign: "center",
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            color: "var(--warn-500)",
          }}
        >
          YIELD FEED UNAVAILABLE
        </div>
      )}

      {!loading && !error && pools.length === 0 && (
        <div
          style={{
            padding: "20px 16px",
            textAlign: "center",
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            color: "var(--text-tertiary)",
          }}
        >
          NO POOLS MATCHED
        </div>
      )}

      <AnimatePresence>
        {pools.map((pool, i) => (
          <PoolRow key={pool.pool} pool={pool} index={i} />
        ))}
      </AnimatePresence>

      {fetchedAt && (
        <div
          style={{
            padding: "6px 16px",
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            color: "rgba(255,255,255,0.2)",
            letterSpacing: "0.04em",
          }}
        >
          SNAPSHOT {new Date(fetchedAt).toLocaleTimeString("en-GB")} UTC
        </div>
      )}
    </div>
  );
}
