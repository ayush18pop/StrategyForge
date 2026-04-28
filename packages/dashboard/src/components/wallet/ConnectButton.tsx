import { useState } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import * as Dialog from '@radix-ui/react-dialog';
import { Wallet, X, LogOut } from 'lucide-react';
import { formatAddress } from '../../lib/format';

export function ConnectButton() {
  const { address, isConnected, connector } = useAccount();
  const { connectors, connect, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);

  if (isConnected && address) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span
          style={{
            height: '40px',
            padding: '0 14px',
            borderRadius: '999px',
            border: '1px solid var(--landing-border)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 100%), var(--landing-surface-soft)',
            color: 'var(--text-secondary)',
            fontSize: 'var(--fs-sm)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'var(--color-ok)',
              flexShrink: 0,
            }}
          />
          {formatAddress(address)}
        </span>
        <button
          onClick={() => disconnect()}
          aria-label="Disconnect wallet"
          title={`Disconnect ${connector?.name ?? 'wallet'}`}
          style={{
            height: '40px',
            width: '40px',
            borderRadius: '999px',
            border: '1px solid var(--landing-border)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 100%), var(--landing-surface-soft)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <LogOut size={14} strokeWidth={1.8} />
        </button>
      </div>
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          style={{
            height: '40px',
            padding: '0 14px',
            borderRadius: '999px',
            border: '1px solid rgba(var(--accent-glow), 0.35)',
            background: 'linear-gradient(135deg, rgba(var(--accent-glow), 0.15) 0%, rgba(var(--accent-glow), 0.05) 100%)',
            color: 'var(--accent-200)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: 'var(--fs-sm)',
            fontWeight: 600,
          }}
        >
          <Wallet size={14} strokeWidth={1.8} />
          Connect
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(4px)',
            zIndex: 500,
          }}
        />
        <Dialog.Content
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 501,
            width: 'min(420px, 92vw)',
            background: 'var(--bg-2)',
            border: '1px solid var(--edge-sides)',
            borderTopColor: 'var(--edge-top)',
            borderRadius: '20px',
            padding: '28px',
            boxShadow: '0 32px 80px -20px rgba(0,0,0,0.6)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <div>
              <Dialog.Title
                style={{
                  margin: 0,
                  color: 'var(--text-primary)',
                  fontSize: 'var(--fs-lg)',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                }}
              >
                Connect wallet
              </Dialog.Title>
              <Dialog.Description
                style={{
                  margin: '4px 0 0',
                  color: 'var(--text-secondary)',
                  fontSize: 'var(--fs-sm)',
                }}
              >
                Choose a wallet to connect to StrategyForge.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                aria-label="Close"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  border: '1px solid var(--edge-sides)',
                  background: 'var(--bg-3)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <X size={14} strokeWidth={1.8} />
              </button>
            </Dialog.Close>
          </div>

          <div style={{ display: 'grid', gap: '10px' }}>
            {connectors.map((c) => (
              <button
                key={c.id}
                disabled={isPending}
                onClick={() => {
                  connect({ connector: c });
                  setOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: '1px solid var(--edge-sides)',
                  background: 'var(--bg-3)',
                  color: 'var(--text-primary)',
                  cursor: isPending ? 'not-allowed' : 'pointer',
                  opacity: isPending ? 0.6 : 1,
                  fontSize: 'var(--fs-md)',
                  fontWeight: 500,
                  textAlign: 'left',
                  transition: 'background 120ms ease, border-color 120ms ease',
                }}
                onMouseEnter={(e) => {
                  if (!isPending) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-4)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-3)';
                }}
              >
                <span
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: 'var(--bg-2)',
                    border: '1px solid var(--edge-sides)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Wallet size={18} strokeWidth={1.6} color="var(--accent-200)" />
                </span>
                <span style={{ flex: 1 }}>{c.name}</span>
                {isPending && <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)' }}>Connecting…</span>}
              </button>
            ))}
          </div>

          {error && (
            <p style={{ marginTop: '16px', color: 'var(--color-error, #f87171)', fontSize: 'var(--fs-sm)' }}>
              {error.message}
            </p>
          )}

          <p style={{ marginTop: '20px', color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs, 11px)', lineHeight: 1.5 }}>
            By connecting you agree to sign transactions for strategy deployment and fund management. Your wallet is never custodied by StrategyForge.
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
