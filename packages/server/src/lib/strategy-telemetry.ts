import type {
  DefiLlamaClient,
  HistoricalAPY,
  ProtocolData as DefiLlamaPool,
} from '@strategyforge/data';
import type { StrategyVersion, WorkflowNode } from '@strategyforge/core';
import type { KVStore } from '@strategyforge/storage';
import { loadFamilyLatest, loadFamilyMeta, type FamilyLatestRecord, type FamilyMetaRecord } from './kv-meta.js';
import { localFamilyToMetaRecord, syncLocalFamily } from './local-db-sync.js';
import type { LocalDB } from './local-store.js';
import { parseWorkflowSpec } from './request-parsers.js';

const HISTORY_WINDOW_DAYS = 7;
const MARKET_CACHE_TTL_MS = 30_000;
const STREAM_WINDOW_MS = HISTORY_WINDOW_DAYS * 24 * 60 * 60 * 1_000;
const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1_000;

export type TelemetryWeightingMode = 'configured-amounts' | 'equal-fallback';
export type TelemetryDegradedMode =
  | 'healthy'
  | 'no-live-version'
  | 'no-protocol-match'
  | 'market-unavailable'
  | 'partial-history'
  | 'stale-market-data';

export interface StrategyYieldPoint {
  timestamp: number;
  estimatedStrategyApyPct: number;
  estimatedCumulativeYieldPct: number;
  targetCumulativeYieldPct: number;
}

export interface ReviewWindowTelemetry {
  nextReviewAt: number;
  monitorIntervalMs: number;
  source: 'latest-record' | 'created-at-fallback';
}

export interface TelemetryDegradedState {
  mode: TelemetryDegradedMode;
  message: string;
  notes: string[];
}

export interface LiveVersionTelemetry {
  version: number;
  createdAt: number;
  keeperhubWorkflowId?: string;
}

export interface ProtocolSparklinePoint {
  timestamp: number;
  apyPct: number;
}

export interface ProtocolTelemetry {
  protocolKey: string;
  protocolName: string;
  chain: string;
  asset: string;
  allocationWeightPct: number;
  currentApyPct: number | null;
  currentTvlUsd: number | null;
  marketAvailable: boolean;
  stale: boolean;
  sparkline: ProtocolSparklinePoint[];
  sourceProject?: string;
  sourcePoolId?: string;
}

export interface StrategyTelemetryBootstrap {
  familyId: string;
  liveVersion: LiveVersionTelemetry | null;
  telemetryPinnedVersion: number | null;
  targetYieldPct: number;
  estimatedStrategyApyPct: number | null;
  estimatedCumulativeYieldPct: number | null;
  weightingMode: TelemetryWeightingMode;
  reviewWindow: ReviewWindowTelemetry;
  protocols: ProtocolTelemetry[];
  chartPoints: StrategyYieldPoint[];
  degradedState: TelemetryDegradedState;
}

export interface StrategyTelemetrySnapshot {
  familyId: string;
  liveVersion: LiveVersionTelemetry | null;
  telemetryPinnedVersion: number | null;
  sampledAt: number;
  estimatedStrategyApyPct: number | null;
  estimatedCumulativeYieldPct: number | null;
  targetYieldPct: number;
  weightingMode: TelemetryWeightingMode;
  reviewWindow: ReviewWindowTelemetry;
  protocols: ProtocolTelemetry[];
  chartPoint: StrategyYieldPoint | null;
  stale: boolean;
  degradedState: TelemetryDegradedState;
}

export interface StrategyTelemetryDeps {
  kvStore: KVStore;
  localDb: LocalDB;
  llama: DefiLlamaClient;
}

interface StrategyFamilySource {
  familyId: string;
  meta: FamilyMetaRecord;
  latest: FamilyLatestRecord | null;
}

interface AllocationCandidate {
  protocolKey: string;
  protocolName: string;
  chain: string;
  asset: string;
  configuredAmount: number | null;
}

