import { test, expect, describe } from 'bun:test';
import { SealedInference } from '../src/sealed-inference';
import { ProxyInference } from '../src/proxy-inference';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '../../.env') });

describe('Compute Smoke Tests', () => {
    test('Should initialize SealedInference and perform inference', async () => {
        const privateKey = process.env.PRIVATE_KEY;
        const evmRpc = process.env.OG_RPC_URL || process.env.OG_EVM_RPC || process.env.EVM_RPC;

        if (!privateKey || !evmRpc) {
            throw new Error('Missing PRIVATE_KEY or OG_RPC_URL in .env');
        }

        const compute = new SealedInference({
            privateKey,
            evmRpc
        });

        const initResult = await compute.init();
        if (!initResult.ok) console.error('Init error:', initResult.error);
        expect(initResult.ok).toBe(true);

        const inferenceResult = await compute.infer({
            systemPrompt: 'You are an intelligent assistant.',
            userPrompt: 'Say hello in one word.'
        });

        if (!inferenceResult.ok) console.error('Inference error:', inferenceResult.error);
        expect(inferenceResult.ok).toBe(true);
        if (inferenceResult.ok) {
            expect(inferenceResult.value.response).toBeTruthy();
            expect(inferenceResult.value.attestationHash).toBeTruthy();
            console.log('Attestation Hash:', inferenceResult.value.attestationHash);
            console.log('Response:', inferenceResult.value.response);
        }
    }, 60000); // give it a 60-second timeout for remote inference

    test('Should perform inference natively via Proxy API Key', async () => {
        const apiKey = process.env['0G_COMPUTE_API_KEY'];
        if (!apiKey) {
            throw new Error('Missing 0G_COMPUTE_API_KEY in .env');
        }

        const compute = new ProxyInference({ apiKey });

        await compute.init();

        const inferenceResult = await compute.infer({
            systemPrompt: 'You are a helpful assistant.',
            userPrompt: 'Say exactly: "Hello! Proxy works!"'
        });

        if (!inferenceResult.ok) console.error('Proxy Inference error:', inferenceResult.error);
        expect(inferenceResult.ok).toBe(true);

        if (inferenceResult.ok) {
            expect(inferenceResult.value.response).toBeTruthy();
            console.log('Proxy Attestation Hash:', inferenceResult.value.attestationHash);
            console.log('Proxy Response:', inferenceResult.value.response);
        }
    }, 60000);
});
