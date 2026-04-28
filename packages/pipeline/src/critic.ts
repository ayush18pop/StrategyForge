import { ok, err } from '@strategyforge/core';
import type {
  StrategyGoal,
  MarketSnapshot,
  CandidateWorkflow,
  BoundsResult,
  CandidateVerdict,
  EvidenceBundle,
  StepEvidence,
  Result,
  FailurePattern,
} from '@strategyforge/core';
import type { InferenceClient } from './researcher.js';

export interface CriticOutput {
  boundsResults: BoundsResult[];
  verdicts: CandidateVerdict[];
  selectedCandidate: CandidateWorkflow;
  constraints: string[];
  evidence: StepEvidence;
}

// ─── System Prompt — workflow auditor ────────────────────────────
// Mirrors docs/prompts.md → Critic Prompt verbatim.

const CRITIC_SYSTEM_PROMPT = `You are a DeFi workflow auditor. You receive 2-3 candidate workflow DAGs and your job is to:

1. Reject any candidate that fails STRUCTURAL bounds checks (these are pre-computed
   for you; if passed=false, the candidate is structurally broken).

2. Audit the surviving candidates for LOGICAL bugs:
     - "Dump-of-actions" pattern: ≥6 action nodes with edges < nodes-1 and no
       Condition/Code/For-Each — auto-reject.
     - Orphan nodes: a node not reachable from "trigger".
     - Condition nodes with edges that lack sourceHandle.
     - Condition wired to only ONE branch (the false branch is missing) — flag
       unless the rationale explicitly justifies it.
     - Action nodes that mutate state without an upstream read or condition.
     - ERC-20 spending action without an approve upstream (and the spending node
       is not itself an approve / withdraw).
     - For Each without a downstream Collect when results feed another node.
     - Templating references that point to a non-existent upstream node id or field.
     - Hardcoded random wallet addresses that aren't placeholders.

3. Evaluate FIT for the user's goal:
     - Does the trigger cadence match the goal? (5-min cron for a 12-month yield
       deposit is wasteful; daily cron for liquidation-protection is dangerous)
     - Does the candidate use the same chain(s) the user specified?
     - Is notification verbosity appropriate?

4. Pick the BEST candidate and explain why in ≤2 sentences.

5. Output mandatoryConstraints — operational guardrails the deploying server must
   enforce after the workflow goes live.

Return JSON:
{
  "boundsResults": [{ "candidateId": string, "passed": boolean, "reason": string }],
  "verdicts": [
    {
      "candidateId": string,
      "approved": boolean,
      "estimatedGasMonthlyUsd": number,
      "risks": [string],
      "logicBugs": [string]
    }
  ],
  "selectedCandidateId": string,
  "selectionRationale": string,
  "mandatoryConstraints": [string]
}

If ALL candidates have logic bugs, set selectedCandidateId to the one with fewest
bugs and add a top-level "blocker" string in mandatoryConstraints describing what
must change for production deployment.`;

// ─── Critic ──────────────────────────────────────────────────────

export class Critic {
  constructor(private readonly inference: InferenceClient) { }

