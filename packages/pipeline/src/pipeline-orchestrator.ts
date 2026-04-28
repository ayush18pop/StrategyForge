import { ok, err } from '@strategyforge/core';
import type {
  PipelineInput,
  EvidenceBundle,
  StrategyVersion,
  Result,
} from '@strategyforge/core';
import type { ResearcherOutput } from './researcher.js';
import type { StrategistOutput } from './strategist.js';
import type { CriticOutput } from './critic.js';
import type { CompilerOutput } from './compiler.js';
import type { ValidationResult } from './risk-validator.js';
import { Researcher } from './researcher.js';
import { Strategist } from './strategist.js';
import { Critic } from './critic.js';
import { Compiler } from './compiler.js';
import { RiskValidator } from './risk-validator.js';
import type { EvidenceStore } from '@strategyforge/storage';
import type { ActionSchemaSource, ActionSchema } from '@strategyforge/core';

// ─── Types ───────────────────────────────────────────────────────

export interface PipelineOutput {
  strategy: StrategyVersion;
  evidenceBundle: EvidenceBundle;
  cid: string;
}

export interface PipelineOrchestratorDeps {
  researcher: Researcher;
  strategist: Strategist;
  critic: Critic;
  compiler: Compiler;
  riskValidator: RiskValidator;
  evidenceStore: EvidenceStore;
  keeperhub: ActionSchemaSource;
}

// ─── PipelineOrchestrator ─────────────────────────────────────────

export class PipelineOrchestrator {
  constructor(private readonly deps: PipelineOrchestratorDeps) { }

