// backend/src/routes/notifications.ts
//
// Mount in index.ts:
//   import { notificationsRouter } from './routes/notifications';
//   app.route('/api/notifications', notificationsRouter);

import { createRouter } from '../lib/create-app';
import { authMiddleware } from '../middleware/auth';
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

    // ── HEALTH (optional) ─────────────────────────────────────────────────────
    .get('/health', authMiddleware, (c) => {
        return c.json({ activeConnections: activeConnectionCount() });
    });