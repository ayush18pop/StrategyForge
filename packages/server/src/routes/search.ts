import { Router } from 'express';
import type { RiskLevel } from '@strategyforge/core';
import type { AppDeps } from '../factory.js';
import {
  latestLiveVersion,
  loadAgentMetadata,
  matchesGoal,
  type SearchQuery,
} from '../lib/agent-metadata.js';

export function createSearchRouter(deps: AppDeps): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const metadataResult = await loadAgentMetadata({
      evidenceStore: deps.evidenceStore,
      agentRegistryAddress: deps.agentRegistryAddress,
      signer: deps.signer,
      agentId: deps.agentId,
    });

    if (!metadataResult.ok) {
      res.status(500).json({ error: metadataResult.error.message });
      return;
    }

    const query: SearchQuery = {
      asset: asString(req.query.asset),
      riskLevel: asRiskLevel(req.query.riskLevel),
      targetYield: asInteger(req.query.targetYield),
      chains: asChains(req.query.chains),
    };

    const matches = metadataResult.value.families
      .map((family) => {
        const latest = latestLiveVersion(family);
        if (!latest || !matchesGoal(family, query)) {
          return null;
        }

        return {
          familyId: family.familyId,
          goal: family.goal,
          versionCount: family.versions.length,
          latestVersionCid: latest.cid,
          latestVersion: latest,
        };
      })
      .filter((family): family is NonNullable<typeof family> => family !== null);

    res.json({
      matches,
      total: matches.length,
    });
  });

  return router;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asRiskLevel(value: unknown): RiskLevel | undefined {
  return value === 'balanced' || value === 'conservative' ? value : undefined;
}

function asInteger(value: unknown): number | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function asChains(value: unknown): string[] | undefined {
  if (typeof value !== 'string' || value.length === 0) {
    return undefined;
  }

  const chains = value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return chains.length > 0 ? chains : undefined;
}
