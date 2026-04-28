import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Clock3, Network, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { StrategySearchRecord } from './types';

interface ResultsListProps {
  query: string;
  results: StrategySearchRecord[];
  onOpen: (familyId: string) => void;
}

const easeOut = [0.22, 1, 0.36, 1] as const;

export function ResultsList({ query, results, onOpen }: ResultsListProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const clampedActiveIndex = Math.min(activeIndex, Math.max(results.length - 1, 0));

  const hasQuery = query.trim().length > 0;

  if (results.length === 0) {
    return (
      <motion.section
        layout
        className="liquid-glass-panel"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: easeOut }}
        style={{
          width: 'min(100%, 920px)',
          margin: '26px auto 0',
          padding: '28px',
          borderRadius: '28px',
          background: `
            linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.03) 24%, transparent 56%),
            linear-gradient(140deg, rgba(227,169,74,0.10) 0%, transparent 40%, rgba(var(--accent-glow), 0.14) 100%),
            var(--landing-surface)
          `,
          border: '1px solid var(--landing-border)',
          borderTopColor: 'var(--landing-border-strong)',
          boxShadow: `
            inset 0 1px 0 0 rgba(255,255,255,0.22),
            inset 0 -1px 0 0 var(--landing-glass-lowlight),
            0 34px 80px -50px var(--landing-glass-shadow)
          `,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            padding: '8px 12px',
            borderRadius: '999px',
            background: 'rgba(255,255,255,0.08)',
            color: 'var(--attest-500)',
            fontSize: 'var(--fs-sm)',
            fontWeight: 600,
          }}
        >
          <Sparkles size={15} strokeWidth={1.8} />
          Generate path unlocked
        </div>

        <h2
          style={{
            marginTop: '18px',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(28px, 3vw, 42px)',
            lineHeight: 1.04,
            letterSpacing: '-0.03em',
          }}
        >
          No proven strategy matches this goal yet.
        </h2>

        <p
          style={{
            marginTop: '10px',
            maxWidth: '54ch',
            color: 'var(--text-secondary)',
            fontSize: 'var(--fs-md)',
          }}
        >
          {hasQuery
            ? 'Nothing in the live catalog clears this brief with enough proof. The next step is to generate a fresh strategy family and inspect its evidence before it goes live.'
            : 'Start with a goal, or jump straight into the generation pipeline if you already know you need a new strategy.'}
        </p>

        <div style={{ marginTop: '22px', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          <Link
            to="/app/generate"
            style={{
              height: '46px',
              padding: '0 18px',
              borderRadius: '999px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              background: 'var(--accent-500)',
              color: '#fff',
              fontSize: 'var(--fs-sm)',
              fontWeight: 600,
              boxShadow: '0 18px 40px -22px rgba(var(--accent-glow), 0.7)',
            }}
          >
            Generate one
            <ArrowRight size={15} strokeWidth={1.9} />
          </Link>
        </div>
      </motion.section>
    );
  }

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: easeOut }}
      style={{ width: 'min(100%, 920px)', margin: '26px auto 0' }}
      aria-label="Strategy search results"
    >
      <div
        className="liquid-glass-panel"
        style={{
          padding: '12px',
          borderRadius: '30px',
          background: `
            linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.04) 18%, transparent 48%),
            linear-gradient(130deg, rgba(var(--accent-glow), 0.10) 0%, transparent 36%, rgba(127,183,154,0.08) 100%),
            var(--landing-surface)
          `,
          border: '1px solid var(--landing-border)',
          borderTopColor: 'var(--landing-border-strong)',
          boxShadow: `
            inset 0 1px 0 0 rgba(255,255,255,0.22),
            inset 0 -1px 0 0 var(--landing-glass-lowlight),
            0 38px 90px -56px var(--landing-glass-shadow)
          `,
        }}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
          event.preventDefault();

          const nextIndex = event.key === 'ArrowDown'
            ? Math.min(clampedActiveIndex + 1, results.length - 1)
            : Math.max(clampedActiveIndex - 1, 0);

          setActiveIndex(nextIndex);
          buttonRefs.current[nextIndex]?.focus();
        }}
      >
        <div
          style={{
            padding: '10px 14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            color: 'var(--text-secondary)',
            fontSize: 'var(--fs-sm)',
          }}
        >
          <span>{hasQuery ? 'Ranked by fit, proof, and live reputation' : 'Featured families with public execution evidence'}</span>
          <span style={{ color: 'var(--text-tertiary)' }}>Arrow keys move through results</span>
        </div>

        <div style={{ display: 'grid', gap: '10px' }}>
          <AnimatePresence initial={false}>
            {results.map((strategy, index) => (
              <motion.button
                key={strategy.familyId}
                ref={(node) => {
                  buttonRefs.current[index] = node;
                }}
                layout
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: easeOut }}
                type="button"
                onClick={() => onOpen(strategy.familyId)}
                onFocus={() => setActiveIndex(index)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '18px',
                  borderRadius: '24px',
                  border: clampedActiveIndex === index
                    ? '1px solid rgba(var(--accent-glow), 0.52)'
                    : '1px solid rgba(255,255,255,0.08)',
                  background: clampedActiveIndex === index
                    ? `
                      linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) 22%, transparent 54%),
                      linear-gradient(130deg, rgba(var(--accent-glow), 0.12) 0%, transparent 48%, rgba(227,169,74,0.06) 100%),
                      var(--landing-surface-strong)
                    `
                    : `
                      linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 24%, transparent 52%),
                      var(--landing-surface-soft)
                    `,
                  color: 'inherit',
                  cursor: 'pointer',
                  boxShadow: clampedActiveIndex === index
                    ? '0 24px 42px -30px rgba(var(--accent-glow), 0.36)'
                    : 'inset 0 1px 0 0 rgba(255,255,255,0.1)',
                  transition: 'border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '20px' }}>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-display)',
                        fontSize: 'clamp(23px, 2.3vw, 30px)',
                        lineHeight: 1.02,
                        letterSpacing: '-0.03em',
                      }}
                    >
                      {strategy.name}
                    </div>

                    <p
                      style={{
                        marginTop: '10px',
                        maxWidth: '62ch',
                        color: 'var(--text-secondary)',
                        fontSize: 'var(--fs-base)',
                      }}
                    >
                      {strategy.thesis}
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <LifecyclePill lifecycle={strategy.lifecycle} />
                    <RunPill runs={strategy.verifiedRuns} emphasize={strategy.reputationScore >= 90} />
                  </div>
                </div>

                <div style={{ marginTop: '16px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '18px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'grid', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
                      <span
                        className="tabular-nums"
                        style={{
                          color: 'var(--ok-500)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 'clamp(26px, 2.8vw, 34px)',
                          letterSpacing: '-0.04em',
                        }}
                      >
                        {strategy.averageYieldPct.toFixed(1)}%
                      </span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>
                        avg yield · target {(strategy.targetYieldBps / 100).toFixed(1)}%
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {strategy.protocols.map((protocol) => (
                        <TokenPill key={protocol} label={protocol} icon={<ShieldCheck size={13} strokeWidth={1.9} />} />
                      ))}
                      {strategy.chains.map((chain) => (
                        <TokenPill key={chain} label={chain} icon={<Network size={13} strokeWidth={1.9} />} subtle />
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'grid', justifyItems: 'end', gap: '8px', minWidth: '156px' }}>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)' }}>{strategy.updatedAtLabel}</div>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '10px',
                        color: 'var(--text-primary)',
                        fontSize: 'var(--fs-sm)',
                        fontWeight: 600,
                      }}
                    >
                      Review strategy
                      <ArrowRight size={16} strokeWidth={2} />
                    </div>
                  </div>
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </motion.section>
  );
}

