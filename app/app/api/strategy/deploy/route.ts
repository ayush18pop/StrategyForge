import { NextResponse } from "next/server";
import { connectDB } from "../../../../lib/db/mongoose";
import { Strategy } from "../../../../lib/db/strategy.model";
import { User } from "../../../../lib/db/user.model";
import { KeeperHubClient } from "../../../../lib/keeperhub";

export async function POST(req: Request) {
  try {
    const { strategyId } = await req.json();
    await connectDB();

    const strategy = await Strategy.findById(strategyId);
    if (!strategy) throw new Error("Strategy not found");

    const user = await User.findById(strategy.userId);
    const kh = new KeeperHubClient(user.keeperhubApiKey);

    const khResponse = await kh.createWorkflow(strategy.workflowJson);
    strategy.keeperhubWorkflowId = khResponse.id;
    strategy.lifecycle = "live";
    strategy.deployedAt = new Date();
    await strategy.save();

    return NextResponse.json({
      workflowId: strategy.keeperhubWorkflowId,
      keeperhubUrl: `https://app.keeperhub.com/workflows/${strategy.keeperhubWorkflowId}`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
