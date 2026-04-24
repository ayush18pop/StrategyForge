# Uniswap — Structured Reference Guide

> Distilled from [uniswap_deep_dive.md](../references/uniswap_deep_dive.md). Purpose-built for quick lookups during implementation.

---

## 1. Uniswap Overview

**What:** Not just a swap UI — a full stack of onchain liquidity primitives + developer tooling.

| Component | Description |
|-----------|-------------|
| **Protocol contracts** | v2, v3, v4 — AMM pools on multiple chains |
| **Routing/execution** | Universal Router, Permit2, UniswapX (gasless intents) |
| **Developer surface** | Hosted API, TypeScript SDKs, contract-level integration |
| **Emerging infra** | Unichain (Uniswap's own chain) |

### Key Links

| Resource | URL |
|----------|-----|
| Developer Portal | <https://developers.uniswap.org/docs> |
| Trading Overview | <https://developers.uniswap.org/docs/trading/overview> |
| Swapping API | <https://developers.uniswap.org/docs/trading/swapping-api/getting-started> |
| API Reference | <https://developers.uniswap.org/docs/api-reference> |
| Protocol Docs (v2/v3/v4) | <https://developers.uniswap.org/docs/protocols/overview> |
| Uniswap AI Repo | <https://github.com/Uniswap/uniswap-ai> |
| v4 Deployments | <https://docs.uniswap.org/contracts/v4/deployments> |

---

## 2. Integration Methods — How to Choose

| Method | Complexity | Best For | What You Own |
|--------|-----------|----------|-------------|
| **Custom Linking** | Very low | Fast referrals to app.uniswap.org | URL params only |
| **Uniswap API** | Low | Wallets, dapps, bots, **agents** | Signing + tx submission |
| **TypeScript SDK** | Medium | Custom UX, local route logic | RPC, quote logic, tx building |
| **Smart contracts** | High | Protocol-native systems, arbitrage, hooks | Full onchain logic |

> **For OpenAgents:** The Uniswap API path is the best tradeoff — deep enough for judging, fast enough for hackathon time.

---

## 3. The API Message Flow (Core)

The canonical 4-step flow every agent must implement:

```
1. POST /check_approval   → is token allowance sufficient?
2. POST /quote             → get route, price, execution metadata
3. POST /swap              → get encoded calldata (classic route)
   OR POST /order          → submit gasless intent (UniswapX route)
4. Agent signs and submits (or filler submits for UniswapX)
```

### Step 1: Check Approval (`POST /check_approval`)

Tells you if token allowance is already sufficient for the swap.

**Key fields:**

- `walletAddress` — the agent's wallet
- `token` — token contract address
- `amount` — amount in base units
- `chainId`
- Optional: `includeGasInfo`, `urgency`

**Key header:** `x-permit2-disabled` (default: false)

**Response behavior:**

- If allowance missing → response includes approval transaction data
- If allowance exists → approval field is null
- Some tokens require cancel/reset before re-approval (response includes this)

### Step 2: Quote (`POST /quote`)

Returns optimal route, price, and quote metadata.

**Key fields:**

- `type`: `EXACT_INPUT` or `EXACT_OUTPUT`
- `amount`, `tokenIn`, `tokenOut`, `tokenInChainId`, `tokenOutChainId`
- `swapper` — agent's wallet address
- `slippageTolerance` or `autoSlippage`
- `routingPreference`: `BEST_PRICE` or `FASTEST`
- Optional: `protocols` (constrain route search)
- Optional: `hooksOptions` (v4 hook controls)
- Optional: `spreadOptimization` (UniswapX spread)
- Optional: `permitAmount`: `FULL` or `EXACT`

**Key headers:**

- `x-api-key` — required
- `x-universal-router-version` — must stay consistent through `quote` → `swap`
- `x-permit2-disabled`
- Optional: `x-erc20eth-enabled` — for native ETH input

### Step 3a: Swap (`POST /swap`) — Classic Routes

Used when routing is classic protocol path (v2/v3/v4) or bridge/wrap flows.

**Key fields:**

- Quote payload from Step 2
- Signature/permit data
- `refreshGasPrice` — refresh gas estimate
- `simulateTransaction` — pre-simulate before submission
- `safetyMode` — extra safety checks
- `deadline` — tx expiry timestamp
- `urgency`

**Response:** Encoded calldata/tx payload. Agent signs and broadcasts on-chain.

### Step 3b: Order (`POST /order`) — UniswapX Gasless Intents

Used for UniswapX-style gasless order submission (DUTCH_V2, DUTCH_V3, PRIORITY, LIMIT_ORDER).

- Agent signs order intent
- Filler network attempts fill
- Filler pays gas (gasless for the agent)

---

## 4. Classic AMM vs UniswapX — Execution Semantics

**Critical distinction for product design:**

| Classic (v2/v3/v4) | UniswapX |
|--------------------|----------|
| Agent submits onchain tx | Agent submits signed intent |
| Agent pays gas | Filler pays gas (gasless for agent) |
| Deterministic immediate execution | Intent-based, filler executes |
| Use `/swap` endpoint | Use `/order` endpoint |
| Best for: real-time, deterministic swaps | Best for: gasless UX, intent-based flows |

**Route-aware branching:** Use quote routing metadata to determine which path:

```typescript
const quote = await uniswapAPI.quote(params);
if (quote.routing === 'CLASSIC') {
  const swapTx = await uniswapAPI.swap(quote);
  await wallet.sendTransaction(swapTx);
} else {
  const order = await uniswapAPI.order(quote);
  // filler handles execution
}
```

---

## 5. Permit2 & Approval Strategy

Permit2 is central to modern Uniswap integrations.

| Option | How | Use Case |
|--------|-----|----------|
| **Standard Permit2** | Better UX, fewer approval txs | Default for most integrations |
| **Disable Permit2** | `x-permit2-disabled: true` → direct approval-then-swap | Specific infra constraints |
| **Permit as message** | `generatePermitAsTransaction=false` → no broadcast tx for permit | Gasless permit signing |
| **Permit as tx** | `generatePermitAsTransaction=true` → onchain submission, gas cost | Broader/longer-lived permissions |

**For agents:** Explicit approval policy and permit lifetime management matter as much as route quality for high-frequency agents.

---

## 6. Deployed Contract Addresses

### v4 PoolManager (Singleton — all pools in one contract)

| Chain | Address |
|-------|---------|
| Ethereum Mainnet | `0x000000000004444c5dc75cB358380D2e3dE08A90` |
| Base | `0x498581ff718922c3f8e6a244956af099b2652b2b` |
| Optimism | `0x9a13f98cb987694c9f086b1f5eb990eea8264ec3` |
| BSC | `0x28e2ea090877bf75740558f6bfb36a5ffee9e9df` |

### v4 Universal Router (Ethereum Mainnet)

`0x66a9893cc07d91d95644aedd05d03f95e1dba8af`

### v3 Key Addresses (still dominant TVL)

| Contract | Mainnet |
|----------|---------|
| Factory | `0x1F98431c8aD98523631AE4a59f267346ea31F984` |
| NonfungiblePositionManager | `0xC36442b4a4522E871399CD717aBDD847Ab11FE88` |
| QuoterV2 | `0x61fFE014bA17989E743c5F6cB21bF9697530B21e` |
| SwapRouter02 | `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45` |

---

## 7. Uniswap v4 — Architecture & Hooks

### v4 vs v3: What Changed

| v3 | v4 |
|----|-----|
| Separate contract per pool | Single `PoolManager` singleton |
| ERC-20 balances per pool | Flash accounting (net balances settled at end) |
| Fixed fee tiers | Dynamic fees via hooks |
| No custom logic | Hooks: arbitrary code at 10 lifecycle points |
| Expensive multi-contract calls | ~99% gas reduction on new pools |
| NFT positions | ERC-6909 claims tokens |

### v4 Hooks — All 10 Lifecycle Points

| Hook | When | Can Modify |
|------|------|-----------|
| `beforeInitialize` | Before pool creation | can revert |
| `afterInitialize` | After pool creation | — |
| `beforeAddLiquidity` | Before LP deposit | can revert |
| `afterAddLiquidity` | After LP deposit | delta adjustments |
| `beforeRemoveLiquidity` | Before LP withdrawal | can revert |
| `afterRemoveLiquidity` | After LP withdrawal | delta adjustments |
| `beforeSwap` | Before swap execution | swap amount, fee override |
| `afterSwap` | After swap execution | delta adjustments |
| `beforeDonate` | Before token donation | can revert |
| `afterDonate` | After token donation | — |

### Hook Address Encoding

Which hooks a contract implements is encoded in the **least significant bits of its deployed address**. The PoolManager reads these bits — no storage reads needed.

```
Bit 0  (1 << 0)  = beforeSwap
Bit 1  (1 << 1)  = afterSwap
Bit 2  (1 << 2)  = beforeAddLiquidity
Bit 3  (1 << 3)  = afterAddLiquidity
...14 bits total (10 hooks + 4 delta-modification flags)
```

Must use **HookMiner** (CREATE2 salt mining) to deploy at an address with required bits set.

### Complete Hook Example

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseHook} from "v4-periphery/src/utils/BaseHook.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {SwapParams} from "v4-core/src/types/PoolOperation.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/src/types/BeforeSwapDelta.sol";

