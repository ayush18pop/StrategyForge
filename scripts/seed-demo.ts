/**
 * Seed demo data: v1 strategy → suboptimal execution → v2 with evidenceOfLearning.
 *
 * User must have already registered via POST /api/auth/register (or the frontend).
 *
 * Usage:
 *   MONGODB_URI=... USER_ID=<userId from register> npx tsx scripts/seed-demo.ts
 *
 * Optional:
 *   DRY_RUN=1 — print what would be created without writing to MongoDB
 */

import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;
const USER_ID = process.env.USER_ID;
const DRY_RUN = process.env.DRY_RUN === '1';

if (!MONGODB_URI) { console.error('MONGODB_URI required'); process.exit(1); }
if (!USER_ID) { console.error('USER_ID required — register first via POST /api/auth/register, then pass the returned userId'); process.exit(1); }

// ── Pre-seeded evidence bundles (no LLM required) ────────────────────────────

const V1_EVIDENCE = {
    step1_researcher: {
        output: {
            goalClassification: 'risk_monitoring',
            relevantProtocols: ['aave-v3'],
            currentState: { aaveHealthFactor: 1.62, usdcBalance: '5000' },
            signals: [{ subject: 'aave-v3', signal: 'Health factor near threshold', severity: 'medium' }],
            priorLessons: [],
            recommendation: 'Monitor Aave health factor and alert when it approaches 1.5',
        },
        attestationId: 'seed-researcher-v1',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h ago
    },
    step2_strategist: {
        output: {
            candidates: [
                {
                    id: 'A',
                    name: 'Aave Health Monitor v1',
                    description: 'Alerts when Aave health factor drops below 1.5',
                    hypothesis: 'Conservative threshold at 1.5 gives early warning',
                    workflow: {
                        name: 'Aave Health Monitor',
                        nodes: [
                            { id: 'trigger', type: 'trigger', data: { type: 'trigger', label: 'Every 5 min', config: { triggerType: 'Schedule', scheduleCron: '*/5 * * * *' }, status: 'idle' }, position: { x: 120, y: 80 } },
                            { id: 'check-health', type: 'action', data: { type: 'aave-v3/get-user-account-data', label: 'Get Aave Health Factor', config: { userAddress: 'USER_WALLET', networkId: '11155111' }, status: 'idle' }, position: { x: 120, y: 240 } },
                            { id: 'condition', type: 'condition', data: { type: 'condition', label: 'Health < 1.5?', config: { condition: 'Number({{@check-health:Get Aave Health Factor.healthFactor}}) < 1.5' }, status: 'idle' }, position: { x: 120, y: 400 } },
                            { id: 'alert', type: 'action', data: { type: 'discord/send-message', label: 'Send Alert', config: { webhookUrl: '{{DISCORD_WEBHOOK}}', message: 'ALERT: Health factor {{@check-health:Get Aave Health Factor.healthFactor}}' }, status: 'idle' }, position: { x: 120, y: 560 } },
                        ],
                        edges: [
                            { id: 'trigger->check-health', source: 'trigger', target: 'check-health' },
                            { id: 'check-health->condition', source: 'check-health', target: 'condition' },
                            { id: 'condition->alert', source: 'condition', target: 'alert', sourceHandle: 'true' },
                        ],
                    },
                },
            ],
        },
        attestationId: 'seed-strategist-v1',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000 + 30000),
    },
    step3_critic: {
        output: {
            selected: 'A',
            rationale: 'Single candidate — conservative threshold of 1.5 is appropriate for first version',
            attacksOnRejected: 'N/A',
            priorLessonsApplied: [],
            evidenceOfLearning: '',
            riskWarnings: ['Threshold of 1.5 may be too sensitive and cause false positives'],
        },
        attestationId: 'seed-critic-v1',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000 + 60000),
    },
};


