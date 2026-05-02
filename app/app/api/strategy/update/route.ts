import { NextResponse } from "next/server";
import { connectDB } from "../../../../lib/db/mongoose";
import { Strategy } from "../../../../lib/db/strategy.model";
import { Execution } from "../../../../lib/db/execution.model";
import { User } from "../../../../lib/db/user.model";
import { KeeperHubClient } from "../../../../lib/keeperhub";
import { runResearcher } from "../../../../lib/pipeline/researcher";
import { runStrategist } from "../../../../lib/pipeline/strategist";
import { runCritic } from "../../../../lib/pipeline/critic";
import { compileWorkflow } from "../../../../lib/pipeline/compiler";
import { registryUpdate } from "../../../../lib/contracts";

export async function POST(req: Request) {
  try {
    const { strategyId, model = "google/gemini-2.0-flash-001" } =
      await req.json();
    await connectDB();

    const strategy = await Strategy.findById(strategyId);
    if (!strategy)
      return NextResponse.json(
        { error: "Strategy not found" },
        { status: 404 },
      );

    // Must have a suboptimal execution to learn from
    const lastExecution = await Execution.findOne({ strategyId }).sort({
      createdAt: -1,
    });
    if (!lastExecution?.outcome?.suboptimal) {
      return NextResponse.json(
        { error: "No suboptimal execution found — nothing to learn from" },
        { status: 400 },
      );
    }

    const user = await User.findById(strategy.userId);
    if (!user) throw new Error("User not found");

    // Validate OpenRouter API key is available
    const apiKey = user.openrouterApiKey || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OpenRouter API key not configured. Please provide openrouterApiKey during registration or set OPENROUTER_API_KEY environment variable.",
      );
    }

    const kh = new KeeperHubClient(user.keeperhubApiKey);

    // Read schemas from local dump file instead of live API
    const fs = require("fs");
    const path = require("path");
    const dumpPath = path.join(process.cwd(), "../action-schemas.dump.json");
    const schemasData = JSON.parse(fs.readFileSync(dumpPath, "utf-8"));
    const actionSchemas = schemasData.schemas ?? schemasData;
    const priorLessons = [lastExecution.outcome.suboptimalReason].filter(
      Boolean,
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

    // Step 2: Strategist — with prior version workflow so it knows what to improve
    const sOut = await runStrategist({
      openrouterApiKey: apiKey,
      model,
      researcherOutput: rOut.output,
      actionSchemas,
      walletAddress: user.walletAddress,
      priorVersionWorkflow: strategy.workflowJson,
    });

    // Step 3: Critic — with prior critic output and prior failures (evidenceOfLearning REQUIRED)
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
      (c: any) => c.id === cOut.output.selected,
    );
    if (!selectedCandidate)
      throw new Error("Critic selected a candidate ID that does not exist");
    const workflowJson = compileWorkflow(selectedCandidate, user.walletAddress);

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

    // Update AgentRegistry with new strategy CID (best-effort)
    try {
      const result = await registryUpdate(1, newStrategy._id.toString());
      newStrategy.agentRegistryCid = newStrategy._id.toString();
      newStrategy.reputationLedgerTxHash = result.txHash;
    } catch {
      // Non-critical
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
    });
  } catch (error: any) {
    console.error("Strategy update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
