// backend/src/routes/notifications.ts
//
// Mount in index.ts:
//   import { notificationsRouter } from './routes/notifications';
//   app.route('/api/notifications', notificationsRouter);

import { z } from 'zod';
import { eq, and } from 'drizzle-orm';

import { createRouter } from '../lib/create-app';
import { authMiddleware } from '../middleware/auth';
import { db } from '../db';
import { deviceTokens } from '../db/schema';
import { addConnection, activeConnectionCount } from '../services/notifications';

export const notificationsRouter = createRouter()

    // ── SSE STREAM ─────────────────────────────────────────────────────────────
    // GET /api/notifications/stream
    //
    // The client opens this once after login and keeps it open.
    // The server sends events as they occur (lab results, imaging, etc.)
    //
    // Event types pushed from the backend:
    //   lab_result_ready   — { visitId, orderId, testName, orderNumber, patientName }
    //   imaging_result_ready — { visitId, orderId, modality, bodyPart, orderNumber }
    //   ping               — { ts } sent every 25 s to keep proxies alive
    //
    .get('/stream', authMiddleware, (c) => {
        const userId = c.get('userId');
        if (!userId) return c.text('Unauthorized', 401);

        // Build a ReadableStream that stays open
        let cleanup: (() => void) | null = null;
        let intervalId: ReturnType<typeof setInterval> | null = null;

        const stream = new ReadableStream({
            start(controller) {
                const encoder = new TextEncoder();

                const write = (data: string) => {
                    try {
                        controller.enqueue(encoder.encode(data));
                    } catch {
                        // controller already closed
                    }
                };

                const close = () => {
                    try { controller.close(); } catch { /* already closed */ }
                };

                // Register with the broadcaster
                cleanup = addConnection(userId, { write, close });

                // Send an immediate "connected" event so the client knows it's live
                write(`event: connected\ndata: ${JSON.stringify({ userId, ts: Date.now() })}\n\n`);

                // Heartbeat every 25 s — keeps load balancers / Nginx from killing the conn
                intervalId = setInterval(() => {
                    write(`event: ping\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);
                }, 25_000);
            },

            cancel() {
                if (intervalId) clearInterval(intervalId);
                if (cleanup) cleanup();
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache, no-transform',
                Connection: 'keep-alive',
                'X-Accel-Buffering': 'no', // disable Nginx buffering
            },
        });
    })

    // ── DEVICE REGISTRATION ───────────────────────────────────────────────────
    // POST /api/notifications/register-device   { token, platform? }
    //
    // The mobile app calls this after sign-in, once Expo has issued a push
    // token for this install. Without a registered token the backend has no
    // address to deliver to, and a patient whose app is closed learns about a
    // consent request only when they next open it.
    //
    // Re-registration is expected and must be cheap: Expo reissues the token on
    // reinstall, and the app registers on every launch. The token column is
    // unique, so the upsert below moves an existing token to the current user
    // (the same handset can be signed into a different account) and refreshes
    // lastSeenAt rather than accumulating duplicate rows — duplicates would
    // deliver the same notification to one phone several times.
    .post(
        '/register-device',
        authMiddleware,
        async (c) => {
            const userId = c.get('userId');
            const userType = c.get('userType');
            if (!userId) return c.json({ success: false, error: { message: 'Unauthorized' } }, 401);

            const body = await c.req.json().catch(() => null);
            const parsed = z
                .object({
                    token: z.string().min(1),
                    platform: z.enum(['ios', 'android']).optional(),
                })
                .safeParse(body);

            if (!parsed.success) {
                return c.json({ success: false, error: { message: 'A push token is required' } }, 400);
            }

            // Expo tokens look like ExponentPushToken[xxxxxxxx]. Reject anything
            // else here so a malformed value never reaches the push service.
            if (!/^Expo(nent)?PushToken\[.+\]$/.test(parsed.data.token)) {
                return c.json({ success: false, error: { message: 'Not a valid Expo push token' } }, 400);
            }

            await db
                .insert(deviceTokens)
                .values({
                    userId,
                    userType: userType as any,
                    token: parsed.data.token,
                    platform: parsed.data.platform ?? null,
                })
                .onConflictDoUpdate({
                    target: deviceTokens.token,
                    set: { userId, userType: userType as any, lastSeenAt: new Date() },
                });

            return c.json({ success: true, data: { registered: true } });
        },
    )

    // ── DEVICE DE-REGISTRATION ────────────────────────────────────────────────
    // DELETE /api/notifications/register-device   { token }
    //
    // Called on sign-out. Without this the handset keeps receiving the previous
    // user's consent requests — which for this system means one patient being
    // notified about another patient's records.
    .delete(
        '/register-device',
        authMiddleware,
        async (c) => {
            const userId = c.get('userId');
            if (!userId) return c.json({ success: false, error: { message: 'Unauthorized' } }, 401);

            const body = await c.req.json().catch(() => null);
            const token = typeof body?.token === 'string' ? body.token : null;
            if (!token) return c.json({ success: false, error: { message: 'A push token is required' } }, 400);

            // Scoped to the caller, so one user cannot unregister another's device.
            await db
                .delete(deviceTokens)
                .where(and(eq(deviceTokens.token, token), eq(deviceTokens.userId, userId)));

            return c.json({ success: true, data: { removed: true } });
        },
    )

    // ── HEALTH (optional) ─────────────────────────────────────────────────────
    .get('/health', authMiddleware, (c) => {
        return c.json({ activeConnections: activeConnectionCount() });
    });