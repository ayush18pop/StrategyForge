# StrategyForge — Trust Layer for KeeperHub's Strategy Marketplace

> **Validated by Luca (KeeperHub Head of Growth):** *"This is a strong idea and fits our vision very nicely! This definitely does align with the prize track, so full course ahead!"*

---

## One-Line Pitch

**KeeperHub has a marketplace. StrategyForge makes it trustworthy.**

Three things that don't exist today:
1. **Verifiable reasoning** — proof the strategy was reasoned about, not randomly generated (0G Compute TEE attestation, chatID-anchored)
2. **On-chain reputation** — proof it worked, how many times, what yield (AgentRegistry + ReputationLedger, deployed by us on 0G Chain)
3. **Evolving memory** — proof v3 learned from v1's failures (priorCids DAG on 0G Storage)

---

## What Is NOT the Pitch

These are correct implementation details. They do not belong in the pitch.

- Kelly Criterion / Sharpe Ratio / VaR → lives inside the evidence bundle. Judges see it when they open 0G Storage proof.
- 500+ protocol scanning → MVP is 3 protocols done right. Breadth is a v2 story.
- Novel primitive composition → out of scope for this hackathon.
- MPT efficient frontier → implementation detail inside the Strategist step.

Lead with trust. Show math when asked "what's in the evidence bundle?"

---

## The Three Trust Questions StrategyForge Answers

| Without StrategyForge | With StrategyForge |
|---|---|
| "Was this strategy reasoned about?" | TEE attestation hash per pipeline step — proof the LLM ran |
| "Has it ever worked?" | ReputationLedger — every run posts yield on-chain |
| "Is v3 smarter than v1?" | priorCids DAG — v3 demonstrably loaded v1's failure before running |

Any agent, anywhere, can verify all three without running the strategy.

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
│  1. AgentRegistry       → publish workflow registered        │
│                            on-chain, discoverable by any     │
│                            caller on 0G Chain                │
│                                                              │
│  2. ReputationLedger    → after every run, outcome posted    │
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
│                            (draft → live → deprecated)       │
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
┌─── STEP 2: SEARCH (AgentRegistry + App Index) ────────────┐
│ Query existing published strategies with reputation data: │
│   "Conservative Yield v3" — 8.2% avg, 47 runs, stable ✅  │
│   "Balanced DeFi v1"     — 6.5% avg, 12 runs, live ⚠️    │
└────────────────────────────────────────────────────────────┘
                    ↓
            GOOD MATCH?
           /           \
         YES            NO
          ↓              ↓
┌── REUSE ──────┐  ┌── CREATE NEW ─────────────────────────┐
│ Show user:    │  │ 9-step pipeline:                      │
│ • why it fits │  │  1. Universe filter                   │
│ • track record│  │  2. Feature builder                   │
│ • evidence    │  │  3. Researcher (0G Compute)           │
│               │  │  4. Strategist (0G Compute)           │
│ Deploy as     │  │  5. VaR check                         │
│ KeeperHub     │  │  6. Critic (0G Compute)               │
│ workflow      │  │  7. Compiler (deterministic)          │
│               │  │  8. Risk validator                    │
│ Creator earns │  │  9. Publish to KeeperHub + register   │
│ via x402      │  │     in AgentRegistry                  │
│               │  │                                       │
│ Outcome →     │  │ OR REFUSE: "Too risky for your goal"  │
│ Reputation    │  │                                       │
│ Ledger        │  │ New strategy starts as `draft`        │
│               │  │ → promote through lifecycle           │
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
- The agent's iNFT wallet (ERC-6551) is **separate** — intended as the agent's identity wallet. Whether KeeperHub's `publish_workflow` x402 earnings can be routed directly to the TBA address needs confirmation with KeeperHub's team. For MVP, the agent operator wallet receives execution earnings.

---

## Strategy Lifecycle (Never Silently Mutated)

```text
draft → live → deprecated
```

| Stage | What Happens |
|-------|-------------|
| `draft` | Generated, not yet deployed to KeeperHub. Not discoverable. |
| `live` | Deployed as KeeperHub workflow. Discoverable. Track record accumulates in ReputationLedger. |
| `deprecated` | Superseded by newer version. No new deployments. History preserved. |

> Staged promotion (paper → canary → stable) is a v2 production concept. For MVP, strategies go draft → live. The versioning and immutability guarantees are the same.

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

## The Strategy Pipeline

> "A good strategy agent is not 'LLM reads DefiLlama and vibes.'"

