import { handleError } from '../lib/errors';
// src/routes/radiology-stats.ts
// Replaces the misnamed receptionist stats file
// Endpoints:
//   GET /api/radiology-stats/overview   — institution-wide imaging stats
//   GET /api/radiology-stats/my-stats   — stats for the logged-in radiologist

import { createRoute, z } from '@hono/zod-openapi';
import { eq, and, gte, lt, count, desc, sql } from 'drizzle-orm';
import { db } from '../db';
import { imagingOrders, visits, practitioners } from '../db/schema';
import { createRouter } from '../lib/create-app';
import { authMiddleware } from '../middleware/auth';

const errorSchema = z.object({ success: z.boolean(), error: z.object({ message: z.string() }) });
const successSchema = z.object({ success: z.boolean(), data: z.any() });

function startOfToday() {
    const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d;
}
function startOfWeek() {
    const d = startOfToday(); d.setUTCDate(d.getUTCDate() - 7); return d;
}

async function getInstitutionId(userId: string): Promise<string | null> {
    const rows = await db.select({ institutionId: practitioners.institutionId }).from(practitioners).where(eq(practitioners.id, userId)).limit(1);
    return rows[0]?.institutionId ?? null;
}

export const radiologyStatsRouter = createRouter()

    // ── GET /overview ─────────────────────────────────────────────────────────
    .openapi(createRoute({
        tags: ['Radiology'],
        summary: 'Radiology overview stats for the institution',
        method: 'get', path: '/overview',
        security: [{ bearerAuth: [] }], middleware: [authMiddleware],
        responses: {
            200: { content: { 'application/json': { schema: successSchema } }, description: 'OK' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
        },
        // @ts-expect-error
    }), async (c) => {
        try {
            const userType = c.get('userType');
            const userId = c.get('userId');
            if (!['radiologist', 'admin'].includes(userType))
                return c.json({ success: false, error: { message: 'Radiologist access required' } }, 403);

            const institutionId = await getInstitutionId(userId);
            const today = startOfToday();
            const weekAgo = startOfWeek();
            const tomorrow = new Date(today); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

            // Build institution condition through visits join
            const instJoin = institutionId
                ? eq(visits.institutionId, institutionId)
                : undefined;

            // Total pending (ordered, scheduled)
            const pendingRows = await db
                .select({ count: count() })
                .from(imagingOrders)
                .innerJoin(visits, eq(visits.id, imagingOrders.visitId))
                .where(and(
                    sql`${imagingOrders.status} IN ('ordered','scheduled')`,
                    ...(instJoin ? [instJoin] : []),
                ));
            const totalPending = Number(pendingRows[0]?.count ?? 0);

            // Critical/emergency pending
            const criticalRows = await db
                .select({ count: count() })
                .from(imagingOrders)
                .innerJoin(visits, eq(visits.id, imagingOrders.visitId))
                .where(and(
                    sql`${imagingOrders.status} IN ('ordered','scheduled')`,
                    sql`${visits.priority} IN ('critical','emergency')`,
                    ...(instJoin ? [instJoin] : []),
                ));
            const criticalCount = Number(criticalRows[0]?.count ?? 0);

            // Reported today
            const reportedTodayRows = await db
                .select({ count: count() })
                .from(imagingOrders)
                .innerJoin(visits, eq(visits.id, imagingOrders.visitId))
                .where(and(
                    eq(imagingOrders.status, 'reported'),
                    gte(imagingOrders.updatedAt, today),
                    lt(imagingOrders.updatedAt, tomorrow),
                    ...(instJoin ? [instJoin] : []),
                ));
            const reportedToday = Number(reportedTodayRows[0]?.count ?? 0);

            // Reported this week
            const reportedWeekRows = await db
                .select({ count: count() })
                .from(imagingOrders)
                .innerJoin(visits, eq(visits.id, imagingOrders.visitId))
                .where(and(
                    eq(imagingOrders.status, 'reported'),
                    gte(imagingOrders.updatedAt, weekAgo),
                    ...(instJoin ? [instJoin] : []),
                ));
            const reportedWeek = Number(reportedWeekRows[0]?.count ?? 0);

            // Pending by modality
            const byModalityRows = await db
                .select({ modality: imagingOrders.modality, count: count() })
                .from(imagingOrders)
                .innerJoin(visits, eq(visits.id, imagingOrders.visitId))
                .where(and(
                    sql`${imagingOrders.status} IN ('ordered','scheduled')`,
                    ...(instJoin ? [instJoin] : []),
                ))
                .groupBy(imagingOrders.modality);
            const pendingByModality: Record<string, number> = {};
            for (const row of byModalityRows) {
                if (row.modality) pendingByModality[row.modality] = Number(row.count);
            }

            // 7-day activity
            const weeklyActivity = await db.execute(sql`
                SELECT
                    DATE(io.updated_at) as date,
                    COUNT(CASE WHEN io.status IN ('ordered','scheduled') THEN 1 END) as ordered,
                    COUNT(CASE WHEN io.status = 'reported' THEN 1 END) as reported
                FROM imaging_orders io
                INNER JOIN visits v ON v.id = io.visit_id
                WHERE io.updated_at >= ${weekAgo.toISOString()}
                  ${institutionId ? sql`AND v.institution_id = ${institutionId}` : sql``}
                GROUP BY DATE(io.updated_at)
                ORDER BY date ASC
            `);

            return c.json({
                success: true,
                data: {
                    totalPending,
                    criticalCount,
                    reportedToday,
                    reportedWeek,
                    pendingByModality,
                    weeklyActivity: (weeklyActivity as any[]).map(r => ({
                        date: r.date,
                        ordered: Number(r.ordered),
                        reported: Number(r.reported),
                    })),
                },
            });
        } catch (err: any) {
            console.error('[RADIOLOGY_OVERVIEW]', err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    })

    // ── GET /my-stats ─────────────────────────────────────────────────────────
    .openapi(createRoute({
        tags: ['Radiology'],
        summary: 'Stats for the logged-in radiologist',
        method: 'get', path: '/my-stats',
        security: [{ bearerAuth: [] }], middleware: [authMiddleware],
        responses: {
            200: { content: { 'application/json': { schema: successSchema } }, description: 'OK' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
        },
        // @ts-expect-error
    }), async (c) => {
        try {
            const userType = c.get('userType');
            const userId = c.get('userId');
            if (!['radiologist', 'admin'].includes(userType))
                return c.json({ success: false, error: { message: 'Radiologist access required' } }, 403);

            const today = startOfToday();
            const monthAgo = new Date(today); monthAgo.setUTCMonth(monthAgo.getUTCMonth() - 1);
            const tomorrow = new Date(today); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

            // Reports today by this radiologist
            const todayRows = await db
                .select({ count: count() })
                .from(imagingOrders)
                .where(and(
                    eq(imagingOrders.reportedById, userId),
                    eq(imagingOrders.status, 'reported'),
                    gte(imagingOrders.updatedAt, today),
                    lt(imagingOrders.updatedAt, tomorrow),
                ));
            const todayReports = Number(todayRows[0]?.count ?? 0);

            // Reports this month
            const monthRows = await db
                .select({ count: count() })
                .from(imagingOrders)
                .where(and(
                    eq(imagingOrders.reportedById, userId),
                    eq(imagingOrders.status, 'reported'),
                    gte(imagingOrders.updatedAt, monthAgo),
                ));
            const monthReports = Number(monthRows[0]?.count ?? 0);

            // Modality breakdown for this radiologist
            const modalityRows = await db
                .select({ modality: imagingOrders.modality, count: count() })
                .from(imagingOrders)
                .where(and(
                    eq(imagingOrders.reportedById, userId),
                    eq(imagingOrders.status, 'reported'),
                    gte(imagingOrders.updatedAt, monthAgo),
                ))
                .groupBy(imagingOrders.modality);
            const modalityBreakdown: Record<string, number> = {};
            for (const row of modalityRows) {
                if (row.modality) modalityBreakdown[row.modality] = Number(row.count);
            }

            // Avg turnaround (ordered_at → updated_at) in minutes for reported orders
            const turnaroundRows = await db.execute(sql`
                SELECT AVG(EXTRACT(EPOCH FROM (updated_at - ordered_at)) / 60)::int as avg_mins
                FROM imaging_orders
                WHERE reported_by_id = ${userId}
                  AND status = 'reported'
                  AND updated_at >= ${monthAgo.toISOString()}
                  AND ordered_at IS NOT NULL
            `);
            const avgTurnaroundMinutes = Number((turnaroundRows as any[])[0]?.avg_mins ?? 0);

            return c.json({
                success: true,
                data: {
                    todayReports,
                    monthReports,
                    modalityBreakdown,
                    avgTurnaroundMinutes,
                },
            });
        } catch (err: any) {
            console.error('[RADIOLOGY_MY_STATS]', err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    });