interface WeightedAllocation extends AllocationCandidate {
  allocationWeightPct: number;
}

interface MatchedProtocolTelemetry extends ProtocolTelemetry {
  _history: ProtocolSparklinePoint[];
}

export class StrategyTelemetryService {
  private yieldPoolsCache:
    | {
      expiresAt: number;
      value: DefiLlamaPool[];
    }
    | null = null;

  constructor(private readonly deps: StrategyTelemetryDeps) { }

  async getBootstrap(familyId: string): Promise<StrategyTelemetryBootstrap> {
    const family = await loadStrategyFamilySource(this.deps, familyId);
    const liveVersion = latestLiveVersion(family.meta.versions);
    const targetYieldPct = family.meta.goal.targetYield / 100;
    const reviewWindow = buildReviewWindow(family.meta, family.latest);

    if (!liveVersion) {
      return {
        familyId,
        liveVersion: null,
        telemetryPinnedVersion: null,
        targetYieldPct,
        estimatedStrategyApyPct: null,
        estimatedCumulativeYieldPct: null,
        weightingMode: 'equal-fallback',
        reviewWindow,
        protocols: [],
        chartPoints: [],
        degradedState: {
          mode: 'no-live-version',
          message: 'Telemetry starts after deployment.',
          notes: [],
        },
      };
    }

    const allocations = extractStrategyAllocations(liveVersion, family.meta.goal.asset);
    if (allocations.length === 0) {
      return {
        familyId,
        liveVersion: asLiveVersionTelemetry(liveVersion),
        telemetryPinnedVersion: liveVersion.version,
        targetYieldPct,
        estimatedStrategyApyPct: null,
        estimatedCumulativeYieldPct: null,
        weightingMode: 'equal-fallback',
        reviewWindow,
        protocols: [],
        chartPoints: [],
        degradedState: {
          mode: 'no-protocol-match',
          message: 'Live workflow found, but protocol allocations could not be mapped.',
          notes: [],
        },
      };
    }

    const { weightingMode, weightedAllocations } = deriveAllocationWeights(allocations);

    try {
      const pools = await this.getCachedYieldPools();
      const protocols = await enrichProtocols(
        weightedAllocations,
        family.meta.goal.asset,
        pools,
        this.deps.llama,
      );
      const chartPoints = buildStrategyYieldChart(
        protocols,
        targetYieldPct,
        Math.max(liveVersion.createdAt, Date.now() - STREAM_WINDOW_MS),
      );
      const latestPoint = chartPoints.at(-1) ?? null;

      return {
        familyId,
        liveVersion: asLiveVersionTelemetry(liveVersion),
        telemetryPinnedVersion: liveVersion.version,
        targetYieldPct,
        estimatedStrategyApyPct: latestPoint?.estimatedStrategyApyPct ?? null,
        estimatedCumulativeYieldPct: latestPoint?.estimatedCumulativeYieldPct ?? null,
        weightingMode,
        reviewWindow,
        protocols: protocols.map(stripProtocolInternals),
        chartPoints,
        degradedState: buildDegradedState({
          protocols,
          chartPointCount: chartPoints.length,
          weightingMode,
          stale: false,
        }),
      };
    } catch (error) {
      return {
        familyId,
        liveVersion: asLiveVersionTelemetry(liveVersion),
        telemetryPinnedVersion: liveVersion.version,
        targetYieldPct,
        estimatedStrategyApyPct: null,
        estimatedCumulativeYieldPct: null,
        weightingMode,
        reviewWindow,
        protocols: weightedAllocations.map((allocation) => ({
          protocolKey: allocation.protocolKey,
          protocolName: allocation.protocolName,
          chain: allocation.chain,
          asset: allocation.asset,
          allocationWeightPct: allocation.allocationWeightPct,
          currentApyPct: null,
          currentTvlUsd: null,
          marketAvailable: false,
          stale: false,
          sparkline: [],
        })),
        chartPoints: [],
        degradedState: {
          mode: 'market-unavailable',
          message: 'Market feeds are unavailable. The panel will refresh when live data returns.',
          notes: [error instanceof Error ? error.message : String(error)],
        },
      };
    }
  }

