import { NextResponse } from 'next/server';
import { connectDB } from '../../../../lib/db/mongoose';
import { Strategy } from '../../../../lib/db/strategy.model';
import { getUserIdFromRequest } from '../../../../lib/auth';

export async function GET(req: Request) {
    try {
        const userId = getUserIdFromRequest(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        await connectDB();
        const strategies = await Strategy.find({ userId })
            .sort({ createdAt: -1 })
            .select('-workflowJson -evidenceBundle');

        return NextResponse.json({ strategies });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
