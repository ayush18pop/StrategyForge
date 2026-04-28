import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BrainCircuit, Fingerprint, Wallet } from 'lucide-react';
import { getContractEntries, deploymentConfig } from '../../lib/contracts';
import { formatAddress, formatDateTime, number } from '../../lib/format';
import { useSearchQuery } from './query';
import { AmbientLight } from '../../components/glass/AmbientLight';
import { ambientPresets } from '../../components/glass/ambient-presets';

const easeOut = [0.22, 1, 0.36, 1] as const;

export function AgentPage() {
  const searchQuery = useSearchQuery(new URLSearchParams());
  const contracts = getContractEntries();
  const familyCount = searchQuery.data?.matches.length ?? 0;

  return (
    <div className="app-page" style={{ position: 'relative' }}>
      <AmbientLight blobs={ambientPresets.hero} />

      {/* ─── Page Intro ─── */}
      <motion.section
        className="app-page-intro"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: easeOut }}
      >
        <span className="app-page-intro__eyebrow">the agent</span>
        <h1 className="app-page-intro__title">One identity. Evolving intelligence.</h1>
        <p className="app-page-intro__subtitle">
          The iNFT persists across strategy versions. Its brain CID changes on-chain after every
          evolution cycle. Reputation stays queryable forever.
        </p>
      </motion.section>

      {/* ─── Stats ─── */}
      <motion.div
        className="app-stat-grid"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: easeOut, delay: 0.08 }}
      >
        <div className="app-stat-card">
          <div className="app-stat-card__value app-stat-card__value--accent">{deploymentConfig.network}</div>
          <div className="app-stat-card__label">Network</div>
          <div className="app-stat-card__meta">Chain ID {deploymentConfig.chainId}</div>
        </div>
        <div className="app-stat-card">
          <div className="app-stat-card__value app-stat-card__value--attest">{contracts.length}</div>
          <div className="app-stat-card__label">Contracts</div>
          <div className="app-stat-card__meta">Registry + reputation + iNFT</div>
        </div>
        <div className="app-stat-card">
          <div className="app-stat-card__value app-stat-card__value--ok">{familyCount}</div>
          <div className="app-stat-card__label">Proven families</div>
          <div className="app-stat-card__meta">Discoverable via search API</div>
        </div>
        <div className="app-stat-card">
          <div className="app-stat-card__value app-stat-card__value--default">{deploymentConfig.totalCost}</div>
          <div className="app-stat-card__label">Deploy cost</div>
          <div className="app-stat-card__meta">{number.format(deploymentConfig.totalGasUsed)} gas used</div>
        </div>
      </motion.div>

      {/* ─── Identity + Registry ─── */}
      <motion.div
        className="app-two-col--agent"
        style={{ display: 'grid', gap: '18px' }}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: easeOut, delay: 0.16 }}
      >
        <div className="app-section-card">
          <div>
            <h2 className="app-section-card__title">Agent identity</h2>
            <p className="app-section-card__caption">ERC-7857 iNFT with ERC-6551 token-bound account</p>
          </div>
          <div style={{ display: 'grid', gap: '14px' }}>
            <span className="app-badge app-badge--accent">
              <BrainCircuit size={14} strokeWidth={1.8} /> Brain CID updates on-chain after every cycle
            </span>
            <span className="app-badge app-badge--attest">
              <Fingerprint size={14} strokeWidth={1.8} /> Every run outcome is permanently recorded
            </span>
            <span className="app-badge app-badge--ok">
              <Wallet size={14} strokeWidth={1.8} /> Agent wallet is separate from user capital
            </span>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', lineHeight: 'var(--lh-body)' }}>
              Strategy versions come and go, but the iNFT persists as the identity anchor.
              The brain CID evolves. The reputation accumulates. The wallet stays distinct.
            </p>
          </div>
        </div>

        <div className="app-section-card">
          <div>
            <h2 className="app-section-card__title">Deployment registry</h2>
            <p className="app-section-card__caption">Synced from {formatDateTime(deploymentConfig.timestamp)} on 0G Testnet</p>
          </div>
          <div style={{ display: 'grid', gap: '12px' }}>
            {contracts.map(([name, contract]) => (
              <div key={name} className="app-contract-card">
                <strong style={{ color: 'var(--text-primary)' }}>{name}</strong>
                <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)' }}>
                  {contract.address}
                </span>
                {contract.implementation ? (
                  <span style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)' }}>
                    Implementation {formatAddress(contract.implementation)}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ─── Families ─── */}
      {searchQuery.data?.matches.length ? (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: easeOut, delay: 0.24 }}
        >
          <div className="app-section-card">
            <div>
              <h2 className="app-section-card__title">Live families</h2>
              <p className="app-section-card__caption">Jump into any discoverable family.</p>
            </div>
            <div style={{ display: 'grid', gap: '10px' }}>
              {searchQuery.data.matches.map((match) => (
                <Link key={match.familyId} to={`/app/strategy/${match.familyId}`} className="app-family-link">
                  {match.familyId}
                </Link>
              ))}
            </div>
          </div>
        </motion.div>
      ) : null}
    </div>
  );
}
