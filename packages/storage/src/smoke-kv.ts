#!/usr/bin/env bun
/**
 * Smoke test for 0G KV storage — hits real network, logs every step.
 *
 * Usage:
 *   cd packages/storage
 *   bun run src/smoke-kv.ts
 *
 * Reads env from packages/server/.env (same config the server uses).
 */

import { config } from "dotenv";
import { resolve } from "node:path";

// Load the server's .env so we get the same credentials
config({ path: resolve(import.meta.dir, "../../server/.env") });

const PRIVATE_KEY = process.env.PRIVATE_KEY!;
const EVM_RPC = process.env.OG_EVM_RPC!;
const INDEXER_URL = process.env.OG_INDEXER!;
const STREAM_ID = process.env.OG_STREAM_ID!;
const KV_NODE_RPC = process.env.OG_KV_NODE_RPC;
const STORAGE_URL = process.env.OG_STORAGE_URL; // local storage node (port 5678)

console.log("═══════════════════════════════════════════════════");
console.log("  0G KV Storage Smoke Test");
console.log("═══════════════════════════════════════════════════");
console.log(`  EVM RPC:     ${EVM_RPC}`);
console.log(`  Indexer:     ${INDEXER_URL}`);
console.log(`  Stream ID:   ${STREAM_ID}`);
console.log(`  KV Node RPC: ${KV_NODE_RPC ?? "(not set — will use indexer)"}`);
console.log(`  Private Key: ${PRIVATE_KEY?.slice(0, 10)}...`);
console.log("═══════════════════════════════════════════════════\n");

// ─── Step 1: Load SDK ────────────────────────────────────────────
console.log("[1/7] Loading 0G SDK...");
const t0 = Date.now();
import { loadStorageSdk } from "./sdk.js";
const sdkResult = await loadStorageSdk();
if (!sdkResult.ok) {
    console.error("  ✗ SDK load failed:", sdkResult.error.message);
    process.exit(1);
}
const { Indexer, Batcher, StorageNode, KvClient, getFlowContract } = sdkResult.value;
console.log(`  ✓ SDK loaded (${Date.now() - t0}ms)\n`);

// ─── Step 2: Create signer ──────────────────────────────────────
console.log("[2/7] Creating ethers signer...");
const t1 = Date.now();
import { createSigner } from "./ethers.js";
const signerResult = await createSigner(PRIVATE_KEY, EVM_RPC);
if (!signerResult.ok) {
    console.error("  ✗ Signer creation failed:", signerResult.error.message);
    process.exit(1);
}
const signer = signerResult.value;
console.log(`  ✓ Signer ready (${Date.now() - t1}ms)\n`);

// ─── Helper: race with timeout ──────────────────────────────────
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
        ),
    ]);
}

// ─── Step 3: Resolve flow address ───────────────────────────────
console.log("[3/7] Resolving flow address...");
const t2 = Date.now();

const FLOW_ADDRESS_OVERRIDE = process.env.OG_FLOW_CONTRACT_ADDRESS;

let flowAddress: string;

if (FLOW_ADDRESS_OVERRIDE) {
    console.log(`  Using OG_FLOW_CONTRACT_ADDRESS override: ${FLOW_ADDRESS_OVERRIDE}`);
    flowAddress = FLOW_ADDRESS_OVERRIDE;
} else {
    // Need to get it from a storage node's getStatus()
    const indexer = new Indexer(INDEXER_URL);

    console.log("  [3a] Selecting storage nodes from indexer...");
    const t2a = Date.now();
    const [storageNodes, selectErr] = await indexer.selectNodes(2) as [any, any];
    if (selectErr) {
        console.error(`  ✗ selectNodes failed (${Date.now() - t2a}ms):`, selectErr);
        process.exit(1);
    }
    if (!storageNodes || storageNodes.length === 0) {
        console.error(`  ✗ No storage nodes returned (${Date.now() - t2a}ms)`);
        process.exit(1);
    }
    console.log(`  ✓ Got ${storageNodes.length} node(s) (${Date.now() - t2a}ms)`);

    // Log node URLs for diagnostics
    for (let i = 0; i < storageNodes.length; i++) {
        const n = storageNodes[i];
        const url = n?.url ?? n?.location ?? n?.endpoint ?? "(unknown URL)";
        console.log(`    node[${i}]: ${url}`);
    }

    // Try each node with a 10s timeout
    console.log("  [3b] Trying getStatus() on each node (10s timeout)...");
    flowAddress = "";
    for (let i = 0; i < storageNodes.length; i++) {
        const t2b = Date.now();
        try {
            console.log(`    → node[${i}].getStatus()...`);
            const status = await withTimeout(storageNodes[i].getStatus(), 10_000, `node[${i}].getStatus()`);
            const addr = status?.networkIdentity?.flowAddress;
            if (addr) {
                flowAddress = addr;
                console.log(`    ✓ node[${i}] flowAddress: ${addr} (${Date.now() - t2b}ms)`);
                break;
            } else {
                console.log(`    ⚠ node[${i}] returned status but no flowAddress (${Date.now() - t2b}ms)`);
                console.log(`      status: ${JSON.stringify(status).slice(0, 300)}`);
            }
        } catch (e: any) {
            console.log(`    ✗ node[${i}] failed (${Date.now() - t2b}ms): ${e.message}`);
        }
    }

    if (!flowAddress) {
        console.error("\n  ✗ All nodes failed. Set OG_FLOW_CONTRACT_ADDRESS in .env to bypass.");
        console.error("    Ask your team for the correct flow contract address for 0G testnet.");
        process.exit(1);
    }
}

