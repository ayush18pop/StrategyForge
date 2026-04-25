# StrategyForge Architecture

> This document is the AI coding reference. Read `CLAUDE.md` first for project context.

---

## Positioning Reminder

**StrategyForge is the trust layer for KeeperHub's marketplace.** The pipeline exists to produce verifiable reasoning, not just to generate allocations. Every step exists because it produces an attestation hash or evidence that justifies trust. If a step produces no evidence, it shouldn't be in the pipeline.

---

## Pipeline Architecture

The strategy pipeline has 3 LLM calls (via 0G Compute, each TEE-attested) + 4 deterministic steps:

```
USER GOAL
    ↓
┌─ Researcher (0G Compute) ──────────────────────────────┐
│  Input: goal + priorCids loaded from 0G Storage         │
│  Does:                                                   │
│    1. Fetch APYs + TVL + utilization from DefiLlama      │
│    2. Filter: TVL > $10M, audited, no exploit in 90d     │
│    3. Compute Kelly priors per protocol:                  │
│         p_i = P(protocol achieves stated APY)            │
│         q_i = P(exploit / loss event)                    │
│         — derived from exploit history + TVL stability   │
│    4. Classify market regime (stable/rising/volatile)    │
│    5. LLM call: "Given signals + priors, what's notable?"│
│  Output: MarketSnapshot + kellyPriors[] + regime         │
│          + attestationHash                               │
└─────────────────────────────────────────────────────────┘
    ↓
┌─ Strategist (0G Compute) ──────────────────────────────┐
│  Input: MarketSnapshot + kellyPriors + regime            │
│          + prior outcomes (from priorCids)               │
│  Does:                                                   │
│    1. Compute Kelly optimal fractions:                    │
│         f_i = (p_i × r_i − q_i × l_i) / r_i            │
│         where r_i = APY, l_i = expected loss magnitude  │
│    2. Compute Sharpe ratio per protocol:                  │
│         Sharpe_i = (APY_i − 0.5%) / σ_i                 │
│         σ_i = stddev(last 30 daily APY values)            │
│               from DefiLlama /chart/{poolId} endpoint     │
│               (defined in tickets/04-data-layer.md)       │
│               fallback σ = 0.5% if < 14 days of history  │
│    3. LLM call: "Given Kelly + Sharpe + regime,          │
│         propose 2-3 allocations as JSON"                 │
│    — LLM interprets the math, it does NOT invent        │
│      allocations from gut feel                           │
│  Output: CandidateAllocation[] (3 max)                   │
│          + attestationHash                               │
└─────────────────────────────────────────────────────────┘
    ↓
┌─ Critic (0G Compute) ──────────────────────────────────┐
│  Input: candidates + prior failure records (priorCids)   │
│  Does:                                                   │
│    1. VaR check: reject any candidate where 95th-pct    │
│         loss > user's stated tolerance                   │
│       VaR_95% = expected_return − 1.645 × σ_portfolio  │
│       σ_portfolio = weighted avg of per-protocol σ_i    │
│       (same 30-day rolling std dev used in Strategist)  │
│    2. LLM call: "Attack each candidate. Reference prior  │
│         failures. Update Kelly priors based on what      │
│         v(n-1) got wrong."                               │
│  Output: selected candidate + constraints                │
│          + updatedKellyPriors (stored for next version)  │
│          + attestationHash                               │
└─────────────────────────────────────────────────────────┘
    ↓
┌─ Compiler (DETERMINISTIC — NOT LLM) ──────────────────┐
│  Input: selected allocation + constraints                │
│  Does: maps allocation to KeeperHub workflow JSON        │
│        (nodes + edges DAG format)                        │
│        Node type strings loaded from list_action_schemas │
│        at startup — not hardcoded                        │
│        + estimates gas cost                              │
│  Output: WorkflowSpec (nodes+edges) + gasEstimate        │
└─────────────────────────────────────────────────────────┘
    ↓
┌─ Risk Validator (DETERMINISTIC) ───────────────────────┐
│  Hard rules: max 70% single protocol, max 50% single    │
│  chain, no unaudited > 20%, total = 100%, ≥2 protocols  │
│  if amount > $10K                                        │
└─────────────────────────────────────────────────────────┘
    ↓
WRITE EVIDENCE BUNDLE TO 0G STORAGE
REGISTER IN AgentRegistry + RECORD ReputationLedger
DEPLOY AS KEEPERHUB WORKFLOW
```

### Why This Division of Labor

