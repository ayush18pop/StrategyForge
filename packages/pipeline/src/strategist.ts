import { createHash } from "node:crypto";
import { ok, err } from "@strategyforge/core";
import type {
  StrategyGoal,
  CandidateWorkflow,
  EvidenceBundle,
  StepEvidence,
  Result,
  WorkflowNode,
  WorkflowEdge,
  ActionSchema,
} from "@strategyforge/core";
import type { ResearcherOutput, InferenceClient } from "./researcher.js";

export interface StrategistOutput {
  candidates: CandidateWorkflow[];
  evidence: StepEvidence;
}

// ─── System Prompt ──────────────────────────────────────────────
// Mirrors docs/prompts.md → Strategist Prompt verbatim.

const STRATEGIST_SYSTEM_PROMPT = `You are a DeFi automation pipeline strategist. You design KeeperHub workflow DAGs.

A workflow is a directed acyclic graph of nodes connected by edges. It runs on a
trigger (cron schedule, webhook, manual, or event) and produces a real, useful piece
of automation — not an allocation table.

────────────────────────────────────────────────────────────────────────
WORKFLOW STRUCTURE
────────────────────────────────────────────────────────────────────────

Every CandidateWorkflow has:
  - id           : string (e.g. "A", "B", "C")
  - trigger      : { type: "schedule"|"manual"|"webhook"|"event", config: {...} }
                   schedule: { cron: "0 */6 * * *" } (UTC cron)
                   webhook:  { path: "/webhook/my-flow" }
                   event:    { contract, eventName, fromBlock? }
                   manual:   {}
  - nodes        : Array<{ id, type, config, label? }>
  - edges        : Array<{ source, target, sourceHandle? }>
  - hypothesis   : one-sentence description
  - confidence   : number 0..1
  - rationale    : why this beats simpler alternatives

Edges: first edge ALWAYS originates from "trigger" (literal string, not a node id).
Condition nodes: every outgoing edge MUST set sourceHandle to "true" or "false".

────────────────────────────────────────────────────────────────────────
SPECIAL NODE TYPES (always available)
────────────────────────────────────────────────────────────────────────

  Condition       config: { condition: "<JS expr>" }   sourceHandles: "true"/"false"
  Code            config: { code: "<JS body>" }        return value flows downstream
  Math            config: { operation, inputMode, ... }
  For Each        config: { arraySource: "{{...}}", concurrency?: "sequential"|"parallel" }
  Collect         config: {}    must follow a For Each
  HTTP Request    config: { endpoint, httpMethod, httpHeaders?, httpBody? }
  Database Query  config: { integrationId, dbQuery }

Templating: any string field can reference an upstream node via
  {{@<nodeId>:<Label>.<field>}}     e.g. {{@check-balance:Check Balance.balance}}

────────────────────────────────────────────────────────────────────────
PLACEHOLDERS — workflows are deployed as TEMPLATES
────────────────────────────────────────────────────────────────────────

The user fills in addresses/credentials AFTER deployment, so:
  - "0xYOUR_WALLET_ADDRESS"   for the user's wallet
  - "0xRECIPIENT_ADDRESS"     for transfer destinations
  - "0xVAULT_ADDRESS"         for ERC-4626 contracts the user picks

Canonical Ethereum mainnet token addresses (use these literally):
  USDC: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
  DAI:  0x6B175474E89094C44Da98b954EedeAC495271d0F
  USDT: 0xdAC17F958D2ee523a2206206994597C13D831ec7
  WETH: 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
  USDS: 0xdC035D45d973E3EC169d2276DDab16f1e407384F
Base mainnet:
  USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
  WETH: 0x4200000000000000000000000000000000000006

Aave V3 Pool (Ethereum): 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2
Aave V3 Pool (Base):     0xA238Dd80C259a72e81d7e4664a9801593F98d1c5

For amounts, use decimals (USDC=6, most ERC-20=18). For "deposit all idle balance",
template the upstream balance read instead of hardcoding.

────────────────────────────────────────────────────────────────────────
FULL EXAMPLE (study this shape)
────────────────────────────────────────────────────────────────────────

User goal: protect Aave V3 borrow on Ethereum

{
  "id": "A",
  "trigger": { "type": "schedule", "config": { "cron": "*/5 * * * *" } },
  "nodes": [
    { "id": "check-health", "type": "aave-v3/get-user-account-data",
      "label": "Check Aave V3 Health Factor",
      "config": { "network": "1", "user": "0xYOUR_WALLET_ADDRESS" } },
    { "id": "is-warning", "type": "Condition", "label": "Health < 1.5?",
      "config": { "condition": "{{@check-health:Check Aave V3 Health Factor.healthFactor}} < 1.5" } },
    { "id": "is-critical", "type": "Condition", "label": "Health < 1.2?",
      "config": { "condition": "{{@check-health:Check Aave V3 Health Factor.healthFactor}} < 1.2" } },
    { "id": "warn-discord", "type": "discord/send-message", "label": "Discord Warning",
      "config": { "discordMessage": "⚠ Health factor is {{@check-health:Check Aave V3 Health Factor.healthFactor}}" } },
    { "id": "auto-repay", "type": "aave-v3/repay", "label": "Auto-Repay 20%",
      "config": { "network": "1", "asset": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        "amount": "{{ Math.floor({{@check-health:Check Aave V3 Health Factor.totalDebtBase}} * 0.2) }}",
        "onBehalfOf": "0xYOUR_WALLET_ADDRESS", "interestRateMode": "2" } },
    { "id": "alert-email", "type": "sendgrid/send-email", "label": "Critical Email",
      "config": { "emailTo": "you@example.com", "emailSubject": "CRITICAL: Auto-repay triggered",
        "emailBody": "HF was {{@check-health:Check Aave V3 Health Factor.healthFactor}}. Tx: {{@auto-repay:Auto-Repay 20%.transactionHash}}" } }
  ],
  "edges": [
    { "source": "trigger",      "target": "check-health" },
    { "source": "check-health", "target": "is-warning" },
    { "source": "is-warning",   "target": "warn-discord", "sourceHandle": "true" },
    { "source": "is-warning",   "target": "is-critical",  "sourceHandle": "true" },
    { "source": "is-critical",  "target": "auto-repay",   "sourceHandle": "true" },
    { "source": "auto-repay",   "target": "alert-email" }
  ],
  "hypothesis": "Poll health factor every 5 min; warn on Discord <1.5; auto-repay 20% and email on <1.2.",
  "confidence": 0.92,
  "rationale": "Two-tier alerting avoids alert fatigue while still giving an emergency response. 20% repay restores safety without over-correcting."
}

See docs/prompts.md for two more full examples (yield auto-deposit, rate dashboard).

────────────────────────────────────────────────────────────────────────
ANTI-PATTERNS — DO NOT PRODUCE
────────────────────────────────────────────────────────────────────────

✗ Workflow with N nodes and 0 edges (auto-rejected dump-of-actions bug)
✗ Workflow whose trigger has no outgoing edges
✗ Action nodes with empty config: {} — fill requiredFields with placeholders
✗ Condition node with edges that lack sourceHandle
✗ Condition wired to only ONE branch (false branch missing) without justification
✗ ERC-20 spending action without an approve upstream (unless it IS approve/withdraw)
✗ For Each not paired with Collect when its results feed downstream nodes
✗ Hardcoded random wallet addresses — use 0xYOUR_WALLET_ADDRESS placeholder
✗ Producing only 1 candidate when 2-3 were requested

────────────────────────────────────────────────────────────────────────
RETURN VALUE
────────────────────────────────────────────────────────────────────────

Return ONLY a JSON object (no prose, no markdown):

{ "candidates": [ <CandidateWorkflow>, <CandidateWorkflow>, <CandidateWorkflow>? ] }

Produce 2 or 3 distinct candidates that explore meaningfully different shapes:
  A: conservative / minimal-action design
  B: more aggressive / multi-step (cross-chain, escalating alerts, rebalance)
  C (optional): contrarian (e.g. "monitor-only, no on-chain action")

Every candidate must satisfy every rule above.`;

