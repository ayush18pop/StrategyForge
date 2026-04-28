import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { LocalKVStore } from '@strategyforge/storage';

export function createLocalStore(dbPath: string): LocalKVStore {
  mkdirSync(dirname(dbPath), { recursive: true });

  const db = new Database(dbPath, { create: true });

  db.run(`
    CREATE TABLE IF NOT EXISTS kv (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  const stmtSet = db.prepare(
    `INSERT OR REPLACE INTO kv (key, value) VALUES ($key, $value)`,
  );
  const stmtGet = db.prepare<{ value: string }, [string]>(
    `SELECT value FROM kv WHERE key = ?`,
  );

  return {
    set(key: string, value: string): void {
      stmtSet.run({ $key: key, $value: value });
    },
    get(key: string): string | null {
      return stmtGet.get(key)?.value ?? null;
    },
  };
}
