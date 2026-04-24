# Ticket: 0G Storage Wrapper

> **Package:** `packages/storage`
> **Priority:** Day 1
> **Dependencies:** `@strategyforge/core` (types), `@0gfoundation/0g-ts-sdk`, `ethers`
> **Read first:** `CLAUDE.md`, `docs/0g_reference.md` section 3 (Storage SDK) + section 4 (priorCids DAG)

## What to Build

A wrapper around 0G Storage that handles evidence bundle upload/download and the priorCids DAG pattern.

## File: `packages/storage/src/evidence-store.ts`

### Interface

```typescript
import type { EvidenceBundle } from '@strategyforge/core';
import type { Result } from '@strategyforge/core';

export interface EvidenceStoreConfig {
  privateKey: string;
  evmRpc: string;              // https://evmrpc-testnet.0g.ai
  indexerUrl: string;          // https://indexer-storage-testnet-turbo.0g.ai
}

export interface EvidenceStore {
  writeBundle(bundle: EvidenceBundle): Promise<Result<{ cid: string }>>;
  readBundle(cid: string): Promise<Result<EvidenceBundle>>;
  loadPriorVersions(priorCids: string[]): Promise<Result<EvidenceBundle[]>>;
}
```

### Implementation Notes

1. **`writeBundle(bundle)`:**
   - Serialize bundle to JSON string
   - Create `MemData` from buffer: `new MemData(Buffer.from(json))`
   - Get merkle tree: `const [tree] = await data.merkleTree()`
   - Upload: `await indexer.upload(data, evmRpc, signer)`
   - Return `tree.rootHash()` as the CID
2. **`readBundle(cid)`:**
   - Download: `await indexer.download(cid, tmpPath, true)` (withProof=true)
   - Read file, parse JSON, return typed EvidenceBundle
   - Clean up tmp file after reading
3. **`loadPriorVersions(priorCids)`:**
   - Map over priorCids, call readBundle for each
   - Return in order (oldest first)
   - If any CID fails, include error in Result but don't fail all

### SDK Reference (from docs/0g_reference.md)

```typescript
import { MemData, Indexer } from '@0gfoundation/0g-ts-sdk';

const indexer = new Indexer(INDEXER_URL);
const data = new MemData(Buffer.from(JSON.stringify(bundle)));
const [tree] = await data.merkleTree();
const rootHash = tree.rootHash();
await indexer.upload(data, EVM_RPC, signer);
await indexer.download(rootHash, './output.json', true);
```

## File: `packages/storage/src/kv-store.ts`

### Interface

```typescript
export interface KVStore {
  set(key: string, value: string): Promise<Result<void>>;
  get(key: string): Promise<Result<string | null>>;
}
```

For storing pointers like `family:{id}:latest → CID`. Uses 0G KV store.

### SDK Reference

```typescript
import { Batcher, KvClient } from '@0gfoundation/0g-ts-sdk';

// Write
const batcher = new Batcher(1, [kvNodeRpc], EVM_RPC, signer);
batcher.streamDataBuilder.set(STREAM_ID, Buffer.from(key), Buffer.from(value));
await batcher.exec();

// Read
const kvClient = new KvClient(kvNodeRpc);
const val = await kvClient.getValue(STREAM_ID, Buffer.from(key));
```

## File: `packages/storage/src/evidence-store.test.ts`

Mock the 0G SDK. Test:

1. `writeBundle()` serializes to JSON, uploads via MemData, returns rootHash
2. `readBundle()` downloads by CID, parses JSON, returns typed bundle
3. `loadPriorVersions()` loads multiple CIDs in order
4. `loadPriorVersions()` handles partial failures gracefully

## File: `packages/storage/src/index.ts`

```typescript
export { EvidenceStore, EvidenceStoreConfig } from './evidence-store.js';
export { KVStore } from './kv-store.js';
```

## Do NOT

- Do NOT use `ZgFile.fromFilePath()` — always use `MemData` for in-memory data
- Do NOT mix up `@0gfoundation/0g-ts-sdk` with `@0glabs/0g-serving-broker`
- Do NOT build the memory DAG manager here — that's ticket 04