contract MyHook is BaseHook {
    using PoolIdLibrary for PoolKey;

    mapping(PoolId => uint256) public swapCount;

    constructor(IPoolManager _manager) BaseHook(_manager) {}

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false, afterInitialize: false,
            beforeAddLiquidity: false, afterAddLiquidity: false,
            beforeRemoveLiquidity: false, afterRemoveLiquidity: false,
            beforeSwap: true, afterSwap: true,
            beforeDonate: false, afterDonate: false,
            beforeSwapReturnDelta: false, afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false, afterRemoveLiquidityReturnDelta: false
        });
    }

    function _beforeSwap(
        address, PoolKey calldata key, SwapParams calldata, bytes calldata
    ) internal override returns (bytes4, BeforeSwapDelta, uint24) {
        swapCount[key.toId()]++;
        return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }

    function _afterSwap(
        address, PoolKey calldata key, SwapParams calldata,
        BalanceDelta delta, bytes calldata
    ) internal override returns (bytes4, int128) {
        return (BaseHook.afterSwap.selector, 0);
    }
}
```

### Key Types Reference

| Type | Purpose |
|------|---------|
| `PoolKey` | (currency0, currency1, fee, tickSpacing, hooks) — identifies a pool |
| `SwapParams` | (zeroForOne, amountSpecified, sqrtPriceLimitX96) |
| `BalanceDelta` | Signed amount pair showing token movement after swap |
| `BeforeSwapDelta` | Adjustment hook applies to swap input/output |
| `PoolId` | `bytes32` hash of PoolKey |

### What You CAN / CANNOT Do in Hooks

**CAN:** Read/write own storage, call external contracts, modify swap amount/fee in `beforeSwap`, adjust token balances via delta returns, revert to block operations.

**CANNOT:** Call `poolManager.swap()` (reentrancy guard), modify PoolManager storage directly, change pool params after initialization.

---

## 8. Safety-Critical Controls for Agents

**Use these by default in production-like demos:**

| Control | Setting |
|---------|---------|
| Slippage | Set explicitly per strategy (EXACT_INPUT vs EXACT_OUTPUT differ) |
| Deadline | Never allow open-ended stale intent submission |
| Simulation | `simulateTransaction=true` for defensive execution |
| Router version | Keep `x-universal-router-version` stable across quote → swap |
| Approval check | Always run `/check_approval` before quote execution |
| Route constraints | Use protocol allowlists if policy prohibits specific paths |
| MEV protection | Enforce `amountOutMinimum` + oracle checks for contract-level integrations |

---

## 9. OpenAgents Prize Track ($5,000)

### Prize Structure

| Place | Prize |
|-------|-------|
| 1st | $2,500 |
| 2nd | $1,500 |
| 3rd | $1,000 |

### What Judges Want

> *"Build the future of agentic finance with Uniswap. Agents that trade, coordinate with other agents, or invent primitives we haven't imagined yet."*

### FEEDBACK.md — REQUIRED

**Not optional.** Must be in repo root for prize eligibility.

Include:

- Builder experience with Uniswap API and Developer Platform
- What worked well
- Bugs encountered
- Documentation gaps
- DX friction points
- Missing endpoints/features
- What you wish existed

### Integration Depth

**Shallow (won't place):**

- One hardcoded swap demo
- No approval handling
- No classic vs UniswapX route branching
- No operational logging or policy controls

**Deep (competitive):**

- Full approval → quote → swap/order pipeline
- Route-aware branching (`/swap` vs `/order`)
- Permit2 strategy implemented intentionally
- Configurable routing policies and slippage strategy
- Execution simulation and failure handling
- Agent-level value loop (trade, settle, report, adapt)

---

## 10. Agentic Finance Architecture Pattern

```
User / Agent Intent
        |
        v
