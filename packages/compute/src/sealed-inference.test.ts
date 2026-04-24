import { describe, it, expect, beforeEach, mock } from 'bun:test';

// ── Mocks declared before imports so bun hoists them ──────────────────────────

const mockListService = mock(() =>
  Promise.resolve([{ provider: '0xprovider', model: 'glm-5', endpoint: 'https://api.0g.ai' }]),
);
const mockAcknowledge = mock(() => Promise.resolve());
const mockGetServiceMetadata = mock(() =>
  Promise.resolve({ endpoint: 'https://api.0g.ai', model: 'glm-5' }),
);
const mockGetRequestHeaders = mock(() =>
  Promise.resolve({ 'X-Inference-Auth': 'test-token' }),
);
const mockVerifyService = mock(
  (_addr: string, _dir: string, cb: (s: { message: string }) => void) => {
    cb({ message: 'Attestation verified' });
    return Promise.resolve();
  },
);
const mockGetBalance = mock(() => Promise.resolve(9.5));

mock.module('@0glabs/0g-serving-broker', () => ({
  createZGComputeNetworkBroker: async () => ({
    inference: {
      listService: mockListService,
      acknowledgeProviderSigner: mockAcknowledge,
      getServiceMetadata: mockGetServiceMetadata,
      getRequestHeaders: mockGetRequestHeaders,
      verifyService: mockVerifyService,
    },
    ledger: {
      getBalance: mockGetBalance,
    },
  }),
}));

mock.module('ethers', () => ({
  ethers: {
    JsonRpcProvider: class {
      constructor(_url: string) {}
    },
    Wallet: class {
      constructor(_key: string, _provider: unknown) {}
    },
  },
  JsonRpcProvider: class {
    constructor(_url: string) {}
  },
  Wallet: class {
    constructor(_key: string, _provider: unknown) {}
  },
}));

// ── Import after mocks ─────────────────────────────────────────────────────────
import { SealedInference } from './sealed-inference.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeConfig() {
  return {
    privateKey: '0xdeadbeef',
    evmRpc: 'https://evmrpc-testnet.0g.ai',
  };
}