  async getSnapshot(
    familyId: string,
    previousState: StrategyTelemetryBootstrap | null,
  ): Promise<{ state: StrategyTelemetryBootstrap; snapshot: StrategyTelemetrySnapshot }> {
    const family = await loadStrategyFamilySource(this.deps, familyId);
    const liveVersion = latestLiveVersion(family.meta.versions);

    if (
      !previousState
      || previousState.telemetryPinnedVersion !== liveVersion?.version
    ) {
      const bootstrap = await this.getBootstrap(familyId);
      return {
        state: bootstrap,
        snapshot: asSnapshot(bootstrap, false),
      };
    }

    const reviewWindow = buildReviewWindow(family.meta, family.latest);

    if (!liveVersion || previousState.protocols.length === 0) {
      const state: StrategyTelemetryBootstrap = {
        ...previousState,
        liveVersion: liveVersion ? asLiveVersionTelemetry(liveVersion) : null,
        telemetryPinnedVersion: liveVersion?.version ?? null,
        reviewWindow,
        degradedState: liveVersion
          ? previousState.degradedState
          : {
            mode: 'no-live-version',
            message: 'Telemetry starts after deployment.',
            notes: [],
          },
      };

      return {
        state,
        snapshot: asSnapshot(state, false),
      };
    }

    try {
      const pools = await this.getCachedYieldPools();
      const refreshedProtocols = refreshProtocols(
        previousState.protocols,
        family.meta.goal.asset,
        pools,
      );
      const nextPoint = buildNextChartPoint(
        previousState.chartPoints.at(-1) ?? null,
        refreshedProtocols,
        previousState.targetYieldPct,
        Date.now(),
      );
      const chartPoints = trimChartPoints([
        ...previousState.chartPoints,
        nextPoint,
      ]);
      const state: StrategyTelemetryBootstrap = {
        ...previousState,
        reviewWindow,
        protocols: refreshedProtocols.map(stripProtocolInternals),
        chartPoints,
        estimatedStrategyApyPct: nextPoint.estimatedStrategyApyPct,
        estimatedCumulativeYieldPct: nextPoint.estimatedCumulativeYieldPct,
        degradedState: buildDegradedState({
          protocols: refreshedProtocols,
          chartPointCount: chartPoints.length,
          weightingMode: previousState.weightingMode,
          stale: false,
        }),
      };

      return {
        state,
        snapshot: {
          ...asSnapshot(state, false),
          chartPoint: nextPoint,
          sampledAt: nextPoint.timestamp,
        },
      };
    } catch (error) {
      const degradedState: TelemetryDegradedState = {
        mode: 'stale-market-data',
        message: 'Showing the last known live telemetry while market feeds recover.',
        notes: [error instanceof Error ? error.message : String(error)],
      };
      const state: StrategyTelemetryBootstrap = {
        ...previousState,
        reviewWindow,
        protocols: previousState.protocols.map((protocol) => ({
          ...protocol,
          stale: true,
        })),
        degradedState,
      };

      return {
        state,
        snapshot: asSnapshot(state, true),
      };
    }
  }

  private async getCachedYieldPools(): Promise<DefiLlamaPool[]> {
    const now = Date.now();
    if (this.yieldPoolsCache && this.yieldPoolsCache.expiresAt > now) {
      return this.yieldPoolsCache.value;
    }

    const result = await this.deps.llama.getYieldPools();
    if (!result.ok) {
      throw new Error(result.error);
    }

    this.yieldPoolsCache = {
      expiresAt: now + MARKET_CACHE_TTL_MS,
      value: result.value,
    };

    return result.value;
  }
}