const STRATEGIST_REPAIR_SYSTEM_PROMPT = `You repair malformed KeeperHub workflow JSON.

Return ONLY a strict JSON object with this shape:
{ "candidates": [ <CandidateWorkflow>, <CandidateWorkflow>? ] }

Hard requirements:
- "trigger" must be an object, never a string
- "nodes" must be an array, never a string
- "edges" must be an array, never a string
- Quote every property name
- Close missing braces/brackets
- Preserve the original candidate intent when possible
- Drop irreparable candidates instead of returning prose`;

const STRATEGIST_RETRY_SYSTEM_PROMPT = `You are a DeFi automation pipeline strategist. Return only strict JSON.

Required shape:
{ "candidates": [ <CandidateWorkflow>, <CandidateWorkflow> ] }

Hard rules:
- "trigger" is an object, never a string
- "nodes" is an array, never a string
- "edges" is an array, never a string
- first edge source must be "trigger"
- every edge from a Condition node must include sourceHandle
- use placeholders like 0xYOUR_WALLET_ADDRESS when needed
- use only the provided action types`;

type StrategistAttemptStage = "initial" | "repair" | "retry";

interface StrategistInferenceAttempt {
  stage: StrategistAttemptStage;
  response: string;
  rawCandidateCount: number;
  candidates: CandidateWorkflow[];
  attestationHash: string;
  model: string;
  provider: string;
}

