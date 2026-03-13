import { createRoute, z } from '@hono/zod-openapi';
import { eq, desc, and, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  visits, vitalSigns, consultations,
  diagnoses, labTestOrders, labTestResults, imagingOrders,
  imagingReports, prescriptions, prescriptionItems,
  patients, auditLogs
} from '../db/schema';
import { createRouter } from '../lib/create-app';
import { authMiddleware } from '../middleware/auth';
import { storeRecordHash, logAccess, checkPermission } from '../services/fabric';
import { generateRecordHash } from '../services/crypto';
import crypto from 'crypto';

// Extend Hono context with custom variables
type AppContext = {
  Variables: {
    userId: string;
    userType: string;
    blockchainAddress: string;
  }
};

const errorSchema = z.object({
  success: z.boolean(),
  error: z.object({ message: z.string() }),
});

const successData = z.object({ success: z.boolean(), data: z.any() });

// ── Helper: log to both DB and blockchain ────────────────
async function auditAction(
  userId: string,
  userType: any,
  patientId: string,
  patientBlockchainAddress: string,
  actionType: any,
  resourceType: string,
  resourceId: string,
  ip?: string
) {
  const txId = crypto.randomBytes(16).toString('hex');
  await Promise.all([
    db.insert(auditLogs).values({
      userId,
      userType,
      patientId,
      actionType,
      resourceType,
      resourceId: resourceId as any,
      blockchainTransactionId: txId,
      ipAddress: ip,
    }),
    logAccess(patientBlockchainAddress, resourceId, `${actionType}:${resourceType}`, true),
  ]);
}

