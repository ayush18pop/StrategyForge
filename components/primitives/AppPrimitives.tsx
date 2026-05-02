import type { CSSProperties, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';

const easeOut = [0.22, 1, 0.36, 1] as const;

export function PageIntro({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: easeOut }}
      style={{
        display: 'grid',
        gap: '18px',
        padding: '28px',
        borderRadius: '32px',
        background: `
          linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) 18%, transparent 48%),
          linear-gradient(130deg, rgba(var(--accent-glow), 0.14) 0%, transparent 42%, rgba(227,169,74,0.07) 100%),
          var(--landing-surface)
        `,
        border: '1px solid var(--landing-border)',
        borderTopColor: 'var(--landing-border-strong)',
        boxShadow: `
          inset 0 1px 0 0 rgba(255,255,255,0.22),
          inset 0 -1px 0 0 var(--landing-glass-lowlight),
          0 34px 80px -52px var(--landing-glass-shadow)
        `,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: '12px', maxWidth: '760px' }}>
          <span className="eyebrow">{eyebrow}</span>
          <h1
            style={{
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(36px, 5vw, 64px)',
              lineHeight: 0.95,
              letterSpacing: '-0.045em',
            }}
          >
            {title}
          </h1>
          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: 'var(--fs-md)',
              maxWidth: '56ch',
            }}
          >
            {description}
          </p>
        </div>

        {actions ? <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>{actions}</div> : null}
      </div>
    </motion.section>
  );
}

export function StatCard({
  label,
  value,
  tone = 'accent',
  meta,
}: {
  label: string;
  value: string;
  tone?: 'accent' | 'ok' | 'attest' | 'default';
  meta?: string;
}) {
  const tones: Record<NonNullable<typeof tone>, CSSProperties> = {
    accent: { color: 'var(--accent-200)', boxShadow: '0 18px 40px -30px rgba(var(--accent-glow), 0.42)' },
    ok: { color: 'var(--ok-500)', boxShadow: '0 18px 40px -30px rgba(127,183,154,0.34)' },
    attest: { color: 'var(--attest-500)', boxShadow: '0 18px 40px -30px rgba(227,169,74,0.3)' },
    default: { color: 'var(--text-primary)', boxShadow: 'none' },
  };

  return (
    <div className="glass-card" style={{ padding: '20px', display: 'grid', gap: '12px' }}>
      <span className="eyebrow">{label}</span>
      <div className="tabular-nums" style={{ fontFamily: 'var(--font-mono)', fontSize: 'clamp(24px, 3vw, 34px)', ...tones[tone] }}>
        {value}
      </div>
      {meta ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>
          {meta}
        </p>
      ) : null}
    </div>
  );
}

export function SectionCard({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children: ReactNode;
}) {
  return (
    <section className="glass-card" style={{ padding: '22px', display: 'grid', gap: '18px' }}>
      <div style={{ display: 'grid', gap: '6px' }}>
        <h2 style={{ color: 'var(--text-primary)', fontSize: 'var(--fs-lg)', letterSpacing: '-0.02em' }}>{title}</h2>
        {caption ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>{caption}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'accent' | 'ok' | 'attest' | 'warn' }) {
  const palette: Record<NonNullable<typeof tone>, CSSProperties> = {
    default: { background: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)' },
    accent: { background: 'rgba(var(--accent-glow), 0.16)', color: 'var(--accent-200)' },
    ok: { background: 'rgba(127,183,154,0.16)', color: 'var(--ok-500)' },
    attest: { background: 'rgba(227,169,74,0.16)', color: 'var(--attest-500)' },
    warn: { background: 'rgba(224,122,106,0.16)', color: 'var(--warn-500)' },
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        minHeight: '32px',
        padding: '6px 12px',
        borderRadius: '999px',
        border: '1px solid rgba(255,255,255,0.08)',
        fontSize: 'var(--fs-sm)',
        fontWeight: 600,
        ...palette[tone],
      }}
    >
      {children}
    </span>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="primary-button"
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  disabled,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="ghost-button"
    >
      {children}
    </button>
  );
}

export function HashRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'grid', gap: '8px' }}>
      <span className="eyebrow">{label}</span>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          toast.success('Copied to clipboard');
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          width: '100%',
          padding: '12px 14px',
          borderRadius: '18px',
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.05)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--fs-sm)',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
        <Copy size={15} strokeWidth={1.8} />
      </button>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="glass-card" style={{ padding: '28px', display: 'grid', gap: '12px', textAlign: 'center' }}>
      <h2 style={{ color: 'var(--text-primary)', fontSize: 'var(--fs-xl)', letterSpacing: '-0.03em' }}>{title}</h2>
      <p style={{ color: 'var(--text-secondary)', maxWidth: '44ch', margin: '0 auto' }}>{description}</p>
      {action ? <div style={{ display: 'flex', justifyContent: 'center' }}>{action}</div> : null}
    </div>
  );
}

export function LoadingBlock({ label }: { label: string }) {
  return (
    <div className="glass-card" style={{ padding: '28px', color: 'var(--text-secondary)' }}>
      {label}
    </div>
  );
}