| Step | What | Tool |
|------|------|------|
| 1. Universe Filter | Only audited protocols with TVL > threshold | DefiLlama + on-chain |
| 2. Kelly Prior Computation | p/q/sigma per protocol, load prior Critic updates | Deterministic |
| 3. Researcher | Regime classification + protocol signals (TEE attested) | 0G Compute (sealed) |
| 4. Strategist | Sharpe + normalized Kelly → LLM proposes candidates (TEE attested) | 0G Compute (sealed) |
| 5. VaR Check | Reject candidates exceeding user loss tolerance | Deterministic |
| 6. Critic | Attacks survivors, selects best, outputs updated Kelly priors (TEE attested) | 0G Compute (sealed) |
| 7. Compiler | Maps allocation to KeeperHub-native workflow JSON (using protocol action vocabulary) + gas estimate | Deterministic |
| 8. Risk Validator | Hard rules reject unsafe specs | Deterministic |
| 9. Deploy | Write evidence bundle → 0G Storage, register AgentRegistry, record ReputationLedger, create KeeperHub workflow | KeeperHub MCP |

**Math runs first. LLM interprets. Rules constrain. Compiler makes execution deterministic.**

> **Pipeline framing:** This is a sequential pipeline with adversarial validation (Critic attacks candidates). It is NOT a multi-agent debate loop — the Critic does not send candidates back to the Strategist for revision. It selects the best surviving candidate and updates Kelly priors for the next version. Don't call it a "swarm."

---

## Evidence Bundle (What Makes Us Different)

For every strategy version, stored on 0G Storage:

```json
{
  "strategyFamily": "conservative-stablecoin-yield",
  "version": 3,
  "priorCids": ["abc", "def"],
  "lifecycle": "live",
  "pipeline": {
    "step1_universe": {
      "protocolsConsidered": 12, "surviving": ["Aave", "Morpho", "Spark"],
      "filterReasons": ["TVL < $10M", "No audit", "Exploit in 90d"]
    },
    "step2_kellyPriors": {
      "aave":   { "p": 0.95, "q": 0.05, "r": 0.068, "l": 0.01, "f_kelly": 0.94, "sigma": 0.003 },
      "morpho": { "p": 0.88, "q": 0.12, "r": 0.092, "l": 0.05, "f_kelly": 0.82, "sigma": 0.007 },
      "spark":  { "p": 0.93, "q": 0.07, "r": 0.071, "l": 0.02, "f_kelly": 0.90, "sigma": 0.004 }
    },
    "step3_researcher": {
      "regime": "stable",
      "snapshot": { "aaveUSDC": "6.8%", "morphoCurated": "9.2%", "sparkDAI": "7.1%" },
      "signals": [{ "protocol": "morpho", "signal": "curator TVL -4%/week", "severity": "low" }],
      "teeAttestation": "0x7f8a..."
    },
    "step4_strategist": {
      "sharpeRankings": [
        { "protocol": "morpho", "sharpe": 1.24 },
        { "protocol": "spark",  "sharpe": 1.12 },
        { "protocol": "aave",   "sharpe": 1.07 }
      ],
      "candidates": [
        { "id": "A", "alloc": "60% Morpho, 40% Aave", "kellyDeviation": "within 20pp" },
        { "id": "B", "alloc": "40% Morpho, 30% Aave, 30% Spark", "kellyDeviation": "diversified from Kelly baseline" }
      ],
      "teeAttestation": "0xb3c1..."
    },
    "step5_varCheck": { "passed": true, "var95": "-3.1%", "threshold": "-8%", "rejectedCandidates": [] },
    "step6_critic": {
      "selected": "B",
      "rationale": "v2 over-weighted Morpho (70%), reducing for diversification",
      "updatedKellyPriors": { "morpho": { "p": 0.82, "reason": "curator underperformed in v2" } },
      "teeAttestation": "0xc4d2..."
    },
    "step7_compiler": { "gasEstimate": "$12/month", "nodeCount": 3 },
    "step8_riskCheck": { "passed": true, "warnings": ["Spark TVL trending -3%/week"] }
  },
  "outcomes": { "started": "2026-05-01", "actualYield": null }
}
```

**A DefiLlama scraper gives:** "Morpho 9.2%" → pick highest.
**StrategyForge gives:** every step TEE-attested, memory-informed, with full evidence trail on 0G Storage.

---

## Contract Stack

