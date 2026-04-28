import { describe, it, expect, beforeEach, mock } from 'bun:test';

const kvValues = new Map<string, unknown>();

const mockSet = mock((streamId: string, key: Buffer, value: Buffer) => {
  kvValues.set(`${streamId}:${key.toString('utf8')}`, new Uint8Array(value));
});

const mockExec = mock(async () => [undefined, null] as const);
const mockGetValue = mock(async (streamId: string, key: Buffer) => {
  return kvValues.get(`${streamId}:${key.toString('utf8')}`) ?? null;
});
const mockSelectNodes = mock(async () => [[{ url: 'https://live-kv-node.0g.ai' }], null] as const);

class MockBatcher {
  readonly streamDataBuilder = {
    set: mockSet,
  };

  constructor(
    public readonly replicaCount: number,
    public readonly nodes: string[],
    public readonly evmRpc: string,
    public readonly signer: unknown,
  ) {}

  exec(): Promise<readonly [undefined, null]> {
    return mockExec();
  }
}

class MockStorageNode {
  constructor(public readonly url: string) {}

  async getStatus(): Promise<{ networkIdentity: { flowAddress: string } }> {
    return { networkIdentity: { flowAddress: '0xflow' } };
  }
}

class MockKvClient {
  constructor(public readonly kvNodeRpc: string) {}

  getValue(streamId: string, key: Buffer): Promise<unknown> {
    return mockGetValue(streamId, key);
  }
}

class MockIndexer {
  constructor(public readonly url: string) {}

  selectNodes(): Promise<readonly [{ url: string }[], null]> {
    return mockSelectNodes();
  }
}

// @ts-expect-error - Bun's mock.module is not recognized by TypeScript types
mock.module('./sdk.js', () => ({
  loadStorageSdk: async () => ({
    ok: true,
    value: {
      MemData: class {},
      Indexer: MockIndexer,
      Batcher: MockBatcher,
      StorageNode: MockStorageNode,
      KvClient: MockKvClient,
      getFlowContract: () => ({ address: '0xflow' }),
    },
  }),
}));

// @ts-expect-error - Bun's mock.module is not recognized by TypeScript types
mock.module('./ethers.js', () => ({
  createSigner: async () => ({ ok: true, value: { address: '0xsigner' } }),
}));

import { KVStore } from './kv-store.js';

describe('KVStore', () => {
  let store: KVStore;

  beforeEach(() => {
    kvValues.clear();
    delete process.env.OG_KV_NODE_PREFERENCE;

    store = new KVStore({
      privateKey: '0xdeadbeef',
      evmRpc: 'https://evmrpc-testnet.0g.ai',
      kvNodeRpc: 'https://kv-node.0g.ai',
      streamId: '0xstream',
      flowContractAddress: '0xflow',  // bypass getStatus() on mock nodes
    });
  });

  it('set stores a value through Batcher.streamDataBuilder.set and exec', async () => {
    const result = await store.set('family:test:latest', 'cid:123');
    expect(result.ok).toBe(true);

    // set() returns immediately after the cache write; the 0G network write
    // fires async. Drain the microtask queue so the mock receives the call.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockSet).toHaveBeenCalledTimes(1);
    expect(mockExec).toHaveBeenCalledTimes(1);
  });

  it('get returns null when the key is absent', async () => {
    const result = await store.get('family:missing:latest');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeNull();
    }
  });

  it('get decodes stored Uint8Array values as UTF-8 strings', async () => {
    kvValues.set('0xstream:agent:brainCid', new Uint8Array(Buffer.from('cid:brain')));

    const result = await store.get('agent:brainCid');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('cid:brain');
    }
  });

  it('get prefers the explicit KV endpoint by default', async () => {
    kvValues.set('0xstream:agent:brainCid', new Uint8Array(Buffer.from('cid:brain')));
    const beforeCalls = mockSelectNodes.mock.calls.length;

    const result = await store.get('agent:brainCid');

    expect(result.ok).toBe(true);
    expect(mockSelectNodes.mock.calls.length).toBe(beforeCalls);
  });

  it('get can prefer indexer nodes when explicitly configured', async () => {
    process.env.OG_KV_NODE_PREFERENCE = 'indexer';
    kvValues.set('0xstream:agent:brainCid', new Uint8Array(Buffer.from('cid:brain')));
    const beforeCalls = mockSelectNodes.mock.calls.length;

    const result = await store.get('agent:brainCid');

    expect(result.ok).toBe(true);
    expect(mockSelectNodes.mock.calls.length).toBe(beforeCalls + 1);
    delete process.env.OG_KV_NODE_PREFERENCE;
  });
});
