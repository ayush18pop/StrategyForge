import { describe, it, expect, beforeEach, mock } from 'bun:test';

const kvValues = new Map<string, unknown>();

const mockSet = mock((streamId: string, key: Buffer, value: Buffer) => {
  kvValues.set(`${streamId}:${key.toString('utf8')}`, new Uint8Array(value));
});

const mockExec = mock(async () => [undefined, null] as const);
const mockGetValue = mock(async (streamId: string, key: Buffer) => {
  return kvValues.get(`${streamId}:${key.toString('utf8')}`) ?? null;
});

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

class MockKvClient {
  constructor(public readonly kvNodeRpc: string) {}

  getValue(streamId: string, key: Buffer): Promise<unknown> {
    return mockGetValue(streamId, key);
  }
}

mock.module('./sdk.js', () => ({
  loadStorageSdk: async () => ({
    ok: true,
    value: {
      MemData: class {},
      Indexer: class {},
      Batcher: MockBatcher,
      KvClient: MockKvClient,
    },
  }),
}));

mock.module('./ethers.js', () => ({
  createSigner: async () => ({ ok: true, value: { address: '0xsigner' } }),
}));

import { KVStore } from './kv-store.js';

describe('KVStore', () => {
  let store: KVStore;

  beforeEach(() => {
    kvValues.clear();
    mockSet.mockClear();
    mockExec.mockClear();
    mockGetValue.mockClear();

    store = new KVStore({
      privateKey: '0xdeadbeef',
      evmRpc: 'https://evmrpc-testnet.0g.ai',
      kvNodeRpc: 'https://kv-node.0g.ai',
      streamId: '0xstream',
    });
  });

  it('set stores a value through Batcher.streamDataBuilder.set and exec', async () => {
    const result = await store.set('family:test:latest', 'cid:123');

    expect(result.ok).toBe(true);
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
});
