# StrategyForge

> Self-improving DeFi strategy agent with provable reasoning and on-chain memory.
> Trust layer for KeeperHub's strategy marketplace.

## What This Project Does

1. User says: "I have $50K USDC, medium risk, Ethereum"
2. Agent searches existing strategies with on-chain reputation (ERC-8004)
3. If proven match → deploy as user's KeeperHub workflow
4. If no match → create new one via 7-step pipeline (TEE-attested on 0G Compute)
5. After every run: outcome posted on-chain, strategy evolves, iNFT brain updates

## Tech Stack

- **Language:** TypeScript strict, Node 20+, pnpm workspaces
- **0G Compute:** `@0glabs/0g-serving-broker` — sealed inference with TEE attestation
- **0G Storage:** `@0gfoundation/0g-ts-sdk` — Merkle-root blobs + KV store for priorCids DAG
- **KeeperHub:** MCP server — create/run/publish workflows, x402 payments
- **Contracts:** Solidity 0.8.24, Hardhat — ERC-7857 iNFT, ERC-6551 TBA, ERC-8004 registries
- **Dashboard:** React 18 + Vite
- **DeFi Data:** DefiLlama REST API + Uniswap Trading API

## Project Structure

```
strategyforge/
├── packages/
│   ├── core/          # shared types + utils
│   ├── compute/       # 0G Compute wrapper (sealed inference)
│   ├── storage/       # 0G Storage wrapper (evidence bundles, memory DAG)
│   ├── data/          # DefiLlama + Uniswap API clients
│   ├── pipeline/      # 7-step strategy pipeline (researcher→strategist→critic→compiler)
│   ├── keeperhub/     # KeeperHub MCP client wrapper
│   ├── contracts/     # Solidity contracts (ERC-7857, 6551, 8004)
│   ├── server/        # StrategyForge MCP server (5 tools)
│   └── dashboard/     # React + Vite UI
├── docs/              # Architecture, reference docs
└── .agents/workflows/ # AI coding workflows
```

## Architecture Rules (MUST FOLLOW)

1. **LLM NEVER generates final workflow JSON** — the deterministic compiler does. LLM proposes allocations, compiler maps to typed KeeperHub workflow spec.
2. **Every pipeline step stores its TEE attestation hash** in the evidence bundle. No step should discard the attestation.
3. **priorCids ALWAYS loaded before generating a new version.** The pipeline must load past evidence bundles before the Strategist and Critic steps.
4. **Strategy ≠ Workflow.** Strategy = reusable blueprint on 0G Storage. Workflow = user-specific KeeperHub deployment from that blueprint.
5. **All 0G Storage writes use `MemData`** (in-memory), not file-system `ZgFile`.

## Package Namespaces (CRITICAL — DO NOT MIX)

```
Storage SDK:  @0gfoundation/0g-ts-sdk      ← 0gfoundation namespace
Compute SDK:  @0glabs/0g-serving-broker     ← 0glabs namespace
```

Mixing these will cause silent runtime failures.

## Code Standards

- Explicit return types on every exported function
- No `any` type — use `unknown` + type guards when needed
- Errors: return `Result<T, E>` objects in business logic, only throw in I/O boundaries
- Each package has `src/index.ts` barrel export
- Tests alongside source: `foo.ts` → `foo.test.ts`
- Test runner: `vitest`

## Environment Variables

```
PRIVATE_KEY=0x...                                    # wallet private key (0G Chain)
OG_EVM_RPC=https://evmrpc-testnet.0g.ai             # 0G testnet RPC
OG_CHAIN_ID=16601                                    # 0G testnet chain ID
OG_INDEXER=https://indexer-storage-testnet-turbo.0g.ai  # 0G Storage indexer
KEEPERHUB_API_KEY=...                                # KeeperHub API key
KEEPERHUB_API_URL=https://api.keeperhub.com          # KeeperHub API base
```

## Key Reference Docs

- Full product spec: `docs/strategyforge_final.md`
- 0G SDK reference: `docs/0g_reference.md`
- KeeperHub reference: `docs/keeperhub_reference.md`
- Architecture & tickets: `docs/architecture.md`
- Type definitions: `packages/core/src/types/`
