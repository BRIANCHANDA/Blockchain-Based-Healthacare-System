import type { Context, Next } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { practitioners, visits } from '../db/schema';
import { clinicalWriteDenial } from '../lib/visit-ownership';

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
const transactions = new WeakMap<Context, Transaction>();
const committed = new WeakMap<Context, Array<() => void | Promise<void>>>();
type ClinicalDb = Pick<typeof db, 'select' | 'insert' | 'update' | 'delete' | 'execute' | 'query' | 'transaction'>;
export function clinicalDb(c: Context): ClinicalDb { return transactions.get(c) ?? db; }
export function afterClinicalCommit(c: Context, task: () => void | Promise<void>) {
  const tasks = committed.get(c) ?? [];
  tasks.push(task);
  committed.set(c, tasks);
}

/** Hold the visit row lock through the clinical write, serializing handovers
 * and already-open forms. Handlers MUST use clinicalDb(c), not the global DB. */
export function createClinicalWriteGuard(database: Pick<typeof db, 'transaction'> = db) {
 return async function clinicalWriteGuard(c: Context, next: Next) {
  const raw = c.req.method === 'GET' ? {} : await c.req.json().catch(() => ({}));
  const body = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const visitId = c.req.param('visitId') ?? body.visitId ?? body.originVisitId;
  if (!visitId) return next(); // Standalone referrals/appointments have no encounter.
  if (typeof visitId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(visitId))
    return c.json({ success: false, error: { message: 'Invalid visit ID' } }, 400);
  const rollback = new Error('Clinical request rejected');
  try {
    await database.transaction(async tx => {
      const [visit] = await tx.select().from(visits).where(eq(visits.id, visitId)).for('update');
      if (!visit) { c.res = c.json({ success: false, error: { message: 'Visit not found' } }, 404); return; }
      if (body.patientId && body.patientId !== visit.patientId) {
        c.res = c.json({ success: false, error: { message: 'Patient does not match this visit' } }, 403); return;
      }
      if (c.get('userType') === 'practitioner') {
        const [doctor] = await tx.select({ id: practitioners.id, institutionId: practitioners.institutionId })
          .from(practitioners).where(eq(practitioners.id, c.get('userId')));
        const denial = doctor ? clinicalWriteDenial(visit, doctor) : 'Doctor not found';
        if (denial) { c.res = c.json({ success: false, error: { message: denial } }, 403); return; }
      }
      transactions.set(c, tx);
      await next();
      if (c.res.status >= 400) throw rollback;
    });
    for (const task of committed.get(c) ?? []) {
      try { await task(); } catch (error) { console.warn('[HANDOVER_NOTIFICATION]', error); }
    }
  } catch (error) {
    if (error !== rollback) {
      console.error('[CLINICAL_WRITE]', error);
      return c.json({ success: false, error: { message: 'Could not save clinical action' } }, 500);
    }
  } finally { transactions.delete(c); committed.delete(c); }
 };
}
export const clinicalWriteGuard = createClinicalWriteGuard();
