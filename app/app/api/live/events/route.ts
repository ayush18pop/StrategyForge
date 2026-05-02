import { NextResponse } from 'next/server';
import { connectDB } from '../../../../lib/db/mongoose';
import { Strategy } from '../../../../lib/db/strategy.model';

// GET /api/live/events
// Returns the last N attestation events from real strategy evidence bundles.
// Used by ActivityTicker to display live proof-of-computation events.
export async function GET() {
  try {
    await connectDB();

    const strategies = await Strategy.find(
      {
        $or: [
          { 'evidenceBundle.step1_researcher.attestationId': { $exists: true, $ne: '' } },
          { 'evidenceBundle.step2_strategist.attestationId': { $exists: true, $ne: '' } },
          { 'evidenceBundle.step3_critic.attestationId': { $exists: true, $ne: '' } },
        ],
      },
      {
        goal: 1,
        version: 1,
        lifecycle: 1,
        reputationLedgerTxHash: 1,
        agentRegistryCid: 1,
        createdAt: 1,
        'evidenceBundle.step1_researcher.attestationId': 1,
        'evidenceBundle.step1_researcher.timestamp': 1,
        'evidenceBundle.step2_strategist.attestationId': 1,
        'evidenceBundle.step2_strategist.timestamp': 1,
        'evidenceBundle.step3_critic.attestationId': 1,
        'evidenceBundle.step3_critic.timestamp': 1,
      }
    )
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const events: {
      id: string;
      type: 'attestation' | 'onchain';
      label: string;
      value: string;
      ts: string;
    }[] = [];

    for (const s of strategies) {
      const eb = (s as any).evidenceBundle ?? {};
      const goal = ((s as any).goal as string).slice(0, 48);

      const steps = [
        { step: eb.step1_researcher, label: 'RESEARCHER' },
        { step: eb.step2_strategist, label: 'STRATEGIST' },
        { step: eb.step3_critic,     label: 'CRITIC' },
      ];

      for (const { step, label } of steps) {
        if (step?.attestationId) {
          events.push({
            id: `${(s as any)._id}-${label}`,
            type: 'attestation',
            label: `◆ ${label} ATTESTED`,
            value: step.attestationId,
            ts: step.timestamp ? new Date(step.timestamp).toISOString() : new Date((s as any).createdAt).toISOString(),
          });
        }
      }

      if ((s as any).reputationLedgerTxHash) {
        events.push({
          id: `${(s as any)._id}-onchain`,
          type: 'onchain',
          label: '⬡ ON-CHAIN ANCHORED',
          value: (s as any).reputationLedgerTxHash,
          ts: new Date((s as any).createdAt).toISOString(),
        });
      }
    }

    // Sort chronologically descending and cap at 30
    events.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

    return NextResponse.json(
      { events: events.slice(0, 30), count: events.length },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message, events: [] }, { status: 500 });
  }
}