  async run(params: {
    candidates: CandidateWorkflow[];
    priorFailures: EvidenceBundle[];
    snapshot: MarketSnapshot;
    goal: StrategyGoal;
    failurePatterns?: FailurePattern[];  // Critic learns from prior failures
  }): Promise<Result<CriticOutput>> {
    const { candidates, priorFailures, snapshot, goal, failurePatterns } = params;

    // 1. Deterministic structural bounds (the LLM gets these as truth)
    const boundsResults: BoundsResult[] = candidates.map(c => computeBounds(c));

    // 2. Filter to surviving candidates for the LLM
    const surviving = candidates.filter(c => {
      const b = boundsResults.find(r => r.candidateId === c.id);
      return b?.passed ?? false;
    });
    const llmCandidates = surviving.length > 0 ? surviving : candidates;

    // 3. Sealed inference — LLM auditor (with learned failure patterns)
    const inferResult = await this.inference.infer({
      systemPrompt: CRITIC_SYSTEM_PROMPT,
      userPrompt: buildUserPrompt(llmCandidates, boundsResults, snapshot, priorFailures, goal, failurePatterns),
      jsonMode: true,
    });
    if (!inferResult.ok) return err(inferResult.error);

    let llmOut: {
      boundsResults?: unknown[];
      verdicts?: unknown[];
      selectedCandidateId?: string;
      selectionRationale?: string;
      mandatoryConstraints?: string[];
    } = {};
    try {
      llmOut = JSON.parse(inferResult.value.response) as typeof llmOut;
    } catch { /* fallback below */ }

    const verdicts: CandidateVerdict[] = parseVerdicts(llmOut.verdicts ?? [], boundsResults, candidates);

    // Pick selected: prefer LLM choice, else best-by-bounds
    const selectedId = llmOut.selectedCandidateId ?? bestCandidateId(candidates, boundsResults);
    const selectedCandidate =
      candidates.find(c => c.id === selectedId) ?? candidates[0];
    if (!selectedCandidate) {
      return err(new Error('Critic: no candidates available to select'));
    }

    const constraints = Array.isArray(llmOut.mandatoryConstraints)
      ? llmOut.mandatoryConstraints.filter((s): s is string => typeof s === 'string')
      : [];

    const evidence: StepEvidence = {
      input: {
        candidates: candidates as unknown as Record<string, unknown>[],
        priorFailuresCount: priorFailures.length,
      },
      output: {
        boundsResults: boundsResults as unknown as Record<string, unknown>[],
        verdicts: verdicts as unknown as Record<string, unknown>[],
        selectedCandidateId: selectedCandidate.id,
        selectionRationale: llmOut.selectionRationale ?? 'Best bounds-passing candidate',
        mandatoryConstraints: constraints,
      },
      attestationHash: inferResult.value.attestationHash,
      timestamp: Date.now(),
    };

    return ok({ boundsResults, verdicts, selectedCandidate, constraints, evidence });
  }
}

// ─── Deterministic bounds checks (BEFORE LLM) ─────────────────────

function computeBounds(candidate: CandidateWorkflow): BoundsResult {
  const violations: string[] = [];
  const nodes = candidate.nodes ?? [];
  const edges = candidate.edges ?? [];

  // R1: must have at least one node
  if (nodes.length === 0) {
    violations.push('Workflow has no nodes');
  }

  // R2: edges must reference real nodes (or "trigger")
  const nodeIds = new Set(nodes.map(n => n.id));
  nodeIds.add('trigger');
  for (const edge of edges) {
    if (!edge.source || !edge.target) {
      violations.push('Edge missing source or target');
      continue;
    }
    if (!nodeIds.has(edge.source)) {
      violations.push(`Edge source "${edge.source}" references unknown node`);
    }
    if (!nodeIds.has(edge.target)) {
      violations.push(`Edge target "${edge.target}" references unknown node`);
    }
  }

  // R3: trigger must have at least one outgoing edge (unless single-node workflow)
  if (nodes.length > 0 && !edges.some(e => e.source === 'trigger')) {
    violations.push('Trigger has no outgoing edges');
  }

  // R4: dump-of-actions detection
  const conditionNodes = nodes.filter(n =>
    n.type === 'Condition' || n.type === 'Code' || n.type === 'For Each' || n.type === 'code/run-code',
  );
  const actionNodes = nodes.filter(n =>
    !['Condition', 'Code', 'For Each', 'Collect', 'Math', 'HTTP Request', 'Database Query',
      'code/run-code', 'math/aggregate'].includes(n.type),
  );
  if (actionNodes.length >= 6 && edges.length < nodes.length - 1 && conditionNodes.length === 0) {
    violations.push(
      `Dump-of-actions pattern: ${actionNodes.length} action nodes, ${edges.length} edges, ` +
      `no Condition/Code/For Each. Workflow has no logic.`,
    );
  }

  // R5: every Condition node's outgoing edges must have sourceHandle
  for (const cond of nodes.filter(n => n.type === 'Condition')) {
    const outgoing = edges.filter(e => e.source === cond.id);
    if (outgoing.length > 0 && outgoing.some(e => !e.sourceHandle)) {
      violations.push(`Condition node "${cond.id}" has outgoing edges without sourceHandle`);
    }
  }

  // R6: orphan nodes (not reachable from trigger)
  if (edges.length > 0) {
    const reachable = new Set<string>(['trigger']);
    let added = true;
    while (added) {
      added = false;
      for (const e of edges) {
        if (reachable.has(e.source) && !reachable.has(e.target)) {
          reachable.add(e.target);
          added = true;
        }
      }
    }
    for (const n of nodes) {
      if (!reachable.has(n.id)) {
        violations.push(`Node "${n.id}" is unreachable from trigger`);
      }
    }
  }

  return {
    candidateId: candidate.id,
    boundsViolations: violations,
    passed: violations.length === 0,
  };
}

