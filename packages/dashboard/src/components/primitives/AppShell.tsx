import { Link, Outlet, useLocation } from 'react-router-dom';
import { useTheme } from '../../theme/ThemeProvider';

const NAV_ITEMS = [
  { label: 'Search',   path: '/app' },
  { label: 'Generate', path: '/app/generate' },
  { label: 'DAG',      path: '/app/dag/conservative-stablecoin-yield' },
  { label: 'Agent',    path: '/app/agent' },
  { label: 'Execution',path: '/app/execution/demo' },
  { label: 'Settings', path: '/app/settings' },
] as const;

export function AppShell() {
  const location = useLocation();
  const { toggle, resolved } = useTheme();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* App top nav: floats at top with glass */}
      <header
        style={{
          position: 'fixed',
          top: '8px',
          left: '16px',
          right: '16px',
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          zIndex: 100,
        }}
        className="glass-regular"
      >
        <Link
          to="/"
          style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-md)', color: 'var(--text-primary)', fontStyle: 'italic', flexShrink: 0 }}
        >
          StrategyForge
        </Link>

        <nav style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'center' }}>
          {NAV_ITEMS.map(({ label, path }) => {
            const active = label === 'Search'
              ? location.pathname === '/app'
              : location.pathname.startsWith(path);
            return (
              <Link
                key={label}
                to={path}
                style={{
                  fontSize: 'var(--fs-sm)',
                  color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: active ? 500 : 400,
                  position: 'relative',
                  transition: 'color 160ms',
                }}
              >
                {label}
                {active && (
                  <span
                    style={{
                      position: 'absolute',
                      bottom: '-4px',
                      left: 0,
                      right: 0,
                      height: '2px',
                      background: 'var(--accent-500)',
                      borderRadius: '1px',
                    }}
                  />
                )}
              </Link>
            );
          })}

          {/* Theme toggle */}
          <button
            onClick={toggle}
            aria-label={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} mode`}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--edge-sides)',
              background: 'var(--glass-chrome)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              transition: 'color 160ms',
            }}
          >
            {resolved === 'dark' ? '○' : '●'}
          </button>
        </nav>
      </header>

      {/* Centered content container */}
      <main
        style={{
          flex: 1,
          paddingTop: '80px',
          maxWidth: '1200px',
          width: '100%',
          margin: '0 auto',
          padding: '80px 32px 32px',
        }}
      >
        <Outlet />
      </main>
    </div>
  );
}
