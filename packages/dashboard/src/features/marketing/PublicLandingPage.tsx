import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import { ArrowRight, Brain, Check, ChevronRight, Copy, ExternalLink, Shield, TrendingUp } from 'lucide-react';

const easeOut = [0.22, 1, 0.36, 1] as const;

const HERO_METRICS = [
  {
    target: 247_382,
    format: (value: number) => `$${value.toLocaleString()}`,
    label: 'capital evaluated through auditable workflows',
  },
  {
    target: 84,
    format: (value: number) => value.toLocaleString(),
    label: 'outcomes posted for public inspection',
  },
  {
    target: 3,
    format: (value: number) => value.toString(),
    label: 'trust questions answered by every strategy',
  },
];

const TRUST_PILLS = [
  { icon: <Brain size={14} color="var(--accent-400)" />, label: 'Verifiable reasoning' },
  { icon: <Shield size={14} color="var(--ok-500)" />, label: 'On-chain reputation' },
  { icon: <TrendingUp size={14} color="var(--attest-500)" />, label: 'Evolving memory' },
];

const PRINCIPLES = [
  {
    eyebrow: 'Trust question 01',
    title: 'Was this strategy reasoned about?',
    description:
      'A TEE attestation hash is emitted for each critical reasoning step, so anyone can verify the strategy was actually reasoned through instead of randomly generated.',
  },
  {
    eyebrow: 'Trust question 02',
    title: 'Has it ever worked?',
    description:
      'ReputationLedger records outcomes on-chain after every run, turning performance from a promise into an inspectable public record.',
  },
  {
    eyebrow: 'Trust question 03',
    title: 'Is v3 smarter than v1?',
    description:
      'A priorCid DAG links versions in 0G Storage, proving the latest version loaded earlier failures before it went live.',
  },
];

const PIPELINE_STEPS = [
  { n: '01', label: 'Universe filter', tag: 'Deterministic', desc: 'Only audited protocols and approved venues enter the candidate set.' },
  { n: '02', label: 'Kelly priors', tag: 'Deterministic', desc: 'Probability, risk, and prior critic updates are computed before models speak.' },
  { n: '03', label: 'Researcher', tag: 'TEE', desc: 'Regime context and protocol signals are gathered inside an attested sealed run.' },
  { n: '04', label: 'Strategist', tag: 'TEE', desc: 'Candidate allocations are proposed against deterministic portfolio constraints.' },
  { n: '05', label: 'VaR check', tag: 'Deterministic', desc: 'Candidates that exceed the user’s loss tolerance are rejected outright.' },
  { n: '06', label: 'Critic', tag: 'TEE', desc: 'The strongest surviving candidate is stress-tested using retained failure memory.' },
  { n: '07', label: 'Compiler', tag: 'Workflow', desc: 'The allocation is mapped into KeeperHub-native workflow JSON with execution details.' },
  { n: '08', label: 'Risk validator', tag: 'Deterministic', desc: 'Hard rules reject unsafe specs before anything can be deployed.' },
  { n: '09', label: 'Deploy', tag: 'Ledger', desc: 'Evidence goes to 0G Storage, trust records go on-chain, and KeeperHub receives the workflow.' },
];

const PROOF_ITEMS = [
  { title: 'Researcher attestation', hash: '0x7f8a3c2b1d4e9f6a...2d4e', meta: 'Step 3 · 0G Compute TEE' },
  { title: 'Strategist attestation', hash: '0xb3c1a9f28e4d1c7b...9f2a', meta: 'Step 4 · 0G Compute TEE' },
  { title: 'Critic attestation', hash: '0xc4d2e1f89a3b2c1d...1e8b', meta: 'Step 6 · 0G Compute TEE' },
  { title: 'Evidence bundle CID', hash: '0xghi789b3c1a94d2e...3c2d', meta: '0G Storage · immutable archive' },
];

const VERSIONS = [
  {
    v: 'v1',
    status: 'Deprecated',
    yield: '4.1%',
    runs: 5,
    note: 'Initial release. It could execute, but it carried no priorCid memory from earlier failures.',
    cid: '0xabc123...',
  },
  {
    v: 'v2',
    status: 'Deprecated',
    yield: '7.1%',
    runs: 14,
    note: 'Derived from v1 after the first failure pattern was recorded and loaded into the next run.',
    cid: '0xdef456...',
  },
  {
    v: 'v3',
    status: 'Live',
    yield: '8.4%',
    runs: 28,
    note: 'Current live version. It proves it loaded the earlier chain before proposing a new allocation.',
    cid: '0xghi789...',
  },
];

const ALLOCATIONS = [
  { label: 'Morpho Blue', value: 34, color: 'var(--accent-500)' },
  { label: 'Spark', value: 30, color: 'var(--attest-500)' },
  { label: 'Aave', value: 36, color: 'var(--ok-500)' },
];

const sectionWidth: CSSProperties = {
  maxWidth: '1180px',
  margin: '0 auto',
  paddingInline: 'clamp(20px, 4vw, 48px)',
};

