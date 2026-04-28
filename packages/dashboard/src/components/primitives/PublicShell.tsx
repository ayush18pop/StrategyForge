import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useTheme } from '../../theme/useTheme';

const NAV_ITEMS = [
  { label: 'Story', href: '#story' },
  { label: 'Architecture', href: '#architecture' },
  { label: 'Proof', href: '#proof' },
  { label: 'Versions', href: '#versions' },
];

export function PublicShell() {
  const navigate = useNavigate();
  const { resolved, toggle } = useTheme();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', overflowX: 'clip' }}>
      <header
        style={{
          position: 'fixed',
          top: '16px',
          left: 0,
          right: 0,
          padding: '0 clamp(16px, 4vw, 32px)',
          zIndex: 100,
        }}
      >
        <div
          className="liquid-glass-shell"
          style={{
            maxWidth: '1180px',
            margin: '0 auto',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
            position: 'relative',
            overflow: 'hidden',
            isolation: 'isolate',
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

          <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
            {NAV_ITEMS.map(item => (
              <a
                key={item.label}
                href={item.href}
                style={{
                  padding: '10px 12px',
                  borderRadius: '999px',
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-apple-text)',
                  fontSize: '13px',
                  fontWeight: 500,
                  transition: 'background 160ms ease, color 160ms ease',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                  (e.currentTarget as HTMLElement).style.background = 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 100%), var(--landing-surface-soft)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                {item.label}
              </a>
            ))}

            <button
              className="liquid-glass-soft"
              type="button"
              onClick={toggle}
              style={{
                height: '44px',
                padding: '0 14px',
                borderRadius: '999px',
                border: '1px solid var(--landing-border)',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 100%), var(--landing-surface-soft)',
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-apple-text)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.14)',
                transition: 'color 160ms ease, background 160ms ease',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                (e.currentTarget as HTMLElement).style.background = 'linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) 100%), var(--landing-surface)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                (e.currentTarget as HTMLElement).style.background = 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 100%), var(--landing-surface-soft)';
              }}
            >
              {resolved === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>

            <button
              type="button"
              onClick={() => navigate('/app')}
              style={{
                height: '44px',
                padding: '0 18px',
                background: 'var(--accent-500)',
                color: '#fff',
                border: 'none',
                borderRadius: '999px',
                fontFamily: 'var(--font-apple-text)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 16px 40px -20px rgba(var(--accent-glow), 0.75)',
                transition: 'filter 160ms ease, transform 160ms ease',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.filter = 'brightness(1.08)';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.filter = 'none';
                (e.currentTarget as HTMLElement).style.transform = 'none';
              }}
            >
              Enter App
            </button>
          </nav>
        </div>
      </header>

      <main style={{ flex: 1, paddingTop: '108px' }}>
        <Outlet />
      </main>
    </div>
  );
}
