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
    const { goal, familyId, priorCids, priorVersions, actualOutcomes, triggerReason } = input;

    // Step 0 — Fetch ActionSchemas from KeeperHub
    const schemasResult = await this.deps.keeperhub.listActionSchemas();
    const actionSchemas: ActionSchema[] = schemasResult.ok ? schemasResult.value : [];
    if (actionSchemas.length === 0) {
      console.warn('[PipelineOrchestrator] listActionSchemas returned empty. Using fallback mechanics.');
    }

    // Step 1 — Discovery: parse available action schemas
    const researcherResult = await this.deps.researcher.run({
      goal,
      priorVersions,
      actualOutcomes,
      triggerReason,
      actionSchemas,
    });
    if (!researcherResult.ok) return err(new Error(`Researcher failed: ${researcherResult.error.message}`));
    const researcherOutput: ResearcherOutput = researcherResult.value;

    // Step 2 — Strategist: Candidate workflow generation
    const strategistResult = await this.deps.strategist.run({
      researcherOutput,
      priorVersions,
      goal,
      actionSchemas,
    });
    if (!strategistResult.ok) return err(new Error(`Strategist failed: ${strategistResult.error.message}`));
    const strategistOutput: StrategistOutput = strategistResult.value;

    // Step 3 — Critic: Bounds check + candidate selection + logic rule update
    const criticResult = await this.deps.critic.run({
      candidates: strategistOutput.candidates,
      logicNodes: researcherOutput.logicNodes,
      priorFailures: priorVersions.filter(v => v.outcomes?.finalStatus === 'underperformed' || v.outcomes?.finalStatus === 'emergency_stopped'),
      snapshot: researcherOutput.snapshot,
      goal,
    });
    if (!criticResult.ok) return err(new Error(`Critic failed: ${criticResult.error.message}`));
    const criticOutput: CriticOutput = criticResult.value;

    // Step 4 — Compiler: deterministic WorkflowSpec + gas estimate
    let compilerOutput: CompilerOutput;
    try {
      compilerOutput = this.deps.compiler.compile({
        selectedCandidate: criticOutput.selectedCandidate,
        constraints: criticOutput.constraints,
        goal,
      });
    } catch (e) {
      return err(new Error(`Compiler failed: ${e instanceof Error ? e.message : String(e)}`));
    }

    // Step 5 — Risk Validator: hard rule checks
    const validationResult: ValidationResult = this.deps.riskValidator.validate(
      compilerOutput.workflowSpec,
      criticOutput.selectedCandidate,
      goal.amount,
    );
    if (!validationResult.passed) {
      return err(new Error(`Risk validation failed:\n${validationResult.violations.join('\n')}`));
    }

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
            logicNodes: unknown[];
            signals: { protocol: string; signal: string; severity: 'low' | 'medium' | 'high' }[];
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
            updatedLogicNodes: unknown[];
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

    // Step 8 — Write EvidenceBundle to 0G Storage
    const writeResult = await this.deps.evidenceStore.writeBundle(evidenceBundle);
    if (!writeResult.ok) return err(new Error(`Storage write failed: ${writeResult.error.message}`));
    const cid = writeResult.value.cid;

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