| Contract | Role |
|----------|------|
| **ERC-7857 iNFT** | Agent as iNFT — brain CID on 0G Storage, evolves each cycle. We deploy this. |
| **ERC-6551 TBA** | iNFT's own wallet (Token Bound Account) — earns x402 fees from strategy runs |
| **AgentRegistry.sol** | Agent registered ONCE. `agentId = 1`. Maps agentId → metadata CID on 0G Storage. Discoverable by any caller. We deploy this on 0G Chain. |
| **ReputationLedger.sol** | `record(agentId, strategyTag, yieldBps, evidenceCid)` — per-strategy outcomes. We deploy this on 0G Chain. |

> ERC-8004 is not deployed on 0G Chain. We deploy our own AgentRegistry and ReputationLedger — simple, purpose-built contracts (~80 lines each). No external dependency.

### TEE Attestation Chain of Trust

The on-chain anchor is NOT a direct TEE verification in the contract. The chain is:

```
Pipeline step (0G Compute)
  → response header: ZG-Res-Key = chatID
  → chatID stored as attestationHash in evidence bundle
  → evidence bundle written to 0G Storage → CID (Merkle root, tamper-proof)
  → CID registered in AgentRegistry on-chain

VERIFICATION (by anyone, off-chain):
  1. Read CID from AgentRegistry
  2. Fetch evidence bundle from 0G Storage (CID guarantees content integrity)
  3. Call: broker.inference.processResponse(providerAddress, chatID) → true/false
```

No trust is required in step 2 — if the content doesn't match the Merkle root, the fetch fails. Step 3 uses the 0G broker SDK to verify the TEE signature. The on-chain CID is the tamper-proof anchor.

### iNFT = The Agent's Identity

The iNFT is StrategyForge the agent — not the user, not a strategy. One token. Minted once on deploy.

```text
ERC-7857 iNFT (tokenId = 1)
  │
  ├── brainCid → 0G Storage "brain root"
  │   A meta-document updated after EVERY pipeline run:
  │   {
  │     "strategies": {
  │       "conservative-yield": "cid_v3",   ← latest CID per family
  │       "balanced-dual-chain": "cid_v1"
  │     },
  │     "totalRuns": 84,
  │     "updatedAt": "2026-05-01"
  │   }
  │   brainCid changes on-chain after each cycle → provable evolution
  │
  ├── ERC-6551 Wallet (Token Bound Account)
  │   Earns USDC from x402 payments when users run strategies
  │   Agent earns passively — no pipeline involvement needed
  │
  └── AgentRegistry agentId = tokenId
      discoverable by any caller on 0G Chain
      reputation tagged per strategy family:
      getSummary(agentId=1, "conservative-yield-v3")
```

**When brainCid updates:** After every pipeline run (creation or update), the server layer re-uploads the brain root document to 0G Storage and calls `iNFT.updateBrain(1, newCid)`. This is the on-chain proof the agent learned something.

**What the iNFT does NOT do:** It does not gate access. It does not change per user. It does not live inside the pipeline. It is purely the agent's identity and knowledge pointer.

---

## Target Tracks

### Primary: KeeperHub — Best Use ($2,500) ✅

**What Luca asked for (verbatim from workshop):**
> *"Wrap a publish_workflow in an ERC-8004 registration so any agent can discover it, expose that call behind x402 as a payment rail, and post reputation back on-chain after every run."*

**What we deliver:**

1. AgentRegistry registration wrapping `publish_workflow` — on-chain discoverability
2. x402 payment rail (already in KeeperHub, we wire to AgentRegistry discovery)
3. On-chain reputation posted to ReputationLedger after every run
4. Agent-controlled workflow versioning (draft → live → deprecated, immutable per version)
5. Verifiable reasoning stored alongside each strategy (TEE chatID-anchored)

**Mergeable contribution:** The AgentRegistry + ReputationLedger pattern. Any KeeperHub builder can deploy these contracts and wire their workflows to on-chain reputation.

### Primary: 0G Track 2 — Autonomous Agents ($1,500) ✅

**Framing for 0G: Autonomous agent with verifiable intelligence.**

| 0G Requirement | How We Hit It |
|----------------|--------------|
| Autonomous, long-running | Cron-based monitoring, proposes version upgrades |
| Persistent memory (KV + Log) | KV: market state. Log: evidence + memory DAG with `priorCids` |
| Self-fact-checking (0G Compute) | Researcher + Strategist + Critic all use sealed inference (3 TEE-attested calls) |
| iNFT (ERC-7857) | Agent = iNFT, brain evolves on 0G Storage |
| ERC-6551 | iNFT wallet earns x402 fees |

### Bonus: KeeperHub Feedback ($250) 💰

Document every integration friction point. Free money.

### Secondary: Uniswap ($500–$1,000)

3/4 API endpoints used in feature builder (quote, check_approval, pool data) + FEEDBACK.md.

