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

export interface KellyPrior {
  protocol: string;
  p: number;        // P(protocol achieves stated APY) — derived from exploit history + TVL stability
  q: number;        // P(exploit / loss event) = 1 - p
  r: number;        // APY (payoff ratio)
  l: number;        // expected loss magnitude if exploit (typically 0.05–0.20)
  f_kelly: number;  // optimal Kelly fraction: (p * r - q * l) / r
  sigma: number;    // historical APY standard deviation (for Sharpe + VaR)
}

export interface ResearcherOutput {
  snapshot: MarketSnapshot;
  kellyPriors: KellyPrior[];
  regime: 'stable' | 'rising' | 'declining' | 'volatile';
  filteredOut: { protocol: string; reason: string }[];
  evidence: StepEvidence;
}

export interface Researcher {
  run(params: {
    goal: StrategyGoal;
    priorCids: string[];
  }): Promise<ResearcherOutput>;
}
```

**Logic (order matters):**

1. Fetch all stablecoin pools from DefiLlama matching goal chains
2. Filter: TVL > $10M, audited, no exploit in 90 days
3. If priorCids provided, load prior evidence bundles from 0G Storage — extract `updatedKellyPriors` from the most recent Critic output (these are the Critic-adjusted priors from the last run)
4. **Compute Kelly priors** (deterministic, no LLM):
   - `p` = base probability of achieving APY. Start at 0.95 for Aave, 0.88 for Morpho (curator risk), 0.93 for Spark. Reduce by 0.02 for each warning signal (TVL down, governance vote, high utilization). If prior version has updatedKellyPriors from Critic, use those instead.
   - `q` = 1 − p
   - `r` = current APY from DefiLlama
   - `l` = historical loss magnitude: Aave 0.01 (overcollateralized), Morpho 0.05 (curator risk), Spark 0.02
   - `f_kelly` = (p × r − q × l) / r
   - `sigma` = std deviation of 30-day APY history (fetch from DefiLlama historical endpoint)
5. Classify market regime from signals (APY trend, TVL trend, utilization)
6. Run 0G Compute sealed inference: LLM call with market data + computed Kelly priors → "Given these signals and Kelly scores, what's notable about the current regime?" → adds attestation hash

### `packages/pipeline/src/strategist.ts`

```typescript
export interface SharpeRanking {
  protocol: string;
  sharpe: number;  // (APY - 0.5%) / sigma
}

export interface StrategistOutput {
  candidates: CandidateAllocation[];  // each includes kellyBaseline + deviations
  sharpeRankings: SharpeRanking[];
  evidence: StepEvidence;
}

export interface Strategist {
  run(params: {
    researcherOutput: ResearcherOutput;
    priorVersions: EvidenceBundle[];
    goal: StrategyGoal;
  }): Promise<StrategistOutput>;
}
```

**Logic (math first, LLM second):**

1. **Compute Sharpe ratios** (deterministic) for all surviving protocols:
   - `sharpe_i = (APY_i − 0.005) / sigma_i`  (risk-free rate = 0.5%)
2. **Compute Kelly-normalized allocations** (deterministic):
   - Raw Kelly fractions may sum > 1 (each bet analyzed independently)
   - Normalize: `pct_i = f_kelly_i / sum(f_kelly_all)`
   - Apply regime dampener: in volatile regime, multiply all by 0.7, put 30% in cash buffer
3. **Pass math to LLM** (0G Compute sealed inference):
   - System prompt: see `docs/prompts.md` → Strategist Prompt
   - LLM receives Kelly fractions, Sharpe rankings, regime, and prior outcomes
   - LLM outputs 2-3 candidates with explicit rationale for any deviation from Kelly baseline
4. Return candidates + attestation hash

**Key constraint:** The LLM is explicitly told the Kelly fractions. It must justify any deviation > 20 percentage points. This is what makes the reasoning verifiable — the math is in the evidence bundle alongside the LLM's explanation.

### `packages/pipeline/src/critic.ts`

```typescript
export interface VaRResult {
  candidateId: string;
  portfolioSigma: number;          // weighted std dev of portfolio
  expectedReturn: number;          // Kelly-weighted expected return
  var95: number;                   // expectedReturn - 1.645 * portfolioSigma
  passed: boolean;                 // var95 > -lossThreshold
}

