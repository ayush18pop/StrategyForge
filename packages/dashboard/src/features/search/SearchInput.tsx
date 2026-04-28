import { motion } from 'framer-motion';
import { ArrowRight, Search, Sparkles } from 'lucide-react';
import type { SearchChip } from './types';

interface SearchInputProps {
  value: string;
  onValueChange: (value: string) => void;
  chips: SearchChip[];
  confidence: number;
  note?: string;
  example: string;
  resultCount: number;
}

const easeOut = [0.22, 1, 0.36, 1] as const;

const CHIP_TONES: Record<SearchChip['kind'], { bg: string; color: string }> = {
  amount: { bg: 'rgba(var(--accent-glow), 0.16)', color: 'var(--accent-200)' },
  asset: { bg: 'rgba(227,169,74,0.14)', color: 'var(--attest-500)' },
  risk: { bg: 'rgba(127,183,154,0.16)', color: 'var(--ok-500)' },
  horizon: { bg: 'rgba(255,255,255,0.08)', color: 'var(--text-primary)' },
  chain: { bg: 'rgba(255,255,255,0.08)', color: 'var(--text-primary)' },
  target: { bg: 'rgba(208,84,74,0.16)', color: 'var(--warn-500)' },
};

export function SearchInput({
  value,
  onValueChange,
  chips,
  confidence,
  note,
  example,
  resultCount,
}: SearchInputProps) {
  return (
    <div style={{ width: 'min(100%, 760px)', margin: '0 auto' }}>
      <label
        htmlFor="strategy-search"
        style={{
          display: 'block',
          marginBottom: '12px',
          color: 'var(--text-tertiary)',
          fontSize: 'var(--fs-xs)',
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        Describe your goal
      </label>

      <div
        className="liquid-glass-panel"
        style={{
          position: 'relative',
          minHeight: '72px',
          padding: '10px 12px 10px 18px',
          borderRadius: '26px',
          background: `
            linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.03) 22%, transparent 52%),
            linear-gradient(130deg, rgba(var(--accent-glow), 0.16) 0%, transparent 36%, rgba(227,169,74,0.06) 100%),
            var(--landing-surface)
          `,
          border: '1px solid var(--landing-border)',
          borderTopColor: 'var(--landing-border-strong)',
          boxShadow: `
            inset 0 1px 0 0 rgba(255,255,255,0.22),
            inset 0 -1px 0 0 var(--landing-glass-lowlight),
            0 30px 70px -42px var(--landing-glass-shadow)
          `,
          backdropFilter: 'blur(34px) saturate(190%) brightness(1.03)',
          WebkitBackdropFilter: 'blur(34px) saturate(190%) brightness(1.03)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            aria-hidden="true"
            style={{
              width: '42px',
              height: '42px',
              display: 'grid',
              placeItems: 'center',
              borderRadius: '50%',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 100%)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'var(--accent-200)',
              flexShrink: 0,
            }}
          >
            <Search size={18} strokeWidth={1.7} />
          </div>

          <input
            id="strategy-search"
            type="text"
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            placeholder="$50K USDC, medium risk, 6 months, Ethereum"
            aria-describedby="strategy-search-hint strategy-search-meta"
            style={{
              flex: 1,
              minWidth: 0,
              height: '52px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-primary)',
              fontSize: 'clamp(18px, 1.8vw, 22px)',
              letterSpacing: '-0.03em',
              outline: 'none',
            }}
          />

          <button
            type="button"
            onClick={() => onValueChange(example)}
            style={{
              height: '46px',
              padding: '0 16px',
              borderRadius: '999px',
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.11) 0%, rgba(255,255,255,0.03) 100%)',
              color: 'var(--text-secondary)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <Sparkles size={15} strokeWidth={1.8} />
            <span style={{ whiteSpace: 'nowrap', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>Try example</span>
          </button>
        </div>

        <div
          style={{
            marginTop: '10px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            minHeight: chips.length > 0 ? '34px' : undefined,
          }}
        >
          {chips.map((chip) => {
            const tone = CHIP_TONES[chip.kind];
            return (
              <motion.span
                key={`${chip.kind}-${chip.label}`}
                layout
                initial={{ opacity: 0, y: 10, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.28, ease: easeOut }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  height: '30px',
                  padding: '0 12px',
                  borderRadius: '999px',
                  background: tone.bg,
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: tone.color,
                  fontSize: 'var(--fs-sm)',
                  fontWeight: 600,
                  backdropFilter: 'blur(14px) saturate(140%)',
                  WebkitBackdropFilter: 'blur(14px) saturate(140%)',
                }}
              >
                {chip.label}
              </motion.span>
            );
          })}
        </div>
      </div>

      <div
        id="strategy-search-meta"
        style={{
          marginTop: '12px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div id="strategy-search-hint" style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)' }}>
          <div
            aria-hidden="true"
            style={{
              width: '78px',
              height: '8px',
              borderRadius: '999px',
              background: 'rgba(255,255,255,0.08)',
              overflow: 'hidden',
            }}
          >
            <motion.div
              initial={false}
              animate={{
                width: `${Math.max(confidence * 100, value.trim().length > 0 ? 18 : 0)}%`,
              }}
              transition={{ duration: 0.35, ease: easeOut }}
              style={{
                height: '100%',
                borderRadius: '999px',
                background: confidence >= 0.75
                  ? 'linear-gradient(90deg, var(--ok-500), rgba(127,183,154,0.62))'
                  : 'linear-gradient(90deg, var(--attest-500), rgba(var(--accent-glow), 0.8))',
              }}
            />
          </div>
          <span style={{ fontSize: 'var(--fs-sm)' }}>
            {note ?? 'Parsed confidently. Refine the sentence any time; results update live.'}
          </span>
        </div>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--text-tertiary)',
            fontSize: 'var(--fs-sm)',
          }}
        >
          <span>{resultCount} proven match{resultCount === 1 ? '' : 'es'}</span>
          <ArrowRight size={14} strokeWidth={1.8} />
        </div>
      </div>
    </div>
  );
}
