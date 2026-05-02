export function detectSuboptimal(
    execution: any,
    strategyGoal: string
): { suboptimal: boolean; reason: string | null } {

    // Pattern 1: Alert fired but condition was borderline (false positive)
    const alertFired = execution.stepLogs?.some((l: any) =>
        l.actionType?.includes('discord') || l.actionType?.includes('telegram') || l.actionType?.includes('slack')
    );

    const healthFactor = execution.outcome?.metrics?.healthFactor;

    if (alertFired && healthFactor && healthFactor > 1.4) {
        return {
            suboptimal: true,
            reason: `Alert fired but health factor was ${healthFactor} (above 1.4) — threshold too sensitive, causing false positive`
        };
    }

    // Pattern 2: Workflow step failed
    const failedStep = execution.stepLogs?.find((l: any) => l.status === 'failed');
    if (failedStep) {
        return {
            suboptimal: true,
            reason: `Step "${failedStep.actionType}" failed: ${failedStep.error}`
        };
    }

    // Pattern 3: Better yield available but not taken (yield optimization strategies)
    // Add protocol-specific checks here

    return { suboptimal: false, reason: null };
}
