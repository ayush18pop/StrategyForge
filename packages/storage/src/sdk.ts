import { err, ok } from "./core.js";
import type { Result } from "./core.js";
import * as zeroGSdk from "@0gfoundation/0g-ts-sdk";

export interface StorageNodeClient {
  getStatus(): Promise<{ networkIdentity: { flowAddress: string } } | null>;
}

export interface StorageSdk {
  Indexer: new (url: string) => {
    selectNodes(count: number): Promise<[StorageNodeClient[], unknown]>;
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
      retryOpts?: unknown,
      opts?: unknown,
    ): Promise<unknown>;
    download(
      cid: string,
      outputPath: string,
      withProof: boolean,
    ): Promise<unknown>;
  };
  MemData: new (buffer: Buffer) => {
    merkleTree(): Promise<unknown>;
    close?: () => Promise<void> | void;
  };
  StorageNode: new (url: string) => StorageNodeClient;
  Batcher: new (
    version: number,
    nodes: StorageNodeClient[],
    flow: unknown,
    evmRpc: string,
  ) => {
    streamDataBuilder: {
      set(streamId: string, key: Buffer, value: Buffer): void;
    };
    exec(): Promise<unknown>;
  };
  KvClient: new (kvNodeRpc: string) => {
    getValue(streamId: string, key: Buffer): Promise<unknown>;
  };
  getFlowContract: (address: string, signer: unknown) => unknown;
}

function hasRequiredStorageSdkExports(value: unknown): value is StorageSdk {
  if (!value || typeof value !== "object") {
    return false;
  }

  const sdk = value as Record<string, unknown>;
  return (
    typeof sdk.Indexer === "function" &&
    typeof sdk.MemData === "function" &&
    typeof sdk.StorageNode === "function" &&
    typeof sdk.Batcher === "function" &&
    typeof sdk.KvClient === "function" &&
    typeof sdk.getFlowContract === "function"
  );
}

export async function loadStorageSdk(): Promise<Result<StorageSdk>> {
  try {
    // Use a regular top-level import and read StorageSdk from it.
    const sdkModule = zeroGSdk as unknown as Record<string, unknown>;

    // Step 2: Read the specific export we use in this package.
    const storageSdk = sdkModule;

    // Step 3: Validate the shape so downstream code can safely use it.
    if (!hasRequiredStorageSdkExports(storageSdk)) {
      return err(new Error("0G storage SDK is missing required exports"));
    }

    return ok(storageSdk);
  } catch (error) {
    return err(
      error instanceof Error
        ? error
        : new Error(`Failed to load 0G storage SDK: ${String(error)}`),
    );
  }
}
