import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'strategyforge-dev-secret-change-in-prod';
const JWT_EXPIRES_IN = '7d';

export interface JwtPayload {
  userId: string;
  username: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export function getUserIdFromRequest(req: Request): string | null {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;

  // Try JWT first
  const payload = verifyToken(token);
  if (payload) return payload.userId;

  // Fallback: treat as raw userId (backwards compat for existing sessions)
  if (/^[a-f0-9]{24}$/.test(token)) return token;

  return null;
}