function buildPanelStyle(overrides: CSSProperties = {}): CSSProperties {
  return {
    position: 'relative',
    overflow: 'hidden',
    isolation: 'isolate',
    background: `
      linear-gradient(180deg, var(--landing-glass-highlight) 0%, var(--landing-glass-sheen) 12%, transparent 34%),
      linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 38%, rgba(255,255,255,0.03) 72%, var(--landing-glass-underline) 100%),
      linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%),
      var(--landing-surface)
    `,
    border: '1px solid var(--landing-border)',
    borderTopColor: 'var(--landing-border-strong)',
    borderRadius: '28px',
    boxShadow: `
      inset 0 1px 0 0 var(--landing-glass-highlight),
      inset 0 -18px 28px -26px var(--landing-glass-sheen),
      inset 0 -1px 0 0 var(--landing-glass-lowlight),
      0 30px 80px -40px var(--landing-glass-shadow),
      0 10px 24px -18px rgba(var(--accent-glow), 0.22)
    `,
    backdropFilter: 'blur(34px) saturate(185%) brightness(1.03)',
    WebkitBackdropFilter: 'blur(34px) saturate(185%) brightness(1.03)',
    ...overrides,
  };
}

function buildSoftPanelStyle(overrides: CSSProperties = {}): CSSProperties {
  return {
    position: 'relative',
    overflow: 'hidden',
    isolation: 'isolate',
    background: `
      linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 18%, transparent 42%),
      linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 54%, rgba(255,255,255,0.03) 100%),
      var(--landing-surface-soft)
    `,
    border: '1px solid var(--landing-border)',
    borderTopColor: 'var(--landing-border-strong)',
    borderRadius: '22px',
    boxShadow: `
      inset 0 1px 0 0 rgba(255,255,255,0.16),
      inset 0 -1px 0 0 var(--landing-glass-lowlight),
      0 18px 44px -34px var(--landing-glass-shadow)
    `,
    backdropFilter: 'blur(24px) saturate(175%) brightness(1.02)',
    WebkitBackdropFilter: 'blur(24px) saturate(175%) brightness(1.02)',
    ...overrides,
  };
}

function Counter({ target, format }: { target: number; format: (value: number) => string }) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });

  useEffect(() => {
    if (!inView) return;

    const duration = 1400;
    const startedAt = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(eased * target));

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        setValue(target);
      }
    };

    requestAnimationFrame(tick);
  }, [inView, target]);

  return <span ref={ref}>{format(value)}</span>;
}

function SectionDivider() {
  return (
    <div style={{ ...sectionWidth, paddingBlock: 0 }}>
      <div
        style={{
          height: '1px',
          background: 'linear-gradient(90deg, transparent 0%, var(--landing-divider) 18%, var(--landing-divider) 82%, transparent 100%)',
        }}
      />
    </div>
  );
}

function SectionAura({
  top,
  right,
  bottom,
  left,
  width,
  height,
  color,
  blur = 90,
  opacity = 1,
}: {
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  width: string;
  height: string;
  color: string;
  blur?: number;
  opacity?: number;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top,
        right,
        bottom,
        left,
        width,
        height,
        borderRadius: '50%',
        background: color,
        filter: `blur(${blur}px)`,
        opacity,
        pointerEvents: 'none',
      }}
    />
  );
}

