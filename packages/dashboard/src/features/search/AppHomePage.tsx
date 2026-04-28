import type { CSSProperties } from 'react';
import { useEffect, useRef, useState, useDeferredValue, startTransition } from 'react';
import { motion, useInView } from 'framer-motion';
import { ArrowRight, Binary, BrainCircuit, ShieldCheck, Waypoints } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AmbientLight } from '../../components/glass/AmbientLight';
import { ambientPresets } from '../../components/glass/ambient-presets';
import { deploymentConfig } from '../../lib/contracts';
import { parseGoalInput } from '../../lib/goal';
import { buildSearchView } from '../../lib/strategy-view';
import { useSearchQuery } from '../app/query';
import { ResultsList } from './ResultsList';
import { SearchInput } from './SearchInput';
import type { LiveStat } from './types';

const easeOut = [0.22, 1, 0.36, 1] as const;

const SEARCH_EXAMPLES = [
  '$50K USDC, medium risk, 6 months, Ethereum',
  '$15K USDC, conservative, Base, 5% target',
  '$80K DAI, balanced, 12 months, Arbitrum',
] as const;

const TRUST_PILLARS = [
  'TEE-attested reasoning',
  'On-chain reputation',
  'Versioned memory DAG',
] as const;

const PROOF_MODULES = [
  {
    eyebrow: 'Discovery first',
    title: 'Schemas are checked before the model reasons.',
    copy: 'The pipeline queries live action schemas deterministically — before any LLM inference begins. No hallucinated context.',
    icon: <Binary size={16} strokeWidth={1.8} />,
  },
  {
    eyebrow: 'Public memory',
    title: 'Every live family carries its own mistake history.',
    copy: 'Versions never overwrite each other. They accumulate lineage through priorCids, and the DAG route lets you inspect the ancestry.',
    icon: <Waypoints size={16} strokeWidth={1.8} />,
  },
  {
    eyebrow: 'Review before deploy',
    title: 'Trust is inspected before capital moves.',
    copy: 'Open a family to inspect lifecycle, workflow topology, and deployment state before committing to execution.',
    icon: <ShieldCheck size={16} strokeWidth={1.8} />,
  },
] as const;

