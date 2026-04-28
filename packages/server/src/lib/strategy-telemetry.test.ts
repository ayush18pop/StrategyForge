import { describe, expect, test } from 'bun:test';
import type { StrategyVersion } from '@strategyforge/core';
import type { FamilyMetaRecord } from './kv-meta.js';
import {
  buildReviewWindow,
  buildStrategyYieldChart,
  deriveAllocationWeights,
  extractStrategyAllocations,
  type ProtocolTelemetry,
} from './strategy-telemetry.js';

const NOW = Date.now();

describe('extractStrategyAllocations', () => {
  test('keeps only allocation nodes for the family asset', () => {
    const version = buildVersion({
      nodes: [
        {
          id: 'check-balance',
          type: 'web3/check-token-balance',
          config: { asset: 'USDC', network: 'base' },
        },
        {
          id: 'supply-aave',
          type: 'aave-v3/supply',
          config: { asset: 'USDC', amount: 30000, network: 'base' },
        },
        {
          id: 'deposit-morpho',
          type: 'morpho/deposit',
          config: { asset: 'USDC', amount: 20000, network: 'base' },
        },
        {
          id: 'deposit-eth',
          type: 'aave-v3/deposit',
          config: { asset: 'WETH', amount: 2, network: 'base' },
        },
      ],
    });

    expect(extractStrategyAllocations(version, 'USDC')).toEqual([
      {
        protocolKey: 'aave-v3',
        protocolName: 'Aave V3',
        chain: 'base',
        asset: 'USDC',
        configuredAmount: 30000,
      },
      {
        protocolKey: 'morpho',
        protocolName: 'Morpho',
        chain: 'base',
        asset: 'USDC',
        configuredAmount: 20000,
      },
    ]);
  });
});

describe('deriveAllocationWeights', () => {
  test('uses configured amounts when all are numeric', () => {
    const result = deriveAllocationWeights([
      {
        protocolKey: 'aave-v3',
        protocolName: 'Aave V3',
        chain: 'base',
        asset: 'USDC',
        configuredAmount: 75,
      },
      {
        protocolKey: 'morpho',
        protocolName: 'Morpho',
        chain: 'base',
        asset: 'USDC',
        configuredAmount: 25,
      },
    ]);

    expect(result.weightingMode).toBe('configured-amounts');
    expect(result.weightedAllocations.map((allocation) => allocation.allocationWeightPct)).toEqual([75, 25]);
  });

  test('falls back to equal weighting when amounts are unreadable', () => {
    const result = deriveAllocationWeights([
      {
        protocolKey: 'aave-v3',
        protocolName: 'Aave V3',
        chain: 'base',
        asset: 'USDC',
        configuredAmount: null,
      },
      {
        protocolKey: 'morpho',
        protocolName: 'Morpho',
        chain: 'base',
        asset: 'USDC',
        configuredAmount: null,
      },
    ]);

    expect(result.weightingMode).toBe('equal-fallback');
    expect(result.weightedAllocations.map((allocation) => allocation.allocationWeightPct)).toEqual([50, 50]);
  });
});

describe('buildReviewWindow', () => {
  test('falls back to family creation time when monitoring has not run yet', () => {
    const familyMeta: FamilyMetaRecord = {
      goal: {
        asset: 'USDC',
        amount: 50000,
        riskLevel: 'balanced',
        horizon: '1 month',
        chains: ['base'],
        targetYield: 800,
      },
      userWalletAddress: '0x123',
      versions: [],
      createdAt: 1_000,
    };

    const reviewWindow = buildReviewWindow(familyMeta, {
      priorCids: [],
      goal: familyMeta.goal,
      monitorIntervalMs: 6_000,
      lastMonitoredAt: 0,
    });

    expect(reviewWindow).toEqual({
      nextReviewAt: 7_000,
      monitorIntervalMs: 6_000,
      source: 'created-at-fallback',
    });
  });
});

describe('buildStrategyYieldChart', () => {
  test('builds cumulative estimated and target yield curves', () => {
    const chartStartAt = NOW - (24 * 60 * 60 * 1_000);
    const protocols: ProtocolTelemetry[] = [
      {
        protocolKey: 'aave-v3',
        protocolName: 'Aave V3',
        chain: 'base',
        asset: 'USDC',
        allocationWeightPct: 100,
        currentApyPct: 12,
        currentTvlUsd: 10_000_000,
        marketAvailable: true,
        stale: false,
        sparkline: [
          { timestamp: chartStartAt, apyPct: 12 },
          { timestamp: NOW, apyPct: 12 },
        ],
      },
    ];

    const chart = buildStrategyYieldChart(protocols, 8, chartStartAt);
    const latest = chart.at(-1);

    expect(chart.length).toBeGreaterThanOrEqual(2);
    expect(latest?.estimatedStrategyApyPct).toBe(12);
    expect(latest?.estimatedCumulativeYieldPct ?? 0).toBeCloseTo(12 / 365, 4);
    expect(latest?.targetCumulativeYieldPct ?? 0).toBeCloseTo(8 / 365, 4);
  });
});

function buildVersion(params: {
  nodes: Array<{
    id: string;
    type: string;
    config: Record<string, unknown>;
  }>;
}): StrategyVersion {
  return {
    familyId: 'family-1',
    version: 1,
    cid: 'cid-1',
    priorCids: [],
    lifecycle: 'live',
    workflowSpec: {
      name: 'Test workflow',
      description: 'Telemetry extraction test',
      trigger: {
        type: 'schedule',
        config: { cron: '0 */6 * * *' },
      },
      nodes: params.nodes,
      edges: [],
    },
    createdAt: NOW,
    keeperhubWorkflowId: 'workflow-1',
    evidenceBundleCid: 'bundle-1',
  };
}
