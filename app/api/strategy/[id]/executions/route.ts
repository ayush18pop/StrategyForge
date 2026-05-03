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

    // Verify strategy exists
    const strategy = await Strategy.findById(id);
    if (!strategy) {
      return NextResponse.json(
        { error: "Strategy not found" },
        { status: 404 }
      );
    }

    // Get execution history for this strategy, sorted newest first
    const executions = await Execution.find({ strategyId: id })
      .sort({ createdAt: -1 })
      .limit(20);

    // Format for frontend
    const formattedExecutions = executions.map((e) => ({
      id: e._id,
      keeperhubExecutionId: e.keeperhubExecutionId,
      status: e.status,
      createdAt: e.createdAt,
      completedAt: e.completedAt,
      duration:
        e.completedAt && e.createdAt
          ? (e.completedAt.getTime() - e.createdAt.getTime()) / 1000
          : null,
      stepLogs: (e.stepLogs || []).map((log: any) => ({
        stepId: log.stepId,
        actionType: log.actionType,
        status: log.status,
        error: log.error,
        txHash: log.txHash,
      })),
      outcome: {
        suboptimal: e.outcome?.suboptimal,
        suboptimalReason: e.outcome?.suboptimalReason,
        metrics: e.outcome?.metrics,
      },
    }));

    // Calculate statistics
    const stats = {
      total: executions.length,
      success: executions.filter((e) => e.status === "success").length,
      failed: executions.filter((e) => e.status === "failed").length,
      running: executions.filter((e) => e.status === "running").length,
      suboptimal: executions.filter(
        (e) => e.outcome?.suboptimal === true
      ).length,
      successRate:
        executions.length > 0
          ? (executions.filter((e) => e.status === "success").length /
              executions.length) *
            100
          : 0,
    };

    return NextResponse.json({
      strategyId: id,
      stats,
      executions: formattedExecutions,
    });
  } catch (error: any) {
    console.error("Strategy executions error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