export interface CriticOutput {
  varResults: VaRResult[];
  verdicts: CandidateVerdict[];
  selectedCandidate: CandidateAllocation;
  constraints: string[];
  updatedKellyPriors: KellyPrior[];  // adjusted priors for next version
  evidence: StepEvidence;
}

export interface Critic {
  run(params: {
    candidates: CandidateAllocation[];
    kellyPriors: KellyPrior[];
    priorFailures: EvidenceBundle[];
    snapshot: MarketSnapshot;
    goal: StrategyGoal;
  }): Promise<CriticOutput>;
}
```

**Logic (VaR first, then LLM):**

1. **Compute VaR for each candidate** (deterministic, before LLM):
   - `portfolioSigma = sqrt(sum((weight_i * sigma_i)^2))` (assuming independence for simplicity)
   - `expectedReturn = sum(weight_i * APY_i * p_i)` (Kelly-weighted, not raw APY)
   - `var95 = expectedReturn - 1.645 * portfolioSigma`
   - `lossThreshold = conservative: 3%, balanced: 8%`
   - Reject any candidate where `var95 < -lossThreshold` before LLM even sees it
2. **LLM call** (0G Compute sealed inference) on surviving candidates:
   - System prompt: see `docs/prompts.md` → Critic Prompt
   - Passes: surviving candidates, VaR results, prior failure records, current Kelly priors
   - LLM outputs: verdicts, selected candidate, updated Kelly priors
3. Store `updatedKellyPriors` in evidence bundle — the Researcher in v(n+1) will load these via priorCids

**Why the Critic updates Kelly priors:**
If v1 used Morpho with `p=0.90` and actual yield was 60% of predicted, the Critic in v2 should output `p=0.80` for Morpho. This is how the system learns from its own history — not by the LLM "remembering," but by the math being updated via evidence.

### `packages/pipeline/src/compiler.ts`

```typescript
export interface CompilerOutput {
  workflowSpec: WorkflowSpec;
  gasEstimate: number;   // estimated monthly gas cost in USD
}

export interface Compiler {
  compile(params: {
    selectedCandidate: CandidateAllocation;
    constraints: string[];
    goal: StrategyGoal;
  }): CompilerOutput;
}
```

**NOT AN LLM CALL.** Pure deterministic function.

WorkflowSpec uses **nodes + edges** graph format (not flat steps). Node `type` strings come from `list_action_schemas` output — the Compiler loads these at startup and selects from them. Do NOT hardcode type strings before calling `list_action_schemas` on day 1.

**Fallback if native actions are unavailable:** If `list_action_schemas` does not return native Aave/Morpho/Spark action types, fall back to KeeperHub's generic `evm.call` action type with ABI-encoded calldata for each protocol interaction. The `evm.call` config includes `{ chainId, to, data, value }` — the Compiler ABI-encodes the relevant function call (e.g. Aave `supply(asset, amount, onBehalfOf, referralCode)`) into `data`. This fallback must be tested on day 1 alongside the `list_action_schemas` check.

Gas estimate = sum of estimated gas per node × current gas price × expected monthly frequency.

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

### `packages/pipeline/src/pipeline-orchestrator.ts`

**Runs the 9 steps. Never called directly — called by CreateOrchestrator or UpdateOrchestrator.**

```typescript
export type TriggerReason =
  | 'user_request'
  | 'apy_drift'
  | 'underperformance'
  | 'protocol_incident'
  | 'scheduled_review';

export interface PipelineInput {
  goal: StrategyGoal;
  familyId: string;
  priorCids: string[];                    // [] on creation, populated on update
  priorVersions: EvidenceBundle[];        // loaded from 0G Storage via priorCids
  actualOutcomes: AnalyticsOutcome | null; // null on creation, from Analytics API on update
  triggerReason: TriggerReason;
  emergencyUpdate: boolean;               // true → deploy immediately, skip any user review window
}

export interface PipelineOutput {
  strategy: StrategyVersion;
  evidenceBundle: EvidenceBundle;
  cid: string;
}

