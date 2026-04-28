import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAccount, useWalletClient } from 'wagmi';
import { motion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, GitBranch, Radar, Rocket, ShieldCheck, Wallet, Zap, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  deployFamily,
  fetchSubscriptionInfo,
  migrateFamily,
  requestIncidentUpdate,
  requestScheduledUpdate,
  requestWithPayment,
  subscribeToStrategy,
  PaymentRequiredError,
} from '../../lib/api';
import type { PaymentDetails, SubscriptionInfo } from '../../lib/api';
import { formatAddress, number, percent, titleCaseFromSlug } from '../../lib/format';
import { buildVersionViews, familySummaryMetrics, latestLiveVersion } from '../../lib/strategy-view';
import { signX402Payment } from '../../lib/payment';
import { useFamilyQuery } from './query';
import { StrategyTelemetryPanel } from './StrategyTelemetryPanel';
import { Badge, EmptyState, GhostButton, HashRow, LoadingBlock, PrimaryButton } from './AppPrimitives';
import { NodeEdgeGraph } from '../../components/data/NodeEdgeGraph';
import { AmbientLight } from '../../components/glass/AmbientLight';
import { ambientPresets } from '../../components/glass/ambient-presets';
import { PaymentModal } from '../../components/wallet/PaymentModal';
import { useStrategyTelemetry } from './useStrategyTelemetry';

const KEEPERHUB_BASE = 'https://app.keeperhub.com';

const easeOut = [0.22, 1, 0.36, 1] as const;

