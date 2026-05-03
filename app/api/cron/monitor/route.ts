import { NextResponse } from "next/server";
import { connectDB } from "../../../../lib/db/mongoose";
import { Strategy } from "../../../../lib/db/strategy.model";
import { User } from "../../../../lib/db/user.model";
import { KeeperHubClient } from "../../../../lib/keeperhub";
import { runResearcher } from "../../../../lib/pipeline/researcher";
import { runStrategist } from "../../../../lib/pipeline/strategist";
import { runCritic } from "../../../../lib/pipeline/critic";
import { compileWorkflow } from "../../../../lib/pipeline/compiler";

/**
 * A simulated chron monitor that iterates over active strategies,
 * checks for market drift, and forces a re-generation of the workflow
 * if the critic determines the current strategy is suboptimal.
 */
export async function POST(req: Request) {
  try {
    await connectDB();

    // Find strategies that are live
    const activeStrategies = await Strategy.find({ lifecycle: "live" });

    const updates = [];

    for (const strategy of activeStrategies) {
      const user = await User.findById(strategy.userId);
      if (!user || !user.openrouterApiKey) continue;

      // Mock market change check
      const needsEvolution = Math.random() > 0.5; // Simulate 50% chance of drift requiring regen

      if (needsEvolution) {
        // Read action schemas
        const fs = require("fs");
        const path = require("path");
        const dumpPath = path.join(process.cwd(), "action-schemas.dump.json");
        const schemasData = JSON.parse(fs.readFileSync(dumpPath, "utf-8"));
        const actionSchemas = (schemasData.schemas ?? schemasData).map(
          (s: any) => ({
            actionType: s.actionType,
            description: s.description,
            requiredFields: Object.keys(s.requiredFields || {}),
          }),
        );

        // Run full evolution pipeline
        const rOut = await runResearcher({
          openrouterApiKey: user.openrouterApiKey,
          model: process.env.MODEL_NAME || "google/gemini-2.0-flash-exp:free",
          goal: strategy.goal,
          marketData: { status: "volatile", simulatedDrift: true },
          walletState: { balance: "50000 USDC" },
          actionSchemas,
          priorLessons: [
            "Previous strategy underperformed in volatile conditions",
          ],
        });

        const sOut = await runStrategist({
          openrouterApiKey: user.openrouterApiKey,
          model: process.env.MODEL_NAME || "google/gemini-2.0-flash-exp:free",
          researcherOutput: rOut.output,
          actionSchemas,
          walletAddress: user.walletAddress,
          priorVersionWorkflow: strategy.workflowJson,
        });

        const cOut = await runCritic({
          openrouterApiKey: user.openrouterApiKey,
          model: process.env.MODEL_NAME || "google/gemini-2.0-flash-exp:free",
          candidates: sOut.output.candidates,
          priorVersionCriticOutput: strategy.evidenceBundle?.step3_critic,
          priorExecutionFailures: [],
        });

        let selectedCandidate = sOut.output.candidates.find(
          (c: any) => c.id === cOut.output.selected,
        );
        if (
          !selectedCandidate &&
          sOut.output.candidates &&
          sOut.output.candidates.length > 0
        ) {
          selectedCandidate = sOut.output.candidates[0]; // fallback to the first candidate
        }

        if (!selectedCandidate) {
          throw new Error(
            "Strategist failed to generate any valid workflow candidates.",
          );
        }

        const workflowJson = compileWorkflow(
          selectedCandidate,
          user.walletAddress,
        );
        // KeeperHub doesn't currently support updating a workflow via PUT /api/workflow/:id
        // So we will just update our local DB to show the evolved Strategy Version.
        // In production, we'd trigger a completely new deployment or handle versioning.

        // Update DB
        strategy.version += 1;
        strategy.workflowJson = workflowJson;
        strategy.evidenceBundle = {
          step1_researcher: rOut,
          step2_strategist: sOut,
          step3_critic: cOut,
        };
        await strategy.save();
        updates.push({
          familyId: strategy.familyId,
          newVersion: strategy.version,
          status: "Evolved",
        });
      } else {
        updates.push({
          familyId: strategy.familyId,
          version: strategy.version,
          status: "No drift detected",
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: activeStrategies.length,
      updates,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
