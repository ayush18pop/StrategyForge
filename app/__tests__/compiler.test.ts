import { describe, it, expect } from 'vitest';
import { compileWorkflow } from '../lib/pipeline/compiler';

const mockCandidate = {
    id: 'A',
    name: 'Test Strategy',
    workflow: {
        name: 'Test',
        nodes: [
            {
                id: 'check',
                type: 'action',
                data: {
                    type: 'aave-v3/get-user-account-data',
                    config: { userAddress: 'USER_WALLET', networkId: 'CHAIN_ID' },
                    status: 'idle',
                },
                position: { x: 120, y: 240 },
            },
        ],
        edges: [],
    },
};

describe('compileWorkflow', () => {
    it('replaces USER_WALLET placeholder', () => {
        const result = compileWorkflow(mockCandidate, '0xABCDEF');
        expect(result.nodes[0].data.config.userAddress).toBe('0xABCDEF');
    });

    it('replaces CHAIN_ID placeholder with Sepolia by default', () => {
        const result = compileWorkflow(mockCandidate, '0xABCDEF');
        expect(result.nodes[0].data.config.networkId).toBe('11155111');
    });

    it('replaces CHAIN_ID with provided chainId', () => {
        const result = compileWorkflow(mockCandidate, '0xABCDEF', '8453');
        expect(result.nodes[0].data.config.networkId).toBe('8453');
    });

    it('ensures nodes and edges arrays exist', () => {
        const candidate = { id: 'A', name: 'T', workflow: { name: 'T' } };
        const result = compileWorkflow(candidate as any, '0xABC');
        expect(Array.isArray(result.nodes)).toBe(true);
        expect(Array.isArray(result.edges)).toBe(true);
    });

    it('preserves workflow name', () => {
        const result = compileWorkflow(mockCandidate, '0xABC');
        expect(result.name).toBe('Test');
    });
});
