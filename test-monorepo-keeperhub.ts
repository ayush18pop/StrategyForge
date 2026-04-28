// test-monorepo-keeperhub.ts
import "dotenv/config";
import { HttpKeeperHubClient as KeeperHubClient } from "./packages/keeperhub/src/client.ts";
import type { WorkflowSpec } from "./packages/core/src/types/keeperhub.ts";

const API_KEY = process.env.KEEPERHUB_KH_API_KEY;
const API_URL = process.env.KEEPERHUB_API_URL || "https://api.keeperhub.com";

if (!API_KEY) {
    console.error("❌ KEEPERHUB_KH_API_KEY not set in .env");
    process.exit(1);
}

const client = new KeeperHubClient({
    apiKey: API_KEY,
    apiUrl: API_URL
});

const SMOKE_TEST_STRATEGY: WorkflowSpec = {
    name: "StrategyForge — Monorepo Smoke Test",
    description: "Checking Aave USDC APY. Read-only.",
    trigger: {
        type: "schedule",
        config: { cron: "0 * * * *" },
    },
    nodes: [
        {
            id: "fetch-aave",
            type: "http/get",
            config: {
                url: "https://yields.llama.fi/pools",
            }
        }
    ],
    edges: []
};

async function runTest() {
    console.log("🚀 Starting Monorepo + KeeperHub Smoke Test...");

    // 1. Create
    const createRes = await client.createWorkflow(SMOKE_TEST_STRATEGY);
    if (!createRes.ok) {
        console.error("❌ Create failed:", createRes.error.message);
        return;
    }
    const workflowId = createRes.value.workflowId;
    console.log(`✅ Created workflow: ${workflowId}`);

    // 2. Publish
    console.log("🛒 Publishing...");
    const pubRes = await client.publishWorkflow({
        workflowId,
        pricePerRun: "0.001",
        paymentNetwork: "base"
    });
    if (!pubRes.ok) {
        console.warn("⚠️  Publishing failed (expected on some plans):", pubRes.error.message);
    } else {
        console.log("✅ Published");
    }

    // 3. Run
    console.log("▶️  Running...");
    const runRes = await client.runWorkflow(workflowId);
    if (!runRes.ok) {
        console.error("❌ Run failed:", runRes.error.message);
        return;
    }
    const executionId = runRes.value.executionId;
    console.log(`✅ Execution started: ${executionId}`);

    // 4. Poll for logs
    console.log("⌛ Polling for result...");
    for (let i = 0; i < 5; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const statusRes = await client.getExecutionLogs(executionId);
        if (statusRes.ok && statusRes.value.length > 0) {
            console.log(`🎊 Execution logs received! Found ${statusRes.value.length} entries.`);
            console.log("Full logs available on KeeperHub dashboard.");
            return;
        }
        process.stdout.write(".");
    }

    console.log("\n✅ Test sequence finished. Check result in app.keeperhub.com");
}

runTest().catch((e: Error) => console.error(e));
