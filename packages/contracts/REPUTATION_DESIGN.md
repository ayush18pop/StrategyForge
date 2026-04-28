# ReputationLedger Design: Yield-as-Input Portfolio Allocation

## The Problem We Solved

Initial design was over-engineered. We tried to track 6 different strategy types (yield, monitoring, protection, liquidation, arbitrage, automation) with incompatible metrics.

**Simplified approach:** The agent is fundamentally a **portfolio allocator targeting a user-specified yield**. That's it.

---

## The Solution: Target-Driven Yield Tracking

User specifies a target APY (e.g., 8%), agent allocates funds across protocols (Aave, Morpho, Compound, etc.) to achieve it.

```solidity
// Frontend specifies goal
targetYield = 800 BPS  // "I want 8% APY"

// Agent rebalances portfolio
actualYield = 850 BPS  // "I achieved 8.5%"

// Reputation tracks success/miss
success = actualYield >= targetYield
```

### Record Structure

```solidity
struct Record {
    int256 targetYield;   // Goal APY set by user (immutable per strategy tag)
    int256 actualYield;   // Achieved APY from portfolio allocation
    bytes32 evidenceCid;  // Keccak256 of evidence bundle (allocation details)
    uint256 timestamp;    // When this rebalance occurred
}
```

### Example Portfolio

```
Strategy             Target   Actual   Hit?
─────────────────────────────────────────
"portfolio-v1"       800 BPS  820 BPS  ✅ 
"portfolio-v2"       800 BPS  950 BPS  ✅ 
"portfolio-v3"       800 BPS  750 BPS  ❌ 
```

Critic learns: **v2's allocation strategy is best** (950 > 800).

---

## Type Safety: Preventing Target Drift

**1. Target immutable per strategy tag:**

```solidity
// First record: strategy locked to target
ledger.record(agentId, "portfolio-v1", 800, 820, cid);  // Target = 800

// Subsequent records: must use same target
ledger.record(agentId, "portfolio-v1", 800, 850, cid);  // ✅ OK
ledger.record(agentId, "portfolio-v1", 700, 900, cid);  // ❌ Reverts!
```

Prevents accidental goal-post moving.

**2. Allows negative yields (losses):**

```solidity
// Failed rebalance (market downturn, bad timing)
ledger.record(agentId, "portfolio-v1", 800, -200, cid);  // ✅ OK: -2% loss recorded
```

Tracks when agent fails to protect capital.

---

## How the Critic Learns

### Scenario: Multi-Version Portfolio Optimization

Agent 1 tries three allocation strategies:

```
Version History:
v1: "aave-only"       target=800, avg=700  → ❌ Misses (0/3 runs)
v2: "morpho-only"     target=800, avg=820  → ✅ Hits (1/1 runs)
v3: "diversified"     target=800, avg=950  → ✅ Hits (2/2 runs)
```

**Critic's decision:** Deploy v3 (highest average, best hit rate)

```typescript
const summaries = await Promise.all([
  ledger.getSummary(agentId, "aave-only"),      // target: 800, avg: 700, hits: 0/3
  ledger.getSummary(agentId, "morpho-only"),    // target: 800, avg: 820, hits: 1/1
  ledger.getSummary(agentId, "diversified"),    // target: 800, avg: 950, hits: 2/2
]);

// Critic ranks by avg actual yield and hit rate
// Winner: "diversified" (950 avg, 100% hit rate)
```

---

## API

### Before (Over-Engineered)

```solidity
function record(
    uint256 agentId,
    string calldata strategyTag,
    StrategyType strategyType,    // yield? monitoring? protection?
    int256 outcome,               // Different metric for each type
    bytes32 evidenceCid
) external;

function getSummary(uint256 agentId, string calldata strategyTag)
    returns (StrategyType, uint256 runCount, int256 avgOutcome, ...);
```

### After (Simple)

```solidity
function record(
    uint256 agentId,
    string calldata strategyTag,
    int256 targetYield,    // What user asked for (800 = 8%)
    int256 actualYield,    // What agent achieved
    bytes32 evidenceCid
) external;

function getSummary(uint256 agentId, string calldata strategyTag)
    returns (
        int256 targetYield,      // Immutable goal
        uint256 runCount,        // Total rebalances
        int256 avgActualYield,   // Average APY achieved
        uint256 hitCount,        // Times target was met
        int256 minActualYield    // Worst rebalance
    );
```

---

## Server Layer Integration

### Before Deployment

```typescript
// Frontend provides target yield
const targetYield = 800;  // 8% APY goal
const strategyTag = "portfolio-v1";
```

### After Pipeline (Rebalance Complete)

```typescript
// Record actual yield achieved
const actualYield = 850;  // 8.5% APY achieved

await ledger.record(
    agentId,
    strategyTag,
    targetYield,      // Immutable across runs
    actualYield,      // New metric each rebalance
    evidenceCidHash
);
```

### Critic Loading Prior Performance

```typescript
// Check if target was achieved before
const priorSummary = await ledger.getSummary(agentId, strategyTag);
// {
//   targetYield: 800,
//   runCount: 5,
//   avgActualYield: 820,
//   hitCount: 4,  ← "Hit 4 out of 5 times"
//   minActualYield: 700
// }

if (priorSummary.hitCount >= 4) {
  // This allocation strategy reliably hits target
  // Re-use it in next version
}
```

---

## Test Coverage

**18 tests organized by scenario:**

- **Target yield tests** (3): Recording with target, immutability, error on mismatch
- **Success tracking** (3): Hit counting, miss detection, hit rate calculation
- **Averaging** (1): Average actual yield across runs
- **Negative yields** (1): Losses tracked correctly
- **Min/max tracking** (1): Portfolio volatility tracking
- **Multi-agent isolation** (1): Agents don't interfere
- **Security** (2): Operator-only access, empty summaries
- **Events** (1): OutcomeRecorded emits correctly
- **Target yield queries** (2): getTargetYield lookup
- **Integration** (4): Full lifecycle, target misses, concurrent allocations, ownership transfer

---

## Backward Compatibility

⚠️ **Breaking change from strategy-type design:**

1. Remove StrategyType enum from contract ABI
2. Update `ledger.record()` calls: pass targetYield instead of strategyType
3. Update `getSummary()` parsing: now returns (targetYield, runCount, avgActual, hitCount, minActual)
4. Update Critic logic: compare by avgActualYield and hitCount

---

## Future Enhancements

- **Rebalance frequency tracking:** How often does portfolio need rebalancing?
- **Time-weighted average:** Recent allocations weighted higher
- **Strategy volatility score:** Standard deviation of yields
- **Multi-asset support:** Track BTC, ETH, stables separately
- **Slippage tracking:** Record rebalancing costs
- **Risk appetite correlation:** If user wants lower volatility, suggest safer allocations

---

## Summary

**Before:** 6 strategy types with incomparable metrics → Over-engineered, hard to compare

**After:** Single yield metric, driven by user's target → Simple, learnable, actionable

- Frontend specifies target (8% APY)
- Agent allocates portfolio to hit target
- Reputation tracks success rate (N hits out of M runs)
- Critic picks best allocation strategy
- Loop repeats with self-improving allocations

✅ **Result:** Reputation is now **simple, understandable, and directly actionable** for portfolio allocation.
