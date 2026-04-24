# StrategyForge — Trust Layer for KeeperHub's Strategy Marketplace

> **Validated by Luca (KeeperHub Head of Growth):** *"This is a strong idea and fits our vision very nicely! This definitely does align with the prize track, so full course ahead!"*

---

## One-Line Pitch

**A trust layer for KeeperHub strategies — agent-controlled versioning, verifiable reasoning via 0G, and on-chain reputation via ERC-8004.**

---

## What KeeperHub Already Has (We Don't Rebuild This)

KeeperHub already provides:

- ✅ Workflow creation (`create_workflow`, `ai_generate_workflow` via MCP)
- ✅ Workflow publishing with pricing (`publish_workflow` + x402)
- ✅ Strategy marketplace (agents discover and pay to run)
- ✅ Execution engine (retries, gas, simulation, audit trail)
- ✅ Turnkey wallet (secure enclave, signs txs for workflows)

**Anyone with Claude + KeeperHub MCP can already create and publish DeFi strategies in 40 seconds.**

## What's Missing (What We Build)

KeeperHub's marketplace has NO trust infrastructure:

- ❌ No on-chain discovery (can't find strategies from outside KeeperHub)
- ❌ No on-chain reputation (no proof a strategy performed well)
- ❌ No verifiable reasoning (no proof WHY the strategy was designed this way)
- ❌ No versioning (strategies are static, no evolution mechanism)
- ❌ No memory (agent doesn't learn from past outcomes)

**StrategyForge adds the trust, discovery, reasoning, and evolution layer on top of KeeperHub.**

---

## What We Actually Build

```text
┌──────────────────────────────────────────────────────────────┐
│                    WHAT EXISTS (KeeperHub)                   │
│  Create workflow → Publish with price → Execute → Audit trail│
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────┐
│               WHAT WE ADD (StrategyForge)                    │
│                                                              │
│  1. ERC-8004 Identity   → publish workflow registered        │
│                            on-chain, discoverable by ANY     │
│                            agent on any network              │
│                                                              │
│  2. ERC-8004 Reputation → after every run, outcome posted    │
│                            on-chain (yield, success, failure)│
│                                                              │
│  3. 0G Storage          → evidence bundle: WHY this strategy,│
│                            what data was used, memory DAG    │
│                            linking v1 → v2 → v3              │
│                                                              │
│  4. 0G Compute          → TEE attestation: PROOF the         │
│                            reasoning wasn't fabricated        │
│                                                              │
│  5. Agent Versioning    → strategies evolve via memory,      │
│                            new versions go through lifecycle │
│                            (draft → paper → canary → stable) │
│                                                              │
│  6. iNFT (ERC-7857)     → agent has persistent identity,     │
│                            evolving brain, own wallet (6551) │
└──────────────────────────────────────────────────────────────┘
```

---

## The Three Objects (Strategy ≠ Workflow)

| Concept | What It Is | Where It Lives |
|---------|-----------|----------------|
| **Strategy Version** | A reusable blueprint with fixed rules, parameters, evidence bundle, and track record | 0G Storage (immutable) + App Index (searchable) |
| **Deployment Instance** | A user-specific KeeperHub workflow created FROM a strategy version. Bound to user's wallet, budget, approval mode | KeeperHub (execution) |
| **Memory Record** | An observation: market snapshot, reasoning, outcomes. Linked via `priorCids` | 0G Storage (DAG) |

---

## User Flow

```text
USER: "I have $50K USDC. Medium risk. 6 months. Ethereum."
                    ↓
┌─── STEP 1: NORMALIZE ──────────────────────────────────────┐
│ Parse into structured objective:                           │
│   asset: USDC, amount: $50K, risk: medium,                │
│   horizon: 6mo, chains: [eth]                             │
└────────────────────────────────────────────────────────────┘
                    ↓
┌─── STEP 2: SEARCH (ERC-8004 + App Index) ─────────────────┐
│ Query existing published strategies with reputation data: │
│   "Conservative Yield v3" — 8.2% avg, 47 runs, stable ✅  │
│   "Balanced DeFi v1"     — 6.5% avg, 12 runs, canary ⚠️  │
└────────────────────────────────────────────────────────────┘
                    ↓
            GOOD MATCH?
           /           \
         YES            NO
          ↓              ↓
┌── REUSE ──────┐  ┌── CREATE NEW ─────────────────────────┐
│ Show user:    │  │ 7-step pipeline:                      │
│ • why it fits │  │  1. Universe filter                   │
│ • track record│  │  2. Feature builder                   │
│ • evidence    │  │  3. Candidate generator (0G sealed)   │
│               │  │  4. Deterministic compiler            │
│ Deploy as     │  │  5. Risk validator                    │
│ KeeperHub     │  │  6. Simulator                         │
│ workflow      │  │  7. Publish to KeeperHub + register   │
│               │  │     on ERC-8004                       │
│ Creator earns │  │                                       │
│ via x402      │  │ OR REFUSE: "Too risky for your goal"  │
│               │  │                                       │
│ Outcome →     │  │ New strategy starts as `draft`        │
│ ERC-8004      │  │ → promote through lifecycle           │
│ reputation    │  │                                       │
└───────────────┘  └───────────────────────────────────────┘
```

---

## KeeperHub Execution Wallet (How Workflows Spend)

```text
User's personal wallet (MetaMask/Rabby)
  │
  │  deposits $50K USDC + ETH for gas
  ↓
User's KeeperHub wallet (Turnkey secure enclave)
  │  Key stored in hardware enclave. Exportable anytime.
  │
  │  Workflow runs:
  │    Step 1: approve Aave to spend USDC  → signed → submitted
  │    Step 2: aave.supply(15000 USDC)     → signed → submitted
  │    Step 3: morpho.deposit(22500 USDC)  → signed → submitted
  ↓
Funds deployed across DeFi protocols, earning yield
```

- User can **withdraw** or **export key** anytime
- Workflows can only spend what's in the KeeperHub wallet
- The agent's iNFT wallet (ERC-6551) is **separate** — earns x402 fees on 0G Chain

---

## Strategy Lifecycle (Never Silently Mutated)

```text
draft → paper → canary → stable → deprecated
```

| Stage | What Happens |
|-------|-------------|
| `draft` | Generated but untested. Not discoverable. |
| `paper` | Shadow-monitored against live data. No real money. |
| `canary` | Small-cap live deployment. Discoverable with ⚠️. |
| `stable` | Broadly discoverable. Real track record. |
| `deprecated` | No new deployments. History preserved. |

### Version Control via 0G Storage CID Chain

```text
v1 (CID: abc123) → priorCids: []
v2 (CID: def456) → priorCids: [abc123]       ← derived from v1
v3 (CID: ghi789) → priorCids: [abc123, def456] ← learned from both
```

Each CID is tamper-proof (Merkle root). Like git commits on decentralized storage.

### Why Update vs Create New?

**UPDATE** when goal is the same, parameters need adjusting:

- v1: 60% Aave, 40% Morpho → yielded 4.1% (Aave rate dropped)
- v2: 30% Aave, 50% Morpho, 20% Spark → same goal, better parameters

**CREATE NEW** when goal is fundamentally different.

### What Triggers Updates?

KeeperHub cron (24h) checks: rate drift, underperformance, external events (hacks, governance), regime shifts. Agent loads past versions from 0G Storage, runs pipeline with memory, proposes v(n+1).

---

## Deployment Instance Controls

Each user gets their own KeeperHub workflow:

- Budget cap + chain/protocol allowlists
- Slippage + rebalance frequency caps
- Pause / Resume / Stop controls

**Approval modes:**

| Mode | Behavior |
|------|----------|
| **Manual** | Every rebalance needs approval |
| **Guardrailed Auto** | Small moves auto-execute, large ones need approval |
| **Full Auto** | Only hard limits enforced |

---

## The 7-Step Strategy Pipeline

> "A good strategy agent is not 'LLM reads DefiLlama and vibes.'"

| Step | What | Tool |
|------|------|------|
| 1. Universe Filter | Only audited protocols with TVL > threshold | DefiLlama + on-chain |
| 2. Feature Builder | APY, utilization, TVL trend, rate stability | DefiLlama + Uniswap API |
| 3. Candidate Generator | LLM proposes 2-3 allocations (TEE attested) | 0G Compute (sealed) |
| 4. Deterministic Compiler | Convert to typed KeeperHub workflow template | Internal |
| 5. Risk Validator | Hard rules reject unsafe plans | Internal |
| 6. Simulator | Estimate net yield after gas, failure modes | Internal |
| 7. Deploy | Create KeeperHub workflow + register on ERC-8004 | KeeperHub MCP |

**LLM proposes. Rules constrain. Compiler makes execution deterministic.**

---

## Evidence Bundle (What Makes Us Different)

For every strategy version, stored on 0G Storage:

```json
{
  "strategyFamily": "conservative-stablecoin-yield",
  "version": 3,
  "priorCids": ["abc", "def"],
  "lifecycle": "stable",
  "pipeline": {
    "step1_universe": {
      "protocolsConsidered": 12, "surviving": ["Aave", "Morpho", "Spark"],
      "filterReasons": ["TVL < $10M", "No audit", "Exploit in 90d"]
    },
    "step2_features": {
      "snapshot": { "aaveUSDC": "6.8%", "morphoCurated": "9.2%", "sparkDAI": "7.1%" },
      "teeAttestation": "0x7f8a..."
    },
    "step3_candidates": {
      "proposed": [
        { "alloc": "60% Morpho, 40% Aave", "hypothesis": "Morpho stable" },
        { "alloc": "40% Morpho, 30% Aave, 30% Spark", "hypothesis": "Diversify" }
      ],
      "selected": "B",
      "rationale": "v2 over-weighted Morpho (70%), reducing for diversification",
      "teeAttestation": "0xb3c1..."
    },
    "step5_riskCheck": { "passed": true, "warnings": ["Spark TVL trending -3%/week"] },
    "step6_simulation": { "estimatedNetAPY": "7.4%", "estimatedGasCost": "$12/month" }
  },
  "outcomes": { "started": "2026-05-01", "actualYield": null }
}
```

**A DefiLlama scraper gives:** "Morpho 9.2%" → pick highest.
**StrategyForge gives:** every step TEE-attested, memory-informed, with full evidence trail on 0G Storage.

---

## ERC Stack

| ERC | Role |
|-----|------|
| **ERC-7857** | Agent as iNFT — brain on 0G Storage, evolves each cycle |
| **ERC-6551** | iNFT's own wallet — earns x402 fees from strategy runs |
| **ERC-8004 Identity** | Published strategies registered on-chain, discoverable by any agent |
| **ERC-8004 Reputation** | Per-strategy track record posted after every run |
| **ERC-8004 Validation** | TEE attestation verification on-chain |

### iNFT = The Agent's Identity

```text
ERC-7857 iNFT (tokenId: 42)
  ├── Brain: 0G Storage CID → evidence bundles, memory DAG
  │   └── Updates after each strategy cycle (evolves)
  ├── ERC-6551 Wallet (Token Bound Account)
  │   └── Earns USDC from x402 strategy runs
  └── ERC-8004 Identity Registry
      └── Discoverable: "find strategy agents with DeFi yield expertise"
```

---

## Target Tracks

### Primary: KeeperHub — Best Use ($2,500) ✅

**What Luca asked for (verbatim from workshop):**
> *"Wrap a publish_workflow in an ERC-8004 registration so any agent can discover it, expose that call behind x402 as a payment rail, and post reputation back on-chain after every run."*

**What we deliver:**

1. ERC-8004 registration wrapping `publish_workflow`
2. x402 payment rail (already in KeeperHub, we wire to ERC-8004 discovery)
3. On-chain reputation posted after every run
4. Agent-controlled workflow versioning (draft → stable lifecycle)
5. Verifiable reasoning stored alongside each strategy

**Mergeable contribution:** The ERC-8004 ↔ KeeperHub bridge pattern. Any builder can reuse this to register their workflows on-chain and build reputation.

### Primary: 0G Track 2 — Autonomous Agents ($1,500) ✅

**Framing for 0G: Autonomous agent with verifiable intelligence.**

| 0G Requirement | How We Hit It |
|----------------|--------------|
| Autonomous, long-running | Cron-based monitoring, proposes version upgrades |
| Persistent memory (KV + Log) | KV: market state. Log: evidence + memory DAG with `priorCids` |
| Self-fact-checking (0G Compute) | Pipeline steps 3 + 5 use sealed inference |
| iNFT (ERC-7857) | Agent = iNFT, brain evolves on 0G Storage |
| ERC-6551 | iNFT wallet earns x402 fees |

### Bonus: KeeperHub Feedback ($250) 💰

Document every integration friction point. Free money.

### Secondary: Uniswap ($500–$1,000)

3/4 API endpoints used in feature builder (quote, check_approval, pool data) + FEEDBACK.md.

---

## Demo Scripts (Two Angles, Same Product)

### KeeperHub Demo (Lead: Trust Layer + Contribution)

**Scene 1 (0:00–0:40):** User enters goal → agent searches ERC-8004 registry + reputation data → finds "Conservative Yield v3" (47 runs, 8.2% avg). *"This strategy is discoverable on-chain via ERC-8004, with verified reputation from 47 executions."*

**Scene 2 (0:40–1:20):** User deploys → KeeperHub workflow created → executes → creator earns via x402 → outcome posted to ERC-8004 Reputation. *"After execution, reputation is posted on-chain. Run #48 recorded."*

**Scene 3 (1:20–2:00):** No match → 7-step pipeline → AI writes KeeperHub workflow → registers on ERC-8004. *"The agent wrote the KeeperHub workflow AND registered it on-chain in one flow."*

**Scene 4 (2:00–2:30):** Cron detects rate drift → agent proposes v4 → new version starts as `draft`. *"Agent-controlled versioning. KeeperHub cron monitors, agent evolves, reputation persists."*

**Scene 5 (2:30–3:00):** *"StrategyForge is the trust layer KeeperHub's marketplace was missing — on-chain discovery, reputation, and verifiable reasoning. All mergeable."*

### 0G Demo (Lead: Verifiable Intelligence)

**Scene 1 (0:00–0:30):** Show the iNFT on 0G explorer. Brain CID. ERC-6551 wallet with earned USDC. *"This agent IS an iNFT. Evolving brain. Its own wallet."*

**Scene 2 (0:30–1:30):** Pipeline runs → show TEE attestation hashes per step. *"Every reasoning step is TEE-attested via 0G Compute."*

**Scene 3 (1:30–2:15):** 0G Storage DAG: v1 → v2 → v3. Click each → evidence bundle. *"A verifiable DAG of how this agent learned from its mistakes."*

**Scene 4 (2:15–2:40):** iNFT metadata before/after cycle. Brain CID changed. *"Intelligence evolves. Identity persists."*

**Scene 5 (2:40–3:00):** *"Autonomous agent with verifiable intelligence — TEE reasoning, memory DAG, iNFT identity — all on 0G."*

---

## DeFi Protocols in MVP

- **Aave/Spark** (Lending) — Supply USDC, earn interest from borrowers (6-8% APY)
- **Morpho** (Yield vault) — Curator splits across lending markets for higher blended yield (~9%)
- **Uniswap** (LP) — Provide liquidity, earn swap fees. Risk: impermanent loss

---

## MVP Scope

| Dimension | Scope |
|-----------|-------|
| Asset class | Stablecoin yield only |
| Chains | Ethereum (+ Base if KeeperHub supports) |
| Protocols | Aave, Morpho, Spark |
| Strategy types | Conservative and Balanced |
| Actions | Allocate, rebalance, pause, unwind |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript strict |
| Agent inference | 0G Compute `@0glabs/0g-serving-broker` |
| Memory | 0G Storage `@0gfoundation/0g-ts-sdk` (KV + Log) |
| Identity | ERC-7857 iNFT + ERC-6551 TBA |
| Trust | ERC-8004 Identity + Reputation + Validation |
| Execution | KeeperHub MCP server |
| Payments | x402 (`@x402/fetch`, `@x402/express`) |
| DeFi data | DefiLlama + Uniswap API |
| Dashboard | React + Vite |
| App Index | SQLite (strategy search, filters) |

---

## StrategyForge MCP Server

| Tool | Description |
|------|-------------|
| `search_strategies` | Search by goal, risk, chains (queries ERC-8004 + App Index) |
| `get_strategy` | Full strategy version with evidence bundle |
| `deploy_strategy` | Deploy a version as user-specific KeeperHub workflow |
| `generate_strategy` | Trigger 7-step pipeline for new strategy |
| `get_reputation` | Strategy track record from ERC-8004 |

---

## Build Timeline (9 Days)

| Day | Deliverable |
|-----|------------|
| **1** | Scaffold + 0G Compute (one sealed inference) + KeeperHub MCP connected |
| **2** | Data layer: DefiLlama + Uniswap API. Universe filter + feature builder |
| **3** | Strategy pipeline: candidate generator + compiler + risk validator |
| **4** | 0G Storage: evidence bundles with `priorCids`. Memory loading |
| **5** | KeeperHub: create → run → publish with x402. Strategy lifecycle |
| **6** | ERC-8004 registries (Identity/Reputation/Validation) + ERC-7857 iNFT + ERC-6551 |
| **7** | Search-first flow: ERC-8004 query → reuse OR create. Reputation feedback loop |
| **8** | Dashboard + StrategyForge MCP server |
| **9** | Tests + demo video + FEEDBACK.md + README |

---

## Prize Ceiling

| Track | Prize | Position |
|-------|-------|----------|
| 0G Track 2 | $1,500 | $1,500 (flat) |
| KeeperHub Main | $500–$2,500 | $1,500–$2,500 |
| KeeperHub Feedback | $250 | $250 |
| Uniswap | $500–$1,000 | Secondary |
| **Total** | | **$3,750–$5,250** |
