import { handleError } from '../lib/errors';
import { createRoute, z } from '@hono/zod-openapi';
import { eq, desc, inArray, and } from 'drizzle-orm';
import { db } from '../db';
import {
  visits, consultations, diagnoses, vitalSigns,
  labTestOrders, labTestResults, imagingOrders,
  prescriptions, patients, auditLogs, practitioners,
  patientInstitutionRegistrations, patientGuardians,
} from '../db/schema';
import { createRouter } from '../lib/create-app';
import { authMiddleware } from '../middleware/auth';
import { checkPermission, storeRecordHash, logAccess, verifyRecordHash, VerifyResult } from '../services/fabric';
import { generateRecordHash, decrypt } from '../services/crypto';
import crypto from 'crypto';

const errorSchema = z.object({
  success: z.boolean(),
  error: z.object({ message: z.string() }),
});

// ── Helper: get staff institution ID ─────────────────────────────────────────
async function getStaffInstitutionId(staffUserId: string): Promise<string | null> {
  const row = await db
    .select({ institutionId: practitioners.institutionId })
    .from(practitioners)
    .where(eq(practitioners.id, staffUserId))
    .limit(1);
  return row[0]?.institutionId ?? null;
}

// ── Helper: is patient registered (active) at institution ────────────────────
async function isPatientRegisteredAtInstitution(
  patientId: string,
  institutionId: string,
): Promise<boolean> {
  const reg = await db
    .select({ id: patientInstitutionRegistrations.id })
    .from(patientInstitutionRegistrations)
    .where(and(
      eq(patientInstitutionRegistrations.patientId, patientId),
      eq(patientInstitutionRegistrations.institutionId, institutionId),
      eq(patientInstitutionRegistrations.isActive, true),
    ))
    .limit(1);
  return reg.length > 0;
}