export const visitRouter = createRouter<AppContext>()



  .openapi(createRoute({
    tags: ['Visits'],
    summary: "Get today's active visits queue (only those without vitals)",
    method: 'get',
    path: '/today',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    responses: {
      200: { content: { 'application/json': { schema: successData } }, description: "Today's visits" },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
    // @ts-expect-error
  }), async (c) => {
    try {
      const userType = c.get('userType');
      if (!['nurse', 'practitioner', 'receptionist', 'admin'].includes(userType)) {
        return c.json({ success: false, error: { message: 'Access denied' } }, 403);
      }

      const { decrypt } = await import('../services/crypto');

      // Use a subquery to exclude visits that already have vitals
      const activeVisits = await db.select({
        id: visits.id,
        visitNumber: visits.visitNumber,
        patientId: visits.patientId,
        visitType: visits.visitType,
        chiefComplaint: visits.chiefComplaint,
        priority: visits.priority,
        status: visits.status,
        wardOrRoom: visits.wardOrRoom,
        admissionDate: visits.admissionDate,
      })
        .from(visits)
        .where(and(
          eq(visits.status, 'in-progress'),
          sql`${visits.id} NOT IN (SELECT DISTINCT ${vitalSigns.visitId} FROM ${vitalSigns})`
        ))
        .orderBy(desc(visits.admissionDate))
        .limit(100);

      const enriched = await Promise.all(activeVisits.map(async (v) => {
        const patient = await db.select({
          firstNameEncrypted: patients.firstNameEncrypted,
          lastNameEncrypted: patients.lastNameEncrypted,
          gender: patients.gender,
          bloodType: patients.bloodType,
        }).from(patients).where(eq(patients.id, v.patientId)).limit(1);

        return {
          ...v,
          patient: patient.length ? {
            firstName: decrypt(patient[0].firstNameEncrypted),
            lastName: decrypt(patient[0].lastNameEncrypted),
            gender: patient[0].gender,
            bloodType: patient[0].bloodType,
          } : null,
        };
      }));

      return c.json({ success: true, data: { visits: enriched, total: enriched.length } });
    } catch (err: any) {
      console.error(err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ════════════════════════════════════════
  // GET VISIT BY VISIT NUMBER
  // ════════════════════════════════════════
  .openapi(createRoute({
    tags: ['Visits'],
    summary: 'Find visit by visit number (VIS-YYYY-XXXX)',
    method: 'get',
    path: '/number/:visitNumber',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: {
      params: z.object({ visitNumber: z.string() }),
    },
    responses: {
      200: { content: { 'application/json': { schema: successData } }, description: 'Visit found' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
    // @ts-expect-error
  }), async (c) => {
    try {
      const { visitNumber } = c.req.valid('param');
      const { decrypt } = await import('../services/crypto');

      const visit = await db.select().from(visits)
        .where(eq(visits.visitNumber, visitNumber)).limit(1);

      if (!visit.length) {
        return c.json({ success: false, error: { message: 'Visit not found' } }, 404);
      }

      const patient = await db.select({
        firstNameEncrypted: patients.firstNameEncrypted,
        lastNameEncrypted: patients.lastNameEncrypted,
        gender: patients.gender,
        bloodType: patients.bloodType,
      }).from(patients).where(eq(patients.id, visit[0].patientId)).limit(1);

      return c.json({
        success: true,
        data: {
          visit: visit[0],
          patient: patient.length ? {
            firstName: decrypt(patient[0].firstNameEncrypted),
            lastName: decrypt(patient[0].lastNameEncrypted),
            gender: patient[0].gender,
            bloodType: patient[0].bloodType,
          } : null,
        }
      });
    } catch (err: any) {
      console.error(err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })


  // ════════════════════════════════════════
  // STEP 1: CREATE VISIT
  // ════════════════════════════════════════
  .openapi(createRoute({
    tags: ['Visits'],
    summary: 'Create a new patient visit/encounter',
    method: 'post',
    path: '/',
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
              wardOrRoom: z.string().optional(),
              bedNumber: z.string().optional(),
            }),
          },
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
      if (!['practitioner', 'nurse', 'admin', 'receptionist'].includes(userType)) {
        return c.json({ success: false, error: { message: 'Unauthorized to create visits' } }, 403);
      }

      const body = c.req.valid('json');
      const userId = c.get('userId');
      const ip = c.req.header('x-forwarded-for');

      const patient = await db.select({
        id: patients.id,
        blockchainAddress: patients.blockchainAddress,
      }).from(patients).where(eq(patients.id, body.patientId)).limit(1);

      if (!patient.length) {
        return c.json({ success: false, error: { message: 'Patient not found' } }, 404);
      }

      const visitNumber = `VIS-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

      const visitHash = generateRecordHash({
        patientId: body.patientId,
        visitNumber,
        visitType: body.visitType,
        chiefComplaint: body.chiefComplaint,
        createdBy: userId,
        timestamp: new Date().toISOString(),
      });

      // Store hash on blockchain (resource ID will be the DB-generated visit ID after insert)
      // We'll store after insert with the actual ID.

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
        wardOrRoom: body.wardOrRoom ?? null,
        bedNumber: body.bedNumber ?? null,
        status: 'in-progress',
        blockchainHash: visitHash,          // store hash in DB
      }).returning({ id: visits.id, visitNumber: visits.visitNumber });

      // Now store on blockchain using the DB-generated ID
      await storeRecordHash(result[0].id, patient[0].blockchainAddress, visitHash, 'visit');

      await auditAction(userId, userType, body.patientId, patient[0].blockchainAddress, 'create', 'visit', result[0].id, ip);

      return c.json({ success: true, data: { visitId: result[0].id, visitNumber: result[0].visitNumber, blockchainHash: visitHash } }, 201);

    } catch (err: any) {
      console.error(err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })




  // ════════════════════════════════════════
  // STEP 2: NURSE TRIAGE - Vital Signs
  // ════════════════════════════════════════
  .openapi(createRoute({
    tags: ['Visits'],
    summary: 'Record patient vital signs (Nurse only)',
    method: 'post',
    path: '/:visitId/vitals',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: {
      params: z.object({ visitId: z.string().uuid() }),
      body: {
        content: {
          'application/json': {
            schema: z.object({
              temperature: z.number().optional(),
              bloodPressureSystolic: z.number().optional(),
              bloodPressureDiastolic: z.number().optional(),
              pulseRate: z.number().optional(),          // renamed from heartRate
              respiratoryRate: z.number().optional(),
              oxygenSaturation: z.number().optional(),
              weight: z.number().optional(),
              height: z.number().optional(),
              painLevel: z.number().min(0).max(10).optional(),
              nurseNotes: z.string().optional(),         // renamed from notes
            }),
          },
        },
      },
    },
    responses: {
      201: { content: { 'application/json': { schema: successData } }, description: 'Vitals recorded' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Visit not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      if (userType !== 'nurse') {   // Only nurses per schema
        return c.json({ success: false, error: { message: 'Only nurses can record vitals' } }, 403);
      }

      const { visitId } = c.req.valid('param');
      const body = c.req.valid('json');
      const userId = c.get('userId');
      const ip = c.req.header('x-forwarded-for');

      const visit = await db.select().from(visits).where(eq(visits.id, visitId)).limit(1);
      if (!visit.length) return c.json({ success: false, error: { message: 'Visit not found' } }, 404);

      const patient = await db.select({ blockchainAddress: patients.blockchainAddress })
        .from(patients).where(eq(patients.id, visit[0].patientId)).limit(1);

      // Permission check
      const hasPermission = await checkPermission(patient[0].blockchainAddress, c.get('blockchainAddress'));
      if (!hasPermission) {
        await auditAction(userId, userType, visit[0].patientId, patient[0].blockchainAddress, 'view', 'vital_signs', visitId, ip);
        return c.json({ success: false, error: { message: 'No blockchain permission' } }, 403);
      }

      const vitalsHash = generateRecordHash({ visitId, ...body, recordedBy: userId, timestamp: new Date().toISOString() });

      const result = await db.insert(vitalSigns).values({
        visitId,
        patientId: visit[0].patientId,
        recordedByNurseId: userId,
        temperature: body.temperature ? body.temperature.toString() : null,
        bloodPressureSystolic: body.bloodPressureSystolic ?? null,
        bloodPressureDiastolic: body.bloodPressureDiastolic ?? null,
        pulseRate: body.pulseRate ?? null,
        respiratoryRate: body.respiratoryRate ?? null,
        oxygenSaturation: body.oxygenSaturation ?? null,
        weight: body.weight ? body.weight.toString() : null,
        height: body.height ? body.height.toString() : null,
        painLevel: body.painLevel ?? null,
        nurseNotes: body.nurseNotes ?? null,
        blockchainHash: vitalsHash,
      }).returning();

      await storeRecordHash(result[0].id, patient[0].blockchainAddress, vitalsHash, 'vital_signs');
      await auditAction(userId, userType, visit[0].patientId, patient[0].blockchainAddress, 'create', 'vital_signs', result[0].id, ip);

      return c.json({ success: true, data: { vitals: result[0], blockchainHash: vitalsHash } }, 201);

    } catch (err: any) {
      console.error(err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })



  // ════════════════════════════════════════
  // STEP 3: DOCTOR CONSULTATION
  // ════════════════════════════════════════
  .openapi(createRoute({
    tags: ['Visits'],
    summary: 'Record doctor consultation notes (Practitioner)',
    method: 'post',
    path: '/:visitId/consultation',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: {
      params: z.object({ visitId: z.string().uuid() }),
      body: {
        content: {
          'application/json': {
            schema: z.object({
              chiefComplaint: z.string(),
              historyOfPresentIllness: z.string().optional(),
              reviewOfSystems: z.string().optional(),
              physicalExamination: z.string().optional(),
              clinicalFindings: z.string().optional(),
              assessment: z.string().optional(),
              plan: z.string().optional(),
              followUpInstructions: z.string().optional(),
              nextAppointmentDate: z.string().datetime().optional(),
              // followUpRequired and referralRequired can be derived if needed
            }),
          },
        },
      },
    },
    responses: {
      201: { content: { 'application/json': { schema: successData } }, description: 'Consultation recorded' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'No permission' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Visit not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      if (userType !== 'practitioner') {
        return c.json({ success: false, error: { message: 'Only practitioners can record consultations' } }, 403);
      }

      const { visitId } = c.req.valid('param');
      const body = c.req.valid('json');
      const userId = c.get('userId');
      const practitionerBlockchainAddress = c.get('blockchainAddress');
      const ip = c.req.header('x-forwarded-for');

      const visit = await db.select().from(visits).where(eq(visits.id, visitId)).limit(1);
      if (!visit.length) return c.json({ success: false, error: { message: 'Visit not found' } }, 404);

      const patient = await db.select({ blockchainAddress: patients.blockchainAddress })
        .from(patients).where(eq(patients.id, visit[0].patientId)).limit(1);

      // Blockchain permission check
      const hasPermission = await checkPermission(patient[0].blockchainAddress, practitionerBlockchainAddress);
      if (!hasPermission) {
        await auditAction(userId, 'practitioner', visit[0].patientId, patient[0].blockchainAddress, 'view', 'consultation', visitId, ip);
        return c.json({ success: false, error: { message: 'No blockchain permission' } }, 403);
      }

      const consultationHash = generateRecordHash({ visitId, ...body, practitionerId: userId, timestamp: new Date().toISOString() });

      const result = await db.insert(consultations).values({
        visitId,
        patientId: visit[0].patientId,
        practitionerId: userId,
        chiefComplaint: body.chiefComplaint,
        historyOfPresentIllness: body.historyOfPresentIllness ?? null,
        reviewOfSystems: body.reviewOfSystems ?? null,
        physicalExamination: body.physicalExamination ?? null,
        clinicalFindings: body.clinicalFindings ?? null,
        assessment: body.assessment ?? null,
        plan: body.plan ?? null,
        followUpInstructions: body.followUpInstructions ?? null,
        nextAppointmentDate: body.nextAppointmentDate ? new Date(body.nextAppointmentDate) : null,
        blockchainHash: consultationHash,
      }).returning();

      await storeRecordHash(result[0].id, patient[0].blockchainAddress, consultationHash, 'consultation');
      await auditAction(userId, 'practitioner', visit[0].patientId, patient[0].blockchainAddress, 'create', 'consultation', result[0].id, ip);

      return c.json({ success: true, data: { consultation: result[0], blockchainHash: consultationHash } }, 201);

    } catch (err: any) {
      console.error(err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ════════════════════════════════════════
  // STEP 3B: ADD DIAGNOSIS
  // ════════════════════════════════════════
  .openapi(createRoute({
    tags: ['Visits'],
    summary: 'Add diagnosis to a visit (Practitioner)',
    method: 'post',
    path: '/:visitId/diagnosis',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: {
      params: z.object({ visitId: z.string().uuid() }),
      body: {
        content: {
          'application/json': {
            schema: z.object({
              consultationId: z.string().uuid(),          // diagnoses require a consultation
              icdCode: z.string(),
              diagnosisName: z.string(),
              diagnosisStatus: z.enum(['provisional', 'confirmed', 'ruled_out', 'differential']),
              severity: z.string().optional(),
              notes: z.string().optional(),
            }),
          },
        },
      },
    },
    responses: {
      201: { content: { 'application/json': { schema: successData } }, description: 'Diagnosis added' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Visit or consultation not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      if (userType !== 'practitioner') {
        return c.json({ success: false, error: { message: 'Only practitioners can add diagnoses' } }, 403);
      }

      const { visitId } = c.req.valid('param');
      const body = c.req.valid('json');
      const userId = c.get('userId');
      const ip = c.req.header('x-forwarded-for');

      const visit = await db.select().from(visits).where(eq(visits.id, visitId)).limit(1);
      if (!visit.length) return c.json({ success: false, error: { message: 'Visit not found' } }, 404);

      // Verify consultation exists
      const consultation = await db.select().from(consultations).where(eq(consultations.id, body.consultationId)).limit(1);
      if (!consultation.length) return c.json({ success: false, error: { message: 'Consultation not found' } }, 404);

      const patient = await db.select({ blockchainAddress: patients.blockchainAddress })
        .from(patients).where(eq(patients.id, visit[0].patientId)).limit(1);

      // Permission check
      const hasPermission = await checkPermission(patient[0].blockchainAddress, c.get('blockchainAddress'));
      if (!hasPermission) {
        await auditAction(userId, userType, visit[0].patientId, patient[0].blockchainAddress, 'view', 'diagnosis', visitId, ip);
        return c.json({ success: false, error: { message: 'No blockchain permission' } }, 403);
      }

      const diagnosisHash = generateRecordHash({ visitId, ...body, practitionerId: userId, timestamp: new Date().toISOString() });

      const result = await db.insert(diagnoses).values({
        consultationId: body.consultationId,
        visitId,
        patientId: visit[0].patientId,
        practitionerId: userId,
        icdCode: body.icdCode,
        diagnosisName: body.diagnosisName,
        diagnosisType: body.diagnosisStatus,      // maps to enum
        severity: body.severity ?? null,
        notes: body.notes ?? null,
        blockchainHash: diagnosisHash,
      }).returning();

      await storeRecordHash(result[0].id, patient[0].blockchainAddress, diagnosisHash, 'diagnosis');
      await auditAction(userId, userType, visit[0].patientId, patient[0].blockchainAddress, 'create', 'diagnosis', result[0].id, ip);

      return c.json({ success: true, data: { diagnosis: result[0] } }, 201);

    } catch (err: any) {
      console.error(err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ════════════════════════════════════════
  // STEP 4: LAB - Order Tests
  // ════════════════════════════════════════
  .openapi(createRoute({
    tags: ['Visits'],
    summary: 'Order lab tests for a patient (Practitioner)',
    method: 'post',
    path: '/:visitId/lab-orders',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: {
      params: z.object({ visitId: z.string().uuid() }),
      body: {
        content: {
          'application/json': {
            schema: z.object({
              tests: z.array(z.object({
                testName: z.string(),
                testCode: z.string(),
                specimenType: z.enum(['blood', 'urine', 'stool', 'sputum', 'csf', 'tissue', 'swab', 'other']),
                urgency: z.enum(['routine', 'urgent', 'emergency', 'critical']).default('routine'),
                clinicalNotes: z.string().optional(),
              })).min(1),
            }),
          },
        },
      },
    },
    responses: {
      201: { content: { 'application/json': { schema: successData } }, description: 'Lab orders created' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Visit not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      if (userType !== 'practitioner') {
        return c.json({ success: false, error: { message: 'Only practitioners can order lab tests' } }, 403);
      }

      const { visitId } = c.req.valid('param');
      const body = c.req.valid('json');
      const userId = c.get('userId');
      const ip = c.req.header('x-forwarded-for');

      const visit = await db.select().from(visits).where(eq(visits.id, visitId)).limit(1);
      if (!visit.length) return c.json({ success: false, error: { message: 'Visit not found' } }, 404);

      const patient = await db.select({ blockchainAddress: patients.blockchainAddress })
        .from(patients).where(eq(patients.id, visit[0].patientId)).limit(1);

      // Permission check
      const hasPermission = await checkPermission(patient[0].blockchainAddress, c.get('blockchainAddress'));
      if (!hasPermission) {
        await auditAction(userId, userType, visit[0].patientId, patient[0].blockchainAddress, 'view', 'lab_order', visitId, ip);
        return c.json({ success: false, error: { message: 'No blockchain permission' } }, 403);
      }

      const createdOrders = [];

      for (const test of body.tests) {
        const orderNumber = `LAB-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
        const orderHash = generateRecordHash({ visitId, orderNumber, ...test, practitionerId: userId, timestamp: new Date().toISOString() });

        const result = await db.insert(labTestOrders).values({
          orderNumber,
          visitId,
          patientId: visit[0].patientId,
          orderedByPractitionerId: userId,
          testName: test.testName,
          testCode: test.testCode,
          specimenType: test.specimenType,
          urgency: test.urgency,
          clinicalNotes: test.clinicalNotes ?? null,
          status: 'ordered',
          blockchainHash: orderHash,
        }).returning();

        await storeRecordHash(result[0].id, patient[0].blockchainAddress, orderHash, 'lab_order');
        createdOrders.push(result[0]);
      }

      // Audit once per order? We'll audit each order individually inside loop or batch? For simplicity, audit each.
      for (const order of createdOrders) {
        await auditAction(userId, userType, visit[0].patientId, patient[0].blockchainAddress, 'create', 'lab_order', order.id, ip);
      }

      return c.json({ success: true, data: { orders: createdOrders } }, 201);

    } catch (err: any) {
      console.error(err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ════════════════════════════════════════
  // STEP 4B: LAB - Enter Results
  // ════════════════════════════════════════
  .openapi(createRoute({
    tags: ['Visits'],
    summary: 'Enter lab test results (Lab Technician)',
    method: 'post',
    path: '/:visitId/lab-results/:orderId',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: {
      params: z.object({ visitId: z.string().uuid(), orderId: z.string().uuid() }),
      body: {
        content: {
          'application/json': {
            schema: z.object({
              resultsData: z.any(),                     // JSON object
              interpretation: z.string().optional(),
              abnormalFindings: z.string().optional(),
              referenceRanges: z.any().optional(),      // JSON
              attachmentUrls: z.array(z.string()).optional(),
            }),
          },
        },
      },
    },
    responses: {
      201: { content: { 'application/json': { schema: successData } }, description: 'Results entered' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Order not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      if (userType !== 'lab_technician') {
        return c.json({ success: false, error: { message: 'Only lab technicians can enter results' } }, 403);
      }

      const { visitId, orderId } = c.req.valid('param');
      const body = c.req.valid('json');
      const userId = c.get('userId');
      const ip = c.req.header('x-forwarded-for');

      const order = await db.select().from(labTestOrders).where(eq(labTestOrders.id, orderId)).limit(1);
      if (!order.length) return c.json({ success: false, error: { message: 'Lab order not found' } }, 404);

      const patient = await db.select({ blockchainAddress: patients.blockchainAddress })
        .from(patients).where(eq(patients.id, order[0].patientId)).limit(1);

      // Permission check
      const hasPermission = await checkPermission(patient[0].blockchainAddress, c.get('blockchainAddress'));
      if (!hasPermission) {
        await auditAction(userId, userType, order[0].patientId, patient[0].blockchainAddress, 'view', 'lab_result', orderId, ip);
        return c.json({ success: false, error: { message: 'No blockchain permission' } }, 403);
      }

      const resultHash = generateRecordHash({ orderId, ...body, labTechId: userId, timestamp: new Date().toISOString() });

      await db.update(labTestOrders).set({ status: 'resulted' }).where(eq(labTestOrders.id, orderId));

      const result = await db.insert(labTestResults).values({
        labTestOrderId: orderId,
        performedByLabTechId: userId,
        resultsData: body.resultsData,
        interpretation: body.interpretation ?? null,
        abnormalFindings: body.abnormalFindings ?? null,
        referenceRanges: body.referenceRanges ?? null,
        attachmentUrls: body.attachmentUrls ?? null,
        blockchainHash: resultHash,
      }).returning();

      await storeRecordHash(result[0].id, patient[0].blockchainAddress, resultHash, 'lab_result');
      await auditAction(userId, userType, order[0].patientId, patient[0].blockchainAddress, 'create', 'lab_result', result[0].id, ip);

      return c.json({ success: true, data: { result: result[0], blockchainHash: resultHash } }, 201);

    } catch (err: any) {
      console.error(err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ════════════════════════════════════════
  // STEP 5: RADIOLOGY - Order Imaging
  // ════════════════════════════════════════
  .openapi(createRoute({
    tags: ['Visits'],
    summary: 'Order imaging study (Practitioner)',
    method: 'post',
    path: '/:visitId/imaging-orders',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: {
      params: z.object({ visitId: z.string().uuid() }),
      body: {
        content: {
          'application/json': {
            schema: z.object({
              modality: z.enum(['x-ray', 'ct_scan', 'mri', 'ultrasound', 'pet_scan', 'mammogram', 'fluoroscopy']),
              bodyPart: z.string(),
              indication: z.string(),
              urgency: z.enum(['routine', 'urgent', 'emergency', 'critical']).default('routine'),
              // clinicalHistory is not in schema, maybe add to clinicalNotes? We'll map to indication or omit.
            }),
          },
        },
      },
    },
    responses: {
      201: { content: { 'application/json': { schema: successData } }, description: 'Imaging ordered' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Visit not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      if (userType !== 'practitioner') {
        return c.json({ success: false, error: { message: 'Only practitioners can order imaging' } }, 403);
      }

      const { visitId } = c.req.valid('param');
      const body = c.req.valid('json');
      const userId = c.get('userId');
      const ip = c.req.header('x-forwarded-for');

      const visit = await db.select().from(visits).where(eq(visits.id, visitId)).limit(1);
      if (!visit.length) return c.json({ success: false, error: { message: 'Visit not found' } }, 404);

      const patient = await db.select({ blockchainAddress: patients.blockchainAddress })
        .from(patients).where(eq(patients.id, visit[0].patientId)).limit(1);

      // Permission check
      const hasPermission = await checkPermission(patient[0].blockchainAddress, c.get('blockchainAddress'));
      if (!hasPermission) {
        await auditAction(userId, userType, visit[0].patientId, patient[0].blockchainAddress, 'view', 'imaging_order', visitId, ip);
        return c.json({ success: false, error: { message: 'No blockchain permission' } }, 403);
      }

      const orderNumber = `IMG-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
      const orderHash = generateRecordHash({ visitId, orderNumber, ...body, practitionerId: userId, timestamp: new Date().toISOString() });

      const result = await db.insert(imagingOrders).values({
        orderNumber,
        visitId,
        patientId: visit[0].patientId,
        orderedByPractitionerId: userId,
        modality: body.modality,
        bodyPart: body.bodyPart,
        indication: body.indication,
        urgency: body.urgency,
        status: 'ordered',
        blockchainHash: orderHash,
      }).returning();

      await storeRecordHash(result[0].id, patient[0].blockchainAddress, orderHash, 'imaging_order');
      await auditAction(userId, userType, visit[0].patientId, patient[0].blockchainAddress, 'create', 'imaging_order', result[0].id, ip);

      return c.json({ success: true, data: { order: result[0], blockchainHash: orderHash } }, 201);

    } catch (err: any) {
      console.error(err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ════════════════════════════════════════
  // STEP 5B: RADIOLOGY - Submit Report
  // ════════════════════════════════════════
  .openapi(createRoute({
    tags: ['Visits'],
    summary: 'Submit radiology report (Radiologist)',
    method: 'post',
    path: '/:visitId/imaging-report/:orderId',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: {
      params: z.object({ visitId: z.string().uuid(), orderId: z.string().uuid() }),
      body: {
        content: {
          'application/json': {
            schema: z.object({
              findings: z.string(),
              impression: z.string(),
              recommendations: z.string().optional(),
              imageUrls: z.array(z.string()).default([]),
            }),
          },
        },
      },
    },
    responses: {
      201: { content: { 'application/json': { schema: successData } }, description: 'Report submitted' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Order not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      if (userType !== 'radiologist') {
        return c.json({ success: false, error: { message: 'Only radiologists can submit imaging reports' } }, 403);
      }

      const { orderId } = c.req.valid('param');
      const body = c.req.valid('json');
      const userId = c.get('userId');
      const ip = c.req.header('x-forwarded-for');

      const order = await db.select().from(imagingOrders).where(eq(imagingOrders.id, orderId)).limit(1);
      if (!order.length) return c.json({ success: false, error: { message: 'Imaging order not found' } }, 404);

      const patient = await db.select({ blockchainAddress: patients.blockchainAddress })
        .from(patients).where(eq(patients.id, order[0].patientId)).limit(1);

      // Permission check
      const hasPermission = await checkPermission(patient[0].blockchainAddress, c.get('blockchainAddress'));
      if (!hasPermission) {
        await auditAction(userId, userType, order[0].patientId, patient[0].blockchainAddress, 'view', 'imaging_report', orderId, ip);
        return c.json({ success: false, error: { message: 'No blockchain permission' } }, 403);
      }

      const reportHash = generateRecordHash({ orderId, ...body, radiologistId: userId, timestamp: new Date().toISOString() });

      await db.update(imagingOrders).set({ status: 'reported' }).where(eq(imagingOrders.id, orderId));

      const result = await db.insert(imagingReports).values({
        imagingOrderId: orderId,
        performedByRadiologistId: userId,
        findings: body.findings,
        impression: body.impression,
        recommendations: body.recommendations ?? null,
        imageUrls: body.imageUrls,
        blockchainHash: reportHash,
      }).returning();

      await storeRecordHash(result[0].id, patient[0].blockchainAddress, reportHash, 'imaging_report');
      await auditAction(userId, userType, order[0].patientId, patient[0].blockchainAddress, 'create', 'imaging_report', result[0].id, ip);

      return c.json({ success: true, data: { report: result[0], blockchainHash: reportHash } }, 201);

    } catch (err: any) {
      console.error(err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ════════════════════════════════════════
  // STEP 6: PHARMACY - Create Prescription
  // ════════════════════════════════════════
  .openapi(createRoute({
    tags: ['Visits'],
    summary: 'Create prescription (Practitioner)',
    method: 'post',
    path: '/:visitId/prescriptions',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: {
      params: z.object({ visitId: z.string().uuid() }),
      body: {
        content: {
          'application/json': {
            schema: z.object({
              medications: z.array(z.object({
                medicationName: z.string(),
                genericName: z.string().optional(),
                strength: z.string(),
                dosageForm: z.enum(['tablet', 'capsule', 'syrup', 'injection', 'cream', 'ointment', 'drops', 'inhaler', 'suppository']),
                dose: z.string(),
                frequency: z.enum(['once_daily', 'twice_daily', 'three_times_daily', 'four_times_daily', 'every_4_hours', 'every_6_hours', 'every_8_hours', 'as_needed', 'stat']),
                route: z.enum(['oral', 'intravenous', 'intramuscular', 'subcutaneous', 'topical', 'inhalation', 'rectal', 'sublingual']),
                duration: z.string(),
                quantity: z.number().int().positive(),
                instructions: z.string().optional(),
                refillsAllowed: z.number().int().min(0).default(0),
              })).min(1),
            }),
          },
        },
      },
    },
    responses: {
      201: { content: { 'application/json': { schema: successData } }, description: 'Prescription created' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Visit not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      if (userType !== 'practitioner') {
        return c.json({ success: false, error: { message: 'Only practitioners can prescribe medications' } }, 403);
      }

      const { visitId } = c.req.valid('param');
      const body = c.req.valid('json');
      const userId = c.get('userId');
      const ip = c.req.header('x-forwarded-for');

      const visit = await db.select().from(visits).where(eq(visits.id, visitId)).limit(1);
      if (!visit.length) return c.json({ success: false, error: { message: 'Visit not found' } }, 404);

      const patient = await db.select({ blockchainAddress: patients.blockchainAddress })
        .from(patients).where(eq(patients.id, visit[0].patientId)).limit(1);

      // Permission check
      const hasPermission = await checkPermission(patient[0].blockchainAddress, c.get('blockchainAddress'));
      if (!hasPermission) {
        await auditAction(userId, userType, visit[0].patientId, patient[0].blockchainAddress, 'view', 'prescription', visitId, ip);
        return c.json({ success: false, error: { message: 'No blockchain permission' } }, 403);
      }

      const prescriptionNumber = `RX-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      const prescriptionHash = generateRecordHash({
        visitId, prescriptionNumber,
        medications: body.medications,
        practitionerId: userId,
        timestamp: new Date().toISOString(),
      });

      const prescription = await db.insert(prescriptions).values({
        prescriptionNumber,
        visitId,
        patientId: visit[0].patientId,
        prescribedByPractitionerId: userId,
        status: 'prescribed',
        blockchainHash: prescriptionHash,
      }).returning();

      await storeRecordHash(prescription[0].id, patient[0].blockchainAddress, prescriptionHash, 'prescription');

      const items = await db.insert(prescriptionItems).values(
        body.medications.map(med => ({
          prescriptionId: prescription[0].id,
          medicationName: med.medicationName,
          genericName: med.genericName ?? null,
          strength: med.strength,
          dosageForm: med.dosageForm,
          dose: med.dose,
          frequency: med.frequency,
          route: med.route,
          duration: med.duration,
          quantity: med.quantity,
          instructions: med.instructions ?? null,
          refillsAllowed: med.refillsAllowed,
          isDispensed: false,
        }))
      ).returning();

      await auditAction(userId, userType, visit[0].patientId, patient[0].blockchainAddress, 'create', 'prescription', prescription[0].id, ip);

      return c.json({ success: true, data: { prescription: prescription[0], items, blockchainHash: prescriptionHash } }, 201);

    } catch (err: any) {
      console.error(err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ════════════════════════════════════════
  // STEP 6B: PHARMACY - Dispense Medication
  // ════════════════════════════════════════
  .openapi(createRoute({
    tags: ['Visits'],
    summary: 'Dispense prescription items (Pharmacist)',
    method: 'patch',
    path: '/:visitId/prescriptions/:prescriptionId/dispense',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: {
      params: z.object({ visitId: z.string().uuid(), prescriptionId: z.string().uuid() }),
      body: {
        content: {
          'application/json': {
            schema: z.object({
              itemIds: z.array(z.string().uuid()),
              dispensingNotes: z.string().optional(),   // can be stored in prescription_items.instructions? or separate log
            }),
          },
        },
      },
    },
    responses: {
      200: { content: { 'application/json': { schema: successData } }, description: 'Dispensed' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Prescription or items not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      if (userType !== 'pharmacist') {
        return c.json({ success: false, error: { message: 'Only pharmacists can dispense medications' } }, 403);
      }

      const { prescriptionId } = c.req.valid('param');
      const { itemIds, dispensingNotes } = c.req.valid('json');
      const userId = c.get('userId');
      const ip = c.req.header('x-forwarded-for');

      // Get prescription to verify patient
      const prescription = await db.select().from(prescriptions).where(eq(prescriptions.id, prescriptionId)).limit(1);
      if (!prescription.length) return c.json({ success: false, error: { message: 'Prescription not found' } }, 404);

      const patient = await db.select({ blockchainAddress: patients.blockchainAddress })
        .from(patients).where(eq(patients.id, prescription[0].patientId)).limit(1);

      // Permission check
      const hasPermission = await checkPermission(patient[0].blockchainAddress, c.get('blockchainAddress'));
      if (!hasPermission) {
        await auditAction(userId, userType, prescription[0].patientId, patient[0].blockchainAddress, 'view', 'prescription_dispense', prescriptionId, ip);
        return c.json({ success: false, error: { message: 'No blockchain permission' } }, 403);
      }

      // Generate a hash for the dispense event (could store in prescription_items as a new column)
      const dispenseHash = generateRecordHash({ prescriptionId, itemIds, dispensedBy: userId, timestamp: new Date().toISOString() });

      for (const itemId of itemIds) {
        await db.update(prescriptionItems)
          .set({
            isDispensed: true,
            dispensedByPharmacistId: userId,
            dispensedAt: new Date(),
            // optionally store dispenseHash per item if we add column
          })
          .where(eq(prescriptionItems.id, itemId));
        // Store blockchain record for each item dispensed? Or one for the batch? We'll do one per item.
        await storeRecordHash(itemId, patient[0].blockchainAddress, dispenseHash, 'prescription_dispense');
      }

      // Check if all items dispensed
      const remaining = await db.select().from(prescriptionItems)
        .where(and(eq(prescriptionItems.prescriptionId, prescriptionId), eq(prescriptionItems.isDispensed, false)));

      if (remaining.length === 0) {
        await db.update(prescriptions).set({ status: 'dispensed' }).where(eq(prescriptions.id, prescriptionId));
      }

      await auditAction(userId, userType, prescription[0].patientId, patient[0].blockchainAddress, 'update', 'prescription_dispense', prescriptionId, ip);

      return c.json({ success: true, data: { message: 'Medications dispensed', remainingItems: remaining.length, blockchainHash: dispenseHash } });

    } catch (err: any) {
      console.error(err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ════════════════════════════════════════
  // STEP 7: DISCHARGE
  // ════════════════════════════════════════
  .openapi(createRoute({
    tags: ['Visits'],
    summary: 'Discharge patient and close visit (Practitioner)',
    method: 'patch',
    path: '/:visitId/discharge',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: {
      params: z.object({ visitId: z.string().uuid() }),
      body: {
        content: {
          'application/json': {
            schema: z.object({
              dischargeDiagnosis: z.string(),
              dischargeSummary: z.string(),
              dischargeInstructions: z.string(),
              followUpDate: z.string().datetime().optional(),
              // condition removed as not in schema
            }),
          },
        },
      },
    },
    responses: {
      200: { content: { 'application/json': { schema: successData } }, description: 'Patient discharged' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Visit not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      if (userType !== 'practitioner') {
        return c.json({ success: false, error: { message: 'Only practitioners can discharge patients' } }, 403);
      }

      const { visitId } = c.req.valid('param');
      const body = c.req.valid('json');
      const userId = c.get('userId');
      const ip = c.req.header('x-forwarded-for');

      const visit = await db.select().from(visits).where(eq(visits.id, visitId)).limit(1);
      if (!visit.length) return c.json({ success: false, error: { message: 'Visit not found' } }, 404);

      const patient = await db.select({ blockchainAddress: patients.blockchainAddress })
        .from(patients).where(eq(patients.id, visit[0].patientId)).limit(1);

      // Permission check
      const hasPermission = await checkPermission(patient[0].blockchainAddress, c.get('blockchainAddress'));
      if (!hasPermission) {
        await auditAction(userId, 'practitioner', visit[0].patientId, patient[0].blockchainAddress, 'view', 'discharge', visitId, ip);
        return c.json({ success: false, error: { message: 'No blockchain permission' } }, 403);
      }

      const dischargeHash = generateRecordHash({
        visitId,
        dischargeDiagnosis: body.dischargeDiagnosis,
        dischargeSummary: body.dischargeSummary,
        dischargedBy: userId,
        dischargeTime: new Date().toISOString(),
      });

      // We need a column to store discharge blockchain hash. We'll add `discharge_blockchain_hash` to visits.
      // For now, we'll update the existing blockchain_hash (overwrite) but better to have separate column.
      // We'll assume we added `discharge_blockchain_hash`. Update accordingly.
      const result = await db.update(visits).set({
        status: 'completed',
        dischargeDate: new Date(),
        dischargeDiagnosis: body.dischargeDiagnosis,
        dischargeSummary: body.dischargeSummary,
        dischargeInstructions: body.dischargeInstructions,
        followUpDate: body.followUpDate ? new Date(body.followUpDate) : null,
        updatedAt: new Date(),
        dischargeBlockchainHash: dischargeHash,   // new column
      }).where(eq(visits.id, visitId)).returning();

      await storeRecordHash(visitId, patient[0].blockchainAddress, dischargeHash, 'discharge');
      await auditAction(userId, 'practitioner', visit[0].patientId, patient[0].blockchainAddress, 'update', 'discharge', visitId, ip);

      return c.json({ success: true, data: { message: 'Patient discharged successfully', visit: result[0], blockchainHash: dischargeHash } });

    } catch (err: any) {
      console.error(err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ════════════════════════════════════════
  // CHECK MY PERMISSION FOR A VISIT
  // ════════════════════════════════════════
  // INSERT THIS BLOCK just before the "GET FULL VISIT SUMMARY" section
  // in src/routes/visits.ts

  .openapi(createRoute({
    tags: ['Visits'],
    summary: 'Check if the current staff member has blockchain permission for this visit patient',
    method: 'get',
    path: '/:visitId/my-permission',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: {
      params: z.object({ visitId: z.string().uuid() }),
    },
    responses: {
      200: {
        content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.object({ hasPermission: z.boolean() }) }) } },
        description: 'Permission check result',
      },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Visit not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
    // @ts-expect-error
  }), async (c) => {
    try {
      const { visitId } = c.req.valid('param');
      const staffBlockchainAddress = c.get('blockchainAddress');

      const visit = await db.select({ patientId: visits.patientId })
        .from(visits).where(eq(visits.id, visitId)).limit(1);

      if (!visit.length) {
        return c.json({ success: false, error: { message: 'Visit not found' } }, 404);
      }

      const patient = await db.select({ blockchainAddress: patients.blockchainAddress })
        .from(patients).where(eq(patients.id, visit[0].patientId)).limit(1);

      if (!patient.length) {
        return c.json({ success: true, data: { hasPermission: false } });
      }

      const hasPermission = await checkPermission(
        patient[0].blockchainAddress,
        staffBlockchainAddress
      );

      return c.json({ success: true, data: { hasPermission } });

    } catch (err: any) {
      console.error(err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })


  // ════════════════════════════════════════
  // GET FULL VISIT SUMMARY
  // ════════════════════════════════════════
  .openapi(createRoute({
    tags: ['Visits'],
    summary: 'Get complete visit summary',
    method: 'get',
    path: '/:visitId/summary',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: {
      params: z.object({ visitId: z.string().uuid() }),
    },
    responses: {
      200: { content: { 'application/json': { schema: successData } }, description: 'Visit summary' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Visit not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const { visitId } = c.req.valid('param');
      const userId = c.get('userId');
      const userType = c.get('userType');
      const ip = c.req.header('x-forwarded-for');

      const visit = await db.select().from(visits).where(eq(visits.id, visitId)).limit(1);
      if (!visit.length) return c.json({ success: false, error: { message: 'Visit not found' } }, 404);

      const patient = await db.select({ blockchainAddress: patients.blockchainAddress })
        .from(patients).where(eq(patients.id, visit[0].patientId)).limit(1);

      // Permission check
      const hasPermission = await checkPermission(patient[0].blockchainAddress, c.get('blockchainAddress'));
      if (!hasPermission) {
        await auditAction(userId, userType, visit[0].patientId, patient[0].blockchainAddress, 'view', 'visit_summary', visitId, ip);
        return c.json({ success: false, error: { message: 'No blockchain permission' } }, 403);
      }

      const [consultationData, diagnosisData, vitalData, labOrderData, imagingOrderData, prescriptionData] = await Promise.all([
        db.select().from(consultations).where(eq(consultations.visitId, visitId)),
        db.select().from(diagnoses).where(eq(diagnoses.visitId, visitId)),
        db.select().from(vitalSigns).where(eq(vitalSigns.visitId, visitId)).orderBy(desc(vitalSigns.recordedAt)),
        db.select().from(labTestOrders).where(eq(labTestOrders.visitId, visitId)),
        db.select().from(imagingOrders).where(eq(imagingOrders.visitId, visitId)),
        db.select().from(prescriptions).where(eq(prescriptions.visitId, visitId)),
      ]);

      await auditAction(userId, userType, visit[0].patientId, patient[0].blockchainAddress, 'view', 'visit_summary', visitId, ip);

      return c.json({
        success: true,
        data: {
          visit: visit[0],
          consultations: consultationData,
          diagnoses: diagnosisData,
          vitalSigns: vitalData,
          labOrders: labOrderData,
          imagingOrders: imagingOrderData,
          prescriptions: prescriptionData,
        }
      });

    } catch (err: any) {
      console.error(err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  });