import { Context, Next } from 'hono';
import { verify } from 'jsonwebtoken';
import { db } from '../db';
import { authSessions } from '../db/schema';
import { eq, and, gt } from 'drizzle-orm';

const JWT_SECRET = process.env.JWT_SECRET || 'healthcare_jwt_secret';

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    console.log('Missing or malformed Authorization header');
    return c.json({ success: false, error: { message: 'Unauthorized' } }, 401);
  }

  try {
    const token = authHeader.split(' ')[1];
    const payload = verify(token, JWT_SECRET) as any;

    console.log('JWT verified, userId:', payload.userId, 'exp:', payload.exp, 'current time:', Math.floor(Date.now() / 1000));

    // ✅ Check if session exists and is active in database
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
      console.log('Session not found or expired for userId:', payload.userId);
      return c.json({
        success: false,
        error: { message: 'Session expired. Please login again.' }
      }, 401);
    }

    console.log('Valid session found for userId:', payload.userId, 'sessionId:', session[0].id);

    c.set('userId', payload.userId);
    c.set('userType', payload.userType);
    c.set('blockchainAddress', payload.blockchainAddress);
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