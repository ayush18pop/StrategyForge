import { err, ok } from "./core.js";
import type { Result } from "./core.js";
import { loadStorageSdk } from "./sdk.js";
import { createSigner } from "./ethers.js";

// Synchronous local persistence interface — implemented by the server layer
// (e.g. SQLite via bun:sqlite). Injected into KVStore so it survives restarts
// without depending on the 0G KV network being reachable.
export interface LocalKVStore {
  set(key: string, value: string): void;
  get(key: string): string | null;
}

export interface KVStoreConfig {
  privateKey: string;
  evmRpc: string;
  kvNodeRpc?: string;
  streamId: string;
  indexerUrl?: string;
  replicaCount?: number;
  flowContractAddress?: string; // OG_FLOW_CONTRACT_ADDRESS — bypasses flaky getStatus()
  storageUrl?: string; // OG_STORAGE_URL — local storage node (e.g. http://127.0.0.1:5678)
  localStore?: LocalKVStore; // persistent fallback (e.g. SQLite) — survives restarts
}

export class KVStore {
  // Write-through cache: set() writes here immediately and returns ok().
  // Network writes happen async. get() checks cache first so reads are
  // instant within a server session regardless of KV node latency.
  private readonly cache = new Map<string, string>();

  constructor(private readonly config: KVStoreConfig) { }

  async set(key: string, value: string): Promise<Result<void>> {
    // 1. Hot cache — instant, session-scoped.
    this.cache.set(key, value);
    // 2. Local persistent store — survives server restarts.
    this.config.localStore?.set(key, value);
    // 3. 0G KV network — async best-effort for decentralized persistence.
    this.writeToNetwork(key, value).catch((e) =>
      console.warn(`[KVStore] background network write failed for "${key}":`, (e as Error).message),
    );
    return ok(undefined);
  }

  async get(key: string): Promise<Result<string | null>> {
    // 1. Hot cache hit — zero latency.
    const cached = this.cache.get(key);
    if (cached !== undefined) {
      return ok(cached);
    }
    // 2. Local persistent store — fast sync read, survives restarts.
    const local = this.config.localStore?.get(key) ?? null;
    if (local !== null) {
      this.cache.set(key, local); // repopulate hot cache
      return ok(local);
    }
    // 3. Cold miss — fall through to the 0G KV network.
    return this.readFromNetwork(key);
  }

  private async writeToNetwork(key: string, value: string): Promise<void> {
    const signerResult = await createSigner(
      this.config.privateKey,
      this.config.evmRpc,
    );
    if (!signerResult.ok) throw signerResult.error;

    const sdkResult = await loadStorageSdk();
    if (!sdkResult.ok) throw sdkResult.error;
    const { Indexer, Batcher, StorageNode, getFlowContract } = sdkResult.value;

    let storageNodes: any[];
    if (this.config.storageUrl) {
      storageNodes = [new StorageNode(this.config.storageUrl)];
    } else {
      const indexerRpc =
        this.config.indexerUrl || "https://indexer-storage-testnet-turbo.0g.ai";
      const indexer = new Indexer(indexerRpc);
      const [nodes, selectErr] = await indexer.selectNodes(
        this.config.replicaCount ?? 1,
      );
      if (selectErr !== null || !nodes || nodes.length === 0) {
        throw new Error(`Failed to select storage nodes: ${String(selectErr)}`);
      }
      storageNodes = nodes;
    }

    const flowAddress = await resolveFlowAddress(
      storageNodes,
      this.config.flowContractAddress,
    );
    if (!flowAddress) {
      throw new Error(
        "Could not resolve flow contract address. " +
        "Set OG_FLOW_CONTRACT_ADDRESS in env to bypass getStatus().",
      );
    }

    const flow = getFlowContract(flowAddress, signerResult.value);
    const batcher = new Batcher(
      1,
      storageNodes,
      flow,
      this.config.evmRpc,
    );

    const keyBytes = Buffer.from(key, "utf-8");
    const valueBytes = Buffer.from(value, "utf-8");
    batcher.streamDataBuilder.set(this.config.streamId, keyBytes, valueBytes);

    const [, batchErr] = (await batcher.exec()) as [unknown, unknown];
    if (batchErr !== null) throw new Error(`Batch execution error: ${batchErr}`);
  }

