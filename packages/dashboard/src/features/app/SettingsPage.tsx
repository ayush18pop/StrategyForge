import { useTheme } from '../../theme/useTheme';
import { deploymentConfig } from '../../lib/contracts';
import { formatAddress } from '../../lib/format';
import { useHealthQuery } from './query';
import { Badge, GhostButton, PageIntro, SectionCard, StatCard } from './AppPrimitives';

export function SettingsPage() {
  const { mode, resolved, setMode } = useTheme();
  const healthQuery = useHealthQuery();
  const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'same-origin';

  return (
    <div style={{ display: 'grid', gap: '18px' }}>
      <PageIntro
        eyebrow="Settings and wiring"
        title="Surface the app’s live wiring, not just preferences."
        description="This route helps the demo prove what the frontend is actually connected to: server health, API base URL, active theme state, and the on-chain deployment addresses."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
        <StatCard label="Theme" value={resolved} tone="accent" meta={`Stored mode: ${mode}`} />
        <StatCard label="API base" value={apiBase} tone="attest" meta="Uses VITE_API_BASE_URL when present." />
        <StatCard label="Server" value={healthQuery.data?.status ?? 'Checking…'} tone={healthQuery.data?.status === 'ok' ? 'ok' : 'attest'} meta={healthQuery.data?.timestamp ?? 'Awaiting /health'} />
        <StatCard label="RPC" value={deploymentConfig.network} meta={deploymentConfig.rpcUrl} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 0.8fr) minmax(0, 1.2fr)', gap: '18px' }}>
        <SectionCard title="Theme controls" caption="The product is designed to look intentional in both light and dark modes.">
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <GhostButton onClick={() => setMode('dark')}>Dark</GhostButton>
            <GhostButton onClick={() => setMode('light')}>Light</GhostButton>
            <GhostButton onClick={() => setMode('auto')}>Auto</GhostButton>
          </div>
          <Badge tone="accent">Active mode: {mode}</Badge>
        </SectionCard>

        <SectionCard title="Contract wiring" caption="These addresses are loaded from the checked-in deployment snapshot.">
          <div style={{ display: 'grid', gap: '10px' }}>
            {Object.entries(deploymentConfig.contracts).map(([name, contract]) => (
              <div
                key={name}
                style={{
                  padding: '14px 16px',
                  borderRadius: '18px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  display: 'grid',
                  gap: '6px',
                }}
              >
                <strong style={{ color: 'var(--text-primary)' }}>{name}</strong>
                <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)' }}>
                  {formatAddress(contract.address, 8)}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