export function extractStrategyAllocations(
  version: StrategyVersion,
  goalAsset: string,
): AllocationCandidate[] {
  const workflow = parseWorkflowSpec(version.workflowSpec);
  if (!workflow) {
    return [];
  }

  const normalizedAsset = normalizeAsset(goalAsset);
  const allocations: AllocationCandidate[] = [];

  for (const node of workflow.nodes) {
    const actionType = normalizeActionType(node);
    if (!isAllocationAction(actionType)) {
      continue;
    }

    const protocolKey = protocolKeyFromAction(actionType);
    if (!protocolKey) {
      continue;
    }

    const nodeAsset = assetFromNode(node);
    if (nodeAsset && nodeAsset !== normalizedAsset) {
      continue;
    }

    allocations.push({
      protocolKey,
      protocolName: humanizeProtocolName(protocolKey),
      chain: normalizeChain(String(node.config.network ?? fallbackChainFromNode(node) ?? 'ethereum')),
      asset: normalizedAsset,
      configuredAmount: numericAmountFromNode(node),
    });
  }

  return dedupeAllocations(allocations);
}

export function deriveAllocationWeights(
  allocations: AllocationCandidate[],
): {
  weightingMode: TelemetryWeightingMode;
  weightedAllocations: WeightedAllocation[];
} {
  const numericAllocations = allocations.filter((allocation) => allocation.configuredAmount !== null);
  if (numericAllocations.length === allocations.length && numericAllocations.length > 0) {
    const total = numericAllocations.reduce((sum, allocation) => sum + (allocation.configuredAmount ?? 0), 0);
    if (total > 0) {
      return {
        weightingMode: 'configured-amounts',
        weightedAllocations: allocations.map((allocation) => ({
          ...allocation,
          allocationWeightPct: ((allocation.configuredAmount ?? 0) / total) * 100,
        })),
      };
    }
  }

  const equalWeight = allocations.length > 0 ? 100 / allocations.length : 0;
  return {
    weightingMode: 'equal-fallback',
    weightedAllocations: allocations.map((allocation) => ({
      ...allocation,
      allocationWeightPct: equalWeight,
    })),
  };
}

export function buildReviewWindow(
  familyMeta: FamilyMetaRecord,
  latestRecord: FamilyLatestRecord | null,
): ReviewWindowTelemetry {
  const monitorIntervalMs = latestRecord?.monitorIntervalMs ?? intervalForRiskLevel(familyMeta.goal.riskLevel);
  const hasMonitoredAt =
    typeof latestRecord?.lastMonitoredAt === 'number'
    && latestRecord.lastMonitoredAt > 0;
  const source = hasMonitoredAt ? 'latest-record' : 'created-at-fallback';
  const nextReviewAt = (hasMonitoredAt ? latestRecord!.lastMonitoredAt : familyMeta.createdAt) + monitorIntervalMs;

  return {
    nextReviewAt,
    monitorIntervalMs,
    source,
  };
}

function asSnapshot(
  state: StrategyTelemetryBootstrap,
  stale: boolean,
): StrategyTelemetrySnapshot {
  const chartPoint = state.chartPoints.at(-1) ?? null;

  return {
    familyId: state.familyId,
    liveVersion: state.liveVersion,
    telemetryPinnedVersion: state.telemetryPinnedVersion,
    sampledAt: chartPoint?.timestamp ?? Date.now(),
    estimatedStrategyApyPct: state.estimatedStrategyApyPct,
    estimatedCumulativeYieldPct: state.estimatedCumulativeYieldPct,
    targetYieldPct: state.targetYieldPct,
    weightingMode: state.weightingMode,
    reviewWindow: state.reviewWindow,
    protocols: state.protocols.map((protocol) => ({
      ...protocol,
      stale: stale || protocol.stale,
    })),
    chartPoint,
    stale,
    degradedState: stale
      ? {
        ...state.degradedState,
        mode: 'stale-market-data',
      }
      : state.degradedState,
  };
}