function makeOkFetch(content: string, attestationHash?: string): typeof fetch {
  return mock(async () =>
    new Response(
      JSON.stringify({ choices: [{ message: { content } }] }),
      {
        status: 200,
        headers: attestationHash
          ? { 'x-attestation-hash': attestationHash }
          : {},
      },
    ),
  ) as unknown as typeof fetch;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SealedInference', () => {
  let si: SealedInference;

  beforeEach(() => {
    si = new SealedInference(makeConfig());
    mockListService.mockClear();
    mockAcknowledge.mockClear();
    mockGetServiceMetadata.mockClear();
    mockGetRequestHeaders.mockClear();
    mockVerifyService.mockClear();
  });

  // ── init() ──────────────────────────────────────────────────────────────────

  describe('init()', () => {
    it('creates broker, lists services, and acknowledges provider', async () => {
      const result = await si.init();

      expect(result.ok).toBe(true);
      expect(mockListService).toHaveBeenCalledTimes(1);
      expect(mockAcknowledge).toHaveBeenCalledTimes(1);
      expect(mockAcknowledge).toHaveBeenCalledWith('0xprovider');
      expect(mockGetServiceMetadata).toHaveBeenCalledWith('0xprovider');
    });

    it('returns error when no services are available', async () => {
      mockListService.mockImplementationOnce(() => Promise.resolve([]));

      const result = await si.init();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('No inference services');
      }
    });
  });

  // ── infer() ─────────────────────────────────────────────────────────────────

  describe('infer()', () => {
    it('returns error if called before init()', async () => {
      const result = await si.infer({ systemPrompt: 'sys', userPrompt: 'user' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Not initialized');
      }
    });

    it('returns response with TEE attestation hash from header', async () => {
      await si.init();
      global.fetch = makeOkFetch('{"alloc":"Morpho 60%"}', '0xteeHash123');

      const result = await si.infer({ systemPrompt: 'sys', userPrompt: 'propose allocations' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.response).toBe('{"alloc":"Morpho 60%"}');
        expect(result.value.attestationHash).toBe('0xteeHash123');
        expect(result.value.model).toBe('glm-5');
        expect(result.value.provider).toBe('0xprovider');
      }
    });

    it('falls back to sha256 content hash when no attestation header present', async () => {
      await si.init();
      global.fetch = makeOkFetch('some response');

      const result = await si.infer({ systemPrompt: 'sys', userPrompt: 'user' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        // sha256 hex is 64 chars
        expect(result.value.attestationHash).toHaveLength(64);
      }
    });

    it('appends JSON instruction to system prompt when jsonMode is true', async () => {
      await si.init();
      let capturedBody = '';
      global.fetch = mock(async (_, init?: RequestInit) => {
        capturedBody = init?.body as string ?? '';
        return new Response(
          JSON.stringify({ choices: [{ message: { content: '{}' } }] }),
          { status: 200 },
        );
      }) as unknown as typeof fetch;

      await si.infer({ systemPrompt: 'analyze', userPrompt: 'data', jsonMode: true });

      const body = JSON.parse(capturedBody) as { messages: Array<{ content: string }> };
      expect(body.messages[0]?.content).toContain('valid JSON only');
    });

    it('retries on 429 up to maxRetries then returns error', async () => {
      await si.init();
      let callCount = 0;
      global.fetch = mock(async () => {
        callCount++;
        return new Response('Too Many Requests', { status: 429 });
      }) as unknown as typeof fetch;

      const result = await si.infer({
        systemPrompt: 'sys',
        userPrompt: 'user',
        maxRetries: 2,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Rate limited');
      }
      // attempt 0 + retries 1,2 = 3 total calls
      expect(callCount).toBe(3);
    });

    it('succeeds on retry after initial 429', async () => {
      await si.init();
      let callCount = 0;
      global.fetch = mock(async () => {
        callCount++;
        if (callCount === 1) {
          return new Response('Too Many Requests', { status: 429 });
        }
        return new Response(
          JSON.stringify({ choices: [{ message: { content: 'ok after retry' } }] }),
          { status: 200 },
        );
      }) as unknown as typeof fetch;

      const result = await si.infer({ systemPrompt: 'sys', userPrompt: 'user' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.response).toBe('ok after retry');
      }
      expect(callCount).toBe(2);
    });

    it('returns error on non-429 HTTP failure', async () => {
      await si.init();
      global.fetch = mock(async () =>
        new Response('Internal Server Error', { status: 500, statusText: 'Internal Server Error' }),
      ) as unknown as typeof fetch;

      const result = await si.infer({ systemPrompt: 'sys', userPrompt: 'user' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('500');
      }
    });
  });

  // ── getBalance() ────────────────────────────────────────────────────────────

  describe('getBalance()', () => {
    it('returns error if called before init()', async () => {
      const result = await si.getBalance();

      expect(result.ok).toBe(false);
    });

    it('returns balance from ledger.getBalance()', async () => {
      await si.init();

      const result = await si.getBalance();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(9.5);
      }
    });
  });

  // ── verifyAttestation() ─────────────────────────────────────────────────────

  describe('verifyAttestation()', () => {
    it('returns error if called before init()', async () => {
      const result = await si.verifyAttestation('0xprovider', '/tmp/attestations');

      expect(result.ok).toBe(false);
    });

    it('calls broker.inference.verifyService and returns true', async () => {
      await si.init();

      const result = await si.verifyAttestation('0xprovider', '/tmp/attestations');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(true);
      }
      expect(mockVerifyService).toHaveBeenCalledWith(
        '0xprovider',
        '/tmp/attestations',
        expect.any(Function),
      );
    });
  });
});
