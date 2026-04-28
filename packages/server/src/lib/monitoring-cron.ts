/**
 * StrategyForge Monitoring Cron
 *
 * Runs periodically inside the server process (NOT a KeeperHub workflow).
 * Checks all tracked families for execution failures or drift,
 * and triggers the UpdateOrchestrator when thresholds are exceeded.
 *
 * Per architecture.md: 24h interval (configurable), node-cron based.
 */

import type { AppDeps } from '../factory.js';
import { listFamilyIds, loadFamilyLatest } from './kv-meta.js';
import { AnalyticsOutcomeFetcher } from '@strategyforge/pipeline';
import type { UpdateTrigger } from '@strategyforge/core';

// ─── Configuration ──────────────────────────────────────────────

const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const FAILURE_THRESHOLD = 2;   // 2+ failures in recent runs
const SUCCESS_RATE_FLOOR = 0.90; // Below 90% triggers underperformance

let cronTimer: ReturnType<typeof setInterval> | null = null;

// ─── Public API ─────────────────────────────────────────────────

export function startMonitoringCron(deps: AppDeps): void {
    const intervalMs = Number(process.env.MONITOR_CRON_INTERVAL_MS) || DEFAULT_INTERVAL_MS;
    console.log(`[MonitorCron] Starting — interval: ${intervalMs / 1000}s`);

    // Run once shortly after startup (30s delay), then every interval
    setTimeout(() => void runMonitoringCycle(deps), 30_000);
    cronTimer = setInterval(() => void runMonitoringCycle(deps), intervalMs);
}

export function stopMonitoringCron(): void {
    if (cronTimer) {
        clearInterval(cronTimer);
        cronTimer = null;
        console.log('[MonitorCron] Stopped');
    }
}

// ─── Core Cycle ─────────────────────────────────────────────────

async function runMonitoringCycle(deps: AppDeps): Promise<void> {
    console.log('[MonitorCron] Starting monitoring cycle...');

    const familiesResult = await listFamilyIds(deps.kvStore);
    if (!familiesResult.ok) {
        console.warn('[MonitorCron] Failed to list families');
        return;
    }

    const familyIds = familiesResult.value;
    if (familyIds.length === 0) {
        console.log('[MonitorCron] No families tracked — skipping');
        return;
    }

    console.log(`[MonitorCron] Checking ${familyIds.length} families...`);

    for (const familyId of familyIds) {
        try {
            await checkFamily(deps, familyId);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.warn(`[MonitorCron] Error checking ${familyId}: ${msg}`);
        }
    }

    console.log('[MonitorCron] Cycle complete');
}

async function checkFamily(deps: AppDeps, familyId: string): Promise<void> {
    const familyResult = await loadFamilyLatest(deps.kvStore, familyId);
    if (!familyResult.ok || !familyResult.value) {
        return; // No data yet
    }

    const family = familyResult.value;
    const workflowId = family.keeperhubWorkflowId;
    if (!workflowId) {
        return; // Not deployed yet
    }

    // Fetch analytics from KeeperHub
    const fetcher = new AnalyticsOutcomeFetcher({
        apiUrl: process.env.KEEPERHUB_API_URL ?? '',
        apiKey: process.env.KEEPERHUB_API_KEY ?? '',
        workflowId,
    });

    const analyticsResult = await fetcher.fetch();
    if (!analyticsResult.ok) {
        console.log(`[MonitorCron] ${familyId}: analytics unavailable (${analyticsResult.error.message})`);
        return;
    }

    const analytics = analyticsResult.value;

    // Evaluate triggers
    let trigger: UpdateTrigger | null = null;

    if (analytics.successRate < SUCCESS_RATE_FLOOR) {
        trigger = {
            reason: 'underperformance',
            actualVsPredicted: analytics.successRate,
        };
    } else if (analytics.failedRuns.length >= FAILURE_THRESHOLD) {
        trigger = {
            reason: 'underperformance',
            actualVsPredicted: analytics.successRate,
        };
    }

    if (!trigger) {
        console.log(`[MonitorCron] ${familyId}: healthy (${(analytics.successRate * 100).toFixed(1)}% success)`);
        return;
    }

    console.log(`[MonitorCron] ${familyId}: triggering update — ${trigger.reason}`);

    // Trigger the update pipeline
    const updateResult = await deps.updateOrchestrator.update({ familyId, trigger });
    if (!updateResult.ok) {
        console.warn(`[MonitorCron] ${familyId}: update failed — ${updateResult.error.message}`);
        return;
    }

    console.log(`[MonitorCron] ${familyId}: v${updateResult.value.strategy.version} created`);
}
