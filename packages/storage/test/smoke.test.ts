import { test, expect, describe } from 'bun:test';
import { KVStore } from '../src/kv-store';
import { EvidenceStore } from '../src/evidence-store';
import type { EvidenceBundle } from '../src/core';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '../../.env') });

describe('Storage Smoke Tests', () => {
    test('Should initialize KVStore, set a value and read it back', async () => {
        const privateKey = process.env.PRIVATE_KEY;
        const evmRpc = process.env.OG_RPC_URL || process.env.OG_EVM_RPC || process.env.EVM_RPC;
        const kvNodeRpc = process.env.ZG_KV_NODE_RPC || "http://3.101.147.150:6789";
        const streamId = process.env.ZG_KV_STREAM_ID || "0x0000000000000000000000000000000000000000000000000000000000000000";

        if (!privateKey || !evmRpc || !kvNodeRpc || !streamId) {
            throw new Error('Missing KVStore configuration in .env');
        }

        const kv = new KVStore({
            privateKey,
            evmRpc,
            kvNodeRpc,
            streamId,
            replicaCount: 1
        });

        const testKey = `smoke-test-key-${Date.now()}`;
        const testValue = `smoke-test-value-${Date.now()}`;

        const setResult = await kv.set(testKey, testValue);
        if (!setResult.ok) console.error('KV set failed:', setResult.error);
        expect(setResult.ok).toBe(true);

        // Give data a bit of time to settle in testnet nodes before querying
        await new Promise(r => setTimeout(r, 2000));

        const getResult = await kv.get(testKey);
        if (!getResult.ok) console.error('KV get failed:', getResult.error);
        expect(getResult.ok).toBe(true);
        if (getResult.ok) {
            expect(getResult.value).toBe(testValue);
            console.log(`KVStore: Successfully set and mapped ${testKey} to ${testValue}`);
        }
    }, 60000);

    test('Should initialize EvidenceStore, write bundle and read it back', async () => {
        const privateKey = process.env.PRIVATE_KEY;
        const evmRpc = process.env.OG_EVM_RPC || process.env.OG_RPC_URL || process.env.EVM_RPC;
        const indexerUrl = process.env.OG_INDEXER || process.env.ZG_INDEXER_URL;

        if (!privateKey || !evmRpc || !indexerUrl) {
            throw new Error('Missing EvidenceStore configuration in .env');
        }

        const store = new EvidenceStore({
            privateKey,
            evmRpc,
            indexerUrl
        });

        const testBundle: EvidenceBundle = {
            strategyFamily: 'smoke-test-family',
            version: 1,
            priorCids: [],
            createdAt: Date.now(),
            pipeline: {
                step1_universe: { test: true }
            },
            outcomes: null
        };

        const writeResult = await store.writeBundle(testBundle);
        if (!writeResult.ok) console.error('Evidence write failed:', writeResult.error);
        expect(writeResult.ok).toBe(true);

        if (writeResult.ok) {
            const cid = writeResult.value.cid;
            console.log(`EvidenceStore: Written dummy bundle with CID: ${cid}`);
            expect(cid).toBeTruthy();

            // Settle on indexer buffer
            await new Promise(r => setTimeout(r, 3000));

            const readResult = await store.readBundle(cid);
            if (!readResult.ok) console.error('Evidence read failed:', readResult.error);
            expect(readResult.ok).toBe(true);

            if (readResult.ok) {
                expect(readResult.value.strategyFamily).toBe('smoke-test-family');
                expect(readResult.value.version).toBe(1);
            }
        }
    }, 120000);
});