The LLM handles qualitative judgements: what does the regime signal? what tail risk is this candidate hiding? what did the prior version get wrong that the math didn't catch?

The math handles optimization: Kelly fraction, Sharpe ranking, VaR rejection. These run deterministically, before the LLM call, and are passed in as context — not hallucinated by the model.

Neither alone is sufficient. A pure math optimizer has no concept of governance risk or curator behavior. A pure LLM has no provably optimal allocation. Together, they produce evidence worth attesting.

---

## Orchestration Layer (Above the Pipeline)

### Two Separate Crons — Do NOT Conflate

There are two independent cron processes. They are completely separate:

| Cron                              | Who runs it                                       | What it does                                                                                                                                                          |
| --------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **KeeperHub workflow cron**       | KeeperHub's execution engine                      | Executes `aave.supply`, `morpho.deposit` etc. on schedule inside the user's deployed workflow. We do NOT control this.                                                |
| **StrategyForge monitoring cron** | Our `packages/server` Node.js process (node-cron) | Periodically reads ReputationLedger outcomes, compares against expected yield, decides if an update is needed. Calls UpdateOrchestrator when drift exceeds threshold. |

The StrategyForge monitoring cron is a plain `setInterval` / `node-cron` job inside the server package — NOT a KeeperHub workflow. It runs on the same Node.js process as the MCP server.

### Pipeline Orchestrators

The pipeline steps are identical for creation and update. What differs is who calls the pipeline and what context they prepare. Two orchestrators, one pipeline.

```
User request                    StrategyForge monitoring cron
      │                            (node-cron in packages/server)
      │                                       │ drift detected
      ▼                                       ▼
CreateOrchestrator              UpdateOrchestrator
  - new familyId                  - load familyId from KV store
  - priorCids: []                 - load all priorCids from 0G Storage
  - priorVersions: []             - read ReputationLedger outcomes
  - actualOutcomes: null          - map trigger → TriggerReason
  - triggerReason:                - set emergencyUpdate if protocol_incident
    'user_request'
      │                                       │
      └─────────────────┬─────────────────────┘
                        │
                        ▼
               PipelineOrchestrator          ← one implementation, 9 steps
               (same always)
                        │
                        ▼
               EvidenceBundle → 0G Storage
                        │
                        ▼
               Server layer (after pipeline):
                 - write evidence bundle → 0G Storage → evidenceCid
                 - update brain root on 0G Storage → brainRootCid
                 - iNFT.updateBrain(tokenId, brainRootCid)  ← on-chain brain update
                 - create NEW KeeperHub workflow_id          ← never update existing
                 - register in AgentRegistry / record ReputationLedger
                 - dashboard banner: "v(n+1) available"
```

### Emergency Update (Protocol Incident)

When `trigger.reason === 'protocol_incident'`, set `emergencyUpdate: true`.
The new version is deployed immediately as `live` and the incident flag is included in the EvidenceBundle so any agent reading it can see why an unscheduled update occurred.

```
Normal update:   draft → live (user review window if possible)
Emergency:       live immediately (incident flag in EvidenceBundle)
```

### Why Never Update an Existing KeeperHub Workflow

Updating a workflow mutates what every user on that deployment runs — silently changing their active DeFi position without consent. Instead:

- v2 gets a new `keeperhubWorkflowId`
- Users on v1 keep running v1 untouched
- Notification sent: "v2 available — improved Kelly priors"
- Migration is opt-in: user deploys v2 as a new deployment instance

---

## Data Flow: Strategy Version Lifecycle

Strategy versions have two lifecycle states: `draft` (created, not yet deployed) and `live` (deployed as KeeperHub workflow). Staged promotion (paper → canary → stable) is a v2 production concept — not in MVP scope.

```
v1 created
  ├── evidenceBundle written to 0G Storage → CID_v1
  ├── registered in AgentRegistry
  ├── deployed as KeeperHub workflow → lifecycle: "live"
  └── outcomes posted to ReputationLedger after each execution
        ↓
StrategyForge monitoring cron detects rate drift (threshold: 0.5% APY for demo, 2% for prod)
  ├── agent loads v1 evidence from 0G Storage via priorCids
  ├── runs pipeline with memory: "v1 overweighted Aave"
  ├── creates v2 with priorCids: [CID_v1] → lifecycle: "draft"
  ├── v2 deployed as NEW KeeperHub workflow → lifecycle: "live"
  └── notification: dashboard banner shows "v2 available"
        ↓
Users on v1 keep running v1 untouched (opt-in migration)
```

---

## 0G Storage Schema

### Evidence Bundle (one per strategy version)