// v2 explicitly learns from v1's false positive
const V2_EVIDENCE = {
    step1_researcher: {
        output: {
            goalClassification: 'risk_monitoring',
            relevantProtocols: ['aave-v3'],
            currentState: { aaveHealthFactor: 1.62, usdcBalance: '5000' },
            signals: [{ subject: 'aave-v3', signal: 'Health factor stable above 1.5', severity: 'low' }],
            priorLessons: ['Alert fired when health factor was 1.62 — threshold of 1.5 caused false positive'],
            recommendation: 'Lower threshold to 1.3 to eliminate false positives while still catching real risk',
        },
        attestationId: 'seed-researcher-v2',
        timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30min ago
    },
    step2_strategist: {
        output: {
            candidates: [
                {
                    id: 'A',
                    name: 'Aave Health Monitor v2',
                    description: 'Alerts when Aave health factor drops below 1.3 (fixed from v1)',
                    hypothesis: 'Lowering threshold to 1.3 eliminates the false positive at 1.62',
                    workflow: {
                        name: 'Aave Health Monitor v2',
                        nodes: [
                            { id: 'trigger', type: 'trigger', data: { type: 'trigger', label: 'Every 5 min', config: { triggerType: 'Schedule', scheduleCron: '*/5 * * * *' }, status: 'idle' }, position: { x: 120, y: 80 } },
                            { id: 'check-health', type: 'action', data: { type: 'aave-v3/get-user-account-data', label: 'Get Aave Health Factor', config: { userAddress: 'USER_WALLET', networkId: '11155111' }, status: 'idle' }, position: { x: 120, y: 240 } },
                            { id: 'condition', type: 'condition', data: { type: 'condition', label: 'Health < 1.3?', config: { condition: 'Number({{@check-health:Get Aave Health Factor.healthFactor}}) < 1.3' }, status: 'idle' }, position: { x: 120, y: 400 } },
                            { id: 'alert', type: 'action', data: { type: 'discord/send-message', label: 'Send Alert', config: { webhookUrl: '{{DISCORD_WEBHOOK}}', message: 'ALERT: Health factor {{@check-health:Get Aave Health Factor.healthFactor}} — critical risk!' }, status: 'idle' }, position: { x: 120, y: 560 } },
                        ],
                        edges: [
                            { id: 'trigger->check-health', source: 'trigger', target: 'check-health' },
                            { id: 'check-health->condition', source: 'check-health', target: 'condition' },
                            { id: 'condition->alert', source: 'condition', target: 'alert', sourceHandle: 'true' },
                        ],
                    },
                },
            ],
        },
        attestationId: 'seed-strategist-v2',
        timestamp: new Date(Date.now() - 30 * 60 * 1000 + 30000),
    },
    step3_critic: {
        output: {
            selected: 'A',
            rationale: 'v2 correctly lowers the threshold to 1.3. The prior version fired a false alert at health factor 1.62, which is well above the danger zone. This version will only alert when there is genuine liquidation risk.',
            attacksOnRejected: 'N/A',
            priorLessonsApplied: ['Threshold changed from 1.5 to 1.3 based on observed false positive'],
            evidenceOfLearning: 'v1 threshold of 1.5 caused a false positive alert when health factor was 1.62 — the user was not at risk but received an alert. v2 changes the threshold to 1.3 which only triggers when liquidation is genuinely imminent.',
            riskWarnings: ['Monitor for missed alerts if health factor drops rapidly past 1.3 without triggering the 5-min check'],
        },
        attestationId: 'seed-critic-v2',
        timestamp: new Date(Date.now() - 30 * 60 * 1000 + 60000),
    },
};

// ── MongoDB schemas (inline to avoid import path issues) ──────────────────────

const UserSchema = new mongoose.Schema({
    keeperhubApiKey: String,
    openrouterApiKey: String,
    walletAddress: String,
    discordWebhookUrl: String,
    createdAt: { type: Date, default: Date.now },
});

const StrategySchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    familyId: String,
    version: Number,
    lifecycle: String,
    goal: String,
    evidenceBundle: Object,
    priorVersionId: { type: mongoose.Schema.Types.ObjectId, default: null },
    keeperhubWorkflowId: String,
    workflowJson: Object,
    agentRegistryCid: String,
    reputationLedgerTxHash: String,
    createdAt: { type: Date, default: Date.now },
    deployedAt: Date,
});

const ExecutionSchema = new mongoose.Schema({
    strategyId: mongoose.Schema.Types.ObjectId,
    keeperhubExecutionId: String,
    status: String,
    stepLogs: Array,
    outcome: Object,
    createdAt: { type: Date, default: Date.now },
    completedAt: Date,
});

