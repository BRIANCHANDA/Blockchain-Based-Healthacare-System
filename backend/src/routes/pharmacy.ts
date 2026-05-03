import { createRoute, z } from '@hono/zod-openapi';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { createRouter } from '../lib/create-app';
import { authMiddleware } from '../middleware/auth';

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

    // ── GET /pharmacy-stats/overview ─────────────────────────────────────────────
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
        // @ts-expect-error
    }), async (c) => {
        try {
            const userType = c.get('userType');
            if (userType !== 'pharmacist' && userType !== 'admin') {
                return c.json({ success: false, error: { message: 'Access denied' } }, 403);
            }

            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            const weekStart = new Date();
            weekStart.setDate(weekStart.getDate() - 7);

            const [
                pendingCount,
                dispensedToday,
                dispensedWeek,
                statusBreakdown,
                topMedications,
                weeklyActivity,
                avgDispenseTime,
            ] = await Promise.all([

                // Pending prescriptions (prescribed or dispensing)
                db.execute(sql`
          SELECT COUNT(*) as count
          FROM prescriptions
          WHERE status IN ('prescribed', 'dispensing')
        `),

                // Dispensed today
                db.execute(sql`
          SELECT COUNT(*) as count
          FROM prescriptions
          WHERE status = 'dispensed'
          AND updated_at >= ${todayStart.toISOString()}
        `),

                // Dispensed this week
                db.execute(sql`
          SELECT COUNT(*) as count
          FROM prescriptions
          WHERE status = 'dispensed'
          AND updated_at >= ${weekStart.toISOString()}
        `),

                // All status breakdown
                db.execute(sql`
          SELECT status, COUNT(*) as count
          FROM prescriptions
          GROUP BY status
          ORDER BY count DESC
        `),

                // Top 5 most prescribed medications
                db.execute(sql`
          SELECT medication_name, COUNT(*) as count
          FROM prescription_items
          WHERE created_at >= ${weekStart.toISOString()}
          GROUP BY medication_name
          ORDER BY count DESC
          LIMIT 5
        `),

                // 7-day activity
                db.execute(sql`
          SELECT
            DATE(prescribed_at) as date,
            COUNT(*) as prescribed,
            COUNT(CASE WHEN status = 'dispensed' THEN 1 END) as dispensed
          FROM prescriptions
          WHERE prescribed_at >= ${weekStart.toISOString()}
          GROUP BY DATE(prescribed_at)
          ORDER BY date ASC
        `),

                // Avg time from prescribed to dispensed (minutes)
                db.execute(sql`
          SELECT
            AVG(
              EXTRACT(EPOCH FROM (updated_at - prescribed_at)) / 60
            )::numeric(10,1) as avg_minutes
          FROM prescriptions
          WHERE status = 'dispensed'
          AND prescribed_at >= ${weekStart.toISOString()}
        `),
            ]);

            // Status map
            const byStatus: Record<string, number> = {};
            (statusBreakdown.rows as any[]).forEach((r) => {
                byStatus[r.status] = parseInt(r.count);
            });

            return c.json({
                success: true,
                data: {
                    pendingCount: parseInt((pendingCount.rows[0] as any)?.count ?? '0'),
                    dispensedToday: parseInt((dispensedToday.rows[0] as any)?.count ?? '0'),
                    dispensedWeek: parseInt((dispensedWeek.rows[0] as any)?.count ?? '0'),
                    statusBreakdown: byStatus,
                    topMedications: topMedications.rows,
                    weeklyActivity: weeklyActivity.rows,
                    avgDispenseMinutes: parseFloat((avgDispenseTime.rows[0] as any)?.avg_minutes ?? '0'),
                },
            });

        } catch (err: any) {
            console.error('Pharmacy stats overview error:', err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    })

    // ── GET /pharmacy-stats/my-stats ─────────────────────────────────────────────
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
        // @ts-expect-error
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

            const [todayItems, monthItems, avgTime] = await Promise.all([

                // Items I dispensed today
                db.execute(sql`
          SELECT COUNT(*) as count
          FROM prescription_items
          WHERE dispensed_by_pharmacist_id = ${userId}
          AND dispensed_at >= ${todayStart.toISOString()}
        `),

                // Items I dispensed this month
                db.execute(sql`
          SELECT COUNT(*) as count
          FROM prescription_items
          WHERE dispensed_by_pharmacist_id = ${userId}
          AND dispensed_at >= ${monthStart.toISOString()}
        `),

                // My avg dispense time this month
                db.execute(sql`
          SELECT
            AVG(
              EXTRACT(EPOCH FROM (pi.dispensed_at - p.prescribed_at)) / 60
            )::numeric(10,1) as avg_minutes
          FROM prescription_items pi
          JOIN prescriptions p ON p.id = pi.prescription_id
          WHERE pi.dispensed_by_pharmacist_id = ${userId}
          AND pi.dispensed_at >= ${monthStart.toISOString()}
        `),
            ]);

            return c.json({
                success: true,
                data: {
                    todayItems: parseInt((todayItems.rows[0] as any)?.count ?? '0'),
                    monthItems: parseInt((monthItems.rows[0] as any)?.count ?? '0'),
                    avgDispenseMinutes: parseFloat((avgTime.rows[0] as any)?.avg_minutes ?? '0'),
                },
            });

        } catch (err: any) {
            console.error('Pharmacy my-stats error:', err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    });