Stored as JSON blob → `MemData` → upload → rootHash = CID

This is the proof object. When a judge or agent opens this, they see exactly why the strategy was designed this way, what math was used, and how it performed. This is what separates StrategyForge from a bot that just calls DefiLlama.

```typescript
{
  strategyFamily: string,
  version: number,
  priorCids: string[],        // rootHashes of prior versions
  pipeline: {
    researcher: {
      input: { goal, priorCidsLoaded: string[] },
      output: {
        regime: "stable" | "rising" | "declining" | "volatile",
        survivingProtocols: string[],
        kellyPriors: {                  // THE MATH — computed before LLM call
          [protocol: string]: {
            p: number,                  // P(achieves stated APY)
            q: number,                  // P(exploit / loss event)
            r: number,                  // APY (payoff ratio)
            l: number,                  // expected loss magnitude
            f_kelly: number             // optimal fraction: (p*r - q*l) / r
          }
        },
        signals: { protocol, signal, severity }[]
      },
      attestationHash: string,
      timestamp: number
    },
    strategist: {
      input: { snapshot, kellyPriors, regime, priorOutcomes },
      output: {
        candidates: CandidateAllocation[],
        sharpeRankings: { candidateId, sharpe: number }[],
      },
      attestationHash: string,
      timestamp: number
    },
    critic: {
      input: { candidates, priorFailures, varThreshold },
      output: {
        verdicts: CandidateVerdict[],
        selectedCandidateId: string,
        varCheck: { passed: boolean, worstCase: number },
        updatedKellyPriors: Record<string, KellyPrior>,  // feeds next version
        selectionRationale: string
      },
      attestationHash: string,
      timestamp: number
    },
    compiler:     { workflowSpec, gasEstimate: number },  // gas estimate lives here now
    riskValidator: { passed, warnings }
  },
  outcomes: null | {
    startedAt, checkpoints[], finalYield, finalStatus
  }
}
```

### KV Store Pointers

0G Storage's KV store is a real primitive — `Batcher` + `KvClient` from `@0gfoundation/0g-ts-sdk`. It is distinct from blob/log storage (`MemData`/`Indexer`). We use both:

| Storage Type                   | API                                                    | What We Store                                           |
| ------------------------------ | ------------------------------------------------------ | ------------------------------------------------------- |
| **KV** (Batcher/KvClient)      | `batcher.streamDataBuilder.set(STREAM_ID, key, value)` | Fast-lookup pointers — latest CID per family, brain CID |
| **Blob/Log** (MemData/Indexer) | `indexer.upload(data, ...)`                            | Evidence bundles, brain root documents (immutable)      |

KV key patterns:

| Key                        | Value                                 |
| -------------------------- | ------------------------------------- |
| `family:{familyId}:latest` | CID of latest version                 |
| `family:{familyId}:live`   | CID of latest live (deployed) version |
| `agent:brainCid`           | CID of latest iNFT brain root         |

---

## iNFT (ERC-7857) — The Agent's Identity

### What It Is

The iNFT is StrategyForge the agent, not the user. One token, minted once on deploy. Its tokenId IS the agentId in AgentRegistry. It has an ERC-6551 TBA (its own wallet). Its `brainCid` is an on-chain pointer to the agent's current knowledge state on 0G Storage.

> **x402 note:** KeeperHub routes x402 execution payments through its own workflow marketplace. The payment recipient is determined by KeeperHub's `publish_workflow` setup, not by an arbitrary address we specify. Whether KeeperHub can route earnings directly to the ERC-6551 TBA address needs to be confirmed with KeeperHub's team. For MVP: the agent operator wallet receives earnings. The TBA exists as identity, not as a payment sink.

### Three Touchpoints

**1. Deploy (once)**

```
Deploy StrategyForgeINFT.sol
  → mint(deployer, initialBrainCid)   → tokenId = 1
  → ERC-6551 TBA created for tokenId  → wallet address
  → agentRegistry.register(metadataCid) → agentId = 1, linked to tokenId
```

**2. After every pipeline run (in server layer)**

The brain root is a meta-document on 0G Storage that links all strategy families:

```json
{
  "agentId": 1,
  "updatedAt": "2026-05-01T12:00:00Z",
  "strategies": {
    "conservative-stablecoin-yield": "cid_v3",
    "balanced-dual-chain": "cid_v1"
  },
  "totalRuns": 84,
  "avgYield": 7.8
}
```

After each pipeline run:

