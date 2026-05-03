import { NextResponse } from "next/server";
import { connectDB } from "../../../../../lib/db/mongoose";
import { Strategy } from "../../../../../lib/db/strategy.model";
import { Execution } from "../../../../../lib/db/execution.model";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    await connectDB();

    // Get the strategy to find its familyId
    const strategy = await Strategy.findById(id);
    if (!strategy) {
      return NextResponse.json(
        { error: "Strategy not found" },
        { status: 404 }
      );
    }

    // Get all strategies in this family, sorted by version
    const versions = await Strategy.find({ familyId: strategy.familyId })
      .sort({ version: 1 })
      .select(
        "version lifecycle goal createdAt deployedAt keeperhubWorkflowId evidenceBundle.step3_critic.output"
      );

    // Get all executions for all strategies in this family
    const strategyIds = versions.map((v) => v._id);
    const executions = await Execution.find({ strategyId: { $in: strategyIds } })
      .sort({ createdAt: -1 })
      .limit(100);

    // Enrich versions with execution count and status
    const versionsWithStats = versions.map((v) => {
      const versionExecutions = executions.filter(
        (e) => e.strategyId.toString() === v._id.toString()
      );
      const successCount = versionExecutions.filter(
        (e) => e.status === "success"
      ).length;
      const failureCount = versionExecutions.filter(
        (e) => e.status === "failed"
      ).length;

      return {
        id: v._id,
        version: v.version,
        lifecycle: v.lifecycle,
        goal: v.goal,
        createdAt: v.createdAt,
        deployedAt: v.deployedAt,
        keeperhubWorkflowId: v.keeperhubWorkflowId,
        evidenceOfLearning:
          v.evidenceBundle?.step3_critic?.output?.evidenceOfLearning || null,
        executionStats: {
          total: versionExecutions.length,
          success: successCount,
          failed: failureCount,
          successRate:
            versionExecutions.length > 0
              ? (successCount / versionExecutions.length) * 100
              : 0,
        },
      };
    });

    return NextResponse.json({
      familyId: strategy.familyId,
      currentVersion: strategy.version,
      versions: versionsWithStats,
      totalExecutions: executions.length,
      executions: executions.map((e) => ({
        id: e._id,
        strategyId: e.strategyId,
        status: e.status,
        createdAt: e.createdAt,
        suboptimal: e.outcome?.suboptimal,
        suboptimalReason: e.outcome?.suboptimalReason,
      })),
    });
  } catch (error: any) {
    console.error("Strategy family error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