function bestCandidateId(
  candidates: CandidateWorkflow[],
  boundsResults: BoundsResult[],
): string | undefined {
  // Pick the bounds-passing candidate with highest confidence; else first
  const passing = candidates.filter(c => {
    const b = boundsResults.find(r => r.candidateId === c.id);
    return b?.passed ?? false;
  });
  const best = (passing.length > 0 ? passing : candidates)
    .slice()
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];
  return best?.id;
}

// ─── LLM verdict parsing ──────────────────────────────────────────

function parseVerdicts(
  raw: unknown[],
  boundsResults: BoundsResult[],
  candidates: CandidateWorkflow[],
): CandidateVerdict[] {
  if (raw.length > 0) {
    const parsed: CandidateVerdict[] = [];
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const v = item as Record<string, unknown>;
      const candidateId = typeof v.candidateId === 'string' ? v.candidateId : '';
      if (!candidateId) continue;
      const boundsCheck = boundsResults.find(r => r.candidateId === candidateId);
      if (!boundsCheck) continue;
      parsed.push({
        candidateId,
        boundsCheck,
        approved: typeof v.approved === 'boolean' ? v.approved : boundsCheck.passed,
        risks: parseStringList(v.risks),
        constraints: parseStringList(v.logicBugs ?? v.constraints),
      });
    }
    if (parsed.length > 0) return parsed;
  }
  return candidates.map(c => {
    const boundsCheck = boundsResults.find(r => r.candidateId === c.id) ?? {
      candidateId: c.id, boundsViolations: [], passed: false,
    };
    return { candidateId: c.id, boundsCheck, approved: boundsCheck.passed, risks: [], constraints: [] };
  });
}

function parseStringList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return [raw.trim()];
  }
  return [];
}

// ─── User prompt ──────────────────────────────────────────────────

function buildUserPrompt(
  candidates: CandidateWorkflow[],
  boundsResults: BoundsResult[],
  snapshot: MarketSnapshot,
  priorFailures: EvidenceBundle[],
  goal: StrategyGoal,
  failurePatterns?: FailurePattern[],
): string {
  const priorSection = priorFailures.length > 0
    ? `PRIOR FAILURES — flag candidates that repeat these patterns:\n${priorFailures.map(p => {
        const out = p.pipeline.critic.output as { selectionRationale?: string };
        return `v${p.version}: ${p.outcomes?.finalStatus ?? 'unknown'} — ${out.selectionRationale ?? 'n/a'}`;
      }).join('\n')}`
    : 'No prior failures.';

  // Critic learns: what specifically failed and why
  const failurePatternSection = failurePatterns && failurePatterns.length > 0
    ? `FAILURE PATTERNS TO AVOID — these candidates caused underperformance:\n${failurePatterns.map(fp =>
        `v${fp.version}: Used ${fp.affectedProtocols.join(", ")} → Target ${fp.targetYield} BPS, Actual ${fp.actualYield} BPS (missed by ${fp.gap} BPS). Reason: ${fp.reason}`
      ).join("\n")}\n\nRecommendation: Flag any candidate that uses the same protocol combinations or repeat the failure reason.`
    : 'No prior failure patterns extracted (first deployment or all prior versions succeeded).';

  return [
    `USER GOAL:\n${JSON.stringify(goal, null, 2)}`,
    `MARKET STATE (for fit evaluation):\n${JSON.stringify(snapshot.protocols.slice(0, 8), null, 2)}`,
    `CANDIDATES:\n${JSON.stringify(candidates, null, 2)}`,
    `PRE-COMPUTED BOUNDS RESULTS (structural check — use as truth):\n${JSON.stringify(boundsResults, null, 2)}`,
    priorSection,
    failurePatternSection,
    'Audit. Consider prior failures. Pick the best. Return JSON only.',
  ].join('\n\n');
}
