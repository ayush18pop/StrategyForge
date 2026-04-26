import { expect, test, describe, mock, beforeEach } from 'bun:test';
import { DefiLlamaClient } from '../src/defillama';

describe('DefiLlamaClient', () => {
    let client: DefiLlamaClient;
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
        client = new DefiLlamaClient();
        originalFetch = global.fetch;
    });

    test('getYieldPools fetches and filters pools correctly', async () => {
        global.fetch = mock(async () => {
            return new Response(JSON.stringify({
                status: 'success',
                data: [
                    { chain: 'Ethereum', project: 'aave-v3', symbol: 'USDC', tvlUsd: 10000000, apy: 5, pool: 'aave-usdc', stablecoin: true },
                    { chain: 'Arbitrum', project: 'aave-v3', symbol: 'USDC', tvlUsd: 5000000, apy: 6, pool: 'aave-usdc-arb', stablecoin: true },
                    { chain: 'Ethereum', project: 'uniswap', symbol: 'ETH', tvlUsd: 20000000, apy: 2, pool: 'uni-eth', stablecoin: false },
                ]
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                },
            });
        }) as unknown as typeof global.fetch;

        // Test no filters
        let result = await client.getYieldPools();
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.length).toBe(3);
        }

        // Test chain filters
        result = await client.getYieldPools({ chains: ['Ethereum'] });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.length).toBe(2);
            expect(result.value[0]!.chain).toBe('Ethereum');
            expect(result.value[1]!.chain).toBe('Ethereum');
        }

        // Test stablecoin filter
        result = await client.getYieldPools({ stablecoinsOnly: true });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.length).toBe(2);
            expect(result.value[0]!.stablecoin).toBe(true);
            expect(result.value[1]!.stablecoin).toBe(true);
        }
    });

    test('getProtocolTVL retrieves correct TVL', async () => {
        global.fetch = mock(async () => {
            return new Response(JSON.stringify({
                tvl: [{ date: 1, totalLiquidityUSD: 100 }, { date: 2, totalLiquidityUSD: 500 }],
                change_7d: 5
            }), {
                status: 200,
            });
        }) as unknown as typeof global.fetch;

        const result = await client.getProtocolTVL('aave');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.tvl).toBe(500); // gets the last one
            expect(result.value.change7d).toBe(5);
        }
    });

    test('getHistoricalAPY fetches and returns history', async () => {
        global.fetch = mock(async () => {
            return new Response(JSON.stringify({
                status: 'success',
                data: [
                    { timestamp: '2024-01-01T00:00:00Z', apy: 5.5 },
                    { timestamp: '2024-01-02T00:00:00Z', apy: 5.6 },
                    { timestamp: '2024-01-03T00:00:00Z', apy: 5.4 }
                ]
            }), { status: 200 });
        }) as unknown as typeof global.fetch;

        let result = await client.getHistoricalAPY('some-pool');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.length).toBe(3);
            expect(result.value[0]!.apy).toBe(5.5);
        }

        // slice 2 days
        result = await client.getHistoricalAPY('some-pool', 2);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.length).toBe(2);
            expect(result.value[0]!.apy).toBe(5.6);
            expect(result.value[1]!.apy).toBe(5.4);
        }

        global.fetch = originalFetch;
    });
});