function FloatingOrb({
  top,
  right,
  bottom,
  left,
  width,
  height,
  color,
  blur = 140,
  opacity = 1,
  duration = 24,
  driftX = [0, 24, -18, 0],
  driftY = [0, -18, 12, 0],
  scale = [1, 1.04, 0.98, 1],
}: {
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  width: string;
  height: string;
  color: string;
  blur?: number;
  opacity?: number;
  duration?: number;
  driftX?: number[];
  driftY?: number[];
  scale?: number[];
}) {
  return (
    <motion.div
      animate={{ x: driftX, y: driftY, scale }}
      transition={{ duration, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
      style={{
        position: 'fixed',
        top,
        right,
        bottom,
        left,
        zIndex: -1,
        width,
        height,
        borderRadius: '50%',
        background: color,
        filter: `blur(${blur}px)`,
        opacity,
        pointerEvents: 'none',
      }}
    />
  );
}

function BackgroundScene() {
  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: -2,
          background: 'linear-gradient(180deg, var(--landing-page-bg-elevated) 0%, var(--landing-page-bg) 38%, var(--landing-page-bg-deep) 100%)',
        }}
      />

      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: -1,
          pointerEvents: 'none',
          background: `
            radial-gradient(76rem 44rem at 16% 12%, var(--landing-highlight) 0%, transparent 68%),
            radial-gradient(44rem 28rem at 28% 46%, rgba(86,202,255,0.16) 0%, transparent 72%),
            radial-gradient(42rem 26rem at 74% 24%, rgba(255,255,255,0.07) 0%, transparent 72%),
            radial-gradient(54rem 34rem at 80% 44%, var(--landing-highlight-cool) 0%, transparent 68%),
            radial-gradient(42rem 28rem at 78% 84%, var(--landing-highlight-warm) 0%, transparent 72%),
            radial-gradient(60rem 34rem at 46% 120%, var(--landing-highlight-sage) 0%, transparent 72%),
            linear-gradient(180deg, rgba(255,255,255,0.11) 0%, transparent 16%),
            linear-gradient(135deg, var(--landing-page-bg-elevated) 0%, rgba(8,17,27,0.88) 42%, var(--landing-page-bg-deep) 100%)
          `,
        }}
      />

      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: -1,
          pointerEvents: 'none',
          opacity: 0.92,
          backgroundImage: `
            repeating-radial-gradient(circle at 18% 22%, var(--landing-contour) 0 1.5px, transparent 1.5px 48px),
            repeating-radial-gradient(circle at 76% 34%, rgba(255,255,255,0.045) 0 1px, transparent 1px 44px),
            repeating-linear-gradient(90deg, transparent 0 112px, var(--landing-grid-strong) 112px 113px),
            linear-gradient(180deg, var(--landing-hero-core) 0%, transparent 26%, transparent 100%)
          `,
          maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.98) 0%, rgba(0,0,0,0.86) 56%, rgba(0,0,0,0.34) 100%)',
          WebkitMaskImage: 'linear-gradient(180deg, rgba(0,0,0,0.98) 0%, rgba(0,0,0,0.86) 56%, rgba(0,0,0,0.34) 100%)',
        }}
      />

      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: -1,
          pointerEvents: 'none',
          opacity: 0.74,
          backgroundImage: `
            repeating-linear-gradient(90deg, transparent 0 84px, var(--landing-grid) 84px 85px),
            repeating-linear-gradient(180deg, transparent 0 84px, rgba(255,255,255,0.018) 84px 85px)
          `,
          maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.56) 44%, rgba(0,0,0,0.18) 100%)',
          WebkitMaskImage: 'linear-gradient(180deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.56) 44%, rgba(0,0,0,0.18) 100%)',
        }}
      />

      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: -1,
          pointerEvents: 'none',
          opacity: 0.92,
          background: `
            linear-gradient(112deg, transparent 10%, var(--landing-beam) 34%, transparent 56%),
            linear-gradient(194deg, transparent 0%, rgba(255,255,255,0.075) 26%, transparent 46%),
            radial-gradient(34rem 12rem at 36% 8%, rgba(255,255,255,0.11) 0%, transparent 72%)
          `,
          filter: 'blur(42px)',
          transform: 'scale(1.08) rotate(-4deg)',
        }}
      />

      <FloatingOrb top="-20%" left="-14%" width="66rem" height="66rem" color="var(--landing-highlight)" blur={210} opacity={1} duration={28} driftX={[0, 42, -26, 0]} driftY={[0, 22, -18, 0]} />
      <FloatingOrb top="-14%" right="-8%" width="50rem" height="50rem" color="var(--landing-highlight-cool)" blur={180} opacity={0.88} duration={26} driftX={[0, -28, 18, 0]} driftY={[0, 16, -20, 0]} scale={[1, 1.06, 0.99, 1]} />
      <FloatingOrb top="22%" left="10%" width="38rem" height="24rem" color="rgba(255,255,255,0.10)" blur={130} opacity={0.84} duration={24} driftX={[0, 24, -14, 0]} driftY={[0, -18, 10, 0]} scale={[1, 1.04, 0.97, 1]} />
      <FloatingOrb top="34%" right="4%" width="40rem" height="34rem" color="var(--landing-highlight-warm)" blur={160} opacity={0.68} duration={22} driftX={[0, 20, -14, 0]} driftY={[0, -22, 12, 0]} scale={[1, 1.05, 0.96, 1]} />
      <FloatingOrb bottom="-14%" left="0%" width="42rem" height="34rem" color="var(--landing-highlight-sage)" blur={165} opacity={0.58} duration={30} driftX={[0, 18, -24, 0]} driftY={[0, -12, 18, 0]} scale={[1, 1.03, 0.97, 1]} />

      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: -1,
          pointerEvents: 'none',
          background: `
            radial-gradient(circle at 50% -8%, transparent 0%, transparent 42%, var(--landing-vignette) 100%),
            linear-gradient(90deg, rgba(0,0,0,0.20) 0%, transparent 12%, transparent 88%, rgba(0,0,0,0.28) 100%),
            linear-gradient(180deg, rgba(0,0,0,0.10) 0%, transparent 18%, transparent 84%, rgba(0,0,0,0.18) 100%)
          `,
        }}
      />
    </>
  );
}

function HeroStageBackdrop() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: '-8% 0 -16%',
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: '0',
          background: `
            radial-gradient(58rem 32rem at 18% 24%, rgba(var(--accent-glow),0.26) 0%, transparent 70%),
            radial-gradient(36rem 22rem at 28% 58%, rgba(86,202,255,0.16) 0%, transparent 68%),
            radial-gradient(42rem 24rem at 78% 32%, rgba(255,255,255,0.07) 0%, transparent 72%),
            radial-gradient(46rem 26rem at 78% 44%, rgba(86,202,255,0.15) 0%, transparent 68%),
            radial-gradient(34rem 18rem at 76% 84%, rgba(227,169,74,0.13) 0%, transparent 72%),
            linear-gradient(180deg, rgba(255,255,255,0.07) 0%, transparent 18%, transparent 100%)
          `,
        }}
      />

      <div
        style={{
          position: 'absolute',
          inset: '4% 10% 12% 0%',
          opacity: 0.88,
          backgroundImage: `
            repeating-radial-gradient(circle at 18% 28%, rgba(255,255,255,0.09) 0 1.5px, transparent 1.5px 42px),
            repeating-radial-gradient(circle at 74% 38%, rgba(255,255,255,0.05) 0 1px, transparent 1px 40px)
          `,
          maskImage: 'linear-gradient(90deg, rgba(0,0,0,0.98) 0%, rgba(0,0,0,0.98) 76%, rgba(0,0,0,0.18) 100%)',
          WebkitMaskImage: 'linear-gradient(90deg, rgba(0,0,0,0.98) 0%, rgba(0,0,0,0.98) 76%, rgba(0,0,0,0.18) 100%)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          inset: '0 -12% 16% -10%',
          opacity: 0.9,
          background: `
            linear-gradient(110deg, transparent 8%, rgba(173,201,255,0.18) 34%, transparent 54%),
            linear-gradient(198deg, transparent 0%, rgba(255,255,255,0.08) 30%, transparent 50%)
          `,
          filter: 'blur(58px)',
          transform: 'rotate(-4deg)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          inset: '18% 8% 10% 6%',
          borderRadius: '64px',
          background: 'linear-gradient(135deg, rgba(18,28,43,0.28) 0%, rgba(10,14,21,0.06) 42%, rgba(14,20,30,0.18) 100%)',
          boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.08), 0 60px 140px -86px rgba(0,0,0,0.72)',
          opacity: 0.72,
        }}
      />
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  center = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  center?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.55, ease: easeOut }}
      style={{
        maxWidth: '720px',
        margin: center ? '0 auto 40px' : '0 0 40px',
        textAlign: center ? 'center' : 'left',
      }}
    >
      <p
        style={{
          marginBottom: '12px',
          color: 'var(--text-tertiary)',
          fontFamily: 'var(--font-apple-text)',
          fontSize: '12px',
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}
      >
        {eyebrow}
      </p>
      <h2
        style={{
          marginBottom: '16px',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-apple-display)',
          fontSize: 'clamp(34px, 5vw, 56px)',
          fontWeight: 600,
          letterSpacing: '-0.05em',
          lineHeight: 1.02,
        }}
      >
        {title}
      </h2>
      <p
        style={{
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-apple-text)',
          fontSize: 'clamp(17px, 2vw, 21px)',
          lineHeight: 1.55,
        }}
      >
        {description}
      </p>
    </motion.div>
  );
}

