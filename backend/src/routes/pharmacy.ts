import { handleError } from '../lib/errors';
import { createRoute, z } from '@hono/zod-openapi';
import { sql, eq, and, ne, count, desc } from 'drizzle-orm';
import { db } from '../db';
import { createRouter } from '../lib/create-app';
import { authMiddleware } from '../middleware/auth';
import { practitioners, visits, prescriptions, prescriptionItems, patients } from '../db/schema';
import { decrypt } from '../services/crypto';

async function getStaffInstitution(userId: string): Promise<string | null> {
    const staff = await db.select({ institutionId: practitioners.institutionId })
        .from(practitioners)
        .where(eq(practitioners.id, userId))
        .limit(1);
    return staff[0]?.institutionId || null;
}

type AppContext = {
    Variables: {
        userId: string;
        userType: string;
        blockchainAddress: string;
    };
};

const errorSchema = z.object({ success: z.boolean(), error: z.object({ message: z.string() }) });
const successData = z.object({ success: z.boolean(), data: z.any() });

export const pharmacyStatsRouter = createRouter<AppContext>()

    // ── GET /pharmacy-stats/overview ─────────────────────────────────────
    .openapi(createRoute({
        tags: ['Pharmacy Stats'],
        summary: 'Pharmacy dashboard overview stats',
        method: 'get',
        path: '/overview',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        responses: {
            200: { content: { 'application/json': { schema: successData } }, description: 'Overview stats' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userType = c.get('userType');
            const userId = c.get('userId');

            if (userType !== 'pharmacist' && userType !== 'admin') {
                return c.json({ success: false, error: { message: 'Access denied' } }, 403);
            }

            const institutionId = await getStaffInstitution(userId);
            if (!institutionId && userType !== 'admin') {
                return c.json({ success: false, error: { message: 'No institution assigned' } }, 403);
            }

            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const weekStart = new Date();
            weekStart.setDate(weekStart.getDate() - 7);
            weekStart.setHours(0, 0, 0, 0);

            // -----------------------------------------------------------------
            // 1. Pending count (prescribed or dispensing) using Drizzle ORM
            // -----------------------------------------------------------------
            const pendingConditions: any[] = [
                sql`${prescriptions.status} IN ('prescribed', 'dispensing')`
            ];
            if (institutionId) {
                pendingConditions.push(eq(visits.institutionId, institutionId));
            }

            const pendingResult = await db
                .select({ count: count() })
                .from(prescriptions)
                .innerJoin(visits, eq(prescriptions.visitId, visits.id))
                .where(and(...pendingConditions));

            const pendingCount = pendingResult[0]?.count || 0;

            // -----------------------------------------------------------------
            // 2. Dispensed today
            // -----------------------------------------------------------------
            const dispensedTodayConditions: any[] = [
                sql`${prescriptionItems.isDispensed} = true`,
                sql`${prescriptionItems.dispensedAt} >= ${todayStart.toISOString()}`
            ];
            if (institutionId) {
                dispensedTodayConditions.push(eq(visits.institutionId, institutionId));
            }

            const dispensedTodayResult = await db
                .selectDistinct({ prescriptionId: prescriptions.id })
                .from(prescriptionItems)
                .innerJoin(prescriptions, eq(prescriptionItems.prescriptionId, prescriptions.id))
                .innerJoin(visits, eq(prescriptions.visitId, visits.id))
                .where(and(...dispensedTodayConditions));

            const dispensedToday = dispensedTodayResult.length;

            // -----------------------------------------------------------------
            // 3. Dispensed this week
            // -----------------------------------------------------------------
            const dispensedWeekConditions: any[] = [
                sql`${prescriptionItems.isDispensed} = true`,
                sql`${prescriptionItems.dispensedAt} >= ${weekStart.toISOString()}`
            ];
            if (institutionId) {
                dispensedWeekConditions.push(eq(visits.institutionId, institutionId));
            }

            const dispensedWeekResult = await db
                .selectDistinct({ prescriptionId: prescriptions.id })
                .from(prescriptionItems)
                .innerJoin(prescriptions, eq(prescriptionItems.prescriptionId, prescriptions.id))
                .innerJoin(visits, eq(prescriptions.visitId, visits.id))
                .where(and(...dispensedWeekConditions));

            const dispensedWeek = dispensedWeekResult.length;

            // -----------------------------------------------------------------
            // 4. Status breakdown
            // -----------------------------------------------------------------
            const statusConditions: any[] = [];
            if (institutionId) {
                statusConditions.push(eq(visits.institutionId, institutionId));
            }

            const statusResult = await db
                .select({
                    status: prescriptions.status,
                    count: count()
                })
                .from(prescriptions)
                .innerJoin(visits, eq(prescriptions.visitId, visits.id))
                .where(and(...statusConditions))
                .groupBy(prescriptions.status)
                .orderBy(desc(count()));

            const byStatus: Record<string, number> = {};
            statusResult.forEach((r: any) => {
                byStatus[r.status] = r.count || 0;
            });

            // -----------------------------------------------------------------
            // 5. Top medications (last 7 days)
            // -----------------------------------------------------------------
            const topMedsConditions: any[] = [
                sql`${prescriptionItems.createdAt} >= ${weekStart.toISOString()}`
            ];
            if (institutionId) {
                topMedsConditions.push(eq(visits.institutionId, institutionId));
            }

            const topMedsResult = await db
                .select({
                    medicationName: prescriptionItems.medicationName,
                    count: count()
                })
                .from(prescriptionItems)
                .innerJoin(prescriptions, eq(prescriptionItems.prescriptionId, prescriptions.id))
                .innerJoin(visits, eq(prescriptions.visitId, visits.id))
                .where(and(...topMedsConditions))
                .groupBy(prescriptionItems.medicationName)
                .orderBy(desc(count()))
                .limit(5);

            const topMedications = topMedsResult.map(m => ({
                medicationName: m.medicationName,
                count: m.count || 0
            }));

            // -----------------------------------------------------------------
            // 6. Weekly activity (prescribed vs dispensed) - raw SQL for complex query
            // -----------------------------------------------------------------
            const weeklyResult: any[] = await db.execute(sql`
                SELECT
                    DATE(${prescriptions.prescribedAt}) as date,
                    COUNT(*) as prescribed,
                    COUNT(DISTINCT CASE WHEN ${prescriptionItems.dispensedAt} IS NOT NULL AND ${prescriptionItems.isDispensed} = true THEN ${prescriptions.id} END) as dispensed
                FROM ${prescriptions}
                JOIN ${visits} ON ${visits.id} = ${prescriptions.visitId}
                LEFT JOIN ${prescriptionItems} ON ${prescriptionItems.prescriptionId} = ${prescriptions.id}
                WHERE ${prescriptions.prescribedAt} >= ${weekStart.toISOString()}
                ${institutionId ? sql`AND ${visits.institutionId} = ${institutionId}` : sql``}
                GROUP BY DATE(${prescriptions.prescribedAt})
                ORDER BY date ASC
            `);

            // Handle the result correctly - it returns array directly or with .rows
            const weeklyActivity = Array.isArray(weeklyResult) ? weeklyResult : weeklyResult?.rows || [];

            // -----------------------------------------------------------------
            // 7. Average dispense time (minutes) - raw SQL for complex aggregation
            // -----------------------------------------------------------------
            const avgTimeResult: any = await db.execute(sql`
                SELECT
                    AVG(EXTRACT(EPOCH FROM (${prescriptionItems.dispensedAt} - ${prescriptions.prescribedAt})) / 60)::numeric(10,1) as avg_minutes
                FROM ${prescriptions}
                JOIN ${prescriptionItems} ON ${prescriptionItems.prescriptionId} = ${prescriptions.id}
                JOIN ${visits} ON ${visits.id} = ${prescriptions.visitId}
                WHERE ${prescriptionItems.dispensedAt} >= ${weekStart.toISOString()}
                  AND ${prescriptionItems.isDispensed} = true
                ${institutionId ? sql`AND ${visits.institutionId} = ${institutionId}` : sql``}
            `);

            // Safe access to result
            const avgDispenseMinutes = avgTimeResult && avgTimeResult.length > 0 && avgTimeResult[0]?.avg_minutes
                ? parseFloat(avgTimeResult[0].avg_minutes)
                : 0;

            return c.json({
                success: true,
                data: {
                    pendingCount: typeof pendingCount === 'number' ? pendingCount : parseInt(String(pendingCount)),
                    dispensedToday,
                    dispensedWeek,
                    statusBreakdown: byStatus,
                    topMedications,
                    weeklyActivity: weeklyActivity.map((w: any) => ({
                        date: w.date,
                        prescribed: parseInt(String(w.prescribed)) || 0,
                        dispensed: parseInt(String(w.dispensed)) || 0
                    })),
                    avgDispenseMinutes,
                },
            });
        } catch (err: any) {
            console.error('Pharmacy stats overview error:', err.message);
            console.error('Full error:', err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    })

    // ── GET /pharmacy-stats/my-stats ──────────────────────────────────────
    .openapi(createRoute({
        tags: ['Pharmacy Stats'],
        summary: 'Stats for the currently logged-in pharmacist',
        method: 'get',
        path: '/my-stats',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        responses: {
            200: { content: { 'application/json': { schema: successData } }, description: 'Personal stats' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userType = c.get('userType');
            const userId = c.get('userId');
            if (userType !== 'pharmacist') {
                return c.json({ success: false, error: { message: 'Pharmacists only' } }, 403);
            }

            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const monthStart = new Date();
            monthStart.setDate(1);
            monthStart.setHours(0, 0, 0, 0);

            // -----------------------------------------------------------------
            // Items dispensed today
            // -----------------------------------------------------------------
            const todayResult = await db
                .select({ count: count() })
                .from(prescriptionItems)
                .where(
                    and(
                        eq(prescriptionItems.dispensedByPharmacistId, userId),
                        sql`${prescriptionItems.dispensedAt} >= ${todayStart.toISOString()}`
                    )
                );

            const todayItems = todayResult[0]?.count || 0;

            // -----------------------------------------------------------------
            // Items dispensed this month
            // -----------------------------------------------------------------
            const monthResult = await db
                .select({ count: count() })
                .from(prescriptionItems)
                .where(
                    and(
                        eq(prescriptionItems.dispensedByPharmacistId, userId),
                        sql`${prescriptionItems.dispensedAt} >= ${monthStart.toISOString()}`
                    )
                );

            const monthItems = monthResult[0]?.count || 0;

            // -----------------------------------------------------------------
            // Average dispense time (minutes) this month
            // -----------------------------------------------------------------
            const avgResult: any = await db.execute(sql`
                SELECT
                    AVG(EXTRACT(EPOCH FROM (${prescriptionItems.dispensedAt} - ${prescriptions.prescribedAt})) / 60)::numeric(10,1) as avg_minutes
                FROM ${prescriptionItems}
                JOIN ${prescriptions} ON ${prescriptions.id} = ${prescriptionItems.prescriptionId}
                WHERE ${prescriptionItems.dispensedByPharmacistId} = ${userId}
                  AND ${prescriptionItems.dispensedAt} >= ${monthStart.toISOString()}
            `);

            const avgDispenseMinutes = avgResult && avgResult.length > 0 && avgResult[0]?.avg_minutes
                ? parseFloat(avgResult[0].avg_minutes)
                : 0;

            return c.json({
                success: true,
                data: {
                    todayItems: typeof todayItems === 'number' ? todayItems : parseInt(String(todayItems)),
                    monthItems: typeof monthItems === 'number' ? monthItems : parseInt(String(monthItems)),
                    avgDispenseMinutes,
                },
            });
        } catch (err: any) {
            console.error('Pharmacy my-stats error:', err.message);
            console.error('Full error:', err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    })

    // ─── GET /pharmacy-stats/patients ──────────────────────────────────────────
    .openapi(createRoute({
        tags: ['Pharmacy Stats'],
        summary: 'List patients with prescriptions at this institution',
        method: 'get',
        path: '/patients',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        responses: {
            200: { content: { 'application/json': { schema: successData } }, description: 'Patients' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userType = c.get('userType');
            const userId = c.get('userId');
            if (!['pharmacist', 'admin'].includes(userType))
                return c.json({ success: false, error: { message: 'Pharmacists only' } }, 403);

            const institutionId = await getStaffInstitution(userId);
            if (!institutionId)
                return c.json({ success: false, error: { message: 'No institution assigned' } }, 403);

            const result = await db.execute(sql`
                SELECT
                  p.id,
                  p.first_name_encrypted    AS "firstNameEncrypted",
                  p.last_name_encrypted     AS "lastNameEncrypted",
                  p.date_of_birth_encrypted AS "dobEncrypted",
                  p.national_id_encrypted   AS "nidEncrypted",
                  p.gender,
                  p.blood_type              AS "bloodType",
                  COUNT(DISTINCT rx.id) AS "totalRx",
                  COUNT(DISTINCT CASE WHEN rx.status = 'dispensed' THEN rx.id END) AS "dispensedRx",
                  COUNT(DISTINCT CASE WHEN rx.status IN ('prescribed', 'dispensing') THEN rx.id END) AS "pendingRx",
                  MAX(rx.prescribed_at) AS "lastRxAt"
                FROM patients p
                JOIN prescriptions rx ON rx.patient_id = p.id
                JOIN visits v ON v.id = rx.visit_id
                WHERE v.institution_id = ${institutionId}
                GROUP BY p.id
                ORDER BY MAX(rx.prescribed_at) DESC
            `);

            const rows = (result as any).rows ?? result;

            const enriched = rows.map((r: any) => {
                const firstName = safeDec(() => decrypt(r.firstNameEncrypted));
                const lastName = safeDec(() => decrypt(r.lastNameEncrypted));
                const dob = safeDec(() => decrypt(r.dobEncrypted));
                const nid = safeDec(() => decrypt(r.nidEncrypted));
                return {
                    id: r.id,
                    firstName, lastName,
                    fullName: `${firstName} ${lastName}`.trim() || 'Unknown',
                    age: dob ? calcAge(dob) : null,
                    nationalId: nid,
                    gender: r.gender,
                    bloodType: r.bloodType,
                    totalRx: Number(r.totalRx ?? 0),
                    dispensedRx: Number(r.dispensedRx ?? 0),
                    pendingRx: Number(r.pendingRx ?? 0),
                    lastRxAt: r.lastRxAt,
                };
            });

            return c.json({ success: true, data: { patients: enriched, total: enriched.length } });
        } catch (err: any) {
            console.error('[PHAR_PATIENTS]', err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    })

    // ─── GET /pharmacy-stats/patients/:patientId/prescriptions ─────────────────
    .openapi(createRoute({
        tags: ['Pharmacy Stats'],
        summary: 'All prescriptions for a patient at this institution',
        method: 'get',
        path: '/patients/:patientId/prescriptions',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        request: { params: z.object({ patientId: z.string().uuid() }) },
        responses: {
            200: { content: { 'application/json': { schema: successData } }, description: 'Prescriptions' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userType = c.get('userType');
            const userId = c.get('userId');
            if (!['pharmacist', 'admin'].includes(userType))
                return c.json({ success: false, error: { message: 'Pharmacists only' } }, 403);

            const institutionId = await getStaffInstitution(userId);
            if (!institutionId)
                return c.json({ success: false, error: { message: 'No institution assigned' } }, 403);

            const { patientId } = c.req.valid('param');

            const [p] = await db.select({
                id: patients.id,
                firstNameEncrypted: patients.firstNameEncrypted,
                lastNameEncrypted: patients.lastNameEncrypted,
                dateOfBirthEncrypted: patients.dateOfBirthEncrypted,
                nationalIdEncrypted: patients.nationalIdEncrypted,
                phoneNumberEncrypted: patients.phoneNumberEncrypted,
                gender: patients.gender,
                bloodType: patients.bloodType,
            }).from(patients).where(eq(patients.id, patientId)).limit(1);

            if (!p) return c.json({ success: false, error: { message: 'Patient not found' } }, 404);

            const firstName = safeDec(() => decrypt(p.firstNameEncrypted));
            const lastName = safeDec(() => decrypt(p.lastNameEncrypted));
            const dob = safeDec(() => decrypt(p.dateOfBirthEncrypted));
            const nid = safeDec(() => decrypt(p.nationalIdEncrypted));
            const phone = safeDec(() => decrypt(p.phoneNumberEncrypted));

            const rxResult = await db.execute(sql`
                SELECT
                  rx.id,
                  rx.prescription_number   AS "prescriptionNumber",
                  rx.status,
                  rx.prescribed_at         AS "prescribedAt",
                  rx.visit_id              AS "visitId",
                  v.visit_number           AS "visitNumber",
                  v.chief_complaint        AS "chiefComplaint",
                  v.visit_type             AS "visitType",
                  doc.first_name_encrypted AS "docFirst",
                  doc.last_name_encrypted  AS "docLast",
                  doc.specialization       AS "docSpecialization",
                  COUNT(pi.id) AS "totalItems",
                  COUNT(CASE WHEN pi.is_dispensed = true THEN 1 END) AS "dispensedItems"
                FROM prescriptions rx
                JOIN visits v        ON v.id = rx.visit_id
                LEFT JOIN practitioners doc ON doc.id = rx.prescribed_by_practitioner_id
                LEFT JOIN prescription_items pi ON pi.prescription_id = rx.id
                WHERE rx.patient_id    = ${patientId}
                  AND v.institution_id = ${institutionId}
                GROUP BY rx.id, v.visit_number, v.chief_complaint, v.visit_type,
                         doc.first_name_encrypted, doc.last_name_encrypted, doc.specialization
                ORDER BY rx.prescribed_at DESC
            `);

            const rxRows = (rxResult as any).rows ?? rxResult;

            const prescriptionsList = rxRows.map((r: any) => {
                const docName = r.docFirst
                    ? `${safeDec(() => decrypt(r.docFirst))} ${safeDec(() => decrypt(r.docLast))}`.trim()
                    : 'Unknown';
                return {
                    id: r.id,
                    prescriptionNumber: r.prescriptionNumber,
                    status: r.status,
                    prescribedAt: r.prescribedAt,
                    visitId: r.visitId,
                    visitNumber: r.visitNumber,
                    chiefComplaint: r.chiefComplaint,
                    visitType: r.visitType,
                    prescribedBy: docName,
                    prescribedBySpecialization: r.docSpecialization ?? null,
                    totalItems: Number(r.totalItems ?? 0),
                    dispensedItems: Number(r.dispensedItems ?? 0),
                };
            });

            return c.json({
                success: true,
                data: {
                    patient: {
                        id: p.id,
                        fullName: `${firstName} ${lastName}`.trim(),
                        firstName, lastName,
                        age: dob ? calcAge(dob) : null,
                        nationalId: nid,
                        phone,
                        gender: p.gender,
                        bloodType: p.bloodType,
                    },
                    prescriptions: prescriptionsList,
                    summary: {
                        total: prescriptionsList.length,
                        dispensed: prescriptionsList.filter((r: any) => r.status === 'dispensed').length,
                        pending: prescriptionsList.filter((r: any) => ['prescribed', 'dispensing'].includes(r.status)).length,
                    },
                },
            });
        } catch (err: any) {
            console.error('[PHAR_PATIENT_RX]', err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    });









function safeDec(fn: () => string): string {
    try { return fn(); } catch { return ''; }
}

function calcAge(dobStr: string): number | null {
    try {
        const d = new Date(dobStr);
        if (isNaN(d.getTime())) return null;
        return Math.floor((Date.now() - d.getTime()) / (365.25 * 86400000));
    } catch { return null; }
}