```
1. evidenceBundle written to 0G Storage → evidenceCid
2. brain root updated (add/update strategy entry) → re-uploaded to 0G Storage → brainRootCid
3. iNFT.updateBrain(tokenId=1, brainRootCid) → on-chain tx
4. KV store updated: agent:brainCid = brainRootCid
```

This is the "evolving brain" the frontend shows morphing. The CID changes on-chain after every cycle.

**3. x402 payment (passive)**

```
User pays to run a strategy
  → x402 payment → ERC-6551 TBA wallet address
  → KeeperHub executes workflow
  → outcome posted to ReputationLedger
  → ERC-6551 balance increases (agent earns)
```

The pipeline does not trigger this. It happens automatically when KeeperHub runs and the user has paid via x402.

### What the iNFT Does NOT Do

- It is NOT the user's identity. Users have their own KeeperHub wallets.
- It does NOT gate access to strategies. Anyone can use strategies via AgentRegistry discovery.
- It does NOT change per strategy version. One iNFT, always tokenId=1. The `brainCid` is what changes.
- It does NOT live inside the pipeline. It's updated in the server layer AFTER the pipeline completes.

### Smart Contract Interface

```solidity
// StrategyForgeINFT.sol — ERC-7857
function mint(address to, string calldata initialBrainCid) external returns (uint256 tokenId);
function updateBrain(uint256 tokenId, string calldata newBrainCid) external;
function brainCid(uint256 tokenId) external view returns (string memory);
```

Only the deployer wallet (agent operator) can call `updateBrain`. The server layer calls this after every successful pipeline run.

> **Gas note:** Each pipeline run triggers one `updateBrain` on-chain tx on 0G Chain. In demo context this is fine. In production, batch updates or use a threshold (e.g., only update if brainCid actually changes).

---

## KeeperHub Workflow Spec

The compiler generates JSON passed directly to `keeperhub.create_workflow`. The actual format uses a **nodes + edges graph** (DAG), not a flat steps array. This was confirmed from KeeperHub's workflow-builder skill documentation.

```typescript
// Exact shape accepted by create_workflow MCP tool
interface WorkflowSpec {
  name: string;
  description: string;
  trigger: {
    type: "schedule" | "manual" | "webhook" | "event";
    config: Record<string, unknown>; // e.g. { cron: "0 */6 * * *" }
  };
  nodes: Array<{
    id: string; // unique, e.g. "node-aave-supply"
    type: string; // action type from list_action_schemas
    config: Record<string, unknown>; // action config, schema from list_action_schemas
  }>;
  edges: Array<{
    source: string; // node id or "trigger"
    target: string; // node id
  }>;
}
```

### How to Discover Action Types

Use `list_action_schemas` MCP tool on day 1 — this is the authoritative source for what node `type` values exist:

```typescript
// Day 1: call this and capture the output
const schemas = await keeperhub.list_action_schemas();
// Returns: [{ type: "aave.supply", fields: [...] }, { type: "morpho.deposit", ... }, ...]
// Save this output. The Compiler's protocol template table is built from it.
```

Also use `validate_plugin_config` before calling `create_workflow` to catch config errors before submitting.

### Concrete Compiler Output (shape — type strings to be filled from list_action_schemas)

```json
{
  "name": "Conservative Yield v3",
  "description": "Stablecoin yield: 30% Aave, 45% Morpho, 25% Spark — rebalances every 6h",
  "trigger": {
    "type": "schedule",
    "config": { "cron": "0 */6 * * *" }
  },
  "nodes": [
    {
      "id": "node-aave",
      "type": "<aave supply action>",
      "config": { "asset": "USDC", "amount": 15000, "chain": "mainnet" }
    },
    {
      "id": "node-morpho",
      "type": "<morpho deposit action>",
      "config": {
        "vault": "0xMorphoCurated",
        "amount": 22500,
        "chain": "mainnet"
      }
    },
    {
      "id": "node-spark",
      "type": "<spark supply action>",
      "config": { "asset": "USDC", "amount": 12500, "chain": "mainnet" }
    }
  ],
  "edges": [
    { "source": "trigger", "target": "node-aave" },
    { "source": "node-aave", "target": "node-morpho" },
    { "source": "node-morpho", "target": "node-spark" }
  ]
}
```

The Compiler maps `allocation[]` → nodes deterministically. It does NOT call an LLM. It does NOT invent type strings — it reads them from the `list_action_schemas` output cached at startup. Conditions (if any) are separate condition nodes, not inline `if` fields.

---

## Smart Contract Interfaces

### StrategyForgeINFT.sol (ERC-7857) — WE DEPLOY THIS

