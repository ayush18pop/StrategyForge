import { useState } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Zap, AlertCircle, Loader } from 'lucide-react';
import type { PaymentDetails } from '../../lib/payment';
import { signX402Payment } from '../../lib/payment';
import { formatAddress } from '../../lib/format';

interface PaymentModalProps {
  details: PaymentDetails | null;
  onClose: () => void;
  onApprove: (paymentHeader: string) => void;
}

export function PaymentModal({ details, onClose, onApprove }: PaymentModalProps) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async () => {
    if (!walletClient || !address || !details) return;
    setSigning(true);
    setError(null);
    try {
      const paymentHeader = await signX402Payment(walletClient, address, details);
      onApprove(paymentHeader);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Signing failed');
    } finally {
      setSigning(false);
    }
  };

  return (
    <Dialog.Root open={!!details} onOpenChange={(open) => { if (!open) onClose(); }}>
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
            width: 'min(440px, 92vw)',
            background: 'var(--bg-2)',
            border: '1px solid var(--edge-sides)',
            borderTopColor: 'var(--edge-top)',
            borderRadius: '20px',
            padding: '28px',
            boxShadow: '0 32px 80px -20px rgba(0,0,0,0.6)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
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
                Approve payment
              </Dialog.Title>
              <Dialog.Description
                style={{
                  margin: '4px 0 0',
                  color: 'var(--text-secondary)',
                  fontSize: 'var(--fs-sm)',
                }}
              >
                Sign an EIP-3009 authorization to run this strategy.
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

          {details && (
            <>
              {/* Amount pill */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '20px',
                  marginBottom: '20px',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, rgba(var(--accent-glow), 0.10) 0%, rgba(var(--accent-glow), 0.03) 100%)',
                  border: '1px solid rgba(var(--accent-glow), 0.20)',
                  gap: '10px',
                }}
              >
                <Zap size={18} strokeWidth={1.8} color="var(--accent-200)" />
                <span
                  style={{
                    fontSize: '28px',
                    fontWeight: 700,
                    letterSpacing: '-0.03em',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-apple-display)',
                  }}
                >
                  {details.amount} {details.currency}
                </span>
              </div>

              {/* Details */}
              <div style={{ display: 'grid', gap: '10px', marginBottom: '20px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: 'var(--bg-3)',
                    border: '1px solid var(--edge-sides)',
                  }}
                >
                  <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>From</span>
                  <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)' }}>
                    {address ? formatAddress(address) : '—'}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: 'var(--bg-3)',
                    border: '1px solid var(--edge-sides)',
                  }}
                >
                  <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>To (agent TBA)</span>
                  <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)' }}>
                    {formatAddress(details.recipient)}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: 'var(--bg-3)',
                    border: '1px solid var(--edge-sides)',
                  }}
                >
                  <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>Network</span>
                  <span style={{ color: 'var(--text-primary)', fontSize: 'var(--fs-sm)', textTransform: 'capitalize' }}>
                    {details.network}
                  </span>
                </div>
              </div>

              {error && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: 'rgba(248,113,113,0.08)',
                    border: '1px solid rgba(248,113,113,0.25)',
                    marginBottom: '16px',
                  }}
                >
                  <AlertCircle size={14} color="#f87171" strokeWidth={1.8} />
                  <span style={{ color: '#f87171', fontSize: 'var(--fs-sm)' }}>{error}</span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={signing}
                  style={{
                    height: '44px',
                    borderRadius: '12px',
                    border: '1px solid var(--edge-sides)',
                    background: 'var(--bg-3)',
                    color: 'var(--text-secondary)',
                    cursor: signing ? 'not-allowed' : 'pointer',
                    fontSize: 'var(--fs-sm)',
                    fontWeight: 600,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={signing || !walletClient}
                  style={{
                    height: '44px',
                    borderRadius: '12px',
                    border: '1px solid rgba(var(--accent-glow), 0.35)',
                    background: 'linear-gradient(135deg, rgba(var(--accent-glow), 0.20) 0%, rgba(var(--accent-glow), 0.08) 100%)',
                    color: 'var(--accent-200)',
                    cursor: signing || !walletClient ? 'not-allowed' : 'pointer',
                    fontSize: 'var(--fs-sm)',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    opacity: signing || !walletClient ? 0.6 : 1,
                  }}
                >
                  {signing ? (
                    <>
                      <Loader size={14} strokeWidth={1.8} style={{ animation: 'spin 1s linear infinite' }} />
                      Signing…
                    </>
                  ) : (
                    'Approve & Run'
                  )}
                </button>
              </div>

              <p style={{ marginTop: '16px', color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs, 11px)', lineHeight: 1.5 }}>
                This is an off-chain EIP-712 signature — no gas is charged for signing. USDC is only transferred when the strategy executes.
              </p>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
