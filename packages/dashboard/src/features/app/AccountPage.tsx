import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { ConnectButton } from '../../components/wallet/ConnectButton';
import { formatAddress, formatDateTime, number, relativeTime, titleCaseFromSlug } from '../../lib/format';
import { useUserAccountQuery } from './query';
import { Badge, EmptyState, HashRow, LoadingBlock, PageIntro, SectionCard, StatCard } from './AppPrimitives';

export function AccountPage() {
  const { address, isConnected } = useAccount();
  const accountQuery = useUserAccountQuery(address);

  if (!isConnected || !address) {
    return (
      <EmptyState
        title="Connect a wallet to open your account."
        description="StrategyForge uses the connected wallet as the account identity. Local SQLite keeps your families, CIDs, and attestation hashes even when 0G is slow."
        action={<ConnectButton />}
      />
    );
  }

  if (accountQuery.isLoading) {
    return <LoadingBlock label="Loading local account mirror…" />;
  }

  if (accountQuery.isError || !accountQuery.data) {
    return (
      <EmptyState
        title="Account unavailable"
        description={accountQuery.error?.message ?? 'The account summary could not be loaded.'}
        action={<Link to="/app/generate" className="primary-button">Forge strategy</Link>}
      />
    );
  }

  const account = accountQuery.data;

  return (
    <div style={{ display: 'grid', gap: '18px' }}>
      <PageIntro
        eyebrow="Wallet account"
        title="Local account mirror for your proof trail."
        description="SQLite is the reliable working ledger for this wallet. Strategy families, evidence CIDs, and TEE attestation hashes are mirrored locally so 0G stays a proof rail instead of a single point of read failure."
        actions={
          <Link to="/app/generate" className="primary-button">
            Forge strategy
          </Link>
        }
      />

      <div className="app-stat-grid">
        <StatCard
          label="Wallet"
          value={formatAddress(account.user.wallet, 8)}
          tone="default"
          meta={`Last active ${relativeTime(account.user.lastActiveAt)}`}
        />
        <StatCard
          label="Families"
          value={number.format(account.stats.familyCount)}
          tone="accent"
          meta={`${account.stats.liveFamilyCount} live families`}
        />
        <StatCard
          label="Versions"
          value={number.format(account.stats.versionCount)}
          tone="attest"
          meta="All locally mirrored strategy versions"
        />
        <StatCard
          label="Proof records"
          value={number.format(account.stats.attestationCount)}
          tone="ok"
          meta={`${account.stats.anchoredAttestationCount} anchored · ${account.stats.pendingAttestationCount} pending`}
        />
      </div>

      <div className="app-two-col--even" style={{ display: 'grid', gap: '18px' }}>
        <SectionCard
          title="Strategy families"
          caption="Wallet-owned families stored in the local SQLite catalog."
        >
          {account.families.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>
              No local families yet. Forge the first one and the account ledger will start tracking it immediately.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {account.families.map((family) => (
                <Link
                  key={family.familyId}
                  to={`/app/strategy/${family.familyId}`}
                  className="app-route-link"
                >
                  <span style={{ display: 'grid', gap: '6px', textAlign: 'left' }}>
                    <strong style={{ color: 'var(--text-primary)', fontSize: 'var(--fs-md)' }}>
                      {family.goal.asset} · {titleCaseFromSlug(family.goal.riskLevel)}
                    </strong>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>
                      {number.format(family.goal.amount)} {family.goal.asset} · {family.versionCount} version{family.versionCount === 1 ? '' : 's'} · Updated {formatDateTime(family.updatedAt)}
                    </span>
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <Badge tone={family.liveVersionCount > 0 ? 'ok' : 'attest'}>
                      {family.liveVersionCount > 0 ? 'Live catalog' : 'Draft only'}
                    </Badge>
                    {family.latestVersion ? (
                      <Badge tone="default">
                        v{family.latestVersion.version}
                      </Badge>
                    ) : null}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Proof mirror"
          caption="Recent TEE attestation hashes stored locally alongside the family snapshot."
        >
          {account.recentAttestations.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>
              No local attestation rows yet. They appear after the first pipeline run.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {account.recentAttestations.map((attestation) => (
                <div
                  key={attestation.id}
                  style={{
                    display: 'grid',
                    gap: '10px',
                    padding: '16px',
                    borderRadius: '18px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <Badge tone="attest">{titleCaseFromSlug(attestation.step)}</Badge>
                      <Badge tone={attestation.storageStatus === 'anchored' ? 'ok' : 'warn'}>
                        {attestation.storageStatus}
                      </Badge>
                    </div>
                    <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)' }}>
                      {formatDateTime(attestation.createdAt)}
                    </span>
                  </div>

                  <Link
                    to={`/app/strategy/${attestation.familyId}`}
                    style={{ color: 'var(--text-primary)', fontSize: 'var(--fs-md)', fontWeight: 600 }}
                  >
                    {attestation.familyId} · v{attestation.version}
                  </Link>

                  <HashRow label="Attestation hash" value={attestation.attestationHash} />
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Proof distribution"
        caption="A healthy pipeline produces one local record for each reasoning stage."
      >
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Badge tone="default">Researcher · {account.stats.stepCounts.researcher}</Badge>
          <Badge tone="default">Strategist · {account.stats.stepCounts.strategist}</Badge>
          <Badge tone="default">Critic · {account.stats.stepCounts.critic}</Badge>
        </div>
        <div style={{ display: 'grid', gap: '10px' }}>
          <HashRow label="Canonical wallet" value={account.user.wallet} />
        </div>
      </SectionCard>
    </div>
  );
}
