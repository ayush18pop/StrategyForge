import { Link } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAccount, useDisconnect } from 'wagmi';
import { useUserAccountQuery } from '../../features/app/query';
import { formatAddress } from '../../lib/format';
import { ConnectButton } from './ConnectButton';

export function NavAccount() {
  const { address, isConnected, connector } = useAccount();
  const { disconnect } = useDisconnect();
  const accountQuery = useUserAccountQuery(address);

  if (!isConnected || !address) {
    return <ConnectButton />;
  }

  const familyCount = accountQuery.data?.stats.familyCount;
  const proofCount = accountQuery.data?.stats.attestationCount;
  const meta = typeof familyCount === 'number' && typeof proofCount === 'number'
    ? `${familyCount} families · ${proofCount} proofs`
    : accountQuery.isLoading
      ? 'Syncing local account'
      : connector?.name ?? 'Connected wallet';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <Link
        to="/app/account"
        style={{
          minHeight: '44px',
          padding: '8px 14px',
          borderRadius: '16px',
          border: '1px solid rgba(var(--accent-glow), 0.22)',
          background: `
            linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.03) 100%),
            rgba(var(--accent-glow), 0.08)
          `,
          display: 'grid',
          alignContent: 'center',
          gap: '2px',
        }}
      >
        <span style={{ color: 'var(--text-primary)', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>
          {formatAddress(address)}
        </span>
        <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)' }}>
          {meta}
        </span>
      </Link>

      <button
        type="button"
        onClick={() => disconnect()}
        aria-label="Disconnect wallet"
        title={`Disconnect ${connector?.name ?? 'wallet'}`}
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '14px',
          border: '1px solid var(--landing-border)',
          background: 'rgba(255,255,255,0.04)',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <LogOut size={15} strokeWidth={1.8} />
      </button>
    </div>
  );
}