// Use local storage node (OG_STORAGE_URL) if available, otherwise fall back to indexer.
// The indexer returns remote testnet nodes which may be unresponsive.
let batcherNodes: any[];
if (STORAGE_URL) {
    console.log(`  Using local storage node for batcher: ${STORAGE_URL}`);
    batcherNodes = [new StorageNode(STORAGE_URL)];
} else {
    console.log("  Selecting storage nodes from indexer for batcher...");
    const batcherIndexer = new Indexer(INDEXER_URL);
    const [nodes, selectErr] = await batcherIndexer.selectNodes(1) as [any, any];
    if (selectErr || !nodes?.length) {
        console.error("  ✗ Failed to get storage nodes for batcher");
        process.exit(1);
    }
    batcherNodes = nodes;
    console.log(`  ✓ Got ${batcherNodes.length} storage node(s) from indexer`);
}
console.log(`  ✓ Flow address resolved (${Date.now() - t2}ms total)\n`);

// ─── Step 4: Get flow contract ──────────────────────────────────
console.log("[4/7] Getting flow contract...");
const t3 = Date.now();
const flow = getFlowContract(flowAddress, signer);
console.log(`  ✓ Flow contract ready (${Date.now() - t3}ms)\n`);

// ─── Step 5: Write a test value via Batcher ─────────────────────
const testKey = `smoke-test:${Date.now()}`;
const testValue = JSON.stringify({
    test: true,
    timestamp: new Date().toISOString(),
    random: Math.random().toString(36).slice(2),
});

console.log("[5/7] Writing test KV pair via Batcher...");
console.log(`  key:   ${testKey}`);
console.log(`  value: ${testValue}`);
const t4 = Date.now();

const batcher = new Batcher(1, batcherNodes, flow, EVM_RPC);
const keyBytes = Buffer.from(testKey, "utf-8");
const valueBytes = Buffer.from(testValue, "utf-8");

batcher.streamDataBuilder.set(STREAM_ID, keyBytes, valueBytes);

console.log("  Calling batcher.exec()...");
const t4b = Date.now();
try {
    const [execResult, execErr] = (await batcher.exec()) as [any, any];
    if (execErr !== null) {
        console.error(`  ✗ batcher.exec() returned error (${Date.now() - t4b}ms):`, execErr);
        process.exit(1);
    }
    console.log(`  ✓ batcher.exec() succeeded (${Date.now() - t4b}ms)`);
    if (execResult) {
        console.log("    result:", JSON.stringify(execResult, null, 2).slice(0, 500));
    }
} catch (e: any) {
    console.error(`  ✗ batcher.exec() threw (${Date.now() - t4b}ms):`, e.message ?? e);
    process.exit(1);
}
console.log(`  ✓ Write completed (${Date.now() - t4}ms total)\n`);

// ─── Step 6: Read it back via KvClient ──────────────────────────
console.log("[6/7] Reading back via KvClient...");
const t5 = Date.now();

const kvEndpoint = KV_NODE_RPC ?? INDEXER_URL;
console.log(`  KV endpoint: ${kvEndpoint}`);

const kvClient = new KvClient(kvEndpoint);
try {
    const readResult = await kvClient.getValue(STREAM_ID, keyBytes);
    console.log(`  ✓ KvClient.getValue() returned (${Date.now() - t5}ms)`);
    if (readResult == null) {
        console.log("  ⚠ Value is null (might need propagation time)");
    } else {
        const decoded =
            readResult instanceof Uint8Array || Buffer.isBuffer(readResult)
                ? Buffer.from(readResult).toString("utf8")
                : String(readResult);
        console.log(`  ✓ Read value: ${decoded}`);
    }
} catch (e: any) {
    console.error(`  ✗ KvClient.getValue() failed (${Date.now() - t5}ms):`, e.message ?? e);
}
console.log();

// ─── Step 7: Summary ────────────────────────────────────────────
const totalMs = Date.now() - t0;
console.log("[7/7] Summary");
console.log(`  Total time: ${totalMs}ms (${(totalMs / 1000).toFixed(1)}s)`);
console.log("  Done ✓\n");
