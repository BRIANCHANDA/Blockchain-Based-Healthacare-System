import { handleError } from '../lib/errors';
import { createRoute, z } from '@hono/zod-openapi';
import { eq, desc, and, count, inArray, SQL } from 'drizzle-orm';
import { db } from '../db';
import {
  auditLogs, patients, practitioners,
  visits, prescriptions, labTestOrders,
  imagingOrders, vitalSigns,
} from '../db/schema';
import { createRouter } from '../lib/create-app';
import { authMiddleware } from '../middleware/auth';
import { decrypt } from '../services/crypto';
import { getPatientAuditLog, checkPermission } from '../services/fabric';

// ── Zod Schemas ───────────────────────────────────────────────────────────────

const errorSchema = z.object({
  success: z.boolean(),
  error: z.object({ message: z.string() }),
});

const auditResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    dbLogs: z.array(z.any()),
    blockchainLogs: z.array(z.any()),
    stats: z.object({
      total: z.number(),
      anchored: z.number(),
      emergencyOverrides: z.number(),
      uniqueActors: z.number(),
    }).optional(),
  }),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeDec(fn: () => string): string {
  try { return fn(); } catch { return ''; }
}

// Enrich raw audit log rows with actor names, patient name, and resource details.
// Used by both /my-log (patient) and /patient/:id (admin/practitioner) endpoints.
async function enrichAuditLogs(rawLogs: any[]) {
  if (!rawLogs.length) return [];

  // ── Collect unique IDs ──
  const actorIds = [...new Set(rawLogs.map(l => l.userId).filter(Boolean))];
  const patientIds = [...new Set(rawLogs.map(l => l.patientId).filter(Boolean))] as string[];

  // ── Batch fetch actors ──
  const actorRows = actorIds.length
    ? await db.select({
      id: practitioners.id,
      firstNameEncrypted: practitioners.firstNameEncrypted,
      lastNameEncrypted: practitioners.lastNameEncrypted,
      role: practitioners.role,
      specialization: practitioners.specialization,
      department: practitioners.department,
    }).from(practitioners).where(inArray(practitioners.id, actorIds))
    : [];

  const actorMap = new Map<string, { name: string; role: string; specialization: string | null; department: string | null }>();
  for (const a of actorRows) {
    const firstName = safeDec(() => decrypt(a.firstNameEncrypted));
    const lastName = safeDec(() => decrypt(a.lastNameEncrypted));
    actorMap.set(a.id, {
      name: `${firstName} ${lastName}`.trim() || 'Unknown',
      role: a.role,
      specialization: a.specialization,
      department: a.department,
    });
  }

  // ── Batch fetch patients ──
  const patientRows = patientIds.length
    ? await db.select({
      id: patients.id,
      firstNameEncrypted: patients.firstNameEncrypted,
      lastNameEncrypted: patients.lastNameEncrypted,
    }).from(patients).where(inArray(patients.id, patientIds))
    : [];

  const patientMap = new Map<string, string>();
  for (const p of patientRows) {
    const firstName = safeDec(() => decrypt(p.firstNameEncrypted));
    const lastName = safeDec(() => decrypt(p.lastNameEncrypted));
    patientMap.set(p.id, `${firstName} ${lastName}`.trim() || 'Unknown Patient');
  }

  // ── Batch fetch resource details ──
  const resourceDetailMap = new Map<string, string>();
  const byType: Record<string, string[]> = {};
  for (const log of rawLogs) {
    if (!log.resourceId || !log.resourceType) continue;
    (byType[log.resourceType] ??= []).push(log.resourceId);
  }

  for (const [type, ids] of Object.entries(byType)) {
    const uniqueIds = [...new Set(ids)];
    if (!uniqueIds.length) continue;

    try {
      if (['visit', 'discharge', 'visit_summary'].includes(type)) {
        const rows = await db
          .select({ id: visits.id, visitNumber: visits.visitNumber, visitType: visits.visitType, chiefComplaint: visits.chiefComplaint })
          .from(visits).where(inArray(visits.id, uniqueIds));
        rows.forEach(r =>
          resourceDetailMap.set(r.id,
            `${r.visitNumber} — ${r.visitType}${r.chiefComplaint ? ` · "${r.chiefComplaint}"` : ''}`
          )
        );
      } else if (['prescription', 'prescription_dispense'].includes(type)) {
        const rows = await db
          .select({ id: prescriptions.id, prescriptionNumber: prescriptions.prescriptionNumber, status: prescriptions.status })
          .from(prescriptions).where(inArray(prescriptions.id, uniqueIds));
        rows.forEach(r =>
          resourceDetailMap.set(r.id, `${r.prescriptionNumber} (${r.status})`)
        );
      } else if (['lab_order', 'lab_result'].includes(type)) {
        const rows = await db
          .select({ id: labTestOrders.id, orderNumber: labTestOrders.orderNumber, testName: labTestOrders.testName, status: labTestOrders.status })
          .from(labTestOrders).where(inArray(labTestOrders.id, uniqueIds));
        rows.forEach(r =>
          resourceDetailMap.set(r.id, `${r.testName} — ${r.orderNumber}`)
        );
      } else if (['imaging_order', 'imaging_report', 'imaging_image'].includes(type)) {
        const rows = await db
          .select({ id: imagingOrders.id, orderNumber: imagingOrders.orderNumber, modality: imagingOrders.modality, bodyPart: imagingOrders.bodyPart })
          .from(imagingOrders).where(inArray(imagingOrders.id, uniqueIds));
        rows.forEach(r =>
          resourceDetailMap.set(r.id, `${r.modality?.toUpperCase()} ${r.bodyPart}`)
        );
      } else if (type === 'vital_signs') {
        const rows = await db
          .select({
            id: vitalSigns.id,
            temperature: vitalSigns.temperature,
            bloodPressureSystolic: vitalSigns.bloodPressureSystolic,
            bloodPressureDiastolic: vitalSigns.bloodPressureDiastolic,
            pulseRate: vitalSigns.pulseRate,
          })
          .from(vitalSigns).where(inArray(vitalSigns.id, uniqueIds));
        rows.forEach(r => {
          const parts: string[] = [];
          if (r.temperature) parts.push(`Temp ${r.temperature}°C`);
          if (r.bloodPressureSystolic) parts.push(`BP ${r.bloodPressureSystolic}/${r.bloodPressureDiastolic}`);
          if (r.pulseRate) parts.push(`HR ${r.pulseRate}`);
          resourceDetailMap.set(r.id, parts.length ? parts.join(' · ') : 'Vitals recorded');
        });
      } else if (type === 'consultation') {
        uniqueIds.forEach(id => resourceDetailMap.set(id, 'Consultation notes'));
      } else if (type === 'diagnosis') {
        uniqueIds.forEach(id => resourceDetailMap.set(id, 'Diagnosis record'));
      }
    } catch (e) {
      console.warn(`[AUDIT_ENRICH] type=${type}:`, e);
    }
  }

  // ── Assemble enriched rows ──
  return rawLogs.map(log => {
    const actor = actorMap.get(log.userId);
    const isAnchored = !!log.blockchainTransactionId && log.blockchainTransactionId !== 'no-tx';
    return {
      id: log.id,
      timestamp: log.timestamp,
      userId: log.userId,
      userType: log.userType,
      actorName: actor?.name ?? 'Unknown',
      actorRole: actor?.role ?? log.userType,
      actorSpecialization: actor?.specialization ?? null,
      actorDepartment: actor?.department ?? null,
      patientId: log.patientId,
      patientName: patientMap.get(log.patientId) ?? 'Unknown Patient',
      actionType: log.actionType,
      resourceType: log.resourceType,
      resourceId: log.resourceId ?? null,
      resourceDetail: log.resourceId ? (resourceDetailMap.get(log.resourceId) ?? null) : null,
      accessReason: log.accessReason ?? null,
      isEmergencyOverride: log.isEmergencyOverride,
      isAnchored,
      blockchainTransactionId: log.blockchainTransactionId,
      ipAddress: log.ipAddress ?? null,
      userAgent: log.userAgent ?? null,
    };
  });
}

