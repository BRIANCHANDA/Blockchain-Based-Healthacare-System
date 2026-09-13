/**
 * Visits — the clinical spine of the system.
 *
 * A visit is one patient encounter at one institution, and almost every other
 * clinical record hangs off a visitId: vitals, consultations, diagnoses, lab
 * and imaging orders, prescriptions, discharge. This is the largest route
 * module in the codebase because it carries that whole workflow.
 *
 * Two things recur throughout and are worth understanding once:
 *
 * 1. CONSENT IS CHECKED AGAINST THE LEDGER, NOT THE DATABASE.
 *    Handlers that expose patient data call checkPermission() from
 *    services/fabric.ts, which queries Fabric. The accessPermissions table is a
 *    convenience mirror for listing and filtering; it is never the authority.
 *
 * 2. WRITES ARE ANCHORED, AND ANCHORING IS ALLOWED TO FAIL.
 *    After a clinical row is written, generateRecordHash() fingerprints it and
 *    storeRecordHash() commits that digest to the ledger. Those calls are
 *    deliberately not awaited into the response path — if the network is down
 *    the clinical write still succeeds and the anchor is retried, because
 *    losing a consultation note is worse than delaying its proof. See
 *    docs/ARCHITECTURE.md §5 on asymmetric failure behaviour.
 *
 * Access is additionally scoped by institution: staff act within their own
 * institution, and reaching another one's records goes through the referral or
 * emergency-override paths in routes/cross-institution.ts.
 */

import { handleError } from '../lib/errors';
import { createRoute, z } from '@hono/zod-openapi';
import { eq, desc, and, sql, ne, or, isNull } from 'drizzle-orm';
import { db } from '../db';
import {
  visits, vitalSigns, consultations, diagnoses,
  labTestOrders, labTestResults, imagingOrders, imagingReports,
  prescriptions, prescriptionItems, patients, auditLogs,
  practitioners, patientInstitutionRegistrations, medicationStock, stockMovements,
  wardBeds, wards,
} from '../db/schema';
import { createRouter } from '../lib/create-app';
import { authMiddleware } from '../middleware/auth';
import { storeRecordHash, logAccess, checkPermission } from '../services/fabric';
import { generateRecordHash, decrypt } from '../services/crypto';
import crypto from 'crypto';
import path from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { createHash } from 'crypto';
import { notifyUser } from '../services/notifications';
import { notifyPatientAssigned } from '../services/assignment-notifications';
import { vitals as vVitals } from '../lib/validators';

const errorSchema = z.object({ success: z.boolean(), error: z.object({ message: z.string() }) });
const successData = z.object({ success: z.boolean(), data: z.any() });

// ── Helpers ───────────────────────────────────────────────────────────────────

async function auditAction(
  userId: string, userType: any, patientId: string, patientBlockchainAddress: string,
  actionType: any, resourceType: string, resourceId: string, ip?: string
) {
  const txId = crypto.randomBytes(16).toString('hex');
  await Promise.all([
    db.insert(auditLogs).values({
      userId, userType, patientId, actionType, resourceType,
      resourceId: resourceId as any, blockchainTransactionId: txId, ipAddress: ip,
    }),
    logAccess(patientBlockchainAddress, resourceId, `${actionType}:${resourceType}`, true),
  ]);
}

async function getStaffInstitution(userId: string): Promise<string | null> {
  const staff = await db.select({ institutionId: practitioners.institutionId })
    .from(practitioners).where(eq(practitioners.id, userId)).limit(1);
  return staff[0]?.institutionId ?? null;
}

async function canActOnVisit(
  staffUserId: string,
  visitInstitutionId: string | null,
): Promise<boolean> {
  const staffInstitutionId = await getStaffInstitution(staffUserId);
  if (!staffInstitutionId || !visitInstitutionId) {
    console.warn(`⚠ canActOnVisit: null institutionId (staff=${staffInstitutionId}, visit=${visitInstitutionId}). Allowing.`);
    return true;
  }
  return staffInstitutionId === visitInstitutionId;
}

async function resolveAccess(
  staffUserId: string,
  resourceInstitutionId: string | null,
  staffBlockchainAddress: string | null | undefined,
  patientBlockchainAddress: string,
): Promise<{ granted: boolean; reason: string }> {
  const staffInstitutionId = await getStaffInstitution(staffUserId);
  if (resourceInstitutionId && staffInstitutionId && resourceInstitutionId === staffInstitutionId)
    return { granted: true, reason: 'own_institution_record' };
  if (staffBlockchainAddress) {
    const hasPerm = await checkPermission(patientBlockchainAddress, staffBlockchainAddress);
    if (hasPerm) return { granted: true, reason: 'blockchain_permission' };
  }
  return { granted: false, reason: 'no_access' };
}

// ── Router ────────────────────────────────────────────────────────────────────

