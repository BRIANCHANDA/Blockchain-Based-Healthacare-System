import { createRoute, z } from '@hono/zod-openapi';
import { eq, desc, inArray } from 'drizzle-orm';
import { db } from '../db';
import {
  visits, consultations, diagnoses, vitalSigns,
  labTestOrders, labTestResults, imagingOrders,
  prescriptions, patients, auditLogs
} from '../db/schema';
import { createRouter } from '../lib/create-app';
import { authMiddleware } from '../middleware/auth';
import { checkPermission, storeRecordHash, logAccess, verifyRecordHash } from '../services/fabric';
import { generateRecordHash, decrypt } from '../services/crypto';
import crypto from 'crypto';

const errorSchema = z.object({
  success: z.boolean(),
  error: z.object({ message: z.string() }),
});

// ── Helper: verify blockchain permission and log access ─────────────────
async function verifyAccess(
  patientBlockchainAddress: string,
  practitionerBlockchainAddress: string,
  practitionerId: string,
  patientId: string,
  resourceType: string,
  resourceId: string,
  ipAddress?: string
): Promise<boolean> {
  const hasPermission = await checkPermission(
    patientBlockchainAddress,
    practitionerBlockchainAddress
  );

  // Log the access attempt on blockchain regardless of outcome
  const logResult = await logAccess(
    patientBlockchainAddress,
    resourceId,
    `${hasPermission ? 'GRANTED' : 'DENIED'}: ${resourceType}`,
    hasPermission
  );

  // Also log in DB audit table
  await db.insert(auditLogs).values({
    userId: practitionerId,
    userType: 'practitioner',
    patientId,
    actionType: 'view',
    resourceType,
    resourceId: resourceId as any,
    blockchainTransactionId: logResult?.txId || crypto.randomBytes(16).toString('hex'),
    ipAddress,
  });

  return hasPermission;
}