// ── Router ────────────────────────────────────────────────────────────────────

export const auditRouter = createRouter()

  // ── GET MY AUDIT LOG (Patient) — now enriched ─────────────────────────────
  .openapi(createRoute({
    tags: ['Audit'],
    summary: 'Patient views complete audit trail of who accessed their records',
    method: 'get',
    path: '/my-log',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    responses: {
      200: { content: { 'application/json': { schema: auditResponseSchema } }, description: 'Audit logs' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
    // @ts-expect-error
  }), async (c) => {
    try {
      // @ts-expect-error
      const userId = c.get('userId');
      // @ts-expect-error
      const userType = c.get('userType');
      // @ts-expect-error
      const blockchainAddress = c.get('blockchainAddress');

      if (userType !== 'patient')
        return c.json({ success: false, error: { message: 'Only patients can view their own audit log' } }, 403);

      const rawLogs = await db.select().from(auditLogs)
        .where(eq(auditLogs.patientId, userId))
        .orderBy(desc(auditLogs.timestamp));

      // Enrich (actor names, resource details, anchor badge)
      const enrichedLogs = await enrichAuditLogs(rawLogs);

      // Stats
      const anchored = enrichedLogs.filter(l => l.isAnchored).length;
      const emergencyOverrides = enrichedLogs.filter(l => l.isEmergencyOverride).length;
      const uniqueActors = new Set(enrichedLogs.map(l => l.userId)).size;

      // Best-effort blockchain fetch (won't block if down)
      let blockchainLogs: any[] = [];
      try { blockchainLogs = await getPatientAuditLog(blockchainAddress); } catch { }

      return c.json({
        success: true,
        data: {
          dbLogs: enrichedLogs,
          blockchainLogs,
          stats: {
            total: enrichedLogs.length,
            anchored,
            emergencyOverrides,
            uniqueActors,
          },
        },
      });
    } catch (err: unknown) {
      console.error('[AUDIT_MY_LOG]', err);
      return handleError(err, c);
    }
  })

  // ── GET AUDIT LOG FOR PATIENT (Admin / Practitioner with permission) ──────
  .openapi(createRoute({
    tags: ['Audit'],
    summary: 'View audit log for a specific patient',
    method: 'get',
    path: '/patient/:patientId',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: { params: z.object({ patientId: z.string().uuid() }) },
    responses: {
      200: { content: { 'application/json': { schema: auditResponseSchema } }, description: 'Patient audit logs' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Access denied' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Patient not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
    // @ts-expect-error
  }), async (c) => {
    try {
      // @ts-expect-error
      const userType = c.get('userType');
      // @ts-expect-error
      const userId = c.get('userId');
      // @ts-expect-error
      const userBlockchainAddress = c.get('blockchainAddress');
      const { patientId } = c.req.valid('param');

      const patient = await db
        .select({ blockchainAddress: patients.blockchainAddress })
        .from(patients).where(eq(patients.id, patientId)).limit(1);
      if (!patient.length)
        return c.json({ success: false, error: { message: 'Patient not found' } }, 404);

      if (userType !== 'admin') {
        const hasPermission = await checkPermission(patient[0].blockchainAddress, userBlockchainAddress);
        if (!hasPermission) {
          await db.insert(auditLogs).values({
            userId, userType, patientId,
            actionType: 'view', resourceType: 'audit_log', resourceId: null,
            blockchainTransactionId: 'no-tx',
            ipAddress: c.req.header('x-forwarded-for'),
          }).catch(() => { });
          return c.json({ success: false, error: { message: "No permission to view this patient's logs" } }, 403);
        }
      }

      const rawLogs = await db.select().from(auditLogs).where(eq(auditLogs.patientId, patientId)).orderBy(desc(auditLogs.timestamp));
      const enrichedLogs = await enrichAuditLogs(rawLogs);

      let blockchainLogs: any[] = [];
      try { blockchainLogs = await getPatientAuditLog(patient[0].blockchainAddress); } catch { }

      return c.json({ success: true, data: { dbLogs: enrichedLogs, blockchainLogs } });
    } catch (err: unknown) {
      console.error('[AUDIT_PATIENT]', err);
      return handleError(err, c);
    }
  })

  // ── GET ALL AUDIT LOGS — enriched (Admin only) ────────────────────────────
  .openapi(createRoute({
    tags: ['Audit'],
    summary: 'Admin views enriched system audit logs',
    method: 'get',
    path: '/',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: {
      query: z.object({
        page: z.string().optional(),
        limit: z.string().optional(),
        actionType: z.string().optional(),
        userType: z.string().optional(),
        institutionId: z.string().uuid().optional(),
      }),
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              data: z.object({
                logs: z.array(z.any()),
                total: z.number(),
                page: z.number(),
                totalPages: z.number(),
              }),
            }),
          },
        },
        description: 'Enriched audit logs',
      },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Admin only' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
    // @ts-expect-error
  }), async (c) => {
    try {
      // @ts-expect-error
      const callerType = c.get('userType');
      if (callerType !== 'admin')
        return c.json({ success: false, error: { message: 'Only admins can view audit logs' } }, 403);

      // @ts-expect-error
      const callerInstitutionId: string | null = c.get('institutionId') ?? null;

      const query = c.req.valid('query');
      const page = Math.max(1, parseInt(query.page ?? '1'));
      const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '20')));
      const offset = (page - 1) * limit;

      // Resolve which institution to scope to:
      // - Hospital admin: always scoped to their own institution
      // - Super admin: optionally scoped to a specific institution via query param
      const scopedInstitutionId = callerInstitutionId ?? query.institutionId ?? null;

      // Build user-id allowlist when scoped to an institution
      let allowedUserIds: string[] | null = null;
      if (scopedInstitutionId) {
        const staffRows = await db
          .select({ id: practitioners.id })
          .from(practitioners)
          .where(eq(practitioners.institutionId, scopedInstitutionId));
        allowedUserIds = staffRows.map(r => r.id);
        // If the institution has no staff, return empty result early
        if (!allowedUserIds.length)
          return c.json({ success: true, data: { logs: [], total: 0, page, totalPages: 0 } });
      }

      const conditions: SQL<unknown>[] = [];
      if (query.actionType) conditions.push(eq(auditLogs.actionType, query.actionType as any));
      if (query.userType) conditions.push(eq(auditLogs.userType, query.userType as any));
      if (allowedUserIds) conditions.push(inArray(auditLogs.userId, allowedUserIds));
      const where = conditions.length ? and(...conditions) : undefined;

      const [rawLogs, countResult] = await Promise.all([
        db.select().from(auditLogs)
          .where(where)
          .orderBy(desc(auditLogs.timestamp))
          .limit(limit)
          .offset(offset),
        db.select({ total: count() }).from(auditLogs).where(where),
      ]);

      const total = Number(countResult[0]?.total ?? 0);
      if (!rawLogs.length)
        return c.json({ success: true, data: { logs: [], total, page, totalPages: 0 } });

      const logs = await enrichAuditLogs(rawLogs);

      return c.json({
        success: true,
        data: { logs, total, page, totalPages: Math.ceil(total / limit), scopedInstitutionId },
      });
    } catch (err: unknown) {
      console.error('[ADMIN_AUDIT]', err);
      return c.json({
        success: false,
        error: { message: err instanceof Error ? err.message : 'Internal server error' },
      }, 500);
    }
  });