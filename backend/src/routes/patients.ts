import { handleError } from '../lib/errors';
import { createRoute, z } from '@hono/zod-openapi';
import { eq, and, desc, ne, or, isNull, sql, inArray, gt } from 'drizzle-orm';
import { db } from '../db';
import {
  patients, institutions, patientInstitutionRegistrations,
  visits, consultations, diagnoses, imagingOrders, imagingReports,
  labTestOrders, labTestResults, prescriptionItems, prescriptions,
  vitalSigns, practitioners, allergies, patientGuardians,
  crossInstitutionAccess,
} from '../db/schema';
import { createRouter } from '../lib/create-app';
import { authMiddleware } from '../middleware/auth';
import { encrypt, decrypt, generateRecordHash } from '../services/crypto';
import { storeRecordHash, checkPermission } from '../services/fabric';
import crypto from 'crypto';
import { hash, compare } from 'bcryptjs'

const errorSchema = z.object({ success: z.boolean(), error: z.object({ message: z.string() }) });
const successData = z.object({ success: z.boolean(), data: z.any() });

function ageFromDob(dob: string): number {
  const d = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

// Base schema — no superRefine so .omit() works for OpenAPI route definition
const registerPatientBaseSchema = z.object({
  firstName:            z.string().min(1),
  lastName:             z.string().min(1),
  middleName:           z.string().optional(),
  dateOfBirth:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gender:               z.enum(['male', 'female', 'other']),
  bloodType:            z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown']).default('unknown'),
  phoneNumber:          z.string().min(5),
  email:                z.string().email().optional(),
  address:              z.string().min(5),
  emergencyContact:     z.string().min(5),
  nationalId:           z.string().min(5).optional(),
  isMinor:              z.boolean().default(false),
  // Guardian fields — guardianPatientId is a FK to an existing adult patient
  guardianPatientId:    z.string().uuid().optional(),
  guardianRelationship: z.enum(['mother', 'father', 'legal_guardian', 'grandparent', 'other']).optional(),
  guardianDocumentReference: z.string().optional(),
  maritalStatus:        z.enum(['single', 'married', 'divorced', 'widowed']).optional(),
  occupation:           z.string().optional(),
  password:             z.string().min(8),
  institutionId:        z.string().uuid().optional(),
  hospitalPatientNumber: z.string().optional(),
});

const updatePatientSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  middleName: z.string().optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  bloodType: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown']).optional(),
  phoneNumber: z.string().min(5).optional(),
  email: z.string().email().optional(),
  address: z.string().min(5).optional(),
  emergencyContact: z.string().min(5).optional(),
  maritalStatus: z.enum(['single', 'married', 'divorced', 'widowed']).optional(),
  occupation: z.string().optional(),
  password: z.string().min(8).optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getStaffInstitution(userId: string): Promise<string | null> {
  const row = await db.select({ institutionId: practitioners.institutionId })
    .from(practitioners).where(eq(practitioners.id, userId)).limit(1);
  return row[0]?.institutionId ?? null;
}

async function getInstitutionPatientIds(institutionId: string): Promise<string[]> {
  const rows = await db.select({ patientId: patientInstitutionRegistrations.patientId })
    .from(patientInstitutionRegistrations)
    .where(and(
      eq(patientInstitutionRegistrations.institutionId, institutionId),
      eq(patientInstitutionRegistrations.isActive, true),
    ));
  return rows.map(r => r.patientId);
}

async function buildVisitPayload(visitId: string) {
  const [consultationsData, diagnosesData, prescriptionsData, labOrdersData, imagingOrdersData, vitalsData] =
    await Promise.all([
      db.select().from(consultations).where(eq(consultations.visitId, visitId)),
      db.select().from(diagnoses).where(eq(diagnoses.visitId, visitId)),
      db.select().from(prescriptions).where(eq(prescriptions.visitId, visitId)),
      db.select().from(labTestOrders).where(eq(labTestOrders.visitId, visitId)),
      db.select().from(imagingOrders).where(eq(imagingOrders.visitId, visitId)),
      db.select().from(vitalSigns).where(eq(vitalSigns.visitId, visitId)).orderBy(desc(vitalSigns.recordedAt)),
    ]);

  const prescriptionsWithItems = await Promise.all(prescriptionsData.map(async rx => {
    const items = await db.select().from(prescriptionItems).where(eq(prescriptionItems.prescriptionId, rx.id));
    return { ...rx, items };
  }));
  const labOrdersWithResults = await Promise.all(labOrdersData.map(async lo => {
    const results = await db.select().from(labTestResults).where(eq(labTestResults.labTestOrderId, lo.id)).limit(1);
    return { ...lo, result: results[0] ?? null };
  }));
  const imagingOrdersWithReports = await Promise.all(imagingOrdersData.map(async io => {
    const report = await db.select().from(imagingReports).where(eq(imagingReports.imagingOrderId, io.id)).limit(1);
    return { ...io, report: report[0] ?? null };
  }));

  return { consultations: consultationsData, diagnoses: diagnosesData, prescriptions: prescriptionsWithItems, labOrders: labOrdersWithResults, imagingOrders: imagingOrdersWithReports, vitals: vitalsData };
}

// ── Router ────────────────────────────────────────────────────────────────────

export const patientRouter = createRouter()

  // ── REGISTER ─────────────────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Patients'], summary: 'Register a new patient',
    method: 'post', path: '/',
    request: { body: { content: { 'application/json': { schema: registerPatientBaseSchema.omit({ password: true }) } } } },
    responses: {
      201: { content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.object({ patientId: z.string().uuid(), blockchainAddress: z.string(), isMinor: z.boolean(), temporaryPatientId: z.string().nullable() }) }) } }, description: 'Registered' },
      400: { content: { 'application/json': { schema: errorSchema } }, description: 'Validation error' },
      409: { content: { 'application/json': { schema: errorSchema } }, description: 'Duplicate national ID' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const body = c.req.valid('json');
      const staffId = c.get('userId') ?? null;

      // Cross-field validation
      if (!body.isMinor && !body.nationalId)
        return c.json({ success: false, error: { message: 'National ID is required for adult patients' } }, 400);
      if (body.isMinor && !body.guardianPatientId)
        return c.json({ success: false, error: { message: 'guardianPatientId is required for minor patients' } }, 400);
      if (body.isMinor && !body.guardianRelationship)
        return c.json({ success: false, error: { message: 'guardianRelationship is required for minor patients' } }, 400);

      // Age validation
      if (body.isMinor) {
        const age = ageFromDob(body.dateOfBirth);
        if (age >= 16)
          return c.json({ success: false, error: { message: `Patient age is ${age} — minor registration is only for patients under 16` } }, 400);
      }

      // Validate guardian exists and is an adult
      if (body.isMinor && body.guardianPatientId) {
        const [gRow] = await db.select().from(patients).where(eq(patients.id, body.guardianPatientId)).limit(1);
        if (!gRow) return c.json({ success: false, error: { message: 'Guardian patient not found' } }, 400);
        if (gRow.isMinor) return c.json({ success: false, error: { message: 'Guardian cannot be a minor patient' } }, 400);
        const guardianAge = ageFromDob(decrypt(gRow.dateOfBirthEncrypted));
        if (guardianAge < 18)
          return c.json({ success: false, error: { message: `Guardian is ${guardianAge} years old — must be at least 18` } }, 400);
      }

      // Generate a temporary ID for minors; use nationalId hash for adults
      const temporaryPatientId = body.isMinor
        ? `HC-MINOR-${new Date().getFullYear()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`
        : null;

      const blockchainAddress = body.isMinor
        ? `patient:minor:${crypto.createHash('sha256').update(temporaryPatientId! + (process.env.BLOCKCHAIN_SALT || 'salt')).digest('hex')}`
        : `patient:${crypto.createHash('sha256').update(body.nationalId! + (process.env.BLOCKCHAIN_SALT || 'salt')).digest('hex')}`;

      // Pre-insert duplicate check — blockchain_address is deterministic for same NRC
      const existing = await db.select({ id: patients.id }).from(patients).where(eq(patients.blockchainAddress, blockchainAddress)).limit(1);
      if (existing.length)
        return c.json({ success: false, error: { message: 'National ID already registered' } }, 409);

      const result = await db.insert(patients).values({
        blockchainAddress,
        firstNameEncrypted:        encrypt(body.firstName),
        lastNameEncrypted:         encrypt(body.lastName),
        middleNameEncrypted:       body.middleName ? encrypt(body.middleName) : null,
        dateOfBirthEncrypted:      encrypt(body.dateOfBirth),
        phoneNumberEncrypted:      encrypt(body.phoneNumber),
        emailEncrypted:            body.email ? encrypt(body.email) : null,
        addressEncrypted:          encrypt(body.address),
        emergencyContactEncrypted: encrypt(body.emergencyContact),
        nationalIdEncrypted:       body.nationalId ? encrypt(body.nationalId) : null,
        isMinor:                   body.isMinor ?? false,
        temporaryPatientId,
        gender:                    body.gender,
        bloodType:                 body.bloodType,
        maritalStatus:             body.maritalStatus,
        occupation:                body.occupation,
        passwordHash:              await hash('test1234', 12),
        mustChangePassword:        true,
        isActive:                  true,
      }).returning({ id: patients.id, blockchainAddress: patients.blockchainAddress });

      const patientId = result[0].id;

      // ── Link to institution ───────────────────────────────────────────────
      if (body.institutionId) {
        const hospitalPatientNumber =
          body.hospitalPatientNumber?.trim() ||
          `HPN-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        await db.insert(patientInstitutionRegistrations).values({
          patientId, institutionId: body.institutionId, hospitalPatientNumber,
          isActive: true, isHomeInstitution: true,
        });
      }

      // ── Guardian link (minors only) — FK to existing adult patient ────────
      if (body.isMinor && body.guardianPatientId) {
        const minorDob  = body.dateOfBirth;
        const dob       = new Date(minorDob);
        const endsAt    = new Date(dob.getFullYear() + 16, dob.getMonth(), dob.getDate());
        await db.insert(patientGuardians).values({
          patientId,
          guardianPatientId:  body.guardianPatientId,
          relationship:       body.guardianRelationship!,
          isPrimary:          true,
          canConsent:         true,
          endsAt,
          documentReference:  body.guardianDocumentReference ?? null,
          verifiedByStaffId:  staffId,
        });

        // Notify guardian
        try {
          const minorName = `${body.firstName} ${body.lastName}`;
          const { notifyUser } = await import('../services/notifications');
          await notifyUser(body.guardianPatientId, 'guardian_linked', {
            message: `You have been registered as guardian (${body.guardianRelationship}) for ${minorName}`,
            minorPatientId: patientId, minorName,
          });
        } catch { /* non-blocking */ }
      }

      storeRecordHash(patientId, blockchainAddress, generateRecordHash({ patientId, blockchainAddress, timestamp: new Date().toISOString() }), 'patient_registration').catch(() => { });

      return c.json({ success: true, data: { patientId, blockchainAddress, isMinor: body.isMinor ?? false, temporaryPatientId } }, 201);
    } catch (err: any) {
      console.error('[REGISTER]', err?.message, err?.code, err);
      if (err.code === '23505')
        return c.json({ success: false, error: { message: 'National ID already registered' } }, 409);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ── GET MY PROFILE ────────────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Patients'], summary: 'Get authenticated patient profile',
    method: 'get', path: '/me',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    responses: {
      200: { content: { 'application/json': { schema: successData } }, description: 'Profile' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      if (c.get('userType') !== 'patient')
        return c.json({ success: false, error: { message: 'Patients only' } }, 403);
      const p = (await db.select().from(patients).where(eq(patients.id, c.get('userId'))).limit(1))[0];
      if (!p) return c.json({ success: false, error: { message: 'Not found' } }, 404);
      return c.json({ success: true, data: { id: p.id, blockchainAddress: p.blockchainAddress, firstName: decrypt(p.firstNameEncrypted), lastName: decrypt(p.lastNameEncrypted), middleName: p.middleNameEncrypted ? decrypt(p.middleNameEncrypted) : undefined, dateOfBirth: decrypt(p.dateOfBirthEncrypted), gender: p.gender, bloodType: p.bloodType, phoneNumber: decrypt(p.phoneNumberEncrypted), email: p.emailEncrypted ? decrypt(p.emailEncrypted) : undefined, address: decrypt(p.addressEncrypted), emergencyContact: decrypt(p.emergencyContactEncrypted), maritalStatus: p.maritalStatus || undefined, occupation: p.occupation || undefined, isActive: p.isActive, createdAt: p.createdAt.toISOString() } });
    } catch { return c.json({ success: false, error: { message: 'Internal server error' } }, 500); }
  })

  // ── UPDATE MY PROFILE ─────────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Patients'], summary: 'Update authenticated patient profile',
    method: 'patch', path: '/me',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    request: { body: { content: { 'application/json': { schema: updatePatientSchema } } } },
    responses: {
      200: { content: { 'application/json': { schema: successData } }, description: 'Updated' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      if (c.get('userType') !== 'patient') return c.json({ success: false, error: { message: 'Patients only' } }, 403);
      const patientId = c.get('userId');
      const body = c.req.valid('json');
      const u: any = {};
      if (body.firstName) u.firstNameEncrypted = encrypt(body.firstName);
      if (body.lastName) u.lastNameEncrypted = encrypt(body.lastName);
      if (body.middleName !== undefined) u.middleNameEncrypted = body.middleName ? encrypt(body.middleName) : null;
      if (body.dateOfBirth) u.dateOfBirthEncrypted = encrypt(body.dateOfBirth);
      if (body.gender) u.gender = body.gender;
      if (body.bloodType) u.bloodType = body.bloodType;
      if (body.phoneNumber) u.phoneNumberEncrypted = encrypt(body.phoneNumber);
      if (body.email !== undefined) u.emailEncrypted = body.email ? encrypt(body.email) : null;
      if (body.address) u.addressEncrypted = encrypt(body.address);
      if (body.emergencyContact) u.emergencyContactEncrypted = encrypt(body.emergencyContact);
      if (body.maritalStatus !== undefined) u.maritalStatus = body.maritalStatus;
      if (body.occupation !== undefined) u.occupation = body.occupation;
      if (body.password) u.passwordHash = await hash(body.password, 12);
      u.updatedAt = new Date();
      if (Object.keys(u).length === 1) return c.json({ success: true, data: { message: 'No fields to update' } });
      const result = await db.update(patients).set(u).where(eq(patients.id, patientId)).returning();
      if (!result.length) return c.json({ success: false, error: { message: 'Not found' } }, 404);
      storeRecordHash(patientId, result[0].blockchainAddress, generateRecordHash({ patientId, timestamp: new Date().toISOString() }), 'patient_update').catch(() => { });
      return c.json({ success: true, data: { message: 'Profile updated successfully' } });
    } catch { return c.json({ success: false, error: { message: 'Internal server error' } }, 500); }
  })

  // ── SEARCH PATIENTS ───────────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Patients'], summary: 'Search patients — institution-scoped',
    method: 'get', path: '/search',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    request: {
      query: z.object({
        q: z.string().optional(),
        limit: z.string().regex(/^\d+$/).transform(Number).optional().default('50'),
        offset: z.string().regex(/^\d+$/).transform(Number).optional().default('0'),
        global: z.enum(['true', 'false']).optional().default('false'),
      }),
    },
    responses: {
      200: { content: { 'application/json': { schema: successData } }, description: 'Results' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      const userId = c.get('userId');
      if (!['receptionist', 'nurse', 'practitioner', 'lab_technician', 'radiologist', 'admin'].includes(userType))
        return c.json({ success: false, error: { message: 'Access denied' } }, 403);

      const { q, limit, offset, global: globalSearch } = c.req.valid('query');
      const searchTerm = q?.toLowerCase().trim() || '';
      const staffInstitutionId = await getStaffInstitution(userId);

      // global=true bypasses institution scoping — only receptionist/admin allowed
      const skipScope = globalSearch === 'true' && ['receptionist', 'admin'].includes(userType);

      // UUID fast-path
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (searchTerm && UUID_RE.test(searchTerm)) {
        if (staffInstitutionId && !skipScope) {
          const reg = await db.select().from(patientInstitutionRegistrations)
            .where(and(eq(patientInstitutionRegistrations.patientId, searchTerm), eq(patientInstitutionRegistrations.institutionId, staffInstitutionId), eq(patientInstitutionRegistrations.isActive, true)))
            .limit(1);
          if (!reg.length) return c.json({ success: true, data: { patients: [], total: 0, limit, offset } });
        }
        const row = await db.select().from(patients).where(and(eq(patients.id, searchTerm), eq(patients.isActive, true))).limit(1);
        if (!row.length) return c.json({ success: true, data: { patients: [], total: 0, limit, offset } });
        const p = row[0];
        return c.json({ success: true, data: { patients: [{ id: p.id, blockchainAddress: p.blockchainAddress, firstName: decrypt(p.firstNameEncrypted), lastName: decrypt(p.lastNameEncrypted), middleName: p.middleNameEncrypted ? decrypt(p.middleNameEncrypted) : undefined, dateOfBirth: decrypt(p.dateOfBirthEncrypted), gender: p.gender, phoneNumber: decrypt(p.phoneNumberEncrypted), email: p.emailEncrypted ? decrypt(p.emailEncrypted) : undefined, nationalId: p.nationalIdEncrypted ? decrypt(p.nationalIdEncrypted) : null, createdAt: p.createdAt.toISOString() }], total: 1, limit, offset } });
      }

      // Decrypt-and-filter path
      let scopedIds: string[] | null = null;
      if (staffInstitutionId && !skipScope) {
        scopedIds = await getInstitutionPatientIds(staffInstitutionId);
        if (scopedIds.length === 0) return c.json({ success: true, data: { patients: [], total: 0, limit, offset } });
      }

      const rows = scopedIds
        ? await db.select().from(patients).where(and(eq(patients.isActive, true), inArray(patients.id, scopedIds)))
        : await db.select().from(patients).where(eq(patients.isActive, true));

      const matched: any[] = [];
      for (const p of rows) {
        try {
          const firstName = decrypt(p.firstNameEncrypted);
          const lastName = decrypt(p.lastNameEncrypted);
          const nationalId = p.nationalIdEncrypted ? decrypt(p.nationalIdEncrypted) : null;
          const tmpId = p.temporaryPatientId ?? '';
          const searchable = `${firstName} ${lastName} ${nationalId ?? ''} ${tmpId} ${p.id}`.toLowerCase();
          if (!searchTerm || searchable.includes(searchTerm)) {
            matched.push({ id: p.id, blockchainAddress: p.blockchainAddress, firstName, lastName, middleName: p.middleNameEncrypted ? decrypt(p.middleNameEncrypted) : undefined, dateOfBirth: decrypt(p.dateOfBirthEncrypted), gender: p.gender, phoneNumber: decrypt(p.phoneNumberEncrypted), email: p.emailEncrypted ? decrypt(p.emailEncrypted) : undefined, nationalId, isMinor: p.isMinor, temporaryPatientId: p.temporaryPatientId, createdAt: p.createdAt.toISOString() });
          }
        } catch (e) { console.error(`[SEARCH] skip ${p.id}:`, e); }
      }

      return c.json({ success: true, data: { patients: matched.slice(offset, offset + limit), total: matched.length, limit, offset } });
    } catch (err: any) {
      console.error('[SEARCH]', err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })


  // ── ADD TO backend/src/routes/patients.ts ────────────────────────────────────
  // Add these imports at top if not already present:
  //   import { eq, desc, inArray } from 'drizzle-orm';
  //   import { visits, institutions } from '../db/schema';

  // ══════════════════════════════════════════════════════════════════════════
  // GET /patients/my-institutions
  // Returns the distinct hospitals where the patient has had any past visit.
  // Used by the mobile app to populate the "select hospital" picker when
  // the patient wants to request a new appointment.
  // ══════════════════════════════════════════════════════════════════════════
  .openapi(createRoute({
    tags: ['Patients'],
    summary: 'Patient — institutions I have visited',
    method: 'get',
    path: '/my-institutions',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              data: z.object({
                institutions: z.array(z.object({
                  id: z.string(),
                  institutionName: z.string(),
                  institutionType: z.string(),
                  lastVisitDate: z.string().nullable(),
                  visitCount: z.number(),
                })),
              }),
            }),
          },
        },
        description: 'My institutions',
      },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      const userId = c.get('userId');

      if (userType !== 'patient')
        return c.json({ success: false, error: { message: 'Patients only' } }, 403);

      // Get distinct institution IDs with visit counts and last visit date
      const rows = await db.execute(sql`
                SELECT
                    i.id               AS id,
                    i.institution_name AS "institutionName",
                    i.institution_type AS "institutionType",
                    COUNT(v.id)::int   AS "visitCount",
                    MAX(v.admission_date) AS "lastVisitDate"
                FROM visits v
                JOIN institutions i ON i.id = v.institution_id
                WHERE v.patient_id = ${userId}
                  AND v.institution_id IS NOT NULL
                  AND i.is_active = true
                GROUP BY i.id, i.institution_name, i.institution_type
                ORDER BY MAX(v.admission_date) DESC
            `);

      return c.json({
        success: true,
        data: {
          institutions: (rows as any[]).map(r => ({
            id: r.id,
            institutionName: r.institutionName,
            institutionType: r.institutionType,
            visitCount: Number(r.visitCount),
            lastVisitDate: r.lastVisitDate ? new Date(r.lastVisitDate).toISOString() : null,
          })),
        },
      });
    } catch (err: any) {
      console.error('[MY_INSTITUTIONS]', err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ── ADD TO backend/src/routes/patients.ts ────────────────────────────────────
  //
  // IMPORTANT: Hono matches routes in declaration order. Place this BEFORE the
  // parameterized /:patientId route (same rule as /my-institutions).
  //
  // Imports needed (add if missing):
  //   import { vitalSigns, visits } from '../db/schema';
  //   import { desc, asc } from 'drizzle-orm';

  // ─── GET /my-vitals-trends ─────────────────────────────────────────────────
  // Patient's own vitals across all visits, oldest→newest, for trend charts.
  .openapi(createRoute({
    tags: ['Patients'],
    summary: 'Patient vitals history for trend charts',
    method: 'get',
    path: '/my-vitals-trends',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    responses: {
      200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.any() }) } }, description: 'Vitals trends' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      const userId = c.get('userId');
      if (userType !== 'patient')
        return c.json({ success: false, error: { message: 'Patients only' } }, 403);

      const rows = await db.select({
        id: vitalSigns.id,
        recordedAt: vitalSigns.recordedAt,
        temperature: vitalSigns.temperature,
        bloodPressureSystolic: vitalSigns.bloodPressureSystolic,
        bloodPressureDiastolic: vitalSigns.bloodPressureDiastolic,
        pulseRate: vitalSigns.pulseRate,
        respiratoryRate: vitalSigns.respiratoryRate,
        oxygenSaturation: vitalSigns.oxygenSaturation,
        weight: vitalSigns.weight,
        height: vitalSigns.height,
        visitNumber: visits.visitNumber,
      })
        .from(vitalSigns)
        .leftJoin(visits, eq(visits.id, vitalSigns.visitId))
        .where(eq(vitalSigns.patientId, userId))
        .orderBy(vitalSigns.recordedAt)   // oldest first for charts
        .limit(100);

      const points = rows.map(r => ({
        date: r.recordedAt,
        visitNumber: r.visitNumber,
        systolic: r.bloodPressureSystolic,
        diastolic: r.bloodPressureDiastolic,
        pulse: r.pulseRate,
        temperature: r.temperature ? parseFloat(r.temperature as any) : null,
        spo2: r.oxygenSaturation,
        weight: r.weight ? parseFloat(r.weight as any) : null,
      }));

      // Latest values + simple deltas for the summary cards
      const latest = points[points.length - 1] ?? null;
      const previous = points[points.length - 2] ?? null;
      const delta = (k: keyof typeof points[0]) =>
        latest && previous && latest[k] != null && previous[k] != null
          ? Number(latest[k]) - Number(previous[k]) : null;

      return c.json({
        success: true,
        data: {
          points,
          total: points.length,
          latest,
          deltas: latest ? {
            systolic: delta('systolic'),
            weight: delta('weight'),
            pulse: delta('pulse'),
          } : null,
        },
      });
    } catch (err: any) {
      console.error('[VITALS_TRENDS]', err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ── GET MY HEALTH — blood type + allergies for the patient portal ───────────
  .openapi(createRoute({
    tags: ['Patients'], summary: 'Patient health summary (blood type + allergies)',
    method: 'get', path: '/my-health',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    responses: {
      200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.any() }) } }, description: 'Health summary' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
    },
  }), async (c) => {
    try {
      if (c.get('userType') !== 'patient')
        return c.json({ success: false, error: { message: 'Patients only' } }, 403);
      const patientId = c.get('userId');

      const [patientRow, allergyRows] = await Promise.all([
        db.select({ bloodType: patients.bloodType })
          .from(patients)
          .where(eq(patients.id, patientId))
          .limit(1),
        db.select({
          id:          allergies.id,
          allergen:    allergies.allergen,
          allergyType: allergies.allergyType,
          severity:    allergies.severity,
          reaction:    allergies.reaction,
        })
          .from(allergies)
          .where(and(eq(allergies.patientId, patientId), eq(allergies.isActive, true)))
          .orderBy(desc(allergies.severity)),
      ]);

      return c.json({
        success: true,
        data: {
          bloodType: patientRow[0]?.bloodType ?? 'unknown',
          allergies: allergyRows,
        },
      });
    } catch (err: any) {
      console.error('[MY_HEALTH]', err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ── GET BY ID ─────────────────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Patients'], summary: 'Get patient by ID',
    method: 'get', path: '/:patientId',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    request: { params: z.object({ patientId: z.string().uuid() }) },
    responses: {
      200: { content: { 'application/json': { schema: successData } }, description: 'Patient' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      const userId = c.get('userId');
      const { patientId } = c.req.valid('param');
      if (!['practitioner', 'nurse', 'receptionist', 'lab_technician', 'radiologist', 'admin'].includes(userType))
        return c.json({ success: false, error: { message: 'Access denied' } }, 403);

      const row = await db.select().from(patients).where(eq(patients.id, patientId)).limit(1);
      if (!row.length) return c.json({ success: false, error: { message: 'Not found' } }, 404);

      let allowed = userType === 'admin';
      if (!allowed) {
        const instId = await getStaffInstitution(userId);
        if (instId) {
          const reg = await db.select().from(patientInstitutionRegistrations).where(and(eq(patientInstitutionRegistrations.patientId, patientId), eq(patientInstitutionRegistrations.institutionId, instId), eq(patientInstitutionRegistrations.isActive, true))).limit(1);
          if (reg.length) allowed = true;
        }
        if (!allowed) {
          const addr = c.get('blockchainAddress');
          if (addr) allowed = await checkPermission(row[0].blockchainAddress, addr);
        }
      }
      if (!allowed) return c.json({ success: false, error: { message: 'Access denied' } }, 403);

      const p = row[0];

      // Fetch guardians if minor
      let guardians: any[] = [];
      if (p.isMinor) {
        const gLinks = await db.select().from(patientGuardians)
          .where(eq(patientGuardians.patientId, p.id))
          .orderBy(desc(patientGuardians.isPrimary));
        const now = new Date();
        guardians = await Promise.all(
          gLinks.filter(g => !g.endsAt || g.endsAt > now).map(async (g) => {
            const [gp] = await db.select().from(patients).where(eq(patients.id, g.guardianPatientId)).limit(1);
            return {
              id: g.id, relationship: g.relationship, isPrimary: g.isPrimary, canConsent: g.canConsent,
              guardianPatientId: g.guardianPatientId,
              guardianName: gp ? `${decrypt(gp.firstNameEncrypted)} ${decrypt(gp.lastNameEncrypted)}` : null,
              guardianPhone: gp ? decrypt(gp.phoneNumberEncrypted) : null,
            };
          }),
        );
      }

      return c.json({ success: true, data: { id: p.id, blockchainAddress: p.blockchainAddress, firstName: decrypt(p.firstNameEncrypted), lastName: decrypt(p.lastNameEncrypted), middleName: p.middleNameEncrypted ? decrypt(p.middleNameEncrypted) : undefined, dateOfBirth: decrypt(p.dateOfBirthEncrypted), gender: p.gender, bloodType: p.bloodType, phoneNumber: decrypt(p.phoneNumberEncrypted), email: p.emailEncrypted ? decrypt(p.emailEncrypted) : undefined, address: decrypt(p.addressEncrypted), emergencyContact: decrypt(p.emergencyContactEncrypted), maritalStatus: p.maritalStatus || undefined, occupation: p.occupation || undefined, isActive: p.isActive, isMinor: p.isMinor, temporaryPatientId: p.temporaryPatientId, guardians, createdAt: p.createdAt.toISOString() } });
    } catch (e) { console.error('[GET_BY_ID]', e); return c.json({ success: false, error: { message: 'Internal server error' } }, 500); }
  })

  // ── LIST PATIENTS ─────────────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Patients'], summary: 'List patients (paginated)',
    method: 'get', path: '/',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    request: { query: z.object({ search: z.string().optional(), limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20'), offset: z.string().regex(/^\d+$/).transform(Number).optional().default('0') }) },
    responses: { 200: { content: { 'application/json': { schema: successData } }, description: 'List' }, 403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' }, 500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' } },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      if (!['admin', 'practitioner', 'receptionist', 'nurse', 'lab_technician', 'radiologist'].includes(userType)) return c.json({ success: false, error: { message: 'Access denied' } }, 403);
      const { search, limit, offset } = c.req.valid('query');
      let query = db.select({ id: patients.id, blockchainAddress: patients.blockchainAddress, firstNameEncrypted: patients.firstNameEncrypted, lastNameEncrypted: patients.lastNameEncrypted, gender: patients.gender, createdAt: patients.createdAt }).from(patients);
      if (search) {
        if (search.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) query = query.where(eq(patients.id, search)) as any;
        else return c.json({ success: true, data: { patients: [], total: 0 } });
      }
      const list = await query.limit(limit).offset(offset);
      return c.json({ success: true, data: { patients: list.map(p => ({ id: p.id, blockchainAddress: p.blockchainAddress, firstName: decrypt(p.firstNameEncrypted), lastName: decrypt(p.lastNameEncrypted), gender: p.gender, createdAt: p.createdAt })), limit, offset } });
    } catch { return c.json({ success: false, error: { message: 'Internal server error' } }, 500); }
  })

  // ── GET BY INSTITUTION ────────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Patients'], summary: 'Get patients at an institution',
    method: 'get', path: '/institution/:institutionId',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    request: { params: z.object({ institutionId: z.string().uuid() }), query: z.object({ search: z.string().optional(), limit: z.string().regex(/^\d+$/).transform(Number).optional().default('50'), offset: z.string().regex(/^\d+$/).transform(Number).optional().default('0') }) },
    responses: { 200: { content: { 'application/json': { schema: successData } }, description: 'List' }, 403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' }, 500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' } },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      const userId = c.get('userId');
      const { institutionId } = c.req.valid('param');
      const { search, limit, offset } = c.req.valid('query');

      let allowed = userType === 'admin';
      if (!allowed) { const sid = await getStaffInstitution(userId); if (sid === institutionId) allowed = true; }
      if (!allowed) return c.json({ success: false, error: { message: 'Access denied' } }, 403);

      const regs = await db.select({ patientId: patientInstitutionRegistrations.patientId }).from(patientInstitutionRegistrations).where(and(eq(patientInstitutionRegistrations.institutionId, institutionId), eq(patientInstitutionRegistrations.isActive, true)));
      if (!regs.length) return c.json({ success: true, data: { patients: [], total: 0, limit, offset } });

      let rows = await db.select().from(patients).where(and(eq(patients.isActive, true), inArray(patients.id, regs.map(r => r.patientId))));

      if (search) {
        const q = search.toLowerCase();
        const filtered = [];
        for (const p of rows) {
          try { const nid = p.nationalIdEncrypted ? decrypt(p.nationalIdEncrypted) : ''; if (`${decrypt(p.firstNameEncrypted)} ${decrypt(p.lastNameEncrypted)}`.toLowerCase().includes(q) || nid.includes(q)) filtered.push(p); } catch { }
        }
        rows = filtered;
      }

      const total = rows.length;
      return c.json({ success: true, data: { patients: rows.slice(offset, offset + limit).map(p => ({ id: p.id, blockchainAddress: p.blockchainAddress, firstName: decrypt(p.firstNameEncrypted), lastName: decrypt(p.lastNameEncrypted), middleName: p.middleNameEncrypted ? decrypt(p.middleNameEncrypted) : undefined, dateOfBirth: decrypt(p.dateOfBirthEncrypted), gender: p.gender, bloodType: p.bloodType, phoneNumber: decrypt(p.phoneNumberEncrypted), email: p.emailEncrypted ? decrypt(p.emailEncrypted) : undefined, nationalId: p.nationalIdEncrypted ? decrypt(p.nationalIdEncrypted) : null, createdAt: p.createdAt.toISOString() })), total, limit, offset } });
    } catch (err: any) { console.error('[INSTITUTION PATIENTS]', err); return c.json({ success: false, error: { message: 'Internal server error' } }, 500); }
  })

  // ── MEDICAL HISTORY ───────────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Patients'], summary: 'Get patient medical history',
    method: 'get', path: '/:patientId/history',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    request: { params: z.object({ patientId: z.string().uuid() }) },
    responses: { 200: { content: { 'application/json': { schema: successData } }, description: 'History' }, 403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' }, 404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' }, 500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' } },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      const userId = c.get('userId');
      const staffBlockchainAddress = c.get('blockchainAddress') as string | undefined;
      const { patientId } = c.req.valid('param');

      if (!['practitioner', 'nurse', 'admin', 'patient', 'lab_technician', 'radiologist', 'receptionist'].includes(userType))
        return c.json({ success: false, error: { message: 'Access denied' } }, 403);

      const patientRow = await db.select().from(patients).where(eq(patients.id, patientId)).limit(1);
      if (!patientRow.length) return c.json({ success: false, error: { message: 'Patient not found' } }, 404);
      const p = patientRow[0];

      const patient = { id: p.id, firstName: decrypt(p.firstNameEncrypted), lastName: decrypt(p.lastNameEncrypted), middleName: p.middleNameEncrypted ? decrypt(p.middleNameEncrypted) : null, gender: p.gender, dateOfBirth: decrypt(p.dateOfBirthEncrypted), phoneNumber: decrypt(p.phoneNumberEncrypted), email: p.emailEncrypted ? decrypt(p.emailEncrypted) : null, bloodType: p.bloodType, maritalStatus: p.maritalStatus, occupation: p.occupation, blockchainAddress: p.blockchainAddress };

      // Patient self
      if (userType === 'patient') {
        if (userId !== patientId) return c.json({ success: false, error: { message: 'Access denied' } }, 403);
        const allVisits = await db.select().from(visits).where(eq(visits.patientId, patientId)).orderBy(desc(visits.admissionDate));
        return c.json({ success: true, data: { patient, ownVisits: await Promise.all(allVisits.map(async v => ({ visit: v, ...(await buildVisitPayload(v.id)) }))), awayInstitutions: [] } });
      }

      const staffInstitutionId = await getStaffInstitution(userId);

      if (!staffInstitutionId) {
        const allVisits = await db.select().from(visits).where(eq(visits.patientId, patientId)).orderBy(desc(visits.admissionDate));
        return c.json({ success: true, data: { patient, ownVisits: await Promise.all(allVisits.map(async v => ({ visit: v, ...(await buildVisitPayload(v.id)) }))), awayInstitutions: [] } });
      }

      const ownVisitRows = await db.select().from(visits).where(and(eq(visits.patientId, patientId), or(eq(visits.institutionId, staffInstitutionId), isNull(visits.institutionId)))).orderBy(desc(visits.admissionDate));
      const ownVisits = await Promise.all(ownVisitRows.map(async v => ({ visit: v, ...(await buildVisitPayload(v.id)) })));

      const awayVisitRows = await db.select({ id: visits.id, institutionId: visits.institutionId, admissionDate: visits.admissionDate, status: visits.status }).from(visits).where(and(eq(visits.patientId, patientId), sql`${visits.institutionId} IS NOT NULL`, ne(visits.institutionId, staffInstitutionId))).orderBy(desc(visits.admissionDate));

      const awayMap = new Map<string, typeof awayVisitRows>();
      for (const v of awayVisitRows) { if (!v.institutionId) continue; if (!awayMap.has(v.institutionId)) awayMap.set(v.institutionId, []); awayMap.get(v.institutionId)!.push(v); }

      // There are two independent ways to be allowed to read another institution's
      // records, and this endpoint must honour both:
      //   1. The patient granted this practitioner consent on the blockchain.
      //      That is patient-wide, so it is resolved once rather than per hospital.
      //   2. An emergency override (or referral/transfer) created a
      //      cross-institution grant from that specific hospital to ours.
      // Checking only (1) is what left emergency access showing as locked.
      let blockchainConsent = false;
      try { if (staffBlockchainAddress) blockchainConsent = await checkPermission(p.blockchainAddress, staffBlockchainAddress); } catch { }

      const now = new Date();
      const grantRows = await db
        .select({ sourceInstitutionId: crossInstitutionAccess.sourceInstitutionId, accessType: crossInstitutionAccess.accessType, expiresAt: crossInstitutionAccess.expiresAt })
        .from(crossInstitutionAccess)
        .where(and(
          eq(crossInstitutionAccess.patientId, patientId),
          eq(crossInstitutionAccess.targetInstitutionId, staffInstitutionId),
          eq(crossInstitutionAccess.status, 'active'),
          // A grant with no expiry is open-ended; otherwise it must not have lapsed.
          or(isNull(crossInstitutionAccess.expiresAt), gt(crossInstitutionAccess.expiresAt, now)),
        ));
      const grantBySource = new Map(grantRows.map(g => [g.sourceInstitutionId, g]));

      const awayInstitutions = await Promise.all(Array.from(awayMap.entries()).map(async ([instId, rows]) => {
        let institutionName = 'Unknown Institution';
        try { const r = await db.select({ institutionName: institutions.institutionName }).from(institutions).where(eq(institutions.id, instId)).limit(1); if (r.length) institutionName = r[0].institutionName; } catch { }
        const grant = grantBySource.get(instId);
        const hasPermission = blockchainConsent || !!grant;
        // Lets the UI show *why* the records opened (e.g. an emergency override).
        const accessVia = blockchainConsent ? 'patient_consent' : grant ? grant.accessType : null;
        let visitsData: any[] = [];
        if (hasPermission) { const fullRows = await db.select().from(visits).where(and(eq(visits.patientId, patientId), eq(visits.institutionId, instId))).orderBy(desc(visits.admissionDate)); visitsData = await Promise.all(fullRows.map(async v => ({ visit: v, ...(await buildVisitPayload(v.id)) }))); }
        return { institutionId: instId, institutionName, visitCount: rows.length, hasPermission, accessVia, accessExpiresAt: grant?.expiresAt ?? null, visits: visitsData };
      }));

      awayInstitutions.sort((a, b) => (a.hasPermission === b.hasPermission ? 0 : a.hasPermission ? -1 : 1));
      return c.json({ success: true, data: { patient, ownVisits, awayInstitutions } });
    } catch (err: any) { console.error('[HISTORY]', err); return c.json({ success: false, error: { message: 'Internal server error' } }, 500); }
  })

  // ── REGISTRATION DETAILS ──────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Patients'], summary: 'Get patient registration details — no clinical data',
    method: 'get', path: '/:patientId/registration',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    request: { params: z.object({ patientId: z.string().uuid() }) },
    responses: { 200: { content: { 'application/json': { schema: successData } }, description: 'Registration' }, 403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' }, 404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' }, 500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' } },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      const userId = c.get('userId');
      const { patientId } = c.req.valid('param');
      if (!['receptionist', 'nurse', 'practitioner', 'admin'].includes(userType)) return c.json({ success: false, error: { message: 'Access denied' } }, 403);

      const row = await db.select().from(patients).where(eq(patients.id, patientId)).limit(1);
      if (!row.length) return c.json({ success: false, error: { message: 'Patient not found' } }, 404);
      const p = row[0];

      const staffInstitutionId = await getStaffInstitution(userId);
      let registration: any = null;
      if (staffInstitutionId) {
        const reg = await db.select().from(patientInstitutionRegistrations).where(and(eq(patientInstitutionRegistrations.patientId, patientId), eq(patientInstitutionRegistrations.institutionId, staffInstitutionId), eq(patientInstitutionRegistrations.isActive, true))).limit(1);
        if (reg.length) registration = { hospitalPatientNumber: reg[0].hospitalPatientNumber, isHomeInstitution: reg[0].isHomeInstitution ?? false, registeredAt: reg[0].createdAt?.toISOString?.() ?? new Date().toISOString() };
      }

      return c.json({ success: true, data: { id: p.id, blockchainAddress: p.blockchainAddress, firstName: decrypt(p.firstNameEncrypted), lastName: decrypt(p.lastNameEncrypted), middleName: p.middleNameEncrypted ? decrypt(p.middleNameEncrypted) : undefined, dateOfBirth: decrypt(p.dateOfBirthEncrypted), gender: p.gender, bloodType: p.bloodType, phoneNumber: decrypt(p.phoneNumberEncrypted), email: p.emailEncrypted ? decrypt(p.emailEncrypted) : undefined, address: decrypt(p.addressEncrypted), emergencyContact: decrypt(p.emergencyContactEncrypted), nationalId: p.nationalIdEncrypted ? decrypt(p.nationalIdEncrypted) : null, maritalStatus: p.maritalStatus || undefined, occupation: p.occupation || undefined, isActive: p.isActive, isMinor: p.isMinor, temporaryPatientId: p.temporaryPatientId || undefined, createdAt: p.createdAt.toISOString(), registration } });
    } catch (err: any) { console.error('[REGISTRATION]', err); return c.json({ success: false, error: { message: 'Internal server error' } }, 500); }
  })

  // ── UPDATE PATIENT (receptionist) ─────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Patients'], summary: 'Update patient basic info — receptionist accessible',
    method: 'patch', path: '/:patientId/update',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    request: {
      params: z.object({ patientId: z.string().uuid() }),
      body: { content: { 'application/json': { schema: z.object({ firstName: z.string().min(1).optional(), lastName: z.string().min(1).optional(), middleName: z.string().optional().nullable(), dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), gender: z.enum(['male', 'female', 'other']).optional(), phoneNumber: z.string().min(5).optional(), email: z.string().email().optional().nullable(), address: z.string().min(5).optional(), emergencyContact: z.string().min(5).optional(), maritalStatus: z.enum(['single', 'married', 'divorced', 'widowed']).optional().nullable(), occupation: z.string().optional().nullable() }) } } },
    },
    responses: { 200: { content: { 'application/json': { schema: successData } }, description: 'Updated' }, 400: { content: { 'application/json': { schema: errorSchema } }, description: 'No fields' }, 403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' }, 404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' }, 500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' } },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      const userId = c.get('userId');
      const { patientId } = c.req.valid('param');
      const body = c.req.valid('json');
      if (!['receptionist', 'admin'].includes(userType)) return c.json({ success: false, error: { message: 'Access denied' } }, 403);

      const sid = await getStaffInstitution(userId);
      if (sid) { const reg = await db.select().from(patientInstitutionRegistrations).where(and(eq(patientInstitutionRegistrations.patientId, patientId), eq(patientInstitutionRegistrations.institutionId, sid), eq(patientInstitutionRegistrations.isActive, true))).limit(1); if (!reg.length) return c.json({ success: false, error: { message: 'Patient not registered at your institution' } }, 403); }

      const existing = await db.select({ id: patients.id, blockchainAddress: patients.blockchainAddress }).from(patients).where(eq(patients.id, patientId)).limit(1);
      if (!existing.length) return c.json({ success: false, error: { message: 'Patient not found' } }, 404);

      const u: Record<string, any> = {};
      if (body.firstName !== undefined) u.firstNameEncrypted = encrypt(body.firstName!);
      if (body.lastName !== undefined) u.lastNameEncrypted = encrypt(body.lastName!);
      if (body.middleName !== undefined) u.middleNameEncrypted = body.middleName ? encrypt(body.middleName) : null;
      if (body.dateOfBirth !== undefined) u.dateOfBirthEncrypted = encrypt(body.dateOfBirth!);
      if (body.gender !== undefined) u.gender = body.gender;
      if (body.phoneNumber !== undefined) u.phoneNumberEncrypted = encrypt(body.phoneNumber!);
      if (body.email !== undefined) u.emailEncrypted = body.email ? encrypt(body.email) : null;
      if (body.address !== undefined) u.addressEncrypted = encrypt(body.address!);
      if (body.emergencyContact !== undefined) u.emergencyContactEncrypted = encrypt(body.emergencyContact!);
      if (body.maritalStatus !== undefined) u.maritalStatus = body.maritalStatus;
      if (body.occupation !== undefined) u.occupation = body.occupation;
      if (Object.keys(u).length === 0) return c.json({ success: false, error: { message: 'No fields provided' } }, 400);
      u.updatedAt = new Date();

      const result = await db.update(patients).set(u).where(eq(patients.id, patientId)).returning();
      if (!result.length) return c.json({ success: false, error: { message: 'Not found' } }, 404);
      storeRecordHash(patientId, existing[0].blockchainAddress, generateRecordHash({ patientId, updatedBy: userId, timestamp: new Date().toISOString() }), 'patient_info_update').catch(() => { });

      const r = result[0];
      return c.json({ success: true, data: { id: r.id, blockchainAddress: r.blockchainAddress, firstName: decrypt(r.firstNameEncrypted), lastName: decrypt(r.lastNameEncrypted), middleName: r.middleNameEncrypted ? decrypt(r.middleNameEncrypted) : undefined, dateOfBirth: decrypt(r.dateOfBirthEncrypted), gender: r.gender, bloodType: r.bloodType, phoneNumber: decrypt(r.phoneNumberEncrypted), email: r.emailEncrypted ? decrypt(r.emailEncrypted) : undefined, address: decrypt(r.addressEncrypted), emergencyContact: decrypt(r.emergencyContactEncrypted), nationalId: r.nationalIdEncrypted ? decrypt(r.nationalIdEncrypted) : null, maritalStatus: r.maritalStatus || undefined, occupation: r.occupation || undefined, isActive: r.isActive, createdAt: r.createdAt.toISOString() } });
    } catch (err: any) { console.error('[UPDATE]', err); return c.json({ success: false, error: { message: 'Internal server error' } }, 500); }
  })

  // ── RESET PASSWORD ────────────────────────────────────────────────────────
  // ── RESET PASSWORD ────────────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Patients'], summary: 'Reset patient password — receptionist accessible',
    method: 'post', path: '/:patientId/reset-password',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    request: {
      params: z.object({ patientId: z.string().uuid() }),
      body: { content: { 'application/json': { schema: z.object({ newPassword: z.string().min(8) }) } } },
    },
    responses: {
      200: { content: { 'application/json': { schema: successData } }, description: 'Reset' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      const userId = c.get('userId');
      const { patientId } = c.req.valid('param');
      const { newPassword } = c.req.valid('json');

      if (!['receptionist', 'admin'].includes(userType))
        return c.json({ success: false, error: { message: 'Access denied' } }, 403);

      // Verify the patient is registered at this staff member's institution
      const sid = await getStaffInstitution(userId);
      if (sid) {
        const reg = await db
          .select({ id: patientInstitutionRegistrations.id })
          .from(patientInstitutionRegistrations)
          .where(and(
            eq(patientInstitutionRegistrations.patientId, patientId),
            eq(patientInstitutionRegistrations.institutionId, sid),
            eq(patientInstitutionRegistrations.isActive, true),
          ))
          .limit(1);
        if (!reg.length)
          return c.json({ success: false, error: { message: 'Patient not registered at your institution' } }, 403);
      }

      // Fetch patient for blockchain address
      const existing = await db
        .select({ id: patients.id, blockchainAddress: patients.blockchainAddress })
        .from(patients)
        .where(eq(patients.id, patientId))
        .limit(1);

      if (!existing.length)
        return c.json({ success: false, error: { message: 'Patient not found' } }, 404);

      // Hash with bcryptjs — ONLY update once, ONLY use bcrypt
      const passwordHash = await hash(newPassword, 12);

      await db
        .update(patients)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(patients.id, patientId));

      // Audit trail on blockchain (non-blocking)
      storeRecordHash(
        patientId,
        existing[0].blockchainAddress,
        generateRecordHash({ patientId, resetBy: userId, timestamp: new Date().toISOString() }),
        'patient_password_reset',
      ).catch(() => { });

      return c.json({
        success: true,
        data: { message: 'Password reset successfully. Advise the patient to change it after logging in.' },
      });
    } catch (err: any) {
      console.error('[RESET-PASSWORD]', err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ── GET guardians for a minor patient ────────────────────────────────────
  .openapi(createRoute({
    tags: ['Patients'], summary: 'Get guardians for a patient (staff only)',
    method: 'get', path: '/:patientId/guardians',
    middleware: [authMiddleware], security: [{ bearerAuth: [] }],
    request: { params: z.object({ patientId: z.string().uuid() }) },
    responses: { 200: { content: { 'application/json': { schema: successData } }, description: 'OK' } },
  }), async (c) => {
    const { patientId } = c.req.valid('param');

    const rows = await db.select().from(patientGuardians)
      .where(and(eq(patientGuardians.patientId, patientId), eq(patientGuardians.isActive, true)))
      .orderBy(desc(patientGuardians.isPrimary));

    const decrypted = rows.map((g) => ({
      id:           g.id,
      patientId:    g.patientId,
      firstName:    decrypt(g.firstNameEncrypted),
      lastName:     decrypt(g.lastNameEncrypted),
      relationship: g.relationship,
      nationalId:   decrypt(g.nationalIdEncrypted),
      phoneNumber:  decrypt(g.phoneNumberEncrypted),
      email:        g.emailEncrypted ? decrypt(g.emailEncrypted) : null,
      isPrimary:    g.isPrimary,
      createdAt:    g.createdAt,
    }));

    return c.json({ success: true, data: decrypted });
  })

  ;