Policy Engine (budget + risk + token allowlist)
        |
        v
Uniswap API Adapter
  1) check_approval
  2) quote
  3) swap/order
        |
        +--> If classic route: sign + broadcast tx
        |
        +--> If UniswapX route: submit gasless order
        |
        v
Execution Logger + Receipt Store
        |
        v
Post-trade Risk/Accounting Agent
```

**Key:** The Uniswap adapter should be a distinct module, not spread across UI and agent logic.

---

## 11. Build Templates

### Template A: Risk-Aware Execution Agent

- Intent parser produces candidate trade
- Risk module checks budget and pair constraints
- Uniswap module executes via API flow
- Reporter posts tx hash, effective rate, slippage, realized cost

### Template B: Multi-Agent Treasury Rebalancer

- Signal agents propose allocations
- Planner generates rebalance set
- Execution agent runs sequence of quotes/swaps with policy gating
- Auditor agent verifies each leg, writes immutable summary

### Template C: Pay-and-Settle Commerce Primitive

- Agent receives payable task
- Converts asset if needed through Uniswap route
- Settles service payment
- Logs execution trace for downstream accounting

---

## 12. Anti-Patterns to Avoid

| Anti-Pattern | Why It Hurts |
|-------------|-------------|
| No `FEEDBACK.md` | **Disqualified** from prize track |
| UI-only demo, no actual execution | Judges require real tx hashes |
| No approval handling | Missing Step 1 of the canonical flow |
| No classic vs UniswapX route branching | Shows lack of API understanding |
| Hardcoding one chain/token | No evidence of route diversity |
| No logs/metrics proving real execution | Can't verify the demo is real |

---

## 13. Minimal Submission Checklist

- [ ] API key setup and environment documented
- [ ] End-to-end approval → quote → swap/order flow in code
- [ ] Route-aware execution branch for classic vs UniswapX
- [ ] Policy and slippage controls documented
- [ ] Demo with real tx hashes (testnet OK)
- [ ] `FEEDBACK.md` with concrete API/DX feedback
- [ ] 3-minute demo showing value path, not just UI

---

## 14. Environment Setup

### API Key

Get from the Uniswap Developer Portal: <https://developers.uniswap.org>

### Headers Template

```typescript
const headers = {
  'x-api-key': process.env.UNISWAP_API_KEY,
  'x-universal-router-version': '2.0',
  'Content-Type': 'application/json',
};
```

### API Endpoints

| Endpoint | URL |
|----------|-----|
| check_approval | <https://developers.uniswap.org/docs/api-reference/check_approval> |
| quote | <https://developers.uniswap.org/docs/api-reference/aggregator_quote> |
| swap | <https://developers.uniswap.org/docs/api-reference/create_swap_transaction> |
| order | <https://developers.uniswap.org/docs/api-reference/post_order> |

---

## 15. Sources

- <https://developers.uniswap.org/docs>
- <https://developers.uniswap.org/docs/trading/overview>
- <https://developers.uniswap.org/docs/trading/swapping-api/getting-started>
- <https://developers.uniswap.org/docs/api-reference>
- <https://github.com/Uniswap/uniswap-ai>
- <https://docs.uniswap.org/contracts/v4/deployments>