async function main() {
    console.log(DRY_RUN ? '--- DRY RUN ---' : '--- SEEDING ---');

    if (!DRY_RUN) {
        await mongoose.connect(MONGODB_URI!);
        console.log('Connected to MongoDB');
    }

    const User = mongoose.models.User || mongoose.model('User', UserSchema);
    const Strategy = mongoose.models.Strategy || mongoose.model('Strategy', StrategySchema);
    const Execution = mongoose.models.Execution || mongoose.model('Execution', ExecutionSchema);

    // 1. Look up the registered user
    const GOAL = 'Monitor my Aave position on Sepolia and alert me if health factor drops below threshold';
    const FAMILY_ID = 'aave-health-guardian-demo';

    console.log('\n[1] Looking up user...');
    let user: any;
    if (!DRY_RUN) {
        user = await User.findById(USER_ID);
        if (!user) { console.error(`User ${USER_ID} not found — register first via POST /api/auth/register`); process.exit(1); }
    } else {
        user = { _id: new mongoose.Types.ObjectId(USER_ID), walletAddress: '0x...' };
    }
    console.log(`   userId: ${user._id}`);
    console.log(`   wallet: ${user.walletAddress}`);

    // Inject real wallet address into workflow nodes
    const v1Evidence = JSON.parse(JSON.stringify(V1_EVIDENCE).replace(/USER_WALLET/g, user.walletAddress));
    const v2Evidence = JSON.parse(JSON.stringify(V2_EVIDENCE).replace(/USER_WALLET/g, user.walletAddress));
    const v1Workflow = v1Evidence.step2_strategist.output.candidates[0].workflow;

    // 2. Create v1 strategy
    console.log('\n[2] Creating v1 strategy...');
    let v1: any;
    if (!DRY_RUN) {
        // Remove existing demo data for clean re-seed
        const existing = await Strategy.find({ familyId: FAMILY_ID, userId: user._id });
        if (existing.length > 0) {
            console.log(`   Removing ${existing.length} existing strategies for family ${FAMILY_ID}`);
            for (const s of existing) {
                await Execution.deleteMany({ strategyId: s._id });
                await s.deleteOne();
            }
        }

        v1 = await Strategy.create({
            userId: user._id,
            familyId: FAMILY_ID,
            version: 1,
            goal: GOAL,
            lifecycle: 'deprecated',
            workflowJson: v1Workflow,
            keeperhubWorkflowId: `demo-kh-wf-v1-${Date.now()}`,
            evidenceBundle: v1Evidence,
            deployedAt: new Date(Date.now() - 90 * 60 * 1000),
            createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        });
    } else {
        v1 = { _id: new mongoose.Types.ObjectId() };
    }
    console.log(`   v1 strategyId: ${v1._id}`);

    // 3. Create suboptimal execution for v1
    console.log('\n[3] Creating suboptimal execution for v1...');
    let execution: any;
    if (!DRY_RUN) {
        execution = await Execution.create({
            strategyId: v1._id,
            keeperhubExecutionId: `demo-exec-${Date.now()}`,
            status: 'success',
            stepLogs: [
                { stepId: 'check-health', actionType: 'aave-v3/get-user-account-data', status: 'success', output: { healthFactor: '1.62', totalCollateralBase: '10000', totalDebtBase: '6000' }, txHash: null, error: null },
                { stepId: 'condition', actionType: 'condition', status: 'success', output: { result: true }, txHash: null, error: null },
                { stepId: 'alert', actionType: 'discord/send-message', status: 'success', output: { messageSent: true }, txHash: null, error: null },
            ],
            outcome: {
                suboptimal: true,
                suboptimalReason: 'Alert fired but health factor was 1.62 (above 1.4) — threshold too sensitive, causing false positive',
                metrics: { healthFactor: 1.62 },
            },
            createdAt: new Date(Date.now() - 60 * 60 * 1000),
            completedAt: new Date(Date.now() - 60 * 60 * 1000 + 15000),
        });
    } else {
        execution = { _id: new mongoose.Types.ObjectId() };
    }
    console.log(`   executionId: ${execution._id}`);
    console.log(`   suboptimalReason: Alert fired at health factor 1.62 — false positive`);

    // 4. Create v2 strategy (learned from v1)
    console.log('\n[4] Creating v2 strategy (with evidenceOfLearning)...');
    let v2: any;
    if (!DRY_RUN) {
        v2 = await Strategy.create({
            userId: user._id,
            familyId: FAMILY_ID,
            version: 2,
            goal: GOAL,
            lifecycle: 'live',
            workflowJson: v2Evidence.step2_strategist.output.candidates[0].workflow,
            keeperhubWorkflowId: `demo-kh-wf-v2-${Date.now()}`,
            priorVersionId: v1._id,
            evidenceBundle: v2Evidence,
            deployedAt: new Date(Date.now() - 25 * 60 * 1000),
            createdAt: new Date(Date.now() - 30 * 60 * 1000),
        });
    } else {
        v2 = { _id: new mongoose.Types.ObjectId() };
    }
    console.log(`   v2 strategyId: ${v2._id}`);
    console.log(`   evidenceOfLearning: "${v2Evidence.step3_critic.output.evidenceOfLearning.slice(0, 80)}..."`);

    console.log('\n--- SEED COMPLETE ---');
    console.log('\nDemo data created:');
    console.log(`  User ID:            ${user._id}`);
    console.log(`  Auth token:         ${user._id}  (use as Bearer token)`);
    console.log(`  v1 strategy:        ${v1._id}  (deprecated — had false positive)`);
    console.log(`  Suboptimal exec:    ${execution._id}`);
    console.log(`  v2 strategy:        ${v2._id}  (live — fixed threshold)`);
    console.log(`\nFamily: ${FAMILY_ID}`);
    console.log(`Goal: ${GOAL}`);

    if (!DRY_RUN) {
        await mongoose.disconnect();
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
