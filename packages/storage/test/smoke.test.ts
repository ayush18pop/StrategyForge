import { test, expect, describe } from "bun:test";
import { KVStore } from "../src/kv-store";
import { EvidenceStore } from "../src/evidence-store";
import type { EvidenceBundle } from "../src/core";
import { config } from "dotenv";
import { join } from "path";

config({ path: join(process.cwd(), "../../.env") });

const RUN_STORAGE_SMOKE_TESTS = process.env.RUN_STORAGE_SMOKE_TESTS === "1";

async function fetchWithTimeout(
  input: string | Request | URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function isRpcReachable(url: string): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_chainId",
          params: [],
          id: 1,
        }),
      },
      5000,
    );
    return response.ok;
  } catch {
    return false;
  }
}

async function isKvNodeReachable(url: string): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "zgs_getStatus",
          id: Date.now(),
        }),
      },
      5000,
    );
    return response.ok;
  } catch {
    return false;
  }
}

describe("Storage Smoke Tests", () => {
  test("Should initialize KVStore, set a value and read it back", async () => {
    if (!RUN_STORAGE_SMOKE_TESTS) {
      console.warn(
        "Skipping KV smoke test. Set RUN_STORAGE_SMOKE_TESTS=1 to enable live storage checks.",
      );
      return;
    }

    const privateKey = process.env.PRIVATE_KEY;
    const evmRpc =
      process.env.OG_RPC_URL || process.env.OG_EVM_RPC || process.env.EVM_RPC;
    const kvNodeRpc = process.env.ZG_KV_NODE_RPC;
    const streamId = process.env.ZG_KV_STREAM_ID;

    const missing = [
      !privateKey ? "PRIVATE_KEY" : null,
      !evmRpc ? "OG_RPC_URL|OG_EVM_RPC|EVM_RPC" : null,
      !kvNodeRpc ? "ZG_KV_NODE_RPC" : null,
      !streamId ? "ZG_KV_STREAM_ID" : null,
    ].filter(Boolean) as string[];
    if (missing.length > 0) {
      console.warn(
        `Skipping KV smoke test due to missing env key(s): ${missing.join(", ")}`,
      );
      return;
    }

    const [rpcUp, kvUp] = await Promise.all([
      isRpcReachable(evmRpc!),
      isKvNodeReachable(kvNodeRpc!),
    ]);
    if (!rpcUp || !kvUp) {
      console.warn(
        `Skipping KV smoke test due to unreachable endpoint(s): evmRpc=${rpcUp}, kvNodeRpc=${kvUp}`,
      );
      return;
    }

    const kv = new KVStore({
      privateKey: privateKey!,
      evmRpc: evmRpc!,
      kvNodeRpc: kvNodeRpc!,
      streamId: streamId!,
      replicaCount: 1,
    });

    const testKey = `smoke-test-key-${Date.now()}`;
    const testValue = `smoke-test-value-${Date.now()}`;

    const setResult = await kv.set(testKey, testValue);
    if (!setResult.ok) console.error("KV set failed:", setResult.error);
    expect(setResult.ok).toBe(true);

    // Give data a bit of time to settle in testnet nodes before querying
    await new Promise((r) => setTimeout(r, 2000));

    const getResult = await kv.get(testKey);
    if (!getResult.ok) console.error("KV get failed:", getResult.error);
    expect(getResult.ok).toBe(true);
    if (getResult.ok) {
      expect(getResult.value).toBe(testValue);
      console.log(
        `KVStore: Successfully set and mapped ${testKey} to ${testValue}`,
      );
    }
  });

  test("Should initialize EvidenceStore, write bundle and read it back", async () => {
    if (!RUN_STORAGE_SMOKE_TESTS) {
      console.warn(
        "Skipping EvidenceStore smoke test. Set RUN_STORAGE_SMOKE_TESTS=1 to enable live storage checks.",
      );
      return;
    }

    const privateKey = process.env.PRIVATE_KEY;
    const evmRpc =
      process.env.OG_EVM_RPC || process.env.OG_RPC_URL || process.env.EVM_RPC;
    const indexerUrl = process.env.OG_INDEXER || process.env.ZG_INDEXER_URL;

    const missing = [
      !privateKey ? "PRIVATE_KEY" : null,
      !evmRpc ? "OG_EVM_RPC|OG_RPC_URL|EVM_RPC" : null,
      !indexerUrl ? "OG_INDEXER|ZG_INDEXER_URL" : null,
    ].filter(Boolean) as string[];
    if (missing.length > 0) {
      console.warn(
        `Skipping EvidenceStore smoke test due to missing env key(s): ${missing.join(", ")}`,
      );
      return;
    }

    const rpcUp = await isRpcReachable(evmRpc!);
    if (!rpcUp) {
      console.warn(
        "Skipping EvidenceStore smoke test due to unreachable EVM RPC endpoint.",
      );
      return;
    }

    const store = new EvidenceStore({
      privateKey: privateKey!,
      evmRpc: evmRpc!,
      indexerUrl: indexerUrl!,
    });

    const testBundle: EvidenceBundle = {
      strategyFamily: "smoke-test-family",
      version: 1,
      priorCids: [],
      createdAt: Date.now(),
      pipeline: {
        researcher: {
          input: {},
          output: {
            regime: "stable",
            survivingProtocols: [],
            logicNodes: [],
            signals: [],
          },
          attestationHash: "",
          timestamp: 0,
        },
        strategist: {
          input: {},
          output: { candidates: [] },
          attestationHash: "",
          timestamp: 0,
        },
        critic: {
          input: {},
          output: {
            verdicts: [],
            selectedCandidateId: "",
            selectionRationale: "",
            mandatoryConstraints: [],
            updatedLogicNodes: [],
          },
          attestationHash: "",
          timestamp: 0,
        },
        compiler: { workflowSpec: {}, gasEstimate: 0 },
        riskValidator: { passed: true, warnings: [] },
      },
    };

    const writeResult = await store.writeBundle(testBundle);
    if (!writeResult.ok)
      console.error("Evidence write failed:", writeResult.error);
    expect(writeResult.ok).toBe(true);

    if (writeResult.ok) {
      const cid = writeResult.value.cid;
      console.log(`EvidenceStore: Written dummy bundle with CID: ${cid}`);
      expect(cid).toBeTruthy();

      // Settle on indexer buffer
      await new Promise((r) => setTimeout(r, 3000));

      const readResult = await store.readBundle(cid);
      if (!readResult.ok)
        console.error("Evidence read failed:", readResult.error);
      expect(readResult.ok).toBe(true);

      if (readResult.ok) {
        expect(readResult.value.strategyFamily).toBe("smoke-test-family");
        expect(readResult.value.version).toBe(1);
      }
    }
  }, 120000);
});
