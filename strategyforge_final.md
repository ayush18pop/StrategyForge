# StrategyForge — Trust Layer for KeeperHub's Strategy Marketplace

> **Validated by Luca (KeeperHub Head of Growth):** _"This is a strong idea and fits our vision very nicely! This definitely does align with the prize track, so full course ahead!"_

---

## One-Line Pitch

**KeeperHub has a marketplace. StrategyForge makes it trustworthy.**

Three things that don't exist today:

1. **Verifiable reasoning** — proof the strategy was reasoned about, not randomly generated (OpenRouter Request ID tracked)
2. **On-chain reputation** — proof it worked, how many times, what yield (AgentRegistry + ReputationLedger, deployed by us on 0G Chain)
3. **Evolving memory** — proof v3 learned from v1's failures (prior versions tracked in MongoDB)

---

## What Is NOT the Pitch

These are correct implementation details. They do not belong in the pitch.

- Workflow node vocabulary is schema-driven via KeeperHub `list_action_schemas` (see `packages/keeperhub/src/dump-action-schemas.ts`). Workflows are built by composing structural nodes: Messaging (Discord, Slack, Email, Telegram), Condition checks, Loops (For Each), Database Queries, HTTP Requests, and System Code execution.
- Novel primitive composition → out of scope for this hackathon.

Lead with trust. Show the evidence bundle when asked "how do you prove the reasoning wasn't fabricated?"

---

## The Three Trust Questions StrategyForge Answers

| Without StrategyForge               | With StrategyForge                                                 |
| ----------------------------------- | ------------------------------------------------------------------ |
| "Was this strategy reasoned about?" | OpenRouter Request ID per pipeline step — proof the LLM ran        |
| "Has it ever worked?"               | ReputationLedger — every run posts execution outcomes on-chain     |
| "Is v3 smarter than v1?"            | Explicit prior version references stored in MongoDB — v3 demonstrably loaded v1's failure before running |

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

**StrategyForge adds the trust, discovery, reasoning, and evolution layer on top of KeeperHub.**

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
│  3. MongoDB Evidence    → evidence bundle: WHY this strategy,│
│                            what data was used, memory DAG    │
│                            linking v1 → v2 → v3              │
│                                                              │
│  4. LLM Attestations    → Request IDs providing proof the    │
│                            reasoning wasn't fabricated        │
│                                                              │
│  5. Agent Versioning    → strategies evolve via memory,      │
│                            new versions go through lifecycle │
│                            (draft → live → deprecated)       │
└──────────────────────────────────────────────────────────────┘

## The DeFi Strategist Agent — personal git, on‑chain memory, and execution guarantees

Think of each agent as a living repository: every strategy version, every test run, every decision is committed as an immutable evidence bundle in MongoDB. This contains the pipeline inputs, the LLM reasoning, the compiler output (KeeperHub workflow JSON), and the resulting run receipts. The dashboard points to these records as a history of learning: you can open any version and see exactly which prior failures or experiments informed today's decision.

Operational correctness is guaranteed by three coupled mechanisms: deterministic compilation, on-chain anchoring of outcomes, and robust on-chain execution patterns. The compiler emits deterministic, idempotent workflows; every completed step writes a log back into the evidence bundle; and the ReputationLedger records outcome summaries.

