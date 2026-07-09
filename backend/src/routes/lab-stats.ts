import { handleError } from '../lib/errors';
import { createRoute, z } from '@hono/zod-openapi';
import { eq, and, gte, count, sql, desc, ne } from 'drizzle-orm';
import { db } from '../db';
import {
    labTestOrders, labTestResults, visits, practitioners,
} from '../db/schema';
import { createRouter } from '../lib/create-app';
import { authMiddleware } from '../middleware/auth';

type AppContext = {
    Variables: { userId: string; userType: string; blockchainAddress: string };
};
const ok = z.object({ success: z.boolean(), data: z.any() });

// Helper to get staff institution
async function getStaffInstitution(userId: string): Promise<string | null> {
    const staff = await db.select({ institutionId: practitioners.institutionId })
        .from(practitioners)
        .where(eq(practitioners.id, userId))
        .limit(1);
    return staff[0]?.institutionId || null;
}

export const labStatsRouter = createRouter<AppContext>()

    // GET /api/lab-stats – overview (HOSPITAL FILTERED)
    .openapi(createRoute({
        tags: ['Lab Stats'],
        summary: 'Lab overview stats',
        method: 'get',
        path: '/',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        responses: { 200: { content: { 'application/json': { schema: ok } }, description: 'Stats' } },
    }), async (c) => {
        try {
            const userType = c.get('userType');
            const userId = c.get('userId');
            if (!['lab_technician', 'admin'].includes(userType)) {
                return c.json({ success: false, error: { message: 'Access denied' } }, 403);
            }

            const staffInstitutionId = await getStaffInstitution(userId);
            const institutionFilter = (userType === 'admin' && !staffInstitutionId)
                ? undefined
                : eq(visits.institutionId, staffInstitutionId);

            const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const startOfDayISO = startOfDay.toISOString();
            const sevenDaysAgoISO = sevenDaysAgo.toISOString();

            // ── Pending orders (not resulted/cancelled, filtered by institution) ──
            const pendingOrders = await db.select({
                id: labTestOrders.id,
                orderNumber: labTestOrders.orderNumber,
                testName: labTestOrders.testName,
                specimenType: labTestOrders.specimenType,
                urgency: labTestOrders.urgency,
                status: labTestOrders.status,
                orderedAt: labTestOrders.orderedAt,
                visitId: labTestOrders.visitId,
                patientId: labTestOrders.patientId,
            })
                .from(labTestOrders)
                .leftJoin(visits, eq(visits.id, labTestOrders.visitId))
                .where(and(
                    ne(labTestOrders.status, 'resulted'),
                    ne(labTestOrders.status, 'cancelled'),
                    institutionFilter
                ))
                .orderBy(desc(labTestOrders.orderedAt))
                .limit(100);

            const enriched = await Promise.all(pendingOrders.map(async (o) => {
                const [visit] = await db.select({ visitNumber: visits.visitNumber })
                    .from(visits).where(eq(visits.id, o.visitId)).limit(1);
                return { ...o, visit_number: visit?.visitNumber ?? null };
            }));

            const pendingByUrgency: Record<string, number> = { critical: 0, emergency: 0, urgent: 0, routine: 0 };
            enriched.forEach(o => { pendingByUrgency[o.urgency] = (pendingByUrgency[o.urgency] ?? 0) + 1; });

            // ── Resulted today (filtered by institution via visit join) ──
            const [resultedTodayRow] = await db.select({ c: count() }).from(labTestResults)
                .leftJoin(labTestOrders, eq(labTestOrders.id, labTestResults.labTestOrderId))
                .leftJoin(visits, eq(visits.id, labTestOrders.visitId))
                .where(and(
                    gte(labTestResults.resultedAt, startOfDay),
                    institutionFilter
                ));
            const resultedToday = Number(resultedTodayRow?.c ?? 0);

            // ── Abnormal today (filtered by institution) ──
            const abnormalResults = await db.select({ id: labTestResults.id }).from(labTestResults)
                .leftJoin(labTestOrders, eq(labTestOrders.id, labTestResults.labTestOrderId))
                .leftJoin(visits, eq(visits.id, labTestOrders.visitId))
                .where(and(
                    gte(labTestResults.resultedAt, startOfDay),
                    sql`${labTestResults.abnormalFindings} IS NOT NULL AND ${labTestResults.abnormalFindings} != ''`,
                    institutionFilter
                ));
            const abnormalToday = abnormalResults.length;

            const criticalCount = enriched.filter(o => ['critical', 'emergency'].includes(o.urgency)).length;

            // ── Resulted this week (filtered by institution) ──
            const [resultedWeekRow] = await db.select({ c: count() }).from(labTestResults)
                .leftJoin(labTestOrders, eq(labTestOrders.id, labTestResults.labTestOrderId))
                .leftJoin(visits, eq(visits.id, labTestOrders.visitId))
                .where(and(
                    gte(labTestResults.resultedAt, sevenDaysAgo),
                    institutionFilter
                ));
            const resultedWeek = Number(resultedWeekRow?.c ?? 0);

            // ── 7-day activity (filtered by institution) ──
            const whereClause = institutionFilter
                ? sql`AND v.institution_id = ${staffInstitutionId}`
                : sql``;

            const weeklyActivity = await db.execute(sql`
                SELECT 
                    date_trunc('day', lto.ordered_at)::date AS date,
                    COUNT(DISTINCT lto.id) AS ordered,
                    COUNT(DISTINCT ltr.id) AS resulted
                FROM lab_test_orders lto
                LEFT JOIN lab_test_results ltr ON ltr.lab_test_order_id = lto.id
                LEFT JOIN visits v ON v.id = lto.visit_id
                WHERE lto.ordered_at >= ${sevenDaysAgoISO}
                ${whereClause}
                GROUP BY 1 ORDER BY 1
            `);

            // ── Avg turnaround (7d, filtered by institution) ──
            const taResult = await db.execute(sql`
                SELECT AVG(
                    EXTRACT(EPOCH FROM (ltr.resulted_at - lto.ordered_at))/60
                )::int AS avg_minutes
                FROM lab_test_orders lto
                JOIN lab_test_results ltr ON ltr.lab_test_order_id = lto.id
                LEFT JOIN visits v ON v.id = lto.visit_id
                WHERE lto.ordered_at >= ${sevenDaysAgoISO}
                ${whereClause}
            `);

            return c.json({
                success: true,
                data: {
                    totalPending: enriched.length,
                    pendingByUrgency,
                    criticalCount,
                    resultedToday,
                    resultedWeek,
                    abnormalToday,
                    avgTurnaroundMinutes: Number((taResult.rows?.[0] as any)?.avg_minutes ?? 0),
                    weeklyActivity: weeklyActivity.rows ?? [],
                },
            });
        } catch (err: any) {
            console.error('Lab overview error:', err);
            return handleError(err, c);
        }
    })

    // GET /api/lab-stats/my-stats (no hospital filter needed - personal performance)
    .openapi(createRoute({
        tags: ['Lab Stats'],
        summary: 'My lab performance',
        method: 'get',
        path: '/my-stats',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        responses: { 200: { content: { 'application/json': { schema: ok } }, description: 'My stats' } },
    }), async (c) => {
        try {
            const userId = c.get('userId');
            const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
            const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const sevenDaysAgoISO = sevenDaysAgo.toISOString();

            const [todayRow] = await db.select({ c: count() }).from(labTestResults)
                .where(and(eq(labTestResults.performedByLabTechId, userId), gte(labTestResults.resultedAt, startOfDay)));

            const [monthRow] = await db.select({ c: count() }).from(labTestResults)
                .where(and(eq(labTestResults.performedByLabTechId, userId), gte(labTestResults.resultedAt, startOfMonth)));

            const abnormalRows = await db.select({ id: labTestResults.id }).from(labTestResults)
                .where(and(
                    eq(labTestResults.performedByLabTechId, userId),
                    gte(labTestResults.resultedAt, startOfMonth),
                    sql`${labTestResults.abnormalFindings} IS NOT NULL AND ${labTestResults.abnormalFindings} != ''`
                ));

            const taResult = await db.execute(sql`
                SELECT AVG(EXTRACT(EPOCH FROM (ltr.resulted_at - lto.ordered_at))/60)::int AS avg_minutes
                FROM lab_test_results ltr
                JOIN lab_test_orders lto ON lto.id = ltr.lab_test_order_id
                WHERE ltr.performed_by_lab_tech_id = ${userId}
                  AND ltr.resulted_at >= ${sevenDaysAgoISO}
            `);

            return c.json({
                success: true,
                data: {
                    todayResults: Number(todayRow?.c ?? 0),
                    monthResults: Number(monthRow?.c ?? 0),
                    abnormalThisMonth: abnormalRows.length,
                    avgTurnaroundMinutes: Number((taResult.rows?.[0] as any)?.avg_minutes ?? 0),
                },
            });
        } catch (err: any) {
            console.error('My stats error:', err);
            return handleError(err, c);
        }
    })

    // GET /api/lab-stats/pending – list of pending orders (HOSPITAL FILTERED)
    .openapi(createRoute({
        tags: ['Lab Stats'],
        summary: 'Pending lab orders list',
        method: 'get',
        path: '/pending',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        responses: { 200: { content: { 'application/json': { schema: ok } }, description: 'Orders' } },
    }), async (c) => {
        try {
            const userType = c.get('userType');
            const userId = c.get('userId');
            if (!['lab_technician', 'admin'].includes(userType)) {
                return c.json({ success: false, error: { message: 'Access denied' } }, 403);
            }

            const staffInstitutionId = await getStaffInstitution(userId);
            const institutionFilter = (userType === 'admin' && !staffInstitutionId)
                ? undefined
                : eq(visits.institutionId, staffInstitutionId);

            const orders = await db.select({
                id: labTestOrders.id,
                orderNumber: labTestOrders.orderNumber,
                testName: labTestOrders.testName,
                testCode: labTestOrders.testCode,
                specimenType: labTestOrders.specimenType,
                urgency: labTestOrders.urgency,
                status: labTestOrders.status,
                clinicalNotes: labTestOrders.clinicalNotes,
                orderedAt: labTestOrders.orderedAt,
                visitId: labTestOrders.visitId,
                patientId: labTestOrders.patientId,
            })
                .from(labTestOrders)
                .leftJoin(visits, eq(visits.id, labTestOrders.visitId))
                .where(and(
                    ne(labTestOrders.status, 'resulted'),
                    ne(labTestOrders.status, 'cancelled'),
                    institutionFilter
                ))
                .orderBy(desc(labTestOrders.orderedAt))
                .limit(200);

            const enriched = await Promise.all(orders.map(async (o) => {
                const [v] = await db.select({ visitNumber: visits.visitNumber })
                    .from(visits).where(eq(visits.id, o.visitId)).limit(1);
                return { ...o, visit_number: v?.visitNumber ?? null };
            }));

            return c.json({ success: true, data: { orders: enriched, total: enriched.length } });
        } catch (err: any) {
            console.error(err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    });