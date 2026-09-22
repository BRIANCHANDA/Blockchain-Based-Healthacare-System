import { OpenAPIHono, z } from '@hono/zod-openapi';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { patients, crossInstitutionAccess, visits, auditLogs } from '../db/schema';
import { randomUUID } from 'node:crypto';
import { authMiddleware, requireUserType } from '../middleware/auth';
import { AppError, handleError } from '../lib/errors';
import { notifyDataChanged } from '../services/realtime';

// Intentionally self-only; a clinician or acting-as-patient header cannot opt in.
export const emergencyPreferenceRouter = new OpenAPIHono<{ Variables: { userId: string; userType: string } }>();
emergencyPreferenceRouter.use('*', authMiddleware, requireUserType('patient'));
emergencyPreferenceRouter.get('/', async c => {
  try {
    const [patient] = await db.select({ enabled: patients.emergencyOverrideEnabled }).from(patients)
      .where(eq(patients.id, c.get('userId')));
    if (!patient) throw new AppError('Patient not found', 404);
    return c.json({ success: true, data: patient });
  } catch (error) { return handleError(error, c); }
});
emergencyPreferenceRouter.patch('/', async c => {
  try {
    const parsed = z.object({ enabled: z.boolean() }).strict().safeParse(await c.req.json());
    if (!parsed.success) throw new AppError('enabled must be a boolean', 400);
    const patientId = c.get('userId');
    const { enabled } = parsed.data;
    await db.transaction(async tx => {
      const [patient] = await tx.select({ id: patients.id }).from(patients)
        .where(eq(patients.id, patientId)).for('update');
      if (!patient) throw new AppError('Patient not found', 404);
      await tx.update(patients).set({ emergencyOverrideEnabled: enabled, updatedAt: new Date() })
        .where(eq(patients.id, patientId));
      if (!enabled) await tx.update(crossInstitutionAccess).set({ status: 'revoked', updatedAt: new Date() })
        .where(and(eq(crossInstitutionAccess.patientId, patientId),
          eq(crossInstitutionAccess.accessType, 'emergency'), eq(crossInstitutionAccess.status, 'active')));
      await tx.insert(auditLogs).values({ userId: patientId, userType: 'patient', patientId,
        actionType: 'update', resourceType: 'emergency_access_preference', resourceId: patientId,
        accessReason: enabled ? 'Patient enabled emergency access' : 'Patient disabled emergency access',
        // This preference is enforced off-chain; do not invent a ledger transaction.
        blockchainTransactionId: `offchain:${randomUUID()}` });
    });
    // Refresh open histories; no clinical data is sent in the invalidation.
    try {
      const destinations = await db.select({ id: crossInstitutionAccess.targetInstitutionId })
        .from(crossInstitutionAccess).where(eq(crossInstitutionAccess.patientId, patientId));
      const homes = await db.select({ id: visits.institutionId }).from(visits).where(eq(visits.patientId, patientId));
      for (const id of new Set([...destinations, ...homes].map(row => row.id))) notifyDataChanged(id, patientId);
    } catch { /* Preference committed; refresh delivery must not turn success into failure. */ }
    return c.json({ success: true, data: { enabled } });
  } catch (error) { return handleError(error, c); }
});
