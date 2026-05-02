import { NextResponse } from 'next/server';
import { connectDB } from '../../../../lib/db/mongoose';
import { User } from '../../../../lib/db/user.model';
import { getUserIdFromRequest } from '../../../../lib/auth';

export async function GET(req: Request) {
    try {
        const userId = getUserIdFromRequest(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        await connectDB();
        const user = await User.findById(userId).select('-keeperhubApiKey -openrouterApiKey');
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        return NextResponse.json({ userId: user._id, walletAddress: user.walletAddress, discordWebhookUrl: user.discordWebhookUrl });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
