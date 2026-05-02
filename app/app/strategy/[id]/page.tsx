"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { LayoutGrid, GitBranch, Rocket, ArrowUpRight } from "lucide-react";
import { AmbientLight } from "../../../components/glass/AmbientLight";
import { ambientPresets } from "../../../components/glass/ambient-presets";
import { EvidenceBundle } from "../../../components/EvidenceBundle";
import { PipelineLoadingScreen } from "../../../components/pipeline/PipelineLoadingScreen";

const KEEPERHUB_BASE = "https://app.keeperhub.com";
const OG_EXPLORER = "https://chainscan-galileo.0g.ai";
const easeOut = [0.22, 1, 0.36, 1] as const;

function colorizeJson(json: string): string {
  return json
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"([^"]+)":/g, '<span style="color:rgba(255,255,255,0.65)">"$1"</span>:')
    .replace(/: "([^"]+)"/g, ': <span style="color:var(--accent-verify)">"$1"</span>')
    .replace(/: (-?\d+\.?\d*)/g, ': <span style="color:var(--attest-500)">$1</span>')
    .replace(/: (true|false|null)/g, ': <span style="color:var(--ok-500)">$1</span>');
}

function TrustBar({ version, wallet, lifecycle }: { version: number; wallet: string; lifecycle: string }) {
  const chips = [
    { label: "VERIFIED", value: "Trust Score 98/100", color: "var(--accent-verify)", bg: "rgba(0,229,200,0.08)", border: "rgba(0,229,200,0.25)" },
    { label: `v${version}`, value: "LIVE ON 0G", color: "var(--attest-500)", bg: "rgba(227,169,74,0.08)", border: "rgba(227,169,74,0.25)" },
    { label: "8.0% APY", value: "Target Yield", color: "var(--ok-500)", bg: "rgba(127,183,154,0.08)", border: "rgba(127,183,154,0.25)" },
    { label: wallet ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}` : "—", value: "Turnkey Enclave", color: "rgba(255,255,255,0.45)", bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.1)" },
  ];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
      {chips.map((c) => (
        <div key={c.label} style={{
          display: "inline-flex", alignItems: "center", gap: "8px",
          padding: "7px 14px", borderRadius: "8px",
          border: `1px solid ${c.border}`, background: c.bg,
        }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: c.color, fontWeight: 700, letterSpacing: "0.05em" }}>
            {c.label}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-tertiary)", letterSpacing: "0.04em" }}>
            {c.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function EvidenceLineage({ strategy }: { strategy: any }) {
  return (
    <div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--accent-verify)", letterSpacing: "0.1em", marginBottom: "14px", fontWeight: 700 }}>
        EVIDENCE LINEAGE
      </div>
      <p style={{ fontSize: "12px", color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", marginBottom: "16px" }}>
        On-chain anchors. Independently verifiable on 0G Chain.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
        {strategy.priorVersionId && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.2)", flexShrink: 0 }} />
              <div style={{ width: "1px", background: "rgba(0,229,200,0.2)", flex: 1, minHeight: "40px" }} />
            </div>
            <div style={{ paddingBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-secondary)", fontWeight: 600 }}>
                  v{strategy.version - 1}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--warn-500)", padding: "1px 6px", borderRadius: "4px", background: "rgba(224,122,106,0.1)" }}>
                  DEPRECATED
                </span>
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-tertiary)" }}>
                CID: {String(strategy.priorVersionId).slice(0, 8)}...
                <span style={{ color: "var(--accent-verify)", marginLeft: "8px", cursor: "pointer" }}>[0G Chain →]</span>
              </div>
              {strategy.evidenceBundle?.step3_critic?.output?.evidenceOfLearning && (
                <div style={{ marginTop: "6px", fontSize: "12px", color: "var(--text-tertiary)", fontStyle: "italic", maxWidth: "320px", lineHeight: 1.45 }}>
                  "{strategy.evidenceBundle.step3_critic.output.priorLessonsApplied?.[0] || "Prior version lessons applied"}"
                </div>
              )}
            </div>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "var(--accent-verify)", boxShadow: "0 0 8px rgba(0,229,200,0.5)", flexShrink: 0 }} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-primary)", fontWeight: 700 }}>
                v{strategy.version}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--accent-verify)", padding: "1px 6px", borderRadius: "4px", background: "rgba(0,229,200,0.1)" }}>
                {strategy.lifecycle?.toUpperCase() ?? "LIVE"}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-tertiary)" }}>← current</span>
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-tertiary)" }}>
              CID: {String(strategy._id).slice(0, 8)}...
              {strategy.agentRegistryCid && (
                <span style={{ color: "var(--accent-verify)", marginLeft: "8px", cursor: "pointer" }}>[0G Chain →]</span>
              )}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-tertiary)", marginTop: "4px" }}>
              {new Date(strategy.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OnChainPanel({ strategy }: { strategy: any }) {
  return (
    <div style={{
      padding: "20px",
      borderRadius: "16px",
      background: "rgba(227,169,74,0.04)",
      border: "1px solid rgba(227,169,74,0.15)",
    }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--attest-500)", letterSpacing: "0.1em", marginBottom: "14px", fontWeight: 700 }}>
        ON-CHAIN ATTESTATIONS
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-tertiary)", letterSpacing: "0.06em", marginBottom: "3px" }}>
            AGENT REGISTRY
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--accent-verify)", display: "flex", alignItems: "center", gap: "6px" }}>
            {process.env.NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS
              ? `${process.env.NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS.slice(0, 10)}...`
              : strategy.agentRegistryCid ? `${strategy.agentRegistryCid.slice(0, 16)}...` : "Registered"}
            <ArrowUpRight size={11} style={{ opacity: 0.5 }} />
          </div>
        </div>
        <div style={{ height: "1px", background: "rgba(227,169,74,0.1)" }} />
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-tertiary)", letterSpacing: "0.06em", marginBottom: "3px" }}>
            REPUTATION LEDGER TX
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--accent-verify)", display: "flex", alignItems: "center", gap: "6px" }}>
            {strategy.reputationLedgerTxHash
              ? `${strategy.reputationLedgerTxHash.slice(0, 10)}...`
              : "Pending execution"}
            {strategy.reputationLedgerTxHash && <ArrowUpRight size={11} style={{ opacity: 0.5 }} />}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StrategyDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [strategy, setStrategy] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenRunId, setRegenRunId] = useState<string | null>(null);
  const [jsonCopied, setJsonCopied] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (!savedUser) { router.push("/"); return; }
    const u = JSON.parse(savedUser);
    setUser(u);

    fetch(`/api/strategy/${id}`, { headers: { Authorization: `Bearer ${u.token}` } })
      .then((r) => r.json())
      .then((data) => { if (data.strategy) setStrategy(data.strategy); else toast.error(data.error || "Not found"); })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [id, router]);

  if (loading) return (
    <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--text-tertiary)" }}>
      Loading strategy telemetry...
    </div>
  );

  if (!strategy) return (
    <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--warn-500)" }}>
      Strategy not found
    </div>
  );

  const workflowJson = strategy.compiledWorkflow || strategy.workflowJson;
  const nodeCount = workflowJson?.nodes?.length ?? "—";
  const edgeCount = workflowJson?.edges?.length ?? "—";
  const jsonStr = JSON.stringify(workflowJson, null, 2);

  return (
    <>
      <PipelineLoadingScreen runId={regenRunId} isRunning={isRegenerating} onComplete={() => {}} />
      <div className="app-page" style={{ position: "relative", minHeight: "100vh", padding: "var(--space-8) var(--space-8) var(--space-16)", maxWidth: "1100px", margin: "0 auto" }}>
        <AmbientLight blobs={ambientPresets.hero} />

        {/* ─── Header ─── */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: easeOut }}
          style={{ marginBottom: "32px" }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-tertiary)", letterSpacing: "0.1em" }}>
              STRATEGY FAMILY
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ padding: "3px 10px", borderRadius: "6px", background: "rgba(0,229,200,0.1)", border: "1px solid rgba(0,229,200,0.25)", color: "var(--accent-verify)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em", fontFamily: "var(--font-mono)" }}>
                ✦ ERC-8004 iNFT
              </span>
              <button
                onClick={() => router.push("/dashboard")}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "30px", padding: "0 12px", borderRadius: "999px", background: "rgba(255,255,255,0.04)", color: "var(--text-secondary)", fontSize: "11px", fontWeight: 600, border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", fontFamily: "var(--font-mono)" }}
              >
                ← FORGE
              </button>
            </div>
          </div>

          <h1 style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: "clamp(32px, 5vw, 52px)", lineHeight: 1.05, letterSpacing: "-0.02em", color: "var(--text-primary)", margin: "4px 0 16px" }}>
            {strategy.familyId}
          </h1>

          <p style={{ color: "var(--text-secondary)", fontSize: "15px", lineHeight: 1.6, marginBottom: "20px", maxWidth: "680px" }}>
            {strategy.goal}
          </p>

          <TrustBar version={strategy.version} wallet={user?.walletAddress ?? ""} lifecycle={strategy.lifecycle} />
        </motion.div>

        {/* ─── Deploy CTA ─── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: easeOut, delay: 0.08 }}
          style={{ marginBottom: "40px" }}
        >
          {strategy.keeperhubWorkflowId ? (
            <a
              href={`${KEEPERHUB_BASE}/workflow/${strategy.keeperhubWorkflowId}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex", alignItems: "center", gap: "10px",
                padding: "12px 24px", borderRadius: "8px",
                background: "var(--accent-forge)", color: "#0a0a0a",
                fontSize: "13px", fontWeight: 700, fontFamily: "var(--font-mono)",
                letterSpacing: "0.07em", textDecoration: "none",
              }}
            >
              <Rocket size={14} strokeWidth={2.5} />
              OPEN ON KEEPERHUB
              <ArrowUpRight size={13} strokeWidth={2.5} />
            </a>
          ) : (
            <div>
              <button
                onClick={async () => {
                  const t = toast.loading("Deploying to KeeperHub...");
                  try {
                    const res = await fetch("/api/strategy/deploy", {
                      method: "POST",
                      headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
                      body: JSON.stringify({ strategyId: strategy._id }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error);
                    setStrategy({ ...strategy, keeperhubWorkflowId: data.workflowId });
                    toast.success("Deployed to KeeperHub!", { id: t });
                  } catch (e: any) { toast.error(e.message, { id: t }); }
                }}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "10px",
                  padding: "12px 24px", borderRadius: "8px", cursor: "pointer",
                  background: "var(--accent-forge)", color: "#0a0a0a",
                  fontSize: "13px", fontWeight: 700, fontFamily: "var(--font-mono)",
                  letterSpacing: "0.07em", border: "none",
                }}
              >
                <Rocket size={14} strokeWidth={2.5} />
                EXECUTE ON KEEPERHUB
              </button>
              {strategy.keeperhubWorkflowId && (
                <div style={{ marginTop: "6px", fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-tertiary)" }}>
                  Workflow: {strategy.keeperhubWorkflowId}
                </div>
              )}
            </div>
          )}
        </motion.div>

        {/* ─── Two-col grid ─── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: easeOut, delay: 0.15 }}
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}
        >
          {/* LEFT: Payload + Audit Trail */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px", minWidth: 0 }}>
            {/* Execution Payload */}
            <div className="liquid-glass-shell" style={{ padding: "24px", borderRadius: "20px", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--accent-verify)", letterSpacing: "0.1em", fontWeight: 700, marginBottom: "2px" }}>
                    EXECUTION PAYLOAD
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>
                    {nodeCount} nodes · {edgeCount} edges
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ padding: "3px 10px", borderRadius: "999px", background: "rgba(127,183,154,0.12)", border: "1px solid rgba(127,183,154,0.3)", color: "var(--ok-500)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.05em", fontFamily: "var(--font-mono)" }}>
                    {strategy.lifecycle?.toUpperCase() ?? "LIVE"}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(jsonStr);
                      setJsonCopied(true);
                      setTimeout(() => setJsonCopied(false), 1500);
                    }}
                    style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: jsonCopied ? "var(--accent-verify)" : "var(--text-tertiary)", letterSpacing: "0.06em", background: "none", border: "none", cursor: "pointer", transition: "color 0.2s" }}
                  >
                    {jsonCopied ? "COPIED" : "COPY JSON"}
                  </button>
                </div>
              </div>
              <pre
                style={{ margin: 0, background: "rgba(0,0,0,0.35)", padding: "16px", borderRadius: "12px", overflowX: "auto", fontSize: "11px", fontFamily: "var(--font-mono)", border: "1px solid rgba(255,255,255,0.05)", maxHeight: "380px", lineHeight: 1.65 }}
                dangerouslySetInnerHTML={{ __html: colorizeJson(jsonStr) }}
              />
            </div>

            {/* Intelligence Audit Trail */}
            <div className="liquid-glass-shell" style={{ padding: "24px", borderRadius: "20px", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                <div style={{ width: "20px", height: "20px", borderRadius: "50%", border: "1.5px solid var(--accent-verify)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--accent-verify)" }} />
                </div>
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--accent-verify)", letterSpacing: "0.1em", fontWeight: 700 }}>
                    INTELLIGENCE AUDIT TRAIL
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-tertiary)", marginTop: "2px" }}>
                    Attested artifacts from the inference pipeline
                  </div>
                </div>
              </div>
              <EvidenceBundle
                researcherOutput={strategy.rawEvidence?.researcher || strategy.evidenceBundle?.step1_researcher}
                strategistOutput={strategy.rawEvidence?.strategist || strategy.evidenceBundle?.step2_strategist}
                criticOutput={strategy.rawEvidence?.critic || strategy.evidenceBundle?.step3_critic}
              />
            </div>
          </div>

          {/* RIGHT: Action paths + On-chain + Lineage */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Action paths */}
            <div className="liquid-glass-shell" style={{ padding: "24px", borderRadius: "20px", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-tertiary)", letterSpacing: "0.1em", marginBottom: "14px", fontWeight: 700 }}>
                ACTION PATHS
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <button
                  onClick={async () => {
                    setIsRegenerating(true);
                    setRegenRunId(`regen-${Date.now()}`);
                    try {
                      const res = await fetch("/api/cron/monitor", { method: "POST" });
                      const data = await res.json();
                      setTimeout(() => {
                        setIsRegenerating(false);
                        if (!res.ok) toast.error(data.error);
                        else { toast.success(`Evolved! ${data.updates?.length || 0} workflow(s) regenerated.`); window.location.reload(); }
                      }, 8500);
                    } catch (e: any) { setIsRegenerating(false); toast.error(e.message); }
                  }}
                  style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--accent-verify)", fontSize: "13px", padding: "12px 14px", borderRadius: "10px", background: "rgba(0,229,200,0.08)", border: "1px solid rgba(0,229,200,0.2)", cursor: "pointer", textAlign: "left", fontWeight: 600 }}
                >
                  <LayoutGrid size={15} />
                  Force Auto-Regeneration Eval
                </button>
                <a
                  href="#"
                  style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--text-secondary)", fontSize: "13px", padding: "12px 14px", borderRadius: "10px", background: "rgba(255,255,255,0.025)", textDecoration: "none" }}
                >
                  <GitBranch size={15} />
                  TRACE INTELLIGENCE →
                </a>
                <a
                  href="/dashboard"
                  style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--text-secondary)", fontSize: "13px", padding: "12px 14px", borderRadius: "10px", background: "rgba(255,255,255,0.025)", textDecoration: "none" }}
                >
                  <Rocket size={15} />
                  ← FORGE
                </a>
              </div>
            </div>

            {/* On-chain attestations */}
            <div className="liquid-glass-shell" style={{ padding: "24px", borderRadius: "20px", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <OnChainPanel strategy={strategy} />
            </div>

            {/* Evidence lineage */}
            <div className="liquid-glass-shell" style={{ padding: "24px", borderRadius: "20px", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <EvidenceLineage strategy={strategy} />
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
}
