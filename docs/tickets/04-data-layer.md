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

export interface HistoricalAPY {
  date: number;      // unix timestamp
  apy: number;
}

export interface DefiLlamaClient {
  getYieldPools(params: {
    chains?: string[];
    stablecoinsOnly?: boolean;
    minTvl?: number;
  }): Promise<Result<ProtocolData[]>>;

  getProtocolTVL(protocol: string): Promise<Result<{ tvl: number; change7d: number }>>;

  // Needed for sigma (std deviation) computation in Kelly priors + VaR
  getHistoricalAPY(poolId: string, days?: number): Promise<Result<HistoricalAPY[]>>;
}
```

### API Details

- **Yields:** `GET https://yields.llama.fi/pools` — returns all pools with APY, TVL, chain
- **TVL:** `GET https://api.llama.fi/tvl/{protocol}` — returns current TVL
- **Historical APY:** `GET https://yields.llama.fi/chart/{poolId}` — returns daily APY history
  - Use this to compute `sigma` (30-day std deviation) for each protocol
  - `sigma = stddev(last 30 days of APY values)`
  - This feeds Kelly prior computation and VaR in the Critic step
- Filter by: `stablecoin === true`, `tvlUsd > minTvl`, `chain` match
- Map response to our `ProtocolData` type

### Pool IDs for MVP protocols

These are stable pool IDs for the 3 MVP protocols:
- Aave USDC on Ethereum: `pool` field in yields API where `project === "aave-v3"` and `chain === "Ethereum"` and `symbol.includes("USDC")`
- Morpho Curated: `project === "morpho"` curated vaults
- Spark: `project === "spark"` and `symbol.includes("USDC")`

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
