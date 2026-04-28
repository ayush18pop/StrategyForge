import { Router } from 'express';
import type { StrategyVersion, WorkflowSpec } from '@strategyforge/core';
import type { AppDeps } from '../factory.js';
import { syncFamilySummary } from '../lib/agent-metadata.js';
import { schedulePersistence } from '../lib/background-persistence.js';
import { recordReputation, updateBrain } from '../lib/contracts.js';
import {
  appendPipelineRunEvent,
  createPipelineRun,
  getPipelineRunEvents,
  hasPipelineRun,
  subscribePipelineRun,
} from '../lib/pipeline-runs.js';
import {
  loadFamilyMeta,
  registerFamilyId,
  saveFamilyMeta,
  upsertStrategyVersion,
  type FamilyMetaRecord,
} from '../lib/kv-meta.js';
import {
  parseCreateBody,
  parseUpdateTrigger,
  parseWorkflowSpec,
} from '../lib/request-parsers.js';

export function createStrategiesRouter(deps: AppDeps): Router {
  const router = Router();

  router.post('/runs', (_req, res) => {
    const runId = createPipelineRun();
    res.status(201).json({ runId });
  });

  router.get('/runs/:runId/stream', (req, res) => {
    const { runId } = req.params;
    if (!hasPipelineRun(runId)) {
      res.status(404).json({ error: 'Unknown runId' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const writeEvent = (event: unknown) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    getPipelineRunEvents(runId).forEach(writeEvent);
    const unsubscribe = subscribePipelineRun(runId, writeEvent);

    req.on('close', () => {
      unsubscribe();
    });
  });

  router.post('/', async (req, res) => {
    const parsed = parseCreateBody(req.body);
    if (!parsed) {
      res.status(400).json({ error: 'Expected { goal, userWalletAddress } with a valid StrategyGoal' });
      return;
    }

    const runId = typeof (req.body as { runId?: unknown } | null)?.runId === 'string'
      ? (req.body as { runId: string }).runId
      : null;

    if (runId) {
      appendPipelineRunEvent(runId, {
        stage: 'request_received',
        status: 'start',
        message: 'Strategy creation request received',
      });
      appendPipelineRunEvent(runId, {
        stage: 'pipeline_started',
        status: 'start',
        message: 'Starting pipeline orchestrator',
      });
    }

    const pipelineResult = await deps.createOrchestrator.create(parsed.goal, {
      onStep: runId
        ? (step, status, message) => {
          appendPipelineRunEvent(runId, {
            stage: step as Parameters<typeof appendPipelineRunEvent>[1]['stage'],
            status,
            message,
          });
        }
        : undefined,
    });
    if (!pipelineResult.ok) {
      if (runId) {
        appendPipelineRunEvent(runId, {
          stage: 'failed',
          status: 'error',
          message: pipelineResult.error.message,
        });
      }
      res.status(500).json({ error: pipelineResult.error.message });
      return;
    }
    if (runId) {
      appendPipelineRunEvent(runId, {
        stage: 'pipeline_completed',
        status: 'done',
        message: 'Pipeline completed successfully',
      });
    }

    let strategy = pipelineResult.value.strategy;
    if (runId) {
      appendPipelineRunEvent(runId, {
        stage: 'deployment',
        status: 'start',
        message: 'Deploying strategy workflow to KeeperHub',
      });
    }
    const deployment = await deployStrategyVersion(deps, strategy);
    if (deployment.ok) {
      strategy = deployment.value;
      if (runId) {
        appendPipelineRunEvent(runId, {
          stage: 'deployment',
          status: 'done',
          message: `Workflow deployed: ${strategy.keeperhubWorkflowId ?? 'unknown id'}`,
        });
      }
    } else {
      console.warn(
        `[Strategies] KeeperHub deploy failed for ${strategy.familyId} v${strategy.version}: ${deployment.error.message}`,
      );
      if (runId) {
        appendPipelineRunEvent(runId, {
          stage: 'deployment',
          status: 'error',
          message: deployment.error.message,
        });
      }
    }

    const familyMeta: FamilyMetaRecord = {
      goal: parsed.goal,
      userWalletAddress: parsed.userWalletAddress,
      versions: [strategy],
      createdAt: Date.now(),
    };

    res.status(201).json({
      familyId: strategy.familyId,
      goal: familyMeta.goal,
      userWalletAddress: familyMeta.userWalletAddress,
      strategy,
      deployment: {
        attempted: true,
        deployed: deployment.ok,
        ...(deployment.ok
          ? { workflowId: deployment.value.keeperhubWorkflowId }
          : { error: deployment.error.message }),
      },
    });

    // Fire persistence in the background — never block the response.
    const evidenceCid = pipelineResult.value.cid;
    const strategyTag = `${strategy.familyId}-v${strategy.version}`;
    schedulePersistence({
      label: strategy.familyId,
      runId,
      tasks: [
        {
          name: 'kv_save',
          fn: () => saveFamilyMeta(deps.kvStore, strategy.familyId, familyMeta),
        },
        {
          name: 'family_index',
          fn: () => registerFamilyId(deps.kvStore, strategy.familyId),
        },
        {
          name: 'metadata_sync',
          fn: () =>
            syncFamilySummary(
              {
                evidenceStore: deps.evidenceStore,
                agentRegistryAddress: deps.agentRegistryAddress,
                signer: deps.signer,
                agentId: deps.agentId,
              },
              {
                familyId: strategy.familyId,
                goal: familyMeta.goal,
                versions: familyMeta.versions,
              },
            ),
        },
        // ─── On-chain: record reputation ────────────────────────
        ...(deps.reputationLedgerAddress
          ? [{
            name: 'reputation_record',
            fn: async () => {
              try {
                const result = await recordReputation(
                  deps.signer, deps.reputationLedgerAddress!, deps.agentId,
                  strategyTag, 10000, evidenceCid,
                );
                console.log(`[Strategies] Reputation recorded: ${result.txHash}`);
                return { ok: true as const };
              } catch (e) {
                const error = e instanceof Error ? e : new Error(String(e));
                console.warn(`[Strategies] Reputation recording failed:`, error.message);
                return { ok: false as const, error };
              }
            },
          }]
          : []),
        // ─── On-chain: update iNFT brain CID ────────────────────
        ...(deps.inftAddress
          ? [{
            name: 'inft_brain_update',
            fn: async () => {
              try {
                const result = await updateBrain(
                  deps.signer, deps.inftAddress!, 1, evidenceCid,
                );
                console.log(`[Strategies] iNFT brain updated: ${result.txHash}`);
                return { ok: true as const };
              } catch (e) {
                const error = e instanceof Error ? e : new Error(String(e));
                console.warn(`[Strategies] iNFT brain update failed:`, error.message);
                return { ok: false as const, error };
              }
            },
          }]
          : []),
      ],
    });
  });

  router.get('/:familyId', async (req, res) => {
    const familyResult = await loadFamilyMeta(deps.kvStore, req.params.familyId);
    if (!familyResult.ok) {
      console.warn(`[Strategies] KV load failed for ${req.params.familyId}: ${familyResult.error.message}`);
      res.status(404).json({ error: `Family ${req.params.familyId} not found (KV unavailable)` });
      return;
    }
    if (!familyResult.value) {
      res.status(404).json({ error: `Family ${req.params.familyId} not found` });
      return;
    }

    res.json({
      familyId: req.params.familyId,
      goal: familyResult.value.goal,
      userWalletAddress: familyResult.value.userWalletAddress,
      versions: familyResult.value.versions,
      createdAt: familyResult.value.createdAt,
    });
  });

  router.post('/:familyId/deploy', async (req, res) => {
    const familyResult = await loadFamilyMeta(deps.kvStore, req.params.familyId);
    if (!familyResult.ok) {
      res.status(500).json({ error: familyResult.error.message });
      return;
    }
    if (!familyResult.value) {
      res.status(404).json({ error: `Family ${req.params.familyId} not found` });
      return;
    }

    const draftVersion = findLatestDraftVersion(familyResult.value.versions);
    if (!draftVersion) {
      res.status(400).json({ error: `Family ${req.params.familyId} has no draft version to deploy` });
      return;
    }

    const deployment = await deployStrategyVersion(deps, draftVersion);
    if (!deployment.ok) {
      res.status(502).json({ error: deployment.error.message });
      return;
    }

    const nextFamily: FamilyMetaRecord = {
      ...familyResult.value,
      versions: upsertStrategyVersion(familyResult.value.versions, deployment.value),
    };

    res.json({
      familyId: req.params.familyId,
      strategy: deployment.value,
      workflowId: deployment.value.keeperhubWorkflowId,
    });

    // Background persistence
    schedulePersistence({
      label: req.params.familyId,
      tasks: [
        {
          name: 'kv_save',
          fn: () => saveFamilyMeta(deps.kvStore, req.params.familyId, nextFamily),
        },
        {
          name: 'metadata_sync',
          fn: () =>
            syncFamilySummary(
              {
                evidenceStore: deps.evidenceStore,
                agentRegistryAddress: deps.agentRegistryAddress,
                signer: deps.signer,
                agentId: deps.agentId,
              },
              {
                familyId: req.params.familyId,
                goal: nextFamily.goal,
                versions: nextFamily.versions,
              },
            ),
        },
      ],
    });
  });

  router.post('/:familyId/update', async (req, res) => {
    const trigger = parseUpdateTrigger(req.body);
    if (!trigger) {
      res.status(400).json({ error: 'Expected a valid update trigger in the request body' });
      return;
    }

    const familyResult = await loadFamilyMeta(deps.kvStore, req.params.familyId);
    if (!familyResult.ok) {
      res.status(500).json({ error: familyResult.error.message });
      return;
    }
    if (!familyResult.value) {
      res.status(404).json({ error: `Family ${req.params.familyId} not found` });
      return;
    }

    const pipelineResult = await deps.updateOrchestrator.update({
      familyId: req.params.familyId,
      trigger,
    });
    if (!pipelineResult.ok) {
      res.status(500).json({ error: pipelineResult.error.message });
      return;
    }

    let strategy = pipelineResult.value.strategy;
    const deployment = await deployStrategyVersion(deps, strategy);
    if (deployment.ok) {
      strategy = deployment.value;
    } else {
      console.warn(
        `[Strategies] KeeperHub deploy failed for ${strategy.familyId} v${strategy.version}: ${deployment.error.message}`,
      );
    }

    const nextFamily: FamilyMetaRecord = {
      ...familyResult.value,
      versions: upsertStrategyVersion(familyResult.value.versions, strategy),
    };

    res.status(201).json({
      familyId: req.params.familyId,
      trigger,
      strategy,
      deployment: {
        attempted: true,
        deployed: deployment.ok,
        ...(deployment.ok
          ? { workflowId: deployment.value.keeperhubWorkflowId }
          : { error: deployment.error.message }),
      },
    });

    // Background persistence
    const updateEvidenceCid = pipelineResult.value.cid;
    const updateTag = `${req.params.familyId}-v${strategy.version}`;
    schedulePersistence({
      label: req.params.familyId,
      tasks: [
        {
          name: 'kv_save',
          fn: () => saveFamilyMeta(deps.kvStore, req.params.familyId, nextFamily),
        },
        {
          name: 'metadata_sync',
          fn: () =>
            syncFamilySummary(
              {
                evidenceStore: deps.evidenceStore,
                agentRegistryAddress: deps.agentRegistryAddress,
                signer: deps.signer,
                agentId: deps.agentId,
              },
              {
                familyId: req.params.familyId,
                goal: nextFamily.goal,
                versions: nextFamily.versions,
              },
            ),
        },
        // ─── On-chain: record reputation ────────────────────────
        ...(deps.reputationLedgerAddress
          ? [{
            name: 'reputation_record',
            fn: async () => {
              try {
                const result = await recordReputation(
                  deps.signer, deps.reputationLedgerAddress!, deps.agentId,
                  updateTag, 10000, updateEvidenceCid,
                );
                console.log(`[Strategies] Reputation recorded (update): ${result.txHash}`);
                return { ok: true as const };
              } catch (e) {
                const error = e instanceof Error ? e : new Error(String(e));
                console.warn(`[Strategies] Reputation recording failed:`, error.message);
                return { ok: false as const, error };
              }
            },
          }]
          : []),
        // ─── On-chain: update iNFT brain CID ────────────────────
        ...(deps.inftAddress
          ? [{
            name: 'inft_brain_update',
            fn: async () => {
              try {
                const result = await updateBrain(
                  deps.signer, deps.inftAddress!, 1, updateEvidenceCid,
                );
                console.log(`[Strategies] iNFT brain updated (update): ${result.txHash}`);
                return { ok: true as const };
              } catch (e) {
                const error = e instanceof Error ? e : new Error(String(e));
                console.warn(`[Strategies] iNFT brain update failed:`, error.message);
                return { ok: false as const, error };
              }
            },
          }]
          : []),
      ],
    });
  });

  return router;
}

function findLatestDraftVersion(versions: StrategyVersion[]): StrategyVersion | undefined {
  return versions
    .filter((version) => version.lifecycle === 'draft')
    .sort((left, right) => right.version - left.version)[0];
}

async function deployStrategyVersion(
  deps: AppDeps,
  strategy: StrategyVersion,
): Promise<{ ok: true; value: StrategyVersion } | { ok: false; error: Error }> {
  const workflowSpec = parseWorkflowSpec(strategy.workflowSpec);
  if (!workflowSpec) {
    return {
      ok: false,
      error: new Error(`Strategy version ${strategy.familyId} v${strategy.version} has invalid workflowSpec`),
    };
  }

  const createResult = await deps.keeperhub.createWorkflow(workflowSpec as WorkflowSpec);
  if (!createResult.ok) {
    return {
      ok: false,
      error: createResult.error,
    };
  }

  const workflowId = createResult.value.workflowId;
  if (deps.keeperhubPublishOnDeploy) {
    const publishResult = await deps.keeperhub.publishWorkflow({
      workflowId,
      pricePerRun: deps.keeperhubPricePerRun,
      paymentNetwork: deps.keeperhubPaymentNetwork,
    });
    if (!publishResult.ok) {
      console.warn(`[Strategies] publishWorkflow failed for ${workflowId}: ${publishResult.error.message}`);
    }
  }

  return {
    ok: true,
    value: {
      ...strategy,
      lifecycle: 'live',
      keeperhubWorkflowId: workflowId,
    },
  };
}
