export interface HistoricalAPY {
    date: number; // unix timestamp
    apy: number;
}

export interface ProtocolData {
    chain: string;
    project: string;
    symbol: string;
    tvlUsd: number;
    apyBase?: number;
    apyReward?: number;
    apy: number;
    rewardTokens?: string[];
    pool: string;
    stablecoin: boolean;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export class DefiLlamaClient {
    private readonly baseUrl = 'https://api.llama.fi';
    private readonly yieldsUrl = 'https://yields.llama.fi';

    /**
     * Get all yield pools, with optional filtering
     */
    async getYieldPools(params: {
        chains?: string[];
        stablecoinsOnly?: boolean;
        minTvl?: number;
    } = {}): Promise<Result<ProtocolData[]>> {
        try {
            const response = await fetch(`${this.yieldsUrl}/pools`);
            if (!response.ok) {
                return { ok: false, error: `Failed to fetch yield pools: ${response.statusText}` };
            }

            const data = (await response.json()) as any;
            let pools: ProtocolData[] = data.data;

            // Apply filtering
            if (params.chains && params.chains.length > 0) {
                const chainsUpper = params.chains.map(c => c.toUpperCase());
                pools = pools.filter(p => chainsUpper.includes(p.chain.toUpperCase()));
            }
            if (params.stablecoinsOnly !== undefined) {
                pools = pools.filter(p => p.stablecoin === params.stablecoinsOnly);
            }
            if (params.minTvl !== undefined) {
                pools = pools.filter(p => p.tvlUsd >= params.minTvl!);
            }

            return { ok: true, value: pools };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            return { ok: false, error: message || 'Unknown error fetching yield pools' };
        }
    }

    /**
     * Get current TVL for a protocol
     * @param protocol eg 'aave'
     */
    async getProtocolTVL(protocol: string): Promise<Result<{ tvl: number; change7d: number }>> {
        try {
            const response = await fetch(`${this.baseUrl}/protocol/${protocol}`);
            if (!response.ok) {
                return { ok: false, error: `Failed to fetch TVL for ${protocol}: ${response.statusText}` };
            }

            const data = (await response.json()) as any;
            const tvl = data.tvl && data.tvl.length > 0 ? data.tvl[data.tvl.length - 1].totalLiquidityUSD : 0;

            return {
                ok: true,
                value: { tvl, change7d: data.change_7d || 0 }
            };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            return { ok: false, error: message || `Unknown error fetching TVL for ${protocol}` };
        }
    }

    /**
     * Get historical daily APY for a given pool
     * @param poolId The ID of the pool (uuid)
     * @param days Number of days of history to fetch (useful for slicing response)
     */
    async getHistoricalAPY(poolId: string, days?: number): Promise<Result<HistoricalAPY[]>> {
        try {
            const response = await fetch(`${this.yieldsUrl}/chart/${poolId}`);
            if (!response.ok) {
                return { ok: false, error: `Failed to fetch historical APY: ${response.statusText}` };
            }

            const data = (await response.json()) as any;
            let history: HistoricalAPY[] = data.data.map((item: { timestamp: string; apy: number }) => ({
                date: new Date(item.timestamp).getTime(),
                apy: item.apy
            }));

            if (days !== undefined && days > 0) {
                history = history.slice(-days);
            }

            return { ok: true, value: history };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            return { ok: false, error: message || 'Unknown error fetching historical APY' };
        }
    }
}
