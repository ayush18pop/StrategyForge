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

    // Pattern 2: Workflow step failed (check status OR error presence)
    const failedStep = execution.stepLogs?.find((l: any) =>
        l.status === 'failed' ||
        (l.error && l.error.length > 0) ||
        l.error?.message ||
        (l.output?.error && typeof l.output.error === 'string')
    );
    if (failedStep) {
        const errorMsg = failedStep.error ||
                        failedStep.output?.error ||
                        'unknown error';
        const actionLabel = failedStep.actionType || failedStep.stepId || 'unknown action';

        // Parse out protocol/network from the error message for a more actionable reason
        const notDeployedMatch = errorMsg.match?.(/Protocol "([^"]+)" .* not deployed on network "([^"]+)"/i);
        if (notDeployedMatch) {
            const [, protocol, network] = notDeployedMatch;
            return {
                suboptimal: true,
                reason: `Action "${actionLabel}" failed because protocol "${protocol}" is NOT deployed on network "${network}". ` +
                        `DO NOT use any "${protocol}" actions on "${network}" in the next version. ` +
                        `Use a different protocol that is available on "${network}", or change the target network.`
            };
        }

        return {
            suboptimal: true,
            reason: `Action "${actionLabel}" failed with error: ${errorMsg}. Avoid this action or fix its configuration in the next version.`
        };
    }

    // Pattern 3: Better yield available but not taken (yield optimization strategies)
    // Add protocol-specific checks here

    return { suboptimal: false, reason: null };
}