function HeroPreviewCard() {
  return (
    <div style={{ position: 'relative', minWidth: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: '14% 8% auto auto',
          width: '180px',
          height: '180px',
          borderRadius: '50%',
          background: 'var(--landing-highlight)',
          filter: 'blur(36px)',
          pointerEvents: 'none',
        }}
      />
      <div
        className="liquid-glass-panel"
        style={buildPanelStyle({
          padding: '22px',
          background: `
            linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.08) 14%, transparent 34%),
            linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 42%, rgba(255,255,255,0.03) 72%, var(--landing-glass-underline) 100%),
            var(--landing-surface-strong)
          `,
        })}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '18px' }}>
          <div>
            <p
              style={{
                color: 'var(--text-tertiary)',
                fontFamily: 'var(--font-apple-text)',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                marginBottom: '6px',
              }}
            >
              Marketplace trust report
            </p>
            <h3
              style={{
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-apple-display)',
                fontSize: '30px',
                fontWeight: 600,
                letterSpacing: '-0.04em',
                lineHeight: 1.05,
              }}
            >
              Conservative Yield v3
            </h3>
          </div>
            <div
              className="liquid-glass-soft"
              style={buildSoftPanelStyle({
                padding: '8px 12px',
                borderRadius: '999px',
                color: 'var(--ok-500)',
              fontFamily: 'var(--font-apple-text)',
              fontSize: '12px',
              fontWeight: 600,
            })}
          >
            Live
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '16px' }}>
          {[
            { label: 'Reasoning proof', value: '3 TEEs' },
            { label: 'Memory chain', value: 'v1→v3' },
          ].map(item => (
            <div key={item.label} className="liquid-glass-soft" style={buildSoftPanelStyle({ padding: '16px' })}>
              <p
                style={{
                  marginBottom: '8px',
                  color: 'var(--text-tertiary)',
                  fontFamily: 'var(--font-apple-text)',
                  fontSize: '12px',
                }}
              >
                {item.label}
              </p>
              <div
                style={{
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-apple-display)',
                  fontSize: '32px',
                  fontWeight: 600,
                  letterSpacing: '-0.04em',
                  lineHeight: 1,
                }}
              >
                {item.value}
              </div>
            </div>
          ))}
        </div>

        <div className="liquid-glass-soft" style={buildSoftPanelStyle({ padding: '18px', marginBottom: '16px' })}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <p style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-apple-text)', fontSize: '14px', fontWeight: 600 }}>
              Deployment snapshot
            </p>
            <span style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>3 protocol destinations</span>
          </div>

          <div style={{ display: 'grid', gap: '14px' }}>
            {ALLOCATIONS.map(item => (
              <div key={item.label}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-apple-text)', fontSize: '14px' }}>{item.label}</span>
                  <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{item.value}%</span>
                </div>
                <div style={{ height: '8px', borderRadius: '999px', background: 'rgba(127,127,127,0.12)', overflow: 'hidden' }}>
                  <div style={{ width: `${item.value}%`, height: '100%', borderRadius: '999px', background: item.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gap: '10px' }}>
          {[
            'Each critical reasoning step emits its own TEE attestation hash.',
            'ReputationLedger records outcomes after every live run.',
            'The priorCid chain proves what this version learned before launch.',
          ].map(line => (
            <div key={line} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <span
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  background: 'rgba(127,183,154,0.14)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '1px',
                }}
              >
                <Check size={11} color="var(--ok-500)" />
              </span>
              <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-apple-text)', fontSize: '14px', lineHeight: 1.45 }}>
                {line}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HeroSection() {
  const navigate = useNavigate();

  return (
    <section id="story" style={{ padding: 'clamp(44px, 8vw, 88px) 0 clamp(72px, 10vw, 112px)', position: 'relative', overflow: 'visible' }}>
      <HeroStageBackdrop />
      <SectionAura top="-10%" left="-6%" width="32rem" height="32rem" color="var(--landing-highlight)" blur={110} opacity={0.9} />
      <SectionAura top="14%" right="8%" width="26rem" height="26rem" color="var(--landing-highlight-cool)" blur={95} opacity={0.7} />
      <SectionAura bottom="-10%" right="16%" width="24rem" height="18rem" color="var(--landing-highlight-warm)" blur={110} opacity={0.6} />

      <div style={{ ...sectionWidth, position: 'relative', zIndex: 1 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 'clamp(28px, 5vw, 64px)',
            alignItems: 'center',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: easeOut }}
              style={{
                marginBottom: '18px',
                color: 'var(--text-tertiary)',
                fontFamily: 'var(--font-apple-text)',
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '0.13em',
                textTransform: 'uppercase',
              }}
            >
              Trust layer for KeeperHub’s strategy marketplace
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, ease: easeOut, delay: 0.06 }}
              style={{
                marginBottom: '22px',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-apple-display)',
                fontSize: 'clamp(42px, 7.2vw, 78px)',
                fontWeight: 600,
                letterSpacing: '-0.055em',
                lineHeight: 0.96,
                maxWidth: '12.8ch',
              }}
            >
              <span style={{ display: 'block' }}>KeeperHub has</span>
              <span style={{ display: 'block' }}>a marketplace.</span>
              <span style={{ display: 'block', color: 'rgba(255,255,255,0.92)' }}>StrategyForge</span>
              <span style={{ display: 'block' }}>makes it trustworthy.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: easeOut, delay: 0.14 }}
              style={{
                maxWidth: '660px',
                marginBottom: '30px',
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-apple-text)',
                fontSize: 'clamp(18px, 2.4vw, 23px)',
                lineHeight: 1.55,
              }}
            >
              We add verifiable reasoning, on-chain reputation, and evolving memory so any agent can inspect why a strategy exists, whether it has worked, and whether the latest version actually learned.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: easeOut, delay: 0.24 }}
              style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', marginBottom: '28px' }}
            >
              <motion.button
                type="button"
                whileHover={{ y: -2, scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                transition={{ duration: 0.18 }}
                onClick={() => navigate('/app')}
                style={{
                  height: '52px',
                  padding: '0 24px',
                  border: 'none',
                  borderRadius: '999px',
                  background: 'var(--accent-500)',
                  color: '#fff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontFamily: 'var(--font-apple-text)',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 18px 44px -24px rgba(var(--accent-glow), 0.85)',
                }}
              >
                Enter App
                <ArrowRight size={16} />
              </motion.button>

              <motion.a
                href="#architecture"
                whileHover={{ y: -2 }}
                transition={{ duration: 0.18 }}
                style={{
                  height: '52px',
                  padding: '0 22px',
                  borderRadius: '999px',
                  border: '1px solid var(--landing-border)',
                  background: `
                    linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 18%, transparent 42%),
                    var(--landing-surface)
                  `,
                  color: 'var(--text-primary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontFamily: 'var(--font-apple-text)',
                  fontSize: '15px',
                  fontWeight: 600,
                  boxShadow: 'var(--landing-shadow)',
                }}
              >
                See the trust layer
                <ChevronRight size={16} />
              </motion.a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: easeOut, delay: 0.3 }}
              style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}
            >
              {TRUST_PILLS.map(item => (
                <div
                  className="liquid-glass-soft"
                  key={item.label}
                  style={buildSoftPanelStyle({
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 14px',
                    borderRadius: '999px',
                    color: 'var(--text-secondary)',
                    fontFamily: 'var(--font-apple-text)',
                    fontSize: '13px',
                    fontWeight: 600,
                  })}
                >
                  {item.icon}
                  {item.label}
                </div>
              ))}
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.75, ease: easeOut, delay: 0.1 }}
            style={{ minWidth: 0 }}
          >
            <HeroPreviewCard />
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: easeOut, delay: 0.38 }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            marginTop: 'clamp(32px, 5vw, 52px)',
          }}
        >
          {HERO_METRICS.map(item => (
            <div key={item.label} className="liquid-glass-panel" style={buildPanelStyle({ padding: '22px 24px' })}>
              <div
                style={{
                  marginBottom: '8px',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-apple-display)',
                  fontSize: 'clamp(28px, 3vw, 38px)',
                  fontWeight: 600,
                  letterSpacing: '-0.05em',
                  lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <Counter target={item.target} format={item.format} />
              </div>
              <p style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-apple-text)', fontSize: '14px', lineHeight: 1.5 }}>
                {item.label}
              </p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function PrinciplesSection() {
  return (
    <section style={{ padding: 'clamp(72px, 10vw, 112px) 0', position: 'relative', overflow: 'visible' }}>
      <SectionAura top="10%" left="8%" width="24rem" height="20rem" color="var(--landing-highlight-cool)" blur={110} opacity={0.45} />
      <SectionAura bottom="-6%" right="10%" width="28rem" height="18rem" color="var(--landing-highlight)" blur={120} opacity={0.42} />
      <div style={{ ...sectionWidth, position: 'relative', zIndex: 1 }}>
        <SectionHeading
          eyebrow="The three trust questions"
          title="This is what StrategyForge proves."
          description="Without StrategyForge, a marketplace user has to trust a story. With StrategyForge, any agent can verify the reasoning, the track record, and the learning history."
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '18px' }}>
          {PRINCIPLES.map((principle, index) => (
            <motion.div
              key={principle.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.5, ease: easeOut, delay: index * 0.05 }}
              className="liquid-glass-panel"
              style={buildPanelStyle({ padding: '24px', minHeight: '100%' })}
            >
              <p
                style={{
                  marginBottom: '14px',
                  color: 'var(--accent-400)',
                  fontFamily: 'var(--font-apple-text)',
                  fontSize: '12px',
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                {principle.eyebrow}
              </p>
              <h3
                style={{
                  marginBottom: '12px',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-apple-display)',
                  fontSize: '28px',
                  fontWeight: 600,
                  letterSpacing: '-0.04em',
                  lineHeight: 1.08,
                }}
              >
                {principle.title}
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-apple-text)', fontSize: '15px', lineHeight: 1.6 }}>
                {principle.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ArchitectureSection() {
  return (
    <section id="architecture" style={{ padding: 'clamp(72px, 10vw, 112px) 0', position: 'relative', overflow: 'visible' }}>
      <SectionAura top="-2%" right="6%" width="34rem" height="22rem" color="var(--landing-highlight-cool)" blur={120} opacity={0.45} />
      <SectionAura bottom="8%" left="-8%" width="26rem" height="22rem" color="var(--landing-highlight-warm)" blur={120} opacity={0.35} />
      <div style={{ ...sectionWidth, position: 'relative', zIndex: 1 }}>
        <SectionHeading
          eyebrow="What KeeperHub has. What we add."
          title="KeeperHub already executes strategies. We make them discoverable, legible, and believable."
          description="We do not rebuild workflow creation, pricing, or execution. StrategyForge adds the trust infrastructure around them: on-chain discovery, verifiable reasoning, reputation, and versioned memory."
        />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '20px',
            alignItems: 'start',
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.55, ease: easeOut }}
            className="liquid-glass-panel"
            style={buildPanelStyle({ padding: '28px', minHeight: '100%' })}
          >
            <p
              style={{
                marginBottom: '10px',
                color: 'var(--text-tertiary)',
                fontFamily: 'var(--font-apple-text)',
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
              }}
            >
              Trust layer
            </p>
            <h3
              style={{
                marginBottom: '14px',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-apple-display)',
                fontSize: '34px',
                fontWeight: 600,
                letterSpacing: '-0.05em',
                lineHeight: 1.04,
              }}
            >
              Execution already exists. Trust infrastructure does not.
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-apple-text)', fontSize: '16px', lineHeight: 1.6, marginBottom: '24px' }}>
              KeeperHub can already create, publish, price, and run DeFi workflows. StrategyForge adds the missing layer that lets a marketplace user judge a strategy before spending capital.
            </p>

            <div style={{ display: 'grid', gap: '12px' }}>
              {[
                'AgentRegistry publishes strategies on-chain so discovery is not trapped inside KeeperHub.',
                'ReputationLedger records yield, success, and failure after every run.',
                '0G Compute proves the reasoning happened instead of being fabricated after the fact.',
                '0G Storage and priorCid links prove what changed between versions.',
              ].map(line => (
                <div key={line} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      background: 'rgba(91,108,255,0.14)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: '2px',
                    }}
                  >
                    <Check size={11} color="var(--accent-400)" />
                  </span>
                  <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-apple-text)', fontSize: '14px', lineHeight: 1.5 }}>
                    {line}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
            {PIPELINE_STEPS.map((step, index) => (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.45, ease: easeOut, delay: index * 0.04 }}
                className="liquid-glass-panel"
                style={buildPanelStyle({ padding: '20px', minHeight: '100%' })}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
                  <span
                    style={{
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '13px',
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                    }}
                  >
                    {step.n}
                  </span>
                  <span
                    className="liquid-glass-soft"
                    style={buildSoftPanelStyle({
                      padding: '5px 10px',
                      borderRadius: '999px',
                      color: step.tag === 'TEE' ? 'var(--attest-500)' : 'var(--text-tertiary)',
                      fontFamily: 'var(--font-apple-text)',
                      fontSize: '11px',
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    })}
                  >
                    {step.tag}
                  </span>
                </div>
                <div style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-apple-display)', fontSize: '24px', fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1.08, marginBottom: '10px' }}>
                  {step.label}
                </div>
                <p style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-apple-text)', fontSize: '14px', lineHeight: 1.55 }}>
                  {step.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ProofSection() {
  return (
    <section id="proof" style={{ padding: 'clamp(72px, 10vw, 112px) 0', position: 'relative', overflow: 'visible' }}>
      <SectionAura top="0%" left="14%" width="24rem" height="18rem" color="var(--landing-highlight)" blur={120} opacity={0.38} />
      <SectionAura top="20%" right="-6%" width="28rem" height="20rem" color="var(--landing-highlight-warm)" blur={115} opacity={0.32} />
      <div style={{ ...sectionWidth, position: 'relative', zIndex: 1 }}>
        <SectionHeading
          eyebrow="Public proof"
          title="Any agent, anywhere, can verify all three trust claims."
          description="Was it reasoned about? Has it ever worked? Did the new version learn from the last one? Each run emits the artifacts needed to answer those questions without rerunning the strategy."
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.55, ease: easeOut }}
            className="liquid-glass-panel"
            style={buildPanelStyle({
              padding: '28px',
              background: `
                linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.07) 15%, transparent 36%),
                linear-gradient(135deg, rgba(255,255,255,0.10) 0%, transparent 48%, rgba(255,255,255,0.03) 100%),
                var(--landing-surface-strong)
              `,
            })}
          >
            <p
              style={{
                marginBottom: '10px',
                color: 'var(--text-tertiary)',
                fontFamily: 'var(--font-apple-text)',
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
              }}
            >
              Evidence digest
            </p>
            <h3
              style={{
                marginBottom: '14px',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-apple-display)',
                fontSize: '34px',
                fontWeight: 600,
                letterSpacing: '-0.05em',
                lineHeight: 1.06,
              }}
            >
              Reasoning proof, performance proof, learning proof.
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-apple-text)', fontSize: '16px', lineHeight: 1.6, marginBottom: '24px' }}>
              StrategyForge turns trust into a concrete object: visible hashes, on-chain outcomes, and version links that can be checked independently.
            </p>

            <div style={{ display: 'grid', gap: '12px', marginBottom: '24px' }}>
              {PROOF_ITEMS.map(item => (
                <div key={item.title} className="liquid-glass-soft" style={buildSoftPanelStyle({ padding: '14px 16px' })}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-apple-text)', fontSize: '14px', fontWeight: 600 }}>
                      {item.title}
                    </span>
                    <ExternalLink size={14} color="var(--text-tertiary)" />
                  </div>
                  <div style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '12px', lineHeight: 1.4, marginBottom: '4px' }}>
                    {item.hash}
                  </div>
                  <div style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-apple-text)', fontSize: '12px' }}>{item.meta}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gap: '10px' }}>
              {[
                'TEE attestation hashes map to the exact reasoning roles that ran.',
                'ReputationLedger makes performance a public record instead of a marketing claim.',
                'priorCid links show exactly which failures informed the next live version.',
              ].map(line => (
                <div key={line} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      background: 'rgba(127,183,154,0.14)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: '2px',
                    }}
                  >
                    <Check size={11} color="var(--ok-500)" />
                  </span>
                  <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-apple-text)', fontSize: '14px', lineHeight: 1.5 }}>
                    {line}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          <div style={{ display: 'grid', gap: '14px' }}>
            {PROOF_ITEMS.map((item, index) => (
              <motion.div
                key={`${item.title}-card`}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.45, ease: easeOut, delay: index * 0.05 }}
                className="liquid-glass-panel"
                style={buildPanelStyle({ padding: '22px' })}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px', marginBottom: '10px' }}>
                  <div>
                    <p
                      style={{
                        marginBottom: '6px',
                        color: 'var(--text-tertiary)',
                        fontFamily: 'var(--font-apple-text)',
                        fontSize: '11px',
                        fontWeight: 600,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                      }}
                    >
                      Public record
                    </p>
                    <h3 style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-apple-display)', fontSize: '26px', fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1.08 }}>
                      {item.title}
                    </h3>
                  </div>
                  <span
                    className="liquid-glass-soft"
                    style={buildSoftPanelStyle({
                      padding: '6px 10px',
                      borderRadius: '999px',
                      color: index === 3 ? 'var(--accent-400)' : 'var(--attest-500)',
                      fontFamily: 'var(--font-apple-text)',
                      fontSize: '11px',
                      fontWeight: 600,
                    })}
                  >
                    {index === 3 ? 'Storage' : 'TEE'}
                  </span>
                </div>
                <div style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '13px', lineHeight: 1.45, marginBottom: '8px' }}>
                  {item.hash}
                </div>
                <p style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-apple-text)', fontSize: '14px', lineHeight: 1.55, marginBottom: '16px' }}>
                  {item.meta}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-apple-text)', fontSize: '13px' }}>
                  <Check size={13} color="var(--ok-500)" />
                  Verifiable by independent operators
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function VersionsSection() {
  return (
    <section id="versions" style={{ padding: 'clamp(72px, 10vw, 112px) 0', position: 'relative', overflow: 'visible' }}>
      <SectionAura top="8%" right="12%" width="22rem" height="18rem" color="var(--landing-highlight-cool)" blur={100} opacity={0.34} />
      <SectionAura bottom="-8%" left="12%" width="26rem" height="18rem" color="var(--landing-highlight)" blur={120} opacity={0.3} />
      <div style={{ ...sectionWidth, position: 'relative', zIndex: 1 }}>
        <SectionHeading
          eyebrow="Versioned evolution"
          title="Strategies improve by creating new history, not editing the old one."
          description="A live strategy can be deprecated, but it is never silently mutated. If v3 claims to be smarter than v1, it has to carry the proof."
          center
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px' }}>
          {VERSIONS.map((version, index) => {
            const isLive = version.status === 'Live';

            return (
              <motion.div
                key={version.v}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.48, ease: easeOut, delay: index * 0.05 }}
                className="liquid-glass-panel"
                style={buildPanelStyle({
                  padding: '24px',
                  background: isLive
                    ? `
                      linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.08) 14%, transparent 36%),
                      linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 48%, rgba(255,255,255,0.03) 100%),
                      var(--landing-surface-strong)
                    `
                    : `
                      linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 16%, transparent 38%),
                      linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 52%, rgba(255,255,255,0.02) 100%),
                      var(--landing-surface)
                    `,
                  boxShadow: isLive ? '0 34px 90px -42px rgba(var(--accent-glow), 0.42)' : 'var(--landing-shadow)',
                })}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
                  <h3 style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-apple-display)', fontSize: '30px', fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1 }}>
                    {version.v}
                  </h3>
                  <span
                    className="liquid-glass-soft"
                    style={buildSoftPanelStyle({
                      padding: '6px 10px',
                      borderRadius: '999px',
                      color: isLive ? 'var(--ok-500)' : 'var(--text-tertiary)',
                      fontFamily: 'var(--font-apple-text)',
                      fontSize: '11px',
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    })}
                  >
                    {version.status}
                  </span>
                </div>

                <div style={{ marginBottom: '6px', color: isLive ? 'var(--ok-500)' : 'var(--text-primary)', fontFamily: 'var(--font-apple-display)', fontSize: '42px', fontWeight: 600, letterSpacing: '-0.05em', lineHeight: 1 }}>
                  {version.yield}
                </div>
                <p style={{ marginBottom: '18px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                  Average yield across {version.runs} runs
                </p>
                <p style={{ marginBottom: '18px', color: 'var(--text-secondary)', fontFamily: 'var(--font-apple-text)', fontSize: '15px', lineHeight: 1.6 }}>
                  {version.note}
                </p>

                <div className="liquid-glass-soft" style={buildSoftPanelStyle({ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' })}>
                  <span style={{ flex: 1, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: '12px', lineHeight: 1.4 }}>
                    priorCid · {version.cid}
                  </span>
                  <Copy size={13} color="var(--text-tertiary)" />
                </div>
              </motion.div>
            );
          })}
        </div>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, ease: easeOut }}
          style={{
            maxWidth: '760px',
            margin: '28px auto 0',
            textAlign: 'center',
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-apple-text)',
            fontSize: '15px',
            lineHeight: 1.6,
          }}
        >
          Each release carries its own priorCid reference, preserving the exact evidence bundle that taught the next version what changed, what failed, and why it was promoted.
        </motion.p>
      </div>
    </section>
  );
}