---

## Demo Scripts (Two Angles, Same Product)

### KeeperHub Demo (Lead: Trust Layer + Contribution)

**Scene 1 (0:00–0:40):** User enters goal → agent queries AgentRegistry + ReputationLedger (agentId=1, tag="conservative-yield-v3") → finds "Conservative Yield v3" (47 runs, 8.2% avg). *"This strategy is discoverable on-chain with verified reputation from 47 executions — no trust required."*

**Scene 2 (0:40–1:20):** User deploys → KeeperHub workflow created → executes → creator earns via x402 → `reputationLedger.record(1, "conservative-yield-v3", 82, evidenceCid)` posted on-chain. *"After execution, reputation is posted. Run #48 recorded on-chain."*

**Scene 3 (1:20–2:00):** No match → 9-step pipeline → AI writes KeeperHub workflow → registers in AgentRegistry. *"The agent wrote the KeeperHub workflow AND registered it on-chain with TEE attestation in one flow."*

**Scene 4 (2:00–2:30):** Cron detects rate drift (threshold: 0.5% APY for demo) → agent loads priorCids from 0G Storage → proposes v4 with memory of v3's failure. *"Agent-controlled versioning. KeeperHub cron monitors, agent evolves using its own past evidence."*

**Scene 5 (2:30–3:00):** *"StrategyForge is the trust layer KeeperHub's marketplace was missing — on-chain discovery, reputation, and verifiable reasoning. All mergeable."*

### 0G Demo (Lead: Verifiable Intelligence)

**Scene 1 (0:00–0:30):** Show the iNFT on 0G explorer. Brain CID. ERC-6551 wallet with earned USDC. *"This agent IS an iNFT. Evolving brain. Its own wallet."*

**Scene 2 (0:30–1:30):** Pipeline runs → show TEE attestation hashes per step. *"Every reasoning step is TEE-attested via 0G Compute."*

**Scene 3 (1:30–2:15):** 0G Storage DAG: v1 → v2 → v3. Click each → evidence bundle. *"A verifiable DAG of how this agent learned from its mistakes."*

**Scene 4 (2:15–2:40):** iNFT metadata before/after cycle. Brain CID changed. *"Intelligence evolves. Identity persists."*

**Scene 5 (2:40–3:00):** *"Autonomous agent with verifiable intelligence — TEE reasoning, memory DAG, iNFT identity — all on 0G."*

---

## DeFi Protocols in MVP

Three. Not twenty. Not five hundred. Three done correctly is more compelling than fifty done sloppily.

- **Aave** (Lending) — Supply USDC, earn interest from borrowers (6–8% APY). Benchmark — the baseline every other protocol is compared against.
- **Morpho Curated** (Yield vault) — Curator routes capital across lending markets for higher blended yield (~9%). Higher reward, but introduces curator risk.
- **Spark** (Lending, DAI-focused) — Similar mechanics to Aave but separate governance. Sometimes diverges in APY, providing genuine diversification.

**Why only these three:** They have structurally distinct yield mechanisms and different governance / curator risk profiles — Aave's base rate, Morpho's curator-managed blended yield, and Spark's DAI-specific governance. That's enough to demonstrate real portfolio math without overclaiming. Adding more protocols adds API surface area, not demo quality.

**Uniswap** — used for liquidity-adjusted universe filtering (high price impact = penalize that token pair in the Universe Filter) and swap quotes during rebalancing. Not a yield protocol in MVP. LP strategies are v2 scope.

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
| Memory | 0G Storage `@0gfoundation/0g-ts-sdk` (KV + Blob) |
| Identity | ERC-7857-inspired iNFT (simplified) + ERC-6551 TBA |
| Trust | AgentRegistry.sol + ReputationLedger.sol (custom, deployed on 0G Chain) |
| Execution | KeeperHub MCP server |
| Monitoring cron | node-cron inside `packages/server` — checks ReputationLedger, triggers UpdateOrchestrator |
| Payments | x402 (`@x402/fetch`, `@x402/express`) |
| DeFi data | DefiLlama (APYs + 30-day historical for σ) + Uniswap API |
| Dashboard | React + Vite |
| App Index | SQLite (strategy search, filters) |

---

## StrategyForge MCP Server

3 tools for MVP. `deploy_strategy` and `get_strategy` are documented as v2.

