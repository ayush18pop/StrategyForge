import { NextResponse } from 'next/server';
import { connectDB } from '../../../../lib/db/mongoose';
import { User, hashPassword } from '../../../../lib/db/user.model';
import { signToken } from '../../../../lib/auth';

// POST /api/auth/register
// Body: { username, password }
export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'username and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 4) {
      return NextResponse.json({ error: 'Password must be at least 4 characters' }, { status: 400 });
    }

    await connectDB();

    // Check if username already exists
    const existing = await User.findOne({ username });
    if (existing) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
    }

    const user = await User.create({
      username,
      passwordHash: hashPassword(password),
      keeperhubApiKey: '',
      openrouterApiKey: '',
      walletAddress: '',
    });

    return NextResponse.json({
      userId: user._id.toString(),
      username: user.username,
      walletAddress: user.walletAddress,
      token: signToken({ userId: user._id.toString(), username: user.username }),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
