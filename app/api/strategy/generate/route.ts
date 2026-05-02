import { NextResponse } from "next/server";
import { connectDB } from "../../../../lib/db/mongoose";
import { User } from "../../../../lib/db/user.model";
import { Strategy } from "../../../../lib/db/strategy.model";
import { KeeperHubClient } from "../../../../lib/keeperhub";
import { runResearcher } from "../../../../lib/pipeline/researcher";
import { runStrategist } from "../../../../lib/pipeline/strategist";
import { runCritic } from "../../../../lib/pipeline/critic";
import { compileWorkflow } from "../../../../lib/pipeline/compiler";

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

    const strategy = await Strategy.create({
      userId,
      familyId: `strat-${Date.now()}`,
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

    return NextResponse.json({
      strategyId: strategy._id,
      workflowJson,
      evidenceBundle: strategy.evidenceBundle,
    });
  } catch (error: any) {
    console.error("Strategy generation error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
