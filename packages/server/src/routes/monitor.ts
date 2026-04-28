import { Router } from 'express';
import type { StrategyVersion, WorkflowSpec } from '@strategyforge/core';
import type { AppDeps } from '../factory.js';
import { syncFamilySummary } from '../lib/agent-metadata.js';
import { schedulePersistence } from '../lib/background-persistence.js';
import { recordReputation, updateBrain } from '../lib/contracts.js';
import { localFamilyToMetaRecord, syncLocalAttestations, syncLocalFamily } from '../lib/local-db-sync.js';
import { loadFamilyMeta, saveFamilyMeta, upsertStrategyVersion } from '../lib/kv-meta.js';
import { parseUpdateTrigger, parseWorkflowSpec } from '../lib/request-parsers.js';

export function createMonitorRouter(deps: AppDeps): Router {
  const router = Router();

  router.post('/', async (req, res) => {
    const body = req.body as Record<string, unknown> | null;
    const familyId = typeof body?.familyId === 'string' ? body.familyId : null;
    const trigger = parseUpdateTrigger(body);

    if (!familyId || !trigger) {
      res.status(400).json({ error: 'Expected body with familyId and a valid update trigger' });
      return;
    }

    const familyResult = await loadFamilyMetaWithLocalFallback(deps, familyId);
    if (!familyResult.ok) {
      res.status(500).json({ error: familyResult.error.message });
      return;
    }
    if (!familyResult.value) {
      res.status(404).json({ error: `Family ${familyId} not found` });
      return;
    }

    const pipelineResult = await deps.updateOrchestrator.update({ familyId, trigger });
    if (!pipelineResult.ok) {
      res.status(500).json({ error: pipelineResult.error.message });
      return;
    }

    let nextVersion = pipelineResult.value.strategy;
    const deployment = await deployStrategyVersion(deps, nextVersion);
    if (deployment.ok) {
      nextVersion = deployment.value;
    } else {
      console.warn(
        `[Monitor] KeeperHub deploy failed for ${familyId} v${nextVersion.version}: ${deployment.error.message}`,
      );
    }

    const nextFamily = {
      ...familyResult.value,
      versions: upsertStrategyVersion(familyResult.value.versions, nextVersion),
    };

    syncLocalFamily(deps.localDb, familyId, nextFamily);
    syncLocalAttestations(
      deps.localDb,
      familyResult.value.userWalletAddress,
      nextVersion,
      pipelineResult.value.evidenceBundle,
    );

    // Respond immediately
    res.json({
      familyId,
      trigger,
      strategy: nextVersion,
      deployment: {
        attempted: true,
        deployed: deployment.ok,
        ...(deployment.ok
          ? { workflowId: deployment.value.keeperhubWorkflowId }
          : { error: deployment.error.message }),
      },
    });

    // Fire persistence in the background
    schedulePersistence({
      label: familyId,
      tasks: [
        {
          name: 'kv_save',
          fn: () => saveFamilyMeta(deps.kvStore, familyId, nextFamily),
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
                familyId,
                goal: nextFamily.goal,
                versions: nextFamily.versions,
              },
            ),
        },
        ...(deployment.ok && deps.reputationLedgerAddress
          ? [
            {
              name: 'reputation_record',
              fn: async () => {
                try {
                  const evidenceCid = pipelineResult.value.cid;
                  const strategyTag = `${familyId}-v${nextVersion.version}`;
                  const result = await recordReputation(
                    deps.signer,
                    deps.reputationLedgerAddress!,
                    deps.agentId,
                    strategyTag,
                    10000, // 100% success on creation
                    evidenceCid,
                  );
                  console.log(`[Monitor] Reputation recorded on-chain: ${result.txHash}`);
                  return { ok: true as const };
                } catch (e) {
                  const error = e instanceof Error ? e : new Error(String(e));
                  console.warn(`[Monitor] Reputation recording failed:`, error.message);
                  return { ok: false as const, error };
                }
              },
            },
          ]
          : []),
        // ─── On-chain: update iNFT brain CID ────────────────────
        ...(deployment.ok && deps.inftAddress
          ? [
            {
              name: 'inft_brain_update',
              fn: async () => {
                try {
                  const evidenceCid = pipelineResult.value.cid;
                  const result = await updateBrain(
                    deps.signer,
                    deps.inftAddress!,
                    1,
                    evidenceCid,
                  );
                  console.log(`[Monitor] iNFT brain updated: ${result.txHash}`);
                  return { ok: true as const };
                } catch (e) {
                  const error = e instanceof Error ? e : new Error(String(e));
                  console.warn(`[Monitor] iNFT brain update failed:`, error.message);
                  return { ok: false as const, error };
                }
              },
            },
          ]
          : []),
      ],
    });
  });

  return router;
}

async function loadFamilyMetaWithLocalFallback(
  deps: AppDeps,
  familyId: string,
): Promise<{ ok: true; value: ReturnType<typeof localFamilyToMetaRecord> | null } | { ok: false; error: Error }> {
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

async function deployStrategyVersion(
  deps: AppDeps,
  version: StrategyVersion,
): Promise<{ ok: true; value: StrategyVersion } | { ok: false; error: Error }> {
  const workflowSpec = parseWorkflowSpec(version.workflowSpec);
  if (!workflowSpec) {
    return {
      ok: false,
      error: new Error(`Strategy version ${version.familyId} v${version.version} has invalid workflowSpec`),
    };
  }

  const deploymentResult = await deps.keeperhub.createWorkflow(workflowSpec as WorkflowSpec);
  if (!deploymentResult.ok) {
    return {
      ok: false,
      error: deploymentResult.error,
    };
  }

  const workflowId = deploymentResult.value.workflowId;
  if (deps.keeperhubPublishOnDeploy) {
    const publishResult = await deps.keeperhub.publishWorkflow({
      workflowId,
      pricePerRun: deps.keeperhubPricePerRun,
      paymentNetwork: deps.keeperhubPaymentNetwork,
    });
    if (!publishResult.ok) {
      console.warn(`[Monitor] publishWorkflow failed for ${workflowId}: ${publishResult.error.message}`);
    }
  }

  return {
    ok: true,
    value: {
      ...version,
      lifecycle: 'live',
      keeperhubWorkflowId: workflowId,
    },
  };
}