```solidity
function mint(address to, string calldata initialBrainCid) external returns (uint256);
function updateBrain(uint256 tokenId, string calldata newCid) external;
function brainCid(uint256 tokenId) external view returns (string memory);
```

### AgentRegistry.sol — WE DEPLOY THIS ON 0G CHAIN

> ERC-8004 is not deployed on 0G Chain. We deploy purpose-built contracts instead. ~60 lines each.

```solidity
// AgentRegistry.sol
function register(string calldata agentURI) external returns (uint256 agentId);
function getAgent(uint256 agentId) external view returns (string memory agentURI);
// agentURI → CID on 0G Storage pointing to:
// { name: "StrategyForge", mcpEndpoint: "...", x402Wallet: "0xERC6551Wallet" }
```

```typescript
// Register agent ONCE on deploy
const agentId = await agentRegistry.register(agentMetadataCid); // returns agentId = 1
```

### ReputationLedger.sol — WE DEPLOY THIS ON 0G CHAIN

```solidity
// ReputationLedger.sol
// Access control: only the agent operator wallet can call record().
// Yield is self-reported by our server layer — no on-chain execution proof.
// This is acceptable for hackathon. For production: require a signed KeeperHub
// execution receipt or Chainlink oracle confirmation.
function record(
  uint256 agentId,
  string calldata strategyTag,   // e.g. "conservative-yield-v3"
  int256 yieldBps,               // e.g. 820 = 8.20%
  bytes32 evidenceCid            // keccak256 of 0G Storage CID → links outcome to evidence
) external onlyOwner;            // ← only deployer wallet can record outcomes

function getSummary(uint256 agentId, string calldata strategyTag)
  external view returns (uint256 runCount, int256 avgYieldBps);
```

```typescript
// Called in server layer after every KeeperHub execution completes
await reputationLedger.record(
  1, // agentId = 1
  "conservative-yield-v3",
  820, // 8.20% yield in bps
  keccak256(Buffer.from(evidenceBundleCid)),
);

// Query
const { runCount, avgYieldBps } = await reputationLedger.getSummary(
  1,
  "conservative-yield-v3",
);
```

**Outcome record stored on 0G Storage (CID linked via evidenceCid):**

```json
{
  "agentId": 1,
  "strategyTag": "conservative-yield-v3",
  "executorAddress": "0xUserKeeperHubWallet",
  "createdAt": "2026-05-01T12:00:00Z",
  "yieldBps": 820,
  "x402TxHash": "0xKeeperHubExecutionTx",
  "evidenceBundleCid": "0xabc..."
}
```

**Contract map:**

| Contract         | What It Does                                                  | Key                     |
| ---------------- | ------------------------------------------------------------- | ----------------------- |
| AgentRegistry    | Register StrategyForge agent once, discoverable by any caller | `agentId = 1`           |
| ReputationLedger | Record yield outcome per execution, linked to evidence CID    | `agentId + strategyTag` |

### TEE Attestation (No On-Chain Contract Needed)

TEE attestation is verified off-chain, not by a contract. The on-chain anchor is the evidence CID.

```
Pipeline step (0G Compute)
  → response headers include: ZG-Res-Key = chatID
  → chatID stored as attestationHash in evidence bundle step
  → full evidence bundle → 0G Storage → CID (Merkle root)
  → CID keccak256 stored in ReputationLedger.record(...)

ANYONE CAN VERIFY:
  1. Read evidenceCid from ReputationLedger
  2. Fetch evidence bundle from 0G Storage (Merkle root guarantees integrity)
  3. Extract chatID (attestationHash) per pipeline step
  4. Call: broker.inference.processResponse(providerAddress, chatID) → true
```

---

## Protocol Templates (Used by Compiler)

### Aave Supply

```typescript
{
  protocol: "aave",
  method: "supply",
  params: {
    asset: "USDC",
    amount: "${allocation.amount}",
    onBehalfOf: "${user.keeperhubWallet}"
  },
  chain: "ethereum"
}
```

### Morpho Deposit

```typescript
{
  protocol: "morpho",
  method: "deposit",
  params: {
    vault: "${morpho.curatedVault}",
    amount: "${allocation.amount}",
    receiver: "${user.keeperhubWallet}"
  },
  chain: "ethereum"
}
```

### Spark Supply

```typescript
{
  protocol: "spark",
  method: "supply",
  params: {
    asset: "USDC",
    amount: "${allocation.amount}",
    onBehalfOf: "${user.keeperhubWallet}"
  },
  chain: "ethereum"
}
```