  private async readFromNetwork(key: string): Promise<Result<string | null>> {
    try {
      const sdkResult = await loadStorageSdk();
      if (!sdkResult.ok) return err(sdkResult.error);
      const { Indexer, KvClient } = sdkResult.value;

      const indexerRpc =
        this.config.indexerUrl || "https://indexer-storage-testnet-turbo.0g.ai";
      const indexer = new Indexer(indexerRpc);
      const endpointResult = await selectKvReadEndpoint(
        indexer,
        this.config.kvNodeRpc,
      );
      if (!endpointResult.ok) return err(endpointResult.error);

      const kvClient = new KvClient(endpointResult.value);

      const keyBytes = Buffer.from(key, "utf-8");
      const value = await kvClient.getValue(this.config.streamId, keyBytes);

      if (value == null) {
        return ok(null);
      }

      const decoded = decodeValue(value);
      // Populate cache so future reads don't hit the network.
      this.cache.set(key, decoded);
      return ok(decoded);
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }
}

async function resolveFlowAddress(
  storageNodes: import("./sdk.js").StorageNodeClient[],
  override?: string,
): Promise<string | null> {
  // Fast path: use the env-configured address and skip the flaky RPC.
  if (override && override.length > 0) {
    return override;
  }

  // Try each storage node with a 10s timeout.
  for (const node of storageNodes) {
    try {
      const status = await Promise.race([
        node.getStatus(),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error("getStatus() timed out after 10s")), 10_000),
        ),
      ]);
      const addr = status?.networkIdentity?.flowAddress;
      if (addr) return addr;
    } catch {
      // Try next node.
    }
  }

  return null;
}

async function selectKvReadEndpoint(
  indexer: unknown,
  fallbackEndpoint: string | undefined,
): Promise<Result<string>> {
  if (shouldPreferExplicitKvNode(fallbackEndpoint)) {
    return ok(fallbackEndpoint as string);
  }

  const maybeIndexer = indexer as {
    selectNodes?: (
      count: number,
    ) => Promise<[unknown[] | null | undefined, unknown]>;
  };

  if (typeof maybeIndexer.selectNodes === "function") {
    const [nodes, nodeErr] = await maybeIndexer.selectNodes(1);
    if (nodeErr === null && nodes && nodes.length > 0) {
      const url = extractNodeUrl(nodes[0]);
      if (url) {
        return ok(url);
      }
    }
  }

  if (fallbackEndpoint && fallbackEndpoint.length > 0) {
    return ok(fallbackEndpoint);
  }

  return err(
    new Error(
      "Unable to resolve KV read endpoint from indexer and no OG_KV_NODE_RPC fallback is configured.",
    ),
  );
}

function shouldPreferExplicitKvNode(endpoint: string | undefined): boolean {
  if (!endpoint || endpoint.length === 0) {
    return false;
  }

  const preference = (process.env.OG_KV_NODE_PREFERENCE ?? "explicit")
    .trim()
    .toLowerCase();

  // Default behavior: use the explicitly configured KV node first.
  // Set OG_KV_NODE_PREFERENCE=indexer to force indexer-selected nodes.
  return preference !== "indexer";
}

function extractNodeUrl(node: unknown): string | null {
  if (typeof node === "string" && node.length > 0) {
    return node;
  }

  if (typeof node === "object" && node !== null && "url" in node) {
    const { url } = node as { url?: unknown };
    if (typeof url === "string" && url.length > 0) {
      return url;
    }
  }

  return null;
}

function decodeValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
    return Buffer.from(value).toString("utf8");
  }
  if (
    Array.isArray(value) &&
    value.every((entry) => typeof entry === "number")
  ) {
    return Buffer.from(value).toString("utf8");
  }
  if (typeof value === "object" && value !== null && "data" in value) {
    return decodeValue((value as { data: unknown }).data);
  }
  if (typeof value === "object" && value !== null && "value" in value) {
    return decodeValue((value as { value: unknown }).value);
  }
  throw new Error("Unsupported KV value returned from 0G KV client");
}
