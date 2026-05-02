import { NextResponse } from 'next/server';
import { connectDB } from '../../../../lib/db/mongoose';
import { Strategy } from '../../../../lib/db/strategy.model';
import { Execution } from '../../../../lib/db/execution.model';
import { getUserIdFromRequest } from '../../../../lib/auth';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userId = getUserIdFromRequest(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { id } = await params;
        await connectDB();

        const strategy = await Strategy.findById(id);
        if (!strategy) return NextResponse.json({ error: 'Strategy not found' }, { status: 404 });
        if (strategy.userId.toString() !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const executions = await Execution.find({ strategyId: id }).sort({ createdAt: -1 }).limit(10);

        // Find prior and next versions in the same family
        const familyVersions = await Strategy.find({ familyId: strategy.familyId, userId })
            .sort({ version: 1 })
            .select('_id version lifecycle keeperhubWorkflowId createdAt');

        return NextResponse.json({ strategy, executions, familyVersions });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
