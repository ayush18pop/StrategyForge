import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { StrategyGoal, StrategyVersion } from '@strategyforge/core';
import type { LocalKVStore } from '@strategyforge/storage';

export interface FamilyRecord {
  familyId: string;
  goal: StrategyGoal;
  wallet: string;
  versions: StrategyVersion[];
  createdAt: number;
  updatedAt: number;
}

export interface UserRecord {
  wallet: string;
  displayName: string | null;
  createdAt: number;
  updatedAt: number;
  lastActiveAt: number;
}

export interface NewAttestationRecord {
  familyId: string;
  version: number;
  wallet: string;
  step: 'researcher' | 'strategist' | 'critic';
  attestationHash: string;
  strategyCid: string;
  evidenceBundleCid: string;
  storageStatus: 'anchored' | 'pending';
  createdAt: number;
}

export interface AttestationRecord extends NewAttestationRecord {
  id: number;
}

export interface LocalDB extends LocalKVStore {
  touchUser(wallet: string, options?: { displayName?: string | null; timestamp?: number }): UserRecord;
  getUser(wallet: string): UserRecord | null;
  listUsers(): UserRecord[];
  upsertFamily(familyId: string, record: Omit<FamilyRecord, 'familyId'>): void;
  getFamily(familyId: string): FamilyRecord | null;
  listFamilies(): FamilyRecord[];
  listFamiliesByWallet(wallet: string): FamilyRecord[];
  deleteFamily(familyId: string): void;
  recordAttestations(records: NewAttestationRecord[]): void;
  listAttestationsByWallet(wallet: string, limit?: number): AttestationRecord[];
  listAttestationsByFamily(familyId: string): AttestationRecord[];
}

interface FamilyRow {
  family_id: string;
  goal: string;
  wallet: string;
  versions: string;
  created_at: number;
  updated_at: number;
}

interface UserRow {
  wallet: string;
  display_name: string | null;
  created_at: number;
  updated_at: number;
  last_active_at: number;
}

interface AttestationRow {
  id: number;
  family_id: string;
  version: number;
  wallet: string;
  step: NewAttestationRecord['step'];
  attestation_hash: string;
  strategy_cid: string;
  evidence_bundle_cid: string;
  storage_status: NewAttestationRecord['storageStatus'];
  created_at: number;
}

interface KvRow {
  key: string;
  value: string;
}

interface KvFamilyMetaRecord {
  goal: StrategyGoal;
  userWalletAddress: string;
  versions: StrategyVersion[];
  createdAt: number;
}