async function loadStrategyFamilySource(
  deps: StrategyTelemetryDeps,
  familyId: string,
): Promise<StrategyFamilySource> {
  const localFamily = deps.localDb.getFamily(familyId);
  const meta = localFamily
    ? localFamilyToMetaRecord(localFamily)
    : await loadFamilyMetaOrThrow(deps, familyId);
  const latestResult = await loadFamilyLatest(deps.kvStore, familyId);
  const latest = latestResult.ok ? latestResult.value : null;

  return {
    familyId,
    meta,
    latest,
  };
}

async function loadFamilyMetaOrThrow(
  deps: StrategyTelemetryDeps,
  familyId: string,
): Promise<FamilyMetaRecord> {
  const result = await loadFamilyMeta(deps.kvStore, familyId);
  if (!result.ok) {
    throw result.error;
  }
  if (!result.value) {
    throw new Error(`Strategy family ${familyId} was not found`);
  }

  syncLocalFamily(deps.localDb, familyId, result.value);
  return result.value;
}

async function enrichProtocols(
  allocations: WeightedAllocation[],
  asset: string,
  pools: DefiLlamaPool[],
  llama: DefiLlamaClient,
): Promise<MatchedProtocolTelemetry[]> {
  return Promise.all(
    allocations.map(async (allocation) => {
      const bestPool = pickBestPool(allocation, asset, pools);
      if (!bestPool) {
        return {
          protocolKey: allocation.protocolKey,
          protocolName: allocation.protocolName,
          chain: allocation.chain,
          asset: allocation.asset,
          allocationWeightPct: allocation.allocationWeightPct,
          currentApyPct: null,
          currentTvlUsd: null,
          marketAvailable: false,
          stale: false,
          sparkline: [],
          _history: [],
        };
      }

      const historyResult = await llama.getHistoricalAPY(bestPool.pool, HISTORY_WINDOW_DAYS);
      const sparkline = historyResult.ok
        ? historyResult.value.map((point) => ({
          timestamp: point.date,
          apyPct: point.apy,
        }))
        : [];
      const dedupedSparkline = dedupeSparkline([
        ...sparkline,
        {
          timestamp: Date.now(),
          apyPct: bestPool.apy,
        },
      ]);

      return {
        protocolKey: allocation.protocolKey,
        protocolName: allocation.protocolName,
        chain: allocation.chain,
        asset: allocation.asset,
        allocationWeightPct: allocation.allocationWeightPct,
        currentApyPct: bestPool.apy,
        currentTvlUsd: bestPool.tvlUsd,
        marketAvailable: true,
        stale: false,
        sparkline: dedupedSparkline,
        sourceProject: bestPool.project,
        sourcePoolId: bestPool.pool,
        _history: dedupedSparkline,
      };
    }),
  );
}

function refreshProtocols(
  previousProtocols: ProtocolTelemetry[],
  asset: string,
  pools: DefiLlamaPool[],
): MatchedProtocolTelemetry[] {
  return previousProtocols.map((protocol) => {
    const bestPool = pickBestPool(
      {
        protocolKey: protocol.protocolKey,
        chain: protocol.chain,
      },
      asset,
      pools,
    );

    if (!bestPool) {
      return {
        ...protocol,
        marketAvailable: false,
        currentApyPct: protocol.currentApyPct,
        currentTvlUsd: protocol.currentTvlUsd,
        _history: protocol.sparkline,
      };
    }

    const sparkline = dedupeSparkline([
      ...protocol.sparkline,
      {
        timestamp: Date.now(),
        apyPct: bestPool.apy,
      },
    ]);

    return {
      ...protocol,
      currentApyPct: bestPool.apy,
      currentTvlUsd: bestPool.tvlUsd,
      marketAvailable: true,
      stale: false,
      sourceProject: bestPool.project,
      sourcePoolId: bestPool.pool,
      sparkline,
      _history: sparkline,
    };
  });
}

