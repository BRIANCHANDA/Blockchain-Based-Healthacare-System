import { handleError } from '../lib/errors';
import { createRoute, z } from '@hono/zod-openapi';
import { eq, and, desc, or, inArray } from 'drizzle-orm';
import { db } from '../db';
import { clinicalDb, clinicalWriteGuard } from '../middleware/clinical-write';
import {
    referrals,
    patients,
    practitioners,
    institutions,
    visits,
    auditLogs,
    patientInstitutionRegistrations,
    departments,
} from '../db/schema';
import { createRouter } from '../lib/create-app';
import { authMiddleware } from '../middleware/auth';
import { generateRecordHash, decrypt } from '../services/crypto';
import { storeRecordHash, checkPermission } from '../services/fabric';
import { notifyUser } from '../services/notifications';
import { notifyDataChanged } from '../services/realtime';
import { notifyPatientAssigned } from '../services/assignment-notifications';
import crypto from 'crypto';

const errorSchema = z.object({
    success: z.boolean(),
    error: z.object({ message: z.string() }),
});

const createReferralSchema = z.object({
    patientId: z.string().uuid(),
    visitId: z.string().uuid().optional(),
    receivingInstitutionId: z.string().uuid(),
    receivingDepartmentId: z.string().uuid().optional(),
    receivingPractitionerId: z.string().uuid().optional(),
    reason: z.string().min(10),
    clinicalSummary: z.string().min(10),
    urgency: z.enum(['routine', 'urgent', 'emergency', 'critical']).default('routine'),
});

const respondReferralSchema = z.object({
    responseNotes: z.string().optional(),
});

// ── Helper: fetch + decrypt patient name ──────────────────────────────────────
async function getDecryptedPatientName(patientId: string): Promise<string> {
    const row = await db
        .select({ f: patients.firstNameEncrypted, l: patients.lastNameEncrypted })
        .from(patients)
        .where(eq(patients.id, patientId))
        .limit(1);
    if (!row.length) return 'Unknown Patient';
    try {
        const first = await decrypt(row[0].f);
        const last = await decrypt(row[0].l);
        return `${first} ${last}`.trim();
    } catch {
        return 'Unknown Patient';
    }
}

// ── Helper: get practitioner's institution ────────────────────────────────────
async function getPractitionerInstitution(userId: string) {
    const row = await db
        .select({ institutionId: practitioners.institutionId })
        .from(practitioners)
        .where(eq(practitioners.id, userId))
        .limit(1);
    return row[0]?.institutionId ?? null;
}

