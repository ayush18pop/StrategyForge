import { Router } from 'express';
import type { StrategyVersion } from '@strategyforge/core';
import type { AppDeps } from '../factory.js';
import { normalizeWalletAddress } from '../lib/wallet-address.js';

export function createUsersRouter(deps: AppDeps): Router {
  const router = Router();

  router.get('/:wallet', (req, res) => {
    const wallet = normalizeWalletAddress(req.params.wallet);
    if (!wallet) {
      res.status(400).json({ error: 'Expected a valid EVM wallet address in the route parameter' });
      return;
    }

    const user = deps.localDb.touchUser(wallet);
    const families = deps.localDb.listFamiliesByWallet(wallet);
    const allAttestations = deps.localDb.listAttestationsByWallet(wallet);

    const versionCount = families.reduce((count, family) => count + family.versions.length, 0);
    const liveFamilyCount = families.filter((family) =>
      family.versions.some((version) => version.lifecycle === 'live'),
    ).length;
    const stepCounts = allAttestations.reduce<Record<'researcher' | 'strategist' | 'critic', number>>(
      (counts, attestation) => {
        counts[attestation.step] += 1;
        return counts;
      },
      { researcher: 0, strategist: 0, critic: 0 },
    );

    res.json({
      user,
      stats: {
        familyCount: families.length,
        liveFamilyCount,
        versionCount,
        attestationCount: allAttestations.length,
        anchoredAttestationCount: allAttestations.filter((attestation) => attestation.storageStatus === 'anchored').length,
        pendingAttestationCount: allAttestations.filter((attestation) => attestation.storageStatus === 'pending').length,
        stepCounts,
      },
      families: families.map((family) => {
        const latestVersion = latestVersionOf(family.versions);
        return {
          familyId: family.familyId,
          goal: family.goal,
          createdAt: family.createdAt,
          updatedAt: family.updatedAt,
          versionCount: family.versions.length,
          liveVersionCount: family.versions.filter((version) => version.lifecycle === 'live').length,
          latestVersion: latestVersion
            ? {
              version: latestVersion.version,
              lifecycle: latestVersion.lifecycle,
              createdAt: latestVersion.createdAt,
              cid: latestVersion.cid,
              evidenceBundleCid: latestVersion.evidenceBundleCid,
              keeperhubWorkflowId: latestVersion.keeperhubWorkflowId,
            }
            : null,
        };
      }),
      recentAttestations: allAttestations.slice(0, 12),
    });
  });

  return router;
}

function latestVersionOf(versions: StrategyVersion[]): StrategyVersion | null {
  return versions
    .slice()
    .sort((left, right) => right.version - left.version)[0] ?? null;
}
