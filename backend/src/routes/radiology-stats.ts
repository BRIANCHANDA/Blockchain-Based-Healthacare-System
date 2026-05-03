import { createRoute, z } from '@hono/zod-openapi';
import { eq, and, sql, gte, lt, count, desc } from 'drizzle-orm';
import { db } from '../db';
import {
    patients,
    patientInstitutionRegistrations,
    visits,
    consultations,
    practitioners,
} from '../db/schema';
import { createRouter } from '../lib/create-app';
import { authMiddleware } from '../middleware/auth';
import { decrypt } from '../services/crypto';

// ── Zod Schemas ──────────────────────────────────────────

const errorSchema = z.object({
    success: z.boolean(),
    error: z.object({ message: z.string() }),
});

const dashboardResponseSchema = z.object({
    success: z.boolean(),
    data: z.object({
        stats: z.object({
            totalPatients: z.number(),
            todayRegistered: z.number(),
            queueLength: z.number(),
            avgWaitMinutes: z.number(),
            completedToday: z.number(),
            weeklyGrowth: z.number(),
        }),
        queue: z.array(
            z.object({
                id: z.string(),
                patientId: z.string(),
                ticket: z.string(),
                name: z.string(),
                age: z.number(),
                reason: z.string(),
                priority: z.string(),
                doctor: z.string().nullable(),
                waitMins: z.number(),
                status: z.string(),
            })
        ),
        recent: z.array(
            z.object({
                id: z.string(),
                name: z.string(),
                time: z.string(),
                type: z.enum(['New Patient', 'Returning']),
            })
        ),
    }),
});

// ── Helpers ──────────────────────────────────────────────

function startOfToday(): Date {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d;
}

function formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
}

async function getStaffInstitution(userId: string): Promise<string | null> {
    const staff = await db
        .select({ institutionId: practitioners.institutionId })
        .from(practitioners)
        .where(eq(practitioners.id, userId))
        .limit(1);
    return staff[0]?.institutionId || null;
}

// ── Router ───────────────────────────────────────────────