// ─── Strategist ──────────────────────────────────────────────────

export class Strategist {
  constructor(private readonly inference: InferenceClient) {}

  async run(params: {
    researcherOutput: ResearcherOutput;
    priorVersions: EvidenceBundle[];
    goal: StrategyGoal;
    actionSchemas: ActionSchema[];
  }): Promise<Result<StrategistOutput>> {
    const { researcherOutput, priorVersions, goal, actionSchemas } = params;
    const attempts: StrategistInferenceAttempt[] = [];

    const initialAttempt = await runStrategistAttempt(
      this.inference,
      "initial",
      {
        systemPrompt: STRATEGIST_SYSTEM_PROMPT,
        userPrompt: buildUserPrompt(
          researcherOutput,
          goal,
          actionSchemas,
          priorVersions,
        ),
        jsonMode: true,
      },
    );
    if (!initialAttempt.ok) return err(initialAttempt.error);
    attempts.push(initialAttempt.value);

    let candidates = initialAttempt.value.candidates;

    if (candidates.length === 0) {
      const repairAttempt = await runStrategistAttempt(
        this.inference,
        "repair",
        {
          systemPrompt: STRATEGIST_REPAIR_SYSTEM_PROMPT,
          userPrompt: buildRepairUserPrompt(initialAttempt.value.response),
          jsonMode: true,
        },
      );
      if (repairAttempt.ok) {
        attempts.push(repairAttempt.value);
        if (repairAttempt.value.candidates.length > 0) {
          candidates = repairAttempt.value.candidates;
        }
      }
    }

    if (candidates.length === 0) {
      const retryAttempt = await runStrategistAttempt(this.inference, "retry", {
        systemPrompt: STRATEGIST_RETRY_SYSTEM_PROMPT,
        userPrompt: buildRetryUserPrompt(
          researcherOutput,
          goal,
          actionSchemas,
          priorVersions,
        ),
        jsonMode: true,
      });
      if (retryAttempt.ok) {
        attempts.push(retryAttempt.value);
        if (retryAttempt.value.candidates.length > 0) {
          candidates = retryAttempt.value.candidates;
        }
      }
    }

    const usedFallback = candidates.length === 0;
    if (usedFallback) {
      // If every recovery attempt fails, emit a fully wired strategy that is safe
      // for demos rather than a placeholder message node.
      candidates = [hardcodedYieldFallbackStrategy(researcherOutput, goal)];
    }

    const evidence: StepEvidence = {
      input: {
        contextType: researcherOutput.contextType,
        suitableActions: researcherOutput.suitableActions,
        signals: researcherOutput.signals,
        regime: researcherOutput.regime,
        goal: goal as unknown as Record<string, unknown>,
      },
      output: {
        candidates: candidates as unknown as Record<string, unknown>[],
        usedFallback,
        recoveryStagesUsed: attempts
          .filter((attempt) => attempt.stage !== "initial")
          .map((attempt) => attempt.stage),
        attempts: attempts.map((attempt) => ({
          stage: attempt.stage,
          rawCandidateCount: attempt.rawCandidateCount,
          parsedCandidateCount: attempt.candidates.length,
          model: attempt.model,
          provider: attempt.provider,
          attestationHash: attempt.attestationHash,
        })),
      },
      attestationHash: combineAttestationHashes(
        attempts.map((attempt) => attempt.attestationHash),
      ),
      timestamp: Date.now(),
    };

    return ok({ candidates, evidence });
  }
}