export function StrategyDetailPage() {
  const { familyId = '' } = useParams();
  const queryClient = useQueryClient();
  const familyQuery = useFamilyQuery(familyId);
  const telemetry = useStrategyTelemetry(familyId);
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [pendingPayment, setPendingPayment] = useState<{ details: PaymentDetails; path: string; body: string } | null>(null);
  const [subscribeStep, setSubscribeStep] = useState<'idle' | 'signing' | 'done'>('idle');
  const [subscribeResult, setSubscribeResult] = useState<{ turnkeyWallet: string; asset: string; expectedAmount: number } | null>(null);

  const subscriptionInfoQuery = useQuery({
    queryKey: ['subscription-info', familyId],
    queryFn: () => fetchSubscriptionInfo(familyId),
    enabled: !!familyId,
    staleTime: 5 * 60 * 1_000,
  });

  const deployMutation = useMutation({
    mutationFn: () => deployFamily(familyId),
    onSuccess: async () => {
      toast.success('Draft deployed to KeeperHub');
      await queryClient.invalidateQueries({ queryKey: ['family', familyId] });
      await queryClient.invalidateQueries({ queryKey: ['search'] });
    },
    onError: (error) => toast.error(error.message),
  });

  const refreshMutation = useMutation({
    mutationFn: () => requestScheduledUpdate(familyId),
    onSuccess: async () => {
      toast.success('Evolution pipeline triggered');
      await queryClient.invalidateQueries({ queryKey: ['family', familyId] });
      await queryClient.invalidateQueries({ queryKey: ['search'] });
    },
    onError: (error) => {
      if (error instanceof PaymentRequiredError) {
        setPendingPayment({
          details: error.details,
          path: `/api/strategies/${familyId}/update`,
          body: JSON.stringify({ reason: 'scheduled_review' }),
        });
        return;
      }
      toast.error(error.message);
    },
  });

  const incidentMutation = useMutation({
    mutationFn: () => requestIncidentUpdate(familyId, 'review-required', 'Manual incident simulation from dashboard'),
    onSuccess: async () => {
      toast.success('Emergency update triggered');
      await queryClient.invalidateQueries({ queryKey: ['family', familyId] });
    },
    onError: (error) => toast.error(error.message),
  });

  const migrateMutation = useMutation({
    mutationFn: () => migrateFamily(familyId),
    onSuccess: (result) => {
      const msg = result.warning
        ? `Migration workflow created — trigger manually (${result.migrationWorkflowId})`
        : `Migrating v${result.from.version}→v${result.to.version} · ${result.withdraws} withdrawals, ${result.deposits} deposits`;
      toast.success(msg);
    },
    onError: (error) => toast.error(error.message),
  });

  const versions = useMemo(
    () => (familyQuery.data ? buildVersionViews(familyQuery.data.versions) : []),
    [familyQuery.data],
  );

  const activeVersion = useMemo(() => {
    if (selectedVersion !== null) {
      return versions.find((version) => version.version === selectedVersion) ?? versions[0];
    }
    return versions[0];
  }, [selectedVersion, versions]);

  if (familyQuery.isLoading) {
    return <LoadingBlock label="Loading strategy family…" />;
  }

  if (familyQuery.isError || !familyQuery.data) {
    return (
      <EmptyState
        title="Strategy unavailable"
        description={familyQuery.error?.message ?? 'This family could not be loaded.'}
        action={<Link to="/app"><PrimaryButton>Back to search</PrimaryButton></Link>}
      />
    );
  }

  const family = familyQuery.data;
  const metrics = familySummaryMetrics(family);
  const liveVersion = latestLiveVersion(family.versions);
  const hasDraft = family.versions.some((version) => version.lifecycle === 'draft');
  const canMigrate = family.versions.length >= 2 && family.versions.some((v) => v.lifecycle === 'live');
  const keeperhubUrl = liveVersion?.keeperhubWorkflowId
    ? `${KEEPERHUB_BASE}/workflows/${liveVersion.keeperhubWorkflowId}`
    : KEEPERHUB_BASE;

  const handlePaymentApproved = async (paymentHeader: string) => {
    if (!pendingPayment) return;
    try {
      await requestWithPayment(pendingPayment.path, paymentHeader, {
        method: 'POST',
        body: pendingPayment.body,
      });
      toast.success('Payment sent — evolution pipeline triggered');
      await queryClient.invalidateQueries({ queryKey: ['family', familyId] });
      await queryClient.invalidateQueries({ queryKey: ['search'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Payment failed');
    } finally {
      setPendingPayment(null);
    }
  };

  const handleSubscribe = async (info: SubscriptionInfo) => {
    if (!walletClient || !address) {
      toast.error('Connect your wallet first');
      return;
    }
    if (!info.accessFeeRecipient) {
      toast.error('Access fee recipient not configured — contact StrategyForge');
      return;
    }

    setSubscribeStep('signing');
    try {
      const paymentDetails: PaymentDetails = {
        amount: info.accessFeeAmount,
        currency: info.accessFeeCurrency,
        recipient: info.accessFeeRecipient,
        network: info.accessFeeNetwork,
      };
      const paymentHeader = await signX402Payment(walletClient, address, paymentDetails);
      const result = await subscribeToStrategy(familyId, paymentHeader, address, info.principalAmount);
      setSubscribeResult({ turnkeyWallet: result.turnkeyWallet, asset: result.asset, expectedAmount: result.expectedAmount });
      setSubscribeStep('done');
      toast.success('Access fee signed — deposit your principal to activate the strategy');
    } catch (e) {
      setSubscribeStep('idle');
      toast.error(e instanceof Error ? e.message : 'Subscription failed');
    }
  };

  return (
    <div className="app-page" style={{ position: 'relative' }}>
      <AmbientLight blobs={ambientPresets.hero} />

      <PaymentModal
        details={pendingPayment?.details ?? null}
        onClose={() => setPendingPayment(null)}
        onApprove={handlePaymentApproved}
      />

      {/* ─── Page Intro ─── */}
      <motion.section
        className="app-page-intro"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: easeOut }}
      >
        <span className="app-page-intro__eyebrow">strategy family</span>
        <h1 className="app-page-intro__title">{titleCaseFromSlug(family.familyId)}</h1>
        <p className="app-page-intro__subtitle">
          {family.versions.length} version{family.versions.length !== 1 ? 's' : ''} tracked.
          Every update creates a sibling, never a silent replacement. Inspect the proof, then decide.
        </p>
        <div className="app-page-intro__actions">
          {liveVersion?.keeperhubWorkflowId ? (
            <a
              href={keeperhubUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                height: '40px',
                padding: '0 20px',
                borderRadius: '999px',
                background: 'var(--accent-500)',
                color: '#fff',
                fontSize: 'var(--fs-sm)',
                fontWeight: 700,
                textDecoration: 'none',
                boxShadow: '0 14px 32px -18px rgba(var(--accent-glow), 0.7)',
              }}
            >
              View on KeeperHub <ArrowUpRight size={14} strokeWidth={2} />
            </a>
          ) : null}
          {hasDraft ? (
            <PrimaryButton onClick={() => deployMutation.mutate()} disabled={deployMutation.isPending}>
              Deploy to KeeperHub →
            </PrimaryButton>
          ) : null}
          <GhostButton onClick={() => refreshMutation.mutate()} disabled={refreshMutation.isPending}>
            Trigger evolution
          </GhostButton>
          <GhostButton onClick={() => incidentMutation.mutate()} disabled={incidentMutation.isPending}>
            Simulate incident
          </GhostButton>
          {canMigrate && (
            <GhostButton onClick={() => migrateMutation.mutate()} disabled={migrateMutation.isPending}>
              {migrateMutation.isPending ? 'Migrating funds…' : 'Migrate funds to latest →'}
            </GhostButton>
          )}
        </div>
      </motion.section>

      {/* ─── Stats ─── */}
      <motion.div
        className="app-stat-grid"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: easeOut, delay: 0.08 }}
      >
        <div className="app-stat-card">
          <div className="app-stat-card__value app-stat-card__value--accent">{metrics.proofScore}</div>
          <div className="app-stat-card__label">Trust score</div>
          <div className="app-stat-card__meta">TEE verified · On-chain anchored</div>
        </div>
        <div className="app-stat-card">
          <div className="app-stat-card__value app-stat-card__value--attest">{family.versions.length}</div>
          <div className="app-stat-card__label">Versions</div>
          <div className="app-stat-card__meta">{metrics.liveCount} live · {metrics.draftCount} draft · {metrics.deprecatedCount} deprecated</div>
        </div>
        <div className="app-stat-card">
          <div className="app-stat-card__value app-stat-card__value--ok">{percent.format(family.goal.targetYield / 100)}%</div>
          <div className="app-stat-card__label">Target yield</div>
          <div className="app-stat-card__meta">{number.format(family.goal.amount)} {family.goal.asset} mandate</div>
        </div>
        <div className="app-stat-card">
          <div className="app-stat-card__value app-stat-card__value--default">{formatAddress(family.userWalletAddress)}</div>
          <div className="app-stat-card__label">Wallet</div>
          <div className="app-stat-card__meta">KeeperHub user wallet</div>
        </div>
      </motion.div>

      {/* ─── Invest / Subscribe ─── */}
      {liveVersion ? (
        <motion.div
          className="app-section-card"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: easeOut, delay: 0.14 }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
            <div>
              <h2 className="app-section-card__title">Invest in this strategy</h2>
              <p className="app-section-card__caption">
                Pay a one-time access fee to activate this strategy, then deposit your principal into the StrategyForge execution wallet.
                KeeperHub runs the strategy on your behalf — no custody given to the dashboard.
              </p>
            </div>
            {liveVersion.keeperhubWorkflowId ? (
              <a
                href={keeperhubUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  borderRadius: '14px',
                  border: '1px solid rgba(var(--accent-glow), 0.32)',
                  background: 'rgba(var(--accent-glow), 0.10)',
                  color: 'var(--accent-200)',
                  fontSize: 'var(--fs-sm)',
                  fontWeight: 600,
                  textDecoration: 'none',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                Open on KeeperHub <ArrowUpRight size={13} strokeWidth={2} />
              </a>
            ) : null}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            {/* Step 1 */}
            <SubscribeStep
              number={1}
              done={subscribeStep === 'done'}
              title="Pay access fee"
              description={
                subscriptionInfoQuery.data
                  ? `${subscriptionInfoQuery.data.accessFeeAmount} ${subscriptionInfoQuery.data.accessFeeCurrency} on ${subscriptionInfoQuery.data.accessFeeNetwork}`
                  : 'Loading…'
              }
              action={
                subscribeStep === 'done' ? null : (
                  <button
                    type="button"
                    disabled={subscribeStep === 'signing' || !walletClient || !subscriptionInfoQuery.data}
                    onClick={() => subscriptionInfoQuery.data && void handleSubscribe(subscriptionInfoQuery.data)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      height: '38px',
                      padding: '0 16px',
                      borderRadius: '12px',
                      border: address ? '1px solid rgba(var(--accent-glow), 0.35)' : '1px solid rgba(255,255,255,0.08)',
                      background: address
                        ? 'linear-gradient(135deg, rgba(var(--accent-glow), 0.18) 0%, rgba(var(--accent-glow), 0.08) 100%)'
                        : 'rgba(255,255,255,0.04)',
                      color: address ? 'var(--accent-200)' : 'var(--text-tertiary)',
                      fontSize: 'var(--fs-sm)',
                      fontWeight: 700,
                      cursor: (subscribeStep === 'signing' || !walletClient || !subscriptionInfoQuery.data) ? 'not-allowed' : 'pointer',
                      opacity: (subscribeStep === 'signing' || !walletClient || !subscriptionInfoQuery.data) ? 0.6 : 1,
                    }}
                  >
                    <Zap size={13} strokeWidth={2} />
                    {!address
                      ? 'Connect wallet first'
                      : subscribeStep === 'signing'
                        ? 'Signing…'
                        : 'Sign & pay access fee'}
                  </button>
                )
              }
            />

            {/* Step 2 */}
            <SubscribeStep
              number={2}
              done={false}
              title="Deposit principal"
              description={
                subscribeResult
                  ? `Send ${number.format(subscribeResult.expectedAmount)} ${subscribeResult.asset} to the address below`
                  : `Complete step 1 first — the deposit address will appear here`
              }
              action={
                subscribeResult ? (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    <div
                      style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        background: 'rgba(127,183,154,0.08)',
                        border: '1px solid rgba(127,183,154,0.24)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 'var(--fs-sm)',
                        color: 'var(--ok-500)',
                        wordBreak: 'break-all',
                      }}
                    >
                      {subscribeResult.turnkeyWallet || '(wallet address not configured)'}
                    </div>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)', lineHeight: 1.5 }}>
                      Send exactly {number.format(subscribeResult.expectedAmount)} {subscribeResult.asset} from your wallet. StrategyForge's Turnkey enclave will begin executing the strategy on your next cron cycle.
                    </p>
                  </div>
                ) : null
              }
            />
          </div>
        </motion.div>
      ) : null}

      {/* ─── Workflow + Telemetry ─── */}
      <motion.div
        className="app-two-col"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: easeOut, delay: 0.20 }}
      >
        {/* Workflow topology */}
        <div className="app-section-card">
          <div>
            <h2 className="app-section-card__title">
              {activeVersion ? `Workflow topology v${activeVersion.version}` : 'Workflow'}
            </h2>
            <p className="app-section-card__caption">
              {activeVersion ? activeVersion.workflowDescription : 'No version selected.'}
            </p>
          </div>
          {activeVersion ? (
            <>
              {versions.length > 0 ? (
                <div className="app-version-selector" aria-label="Strategy versions">
                  {versions.map((version) => {
                    const selected = activeVersion.version === version.version;
                    return (
                      <button
                        key={version.version}
                        type="button"
                        onClick={() => setSelectedVersion(version.version)}
                        className={`app-version-chip ${selected ? 'app-version-chip--selected' : ''}`}
                      >
                        <strong>v{version.version}</strong>
                        <span>{version.lifecycle}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                <Badge tone={activeVersion.lifecycle === 'live' ? 'ok' : activeVersion.lifecycle === 'draft' ? 'attest' : 'default'}>
                  {activeVersion.lifecycle}
                </Badge>
                <Badge tone="accent">Workflow {activeVersion.workflowName}</Badge>
                {activeVersion.keeperhubWorkflowId ? (
                  <a
                    href={`${KEEPERHUB_BASE}/workflows/${activeVersion.keeperhubWorkflowId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 10px',
                      borderRadius: '999px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: 'var(--text-secondary)',
                      fontSize: 'var(--fs-xs)',
                      fontWeight: 600,
                      textDecoration: 'none',
                    }}
                  >
                    KeeperHub {activeVersion.keeperhubWorkflowId.slice(0, 12)}… <ArrowUpRight size={11} strokeWidth={2} />
                  </a>
                ) : null}
              </div>
              <NodeEdgeGraph nodes={activeVersion.workflowNodes} edges={activeVersion.workflowEdges} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
                <HashRow label="Version CID" value={activeVersion.cid} />
                <HashRow label="Evidence bundle CID" value={activeVersion.evidenceBundleCid} />
              </div>
            </>
          ) : (
            <p style={{ color: 'var(--text-secondary)' }}>No workflow versions recorded yet.</p>
          )}
        </div>

        {/* Goal + Action paths stacked */}
        <div style={{ display: 'grid', gap: '18px', alignContent: 'start' }}>
          <div className="app-section-card">
            <div>
              <h2 className="app-section-card__title">Goal contract</h2>
              <p className="app-section-card__caption">The normalized objective the pipeline is held against.</p>
            </div>
            <div style={{ display: 'grid', gap: '14px' }}>
              <div className="app-goal-row">
                <span className="eyebrow">Asset</span>
                <span style={{ color: 'var(--text-primary)' }}>{family.goal.asset}</span>
              </div>
              <div className="app-goal-row">
                <span className="eyebrow">Amount</span>
                <span style={{ color: 'var(--text-primary)' }}>{number.format(family.goal.amount)} {family.goal.asset}</span>
              </div>
              <div className="app-goal-row">
                <span className="eyebrow">Risk</span>
                <span style={{ color: 'var(--text-primary)', textTransform: 'capitalize' }}>{family.goal.riskLevel}</span>
              </div>
              <div className="app-goal-row">
                <span className="eyebrow">Horizon</span>
                <span style={{ color: 'var(--text-primary)' }}>{family.goal.horizon}</span>
              </div>
              <div className="app-goal-row">
                <span className="eyebrow">Chains</span>
                <span style={{ color: 'var(--text-primary)' }}>{family.goal.chains.map((chain) => titleCaseFromSlug(chain)).join(', ')}</span>
              </div>
            </div>
          </div>

          <div className="app-section-card">
            <div>
              <h2 className="app-section-card__title">Action paths</h2>
              <p className="app-section-card__caption">Inspect, verify, then act.</p>
            </div>
            <div style={{ display: 'grid', gap: '12px' }}>
              <Link to={`/app/dag/${family.familyId}`} className="app-route-link">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                  <GitBranch size={16} strokeWidth={1.8} /> Inspect evidence lineage →
                </span>
                <ArrowRight size={16} strokeWidth={1.8} />
              </Link>
              <Link to="/app/agent" className="app-route-link">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                  <ShieldCheck size={16} strokeWidth={1.8} /> View agent brain →
                </span>
                <ArrowRight size={16} strokeWidth={1.8} />
              </Link>
              {liveVersion?.keeperhubWorkflowId ? (
                <>
                  <Link to={`/app/execution/${liveVersion.keeperhubWorkflowId}`} className="app-route-link">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                      <Radar size={16} strokeWidth={1.8} /> Watch live execution →
                    </span>
                    <ArrowRight size={16} strokeWidth={1.8} />
                  </Link>
                  <a
                    href={keeperhubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="app-route-link"
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                      <Wallet size={16} strokeWidth={1.8} /> Manage on KeeperHub →
                    </span>
                    <ArrowUpRight size={16} strokeWidth={1.8} />
                  </a>
                </>
              ) : null}
              <Link to="/app/generate" className="app-route-link">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                  <Rocket size={16} strokeWidth={1.8} /> Forge another family →
                </span>
                <ArrowRight size={16} strokeWidth={1.8} />
              </Link>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ─── Live Telemetry (full width) ─── */}
      <motion.div
        className="app-section-card"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: easeOut, delay: 0.28 }}
      >
        <StrategyTelemetryPanel
          telemetry={telemetry}
          activeVersion={activeVersion?.version ?? null}
        />
      </motion.div>
    </div>
  );
}

function SubscribeStep({
  number,
  done,
  title,
  description,
  action,
}: {
  number: number;
  done: boolean;
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gap: '14px',
        padding: '20px',
        borderRadius: '20px',
        border: done
          ? '1px solid rgba(127,183,154,0.30)'
          : '1px solid rgba(255,255,255,0.08)',
        background: done
          ? 'rgba(127,183,154,0.06)'
          : 'rgba(255,255,255,0.03)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            border: done ? '1.5px solid var(--ok-500)' : '1.5px solid rgba(255,255,255,0.2)',
            background: done ? 'rgba(127,183,154,0.14)' : 'rgba(255,255,255,0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {done
            ? <CheckCircle2 size={16} strokeWidth={2} color="var(--ok-500)" />
            : <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)' }}>{number}</span>}
        </div>
        <div>
          <strong style={{ color: 'var(--text-primary)', fontSize: 'var(--fs-sm)', fontWeight: 700 }}>{title}</strong>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)', marginTop: '2px' }}>{description}</p>
        </div>
      </div>
      {action}
    </div>
  );
}
