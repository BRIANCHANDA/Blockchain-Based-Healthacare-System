import { createRoute, z } from '@hono/zod-openapi';
import { eq, and, desc, asc, gte, lte, sql, inArray } from 'drizzle-orm';
import { db } from '../db';
import {
    visits, patients, practitioners, institutions,
    auditLogs,
} from '../db/schema';
import { createRouter } from '../lib/create-app';
import { authMiddleware } from '../middleware/auth';
import { generateRecordHash, decrypt } from '../services/crypto';
import { storeRecordHash } from '../services/fabric';
import crypto from 'crypto';

const errorSchema = z.object({ success: z.boolean(), error: z.object({ message: z.string() }) });
const successData = z.object({ success: z.boolean(), data: z.any() });

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getStaffInstitution(userId: string): Promise<string | null> {
    const row = await db
        .select({ institutionId: practitioners.institutionId })
        .from(practitioners)
        .where(eq(practitioners.id, userId))
        .limit(1);
    return row[0]?.institutionId ?? null;
}

async function decryptName(first: string, last: string): Promise<string> {
    try {
        return `${decrypt(first)} ${decrypt(last)}`.trim();
    } catch {
        return 'Unknown';
    }
}

// ── Router ────────────────────────────────────────────────────────────────────

export const appointmentRouter = createRouter()

    // ══════════════════════════════════════════════════════════════════════════
    // GET /appointments
    // List scheduled appointments for the caller's institution.
    // Returns admittingDiagnosis and createdByPractitionerId so the frontend
    // can distinguish internal referrals (APT- prefix + admittingDiagnosis set)
    // and split them into incoming vs outgoing.
    // ══════════════════════════════════════════════════════════════════════════
    .openapi(createRoute({
        tags: ['Appointments'],
        summary: 'List appointments for the institution',
        method: 'get',
        path: '/',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        request: {
            query: z.object({
                status: z.enum(['scheduled', 'in-progress', 'completed', 'cancelled']).optional(),
                doctorId: z.string().uuid().optional(),
                from: z.string().optional(),
                to: z.string().optional(),
                limit: z.string().regex(/^\d+$/).transform(Number).optional().default('50'),
                offset: z.string().regex(/^\d+$/).transform(Number).optional().default('0'),
            }),
        },
        responses: {
            200: { content: { 'application/json': { schema: successData } }, description: 'Appointments list' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userType = c.get('userType');
            const userId = c.get('userId');

            if (!['receptionist', 'practitioner', 'nurse', 'admin'].includes(userType))
                return c.json({ success: false, error: { message: 'Access denied' } }, 403);

            const institutionId = await getStaffInstitution(userId);
            if (!institutionId)
                return c.json({ success: false, error: { message: 'No institution assigned' } }, 403);

            const { status, doctorId, from, to, limit, offset } = c.req.valid('query');

            const conditions: any[] = [eq(visits.institutionId, institutionId)];
            conditions.push(eq(visits.status, (status ?? 'scheduled') as any));
            if (doctorId) conditions.push(eq(visits.assignedDoctorId, doctorId));
            if (from) conditions.push(gte(visits.admissionDate, new Date(from)));
            if (to) conditions.push(lte(visits.admissionDate, new Date(to)));

            // Two practitioner joins: assigned doctor + referring doctor
            const assignedDoc = { id: practitioners.id, first: practitioners.firstNameEncrypted, last: practitioners.lastNameEncrypted, spec: practitioners.specialization };

            const rows = await db
                .select({
                    id: visits.id,
                    visitNumber: visits.visitNumber,
                    visitType: visits.visitType,
                    priority: visits.priority,
                    status: visits.status,
                    admissionDate: visits.admissionDate,
                    chiefComplaint: visits.chiefComplaint,
                    admittingDiagnosis: visits.admittingDiagnosis,      // referral reason
                    wardOrRoom: visits.wardOrRoom,
                    patientId: visits.patientId,
                    assignedDoctorId: visits.assignedDoctorId,
                    createdByPractitionerId: visits.createdByPractitionerId, // who booked it
                    patientFirst: patients.firstNameEncrypted,
                    patientLast: patients.lastNameEncrypted,
                    gender: patients.gender,
                    bloodType: patients.bloodType,
                    doctorFirst: practitioners.firstNameEncrypted,
                    doctorLast: practitioners.lastNameEncrypted,
                    specialization: practitioners.specialization,
                })
                .from(visits)
                .innerJoin(patients, eq(patients.id, visits.patientId))
                .leftJoin(practitioners, eq(practitioners.id, visits.assignedDoctorId))
                .where(and(...conditions))
                .orderBy(asc(visits.admissionDate))
                .limit(limit)
                .offset(offset);

            // For internal referrals we also need the referring doctor's name.
            // createdByPractitionerId points to who booked the appointment.
            // Fetch those names in a second pass (only for rows that need it).
            const referrerIds = [...new Set(
                rows
                    .filter(r => r.createdByPractitionerId && r.createdByPractitionerId !== r.assignedDoctorId)
                    .map(r => r.createdByPractitionerId!)
            )];

            const referrerMap = new Map<string, string>();
            if (referrerIds.length) {
                const referrers = await db
                    .select({ id: practitioners.id, first: practitioners.firstNameEncrypted, last: practitioners.lastNameEncrypted })
                    .from(practitioners)
                    .where(referrerIds.length === 1
                        ? eq(practitioners.id, referrerIds[0])
                        : inArray(practitioners.id, referrerIds)
                    );

                for (const r of referrers) {
                    referrerMap.set(r.id, await decryptName(r.first, r.last));
                }
            }

            const decrypted = await Promise.all(rows.map(async (r) => {
                const { patientFirst, patientLast, doctorFirst, doctorLast, ...rest } = r;
                return {
                    ...rest,
                    patientName: await decryptName(patientFirst, patientLast),
                    doctorName: doctorFirst && doctorLast ? await decryptName(doctorFirst, doctorLast) : null,
                    referringDoctorName: r.createdByPractitionerId
                        ? (referrerMap.get(r.createdByPractitionerId) ?? null)
                        : null,
                };
            }));

            return c.json({ success: true, data: { appointments: decrypted, total: decrypted.length, limit, offset } });
        } catch (err: any) {
            console.error('[APPOINTMENTS_LIST]', err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    })

    // ══════════════════════════════════════════════════════════════════════════
    // GET /appointments/today
    // ══════════════════════════════════════════════════════════════════════════
    .openapi(createRoute({
        tags: ['Appointments'],
        summary: "Today's appointments",
        method: 'get',
        path: '/today',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        responses: {
            200: { content: { 'application/json': { schema: successData } }, description: "Today's appointments" },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userType = c.get('userType');
            const userId = c.get('userId');

            if (!['receptionist', 'practitioner', 'nurse', 'admin'].includes(userType))
                return c.json({ success: false, error: { message: 'Access denied' } }, 403);

            const institutionId = await getStaffInstitution(userId);
            if (!institutionId)
                return c.json({ success: false, error: { message: 'No institution assigned' } }, 403);

            const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
            const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

            const rows = await db
                .select({
                    id: visits.id,
                    visitNumber: visits.visitNumber,
                    visitType: visits.visitType,
                    priority: visits.priority,
                    status: visits.status,
                    admissionDate: visits.admissionDate,
                    chiefComplaint: visits.chiefComplaint,
                    admittingDiagnosis: visits.admittingDiagnosis,
                    wardOrRoom: visits.wardOrRoom,
                    patientId: visits.patientId,
                    assignedDoctorId: visits.assignedDoctorId,
                    createdByPractitionerId: visits.createdByPractitionerId,
                    patientFirst: patients.firstNameEncrypted,
                    patientLast: patients.lastNameEncrypted,
                    gender: patients.gender,
                    bloodType: patients.bloodType,
                    doctorFirst: practitioners.firstNameEncrypted,
                    doctorLast: practitioners.lastNameEncrypted,
                })
                .from(visits)
                .innerJoin(patients, eq(patients.id, visits.patientId))
                .leftJoin(practitioners, eq(practitioners.id, visits.assignedDoctorId))
                .where(and(
                    eq(visits.institutionId, institutionId),
                    eq(visits.status, 'scheduled'),
                    gte(visits.admissionDate, todayStart),
                    lte(visits.admissionDate, todayEnd),
                ))
                .orderBy(asc(visits.admissionDate));

            const decrypted = await Promise.all(rows.map(async (r) => {
                const { patientFirst, patientLast, doctorFirst, doctorLast, ...rest } = r;
                return {
                    ...rest,
                    patientName: await decryptName(patientFirst, patientLast),
                    doctorName: doctorFirst && doctorLast ? await decryptName(doctorFirst, doctorLast) : null,
                };
            }));

            return c.json({ success: true, data: { appointments: decrypted, total: decrypted.length } });
        } catch (err: any) {
            console.error('[APPOINTMENTS_TODAY]', err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    })

    // ══════════════════════════════════════════════════════════════════════════
    // GET /appointments/follow-ups
    // Discharged patients with a followUpDate set — for receptionist booking.
    // ══════════════════════════════════════════════════════════════════════════
    .openapi(createRoute({
        tags: ['Appointments'],
        summary: 'Patients due for follow-up',
        method: 'get',
        path: '/follow-ups',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        request: {
            query: z.object({
                days: z.string().regex(/^\d+$/).transform(Number).optional().default('30'),
            }),
        },
        responses: {
            200: { content: { 'application/json': { schema: successData } }, description: 'Follow-ups due' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userType = c.get('userType');
            const userId = c.get('userId');

            if (!['receptionist', 'practitioner', 'admin'].includes(userType))
                return c.json({ success: false, error: { message: 'Access denied' } }, 403);

            const institutionId = await getStaffInstitution(userId);
            if (!institutionId)
                return c.json({ success: false, error: { message: 'No institution assigned' } }, 403);

            const { days } = c.req.valid('query');
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() + days);

            const rows = await db.execute(sql`
                SELECT
                    v.id                      AS "visitId",
                    v.visit_number            AS "visitNumber",
                    v.discharge_date          AS "dischargeDate",
                    v.follow_up_date          AS "followUpDate",
                    v.discharge_diagnosis     AS "dischargeDiagnosis",
                    v.discharge_instructions  AS "dischargeInstructions",
                    v.patient_id              AS "patientId",
                    v.assigned_doctor_id      AS "assignedDoctorId",
                    p.first_name_encrypted    AS "patientFirst",
                    p.last_name_encrypted     AS "patientLast",
                    p.gender,
                    p.blood_type              AS "bloodType",
                    doc.first_name_encrypted  AS "doctorFirst",
                    doc.last_name_encrypted   AS "doctorLast",
                    doc.specialization,
                    EXISTS (
                        SELECT 1 FROM visits sv
                        WHERE sv.patient_id     = v.patient_id
                          AND sv.institution_id = v.institution_id
                          AND sv.status         = 'scheduled'
                          AND sv.admission_date >= NOW()
                    ) AS "alreadyBooked"
                FROM visits v
                JOIN patients p ON p.id = v.patient_id
                LEFT JOIN practitioners doc ON doc.id = v.assigned_doctor_id
                WHERE v.institution_id = ${institutionId}
                  AND v.status         = 'completed'
                  AND v.follow_up_date IS NOT NULL
                  AND v.follow_up_date >= NOW()
                  AND v.follow_up_date <= ${cutoff.toISOString()}
                ORDER BY v.follow_up_date ASC
                LIMIT 100
            `);

            const result = await Promise.all((rows as any[]).map(async (r) => ({
                visitId: r.visitId,
                visitNumber: r.visitNumber,
                dischargeDate: r.dischargeDate,
                followUpDate: r.followUpDate,
                dischargeDiagnosis: r.dischargeDiagnosis,
                dischargeInstructions: r.dischargeInstructions,
                patientId: r.patientId,
                patientName: await decryptName(r.patientFirst, r.patientLast),
                gender: r.gender,
                bloodType: r.bloodType,
                assignedDoctorId: r.assignedDoctorId,
                doctorName: r.doctorFirst ? await decryptName(r.doctorFirst, r.doctorLast) : null,
                specialization: r.specialization,
                alreadyBooked: r.alreadyBooked === true || r.alreadyBooked === 't',
                daysUntilDue: Math.ceil((new Date(r.followUpDate).getTime() - Date.now()) / 86_400_000),
            })));

            return c.json({ success: true, data: { followUps: result, total: result.length } });
        } catch (err: any) {
            console.error('[FOLLOW_UPS]', err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    })

    // ══════════════════════════════════════════════════════════════════════════
    // POST /appointments
    // Book a new appointment (scheduled visit).
    // Also used by InternalReferralModal — passes admittingDiagnosis as
    // the referral reason and assignedDoctorId as the receiving specialist.
    // createdByPractitionerId is set to the caller so the referrals page
    // can correctly split incoming vs outgoing internal referrals.
    // ══════════════════════════════════════════════════════════════════════════
    .openapi(createRoute({
        tags: ['Appointments'],
        summary: 'Book a new appointment',
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
                            appointmentDate: z.string().datetime(),
                            visitType: z.enum(['outpatient', 'inpatient', 'emergency', 'consultation']).default('consultation'),
                            priority: z.enum(['routine', 'urgent', 'emergency', 'critical']).default('routine'),
                            chiefComplaint: z.string().min(5),
                            admittingDiagnosis: z.string().optional(), // referral reason for internal referrals
                            assignedDoctorId: z.string().uuid().optional(),
                            wardOrRoom: z.string().optional(),
                            originVisitId: z.string().uuid().optional(),
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
                            data: z.object({ appointmentId: z.string(), visitNumber: z.string() }),
                        }),
                    },
                },
                description: 'Appointment booked',
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

            if (!['receptionist', 'practitioner', 'admin'].includes(userType))
                return c.json({ success: false, error: { message: 'Only receptionists and doctors can book appointments' } }, 403);

            const body = c.req.valid('json');
            const ip = c.req.header('x-forwarded-for');

            const institutionId = await getStaffInstitution(userId);
            if (!institutionId)
                return c.json({ success: false, error: { message: 'No institution assigned' } }, 403);

            const apptDate = new Date(body.appointmentDate);
            if (apptDate <= new Date())
                return c.json({ success: false, error: { message: 'Appointment date must be in the future' } }, 400);

            const patient = await db
                .select({ id: patients.id, blockchainAddress: patients.blockchainAddress })
                .from(patients)
                .where(eq(patients.id, body.patientId))
                .limit(1);
            if (!patient.length)
                return c.json({ success: false, error: { message: 'Patient not found' } }, 404);

            if (body.assignedDoctorId) {
                const doctor = await db
                    .select({ id: practitioners.id })
                    .from(practitioners)
                    .where(and(
                        eq(practitioners.id, body.assignedDoctorId),
                        eq(practitioners.institutionId, institutionId),
                        eq(practitioners.role, 'practitioner'),
                    ))
                    .limit(1);
                if (!doctor.length)
                    return c.json({ success: false, error: { message: 'Doctor not found at this institution' } }, 404);
            }

            const visitNumber = `APT-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
            const visitHash = generateRecordHash({
                patientId: body.patientId,
                visitNumber,
                appointmentDate: body.appointmentDate,
                bookedBy: userId,
                timestamp: new Date().toISOString(),
            });

            const [newVisit] = await db.insert(visits).values({
                patientId: body.patientId,
                institutionId,
                visitNumber,
                visitType: body.visitType,
                priority: body.priority,
                chiefComplaint: body.chiefComplaint,
                admittingDiagnosis: body.admittingDiagnosis ?? null,
                admissionDate: apptDate,
                status: 'scheduled',
                assignedDoctorId: body.assignedDoctorId ?? null,
                wardOrRoom: body.wardOrRoom ?? null,
                blockchainHash: visitHash,
                createdByPractitionerId: userId,  // track who booked — used to split incoming/outgoing
            }).returning({ id: visits.id, visitNumber: visits.visitNumber });

            await storeRecordHash(newVisit.id, patient[0].blockchainAddress, visitHash, 'appointment');

            await db.insert(auditLogs).values({
                userId,
                userType: userType as any,
                patientId: body.patientId,
                actionType: 'create',
                resourceType: 'appointment',
                resourceId: newVisit.id,
                blockchainTransactionId: crypto.randomBytes(16).toString('hex'),
                ipAddress: ip,
                accessReason: body.originVisitId
                    ? `Follow-up from visit ${body.originVisitId}`
                    : body.admittingDiagnosis
                        ? `Internal referral: ${body.admittingDiagnosis.slice(0, 80)}`
                        : 'New appointment',
            });

            return c.json({ success: true, data: { appointmentId: newVisit.id, visitNumber: newVisit.visitNumber } }, 201);
        } catch (err: any) {
            console.error('[APPOINTMENT_CREATE]', err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    })

    // ══════════════════════════════════════════════════════════════════════════
    // PATCH /appointments/:appointmentId/confirm
    // Patient arrived — flip status to in-progress.
    // ══════════════════════════════════════════════════════════════════════════
    .openapi(createRoute({
        tags: ['Appointments'],
        summary: 'Confirm patient arrival — convert appointment to active visit',
        method: 'patch',
        path: '/:appointmentId/confirm',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        request: {
            params: z.object({ appointmentId: z.string().uuid() }),
            body: {
                content: {
                    'application/json': {
                        schema: z.object({
                            assignedNurseId: z.string().uuid().optional(),
                            assignedDoctorId: z.string().uuid().optional(),
                            wardOrRoom: z.string().optional(),
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
                            data: z.object({ visitId: z.string(), visitNumber: z.string(), message: z.string() }),
                        }),
                    },
                },
                description: 'Appointment confirmed',
            },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
            409: { content: { 'application/json': { schema: errorSchema } }, description: 'Not scheduled' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userType = c.get('userType');
            const userId = c.get('userId');

            if (!['receptionist', 'admin'].includes(userType))
                return c.json({ success: false, error: { message: 'Only receptionists can confirm arrivals' } }, 403);

            const { appointmentId } = c.req.valid('param');
            const body = c.req.valid('json');
            const ip = c.req.header('x-forwarded-for');
            const institutionId = await getStaffInstitution(userId);

            const [appt] = await db.select().from(visits).where(eq(visits.id, appointmentId)).limit(1);
            if (!appt)
                return c.json({ success: false, error: { message: 'Appointment not found' } }, 404);
            if (appt.institutionId !== institutionId)
                return c.json({ success: false, error: { message: 'Appointment belongs to another institution' } }, 403);
            if (appt.status !== 'scheduled')
                return c.json({ success: false, error: { message: `Cannot confirm — appointment is already ${appt.status}` } }, 409);

            const updates: any = {
                status: 'in-progress',
                admissionDate: new Date(),
                updatedAt: new Date(),
            };
            if (body.assignedNurseId) updates.assignedNurseId = body.assignedNurseId;
            if (body.assignedDoctorId) updates.assignedDoctorId = body.assignedDoctorId;
            if (body.wardOrRoom) updates.wardOrRoom = body.wardOrRoom;

            const [updated] = await db
                .update(visits).set(updates).where(eq(visits.id, appointmentId))
                .returning({ id: visits.id, visitNumber: visits.visitNumber });

            await db.insert(auditLogs).values({
                userId,
                userType: userType as any,
                patientId: appt.patientId,
                actionType: 'update',
                resourceType: 'appointment',
                resourceId: appointmentId,
                blockchainTransactionId: crypto.randomBytes(16).toString('hex'),
                ipAddress: ip,
                accessReason: 'Patient arrival confirmed',
            });

            return c.json({ success: true, data: { visitId: updated.id, visitNumber: updated.visitNumber, message: 'Patient checked in — visit is now active' } });
        } catch (err: any) {
            console.error('[APPOINTMENT_CONFIRM]', err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    })

    // ══════════════════════════════════════════════════════════════════════════
    // PATCH /appointments/:appointmentId/cancel
    // ══════════════════════════════════════════════════════════════════════════
    .openapi(createRoute({
        tags: ['Appointments'],
        summary: 'Cancel a scheduled appointment',
        method: 'patch',
        path: '/:appointmentId/cancel',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        request: {
            params: z.object({ appointmentId: z.string().uuid() }),
            body: {
                content: {
                    'application/json': {
                        schema: z.object({ reason: z.string().min(5) }),
                    },
                },
            },
        },
        responses: {
            200: { content: { 'application/json': { schema: successData } }, description: 'Cancelled' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
            409: { content: { 'application/json': { schema: errorSchema } }, description: 'Cannot cancel' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userType = c.get('userType');
            const userId = c.get('userId');

            if (!['receptionist', 'practitioner', 'admin'].includes(userType))
                return c.json({ success: false, error: { message: 'Access denied' } }, 403);

            const { appointmentId } = c.req.valid('param');
            const { reason } = c.req.valid('json');
            const institutionId = await getStaffInstitution(userId);

            const [appt] = await db
                .select({ id: visits.id, status: visits.status, institutionId: visits.institutionId, patientId: visits.patientId })
                .from(visits).where(eq(visits.id, appointmentId)).limit(1);

            if (!appt)
                return c.json({ success: false, error: { message: 'Appointment not found' } }, 404);
            if (appt.institutionId !== institutionId)
                return c.json({ success: false, error: { message: 'Appointment belongs to another institution' } }, 403);
            if (appt.status !== 'scheduled')
                return c.json({ success: false, error: { message: `Cannot cancel — appointment is ${appt.status}` } }, 409);

            await db.update(visits).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(visits.id, appointmentId));

            await db.insert(auditLogs).values({
                userId,
                userType: userType as any,
                patientId: appt.patientId,
                actionType: 'update',
                resourceType: 'appointment',
                resourceId: appointmentId,
                blockchainTransactionId: crypto.randomBytes(16).toString('hex'),
                accessReason: `Cancelled: ${reason}`,
            });

            return c.json({ success: true, data: { message: 'Appointment cancelled' } });
        } catch (err: any) {
            console.error('[APPOINTMENT_CANCEL]', err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    })

    // ══════════════════════════════════════════════════════════════════════════
    // PATCH /appointments/:appointmentId/reschedule
    // ══════════════════════════════════════════════════════════════════════════
    .openapi(createRoute({
        tags: ['Appointments'],
        summary: 'Reschedule an appointment',
        method: 'patch',
        path: '/:appointmentId/reschedule',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        request: {
            params: z.object({ appointmentId: z.string().uuid() }),
            body: {
                content: {
                    'application/json': {
                        schema: z.object({
                            appointmentDate: z.string().datetime(),
                            assignedDoctorId: z.string().uuid().optional(),
                            reason: z.string().optional(),
                        }),
                    },
                },
            },
        },
        responses: {
            200: { content: { 'application/json': { schema: successData } }, description: 'Rescheduled' },
            400: { content: { 'application/json': { schema: errorSchema } }, description: 'Bad request' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
            409: { content: { 'application/json': { schema: errorSchema } }, description: 'Cannot reschedule' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userType = c.get('userType');
            const userId = c.get('userId');

            if (!['receptionist', 'practitioner', 'admin'].includes(userType))
                return c.json({ success: false, error: { message: 'Access denied' } }, 403);

            const { appointmentId } = c.req.valid('param');
            const body = c.req.valid('json');
            const institutionId = await getStaffInstitution(userId);

            const newDate = new Date(body.appointmentDate);
            if (newDate <= new Date())
                return c.json({ success: false, error: { message: 'New appointment date must be in the future' } }, 400);

            const [appt] = await db
                .select({ id: visits.id, status: visits.status, institutionId: visits.institutionId, patientId: visits.patientId })
                .from(visits).where(eq(visits.id, appointmentId)).limit(1);

            if (!appt)
                return c.json({ success: false, error: { message: 'Appointment not found' } }, 404);
            if (appt.institutionId !== institutionId)
                return c.json({ success: false, error: { message: 'Appointment belongs to another institution' } }, 403);
            if (appt.status !== 'scheduled')
                return c.json({ success: false, error: { message: `Cannot reschedule — appointment is ${appt.status}` } }, 409);

            const updates: any = { admissionDate: newDate, updatedAt: new Date() };
            if (body.assignedDoctorId) updates.assignedDoctorId = body.assignedDoctorId;

            await db.update(visits).set(updates).where(eq(visits.id, appointmentId));

            await db.insert(auditLogs).values({
                userId,
                userType: userType as any,
                patientId: appt.patientId,
                actionType: 'update',
                resourceType: 'appointment',
                resourceId: appointmentId,
                blockchainTransactionId: crypto.randomBytes(16).toString('hex'),
                accessReason: `Rescheduled to ${newDate.toISOString()}${body.reason ? `: ${body.reason}` : ''}`,
            });

            return c.json({ success: true, data: { message: 'Appointment rescheduled', newDate: newDate.toISOString() } });
        } catch (err: any) {
            console.error('[APPOINTMENT_RESCHEDULE]', err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    });