export const visitRouter = createRouter()

  // ── CHECK ACTIVE VISIT ────────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Visits'], summary: 'Check whether a patient has an active in-progress visit',
    method: 'get', path: '/patient/:patientId/active',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    request: { params: z.object({ patientId: z.string().uuid() }) },
    responses: {
      200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.object({ hasActiveVisit: z.boolean(), visit: z.any().nullable() }) }) } }, description: 'Active visit check' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Access denied' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      if (!['nurse', 'practitioner', 'receptionist', 'admin'].includes(userType))
        return c.json({ success: false, error: { message: 'Access denied' } }, 403);
      const { patientId } = c.req.valid('param');
      const active = await db.select({
        id: visits.id, visitNumber: visits.visitNumber, visitType: visits.visitType,
        priority: visits.priority, admissionDate: visits.admissionDate,
      }).from(visits)
        .where(and(eq(visits.patientId, patientId), eq(visits.status, 'in-progress')))
        .orderBy(desc(visits.admissionDate)).limit(1);
      if (!active.length) return c.json({ success: true, data: { hasActiveVisit: false, visit: null } });
      const v = active[0];
      return c.json({ success: true, data: { hasActiveVisit: true, visit: { id: v.id, visitNumber: v.visitNumber, visitType: v.visitType, priority: v.priority, admissionDate: v.admissionDate?.toISOString() ?? '' } } });
    } catch (err: any) {
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ── ADMITTED (INPATIENT) LIST ─────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Visits'], summary: 'List all current inpatients for the institution',
    method: 'get', path: '/inpatients',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    responses: {
      200: { content: { 'application/json': { schema: successData } }, description: 'Inpatient list' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      if (!['practitioner', 'nurse', 'admin'].includes(userType))
        return c.json({ success: false, error: { message: 'Access denied' } }, 403);

      const userId = c.get('userId');
      const institutionId = await getStaffInstitution(userId);
      if (!institutionId)
        return c.json({ success: false, error: { message: 'No institution' } }, 403);

      const { decrypt } = await import('../services/crypto');

      const rows = await db.execute(sql`
        SELECT
          v.id,
          v.visit_number         AS "visitNumber",
          v.patient_id           AS "patientId",
          v.priority,
          v.admission_date       AS "admissionDate",
          v.admitting_diagnosis  AS "admittingDiagnosis",
          v.ward_or_room         AS "wardOrRoom",
          v.bed_number           AS "bedNumber",
          p.first_name_encrypted AS "firstNameEncrypted",
          p.last_name_encrypted  AS "lastNameEncrypted",
          p.gender,
          p.blood_type           AS "bloodType",
          dr.first_name_encrypted AS "drFirstEncrypted",
          dr.last_name_encrypted  AS "drLastEncrypted",
          wb.bed_code            AS "bedCode",
          w.ward_name            AS "wardName"
        FROM visits v
        JOIN patients p ON p.id = v.patient_id
        LEFT JOIN practitioners dr ON dr.id = v.assigned_doctor_id
        LEFT JOIN ward_beds wb ON wb.current_visit_id = v.id
        LEFT JOIN wards w ON w.id = wb.ward_id
        WHERE v.institution_id = ${institutionId}
          AND v.visit_type = 'inpatient'
          AND v.status = 'in-progress'
        ORDER BY
          CASE v.priority WHEN 'critical' THEN 1 WHEN 'emergency' THEN 2 WHEN 'urgent' THEN 3 ELSE 4 END,
          v.admission_date ASC
      `);

      const result = await Promise.all((rows as any[]).map(async (r) => ({
        id:                r.id,
        visitNumber:       r.visitNumber,
        patientId:         r.patientId,
        priority:          r.priority,
        admissionDate:     r.admissionDate,
        admittingDiagnosis: r.admittingDiagnosis,
        wardName:          r.wardName ?? r.wardOrRoom ?? null,
        bedCode:           r.bedCode ?? r.bedNumber ?? null,
        gender:            r.gender,
        bloodType:         r.bloodType,
        patientName:       `${await decrypt(r.firstNameEncrypted)} ${await decrypt(r.lastNameEncrypted)}`,
        doctorName:        r.drFirstEncrypted
                             ? `${await decrypt(r.drFirstEncrypted)} ${await decrypt(r.drLastEncrypted)}`
                             : null,
      })));

      return c.json({ success: true, data: { patients: result, total: result.length } });
    } catch (err: unknown) {
      console.error('Inpatients error:', err);
      return handleError(err, c);
    }
  })

  // ── TODAY'S QUEUE ─────────────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Visits'], summary: "Get today's active visits queue",
    method: 'get', path: '/today',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    responses: {
      200: { content: { 'application/json': { schema: successData } }, description: "Today's visits" },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      if (!['nurse', 'practitioner', 'receptionist', 'admin'].includes(userType))
        return c.json({ success: false, error: { message: 'Access denied' } }, 403);
      const userId = c.get('userId');
      const staffInstitutionId = await getStaffInstitution(userId);
      const institutionFilter = (userType === 'admin' && !staffInstitutionId) ? undefined : eq(visits.institutionId, staffInstitutionId);
      const { decrypt } = await import('../services/crypto');

      const activeVisits = await db.select({
        id: visits.id, visitNumber: visits.visitNumber, patientId: visits.patientId,
        visitType: visits.visitType, chiefComplaint: visits.chiefComplaint,
        priority: visits.priority, status: visits.status, wardOrRoom: visits.wardOrRoom,
        admissionDate: visits.admissionDate, institutionId: visits.institutionId,
        assignedNurseId: visits.assignedNurseId, assignedDoctorId: visits.assignedDoctorId,
      }).from(visits)
        .where(and(eq(visits.status, 'in-progress'), institutionFilter))
        .orderBy(
          sql`CASE ${visits.priority} WHEN 'critical' THEN 1 WHEN 'emergency' THEN 2 WHEN 'urgent' THEN 3 ELSE 4 END`,
          visits.admissionDate
        ).limit(200);

      const enriched = await Promise.all(activeVisits.map(async (v) => {
        const patient = await db.select({
          firstNameEncrypted: patients.firstNameEncrypted, lastNameEncrypted: patients.lastNameEncrypted,
          gender: patients.gender, bloodType: patients.bloodType,
        }).from(patients).where(eq(patients.id, v.patientId)).limit(1);

        let assignedNurseName: string | null = null;
        if (v.assignedNurseId) {
          const nurse = await db.select({ firstNameEncrypted: practitioners.firstNameEncrypted, lastNameEncrypted: practitioners.lastNameEncrypted })
            .from(practitioners).where(eq(practitioners.id, v.assignedNurseId)).limit(1);
          if (nurse.length) assignedNurseName = `${decrypt(nurse[0].firstNameEncrypted)} ${decrypt(nurse[0].lastNameEncrypted)}`;
        }

        const hvResult = await db.execute(sql`SELECT EXISTS (SELECT 1 FROM ${vitalSigns} WHERE ${vitalSigns.visitId} = ${v.id}) AS hv`);
        const hasVitals = (hvResult as any).rows?.[0]?.hv === true || (hvResult as any).rows?.[0]?.hv === 't';

        return {
          ...v, assignedNurseName, hasVitals,
          patient: patient.length ? {
            firstName: decrypt(patient[0].firstNameEncrypted), lastName: decrypt(patient[0].lastNameEncrypted),
            gender: patient[0].gender, bloodType: patient[0].bloodType,
          } : null,
        };
      }));

      return c.json({ success: true, data: { visits: enriched, total: enriched.length } });
    } catch (err: any) {
      console.error(err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ── FIND BY VISIT NUMBER ──────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Visits'], summary: 'Find visit by visit number',
    method: 'get', path: '/number/:visitNumber',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    request: { params: z.object({ visitNumber: z.string() }) },
    responses: {
      200: { content: { 'application/json': { schema: successData } }, description: 'Visit found' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const { visitNumber } = c.req.valid('param');
      const { decrypt } = await import('../services/crypto');
      const visit = await db.select().from(visits).where(eq(visits.visitNumber, visitNumber)).limit(1);
      if (!visit.length) return c.json({ success: false, error: { message: 'Visit not found' } }, 404);
      const patient = await db.select({
        firstNameEncrypted: patients.firstNameEncrypted, lastNameEncrypted: patients.lastNameEncrypted,
        gender: patients.gender, bloodType: patients.bloodType,
        isMinor: patients.isMinor, dateOfBirthEncrypted: patients.dateOfBirthEncrypted,
      }).from(patients).where(eq(patients.id, visit[0].patientId)).limit(1);
      return c.json({
        success: true, data: {
          visit: visit[0],
          patient: patient.length ? {
            firstName: decrypt(patient[0].firstNameEncrypted),
            lastName: decrypt(patient[0].lastNameEncrypted),
            gender: patient[0].gender,
            bloodType: patient[0].bloodType,
            isMinor: patient[0].isMinor,
            dateOfBirth: patient[0].dateOfBirthEncrypted ? decrypt(patient[0].dateOfBirthEncrypted) : undefined,
          } : null,
        }
      });
    } catch (err: any) {
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ── CREATE VISIT ──────────────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Visits'], summary: 'Create a new patient visit',
    method: 'post', path: '/',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
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
              priority: z.enum(['routine', 'urgent', 'emergency', 'critical']).default('routine'),
              wardOrRoom: z.string().optional(),
              bedNumber: z.string().optional(),
            }),
          },
        },
      },
    },
    responses: {
      201: { content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.object({ visitId: z.string(), visitNumber: z.string(), blockchainHash: z.string() }) }) } }, description: 'Visit created' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Patient not found' },
      409: { content: { 'application/json': { schema: errorSchema } }, description: 'Active visit exists' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      if (!['practitioner', 'nurse', 'admin', 'receptionist'].includes(userType))
        return c.json({ success: false, error: { message: 'Unauthorized to create visits' } }, 403);
      const body = c.req.valid('json');
      const userId = c.get('userId');
      const ip = c.req.header('x-forwarded-for');

      const staffInstitutionId = await getStaffInstitution(userId);
      const institutionId = body.institutionId || staffInstitutionId;

      const patient = await db.select({ id: patients.id, blockchainAddress: patients.blockchainAddress })
        .from(patients).where(eq(patients.id, body.patientId)).limit(1);
      if (!patient.length) return c.json({ success: false, error: { message: 'Patient not found' } }, 404);

      const existing = await db.select({ id: visits.id, visitNumber: visits.visitNumber })
        .from(visits).where(and(eq(visits.patientId, body.patientId), eq(visits.status, 'in-progress'))).limit(1);
      if (existing.length)
        return c.json({ success: false, error: { message: `Patient already has an active visit (${existing[0].visitNumber}). Discharge it before creating a new one.` } }, 409);

      const visitNumber = `VIS-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      const visitHash = generateRecordHash({ patientId: body.patientId, visitNumber, visitType: body.visitType, createdBy: userId, timestamp: new Date().toISOString() });

      const result = await db.insert(visits).values({
        patientId: body.patientId, institutionId: institutionId ?? null,
        departmentId: body.departmentId ?? null, wardId: body.wardId ?? null,
        visitNumber, visitType: body.visitType, admissionDate: new Date(),
        chiefComplaint: '', priority: body.priority, wardOrRoom: body.wardOrRoom ?? null,
        bedNumber: body.bedNumber ?? null, status: 'in-progress', blockchainHash: visitHash,
      }).returning({ id: visits.id, visitNumber: visits.visitNumber });

      await storeRecordHash(result[0].id, patient[0].blockchainAddress, visitHash, 'visit');
      await auditAction(userId, userType, body.patientId, patient[0].blockchainAddress, 'create', 'visit', result[0].id, ip);
      return c.json({ success: true, data: { visitId: result[0].id, visitNumber: result[0].visitNumber, blockchainHash: visitHash } }, 201);
    } catch (err: any) {
      console.error(err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ── ASSIGN NURSE ──────────────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Visits'], summary: 'Assign a nurse to a visit (receptionist only)',
    method: 'post', path: '/:visitId/assign-nurse',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    request: {
      params: z.object({ visitId: z.string().uuid() }),
      body: { content: { 'application/json': { schema: z.object({ nurseId: z.string().uuid() }) } } },
    },
    responses: {
      200: { content: { 'application/json': { schema: successData } }, description: 'Nurse assigned' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      const userId = c.get('userId');
      if (userType !== 'receptionist' && userType !== 'admin')
        return c.json({ success: false, error: { message: 'Only receptionists or admins can assign nurses' } }, 403);
      const { visitId } = c.req.valid('param');
      const { nurseId } = c.req.valid('json');

      const [visitRow, staffRow, nurseRow] = await Promise.all([
        db.select({ institutionId: visits.institutionId, patientId: visits.patientId, visitNumber: visits.visitNumber, priority: visits.priority }).from(visits).where(eq(visits.id, visitId)).limit(1),
        db.select({ institutionId: practitioners.institutionId }).from(practitioners).where(eq(practitioners.id, userId)).limit(1),
        db.select({ id: practitioners.id, role: practitioners.role, institutionId: practitioners.institutionId, isActive: practitioners.isActive }).from(practitioners).where(eq(practitioners.id, nurseId)).limit(1),
      ]);

      if (!visitRow.length) return c.json({ success: false, error: { message: 'Visit not found' } }, 404);
      if (!nurseRow.length) return c.json({ success: false, error: { message: 'Nurse not found' } }, 404);
      if (nurseRow[0].role !== 'nurse') return c.json({ success: false, error: { message: `Staff member is a '${nurseRow[0].role}', not a nurse` } }, 400);

      const visitInst = visitRow[0]?.institutionId ?? null;
      const staffInst = staffRow[0]?.institutionId ?? null;
      const nurseInst = nurseRow[0]?.institutionId ?? null;
      const mismatch = !visitInst || !staffInst || !nurseInst || !(staffInst === visitInst && staffInst === nurseInst);
      if (mismatch) return c.json({ success: false, error: { message: 'Institution mismatch — cannot assign nurse from a different institution.' } }, 403);
      if (!nurseRow[0].isActive) return c.json({ success: false, error: { message: 'Nurse account is inactive' } }, 403);

      await db.update(visits).set({ assignedNurseId: nurseId }).where(eq(visits.id, visitId));
      await notifyPatientAssigned(visitId, nurseId, 'nurse');
      return c.json({ success: true, data: { message: 'Nurse assigned successfully' } });
    } catch (err: any) {
      return handleError(err, c);
    }
  })

  // ── ASSIGN DOCTOR ─────────────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Visits'], summary: 'Assign a doctor to a visit (nurse only)',
    method: 'post', path: '/:visitId/assign-doctor',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    request: {
      params: z.object({ visitId: z.string().uuid() }),
      body: { content: { 'application/json': { schema: z.object({ doctorId: z.string().uuid() }) } } },
    },
    responses: {
      200: { content: { 'application/json': { schema: successData } }, description: 'Doctor assigned' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      const userId = c.get('userId');
      if (userType !== 'nurse' && userType !== 'admin')
        return c.json({ success: false, error: { message: 'Only nurses can assign doctors' } }, 403);
      const { visitId } = c.req.valid('param');
      const { doctorId } = c.req.valid('json');
      const visit = await db.select({ institutionId: visits.institutionId, patientId: visits.patientId, visitNumber: visits.visitNumber, priority: visits.priority }).from(visits).where(eq(visits.id, visitId)).limit(1);
      if (!visit.length) return c.json({ success: false, error: { message: 'Visit not found' } }, 404);
      const staffInstitutionId = await getStaffInstitution(userId);
      if (!visit[0].institutionId || !staffInstitutionId || visit[0].institutionId !== staffInstitutionId)
        return c.json({ success: false, error: { message: 'Cannot assign doctor to visit from another institution' } }, 403);
      const doctor = await db.select().from(practitioners)
        .where(and(eq(practitioners.id, doctorId), eq(practitioners.role, 'practitioner'), eq(practitioners.isActive, true), eq(practitioners.institutionId, staffInstitutionId)))
        .limit(1);
      if (!doctor.length) return c.json({ success: false, error: { message: 'Doctor not found in your institution' } }, 404);
      await db.update(visits).set({ assignedDoctorId: doctorId }).where(eq(visits.id, visitId));
      await notifyPatientAssigned(visitId, doctorId, 'practitioner');
      return c.json({ success: true, data: { message: 'Doctor assigned successfully' } });
    } catch (err: any) {
      return handleError(err, c);
    }
  })

  // ── RECORD VITALS ─────────────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Visits'], summary: 'Record patient vital signs (Nurse only)',
    method: 'post', path: '/:visitId/vitals',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    request: {
      params: z.object({ visitId: z.string().uuid() }),
      body: {
        content: {
          'application/json': {
            schema: z.object({
              // Ranged, not merely typed. z.number() alone accepted a
              // temperature of 999 and a pulse of -50; the bounds below exclude
              // the physically impossible while still admitting the genuinely
              // abnormal — 41.5 degrees and a pulse of 180 are emergencies that
              // must be recordable. Checked against every existing row before
              // being applied.
              temperature: vVitals.temperatureC.optional(),
              bloodPressureSystolic: vVitals.systolic.optional(),
              bloodPressureDiastolic: vVitals.diastolic.optional(),
              pulseRate: vVitals.pulseBpm.optional(),
              respiratoryRate: vVitals.respiratoryRate.optional(),
              oxygenSaturation: vVitals.oxygenSaturation.optional(),
              weight: vVitals.weightKg.optional(),
              height: vVitals.heightCm.optional(),
              painLevel: z.number().min(0).max(10).optional(), nurseNotes: z.string().optional(),
            }),
          },
        },
      },
    },
    responses: {
      201: { content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.object({ vitals: z.any(), blockchainHash: z.string() }) }) } }, description: 'Vitals recorded' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Visit not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      let userType = c.get('userType');
      const userId = c.get('userId');
      if (userType !== 'nurse') {
        const staff = await db.select({ role: practitioners.role }).from(practitioners).where(eq(practitioners.id, userId)).limit(1);
        if (staff.length && (staff[0].role === 'nurse' || staff[0].role === 'practitioner')) userType = 'nurse';
      }
      if (userType !== 'nurse') return c.json({ success: false, error: { message: 'Only nurses can record vitals' } }, 403);

      const { visitId } = c.req.valid('param');
      const body = c.req.valid('json');
      const ip = c.req.header('x-forwarded-for');

      const visitRow = await db.select({ institutionId: visits.institutionId, status: visits.status, patientId: visits.patientId })
        .from(visits).where(eq(visits.id, visitId)).limit(1);
      if (!visitRow.length) return c.json({ success: false, error: { message: 'Visit not found' } }, 404);

      const patient = await db.select({ blockchainAddress: patients.blockchainAddress })
        .from(patients).where(eq(patients.id, visitRow[0].patientId)).limit(1);
      if (!patient.length) return c.json({ success: false, error: { message: 'Patient not found' } }, 404);

      const canAct = await canActOnVisit(userId, visitRow[0].institutionId);
      if (!canAct) {
        await auditAction(userId, userType, visitRow[0].patientId, patient[0].blockchainAddress, 'view', 'vital_signs', visitId, ip);
        return c.json({ success: false, error: { message: 'You can only record vitals on visits created by your institution.' } }, 403);
      }

      const vitalsHash = generateRecordHash({ visitId, ...body, recordedBy: userId, timestamp: new Date().toISOString() });
      const result = await db.insert(vitalSigns).values({
        visitId, patientId: visitRow[0].patientId, recordedByNurseId: userId,
        temperature: body.temperature ? body.temperature.toString() : null,
        bloodPressureSystolic: body.bloodPressureSystolic ?? null,
        bloodPressureDiastolic: body.bloodPressureDiastolic ?? null,
        pulseRate: body.pulseRate ?? null, respiratoryRate: body.respiratoryRate ?? null,
        oxygenSaturation: body.oxygenSaturation ?? null,
        weight: body.weight ? body.weight.toString() : null,
        height: body.height ? body.height.toString() : null,
        painLevel: body.painLevel ?? null, nurseNotes: body.nurseNotes ?? null,
        blockchainHash: vitalsHash,
      }).returning();

      await storeRecordHash(result[0].id, patient[0].blockchainAddress, vitalsHash, 'vital_signs');
      await auditAction(userId, userType, visitRow[0].patientId, patient[0].blockchainAddress, 'create', 'vital_signs', result[0].id, ip);
      return c.json({ success: true, data: { vitals: result[0], blockchainHash: vitalsHash } }, 201);
    } catch (err: any) {
      console.error('Vitals error:', err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ── HAS VITALS ────────────────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Visits'], summary: 'Check if vital signs exist for a visit',
    method: 'get', path: '/:visitId/has-vitals',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    request: { params: z.object({ visitId: z.string().uuid() }) },
    responses: { 200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.object({ hasVitals: z.boolean() }) }) } }, description: 'Result' } },
  }), async (c) => {
    const { visitId } = c.req.valid('param');
    const result = await db.execute(sql`SELECT EXISTS (SELECT 1 FROM ${vitalSigns} WHERE ${vitalSigns.visitId} = ${visitId}) AS has_vitals`);
    const hasVitals = (result as any).rows?.[0]?.has_vitals === true || (result as any).rows?.[0]?.has_vitals === 't';
    return c.json({ success: true, data: { hasVitals } });
  })

  // ── STAFF BY ROLE ─────────────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Staff'], summary: 'Get staff by role (for assignment dropdowns)',
    method: 'get', path: '/staff',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    request: { query: z.object({ role: z.enum(['lab_technician', 'radiologist', 'nurse', 'practitioner', 'pharmacist']) }) },
    responses: {
      200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.array(z.object({ id: z.string(), name: z.string() })) }) } }, description: 'Staff list' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userId = c.get('userId');
      const role = c.req.query('role');
      const institutionId = await getStaffInstitution(userId);
      if (!institutionId) return c.json({ success: false, error: { message: 'Your account is not associated with an institution.' } }, 403);
      const staff = await db.select({
        id: practitioners.id, firstNameEncrypted: practitioners.firstNameEncrypted, lastNameEncrypted: practitioners.lastNameEncrypted,
      }).from(practitioners)
        .where(and(eq(practitioners.role, role), eq(practitioners.institutionId, institutionId), eq(practitioners.isActive, true), eq(practitioners.isVerified, true)));
      const { decrypt } = await import('../services/crypto');
      const result = await Promise.all(staff.map(async (s) => ({ id: s.id, name: `${await decrypt(s.firstNameEncrypted)} ${await decrypt(s.lastNameEncrypted)}` })));
      return c.json({ success: true, data: result });
    } catch (err: any) {
      return handleError(err, c);
    }
  })

  // ── CONSULTATION ──────────────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Visits'], summary: 'Record doctor consultation notes (Practitioner)',
    method: 'post', path: '/:visitId/consultation',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    request: {
      params: z.object({ visitId: z.string().uuid() }),
      body: {
        content: {
          'application/json': {
            schema: z.object({
              chiefComplaint: z.string(),
              historyOfPresentIllness: z.string().optional(), reviewOfSystems: z.string().optional(),
              physicalExamination: z.string().optional(), clinicalFindings: z.string().optional(),
              assessment: z.string().optional(), plan: z.string().optional(),
              followUpInstructions: z.string().optional(), nextAppointmentDate: z.string().datetime().optional(),
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
      if (userType !== 'practitioner') return c.json({ success: false, error: { message: 'Only practitioners can record consultations' } }, 403);
      const { visitId } = c.req.valid('param');
      const body = c.req.valid('json');
      const userId = c.get('userId');
      const ip = c.req.header('x-forwarded-for');

      const visitRow = await db.select({ institutionId: visits.institutionId, status: visits.status, patientId: visits.patientId })
        .from(visits).where(eq(visits.id, visitId)).limit(1);
      if (!visitRow.length) return c.json({ success: false, error: { message: 'Visit not found' } }, 404);
      const patient = await db.select({ blockchainAddress: patients.blockchainAddress })
        .from(patients).where(eq(patients.id, visitRow[0].patientId)).limit(1);
      if (!patient.length) return c.json({ success: false, error: { message: 'Patient not found' } }, 404);

      const canAct = await canActOnVisit(userId, visitRow[0].institutionId);
      if (!canAct) {
        await auditAction(userId, 'practitioner', visitRow[0].patientId, patient[0].blockchainAddress, 'view', 'consultation', visitId, ip);
        return c.json({ success: false, error: { message: 'You can only perform clinical actions on visits created by your institution.' } }, 403);
      }

      const consultationHash = generateRecordHash({ visitId, ...body, practitionerId: userId, timestamp: new Date().toISOString() });
      const result = await db.insert(consultations).values({
        visitId, patientId: visitRow[0].patientId, practitionerId: userId,
        chiefComplaint: body.chiefComplaint, historyOfPresentIllness: body.historyOfPresentIllness ?? null,
        reviewOfSystems: body.reviewOfSystems ?? null, physicalExamination: body.physicalExamination ?? null,
        clinicalFindings: body.clinicalFindings ?? null, assessment: body.assessment ?? null,
        plan: body.plan ?? null, followUpInstructions: body.followUpInstructions ?? null,
        nextAppointmentDate: body.nextAppointmentDate ? new Date(body.nextAppointmentDate) : null,
        blockchainHash: consultationHash,
      }).returning();

      await db.update(visits).set({ chiefComplaint: body.chiefComplaint, updatedAt: new Date() }).where(eq(visits.id, visitId));
      await storeRecordHash(result[0].id, patient[0].blockchainAddress, consultationHash, 'consultation');
      await auditAction(userId, 'practitioner', visitRow[0].patientId, patient[0].blockchainAddress, 'create', 'consultation', result[0].id, ip);
      return c.json({ success: true, data: { consultation: result[0], blockchainHash: consultationHash } }, 201);
    } catch (err: any) {
      console.error(err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ── DIAGNOSIS ─────────────────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Visits'], summary: 'Add diagnosis to a visit (Practitioner)',
    method: 'post', path: '/:visitId/diagnosis',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    request: {
      params: z.object({ visitId: z.string().uuid() }),
      body: {
        content: {
          'application/json': {
            schema: z.object({
              consultationId: z.string().uuid(), icdCode: z.string(), diagnosisName: z.string(),
              diagnosisStatus: z.enum(['provisional', 'confirmed', 'ruled_out', 'differential']),
              severity: z.string().optional(), notes: z.string().optional(),
            }),
          },
        },
      },
    },
    responses: {
      201: { content: { 'application/json': { schema: successData } }, description: 'Diagnosis added' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      if (userType !== 'practitioner') return c.json({ success: false, error: { message: 'Only practitioners can add diagnoses' } }, 403);
      const { visitId } = c.req.valid('param');
      const body = c.req.valid('json');
      const userId = c.get('userId');
      const ip = c.req.header('x-forwarded-for');

      const visitRow = await db.select({ institutionId: visits.institutionId, status: visits.status, patientId: visits.patientId })
        .from(visits).where(eq(visits.id, visitId)).limit(1);
      if (!visitRow.length) return c.json({ success: false, error: { message: 'Visit not found' } }, 404);
      const consultation = await db.select().from(consultations).where(eq(consultations.id, body.consultationId)).limit(1);
      if (!consultation.length) return c.json({ success: false, error: { message: 'Consultation not found' } }, 404);
      const patient = await db.select({ blockchainAddress: patients.blockchainAddress })
        .from(patients).where(eq(patients.id, visitRow[0].patientId)).limit(1);
      if (!patient.length) return c.json({ success: false, error: { message: 'Patient not found' } }, 404);

      const canAct = await canActOnVisit(userId, visitRow[0].institutionId);
      if (!canAct) {
        await auditAction(userId, userType, visitRow[0].patientId, patient[0].blockchainAddress, 'view', 'diagnosis', visitId, ip);
        return c.json({ success: false, error: { message: 'You can only perform clinical actions on visits created by your institution.' } }, 403);
      }

      const diagnosisHash = generateRecordHash({ visitId, ...body, practitionerId: userId, timestamp: new Date().toISOString() });
      const result = await db.insert(diagnoses).values({
        consultationId: body.consultationId, visitId, patientId: visitRow[0].patientId, practitionerId: userId,
        icdCode: body.icdCode, diagnosisName: body.diagnosisName, diagnosisType: body.diagnosisStatus,
        severity: body.severity ?? null, notes: body.notes ?? null, blockchainHash: diagnosisHash,
      }).returning();

      await storeRecordHash(result[0].id, patient[0].blockchainAddress, diagnosisHash, 'diagnosis');
      await auditAction(userId, userType, visitRow[0].patientId, patient[0].blockchainAddress, 'create', 'diagnosis', result[0].id, ip);
      return c.json({ success: true, data: { diagnosis: result[0] } }, 201);
    } catch (err: any) {
      console.error(err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ── VISIT SUMMARY — FIXED to include vitals + hasVitals ──────────────────
  //
  // The triage page calls this endpoint to determine whether to show view
  // mode (vitals already recorded) or the new-triage flow. It now returns:
  //   data.visit.hasVitals   — boolean
  //   data.visit.vitals      — most recent vitals object (or null)
  //   data.visit.assignedDoctorName — decrypted doctor name (or null)
  //
  .openapi(createRoute({
    tags: ['Visits'], summary: 'Get complete visit summary',
    method: 'get', path: '/:visitId/summary',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    request: { params: z.object({ visitId: z.string().uuid() }) },
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

      const visitRow = await db.select().from(visits).where(eq(visits.id, visitId)).limit(1);
      if (!visitRow.length) return c.json({ success: false, error: { message: 'Visit not found' } }, 404);
      const visit = visitRow[0];

      const patient = await db.select({ blockchainAddress: patients.blockchainAddress })
        .from(patients).where(eq(patients.id, visit.patientId)).limit(1);
      if (!patient.length) return c.json({ success: false, error: { message: 'Patient not found' } }, 404);

      const access = await resolveAccess(userId, visit.institutionId, c.get('blockchainAddress'), patient[0].blockchainAddress);
      if (!access.granted) {
        await auditAction(userId, userType, visit.patientId, patient[0].blockchainAddress, 'view', 'visit_summary', visitId, ip);
        return c.json({ success: false, error: { message: 'No access. Request blockchain permission from the patient.' } }, 403);
      }

      const { decrypt } = await import('../services/crypto');

      // ── Load all clinical data in parallel ────────────────────────────────
      const [consultationData, diagnosisData, vitalData, prescriptionData] = await Promise.all([
        db.select().from(consultations).where(eq(consultations.visitId, visitId)),
        db.select().from(diagnoses).where(eq(diagnoses.visitId, visitId)),
        db.select().from(vitalSigns).where(eq(vitalSigns.visitId, visitId)).orderBy(desc(vitalSigns.recordedAt)),
        db.select().from(prescriptions).where(eq(prescriptions.visitId, visitId)),
      ]);

      // ── Most recent vitals for the triage page ────────────────────────────
      const mostRecentVitals = vitalData.length > 0 ? vitalData[0] : null;
      const hasVitals = vitalData.length > 0;

      // ── Assigned doctor name ──────────────────────────────────────────────
      let assignedDoctorName: string | null = null;
      if (visit.assignedDoctorId) {
        const docRow = await db.select({
          firstNameEncrypted: practitioners.firstNameEncrypted,
          lastNameEncrypted: practitioners.lastNameEncrypted,
        }).from(practitioners).where(eq(practitioners.id, visit.assignedDoctorId)).limit(1);
        if (docRow.length)
          assignedDoctorName = `${decrypt(docRow[0].firstNameEncrypted)} ${decrypt(docRow[0].lastNameEncrypted)}`;
      }

      // ── Patient demographics ──────────────────────────────────────────────
      const patientRow = await db.select().from(patients).where(eq(patients.id, visit.patientId)).limit(1);
      let patientData = null;
      if (patientRow.length) {
        const p = patientRow[0];
        patientData = {
          firstName: decrypt(p.firstNameEncrypted),
          lastName: decrypt(p.lastNameEncrypted),
          gender: p.gender,
          bloodType: p.bloodType,
        };
      }

      // ── Lab orders (with results) ─────────────────────────────────────────
      const labOrdersRaw = await db.select({
        id: labTestOrders.id, orderNumber: labTestOrders.orderNumber, testName: labTestOrders.testName,
        testCode: labTestOrders.testCode, specimenType: labTestOrders.specimenType, urgency: labTestOrders.urgency,
        clinicalNotes: labTestOrders.clinicalNotes, status: labTestOrders.status, orderedAt: labTestOrders.orderedAt,
        assignedTo: labTestOrders.assignedTo, techFirstName: practitioners.firstNameEncrypted, techLastName: practitioners.lastNameEncrypted,
        abnormalFindings: labTestResults.abnormalFindings,
        interpretation: labTestResults.interpretation,
        resultedAt: labTestResults.resultedAt,
        resultsData: labTestResults.resultsData,
        referenceRanges: labTestResults.referenceRanges,
      }).from(labTestOrders)
        .leftJoin(practitioners, eq(practitioners.id, labTestOrders.assignedTo))
        .leftJoin(labTestResults, eq(labTestResults.labTestOrderId, labTestOrders.id))
        .where(eq(labTestOrders.visitId, visitId));

      const labOrders = await Promise.all(labOrdersRaw.map(async (o) => ({
        id: o.id, orderNumber: o.orderNumber, testName: o.testName, testCode: o.testCode,
        specimenType: o.specimenType, urgency: o.urgency, clinicalNotes: o.clinicalNotes,
        status: o.status, orderedAt: o.orderedAt,
        assignedToName: o.techFirstName && o.techLastName
          ? `${await decrypt(o.techFirstName)} ${await decrypt(o.techLastName)}` : null,
        result: o.status === 'resulted' ? {
          abnormalFindings: o.abnormalFindings,
          interpretation: o.interpretation,
          performedAt: o.resultedAt,
          resultsData: o.resultsData,
          referenceRanges: o.referenceRanges,
        } : null,
      })));

      // ── Imaging orders (with reports) ─────────────────────────────────────
      const imagingOrdersRaw = await db.select({
        id: imagingOrders.id, orderNumber: imagingOrders.orderNumber, modality: imagingOrders.modality,
        bodyPart: imagingOrders.bodyPart, indication: imagingOrders.indication, urgency: imagingOrders.urgency,
        status: imagingOrders.status, orderedAt: imagingOrders.orderedAt, assignedTo: imagingOrders.assignedTo,
        radioFirstName: practitioners.firstNameEncrypted, radioLastName: practitioners.lastNameEncrypted,
        reportFindings: imagingReports.findings,
        reportImpression: imagingReports.impression,
        reportRecommendations: imagingReports.recommendations,
        reportImageUrls: imagingReports.imageUrls,
        reportedAt: imagingReports.reportedAt,
      }).from(imagingOrders)
        .leftJoin(practitioners, eq(practitioners.id, imagingOrders.assignedTo))
        .leftJoin(imagingReports, eq(imagingReports.imagingOrderId, imagingOrders.id))
        .where(eq(imagingOrders.visitId, visitId));

      const imagingOrdersWithNames = await Promise.all(imagingOrdersRaw.map(async (o) => ({
        id: o.id, orderNumber: o.orderNumber, modality: o.modality,
        bodyPart: o.bodyPart, indication: o.indication, urgency: o.urgency,
        status: o.status, orderedAt: o.orderedAt,
        assignedToName: o.radioFirstName && o.radioLastName
          ? `${await decrypt(o.radioFirstName)} ${await decrypt(o.radioLastName)}` : null,
        report: o.reportFindings ? {
          findings: o.reportFindings,
          impression: o.reportImpression,
          recommendations: o.reportRecommendations,
          imageUrls: o.reportImageUrls,
          reportedAt: o.reportedAt,
        } : null,
      })));

      await auditAction(userId, userType, visit.patientId, patient[0].blockchainAddress, 'view', 'visit_summary', visitId, ip);

      return c.json({
        success: true,
        data: {
          // Visit row enriched with triage-relevant fields
          visit: {
            ...visit,
            hasVitals,
            vitals: mostRecentVitals,
            assignedDoctorName,
          },
          patient: patientData,
          accessReason: access.reason,
          consultations: consultationData,
          diagnoses: diagnosisData,
          vitalSigns: vitalData,
          labOrders,
          imagingOrders: imagingOrdersWithNames,
          prescriptions: prescriptionData,
        },
      });
    } catch (err: any) {
      console.error('Summary error:', err);
      return handleError(err, c);
    }
  })

  // ── LAB RESULTS ───────────────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Visits'], summary: 'Enter lab test results (Lab Technician)',
    method: 'post', path: '/:visitId/lab-results/:orderId',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    request: {
      params: z.object({ visitId: z.string().uuid(), orderId: z.string().uuid() }),
      body: {
        content: {
          'application/json': {
            schema: z.object({
              resultsData: z.any(),
              interpretation: z.string().optional(),
              abnormalFindings: z.string().optional(),
              referenceRanges: z.any().optional(),
              attachmentUrls: z.array(z.string()).optional(),
              hasCritical: z.boolean().optional(),
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
      if (userType !== 'lab_technician')
        return c.json({ success: false, error: { message: 'Only lab technicians can enter results' } }, 403);

      const { visitId, orderId } = c.req.valid('param');
      const body = c.req.valid('json');
      const userId = c.get('userId');
      const ip = c.req.header('x-forwarded-for');

      // ── Validate order exists ─────────────────────────────────────────────
      const order = await db
        .select()
        .from(labTestOrders)
        .where(eq(labTestOrders.id, orderId))
        .limit(1);
      if (!order.length)
        return c.json({ success: false, error: { message: 'Lab order not found' } }, 404);
      if (order[0].visitId !== visitId)
        return c.json({ success: false, error: { message: 'Lab order does not belong to this visit' } }, 400);
      // A null assignment is the shared hospital-laboratory queue. Explicitly
      // assigned orders remain actionable only by their intended technician.
      if (order[0].assignedTo && order[0].assignedTo !== userId)
        return c.json({ success: false, error: { message: 'This lab order is assigned to another technician' } }, 403);

      // ── Validate visit exists ─────────────────────────────────────────────
      const visitRow = await db
        .select({
          institutionId: visits.institutionId,
          status: visits.status,
          patientId: visits.patientId,
          assignedDoctorId: visits.assignedDoctorId,
        })
        .from(visits)
        .where(eq(visits.id, visitId))
        .limit(1);
      if (!visitRow.length)
        return c.json({ success: false, error: { message: 'Visit not found' } }, 404);

      // ── Validate patient exists ───────────────────────────────────────────
      const patient = await db
        .select({ blockchainAddress: patients.blockchainAddress })
        .from(patients)
        .where(eq(patients.id, visitRow[0].patientId))
        .limit(1);
      if (!patient.length)
        return c.json({ success: false, error: { message: 'Patient not found' } }, 404);

      // ── Institution check ─────────────────────────────────────────────────
      const canAct = await canActOnVisit(userId, visitRow[0].institutionId);
      if (!canAct)
        return c.json({
          success: false,
          error: { message: 'You can only perform clinical actions on visits created by your institution.' },
        }, 403);

      // ── Insert result + mark order as resulted ────────────────────────────
      const resultHash = generateRecordHash({
        orderId,
        ...body,
        labTechId: userId,
        timestamp: new Date().toISOString(),
      });

      await db
        .update(labTestOrders)
        .set({ status: 'resulted' })
        .where(eq(labTestOrders.id, orderId));

      const result = await db
        .insert(labTestResults)
        .values({
          labTestOrderId: orderId,
          performedByLabTechId: userId,
          resultsData: body.resultsData,
          interpretation: body.interpretation ?? null,
          abnormalFindings: body.abnormalFindings ?? null,
          referenceRanges: body.referenceRanges ?? null,
          attachmentUrls: body.attachmentUrls ?? null,
          blockchainHash: resultHash,
        })
        .returning();

      // ── Blockchain + audit ────────────────────────────────────────────────
      await storeRecordHash(result[0].id, patient[0].blockchainAddress, resultHash, 'lab_result');
      await auditAction(
        userId, userType,
        visitRow[0].patientId,
        patient[0].blockchainAddress,
        'create', 'lab_result', result[0].id, ip,
      );

      // ── Notify assigned doctor (SSE — fire and forget) ────────────────────
      const assignedDoctorId = visitRow[0].assignedDoctorId;
      if (assignedDoctorId) {
        try {
          const { notifyUser } = await import('../services/notifications');
          const { decrypt } = await import('../services/crypto');

          const patientRow = await db
            .select({
              firstNameEncrypted: patients.firstNameEncrypted,
              lastNameEncrypted: patients.lastNameEncrypted,
            })
            .from(patients)
            .where(eq(patients.id, visitRow[0].patientId))
            .limit(1);

          const patientName = patientRow.length
            ? `${decrypt(patientRow[0].firstNameEncrypted)} ${decrypt(patientRow[0].lastNameEncrypted)}`
            : 'Unknown Patient';

          notifyUser(assignedDoctorId, 'lab_result_ready', {
            visitId,
            orderId,
            orderNumber: order[0].orderNumber,
            testName: order[0].testName,
            patientName,
            hasCritical: !!body.hasCritical,
            ts: new Date().toISOString(),
          });
        } catch (notifyErr) {
          // Never fail the request because of a notification error
          console.warn('[LAB_RESULTS] Failed to notify doctor:', notifyErr);
        }
      }

      return c.json({ success: true, data: { result: result[0], blockchainHash: resultHash } }, 201);
    } catch (err: any) {
      console.error(err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

    // ── LAB RESULT ATTACHMENTS ────────────────────────────────────────────────
    // POST /:visitId/lab-results/:orderId/attachments   (multipart)
    //
    // Laboratory results previously accepted attachmentUrls as an array of
    // strings supplied by the client — there was no way to actually upload a
    // file, so a technician could reference a document but never store one.
    // This mirrors the radiology upload: the file is written to disk, its bytes
    // are hashed and anchored on the ledger, and the URL points at the
    // authenticated /api/files route rather than a public directory.
    .post('/:visitId/lab-results/:orderId/attachments', authMiddleware, async (c) => {
      try {
        const userId = c.get('userId');
        const visitId = c.req.param('visitId');
        const orderId = c.req.param('orderId');

        const [order] = await db.select({ id: labTestOrders.id })
          .from(labTestOrders).where(eq(labTestOrders.id, orderId)).limit(1);
        if (!order) return c.json({ success: false, error: { message: 'Lab order not found' } }, 404);

        const [visitRow] = await db.select({ institutionId: visits.institutionId, patientId: visits.patientId })
          .from(visits).where(eq(visits.id, visitId)).limit(1);
        if (!visitRow) return c.json({ success: false, error: { message: 'Visit not found' } }, 404);

        const [patient] = await db.select({ blockchainAddress: patients.blockchainAddress })
          .from(patients).where(eq(patients.id, visitRow.patientId)).limit(1);
        if (!patient) return c.json({ success: false, error: { message: 'Patient not found' } }, 404);

        // Same institutional boundary as every other clinical write.
        const canAct = await canActOnVisit(userId, visitRow.institutionId);
        if (!canAct) {
          return c.json({ success: false, error: { message: 'You can only perform clinical actions on visits created by your institution.' } }, 403);
        }

        const [existing] = await db.select().from(labTestResults)
          .where(eq(labTestResults.labTestOrderId, orderId)).limit(1);
        if (!existing) {
          return c.json({ success: false, error: { message: 'Submit the result before attaching documents' } }, 400);
        }

        const body = await c.req.parseBody();
        const raw = body['files'];
        const fileArray: File[] = raw && typeof raw !== 'string'
          ? (Array.isArray(raw) ? raw : [raw])
          : [];
        if (!fileArray.length) {
          return c.json({ success: false, error: { message: 'No files supplied' } }, 400);
        }

        // Only types the file route is willing to serve back. Accepting anything
        // else would store a document nobody could ever open.
        const ALLOWED = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
        const uploadDir = path.join(process.cwd(), 'uploads', 'lab');
        await mkdir(uploadDir, { recursive: true });

        const newUrls: string[] = [];
        for (const file of fileArray) {
          const ext = path.extname(file.name || '').toLowerCase();
          if (!ALLOWED.includes(ext)) {
            return c.json({ success: false, error: { message: `Unsupported file type: ${ext || 'unknown'}` } }, 415);
          }
          const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
          const buffer = Buffer.from(await file.arrayBuffer());
          await writeFile(path.join(uploadDir, filename), buffer);

          // Anchor the file's own bytes, so a swapped document is detectable
          // independently of the result record that references it.
          const hash = createHash('sha256').update(buffer).digest('hex');
          storeRecordHash(`${orderId}:attachment:${hash.slice(0, 8)}`, patient.blockchainAddress, hash, 'lab_attachment')
            .catch(() => { /* anchoring is retried; never lose the upload over it */ });

          newUrls.push(`${(process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')}/api/files/lab/${filename}`);
        }

        const merged = [...((existing.attachmentUrls as string[]) || []), ...newUrls];
        await db.update(labTestResults)
          .set({ attachmentUrls: merged })
          .where(eq(labTestResults.id, existing.id));

        return c.json({ success: true, data: { attachmentUrls: merged, added: newUrls.length } }, 201);
      } catch (err: any) {
        console.error('[LAB_ATTACHMENT]', err);
        return handleError(err, c);
      }
    })


  // ── LAB ORDERS WITH RESULTS ───────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Visits'], summary: 'Get lab orders with full results (Doctor polling)',
    method: 'get', path: '/:visitId/lab-orders/results',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    request: { params: z.object({ visitId: z.string().uuid() }) },
    responses: {
      200: { content: { 'application/json': { schema: successData } }, description: 'Lab orders with results' },
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

      const visitRow = await db.select({ patientId: visits.patientId, institutionId: visits.institutionId }).from(visits).where(eq(visits.id, visitId)).limit(1);
      if (!visitRow.length) return c.json({ success: false, error: { message: 'Visit not found' } }, 404);
      const patient = await db.select({ blockchainAddress: patients.blockchainAddress }).from(patients).where(eq(patients.id, visitRow[0].patientId)).limit(1);
      if (!patient.length) return c.json({ success: false, error: { message: 'Patient not found' } }, 404);

      const canAct = await canActOnVisit(userId, visitRow[0].institutionId);
      if (!canAct) {
        const access = await resolveAccess(userId, visitRow[0].institutionId, c.get('blockchainAddress'), patient[0].blockchainAddress);
        if (!access.granted) {
          await auditAction(userId, userType, visitRow[0].patientId, patient[0].blockchainAddress, 'view', 'lab_results_poll', visitId, ip);
          return c.json({ success: false, error: { message: 'No access. Request blockchain permission from the patient.' } }, 403);
        }
      }

      const labOrdersWithResults = await db.select({
        id: labTestOrders.id, orderNumber: labTestOrders.orderNumber, testName: labTestOrders.testName,
        testCode: labTestOrders.testCode, specimenType: labTestOrders.specimenType, urgency: labTestOrders.urgency,
        clinicalNotes: labTestOrders.clinicalNotes, status: labTestOrders.status, orderedAt: labTestOrders.orderedAt,
        assignedTo: labTestOrders.assignedTo, abnormalFindings: labTestResults.abnormalFindings,
        interpretation: labTestResults.interpretation, resultedAt: labTestResults.resultedAt,
        resultsData: labTestResults.resultsData, referenceRanges: labTestResults.referenceRanges,
      }).from(labTestOrders).leftJoin(labTestResults, eq(labTestResults.labTestOrderId, labTestOrders.id))
        .where(eq(labTestOrders.visitId, visitId)).orderBy(desc(labTestOrders.orderedAt));

      const { decrypt } = await import('../services/crypto');
      const labOrders = await Promise.all(labOrdersWithResults.map(async (order) => {
        let assignedToName = null;
        if (order.assignedTo) {
          const tech = await db.select({ firstNameEncrypted: practitioners.firstNameEncrypted, lastNameEncrypted: practitioners.lastNameEncrypted }).from(practitioners).where(eq(practitioners.id, order.assignedTo)).limit(1);
          if (tech.length) assignedToName = `${await decrypt(tech[0].firstNameEncrypted)} ${await decrypt(tech[0].lastNameEncrypted)}`;
        }
        return {
          id: order.id, orderNumber: order.orderNumber, testName: order.testName, testCode: order.testCode,
          specimenType: order.specimenType, urgency: order.urgency, clinicalNotes: order.clinicalNotes,
          status: order.status, orderedAt: order.orderedAt, assignedToName,
          result: order.status === 'resulted' ? { abnormalFindings: order.abnormalFindings, interpretation: order.interpretation, performedAt: order.resultedAt, resultsData: order.resultsData, referenceRanges: order.referenceRanges } : null,
        };
      }));

      return c.json({ success: true, data: { labOrders } });
    } catch (err: any) {
      return handleError(err, c);
    }
  })

  // ── ASSIGNED TO ME — single registration, role-branched ──────────────────
  //

  //
  .openapi(createRoute({
    tags: ['Visits'], summary: 'Get all in-progress visits assigned to the current user (nurse or doctor)',
    method: 'get', path: '/assigned-to-me',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    responses: {
      200: { content: { 'application/json': { schema: successData } }, description: 'Assigned visits' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userId = c.get('userId');
      if (!userId) return c.json({ success: false, error: { message: 'User ID not found' } }, 401);

      const staff = await db
        .select({ role: practitioners.role, institutionId: practitioners.institutionId })
        .from(practitioners)
        .where(eq(practitioners.id, userId))
        .limit(1);

      if (!staff.length)
        return c.json({ success: false, error: { message: 'User not found in staff records' } }, 403);

      const { role, institutionId } = staff[0];

      if (!['nurse', 'practitioner', 'admin'].includes(role))
        return c.json({ success: false, error: { message: 'Access denied — nurses and doctors only' } }, 403);

      const { decrypt } = await import('../services/crypto');

      if (role === 'nurse') {
        const rows = await db.execute(sql`
          SELECT
            v.id,
            v.visit_number          AS "visitNumber",
            v.patient_id            AS "patientId",
            v.chief_complaint       AS "chiefComplaint",
            v.priority,
            v.status,
            v.admission_date        AS "admissionDate",
            v.ward_or_room          AS "wardOrRoom",
            v.assigned_doctor_id    AS "assignedDoctorId",
            v.assigned_nurse_id     AS "assignedNurseId",
            p.first_name_encrypted  AS "patientFirstNameEncrypted",
            p.last_name_encrypted   AS "patientLastNameEncrypted",
            p.gender,
            p.blood_type            AS "bloodType",
            doc.first_name_encrypted AS "doctorFirstNameEncrypted",
            doc.last_name_encrypted  AS "doctorLastNameEncrypted",
            EXISTS (
              SELECT 1 FROM vital_signs vs WHERE vs.visit_id = v.id LIMIT 1
            ) AS "hasVitals"
          FROM visits v
          JOIN patients p ON p.id = v.patient_id
          LEFT JOIN practitioners doc ON doc.id = v.assigned_doctor_id
          WHERE v.institution_id = ${institutionId}
            AND v.status = 'in-progress'
            AND (v.assigned_nurse_id = ${userId} OR v.assigned_nurse_id IS NULL)
          ORDER BY
            CASE v.priority WHEN 'critical' THEN 1 WHEN 'emergency' THEN 2 WHEN 'urgent' THEN 3 ELSE 4 END,
            v.admission_date ASC
        `);

        return c.json({
          success: true,
          data: (rows as any[]).map((row: any) => ({
            id: row.id, visitNumber: row.visitNumber, patientId: row.patientId,
            patientName: row.patientFirstNameEncrypted
              ? `${decrypt(row.patientFirstNameEncrypted)} ${decrypt(row.patientLastNameEncrypted)}`
              : 'Unknown Patient',
            gender: row.gender, bloodType: row.bloodType,
            chiefComplaint: row.chiefComplaint, priority: row.priority,
            status: row.status, admissionDate: row.admissionDate,
            wardOrRoom: row.wardOrRoom ?? null,
            assignedDoctorId: row.assignedDoctorId ?? null,
            assignedNurseId: row.assignedNurseId ?? null,
            doctorName: row.doctorFirstNameEncrypted
              ? `${decrypt(row.doctorFirstNameEncrypted)} ${decrypt(row.doctorLastNameEncrypted)}`
              : null,
            hasVitals: row.hasVitals === true || row.hasVitals === 't',
            role: 'nurse',
          })),
        });

      } else if (role === 'practitioner') {
        const rows = await db.execute(sql`
          SELECT
            v.id,
            v.visit_number          AS "visitNumber",
            v.patient_id            AS "patientId",
            v.chief_complaint       AS "chiefComplaint",
            v.admitting_diagnosis   AS "admittingDiagnosis",
            v.priority,
            v.status,
            v.admission_date        AS "admissionDate",
            v.ward_or_room          AS "wardOrRoom",
            v.assigned_nurse_id     AS "assignedNurseId",
            p.first_name_encrypted  AS "patientFirstNameEncrypted",
            p.last_name_encrypted   AS "patientLastNameEncrypted",
            p.gender,
            p.blood_type            AS "bloodType",
            nur.first_name_encrypted AS "nurseFirstNameEncrypted",
            nur.last_name_encrypted  AS "nurseLastNameEncrypted",
            EXISTS (
              SELECT 1 FROM vital_signs vs WHERE vs.visit_id = v.id LIMIT 1
            ) AS "hasVitals",
            EXISTS (
              SELECT 1 FROM consultations c WHERE c.visit_id = v.id LIMIT 1
            ) AS "hasConsultation",
            (SELECT COUNT(*) FROM lab_test_orders lo WHERE lo.visit_id = v.id AND lo.status != 'resulted') AS "pendingLabCount",
            (SELECT COUNT(*) FROM imaging_orders io WHERE io.visit_id = v.id AND io.status NOT IN ('reported', 'cancelled')) AS "pendingImagingCount"
          FROM visits v
          JOIN patients p ON p.id = v.patient_id
          LEFT JOIN practitioners nur ON nur.id = v.assigned_nurse_id
          WHERE v.institution_id = ${institutionId}
            AND v.status = 'in-progress'
            AND (v.assigned_doctor_id = ${userId} OR v.assigned_doctor_id IS NULL)
          ORDER BY
            CASE v.priority WHEN 'critical' THEN 1 WHEN 'emergency' THEN 2 WHEN 'urgent' THEN 3 ELSE 4 END,
            v.admission_date ASC
        `);

        return c.json({
          success: true,
          data: (rows as any[]).map((row: any) => ({
            id: row.id, visitNumber: row.visitNumber, patientId: row.patientId,
            patientName: row.patientFirstNameEncrypted
              ? `${decrypt(row.patientFirstNameEncrypted)} ${decrypt(row.patientLastNameEncrypted)}`
              : 'Unknown Patient',
            gender: row.gender, bloodType: row.bloodType,
            chiefComplaint: row.chiefComplaint, admittingDiagnosis: row.admittingDiagnosis ?? null,
            priority: row.priority, status: row.status, admissionDate: row.admissionDate,
            wardOrRoom: row.wardOrRoom ?? null, assignedNurseId: row.assignedNurseId ?? null,
            nurseName: row.nurseFirstNameEncrypted
              ? `${decrypt(row.nurseFirstNameEncrypted)} ${decrypt(row.nurseLastNameEncrypted)}`
              : null,
            hasVitals: row.hasVitals === true || row.hasVitals === 't',
            hasConsultation: row.hasConsultation === true || row.hasConsultation === 't',
            pendingLabCount: Number(row.pendingLabCount ?? 0),
            pendingImagingCount: Number(row.pendingImagingCount ?? 0),
            role: 'practitioner',
          })),
        });

      } else {
        // Admin — all active visits at their institution
        const rows = await db.execute(sql`
          SELECT
            v.id,
            v.visit_number          AS "visitNumber",
            v.patient_id            AS "patientId",
            v.chief_complaint       AS "chiefComplaint",
            v.priority,
            v.status,
            v.admission_date        AS "admissionDate",
            v.ward_or_room          AS "wardOrRoom",
            p.first_name_encrypted  AS "patientFirstNameEncrypted",
            p.last_name_encrypted   AS "patientLastNameEncrypted",
            p.gender,
            nur.first_name_encrypted AS "nurseFirstNameEncrypted",
            nur.last_name_encrypted  AS "nurseLastNameEncrypted",
            doc.first_name_encrypted AS "doctorFirstNameEncrypted",
            doc.last_name_encrypted  AS "doctorLastNameEncrypted",
            EXISTS (
              SELECT 1 FROM vital_signs vs WHERE vs.visit_id = v.id LIMIT 1
            ) AS "hasVitals"
          FROM visits v
          JOIN patients p ON p.id = v.patient_id
          LEFT JOIN practitioners nur ON nur.id = v.assigned_nurse_id
          LEFT JOIN practitioners doc ON doc.id = v.assigned_doctor_id
          WHERE v.institution_id = ${institutionId}
            AND v.status = 'in-progress'
          ORDER BY
            CASE v.priority WHEN 'critical' THEN 1 WHEN 'emergency' THEN 2 WHEN 'urgent' THEN 3 ELSE 4 END,
            v.admission_date ASC
        `);

        return c.json({
          success: true,
          data: (rows as any[]).map((row: any) => ({
            id: row.id, visitNumber: row.visitNumber, patientId: row.patientId,
            patientName: row.patientFirstNameEncrypted
              ? `${decrypt(row.patientFirstNameEncrypted)} ${decrypt(row.patientLastNameEncrypted)}`
              : 'Unknown Patient',
            gender: row.gender, chiefComplaint: row.chiefComplaint,
            priority: row.priority, status: row.status, admissionDate: row.admissionDate,
            wardOrRoom: row.wardOrRoom ?? null,
            nurseName: row.nurseFirstNameEncrypted
              ? `${decrypt(row.nurseFirstNameEncrypted)} ${decrypt(row.nurseLastNameEncrypted)}`
              : null,
            doctorName: row.doctorFirstNameEncrypted
              ? `${decrypt(row.doctorFirstNameEncrypted)} ${decrypt(row.doctorLastNameEncrypted)}`
              : null,
            hasVitals: row.hasVitals === true || row.hasVitals === 't',
            role: 'admin',
          })),
        });
      }

    } catch (err: any) {
      console.error('assigned-to-me error:', err);
      return handleError(err, c);
    }
  })

  // ── PENDING IMAGING ORDERS ────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Visits'], summary: 'Get all pending imaging orders (Radiologist)',
    method: 'get', path: '/imaging-orders/pending',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    responses: {
      200: { content: { 'application/json': { schema: successData } }, description: 'Pending imaging orders' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Access denied' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      const userId = c.get('userId');
      if (userType !== 'radiologist' && userType !== 'admin') return c.json({ success: false, error: { message: 'Access denied' } }, 403);
      const staffInstitutionId = await getStaffInstitution(userId);
      const institutionFilter = (userType === 'admin' && !staffInstitutionId) ? undefined : eq(visits.institutionId, staffInstitutionId);
      const { decrypt } = await import('../services/crypto');
      const orders = await db.select({
        id: imagingOrders.id, orderNumber: imagingOrders.orderNumber, visitId: imagingOrders.visitId, patientId: imagingOrders.patientId,
        modality: imagingOrders.modality, bodyPart: imagingOrders.bodyPart, indication: imagingOrders.indication,
        urgency: imagingOrders.urgency, status: imagingOrders.status, orderedAt: imagingOrders.orderedAt,
        visitNumber: visits.visitNumber, chiefComplaint: visits.chiefComplaint,
        patientFirstNameEncrypted: patients.firstNameEncrypted, patientLastNameEncrypted: patients.lastNameEncrypted,
      }).from(imagingOrders)
        .leftJoin(visits, eq(visits.id, imagingOrders.visitId))
        .leftJoin(patients, eq(patients.id, imagingOrders.patientId))
        .where(and(ne(imagingOrders.status, 'reported'), ne(imagingOrders.status, 'cancelled'), institutionFilter))
        .orderBy(desc(imagingOrders.orderedAt));
      const ordersWithNames = await Promise.all(orders.map(async (o) => ({
        ...o, patientName: o.patientFirstNameEncrypted && o.patientLastNameEncrypted
          ? `${await decrypt(o.patientFirstNameEncrypted)} ${await decrypt(o.patientLastNameEncrypted)}` : 'Unknown',
      })));
      return c.json({ success: true, data: { orders: ordersWithNames } });
    } catch (err: any) {
      return handleError(err, c);
    }
  })

  // ── IMAGING REPORT ────────────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Visits'], summary: 'Get imaging report for an order',
    method: 'get', path: '/imaging-orders/:orderId/report',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    request: { params: z.object({ orderId: z.string().uuid() }) },
    responses: { 200: { content: { 'application/json': { schema: successData } }, description: 'Report' } },
  }), async (c) => {
    const { orderId } = c.req.valid('param');
    const report = await db.select().from(imagingReports).where(eq(imagingReports.imagingOrderId, orderId)).limit(1);
    return c.json({ success: true, data: report[0] || null });
  })

  // ── SUBMIT RADIOLOGY REPORT ───────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Visits'], summary: 'Submit radiology report with images',
    method: 'post', path: '/:visitId/imaging-report/:orderId',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    request: { params: z.object({ visitId: z.string().uuid(), orderId: z.string().uuid() }) },
    responses: {
      201: { content: { 'application/json': { schema: successData } }, description: 'Report submitted' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Order not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      if (userType !== 'radiologist') return c.json({ success: false, error: { message: 'Only radiologists can submit reports' } }, 403);
      const { visitId, orderId } = c.req.valid('param');
      const userId = c.get('userId');
      const ip = c.req.header('x-forwarded-for');

      const order = await db.select().from(imagingOrders).where(eq(imagingOrders.id, orderId)).limit(1);
      if (!order.length) return c.json({ success: false, error: { message: 'Imaging order not found' } }, 404);
      const visitRow = await db.select({ institutionId: visits.institutionId, status: visits.status, patientId: visits.patientId }).from(visits).where(eq(visits.id, visitId)).limit(1);
      if (!visitRow.length) return c.json({ success: false, error: { message: 'Visit not found' } }, 404);
      const patient = await db.select({ blockchainAddress: patients.blockchainAddress }).from(patients).where(eq(patients.id, visitRow[0].patientId)).limit(1);
      if (!patient.length) return c.json({ success: false, error: { message: 'Patient not found' } }, 404);

      const canAct = await canActOnVisit(userId, visitRow[0].institutionId);
      if (!canAct) return c.json({ success: false, error: { message: 'You can only perform clinical actions on visits created by your institution.' } }, 403);

      const body = await c.req.parseBody();
      const findings = body['findings']?.toString() || '';
      const impression = body['impression']?.toString() || '';
      const recommendations = body['recommendations']?.toString() || '';
      const files = body['images'];
      let fileArray: File[] = [];
      if (files && typeof files !== 'string') fileArray = Array.isArray(files) ? files : [files];

      const imageUrls: string[] = [];
      if (fileArray.length > 0) {
        const uploadDir = path.join(process.cwd(), 'uploads', 'radiology');
        await mkdir(uploadDir, { recursive: true });
        for (const file of fileArray) {
          const ext = path.extname(file.name);
          const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
          const buffer = Buffer.from(await file.arrayBuffer());
          await writeFile(path.join(uploadDir, filename), buffer);
          const hash = createHash('sha256').update(buffer).digest('hex');
          await storeRecordHash(`${orderId}:image:${hash.slice(0, 8)}`, patient[0].blockchainAddress, hash, 'imaging_image');
            // Points at the authenticated route, not the old public /uploads
            // path. Rows written before this change still resolve: clients take
            // the basename and request /api/files/radiology/<name>, so both URL
            // shapes work without a data migration.
          imageUrls.push(`${(process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')}/api/files/radiology/${filename}`);
        }
      }

      const existing = await db.select().from(imagingReports).where(eq(imagingReports.imagingOrderId, orderId)).limit(1);
      let reportId: string;
      if (existing.length) {
        const newUrls = [...((existing[0].imageUrls as string[]) || []), ...imageUrls];
        const reportHash = generateRecordHash({ orderId, findings, impression, imageUrls: newUrls, updatedBy: userId, timestamp: new Date().toISOString() });
        await db.update(imagingReports).set({ findings, impression, recommendations: recommendations || null, imageUrls: newUrls, blockchainHash: reportHash, updatedAt: new Date() }).where(eq(imagingReports.imagingOrderId, orderId));
        reportId = existing[0].id;
      } else {
        const reportHash = generateRecordHash({ orderId, findings, impression, imageUrls, radiologistId: userId, timestamp: new Date().toISOString() });
        const result = await db.insert(imagingReports).values({ imagingOrderId: orderId, performedByRadiologistId: userId, findings, impression, recommendations: recommendations || null, imageUrls, blockchainHash: reportHash }).returning();
        reportId = result[0].id;
      }

      await db.update(imagingOrders).set({ status: 'reported' }).where(eq(imagingOrders.id, orderId));
      await auditAction(userId, userType, visitRow[0].patientId, patient[0].blockchainAddress, 'create', 'imaging_report', reportId, ip);
      try {
        const [visit] = await db.select({ doctorId: visits.assignedDoctorId }).from(visits).where(eq(visits.id, visitId)).limit(1);
        if (visit?.doctorId) notifyUser(visit.doctorId, 'imaging_result_ready', {
          visitId, orderId, orderNumber: order[0].orderNumber,
          modality: order[0].modality, bodyPart: order[0].bodyPart,
        });
      } catch { console.warn('[IMAGING_NOTIFICATION] Delivery failed'); }
      return c.json({ success: true, data: { reportId, imageUrls } }, 201);
    } catch (err: any) {
      return handleError(err, c);
    }
  })

  // ── UPLOAD IMAGING IMAGES ─────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Visits'], summary: 'Upload images for an imaging order (Radiologist)',
    method: 'post', path: '/:visitId/imaging-orders/:orderId/images',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    request: { params: z.object({ visitId: z.string().uuid(), orderId: z.string().uuid() }) },
    responses: {
      201: { content: { 'application/json': { schema: successData } }, description: 'Images uploaded' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Order not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      if (userType !== 'radiologist') return c.json({ success: false, error: { message: 'Only radiologists can upload images' } }, 403);
      const { visitId, orderId } = c.req.valid('param');
      const userId = c.get('userId');
      const ip = c.req.header('x-forwarded-for');

      const order = await db.select().from(imagingOrders).where(eq(imagingOrders.id, orderId)).limit(1);
      if (!order.length) return c.json({ success: false, error: { message: 'Imaging order not found' } }, 404);
      const visitRow = await db.select({ institutionId: visits.institutionId, status: visits.status, patientId: visits.patientId }).from(visits).where(eq(visits.id, visitId)).limit(1);
      if (!visitRow.length) return c.json({ success: false, error: { message: 'Visit not found' } }, 404);
      const patient = await db.select({ blockchainAddress: patients.blockchainAddress }).from(patients).where(eq(patients.id, visitRow[0].patientId)).limit(1);
      if (!patient.length) return c.json({ success: false, error: { message: 'Patient not found' } }, 404);

      const canAct = await canActOnVisit(userId, visitRow[0].institutionId);
      if (!canAct) return c.json({ success: false, error: { message: 'You can only perform clinical actions on visits created by your institution.' } }, 403);

      const body = await c.req.parseBody();
      const files = body['images'];
      let fileArray: File[] = [];
      if (files && typeof files !== 'string') fileArray = Array.isArray(files) ? files : [files];
      if (fileArray.length === 0) return c.json({ success: false, error: { message: 'No image files uploaded' } }, 400);

      const uploadDir = path.join(process.cwd(), 'uploads', 'radiology');
      await mkdir(uploadDir, { recursive: true });
      const imageUrls: string[] = [];
      const hashes: string[] = [];
      for (const file of fileArray) {
        const ext = path.extname(file.name);
        const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
        const buffer = Buffer.from(await file.arrayBuffer());
        await writeFile(path.join(uploadDir, filename), buffer);
        hashes.push(createHash('sha256').update(buffer).digest('hex'));
        imageUrls.push(`${process.env.BASE_URL || 'http://localhost:3000'}/api/files/radiology/${filename}`);
      }

      const existing = await db.select().from(imagingReports).where(eq(imagingReports.imagingOrderId, orderId)).limit(1);
      let reportId: string;
      if (existing.length) {
        const newUrls = [...((existing[0].imageUrls as string[]) || []), ...imageUrls];
        await db.update(imagingReports).set({ imageUrls: newUrls, updatedAt: new Date() }).where(eq(imagingReports.imagingOrderId, orderId));
        reportId = existing[0].id;
      } else {
        const reportHash = generateRecordHash({ orderId, imageUrls, uploadedBy: userId, timestamp: new Date().toISOString() });
        const result = await db.insert(imagingReports).values({ imagingOrderId: orderId, performedByRadiologistId: userId, findings: '', impression: '', imageUrls, blockchainHash: reportHash }).returning();
        reportId = result[0].id;
      }

      for (const hash of hashes) await storeRecordHash(`${orderId}:image:${hash.slice(0, 8)}`, patient[0].blockchainAddress, hash, 'imaging_image');
      await auditAction(userId, userType, visitRow[0].patientId, patient[0].blockchainAddress, 'create', 'imaging_image', reportId, ip);
      return c.json({ success: true, data: { imageUrls, reportId } }, 201);
    } catch (err: any) {
      return handleError(err, c);
    }
  })

  // ── CREATE PRESCRIPTION ───────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Visits'], summary: 'Create prescription (Practitioner)',
    method: 'post', path: '/:visitId/prescriptions',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    request: {
      params: z.object({ visitId: z.string().uuid() }),
      body: {
        content: {
          'application/json': {
            schema: z.object({
              medications: z.array(z.object({
                medicationName: z.string(), genericName: z.string().optional(), strength: z.string(),
                dosageForm: z.enum(['tablet', 'capsule', 'syrup', 'injection', 'cream', 'ointment', 'drops', 'inhaler', 'suppository']),
                dose: z.string(), frequency: z.enum(['once_daily', 'twice_daily', 'three_times_daily', 'four_times_daily', 'every_4_hours', 'every_6_hours', 'every_8_hours', 'as_needed', 'stat']),
                route: z.enum(['oral', 'intravenous', 'intramuscular', 'subcutaneous', 'topical', 'inhalation', 'rectal', 'sublingual']),
                duration: z.string(), quantity: z.number().int().positive(), instructions: z.string().optional(), refillsAllowed: z.number().int().min(0).default(0),
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
      if (userType !== 'practitioner') return c.json({ success: false, error: { message: 'Only practitioners can prescribe medications' } }, 403);
      const { visitId } = c.req.valid('param');
      const body = c.req.valid('json');
      const userId = c.get('userId');
      const ip = c.req.header('x-forwarded-for');

      const visitRow = await db.select({ institutionId: visits.institutionId, status: visits.status, patientId: visits.patientId }).from(visits).where(eq(visits.id, visitId)).limit(1);
      if (!visitRow.length) return c.json({ success: false, error: { message: 'Visit not found' } }, 404);
      const patient = await db.select({ blockchainAddress: patients.blockchainAddress }).from(patients).where(eq(patients.id, visitRow[0].patientId)).limit(1);
      if (!patient.length) return c.json({ success: false, error: { message: 'Patient not found' } }, 404);

      const canAct = await canActOnVisit(userId, visitRow[0].institutionId);
      if (!canAct) {
        await auditAction(userId, userType, visitRow[0].patientId, patient[0].blockchainAddress, 'view', 'prescription', visitId, ip);
        return c.json({ success: false, error: { message: 'You can only perform clinical actions on visits created by your institution.' } }, 403);
      }

      const prescriptionNumber = `RX-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      const prescriptionHash = generateRecordHash({ visitId, prescriptionNumber, medications: body.medications, practitionerId: userId, timestamp: new Date().toISOString() });
      const prescription = await db.insert(prescriptions).values({ prescriptionNumber, visitId, patientId: visitRow[0].patientId, prescribedByPractitionerId: userId, status: 'prescribed', blockchainHash: prescriptionHash }).returning();
      await storeRecordHash(prescription[0].id, patient[0].blockchainAddress, prescriptionHash, 'prescription');

      const items = await db.insert(prescriptionItems).values(
        body.medications.map(med => ({
          prescriptionId: prescription[0].id, medicationName: med.medicationName, genericName: med.genericName ?? null,
          strength: med.strength, dosageForm: med.dosageForm, dose: med.dose, frequency: med.frequency, route: med.route,
          duration: med.duration, quantity: med.quantity, instructions: med.instructions ?? null, refillsAllowed: med.refillsAllowed, isDispensed: false,
        }))
      ).returning();

      await auditAction(userId, userType, visitRow[0].patientId, patient[0].blockchainAddress, 'create', 'prescription', prescription[0].id, ip);
      return c.json({ success: true, data: { prescription: prescription[0], items, blockchainHash: prescriptionHash } }, 201);
    } catch (err: any) {
      console.error(err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })



  .openapi(createRoute({
    tags: ['Visits'], summary: 'Dispense prescription items (Pharmacist) — auto-deducts stock',
    method: 'patch', path: '/:visitId/prescriptions/:prescriptionId/dispense',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    request: {
      params: z.object({ visitId: z.string().uuid(), prescriptionId: z.string().uuid() }),
      body: { content: { 'application/json': { schema: z.object({ itemIds: z.array(z.string().uuid()), dispensingNotes: z.string().optional() }) } } },
    },
    responses: {
      200: { content: { 'application/json': { schema: successData } }, description: 'Dispensed' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
      409: { content: { 'application/json': { schema: errorSchema } }, description: 'Insufficient stock' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      if (userType !== 'pharmacist') return c.json({ success: false, error: { message: 'Only pharmacists can dispense medications' } }, 403);
      const { visitId, prescriptionId } = c.req.valid('param');
      const { itemIds } = c.req.valid('json');
      const userId = c.get('userId');
      const ip = c.req.header('x-forwarded-for');

      const prescription = await db.select().from(prescriptions).where(eq(prescriptions.id, prescriptionId)).limit(1);
      if (!prescription.length) return c.json({ success: false, error: { message: 'Prescription not found' } }, 404);
      const visitRow = await db.select({ institutionId: visits.institutionId, status: visits.status, patientId: visits.patientId }).from(visits).where(eq(visits.id, visitId)).limit(1);
      if (!visitRow.length) return c.json({ success: false, error: { message: 'Visit not found' } }, 404);
      const patient = await db.select({ blockchainAddress: patients.blockchainAddress }).from(patients).where(eq(patients.id, visitRow[0].patientId)).limit(1);
      if (!patient.length) return c.json({ success: false, error: { message: 'Patient not found' } }, 404);

      const canAct = await canActOnVisit(userId, visitRow[0].institutionId);
      if (!canAct) return c.json({ success: false, error: { message: 'You can only perform clinical actions on visits created by your institution.' } }, 403);

      const institutionId = visitRow[0].institutionId;

      // ── Load the prescription items being dispensed ──────────────────────
      const itemsToDispense = await db.select().from(prescriptionItems)
        .where(and(eq(prescriptionItems.prescriptionId, prescriptionId)));
      const selectedItems = itemsToDispense.filter(i => itemIds.includes(i.id));

      // ── Stock check + deduction (best-effort match by name + strength) ───
      const stockWarnings: string[] = [];
      if (institutionId) {
        for (const item of selectedItems) {
          // Find matching stock by medication name + strength (case-insensitive)
          const matches = await db.select().from(medicationStock)
            .where(and(
              eq(medicationStock.institutionId, institutionId),
              sql`LOWER(${medicationStock.medicationName}) = LOWER(${item.medicationName})`,
              sql`LOWER(${medicationStock.strength}) = LOWER(${item.strength})`,
            ))
            .orderBy(medicationStock.expiryDate)  // dispense soonest-expiring first
            .limit(1);

          if (matches.length === 0) {
            stockWarnings.push(`${item.medicationName} ${item.strength}: not tracked in stock`);
            continue;
          }

          const stock = matches[0];
          const need = item.quantity ?? 0;

          if (stock.quantity < need) {
            stockWarnings.push(`${item.medicationName} ${item.strength}: only ${stock.quantity} in stock (needed ${need})`);
            // Deduct what's available, floor at 0
          }

          const deduct = Math.min(stock.quantity, need);
          const newQty = stock.quantity - deduct;

          await db.update(medicationStock).set({ quantity: newQty, updatedAt: new Date() }).where(eq(medicationStock.id, stock.id));
          await db.insert(stockMovements).values({
            stockId: stock.id, institutionId, changeType: 'dispense',
            quantityChange: -deduct, quantityAfter: newQty,
            referenceId: prescriptionId, performedBy: userId,
            notes: `Dispensed for prescription ${prescription[0].prescriptionNumber}`,
          });
        }
      }

      // ── Mark items dispensed + blockchain hash ───────────────────────────
      const dispenseHash = generateRecordHash({ prescriptionId, itemIds, dispensedBy: userId, timestamp: new Date().toISOString() });
      for (const itemId of itemIds) {
        await db.update(prescriptionItems).set({ isDispensed: true, dispensedByPharmacistId: userId, dispensedAt: new Date() }).where(eq(prescriptionItems.id, itemId));
        await storeRecordHash(itemId, patient[0].blockchainAddress, dispenseHash, 'prescription_dispense');
      }

      const remaining = await db.select().from(prescriptionItems).where(and(eq(prescriptionItems.prescriptionId, prescriptionId), eq(prescriptionItems.isDispensed, false)));
      const newStatus = remaining.length === 0 ? 'dispensed' : 'dispensing';
      await db.update(prescriptions).set({ status: newStatus }).where(eq(prescriptions.id, prescriptionId));
      await auditAction(userId, userType, visitRow[0].patientId, patient[0].blockchainAddress, 'update', 'prescription_dispense', prescriptionId, ip);

      return c.json({
        success: true,
        data: {
          message: 'Medications dispensed',
          remainingItems: remaining.length,
          blockchainHash: dispenseHash,
          stockWarnings,   // frontend can show these as soft warnings
        },
      });
    } catch (err: any) {
      console.error('[DISPENSE]', err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ── ORDER LAB TESTS ───────────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Visits'], summary: 'Order lab tests for a patient (Practitioner)',
    method: 'post', path: '/:visitId/lab-orders',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    request: {
      params: z.object({ visitId: z.string().uuid() }),
      body: {
        content: {
          'application/json': {
            schema: z.object({
              tests: z.array(z.object({
                testName: z.string(), testCode: z.string(),
                specimenType: z.enum(['blood', 'urine', 'stool', 'sputum', 'csf', 'tissue', 'swab', 'other']),
                urgency: z.enum(['routine', 'urgent', 'emergency', 'critical']).default('routine'),
                // When nobody is online, leave this unset.  The order is then
                // offered to every laboratory technician at this institution.
                clinicalNotes: z.string().optional(), assignedTo: z.string().uuid().optional(),
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
      if (userType !== 'practitioner') return c.json({ success: false, error: { message: 'Only practitioners can order lab tests' } }, 403);
      const { visitId } = c.req.valid('param');
      const body = c.req.valid('json');
      const userId = c.get('userId');
      const ip = c.req.header('x-forwarded-for');

      const visitRow = await db.select({ institutionId: visits.institutionId, status: visits.status, patientId: visits.patientId }).from(visits).where(eq(visits.id, visitId)).limit(1);
      if (!visitRow.length) return c.json({ success: false, error: { message: 'Visit not found' } }, 404);
      const patient = await db.select({ blockchainAddress: patients.blockchainAddress }).from(patients).where(eq(patients.id, visitRow[0].patientId)).limit(1);
      if (!patient.length) return c.json({ success: false, error: { message: 'Patient not found' } }, 404);

      const canAct = await canActOnVisit(userId, visitRow[0].institutionId);
      if (!canAct) return c.json({ success: false, error: { message: 'You can only perform clinical actions on visits created by your institution.' } }, 403);

      const createdOrders = [];
      for (const test of body.tests) {
        if (test.assignedTo) {
          const tech = await db.select({ id: practitioners.id }).from(practitioners)
            .where(and(eq(practitioners.id, test.assignedTo), eq(practitioners.role, 'lab_technician'), eq(practitioners.institutionId, visitRow[0].institutionId)))
            .limit(1);
          if (!tech.length) return c.json({ success: false, error: { message: 'Lab technician not found in this institution' } }, 400);
        }

        const orderNumber = `LAB-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
        const orderHash = generateRecordHash({ visitId, orderNumber, ...test, practitionerId: userId, timestamp: new Date().toISOString() });
        const result = await db.insert(labTestOrders).values({ orderNumber, visitId, patientId: visitRow[0].patientId, orderedByPractitionerId: userId, testName: test.testName, testCode: test.testCode, specimenType: test.specimenType, urgency: test.urgency, clinicalNotes: test.clinicalNotes ?? null, status: 'ordered', assignedTo: test.assignedTo ?? null, blockchainHash: orderHash }).returning();
        await storeRecordHash(result[0].id, patient[0].blockchainAddress, orderHash, 'lab_order');
        createdOrders.push(result[0]);
      }

      for (const order of createdOrders) await auditAction(userId, userType, visitRow[0].patientId, patient[0].blockchainAddress, 'create', 'lab_order', order.id, ip);
      return c.json({ success: true, data: { orders: createdOrders } }, 201);
    } catch (err: any) {
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ── ORDER IMAGING ─────────────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Visits'], summary: 'Order imaging study (Practitioner)',
    method: 'post', path: '/:visitId/imaging-orders',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    request: {
      params: z.object({ visitId: z.string().uuid() }),
      body: {
        content: {
          'application/json': {
            schema: z.object({
              modality: z.enum(['x-ray', 'ct_scan', 'mri', 'ultrasound', 'pet_scan', 'mammogram', 'fluoroscopy']),
              bodyPart: z.string(), indication: z.string(),
              urgency: z.enum(['routine', 'urgent', 'emergency', 'critical']).default('routine'),
              assignedTo: z.string().uuid(),
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
      if (userType !== 'practitioner') return c.json({ success: false, error: { message: 'Only practitioners can order imaging' } }, 403);
      const { visitId } = c.req.valid('param');
      const body = c.req.valid('json');
      const userId = c.get('userId');
      const ip = c.req.header('x-forwarded-for');

      const visitRow = await db.select({ institutionId: visits.institutionId, status: visits.status, patientId: visits.patientId }).from(visits).where(eq(visits.id, visitId)).limit(1);
      if (!visitRow.length) return c.json({ success: false, error: { message: 'Visit not found' } }, 404);
      const patient = await db.select({ blockchainAddress: patients.blockchainAddress }).from(patients).where(eq(patients.id, visitRow[0].patientId)).limit(1);
      if (!patient.length) return c.json({ success: false, error: { message: 'Patient not found' } }, 404);

      const canAct = await canActOnVisit(userId, visitRow[0].institutionId);
      if (!canAct) return c.json({ success: false, error: { message: 'You can only perform clinical actions on visits created by your institution.' } }, 403);

      const radiologist = await db.select({ id: practitioners.id }).from(practitioners)
        .where(and(eq(practitioners.id, body.assignedTo), eq(practitioners.role, 'radiologist'), eq(practitioners.institutionId, visitRow[0].institutionId)))
        .limit(1);
      if (!radiologist.length) return c.json({ success: false, error: { message: 'Radiologist not found in this institution' } }, 400);

      const orderNumber = `IMG-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
      const orderHash = generateRecordHash({ visitId, orderNumber, ...body, practitionerId: userId, timestamp: new Date().toISOString() });
      const result = await db.insert(imagingOrders).values({ orderNumber, visitId, patientId: visitRow[0].patientId, orderedByPractitionerId: userId, modality: body.modality, bodyPart: body.bodyPart, indication: body.indication, urgency: body.urgency, status: 'ordered', assignedTo: body.assignedTo, blockchainHash: orderHash }).returning();

      await storeRecordHash(result[0].id, patient[0].blockchainAddress, orderHash, 'imaging_order');
      await auditAction(userId, userType, visitRow[0].patientId, patient[0].blockchainAddress, 'create', 'imaging_order', result[0].id, ip);
      return c.json({ success: true, data: { order: result[0], blockchainHash: orderHash } }, 201);
    } catch (err: any) {
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ── ADMIT TO WARD ─────────────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Visits'], summary: 'Doctor admits patient to ward (changes visit to inpatient)',
    method: 'patch', path: '/:visitId/admit',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    request: {
      params: z.object({ visitId: z.string().uuid() }),
      body: {
        content: {
          'application/json': {
            schema: z.object({
              admittingDiagnosis: z.string().min(3),
              priority: z.enum(['routine', 'urgent', 'emergency', 'critical']).optional(),
              notes: z.string().optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: { content: { 'application/json': { schema: successData } }, description: 'Patient admitted' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Visit not found' },
      409: { content: { 'application/json': { schema: errorSchema } }, description: 'Already admitted' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      if (userType !== 'practitioner')
        return c.json({ success: false, error: { message: 'Only practitioners can admit patients' } }, 403);

      const { visitId } = c.req.valid('param');
      const body = c.req.valid('json');

      const visitRow = await db.select({
        status: visits.status, visitType: visits.visitType,
        patientId: visits.patientId, institutionId: visits.institutionId,
        visitNumber: visits.visitNumber, priority: visits.priority,
      }).from(visits).where(eq(visits.id, visitId)).limit(1);

      if (!visitRow.length)
        return c.json({ success: false, error: { message: 'Visit not found' } }, 404);
      if (visitRow[0].status !== 'in-progress')
        return c.json({ success: false, error: { message: 'Visit is already closed' } }, 409);
      if (visitRow[0].visitType === 'inpatient')
        return c.json({ success: false, error: { message: 'Patient is already admitted as inpatient' } }, 409);

      const updateData: Record<string, unknown> = {
        visitType: 'inpatient',
        admittingDiagnosis: body.admittingDiagnosis,
        updatedAt: new Date(),
      };
      if (body.priority) updateData.priority = body.priority;

      await db.update(visits).set(updateData).where(eq(visits.id, visitId));

      const userId = c.get('userId');
      const ip = c.req.header('x-forwarded-for');
      const patient = await db.select({ blockchainAddress: patients.blockchainAddress })
        .from(patients).where(eq(patients.id, visitRow[0].patientId)).limit(1);
      if (patient.length) {
        await auditAction(userId, 'practitioner', visitRow[0].patientId, patient[0].blockchainAddress, 'update', 'admit', visitId, ip)
          .catch(() => {});
      }

      // Notify all active nurses at the institution
      try {
        const { decrypt } = await import('../services/crypto');
        const patientDetails = await db.select({
          firstNameEncrypted: patients.firstNameEncrypted,
          lastNameEncrypted: patients.lastNameEncrypted,
        }).from(patients).where(eq(patients.id, visitRow[0].patientId)).limit(1);

        const patientName = patientDetails.length
          ? `${decrypt(patientDetails[0].firstNameEncrypted)} ${decrypt(patientDetails[0].lastNameEncrypted)}`
          : 'Unknown Patient';

        const nurses = await db.select({ id: practitioners.id })
          .from(practitioners)
          .where(and(
            eq(practitioners.institutionId, visitRow[0].institutionId!),
            eq(practitioners.role, 'nurse'),
            eq(practitioners.isActive, true),
          ));

        for (const nurse of nurses) {
          notifyUser(nurse.id, 'patient_admitted', {
            visitId,
            visitNumber: visitRow[0].visitNumber,
            patientName,
            admittingDiagnosis: body.admittingDiagnosis,
            priority: body.priority ?? visitRow[0].priority,
            ts: new Date().toISOString(),
          });
        }
      } catch (notifyErr) {
        console.warn('[ADMIT] Failed to notify nurses:', notifyErr);
      }

      return c.json({ success: true, data: { message: 'Patient admitted to ward. Assign a bed from the ward view.' } });
    } catch (err: unknown) {
      console.error('Admit error:', err);
      return handleError(err, c);
    }
  })

  // ── DISCHARGE ─────────────────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Visits'], summary: 'Discharge patient and close visit (Practitioner)',
    method: 'patch', path: '/:visitId/discharge',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    request: {
      params: z.object({ visitId: z.string().uuid() }),
      body: {
        content: {
          'application/json': {
            schema: z.object({
              dischargeDiagnosis: z.string(), dischargeSummary: z.string(),
              dischargeInstructions: z.string(), followUpDate: z.string().datetime().optional(),
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
      if (userType !== 'practitioner') return c.json({ success: false, error: { message: 'Only practitioners can discharge patients' } }, 403);
      const { visitId } = c.req.valid('param');
      const body = c.req.valid('json');
      const userId = c.get('userId');
      const ip = c.req.header('x-forwarded-for');

      const visitRow = await db.select({ institutionId: visits.institutionId, status: visits.status, patientId: visits.patientId }).from(visits).where(eq(visits.id, visitId)).limit(1);
      if (!visitRow.length) return c.json({ success: false, error: { message: 'Visit not found' } }, 404);
      const patient = await db.select({ blockchainAddress: patients.blockchainAddress }).from(patients).where(eq(patients.id, visitRow[0].patientId)).limit(1);
      if (!patient.length) return c.json({ success: false, error: { message: 'Patient not found' } }, 404);

      const canAct = await canActOnVisit(userId, visitRow[0].institutionId);
      if (!canAct) return c.json({ success: false, error: { message: 'You can only perform clinical actions on visits created by your institution.' } }, 403);

      const dischargeHash = generateRecordHash({ visitId, dischargeDiagnosis: body.dischargeDiagnosis, dischargeSummary: body.dischargeSummary, dischargedBy: userId, dischargeTime: new Date().toISOString() });
      const result = await db.update(visits).set({
        status: 'completed', dischargeDate: new Date(),
        dischargeDiagnosis: body.dischargeDiagnosis, dischargeSummary: body.dischargeSummary,
        dischargeInstructions: body.dischargeInstructions, followUpDate: body.followUpDate ? new Date(body.followUpDate) : null,
        updatedAt: new Date(), dischargeBlockchainHash: dischargeHash,
      }).where(eq(visits.id, visitId)).returning();

      // Auto-release any bed assigned to this visit
      await db.execute(sql`
        UPDATE ward_beds
        SET status = 'available', current_visit_id = NULL, updated_at = NOW()
        WHERE current_visit_id = ${visitId}
      `);
      // Sync ward available_beds counts
      await db.execute(sql`
        UPDATE wards w
        SET available_beds = (
          SELECT COUNT(*) FROM ward_beds wb WHERE wb.ward_id = w.id AND wb.status = 'available'
        )
        WHERE w.id IN (SELECT ward_id FROM ward_beds WHERE institution_id = ${visitRow[0].institutionId})
      `);

      await storeRecordHash(`${visitId}:discharge`, patient[0].blockchainAddress, dischargeHash, 'discharge');
      await auditAction(userId, 'practitioner', visitRow[0].patientId, patient[0].blockchainAddress, 'update', 'discharge', visitId, ip);
      return c.json({ success: true, data: { message: 'Patient discharged successfully', visit: result[0], blockchainHash: dischargeHash } });
    } catch (err: any) {
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ── MY PERMISSION CHECK ───────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Visits'], summary: 'Check access level for a visit (returns reason)',
    method: 'get', path: '/:visitId/my-permission',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    request: { params: z.object({ visitId: z.string().uuid() }) },
    responses: {
      200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.object({ hasPermission: z.boolean(), reason: z.string() }) }) } }, description: 'Permission check result' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Visit not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const { visitId } = c.req.valid('param');
      const userId = c.get('userId');
      const staffBlockchainAddress = c.get('blockchainAddress');
      const visit = await db.select({ patientId: visits.patientId, institutionId: visits.institutionId }).from(visits).where(eq(visits.id, visitId)).limit(1);
      if (!visit.length) return c.json({ success: false, error: { message: 'Visit not found' } }, 404);
      const patient = await db.select({ blockchainAddress: patients.blockchainAddress }).from(patients).where(eq(patients.id, visit[0].patientId)).limit(1);
      if (!patient.length) return c.json({ success: true, data: { hasPermission: false, reason: 'no_access' } });
      const access = await resolveAccess(userId, visit[0].institutionId, staffBlockchainAddress, patient[0].blockchainAddress);
      return c.json({ success: true, data: { hasPermission: access.granted, reason: access.reason } });
    } catch (err: any) {
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ── VISIT INFO (no permission required) ───────────────────────────────────
  .openapi(createRoute({
    tags: ['Visits'], summary: 'Get basic visit info (no permission required)',
    method: 'get', path: '/:visitId/info',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    request: { params: z.object({ visitId: z.string().uuid() }) },
    responses: {
      200: { content: { 'application/json': { schema: successData } }, description: 'Visit info' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
    },
  }), async (c) => {
    const { visitId } = c.req.valid('param');
    const visit = await db.select().from(visits).where(eq(visits.id, visitId)).limit(1);
    if (!visit.length) return c.json({ success: false, error: { message: 'Visit not found' } }, 404);
    const patient = await db.select({ firstNameEncrypted: patients.firstNameEncrypted, lastNameEncrypted: patients.lastNameEncrypted })
      .from(patients).where(eq(patients.id, visit[0].patientId)).limit(1);
    const { decrypt } = await import('../services/crypto');
    return c.json({ success: true, data: { patientId: visit[0].patientId, visitNumber: visit[0].visitNumber, patientName: patient.length ? `${decrypt(patient[0].firstNameEncrypted)} ${decrypt(patient[0].lastNameEncrypted)}` : 'Unknown' } });
  })

  // ── PENDING LAB ORDERS ────────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Visits'], summary: 'Get all pending lab orders (Lab Technician)',
    method: 'get', path: '/lab-orders/pending',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    responses: {
      200: { content: { 'application/json': { schema: successData } }, description: 'Pending lab orders' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      const userId = c.get('userId');
      if (userType !== 'lab_technician' && userType !== 'admin') return c.json({ success: false, error: { message: 'Access denied' } }, 403);
      const staffInstitutionId = await getStaffInstitution(userId);
      const institutionFilter = (userType === 'admin' && !staffInstitutionId) ? undefined : eq(visits.institutionId, staffInstitutionId);
      const orders = await db.select({
        id: labTestOrders.id, orderNumber: labTestOrders.orderNumber, visitId: labTestOrders.visitId, patientId: labTestOrders.patientId,
        testName: labTestOrders.testName, testCode: labTestOrders.testCode, specimenType: labTestOrders.specimenType, urgency: labTestOrders.urgency,
        clinicalNotes: labTestOrders.clinicalNotes, status: labTestOrders.status, orderedAt: labTestOrders.orderedAt,
        visitNumber: visits.visitNumber, chiefComplaint: visits.chiefComplaint,
        patientFirstNameEncrypted: patients.firstNameEncrypted, patientLastNameEncrypted: patients.lastNameEncrypted,
      }).from(labTestOrders)
        .leftJoin(visits, eq(visits.id, labTestOrders.visitId))
        .leftJoin(patients, eq(patients.id, labTestOrders.patientId))
        .where(and(
          ne(labTestOrders.status, 'resulted'),
          ne(labTestOrders.status, 'cancelled'),
          institutionFilter,
          // Match the nursing queue: personal assignments plus the shared
          // hospital queue for orders created while no technician was online.
          userType === 'admin' ? undefined : or(eq(labTestOrders.assignedTo, userId), isNull(labTestOrders.assignedTo)),
        ))
        .orderBy(sql`CASE ${labTestOrders.urgency} WHEN 'critical' THEN 1 WHEN 'emergency' THEN 2 WHEN 'urgent' THEN 3 ELSE 4 END`, labTestOrders.orderedAt);
      return c.json({
        success: true,
        data: {
          orders: orders.map((order) => ({
            ...order,
            patientName: order.patientFirstNameEncrypted
              ? `${decrypt(order.patientFirstNameEncrypted)} ${order.patientLastNameEncrypted ? decrypt(order.patientLastNameEncrypted) : ''}`.trim()
              : 'Unknown patient',
          })),
        },
      });
    } catch (err: any) {
      return handleError(err, c);
    }
  })

  // ── RESULTED LAB ORDERS ───────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Visits'], summary: 'Get resulted lab orders history (Lab Technician)',
    method: 'get', path: '/lab-orders/resulted',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    responses: {
      200: { content: { 'application/json': { schema: successData } }, description: 'Resulted orders' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      if (userType !== 'lab_technician' && userType !== 'admin') return c.json({ success: false, error: { message: 'Access denied' } }, 403);
      const orders = await db.execute(sql`SELECT lo.id, lo.order_number, lo.visit_id, lo.patient_id, lo.test_name, lo.test_code, lo.specimen_type, lo.urgency, lo.status, lo.ordered_at, v.visit_number, lr.interpretation, lr.abnormal_findings, lr.performed_at FROM lab_test_orders lo JOIN visits v ON v.id = lo.visit_id LEFT JOIN lab_test_results lr ON lr.lab_test_order_id = lo.id WHERE lo.status = 'resulted' ORDER BY lr.performed_at DESC LIMIT 50`);
      return c.json({ success: true, data: { orders: (orders as any).rows } });
    } catch (err: any) {
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // Replace the PENDING PRESCRIPTIONS handler in visits.ts with this.
  // Adds patient name decryption to the pending prescriptions list.

  .openapi(createRoute({
    tags: ['Visits'], summary: 'Get all pending prescriptions (Pharmacist)',
    method: 'get', path: '/prescriptions/pending',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    responses: {
      200: { content: { 'application/json': { schema: successData } }, description: 'Pending prescriptions' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      const userId = c.get('userId');
      if (userType !== 'pharmacist' && userType !== 'admin')
        return c.json({ success: false, error: { message: 'Access denied' } }, 403);

      const staffInstitutionId = await getStaffInstitution(userId);
      const { decrypt } = await import('../services/crypto');

      const instClause = staffInstitutionId
        ? sql`AND v.institution_id = ${staffInstitutionId}`
        : sql``;

      const result = await db.execute(sql`
        SELECT
          p.id,
          p.prescription_number,
          p.visit_id,
          p.patient_id,
          p.status,
          p.prescribed_at,
          v.visit_number,
          v.chief_complaint,
          pt.first_name_encrypted AS patient_first_name_encrypted,
          pt.last_name_encrypted  AS patient_last_name_encrypted,
          COUNT(pi.id)                                              AS total_items,
          COUNT(CASE WHEN pi.is_dispensed = false THEN 1 END)      AS pending_items
        FROM prescriptions p
        JOIN visits v            ON v.id  = p.visit_id
        JOIN patients pt         ON pt.id = p.patient_id
        LEFT JOIN prescription_items pi ON pi.prescription_id = p.id
        WHERE p.status IN ('prescribed', 'dispensing')
          ${instClause}
        GROUP BY p.id, v.visit_number, v.chief_complaint,
                 pt.first_name_encrypted, pt.last_name_encrypted
        ORDER BY p.prescribed_at ASC
      `);

      const rows = (result as any).rows ?? result;

      const prescriptions = rows.map((row: any) => {
        let patientName = 'Unknown Patient';
        try {
          if (row.patient_first_name_encrypted)
            patientName = `${decrypt(row.patient_first_name_encrypted)} ${decrypt(row.patient_last_name_encrypted)}`;
        } catch { /* keep fallback */ }

        return {
          id: row.id,
          prescriptionNumber: row.prescription_number,
          visitId: row.visit_id,
          patientId: row.patient_id,
          patientName,
          visitNumber: row.visit_number,
          chiefComplaint: row.chief_complaint,
          status: row.status,
          prescribedAt: row.prescribed_at,
          totalItems: Number(row.total_items ?? 0),
          pendingItems: Number(row.pending_items ?? 0),
        };
      });

      return c.json({ success: true, data: { prescriptions } });
    } catch (err: any) {
      console.error('[PENDING_PRESCRIPTIONS]', err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })
  // ── GET PRESCRIPTION DETAIL ───────────────────────────────────────────────
  //
  // FIXED: was restricted to pharmacist + admin only.
  // Practitioners need this to view items on their own prescriptions.
  // Nurses and receptionists also need read access.
  //
  .openapi(createRoute({
    tags: ['Visits'],
    summary: 'Get prescription detail with all items',
    method: 'get',
    path: '/prescriptions/:prescriptionId/detail',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: { params: z.object({ prescriptionId: z.string().uuid() }) },
    responses: {
      200: { content: { 'application/json': { schema: successData } }, description: 'Prescription detail' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');

      // All clinical and administrative roles can read prescription details.
      // Pharmacists already had access; practitioners need it to view their
      // own prescriptions; nurses and receptionists for care coordination.
      const allowed = [
        'pharmacist',
        'practitioner',
        'nurse',
        'receptionist',
        'admin',
      ];
      if (!allowed.includes(userType))
        return c.json({ success: false, error: { message: 'Access denied' } }, 403);

      const { prescriptionId } = c.req.valid('param');

      const [prescriptionResult, itemsResult] = await Promise.all([
        db.execute(
          sql`
            SELECT
              p.id,
              p.prescription_number,
              p.visit_id,
              p.patient_id,
              p.status,
              p.prescribed_at,
              v.visit_number,
              v.chief_complaint
            FROM prescriptions p
            JOIN visits v ON v.id = p.visit_id
            WHERE p.id = ${prescriptionId}
            LIMIT 1
          `
        ),
        db.execute(
          sql`
            SELECT
              id,
              prescription_id,
              medication_name,
              generic_name,
              strength,
              dosage_form,
              dose,
              frequency,
              route,
              duration,
              quantity,
              refills_allowed,
              instructions,
              is_dispensed,
              dispensed_at,
              dispensed_quantity
            FROM prescription_items
            WHERE prescription_id = ${prescriptionId}
            ORDER BY created_at ASC
          `
        ),
      ]);

      const rows = (prescriptionResult as any)?.rows ?? prescriptionResult;
      if (!rows?.length)
        return c.json({ success: false, error: { message: 'Prescription not found' } }, 404);

      const itemRows = (itemsResult as any)?.rows ?? itemsResult ?? [];

      return c.json({
        success: true,
        data: {
          prescription: rows[0],
          items: itemRows,
        },
      });
    } catch (err: any) {
      console.error('[PRESCRIPTION_DETAIL] error:', err.message);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ── DISPENSED PRESCRIPTIONS (with patient names) ──────────────────────────────
  // Replace the existing /prescriptions/dispensed handler in visits.ts with this.
  // The patient name is encrypted so we fetch + decrypt per row.

  .openapi(createRoute({
    tags: ['Visits'], summary: 'Get dispensed prescriptions history (Pharmacist)',
    method: 'get', path: '/prescriptions/dispensed',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    responses: {
      200: { content: { 'application/json': { schema: successData } }, description: 'Dispensed history' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      const userId = c.get('userId');
      if (userType !== 'pharmacist' && userType !== 'admin')
        return c.json({ success: false, error: { message: 'Access denied' } }, 403);

      const staffInstitutionId = await getStaffInstitution(userId);
      const { decrypt } = await import('../services/crypto');

      // Scope to institution unless super admin with no institution
      const instClause = staffInstitutionId
        ? sql`AND v.institution_id = ${staffInstitutionId}`
        : sql``;

      const result = await db.execute(sql`
        SELECT
          p.id,
          p.prescription_number,
          p.visit_id,
          p.patient_id,
          p.status,
          p.prescribed_at,
          p.updated_at AS dispensed_at,
          v.visit_number,
          pt.first_name_encrypted AS patient_first_name_encrypted,
          pt.last_name_encrypted  AS patient_last_name_encrypted,
          COUNT(pi.id) AS total_items
        FROM prescriptions p
        JOIN visits v   ON v.id = p.visit_id
        JOIN patients pt ON pt.id = p.patient_id
        LEFT JOIN prescription_items pi ON pi.prescription_id = p.id
        WHERE p.status = 'dispensed'
          ${instClause}
        GROUP BY p.id, v.visit_number, pt.first_name_encrypted, pt.last_name_encrypted
        ORDER BY p.updated_at DESC
        LIMIT 50
      `);

      const rows = (result as any).rows ?? result;

      const prescriptions = rows.map((row: any) => {
        let patientName = 'Unknown Patient';
        try {
          if (row.patient_first_name_encrypted) {
            patientName = `${decrypt(row.patient_first_name_encrypted)} ${decrypt(row.patient_last_name_encrypted)}`;
          }
        } catch { /* keep fallback */ }

        return {
          id: row.id,
          prescriptionNumber: row.prescription_number,
          visitId: row.visit_id,
          patientId: row.patient_id,
          patientName,
          visitNumber: row.visit_number,
          status: row.status,
          prescribedAt: row.prescribed_at,
          dispensedAt: row.dispensed_at,
          itemCount: Number(row.total_items ?? 0),
        };
      });

      return c.json({ success: true, data: { prescriptions } });
    } catch (err: any) {
      console.error('[DISPENSED_HISTORY]', err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })









  // ── ADD THIS ENDPOINT TO visit.router.ts ─────────────────────────────────────
  //
  // Paste this as a new chained .openapi(...) block anywhere in the router chain.
  // All imports (vitalSigns, visits, patients, eq, and, db, etc.) already exist.
  // No new imports needed.
  //
  // The endpoint lives at POST /visits/doctor-admit (separate from POST /visits
  // which is the receptionist/nurse flow).



  .openapi(createRoute({
    tags: ['Visits'],
    summary: 'Doctor-initiated direct admission — bypasses nurse triage queue',
    method: 'post',
    path: '/doctor-admit',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              patientId: z.string().uuid(),
              visitType: z.enum(['outpatient', 'inpatient', 'emergency', 'consultation']),
              priority: z.enum(['routine', 'urgent', 'emergency', 'critical']),
              chiefComplaint: z.string().min(5),
              admittingDiagnosis: z.string().optional(), // initial clinical notes
              wardOrRoom: z.string().optional(),
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
                skippedTriage: z.boolean(),
              }),
            }),
          },
        },
        description: 'Visit created and assigned to doctor',
      },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Patient not found' },
      409: { content: { 'application/json': { schema: errorSchema } }, description: 'Active visit exists' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      if (userType !== 'practitioner')
        return c.json({ success: false, error: { message: 'Only practitioners can use direct admission' } }, 403);

      const userId = c.get('userId');
      const body = c.req.valid('json');
      const ip = c.req.header('x-forwarded-for');

      // Resolve doctor's institution
      const institutionId = await getStaffInstitution(userId);
      if (!institutionId)
        return c.json({ success: false, error: { message: 'Your account is not associated with an institution' } }, 403);

      // Patient must exist
      const patient = await db
        .select({ id: patients.id, blockchainAddress: patients.blockchainAddress })
        .from(patients)
        .where(eq(patients.id, body.patientId))
        .limit(1);
      if (!patient.length)
        return c.json({ success: false, error: { message: 'Patient not found' } }, 404);

      // Block if patient already has an active visit
      const existing = await db
        .select({ id: visits.id, visitNumber: visits.visitNumber })
        .from(visits)
        .where(and(eq(visits.patientId, body.patientId), eq(visits.status, 'in-progress')))
        .limit(1);
      if (existing.length)
        return c.json({
          success: false,
          error: { message: `Patient already has an active visit (${existing[0].visitNumber}). Discharge it first.` },
        }, 409);

      // Generate visit number + hash
      const visitNumber = `VIS-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      const visitHash = generateRecordHash({
        patientId: body.patientId,
        visitNumber,
        visitType: body.visitType,
        createdBy: userId,
        admitType: 'doctor_direct',
        timestamp: new Date().toISOString(),
      });

      // ── Create visit — doctor self-assigns, chiefComplaint set immediately ──
      const [newVisit] = await db.insert(visits).values({
        patientId: body.patientId,
        institutionId,
        visitNumber,
        visitType: body.visitType,
        priority: body.priority,
        chiefComplaint: body.chiefComplaint,
        admittingDiagnosis: body.admittingDiagnosis ?? null,
        wardOrRoom: body.wardOrRoom ?? null,
        admissionDate: new Date(),
        status: 'in-progress',
        assignedDoctorId: userId,   // doctor self-assigns
        blockchainHash: visitHash,
      }).returning({ id: visits.id, visitNumber: visits.visitNumber });

      // ── Determine if triage should be skipped ────────────────────────────
      const skipTriage = ['emergency', 'critical'].includes(body.priority);

      if (skipTriage) {
        // Insert placeholder vitalSigns row so hasVitals === true and the
        // nurse triage queue filter excludes this visit entirely.
        // The doctor is assuming responsibility for initial assessment.
        await db.insert(vitalSigns).values({
          visitId: newVisit.id,
          patientId: body.patientId,
          recordedByNurseId: userId,   // doctor's id — field just needs a valid UUID
          nurseNotes: `Direct doctor admission — ${body.priority} priority. Triage bypassed. Attending: ${userId}.`,
          blockchainHash: 'doctor-direct-admission',
        });
      }

      // ── Blockchain + audit ────────────────────────────────────────────────
      await storeRecordHash(newVisit.id, patient[0].blockchainAddress, visitHash, 'visit');
      await auditAction(
        userId, 'practitioner', body.patientId,
        patient[0].blockchainAddress,
        'create', 'visit', newVisit.id, ip,
      );

      return c.json({
        success: true,
        data: {
          visitId: newVisit.id,
          visitNumber: newVisit.visitNumber,
          blockchainHash: visitHash,
          skippedTriage: skipTriage,
        },
      }, 201);

    } catch (err: any) {
      console.error('[DOCTOR_ADMIT]', err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  ;
