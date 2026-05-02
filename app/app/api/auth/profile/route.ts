import { NextResponse } from 'next/server';
import { connectDB } from '../../../../lib/db/mongoose';
import { User } from '../../../../lib/db/user.model';
import { KeeperHubClient } from '../../../../lib/keeperhub';
import { getUserIdFromRequest } from '../../../../lib/auth';

// GET /api/auth/profile
export async function GET(req: Request) {
    try {
        const userId = getUserIdFromRequest(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        await connectDB();
        const user = await User.findById(userId);
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        return NextResponse.json({
            keeperhubApiKey: user.keeperhubApiKey || '',
            openrouterApiKey: user.openrouterApiKey || '',
            walletAddress: user.walletAddress || ''
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PUT /api/auth/profile
// Body: { keeperhubApiKey }
export async function PUT(req: Request) {
    try {
        const userId = getUserIdFromRequest(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { keeperhubApiKey } = await req.json();

        if (!keeperhubApiKey) {
            return NextResponse.json({ error: 'KeeperHub API key is required' }, { status: 400 });
        }

        // Validate KeeperHub API key and get wallet
        const kh = new KeeperHubClient(keeperhubApiKey);
        let walletAddress = '';
        try {
            const khUser = await kh.getUserInfo();
            walletAddress = khUser.walletAddress;
        } catch (e: any) {
            return NextResponse.json({ error: `Invalid KeeperHub API Key: ${e.message}` }, { status: 400 });
        }

        await connectDB();
        const user = await User.findByIdAndUpdate(userId, {
            keeperhubApiKey,
            walletAddress
        }, { new: true });

        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        return NextResponse.json({
            success: true,
            walletAddress,
            keeperhubApiKey
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