// ─── LLM output parsing ───────────────────────────────────────────

async function runStrategistAttempt(
  inference: InferenceClient,
  stage: StrategistAttemptStage,
  params: {
    systemPrompt: string;
    userPrompt: string;
    jsonMode?: boolean;
    maxRetries?: number;
  },
): Promise<Result<StrategistInferenceAttempt>> {
  const inferResult = await inference.infer(params);
  if (!inferResult.ok) return err(inferResult.error);

  const parsed = parseStrategistResponse(inferResult.value.response);

  return ok({
    stage,
    response: inferResult.value.response,
    rawCandidateCount: parsed.rawCandidateCount,
    candidates: parsed.candidates,
    attestationHash: inferResult.value.attestationHash,
    model: inferResult.value.model,
    provider: inferResult.value.provider,
  });
}

function parseStrategistResponse(response: string): {
  rawCandidateCount: number;
  candidates: CandidateWorkflow[];
} {
  const parsed = parseTopLevelResponse(response);
  const rawCandidates = extractRawCandidates(parsed);
  return {
    rawCandidateCount: rawCandidates.length,
    candidates: parseCandidates(rawCandidates),
  };
}

function extractRawCandidates(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== "object") return [];
  const record = parsed as Record<string, unknown>;
  if (Array.isArray(record.candidates)) return record.candidates;
  // Some LLMs wrap in { workflow: ... } or similar
  if (record.id && record.nodes) return [record];
  return [];
}

function parseCandidates(raw: unknown[]): CandidateWorkflow[] {
  const out: CandidateWorkflow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    const id = typeof c.id === "string" ? c.id : `C${out.length + 1}`;

    const trigger = parseTrigger(c.trigger);
    const nodes = parseNodes(c.nodes);
    const edges = parseEdges(c.edges);

    if (nodes.length === 0) continue;
    // Reject the dump-of-actions pattern: many nodes, zero edges, no Condition/Code
    if (edges.length === 0 && nodes.length > 2) continue;
    // Reject if trigger has no outgoing edge
    if (edges.length > 0 && !edges.some((e) => e.source === "trigger"))
      continue;

    out.push({
      id,
      nodes,
      edges,
      trigger,
      hypothesis: typeof c.hypothesis === "string" ? c.hypothesis : "Workflow",
      confidence: normalizeConfidence(c.confidence),
    });
  }
  return out;
}

function parseTopLevelResponse(response: string): unknown {
  const parsed = parseJsonLikeValue(response);
  return parsed === undefined ? response : parsed;
}

function parseTrigger(raw: unknown): CandidateWorkflow["trigger"] | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw === "string") {
    const parsed = parseJsonLikeValue(raw);
    if (parsed === undefined) return undefined;
    return parseTrigger(parsed);
  }
  if (typeof raw !== "object") return undefined;
  const t = raw as Record<string, unknown>;
  if (typeof t.type !== "string") return undefined;
  return {
    type: t.type as CandidateWorkflow["trigger"] extends infer T
      ? T extends { type: infer U }
        ? U
        : never
      : never,
    config:
      typeof t.config === "object" && t.config !== null
        ? (t.config as Record<string, unknown>)
        : {},
  } as CandidateWorkflow["trigger"];
}

