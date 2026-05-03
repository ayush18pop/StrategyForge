import { NextResponse } from 'next/server';
import { connectDB } from '../../../../lib/db/mongoose';
import { Strategy } from '../../../../lib/db/strategy.model';
import { Execution } from '../../../../lib/db/execution.model';
import { User } from '../../../../lib/db/user.model';
import { KeeperHubClient } from '../../../../lib/keeperhub';
import { detectSuboptimal } from '../../../../lib/monitor';
import { ledgerRecord } from '../../../../lib/contracts';

async function pollStatus(kh: KeeperHubClient, executionId: string, maxMs = 60000) {
    const interval = 2000;
    const maxAttempts = maxMs / interval;
    for (let i = 0; i < maxAttempts; i++) {
        const status = await kh.getExecutionStatus(executionId);
        if (['completed', 'failed', 'success', 'error', 'cancelled', 'stopped'].includes(status.status)) {
            return status;
        }
        await new Promise(r => setTimeout(r, interval));
    }
    return { status: 'timeout' };
}

function mapStepStatus(status: string | undefined, hasError: boolean | string): string {
  if (status === "success" || status === "succeeded") return "success";
  if (status === "failed" || status === "error" || hasError) return "failed";
  if (status === "skipped") return "skipped";
  return hasError ? "failed" : "success";
}

export async function POST(req: Request) {
    try {
        const { strategyId } = await req.json();
        await connectDB();

        const strategy = await Strategy.findById(strategyId);
        if (!strategy) return NextResponse.json({ error: 'Strategy not found' }, { status: 404 });
        if (!strategy.keeperhubWorkflowId) return NextResponse.json({ error: 'Strategy not deployed yet' }, { status: 400 });

        const user = await User.findById(strategy.userId);
        const kh = new KeeperHubClient(user.keeperhubApiKey);

        // Trigger execution
        const execResponse = await kh.executeWorkflow(strategy.keeperhubWorkflowId);
        const keeperhubExecutionId: string = execResponse.executionId ?? execResponse.id ?? 'unknown';

        // Save execution as running
        const execution = await Execution.create({
            strategyId,
            keeperhubExecutionId,
            status: 'running',
            stepLogs: [],
        });

        // Poll for completion (best-effort, 60s max)
        let finalStatus: any = { status: 'running' };
        let stepLogs: any[] = [];
        try {
            finalStatus = await pollStatus(kh, keeperhubExecutionId);
            const logsResponse = await kh.getExecutionLogs(keeperhubExecutionId);
            stepLogs = logsResponse.logs ?? logsResponse.steps ?? [];
        } catch {
            // Best-effort — continue with partial data
        }

        const mappedStatus = finalStatus.status === 'completed' ? 'success'
            : finalStatus.status === 'failed' ? 'failed'
            : finalStatus.status === 'error' ? 'failed' : finalStatus.status === 'timeout' ? 'partial'
            : 'running';

        // Extract metrics from logs (look for health factor, yield)
        const metrics: Record<string, any> = {};
        for (const log of stepLogs) {
            const out = log.output ?? {};
            if (out.healthFactor) metrics.healthFactor = Number(out.healthFactor);
            if (out.currentLiquidityRate) metrics.currentLiquidityRate = out.currentLiquidityRate;
        }

        // Detect suboptimal
        execution.stepLogs = stepLogs.map((l: any) => ({
            stepId: l.stepId ?? l.id,
            actionType: l.actionType ?? l.type,
            status: mapStepStatus(l.status, l.error || l.output?.error),
            output: l.output ?? {},
            txHash: l.txHash ?? null,
            error: l.error ?? null,
        }));
        execution.outcome = { suboptimal: false, suboptimalReason: null, metrics };
        execution.status = mappedStatus;
        execution.completedAt = new Date();

        const suboptimalResult = detectSuboptimal(execution, strategy.goal);
        execution.outcome = { ...suboptimalResult, metrics } as any;
        await execution.save();

        // Write to ReputationLedger on 0G Chain (best-effort)
        let reputationTxHash: string | null = null;
        try {
            const agentId = strategy.onChainAgentId ?? 1; // fallback for legacy strategies
            const successRateBps = suboptimalResult.suboptimal ? 0 : 10000;
            const result = await ledgerRecord(
                agentId,
                strategy.familyId,
                successRateBps,
                strategyId.toString(),
            );
            reputationTxHash = result.txHash;
            strategy.reputationLedgerTxHash = reputationTxHash;
            await strategy.save();
        } catch {
            // Non-critical — log silently
        }

        return NextResponse.json({
            executionId: execution._id,
            keeperhubExecutionId,
            status: mappedStatus,
            stepLogs,
            suboptimal: suboptimalResult.suboptimal,
            suboptimalReason: suboptimalResult.reason,
            reputationTxHash,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