| Tool | Description | Priority |
|------|-------------|----------|
| `search_strategies` | Search by goal, risk, chains (queries AgentRegistry + App Index) | **MVP** |
| `generate_strategy` | Trigger 9-step pipeline for new strategy | **MVP** |
| `get_reputation` | Strategy track record from ReputationLedger | **MVP** |
| `get_strategy` | Full strategy version with evidence bundle from 0G Storage | v2 |
| `deploy_strategy` | Deploy a version as user-specific KeeperHub workflow | v2 |

---

## Build Timeline (9 Days)

> **Day 1 verification checklist — ALL must pass before writing application code:**
> 1. 0G Compute: one real sealed inference → chatID from `ZG-Res-Key` header stored
> 2. KeeperHub MCP: `list_workflows` returns success
> 3. **KeeperHub action vocab:** call `list_action_schemas` MCP tool → capture full output → identify exact `type` strings for Aave supply, Morpho deposit, Spark supply. Compiler is built from this output. **If native Aave/Morpho/Spark actions are not in the schema, use `evm.call` with ABI-encoded calldata as fallback** — test this path on day 1 so it's not a surprise on day 5.
> 4. **KeeperHub workflow structure:** call `create_workflow` with a minimal test (trigger + 1 node + 1 edge) → confirm `nodes`/`edges` format is accepted
> 5. Stub contracts deployed to 0G Chain testnet — confirms Hardhat + RPC work
> 6. Check 0G Chain block time — note it for demo pacing

| Day | Deliverable |
|-----|------------|
| **1** | Scaffold + 0G Compute verified end-to-end (sealed inference → chatID stored) + KeeperHub MCP connected |
| **2** | **Deploy all 4 contracts to 0G Chain** (stub implementations — confirms toolchain). Data layer: DefiLlama + Uniswap. Universe filter + feature builder |
| **3** | Researcher step (0G Compute, TEE attested) + 0G Storage writes (evidence bundle + KV pointers) |
| **4** | Strategist step (Kelly + Sharpe, 0G Compute) + Deterministic Compiler (KeeperHub-native workflow JSON output) |
| **5** | Critic step (0G Compute) + Risk Validator + KeeperHub: create → run → publish with x402 |
| **6** | Finalize contracts (AgentRegistry + ReputationLedger + iNFT logic). Search-first flow. Reputation record loop. |
| **7** | Basic dashboard. v1→v2 update flow end-to-end. |
| **8** | StrategyForge MCP server (3 tools: search_strategies, generate_strategy, get_reputation) + pre-seed synthetic v1/v2 evidence bundles for demo |
| **9** | Tests + demo recording + FEEDBACK.md + README |

### Demo Setup Notes

The following are intentional demo parameters (not bugs):
- **Drift threshold:** 0.5% APY deviation (production default: 2%). Lowered so the self-improvement loop triggers during the hackathon window.
- **Pre-seeded evidence bundles:** Two synthetic `v1` and `v2` evidence bundles written to 0G Storage. CIDs are real. The Critic reads them during demo.
- **Pre-seeded reputation records:** Run a setup script before recording that calls `reputationLedger.record(1, "conservative-yield-v3", yieldBps, evidenceCid)` 47 times with synthetic outcome CIDs. Do the same for `"balanced-defi-v1"` (12 records) — this strategy appears in the Scene 1 search results, so the contract must also show real records for it. The contract will show 47 + 12 real records. If a judge queries the contract directly, they see real records — not 2. Do this before demo day.
- **Execution:** KeeperHub runs real transactions on testnet. No paper mode in KeeperHub. Use a funded testnet wallet + call `keeperhub.run_workflow` manually for demo rather than waiting for cron.
- **Notification channel for v2 availability:** Dashboard banner. No email/XMPP/Discord in MVP.
- **0G Chain finality:** Check 0G Chain's average block time before recording the demo. If `updateBrain` tx takes >10s, don't wait on-screen for confirmation — show tx hash immediately and cut to the explorer showing it confirmed. Design demo flow around actual finality, not assumed instant finality.
- **KeeperHub action vocabulary:** Call `list_action_schemas` on day 1 — this returns the full list of valid node `type` strings with their config schemas. The Compiler's protocol template table is built from this output, not from guesses. Conditions are separate condition nodes in the graph, not inline `if` fields.
- **Uniswap track:** Realistic prize ceiling is $500. Not competing for the primary Uniswap prize. FEEDBACK.md is the play.

---

## Prize Ceiling

| Track | Prize | Position |
|-------|-------|----------|
| 0G Track 2 | $1,500 | $1,500 (flat) |
| KeeperHub Main | $500–$2,500 | $1,500–$2,500 |
| KeeperHub Feedback | $250 | $250 |
| Uniswap | $500–$1,000 | Secondary |
| **Total** | | **$3,750–$5,250** |