export function buildStrategyYieldChart(
  protocols: Array<MatchedProtocolTelemetry | ProtocolTelemetry>,
  targetYieldPct: number,
  chartStartAt: number,
): StrategyYieldPoint[] {
  const availableProtocols = protocols.filter((protocol) => protocol.currentApyPct !== null);
  if (availableProtocols.length === 0) {
    return [];
  }

  const timeline = uniqueSortedTimestamps([
    chartStartAt,
    ...availableProtocols.flatMap((protocol) => protocol.sparkline.map((point) => point.timestamp)),
  ]);

  if (timeline.length === 0) {
    return [];
  }

  const points: StrategyYieldPoint[] = [];
  let previousTimestamp = timeline[0] ?? Date.now();
  let previousApyPct = weightedApyAt(availableProtocols, previousTimestamp);
  let cumulativeYieldPct = 0;
  let targetCumulativeYieldPct = 0;

  for (const timestamp of timeline) {
    const nextApyPct = weightedApyAt(availableProtocols, timestamp);
    const elapsedMs = Math.max(0, timestamp - previousTimestamp);
    cumulativeYieldPct += previousApyPct * (elapsedMs / MS_PER_YEAR);
    targetCumulativeYieldPct += targetYieldPct * (elapsedMs / MS_PER_YEAR);

    points.push({
      timestamp,
      estimatedStrategyApyPct: nextApyPct,
      estimatedCumulativeYieldPct: cumulativeYieldPct,
      targetCumulativeYieldPct,
    });

    previousTimestamp = timestamp;
    previousApyPct = nextApyPct;
  }

  return trimChartPoints(points);
}

function buildNextChartPoint(
  previousPoint: StrategyYieldPoint | null,
  protocols: MatchedProtocolTelemetry[],
  targetYieldPct: number,
  timestamp: number,
): StrategyYieldPoint {
  const estimatedStrategyApyPct = weightedApyAt(protocols, timestamp);
  if (!previousPoint) {
    return {
      timestamp,
      estimatedStrategyApyPct,
      estimatedCumulativeYieldPct: 0,
      targetCumulativeYieldPct: 0,
    };
  }

  const elapsedMs = Math.max(0, timestamp - previousPoint.timestamp);
  return {
    timestamp,
    estimatedStrategyApyPct,
    estimatedCumulativeYieldPct:
      previousPoint.estimatedCumulativeYieldPct
      + (previousPoint.estimatedStrategyApyPct * (elapsedMs / MS_PER_YEAR)),
    targetCumulativeYieldPct:
      previousPoint.targetCumulativeYieldPct
      + (targetYieldPct * (elapsedMs / MS_PER_YEAR)),
  };
}

function weightedApyAt(protocols: Array<MatchedProtocolTelemetry | ProtocolTelemetry>, timestamp: number): number {
  const available = protocols.filter((protocol) => protocol.currentApyPct !== null);
  if (available.length === 0) {
    return 0;
  }

  const totalWeight = available.reduce((sum, protocol) => sum + protocol.allocationWeightPct, 0);
  if (totalWeight <= 0) {
    return 0;
  }

  return available.reduce((sum, protocol) => {
    const apyPct = sparklineValueAt(protocol.sparkline, timestamp, protocol.currentApyPct ?? 0);
    return sum + ((protocol.allocationWeightPct / totalWeight) * apyPct);
  }, 0);
}