export const referralRouter = createRouter()

    // ══════════════════════════════════════════════════════════════════════════
    // POST /  — Create referral (practitioner)
    // ══════════════════════════════════════════════════════════════════════════
    .openapi(createRoute({
        tags: ['Referrals'],
        summary: 'Create a referral for a patient to another institution',
        method: 'post',
        path: '/',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware, clinicalWriteGuard],
        request: {
            body: { content: { 'application/json': { schema: createReferralSchema } } },
        },
        responses: {
            201: {
                content: {
                    'application/json': {
                        schema: z.object({
                            success: z.boolean(),
                            data: z.object({ referralId: z.string(), referralNumber: z.string() }),
                        }),
                    },
                },
                description: 'Referral created',
            },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        const db = clinicalDb(c);
        try {
            const userType = c.get('userType');
            if (userType !== 'practitioner')
                return c.json({ success: false, error: { message: 'Only practitioners can create referrals' } }, 403);

            const practitionerId = c.get('userId');
            const practitionerBlockchainAddress = c.get('blockchainAddress');
            const body = c.req.valid('json');

            // Patient must exist
            const patient = await db
                .select({ blockchainAddress: patients.blockchainAddress })
                .from(patients)
                .where(eq(patients.id, body.patientId))
                .limit(1);
            if (!patient.length)
                return c.json({ success: false, error: { message: 'Patient not found' } }, 404);

            // Get referring practitioner's institution
            const practitioner = await db
                .select({ institutionId: practitioners.institutionId })
                .from(practitioners)
                .where(eq(practitioners.id, practitionerId))
                .limit(1);
            if (!practitioner.length)
                return c.json({ success: false, error: { message: 'Practitioner not found' } }, 404);

            const referringInstitutionId = practitioner[0].institutionId;

            // Access check — institutional membership is enough to refer a patient.
            // Blockchain permission is only needed if the patient is NOT registered
            // at the doctor's institution (e.g. emergency walk-in with no registration).
            if (referringInstitutionId) {
                const reg = await db
                    .select({ id: patientInstitutionRegistrations.id })
                    .from(patientInstitutionRegistrations)
                    .where(and(
                        eq(patientInstitutionRegistrations.patientId, body.patientId),
                        eq(patientInstitutionRegistrations.institutionId, referringInstitutionId),
                        eq(patientInstitutionRegistrations.isActive, true),
                    ))
                    .limit(1);

                if (!reg.length) {
                    const hasPermission = await checkPermission(
                        patient[0].blockchainAddress,
                        practitionerBlockchainAddress,
                    );
                    if (!hasPermission)
                        return c.json({ success: false, error: { message: 'No permission to refer this patient' } }, 403);
                }
            }

            // Receiving institution must exist
            const inst = await db
                .select({ id: institutions.id, name: institutions.institutionName })
                .from(institutions)
                .where(eq(institutions.id, body.receivingInstitutionId))
                .limit(1);
            if (!inst.length)
                return c.json({ success: false, error: { message: 'Receiving institution not found' } }, 404);

            if (referringInstitutionId === body.receivingInstitutionId)
                return c.json({ success: false, error: { message: 'Cannot refer to your own institution' } }, 400);

            if (body.receivingPractitionerId) {
                const [doctor] = await db.select({ id: practitioners.id }).from(practitioners).where(and(
                    eq(practitioners.id, body.receivingPractitionerId),
                    eq(practitioners.institutionId, body.receivingInstitutionId),
                    eq(practitioners.role, 'practitioner'), eq(practitioners.isActive, true),
                    eq(practitioners.isVerified, true),
                )).limit(1);
                if (!doctor) return c.json({ success: false, error: { message: 'Receiving doctor not found at the destination hospital' } }, 404);
            }

            const referralNumber = `REF-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

            const [result] = await db.insert(referrals).values({
                referralNumber,
                patientId: body.patientId,
                visitId: body.visitId ?? null,
                referringInstitutionId: practitioner[0].institutionId!,
                referringPractitionerId: practitionerId,
                receivingInstitutionId: body.receivingInstitutionId,
                receivingDepartmentId: body.receivingDepartmentId ?? null,
                receivingPractitionerId: body.receivingPractitionerId ?? null,
                reason: body.reason,
                clinicalSummary: body.clinicalSummary,
                urgency: body.urgency,
                status: 'pending',
                referredAt: new Date(),
                blockchainHash: 'pending',
            }).returning({ id: referrals.id });

            // Blockchain hash
            const hash = generateRecordHash({
                referralId: result.id,
                referralNumber,
                patientId: body.patientId,
                referringInstitutionId: practitioner[0].institutionId,
                receivingInstitutionId: body.receivingInstitutionId,
                timestamp: new Date().toISOString(),
            });
            await db.update(referrals).set({ blockchainHash: hash }).where(eq(referrals.id, result.id));
            await storeRecordHash(result.id, patient[0].blockchainAddress, hash, 'referral').catch(() => { });

            await db.insert(auditLogs).values({
                userId: practitionerId,
                userType: 'practitioner',
                patientId: body.patientId,
                actionType: 'create',
                resourceType: 'referral',
                resourceId: result.id,
                blockchainTransactionId: crypto.randomBytes(16).toString('hex'),
                ipAddress: c.req.header('x-forwarded-for'),
            });

            notifyDataChanged(body.receivingInstitutionId, practitionerId);
            try {
            const patientName = await getDecryptedPatientName(body.patientId);
            const notification = {
                referralId: result.id,
                referralNumber,
                patientName,
                reason: body.reason,
                priority: body.urgency,
            };

            // Coordination staff always need to know a referral has arrived,
            // including when it is addressed to a particular doctor.
            const recipientConditions: any[] = [
                eq(practitioners.institutionId, body.receivingInstitutionId),
                eq(practitioners.isActive, true),
                eq(practitioners.isVerified, true),
            ];
            if (body.receivingPractitionerId) {
                recipientConditions.push(or(eq(practitioners.id, body.receivingPractitionerId), inArray(practitioners.role, ['receptionist', 'admin'])));
            } else {
                recipientConditions.push(inArray(practitioners.role, ['practitioner', 'receptionist', 'admin']));
            }
            const recipients = await db.select({ id: practitioners.id })
                .from(practitioners)
                .where(and(...recipientConditions));
            for (const recipient of recipients) {
                notifyUser(recipient.id, 'external_referral_received', notification);
            }
            } catch { console.warn('[REFERRAL_NOTIFICATION] Delivery failed'); }

            return c.json({ success: true, data: { referralId: result.id, referralNumber } }, 201);
        } catch (err: any) {
            console.error('[REFERRAL_CREATE]', err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    })

    // ══════════════════════════════════════════════════════════════════════════
    // GET /incoming  — Incoming referrals for the logged-in user's institution
    //
    // Used by: receptionist dashboard (pending referrals tile)
    // Returns referrals where receivingInstitutionId = user's institutionId
    // Includes decrypted patient name + referring institution name
    // ══════════════════════════════════════════════════════════════════════════
    .openapi(createRoute({
        tags: ['Referrals'],
        summary: 'List incoming referrals for this institution (receptionist/admin)',
        method: 'get',
        path: '/incoming',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        request: {
            query: z.object({
                status: z.string().optional(),
                limit: z.string().regex(/^\d+$/).transform(Number).optional().default('50'),
                offset: z.string().regex(/^\d+$/).transform(Number).optional().default('0'),
            }),
        },
        responses: {
            200: {
                content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.any() }) } },
                description: 'Incoming referrals',
            },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userType = c.get('userType');
            const userId = c.get('userId');

            if (!['receptionist', 'admin', 'practitioner'].includes(userType))
                return c.json({ success: false, error: { message: 'Access denied' } }, 403);

            const institutionId = await getPractitionerInstitution(userId);
            if (!institutionId)
                return c.json({ success: false, error: { message: 'No institution assigned' } }, 403);

            const { status, limit, offset } = c.req.valid('query');

            // Build filter conditions
            const conditions = [eq(referrals.receivingInstitutionId, institutionId)];
            if (status) conditions.push(eq(referrals.status, status as any));

            const rows = await db
                .select({
                    id: referrals.id,
                    referralNumber: referrals.referralNumber,
                    patientId: referrals.patientId,
                    visitId: referrals.visitId,
                    reason: referrals.reason,
                    clinicalSummary: referrals.clinicalSummary,
                    urgency: referrals.urgency,
                    status: referrals.status,
                    referredAt: referrals.referredAt,
                    acceptedAt: referrals.acceptedAt,
                    completedAt: referrals.completedAt,
                    responseNotes: referrals.responseNotes,
                    receivingDepartmentId: referrals.receivingDepartmentId,
                    receivingPractitionerId: referrals.receivingPractitionerId,
                    // Referring institution name (joined)
                    referringInstitutionName: institutions.institutionName,
                    // Patient identity (encrypted — decrypted below)
                    firstNameEncrypted: patients.firstNameEncrypted,
                    lastNameEncrypted: patients.lastNameEncrypted,
                    gender: patients.gender,
                    bloodType: patients.bloodType,
                })
                .from(referrals)
                .innerJoin(patients, eq(patients.id, referrals.patientId))
                .innerJoin(institutions, eq(institutions.id, referrals.referringInstitutionId))
                .where(and(...conditions))
                .orderBy(desc(referrals.referredAt))
                .limit(limit)
                .offset(offset);

            // Decrypt names
            const decrypted = await Promise.all(rows.map(async (r) => {
                let patientName = 'Unknown Patient';
                try {
                    const first = await decrypt(r.firstNameEncrypted);
                    const last = await decrypt(r.lastNameEncrypted);
                    patientName = `${first} ${last}`.trim();
                } catch { }
                const { firstNameEncrypted, lastNameEncrypted, ...rest } = r;
                return { ...rest, patientName };
            }));

            return c.json({ success: true, data: { referrals: decrypted, total: decrypted.length, limit, offset } });
        } catch (err: any) {
            console.error('[REFERRAL_INCOMING]', err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    })

    // ══════════════════════════════════════════════════════════════════════════
    // GET /outgoing  — Referrals sent from the logged-in practitioner / institution
    // ══════════════════════════════════════════════════════════════════════════
    .openapi(createRoute({
        tags: ['Referrals'],
        summary: 'List outgoing referrals for the current practitioner',
        method: 'get',
        path: '/outgoing',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        request: {
            query: z.object({
                status: z.string().optional(),
                limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
                offset: z.string().regex(/^\d+$/).transform(Number).optional().default('0'),
            }),
        },
        responses: {
            200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.any() }) } }, description: 'Outgoing referrals' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userType = c.get('userType');
            const userId = c.get('userId');

            if (userType !== 'practitioner')
                return c.json({ success: false, error: { message: 'Access denied' } }, 403);

            const { status, limit, offset } = c.req.valid('query');
            const conditions = [eq(referrals.referringPractitionerId, userId)];
            if (status) conditions.push(eq(referrals.status, status as any));

            const rows = await db
                .select({
                    id: referrals.id,
                    referralNumber: referrals.referralNumber,
                    patientId: referrals.patientId,
                    reason: referrals.reason,
                    urgency: referrals.urgency,
                    status: referrals.status,
                    referredAt: referrals.referredAt,
                    acceptedAt: referrals.acceptedAt,
                    completedAt: referrals.completedAt,
                    responseNotes: referrals.responseNotes,
                    receivingInstitutionName: institutions.institutionName,
                    firstNameEncrypted: patients.firstNameEncrypted,
                    lastNameEncrypted: patients.lastNameEncrypted,
                })
                .from(referrals)
                .innerJoin(patients, eq(patients.id, referrals.patientId))
                .innerJoin(institutions, eq(institutions.id, referrals.receivingInstitutionId))
                .where(and(...conditions))
                .orderBy(desc(referrals.referredAt))
                .limit(limit)
                .offset(offset);

            const decrypted = await Promise.all(rows.map(async (r) => {
                let patientName = 'Unknown Patient';
                try {
                    const first = await decrypt(r.firstNameEncrypted);
                    const last = await decrypt(r.lastNameEncrypted);
                    patientName = `${first} ${last}`.trim();
                } catch { }
                const { firstNameEncrypted, lastNameEncrypted, ...rest } = r;
                return { ...rest, patientName };
            }));

            return c.json({ success: true, data: { referrals: decrypted } });
        } catch (err: any) {
            console.error('[REFERRAL_OUTGOING]', err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    })

    // ══════════════════════════════════════════════════════════════════════════
    // GET /lookup/:referralNumber  — Look up by referral number
    //
    // Used by: receptionist when patient shows their referral number
    // Returns full referral details + patient info (decrypted)
    // ══════════════════════════════════════════════════════════════════════════
    .openapi(createRoute({
        tags: ['Referrals'],
        summary: 'Look up a referral by referral number',
        method: 'get',
        path: '/lookup/:referralNumber',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        request: {
            params: z.object({ referralNumber: z.string() }),
        },
        responses: {
            200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.any() }) } }, description: 'Referral found' },
            404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userType = c.get('userType');
            const userId = c.get('userId');

            if (!['receptionist', 'admin', 'practitioner'].includes(userType))
                return c.json({ success: false, error: { message: 'Access denied' } }, 403);

            const { referralNumber } = c.req.valid('param');
            const institutionId = await getPractitionerInstitution(userId);

            const rows = await db
                .select({
                    id: referrals.id,
                    referralNumber: referrals.referralNumber,
                    patientId: referrals.patientId,
                    visitId: referrals.visitId,
                    reason: referrals.reason,
                    clinicalSummary: referrals.clinicalSummary,
                    urgency: referrals.urgency,
                    status: referrals.status,
                    referredAt: referrals.referredAt,
                    receivingInstitutionId: referrals.receivingInstitutionId,
                    receivingDepartmentId: referrals.receivingDepartmentId,
                    receivingPractitionerId: referrals.receivingPractitionerId,
                    referringInstitutionName: institutions.institutionName,
                    patientFirstName: patients.firstNameEncrypted,
                    patientLastName: patients.lastNameEncrypted,
                    gender: patients.gender,
                    bloodType: patients.bloodType,
                })
                .from(referrals)
                .innerJoin(patients, eq(patients.id, referrals.patientId))
                .innerJoin(institutions, eq(institutions.id, referrals.referringInstitutionId))
                .where(eq(referrals.referralNumber, referralNumber))
                .limit(1);

            if (!rows.length)
                return c.json({ success: false, error: { message: 'Referral not found' } }, 404);

            const r = rows[0];

            // Receptionist can only look up referrals destined for their institution
            if (userType === 'receptionist' && r.receivingInstitutionId !== institutionId)
                return c.json({ success: false, error: { message: 'This referral is not for your institution' } }, 403);

            let patientName = 'Unknown Patient';
            try {
                const first = await decrypt(r.patientFirstName);
                const last = await decrypt(r.patientLastName);
                patientName = `${first} ${last}`.trim();
            } catch { }

            const { patientFirstName, patientLastName, ...rest } = r;
            return c.json({ success: true, data: { ...rest, patientName } });
        } catch (err: any) {
            console.error('[REFERRAL_LOOKUP]', err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    })

    // ══════════════════════════════════════════════════════════════════════════
    // POST /:referralId/convert-to-visit
    //
    // The key receptionist action: patient arrives with referral number,
    // receptionist looks it up then calls this to:
    //   1. Register patient at receiving institution (if not already)
    //   2. Create a new visit linked to the referral
    //   3. Optionally assign to a specific doctor
    //   4. Mark referral as accepted
    //   5. Return the new visitId so receptionist can open it
    // ══════════════════════════════════════════════════════════════════════════
    .openapi(createRoute({
        tags: ['Referrals'],
        summary: 'Convert a pending referral into a visit (receptionist)',
        method: 'post',
        path: '/:referralId/convert-to-visit',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        request: {
            params: z.object({ referralId: z.string().uuid() }),
            body: {
                content: {
                    'application/json': {
                        schema: z.object({
                            assignedDoctorId: z.string().uuid().optional(),
                            wardOrRoom: z.string().optional(),
                            visitType: z.enum(['outpatient', 'inpatient', 'emergency', 'consultation']).default('consultation'),
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
                                referralNumber: z.string(),
                                message: z.string(),
                            }),
                        }),
                    },
                },
                description: 'Visit created from referral',
            },
            400: { content: { 'application/json': { schema: errorSchema } }, description: 'Bad request' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userType = c.get('userType');
            const userId = c.get('userId');

            if (!['receptionist', 'admin'].includes(userType))
                return c.json({ success: false, error: { message: 'Only receptionists can convert referrals to visits' } }, 403);

            const { referralId } = c.req.valid('param');
            const body = c.req.valid('json');

            const institutionId = await getPractitionerInstitution(userId);
            if (!institutionId)
                return c.json({ success: false, error: { message: 'No institution assigned' } }, 403);

            // Fetch referral
            const [referral] = await db
                .select()
                .from(referrals)
                .where(eq(referrals.id, referralId))
                .limit(1);

            if (!referral)
                return c.json({ success: false, error: { message: 'Referral not found' } }, 404);

            if (referral.receivingInstitutionId !== institutionId)
                return c.json({ success: false, error: { message: 'This referral is not addressed to your institution' } }, 403);

            if (referral.status !== 'pending')
                return c.json({ success: false, error: { message: `Referral is already ${referral.status}` } }, 400);

            const assignedDoctorId = body.assignedDoctorId ?? referral.receivingPractitionerId;
            if (assignedDoctorId) {
                const [doctor] = await db.select({ id: practitioners.id }).from(practitioners).where(and(
                    eq(practitioners.id, assignedDoctorId), eq(practitioners.institutionId, institutionId),
                    eq(practitioners.role, 'practitioner'), eq(practitioners.isActive, true),
                )).limit(1);
                if (!doctor) return c.json({ success: false, error: { message: 'Assigned doctor not found at this hospital' } }, 404);
            }

            // ── Step 1: Ensure patient is registered at this institution ──────
            const existingReg = await db
                .select({ id: patientInstitutionRegistrations.id })
                .from(patientInstitutionRegistrations)
                .where(and(
                    eq(patientInstitutionRegistrations.patientId, referral.patientId),
                    eq(patientInstitutionRegistrations.institutionId, institutionId),
                ))
                .limit(1);

            if (!existingReg.length) {
                // Register the patient at this institution
                // Hospital patient number: REF- prefix to signal referral origin
                const hospitalNumber = `REF-${referral.referralNumber}-${Date.now()}`;
                await db.insert(patientInstitutionRegistrations).values({
                    patientId: referral.patientId,
                    institutionId,
                    hospitalPatientNumber: hospitalNumber,
                    registeredAt: new Date(),
                    isActive: true,
                    isHomeInstitution: false,
                });
            }

            // ── Step 2: Generate visit number ─────────────────────────────────
            const visitNumber = `V-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

            // ── Step 3: Create visit ──────────────────────────────────────────
            const visitHash = generateRecordHash({
                patientId: referral.patientId,
                institutionId,
                visitNumber,
                referralId,
                timestamp: new Date().toISOString(),
            });

            const [newVisit] = await db.insert(visits).values({
                patientId: referral.patientId,
                institutionId,
                visitNumber,
                visitType: body.visitType,
                admissionDate: new Date(),
                chiefComplaint: referral.reason,        // pre-populate from referral reason
                admittingDiagnosis: referral.clinicalSummary, // pre-populate clinical summary
                status: 'in-progress',
                priority: referral.urgency,       // carry over urgency as priority
                wardOrRoom: body.wardOrRoom ?? null,
                assignedDoctorId: assignedDoctorId ?? null,
                blockchainHash: visitHash,
            }).returning({ id: visits.id });

            // ── Step 4: Mark referral accepted and link the new visit ─────────
            await db.update(referrals)
                .set({
                    status: 'accepted',
                    acceptedAt: new Date(),
                    // Store the new visitId so it's navigable from both sides
                    // Note: referrals.visitId was the ORIGINAL visit; we can use responseNotes
                    // to record the receiving visit ID since the schema has no second visitId column.
                    responseNotes: `Converted to visit ${visitNumber} (id: ${newVisit.id})`,
                })
                .where(eq(referrals.id, referralId));

            // ── Step 5: Blockchain hash for acceptance ────────────────────────
            const acceptHash = generateRecordHash({
                referralId,
                action: 'convert_to_visit',
                visitId: newVisit.id,
                acceptedBy: userId,
                institutionId,
                timestamp: new Date().toISOString(),
            });
            const patientRow = await db
                .select({ blockchainAddress: patients.blockchainAddress })
                .from(patients)
                .where(eq(patients.id, referral.patientId))
                .limit(1);
            await storeRecordHash(referralId, patientRow[0]?.blockchainAddress ?? '', acceptHash, 'referral_accept').catch(() => { });
            await storeRecordHash(newVisit.id, patientRow[0]?.blockchainAddress ?? '', visitHash, 'visit').catch(() => { });

            // ── Step 6: Audit log ─────────────────────────────────────────────
            await db.insert(auditLogs).values({
                userId,
                userType: userType as any,
                patientId: referral.patientId,
                actionType: 'create',
                resourceType: 'visit',
                resourceId: newVisit.id,
                blockchainTransactionId: crypto.randomBytes(16).toString('hex'),
                ipAddress: c.req.header('x-forwarded-for'),
                accessReason: `Converted from referral ${referral.referralNumber}`,
            });

            if (assignedDoctorId) await notifyPatientAssigned(newVisit.id, assignedDoctorId, 'practitioner');
            notifyDataChanged(referral.referringInstitutionId, userId);

            return c.json({
                success: true,
                data: {
                    visitId: newVisit.id,
                    visitNumber,
                    referralNumber: referral.referralNumber,
                    message: `Referral converted to visit. Patient registered at institution.`,
                },
            }, 201);
        } catch (err: any) {
            console.error('[REFERRAL_CONVERT]', err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    })

    // ══════════════════════════════════════════════════════════════════════════
    // GET /  — Generic list (role-filtered)
    // ══════════════════════════════════════════════════════════════════════════
    .openapi(createRoute({
        tags: ['Referrals'],
        summary: 'List referrals (role-filtered)',
        method: 'get',
        path: '/',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        request: {
            query: z.object({
                patientId: z.string().uuid().optional(),
                status: z.string().optional(),
                limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
                offset: z.string().regex(/^\d+$/).transform(Number).optional().default('0'),
            }),
        },
        responses: {
            200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.any() }) } }, description: 'Referrals' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userType = c.get('userType');
            const userId = c.get('userId');
            const { patientId, status, limit, offset } = c.req.valid('query');

            const conditions: any[] = [];
            if (patientId) conditions.push(eq(referrals.patientId, patientId));
            if (status) conditions.push(eq(referrals.status, status as any));

            if (userType === 'patient')
                conditions.push(eq(referrals.patientId, userId));
            else if (userType === 'practitioner')
                conditions.push(or(eq(referrals.referringPractitionerId, userId), eq(referrals.receivingPractitionerId, userId)));
            // admin sees all

            const result = await db
                .select()
                .from(referrals)
                .where(conditions.length ? and(...conditions) : undefined)
                .orderBy(desc(referrals.referredAt))
                .limit(limit)
                .offset(offset);

            return c.json({ success: true, data: { referrals: result, limit, offset } });
        } catch (err: any) {
            console.error('[REFERRAL_LIST]', err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    })

    // ══════════════════════════════════════════════════════════════════════════
    // GET /:referralId  — Single referral detail
    // ══════════════════════════════════════════════════════════════════════════
    .openapi(createRoute({
        tags: ['Referrals'],
        summary: 'Get a referral by ID',
        method: 'get',
        path: '/:referralId',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        request: { params: z.object({ referralId: z.string().uuid() }) },
        responses: {
            200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.any() }) } }, description: 'Referral' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userType = c.get('userType');
            const userId = c.get('userId');
            const { referralId } = c.req.valid('param');

            const [r] = await db.select().from(referrals).where(eq(referrals.id, referralId)).limit(1);
            if (!r)
                return c.json({ success: false, error: { message: 'Referral not found' } }, 404);

            const hasAccess =
                userType === 'admin' ||
                (userType === 'patient' && r.patientId === userId) ||
                (userType === 'practitioner' && (r.referringPractitionerId === userId || r.receivingPractitionerId === userId)) ||
                (['receptionist'].includes(userType));

            if (!hasAccess)
                return c.json({ success: false, error: { message: 'Access denied' } }, 403);

            const patientName = await getDecryptedPatientName(r.patientId);
            return c.json({ success: true, data: { ...r, patientName } });
        } catch (err: any) {
            console.error('[REFERRAL_GET]', err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    })

    // ══════════════════════════════════════════════════════════════════════════
    // PATCH /:referralId/accept  — Accept (receiving institution practitioner)
    // ══════════════════════════════════════════════════════════════════════════
    .openapi(createRoute({
        tags: ['Referrals'],
        summary: 'Accept a referral',
        method: 'patch',
        path: '/:referralId/accept',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        request: {
            params: z.object({ referralId: z.string().uuid() }),
            body: { content: { 'application/json': { schema: respondReferralSchema } } },
        },
        responses: {
            200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.object({ message: z.string() }) }) } }, description: 'Accepted' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userType = c.get('userType');
            const userId = c.get('userId');
            if (userType !== 'practitioner')
                return c.json({ success: false, error: { message: 'Only practitioners can accept referrals' } }, 403);

            const { referralId } = c.req.valid('param');
            const { responseNotes } = c.req.valid('json');

            const [r] = await db.select().from(referrals).where(eq(referrals.id, referralId)).limit(1);
            if (!r) return c.json({ success: false, error: { message: 'Referral not found' } }, 404);
            if (r.status !== 'pending') return c.json({ success: false, error: { message: `Referral already ${r.status}` } }, 400);

            const practInst = await getPractitionerInstitution(userId);
            if (practInst !== r.receivingInstitutionId)
                return c.json({ success: false, error: { message: 'You must belong to the receiving institution' } }, 403);

            await db.update(referrals).set({ status: 'accepted', acceptedAt: new Date(), responseNotes: responseNotes ?? null }).where(eq(referrals.id, referralId));

            const [pat] = await db.select({ blockchainAddress: patients.blockchainAddress }).from(patients).where(eq(patients.id, r.patientId)).limit(1);
            const hash = generateRecordHash({ referralId, action: 'accept', acceptedBy: userId, timestamp: new Date().toISOString() });
            await storeRecordHash(referralId, pat?.blockchainAddress ?? '', hash, 'referral_accept').catch(() => { });

            return c.json({ success: true, data: { message: 'Referral accepted' } });
        } catch (err: any) {
            console.error('[REFERRAL_ACCEPT]', err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    })

    // ══════════════════════════════════════════════════════════════════════════
    // PATCH /:referralId/reject
    // ══════════════════════════════════════════════════════════════════════════
    .openapi(createRoute({
        tags: ['Referrals'],
        summary: 'Reject a referral',
        method: 'patch',
        path: '/:referralId/reject',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        request: {
            params: z.object({ referralId: z.string().uuid() }),
            body: { content: { 'application/json': { schema: respondReferralSchema } } },
        },
        responses: {
            200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.object({ message: z.string() }) }) } }, description: 'Rejected' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userType = c.get('userType');
            const userId = c.get('userId');
            if (userType !== 'practitioner')
                return c.json({ success: false, error: { message: 'Only practitioners can reject referrals' } }, 403);

            const { referralId } = c.req.valid('param');
            const { responseNotes } = c.req.valid('json');

            const [r] = await db.select().from(referrals).where(eq(referrals.id, referralId)).limit(1);
            if (!r) return c.json({ success: false, error: { message: 'Referral not found' } }, 404);
            if (r.status !== 'pending') return c.json({ success: false, error: { message: `Referral already ${r.status}` } }, 400);

            const practInst = await getPractitionerInstitution(userId);
            if (practInst !== r.receivingInstitutionId)
                return c.json({ success: false, error: { message: 'You must belong to the receiving institution' } }, 403);

            await db.update(referrals).set({ status: 'rejected', responseNotes: responseNotes ?? null }).where(eq(referrals.id, referralId));

            const [pat] = await db.select({ blockchainAddress: patients.blockchainAddress }).from(patients).where(eq(patients.id, r.patientId)).limit(1);
            const hash = generateRecordHash({ referralId, action: 'reject', rejectedBy: userId, timestamp: new Date().toISOString() });
            await storeRecordHash(referralId, pat?.blockchainAddress ?? '', hash, 'referral_reject').catch(() => { });

            return c.json({ success: true, data: { message: 'Referral rejected' } });
        } catch (err: any) {
            console.error('[REFERRAL_REJECT]', err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    })
    // ── ADD THIS to backend/src/routes/referrals.ts ──────────────────────────────
    // Paste before the final semicolon at the bottom of the file.
    // This is the patient-facing endpoint used by the mobile app.

    // ══════════════════════════════════════════════════════════════════════════
    // GET /my  — Patient's own referrals (mobile app)
    // ══════════════════════════════════════════════════════════════════════════
    .openapi(createRoute({
        tags: ['Referrals'],
        summary: 'Get my referrals (patient)',
        method: 'get',
        path: '/my',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        request: {
            query: z.object({
                status: z.string().optional(),
                limit: z.string().regex(/^\d+$/).transform(Number).optional().default('50'),
                offset: z.string().regex(/^\d+$/).transform(Number).optional().default('0'),
            }),
        },
        responses: {
            200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.any() }) } }, description: 'My referrals' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userType = c.get('userType');
            const userId = c.get('userId');

            if (userType !== 'patient')
                return c.json({ success: false, error: { message: 'Patients only' } }, 403);

            const { status, limit, offset } = c.req.valid('query');

            const conditions: any[] = [eq(referrals.patientId, userId)];
            if (status) conditions.push(eq(referrals.status, status as any));

            const rows = await db
                .select({
                    id: referrals.id,
                    referralNumber: referrals.referralNumber,
                    reason: referrals.reason,
                    clinicalSummary: referrals.clinicalSummary,
                    urgency: referrals.urgency,
                    status: referrals.status,
                    referredAt: referrals.referredAt,
                    acceptedAt: referrals.acceptedAt,
                    completedAt: referrals.completedAt,
                    responseNotes: referrals.responseNotes,
                    receivingInstitutionName: institutions.institutionName,
                    receivingInstitutionId: referrals.receivingInstitutionId,
                })
                .from(referrals)
                .innerJoin(institutions, eq(institutions.id, referrals.receivingInstitutionId))
                .where(and(...conditions))
                .orderBy(desc(referrals.referredAt))
                .limit(limit)
                .offset(offset);

            return c.json({
                success: true,
                data: { referrals: rows, total: rows.length },
            });
        } catch (err: any) {
            console.error('[REFERRAL_MY]', err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    })

    // ══════════════════════════════════════════════════════════════════════════
    // PATCH /:referralId/complete
    // ══════════════════════════════════════════════════════════════════════════
    .openapi(createRoute({
        tags: ['Referrals'],
        summary: 'Mark a referral as completed',
        method: 'patch',
        path: '/:referralId/complete',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        request: { params: z.object({ referralId: z.string().uuid() }) },
        responses: {
            200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.object({ message: z.string() }) }) } }, description: 'Completed' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userType = c.get('userType');
            const userId = c.get('userId');
            if (userType !== 'practitioner')
                return c.json({ success: false, error: { message: 'Only practitioners can complete referrals' } }, 403);

            const { referralId } = c.req.valid('param');
            const [r] = await db.select().from(referrals).where(eq(referrals.id, referralId)).limit(1);
            if (!r) return c.json({ success: false, error: { message: 'Referral not found' } }, 404);
            if (r.status !== 'accepted') return c.json({ success: false, error: { message: 'Referral must be accepted first' } }, 400);

            const practInst = await getPractitionerInstitution(userId);
            if (practInst !== r.receivingInstitutionId)
                return c.json({ success: false, error: { message: 'You must belong to the receiving institution' } }, 403);

            await db.update(referrals).set({ status: 'completed', completedAt: new Date() }).where(eq(referrals.id, referralId));

            const [pat] = await db.select({ blockchainAddress: patients.blockchainAddress }).from(patients).where(eq(patients.id, r.patientId)).limit(1);
            const hash = generateRecordHash({ referralId, action: 'complete', completedBy: userId, timestamp: new Date().toISOString() });
            await storeRecordHash(referralId, pat?.blockchainAddress ?? '', hash, 'referral_complete').catch(() => { });

            return c.json({ success: true, data: { message: 'Referral completed' } });
        } catch (err: any) {
            console.error('[REFERRAL_COMPLETE]', err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    })

    // ══════════════════════════════════════════════════════════════════════════
    // PATCH /:referralId/cancel  — Cancel (referring practitioner)
    // ══════════════════════════════════════════════════════════════════════════
    .openapi(createRoute({
        tags: ['Referrals'],
        summary: 'Cancel a referral (referring practitioner only)',
        method: 'patch',
        path: '/:referralId/cancel',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        request: { params: z.object({ referralId: z.string().uuid() }) },
        responses: {
            200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.object({ message: z.string() }) }) } }, description: 'Cancelled' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userType = c.get('userType');
            const userId = c.get('userId');
            if (userType !== 'practitioner')
                return c.json({ success: false, error: { message: 'Only practitioners can cancel referrals' } }, 403);

            const { referralId } = c.req.valid('param');
            const [r] = await db.select().from(referrals).where(eq(referrals.id, referralId)).limit(1);
            if (!r) return c.json({ success: false, error: { message: 'Referral not found' } }, 404);
            if (r.status !== 'pending') return c.json({ success: false, error: { message: 'Only pending referrals can be cancelled' } }, 400);
            if (r.referringPractitionerId !== userId) return c.json({ success: false, error: { message: 'You are not the referring practitioner' } }, 403);

            await db.update(referrals).set({ status: 'cancelled' }).where(eq(referrals.id, referralId));

            const [pat] = await db.select({ blockchainAddress: patients.blockchainAddress }).from(patients).where(eq(patients.id, r.patientId)).limit(1);
            const hash = generateRecordHash({ referralId, action: 'cancel', cancelledBy: userId, timestamp: new Date().toISOString() });
            await storeRecordHash(referralId, pat?.blockchainAddress ?? '', hash, 'referral_cancel').catch(() => { });

            return c.json({ success: true, data: { message: 'Referral cancelled' } });
        } catch (err: any) {
            console.error('[REFERRAL_CANCEL]', err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    });
