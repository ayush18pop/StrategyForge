import { NextResponse } from "next/server";
import { connectDB } from "../../../../lib/db/mongoose";
import { User } from "../../../../lib/db/user.model";
import { Strategy } from "../../../../lib/db/strategy.model";
import { KeeperHubClient } from "../../../../lib/keeperhub";
import { runResearcher } from "../../../../lib/pipeline/researcher";
import { runStrategist } from "../../../../lib/pipeline/strategist";
import { runCritic } from "../../../../lib/pipeline/critic";
import { compileWorkflow } from "../../../../lib/pipeline/compiler";
import { registryRegister, ledgerRecord } from "../../../../lib/contracts";

export async function POST(req: Request) {
  try {
    const {
      userId,
      goal,
      model = process.env.MODEL_NAME,
    } = await req.json();
    await connectDB();
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    const kh = new KeeperHubClient(user.keeperhubApiKey);

    // Validate OpenRouter API key is available
    const openrouterApiKey =
      user.openrouterApiKey || process.env.OPENROUTER_API_KEY;
    if (!openrouterApiKey) {
      throw new Error(
        "OpenRouter API key not configured. Please provide openrouterApiKey during registration or set OPENROUTER_API_KEY environment variable.",
      );
    }

    // Read schemas from local dump file instead of live API to ensure all context is available
    const fs = require("fs");
    const path = require("path");
    const dumpPath = path.join(process.cwd(), "../action-schemas.dump.json");
    const schemasData = JSON.parse(fs.readFileSync(dumpPath, "utf-8"));
    const rawSchemas = schemasData.schemas ?? schemasData;

    // Compress schemas to fit within LLM token limits (e.g. 16k context on free models)
    const actionSchemas = rawSchemas.map((s: any) => ({
      actionType: s.actionType,
      description: s.description,
      requiredFields: Object.keys(s.requiredFields || {})
    }));

    // Step 1: Researcher
    const rOut = await runResearcher({
      openrouterApiKey,
      model,
      goal,
      marketData: { status: "stable", mocked: true },
      walletState: { balance: "50000 USDC" },
      actionSchemas,
      priorLessons: [],
    });

    // Step 2: Strategist
    const sOut = await runStrategist({
      openrouterApiKey,
      model,
      researcherOutput: rOut.output,
      actionSchemas,
      walletAddress: user.walletAddress,
      priorVersionWorkflow: null,
    });

    // Step 3: Critic
    const cOut = await runCritic({
      openrouterApiKey,
      model,
      candidates: sOut.output.candidates,
      priorVersionCriticOutput: null,
      priorExecutionFailures: [],
    });

    // Step 4: Compiler
    const selectedCandidate = sOut.output.candidates.find(
      (c: any) => c.id === cOut.output.selected,
    );
    const workflowJson = compileWorkflow(selectedCandidate, user.walletAddress, '11155111', rOut.output.targetNetwork);

    const familyId = `strat-${Date.now()}`;

    const strategy = await Strategy.create({
      userId,
      familyId,
      version: 1,
      goal,
      lifecycle: "draft",
      workflowJson,
      evidenceBundle: {
        step1_researcher: rOut,
        step2_strategist: sOut,
        step3_critic: cOut,
      },
    });

    // ── On-chain: Register agent on 0G AgentRegistry ──────────────────────
    // Each strategy family gets its own on-chain agentId
    try {
      const metadataCid = JSON.stringify({
        type: "strategyforge-agent",
        familyId,
        strategyId: strategy._id.toString(),
        goal,
        version: 1,
        createdAt: new Date().toISOString(),
      });
      const regResult = await registryRegister(metadataCid);
      strategy.onChainAgentId = regResult.agentId;
      strategy.registryTxHash = regResult.txHash;
      strategy.agentRegistryCid = metadataCid;

      // Record initial reputation entry (v1, no execution yet, neutral score)
      const ledgerResult = await ledgerRecord(
        regResult.agentId,
        familyId,
        5000, // 50% — neutral initial score
        strategy._id.toString(),
      );
      strategy.reputationLedgerTxHash = ledgerResult.txHash;

      await strategy.save();
    } catch (e: any) {
      console.warn("On-chain registration failed (non-critical):", e.message);
      // Save strategy anyway — on-chain is best-effort
      await strategy.save();
    }

    return NextResponse.json({
      strategyId: strategy._id,
      workflowJson,
      evidenceBundle: strategy.evidenceBundle,
      onChainAgentId: strategy.onChainAgentId,
      registryTxHash: strategy.registryTxHash,
    });
  } catch (error: any) {
    console.error("Strategy generation error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
