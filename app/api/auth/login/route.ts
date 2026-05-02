import { NextResponse } from 'next/server';
import { connectDB } from '../../../../lib/db/mongoose';
import { User, hashPassword } from '../../../../lib/db/user.model';
import { signToken } from '../../../../lib/auth';

// POST /api/auth/login
// Body: { username, password }
export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'username and password are required' }, { status: 400 });
    }

    await connectDB();
    const user = await User.findOne({ username });

    if (!user) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    if (user.passwordHash !== hashPassword(password)) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    return NextResponse.json({
      userId: user._id.toString(),
      username: user.username,
      walletAddress: user.walletAddress,
      token: signToken({ userId: user._id.toString(), username: user.username }),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