function parseNodes(raw: unknown): WorkflowNode[] {
  const items = parseJsonIfString(raw);
  if (!Array.isArray(items)) return [];
  const nodes: WorkflowNode[] = [];
  for (const item of items) {
    if (typeof item !== "object" || item === null) continue;
    const n = item as Record<string, unknown>;
    if (typeof n.id !== "string" || typeof n.type !== "string") continue;
    nodes.push({
      id: n.id,
      type: n.type,
      config:
        typeof n.config === "object" && n.config !== null
          ? (n.config as Record<string, unknown>)
          : {},
      label: typeof n.label === "string" ? n.label : undefined,
    });
  }
  return nodes;
}

function parseEdges(raw: unknown): WorkflowEdge[] {
  const items = parseJsonIfString(raw);
  if (!Array.isArray(items)) return [];
  const edges: WorkflowEdge[] = [];
  for (const item of items) {
    if (typeof item !== "object" || item === null) continue;
    const e = item as Record<string, unknown>;
    if (typeof e.source !== "string" || typeof e.target !== "string") continue;
    edges.push({
      source: e.source,
      target: e.target,
      sourceHandle:
        typeof e.sourceHandle === "string" ? e.sourceHandle : undefined,
    });
  }
  return edges;
}

function parseJsonIfString(raw: unknown): unknown {
  if (typeof raw === "string") {
    const parsed = parseJsonLikeValue(raw);
    return parsed === undefined ? raw : parsed;
  }
  return raw;
}

function parseJsonLikeValue(raw: string): unknown | undefined {
  const cleaned = stripCodeFences(raw.trim());
  const fragment = extractJsonFragment(cleaned);
  const candidates = uniqueStrings([
    cleaned,
    fragment,
    normalizeJsonLike(cleaned),
    fragment ? normalizeJsonLike(fragment) : undefined,
    balanceJsonDelimiters(normalizeJsonLike(cleaned)),
    fragment ? balanceJsonDelimiters(normalizeJsonLike(fragment)) : undefined,
  ]);

  for (const candidate of candidates) {
    const parsed = tryParseJson(candidate);
    if (parsed !== undefined) return parsed;
  }

  return undefined;
}

function tryParseJson(raw: string): unknown | undefined {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function stripCodeFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractJsonFragment(raw: string): string | undefined {
  const starts = [raw.indexOf("{"), raw.indexOf("[")].filter(
    (index) => index >= 0,
  );
  const ends = [raw.lastIndexOf("}"), raw.lastIndexOf("]")].filter(
    (index) => index >= 0,
  );
  if (starts.length === 0 || ends.length === 0) return undefined;

  const start = Math.min(...starts);
  const end = Math.max(...ends);
  if (end <= start) return undefined;
  return raw.slice(start, end + 1);
}

function normalizeJsonLike(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_-]*)(\s*:)/g, '$1"$2"$3')
    .replace(/,\s*([}\]])/g, "$1");
}

function balanceJsonDelimiters(raw: string): string {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (const char of raw) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\" && inString) {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{" || char === "[") {
      stack.push(char);
      continue;
    }
    if (char === "}" && stack[stack.length - 1] === "{") {
      stack.pop();
      continue;
    }
    if (char === "]" && stack[stack.length - 1] === "[") {
      stack.pop();
    }
  }

  let suffix = "";
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    suffix += stack[index] === "{" ? "}" : "]";
  }
  return `${raw}${suffix}`;
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (!value) continue;
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function normalizeConfidence(raw: unknown): number {
  if (typeof raw !== "number" || Number.isNaN(raw)) return 0.7;
  if (raw > 1 && raw <= 100) return Math.min(1, Math.max(0, raw / 100));
  return Math.min(1, Math.max(0, raw));
}

// ─── Hardcoded fallback when LLM completely fails ────────────────

