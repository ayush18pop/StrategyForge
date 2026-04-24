# StrategyForge Architecture

> This document is the AI coding reference. Read `CLAUDE.md` first for project context.

---

## Pipeline Architecture

The strategy pipeline has 4 LLM calls (via 0G Compute) + 3 deterministic steps:

```
USER GOAL
    ↓
┌─ Researcher (0G Compute) ──────────────────────────┐
│  Input: goal + priorCids loaded from 0G Storage     │
│  Does: fetches APYs from DefiLlama, pools from      │
│        Uniswap, filters by TVL/audit/exploit         │
│  Output: MarketSnapshot + attestationHash            │
└─────────────────────────────────────────────────────┘
    ↓
┌─ Strategist (0G Compute) ──────────────────────────┐
│  Input: MarketSnapshot + prior outcomes              │
│  Does: proposes 2-3 candidate allocations as JSON    │
│  Output: CandidateAllocation[] + attestationHash     │
└─────────────────────────────────────────────────────┘
    ↓
┌─ Critic (0G Compute) ──────────────────────────────┐
│  Input: candidates + all prior failure records       │
│  Does: attacks each candidate, finds risk,           │
│        references prior failures                     │
│  Output: selected candidate + constraints            │
│          + attestationHash                           │
└─────────────────────────────────────────────────────┘
    ↓
┌─ Compiler (DETERMINISTIC — NOT LLM) ──────────────┐
│  Input: selected allocation + constraints            │
│  Does: maps allocation to typed KeeperHub workflow   │
│        spec using protocol templates                 │
│  Output: WorkflowSpec (JSON)                         │
└─────────────────────────────────────────────────────┘
    ↓
┌─ Risk Validator (DETERMINISTIC) ───────────────────┐
│  Hard rules: max 70% single protocol, max 50%       │
│  single chain, no unaudited > 20%, etc.              │
│  Rejects or passes.                                  │
└─────────────────────────────────────────────────────┘
    ↓
┌─ Simulator (DETERMINISTIC) ────────────────────────┐
│  Estimates: net APY after gas, monthly gas cost,     │
│  failure scenarios                                   │
└─────────────────────────────────────────────────────┘
    ↓
WRITE EVIDENCE BUNDLE TO 0G STORAGE
REGISTER ON ERC-8004
DEPLOY AS KEEPERHUB WORKFLOW
```

---

## Data Flow: Strategy Version Lifecycle

```
v1 created
  ├── evidenceBundle written to 0G Storage → CID_v1
  ├── registered on ERC-8004 Identity Registry
  ├── deployed as KeeperHub workflow
  └── lifecycle: "draft"
        ↓
v1 runs for 7 days (paper monitoring)
  └── lifecycle promoted to "paper"
        ↓
v1 runs with real money ($1K cap)
  ├── outcomes posted to ERC-8004 Reputation Registry
  └── lifecycle promoted to "canary"
        ↓
20+ successful runs
  └── lifecycle promoted to "stable"
        ↓
KeeperHub cron detects rate drift
  ├── agent loads v1 evidence from 0G Storage
  ├── runs pipeline with memory: "v1 overweighted Aave"
  ├── creates v2 with priorCids: [CID_v1]
  └── v2 starts as "draft", old v1 eventually "deprecated"
```

---

## 0G Storage Schema

### Evidence Bundle (one per strategy version)

Stored as JSON blob → `MemData` → upload → rootHash = CID

```typescript
{
  strategyFamily: string,
  version: number,
  priorCids: string[],        // rootHashes of prior versions
  pipeline: {
    researcher: { input, output, attestationHash, timestamp },
    strategist: { input, output, attestationHash, timestamp },
    critic:     { input, output, attestationHash, timestamp },
    compiler:   { workflowSpec },
    riskValidator: { passed, warnings },
    simulator:  { estimatedNetAPY, estimatedGasCost }
  },
  outcomes: null | {
    startedAt, checkpoints[], finalYield, finalStatus
  }
}
```

### KV Store Pointers

| Key Pattern | Value |
|------------|-------|
| `family:{familyId}:latest` | CID of latest version |
| `family:{familyId}:stable` | CID of latest stable version |
| `agent:brainCid` | CID of latest iNFT brain root |

---

## KeeperHub Workflow Spec

The compiler generates this JSON. It maps directly to KeeperHub's workflow model:

```typescript
interface WorkflowSpec {
  name: string;
  trigger: {
    type: 'cron';
    schedule: string;     // e.g. "*/30 * * * *"
  };
  steps: WorkflowStep[];
}

interface WorkflowStep {
  id: string;
  type: 'condition' | 'action' | 'notification';
  // condition steps:
  condition?: {
    check: string;        // e.g. "apy_differential"
    threshold: number;
    action_if_false: 'skip' | 'defer';
  };
  // action steps:
  action?: {
    protocol: string;     // e.g. "aave"
    method: string;       // e.g. "supply"
    params: Record<string, unknown>;
    chain: string;
  };
}
```

---

## Smart Contract Interfaces

### StrategyForgeINFT.sol (ERC-7857)

```solidity
function mint(address to, string calldata initialBrainCid) external returns (uint256);
function updateBrain(uint256 tokenId, string calldata newCid) external;
function brainCid(uint256 tokenId) external view returns (string memory);
```

### IdentityRegistry.sol (ERC-8004)

```solidity
function registerStrategy(bytes32 strategyId, string calldata cid, uint256 pricePerRun) external;
function getStrategy(bytes32 strategyId) external view returns (address creator, string memory cid, uint256 price, uint256 runCount);
```

### ReputationRegistry.sol (ERC-8004)

```solidity
function postOutcome(bytes32 strategyId, uint256 yieldBps, bool success) external;
function getReputation(bytes32 strategyId) external view returns (uint256 avgYieldBps, uint256 totalRuns, uint256 successCount);
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
