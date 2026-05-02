/**
 * Full end-to-end test:
 *   1. Register user
 *   2. Fetch KeeperHub wallet address
 *   3. Generate strategy (real LLM)
 *   4. Deploy to KeeperHub
 *   5. Inject fake suboptimal execution (false positive alert at health factor 1.62)
 *   6. Trigger strategy evolution (real LLM v2 with evidenceOfLearning)
 *   7. Verify on-chain: AgentRegistry + ReputationLedger
 *
 * Usage:
 *   MONGODB_URI=... npx dotenv -e .env -- npx tsx scripts/e2e-test.ts
 *
 * Or with env vars inline:
 *   MONGODB_URI=... OPENROUTER_API_KEY=... AGENT_PRIVATE_KEY=... npx tsx scripts/e2e-test.ts
 *
 * Logs to: e2e-test.log (in app directory)
 */

import { createWriteStream, WriteStream } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import { ethers } from "ethers";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const KH_API_KEY =
  process.env.KH_API_KEY ?? "kh_AdycoB_EPouRoslFA6CzjQbPllNhi_oL";
const WALLET_ADDRESS =
  process.env.WALLET_ADDRESS ?? "0x7975E591c26e6c6D9B0CFd9A81f6d61A921C080c";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MONGODB_URI = process.env.MONGODB_URI!;
const EXISTING_USER_ID =
  process.env.EXISTING_USER_ID ?? "69f5f3a3cc1888211f44c011";

// ── Logger ────────────────────────────────────────────────────────────────────

const logFile = resolve(__dirname, "../e2e-test.log");
let logStream: WriteStream;

function initLogger() {
  logStream = createWriteStream(logFile, { flags: "w" });
  console.log(`Logging to: ${logFile}`);
}

function log(msg: string, data?: any) {
  const ts = new Date().toISOString();
  const line =
    data !== undefined
      ? `[${ts}] ${msg}\n${JSON.stringify(data, null, 2)}`
      : `[${ts}] ${msg}`;
  console.log(line);
  logStream.write(line + "\n");
}