Safety and observability are first class: preflight validators enforce hard spending caps, bounded rebalances, and rule‑based rejects; post‑run checks verify reasoning; and every transaction has an explorer link surfaced in the dashboard. This means auditors, users, and integrators can follow the entire lifecycle — from the LLM's reasoning, through deterministic compilation, to the final on‑chain receipts.
```

---

## What a Strategy Actually Is

A strategy is any complex execution workflow: a managed topology of conditions, loops, internal logic, messaging, and automation. Not an allocation portfolio model. It relies completely on the LLM to design the logic topology without mathematical pre-processing.

**Examples of strategies StrategyForge can design:**

- **Sky USDS Savings Auto-Deposit:** Monitors your USDS balance daily at 9 AM UTC. If it exceeds a threshold (Condition node), it automatically approves and deposits into sUSDS, followed by a Discord confirmation message.
- **Sky Auto-Claim SKY Rewards:** Monitors pending SKY rewards (Loop/Check). When rewards reach 100 SKY, automatically claims them. Then sends an email confirmation.
- **On-Chain Arbitrage Execution:** For Each loop checking token pairs. Condition node detects price gap. HTTP request node fetches external swap quote. Run Code computes slippage logic. Sends Slack alert on success.

The LLM designs the full workflow graph (Condition logic, Loops, Webhooks, Data querying, Action sequence, Notification channels). No static allocation matching or complex math is required.

## The Three Objects (Strategy ≠ Workflow)

| Concept                 | What It Is                                                                                                        | Where It Lives                                  |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **Strategy Version**    | A reusable automation blueprint with reasoning evidence, workflow graph, and execution track record               | MongoDB + App Index                             |
| **Deployment Instance** | A user-specific KeeperHub workflow created FROM a strategy version. Bound to user's wallet and config            | KeeperHub (execution)                           |
| **Memory Record**       | An observation: context snapshot, LLM reasoning, outcomes. Linked explicitly to past versions                    | MongoDB                                         |

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
│   "Conservative Yield v3" — 8.2% avg, 47 runs, live ✅     │
│   "Balanced DeFi v1"     — 6.5% avg, 12 runs, live ⚠️    │
└────────────────────────────────────────────────────────────┘
                    ↓
            GOOD MATCH?
           /           \
         YES            NO
          ↓              ↓
┌── REUSE ──────┐  ┌── CREATE NEW ─────────────────────────┐
│ Show user:    │  │ 7-step pipeline:                      │
│ • why it fits │  │  1. Discovery (action schemas)        │
│ • track record│  │  2. Researcher (Model-agnostic LLM)   │
│ • evidence    │  │  3. Strategist (Model-agnostic LLM)   │
│               │  │  4. Critic (Model-agnostic LLM)       │
│ Deploy as     │  │  5. Compiler (deterministic)          │
│ KeeperHub     │  │  6. Risk validator                    │
│ workflow      │  │  7. Publish to KeeperHub + register   │
│               │  │     in AgentRegistry                  │
│ Creator earns │  │                                       │
│ via x402      │  │                                       │
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
- For MVP, the agent operator wallet receives workflow execution earnings.

---

## Strategy Lifecycle (Never Silently Mutated)

```text
draft → live → deprecated
```

| Stage        | What Happens                                                                                |
| ------------ | ------------------------------------------------------------------------------------------- |
| `draft`      | Generated, not yet deployed to KeeperHub. Not discoverable.                                 |
| `live`       | Deployed as KeeperHub workflow. Discoverable. Track record accumulates in ReputationLedger. |
| `deprecated` | Superseded by newer version. No new deployments. History preserved.                         |

> Staged promotion (paper → canary → stable) is a v2 production concept. For MVP, strategies go draft → live. The versioning and immutability guarantees are the same.

### Version Control via MongoDB Linked Records

```text
v1 (id: abc123) → priorVersionId: null
v2 (id: def456) → priorVersionId: abc123       ← derived from v1
v3 (id: ghi789) → priorVersionId: def456       ← learned from both
```

Each version acts like a git commit, with direct database references ensuring a clear history of learning.

### Why Update vs Create New?

**UPDATE** when goal is the same, parameters need adjusting:

- v1: 60% Aave, 40% Morpho → yielded 4.1% (Aave rate dropped)
- v2: 30% Aave, 50% Morpho, 20% Spark → same goal, better parameters

**CREATE NEW** when goal is fundamentally different.

### What Triggers Updates?

StrategyForge monitoring cron (24h) checks: rate drift, underperformance, external events (hacks, governance), regime shifts. Agent loads past versions from MongoDB, runs pipeline with memory, proposes v(n+1).

---

## Deployment Instance Controls

Each user gets their own KeeperHub workflow:

- Budget cap + chain/protocol allowlists
- Slippage + rebalance frequency caps
- Pause / Resume / Stop controls

**Approval modes:**

| Mode                 | Behavior                                           |
| -------------------- | -------------------------------------------------- |
| **Manual**           | Every rebalance needs approval                     |
| **Guardrailed Auto** | Small moves auto-execute, large ones need approval |
| **Full Auto**        | Only hard limits enforced                          |

---

## The Strategy Pipeline

> "A good strategy agent is not 'LLM reads an API and generates a template.'"

| Step              | What                                                                                                            | Tool                |
| ----------------- | --------------------------------------------------------------------------------------------------------------- | ------------------- |
| 1. Discovery      | Fetch all available action types from KeeperHub (`list_action_schemas`)                                         | Deterministic       |
| 2. Researcher     | Gather relevant context (on-chain state, market data, signals) + classify what's needed                         | OpenRouter API      |
| 3. Strategist     | LLM designs 2-3 candidate workflow graphs (nodes + edges + trigger + conditions + alerts)                       | OpenRouter API      |
| 4. Critic         | Attacks candidates, references prior failures, selects best                                                     | OpenRouter API      |
| 5. Compiler       | Maps selected candidate to exact KeeperHub workflow JSON (nodes+edges DAG, type strings from action schemas)    | Deterministic       |
| 6. Risk Validator | Hard rules: tx nodes above threshold need condition gates, no unbounded spend loops                             | Deterministic       |
| 7. Deploy         | Write evidence bundle → MongoDB, register AgentRegistry, record ReputationLedger, create KeeperHub workflow | KeeperHub MCP       |

**LLM reasons end-to-end. Compiler makes execution deterministic. Rules enforce hard safety.**

> **Pipeline framing:** Sequential pipeline with adversarial validation (Critic attacks candidates). NOT a multi-agent debate loop — the Critic selects the best candidate, it does not send candidates back for revision. Don't call it a "swarm."

---

## Evidence Bundle (What Makes Us Different)

For every strategy version, stored in MongoDB:

```json
{
  "strategyFamily": "aave-health-guardian",
  "version": 2,
  "priorVersionId": "abc123",
  "lifecycle": "live",
  "pipeline": {
    "step1_discovery": {
      "availableActionTypes": ["aave.get-health-factor", "condition", "discord.send-message", "email.send", "..."],
      "relevantActionTypes": ["aave.get-health-factor", "condition", "discord.send-message"]
    },
    "step2_researcher": {
      "contextType": "monitoring",
      "currentState": {
        "healthFactor": 2.1,
        "collateralUSD": 50000,
        "debtUSD": 20000,
        "liquidationThreshold": 0.825
      },
      "signals": [
        { "subject": "ETH", "signal": "price down 5% this week", "severity": "medium" }
      ],
      "priorLessons": ["v1 threshold of 1.3 triggered false alerts — health factor bounced above 1.4 within minutes"],
      "attestationId": "req_0x7f8a..."
    },
    "step3_strategist": {
      "candidates": [
        {
          "id": "A",
          "description": "Poll every 5 min, single Discord alert at 1.5",
          "trigger": { "cron": "*/5 * * * *" },
          "nodeCount": 3,
          "hypothesis": "5-min cadence gives adequate lead time for manual repay before liquidation"
        },
        {
          "id": "B",
          "description": "Poll every 5 min, dual alert (Discord + Email) at 1.5, auto-repay 10% at 1.2",
          "trigger": { "cron": "*/5 * * * *" },
          "nodeCount": 6,
          "hypothesis": "Dual-channel alert ensures notification; auto-repay backstop prevents liquidation if user is unresponsive"
        }
      ],
      "attestationId": "req_0xb3c1..."
    },
    "step4_critic": {
      "selected": "B",
      "rationale": "v1 used alert-only and user missed a notification during a fast ETH drop — position was liquidated. Auto-repay backstop directly addresses this prior failure.",
      "priorLessonsApplied": ["v1 failure: alert-only insufficient during rapid price moves"],
      "attestationId": "req_0xc4d2..."
    },
    "step5_compiler": { "costEstimate": "$0/month", "nodeCount": 6 },
    "step6_riskCheck": { "passed": true, "warnings": [] }
  },
  "outcomes": { "started": "2026-05-01", "executionSuccessRate": null }
}
```

**A template generator gives:** "here's a monitoring workflow boilerplate."
**StrategyForge gives:** every step tracks its generation request, is memory-informed (v2 explicitly fixes v1's failure), with a full evidence trail in MongoDB.

---

## Contract Stack

| Contract                 | Role                                                                                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **AgentRegistry.sol**    | Agent registered ONCE. `agentId = 1`. Maps agentId → strategy _id. Discoverable by any caller. We deploy this on 0G Chain.             |
| **ReputationLedger.sol** | `record(agentId, strategyTag, successRateBps, evidenceCid)` — per-strategy execution outcomes. We deploy this on 0G Chain.               |

> ERC-8004 is not deployed on 0G Chain. We deploy our own AgentRegistry and ReputationLedger — simple, purpose-built contracts (~80 lines each). No external dependency.

### Execution Validation Chain

Execution history is mapped securely to verify performance:

```
Pipeline step (OpenRouter Inference)
  → Request ID stored as attestationId in evidence bundle
  → evidence bundle written to MongoDB → ObjectId generated
  → ID registered in AgentRegistry on-chain

