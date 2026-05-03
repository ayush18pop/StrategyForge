import { NextResponse } from "next/server";
import { connectDB } from "../../../../../lib/db/mongoose";
import { Strategy } from "../../../../../lib/db/strategy.model";
import { Execution } from "../../../../../lib/db/execution.model";
import { User } from "../../../../../lib/db/user.model";
import { KeeperHubClient } from "../../../../../lib/keeperhub";
import { runResearcher } from "../../../../../lib/pipeline/researcher";
import { runStrategist } from "../../../../../lib/pipeline/strategist";
import { runCritic } from "../../../../../lib/pipeline/critic";
import { compileWorkflow } from "../../../../../lib/pipeline/compiler";
import { registryRegister, registryUpdate, ledgerRecord } from "../../../../../lib/contracts";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { model = "google/gemini-2.0-flash-001" } = (await req.json()) || {};
    await connectDB();

    const strategy = await Strategy.findById(id);
    if (!strategy)
      return NextResponse.json(
        { error: "Strategy not found" },
        { status: 404 }
      );

    // Must have a suboptimal execution to learn from
    const lastExecution = await Execution.findOne({
      strategyId: strategy._id,
    }).sort({ createdAt: -1 });

    if (!lastExecution?.outcome?.suboptimal) {
      return NextResponse.json(
        { error: "No suboptimal execution found — nothing to learn from" },
        { status: 400 }
      );
    }

    const user = await User.findById(strategy.userId);
    if (!user) throw new Error("User not found");

    // Validate OpenRouter API key is available
    const apiKey = user.openrouterApiKey || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OpenRouter API key not configured. Please provide openrouterApiKey during registration or set OPENROUTER_API_KEY environment variable."
      );
    }

    const kh = new KeeperHubClient(user.keeperhubApiKey);

    // Read schemas from local dump file
    const fs = require("fs");
    const path = require("path");
    const dumpPath = path.join(process.cwd(), "../action-schemas.dump.json");
    const schemasData = JSON.parse(fs.readFileSync(dumpPath, "utf-8"));
    const actionSchemas = (schemasData.schemas ?? schemasData).map((s: any) => ({
      actionType: s.actionType,
      description: s.description,
      requiredFields: Object.keys(s.requiredFields || {}),
    }));

    const priorLessons = [lastExecution.outcome.suboptimalReason].filter(
      Boolean
    ) as string[];

    // Step 1: Researcher — with prior lessons injected
    const rOut = await runResearcher({
      openrouterApiKey: apiKey,
      model,
      goal: strategy.goal,
      marketData: { status: "stable", mocked: true },
      walletState: { balance: "50000 USDC" },
      actionSchemas,
      priorLessons,
    });

    // Step 2: Strategist — with prior version workflow
    const sOut = await runStrategist({
      openrouterApiKey: apiKey,
      model,
      researcherOutput: rOut.output,
      actionSchemas,
      walletAddress: user.walletAddress,
      priorVersionWorkflow: strategy.workflowJson,
    });

    // Step 3: Critic — with prior critic output and failures
    const priorCriticOutput =
      strategy.evidenceBundle?.step3_critic?.output ?? null;
    const cOut = await runCritic({
      openrouterApiKey: apiKey,
      model,
      candidates: sOut.output.candidates,
      priorVersionCriticOutput: priorCriticOutput,
      priorExecutionFailures: priorLessons,
    });

    // Step 4: Compile
    const selectedCandidate = sOut.output.candidates.find(
      (c: any) => c.id === cOut.output.selected
    );
    if (!selectedCandidate)
      throw new Error("Critic selected a candidate ID that does not exist");

    const workflowJson = compileWorkflow(
      selectedCandidate,
      user.walletAddress,
      "11155111",
      rOut.output.targetNetwork
    );

    // Create new version strategy
    const newStrategy = await Strategy.create({
      userId: strategy.userId,
      familyId: strategy.familyId,
      version: strategy.version + 1,
      goal: strategy.goal,
      lifecycle: "draft",
      workflowJson,
      priorVersionId: strategy._id,
      evidenceBundle: {
        step1_researcher: rOut,
        step2_strategist: sOut,
        step3_critic: cOut,
      },
    });

    // Auto-deploy to KeeperHub
    const khResponse = await kh.createWorkflow(workflowJson);
    newStrategy.keeperhubWorkflowId = khResponse.id;
    newStrategy.lifecycle = "live";
    newStrategy.deployedAt = new Date();

    // ── On-chain: Update AgentRegistry + record reputation ────────────────
    // Use the family's existing agentId, or register a new one if v1 didn't have one
    try {
      const agentId = strategy.onChainAgentId;

      if (agentId) {
        // Update existing agent's metadata with new version info
        const metadataCid = JSON.stringify({
          type: "strategyforge-agent",
          familyId: strategy.familyId,
          strategyId: newStrategy._id.toString(),
          version: newStrategy.version,
          priorVersionId: strategy._id.toString(),
          evidenceOfLearning: cOut.output.evidenceOfLearning,
          evolvedAt: new Date().toISOString(),
        });
        const updateResult = await registryUpdate(agentId, metadataCid);
        newStrategy.onChainAgentId = agentId;
        newStrategy.registryTxHash = updateResult.txHash;
        newStrategy.agentRegistryCid = metadataCid;

        // Record evolution reputation — improved from suboptimal
        const ledgerResult = await ledgerRecord(
          agentId,
          strategy.familyId,
          7500, // 75% — evolved from failure, not yet proven
          newStrategy._id.toString(),
        );
        newStrategy.reputationLedgerTxHash = ledgerResult.txHash;
      } else {
        // v1 was never registered — register now
        const metadataCid = JSON.stringify({
          type: "strategyforge-agent",
          familyId: strategy.familyId,
          strategyId: newStrategy._id.toString(),
          version: newStrategy.version,
          createdAt: new Date().toISOString(),
        });
        const regResult = await registryRegister(metadataCid);
        newStrategy.onChainAgentId = regResult.agentId;
        newStrategy.registryTxHash = regResult.txHash;
        newStrategy.agentRegistryCid = metadataCid;
      }
    } catch (e: any) {
      console.warn("On-chain update failed (non-critical):", e.message);
    }
    await newStrategy.save();

    // Deprecate old strategy
    strategy.lifecycle = "deprecated";
    await strategy.save();

    return NextResponse.json({
      newStrategyId: newStrategy._id,
      version: newStrategy.version,
      evidenceOfLearning: cOut.output.evidenceOfLearning,
      keeperhubWorkflowId: newStrategy.keeperhubWorkflowId,
      keeperhubUrl: `https://app.keeperhub.com/workflows/${newStrategy.keeperhubWorkflowId}`,
      onChainAgentId: newStrategy.onChainAgentId,
      registryTxHash: newStrategy.registryTxHash,
      reputationTxHash: newStrategy.reputationLedgerTxHash,
    });
  } catch (error: any) {
    console.error("Strategy evolve error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
