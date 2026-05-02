import { NextResponse } from 'next/server';

// Curated pool IDs from DefiLlama for key DeFi protocols
// These are stable IDs that won't change between requests
const TARGET_POOLS = [
  // Aave V3 USDC on Ethereum mainnet
  'aa7a9d80-def8-4b52-bbca-d3c0fa58e25e',
  // Compound V3 USDC on Ethereum
  'bd956b7e-45fc-4f0e-9600-94a7a0d2bcf7',
  // Morpho Aave V3 USDC
  'e9ad5f2a-5c7f-4e43-a0cd-31f5df0e0a68',
];

// Fallback: query by project + symbol if IDs fail
const FALLBACK_FILTERS = [
  { project: 'aave-v3', symbol: 'USDC', chain: 'Ethereum' },
  { project: 'compound-v3', symbol: 'USDC', chain: 'Ethereum' },
  { project: 'morpho-blue', symbol: 'USDC', chain: 'Ethereum' },
];

// GET /api/live/yields
// Returns real APY data from DefiLlama for key DeFi pools.
export async function GET() {
  try {
    const res = await fetch('https://yields.llama.fi/pools', {
      next: { revalidate: 60 }, // cache 60s
    });

    if (!res.ok) {
      throw new Error(`DefiLlama returned ${res.status}`);
    }

    const { data: pools } = await res.json();

    // Try to find target pools, fall back to filter-based matching
    const matched: {
      project: string;
      symbol: string;
      chain: string;
      apy: number;
      tvlUsd: number;
      apyBase: number | null;
      apyReward: number | null;
      pool: string;
    }[] = [];

    for (const filter of FALLBACK_FILTERS) {
      const found = pools.find(
        (p: any) =>
          p.project === filter.project &&
          p.symbol?.includes(filter.symbol) &&
          p.chain === filter.chain &&
          typeof p.apy === 'number' &&
          p.tvlUsd > 1_000_000
      );

      if (found) {
        matched.push({
          project: found.project,
          symbol: found.symbol,
          chain: found.chain,
          apy: parseFloat(found.apy.toFixed(4)),
          tvlUsd: found.tvlUsd,
          apyBase: found.apyBase ?? null,
          apyReward: found.apyReward ?? null,
          pool: found.pool,
        });
      }
    }

    // Also grab a few more notable pools for variety
    const additional = pools
      .filter(
        (p: any) =>
          ['aave-v3', 'compound-v3', 'morpho-blue', 'spark', 'fluid'].includes(p.project) &&
          p.symbol?.includes('USDC') &&
          p.chain === 'Ethereum' &&
          typeof p.apy === 'number' &&
          p.tvlUsd > 5_000_000 &&
          !matched.find((m) => m.pool === p.pool)
      )
      .slice(0, 5)
      .map((p: any) => ({
        project: p.project,
        symbol: p.symbol,
        chain: p.chain,
        apy: parseFloat(p.apy.toFixed(4)),
        tvlUsd: p.tvlUsd,
        apyBase: p.apyBase ?? null,
        apyReward: p.apyReward ?? null,
        pool: p.pool,
      }));

    const allPools = [...matched, ...additional].sort((a, b) => b.apy - a.apy);

    return NextResponse.json(
      {
        pools: allPools,
        fetchedAt: new Date().toISOString(),
        source: 'defillama',
      },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message, pools: [] }, { status: 500 });
  }
}