function buildDegradedState(params: {
  protocols: Array<MatchedProtocolTelemetry | ProtocolTelemetry>;
  chartPointCount: number;
  weightingMode: TelemetryWeightingMode;
  stale: boolean;
}): TelemetryDegradedState {
  if (params.stale) {
    return {
      mode: 'stale-market-data',
      message: 'Showing the last known telemetry while live market feeds recover.',
      notes: [],
    };
  }

  if (params.protocols.length === 0) {
    return {
      mode: 'no-protocol-match',
      message: 'Live workflow found, but protocol allocations could not be mapped.',
      notes: [],
    };
  }

  const availableCount = params.protocols.filter((protocol) => protocol.marketAvailable).length;
  if (availableCount === 0) {
    return {
      mode: 'market-unavailable',
      message: 'Protocol cards are present, but live market feeds are unavailable right now.',
      notes: params.weightingMode === 'equal-fallback'
        ? ['Allocation weights are estimated evenly because node amounts were not readable.']
        : [],
    };
  }

  if (params.chartPointCount <= 1) {
    return {
      mode: 'partial-history',
      message: 'Live telemetry is connected. Historical seed data is still sparse.',
      notes: params.weightingMode === 'equal-fallback'
        ? ['Allocation weights are estimated evenly because node amounts were not readable.']
        : [],
    };
  }

  if (params.weightingMode === 'equal-fallback') {
    return {
      mode: 'partial-history',
      message: 'Live telemetry is estimated from evenly weighted protocol exposure.',
      notes: ['Node amounts were templated or unavailable, so protocol weights are evenly estimated.'],
    };
  }

  return {
    mode: 'healthy',
    message: 'Live telemetry is flowing normally.',
    notes: [],
  };
}

function pickBestPool(
  allocation: Pick<WeightedAllocation, 'protocolKey' | 'chain'>,
  asset: string,
  pools: DefiLlamaPool[],
): DefiLlamaPool | null {
  const assetKey = normalizeAsset(asset);
  const protocolAliases = protocolAliasesFor(allocation.protocolKey);
  const chainKey = normalizeChain(allocation.chain);

  const candidates = pools.filter((pool) => {
    const projectKey = normalizeProtocolKey(pool.project);
    const chain = normalizeChain(pool.chain);
    const symbol = normalizeAsset(pool.symbol);
    return protocolAliases.includes(projectKey) && chain === chainKey && symbol.includes(assetKey);
  });

  if (candidates.length === 0) {
    return null;
  }

  return candidates.sort((left, right) => right.tvlUsd - left.tvlUsd)[0] ?? null;
}

function stripProtocolInternals(protocol: MatchedProtocolTelemetry): ProtocolTelemetry {
  return {
    protocolKey: protocol.protocolKey,
    protocolName: protocol.protocolName,
    chain: protocol.chain,
    asset: protocol.asset,
    allocationWeightPct: protocol.allocationWeightPct,
    currentApyPct: protocol.currentApyPct,
    currentTvlUsd: protocol.currentTvlUsd,
    marketAvailable: protocol.marketAvailable,
    stale: protocol.stale,
    sparkline: protocol.sparkline,
    sourceProject: protocol.sourceProject,
    sourcePoolId: protocol.sourcePoolId,
  };
}

function latestLiveVersion(versions: StrategyVersion[]): StrategyVersion | null {
  return versions
    .filter((version) => version.lifecycle === 'live')
    .sort((left, right) => right.version - left.version)[0] ?? null;
}

function asLiveVersionTelemetry(version: StrategyVersion): LiveVersionTelemetry {
  return {
    version: version.version,
    createdAt: version.createdAt,
    ...(version.keeperhubWorkflowId ? { keeperhubWorkflowId: version.keeperhubWorkflowId } : {}),
  };
}

