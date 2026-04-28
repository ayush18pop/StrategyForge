import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import { createPipelineRun, createStrategy } from "../../lib/api";
import { PipelineLoadingScreen } from "../pipeline/PipelineLoadingScreen";
import { AmbientLight } from "../../components/glass/AmbientLight";
import { ambientPresets } from "../../components/glass/ambient-presets";
import { ConnectButton } from "../../components/wallet/ConnectButton";
import "./generate.css";

const easeOut = [0.22, 1, 0.36, 1] as const;

export function GeneratePage() {
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();
  const [asset, setAsset] = useState("USDC");
  const [amount, setAmount] = useState("50000");
  const [riskLevel, setRiskLevel] = useState<"balanced" | "conservative">(
    "balanced",
  );
  const [horizon, setHorizon] = useState("6 months");
  const [chains, setChains] = useState("ethereum,base");
  const [targetYield, setTargetYield] = useState("800");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [liveRunId, setLiveRunId] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (runId: string | null) => {
      if (!address) {
        throw new Error('Connect a wallet before forging a strategy.');
      }

      return createStrategy({
        runId: runId ?? undefined,
        userWalletAddress: address,
        goal: {
          asset,
          amount: Number(amount),
          riskLevel,
          horizon,
          chains: chains
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean),
          targetYield: Number(targetYield),
        },
      });
    },
    onSuccess: (result) => {
      toast.success("Strategy family created");
      setLiveRunId(null);
      navigate(`/app/strategy/${result.familyId}`);
    },
    onError: (error) => {
      setLiveRunId(null);
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !address) return;
    createPipelineRun()
      .then(({ runId }) => {
        setLiveRunId(runId);
        mutation.mutate(runId);
      })
      .catch(() => {
        setLiveRunId(null);
        mutation.mutate(null);
      });
  };

  return (
    <>
      {/* Loading screen overlay */}
      <PipelineLoadingScreen
        runId={liveRunId}
        isRunning={mutation.isPending}
        onComplete={() => {
          /* navigation handled by mutation.onSuccess */
        }}
      />

      <div className="generate-page" style={{ position: "relative" }}>
        <AmbientLight blobs={ambientPresets.hero} />

        {/* Hero */}
        <motion.header
          className="generate-hero"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: easeOut }}
        >
          <span className="generate-hero__eyebrow">forge a strategy</span>
          <h1 className="generate-hero__title">
            Define the goal. The agent does the rest — with proof.
          </h1>
          <p className="generate-hero__subtitle">
            Six pipeline stations. Three TEE attestations. One verifiable
            evidence bundle. Every step is inspectable.
          </p>
        </motion.header>

        {/* Goal form */}
        <form className="generate-form glass-card" onSubmit={handleSubmit}>
          {/* Primary fields */}
          <div className="generate-form__row">
            <div className="generate-form__field">
              <label className="generate-form__label" htmlFor="gen-asset">
                Asset
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
                Amount
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

          {/* Risk level */}
          <div className="generate-form__field">
            <span className="generate-form__label">Risk level</span>
            <div className="generate-form__risk-group">
              <button
                type="button"
                className={
                  riskLevel === "balanced"
                    ? "segmented-active"
                    : "segmented-button"
                }
                onClick={() => setRiskLevel("balanced")}
              >
                Balanced
              </button>
              <button
                type="button"
                className={
                  riskLevel === "conservative"
                    ? "segmented-active"
                    : "segmented-button"
                }
                onClick={() => setRiskLevel("conservative")}
              >
                Conservative
              </button>
            </div>
          </div>

          {/* Advanced toggle */}
          <button
            type="button"
            className="generate-form__advanced-toggle"
            aria-expanded={advancedOpen}
            onClick={() => setAdvancedOpen(!advancedOpen)}
          >
            <ChevronDown size={14} />
            Advanced options
          </button>

          {/* Advanced fields */}
          <div
            className="generate-form__advanced-fields"
            data-open={advancedOpen}
          >
            <div className="generate-form__advanced-inner">
              <div className="generate-form__row">
                <div className="generate-form__field">
                  <label className="generate-form__label" htmlFor="gen-horizon">
                    Horizon
                  </label>
                  <input
                    id="gen-horizon"
                    className="generate-form__input"
                    value={horizon}
                    onChange={(e) => setHorizon(e.target.value)}
                    placeholder="6 months"
                  />
                </div>
                <div className="generate-form__field">
                  <label className="generate-form__label" htmlFor="gen-yield">
                    Target yield (bps)
                  </label>
                  <input
                    id="gen-yield"
                    className="generate-form__input"
                    value={targetYield}
                    onChange={(e) => setTargetYield(e.target.value)}
                    placeholder="800"
                  />
                </div>
              </div>
              <div className="generate-form__field">
                <label className="generate-form__label" htmlFor="gen-chains">
                  Chains
                </label>
                <input
                  id="gen-chains"
                  className="generate-form__input"
                  value={chains}
                  onChange={(e) => setChains(e.target.value)}
                  placeholder="ethereum,base"
                />
              </div>
              <div className="generate-form__field">
                <label className="generate-form__label">Wallet address</label>
                {isConnected && address ? (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--edge-sides)',
                      background: 'var(--bg-3)',
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--fs-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-ok)', flexShrink: 0 }} />
                    {address}
                  </div>
                ) : (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--edge-sides)',
                      background: 'var(--bg-3)',
                      color: 'var(--text-tertiary)',
                      fontSize: 'var(--fs-sm)',
                    }}
                  >
                    No wallet connected
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Submit */}
          {isConnected ? (
            <button
              type="submit"
              className="generate-form__submit"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Forging…" : "Forge Strategy"}
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', paddingTop: '4px' }}>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', textAlign: 'center' }}>
                Connect your wallet to forge a strategy.
              </p>
              <ConnectButton />
            </div>
          )}
        </form>

        {/* Pipeline overview (dormant stations) */}
        {!mutation.isPending && (
          <section className="station-strip">
            {[
              {
                n: 1,
                label: "Discovery",
                badge: "deterministic",
                desc: "Fetches live action schemas — no LLM involved",
              },
              {
                n: 2,
                label: "Researcher",
                badge: "tee",
                desc: "Gathers market signals inside a TEE enclave",
              },
              {
                n: 3,
                label: "Strategist",
                badge: "tee",
                desc: "Proposes candidate workflows using proven schemas",
              },
              {
                n: 4,
                label: "Critic",
                badge: "tee",
                desc: "Stress-tests candidates against prior failures",
              },
              {
                n: 5,
                label: "Compiler",
                badge: "deterministic",
                desc: "Compiles the winner to deployable JSON",
              },
              {
                n: 6,
                label: "Risk Validator",
                badge: "deterministic",
                desc: "Validates safety bounds — deterministic, no AI",
              },
            ].map(({ n, label, badge, desc }, i) => (
              <motion.div
                key={label}
                className="station station--dormant"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 0.5, y: 0 }}
                transition={{
                  duration: 0.35,
                  ease: easeOut,
                  delay: 0.3 + i * 0.05,
                }}
              >
                <div className="station__header">
                  <div className="station__number">{n}</div>
                  <span className="station__title">{label}</span>
                  <span className={`station__badge station__badge--${badge}`}>
                    {badge === "tee" ? "⬡ TEE" : "⚙ DET"}
                  </span>
                </div>
                <p className="station__detail">{desc}</p>
              </motion.div>
            ))}
          </section>
        )}
      </div>
    </>
  );
}
