import type { Context, Next } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { practitioners } from '../db/schema';
import { notifyDataChanged } from '../services/realtime';

export async function liveUpdates(c: Context, next: Next) {
  await next();
  const userId = c.get('userId');
  if (!userId || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(c.req.method) ||
      c.res.status < 200 || c.res.status >= 300 ||
      /^\/api\/(auth|notifications|ai)(\/|$)/.test(c.req.path)) return;
  try {
    const [staff] = await db.select({ institutionId: practitioners.institutionId })
      .from(practitioners).where(eq(practitioners.id, userId)).limit(1);
    notifyDataChanged(staff?.institutionId ?? null, userId);
  } catch (error) {
    // Notification availability must never change the outcome of a saved record.
    console.warn('[LIVE_UPDATE]', error instanceof Error ? error.message : 'Delivery failed');
  }
}