function logSection(title: string) {
  const sep = "─".repeat(60);
  const line = `\n${sep}\n  ${title}\n${sep}`;
  console.log(line);
  logStream.write(line + "\n");
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function api(
  method: string,
  path: string,
  body?: object,
  token?: string,
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${APP_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok || json.error)
    throw new Error(json.error ?? `HTTP ${res.status}`);
  return json;
}

// ── Inline Mongoose schemas (avoid import path issues) ────────────────────────

function initMongoose() {
  const ExecutionSchema = new mongoose.Schema({
    strategyId: mongoose.Schema.Types.ObjectId,
    keeperhubExecutionId: String,
    status: String,
    stepLogs: Array,
    outcome: Object,
    createdAt: { type: Date, default: Date.now },
    completedAt: Date,
  });
  return (
    mongoose.models.Execution ?? mongoose.model("Execution", ExecutionSchema)
  );
}

// ── On-chain readers ──────────────────────────────────────────────────────────

const REGISTRY_ABI = [
  "function getAgent(uint256 agentId) external view returns (string memory)",
];
const LEDGER_ABI = [
  "function getLatest(uint256 agentId) external view returns (tuple(string strategyTag, uint256 successRateBps, string evidenceCid, uint256 timestamp) memory)",
  "function getCount(uint256 agentId) external view returns (uint256)",
];

async function readChain() {
  const provider = new ethers.JsonRpcProvider(
    process.env.OG_CHAIN_RPC ?? "https://evmrpc-testnet.0g.ai",
  );
  const registryAddr = process.env.AGENT_REGISTRY_ADDRESS!;
  const ledgerAddr = process.env.REPUTATION_LEDGER_ADDRESS!;

  const registry = new ethers.Contract(registryAddr, REGISTRY_ABI, provider);
  const ledger = new ethers.Contract(ledgerAddr, LEDGER_ABI, provider);

  const agentCid = await registry.getAgent(1).catch(() => "not_found");
  const recordCount = await ledger.getCount(1).catch(() => 0);
  let latestRecord: any = null;
  if (Number(recordCount) > 0) {
    latestRecord = await ledger.getLatest(1).catch(() => null);
  }

  return {
    agentRegistry: { address: registryAddr, agentId: 1, metadataCid: agentCid },
    reputationLedger: {
      address: ledgerAddr,
      recordCount: Number(recordCount.toString()),
      latest: latestRecord
        ? {
            strategyTag: latestRecord.strategyTag,
            successRateBps: Number(latestRecord.successRateBps),
            evidenceCid: latestRecord.evidenceCid,
            timestamp: new Date(
              Number(latestRecord.timestamp) * 1000,
            ).toISOString(),
          }
        : null,
    },
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!MONGODB_URI) {
    console.error("MONGODB_URI required");
    process.exit(1);
  }

  initLogger();
  log("=== StrategyForge E2E Test ===");
  log("App URL", APP_URL);
  log("KeeperHub API Key", KH_API_KEY.slice(0, 12) + "...");
  log("Wallet Address", WALLET_ADDRESS);

  // ── Step 1: Use existing user (skip registration) ────────────────────────
  logSection("STEP 1: Using existing user");
  const userId = EXISTING_USER_ID;
  const token = userId;
  log("Reusing existing user", { userId, token });

  // ── Step 2: Fetch KeeperHub user info (wallet address) ───────────────────
  logSection("STEP 2: KeeperHub wallet address");
  try {
    const khRes = await fetch("https://app.keeperhub.com/api/user", {
      headers: { Authorization: `Bearer ${KH_API_KEY}` },
    });
    if (khRes.ok) {
      const khUser = await khRes.json();
      log("KeeperHub user info", khUser);
      log(
        `KeeperHub turnkey wallet address: ${khUser.walletAddress ?? khUser.wallet ?? "not in response"}`,
      );
    } else {
      const body = await khRes.text();
      log(`KeeperHub /api/user returned ${khRes.status}`, body.slice(0, 200));
    }
  } catch (e: any) {
    log(`KeeperHub user fetch error: ${e.message}`);
  }

  // ── Step 3: Generate strategy (real LLM) ─────────────────────────────────
  logSection("STEP 3: Generate strategy (LLM pipeline)");
  const goal =
    "Monitor my Aave position on Sepolia and alert me if health factor drops below threshold";
  log("Goal", goal);
  const genResp = await api(
    "POST",
    "/api/strategy/generate",
    { userId, goal },
    token,
  );
  const { strategyId } = genResp;
  log("Generate response (strategyId + evidenceBundle)", {
    strategyId,
    researcher: genResp.evidenceBundle?.step1_researcher?.output,
    strategistCandidates:
      genResp.evidenceBundle?.step2_strategist?.output?.candidates?.map(
        (c: any) => ({
          id: c.id,
          name: c.name,
          hypothesis: c.hypothesis,
        }),
      ),
    criticSelected: genResp.evidenceBundle?.step3_critic?.output?.selected,
    criticRationale: genResp.evidenceBundle?.step3_critic?.output?.rationale,
  });

  // ── Step 4: Deploy to KeeperHub ──────────────────────────────────────────
  logSection("STEP 4: Deploy strategy to KeeperHub");
  const deployResp = await api(
    "POST",
    "/api/strategy/deploy",
    { strategyId },
    token,
  );
  log("Deploy response", deployResp);
  log(`KeeperHub workflow URL: ${deployResp.keeperhubUrl}`);

  // ── Step 5: Inject fake suboptimal execution ─────────────────────────────
  logSection("STEP 5: Inject fake suboptimal execution (false positive)");
  log("Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI);
  const Execution = initMongoose();

  const fakeExecution = await Execution.create({
    strategyId: new mongoose.Types.ObjectId(strategyId),
    keeperhubExecutionId: `e2e-fake-exec-${Date.now()}`,
    status: "success",
    stepLogs: [
      {
        stepId: "check-health",
        actionType: "aave-v3/get-user-account-data",
        status: "success",
        output: {
          healthFactor: "1.62",
          totalCollateralBase: "10000",
          totalDebtBase: "6000",
        },
        txHash: null,
        error: null,
      },
      {
        stepId: "condition",
        actionType: "condition",
        status: "success",
        output: { result: true },
        txHash: null,
        error: null,
      },
      {
        stepId: "alert",
        actionType: "discord/send-message",
        status: "success",
        output: { messageSent: true },
        txHash: null,
        error: null,
      },
    ],
    outcome: {
      suboptimal: true,
      suboptimalReason:
        "Alert fired but health factor was 1.62 (above 1.4) — threshold too sensitive, causing false positive",
      metrics: { healthFactor: 1.62 },
    },
    createdAt: new Date(),
    completedAt: new Date(),
  });
  await mongoose.disconnect();
  log("Fake execution injected", {
    executionId: fakeExecution._id.toString(),
    suboptimalReason: fakeExecution.outcome.suboptimalReason,
  });

  // ── Step 6: Trigger strategy evolution (real LLM) ────────────────────────
  logSection("STEP 6: Trigger strategy evolution (v2 LLM pipeline)");
  const updateResp = await api(
    "POST",
    "/api/strategy/update",
    { strategyId },
    token,
  );
  log("Update response", {
    newStrategyId: updateResp.newStrategyId,
    version: updateResp.version,
    keeperhubWorkflowId: updateResp.keeperhubWorkflowId,
    keeperhubUrl: `https://app.keeperhub.com/workflows/${updateResp.keeperhubWorkflowId}`,
    evidenceOfLearning: updateResp.evidenceOfLearning,
  });

  // ── Step 7: Verify on-chain state ────────────────────────────────────────
  logSection(
    "STEP 7: On-chain verification (AgentRegistry + ReputationLedger)",
  );
  const chainState = await readChain();
  log("On-chain state", chainState);

  // ── Summary ──────────────────────────────────────────────────────────────
  logSection("SUMMARY");
  log("E2E test completed successfully", {
    userId,
    v1StrategyId: strategyId,
    v1KeeperHubUrl: deployResp.keeperhubUrl,
    fakeExecutionId: fakeExecution._id.toString(),
    v2StrategyId: updateResp.newStrategyId,
    v2KeeperHubUrl: updateResp.keeperhubUrl,
    evidenceOfLearning: updateResp.evidenceOfLearning,
    onChain: chainState,
  });

  logStream.end();
}

main().catch((err) => {
  log(`FATAL ERROR: ${err.message}`, err.stack);
  logStream?.end();
  process.exit(1);
});