function LifecyclePill({ lifecycle }: { lifecycle: StrategySearchRecord['lifecycle'] }) {
  const tone = lifecycle === 'live'
    ? { bg: 'rgba(127,183,154,0.14)', color: 'var(--ok-500)', label: 'live' }
    : lifecycle === 'draft'
      ? { bg: 'rgba(227,169,74,0.14)', color: 'var(--attest-500)', label: 'draft' }
      : { bg: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)', label: 'deprecated' };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: '32px',
        padding: '0 12px',
        borderRadius: '999px',
        background: tone.bg,
        color: tone.color,
        border: '1px solid rgba(255,255,255,0.08)',
        fontSize: 'var(--fs-sm)',
        fontWeight: 600,
        textTransform: 'lowercase',
      }}
    >
      {tone.label}
    </span>
  );
}

function RunPill({ runs, emphasize }: { runs: number; emphasize: boolean }) {
  return (
    <span
      className={emphasize ? 'reputation-ripple' : undefined}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        height: '32px',
        padding: '0 12px',
        borderRadius: '999px',
        background: 'rgba(var(--accent-glow), 0.14)',
        color: 'var(--accent-200)',
        border: '1px solid rgba(var(--accent-glow), 0.24)',
        fontSize: 'var(--fs-sm)',
        fontWeight: 600,
      }}
    >
      <Clock3 size={13} strokeWidth={1.8} />
      <span className="tabular-nums">{runs} runs</span>
    </span>
  );
}

function TokenPill({
  label,
  icon,
  subtle = false,
}: {
  label: string;
  icon: ReactNode;
  subtle?: boolean;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        height: '30px',
        padding: '0 12px',
        borderRadius: '999px',
        background: subtle ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.10)',
        border: '1px solid rgba(255,255,255,0.08)',
        color: subtle ? 'var(--text-secondary)' : 'var(--text-primary)',
        fontSize: 'var(--fs-sm)',
      }}
    >
      {icon}
      {label}
    </span>
  );
}
