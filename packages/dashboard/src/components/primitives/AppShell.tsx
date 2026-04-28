import type { CSSProperties, ReactNode } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { ArrowUpRight, Search, Sparkles, UserRound } from 'lucide-react';
import { useTheme } from '../../theme/useTheme';
import { NavAccount } from '../wallet/NavAccount';

const NAV_ITEMS = [
  { label: 'Search', path: '/app', icon: Search },
  { label: 'Forge', path: '/app/generate', icon: Sparkles },
  { label: 'Account', path: '/app/account', icon: UserRound },
] as const;

export function AppShell() {
  const location = useLocation();
  const { toggle, resolved } = useTheme();
  const contextLabel = contextForPath(location.pathname);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflowX: 'clip',
        background: `
          radial-gradient(circle at 14% 4%, rgba(var(--accent-glow), 0.16) 0%, transparent 28%),
          radial-gradient(circle at 88% 88%, rgba(227,169,74,0.12) 0%, transparent 24%),
          linear-gradient(180deg, var(--landing-page-bg) 0%, color-mix(in srgb, var(--landing-page-bg) 80%, var(--bg-0) 20%) 100%)
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
          opacity: 0.26,
          pointerEvents: 'none',
        }}
      />

      <header
        style={{
          position: 'fixed',
          top: '16px',
          left: 0,
          right: 0,
          padding: '0 clamp(16px, 4vw, 28px)',
          zIndex: 100,
        }}
      >
        <div
          className="liquid-glass-shell"
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px 16px',
            flexWrap: 'wrap',
            background: `
              linear-gradient(180deg, var(--landing-glass-highlight) 0%, var(--landing-glass-sheen) 12%, transparent 34%),
              linear-gradient(140deg, rgba(255,255,255,0.12) 0%, transparent 46%, rgba(255,255,255,0.03) 72%, var(--landing-glass-underline) 100%),
              var(--landing-shell)
            `,
            border: '1px solid var(--landing-border-strong)',
            borderRadius: '28px',
            boxShadow: `
              inset 0 1px 0 0 var(--landing-glass-highlight),
              inset 0 -1px 0 0 var(--landing-glass-lowlight),
              0 24px 70px -34px var(--landing-glass-shadow)
            `,
            backdropFilter: 'blur(34px) saturate(185%) brightness(1.03)',
            WebkitBackdropFilter: 'blur(34px) saturate(185%) brightness(1.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <Link
              to="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '12px',
                minHeight: '44px',
                padding: '0 10px 0 6px',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-apple-display)',
                fontSize: '15px',
                fontWeight: 600,
                letterSpacing: '-0.02em',
              }}
            >
              <span
                style={{
                  width: '11px',
                  height: '11px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--accent-500), var(--attest-500))',
                  boxShadow: '0 0 22px rgba(var(--accent-glow), 0.45)',
                }}
              />
              StrategyForge
            </Link>

            <StatusPill>Local-first proof ledger</StatusPill>
            {contextLabel ? <StatusPill>{contextLabel}</StatusPill> : null}
          </div>

          <nav style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {NAV_ITEMS.map(({ label, path, icon: Icon }) => {
              const active = isNavItemActive(path, location.pathname);

              return (
                <Link
                  key={label}
                  to={path}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    minHeight: '44px',
                    padding: '0 14px',
                    borderRadius: '14px',
                    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                    background: active
                      ? 'linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) 100%), rgba(var(--accent-glow), 0.08)'
                      : 'transparent',
                    border: active ? '1px solid rgba(var(--accent-glow), 0.22)' : '1px solid transparent',
                    fontSize: 'var(--fs-sm)',
                    fontWeight: active ? 600 : 500,
                    transition: 'background 160ms ease, color 160ms ease, border-color 160ms ease',
                  }}
                >
                  <Icon size={15} strokeWidth={1.8} />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginLeft: 'auto' }}>
            <button
              type="button"
              onClick={toggle}
              aria-label={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} mode`}
              style={utilityButtonStyle}
            >
              {resolved === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>

            <Link to="/" style={utilityButtonStyle}>
              Story
              <ArrowUpRight size={14} strokeWidth={1.8} />
            </Link>

            <NavAccount />
          </div>
        </div>
      </header>

      <main
        style={{
          flex: 1,
          position: 'relative',
          paddingTop: '128px',
        }}
      >
        <div
          style={{
            maxWidth: '1280px',
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

function StatusPill({ children }: { children: ReactNode }) {
  return (
    <div
      className="liquid-glass-soft"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: '36px',
        padding: '0 12px',
        borderRadius: '999px',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 100%), var(--landing-surface-soft)',
        border: '1px solid var(--landing-border)',
        color: 'var(--text-secondary)',
        fontSize: 'var(--fs-sm)',
      }}
    >
      {children}
    </div>
  );
}

const utilityButtonStyle: CSSProperties = {
  minHeight: '44px',
  padding: '0 14px',
  borderRadius: '14px',
  border: '1px solid var(--landing-border)',
  background: 'rgba(255,255,255,0.04)',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  fontSize: 'var(--fs-sm)',
  fontWeight: 600,
};

function isNavItemActive(path: string, pathname: string): boolean {
  if (path === '/app') {
    return pathname === '/app'
      || pathname.startsWith('/app/strategy/')
      || pathname.startsWith('/app/dag/')
      || pathname.startsWith('/app/execution/')
      || pathname.startsWith('/app/agent');
  }

  if (path === '/app/account') {
    return pathname.startsWith('/app/account') || pathname.startsWith('/app/settings');
  }

  return pathname.startsWith(path);
}

function contextForPath(pathname: string): string | null {
  if (pathname === '/app') return 'Search the public catalog';
  if (pathname.startsWith('/app/generate')) return 'Pipeline forge';
  if (pathname.startsWith('/app/account')) return 'Wallet account';
  if (pathname.startsWith('/app/strategy/')) return 'Family detail';
  if (pathname.startsWith('/app/dag/')) return 'Proof DAG';
  if (pathname.startsWith('/app/execution/')) return 'Execution telemetry';
  if (pathname.startsWith('/app/agent')) return 'Agent memory';
  if (pathname.startsWith('/app/settings')) return 'System wiring';
  return null;
}
