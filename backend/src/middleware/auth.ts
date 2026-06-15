import { Context, Next } from 'hono';
import { verify } from 'jsonwebtoken';
import { db } from '../db';
import { authSessions, practitioners } from '../db/schema';
import { eq, and, gt } from 'drizzle-orm';

const JWT_SECRET = process.env.JWT_SECRET || 'healthcare_jwt_secret';

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  const queryToken = c.req.query('token'); // SSE fallback — EventSource can't send headers

  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : queryToken ?? null;

  if (!token) {
    console.log('Missing or malformed Authorization header');
    return c.json({ success: false, error: { message: 'Unauthorized' } }, 401);
  }

  try {
    const payload = verify(token, JWT_SECRET) as any;

    // Check session
    const session = await db.select()
      .from(authSessions)
      .where(and(
        eq(authSessions.jwtToken, token),
        eq(authSessions.userId, payload.userId),
        eq(authSessions.isActive, true),
        gt(authSessions.expiresAt, new Date())
      ))
      .limit(1);

    if (!session.length) {
      return c.json({ success: false, error: { message: 'Session expired. Please login again.' } }, 401);
    }

    // Update last_seen_at for staff (non‑patient)
    if (payload.userType !== 'patient') {
      await db.update(practitioners)
        .set({ lastSeenAt: new Date() })
        .where(eq(practitioners.id, payload.userId))
        .catch(() => { }); // non‑blocking
    }

    c.set('userId', payload.userId);
    c.set('userType', payload.userType);
    c.set('blockchainAddress', payload.blockchainAddress);
    c.set('institutionId', payload.institutionId ?? null);
    c.set('sessionId', session[0].id);

    await next();
  } catch (err: any) {
    console.log('JWT verification failed:', err.message);
    return c.json({ success: false, error: { message: 'Invalid token' } }, 401);
  }
}

export function requireUserType(...types: string[]) {
  return async (c: Context, next: Next) => {
    const userType = c.get('userType');
    if (!types.includes(userType)) {
      return c.json({
        success: false,
        error: { message: `Access denied. Required: ${types.join(', ')}` }
      }, 403);
    }
    await next();
  };
}