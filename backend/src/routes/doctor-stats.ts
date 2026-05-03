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
// GET /api/doctor/stats
//
// Returns a rich stats + queue payload for the doctor overview dashboard.
// Accessible only by: practitioner, admin
// ─────────────────────────────────────────────────────────────────────────────

type AppContext = {
    Variables: {
        userId: string;
        userType: string;
        blockchainAddress: string;
    };
};

const successData = z.object({ success: z.boolean(), data: z.any() });
const errorSchema = z.object({
    success: z.boolean(),
    error: z.object({ message: z.string() }),
});

// Helper to get staff institution
async function getStaffInstitution(userId: string): Promise<string | null> {
    const staff = await db.select({ institutionId: practitioners.institutionId })
        .from(practitioners)
        .where(eq(practitioners.id, userId))
        .limit(1);
    return staff[0]?.institutionId || null;
}

export const doctorStatsRouter = createRouter<AppContext>()

    // ══════════════════════════════════════════
    // GET /today-queue  — Doctor's patient queue (HOSPITAL FILTERED)
    // ══════════════════════════════════════════
    .openapi(createRoute({
        tags: ['Doctor'],
        summary: "Get today's doctor queue (visits with vitals, ready for consultation)",
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

            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);

            const queueRows = await db.select({
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
                    gte(visits.admissionDate, startOfDay),
                    sql`${visits.id} IN (SELECT DISTINCT ${vitalSigns.visitId} FROM ${vitalSigns})`,
                    institutionFilter
                ))
                .orderBy(visits.admissionDate)
                .limit(100);

            const enriched = await Promise.all(queueRows.map(async (v) => {
                const [patientRow, consultRow] = await Promise.all([
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
                ]);

                return {
                    ...v,
                    hasConsultation: consultRow.length > 0,
                    patient: patientRow.length ? {
                        firstName: decrypt(patientRow[0].firstNameEncrypted),
                        lastName: decrypt(patientRow[0].lastNameEncrypted),
                        gender: patientRow[0].gender,
                        bloodType: patientRow[0].bloodType,
                    } : null,
                };
            }));

            const ORDER: Record<string, number> = { critical: 0, emergency: 1, urgent: 2, routine: 3 };
            enriched.sort((a, b) => {
                const po = (ORDER[a.priority] ?? 9) - (ORDER[b.priority] ?? 9);
                return po !== 0 ? po : new Date(a.admissionDate).getTime() - new Date(b.admissionDate).getTime();
            });

            return c.json({ success: true, data: { visits: enriched, total: enriched.length } });

        } catch (err: any) {
            console.error(err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    })

    // ══════════════════════════════════════════
    // GET /stats  — Doctor overview dashboard stats (HOSPITAL FILTERED)
    // ══════════════════════════════════════════
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

            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);

            const whereTodayWithInst = institutionFilter
                ? and(gte(visits.admissionDate, startOfDay), institutionFilter)
                : gte(visits.admissionDate, startOfDay);

            const [
                todayVisits,
                triagedVisits,
                completedToday,
                criticalToday,
                urgentToday,
                myConsultationsToday,
                myLabOrdersToday,
                myImagingOrdersToday,
                myPrescriptionsToday,
                recentConsultations,
            ] = await Promise.all([
                db.select({ cnt: count() }).from(visits).where(whereTodayWithInst),
                db.select({ cnt: count() }).from(visits)
                    .where(and(
                        eq(visits.status, 'in-progress'),
                        gte(visits.admissionDate, startOfDay),
                        sql`${visits.id} IN (SELECT DISTINCT ${vitalSigns.visitId} FROM ${vitalSigns})`,
                        institutionFilter
                    )),
                db.select({ cnt: count() }).from(visits)
                    .where(and(eq(visits.status, 'completed'), whereTodayWithInst)),
                db.select({ cnt: count() }).from(visits)
                    .where(and(
                        eq(visits.status, 'in-progress'),
                        gte(visits.admissionDate, startOfDay),
                        sql`${visits.priority} IN ('critical', 'emergency')`,
                        institutionFilter
                    )),
                db.select({ cnt: count() }).from(visits)
                    .where(and(
                        eq(visits.status, 'in-progress'),
                        gte(visits.admissionDate, startOfDay),
                        eq(visits.priority, 'urgent'),
                        institutionFilter
                    )),
                db.select({ cnt: count() }).from(consultations)
                    .where(and(
                        eq(consultations.practitionerId, userId),
                        gte(consultations.createdAt, startOfDay)
                    )),
                db.select({ cnt: count() }).from(labTestOrders)
                    .where(and(
                        eq(labTestOrders.orderedByPractitionerId, userId),
                        gte(labTestOrders.createdAt, startOfDay)
                    )),
                db.select({ cnt: count() }).from(imagingOrders)
                    .where(and(
                        eq(imagingOrders.orderedByPractitionerId, userId),
                        gte(imagingOrders.createdAt, startOfDay)
                    )),
                db.select({ cnt: count() }).from(prescriptions)
                    .where(and(
                        eq(prescriptions.prescribedByPractitionerId, userId),
                        gte(prescriptions.createdAt, startOfDay)
                    )),
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

            const recentPatients = await Promise.all(
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
                        consultedAt: c_.createdAt,
                        patient: patientRow.length ? {
                            firstName: decrypt(patientRow[0].firstNameEncrypted),
                            lastName: decrypt(patientRow[0].lastNameEncrypted),
                            gender: patientRow[0].gender,
                            bloodType: patientRow[0].bloodType,
                        } : null,
                    };
                })
            );

            return c.json({
                success: true,
                data: {
                    today: {
                        total: todayVisits[0]?.cnt ?? 0,
                        triaged: triagedVisits[0]?.cnt ?? 0,
                        completed: completedToday[0]?.cnt ?? 0,
                        critical: criticalToday[0]?.cnt ?? 0,
                        urgent: urgentToday[0]?.cnt ?? 0,
                    },
                    activity: {
                        consultations: myConsultationsToday[0]?.cnt ?? 0,
                        labOrders: myLabOrdersToday[0]?.cnt ?? 0,
                        imagingOrders: myImagingOrdersToday[0]?.cnt ?? 0,
                        prescriptions: myPrescriptionsToday[0]?.cnt ?? 0,
                    },
                    recentPatients: recentPatients.filter(Boolean),
                },
            });

        } catch (err: any) {
            console.error(err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    })

    // ══════════════════════════════════════════════════
    // GET /api/dashboard/doctor (HOSPITAL FILTERED)
    // ══════════════════════════════════════════════════
    .openapi(createRoute({
        tags: ['Dashboard'],
        summary: "Doctor dashboard — stats + today's personal queue",
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
            const institutionFilter = eq(visits.institutionId, staffInstitutionId);

            const { decrypt } = await import('../services/crypto');

            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);

            const readyVisits = await db.select({
                id: visits.id,
                visitNumber: visits.visitNumber,
                visitType: visits.visitType,
                chiefComplaint: visits.chiefComplaint,
                priority: visits.priority,
                status: visits.status,
                wardOrRoom: visits.wardOrRoom,
                admissionDate: visits.admissionDate,
                patientId: visits.patientId,
            })
                .from(visits)
                .where(and(
                    eq(visits.status, 'in-progress'),
                    gte(visits.admissionDate, startOfDay),
                    sql`${visits.id} IN (SELECT DISTINCT ${vitalSigns.visitId} FROM ${vitalSigns})`,
                    institutionFilter
                ))
                .orderBy(desc(visits.admissionDate))
                .limit(100);

            const enriched = await Promise.all(readyVisits.map(async (v) => {
                const [patient, hasConsult] = await Promise.all([
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
                ]);

                return {
                    ...v,
                    hasConsultation: hasConsult.length > 0,
                    patient: patient.length ? {
                        firstName: decrypt(patient[0].firstNameEncrypted),
                        lastName: decrypt(patient[0].lastNameEncrypted),
                        gender: patient[0].gender,
                        bloodType: patient[0].bloodType,
                    } : null,
                };
            }));

            const whereTodayWithInst = and(gte(visits.admissionDate, startOfDay), institutionFilter);

            const [
                totalToday,
                pendingConsult,
                inConsultCount,
                completedToday,
                pendingLabCount,
                pendingImagingCount,
                pendingRxCount,
            ] = await Promise.all([
                db.select({ c: count() }).from(visits).where(whereTodayWithInst).then(r => r[0]?.c ?? 0),
                db.select({ c: count() }).from(visits)
                    .where(and(
                        eq(visits.status, 'in-progress'),
                        gte(visits.admissionDate, startOfDay),
                        sql`${visits.id} IN (SELECT DISTINCT ${vitalSigns.visitId} FROM ${vitalSigns})`,
                        sql`${visits.id} NOT IN (SELECT DISTINCT ${consultations.visitId} FROM ${consultations})`,
                        institutionFilter
                    ))
                    .then(r => r[0]?.c ?? 0),
                db.select({ c: count() }).from(visits)
                    .where(and(
                        eq(visits.status, 'in-progress'),
                        gte(visits.admissionDate, startOfDay),
                        sql`${visits.id} IN (SELECT DISTINCT ${consultations.visitId} FROM ${consultations})`,
                        institutionFilter
                    ))
                    .then(r => r[0]?.c ?? 0),
                db.select({ c: count() }).from(visits)
                    .where(and(eq(visits.status, 'completed'), whereTodayWithInst))
                    .then(r => r[0]?.c ?? 0),
                db.select({ c: count() }).from(labTestOrders)
                    .where(eq(labTestOrders.status, 'ordered'))
                    .then(r => r[0]?.c ?? 0),
                db.select({ c: count() }).from(imagingOrders)
                    .where(eq(imagingOrders.status, 'ordered'))
                    .then(r => r[0]?.c ?? 0),
                db.select({ c: count() }).from(prescriptions)
                    .where(and(
                        eq(prescriptions.status, 'prescribed'),
                        gte(prescriptions.createdAt, startOfDay)
                    ))
                    .then(r => r[0]?.c ?? 0),
            ]);

            return c.json({
                success: true,
                data: {
                    stats: {
                        totalToday: Number(totalToday),
                        awaitingConsult: Number(pendingConsult),
                        inConsultation: Number(inConsultCount),
                        completedToday: Number(completedToday),
                        pendingLabResults: Number(pendingLabCount),
                        pendingImaging: Number(pendingImagingCount),
                        pendingRx: Number(pendingRxCount),
                        criticalCount: enriched.filter(v => v.priority === 'critical').length,
                        urgentCount: enriched.filter(v => v.priority === 'urgent').length,
                    },
                    queue: enriched,
                },
            });

        } catch (err: any) {
            console.error(err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    });