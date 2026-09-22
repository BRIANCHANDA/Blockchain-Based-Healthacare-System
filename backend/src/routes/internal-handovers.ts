import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { auditLogs, patients, practitioners, visits } from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { afterClinicalCommit, clinicalDb, clinicalWriteGuard } from '../middleware/clinical-write';
import { decrypt } from '../services/crypto';
import { notifyDataChanged, notifyUser } from '../services/realtime';

const response = { content: { 'application/json': { schema: z.any() } }, description: 'Handover response' };
const name = (first: string, last: string) => {
  try { return `${decrypt(first)} ${decrypt(last)}`.trim(); } catch { return 'Unknown'; }
};

export const internalHandoversRouter = new OpenAPIHono<{ Variables: { userId: string; userType: string } }>()
  .openapi(createRoute({
    method: 'post', path: '/', tags: ['Visits'], summary: 'Hand over an active visit to another doctor',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware, clinicalWriteGuard],
    request: { body: { content: { 'application/json': { schema: z.object({
      visitId: z.string().uuid(), patientId: z.string().uuid(), doctorId: z.string().uuid(),
      reason: z.string().trim().min(5).max(4000),
      priority: z.enum(['routine', 'urgent', 'emergency', 'critical']),
    }) } } } },
    responses: { 200: response, 400: response, 403: response, 404: response, 409: response },
  }), async c => {
    if (c.get('userType') !== 'practitioner')
      return c.json({ success: false, error: { message: 'Only the assigned doctor can hand over a visit' } }, 403);
    const tx = clinicalDb(c);
    const body = c.req.valid('json');
    const userId = c.get('userId');
    if (body.doctorId === userId)
      return c.json({ success: false, error: { message: 'Select another doctor' } }, 400);
    const [visit] = await tx.select().from(visits).where(eq(visits.id, body.visitId));
    const [doctor] = await tx.select().from(practitioners).where(and(
      eq(practitioners.id, body.doctorId), eq(practitioners.role, 'practitioner'),
      eq(practitioners.institutionId, visit.institutionId!), eq(practitioners.isActive, true),
      eq(practitioners.isVerified, true),
    ));
    if (!doctor) return c.json({ success: false, error: { message: 'Select an active verified doctor at this hospital' } }, 404);
    await tx.update(visits).set({ assignedDoctorId: doctor.id, priority: body.priority, updatedAt: new Date() })
      .where(eq(visits.id, visit.id));
    // Existing immutable audit storage records the handover history without
    // repurposing diagnosis fields or creating a second patient encounter.
    await tx.insert(auditLogs).values({
      userId, userType: 'practitioner', patientId: visit.patientId, actionType: 'update',
      resourceType: 'internal_handover', resourceId: visit.id,
      blockchainTransactionId: crypto.randomUUID(),
      accessReason: JSON.stringify({ receivingDoctorId: doctor.id, reason: body.reason }),
      ipAddress: c.req.header('x-forwarded-for'),
    });
    const [patient] = await tx.select().from(patients).where(eq(patients.id, visit.patientId));
    afterClinicalCommit(c, () => {
      notifyUser(doctor.id, 'internal_referral_received', {
        visitId: visit.id, visitNumber: visit.visitNumber,
        patientName: name(patient.firstNameEncrypted, patient.lastNameEncrypted),
        reason: body.reason, priority: body.priority,
      });
      notifyDataChanged(visit.institutionId, userId);
    });
    return c.json({ success: true, data: { visitId: visit.id, visitNumber: visit.visitNumber } });
  })
  .openapi(createRoute({
    method: 'get', path: '/', tags: ['Visits'], summary: 'My internal handovers',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware], responses: { 200: response, 403: response },
  }), async c => {
    const userId = c.get('userId');
    if (c.get('userType') !== 'practitioner') return c.json({ success: false }, 403);
    const [doctor] = await db.select().from(practitioners).where(eq(practitioners.id, userId));
    if (!doctor?.institutionId) return c.json({ success: false }, 403);
    const rows = await db.select({ audit: auditLogs, visit: visits, patient: patients })
      .from(auditLogs).innerJoin(visits, eq(visits.id, auditLogs.resourceId))
      .innerJoin(patients, eq(patients.id, visits.patientId))
      .where(and(eq(auditLogs.resourceType, 'internal_handover'), eq(visits.institutionId, doctor.institutionId),
        sql`(${auditLogs.userId} = ${userId} OR CASE WHEN ${auditLogs.resourceType} = 'internal_handover' THEN ${auditLogs.accessReason}::jsonb->>'receivingDoctorId' END = ${userId})`))
      .orderBy(desc(auditLogs.timestamp)).limit(200);
    const staff = await db.select().from(practitioners).where(eq(practitioners.institutionId, doctor.institutionId));
    const names = new Map(staff.map(s => [s.id, name(s.firstNameEncrypted, s.lastNameEncrypted)]));
    const incoming: any[] = [], outgoing: any[] = [];
    for (const { audit, visit, patient } of rows) {
      const details = JSON.parse(audit.accessReason!);
      const item = {
        id: visit.id, visitNumber: visit.visitNumber, patientId: visit.patientId,
        patientName: name(patient.firstNameEncrypted, patient.lastNameEncrypted),
        chiefComplaint: visit.chiefComplaint, admittingDiagnosis: details.reason,
        priority: visit.priority, admissionDate: audit.timestamp, status: visit.status,
        assignedDoctorId: details.receivingDoctorId, doctorName: names.get(details.receivingDoctorId),
        createdByPractitionerId: audit.userId, referringDoctorName: names.get(audit.userId!),
      };
      if (audit.userId === userId && !outgoing.some(v => v.id === visit.id)) outgoing.push(item);
      if (details.receivingDoctorId === userId && visit.assignedDoctorId === userId && !incoming.some(v => v.id === visit.id)) incoming.push(item);
    }
    return c.json({ success: true, data: { incoming, outgoing } });
  });
