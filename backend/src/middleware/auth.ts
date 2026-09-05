/**
 * Authentication and role guards for every protected route.
 *
 * The token here is a STATEFUL JWT, which is deliberate and slightly unusual.
 * A signed token alone is not accepted: it must also correspond to a live row
 * in auth_sessions. That makes sessions revocable — logging out flips
 * is_active and the token dies immediately — which a stateless JWT cannot do,
 * and matters for a clinical system where an administrator may need to cut off
 * a compromised account at once.
 *
 * The cost is one database round-trip per authenticated request, which is why
 * a database outage surfaces here as 503 rather than 401.
 */

import { Context, Next } from 'hono';
import { verify } from 'jsonwebtoken';
import { db } from '../db';
import { authSessions, practitioners } from '../db/schema';
import { eq, and, gt } from 'drizzle-orm';

import { JWT_SECRET } from '../lib/env';

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');

  /*
   * Server-Sent Events (GET /api/notifications/stream) are opened by the
   * browser's EventSource, which cannot set request headers. The token is
   * therefore accepted from the query string as a documented fallback. It is
   * the same token and the same validation — only the transport differs.
   */
  const queryToken = c.req.query('token');

  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : queryToken ?? null;

  if (!token) {
    console.log('Missing or malformed Authorization header');
    return c.json({ success: false, error: { message: 'Unauthorized' } }, 401);
  }

  /* Step 1 of 2: is the token authentic? Verifies the signature and the
     built-in expiry claim, but says nothing about whether it was revoked. */
  let payload: any;
  try {
    payload = verify(token, JWT_SECRET);
  } catch (err: any) {
    return c.json({ success: false, error: { message: 'Invalid token' } }, 401);
  }

  /*
   * Step 2 of 2: is the session still live? Matching on the token string as
   * well as the user id means a token cannot be replayed after logout, and a
   * token issued for one user cannot be presented as another.
   */
  let session: any[];
  try {
    session = await db.select()
      .from(authSessions)
      .where(and(
        eq(authSessions.jwtToken, token),
        eq(authSessions.userId, payload.userId),
        eq(authSessions.isActive, true),
        gt(authSessions.expiresAt, new Date())
      ))
      .limit(1);
  } catch (err: any) {
    /* The database is unreachable, so we cannot prove the session is valid.
       Fail closed with 503 rather than 401: the credentials may be perfectly
       good, and telling the user to log in again would not help. */
    console.error('[AUTH] DB session lookup failed:', err.message);
    return c.json({ success: false, error: { message: 'Service temporarily unavailable' } }, 503);
  }

  if (!session.length) {
    return c.json({ success: false, error: { message: 'Session expired. Please login again.' } }, 401);
  }

  /*
   * Presence tracking, used by the "online staff" pickers when assigning a
   * nurse or doctor. Deliberately not awaited and errors are swallowed — a
   * failure to record presence must never fail the request the user actually
   * made.
   */
  if (payload.userType !== 'patient') {
    db.update(practitioners)
      .set({ lastSeenAt: new Date() })
      .where(eq(practitioners.id, payload.userId))
      .catch(() => {});
  }

  /*
   * Everything downstream reads identity from the context rather than
   * re-parsing the token. institutionId is the basis of nearly all data
   * scoping, and a null value means super admin (no single institution).
   * blockchainAddress is what eventually gets passed to the chaincode.
   */
  c.set('userId', payload.userId);
  c.set('userType', payload.userType);
  c.set('blockchainAddress', payload.blockchainAddress);
  c.set('institutionId', payload.institutionId ?? null);
  c.set('sessionId', session[0].id);

  await next();
}

/**
 * Coarse role gate, applied after authMiddleware has populated the context.
 *
 * This checks role only. Anything finer — "may this practitioner read THIS
 * patient" — is a separate consent check against the ledger, and belongs in
 * the route handler rather than here.
 */
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