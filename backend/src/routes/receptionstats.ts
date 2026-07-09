import { handleError } from '../lib/errors';
import { createRoute, z } from '@hono/zod-openapi';
import { eq, and, sql, count, desc, asc, gte, lt, inArray } from 'drizzle-orm';
import { db } from '../db';
import {
    patients,
    visits,
    consultations,
    diagnoses,
    prescriptions,
    practitioners,
    institutions,
    patientInstitutionRegistrations,
} from '../db/schema';
import { createRouter } from '../lib/create-app';
import { authMiddleware } from '../middleware/auth';
import { decrypt } from '../services/crypto';

// ── Schemas ───────────────────────────────────────────────────────────────────

const errorSchema = z.object({
    success: z.boolean(),
    error: z.object({ message: z.string() }),
});

const successData = z.object({
    success: z.boolean(),
    data: z.object({
        stats: z.object({
            totalPatients: z.number(),
            todayRegistered: z.number(),
            completedToday: z.number(),
            activeVisits: z.number(),
            avgWaitMinutes: z.number(),
            weeklyGrowth: z.number(),
        }),
        queue: z.array(z.object({
            id: z.string(),
            visitNumber: z.string().nullable(),
            chiefComplaint: z.string().nullable(),
            priority: z.string().nullable(),
            status: z.string(),
            admissionDate: z.date(),
            wardOrRoom: z.string().nullable(),
            patientId: z.string(),
            patientName: z.string(),
            gender: z.string().nullable(),
            bloodType: z.string().nullable(),
        })),
        recentRegistrations: z.array(z.object({
            patientId: z.string(),
            patientName: z.string(),
            gender: z.string().nullable(),
            registeredAt: z.date(),
        })),
    }),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function startOfToday(): Date {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d;
}

/** Fetch institutionId for any practitioner/receptionist/admin from the practitioners table */
async function getStaffInstitution(userId: string): Promise<string | null> {
    const staff = await db
        .select({ institutionId: practitioners.institutionId })
        .from(practitioners)
        .where(eq(practitioners.id, userId))
        .limit(1);
    return staff[0]?.institutionId ?? null;
}

// ── Router ────────────────────────────────────────────────────────────────────

export const dashboardRouter = createRouter()

    // ══════════════════════════════════════════════════════════════════════════
    // GET /receptionist  — queue + stats for front-desk staff
    // ══════════════════════════════════════════════════════════════════════════
    .openapi(createRoute({
        tags: ['Dashboard'],
        summary: 'Receptionist dashboard stats + queue',
        method: 'get',
        path: '/receptionist',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        responses: {
            200: { content: { 'application/json': { schema: successData } }, description: 'Dashboard data' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userId = c.get('userId');
            const userType = c.get('userType');

            if (!['receptionist', 'admin'].includes(userType))
                return c.json({ success: false, error: { message: 'Access denied' } }, 403);

            // ── Get institutionId from practitioners table (same as /stats) ──────
            // Do NOT use c.get('institutionId') — it may not be set on the context.
            const institutionId = await getStaffInstitution(userId);

            if (!institutionId)
                return c.json({ success: false, error: { message: 'No institution assigned to this account' } }, 403);

            // ── Patient IDs scoped to this institution ────────────────────────────
            // visits.institution_id EXISTS (confirmed in schema), so we CAN filter
            // visits directly — but patientInstitutionRegistrations is the source of
            // truth for "who is registered here" (used for totalPatients / todayRegistered).
            const scopedPatientSubquery = db
                .select({ patientId: patientInstitutionRegistrations.patientId })
                .from(patientInstitutionRegistrations)
                .where(eq(patientInstitutionRegistrations.institutionId, institutionId));

            // ── Time boundaries ───────────────────────────────────────────────────
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const weekStart = new Date(todayStart);
            weekStart.setDate(weekStart.getDate() - 7);
            const prevWeekStart = new Date(weekStart);
            prevWeekStart.setDate(prevWeekStart.getDate() - 7);

            // ── Run all queries in parallel ───────────────────────────────────────
            const [
                totalPatientsResult,
                todayRegisteredResult,
                completedTodayResult,
                activeVisitsResult,
                weekVisitsResult,
                prevWeekVisitsResult,
                recentRegistrationsRaw,
                queueRaw,
            ] = await Promise.all([

                // Total patients registered at this institution
                db.select({ count: count() })
                    .from(patientInstitutionRegistrations)
                    .where(eq(patientInstitutionRegistrations.institutionId, institutionId)),

                // Patients registered TODAY at this institution
                db.select({ count: count() })
                    .from(patientInstitutionRegistrations)
                    .where(and(
                        eq(patientInstitutionRegistrations.institutionId, institutionId),
                        gte(patientInstitutionRegistrations.registeredAt, todayStart),
                    )),

                // Visits completed TODAY — use visits.institutionId (column exists in schema)
                db.select({ count: count() })
                    .from(visits)
                    .where(and(
                        eq(visits.institutionId, institutionId),
                        eq(visits.status, 'completed'),
                        gte(visits.admissionDate, todayStart),
                    )),

                // Currently active (in-progress) visits
                db.select({ count: count() })
                    .from(visits)
                    .where(and(
                        eq(visits.institutionId, institutionId),
                        eq(visits.status, 'in-progress'),
                    )),

                // This week's visits (for weekly growth numerator)
                db.select({ count: count() })
                    .from(visits)
                    .where(and(
                        eq(visits.institutionId, institutionId),
                        gte(visits.admissionDate, weekStart),
                        lt(visits.admissionDate, todayStart),
                    )),

                // Previous week's visits (for weekly growth denominator)
                db.select({ count: count() })
                    .from(visits)
                    .where(and(
                        eq(visits.institutionId, institutionId),
                        gte(visits.admissionDate, prevWeekStart),
                        lt(visits.admissionDate, weekStart),
                    )),

                // Recent registrations — last 10 patients registered here
                db.select({
                    patientId: patientInstitutionRegistrations.patientId,
                    registeredAt: patientInstitutionRegistrations.registeredAt,
                    firstNameEncrypted: patients.firstNameEncrypted,
                    lastNameEncrypted: patients.lastNameEncrypted,
                    gender: patients.gender,
                })
                    .from(patientInstitutionRegistrations)
                    .innerJoin(patients, eq(patients.id, patientInstitutionRegistrations.patientId))
                    .where(eq(patientInstitutionRegistrations.institutionId, institutionId))
                    .orderBy(desc(patientInstitutionRegistrations.registeredAt))
                    .limit(10),

                // Today's active queue
                db.select({
                    id: visits.id,
                    visitNumber: visits.visitNumber,
                    chiefComplaint: visits.chiefComplaint,
                    priority: visits.priority,
                    status: visits.status,
                    admissionDate: visits.admissionDate,
                    wardOrRoom: visits.wardOrRoom,
                    patientId: visits.patientId,
                    firstNameEncrypted: patients.firstNameEncrypted,
                    lastNameEncrypted: patients.lastNameEncrypted,
                    gender: patients.gender,
                    bloodType: patients.bloodType,
                })
                    .from(visits)
                    .innerJoin(patients, eq(patients.id, visits.patientId))
                    .where(and(
                        eq(visits.institutionId, institutionId),
                        eq(visits.status, 'in-progress'),
                        gte(visits.admissionDate, todayStart),
                    ))
                    .orderBy(asc(visits.admissionDate))
                    .limit(50),
            ]);

            // ── Derive stats ──────────────────────────────────────────────────────
            const totalPatients = Number(totalPatientsResult[0]?.count ?? 0);
            const todayRegistered = Number(todayRegisteredResult[0]?.count ?? 0);
            const completedToday = Number(completedTodayResult[0]?.count ?? 0);
            const activeVisits = Number(activeVisitsResult[0]?.count ?? 0);
            const weekVisits = Number(weekVisitsResult[0]?.count ?? 0);
            const prevWeekVisits = Number(prevWeekVisitsResult[0]?.count ?? 0);

            const weeklyGrowth = prevWeekVisits === 0
                ? (weekVisits > 0 ? 100 : 0)
                : Math.round(((weekVisits - prevWeekVisits) / prevWeekVisits) * 100);

            const waitMins = queueRaw.map((v) =>
                Math.max(0, Math.floor((Date.now() - new Date(v.admissionDate).getTime()) / 60_000))
            );
            const avgWaitMinutes = waitMins.length > 0
                ? Math.round(waitMins.reduce((a, b) => a + b, 0) / waitMins.length)
                : 0;

            // ── Decrypt names ─────────────────────────────────────────────────────
            const decryptedRegistrations = await Promise.all(
                recentRegistrationsRaw.map(async (r) => {
                    let firstName = 'Unknown', lastName = '';
                    try {
                        firstName = r.firstNameEncrypted ? await decrypt(r.firstNameEncrypted) : 'Unknown';
                        lastName = r.lastNameEncrypted ? await decrypt(r.lastNameEncrypted) : '';
                    } catch { }
                    return {
                        patientId: r.patientId,
                        patientName: `${firstName} ${lastName}`.trim(),
                        gender: r.gender,
                        registeredAt: r.registeredAt,
                    };
                })
            );

            const decryptedQueue = await Promise.all(
                queueRaw.map(async (v) => {
                    let firstName = 'Unknown', lastName = '';
                    try {
                        firstName = v.firstNameEncrypted ? await decrypt(v.firstNameEncrypted) : 'Unknown';
                        lastName = v.lastNameEncrypted ? await decrypt(v.lastNameEncrypted) : '';
                    } catch { }
                    return {
                        id: v.id,
                        visitNumber: v.visitNumber,
                        chiefComplaint: v.chiefComplaint,
                        priority: v.priority,
                        status: v.status,
                        admissionDate: v.admissionDate,
                        wardOrRoom: v.wardOrRoom,
                        patientId: v.patientId,
                        patientName: `${firstName} ${lastName}`.trim(),
                        gender: v.gender,
                        bloodType: v.bloodType,
                    };
                })
            );

            return c.json({
                success: true,
                data: {
                    stats: {
                        totalPatients,
                        todayRegistered,
                        completedToday,
                        activeVisits,
                        avgWaitMinutes,
                        weeklyGrowth,
                    },
                    queue: decryptedQueue,
                    recentRegistrations: decryptedRegistrations,
                },
            });

        } catch (err: any) {
            console.error('[RECEPTIONIST_DASHBOARD] Error:', err.message, err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    })

    // ══════════════════════════════════════════════════════════════════════════
    // GET /stats  — doctor/practitioner statistics
    // ══════════════════════════════════════════════════════════════════════════
    .openapi(createRoute({
        tags: ['Dashboard'],
        summary: 'Doctor statistics (institution filtered)',
        method: 'get',
        path: '/stats',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        responses: {
            200: {
                content: {
                    'application/json': {
                        schema: z.object({
                            success: z.boolean(),
                            data: z.object({
                                totalPatients: z.number(),
                                averageConsultationTime: z.number(),
                                completedVisits: z.number(),
                                pendingVisits: z.number(),
                                totalDiagnoses: z.number(),
                                totalPrescriptions: z.number(),
                                activeVisitsToday: z.number(),
                                institutionId: z.string().nullable(),
                            }),
                        }),
                    },
                },
                description: 'Doctor statistics',
            },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userId = c.get('userId');
            const institutionId = await getStaffInstitution(userId);
            const instFilter = institutionId ? eq(visits.institutionId, institutionId) : undefined;
            const today = startOfToday();

            const [
                totalPatientsRes,
                completedVisitsRes,
                pendingVisitsRes,
                diagnosesRes,
                prescriptionsRes,
                activeTodayRes,
                avgConsRes,
            ] = await Promise.all([

                db.select({ c: count() })
                    .from(patients)
                    .where(eq(patients.isActive, true)),

                db.select({ c: count() })
                    .from(visits)
                    .where(and(eq(visits.status, 'completed'), instFilter)),

                db.select({ c: count() })
                    .from(visits)
                    .where(and(eq(visits.status, 'in-progress'), instFilter)),

                db.select({ c: count() })
                    .from(diagnoses)
                    .innerJoin(visits, eq(diagnoses.visitId, visits.id))
                    .where(instFilter),

                db.select({ c: count() })
                    .from(prescriptions)
                    .innerJoin(visits, eq(prescriptions.visitId, visits.id))
                    .where(instFilter),

                db.select({ c: count() })
                    .from(visits)
                    .where(and(
                        eq(visits.status, 'in-progress'),
                        gte(visits.admissionDate, today),
                        instFilter,
                    )),

                db.select({
                    avgMinutes: sql<number>`
                        CAST(
                            AVG(
                                EXTRACT(EPOCH FROM (${consultations.createdAt} - ${visits.admissionDate})) / 60
                            ) AS DECIMAL
                        )
                    `,
                })
                    .from(consultations)
                    .innerJoin(visits, eq(consultations.visitId, visits.id))
                    .where(instFilter),
            ]);

            return c.json({
                success: true,
                data: {
                    totalPatients: Number(totalPatientsRes[0]?.c ?? 0),
                    averageConsultationTime: Math.round(Number(avgConsRes[0]?.avgMinutes ?? 0)),
                    completedVisits: Number(completedVisitsRes[0]?.c ?? 0),
                    pendingVisits: Number(pendingVisitsRes[0]?.c ?? 0),
                    totalDiagnoses: Number(diagnosesRes[0]?.c ?? 0),
                    totalPrescriptions: Number(prescriptionsRes[0]?.c ?? 0),
                    activeVisitsToday: Number(activeTodayRes[0]?.c ?? 0),
                    institutionId: institutionId ?? null,
                },
            });

        } catch (err: any) {
            console.error('[DOCTOR_STATS] Error:', err.message, err.stack);
            return c.json({ success: false, error: { message: 'Failed to fetch statistics' } }, 500);
        }
    });