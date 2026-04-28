import { Router } from 'express';
import type { RiskLevel, StrategyGoal } from '@strategyforge/core';
import type { AppDeps } from '../factory.js';
import type { FamilyRecord } from '../lib/local-store.js';
import { latestLiveVersion } from '../lib/agent-metadata.js';

export function createSearchRouter(deps: AppDeps): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    const query: SearchQuery = {
      asset: asString(_req.query.asset),
      riskLevel: asRiskLevel(_req.query.riskLevel),
      targetYield: asInteger(_req.query.targetYield),
      chains: asChains(_req.query.chains),
    };

    // Read from SQLite — instant, reliable, single source of truth.
    const allFamilies = deps.localDb.listFamilies();

    const matches = allFamilies
      .filter((family) => matchesFamilyGoal(family, query))
      .map((family) => {
        const latest = latestLiveVersionFromRecord(family);
        if (!latest) return null;

        return {
          familyId: family.familyId,
          goal: family.goal,
          versionCount: family.versions.length,
          latestVersionCid: latest.cid,
          latestVersion: latest,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    res.json({
      matches,
      total: matches.length,
    });
  });

  return router;
}

// ─── Helpers ──────────────────────────────────────────────────────────

interface SearchQuery {
  asset?: string;
  riskLevel?: RiskLevel;
  targetYield?: number;
  chains?: string[];
}

function matchesFamilyGoal(family: FamilyRecord, query: SearchQuery): boolean {
  const goal = family.goal;

  if (query.asset && goal.asset.toLowerCase() !== query.asset.toLowerCase()) {
    return false;
  }
  if (query.riskLevel && goal.riskLevel !== query.riskLevel) {
    return false;
  }
  if (
    query.chains &&
    query.chains.length > 0 &&
    !query.chains.some((chain) =>
      goal.chains.some((goalChain) => goalChain.toLowerCase() === chain.toLowerCase()),
    )
  ) {
    return false;
  }
  if (typeof query.targetYield === 'number') {
    const delta = Math.abs(goal.targetYield - query.targetYield);
    if (delta > 200) return false;
  }
  return true;
}

function latestLiveVersionFromRecord(family: FamilyRecord) {
  return family.versions
    .filter((v) => v.lifecycle === 'live')
    .sort((a, b) => b.version - a.version)[0] ?? null;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asRiskLevel(value: unknown): RiskLevel | undefined {
  return value === 'balanced' || value === 'conservative' ? value : undefined;
}

function asInteger(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function asChains(value: unknown): string[] | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  const chains = value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return chains.length > 0 ? chains : undefined;
}
