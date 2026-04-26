import { Batcher, KvClient, Indexer, getFlowContract } from '@0gfoundation/0g-ts-sdk';
import { ethers } from 'ethers';
import { err, ok } from "./core.js";
import type { Result } from "./core.js";

export interface KVStoreConfig {
  privateKey: string;
  evmRpc: string;
  kvNodeRpc: string;
  streamId: string;
  indexerUrl?: string; // needed to fetch nodes/flowContract if following strict SDK
  replicaCount?: number;
}

export class KVStore {
  constructor(private readonly config: KVStoreConfig) { }

  async set(key: string, value: string): Promise<Result<void>> {
    try {
      const provider = new ethers.JsonRpcProvider(this.config.evmRpc);
      const signer = new ethers.Wallet(this.config.privateKey, provider);

      // Auto-discover testnet nodes using the indexer
      const indexerRpc = this.config.indexerUrl || 'https://indexer-storage-testnet-turbo.0g.ai';
      const indexer = new Indexer(indexerRpc);

      const [nodes, nodeErr] = await indexer.selectNodes(this.config.replicaCount ?? 1);
      if (nodeErr !== null || !nodes || nodes.length === 0) throw new Error(`Error selecting nodes: ${nodeErr}`);

      // flowContract must be actively extracted per network standards as Batcher doesn't fetch it explicitly.
      const status = await nodes[0]!.getStatus();
      const flowAddress = status.networkIdentity.flowAddress;
      const flowContract = getFlowContract(flowAddress, signer);

      const batcher = new Batcher(1, nodes, flowContract as any, this.config.evmRpc);

      const keyBytes = Uint8Array.from(Buffer.from(key, 'utf-8'));
      const valueBytes = Uint8Array.from(Buffer.from(value, 'utf-8'));

      batcher.streamDataBuilder.set(this.config.streamId, keyBytes, valueBytes);

      const [tx, batchErr] = await batcher.exec();
      if (batchErr !== null) throw new Error(`Batch execution error: ${batchErr}`);

      return ok(undefined);
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  async get(key: string): Promise<Result<string | null>> {
    try {
      const kvClient = new KvClient(this.config.kvNodeRpc);

      const keyBytes = Uint8Array.from(Buffer.from(key, 'utf-8'));
      const value = await kvClient.getValue(this.config.streamId, keyBytes);

      if (value == null) {
        return ok(null);
      }

      return ok(decodeValue(value));
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }
}

function decodeValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
    return Buffer.from(value).toString("utf8");
  }
  if (Array.isArray(value) && value.every((entry) => typeof entry === "number")) {
    return Buffer.from(value).toString("utf8");
  }
  if (typeof value === "object" && value !== null && "data" in value) {
    return decodeValue((value as any).data);
  }
  if (typeof value === "object" && value !== null && "value" in value) {
    return decodeValue((value as any).value);
  }
  throw new Error("Unsupported KV value returned from 0G KV client");
}