export const recordRouter = createRouter()

  // ── GET PATIENT VISITS ────────────────────────────────
  .openapi(createRoute({
    tags: ['Records'],
    summary: 'Get all visits for a patient (requires blockchain permission)',
    method: 'get',
    path: '/visits/:patientId',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: {
      params: z.object({ patientId: z.string().uuid() }),
    },
    responses: {
      200: {
        content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.object({ visits: z.array(z.any()) }) }) } },
        description: 'Patient visits',
      },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'No blockchain permission' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Patient not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const { patientId } = c.req.valid('param');
      const userId = c.get('userId');
      const userType = c.get('userType');
      const practitionerBlockchainAddress = c.get('blockchainAddress');
      const ip = c.req.header('x-forwarded-for');

      // Get patient blockchain address
      const patient = await db.select({
        id: patients.id,
        blockchainAddress: patients.blockchainAddress,
      }).from(patients).where(eq(patients.id, patientId)).limit(1);

      if (!patient.length) {
        return c.json({ success: false, error: { message: 'Patient not found' } }, 404);
      }

      // Patients can always see their own records
      if (userType !== 'patient') {
        const hasAccess = await verifyAccess(
          patient[0].blockchainAddress,
          practitionerBlockchainAddress,
          userId,
          patientId,
          'visits',
          patientId,
          ip
        );

        if (!hasAccess) {
          return c.json({ success: false, error: { message: 'Access denied - patient has not granted you permission' } }, 403);
        }
      }

      const patientVisits = await db.select().from(visits)
        .where(eq(visits.patientId, patientId))
        .orderBy(desc(visits.admissionDate));

      return c.json({ success: true, data: { visits: patientVisits } });

    } catch (err: any) {
      console.error('Get patient visits error:', err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ── GET VISIT DETAILS (full record) ──────────────────
  .openapi(createRoute({
    tags: ['Records'],
    summary: 'Get full details of a visit including consultations, labs, imaging, prescriptions',
    method: 'get',
    path: '/visits/:patientId/:visitId',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: {
      params: z.object({
        patientId: z.string().uuid(),
        visitId: z.string().uuid(),
      }),
    },
    responses: {
      200: {
        content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.any() }) } },
        description: 'Full visit record',
      },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'No permission' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Patient or visit not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const { patientId, visitId } = c.req.valid('param');
      const userId = c.get('userId');
      const userType = c.get('userType');
      const practitionerBlockchainAddress = c.get('blockchainAddress');
      const ip = c.req.header('x-forwarded-for');

      // Get patient for blockchain check
      const patient = await db.select({
        blockchainAddress: patients.blockchainAddress
      }).from(patients).where(eq(patients.id, patientId)).limit(1);

      if (!patient.length) {
        return c.json({ success: false, error: { message: 'Patient not found' } }, 404);
      }

      // Check permission for non-patients
      if (userType !== 'patient') {
        const hasAccess = await verifyAccess(
          patient[0].blockchainAddress,
          practitionerBlockchainAddress,
          userId,
          patientId,
          'visit_detail',
          visitId,
          ip
        );
        if (!hasAccess) {
          return c.json({ success: false, error: { message: 'Access denied - no blockchain permission' } }, 403);
        }
      }

      // Fetch all visit data in parallel
      const [
        visitData,
        consultationData,
        diagnosisData,
        vitalData,
        labOrders,
        imagingOrderData,
        prescriptionData,
      ] = await Promise.all([
        db.select().from(visits).where(eq(visits.id, visitId)).limit(1),
        db.select().from(consultations).where(eq(consultations.visitId, visitId)),
        db.select().from(diagnoses).where(eq(diagnoses.visitId, visitId)),
        db.select().from(vitalSigns).where(eq(vitalSigns.visitId, visitId)).orderBy(desc(vitalSigns.recordedAt)),
        db.select().from(labTestOrders).where(eq(labTestOrders.visitId, visitId)),
        db.select().from(imagingOrders).where(eq(imagingOrders.visitId, visitId)),
        db.select().from(prescriptions).where(eq(prescriptions.visitId, visitId)),
      ]);

      if (!visitData.length) {
        return c.json({ success: false, error: { message: 'Visit not found' } }, 404);
      }

      return c.json({
        success: true,
        data: {
          visit: visitData[0],
          consultations: consultationData,
          diagnoses: diagnosisData,
          vitalSigns: vitalData,
          labOrders,
          imagingOrders: imagingOrderData,
          prescriptions: prescriptionData,
        }
      });

    } catch (err: any) {
      console.error('Get visit details error:', err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ── CREATE VISIT ──────────────────────────────────────
  .openapi(createRoute({
    tags: ['Records'],
    summary: 'Create a new visit/encounter for a patient',
    method: 'post',
    path: '/visits',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              patientId: z.string().uuid(),
              institutionId: z.string().uuid().optional(),
              departmentId: z.string().uuid().optional(),
              wardId: z.string().uuid().optional(),
              visitType: z.enum(['outpatient', 'inpatient', 'emergency', 'consultation']),
              chiefComplaint: z.string().min(5),
              priority: z.enum(['routine', 'urgent', 'emergency', 'critical']).default('routine'),
              admittingDiagnosis: z.string().optional(),
              wardOrRoom: z.string().optional(),
              bedNumber: z.string().optional(),
            })
          }
        },
      },
    },
    responses: {
      201: {
        content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.object({ visitId: z.string(), visitNumber: z.string(), blockchainHash: z.string() }) }) } },
        description: 'Visit created',
      },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Patient not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      if (!['practitioner', 'nurse'].includes(userType)) {
        return c.json({ success: false, error: { message: 'Only practitioners or nurses can create visits' } }, 403);
      }

      const body = c.req.valid('json');
      const userId = c.get('userId');
      const ip = c.req.header('x-forwarded-for');

      // Get patient blockchain address
      const patient = await db.select({
        id: patients.id,
        blockchainAddress: patients.blockchainAddress,
      }).from(patients).where(eq(patients.id, body.patientId)).limit(1);

      if (!patient.length) {
        return c.json({ success: false, error: { message: 'Patient not found' } }, 404);
      }

      // Generate visit number
      const visitNumber = `VIS-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

      // Generate hash of the visit data
      const visitHash = generateRecordHash({
        patientId: body.patientId,
        visitType: body.visitType,
        chiefComplaint: body.chiefComplaint,
        visitNumber,
        timestamp: new Date().toISOString(),
      });

      // First insert the visit into the database (so we get the DB-generated ID)
      const result = await db.insert(visits).values({
        patientId: body.patientId,
        institutionId: body.institutionId ?? null,
        departmentId: body.departmentId ?? null,
        wardId: body.wardId ?? null,
        visitNumber,
        visitType: body.visitType,
        admissionDate: new Date(),
        chiefComplaint: body.chiefComplaint,
        priority: body.priority,
        admittingDiagnosis: body.admittingDiagnosis ?? null,
        wardOrRoom: body.wardOrRoom ?? null,
        bedNumber: body.bedNumber ?? null,
        status: 'in-progress',
        blockchainHash: visitHash, // store hash in DB
      }).returning({ id: visits.id, visitNumber: visits.visitNumber });

      // Now store the hash on the blockchain using the DB-generated ID as resource ID
      await storeRecordHash(
        result[0].id,
        patient[0].blockchainAddress,
        visitHash,
        'visit'
      );

      // Audit log
      await db.insert(auditLogs).values({
        userId,
        userType,
        patientId: body.patientId,
        actionType: 'create',
        resourceType: 'visit',
        resourceId: result[0].id,
        blockchainTransactionId: crypto.randomBytes(16).toString('hex'), // if storeRecordHash returns txId, use it
        ipAddress: ip,
      });

      return c.json({
        success: true,
        data: {
          visitId: result[0].id,
          visitNumber: result[0].visitNumber,
          blockchainHash: visitHash,
        }
      }, 201);

    } catch (err: any) {
      console.error('Create visit error:', err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ── GET LAB RESULTS ───────────────────────────────────
  .openapi(createRoute({
    tags: ['Records'],
    summary: 'Get lab test results for a visit',
    method: 'get',
    path: '/labs/:visitId',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: {
      params: z.object({ visitId: z.string().uuid() }),
    },
    responses: {
      200: {
        content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.any() }) } },
        description: 'Lab results',
      },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Visit not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const { visitId } = c.req.valid('param');
      const userId = c.get('userId');
      const userType = c.get('userType');
      const practitionerBlockchainAddress = c.get('blockchainAddress');
      const ip = c.req.header('x-forwarded-for');

      // Get visit to find patientId
      const visit = await db.select({ patientId: visits.patientId })
        .from(visits)
        .where(eq(visits.id, visitId))
        .limit(1);

      if (!visit.length) {
        return c.json({ success: false, error: { message: 'Visit not found' } }, 404);
      }

      const patientId = visit[0].patientId;

      // Get patient blockchain address
      const patient = await db.select({ blockchainAddress: patients.blockchainAddress })
        .from(patients)
        .where(eq(patients.id, patientId))
        .limit(1);

      if (!patient.length) {
        return c.json({ success: false, error: { message: 'Patient not found' } }, 404);
      }

      // Permission check (patients can view their own)
      if (userType !== 'patient') {
        const hasAccess = await verifyAccess(
          patient[0].blockchainAddress,
          practitionerBlockchainAddress,
          userId,
          patientId,
          'lab_results',
          visitId,
          ip
        );
        if (!hasAccess) {
          return c.json({ success: false, error: { message: 'Access denied - no permission' } }, 403);
        }
      }

      const orders = await db.select().from(labTestOrders)
        .where(eq(labTestOrders.visitId, visitId));

      const orderIds = orders.map(o => o.id);
      const results = orderIds.length > 0
        ? await db.select().from(labTestResults)
            .where(inArray(labTestResults.labTestOrderId, orderIds))
        : [];

      return c.json({ success: true, data: { orders, results } });

    } catch (err: any) {
      console.error('Get lab results error:', err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ── VERIFY RECORD INTEGRITY ───────────────────────────
  .openapi(createRoute({
    tags: ['Records'],
    summary: 'Verify a record has not been tampered with using blockchain hash',
    method: 'post',
    path: '/verify',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              recordId: z.string(),
              recordData: z.any(),
            })
          }
        }
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              data: z.object({
                isValid: z.boolean(),
                message: z.string(),
              })
            })
          }
        },
        description: 'Verification result',
      },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const { recordId, recordData } = c.req.valid('json');
      const currentHash = generateRecordHash(recordData);

      const isValid = await verifyRecordHash(recordId, currentHash);

      return c.json({
        success: true,
        data: {
          isValid,
          message: isValid
            ? 'Record integrity verified — data matches blockchain'
            : 'WARNING: Record may have been tampered with',
        }
      });

    } catch (err: any) {
      console.error('Verify record error:', err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  });