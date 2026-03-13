import { createRoute, z } from '@hono/zod-openapi';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db';
import { auditLogs, patients } from '../db/schema';
import { createRouter } from '../lib/create-app';
import { authMiddleware } from '../middleware/auth';
import { getPatientAuditLog, checkPermission } from '../services/fabric';

// ── Zod Schemas ──────────────────────────────────────────

const errorSchema = z.object({
  success: z.boolean(),
  error: z.object({ message: z.string() }),
});

const auditLogEntrySchema = z.any(); // could be refined later

const auditResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    dbLogs: z.array(auditLogEntrySchema),
    blockchainLogs: z.array(auditLogEntrySchema),
  }),
});

// ── Router ───────────────────────────────────────────────

export const auditRouter = createRouter()

  // ── GET MY AUDIT LOG (Patient) ─────────────────────────
  .openapi(createRoute({
    tags: ['Audit'],
    summary: 'Patient views complete audit trail of who accessed their records',
    method: 'get',
    path: '/my-log',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    responses: {
      200: {
        content: { 'application/json': { schema: auditResponseSchema } },
        description: 'Audit logs from both DB and blockchain',
      },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden (not a patient)' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
    // @ts-expect-error - Route handler return type inference issue with @hono/zod-openapi
  }), async (c) => {
    try {
      // @ts-expect-error - context keys not recognized by TypeScript
      const userId = c.get('userId');
      // @ts-expect-error - context keys not recognized by TypeScript
      const userType = c.get('userType');
      // @ts-expect-error - context keys not recognized by TypeScript
      const blockchainAddress = c.get('blockchainAddress');

      if (userType !== 'patient') {
        return c.json({ success: false, error: { message: 'Only patients can view their own audit log' } }, 403);
      }

      // Get from database
      const dbLogs = await db.select().from(auditLogs)
        .where(eq(auditLogs.patientId, userId))
        .orderBy(desc(auditLogs.timestamp));

      // Get from blockchain (immutable source of truth)
      const blockchainLogs = await getPatientAuditLog(blockchainAddress);

      return c.json({ success: true, data: { dbLogs, blockchainLogs } }, 200);

    } catch (err: unknown) {
      console.error('Audit log error:', err);
      return c.json({ success: false, error: { message: err instanceof Error ? err.message : 'Internal server error' } }, 500);
    }
  })

  // ── GET AUDIT LOG FOR PATIENT (Admin/Practitioner with permission) ───
  .openapi(createRoute({
    tags: ['Audit'],
    summary: 'View audit log for a specific patient',
    method: 'get',
    path: '/patient/:patientId',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: {
      params: z.object({ patientId: z.string().uuid() }),
    },
    responses: {
      200: {
        content: { 'application/json': { schema: auditResponseSchema } },
        description: 'Patient audit logs',
      },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Access denied' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Patient not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
    // @ts-expect-error - Route handler return type inference issue with @hono/zod-openapi
  }), async (c) => {
    try {
      // @ts-expect-error - context keys not recognized by TypeScript
      const userType = c.get('userType');
      // @ts-expect-error - context keys not recognized by TypeScript
      const userId = c.get('userId');
      // @ts-expect-error - context keys not recognized by TypeScript
      const userBlockchainAddress = c.get('blockchainAddress');
      const { patientId } = c.req.valid('param');

      // Get patient blockchain address
      const patient = await db.select({ blockchainAddress: patients.blockchainAddress })
        .from(patients).where(eq(patients.id, patientId)).limit(1);

      if (!patient.length) {
        return c.json({ success: false, error: { message: 'Patient not found' } }, 404);
      }

      // Permission check: admins bypass, practitioners must have blockchain permission
      if (userType !== 'admin') {
        const hasPermission = await checkPermission(patient[0].blockchainAddress, userBlockchainAddress);
        if (!hasPermission) {
          // Log attempted unauthorized access
          await db.insert(auditLogs).values({
            userId,
            userType,
            patientId,
            actionType: 'view',
            resourceType: 'audit_log',
            resourceId: null,
            blockchainTransactionId: 'no-tx',
            ipAddress: c.req.header('x-forwarded-for'),
          }).catch(() => { }); // Non‑blocking
          return c.json({ success: false, error: { message: 'No permission to view this patient’s logs' } }, 403);
        }
      }

      const dbLogs = await db.select().from(auditLogs)
        .where(eq(auditLogs.patientId, patientId))
        .orderBy(desc(auditLogs.timestamp));

      const blockchainLogs = await getPatientAuditLog(patient[0].blockchainAddress);

      return c.json({ success: true, data: { dbLogs, blockchainLogs } }, 200);

    } catch (err: unknown) {
      console.error('Audit log fetch error:', err);
      return c.json({ success: false, error: { message: err instanceof Error ? err.message : 'Internal server error' } }, 500);
    }
  });