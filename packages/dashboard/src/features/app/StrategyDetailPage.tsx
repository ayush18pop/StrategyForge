import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowRight, GitBranch, Radar, Rocket, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { deployFamily, requestIncidentUpdate, requestScheduledUpdate } from '../../lib/api';
import { formatAddress, formatDateTime, number, percent, titleCaseFromSlug } from '../../lib/format';
import { buildVersionViews, familySummaryMetrics, latestLiveVersion } from '../../lib/strategy-view';
import { useFamilyQuery } from './query';
import { Badge, EmptyState, GhostButton, HashRow, LoadingBlock, PrimaryButton } from './AppPrimitives';
import { NodeEdgeGraph } from '../../components/data/NodeEdgeGraph';
import { AmbientLight } from '../../components/glass/AmbientLight';
import { ambientPresets } from '../../components/glass/ambient-presets';

const easeOut = [0.22, 1, 0.36, 1] as const;

export function StrategyDetailPage() {
  const { familyId = '' } = useParams();
  const queryClient = useQueryClient();
  const familyQuery = useFamilyQuery(familyId);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);

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
    onError: (error) => toast.error(error.message),
  });

  const incidentMutation = useMutation({
    mutationFn: () => requestIncidentUpdate(familyId, 'review-required', 'Manual incident simulation from dashboard'),
    onSuccess: async () => {
      toast.success('Emergency update triggered');
      await queryClient.invalidateQueries({ queryKey: ['family', familyId] });
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

  return (
    <div className="app-page" style={{ position: 'relative' }}>
      <AmbientLight blobs={ambientPresets.hero} />

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

      {/* ─── Workflow + Version Lineage ─── */}
      <motion.div
        className="app-two-col"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: easeOut, delay: 0.16 }}
      >
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
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <Badge tone={activeVersion.lifecycle === 'live' ? 'ok' : activeVersion.lifecycle === 'draft' ? 'attest' : 'default'}>
                  {activeVersion.lifecycle}
                </Badge>
                <Badge tone="accent">Workflow {activeVersion.workflowName}</Badge>
                {activeVersion.keeperhubWorkflowId ? (
                  <Badge tone="default">KeeperHub {activeVersion.keeperhubWorkflowId}</Badge>
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

        <div className="app-section-card">
          <div>
            <h2 className="app-section-card__title">Version lineage</h2>
            <p className="app-section-card__caption">
              Updates are siblings, not replacements. Every version stays inspectable.
            </p>
          </div>
          <div style={{ display: 'grid', gap: '10px' }}>
            {versions.map((version) => {
              const selected = activeVersion?.version === version.version;
              return (
                <button
                  key={version.version}
                  type="button"
                  onClick={() => setSelectedVersion(version.version)}
                  className={`app-version-card ${selected ? 'app-version-card--selected' : ''}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                    <strong style={{ color: 'var(--text-primary)', fontSize: 'var(--fs-md)' }}>v{version.version}</strong>
                    <Badge tone={version.lifecycle === 'live' ? 'ok' : version.lifecycle === 'draft' ? 'attest' : 'default'}>
                      {version.lifecycle}
                    </Badge>
                  </div>
                  <p style={{ marginTop: '8px', color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>
                    {formatDateTime(version.createdAt)} · {version.protocols.join(', ')}
                  </p>
                  <p style={{ marginTop: '8px', color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>
                    Trust score {version.proofScore} · {version.priorCids.length} prior CID{version.priorCids.length === 1 ? '' : 's'}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* ─── Goal + Action paths ─── */}
      <motion.div
        className="app-two-col--even"
        style={{ display: 'grid', gap: '18px' }}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: easeOut, delay: 0.24 }}
      >
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
              <Link to={`/app/execution/${liveVersion.keeperhubWorkflowId}`} className="app-route-link">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                  <Radar size={16} strokeWidth={1.8} /> Watch live execution →
                </span>
                <ArrowRight size={16} strokeWidth={1.8} />
              </Link>
            ) : null}
            <Link to="/app/generate" className="app-route-link">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                <Rocket size={16} strokeWidth={1.8} /> Forge another family →
              </span>
              <ArrowRight size={16} strokeWidth={1.8} />
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
