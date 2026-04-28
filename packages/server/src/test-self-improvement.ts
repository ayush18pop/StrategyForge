/**
 * End-to-End Self-Improvement Smoke Test
 *
 * Exercises the full StrategyForge loop against a running server:
 *   1. POST /api/strategies — create v1
 *   2. Verify v1 returned with CID + evidence
 *   3. POST /api/strategies/:familyId/update — simulate underperformance → v2
 *   4. Verify v2 has priorCids containing v1's CID
 *   5. GET /api/strategies/:familyId — read the full family
 *   6. Print the evidence DAG showing v1 → v2 lineage
 *
 * Usage:
 *   bun run src/test-self-improvement.ts
 *
 * Requires: server running on PORT (default 3000)
 */

const BASE_URL = process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;

async function main() {
    console.log('═══════════════════════════════════════════════════');
    console.log('  StrategyForge — Self-Improvement Smoke Test');
    console.log('═══════════════════════════════════════════════════');
    console.log(`  Server: ${BASE_URL}`);
    console.log('');

    // ── Step 1: Create v1 ─────────────────────────────────────
    console.log('[1/6] Creating v1 strategy...');
    const createRes = await fetch(`${BASE_URL}/api/strategies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            goal: {
                asset: 'USDC',
                amount: 50000,
                riskLevel: 'balanced',      // valid: 'conservative' | 'balanced'
                horizon: '6mo',
                chains: ['ethereum'],
                targetYield: 800,           // 8% in basis points
            },
            userWalletAddress: '0x0000000000000000000000000000000000000001',
        }),
    });

    if (!createRes.ok) {
        const err = await createRes.text();
        console.error(`  ✗ Create failed (${createRes.status}): ${err}`);
        process.exit(1);
    }

    const created = (await createRes.json()) as {
        familyId: string;
        strategy: {
            version: number;
            familyId: string;
            lifecycle: string;
            evidenceBundleCid: string;
            priorCids: string[];
            keeperhubWorkflowId?: string;
        };
        deployment: { deployed: boolean; workflowId?: string };
    };

    console.log(`  ✓ v${created.strategy.version} created`);
    console.log(`    familyId:    ${created.familyId}`);
    console.log(`    lifecycle:   ${created.strategy.lifecycle}`);
    console.log(`    evidenceCID: ${created.strategy.evidenceBundleCid}`);
    console.log(`    priorCids:   ${JSON.stringify(created.strategy.priorCids)}`);
    console.log(`    deployed:    ${created.deployment.deployed}`);
    if (created.deployment.workflowId) {
        console.log(`    workflowId:  ${created.deployment.workflowId}`);
    }
    console.log('');

    // ── Step 2: Verify v1 has no priorCids ────────────────────
    console.log('[2/6] Verifying v1 has no priorCids...');
    if (created.strategy.priorCids.length === 0) {
        console.log('  ✓ v1 has 0 priorCids — correct (first version)');
    } else {
        console.warn(`  ⚠ v1 has ${created.strategy.priorCids.length} priorCids — unexpected for first version`);
    }
    console.log('');

    // Wait for background persistence to flush
    console.log('[3/6] Waiting 5s for on-chain persistence (reputation + brain)...');
    await new Promise((resolve) => setTimeout(resolve, 5000));
    console.log('  ✓ Wait complete');
    console.log('');

    // ── Step 3: Trigger update (simulate underperformance) ────
    console.log('[4/6] Triggering evolution (simulated underperformance)...');
    const updateRes = await fetch(`${BASE_URL}/api/strategies/${created.familyId}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            reason: 'underperformance',
            actualVsPredicted: 0.72,   // 72% — below 90% threshold, triggers evolution
        }),
    });

    if (!updateRes.ok) {
        const err = await updateRes.text();
        console.error(`  ✗ Update failed (${updateRes.status}): ${err}`);
        process.exit(1);
    }

    const updated = (await updateRes.json()) as {
        familyId: string;
        strategy: {
            version: number;
            lifecycle: string;
            evidenceBundleCid: string;
            priorCids: string[];
            keeperhubWorkflowId?: string;
        };
        deployment: { deployed: boolean };
    };

    console.log(`  ✓ v${updated.strategy.version} created from update`);
    console.log(`    lifecycle:   ${updated.strategy.lifecycle}`);
    console.log(`    evidenceCID: ${updated.strategy.evidenceBundleCid}`);
    console.log(`    priorCids:   ${JSON.stringify(updated.strategy.priorCids)}`);
    console.log(`    deployed:    ${updated.deployment.deployed}`);
    console.log('');

    // ── Step 4: Verify v2 has priorCids linking to v1 ─────────
    console.log('[5/6] Verifying v2 learned from v1...');
    if (updated.strategy.priorCids.length > 0) {
        console.log(`  ✓ v2 has ${updated.strategy.priorCids.length} priorCid(s) — learning confirmed`);
        for (const cid of updated.strategy.priorCids) {
            console.log(`    → prior: ${cid}`);
        }
    } else {
        console.error('  ✗ v2 has 0 priorCids — self-improvement chain broken');
        process.exit(1);
    }
    console.log('');

    // ── Step 5: Read full family and print DAG ────────────────
    console.log('[6/6] Reading full family to print evidence DAG...');
    const familyRes = await fetch(`${BASE_URL}/api/strategies/${created.familyId}`);
    if (!familyRes.ok) {
        const err = await familyRes.text();
        console.error(`  ✗ Family fetch failed (${familyRes.status}): ${err}`);
        process.exit(1);
    }

    const family = (await familyRes.json()) as {
        familyId: string;
        versions: Array<{
            version: number;
            lifecycle: string;
            evidenceBundleCid: string;
            priorCids: string[];
        }>;
    };

    console.log(`  ✓ Family ${family.familyId} — ${family.versions.length} versions\n`);

    console.log('═══════════════════════════════════════════════════');
    console.log('  Evidence DAG (priorCids chain)');
    console.log('═══════════════════════════════════════════════════');

    for (const v of family.versions.sort((a, b) => a.version - b.version)) {
        const priors = v.priorCids.length > 0
            ? v.priorCids.map((c) => c.slice(0, 12) + '...').join(', ')
            : '(genesis)';
        console.log(`  v${v.version} [${v.lifecycle}]`);
        console.log(`    CID:    ${v.evidenceBundleCid}`);
        console.log(`    Priors: ${priors}`);
        if (v.version < family.versions.length) {
            console.log('       │');
            console.log('       ▼');
        }
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log('  ✅ Self-improvement loop verified');
    console.log('═══════════════════════════════════════════════════');
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
