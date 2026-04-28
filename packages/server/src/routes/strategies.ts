import { Router } from 'express';
import type { StrategyVersion, WorkflowSpec } from '@strategyforge/core';
import { buildMigrationWorkflow } from '@strategyforge/pipeline';
import type { AppDeps } from '../factory.js';
import { syncFamilySummary } from '../lib/agent-metadata.js';
import { schedulePersistence } from '../lib/background-persistence.js';
import { recordReputation, updateBrain } from '../lib/contracts.js';
import {
  localFamilyToMetaRecord,
  syncLocalAttestations,
  syncLocalFamily,
} from '../lib/local-db-sync.js';
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

    syncLocalFamily(deps.localDb, strategy.familyId, familyMeta);
    syncLocalAttestations(
      deps.localDb,
      familyMeta.userWalletAddress,
      strategy,
      pipelineResult.value.evidenceBundle,
    );

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

  router.get('/:familyId/telemetry', async (req, res) => {
    try {
      const telemetry = await deps.strategyTelemetryService.getBootstrap(req.params.familyId);
      res.json(telemetry);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = message.toLowerCase().includes('not found') ? 404 : 502;
      res.status(status).json({ error: message });
    }
  });

  router.get('/:familyId', async (req, res) => {
    const familyResult = await loadFamilyMetaWithLocalFallback(deps, req.params.familyId);
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
    const familyResult = await loadFamilyMetaWithLocalFallback(deps, req.params.familyId);
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

    syncLocalFamily(deps.localDb, req.params.familyId, nextFamily);

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

    const familyResult = await loadFamilyMetaWithLocalFallback(deps, req.params.familyId);
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

    syncLocalFamily(deps.localDb, req.params.familyId, nextFamily);
    syncLocalAttestations(
      deps.localDb,
      familyResult.value.userWalletAddress,
      strategy,
      pipelineResult.value.evidenceBundle,
    );

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

  // GET /:familyId/subscription-info
  // Returns payment details for subscribing to this strategy (access fee + deposit address).
  router.get('/:familyId/subscription-info', async (req, res) => {
    const familyResult = await loadFamilyMetaWithLocalFallback(deps, req.params.familyId);
    if (!familyResult.ok || !familyResult.value) {
      res.status(404).json({ error: `Family ${req.params.familyId} not found` });
      return;
    }

    const liveVersion = familyResult.value.versions
      .filter((v) => v.lifecycle === 'live')
      .sort((a, b) => b.version - a.version)[0];

    res.json({
      familyId: req.params.familyId,
      asset: familyResult.value.goal.asset,
      principalAmount: familyResult.value.goal.amount,
      accessFeeAmount: deps.accessFeeAmount,
      accessFeeRecipient: deps.accessFeeRecipient,
      accessFeeNetwork: 'base',
      accessFeeCurrency: 'USDC',
      turnkeyWallet: deps.turnkeyWallet,
      keeperhubWorkflowId: liveVersion?.keeperhubWorkflowId ?? null,
    });
  });

  // POST /:familyId/subscribe
  // Records a user's deposit intent after they've signed the x402 access fee payment.
  router.post('/:familyId/subscribe', async (req, res) => {
    const { depositorAddress, expectedAmount } = (req.body ?? {}) as {
      depositorAddress?: unknown;
      expectedAmount?: unknown;
    };

    if (typeof depositorAddress !== 'string' || !depositorAddress.startsWith('0x')) {
      res.status(400).json({ error: 'Expected depositorAddress (0x...)' });
      return;
    }

    const familyResult = await loadFamilyMetaWithLocalFallback(deps, req.params.familyId);
    if (!familyResult.ok || !familyResult.value) {
      res.status(404).json({ error: `Family ${req.params.familyId} not found` });
      return;
    }

    const amount = typeof expectedAmount === 'number' ? expectedAmount : familyResult.value.goal.amount;
    const record = {
      userAddress: depositorAddress,
      workflowId: req.params.familyId,
      amount,
      depositedAt: Date.now(),
      status: 'pending',
    };

    // Best-effort KV write — don't block response
    void deps.kvStore.set(
      `deposit:${depositorAddress}:${req.params.familyId}`,
      JSON.stringify(record),
    ).catch((err: Error) => {
      console.warn(`[Strategies] deposit KV write failed: ${err.message}`);
    });

    console.log(`[Strategies] Subscribe: ${depositorAddress} → ${req.params.familyId}, amount: ${amount}`);

    res.json({
      familyId: req.params.familyId,
      depositorAddress,
      turnkeyWallet: deps.turnkeyWallet,
      asset: familyResult.value.goal.asset,
      expectedAmount: amount,
      subscribedAt: Date.now(),
    });
  });

  // POST /:familyId/migrate
  // Builds a one-shot migration workflow that unwinds v(n) and re-deploys into v(n+1).
  // Creates + immediately runs the workflow in KeeperHub.
  router.post('/:familyId/migrate', async (req, res) => {
    const familyResult = await loadFamilyMetaWithLocalFallback(deps, req.params.familyId);
    if (!familyResult.ok) {
      res.status(500).json({ error: familyResult.error.message });
      return;
    }
    if (!familyResult.value) {
      res.status(404).json({ error: `Family ${req.params.familyId} not found` });
      return;
    }

    const versions = familyResult.value.versions
      .slice()
      .sort((a, b) => a.version - b.version);

    // Need at least two versions: the live one to unwind and the target to deploy.
    const fromVersion = versions.filter((v) => v.lifecycle === 'live').at(-1);
    const toVersion = versions.at(-1);

    if (!fromVersion || !toVersion || fromVersion.version === toVersion.version) {
      res.status(400).json({ error: 'Migration requires a live version to unwind and a newer target version' });
      return;
    }

    const v1Spec = parseWorkflowSpec(fromVersion.workflowSpec);
    const v2Spec = parseWorkflowSpec(toVersion.workflowSpec);
    if (!v1Spec || !v2Spec) {
      res.status(400).json({ error: 'One or both versions have invalid workflowSpec' });
      return;
    }

    const migration = buildMigrationWorkflow(
      v1Spec as WorkflowSpec,
      v2Spec as WorkflowSpec,
      req.params.familyId,
      fromVersion.version,
      toVersion.version,
    );

    if (!migration) {
      res.status(400).json({ error: `v${fromVersion.version} has no recognizable supply positions to unwind` });
      return;
    }

    // Create the migration workflow in KeeperHub.
    const createResult = await deps.keeperhub.createWorkflow(migration.spec as WorkflowSpec);
    if (!createResult.ok) {
      res.status(502).json({ error: `KeeperHub createWorkflow failed: ${createResult.error.message}` });
      return;
    }

    const migrationWorkflowId = createResult.value.workflowId;

    // Trigger immediately — this is a one-shot manual workflow.
    const runResult = await deps.keeperhub.runWorkflow(migrationWorkflowId);
    if (!runResult.ok) {
      // Created but failed to trigger — still return the workflow ID so the user can trigger manually.
      res.status(207).json({
        migrationWorkflowId,
        executionId: null,
        warning: `Workflow created but auto-trigger failed: ${runResult.error.message}. Trigger manually via KeeperHub.`,
        withdraws: migration.withdrawNodeCount,
        deposits: migration.depositNodeCount,
        from: { version: fromVersion.version, workflowId: fromVersion.keeperhubWorkflowId },
        to: { version: toVersion.version, workflowId: toVersion.keeperhubWorkflowId },
      });
      return;
    }

    console.log(`[Strategies] Migration ${req.params.familyId} v${fromVersion.version}→v${toVersion.version}: workflow ${migrationWorkflowId}, execution ${runResult.value.executionId}`);

    res.json({
      migrationWorkflowId,
      executionId: runResult.value.executionId,
      withdraws: migration.withdrawNodeCount,
      deposits: migration.depositNodeCount,
      from: { version: fromVersion.version, workflowId: fromVersion.keeperhubWorkflowId },
      to: { version: toVersion.version, workflowId: toVersion.keeperhubWorkflowId },
    });
  });

  return router;
}

async function loadFamilyMetaWithLocalFallback(
  deps: AppDeps,
  familyId: string,
): Promise<{ ok: true; value: FamilyMetaRecord | null } | { ok: false; error: Error }> {
  const localRecord = deps.localDb.getFamily(familyId);
  if (localRecord) {
    return {
      ok: true,
      value: localFamilyToMetaRecord(localRecord),
    };
  }

  const familyResult = await loadFamilyMeta(deps.kvStore, familyId);
  if (familyResult.ok && familyResult.value) {
    syncLocalFamily(deps.localDb, familyId, familyResult.value);
  }
  return familyResult;
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
