"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TickerEvent {
  id: string;
  type: "attestation" | "onchain";
  label: string;
  value: string;
  ts: string;
}

const POLL_INTERVAL = 8000;

function truncate(s: string, maxLen = 20) {
  if (s.length <= maxLen) return s;
  return s.slice(0, 8) + "…" + s.slice(-6);
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

export function ActivityTicker() {
  const [events, setEvents] = useState<TickerEvent[]>([]);
  const [newEventId, setNewEventId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const prevIdsRef = useRef<Set<string>>(new Set());

  async function fetchEvents() {
    try {
      const res = await fetch("/api/live/events");
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      const incoming: TickerEvent[] = data.events ?? [];

      // detect genuinely new events
      const newId = incoming.find((e) => !prevIdsRef.current.has(e.id))?.id ?? null;
      if (newId) setNewEventId(newId);
      setTimeout(() => setNewEventId(null), 1200);

      incoming.forEach((e) => prevIdsRef.current.add(e.id));
      setEvents(incoming);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchEvents();
    const id = setInterval(fetchEvents, POLL_INTERVAL);
    return () => clearInterval(id);
  }, []);

  // Fallback placeholder events when no real data yet
  const displayEvents: TickerEvent[] = events.length > 0
    ? events
    : [
        { id: "ph1", type: "attestation", label: "◆ RESEARCHER ATTESTED", value: "att-demo-seed-v1-1a2b", ts: new Date(Date.now() - 60000).toISOString() },
        { id: "ph2", type: "attestation", label: "◆ STRATEGIST ATTESTED", value: "att-demo-seed-v1-3c4d", ts: new Date(Date.now() - 55000).toISOString() },
        { id: "ph3", type: "onchain",     label: "⬡ ON-CHAIN ANCHORED",   value: "0xdemo...anchor", ts: new Date(Date.now() - 50000).toISOString() },
      ];

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: "12px",
        border: "1px solid rgba(0,229,200,0.12)",
        background: "rgba(0,229,200,0.03)",
        padding: "0 0 0 0",
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
            color: "var(--accent-verify)",
            fontWeight: 700,
          }}
        >
          LIVE ATTESTATION FEED
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
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: error ? "var(--warn-500)" : "var(--ok-500)",
              display: "inline-block",
              boxShadow: error ? "none" : "0 0 6px var(--ok-500)",
            }}
          />
          {error ? "OFFLINE" : loading ? "SYNCING" : `${displayEvents.length} EVENTS`}
        </span>
      </div>

      {/* Scrollable list */}
      <div
        style={{
          maxHeight: "224px",
          overflowY: "auto",
          overflowX: "hidden",
          padding: "4px 0",
        }}
      >
        <AnimatePresence initial={false}>
          {displayEvents.map((ev) => (
            <motion.div
              key={ev.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{
                opacity: 1,
                x: 0,
                backgroundColor: ev.id === newEventId ? "rgba(0,229,200,0.06)" : "transparent",
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "8px 16px",
                borderBottom: "1px solid rgba(255,255,255,0.03)",
                cursor: "default",
              }}
            >
              {/* Type indicator */}
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "9px",
                  letterSpacing: "0.08em",
                  color: ev.type === "onchain" ? "var(--attest-500)" : "var(--accent-verify)",
                  minWidth: "130px",
                  flexShrink: 0,
                }}
              >
                {ev.label}
              </span>

              {/* Value */}
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  color:
                    ev.type === "onchain"
                      ? "rgba(227,169,74,0.8)"
                      : "rgba(0,229,200,0.75)",
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={ev.value}
              >
                {truncate(ev.value, 28)}
              </span>

              {/* Timestamp */}
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "9px",
                  color: "var(--text-tertiary)",
                  flexShrink: 0,
                  minWidth: "48px",
                  textAlign: "right",
                }}
              >
                {timeAgo(ev.ts)}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
