import { err, ok } from '@strategyforge/core';
import type { Result, RiskLevel, StrategyGoal, StrategyVersion } from '@strategyforge/core';
import type { KVStore } from '@strategyforge/storage';

export interface FamilyLatestRecord {
  priorCids: string[];
  goal: StrategyGoal;
  keeperhubWorkflowId?: string;
  monitorIntervalMs: number; // derived from riskLevel at creation
  lastMonitoredAt: number;   // updated by cron after each check
}

export interface FamilyMetaRecord {
  goal: StrategyGoal;
  userWalletAddress: string;
  versions: StrategyVersion[];
  createdAt: number;
}

export async function loadFamilyLatest(
  kvStore: KVStore,
  familyId: string,
): Promise<Result<FamilyLatestRecord | null>> {
  return loadJson<FamilyLatestRecord>(kvStore, latestKey(familyId));
}

export async function loadFamilyMeta(
  kvStore: KVStore,
  familyId: string,
): Promise<Result<FamilyMetaRecord | null>> {
  return loadJson<FamilyMetaRecord>(kvStore, metaKey(familyId));
}

export async function saveFamilyMeta(
  kvStore: KVStore,
  familyId: string,
  meta: FamilyMetaRecord,
): Promise<Result<void>> {
  const latestVersion = latestVersionFor(meta.versions);
  if (!latestVersion) {
    return err(new Error(`Family ${familyId} has no versions to persist`));
  }

  // Preserve lastMonitoredAt so a re-save after a version bump doesn't
  // reset the cron clock and cause an immediate re-check.
  const existingResult = await loadFamilyLatest(kvStore, familyId);
  const lastMonitoredAt =
    existingResult.ok && existingResult.value
      ? existingResult.value.lastMonitoredAt
      : 0;

  const latestRecord: FamilyLatestRecord = {
    priorCids: dedupeCids([...latestVersion.priorCids, latestVersion.cid]),
    goal: meta.goal,
    ...(latestVersion.keeperhubWorkflowId
      ? { keeperhubWorkflowId: latestVersion.keeperhubWorkflowId }
      : {}),
    monitorIntervalMs: monitorIntervalFor(meta.goal.riskLevel),
    lastMonitoredAt,
  };

  const latestWrite = await writeJson(kvStore, latestKey(familyId), latestRecord);
  if (!latestWrite.ok) {
    return latestWrite;
  }

  return writeJson(kvStore, metaKey(familyId), {
    ...meta,
    versions: sortVersions(meta.versions),
  });
}

// Called by the cron after successfully checking a family to advance its clock.
export async function touchLastMonitored(
  kvStore: KVStore,
  familyId: string,
): Promise<void> {
  const existing = await loadFamilyLatest(kvStore, familyId);
  if (!existing.ok || !existing.value) return;
  await writeJson(kvStore, latestKey(familyId), {
    ...existing.value,
    lastMonitoredAt: Date.now(),
  });
}

export function upsertStrategyVersion(
  versions: StrategyVersion[],
  nextVersion: StrategyVersion,
): StrategyVersion[] {
  const existingIndex = versions.findIndex((version) => version.version === nextVersion.version);
  if (existingIndex === -1) {
    return sortVersions([...versions, nextVersion]);
  }

  const copy = versions.slice();
  copy[existingIndex] = nextVersion;
  return sortVersions(copy);
}

function latestKey(familyId: string): string {
  return `family:${familyId}:latest`;
}

function metaKey(familyId: string): string {
  return `family:${familyId}:meta`;
}

async function loadJson<T>(
  kvStore: KVStore,
  key: string,
): Promise<Result<T | null>> {
  const result = await kvStore.get(key);
  if (!result.ok) {
    return err(result.error);
  }

  if (result.value === null) {
    return ok(null);
  }

  try {
    return ok(JSON.parse(result.value) as T);
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

async function writeJson(
  kvStore: KVStore,
  key: string,
  value: unknown,
): Promise<Result<void>> {
  return kvStore.set(key, JSON.stringify(value));
}

function latestVersionFor(versions: StrategyVersion[]): StrategyVersion | undefined {
  return sortVersions(versions)[versions.length - 1];
}

function sortVersions(versions: StrategyVersion[]): StrategyVersion[] {
  return versions.slice().sort((left, right) => left.version - right.version);
}

function dedupeCids(cids: string[]): string[] {
  return Array.from(new Set(cids));
}

function monitorIntervalFor(riskLevel: RiskLevel): number {
  switch (riskLevel) {
    case 'conservative': return 24 * 60 * 60 * 1000; // 24 h — stable positions change slowly
    case 'balanced':     return  6 * 60 * 60 * 1000; //  6 h — more market exposure
  }
}

// ─── Family Index (for monitoring cron) ─────────────────────────

const FAMILIES_INDEX_KEY = 'families:index';

/**
 * Register a familyId in the global index.
 * Called after every strategy creation so the monitoring cron can discover it.
 */
export async function registerFamilyId(
  kvStore: KVStore,
  familyId: string,
): Promise<Result<void>> {
  const existing = await listFamilyIds(kvStore);
  const ids = existing.ok ? existing.value : [];
  if (ids.includes(familyId)) {
    return ok(undefined);
  }
  ids.push(familyId);
  return kvStore.set(FAMILIES_INDEX_KEY, JSON.stringify(ids));
}

/**
 * List all tracked family IDs. Returns empty array on errors.
 */
export async function listFamilyIds(
  kvStore: KVStore,
): Promise<Result<string[]>> {
  const result = await kvStore.get(FAMILIES_INDEX_KEY);
  if (!result.ok) {
    return ok([]); // Graceful fallback — don't block cron
  }
  if (result.value === null) {
    return ok([]);
  }
  try {
    const parsed = JSON.parse(result.value);
    return ok(Array.isArray(parsed) ? parsed : []);
  } catch {
    return ok([]);
  }
}
