/**
 * Backfill on-chain registration for existing strategies that were created
 * before the AgentRegistry integration was wired up.
 * 
 * Usage:
 *   npx tsx scripts/backfill-onchain.ts
 * 
 * What it does:
 *   1. Finds all strategies with no onChainAgentId
 *   2. Groups them by familyId (only the latest version per family needs registration)
 *   3. Registers each family on AgentRegistry
 *   4. Records an initial reputation entry on ReputationLedger
 *   5. Updates the MongoDB documents with the on-chain data
 */

import 'dotenv/config';
import mongoose from 'mongoose';

// We need to import the models after dotenv loads
async function main() {
    console.log('═══════════════════════════════════════════════════');
    console.log('  StrategyForge — Backfill On-Chain Registration');
    console.log('═══════════════════════════════════════════════════\n');

    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) { console.error('❌ MONGODB_URI not set'); process.exit(1); }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Import models after connection
    const { Strategy } = await import('../lib/db/strategy.model');
    const { registryRegister, ledgerRecord } = await import('../lib/contracts');

    // Find strategies without on-chain registration
    const unregistered = await Strategy.find({ onChainAgentId: null }).sort({ createdAt: 1 });
    console.log(`Found ${unregistered.length} strategies without on-chain registration\n`);

    if (unregistered.length === 0) {
        console.log('Nothing to backfill — all strategies are registered!');
        await mongoose.disconnect();
        return;
    }

    // Group by familyId — only register each family once
    const families = new Map<string, any[]>();
    for (const s of unregistered) {
        const fam = families.get(s.familyId) || [];
        fam.push(s);
        families.set(s.familyId, fam);
    }

    console.log(`${families.size} unique families to register\n`);

    let registered = 0;
    let failed = 0;

    for (const [familyId, strategies] of families) {
        // Get the latest version in this family
        const latest = strategies.sort((a: any, b: any) => b.version - a.version)[0];

        console.log(`Family: ${familyId} (${strategies.length} versions, latest: v${latest.version})`);

        try {
            // Register on AgentRegistry
            const metadataCid = JSON.stringify({
                type: 'strategyforge-agent',
                familyId,
                strategyId: latest._id.toString(),
                goal: latest.goal?.substring(0, 100),
                version: latest.version,
                backfilled: true,
                createdAt: latest.createdAt?.toISOString(),
            });

            const regResult = await registryRegister(metadataCid);
            console.log(`  ✅ Registered as agent #${regResult.agentId} (tx: ${regResult.txHash.substring(0, 18)}...)`);

            // Record initial reputation
            const ledgerResult = await ledgerRecord(
                regResult.agentId,
                familyId,
                5000, // 50% neutral
                latest._id.toString(),
            );
            console.log(`  ✅ Reputation recorded (tx: ${ledgerResult.txHash.substring(0, 18)}...)`);

            // Update ALL versions in this family with the agentId
            for (const s of strategies) {
                s.onChainAgentId = regResult.agentId;
                s.registryTxHash = regResult.txHash;
                if (s._id.toString() === latest._id.toString()) {
                    s.agentRegistryCid = metadataCid;
                    s.reputationLedgerTxHash = ledgerResult.txHash;
                }
                await s.save();
            }

            registered++;
        } catch (e: any) {
            console.log(`  ❌ Failed: ${e.message}`);
            failed++;
        }
    }

    console.log(`\n═══════════════════════════════════════════════════`);
    console.log(`  Done: ${registered} registered, ${failed} failed`);
    console.log(`═══════════════════════════════════════════════════`);

    await mongoose.disconnect();
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
