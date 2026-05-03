// src/routes/admin-stats.ts
// Mount as: app.route('/api/dashboard/admin', adminStatsRouter)

import { createRoute, z } from '@hono/zod-openapi';
import { eq, and, gte, count, sql } from 'drizzle-orm';
import { db } from '../db';
import {
    patients, practitioners, institutions, visits,
    accessRequests, labTestOrders, imagingOrders,
    prescriptions, auditLogs,
} from '../db/schema';
import { createRouter } from '../lib/create-app';
import { authMiddleware } from '../middleware/auth';

type AppContext = {
    Variables: { userId: string; userType: string; blockchainAddress: string };
};

const successData = z.object({ success: z.boolean(), data: z.any() });
const errorSchema = z.object({ success: z.boolean(), error: z.object({ message: z.string() }) });

export const adminStatsRouter = createRouter<AppContext>()
    .openapi(createRoute({
        tags: ['Dashboard'],
        summary: 'Admin dashboard stats',
        method: 'get',
        path: '/',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        responses: {
            200: { content: { 'application/json': { schema: successData } }, description: 'Stats' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
        },
        // @ts-expect-error
    }), async (c) => {
        try {
            if (c.get('userType') !== 'admin') {
                return c.json({ success: false, error: { message: 'Admin only' } }, 403);
            }

            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);

            const [
                totalPatients,
                totalStaff,
                totalInstitutions,
                activeVisits,
                completedToday,
                pendingPermissions,
                pendingLabOrders,
                pendingImaging,
                unverifiedStaff,
                auditLogsToday,
            ] = await Promise.all([
                db.select({ c: count() }).from(patients).where(eq(patients.isActive, true)).then(r => Number(r[0]?.c ?? 0)),
                db.select({ c: count() }).from(practitioners).where(eq(practitioners.isActive, true)).then(r => Number(r[0]?.c ?? 0)),
                db.select({ c: count() }).from(institutions).where(eq(institutions.isActive, true)).then(r => Number(r[0]?.c ?? 0)),
                db.select({ c: count() }).from(visits).where(eq(visits.status, 'in-progress')).then(r => Number(r[0]?.c ?? 0)),
                db.select({ c: count() }).from(visits).where(and(eq(visits.status, 'completed'), gte(visits.admissionDate, startOfDay))).then(r => Number(r[0]?.c ?? 0)),
                db.select({ c: count() }).from(accessRequests).where(eq(accessRequests.status, 'pending')).then(r => Number(r[0]?.c ?? 0)),
                db.select({ c: count() }).from(labTestOrders).where(eq(labTestOrders.status, 'ordered')).then(r => Number(r[0]?.c ?? 0)),
                db.select({ c: count() }).from(imagingOrders).where(eq(imagingOrders.status, 'ordered')).then(r => Number(r[0]?.c ?? 0)),
                db.select({ c: count() }).from(practitioners).where(and(eq(practitioners.isActive, true), eq(practitioners.isVerified, false))).then(r => Number(r[0]?.c ?? 0)),
                db.select({ c: count() }).from(auditLogs).where(gte(auditLogs.timestamp, startOfDay)).then(r => Number(r[0]?.c ?? 0)),
            ]);

            return c.json({
                success: true,
                data: {
                    totalPatients, totalStaff, totalInstitutions, activeVisits,
                    completedToday, pendingPermissions, pendingLabOrders, pendingImaging,
                    unverifiedStaff, auditLogsToday,
                },
            });
        } catch (err: any) {
            console.error(err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    });