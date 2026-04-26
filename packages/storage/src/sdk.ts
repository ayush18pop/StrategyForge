import { err, ok } from "./core.js";
import type { Result } from "./core.js";
import * as zeroGSdk from "@0gfoundation/0g-ts-sdk";

export interface StorageSdk {
  Indexer: new (url: string) => {
    selectNodes(count: number): Promise<[any[], unknown]>;
    upload(data: unknown, evmRpc: string, signer: unknown): Promise<unknown>;
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
  Batcher: new (
    replicaCount: number,
    nodes: string[],
    evmRpc: string,
    signer: unknown,
  ) => {
    streamDataBuilder: {
      set(streamId: string, key: Buffer, value: Buffer): void;
    };
    exec(): Promise<unknown>;
  };
  KvClient: new (kvNodeRpc: string) => {
    getValue(streamId: string, key: Buffer): Promise<unknown>;
  };
  getFlowContract: Function;
}

function hasRequiredStorageSdkExports(value: unknown): value is StorageSdk {
  if (!value || typeof value !== "object") {
    return false;
  }

  const sdk = value as Record<string, unknown>;
  return (
    typeof sdk.Indexer === "function" &&
    typeof sdk.MemData === "function" &&
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
