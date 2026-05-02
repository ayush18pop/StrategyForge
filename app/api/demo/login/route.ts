import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '../../../../lib/db/mongoose';
import { User, hashPassword } from '../../../../lib/db/user.model';
import { Strategy } from '../../../../lib/db/strategy.model';
import { Execution } from '../../../../lib/db/execution.model';
import { signToken } from '../../../../lib/auth';

const DEMO_USERNAME = 'demo';
const DEMO_PASSWORD = 'demo123';
const DEMO_WALLET = '0x742d35Cc6634C0532925a3b8D4C9B7d45B6F9012';

async function seedDemoStrategies(userId: string) {
  const existing = await Strategy.countDocuments({ userId });
  if (existing > 0) return;

  const v1Id = new mongoose.Types.ObjectId();
  const v2Id = new mongoose.Types.ObjectId();

  const v1Evidence = {
    step1_researcher: {
      output: {
        goalClassification: 'risk_monitoring',
        targetNetwork: 'sepolia',
        relevantProtocols: ['aave-v3'],
        currentState: { healthFactor: 1.82, totalDebtUSD: 4200, totalCollateralUSD: 7650 },
        signals: [{ subject: 'aave-v3', signal: 'Health factor approaching alert threshold', severity: 'medium' }],
        priorLessons: [],
        recommendation: 'Set alert at 1.5 health factor threshold with Discord notification'
      },
      attestationId: 'or-v1-a8f2b913c4d5e6f7-20250502',
      timestamp: new Date(Date.now() - 86400000 * 2),
    },
    step2_strategist: {
      output: {
        candidates: [
          { id: 'A', name: 'Conservative Monitor', description: 'Alert at HF < 1.5 with immediate Discord ping', hypothesis: 'Early warning at 1.5 gives time to react before liquidation' },
          { id: 'B', name: 'Aggressive Monitor', description: 'Alert at HF < 1.3 to reduce false positives', hypothesis: 'Tighter threshold reduces noise while still catching real risk' }
        ]
      },
      attestationId: 'or-v1-2c7e4a1b9f8d3e5c-20250502',
      timestamp: new Date(Date.now() - 86400000 * 2 + 30000),
    },
    step3_critic: {
      output: {
        selected: 'A',
        rationale: 'Candidate A provides earlier warning. 1.5 threshold gives more reaction time.',
        attacksOnRejected: 'Candidate B threshold of 1.3 is too close to liquidation threshold.',
        priorLessonsApplied: [],
        evidenceOfLearning: '',
        riskWarnings: ['Health factor can fluctuate rapidly in volatile markets']
      },
      attestationId: 'or-v1-6b3d9c2a5e1f7d4e-20250502',
      timestamp: new Date(Date.now() - 86400000 * 2 + 60000),
    },
  };

  const v2Evidence = {
    step1_researcher: {
      output: {
        goalClassification: 'risk_monitoring',
        targetNetwork: 'sepolia',
        relevantProtocols: ['aave-v3'],
        currentState: { healthFactor: 1.62, totalDebtUSD: 4200, totalCollateralUSD: 7150 },
        signals: [{ subject: 'aave-v3', signal: 'v1 generated false positive at HF 1.6', severity: 'low' }],
        priorLessons: ['Alert fired but health factor was 1.6 (above 1.5 threshold) — false positive caused unnecessary Discord alert'],
        recommendation: 'Tighten threshold to 1.3 and add cooldown to eliminate false positives'
      },
      attestationId: 'or-v2-9a4c2e7b1d5f3a8c-20250502',
      timestamp: new Date(Date.now() - 86400000),
    },
    step2_strategist: {
      output: {
        candidates: [
          { id: 'A', name: 'Calibrated Monitor v2', description: 'Alert at HF < 1.3 with 10-min cooldown', hypothesis: 'Threshold 1.3 eliminates false positives observed in v1 while maintaining protection' },
          { id: 'B', name: 'Dual-Layer Monitor', description: 'Alert at HF < 1.35 + trend check', hypothesis: 'Trend analysis adds signal quality but increases complexity' }
        ]
      },
      attestationId: 'or-v2-3f8a1c6e2b9d5f1a-20250502',
      timestamp: new Date(Date.now() - 86400000 + 30000),
    },
    step3_critic: {
      output: {
        selected: 'A',
        rationale: 'Candidate A directly addresses v1 failure. Threshold 1.3 with cooldown is the minimal effective fix.',
        attacksOnRejected: 'Candidate B adds trend complexity that could mask sudden drops.',
        priorLessonsApplied: ['Changed threshold from 1.5 → 1.3 based on v1 false positive at 1.6', 'Added 10-minute cooldown to prevent alert spam'],
        evidenceOfLearning: 'v1 used threshold 1.5 which fired a false positive when health factor was 1.6 — too sensitive, causing unnecessary Discord alerts. v2 calibrates to 1.3 with a 10-minute cooldown, eliminating false positives while maintaining protection against real liquidation risk.',
        riskWarnings: ['Threshold 1.3 still gives 30 basis points above typical liquidation threshold']
      },
      attestationId: 'or-v2-7d2e9f1b4c8a3e6d-20250502',
      timestamp: new Date(Date.now() - 86400000 + 60000),
    },
  };

  const v1Workflow = {
    name: 'Aave Health Guardian v1',
    nodes: [
      { id: 'trigger', type: 'trigger', data: { type: 'trigger', label: 'Schedule Trigger', config: { triggerType: 'Schedule', scheduleCron: '*/5 * * * *' }, status: 'idle' }, position: { x: 120, y: 80 } },
      { id: 'health-check', type: 'action', data: { type: 'action', label: 'Get Aave Account Data', config: { actionType: 'aave-v3/get-user-account-data', network: 'sepolia', userAddress: DEMO_WALLET }, status: 'idle' }, position: { x: 120, y: 240 } },
      { id: 'condition', type: 'action', data: { type: 'action', label: 'Check Health Factor < 1.5', config: { actionType: 'condition/if', expression: '{{steps.health-check.output.healthFactor}} < 1.5' }, status: 'idle' }, position: { x: 120, y: 400 } },
      { id: 'alert', type: 'action', data: { type: 'action', label: 'Send Discord Alert', config: { actionType: 'discord/send-message', webhookUrl: '{{user.discordWebhookUrl}}', message: 'ALERT: Health factor dropped to {{steps.health-check.output.healthFactor}}' }, status: 'idle' }, position: { x: 120, y: 560 } },
    ],
    edges: [
      { id: 'trigger:default->health-check', source: 'trigger', target: 'health-check' },
      { id: 'health-check:default->condition', source: 'health-check', target: 'condition' },
      { id: 'condition:true->alert', source: 'condition', target: 'alert', sourceHandle: 'true' },
    ]
  };

  const v2Workflow = {
    name: 'Aave Health Guardian v2',
    nodes: [
      { id: 'trigger', type: 'trigger', data: { type: 'trigger', label: 'Schedule Trigger', config: { triggerType: 'Schedule', scheduleCron: '*/5 * * * *' }, status: 'idle' }, position: { x: 120, y: 80 } },
      { id: 'health-check', type: 'action', data: { type: 'action', label: 'Get Aave Account Data', config: { actionType: 'aave-v3/get-user-account-data', network: 'sepolia', userAddress: DEMO_WALLET }, status: 'idle' }, position: { x: 120, y: 240 } },
      { id: 'condition', type: 'action', data: { type: 'action', label: 'Check Health Factor < 1.3', config: { actionType: 'condition/if', expression: '{{steps.health-check.output.healthFactor}} < 1.3' }, status: 'idle' }, position: { x: 120, y: 400 } },
      { id: 'alert', type: 'action', data: { type: 'action', label: 'Send Discord Alert (Calibrated)', config: { actionType: 'discord/send-message', webhookUrl: '{{user.discordWebhookUrl}}', message: 'ALERT: Health factor dropped to {{steps.health-check.output.healthFactor}} — threshold 1.3' }, status: 'idle' }, position: { x: 120, y: 560 } },
    ],
    edges: [
      { id: 'trigger:default->health-check', source: 'trigger', target: 'health-check' },
      { id: 'health-check:default->condition', source: 'health-check', target: 'condition' },
      { id: 'condition:true->alert', source: 'condition', target: 'alert', sourceHandle: 'true' },
    ]
  };

  // Create v1 strategy
  await Strategy.create({
    _id: v1Id,
    userId,
    familyId: 'aave-health-guardian',
    version: 1,
    lifecycle: 'deprecated',
    goal: 'Monitor my Aave position on Sepolia and alert me on Discord if health factor drops below 1.5',
    evidenceBundle: v1Evidence,
    workflowJson: v1Workflow,
    keeperhubWorkflowId: 'demo-kh-workflow-v1',
    agentRegistryCid: v1Id.toString(),
    reputationLedgerTxHash: '0xdemo1a2f3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0',
    priorVersionId: null,
    createdAt: new Date(Date.now() - 86400000 * 2),
    deployedAt: new Date(Date.now() - 86400000 * 2 + 120000),
  });

  // Create a suboptimal execution for v1
  await Execution.create({
    strategyId: v1Id,
    keeperhubExecutionId: 'demo-exec-v1-001',
    status: 'success',
    stepLogs: [
      { stepId: 'health-check', actionType: 'aave-v3/get-user-account-data', status: 'success', output: { healthFactor: 1.6, totalDebtUSD: 4200 }, txHash: null, error: null },
      { stepId: 'condition', actionType: 'condition/if', status: 'success', output: { result: true }, txHash: null, error: null },
      { stepId: 'alert', actionType: 'discord/send-message', status: 'success', output: { sent: true }, txHash: null, error: null },
    ],
    outcome: {
      suboptimal: true,
      suboptimalReason: 'Alert fired but health factor was 1.6 (above 1.5 threshold — false positive)',
      metrics: { healthFactor: 1.6 }
    },
    createdAt: new Date(Date.now() - 86400000),
    completedAt: new Date(Date.now() - 86400000 + 5000),
  });

  // Create v2 strategy
  await Strategy.create({
    _id: v2Id,
    userId,
    familyId: 'aave-health-guardian',
    version: 2,
    lifecycle: 'live',
    goal: 'Monitor my Aave position on Sepolia and alert me on Discord if health factor drops below 1.5',
    evidenceBundle: v2Evidence,
    workflowJson: v2Workflow,
    keeperhubWorkflowId: 'demo-kh-workflow-v2',
    agentRegistryCid: v2Id.toString(),
    reputationLedgerTxHash: '0xdemo2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1',
    priorVersionId: v1Id,
    createdAt: new Date(Date.now() - 86400000),
    deployedAt: new Date(Date.now() - 86400000 + 120000),
  });
}

export async function POST() {
  try {
    await connectDB();

    // Upsert demo user
    const demoUser = await User.findOneAndUpdate(
      { username: DEMO_USERNAME },
      {
        $setOnInsert: {
          username: DEMO_USERNAME,
          passwordHash: hashPassword(DEMO_PASSWORD),
          walletAddress: DEMO_WALLET,
          keeperhubApiKey: process.env.DEMO_KEEPERHUB_API_KEY || process.env.KEEPERHUB_API_KEY || 'demo-key',
          openrouterApiKey: process.env.OPENROUTER_API_KEY || 'demo-key',
          createdAt: new Date(),
        }
      },
      { upsert: true, new: true }
    );

    // Seed demo strategies if empty
    await seedDemoStrategies(demoUser._id.toString());

    return NextResponse.json({
      userId: demoUser._id.toString(),
      username: demoUser.username,
      walletAddress: demoUser.walletAddress,
      token: signToken({ userId: demoUser._id.toString(), username: demoUser.username }),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
