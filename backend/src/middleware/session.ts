// src/middleware/session.ts
import { createMiddleware } from 'hono/factory';
import { db } from '../db';
import { authSessions } from '../db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { verify } from 'jsonwebtoken';

const JWT_SECRET = (process.env.JWT_SECRET || 'healthcare_jwt_secret') as string;

export const sessionMiddleware = createMiddleware(async (c, next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return c.json({ success: false, error: { message: 'No token provided' } }, 401);
    }

    const token = authHeader.split(' ')[1];

    try {
        // Verify JWT
        const decoded = verify(token, JWT_SECRET) as any;

        // Check if session exists and is active
        const session = await db.select()
            .from(authSessions)
            .where(and(
                eq(authSessions.jwtToken, token),
                eq(authSessions.userId, decoded.userId),
                eq(authSessions.isActive, true),
                gt(authSessions.expiresAt, new Date())
            ))
            .limit(1);

        if (!session.length) {
            return c.json({ success: false, error: { message: 'Session expired or invalid' } }, 401);
        }

        // Attach session info to context
        c.set('sessionId', session[0].id);
        c.set('userId', decoded.userId);
        c.set('userType', decoded.userType);
        c.set('blockchainAddress', decoded.blockchainAddress);

        await next();
    } catch (err) {
        return c.json({ success: false, error: { message: 'Invalid token' } }, 401);
    }
});