export function createLocalStore(dbPath: string): LocalDB {
  mkdirSync(dirname(dbPath), { recursive: true });

  const db = new Database(dbPath, { create: true });

  db.run(`
    CREATE TABLE IF NOT EXISTS kv (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      wallet          TEXT PRIMARY KEY,
      display_name    TEXT,
      created_at      INTEGER NOT NULL,
      updated_at      INTEGER NOT NULL,
      last_active_at  INTEGER NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS families (
      family_id    TEXT PRIMARY KEY,
      goal         TEXT NOT NULL,
      wallet       TEXT NOT NULL,
      versions     TEXT NOT NULL,
      created_at   INTEGER NOT NULL,
      updated_at   INTEGER NOT NULL,
      FOREIGN KEY (wallet) REFERENCES users(wallet)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS attestations (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      family_id           TEXT NOT NULL,
      version             INTEGER NOT NULL,
      wallet              TEXT NOT NULL,
      step                TEXT NOT NULL,
      attestation_hash    TEXT NOT NULL,
      strategy_cid        TEXT NOT NULL,
      evidence_bundle_cid TEXT NOT NULL,
      storage_status      TEXT NOT NULL,
      created_at          INTEGER NOT NULL,
      UNIQUE(family_id, version, step, attestation_hash)
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_families_wallet ON families(wallet, updated_at DESC)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_attestations_wallet ON attestations(wallet, created_at DESC)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_attestations_family ON attestations(family_id, version, created_at DESC)`);

  const stmtSet = db.prepare(
    `INSERT OR REPLACE INTO kv (key, value) VALUES ($key, $value)`,
  );
  const stmtGet = db.prepare<{ value: string }, [string]>(
    `SELECT value FROM kv WHERE key = ?`,
  );

  const stmtGetUser = db.prepare<UserRow, [string]>(
    `SELECT wallet, display_name, created_at, updated_at, last_active_at FROM users WHERE wallet = ?`,
  );
  const stmtListUsers = db.prepare<UserRow, []>(
    `SELECT wallet, display_name, created_at, updated_at, last_active_at FROM users ORDER BY updated_at DESC`,
  );
  const stmtUpsertUser = db.prepare(
    `INSERT OR REPLACE INTO users (wallet, display_name, created_at, updated_at, last_active_at)
     VALUES ($wallet, $display_name, $created_at, $updated_at, $last_active_at)`,
  );

  const stmtUpsertFamily = db.prepare(
    `INSERT OR REPLACE INTO families (family_id, goal, wallet, versions, created_at, updated_at)
     VALUES ($family_id, $goal, $wallet, $versions, $created_at, $updated_at)`,
  );
  const stmtGetFamily = db.prepare<FamilyRow, [string]>(
    `SELECT family_id, goal, wallet, versions, created_at, updated_at FROM families WHERE family_id = ?`,
  );
  const stmtListFamilies = db.prepare<FamilyRow, []>(
    `SELECT family_id, goal, wallet, versions, created_at, updated_at FROM families ORDER BY updated_at DESC`,
  );
  const stmtListFamiliesByWallet = db.prepare<FamilyRow, [string]>(
    `SELECT family_id, goal, wallet, versions, created_at, updated_at FROM families WHERE wallet = ? ORDER BY updated_at DESC`,
  );
  const stmtDeleteFamily = db.prepare(
    `DELETE FROM families WHERE family_id = ?`,
  );

  const stmtInsertAttestation = db.prepare(
    `INSERT OR IGNORE INTO attestations (
      family_id,
      version,
      wallet,
      step,
      attestation_hash,
      strategy_cid,
      evidence_bundle_cid,
      storage_status,
      created_at
    ) VALUES (
      $family_id,
      $version,
      $wallet,
      $step,
      $attestation_hash,
      $strategy_cid,
      $evidence_bundle_cid,
      $storage_status,
      $created_at
    )`,
  );
  const stmtListAttestationsByWallet = db.prepare<AttestationRow, [string]>(
    `SELECT
      id,
      family_id,
      version,
      wallet,
      step,
      attestation_hash,
      strategy_cid,
      evidence_bundle_cid,
      storage_status,
      created_at
     FROM attestations
     WHERE wallet = ?
     ORDER BY created_at DESC, id DESC`,
  );
  const stmtListAttestationsByFamily = db.prepare<AttestationRow, [string]>(
    `SELECT
      id,
      family_id,
      version,
      wallet,
      step,
      attestation_hash,
      strategy_cid,
      evidence_bundle_cid,
      storage_status,
      created_at
     FROM attestations
     WHERE family_id = ?
     ORDER BY created_at DESC, id DESC`,
  );
  const stmtListKvFamilyMeta = db.prepare<KvRow, []>(
    `SELECT key, value FROM kv WHERE key LIKE 'family:%:meta' ORDER BY key ASC`,
  );

  const touchUserRecord = (
    wallet: string,
    options?: { displayName?: string | null; timestamp?: number },
  ): UserRecord => {
    const timestamp = options?.timestamp ?? Date.now();
    const existing = stmtGetUser.get(wallet);
    const next: UserRecord = {
      wallet,
      displayName: options?.displayName !== undefined ? options.displayName : existing?.display_name ?? null,
      createdAt: existing?.created_at ?? timestamp,
      updatedAt: timestamp,
      lastActiveAt: timestamp,
    };

    stmtUpsertUser.run({
      $wallet: next.wallet,
      $display_name: next.displayName,
      $created_at: next.createdAt,
      $updated_at: next.updatedAt,
      $last_active_at: next.lastActiveAt,
    });

    return next;
  };

  const upsertFamilyRecord = (
    familyId: string,
    record: Omit<FamilyRecord, 'familyId'>,
  ): void => {
    touchUserRecord(record.wallet, { timestamp: record.updatedAt });
    const existing = stmtGetFamily.get(familyId);
    const createdAt = existing?.created_at ?? record.createdAt;

    stmtUpsertFamily.run({
      $family_id: familyId,
      $goal: JSON.stringify(record.goal),
      $wallet: record.wallet,
      $versions: JSON.stringify(sortVersions(record.versions)),
      $created_at: createdAt,
      $updated_at: record.updatedAt,
    });
  };

  const recordAttestationSet = db.transaction((records: NewAttestationRecord[]) => {
    for (const record of records) {
      touchUserRecord(record.wallet, { timestamp: record.createdAt });
      stmtInsertAttestation.run({
        $family_id: record.familyId,
        $version: record.version,
        $wallet: record.wallet,
        $step: record.step,
        $attestation_hash: record.attestationHash,
        $strategy_cid: record.strategyCid,
        $evidence_bundle_cid: record.evidenceBundleCid,
        $storage_status: record.storageStatus,
        $created_at: record.createdAt,
      });
    }
  });

  hydrateFamiliesFromKv(stmtListKvFamilyMeta.all(), upsertFamilyRecord, touchUserRecord);

  return {
    set(key: string, value: string): void {
      stmtSet.run({ $key: key, $value: value });
    },

    get(key: string): string | null {
      return stmtGet.get(key)?.value ?? null;
    },

    touchUser(wallet: string, options?: { displayName?: string | null; timestamp?: number }): UserRecord {
      return touchUserRecord(wallet, options);
    },

    getUser(wallet: string): UserRecord | null {
      const row = stmtGetUser.get(wallet);
      return row ? mapUserRow(row) : null;
    },

    listUsers(): UserRecord[] {
      return stmtListUsers.all().map(mapUserRow);
    },

    upsertFamily(familyId: string, record: Omit<FamilyRecord, 'familyId'>): void {
      upsertFamilyRecord(familyId, record);
    },

    getFamily(familyId: string): FamilyRecord | null {
      const row = stmtGetFamily.get(familyId);
      return row ? mapFamilyRow(row) : null;
    },

    listFamilies(): FamilyRecord[] {
      return stmtListFamilies.all().map(mapFamilyRow);
    },

    listFamiliesByWallet(wallet: string): FamilyRecord[] {
      return stmtListFamiliesByWallet.all(wallet).map(mapFamilyRow);
    },

    deleteFamily(familyId: string): void {
      stmtDeleteFamily.run(familyId);
    },

    recordAttestations(records: NewAttestationRecord[]): void {
      recordAttestationSet(records);
    },

    listAttestationsByWallet(wallet: string, limit?: number): AttestationRecord[] {
      const rows = stmtListAttestationsByWallet.all(wallet).map(mapAttestationRow);
      if (typeof limit !== 'number' || limit <= 0) {
        return rows;
      }
      return rows.slice(0, limit);
    },

    listAttestationsByFamily(familyId: string): AttestationRecord[] {
      return stmtListAttestationsByFamily.all(familyId).map(mapAttestationRow);
    },
  };
}

