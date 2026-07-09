import { handleError } from '../lib/errors';
import { createRoute, z } from '@hono/zod-openapi';
import { eq, desc, and, sql, gte, count } from 'drizzle-orm';
import { db } from '../db';
import {
    visits, consultations, diagnoses, labTestOrders,
    imagingOrders, prescriptions, patients, vitalSigns, practitioners,
} from '../db/schema';
import { createRouter } from '../lib/create-app';
import { authMiddleware } from '../middleware/auth';

// ─────────────────────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────────────────────

const successData = z.object({ success: z.boolean(), data: z.any() });
const errorSchema = z.object({
    success: z.boolean(),
    error: z.object({ message: z.string() }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getStaffInstitution(userId: string): Promise<string | null> {
    const staff = await db
        .select({ institutionId: practitioners.institutionId })
        .from(practitioners)
        .where(eq(practitioners.id, userId))
        .limit(1);
    return staff[0]?.institutionId ?? null;
}

/** Start of today in UTC — used for "today's activity" counts */
function getStartOfDayUTC(): Date {
    const now = new Date();
    return new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0, 0, 0, 0,
    ));
}

/** Priority sort order */
const PRIORITY_ORDER: Record<string, number> = {
    critical: 0,
    emergency: 1,
    urgent: 2,
    routine: 3,
};

function sortByPriority<T extends { priority: string; admissionDate: Date | string }>(
    items: T[],
): T[] {
    return [...items].sort((a, b) => {
        const diff = (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
        if (diff !== 0) return diff;
        return new Date(a.admissionDate).getTime() - new Date(b.admissionDate).getTime();
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────────────────────────────────────

export const doctorStatsRouter = createRouter()

    // ══════════════════════════════════════════════════════════════════════════
    // GET /today-queue
    //
    // Returns ALL active in-progress visits assigned to this doctor that have
    // been triaged (have at least one set of vitals recorded).
    //
    // FIX: Removed gte(admissionDate, startOfDay) — doctors manage inpatients
    // who may have been admitted days ago, not just today's admissions.
    // ══════════════════════════════════════════════════════════════════════════
    .openapi(createRoute({
        tags: ['Doctor'],
        summary: "Get doctor's active queue — all assigned in-progress visits with vitals",
        method: 'get',
        path: '/today-queue',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        responses: {
            200: { content: { 'application/json': { schema: successData } }, description: 'Queue fetched' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userType = c.get('userType');
            const userId = c.get('userId');

            if (!['practitioner', 'admin'].includes(userType)) {
                return c.json({ success: false, error: { message: 'Access denied' } }, 403);
            }

            const staffInstitutionId = await getStaffInstitution(userId);
            const institutionFilter = (userType === 'admin' && !staffInstitutionId)
                ? undefined
                : eq(visits.institutionId, staffInstitutionId);

            const { decrypt } = await import('../services/crypto');

            // Fetch all active visits assigned to this doctor that have vitals
            // NO date filter — inpatients may have been admitted days ago
            const queueRows = await db.select({
                id: visits.id,
                visitNumber: visits.visitNumber,
                patientId: visits.patientId,
                visitType: visits.visitType,
                chiefComplaint: visits.chiefComplaint,
                admittingDiagnosis: visits.admittingDiagnosis,
                priority: visits.priority,
                status: visits.status,
                wardOrRoom: visits.wardOrRoom,
                admissionDate: visits.admissionDate,
                assignedNurseId: visits.assignedNurseId,
            })
                .from(visits)
                .where(and(
                    eq(visits.status, 'in-progress'),
                    // FIX: removed gte(visits.admissionDate, startOfDay)
                    sql`${visits.id} IN (SELECT DISTINCT ${vitalSigns.visitId} FROM ${vitalSigns})`,
                    eq(visits.assignedDoctorId, userId),
                    institutionFilter,
                ))
                .limit(100);

            // Enrich with patient info, nurse name, and clinical summary
            const enriched = await Promise.all(queueRows.map(async (v) => {
                const [patientRow, consultRow, labPendingRow, imagingPendingRow, nurseRow] = await Promise.all([
                    db.select({
                        firstNameEncrypted: patients.firstNameEncrypted,
                        lastNameEncrypted: patients.lastNameEncrypted,
                        gender: patients.gender,
                        bloodType: patients.bloodType,
                    }).from(patients).where(eq(patients.id, v.patientId)).limit(1),

                    db.select({ id: consultations.id })
                        .from(consultations)
                        .where(eq(consultations.visitId, v.id))
                        .limit(1),

                    db.select({ cnt: count() })
                        .from(labTestOrders)
                        .where(and(
                            eq(labTestOrders.visitId, v.id),
                            sql`${labTestOrders.status} NOT IN ('resulted', 'cancelled')`,
                        )),

                    db.select({ cnt: count() })
                        .from(imagingOrders)
                        .where(and(
                            eq(imagingOrders.visitId, v.id),
                            sql`${imagingOrders.status} NOT IN ('reported', 'cancelled')`,
                        )),

                    v.assignedNurseId
                        ? db.select({
                            firstNameEncrypted: practitioners.firstNameEncrypted,
                            lastNameEncrypted: practitioners.lastNameEncrypted,
                        }).from(practitioners).where(eq(practitioners.id, v.assignedNurseId)).limit(1)
                        : Promise.resolve([]),
                ]);

                return {
                    id: v.id,
                    visitNumber: v.visitNumber,
                    patientId: v.patientId,
                    visitType: v.visitType,
                    chiefComplaint: v.chiefComplaint,
                    admittingDiagnosis: v.admittingDiagnosis ?? null,
                    priority: v.priority,
                    status: v.status,
                    wardOrRoom: v.wardOrRoom ?? null,
                    admissionDate: v.admissionDate,
                    hasConsultation: consultRow.length > 0,
                    pendingLabCount: Number(labPendingRow[0]?.cnt ?? 0),
                    pendingImagingCount: Number(imagingPendingRow[0]?.cnt ?? 0),
                    nurseName: nurseRow.length
                        ? `${decrypt(nurseRow[0].firstNameEncrypted)} ${decrypt(nurseRow[0].lastNameEncrypted)}`
                        : null,
                    patient: patientRow.length ? {
                        firstName: decrypt(patientRow[0].firstNameEncrypted),
                        lastName: decrypt(patientRow[0].lastNameEncrypted),
                        gender: patientRow[0].gender,
                        bloodType: patientRow[0].bloodType,
                    } : null,
                };
            }));

            return c.json({
                success: true,
                data: {
                    visits: sortByPriority(enriched),
                    total: enriched.length,
                },
            });

        } catch (err: any) {
            console.error('[ERROR] GET /today-queue:', err.message);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    })

    // ══════════════════════════════════════════════════════════════════════════
    // GET /stats
    //
    // Returns dashboard stats for the doctor overview page.
    //
    // "Today" counts use startOfDay UTC for activity metrics (consultations,
    // lab orders, imaging, prescriptions written today).
    //
    // "Active" counts are NOT date-filtered — they reflect the doctor's current
    // patient load regardless of admission date.
    // ══════════════════════════════════════════════════════════════════════════
    .openapi(createRoute({
        tags: ['Doctor'],
        summary: 'Get doctor overview stats',
        method: 'get',
        path: '/stats',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        responses: {
            200: { content: { 'application/json': { schema: successData } }, description: 'Stats fetched' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userType = c.get('userType');
            const userId = c.get('userId');

            if (!['practitioner', 'admin'].includes(userType)) {
                return c.json({ success: false, error: { message: 'Access denied' } }, 403);
            }

            const staffInstitutionId = await getStaffInstitution(userId);
            const institutionFilter = (userType === 'admin' && !staffInstitutionId)
                ? undefined
                : eq(visits.institutionId, staffInstitutionId);

            const { decrypt } = await import('../services/crypto');
            const startOfDay = getStartOfDayUTC();

            // All active visits assigned to this doctor (no date filter)
            const whereAssigned = and(
                eq(visits.assignedDoctorId, userId),
                institutionFilter,
            );

            // Visible workload — assigned to me OR unclaimed at my institution.
            // Unassigned visits surface to every doctor at the institution until
            // someone claims them, so caseload counts should match that.
            const whereVisible = and(
                sql`(${visits.assignedDoctorId} = ${userId} OR ${visits.assignedDoctorId} IS NULL)`,
                institutionFilter,
            );

            // Today's admissions assigned to this doctor
            const whereTodayAssigned = and(
                gte(visits.admissionDate, startOfDay),
                whereAssigned,
            );

            const [
                // Active patient load (all in-progress, any admission date)
                activeVisits,
                // Triaged and awaiting consultation (has vitals, no consultation yet)
                awaitingConsult,
                // Already consulted today
                consultedToday,
                // Completed today (discharged)
                completedToday,
                // Critical currently active
                criticalActive,
                // Urgent currently active
                urgentActive,
                // Today's new admissions assigned to this doctor
                todayAdmissions,
                // Activity counts — what I have done today
                myConsultationsToday,
                myLabOrdersToday,
                myImagingOrdersToday,
                myPrescriptionsToday,
                // 5 most recent consultations for "recently consulted" panel
                recentConsultations,
            ] = await Promise.all([

                // Active patient load (includes unclaimed visits at my institution)
                db.select({ cnt: count() })
                    .from(visits)
                    .where(and(eq(visits.status, 'in-progress'), whereVisible)),

                // Awaiting consultation — triaged (vitals recorded) but no consultation yet
                db.select({ cnt: count() })
                    .from(visits)
                    .where(and(
                        eq(visits.status, 'in-progress'),
                        sql`${visits.id} IN (SELECT DISTINCT ${vitalSigns.visitId} FROM ${vitalSigns})`,
                        sql`${visits.id} NOT IN (SELECT DISTINCT ${consultations.visitId} FROM ${consultations})`,
                        whereVisible,
                    )),

                // Consulted today (has a consultation created today by this doctor)
                db.select({ cnt: count() })
                    .from(visits)
                    .innerJoin(
                        consultations,
                        and(
                            eq(consultations.visitId, visits.id),
                            eq(consultations.practitionerId, userId),
                            gte(consultations.createdAt, startOfDay),
                        )
                    )
                    .where(and(
                        eq(visits.status, 'in-progress'),
                        whereAssigned,
                    )),

                // Completed/discharged today
                db.select({ cnt: count() })
                    .from(visits)
                    .where(and(
                        eq(visits.status, 'completed'),
                        gte(visits.dischargeDate, startOfDay),
                        whereAssigned,
                    )),

                // Critical active
                db.select({ cnt: count() })
                    .from(visits)
                    .where(and(
                        eq(visits.status, 'in-progress'),
                        sql`${visits.priority} IN ('critical', 'emergency')`,
                        whereVisible,
                    )),

                // Urgent active
                db.select({ cnt: count() })
                    .from(visits)
                    .where(and(
                        eq(visits.status, 'in-progress'),
                        eq(visits.priority, 'urgent'),
                        whereVisible,
                    )),

                // Today's new admissions
                db.select({ cnt: count() })
                    .from(visits)
                    .where(whereTodayAssigned),

                // My consultations today
                db.select({ cnt: count() })
                    .from(consultations)
                    .where(and(
                        eq(consultations.practitionerId, userId),
                        gte(consultations.createdAt, startOfDay),
                    )),

                // My lab orders today
                db.select({ cnt: count() })
                    .from(labTestOrders)
                    .where(and(
                        eq(labTestOrders.orderedByPractitionerId, userId),
                        gte(labTestOrders.createdAt, startOfDay),
                    )),

                // My imaging orders today
                db.select({ cnt: count() })
                    .from(imagingOrders)
                    .where(and(
                        eq(imagingOrders.orderedByPractitionerId, userId),
                        gte(imagingOrders.createdAt, startOfDay),
                    )),

                // My prescriptions today
                db.select({ cnt: count() })
                    .from(prescriptions)
                    .where(and(
                        eq(prescriptions.prescribedByPractitionerId, userId),
                        gte(prescriptions.prescribedAt, startOfDay),
                    )),

                // 5 most recent consultations
                db.select({
                    visitId: consultations.visitId,
                    createdAt: consultations.createdAt,
                    chiefComplaint: consultations.chiefComplaint,
                })
                    .from(consultations)
                    .where(eq(consultations.practitionerId, userId))
                    .orderBy(desc(consultations.createdAt))
                    .limit(5),
            ]);

            // Enrich recent consultations with visit and patient details
            const recentPatients = (
                await Promise.all(
                    recentConsultations.map(async (c_) => {
                        const visitRow = await db.select({
                            id: visits.id,
                            visitNumber: visits.visitNumber,
                            priority: visits.priority,
                            status: visits.status,
                            patientId: visits.patientId,
                        }).from(visits).where(eq(visits.id, c_.visitId)).limit(1);

                        if (!visitRow.length) return null;

                        const patientRow = await db.select({
                            firstNameEncrypted: patients.firstNameEncrypted,
                            lastNameEncrypted: patients.lastNameEncrypted,
                            gender: patients.gender,
                            bloodType: patients.bloodType,
                        }).from(patients).where(eq(patients.id, visitRow[0].patientId)).limit(1);

                        return {
                            visitId: visitRow[0].id,
                            visitNumber: visitRow[0].visitNumber,
                            priority: visitRow[0].priority,
                            status: visitRow[0].status,
                            chiefComplaint: c_.chiefComplaint,
                            consultedAt: c_.createdAt.toISOString(),
                            patient: patientRow.length ? {
                                firstName: decrypt(patientRow[0].firstNameEncrypted),
                                lastName: decrypt(patientRow[0].lastNameEncrypted),
                                gender: patientRow[0].gender,
                                bloodType: patientRow[0].bloodType,
                            } : null,
                        };
                    })
                )
            ).filter(Boolean);

            return c.json({
                success: true,
                data: {
                    today: {
                        // "total" = today's new admissions for this doctor
                        total: Number(todayAdmissions[0]?.cnt ?? 0),
                        // "triaged" = awaiting consultation (has vitals, no consult yet)
                        triaged: Number(awaitingConsult[0]?.cnt ?? 0),
                        // "completed" = discharged today
                        completed: Number(completedToday[0]?.cnt ?? 0),
                        // critical + emergency active
                        critical: Number(criticalActive[0]?.cnt ?? 0),
                        // urgent active
                        urgent: Number(urgentActive[0]?.cnt ?? 0),
                        // total currently in my care
                        activePatients: Number(activeVisits[0]?.cnt ?? 0),
                        // consulted today
                        consultedToday: Number(consultedToday[0]?.cnt ?? 0),
                    },
                    activity: {
                        consultations: Number(myConsultationsToday[0]?.cnt ?? 0),
                        labOrders: Number(myLabOrdersToday[0]?.cnt ?? 0),
                        imagingOrders: Number(myImagingOrdersToday[0]?.cnt ?? 0),
                        prescriptions: Number(myPrescriptionsToday[0]?.cnt ?? 0),
                    },
                    recentPatients,
                },
            });

        } catch (err: any) {
            console.error('[ERROR] GET /stats:', err.message);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    })

    // ══════════════════════════════════════════════════════════════════════════
    // GET /  (root) — Combined dashboard endpoint
    //
    // Returns stats + queue in a single call for the doctor dashboard page.
    // ══════════════════════════════════════════════════════════════════════════
    .openapi(createRoute({
        tags: ['Dashboard'],
        summary: "Doctor dashboard — combined stats + queue",
        method: 'get',
        path: '/',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        responses: {
            200: { content: { 'application/json': { schema: successData } }, description: 'Dashboard data' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userType = c.get('userType');
            const userId = c.get('userId');

            if (userType !== 'practitioner') {
                return c.json({ success: false, error: { message: 'Access denied' } }, 403);
            }

            const staffInstitutionId = await getStaffInstitution(userId);
            if (!staffInstitutionId) {
                return c.json({
                    success: false,
                    error: { message: 'Practitioner not assigned to an institution' },
                }, 403);
            }

            const institutionFilter = eq(visits.institutionId, staffInstitutionId);
            const { decrypt } = await import('../services/crypto');
            const startOfDay = getStartOfDayUTC();

            const whereAssigned = and(
                eq(visits.assignedDoctorId, userId),
                institutionFilter,
            );

            // Queue: all active assigned visits with vitals (no date filter)
            const queueRows = await db.select({
                id: visits.id,
                visitNumber: visits.visitNumber,
                visitType: visits.visitType,
                chiefComplaint: visits.chiefComplaint,
                admittingDiagnosis: visits.admittingDiagnosis,
                priority: visits.priority,
                status: visits.status,
                wardOrRoom: visits.wardOrRoom,
                admissionDate: visits.admissionDate,
                patientId: visits.patientId,
                assignedNurseId: visits.assignedNurseId,
            })
                .from(visits)
                .where(and(
                    eq(visits.status, 'in-progress'),
                    sql`${visits.id} IN (SELECT DISTINCT ${vitalSigns.visitId} FROM ${vitalSigns})`,
                    whereAssigned,
                ))
                .limit(100);

            const enrichedQueue = await Promise.all(queueRows.map(async (v) => {
                const [patientRow, consultRow, nurseRow] = await Promise.all([
                    db.select({
                        firstNameEncrypted: patients.firstNameEncrypted,
                        lastNameEncrypted: patients.lastNameEncrypted,
                        gender: patients.gender,
                        bloodType: patients.bloodType,
                    }).from(patients).where(eq(patients.id, v.patientId)).limit(1),

                    db.select({ id: consultations.id })
                        .from(consultations)
                        .where(eq(consultations.visitId, v.id))
                        .limit(1),

                    v.assignedNurseId
                        ? db.select({
                            firstNameEncrypted: practitioners.firstNameEncrypted,
                            lastNameEncrypted: practitioners.lastNameEncrypted,
                        }).from(practitioners).where(eq(practitioners.id, v.assignedNurseId)).limit(1)
                        : Promise.resolve([]),
                ]);

                return {
                    id: v.id,
                    visitNumber: v.visitNumber,
                    visitType: v.visitType,
                    chiefComplaint: v.chiefComplaint,
                    admittingDiagnosis: v.admittingDiagnosis ?? null,
                    priority: v.priority,
                    status: v.status,
                    wardOrRoom: v.wardOrRoom ?? null,
                    admissionDate: v.admissionDate,
                    hasConsultation: consultRow.length > 0,
                    nurseName: nurseRow.length
                        ? `${decrypt(nurseRow[0].firstNameEncrypted)} ${decrypt(nurseRow[0].lastNameEncrypted)}`
                        : null,
                    patient: patientRow.length ? {
                        firstName: decrypt(patientRow[0].firstNameEncrypted),
                        lastName: decrypt(patientRow[0].lastNameEncrypted),
                        gender: patientRow[0].gender,
                        bloodType: patientRow[0].bloodType,
                    } : null,
                };
            }));

            // Stats
            const [
                activeVisits,
                awaitingConsult,
                completedToday,
                pendingLab,
                pendingImaging,
                pendingRx,
            ] = await Promise.all([
                db.select({ c: count() })
                    .from(visits)
                    .where(and(eq(visits.status, 'in-progress'), whereAssigned))
                    .then(r => Number(r[0]?.c ?? 0)),

                db.select({ c: count() })
                    .from(visits)
                    .where(and(
                        eq(visits.status, 'in-progress'),
                        sql`${visits.id} IN (SELECT DISTINCT ${vitalSigns.visitId} FROM ${vitalSigns})`,
                        sql`${visits.id} NOT IN (SELECT DISTINCT ${consultations.visitId} FROM ${consultations})`,
                        whereAssigned,
                    ))
                    .then(r => Number(r[0]?.c ?? 0)),

                db.select({ c: count() })
                    .from(visits)
                    .where(and(
                        eq(visits.status, 'completed'),
                        gte(visits.dischargeDate, startOfDay),
                        whereAssigned,
                    ))
                    .then(r => Number(r[0]?.c ?? 0)),

                db.select({ c: count() })
                    .from(labTestOrders)
                    .where(eq(labTestOrders.status, 'ordered'))
                    .then(r => Number(r[0]?.c ?? 0)),

                db.select({ c: count() })
                    .from(imagingOrders)
                    .where(eq(imagingOrders.status, 'ordered'))
                    .then(r => Number(r[0]?.c ?? 0)),

                db.select({ c: count() })
                    .from(prescriptions)
                    .where(and(
                        eq(prescriptions.status, 'prescribed'),
                        gte(prescriptions.prescribedAt, startOfDay),
                    ))
                    .then(r => Number(r[0]?.c ?? 0)),
            ]);

            const sortedQueue = sortByPriority(enrichedQueue);

            return c.json({
                success: true,
                data: {
                    stats: {
                        activePatients: activeVisits,
                        awaitingConsult,
                        completedToday,
                        pendingLabResults: pendingLab,
                        pendingImaging,
                        pendingRx,
                        criticalCount: sortedQueue.filter(v =>
                            ['critical', 'emergency'].includes(v.priority)
                        ).length,
                        urgentCount: sortedQueue.filter(v => v.priority === 'urgent').length,
                    },
                    queue: sortedQueue,
                },
            });

        } catch (err: any) {
            console.error('[ERROR] GET /:', err.message);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    });