# StrategyForge

> Self-improving DeFi strategy agent with provable reasoning and on-chain memory.
> Trust layer for KeeperHub's strategy marketplace.

## What This Project Does

1. User says: "I have $50K USDC, medium risk, Ethereum"
2. Agent searches existing strategies with on-chain reputation (AgentRegistry + ReputationLedger)
3. If proven match → deploy as user's KeeperHub workflow
4. If no match → run pipeline (Kelly math + TEE-attested LLM reasoning) → create strategy
5. After every run: outcome posted to ReputationLedger on-chain
6. Monitor cron detects drift → UpdateOrchestrator → pipeline runs again → v(n+1) created
7. After every pipeline run: iNFT brainCid updated on-chain (agent's knowledge evolves)

## iNFT Role (important)

The iNFT (ERC-7857-inspired simplified, tokenId=1) IS the StrategyForge agent — not the user, not a strategy.
Note: We implement a simplified subset of ERC-7857 (no proof-verified transfer, no clone/authorizeUsage). Full spec in `docs/erc7857_reference.md`.
- brainCid → 0G Storage brain root, updated after every pipeline run
- ERC-6551 TBA wallet → earns x402 fees when users run strategies
- agentId in AgentRegistry = iNFT tokenId → reputation is the agent's track record
The iNFT is updated in the SERVER LAYER after the pipeline, not inside the pipeline itself.

## Tech Stack

- **Language:** TypeScript strict, Bun runtime, pnpm workspaces
- **0G Compute:** `@0glabs/0g-serving-broker` — sealed inference with TEE attestation
- **0G Storage:** `@0gfoundation/0g-ts-sdk` — Merkle-root blobs + KV store for priorCids DAG
- **Storage resilience:** In-memory write-through cache + SQLite (`bun:sqlite`) as local fallback — 0G KV is async best-effort only
- **KeeperHub:** MCP server — create/run/publish workflows, x402 payments
- **Contracts:** Solidity 0.8.24, Hardhat — ERC-7857-inspired iNFT (simplified), ERC-6551 TBA, AgentRegistry, ReputationLedger
- **Dashboard:** React 18 + Vite (wallet connect + payment: **not yet implemented** — see `docs/ONBOARDING_PLAN.md`)
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
│   ├── server/        # StrategyForge HTTP server + monitoring cron
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

## Storage Resilience Layer (read this before touching KVStore or EvidenceStore)

0G testnet KV nodes are intermittently slow. The storage stack has three layers:

```
set():  hot cache (Map) → SQLite write → 0G KV write (async, fire-and-forget)
get():  hot cache hit → SQLite read → 0G KV network read
```

- `KVStore` holds an in-memory `Map` as write-through cache. `set()` returns `ok(undefined)` instantly after writing to the map and SQLite. The 0G network write fires async and logs failures but never blocks the caller.
- SQLite path: `./data/strategyforge.db` (configurable via `LOCAL_DB_PATH`). Created automatically by the server on startup via `createLocalStore()` in `packages/server/src/lib/local-store.ts`.
- `EvidenceStore` has a parallel in-memory bundle cache. If `writeBundle()` fails (storage node flaky), the bundle is cached under its `pending:…` CID via `cacheBundle()`. `readBundle()` checks the cache first, so the update pipeline can still load prior versions within the same server session.
- `KVStoreConfig.localStore` — optional `LocalKVStore` interface (synchronous get/set). Injected from the server layer; the storage package itself has no SQLite dependency.

## Monitoring Cron

The server runs a single ticker (default every 5 minutes, `MONITOR_TICK_MS` env var).
Each tick scans all tracked family IDs but only acts on those that are **due** based on their own interval:

| riskLevel     | monitorIntervalMs | default check cadence |
|---------------|-------------------|-----------------------|
| `balanced`    | 6 hours           | high market exposure  |
| `conservative`| 24 hours          | stable positions      |

`lastMonitoredAt` and `monitorIntervalMs` live in `FamilyLatestRecord` (KV + SQLite).
`touchLastMonitored()` is called after every check (healthy or not) to advance the clock.
`saveFamilyMeta()` preserves `lastMonitoredAt` across version bumps so a v2 save doesn't reset the cron clock.

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
- Test runner: `bun test` (not vitest — runtime is Bun)

## Known Gaps (active work items)

### User onboarding / payments — NOT IMPLEMENTED
The dashboard has no wallet connect and no payment flow. `userWalletAddress` is a hardcoded placeholder. The iNFT TBA wallet never receives x402 fees.
Full plan: `docs/ONBOARDING_PLAN.md`
Short version: add wagmi + RainbowKit to `providers.tsx`, wire `useAccount()` into `GeneratePage`, intercept 402 responses in `lib/api.ts`, add `PaymentModal` component.

### Pipeline — single strategist (future: consensus)
Current pipeline is linear: Researcher → Strategist → Critic → Compiler.
Future direction (`docs/FUTURE_DIRECTION.md`): replace single Strategist with three parallel agents (Yield Maximizer, Tail Risk Minimizer, Regime Follower) feeding a Consensus Critic that resolves disputes. No changes needed in Compiler, RiskValidator, or the deploy path — only the Strategist call and Critic prompt change.

## Environment Variables

```
# 0G Chain
PRIVATE_KEY=0x...
OG_EVM_RPC=https://evmrpc-testnet.0g.ai
OG_CHAIN_ID=16602
OG_INDEXER=https://indexer-storage-testnet-turbo.0g.ai
OG_STREAM_ID=0x...f2bd                              # must match an indexed stream on the KV node
OG_KV_NODE_RPC=http://178.238.236.119:6789          # community KV node (0xAgentio)
OG_STORAGE_URL=http://34.169.28.106:5678            # direct storage node for KV Batcher writes
OG_FLOW_CONTRACT_ADDRESS=0x22E03a6A89B950F1c82ec5e74F8eCa321a105296
OG_STORAGE_FINALITY_REQUIRED=false
OG_STORAGE_UPLOAD_TIMEOUT_MS=120000

# Compute
OG_COMPUTE_URL=https://...
OG_COMPUTE_API_KEY=app-sk-...

# KeeperHub
KEEPERHUB_API_KEY=kh_...
KEEPERHUB_API_URL=https://app.keeperhub.com/api
KEEPERHUB_PRICE_PER_RUN=0.01
KEEPERHUB_PAYMENT_NETWORK=base
KEEPERHUB_PUBLISH_ON_DEPLOY=1                       # set to "1" to publish workflow on deploy

# Contracts (0G testnet)
AGENT_REGISTRY_ADDRESS=0xF0Be1A141A3340262197f3e519FafB1a71Ee432a
REPUTATION_LEDGER_ADDRESS=0xCd2FD868b7eaB529075c5a7716dDfE395be33656
INFT_ADDRESS=0xEAd14B860fa11e81a2B8348AC3Ea1b401b7C4135
AGENT_ID=1

# Server
PORT=3000
LOCAL_DB_PATH=./data/strategyforge.db               # SQLite persistent KV fallback
MONITOR_TICK_MS=300000                              # how often the cron scans (default 5 min)

# Dashboard
VITE_API_BASE_URL=http://localhost:3000
VITE_WC_PROJECT_ID=...                             # WalletConnect v2 — NOT YET WIRED
```

## Key Reference Docs

- Full product spec: `docs/strategyforge_final.md`
- 0G SDK reference: `docs/0g_reference.md`
- ERC-7857 iNFT reference: `docs/erc7857_reference.md`
- KeeperHub reference: `docs/keeperhub_reference.md`
- Architecture & tickets: `docs/architecture.md`
- Future pipeline direction: `docs/FUTURE_DIRECTION.md`
- User onboarding + payment plan: `docs/ONBOARDING_PLAN.md`
- Type definitions: `packages/core/src/types/`
