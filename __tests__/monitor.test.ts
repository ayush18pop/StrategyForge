import { describe, it, expect } from 'vitest';
import { detectSuboptimal } from '../lib/monitor';

const baseExec = {
    stepLogs: [],
    outcome: { metrics: {} },
};

describe('detectSuboptimal', () => {
    it('returns false for clean execution', () => {
        const result = detectSuboptimal(baseExec, 'monitor aave health');
        expect(result.suboptimal).toBe(false);
        expect(result.reason).toBeNull();
    });

    it('detects false positive when discord alert fires at high health factor', () => {
        const exec = {
            stepLogs: [
                { actionType: 'discord/send-message', status: 'success', output: {}, error: null },
            ],
            outcome: { metrics: { healthFactor: 1.62 } },
        };
        const result = detectSuboptimal(exec, 'monitor aave health');
        expect(result.suboptimal).toBe(true);
        expect(result.reason).toContain('1.62');
        expect(result.reason).toContain('false positive');
    });

    it('does NOT flag as false positive when health factor is below 1.4', () => {
        const exec = {
            stepLogs: [
                { actionType: 'discord/send-message', status: 'success', output: {}, error: null },
            ],
            outcome: { metrics: { healthFactor: 1.2 } },
        };
        const result = detectSuboptimal(exec, 'monitor aave health');
        expect(result.suboptimal).toBe(false);
    });

    it('detects failed step', () => {
        const exec = {
            stepLogs: [
                { actionType: 'aave-v3/get-user-account-data', status: 'failed', output: {}, error: 'RPC timeout' },
            ],
            outcome: { metrics: {} },
        };
        const result = detectSuboptimal(exec, 'monitor aave health');
        expect(result.suboptimal).toBe(true);
        expect(result.reason).toContain('aave-v3/get-user-account-data');
        expect(result.reason).toContain('RPC timeout');
    });

    it('handles missing stepLogs gracefully', () => {
        const result = detectSuboptimal({ outcome: { metrics: {} } }, 'monitor');
        expect(result.suboptimal).toBe(false);
    });
});