// ── Helper: check blockchain permission + audit ───────────────────────────────
async function verifyBlockchainAccess(
  patientBlockchainAddress: string,
  practitionerBlockchainAddress: string,
  practitionerId: string,
  patientId: string,
  resourceType: string,
  resourceId: string,
  ipAddress?: string,
): Promise<boolean> {
  const hasPermission = await checkPermission(
    patientBlockchainAddress,
    practitionerBlockchainAddress,
  );

  const logResult = await logAccess(
    patientBlockchainAddress,
    resourceId,
    `${hasPermission ? 'GRANTED' : 'DENIED'}: ${resourceType}`,
    hasPermission,
  );

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

// ─────────────────────────────────────────────────────────────────────────────
// ACCESS + SCOPE RESOLUTION
//
// Rules applied consistently across every read endpoint:
//
//   userType === 'patient'
//     → always allowed; sees ALL their own visits across all institutions
//
//   userType === 'practitioner' / 'nurse' / staff
//     → Case 1: explicit blockchain permission granted by patient
//               → allowed; sees ALL visits (patient consented to full history)
//     → Case 2: no blockchain permission BUT patient is registered at staff's
//               institution (implicit institutional access)
//               → allowed; scoped to visits AT THAT INSTITUTION ONLY
//     → Case 3: neither
//               → 403 denied
//
// This means: a doctor at Hospital A with implicit access sees only Hospital A
// visits. A doctor who the patient explicitly granted blockchain permission sees
// everything (e.g. for referral continuity).
// ─────────────────────────────────────────────────────────────────────────────

type AccessResult =
  | { allowed: false }
  | { allowed: true; scopeInstitutionId: string | null }; // null = all institutions

// ── Helper: verify active canConsent guardian link ────────────────────────────
async function isActiveGuardian(guardianPatientId: string, minorPatientId: string): Promise<boolean> {
  const links = await db
    .select({ endsAt: patientGuardians.endsAt })
    .from(patientGuardians)
    .where(and(
      eq(patientGuardians.guardianPatientId, guardianPatientId),
      eq(patientGuardians.patientId, minorPatientId),
      eq(patientGuardians.canConsent, true),
    ))
    .limit(1);
  if (!links.length) return false;
  const { endsAt } = links[0];
  return !endsAt || endsAt > new Date();
}

async function resolveAccess(
  userType: string,
  userId: string,
  practitionerBlockchainAddress: string,
  patientId: string,
  patientBlockchainAddress: string,
  resourceType: string,
  resourceId: string,
  ipAddress?: string,
  actingAsPatientId?: string,
): Promise<AccessResult> {

  // Patient accessing their own records or a dependent's via guardian link
  if (userType === 'patient') {
    if (patientId === userId) return { allowed: true, scopeInstitutionId: null };
    // Guardian acting as a dependent
    if (actingAsPatientId && actingAsPatientId === patientId) {
      const ok = await isActiveGuardian(userId, patientId);
      if (ok) return { allowed: true, scopeInstitutionId: null };
    }
    return { allowed: false };
  }

  // Staff: check blockchain permission first (explicit patient consent = full access)
  const hasBlockchainPerm = await verifyBlockchainAccess(
    patientBlockchainAddress,
    practitionerBlockchainAddress,
    userId,
    patientId,
    resourceType,
    resourceId,
    ipAddress,
  );

  if (hasBlockchainPerm) {
    // Patient explicitly granted this practitioner access → full history
    return { allowed: true, scopeInstitutionId: null };
  }

  // No blockchain permission — check implicit institutional access
  const institutionId = await getStaffInstitutionId(userId);
  if (institutionId) {
    const isRegistered = await isPatientRegisteredAtInstitution(patientId, institutionId);
    if (isRegistered) {
      // Implicit access — scope strictly to this institution's records
      return { allowed: true, scopeInstitutionId: institutionId };
    }
  }

  return { allowed: false };
}

export const recordRouter = createRouter()

  // ══════════════════════════════════════════════════════════════════════════
  // GET /visits/:patientId
  // ══════════════════════════════════════════════════════════════════════════
  .openapi(createRoute({
    tags: ['Records'],
    summary: 'Get visits for a patient (institution-scoped unless blockchain permission granted)',
    method: 'get',
    path: '/visits/:patientId',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: {
      params: z.object({ patientId: z.string().uuid() }),
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              data: z.object({
                visits: z.array(z.any()),
                scopedToInstitution: z.boolean(),
              }),
            }),
          },
        },
        description: 'Patient visits',
      },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'No permission' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Patient not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const { patientId } = c.req.valid('param');
      const userId = c.get('userId');
      const userType = c.get('userType');
      const blockchainAddress = c.get('blockchainAddress');
      const ip = c.req.header('x-forwarded-for');
      const actingAs = c.req.header('X-Acting-As-Patient');

      const patient = await db
        .select({ id: patients.id, blockchainAddress: patients.blockchainAddress })
        .from(patients)
        .where(eq(patients.id, patientId))
        .limit(1);

      if (!patient.length)
        return c.json({ success: false, error: { message: 'Patient not found' } }, 404);

      const access = await resolveAccess(
        userType, userId, blockchainAddress,
        patientId, patient[0].blockchainAddress,
        'visits', patientId, ip, actingAs,
      );

      if (!access.allowed)
        return c.json({ success: false, error: { message: 'Access denied — patient has not granted you permission' } }, 403);

      // ── Scope the query ───────────────────────────────────────────────────
      const conditions = [eq(visits.patientId, patientId)];
      if (access.scopeInstitutionId) {
        // Implicit access — restrict to staff's institution only
        conditions.push(eq(visits.institutionId, access.scopeInstitutionId));
      }
      // null scopeInstitutionId → blockchain permission granted → no extra filter

      const patientVisits = await db
        .select()
        .from(visits)
        .where(and(...conditions))
        .orderBy(desc(visits.admissionDate));

      return c.json({
        success: true,
        data: {
          visits: patientVisits,
          scopedToInstitution: !!access.scopeInstitutionId,
        },
      });
    } catch (err: any) {
      console.error('[RECORD_VISITS]', err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ══════════════════════════════════════════════════════════════════════════
  // GET /visits/:patientId/:visitId  — full visit detail
  // ══════════════════════════════════════════════════════════════════════════
  .openapi(createRoute({
    tags: ['Records'],
    summary: 'Get full details of a visit (scoped by institution or blockchain permission)',
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
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const { patientId, visitId } = c.req.valid('param');
      const userId = c.get('userId');
      const userType = c.get('userType');
      const blockchainAddress = c.get('blockchainAddress');
      const ip = c.req.header('x-forwarded-for');
      const actingAs = c.req.header('X-Acting-As-Patient');

      const patient = await db
        .select({ blockchainAddress: patients.blockchainAddress })
        .from(patients)
        .where(eq(patients.id, patientId))
        .limit(1);

      if (!patient.length)
        return c.json({ success: false, error: { message: 'Patient not found' } }, 404);

      const access = await resolveAccess(
        userType, userId, blockchainAddress,
        patientId, patient[0].blockchainAddress,
        'visit_detail', visitId, ip, actingAs,
      );

      if (!access.allowed)
        return c.json({ success: false, error: { message: 'Access denied — no permission' } }, 403);

      // ── If institution-scoped, verify this visit belongs to that institution
      if (access.scopeInstitutionId) {
        const visitCheck = await db
          .select({ institutionId: visits.institutionId })
          .from(visits)
          .where(and(eq(visits.id, visitId), eq(visits.patientId, patientId)))
          .limit(1);

        if (!visitCheck.length)
          return c.json({ success: false, error: { message: 'Visit not found' } }, 404);

        if (visitCheck[0].institutionId !== access.scopeInstitutionId)
          return c.json({ success: false, error: { message: 'Access denied — this visit belongs to another institution' } }, 403);
      }

      // ── Fetch all visit data in parallel ──────────────────────────────────
      const [
        visitData, consultationData, diagnosisData, vitalData,
        labOrders, imagingOrderData, prescriptionData,
      ] = await Promise.all([
        db.select().from(visits).where(and(eq(visits.id, visitId), eq(visits.patientId, patientId))).limit(1),
        db.select().from(consultations).where(eq(consultations.visitId, visitId)),
        db.select().from(diagnoses).where(eq(diagnoses.visitId, visitId)),
        db.select().from(vitalSigns).where(eq(vitalSigns.visitId, visitId)).orderBy(desc(vitalSigns.recordedAt)),
        db.select().from(labTestOrders).where(eq(labTestOrders.visitId, visitId)),
        db.select().from(imagingOrders).where(eq(imagingOrders.visitId, visitId)),
        db.select().from(prescriptions).where(eq(prescriptions.visitId, visitId)),
      ]);

      if (!visitData.length)
        return c.json({ success: false, error: { message: 'Visit not found' } }, 404);

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
        },
      });
    } catch (err: any) {
      console.error('[RECORD_VISIT_DETAIL]', err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ══════════════════════════════════════════════════════════════════════════
  // POST /visits  — create visit
  // ══════════════════════════════════════════════════════════════════════════
  .openapi(createRoute({
    tags: ['Records'],
    summary: 'Create a new visit for a patient',
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
            }),
          },
        },
      },
    },
    responses: {
      201: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              data: z.object({
                visitId: z.string(),
                visitNumber: z.string(),
                blockchainHash: z.string(),
              }),
            }),
          },
        },
        description: 'Visit created',
      },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Patient not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      if (!['practitioner', 'nurse', 'receptionist'].includes(userType))
        return c.json({ success: false, error: { message: 'Only clinical staff can create visits' } }, 403);

      const body = c.req.valid('json');
      const userId = c.get('userId');
      const ip = c.req.header('x-forwarded-for');

      const patient = await db
        .select({ id: patients.id, blockchainAddress: patients.blockchainAddress })
        .from(patients)
        .where(eq(patients.id, body.patientId))
        .limit(1);

      if (!patient.length)
        return c.json({ success: false, error: { message: 'Patient not found' } }, 404);

      const visitNumber = `VIS-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

      const visitHash = generateRecordHash({
        patientId: body.patientId,
        visitType: body.visitType,
        chiefComplaint: body.chiefComplaint,
        visitNumber,
        timestamp: new Date().toISOString(),
      });

      const [result] = await db.insert(visits).values({
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
        blockchainHash: visitHash,
      }).returning({ id: visits.id, visitNumber: visits.visitNumber });

      await storeRecordHash(result.id, patient[0].blockchainAddress, visitHash, 'visit');

      await db.insert(auditLogs).values({
        userId,
        userType,
        patientId: body.patientId,
        actionType: 'create',
        resourceType: 'visit',
        resourceId: result.id,
        blockchainTransactionId: crypto.randomBytes(16).toString('hex'),
        ipAddress: ip,
      });

      return c.json({
        success: true,
        data: { visitId: result.id, visitNumber: result.visitNumber, blockchainHash: visitHash },
      }, 201);
    } catch (err: any) {
      console.error('[RECORD_CREATE_VISIT]', err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ══════════════════════════════════════════════════════════════════════════
  // GET /labs/:visitId
  // ══════════════════════════════════════════════════════════════════════════
  .openapi(createRoute({
    tags: ['Records'],
    summary: 'Get lab results for a visit (institution-scoped or blockchain permission)',
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
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const { visitId } = c.req.valid('param');
      const userId = c.get('userId');
      const userType = c.get('userType');
      const blockchainAddress = c.get('blockchainAddress');
      const ip = c.req.header('x-forwarded-for');
      const actingAs = c.req.header('X-Acting-As-Patient');

      // Resolve visit → patient
      const visit = await db
        .select({ patientId: visits.patientId, institutionId: visits.institutionId })
        .from(visits)
        .where(eq(visits.id, visitId))
        .limit(1);

      if (!visit.length)
        return c.json({ success: false, error: { message: 'Visit not found' } }, 404);

      const { patientId, institutionId: visitInstitutionId } = visit[0];

      const patient = await db
        .select({ blockchainAddress: patients.blockchainAddress })
        .from(patients)
        .where(eq(patients.id, patientId))
        .limit(1);

      if (!patient.length)
        return c.json({ success: false, error: { message: 'Patient not found' } }, 404);

      const access = await resolveAccess(
        userType, userId, blockchainAddress,
        patientId, patient[0].blockchainAddress,
        'lab_results', visitId, ip, actingAs,
      );

      if (!access.allowed)
        return c.json({ success: false, error: { message: 'Access denied — no permission' } }, 403);

      // Institution-scoped: verify the visit belongs to staff's institution
      if (access.scopeInstitutionId && visitInstitutionId !== access.scopeInstitutionId)
        return c.json({ success: false, error: { message: 'Access denied — this visit belongs to another institution' } }, 403);

      const orders = await db.select().from(labTestOrders).where(eq(labTestOrders.visitId, visitId));
      const orderIds = orders.map(o => o.id);
      const results = orderIds.length > 0
        ? await db.select().from(labTestResults).where(inArray(labTestResults.labTestOrderId, orderIds))
        : [];

      return c.json({ success: true, data: { orders, results } });
    } catch (err: any) {
      console.error('[RECORD_LABS]', err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ══════════════════════════════════════════════════════════════════════════
  // POST /verify  — blockchain integrity check
  // ══════════════════════════════════════════════════════════════════════════
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
            }),
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              data: z.object({ isValid: z.boolean(), message: z.string() }),
            }),
          },
        },
        description: 'Verification result',
      },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const { recordId, recordData } = c.req.valid('json');
      const currentHash = generateRecordHash(recordData);
      const result: VerifyResult = await verifyRecordHash(recordId, currentHash);

      const message = result.timedOut
        ? 'Unable to verify — blockchain temporarily unavailable'
        : result.notFound
          ? 'Record not found on blockchain — it may not have been anchored yet'
          : result.verified
            ? 'Record integrity verified — data matches blockchain'
            : 'WARNING: Record hash mismatch — data may have been tampered with';

      return c.json({
        success: true,
        data: {
          isValid: result.verified,
          timedOut: result.timedOut,
          notFound: result.notFound,
          message,
        },
      });
    } catch (err: any) {
      console.error('[RECORD_VERIFY]', err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  });