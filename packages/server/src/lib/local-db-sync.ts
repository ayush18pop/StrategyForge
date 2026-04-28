import type { EvidenceBundle, StrategyVersion } from '@strategyforge/core';
import type { LocalDB } from './local-store.js';
import type { FamilyMetaRecord } from './kv-meta.js';

export function syncLocalFamily(
  localDb: LocalDB,
  familyId: string,
  meta: FamilyMetaRecord,
): void {
  const updatedAt = latestVersionTimestamp(meta.versions, meta.createdAt);
  localDb.touchUser(meta.userWalletAddress, { timestamp: updatedAt });
  localDb.upsertFamily(familyId, {
    goal: meta.goal,
    wallet: meta.userWalletAddress,
    versions: meta.versions,
    createdAt: meta.createdAt,
    updatedAt,
  });
}

export function syncLocalAttestations(
  localDb: LocalDB,
  wallet: string,
  strategy: StrategyVersion,
  evidenceBundle: EvidenceBundle,
): void {
  localDb.recordAttestations([
    {
      familyId: strategy.familyId,
      version: strategy.version,
      wallet,
      step: 'researcher',
      attestationHash: evidenceBundle.pipeline.researcher.attestationHash,
      strategyCid: strategy.cid,
      evidenceBundleCid: strategy.evidenceBundleCid,
      storageStatus: storageStatusForCid(strategy.evidenceBundleCid),
      createdAt: evidenceBundle.pipeline.researcher.timestamp,
    },
    {
      familyId: strategy.familyId,
      version: strategy.version,
      wallet,
      step: 'strategist',
      attestationHash: evidenceBundle.pipeline.strategist.attestationHash,
      strategyCid: strategy.cid,
      evidenceBundleCid: strategy.evidenceBundleCid,
      storageStatus: storageStatusForCid(strategy.evidenceBundleCid),
      createdAt: evidenceBundle.pipeline.strategist.timestamp,
    },
    {
      familyId: strategy.familyId,
      version: strategy.version,
      wallet,
      step: 'critic',
      attestationHash: evidenceBundle.pipeline.critic.attestationHash,
      strategyCid: strategy.cid,
      evidenceBundleCid: strategy.evidenceBundleCid,
      storageStatus: storageStatusForCid(strategy.evidenceBundleCid),
      createdAt: evidenceBundle.pipeline.critic.timestamp,
    },
  ]);
}

export function localFamilyToMetaRecord(record: {
  goal: FamilyMetaRecord['goal'];
  wallet: string;
  versions: FamilyMetaRecord['versions'];
  createdAt: number;
}): FamilyMetaRecord {
  return {
    goal: record.goal,
    userWalletAddress: record.wallet,
    versions: record.versions,
    createdAt: record.createdAt,
  };
}

function latestVersionTimestamp(versions: StrategyVersion[], fallback: number): number {
  const latest = versions
    .slice()
    .sort((left, right) => left.version - right.version)
    .at(-1);
  return latest?.createdAt ?? fallback;
}

function storageStatusForCid(cid: string): 'anchored' | 'pending' {
  return cid.startsWith('pending:') ? 'pending' : 'anchored';
}
