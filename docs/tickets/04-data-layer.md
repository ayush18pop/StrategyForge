# Ticket: Data Layer (DefiLlama + Uniswap)

> **Package:** `packages/data`
> **Priority:** Day 2
> **Dependencies:** `@strategyforge/core` (types)
> **Read first:** `CLAUDE.md`, `docs/uniswap_reference.md`

## What to Build

Typed clients for fetching DeFi protocol data. These feed the Researcher pipeline step.

## File: `packages/data/src/defillama.ts`

### Interface

```typescript
import type { ProtocolData } from '@strategyforge/core';
import type { Result } from '@strategyforge/core';

export interface DefiLlamaClient {
  getYieldPools(params: {
    chains?: string[];
    stablecoinsOnly?: boolean;
    minTvl?: number;           // filter pools with TVL below this
  }): Promise<Result<ProtocolData[]>>;

  getProtocolTVL(protocol: string): Promise<Result<{ tvl: number; change7d: number }>>;
}
```

### API Details

- **Yields:** `GET https://yields.llama.fi/pools` — returns all pools with APY, TVL, chain
- **TVL:** `GET https://api.llama.fi/tvl/{protocol}` — returns current TVL
- Filter by: `stablecoin === true`, `tvlUsd > minTvl`, `chain` match
- Map response to our `ProtocolData` type

## File: `packages/data/src/uniswap.ts`

### Interface

```typescript
import type { Result } from '@strategyforge/core';

export interface UniswapClient {
  getQuote(params: {
    tokenIn: string;
    tokenOut: string;
    amount: string;
    chain: string;
  }): Promise<Result<{ quote: string; gasEstimate: string; route: string }>>;

  checkApproval(params: {
    token: string;
    walletAddress: string;
    chain: string;
  }): Promise<Result<{ approvalNeeded: boolean; approvalTx?: string }>>;
}
```

### API Details

- **Quote:** `POST https://trade-api.gateway.uniswap.org/v1/quote`
- **Approval:** `POST https://trade-api.gateway.uniswap.org/v1/check_approval`
- Requires API key in `x-api-key` header

## Tests

Snapshot tests with fixture data (save a real API response as JSON fixture, test parsing against it).

## Do NOT

- Do NOT build the universe filter logic here — that's the Researcher (pipeline package)
- Do NOT call 0G Compute or Storage