  async run(input: PipelineInput): Promise<Result<PipelineOutput>> {
    const onStep = (
      input as PipelineInput & {
        onStep?: (step: string, status: 'start' | 'done' | 'error', message: string) => void;
      }
    ).onStep;
    const emitStep = (
      step: string,
      status: 'start' | 'done' | 'error',
      message: string,
    ) => onStep?.(step, status, message);

    const { goal, familyId, priorCids, priorVersions, actualOutcomes, triggerReason, failurePatterns } = input;

    // Step 0 — Fetch ActionSchemas from KeeperHub
    emitStep('discovery', 'start', 'Fetching KeeperHub action schemas');
    const schemasResult = await this.deps.keeperhub.listActionSchemas();
    const actionSchemas: ActionSchema[] = schemasResult.ok ? schemasResult.value : [];
    if (actionSchemas.length === 0) {
      console.warn('[PipelineOrchestrator] listActionSchemas returned empty. Using fallback mechanics.');
    }
    emitStep('discovery', 'done', `Loaded ${actionSchemas.length} action schemas`);

    // Step 1 — Discovery: parse available action schemas
    emitStep('researcher', 'start', 'Running researcher stage');
    const researcherResult = await this.deps.researcher.run({
      goal,
      priorVersions,
      actualOutcomes,
      triggerReason,
      actionSchemas,
    });
    if (!researcherResult.ok) {
      emitStep('researcher', 'error', researcherResult.error.message);
      return err(new Error(`Researcher failed: ${researcherResult.error.message}`));
    }
    emitStep('researcher', 'done', 'Researcher stage completed');
    const researcherOutput: ResearcherOutput = researcherResult.value;

    // Step 2 — Strategist: Candidate workflow generation
    emitStep('strategist', 'start', 'Generating strategy candidates');
    const strategistResult = await this.deps.strategist.run({
      researcherOutput,
      priorVersions,
      goal,
      actionSchemas,
    });
    if (!strategistResult.ok) {
      emitStep('strategist', 'error', strategistResult.error.message);
      return err(new Error(`Strategist failed: ${strategistResult.error.message}`));
    }
    emitStep('strategist', 'done', `Generated ${strategistResult.value.candidates.length} candidates`);
    const strategistOutput: StrategistOutput = strategistResult.value;

    // Step 3 — Critic: Bounds check + candidate selection + logic rule update
    // Critic learns from failure patterns to avoid repeating mistakes
    emitStep('critic', 'start', 'Critic evaluating candidates');
    const criticResult = await this.deps.critic.run({
      candidates: strategistOutput.candidates,
      priorFailures: priorVersions.filter(v => v.outcomes?.finalStatus === 'underperformed' || v.outcomes?.finalStatus === 'emergency_stopped'),
      snapshot: researcherOutput.snapshot,
      goal,
      failurePatterns,  // ← Critic uses this to validate candidates
    });
    if (!criticResult.ok) {
      emitStep('critic', 'error', criticResult.error.message);
      return err(new Error(`Critic failed: ${criticResult.error.message}`));
    }
    emitStep('critic', 'done', 'Critic selected candidate');
    const criticOutput: CriticOutput = criticResult.value;

    // Step 4 — Compiler: deterministic WorkflowSpec + gas estimate
    // Use Researcher's calculated rebalance frequency
    emitStep('compiler', 'start', 'Compiling workflow spec');
    let compilerOutput: CompilerOutput;
    try {
      compilerOutput = this.deps.compiler.compile({
        selectedCandidate: criticOutput.selectedCandidate,
        constraints: criticOutput.constraints,
        goal,
        rebalanceFrequency: researcherOutput.rebalanceFrequency,
      });
    } catch (e) {
      emitStep('compiler', 'error', e instanceof Error ? e.message : String(e));
      return err(new Error(`Compiler failed: ${e instanceof Error ? e.message : String(e)}`));
    }
    emitStep('compiler', 'done', 'Compiler produced workflow spec');

    // Step 5 — Risk Validator: hard rule checks
    emitStep('risk_validator', 'start', 'Validating risk constraints');
    const validationResult: ValidationResult = this.deps.riskValidator.validate(
      compilerOutput.workflowSpec,
      criticOutput.selectedCandidate,
      goal.amount,
    );
    if (!validationResult.passed) {
      emitStep('risk_validator', 'error', validationResult.violations.join('; '));
      return err(new Error(`Risk validation failed:\n${validationResult.violations.join('\n')}`));
    }
    emitStep('risk_validator', 'done', 'Risk validation passed');

    // Step 6 — Determine version number
    const version = priorVersions.length + 1;

    // Step 7 — Assemble EvidenceBundle
    const evidenceBundle: EvidenceBundle = {
      strategyFamily: familyId,
      version,
      priorCids,
      pipeline: {
        researcher: {
          input: researcherOutput.evidence.input,
          output: researcherOutput.evidence.output as {
            regime: 'stable' | 'rising' | 'declining' | 'volatile';
            survivingProtocols: string[];
            contextType: string;
            suitableActions: string[];
            signals: { subject?: string; protocol?: string; signal: string; severity: 'low' | 'medium' | 'high' }[];
          },
          attestationHash: researcherOutput.evidence.attestationHash,
          timestamp: researcherOutput.evidence.timestamp,
        },
        strategist: strategistOutput.evidence,
        critic: {
          input: criticOutput.evidence.input,
          output: criticOutput.evidence.output as {
            verdicts: Record<string, unknown>[];
            selectedCandidateId: string;
            selectionRationale: string;
            mandatoryConstraints: string[];
          },
          attestationHash: criticOutput.evidence.attestationHash,
          timestamp: criticOutput.evidence.timestamp,
        },
        compiler: {
          workflowSpec: compilerOutput.workflowSpec as unknown as Record<string, unknown>,
          gasEstimate: compilerOutput.gasEstimate,
        },
        riskValidator: {
          passed: validationResult.passed,
          warnings: validationResult.warnings,
        },
      },
      createdAt: Date.now(),
    };

    // Step 8 — Write EvidenceBundle to 0G Storage (best-effort: continues if storage unavailable)
    emitStep('storage', 'start', 'Writing evidence bundle to 0G storage');
    const writeResult = await this.deps.evidenceStore.writeBundle(evidenceBundle);
    let cid: string;
    if (!writeResult.ok) {
      console.warn(`[PipelineOrchestrator] Storage write failed (best-effort): ${writeResult.error.message}`);
      cid = `pending:${familyId}:v${version}:${Date.now()}`;
      // Cache under the pending CID so UpdateOrchestrator can still load this
      // bundle as a prior version within the same server session.
      this.deps.evidenceStore.cacheBundle(cid, evidenceBundle);
      emitStep('storage', 'error', `Storage write failed (best effort): ${writeResult.error.message}`);
    } else {
      cid = writeResult.value.cid;
      emitStep('storage', 'done', 'Evidence bundle stored successfully');
    }

    // Step 9 — Assemble StrategyVersion
    const strategy: StrategyVersion = {
      familyId,
      version,
      cid,
      priorCids,
      lifecycle: 'draft', // server layer promotes to 'live' after KeeperHub deployment
      workflowSpec: compilerOutput.workflowSpec as unknown as Record<string, unknown>,
      createdAt: Date.now(),
      evidenceBundleCid: cid,
    };

    return ok({ strategy, evidenceBundle, cid });
  }
}