VERIFICATION (by anyone):
  1. Read ID from AgentRegistry
  2. Fetch evidence bundle from StrategyForge API
  3. Validate past performance via the ReputationLedger
```

The dual setup of AgentRegistry and ReputationLedger ensures track records cannot be spoofed.

---

## Target Tracks

### Primary: KeeperHub — Best Use ($2,500) ✅

**What Luca asked for (workshop direction):**

> _"Wrap a publish_workflow in an ERC-8004-compatible registration so any agent can discover it, expose that call behind x402 as a payment rail, and post reputation back on-chain after every run."_

**What we deliver:**

1. AgentRegistry registration wrapping `publish_workflow` — on-chain discoverability
2. x402 payment rail (already in KeeperHub, we wire to AgentRegistry discovery)
3. On-chain reputation posted to ReputationLedger after every run
4. Agent-controlled workflow versioning (draft → live → deprecated, immutable per version)
5. Verifiable reasoning stored alongside each strategy (TEE chatID-anchored)

**Mergeable contribution:** The AgentRegistry + ReputationLedger pattern. Any KeeperHub builder can deploy these contracts and wire their workflows to on-chain reputation.

### Primary: 0G Track 2 — Autonomous Agents ($1,500) ✅

**Framing for 0G: Autonomous agent with verifiable intelligence.**

| 0G Requirement                  | How We Hit It                                                                    |
| ------------------------------- | -------------------------------------------------------------------------------- |
| Autonomous, long-running        | Cron-based monitoring, proposes version upgrades                                 |
| Persistent memory               | Market state, evidence, and historical failure analysis                          |
| Self-fact-checking              | Researcher + Strategist + Critic architecture validates outputs inherently       |

### Bonus: KeeperHub Feedback ($250) 💰

Document every integration friction point. Free money.

### Secondary: Uniswap ($500–$1,000)

3/4 API endpoints used in feature builder (quote, check_approval, pool data) + FEEDBACK.md.

---

## Demo Scripts (Two Angles, Same Product)

### KeeperHub Demo (Lead: Trust Layer + Contribution)

**Scene 1 (0:00–0:40):** User enters goal ("monitor my Aave position") → agent queries AgentRegistry + ReputationLedger (agentId=1, tag="aave-health-guardian-v2") → finds it (47 runs, 98% execution success rate). _"This workflow is discoverable on-chain with verified execution history from 47 runs — no trust required."_

**Scene 2 (0:40–1:20):** User deploys → KeeperHub workflow created → executes → creator earns via x402 → `reputationLedger.record(1, "aave-health-guardian-v2", 9800, evidenceCid)` posted on-chain. _"After execution, reputation is posted. Run #48 recorded on-chain."_

**Scene 3 (1:20–2:00):** No match → 7-step pipeline → LLM designs full KeeperHub workflow (health check node → condition node → Discord alert node) → registers in AgentRegistry. _"The agent designed and registered a complete automation workflow in one flow."_

**Scene 4 (2:00–2:30):** Cron detects execution failures → agent loads prior versions from MongoDB → proposes v4 with memory of v3's failure. _"Agent-controlled versioning. Monitoring cron detects failures, agent evolves using its own past evidence."_

**Scene 5 (2:30–3:00):** _"StrategyForge is the trust layer KeeperHub's marketplace was missing — on-chain discovery, reputation, and verifiable reasoning. All mergeable."_

### 0G Demo (Lead: Verifiable Intelligence)

**Scene 1 (0:00–0:30):** Show the agent on 0G explorer. _"This agent has a permanent identity and track record on 0G Chain."_

**Scene 2 (0:30–1:30):** Pipeline runs → show LLM steps per step. _"Every reasoning step explicitly uses requested models seamlessly."_

**Scene 3 (1:30–2:15):** Version Chain: v1 → v2 → v3. Click each → evidence bundle. _"A verifiable timeline of how this agent learned from its mistakes."_

**Scene 4 (2:15–2:40):** Show ReputationLedger updates. _"Intelligence evolves based on real execution data."_

**Scene 5 (2:40–3:00):** _"Autonomous agent with verifiable intelligence and memory, verified natively on 0G."_

---

## DeFi Protocols & Nodes in MVP

Protocol and execution support is schema-driven. In v1, we can use any node exposed by KeeperHub action schemas. Note that the workflow execution environment uses fundamental system primitives:

- **System Primitives:** HTTP Request, Run Code, Aggregate, Webhook, API Query.
- **Control Flow:** Branch/Condition, For Each loops.
- **Messaging:** Send Discord Message, Slack Alert, Email, Telegram.
- **Yield / Asset Integration:** Modules to manage interactions with protocols (e.g. SKY rewards claiming, Sky USDS Savings deposit).

**Why spotlight these nodes:** They clearly showcase that strategies are logical pipelines reacting to conditions, not static portfolios.

**Uniswap** — used for liquidity-adjusted universe filtering (Condition node rules) and swap quotes. Not a static yield protocol in MVP.

---

## MVP Scope

| Dimension      | Scope                                                                            |
| -------------- | -------------------------------------------------------------------------------- |
| Asset class    | Stablecoin yield only                                                            |
| Chains         | Ethereum (+ Base if KeeperHub supports)                                          |
| Protocols      | All protocols available via KeeperHub action schemas (e.g., Aave, Morpho, Spark) |
| Strategy types | Conservative and Balanced                                                        |
| Actions        | Allocate, rebalance, pause, unwind                                               |

---

## Tech Stack

| Layer           | Technology                                                                                |
| --------------- | ----------------------------------------------------------------------------------------- |
| Language        | TypeScript strict                                                                         |
| Agent inference | OpenRouter (Model-agnostic endpoints)                                                     |
| Memory          | MongoDB Atlas via Mongoose                                                                |
| Identity        | User Auth mapped to KeeperHub Key and Wallet                                              |
| Trust           | AgentRegistry.sol + ReputationLedger.sol (custom, deployed on 0G Chain)                   |
| Execution       | KeeperHub MCP server                                                                      |
| Monitoring cron | node-cron inside `packages/server` — checks ReputationLedger, triggers UpdateOrchestrator |
| Payments        | x402 (`@x402/fetch`, `@x402/express`)                                                     |
| DeFi data       | DefiLlama (APYs + 30-day historical for σ) + Uniswap API                                  |
| Dashboard       | React + Vite                                                                              |
| App Index       | SQLite (strategy search, filters)                                                         |

---

## StrategyForge MCP Server

3 tools for MVP. `deploy_strategy` and `get_strategy` are documented as v2.

| Tool                | Description                                                      | Priority |
| ------------------- | ---------------------------------------------------------------- | -------- |
| `search_strategies` | Search by goal, risk, chains (queries AgentRegistry + App Index) | **MVP**  |
| `generate_strategy` | Trigger 9-step pipeline for new strategy                         | **MVP**  |
| `get_reputation`    | Strategy track record from ReputationLedger                      | **MVP**  |
| `get_strategy`      | Full strategy version with evidence bundle from MongoDB          | v2       |
| `deploy_strategy`   | Deploy a version as user-specific KeeperHub workflow             | v2       |

---

## Build Timeline (9 Days)

> **Day 1 verification checklist — ALL must pass before writing application code:**
>
> 1. OpenRouter Request: Complete end-to-end inference call to test key.
> 2. KeeperHub MCP: `list_workflows` returns success
> 3. **KeeperHub action vocab:** call `list_action_schemas` MCP tool → capture full output → identify exact `type` strings for the selected strategy actions. Compiler is built from this output. **If a needed native protocol action is not in the schema, use `evm.call` with ABI-encoded calldata as fallback** — test this path on day 1 so it's not a surprise on day 5.
> 4. **KeeperHub workflow structure:** call `create_workflow` with a minimal test (trigger + 1 node + 1 edge) → confirm `nodes`/`edges` format is accepted
> 5. Stub contracts deployed to 0G Chain testnet — confirms Hardhat + RPC work
> 6. Check 0G Chain block time — note it for demo pacing

| Day   | Deliverable                                                                                                                                            |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1** | Scaffold + Model-Agnostic Setup verified end-to-end + KeeperHub connection                                                                             |
| **2** | **Deploy contracts to 0G Chain** (stub implementations — confirms toolchain). Data layer: DefiLlama + on-chain reads. Discovery + action schema dump |
| **3** | Researcher step (LLM pipeline) + MongoDB integration (evidence bundle)                                                                                    |
| **4** | Strategist step (LLM designs workflow graph) + Critic step + Deterministic Compiler (KeeperHub-native workflow JSON output)                                |
| **5** | Critic step (LLM pipeline) + Risk Validator + KeeperHub: create → run → publish with x402                                                              |
| **6** | Finalize contracts (AgentRegistry + ReputationLedger + iNFT logic). Search-first flow. Reputation record loop.                                         |
| **7** | Basic dashboard. v1→v2 update flow end-to-end.                                                                                                         |
| **8** | StrategyForge MCP server (3 tools: search_strategies, generate_strategy, get_reputation) + pre-seed synthetic v1/v2 evidence bundles for demo          |
| **9** | Tests + demo recording + FEEDBACK.md + README                                                                                                          |

### Demo Setup Notes

The following are intentional demo parameters (not bugs):

- **Update trigger threshold:** 1 execution failure in 3 runs (production default: 2+ failures in 10 runs). Lowered so the self-improvement loop triggers during the hackathon window.
- **Pre-seeded evidence bundles:** Two synthetic `v1` and `v2` evidence bundles written to MongoDB. Object IDs are real. The Critic reads them during demo.
- **Pre-seeded reputation records:** Run a setup script before recording that calls `reputationLedger.record(1, "aave-health-guardian-v2", 9800, evidenceCid)` 47 times with synthetic outcome CIDs. Do the same for `"usds-savings-auto-deposit-v1"` (12 records) — this strategy appears in the Scene 1 search results, so the contract must also show real records for it. The contract will show 47 + 12 real records. If a judge queries the contract directly, they see real records — not 2. Do this before demo day.
- **Execution:** KeeperHub runs real transactions on testnet. No paper mode in KeeperHub. Use a funded testnet wallet + call `keeperhub.run_workflow` manually for demo rather than waiting for cron.
- **Notification channel for v2 availability:** Dashboard banner. No email/XMPP/Discord in MVP.
- **0G Chain finality:** Check 0G Chain's average block time before recording the demo. If `updateBrain` tx takes >10s, don't wait on-screen for confirmation — show tx hash immediately and cut to the explorer showing it confirmed. Design demo flow around actual finality, not assumed instant finality.
- **KeeperHub action vocabulary:** Call `list_action_schemas` on day 1 — this returns the full list of valid node `type` strings with their config schemas. The Compiler's protocol template table is built from this output, not from guesses. Conditions are separate condition nodes in the graph, not inline `if` fields.
- **Uniswap track:** Realistic prize ceiling is $500. Not competing for the primary Uniswap prize. FEEDBACK.md is the play.

---

## Prize Ceiling

| Track              | Prize       | Position          |
| ------------------ | ----------- | ----------------- |
| 0G Track 2         | $1,500      | $1,500 (flat)     |
| KeeperHub Main     | $500–$2,500 | $1,500–$2,500     |
| KeeperHub Feedback | $250        | $250              |
| Uniswap            | $500–$1,000 | Secondary         |
| **Total**          |             | **$3,750–$5,250** |
