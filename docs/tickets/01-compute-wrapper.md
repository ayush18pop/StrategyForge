# Ticket: 0G Compute Wrapper

> **Package:** `packages/compute`
> **Priority:** Day 1
> **Dependencies:** `@strategyforge/core` (types), `@0glabs/0g-serving-broker`, `ethers`
> **Read first:** `CLAUDE.md`, `docs/0g_reference.md` section 2 (Compute SDK)

## What to Build

A wrapper around 0G Compute that gives the pipeline a simple `infer()` function. Handles broker setup, provider management, auth headers, and retry logic.

## File: `packages/compute/src/sealed-inference.ts`

### Interface

```typescript
import type { SealedInferenceResult } from '@strategyforge/core';
import type { Result } from '@strategyforge/core';

export interface SealedInferenceConfig {
  privateKey: string;
  evmRpc: string;             // https://evmrpc-testnet.0g.ai
}

export interface InferenceParams {
  systemPrompt: string;
  userPrompt: string;
  jsonMode?: boolean;          // if true, instruct model to return JSON
  maxRetries?: number;         // default 3
}

export interface SealedInference {
  init(): Promise<Result<void>>;
  infer(params: InferenceParams): Promise<Result<SealedInferenceResult>>;
  getBalance(): Promise<Result<number>>;
  verifyAttestation(providerAddress: string, outputDir: string): Promise<Result<boolean>>;
}
```

### Implementation Notes

1. **Constructor:** takes `SealedInferenceConfig`
2. **`init()`:** creates broker via `createZGComputeNetworkBroker(wallet)`, lists services, picks first provider, calls `acknowledgeProviderSigner`, caches provider/endpoint/model
3. **`infer()`:**
   - Gets fresh auth headers via `broker.inference.getRequestHeaders(provider)`
   - Calls `${endpoint}/chat/completions` with OpenAI-compatible format
   - Returns `{ response, attestationHash, model, provider }`
   - **Retry:** on 429 → exponential backoff (1s, 2s, 4s), up to `maxRetries`
   - **attestationHash:** extract from response headers or generate hash of response for now
4. **`verifyAttestation()`:** calls `broker.inference.verifyService()`

### SDK Reference (from docs/0g_reference.md)

```typescript
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker';

const broker = await createZGComputeNetworkBroker(wallet);
const services = await broker.inference.listService();
await broker.inference.acknowledgeProviderSigner(providerAddress);
const { endpoint, model } = await broker.inference.getServiceMetadata(providerAddress);
const headers = await broker.inference.getRequestHeaders(providerAddress);
```

## File: `packages/compute/src/sealed-inference.test.ts`

Mock the broker and fetch. Test:

1. `init()` creates broker, lists services, acknowledges provider
2. `infer()` returns response + attestation hash
3. `infer()` retries on 429 up to maxRetries
4. `infer()` returns error Result on all retries exhausted
5. `getBalance()` returns current balance

## File: `packages/compute/src/index.ts`

```typescript
export { SealedInference, SealedInferenceConfig, InferenceParams } from './sealed-inference.js';
```

## Do NOT

- Do NOT build the pipeline steps — just the raw inference wrapper
- Do NOT parse or structure the LLM response — that's the pipeline's job
- Do NOT call 0G Storage from this package
