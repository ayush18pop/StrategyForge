import { NextResponse } from 'next/server';
import { connectDB } from '../../../../lib/db/mongoose';
import { Strategy } from '../../../../lib/db/strategy.model';

const OG_RPC = process.env.OG_CHAIN_RPC || 'https://evmrpc-testnet.0g.ai';

async function getBlock(): Promise<number | null> {
  try {
    const res = await fetch(OG_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
      signal: AbortSignal.timeout(4000),
    });
    const d = await res.json();
    return parseInt(d.result, 16);
  } catch {
    return null;
  }
}

async function getBestYield(): Promise<number | null> {
  try {
    const res = await fetch('https://yields.llama.fi/pools', { next: { revalidate: 120 } });
    const { data } = await res.json();
    const usdc = data.filter(
      (p: any) =>
        ['aave-v3', 'compound-v3', 'morpho-blue', 'spark', 'fluid'].includes(p.project) &&
        p.symbol?.includes('USDC') &&
        p.chain === 'Ethereum' &&
        typeof p.apy === 'number' &&
        p.tvlUsd > 1_000_000
    );
    if (!usdc.length) return null;
    return Math.max(...usdc.map((p: any) => p.apy));
  } catch {
    return null;
  }
}

// GET /api/live/stats
// Aggregated live stats for the landing page status bar.
export async function GET() {
  try {
    await connectDB();

    const [totalStrategies, attestedCount, lastStrategy, block, bestYield] = await Promise.all([
      Strategy.countDocuments(),
      Strategy.countDocuments({ 'evidenceBundle.step3_critic.attestationId': { $exists: true, $ne: '' } }),
      Strategy.findOne({}, { createdAt: 1 }).sort({ createdAt: -1 }).lean(),
      getBlock(),
      getBestYield(),
    ]);

    const totalAttestations = attestedCount * 3; // 3 steps per strategy

    return NextResponse.json(
      {
        totalStrategies,
        totalAttestations,
        lastStrategyAt: lastStrategy ? (lastStrategy as any).createdAt : null,
        block,
        bestYield: bestYield !== null ? parseFloat(bestYield.toFixed(2)) : null,
        fetchedAt: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