function hardcodedYieldFallbackStrategy(
  researcherOutput: ResearcherOutput,
  goal: StrategyGoal,
): CandidateWorkflow {
  const canonicalChains = goal.chains.length > 0 ? goal.chains : ["ethereum"];
  const primaryChain = canonicalChains[0] ?? "ethereum";

  const usdcAddress =
    primaryChain === "base"
      ? "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
      : "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

  const aavePool =
    primaryChain === "base"
      ? "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5"
      : "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2";

  return {
    id: "A",
    trigger: { type: "schedule", config: { cron: "0 */6 * * *" } },
    nodes: [
      {
        id: "check-balance",
        type: "web3/check-token-balance",
        label: "Check USDC Balance",
        config: {
          tokenAddress: usdcAddress,
          walletAddress: "0xYOUR_WALLET_ADDRESS",
          network: primaryChain,
        },
      },
      {
        id: "approve-aave",
        type: "web3/approve-token",
        label: "Approve Aave USDC",
        config: {
          tokenAddress: usdcAddress,
          spender: aavePool,
          amount: "{{@check-balance:Check USDC Balance.balance}}",
          network: primaryChain,
        },
      },
      {
        id: "supply-aave",
        type: "aave-v3/supply",
        label: "Supply 40% to Aave",
        config: {
          network: primaryChain === "base" ? "8453" : "1",
          asset: usdcAddress,
          amount:
            "{{ Math.floor(Number({{@check-balance:Check USDC Balance.balance}}) * 0.4) }}",
          onBehalfOf: "0xYOUR_WALLET_ADDRESS",
          referralCode: "0",
        },
      },
      {
        id: "approve-morpho",
        type: "web3/approve-token",
        label: "Approve Morpho Vault",
        config: {
          tokenAddress: usdcAddress,
          spender: "0xVAULT_ADDRESS",
          amount:
            "{{ Math.floor(Number({{@check-balance:Check USDC Balance.balance}}) * 0.3) }}",
          network: primaryChain,
        },
      },
      {
        id: "deposit-morpho",
        type: "morpho/vault-deposit",
        label: "Deposit 30% to Morpho Vault",
        config: {
          network: primaryChain,
          vault: "0xVAULT_ADDRESS",
          assets:
            "{{ Math.floor(Number({{@check-balance:Check USDC Balance.balance}}) * 0.3) }}",
          receiver: "0xYOUR_WALLET_ADDRESS",
        },
      },
      {
        id: "approve-yearn",
        type: "web3/approve-token",
        label: "Approve Yearn Vault",
        config: {
          tokenAddress: usdcAddress,
          spender: "0xVAULT_ADDRESS",
          amount:
            "{{ Math.floor(Number({{@check-balance:Check USDC Balance.balance}}) * 0.3) }}",
          network: primaryChain,
        },
      },
      {
        id: "deposit-yearn",
        type: "yearn/vault-deposit",
        label: "Deposit 30% to Yearn Vault",
        config: {
          network: primaryChain,
          vault: "0xVAULT_ADDRESS",
          assets:
            "{{ Math.floor(Number({{@check-balance:Check USDC Balance.balance}}) * 0.3) }}",
          receiver: "0xYOUR_WALLET_ADDRESS",
        },
      },
      {
        id: "notify-telegram",
        type: "telegram/send-message",
        label: "Send Allocation Summary",
        config: {
          telegramMessage:
            `✅ Yield allocation executed for ${goal.asset} (${goal.amount}). ` +
            `Chain: ${primaryChain}. Split: 40% Aave, 30% Morpho, 30% Yearn. ` +
            `Context: ${researcherOutput.contextType}.`,
        },
      },
    ],
    edges: [
      { source: "trigger", target: "check-balance" },
      { source: "check-balance", target: "approve-aave" },
      { source: "approve-aave", target: "supply-aave" },
      { source: "supply-aave", target: "approve-morpho" },
      { source: "approve-morpho", target: "deposit-morpho" },
      { source: "deposit-morpho", target: "approve-yearn" },
      { source: "approve-yearn", target: "deposit-yearn" },
      { source: "deposit-yearn", target: "notify-telegram" },
    ],
    hypothesis:
      "Automatically deploy idle USDC across proven yield venues on a 6h cadence using deterministic split logic.",
    confidence: 0.78,
  };
}

