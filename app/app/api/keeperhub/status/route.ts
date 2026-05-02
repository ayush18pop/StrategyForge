import { NextResponse } from 'next/server';
import { connectDB } from '../../../../lib/db/mongoose';
import { User } from '../../../../lib/db/user.model';
import { KeeperHubClient } from '../../../../lib/keeperhub';
import { getUserIdFromRequest } from '../../../../lib/auth';

export async function GET(req: Request) {
    try {
        const userId = getUserIdFromRequest(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        await connectDB();
        const user = await User.findById(userId);
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const kh = new KeeperHubClient(user.keeperhubApiKey);
        await kh.listActionSchemas();
        return NextResponse.json({ connected: true });
    } catch (error: any) {
        return NextResponse.json({ connected: false, error: error.message });
    }
}
