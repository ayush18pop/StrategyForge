import { NextResponse } from 'next/server';
import { connectDB } from '../../../../lib/db/mongoose';
import { User, hashPassword } from '../../../../lib/db/user.model';
import { KeeperHubClient } from '../../../../lib/keeperhub';

// POST /api/user/connect — legacy alias, redirects to auth/register logic
export async function POST(req: Request) {
  try {
    const { keeperhubApiKey, walletAddress, openrouterApiKey, username, password } = await req.json();

    if (!keeperhubApiKey) {
      return NextResponse.json({ error: 'keeperhubApiKey is required' }, { status: 400 });
    }

    const kh = new KeeperHubClient(keeperhubApiKey);
    const khUser = await kh.getUserInfo();

    await connectDB();

    const uname = username || walletAddress || khUser.walletAddress;
    const pw = password || 'default';

    // Upsert by username
    const user = await User.findOneAndUpdate(
      { username: uname },
      {
        username: uname,
        passwordHash: hashPassword(pw),
        keeperhubApiKey,
        openrouterApiKey: openrouterApiKey || undefined,
        walletAddress: walletAddress || khUser.walletAddress || undefined,
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({
      userId: user._id.toString(),
      username: user.username,
      walletAddress: user.walletAddress,
      token: user._id.toString(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
