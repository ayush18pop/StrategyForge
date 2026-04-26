import { err, ok } from "./core.js";
import type { Result } from "./core.js";
import { createSigner, type WalletLike } from "./ethers.js";
import { loadStorageSdk } from "./sdk.js";

export interface KVStoreConfig {
  privateKey: string;
  evmRpc: string;
  kvNodeRpc: string;
  streamId: string;
  replicaCount?: number;
}

type BatcherLike = {
  streamDataBuilder: {
    set(streamId: string, key: Buffer, value: Buffer): void;
  };
  exec(): Promise<unknown>;
};

export class KVStore {
  constructor(private readonly config: KVStoreConfig) { }

  async set(key: string, value: string): Promise<Result<void>> {
    const sdkResult = await loadStorageSdk();
    if (!sdkResult.ok) {
      return err(sdkResult.error);
    }

    const signerResult = await createSigner(
      this.config.privateKey,
      this.config.evmRpc,
    );
    if (!signerResult.ok) {
      return err(signerResult.error);
    }

    try {
      const indexerUrl = process.env.OG_INDEXER || process.env.ZG_INDEXER_URL || "https://indexer-storage-testnet-turbo.0g.ai";
      const indexer = new sdkResult.value.Indexer(indexerUrl);
      const [nodes, err1] = await indexer.selectNodes(this.config.replicaCount ?? 1);
      if (err1 != null) { throw new Error(String(err1)); }

      const status = await nodes[0].getStatus();
      const flowAddress = status.networkIdentity.flowAddress;
      const flowContract = sdkResult.value.getFlowContract(flowAddress, signerResult.value);

      const batcher = new sdkResult.value.Batcher(
        this.config.replicaCount ?? 1,
        nodes,
        flowContract,
        this.config.evmRpc,
      ) as BatcherLike;

      batcher.streamDataBuilder.set(
        this.config.streamId,
        Buffer.from(key),
        Buffer.from(value),
      );

      unwrapSdkSuccess(await batcher.exec(), `set KV key ${key}`);
      return ok(undefined);
    } catch (error) {
      return err(normalizeError(error));
    }
  }

  async get(key: string): Promise<Result<string | null>> {
    const sdkResult = await loadStorageSdk();
    if (!sdkResult.ok) {
      return err(sdkResult.error);
    }

    try {
      const kvClient = new sdkResult.value.KvClient(this.config.kvNodeRpc);
      const value = await kvClient.getValue(
        this.config.streamId,
        Buffer.from(key),
      );
      if (value == null) {
        return ok(null);
      }

      return ok(decodeValue(value));
    } catch (error) {
      return err(normalizeError(error));
    }
  }
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

function decodeValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString("utf8");
  }

  if (
    Array.isArray(value) &&
    value.every((entry) => typeof entry === "number")
  ) {
    return Buffer.from(value).toString("utf8");
  }

  if (isRecord(value) && "data" in value) {
    return decodeValue(value.data);
  }

  if (isRecord(value) && "value" in value) {
    return decodeValue(value.value);
  }

  throw new Error("Unsupported KV value returned from 0G KV client");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(stringifyUnknown(error));
}

function stringifyUnknown(value: unknown): string {
  if (value instanceof Error) {
    return value.message;
  }

  if (typeof value === "string") {
    return value;
  }

  const serialized = JSON.stringify(value);
  return serialized ?? String(value);
}
