import { NextResponse } from "next/server";
import { connectDB } from "../../../../lib/db/mongoose";
import { Strategy } from "../../../../lib/db/strategy.model";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");
    
    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    await connectDB();
    const strategies = await Strategy.find({ userId }).sort({ createdAt: -1 });

    return NextResponse.json({ strategies });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
