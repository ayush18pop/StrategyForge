import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

import { err, ok } from './core.js';
import type { EvidenceBundle, Result } from './core.js';
import { createSigner, type WalletLike } from './ethers.js';
import { loadStorageSdk } from './sdk.js';

export interface EvidenceStoreConfig {
  privateKey: string;
  evmRpc: string;
  indexerUrl: string;
  tempDir?: string;
}

type MerkleTreeLike = {
  rootHash(): string;
};

type Closeable = {
  close?: () => Promise<void> | void;
};

export class EvidenceStore {
  private readonly tempDirRoot: string;

  constructor(private readonly config: EvidenceStoreConfig) {
    this.tempDirRoot = config.tempDir ?? tmpdir();
  }

  async writeBundle(bundle: EvidenceBundle): Promise<Result<{ cid: string }>> {
    const sdkResult = await loadStorageSdk();
    if (!sdkResult.ok) {
      return err(sdkResult.error);
    }

    const signerResult = await createSigner(this.config.privateKey, this.config.evmRpc);
    if (!signerResult.ok) {
      return err(signerResult.error);
    }

    const indexer = new sdkResult.value.Indexer(this.config.indexerUrl);
    const data = new sdkResult.value.MemData(Buffer.from(JSON.stringify(bundle)));
    const signer: WalletLike = signerResult.value;

    try {
      const tree = unwrapSdkValue<MerkleTreeLike>(
        await data.merkleTree(),
        'build evidence Merkle tree',
      );

      unwrapSdkSuccess(
        await indexer.upload(data, this.config.evmRpc, signer),
        'upload evidence bundle',
      );

      return ok({ cid: tree.rootHash() });
    } catch (error) {
      return err(normalizeError(error));
    } finally {
      await maybeClose(data);
    }
  }

  async readBundle(cid: string): Promise<Result<EvidenceBundle>> {
    let tempPath: string | null = null;

    const sdkResult = await loadStorageSdk();
    if (!sdkResult.ok) {
      return err(sdkResult.error);
    }

    const indexer = new sdkResult.value.Indexer(this.config.indexerUrl);

    try {
      tempPath = await this.makeTempPath(cid);

      unwrapSdkSuccess(
        await indexer.download(cid, tempPath, true),
        `download evidence bundle ${cid}`,
      );

      const raw = await readFile(tempPath, 'utf8');
      const parsed = JSON.parse(raw) as unknown;

      if (!isEvidenceBundle(parsed)) {
        return err(new Error(`Downloaded content for CID ${cid} is not an EvidenceBundle`));
      }

      return ok(parsed);
    } catch (error) {
      return err(normalizeError(error));
    } finally {
      if (tempPath !== null) {
        await rm(tempPath, { force: true }).catch(() => undefined);
        await rm(dirname(tempPath), { recursive: true, force: true }).catch(() => undefined);
      }
    }
  }

  async loadPriorVersions(priorCids: string[]): Promise<Result<EvidenceBundle[]>> {
    const loadedBundles: EvidenceBundle[] = [];
    const failures: string[] = [];

    for (const cid of priorCids) {
      const result = await this.readBundle(cid);
      if (result.ok) {
        loadedBundles.push(result.value);
        continue;
      }

      failures.push(`${cid}: ${result.error.message}`);
    }

    if (loadedBundles.length === 0 && failures.length > 0) {
      return err(new Error(`Failed to load prior versions: ${failures.join('; ')}`));
    }

    if (failures.length > 0) {
      console.warn(
        `[EvidenceStore] Skipped ${failures.length} prior version(s): ${failures.join('; ')}`,
      );
    }

    loadedBundles.sort((left, right) => left.version - right.version);
    return ok(loadedBundles);
  }

  private async makeTempPath(cid: string): Promise<string> {
    const directory = await mkdtemp(join(this.tempDirRoot, 'strategyforge-evidence-'));
    return join(directory, `${encodeURIComponent(cid)}.json`);
  }
}

function unwrapSdkValue<T>(value: unknown, action: string): T {
  if (Array.isArray(value)) {
    const [result, sdkError] = value as [unknown, unknown];
    if (sdkError != null) {
      throw new Error(`Failed to ${action}: ${stringifyUnknown(sdkError)}`);
    }

    if (result == null) {
      throw new Error(`Failed to ${action}: SDK returned no value`);
    }

    return result as T;
  }

  if (value == null) {
    throw new Error(`Failed to ${action}: SDK returned no value`);
  }

  return value as T;
}

function unwrapSdkSuccess(value: unknown, action: string): void {
  if (!Array.isArray(value)) {
    return;
  }

  const [, sdkError] = value as [unknown, unknown];
  if (sdkError != null) {
    throw new Error(`Failed to ${action}: ${stringifyUnknown(sdkError)}`);
  }
}

async function maybeClose(target: Closeable): Promise<void> {
  if (typeof target.close !== 'function') {
    return;
  }

  await target.close();
}

function isEvidenceBundle(value: unknown): value is EvidenceBundle {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.strategyFamily === 'string' &&
    typeof value.version === 'number' &&
    typeof value.createdAt === 'number' &&
    Array.isArray(value.priorCids) &&
    isRecord(value.pipeline)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(stringifyUnknown(error));
}

function stringifyUnknown(value: unknown): string {
  if (value instanceof Error) {
    return value.message;
  }

  if (typeof value === 'string') {
    return value;
  }

  const serialized = JSON.stringify(value);
  return serialized ?? String(value);
}
