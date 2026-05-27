import { createRoute, z } from '@hono/zod-openapi';
import { sql, eq, and, ne, count, desc } from 'drizzle-orm';
import { db } from '../db';
import { createRouter } from '../lib/create-app';
import { authMiddleware } from '../middleware/auth';
import { practitioners, visits, prescriptions, prescriptionItems } from '../db/schema';

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
    });