import { err, ok } from "./core.js";
import type { EvidenceBundle, Result } from "./core.js";
import { loadStorageSdk } from "./sdk.js";
import { createSigner } from "./ethers.js";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

export interface EvidenceStoreConfig {
  privateKey: string;
  evmRpc: string;
  indexerUrl: string;
  storageUrl?: string; // OG_STORAGE_URL — bypass indexer-discovered nodes for uploads
}

export class EvidenceStore {
  // In-memory cache keyed by CID (real hash OR pending:... placeholder).
  // Allows readBundle() to serve bundles within a server session even when
  // the 0G upload failed and the CID is a pending placeholder — critical for
  // the self-improvement loop when storage nodes are flaky.
  private readonly cache = new Map<string, EvidenceBundle>();

  constructor(private readonly config: EvidenceStoreConfig) { }

  async writeBundle(bundle: EvidenceBundle): Promise<Result<{ cid: string }>> {
    try {
      const signerResult = await createSigner(
        this.config.privateKey,
        this.config.evmRpc,
      );
      if (!signerResult.ok) return err(signerResult.error);

      const sdkResult = await loadStorageSdk();
      if (!sdkResult.ok) return err(sdkResult.error);
      const { Indexer, MemData } = sdkResult.value;

      const indexer = new Indexer(this.config.indexerUrl);

      const dataString = JSON.stringify(bundle);
      const data = Buffer.from(dataString, "utf8");
      const memData = new MemData(data);

      const [tree, treeErr] = (await memData.merkleTree()) as [
        { rootHash(): string } | undefined,
        unknown,
      ];
      if (treeErr !== null) throw new Error(`Merkle tree error: ${treeErr}`);

      const rootHash = tree?.rootHash();
      if (!rootHash) throw new Error("Merkle tree returned empty root hash");

      const uploadTimeoutMs = readUploadTimeoutMs();
      const finalityRequired = readFinalityRequired();

      const uploadResult = await attemptUploadWithRetries({
        indexer,
        memData,
        evmRpc: this.config.evmRpc,
        signer: signerResult.value,
        finalityRequired,
        uploadTimeoutMs,
      });
      if (!uploadResult.ok) {
        throw uploadResult.error;
      }

      this.cache.set(rootHash, bundle);
      return ok({ cid: rootHash });
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  // Cache a bundle under an arbitrary CID key (e.g. a pending: placeholder).
  // Called by the pipeline when writeBundle() fails so readBundle() can still
  // serve the bundle within the same server session.
  cacheBundle(cid: string, bundle: EvidenceBundle): void {
    this.cache.set(cid, bundle);
  }

  async readBundle(cid: string): Promise<Result<EvidenceBundle>> {
    const cached = this.cache.get(cid);
    if (cached !== undefined) {
      return ok(cached);
    }
    let tempDir: string | null = null;
    try {
      const sdkResult = await loadStorageSdk();
      if (!sdkResult.ok) return err(sdkResult.error);
      const { Indexer } = sdkResult.value;

      const indexer = new Indexer(this.config.indexerUrl);

      tempDir = await mkdtemp(join(tmpdir(), "strategyforge-evidence-"));
      const outputPath = join(tempDir, `${cid}.json`);

      const [, dlErr] = (await indexer.download(cid, outputPath, true)) as [
        unknown,
        unknown,
      ];
      if (dlErr !== null) throw new Error(`Download error: ${dlErr}`);

      const text = await readFile(outputPath, "utf8");
      const parsed = JSON.parse(text) as EvidenceBundle;

      return ok(parsed);
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    } finally {
      if (tempDir) {
        await rm(tempDir, { recursive: true, force: true });
      }
    }
  }

  async loadPriorVersions(cids: string[]): Promise<Result<EvidenceBundle[]>> {
    const bundles: EvidenceBundle[] = [];

    for (const cid of cids) {
      const result = await this.readBundle(cid);
      if (!result.ok) {
        console.warn(
          `[EvidenceStore] failed to load prior CID ${cid}: ${result.error.message}`,
        );
        continue;
      }
      bundles.push(result.value);
    }

    bundles.sort((a, b) => a.version - b.version);
    return ok(bundles);
  }
}

function readFinalityRequired(): boolean {
  const raw = (process.env.OG_STORAGE_FINALITY_REQUIRED ?? "")
    .trim()
    .toLowerCase();
  if (raw === "true" || raw === "1" || raw === "yes") {
    return true;
  }
  if (raw === "false" || raw === "0" || raw === "no") {
    return false;
  }
  // Default to non-blocking mode for local/dev workflows.
  return false;
}

function readUploadTimeoutMs(): number {
  const raw = process.env.OG_STORAGE_UPLOAD_TIMEOUT_MS;
  if (!raw) {
    return 120_000;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 120_000;
  }

  return parsed;
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(timeoutMessage));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function attemptUploadWithRetries(input: {
  indexer: {
    upload(
      data: unknown,
      evmRpc: string,
      signer: unknown,
      uploadOpts?: {
        finalityRequired?: boolean;
        expectedReplica?: number;
        skipIfFinalized?: boolean;
        onProgress?: (message: string) => void;
      },
    ): Promise<unknown>;
  };
  memData: unknown;
  evmRpc: string;
  signer: unknown;
  finalityRequired: boolean;
  uploadTimeoutMs: number;
}): Promise<Result<void>> {
  const attempts: Array<{ finalityRequired: boolean; timeoutMs: number }> = [
    {
      finalityRequired: input.finalityRequired,
      timeoutMs: input.uploadTimeoutMs,
    },
  ];

  for (let index = 0; index < attempts.length; index += 1) {
    const attempt = attempts[index]!;
    const [, uploadErr] = (await withTimeout(
      input.indexer.upload(input.memData, input.evmRpc, input.signer, {
        finalityRequired: attempt.finalityRequired,
        expectedReplica: 1,
        skipIfFinalized: true,
        onProgress: (message: string) =>
          console.log(`[EvidenceStore] upload: ${message}`),
      }),
      attempt.timeoutMs,
      `0G upload timed out after ${attempt.timeoutMs}ms. ` +
      `Set OG_STORAGE_UPLOAD_TIMEOUT_MS to a higher value or set ` +
      `OG_STORAGE_FINALITY_REQUIRED=true to wait for network finality.`,
    )) as [unknown, unknown];

    if (uploadErr === null) {
      return ok(undefined);
    }

    const isLastAttempt = index === attempts.length - 1;
    if (isLastAttempt) {
      return err(new Error(`Upload error: ${uploadErr}`));
    }

    console.warn(
      `[EvidenceStore] upload attempt ${index + 1} failed: ${String(uploadErr)}. Retrying with finality enabled and a longer timeout.`,
    );
  }

  return err(new Error("Upload failed for an unknown reason"));
}