export function AppHomePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const deferredQuery = useDeferredValue(query);
  const parsedGoal = parseGoalInput(query);
  const deferredParsedGoal = parseGoalInput(deferredQuery);

  const apiParams = new URLSearchParams();
  if (deferredParsedGoal.asset) apiParams.set('asset', deferredParsedGoal.asset);
  if (deferredParsedGoal.riskLevel) apiParams.set('riskLevel', deferredParsedGoal.riskLevel);
  if (deferredParsedGoal.targetYieldBps) apiParams.set('targetYield', String(deferredParsedGoal.targetYieldBps));
  if (deferredParsedGoal.chain) apiParams.set('chains', deferredParsedGoal.chain.toLowerCase());

  const searchQuery = useSearchQuery(apiParams);
  const results = (searchQuery.data?.matches ?? []).map((match) =>
    buildSearchView(match.familyId, match.goal, match.versionCount, match.latestVersion),
  );

  const stats: LiveStat[] = [
    {
      value: `${searchQuery.data?.total ?? 0}`,
      label: 'Proven families',
      tone: 'accent',
    },
    {
      value: `${Object.keys(deploymentConfig.contracts).length}`,
      label: 'On-chain contracts',
      tone: 'attest',
    },
    {
      value: results.some((result) => result.lifecycle === 'live') ? 'Live' : 'Draft',
      label: 'Catalog status',
      tone: 'ok',
    },
  ];

  const example = SEARCH_EXAMPLES[query.length % SEARCH_EXAMPLES.length] ?? SEARCH_EXAMPLES[0];

  const handleValueChange = (nextValue: string) => {
    startTransition(() => {
      const nextParams = new URLSearchParams(searchParams);
      if (nextValue.trim().length === 0) {
        nextParams.delete('q');
      } else {
        nextParams.set('q', nextValue);
      }
      setSearchParams(nextParams, { replace: true });
    });
  };

  return (
    <div
      style={{
        position: 'relative',
        minHeight: 'calc(100vh - 96px)',
        paddingBottom: '48px',
      }}
    >
      <AmbientLight blobs={ambientPresets.hero} />

      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: `
            radial-gradient(circle at 18% 12%, rgba(var(--accent-glow), 0.18) 0%, transparent 30%),
            radial-gradient(circle at 84% 82%, rgba(227,169,74,0.16) 0%, transparent 28%),
            linear-gradient(180deg, var(--landing-page-bg) 0%, color-mix(in srgb, var(--landing-page-bg) 74%, var(--bg-0) 26%) 100%)
          `,
          pointerEvents: 'none',
        }}
      />

      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: easeOut }}
        style={{
          position: 'relative',
          zIndex: 1,
          width: 'min(100%, 1180px)',
          margin: '0 auto',
          paddingInline: 'clamp(20px, 4vw, 40px)',
          paddingTop: 'clamp(20px, 4vw, 42px)',
        }}
      >
        <div style={{ display: 'grid', gap: '28px', justifyItems: 'center', textAlign: 'center' }}>
          <div
            className="liquid-glass-soft"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              height: '36px',
              padding: '0 14px',
              borderRadius: '999px',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.11) 0%, rgba(255,255,255,0.03) 100%), var(--landing-surface-soft)',
              border: '1px solid var(--landing-border)',
              color: 'var(--text-secondary)',
              fontSize: 'var(--fs-sm)',
              fontWeight: 600,
            }}
          >
            <BrainCircuit size={15} strokeWidth={1.8} color="var(--accent-200)" />
            App home · trust-first search
          </div>

          <div style={{ maxWidth: '930px' }}>
            <h1
              style={{
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(52px, 8vw, 98px)',
                lineHeight: 0.95,
                letterSpacing: '-0.055em',
              }}
            >
              Trust the strategy, not the marketer.
            </h1>

            <p
              style={{
                margin: '18px auto 0',
                maxWidth: '42rem',
                color: 'var(--text-secondary)',
                fontSize: 'clamp(17px, 2vw, 20px)',
                lineHeight: 1.45,
              }}
            >
              Every strategy family here carries TEE-attested reasoning, on-chain reputation, and a memory of what went wrong before. Search the proof layer first, then decide whether a family deserves your deploy path.
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            {TRUST_PILLARS.map((pillar) => (
              <div
                key={pillar}
                className="liquid-glass-soft"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  height: '38px',
                  padding: '0 14px',
                  borderRadius: '999px',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'var(--text-secondary)',
                  fontSize: 'var(--fs-sm)',
                }}
              >
                {pillar}
              </div>
            ))}
          </div>

          <div
            className="liquid-glass-panel"
            style={{
              width: 'min(100%, 920px)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px',
              padding: '14px',
              borderRadius: '28px',
              background: `
                linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.03) 20%, transparent 54%),
                linear-gradient(130deg, rgba(var(--accent-glow), 0.12) 0%, transparent 42%, rgba(127,183,154,0.06) 100%),
                var(--landing-surface)
              `,
              border: '1px solid var(--landing-border)',
              borderTopColor: 'var(--landing-border-strong)',
            }}
          >
            {stats.map((stat) => (
              <AnimatedStat key={stat.label} value={stat.value} label={stat.label} tone={stat.tone} />
            ))}
          </div>

          <SearchInput
            value={query}
            onValueChange={handleValueChange}
            chips={parsedGoal.chips}
            confidence={parsedGoal.confidence}
            note={parsedGoal.note}
            example={example}
            resultCount={results.length}
          />
        </div>

        <ResultsList
          query={deferredQuery}
          results={results}
          onOpen={(familyId) => navigate(`/app/strategy/${familyId}`)}
        />

        <div
          style={{
            marginTop: '28px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '16px',
          }}
        >
          {PROOF_MODULES.map((module, index) => (
            <motion.article
              key={module.title}
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: easeOut, delay: 0.12 + index * 0.05 }}
              className="liquid-glass-soft"
              style={{
                padding: '20px',
                borderRadius: '24px',
                background: `
                  linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.03) 18%, transparent 56%),
                  var(--landing-surface-soft)
                `,
                border: '1px solid var(--landing-border)',
                borderTopColor: 'var(--landing-border-strong)',
              }}
            >
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  height: '32px',
                  padding: '0 12px',
                  borderRadius: '999px',
                  background: 'rgba(255,255,255,0.08)',
                  color: 'var(--accent-200)',
                  fontSize: 'var(--fs-sm)',
                  fontWeight: 600,
                }}
              >
                {module.icon}
                {module.eyebrow}
              </div>

              <h2
                style={{
                  marginTop: '16px',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(26px, 2.7vw, 34px)',
                  lineHeight: 1.02,
                  letterSpacing: '-0.035em',
                }}
              >
                {module.title}
              </h2>

              <p
                style={{
                  marginTop: '10px',
                  color: 'var(--text-secondary)',
                  fontSize: 'var(--fs-base)',
                }}
              >
                {module.copy}
              </p>
            </motion.article>
          ))}
        </div>

        <div
          className="liquid-glass-soft"
          style={{
            marginTop: '18px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px',
            padding: '16px 18px',
            borderRadius: '22px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid var(--landing-border)',
          }}
        >
          <div>
            <div style={{ color: 'var(--text-primary)', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>
              Search is wired to the real StrategyForge backend now.
            </div>
            <div style={{ marginTop: '4px', color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)' }}>
              If a query returns nothing, the next correct move is the generation pipeline, not a fabricated result card.
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/app/generate')}
            style={primaryButtonStyle}
          >
            Generate new family
            <ArrowRight size={15} strokeWidth={2} />
          </button>
        </div>
      </motion.section>
    </div>
  );
}

function AnimatedStat({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone: 'attest' | 'accent' | 'ok';
}) {
  const [current, setCurrent] = useState(0);
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.7 });
  const numeric = Number(value.replace(/[^0-9.]/g, ''));
  const isNumeric = Number.isFinite(numeric) && value.toLowerCase() !== 'live' && value.toLowerCase() !== 'draft';

  useEffect(() => {
    if (!inView || !isNumeric) return;

    const startedAt = performance.now();
    const duration = 1300;

    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(numeric * eased));

      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(tick);
  }, [inView, isNumeric, numeric]);

  const rendered = isNumeric ? `${current.toLocaleString()}` : value;
  const color = tone === 'attest' ? 'var(--attest-500)' : tone === 'ok' ? 'var(--ok-500)' : 'var(--accent-200)';

  return (
    <div
      ref={ref}
      style={{
        padding: '16px',
        borderRadius: '20px',
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.08)',
        textAlign: 'left',
      }}
    >
      <div
        className="tabular-nums"
        style={{
          color,
          fontFamily: isNumeric ? 'var(--font-mono)' : 'var(--font-display)',
          fontSize: isNumeric ? 'clamp(24px, 2.8vw, 32px)' : 'clamp(30px, 3vw, 40px)',
          lineHeight: 1,
          letterSpacing: '-0.03em',
        }}
      >
        {rendered}
      </div>
      <div style={{ marginTop: '10px', maxWidth: '22ch', color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>
        {label}
      </div>
    </div>
  );
}

const primaryButtonStyle: CSSProperties = {
  height: '46px',
  padding: '0 18px',
  border: 'none',
  borderRadius: '999px',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '10px',
  background: 'var(--accent-500)',
  color: '#fff',
  fontSize: 'var(--fs-sm)',
  fontWeight: 600,
  boxShadow: '0 18px 40px -22px rgba(var(--accent-glow), 0.72)',
  cursor: 'pointer',
};
