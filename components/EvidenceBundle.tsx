"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface EvidenceBundleProps {
  researcherOutput?: any;
  strategistOutput?: any;
  criticOutput?: any;
}

const easeOut = [0.22, 1, 0.36, 1] as const;

function AttestationId({ id }: { id?: string }) {
  const [copied, setCopied] = useState(false);
  if (!id) return null;
  const handleCopy = () => {
    navigator.clipboard.writeText(id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={handleCopy}
      title="Click to copy request ID"
      aria-label={`Copy OpenRouter request ID: ${id}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        padding: "5px 10px",
        borderRadius: "6px",
        border: "1px solid rgba(0,229,200,0.25)",
        background: "rgba(0,229,200,0.07)",
        cursor: "pointer",
        textAlign: "left",
        transition: "border-color 0.2s, background 0.2s",
      }}
    >
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "rgba(0,229,200,0.5)", letterSpacing: "0.08em" }}>
        OPENROUTER REQUEST ID
      </span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--accent-verify)", letterSpacing: "0.04em" }}>
        {id}
      </span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: copied ? "var(--accent-verify)" : "rgba(0,229,200,0.4)", transition: "color 0.2s" }}>
        {copied ? "COPIED" : "COPY"}
      </span>
    </button>
  );
}

function colorizeJson(json: string): string {
  return json
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"([^"]+)":/g, '<span style="color:rgba(255,255,255,0.65)">"$1"</span>:')
    .replace(/: "([^"]+)"/g, ': <span style="color:var(--accent-verify)">"$1"</span>')
    .replace(/: (-?\d+\.?\d*)/g, ': <span style="color:var(--attest-500)">$1</span>')
    .replace(/: (true|false|null)/g, ': <span style="color:var(--ok-500)">$1</span>');
}

function AuditCard({
  n, title, attestationId, timestamp, summary, content, delay,
}: {
  n: number; title: string; attestationId?: string; timestamp?: string;
  summary: string; content: any; delay: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const jsonStr = JSON.stringify(content, null, 2);

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, x: -16 },
        show: { opacity: 1, x: 0, transition: { duration: 0.45, ease: easeOut, delay } },
      }}
      style={{
        border: "1px solid rgba(255,255,255,0.07)",
        borderTop: "1px solid rgba(0,229,200,0.12)",
        borderRadius: "16px",
        background: "rgba(255,255,255,0.025)",
        overflow: "hidden",
      }}
    >
      {/* Card header */}
      <div style={{ padding: "20px 24px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "12px" }}>
          <div style={{
            width: "40px", height: "40px", borderRadius: "50%", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "1px solid rgba(0,229,200,0.25)",
            background: "rgba(0,229,200,0.07)",
            fontFamily: "var(--font-mono)", fontSize: "14px", fontWeight: 700,
            color: "var(--accent-verify)",
          }}>
            {n}
          </div>
          <h3 style={{
            fontFamily: "var(--font-display)", fontStyle: "italic",
            fontSize: "22px", letterSpacing: "-0.01em",
            color: "var(--text-primary)", margin: 0,
          }}>
            {title}
          </h3>
        </div>

        <AttestationId id={attestationId} />

        {timestamp && (
          <div style={{ marginTop: "8px", fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-tertiary)", letterSpacing: "0.04em" }}>
            {new Date(timestamp).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "medium" })} UTC
          </div>
        )}

        <div style={{ height: "1px", background: "rgba(255,255,255,0.06)", margin: "14px 0" }} />

        <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.55, margin: 0 }}>
          {summary}
        </p>

        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            marginTop: "12px", padding: "4px 0",
            background: "none", border: "none", cursor: "pointer",
            fontFamily: "var(--font-mono)", fontSize: "11px",
            color: "var(--text-tertiary)", letterSpacing: "0.06em",
            transition: "color 0.2s",
          }}
          onMouseOver={(e) => (e.currentTarget.style.color = "var(--accent-verify)")}
          onMouseOut={(e) => (e.currentTarget.style.color = "var(--text-tertiary)")}
        >
          {expanded ? "▲ COLLAPSE ARTIFACT" : "▼ EXPAND FULL ARTIFACT →"}
        </button>
      </div>

      {/* Expandable JSON */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: easeOut }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "16px 24px 20px" }}>
              <pre
                style={{
                  margin: 0, fontFamily: "var(--font-mono)", fontSize: "11px",
                  lineHeight: 1.6, overflowX: "auto", maxHeight: "360px",
                  color: "rgba(255,255,255,0.55)",
                }}
                dangerouslySetInnerHTML={{ __html: colorizeJson(jsonStr) }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function extractSummary(step: string, data: any): string {
  if (!data) return "No data recorded for this step.";
  switch (step) {
    case "researcher":
      return data.output?.recommendation
        || (data.output?.signals?.[0]?.signal
          ? `Market signal: ${data.output.signals[0].signal}. ${data.output.relevantProtocols?.length ?? 0} protocol(s) in scope.`
          : "Market context gathered and analyzed.");
    case "strategist":
      return data.output?.candidates?.length
        ? `${data.output.candidates.length} candidate workflow(s) designed. Leading: "${data.output.candidates[0]?.name ?? data.output.candidates[0]?.id}".`
        : "Candidate workflow topologies generated.";
    case "critic":
      return data.output?.rationale
        || `Candidate ${data.output?.selected ?? "B"} selected after adversarial stress-testing.`;
    default:
      return "Evidence recorded.";
  }
}

export function EvidenceBundle({ researcherOutput, strategistOutput, criticOutput }: EvidenceBundleProps) {
  const hasAny = researcherOutput || strategistOutput || criticOutput;

  if (!hasAny) {
    return (
      <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-tertiary)", fontSize: "14px" }}>
        No evidence recorded yet. Run the pipeline to generate the audit trail.
      </div>
    );
  }

  const steps = [
    { n: 1, title: "Researcher", key: "researcher", data: researcherOutput },
    { n: 2, title: "Strategist", key: "strategist", data: strategistOutput },
    { n: 3, title: "Critic",     key: "critic",     data: criticOutput },
  ];

  return (
    <div>
      {/* Evidence of Learning — full-width callout for v2+ */}
      {criticOutput?.output?.evidenceOfLearning && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: easeOut }}
          style={{
            marginBottom: "24px",
            padding: "20px 24px",
            borderRadius: "16px",
            border: "2px solid var(--accent-verify)",
            background: "rgba(0,229,200,0.06)",
          }}
        >
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.1em",
            color: "var(--accent-verify)", marginBottom: "10px", fontWeight: 700,
          }}>
            EVIDENCE OF LEARNING
          </div>
          <p style={{ fontSize: "16px", color: "var(--text-primary)", lineHeight: 1.6, margin: 0 }}>
            {criticOutput.output.evidenceOfLearning}
          </p>
        </motion.div>
      )}

      {/* Vertical audit trail cards */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.12 } } }}
        style={{ display: "flex", flexDirection: "column", gap: "16px" }}
      >
        {steps.map(({ n, title, key, data }) => (
          <AuditCard
            key={key}
            n={n}
            title={title}
            attestationId={data?.attestationId}
            timestamp={data?.timestamp}
            summary={extractSummary(key, data)}
            content={data}
            delay={0}
          />
        ))}
      </motion.div>
    </div>
  );
}
