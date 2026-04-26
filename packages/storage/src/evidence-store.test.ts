import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { writeFile } from 'node:fs/promises';

const uploadedPayloads: string[] = [];
const storedBundles = new Map<string, string>();

const mockUpload = mock(async (data: { buffer: Buffer }) => {
  uploadedPayloads.push(data.buffer.toString('utf8'));
  return [{ transactionHash: '0xupload' }, null];
});

const mockDownload = mock(async (cid: string, outputPath: string, _withProof: boolean) => {
  const stored = storedBundles.get(cid);
  if (!stored) {
    return [undefined, new Error(`missing CID ${cid}`)];
  }

  await writeFile(outputPath, stored, 'utf8');
  return [undefined, null];
});

class MockMemData {
  constructor(public readonly buffer: Buffer) {}

  async merkleTree(): Promise<[{ rootHash(): string }, null]> {
    const payload = this.buffer.toString('utf8');
    return [
      {
        rootHash: () => `cid:${Buffer.byteLength(payload, 'utf8')}`,
      },
      null,
    ];
  }

  async close(): Promise<void> {}
}

class MockIndexer {
  constructor(public readonly url: string) {}

  upload(
    data: MockMemData,
    _evmRpc: string,
    _signer: unknown,
  ): Promise<[unknown, null]> {
    return mockUpload(data) as Promise<[unknown, null]>;
  }

  download(
    cid: string,
    outputPath: string,
    withProof: boolean,
  ): Promise<[undefined, Error | null]> {
    return mockDownload(cid, outputPath, withProof) as Promise<[undefined, Error | null]>;
  }
}

mock.module('./sdk.js', () => ({
  loadStorageSdk: async () => ({
    ok: true,
    value: {
      MemData: MockMemData,
      Indexer: MockIndexer,
      Batcher: class {},
      KvClient: class {},
    },
  }),
}));

mock.module('./ethers.js', () => ({
  createSigner: async () => ({ ok: true, value: { address: '0xsigner' } }),
}));

import { EvidenceStore } from './evidence-store.js';
import type { EvidenceBundle } from './core.js';

function makeBundle(version: number): EvidenceBundle {
  return {
    strategyFamily: 'conservative-stablecoin-yield',
    version,
    priorCids: version > 1 ? [`cid:${version - 1}`] : [],
    pipeline: {
      researcher: {
        input: { version },
        output: {
          regime: 'stable',
          survivingProtocols: ['aave', 'morpho', 'spark'],
          kellyPriors: [],
          signals: [],
        },
        attestationHash: `0xresearcher${version}`,
        timestamp: 1_700_000_000_000 + version,
      },
      strategist: {
        input: { version },
        output: { candidates: [] },
        attestationHash: `0xstrategist${version}`,
        timestamp: 1_700_000_000_010 + version,
      },
      critic: {
        input: { version },
        output: {
          verdicts: [],
          selectedCandidateId: 'A',
          selectionRationale: 'Best risk-adjusted candidate',
          mandatoryConstraints: [],
          updatedKellyPriors: [],
        },
        attestationHash: `0xcritic${version}`,
        timestamp: 1_700_000_000_020 + version,
      },
      compiler: {
        workflowSpec: { name: `Strategy v${version}` },
        gasEstimate: 12,
      },
      riskValidator: {
        passed: true,
        warnings: [],
      },
    },
    createdAt: 1_700_000_000_100 + version,
  };
}

describe('EvidenceStore', () => {
  let store: EvidenceStore;

  beforeEach(() => {
    uploadedPayloads.length = 0;
    storedBundles.clear();
    mockUpload.mockClear();
    mockDownload.mockClear();

    store = new EvidenceStore({
      privateKey: '0xdeadbeef',
      evmRpc: 'https://evmrpc-testnet.0g.ai',
      indexerUrl: 'https://indexer-storage-testnet-turbo.0g.ai',
    });
  });

  it('writeBundle serializes JSON, uploads with MemData, and returns the Merkle root CID', async () => {
    const bundle = makeBundle(3);

    const result = await store.writeBundle(bundle);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.cid).toBe(`cid:${Buffer.byteLength(JSON.stringify(bundle), 'utf8')}`);
    }
    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(uploadedPayloads[0]).toBe(JSON.stringify(bundle));
  });

  it('readBundle downloads by CID, parses JSON, and returns a typed EvidenceBundle', async () => {
    const bundle = makeBundle(2);
    storedBundles.set('cid:bundle-2', JSON.stringify(bundle));

    const result = await store.readBundle('cid:bundle-2');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(bundle);
    }
    expect(mockDownload).toHaveBeenCalledWith('cid:bundle-2', expect.any(String), true);
  });

  it('loadPriorVersions loads multiple bundles and returns them oldest first', async () => {
    storedBundles.set('cid:v3', JSON.stringify(makeBundle(3)));
    storedBundles.set('cid:v1', JSON.stringify(makeBundle(1)));
    storedBundles.set('cid:v2', JSON.stringify(makeBundle(2)));

    const result = await store.loadPriorVersions(['cid:v3', 'cid:v1', 'cid:v2']);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.map((bundle) => bundle.version)).toEqual([1, 2, 3]);
    }
  });

  it('loadPriorVersions skips failed CIDs but still returns successful bundles', async () => {
    const warn = mock(() => undefined);
    const originalWarn = console.warn;
    console.warn = warn;

    storedBundles.set('cid:v1', JSON.stringify(makeBundle(1)));
    storedBundles.set('cid:v3', JSON.stringify(makeBundle(3)));

    const result = await store.loadPriorVersions(['cid:v1', 'cid:missing', 'cid:v3']);

    console.warn = originalWarn;

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.map((bundle) => bundle.version)).toEqual([1, 3]);
    }
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
