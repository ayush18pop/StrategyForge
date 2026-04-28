/**
 * StrategyForge Monitoring Cron
 *
 * A single ticker fires every TICK_MS (default 5 min).
 * Each tick checks every tracked family, but only acts on those
 * whose per-family monitorIntervalMs has elapsed since lastMonitoredAt.
 *
 * Interval per family is derived from riskLevel at creation time:
 *   conservative → 24 h
 *   balanced     →  6 h
 */

import type { AppDeps } from '../factory.js';
import { listFamilyIds, loadFamilyLatest, touchLastMonitored } from './kv-meta.js';
import { AnalyticsOutcomeFetcher } from '@strategyforge/pipeline';
import type { UpdateTrigger } from '@strategyforge/core';

// ─── Configuration ──────────────────────────────────────────────

const DEFAULT_TICK_MS = 5 * 60 * 1000;   // how often we scan all families
const FAILURE_THRESHOLD = 2;
const SUCCESS_RATE_FLOOR = 0.90;

let cronTimer: ReturnType<typeof setInterval> | null = null;

// ─── Public API ─────────────────────────────────────────────────

export function startMonitoringCron(deps: AppDeps): void {
    const tickMs = Number(process.env.MONITOR_TICK_MS) || DEFAULT_TICK_MS;
    console.log(`[MonitorCron] Starting — tick every ${tickMs / 1000}s, per-family intervals from riskLevel`);

    // First tick 30 s after startup so the server is fully ready.
    setTimeout(() => void runTick(deps), 30_000);
    cronTimer = setInterval(() => void runTick(deps), tickMs);
}

export function stopMonitoringCron(): void {
    if (cronTimer) {
        clearInterval(cronTimer);
        cronTimer = null;
        console.log('[MonitorCron] Stopped');
    }
}

// ─── Tick ────────────────────────────────────────────────────────

async function runTick(deps: AppDeps): Promise<void> {
    const localFamilyIds = deps.localDb.listFamilies().map((family) => family.familyId);
    const familiesResult = localFamilyIds.length === 0
        ? await listFamilyIds(deps.kvStore)
        : { ok: true as const, value: localFamilyIds };

    if (!familiesResult.ok) {
        console.warn('[MonitorCron] Failed to list families');
        return;
    }

    const familyIds = familiesResult.value;
    if (familyIds.length === 0) return;

    const now = Date.now();
    let due = 0;

    for (const familyId of familyIds) {
        try {
            const checked = await maybeCheckFamily(deps, familyId, now);
            if (checked) due++;
        } catch (e) {
            console.warn(`[MonitorCron] Error checking ${familyId}:`, (e as Error).message);
        }
    }

    if (due > 0) {
        console.log(`[MonitorCron] Tick complete — checked ${due}/${familyIds.length} families`);
    }
}

// Returns true if the family was due and we ran a check.
async function maybeCheckFamily(
    deps: AppDeps,
    familyId: string,
    now: number,
): Promise<boolean> {
    const familyResult = await loadFamilyLatest(deps.kvStore, familyId);
    if (!familyResult.ok || !familyResult.value) return false;

    const family = familyResult.value;

    // Skip if not yet due.
    const elapsed = now - family.lastMonitoredAt;
    if (elapsed < family.monitorIntervalMs) return false;

    const workflowId = family.keeperhubWorkflowId;
    if (!workflowId) return false;

    // Fetch analytics from KeeperHub.
    const fetcher = new AnalyticsOutcomeFetcher({
        apiUrl: process.env.KEEPERHUB_API_URL ?? '',
        apiKey: process.env.KEEPERHUB_API_KEY ?? '',
        workflowId,
    });

    const analyticsResult = await fetcher.fetch();
    if (!analyticsResult.ok) {
        console.log(`[MonitorCron] ${familyId}: analytics unavailable (${analyticsResult.error.message})`);
        // Still advance the clock so we don't hammer a failing endpoint.
        await touchLastMonitored(deps.kvStore, familyId);
        return true;
    }

    const analytics = analyticsResult.value;
    const trigger = buildTrigger(analytics);

    if (!trigger) {
        const pct = (analytics.successRate * 100).toFixed(1);
        const nextCheckIn = Math.round((family.monitorIntervalMs - elapsed) / 60_000);
        console.log(`[MonitorCron] ${familyId}: healthy (${pct}%) — next check in ~${nextCheckIn}min`);
        await touchLastMonitored(deps.kvStore, familyId);
        return true;
    }

    console.log(`[MonitorCron] ${familyId}: triggering update — ${trigger.reason}`);

    const updateResult = await deps.updateOrchestrator.update({ familyId, trigger });
    if (!updateResult.ok) {
        console.warn(`[MonitorCron] ${familyId}: update failed — ${updateResult.error.message}`);
    } else {
        console.log(`[MonitorCron] ${familyId}: v${updateResult.value.strategy.version} created`);
    }

    await touchLastMonitored(deps.kvStore, familyId);
    return true;
}

function buildTrigger(analytics: { successRate: number; failedRuns: unknown[] }): UpdateTrigger | null {
    if (analytics.successRate < SUCCESS_RATE_FLOOR) {
        return { reason: 'underperformance', actualVsPredicted: analytics.successRate };
    }
    if (analytics.failedRuns.length >= FAILURE_THRESHOLD) {
        return { reason: 'underperformance', actualVsPredicted: analytics.successRate };
    }
    return null;
}