function FinalCTASection() {
  const navigate = useNavigate();

  return (
    <section style={{ padding: 'clamp(72px, 10vw, 112px) 0 40px', position: 'relative', overflow: 'visible' }}>
      <SectionAura top="-18%" left="50%" width="30rem" height="18rem" color="var(--landing-highlight)" blur={130} opacity={0.4} />
      <SectionAura bottom="-10%" right="12%" width="22rem" height="18rem" color="var(--landing-highlight-warm)" blur={120} opacity={0.3} />
      <div style={{ ...sectionWidth, position: 'relative', zIndex: 1 }}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: easeOut }}
          className="liquid-glass-panel"
          style={buildPanelStyle({
            padding: 'clamp(28px, 5vw, 48px)',
            background: `
              linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.08) 14%, transparent 38%),
              linear-gradient(135deg, rgba(var(--accent-glow), 0.14) 0%, transparent 42%, rgba(255,255,255,0.04) 100%),
              var(--landing-surface-strong)
            `,
            textAlign: 'center',
          })}
        >
          <p
            style={{
              marginBottom: '14px',
              color: 'var(--text-tertiary)',
              fontFamily: 'var(--font-apple-text)',
              fontSize: '12px',
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
            >
            Open the trust layer
          </p>
          <h2
            style={{
              marginBottom: '16px',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-apple-display)',
              fontSize: 'clamp(36px, 5vw, 64px)',
              fontWeight: 600,
              letterSpacing: '-0.06em',
              lineHeight: 0.98,
            }}
          >
            Inspect the strategy. Inspect the proof. Then decide.
          </h2>
          <p
            style={{
              maxWidth: '680px',
              margin: '0 auto 30px',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-apple-text)',
              fontSize: 'clamp(17px, 2vw, 20px)',
              lineHeight: 1.6,
            }}
          >
            Search discoverable strategies, compare their track records, open the attestation trail, and see whether the latest version actually learned before you deploy.
          </p>

          <motion.button
            type="button"
            whileHover={{ y: -2, scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            transition={{ duration: 0.18 }}
            onClick={() => navigate('/app')}
            style={{
              height: '54px',
              padding: '0 28px',
              border: 'none',
              borderRadius: '999px',
              background: 'var(--accent-500)',
              color: '#fff',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              fontFamily: 'var(--font-apple-text)',
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 18px 44px -24px rgba(var(--accent-glow), 0.85)',
            }}
          >
            Enter App
            <ArrowRight size={16} />
          </motion.button>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '24px' }}>
            {['Verifiable reasoning', 'On-chain reputation', 'Versioned memory'].map(item => (
              <div
                className="liquid-glass-soft"
                key={item}
                style={buildSoftPanelStyle({
                  padding: '10px 14px',
                  borderRadius: '999px',
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-apple-text)',
                  fontSize: '13px',
                  fontWeight: 600,
                })}
              >
                {item}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export function PublicLandingPage() {
  return (
    <div style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden', background: 'var(--landing-page-bg)' }}>
      <BackgroundScene />

      <HeroSection />
      <SectionDivider />
      <PrinciplesSection />
      <SectionDivider />
      <ArchitectureSection />
      <SectionDivider />
      <ProofSection />
      <SectionDivider />
      <VersionsSection />
      <FinalCTASection />

      <footer style={{ padding: '0 clamp(20px, 4vw, 48px) 40px' }}>
        <div
          style={{
            maxWidth: '1180px',
            margin: '0 auto',
            paddingTop: '20px',
            borderTop: '1px solid var(--landing-divider)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <p style={{ color: 'var(--landing-text-quiet)', fontFamily: 'var(--font-apple-text)', fontSize: '13px' }}>
            StrategyForge
          </p>
          <p style={{ color: 'var(--landing-text-quiet)', fontFamily: 'var(--font-apple-text)', fontSize: '13px' }}>
            The trust layer for KeeperHub’s strategy marketplace
          </p>
        </div>
      </footer>
    </div>
  );
}