function combineAttestationHashes(hashes: string[]): string {
  const digest = createHash("sha256");
  for (const hash of hashes) digest.update(hash);
  return digest.digest("hex");
}

// ─── User prompt builder ─────────────────────────────────────────

function buildUserPrompt(
  researcherOutput: ResearcherOutput,
  goal: StrategyGoal,
  actionSchemas: ActionSchema[],
  priorVersions: EvidenceBundle[],
): string {
  const relevantSchemas = summarizeActionSchemas(
    actionSchemas.filter((schema) =>
      researcherOutput.suitableActions.includes(schema.type),
    ),
  );
  const marketSummary = summarizeMarketContext(researcherOutput);

  const priorSection =
    priorVersions.length > 0
      ? `LESSONS FROM PRIOR VERSIONS:\n${priorVersions
          .map((p) => {
            const cOut = p.pipeline.critic.output as {
              selectionRationale?: string;
            };
            return (
              `v${p.version}: rationale was "${cOut.selectionRationale ?? "n/a"}". ` +
              `Outcome: ${JSON.stringify(p.outcomes ?? null)}`
            );
          })
          .join("\n")}`
      : "No prior versions.";

  return [
    `USER GOAL:\n${JSON.stringify(goal, null, 2)}`,
    `PLANNING CONTEXT:\n${JSON.stringify(marketSummary, null, 2)}`,
    `ALLOWED ACTION TYPES (plus System nodes named in the system prompt):\n${researcherOutput.suitableActions.join(", ")}`,
    `ACTION SCHEMA SUMMARY:\n${JSON.stringify(relevantSchemas, null, 2)}`,
    priorSection,
    `Design 2-3 candidate workflows using the shape from the example.`,
    `Return only the JSON object.`,
    `Do not encode trigger, nodes, or edges as strings.`,
  ].join("\n\n");
}

function buildRetryUserPrompt(
  researcherOutput: ResearcherOutput,
  goal: StrategyGoal,
  actionSchemas: ActionSchema[],
  priorVersions: EvidenceBundle[],
): string {
  return [
    `The previous workflow response was not parseable into valid DAG candidates.`,
    buildUserPrompt(researcherOutput, goal, actionSchemas, priorVersions),
    `Make the recovery easy on yourself: keep each candidate to 3-6 nodes and 2-6 edges.`,
    `Return exactly 2 candidates unless only 1 valid candidate is possible.`,
  ].join("\n\n");
}

function buildRepairUserPrompt(rawResponse: string): string {
  const truncated =
    rawResponse.length > 12_000
      ? `${rawResponse.slice(0, 12_000)}\n…[truncated]`
      : rawResponse;

  return [
    `Repair the malformed workflow response below.`,
    `Convert JS-style object literals or stringified arrays into strict JSON arrays/objects.`,
    `If a candidate is beyond repair, omit it instead of inventing a large replacement.`,
    `Malformed response:\n${truncated}`,
  ].join("\n\n");
}

function summarizeMarketContext(
  researcherOutput: ResearcherOutput,
): Record<string, unknown> {
  return {
    contextType: researcherOutput.contextType,
    regime: researcherOutput.regime,
    signals: researcherOutput.signals.slice(0, 8),
    topPools: researcherOutput.snapshot.protocols
      .slice(0, 8)
      .map((protocol) => ({
        name: protocol.name,
        chain: protocol.chain,
        apy: Number((protocol.apy * 100).toFixed(2)),
        tvl: Math.round(protocol.tvl),
        pool: protocol.pool,
      })),
  };
}

function summarizeActionSchemas(
  actionSchemas: ActionSchema[],
): Array<Record<string, unknown>> {
  return actionSchemas.map((schema) => {
    const summary: Record<string, unknown> = {
      type: schema.type,
      category: schema.category ?? null,
      requiredFields: Object.keys(schema.requiredFields ?? {}),
    };

    const optionalFields = Object.keys(schema.optionalFields ?? {});
    if (optionalFields.length > 0) {
      summary.optionalFields = optionalFields.slice(0, 6);
    }

    return summary;
  });
}
