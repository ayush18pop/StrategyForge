import { Link, Outlet, useLocation } from 'react-router-dom';
import { ArrowUpRight, Search, Sparkles } from 'lucide-react';
import { useTheme } from '../../theme/useTheme';

const NAV_ITEMS = [
  { label: 'Search', path: '/app' },
  { label: 'Generate', path: '/app/generate' },
  { label: 'DAG', path: '/app/dag/demo-family' },
  { label: 'Agent', path: '/app/agent' },
  { label: 'Execution', path: '/app/execution/demo-workflow' },
  { label: 'Settings', path: '/app/settings' },
] as const;

export function AppShell() {
  const location = useLocation();
  const { toggle, resolved } = useTheme();

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflowX: 'clip',
        background: `
          radial-gradient(circle at 10% 0%, rgba(var(--accent-glow), 0.15) 0%, transparent 30%),
          radial-gradient(circle at 92% 84%, rgba(227,169,74,0.12) 0%, transparent 26%),
          linear-gradient(180deg, var(--landing-page-bg) 0%, color-mix(in srgb, var(--landing-page-bg) 78%, var(--bg-0) 22%) 100%)
        `,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(to right, var(--landing-grid) 1px, transparent 1px),
            linear-gradient(to bottom, var(--landing-grid) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
          opacity: 0.3,
          pointerEvents: 'none',
        }}
      />

      <header
        style={{
          position: 'fixed',
          top: '14px',
          left: 0,
          right: 0,
          padding: '0 clamp(16px, 4vw, 28px)',
          zIndex: 100,
        }}
      >
        <div
          className="liquid-glass-shell"
          style={{
            maxWidth: '1240px',
            margin: '0 auto',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
            background: `
              linear-gradient(180deg, var(--landing-glass-highlight) 0%, var(--landing-glass-sheen) 12%, transparent 34%),
              linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 42%, rgba(255,255,255,0.03) 72%, var(--landing-glass-underline) 100%),
              var(--landing-shell)
            `,
            border: '1px solid var(--landing-border-strong)',
            borderRadius: '999px',
            boxShadow: `
              inset 0 1px 0 0 var(--landing-glass-highlight),
              inset 0 -1px 0 0 var(--landing-glass-lowlight),
              0 20px 60px -28px var(--landing-glass-shadow)
            `,
            backdropFilter: 'blur(34px) saturate(185%) brightness(1.03)',
            WebkitBackdropFilter: 'blur(34px) saturate(185%) brightness(1.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <Link
              to="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '12px',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-apple-display)',
                fontSize: '15px',
                fontWeight: 600,
                letterSpacing: '-0.02em',
              }}
            >
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--accent-500), var(--attest-500))',
                  boxShadow: '0 0 22px rgba(var(--accent-glow), 0.45)',
                }}
              />
              StrategyForge
            </Link>

            <div
              className="liquid-glass-soft"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                height: '34px',
                padding: '0 12px',
                borderRadius: '999px',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 100%), var(--landing-surface-soft)',
                border: '1px solid var(--landing-border)',
              color: 'var(--text-secondary)',
              fontSize: 'var(--fs-sm)',
            }}
          >
            <Sparkles size={14} strokeWidth={1.8} color="var(--accent-200)" />
            Live product layer
          </div>
          </div>

          <nav style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {NAV_ITEMS.map(({ label, path }) => {
              const active = label === 'Search'
                ? location.pathname === '/app'
                : location.pathname.startsWith(path);

              return (
                <Link
                  key={label}
                  to={path}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    height: '40px',
                    padding: '0 14px',
                    borderRadius: '999px',
                    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                    background: active
                      ? 'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 100%), var(--landing-surface-soft)'
                      : 'transparent',
                    border: active ? '1px solid rgba(var(--accent-glow), 0.20)' : '1px solid transparent',
                    fontSize: 'var(--fs-sm)',
                    fontWeight: active ? 600 : 500,
                    transition: 'background 160ms ease, color 160ms ease, border-color 160ms ease',
                  }}
                >
                  {label === 'Search' && <Search size={14} strokeWidth={1.8} />}
                  {label}
                </Link>
              );
            })}

            <button
              onClick={toggle}
              aria-label={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} mode`}
              style={{
                height: '40px',
                padding: '0 14px',
                borderRadius: '999px',
                border: '1px solid var(--landing-border)',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 100%), var(--landing-surface-soft)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 'var(--fs-sm)',
                fontWeight: 600,
              }}
            >
              {resolved === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>

            <Link
              to="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                height: '40px',
                padding: '0 14px',
                borderRadius: '999px',
                border: '1px solid var(--landing-border)',
                background: 'rgba(255,255,255,0.04)',
                color: 'var(--text-secondary)',
                fontSize: 'var(--fs-sm)',
              }}
            >
              Story
              <ArrowUpRight size={14} strokeWidth={1.8} />
            </Link>
          </nav>
        </div>
      </header>

      <main
        style={{
          flex: 1,
          position: 'relative',
          paddingTop: '96px',
        }}
      >
        <div
          style={{
            maxWidth: '1240px',
            width: '100%',
            margin: '0 auto',
            padding: '0 clamp(20px, 4vw, 32px) 32px',
          }}
        >
          <Outlet />
        </div>
      </main>
    </div>
  );
}
