import { config as loadDotEnv } from "dotenv";
import { dirname, join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { HttpKeeperHubClient } from "./client";
import type { WorkflowSpec } from "@strategyforge/core";

function loadEnvFromWorkspace(): void {
  let currentDir = process.cwd();
  while (true) {
    const envPath = join(currentDir, ".env");
    if (existsSync(envPath)) {
      loadDotEnv({ path: envPath });
      return;
    }
    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) return;
    currentDir = parentDir;
  }
}

loadEnvFromWorkspace();

const apiUrl = process.env.KEEPERHUB_API_URL;
const apiKey = process.env.KEEPERHUB_API_KEY;
const integrationId = process.env.KEEPERHUB_INTEGRATION_ID;

if (!apiUrl || !apiKey) {
  console.error("Missing env vars: KEEPERHUB_API_URL and KEEPERHUB_API_KEY");
  process.exit(1);
}

const BASE_CHAIN_ID = "8453";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const BASE_WETH = "0x4200000000000000000000000000000000000006";

const REQUIRED_ACTION_TYPES = {
  aaveSupply: "aave-v3/supply",
  morphoVaultDeposit: "morpho/vault-deposit",
  uniswapSwapExactInput: "uniswap/swap-exact-input",
} as const;

interface DumpSchema {
  actionType?: string;
  type?: string;
}

interface DumpFile {
  count: number;
  schemas: DumpSchema[];
}

async function main(): Promise<void> {
  const client = new HttpKeeperHubClient({ apiUrl: apiUrl!, apiKey: apiKey! });

  console.log("\n[1/2] load local schema dump");
  const schemaSet = loadSchemaTypeSet();
  assertRequiredActions(schemaSet);

  console.log(`  Loaded ${schemaSet.size} normalized action types from dump`);
  console.log("  Using action types:");
  console.log(`  - ${REQUIRED_ACTION_TYPES.aaveSupply}`);
  console.log(`  - ${REQUIRED_ACTION_TYPES.morphoVaultDeposit}`);
  console.log(`  - ${REQUIRED_ACTION_TYPES.uniswapSwapExactInput}`);

  console.log("\n[2/2] create_workflow -> POST /workflows/create");

  const workflow: WorkflowSpec = {
    name: "strategyforge-smoke-real-actions",
    description:
      "Smoke test using action types verified from action-schemas.dump.json.",
    trigger: {
      type: "schedule",
      config: { cron: "*/30 * * * *" },
    },
    nodes: [
      {
        id: "aave-supply-step",
        type: REQUIRED_ACTION_TYPES.aaveSupply,
        config: {
          actionType: REQUIRED_ACTION_TYPES.aaveSupply,
          network: BASE_CHAIN_ID,
          asset: BASE_USDC,
          amount: "1000000",
          onBehalfOf: ZERO_ADDRESS,
          referralCode: "0",
          ...(integrationId ? { integrationId } : {}),
        },
      },
      {
        id: "morpho-vault-deposit-step",
        type: REQUIRED_ACTION_TYPES.morphoVaultDeposit,
        config: {
          actionType: REQUIRED_ACTION_TYPES.morphoVaultDeposit,
          network: BASE_CHAIN_ID,
          contractAddress: "0xBBBBBBBB9CC5E90E3B3AF64bdAF62C37EeFFCBa5",
          assets: "1000000",
          receiver: ZERO_ADDRESS,
          ...(integrationId ? { integrationId } : {}),
        },
      },
      {
        id: "uniswap-swap-step",
        type: REQUIRED_ACTION_TYPES.uniswapSwapExactInput,
        config: {
          actionType: REQUIRED_ACTION_TYPES.uniswapSwapExactInput,
          network: BASE_CHAIN_ID,
          tokenIn: BASE_USDC,
          tokenOut: BASE_WETH,
          fee: "500",
          recipient: ZERO_ADDRESS,
          amountIn: "1000000",
          amountOutMinimum: "0",
          sqrtPriceLimitX96: "0",
          ...(integrationId ? { integrationId } : {}),
        },
      },
    ],
    edges: [
      { source: "trigger", target: "aave-supply-step" },
      { source: "aave-supply-step", target: "morpho-vault-deposit-step" },
      { source: "morpho-vault-deposit-step", target: "uniswap-swap-step" },
    ],
  };

  const result = await client.createWorkflow(workflow);

  if (!result.ok) {
    console.error("  FAILED:", result.error.message);
    process.exit(1);
  }

  console.log("  OK — workflowId:", result.value.workflowId);
  console.log("\nSmoke test PASSED.");
  console.log("Created workflow id:", result.value.workflowId);
}

function loadSchemaTypeSet(): Set<string> {
  const dumpPath = join(process.cwd(), "action-schemas.dump.json");
  if (!existsSync(dumpPath)) {
    throw new Error(
      `Missing schema dump at ${dumpPath}. Run: bun run schemas:dump`,
    );
  }

  const parsed = JSON.parse(readFileSync(dumpPath, "utf8")) as DumpFile;
  if (!Array.isArray(parsed.schemas)) {
    throw new Error("Invalid dump file: schemas array missing");
  }

  const types = new Set<string>();
  for (const schema of parsed.schemas) {
    const actionType =
      typeof schema.type === "string" && schema.type.length > 0
        ? schema.type
        : schema.actionType;
    if (typeof actionType === "string" && actionType.length > 0) {
      types.add(actionType);
    }
  }

  if (parsed.count && parsed.count !== parsed.schemas.length) {
    console.warn(
      `Warning: dump count mismatch (count=${parsed.count}, schemas=${parsed.schemas.length})`,
    );
  }

  return types;
}

function assertRequiredActions(schemaTypeSet: Set<string>): void {
  const required = Object.values(REQUIRED_ACTION_TYPES);
  const missing = required.filter((type) => !schemaTypeSet.has(type));
  if (missing.length > 0) {
    throw new Error(
      `Required action types missing from dump: ${missing.join(", ")}`,
    );
  }
}

void main();