function hydrateFamiliesFromKv(
  rows: KvRow[],
  upsertFamilyRecord: (familyId: string, record: Omit<FamilyRecord, 'familyId'>) => void,
  touchUserRecord: (wallet: string, options?: { displayName?: string | null; timestamp?: number }) => UserRecord,
): void {
  for (const row of rows) {
    const familyId = parseFamilyIdFromMetaKey(row.key);
    if (!familyId) {
      continue;
    }

    const parsed = safeJsonParse<KvFamilyMetaRecord>(row.value);
    if (!parsed || typeof parsed.userWalletAddress !== 'string') {
      continue;
    }

    const updatedAt = latestVersionTimestamp(parsed.versions, parsed.createdAt);
    touchUserRecord(parsed.userWalletAddress, { timestamp: updatedAt });
    upsertFamilyRecord(familyId, {
      goal: parsed.goal,
      wallet: parsed.userWalletAddress,
      versions: parsed.versions,
      createdAt: parsed.createdAt,
      updatedAt,
    });
  }
}

function parseFamilyIdFromMetaKey(key: string): string | null {
  const match = /^family:(.+):meta$/.exec(key);
  return match?.[1] ?? null;
}

function mapUserRow(row: UserRow): UserRecord {
  return {
    wallet: row.wallet,
    displayName: row.display_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastActiveAt: row.last_active_at,
  };
}

function mapFamilyRow(row: FamilyRow): FamilyRecord {
  return {
    familyId: row.family_id,
    goal: safeJsonParse<StrategyGoal>(row.goal) ?? emptyGoal(),
    wallet: row.wallet,
    versions: sortVersions(safeJsonParse<StrategyVersion[]>(row.versions) ?? []),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAttestationRow(row: AttestationRow): AttestationRecord {
  return {
    id: row.id,
    familyId: row.family_id,
    version: row.version,
    wallet: row.wallet,
    step: row.step,
    attestationHash: row.attestation_hash,
    strategyCid: row.strategy_cid,
    evidenceBundleCid: row.evidence_bundle_cid,
    storageStatus: row.storage_status,
    createdAt: row.created_at,
  };
}

function latestVersionTimestamp(versions: StrategyVersion[], fallback: number): number {
  const latest = sortVersions(versions).at(-1);
  return latest?.createdAt ?? fallback;
}

function sortVersions(versions: StrategyVersion[]): StrategyVersion[] {
  return versions.slice().sort((left, right) => left.version - right.version);
}

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function emptyGoal(): StrategyGoal {
  return {
    asset: '',
    amount: 0,
    riskLevel: 'balanced',
    horizon: '',
    chains: [],
    targetYield: 0,
  };
}