function dedupeAllocations(allocations: AllocationCandidate[]): AllocationCandidate[] {
  const seen = new Set<string>();
  const unique: AllocationCandidate[] = [];

  for (const allocation of allocations) {
    const key = `${allocation.protocolKey}:${allocation.chain}:${allocation.asset}:${allocation.configuredAmount ?? 'na'}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(allocation);
  }

  return unique;
}

function trimChartPoints(points: StrategyYieldPoint[]): StrategyYieldPoint[] {
  const cutoff = Date.now() - STREAM_WINDOW_MS;
  return points.filter((point, index, list) => point.timestamp >= cutoff || index === list.length - 1);
}

function dedupeSparkline(points: ProtocolSparklinePoint[]): ProtocolSparklinePoint[] {
  const byTimestamp = new Map<number, ProtocolSparklinePoint>();
  for (const point of points) {
    byTimestamp.set(point.timestamp, point);
  }
  return Array.from(byTimestamp.values())
    .sort((left, right) => left.timestamp - right.timestamp)
    .filter((point) => point.timestamp >= Date.now() - STREAM_WINDOW_MS);
}

function uniqueSortedTimestamps(values: number[]): number[] {
  return Array.from(new Set(values))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);
}

function sparklineValueAt(
  points: ProtocolSparklinePoint[],
  timestamp: number,
  fallback: number,
): number {
  let last = fallback;
  for (const point of points) {
    if (point.timestamp > timestamp) {
      break;
    }
    last = point.apyPct;
  }
  return last;
}

function assetFromNode(node: WorkflowNode): string | null {
  const asset = node.config.asset;
  if (typeof asset === 'string' && asset.trim().length > 0) {
    return normalizeAsset(asset);
  }

  const label = typeof node.label === 'string' ? node.label : '';
  const match = /\b(USDC|USDT|DAI|WETH|ETH|WBTC)\b/i.exec(label);
  const matchedAsset = match?.[1];
  return matchedAsset ? normalizeAsset(matchedAsset) : null;
}

function numericAmountFromNode(node: WorkflowNode): number | null {
  const raw = node.config.amount ?? node.config.assets;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return raw;
  }

  if (typeof raw !== 'string') {
    return null;
  }

  if (raw.includes('{{')) {
    return null;
  }

  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeActionType(node: WorkflowNode): string {
  if (typeof node.type === 'string' && node.type.length > 0) {
    return node.type.toLowerCase();
  }

  const actionType = node.config.actionType;
  return typeof actionType === 'string' ? actionType.toLowerCase() : '';
}

function isAllocationAction(actionType: string): boolean {
  return (
    actionType.includes('/supply')
    || actionType.includes('/deposit')
    || actionType.includes('vault-deposit')
  ) && !actionType.includes('approve');
}

function protocolKeyFromAction(actionType: string): string | null {
  const rawPrefix = actionType.split(/[/:]/)[0]?.trim();
  if (!rawPrefix) {
    return null;
  }
  return normalizeProtocolKey(rawPrefix);
}

function humanizeProtocolName(protocolKey: string): string {
  return protocolKey
    .split(/[-_]/g)
    .map((part) => part.toUpperCase() === 'V3' || part.toUpperCase() === 'V2'
      ? part.toUpperCase()
      : part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function fallbackChainFromNode(node: WorkflowNode): string | null {
  const label = typeof node.label === 'string' ? node.label.toLowerCase() : '';
  if (label.includes('base')) return 'base';
  if (label.includes('arbitrum')) return 'arbitrum';
  return null;
}

function normalizeAsset(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeChain(value: string): string {
  const key = value.trim().toLowerCase();
  switch (key) {
    case '1':
    case 'eth':
    case 'ethereum':
      return 'ethereum';
    case '8453':
    case 'base':
      return 'base';
    case '42161':
    case 'arbitrum':
      return 'arbitrum';
    case '10':
    case 'optimism':
      return 'optimism';
    case '137':
    case 'polygon':
      return 'polygon';
    case '43114':
    case 'avalanche':
      return 'avalanche';
    default:
      return key;
  }
}

function normalizeProtocolKey(value: string): string {
  return value.trim().toLowerCase();
}

function protocolAliasesFor(protocolKey: string): string[] {
  const aliases: Record<string, string[]> = {
    'aave-v3': ['aave-v3', 'aave'],
    morpho: ['morpho', 'morpho-blue'],
    compound: ['compound-v3', 'compound'],
    spark: ['spark', 'spark-lend'],
    yearn: ['yearn-finance', 'yearn'],
  };
  return aliases[protocolKey] ?? [protocolKey];
}

function intervalForRiskLevel(riskLevel: FamilyMetaRecord['goal']['riskLevel']): number {
  switch (riskLevel) {
    case 'conservative':
      return 24 * 60 * 60 * 1_000;
    case 'balanced':
      return 6 * 60 * 60 * 1_000;
  }
}
