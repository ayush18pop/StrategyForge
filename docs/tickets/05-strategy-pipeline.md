# Ticket: Strategy Pipeline

> **Package:** `packages/pipeline`
> **Priority:** Day 2-3
> **Dependencies:** `@strategyforge/core`, `@strategyforge/compute`, `@strategyforge/storage`, `@strategyforge/data`
> **Read first:** `CLAUDE.md`, `docs/architecture.md` (Pipeline Architecture section)

## What to Build

The 7-step strategy creation pipeline. 4 sequential steps, then compile + validate + simulate.

## Files to Create

### `packages/pipeline/src/researcher.ts`

```typescript
import type { StrategyGoal, MarketSnapshot, ProtocolData, StepEvidence } from '@strategyforge/core';

export interface Researcher {
  run(params: {
    goal: StrategyGoal;
    priorCids: string[];       // load from 0G Storage
  }): Promise<{
    snapshot: MarketSnapshot;
    filteredOut: { protocol: string; reason: string }[];
    evidence: StepEvidence;
  }>;
}
```

**Logic:**

1. Fetch all stablecoin pools from DefiLlama matching goal chains
2. Filter: TVL > $10M, audited, no exploit in 90 days
3. If priorCids provided, load prior evidence bundles from 0G Storage
4. Build MarketSnapshot with surviving protocols
5. Run 0G Compute sealed inference: "Given this market data and prior experience, what's the regime?" → adds attestation hash

### `packages/pipeline/src/strategist.ts`

```typescript
export interface Strategist {
  run(params: {
    snapshot: MarketSnapshot;
    priorVersions: EvidenceBundle[];
    goal: StrategyGoal;
  }): Promise<{
    candidates: CandidateAllocation[];
    evidence: StepEvidence;
  }>;
}
```

**System prompt:**

```
You are a DeFi strategist. Given the market data and the user's goal, propose 2-3 candidate allocations.
For each candidate: specify protocol, chain, asset, percentage, and your hypothesis for why this allocation is good.
If prior version outcomes are provided, reference them in your reasoning.
Return JSON array of candidates.
```

### `packages/pipeline/src/critic.ts`

```typescript
export interface Critic {
  run(params: {
    candidates: CandidateAllocation[];
    priorFailures: EvidenceBundle[];
    snapshot: MarketSnapshot;
  }): Promise<{
    verdicts: CandidateVerdict[];
    selectedCandidate: CandidateAllocation;
    constraints: string[];
    evidence: StepEvidence;
  }>;
}
```

**System prompt:**

```
You are a DeFi risk analyst. For each candidate allocation, identify risks and attack vectors.
Reference prior failures if available. For each candidate, return: approved (bool), risks (string[]), constraints (string[]).
Select the best candidate considering risk mitigation.
```

### `packages/pipeline/src/compiler.ts`

```typescript
export interface Compiler {
  compile(params: {
    selectedCandidate: CandidateAllocation;
    constraints: string[];
    goal: StrategyGoal;
  }): WorkflowSpec;
}
```

**NOT AN LLM CALL.** Pure deterministic function using protocol templates.
See `docs/architecture.md` → Protocol Templates section.

### `packages/pipeline/src/risk-validator.ts`

```typescript
export interface RiskValidator {
  validate(spec: WorkflowSpec, allocation: CandidateAllocation): {
    passed: boolean;
    warnings: string[];
    violations: string[];
  };
}
```

**Hard rules:**

- Max 70% in single protocol
- Max 50% on single chain
- No unaudited protocols > 20%
- Total allocation must equal 100%
- Must have at least 2 protocols if amount > $10K

### `packages/pipeline/src/simulator.ts`

```typescript
export interface Simulator {
  simulate(params: {
    allocation: CandidateAllocation;
    snapshot: MarketSnapshot;
    horizon: string;
  }): {
    estimatedNetAPY: number;
    estimatedGasCost: number;   // monthly USD
    scenarios: { name: string; impact: string }[];
  };
}
```

### `packages/pipeline/src/orchestrator.ts`

**The main entry point.** Wires all steps together:

```typescript
export interface PipelineOrchestrator {
  generateStrategy(goal: StrategyGoal): Promise<Result<{
    strategy: StrategyVersion;
    evidenceBundle: EvidenceBundle;
    cid: string;
  }>>;
}
```

1. Researcher.run() → MarketSnapshot
2. Strategist.run() → candidates
3. Critic.run() → selected + constraints
4. Compiler.compile() → WorkflowSpec
5. RiskValidator.validate() → pass/fail
6. Simulator.simulate() → estimates
7. Build EvidenceBundle with all step evidence
8. Write bundle to 0G Storage → get CID
9. Return StrategyVersion + bundle + CID

## Do NOT

- Do NOT deploy to KeeperHub from here — that's a separate orchestration layer
- Do NOT register on ERC-8004 from here
- Do NOT parse user input — the goal comes pre-structured