export const radiologyStatsRouter = createRouter()

    .openapi(
        createRoute({
            tags: ['Dashboard'],
            summary: 'Receptionist dashboard data (filtered by institution)',
            method: 'get',
            path: '/receptionist',
            security: [{ bearerAuth: [] }],
            middleware: [authMiddleware],
            responses: {
                200: {
                    content: { 'application/json': { schema: dashboardResponseSchema } },
                    description: 'Dashboard data for receptionist',
                },
                403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
                500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
            },
        }),
        async (c) => {
            try {
                const userType = c.get('userType');
                const userId = c.get('userId');
                if (!['receptionist', 'admin'].includes(userType)) {
                    return c.json(
                        { success: false, error: { message: 'Access denied. Receptionist role required.' } },
                        403
                    );
                }

                const staffInstitutionId = await getStaffInstitution(userId);
                if (!staffInstitutionId && userType !== 'admin') {
                    return c.json(
                        { success: false, error: { message: 'User not associated with any institution.' } },
                        403
                    );
                }

                const institutionFilter = userType === 'admin' && !staffInstitutionId
                    ? undefined
                    : eq(visits.institutionId, staffInstitutionId);

                const today = startOfToday();
                const tomorrow = new Date(today);
                tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

                // ── Patient stats filtered by institution using patient_institution_registrations ──
                // Total patients registered at this institution
                const [totalPatients] = await db
                    .select({ value: count() })
                    .from(patientInstitutionRegistrations)
                    .where(
                        and(
                            eq(patientInstitutionRegistrations.institutionId, staffInstitutionId),
                            eq(patientInstitutionRegistrations.isActive, true)
                        )
                    );

                // Patients registered at this institution today
                const [todayRegistered] = await db
                    .select({ value: count() })
                    .from(patientInstitutionRegistrations)
                    .where(
                        and(
                            eq(patientInstitutionRegistrations.institutionId, staffInstitutionId),
                            eq(patientInstitutionRegistrations.isActive, true),
                            gte(patientInstitutionRegistrations.registeredAt, today),
                            lt(patientInstitutionRegistrations.registeredAt, tomorrow)
                        )
                    );

                // ── Weekly growth for this institution ──
                const sevenDaysAgo = new Date(today);
                sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
                const fourteenDaysAgo = new Date(today);
                fourteenDaysAgo.setUTCDate(fourteenDaysAgo.getUTCDate() - 14);

                const [last7] = await db
                    .select({ value: count() })
                    .from(patientInstitutionRegistrations)
                    .where(
                        and(
                            eq(patientInstitutionRegistrations.institutionId, staffInstitutionId),
                            eq(patientInstitutionRegistrations.isActive, true),
                            gte(patientInstitutionRegistrations.registeredAt, sevenDaysAgo),
                            lt(patientInstitutionRegistrations.registeredAt, today)
                        )
                    );

                const [prev7] = await db
                    .select({ value: count() })
                    .from(patientInstitutionRegistrations)
                    .where(
                        and(
                            eq(patientInstitutionRegistrations.institutionId, staffInstitutionId),
                            eq(patientInstitutionRegistrations.isActive, true),
                            gte(patientInstitutionRegistrations.registeredAt, fourteenDaysAgo),
                            lt(patientInstitutionRegistrations.registeredAt, sevenDaysAgo)
                        )
                    );

                const weeklyGrowth =
                    prev7.value === 0
                        ? last7.value > 0
                            ? 100
                            : 0
                        : Math.round(((last7.value - prev7.value) / prev7.value) * 100 * 10) / 10;

                // ── Queue: visits today, not completed/cancelled, filtered by institution ──
                const queueVisits = await db
                    .select({
                        id: visits.id,
                        visitNumber: visits.visitNumber,
                        patientId: visits.patientId,
                        chiefComplaint: visits.chiefComplaint,
                        priority: visits.priority,
                        status: visits.status,
                        admissionDate: visits.admissionDate,
                    })
                    .from(visits)
                    .where(
                        and(
                            gte(visits.admissionDate, today),
                            lt(visits.admissionDate, tomorrow),
                            sql`${visits.status} NOT IN ('completed', 'cancelled')`,
                            institutionFilter
                        )
                    );

                const queueLength = queueVisits.length;

                let avgWaitMinutes = 0;
                if (queueLength > 0) {
                    const now = new Date();
                    const totalWait = queueVisits.reduce((sum, v) => {
                        const mins = (now.getTime() - v.admissionDate.getTime()) / 60000;
                        return sum + mins;
                    }, 0);
                    avgWaitMinutes = Math.round(totalWait / queueLength);
                }

                // Completed today at this institution
                const [completedToday] = await db
                    .select({ value: count() })
                    .from(visits)
                    .where(
                        and(
                            eq(visits.status, 'completed'),
                            gte(visits.dischargeDate, today),
                            lt(visits.dischargeDate, tomorrow),
                            institutionFilter
                        )
                    );

                // ── Build queue list (enriched with patient info) ──
                const queue = await Promise.all(
                    queueVisits.map(async (v) => {
                        const patientRec = await db
                            .select({
                                id: patients.id,
                                firstNameEncrypted: patients.firstNameEncrypted,
                                lastNameEncrypted: patients.lastNameEncrypted,
                                dateOfBirthEncrypted: patients.dateOfBirthEncrypted,
                            })
                            .from(patients)
                            .where(eq(patients.id, v.patientId))
                            .limit(1);

                        if (!patientRec.length) return null;

                        const p = patientRec[0];

                        let firstName = 'Unknown';
                        try {
                            firstName = decrypt(p.firstNameEncrypted);
                        } catch (err) {
                            console.error(`Failed to decrypt firstName for patient ${p.id}:`, err);
                        }

                        let lastName = 'Unknown';
                        try {
                            lastName = decrypt(p.lastNameEncrypted);
                        } catch (err) {
                            console.error(`Failed to decrypt lastName for patient ${p.id}:`, err);
                        }

                        const name = `${firstName} ${lastName}`.trim();

                        let dobStr = '1970-01-01';
                        try {
                            dobStr = decrypt(p.dateOfBirthEncrypted);
                        } catch (err) {
                            console.error(`Failed to decrypt dateOfBirth for patient ${p.id}:`, err);
                        }

                        const dob = new Date(dobStr);
                        const age = isNaN(dob.getTime())
                            ? 0
                            : Math.floor((new Date().getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

                        let doctorName: string | null = null;
                        const consultation = await db
                            .select({ practitionerId: consultations.practitionerId })
                            .from(consultations)
                            .where(eq(consultations.visitId, v.id))
                            .orderBy(consultations.consultationDate)
                            .limit(1);

                        if (consultation.length) {
                            const prac = await db
                                .select({
                                    firstNameEncrypted: practitioners.firstNameEncrypted,
                                    lastNameEncrypted: practitioners.lastNameEncrypted,
                                })
                                .from(practitioners)
                                .where(eq(practitioners.id, consultation[0].practitionerId))
                                .limit(1);

                            if (prac.length) {
                                let firstNameDoc = 'Unknown';
                                let lastNameDoc = 'Unknown';
                                try {
                                    firstNameDoc = decrypt(prac[0].firstNameEncrypted);
                                } catch (err) {
                                    console.error(`Failed to decrypt firstName for practitioner ${consultation[0].practitionerId}:`, err);
                                }
                                try {
                                    lastNameDoc = decrypt(prac[0].lastNameEncrypted);
                                } catch (err) {
                                    console.error(`Failed to decrypt lastName for practitioner ${consultation[0].practitionerId}:`, err);
                                }
                                doctorName = `${firstNameDoc} ${lastNameDoc}`.trim();
                            }
                        }

                        const waitMins = Math.round((new Date().getTime() - v.admissionDate.getTime()) / 60000);
                        const statusDisplay = v.status === 'in-progress' ? 'In Progress' : 'Waiting';

                        return {
                            id: v.id,
                            patientId: v.patientId,
                            ticket: v.visitNumber,
                            name,
                            age,
                            reason: v.chiefComplaint,
                            priority: v.priority,
                            doctor: doctorName,
                            waitMins,
                            status: statusDisplay,
                        };
                    })
                ).then((results) => results.filter((r): r is NonNullable<typeof r> => r !== null));

                // ── Recent patients registered at this institution ──
                const recentRegistrations = await db
                    .select({
                        patientId: patientInstitutionRegistrations.patientId,
                        registeredAt: patientInstitutionRegistrations.registeredAt,
                    })
                    .from(patientInstitutionRegistrations)
                    .where(
                        and(
                            eq(patientInstitutionRegistrations.institutionId, staffInstitutionId),
                            eq(patientInstitutionRegistrations.isActive, true)
                        )
                    )
                    .orderBy(desc(patientInstitutionRegistrations.registeredAt))
                    .limit(5);

                const recent = await Promise.all(
                    recentRegistrations.map(async (reg) => {
                        const patient = await db
                            .select({
                                firstNameEncrypted: patients.firstNameEncrypted,
                                lastNameEncrypted: patients.lastNameEncrypted,
                            })
                            .from(patients)
                            .where(eq(patients.id, reg.patientId))
                            .limit(1);
                        if (!patient.length) return null;
                        const p = patient[0];
                        const firstName = decrypt(p.firstNameEncrypted);
                        const lastName = decrypt(p.lastNameEncrypted);
                        const name = `${firstName} ${lastName}`.trim();

                        // Check if this patient has had any previous visit at this institution
                        const previousVisits = await db
                            .select({ id: visits.id })
                            .from(visits)
                            .where(
                                and(
                                    eq(visits.patientId, reg.patientId),
                                    lt(visits.admissionDate, reg.registeredAt),
                                    institutionFilter
                                )
                            )
                            .limit(1);

                        const type = previousVisits.length > 0 ? 'Returning' : 'New Patient';
                        return {
                            id: reg.patientId,
                            name,
                            time: formatTime(reg.registeredAt),
                            type,
                        };
                    })
                ).then((results) => results.filter((r): r is NonNullable<typeof r> => r !== null));

                return c.json({
                    success: true,
                    data: {
                        stats: {
                            totalPatients: totalPatients.value,
                            todayRegistered: todayRegistered.value,
                            queueLength,
                            avgWaitMinutes,
                            completedToday: completedToday.value,
                            weeklyGrowth,
                        },
                        queue,
                        recent,
                    },
                });
            } catch (err: unknown) {
                console.error('Dashboard error:', err);
                return c.json(
                    {
                        success: false,
                        error: { message: err instanceof Error ? err.message : 'Internal server error' },
                    },
                    500
                );
            }
        }
    );