export interface PipelineOrchestrator {
  run(input: PipelineInput): Promise<Result<PipelineOutput>>;
}
```

**Steps (always the same 9, regardless of creation vs update):**

1. Compute Kelly priors — use `priorVersions[-1].critic.output.updatedKellyPriors` if available, else defaults
2. `Researcher.run()` → MarketSnapshot + regime (receives `actualOutcomes` + `triggerReason` as context)
3. `Strategist.run()` → candidates
4. VaR check — reject candidates exceeding loss threshold
5. `Critic.run()` → selectedCandidate + `updatedKellyPriors`
6. `Compiler.compile()` → WorkflowSpec + gasEstimate
7. `RiskValidator.validate()` → pass/fail
8. Build EvidenceBundle (includes `triggerReason`, `priorCids`, all step evidence)
9. Write bundle to 0G Storage → return CID

---

### `packages/pipeline/src/create-orchestrator.ts`

**Called when a user requests a new strategy.** Prepares input for the pipeline.

```typescript
export interface CreateOrchestrator {
  create(goal: StrategyGoal): Promise<Result<PipelineOutput>>;
}
```

**Logic:**

1. Generate a new `familyId` (uuid)
2. `priorCids: []`, `priorVersions: []`, `actualOutcomes: null`
3. `triggerReason: 'user_request'`, `emergencyUpdate: false`
4. Call `PipelineOrchestrator.run(input)`
5. Return result — caller (server layer) deploys to KeeperHub + registers AgentRegistry + records ReputationLedger

---

### `packages/pipeline/src/update-orchestrator.ts`

**Called by the strategy monitor cron when drift is detected.** Prepares input for the pipeline.

```typescript
export type UpdateTrigger =
  | { reason: 'apy_drift'; delta: number }
  | { reason: 'underperformance'; actualVsPredicted: number }
  | { reason: 'protocol_incident'; protocol: string; description: string }
  | { reason: 'scheduled_review' };

export interface UpdateOrchestrator {
  update(params: {
    familyId: string;
    trigger: UpdateTrigger;
  }): Promise<Result<PipelineOutput>>;
}
```

**Logic:**

1. Load family from 0G Storage KV: `family:{familyId}:latest` → get current CID chain
2. Load all prior `EvidenceBundle[]` from 0G Storage via `priorCids`
3. Fetch actual outcomes from KeeperHub Analytics API:
   - `GET /api/analytics/summary?range=7d` → success rate
   - `GET /api/analytics/runs?status=error` → failed runs
   - `GET /api/analytics/runs/{id}/steps` → which steps failed
4. Map trigger to `TriggerReason`
5. Set `emergencyUpdate: true` only if `trigger.reason === 'protocol_incident'`
6. Call `PipelineOrchestrator.run(input)` with all prior context loaded
7. Return result — caller deploys new KeeperHub workflow + updates AgentRegistry + records ReputationLedger

**Emergency update lifecycle skip:**

```typescript
// In the server layer, after PipelineOrchestrator returns:
// emergencyUpdate=true → deploy immediately as 'live', incident flag in EvidenceBundle
// emergencyUpdate=false → set 'draft', server deploys when ready
const lifecycle: Lifecycle = 'draft';
// Server layer sets to 'live' after deploying KeeperHub workflow
```

---

### `packages/pipeline/src/analytics-outcome.ts`

Helper that reads KeeperHub Analytics API and maps it to `AnalyticsOutcome`.

```typescript
export interface AnalyticsOutcome {
  successRate: number;          // from /api/analytics/summary
  failedRuns: FailedRun[];      // from /api/analytics/runs?status=error
  stepFailures: StepFailure[];  // from /api/analytics/runs/{id}/steps
  networkBreakdown: {           // from /api/analytics/networks
    network: string;
    successRate: number;
  }[];
}

export interface FailedRun {
  executionId: string;
  failedAt: string;
  steps: StepFailure[];
}

export interface StepFailure {
  nodeId: string;
  nodeName: string;
  errorMessage: string;
  protocol?: string;    // which protocol action failed
}
```

---

## Do NOT

- Do NOT call `PipelineOrchestrator` directly from the server — always go through `CreateOrchestrator` or `UpdateOrchestrator`
- Do NOT deploy to KeeperHub from inside the pipeline — that's the server layer's job
- Do NOT call AgentRegistry or ReputationLedger from inside the pipeline — that's the server layer's job
- Do NOT parse user input — the goal comes pre-structured into `StrategyGoal`
- Do NOT update an existing KeeperHub workflow on strategy update — always create a new one
