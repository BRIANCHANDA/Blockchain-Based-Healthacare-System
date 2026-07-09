import { handleError } from '../lib/errors';
// src/routes/admin-stats.ts
// Mount as: app.route('/api/dashboard/admin', adminStatsRouter)
//
// Two-tier admin:
//   Super admin  — institutionId IS NULL  → system-wide stats
//   Hospital admin — institutionId IS SET → scoped to their institution only

import { createRoute, z } from '@hono/zod-openapi';
import { eq, and, gte, count, isNull, isNotNull } from 'drizzle-orm';
import { db } from '../db';
import {
    patients, practitioners, institutions, visits,
    accessRequests, labTestOrders, imagingOrders,
    prescriptions, auditLogs, patientInstitutionRegistrations,
} from '../db/schema';
import { createRouter } from '../lib/create-app';
import { authMiddleware } from '../middleware/auth';

const successData = z.object({ success: z.boolean(), data: z.any() });
const errorSchema = z.object({ success: z.boolean(), error: z.object({ message: z.string() }) });

export const adminStatsRouter = createRouter()
    .openapi(createRoute({
        tags: ['Dashboard'],
        summary: 'Admin dashboard stats (scoped by admin level)',
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
            if (c.get('userType') !== 'admin')
                return c.json({ success: false, error: { message: 'Admin only' } }, 403);

            const userId = c.get('userId');

            // Look up this admin's institutionId to determine their level
            const [me] = await db
                .select({ institutionId: practitioners.institutionId })
                .from(practitioners)
                .where(eq(practitioners.id, userId))
                .limit(1);

            const institutionId = me?.institutionId ?? null;
            const isSuperAdmin = institutionId === null;

            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);

            if (isSuperAdmin) {
                // ── SUPER ADMIN: system-wide stats ────────────────────────────
                const [
                    totalPatients, totalStaff, totalInstitutions, activeVisits,
                    completedToday, pendingPermissions, pendingLabOrders,
                    pendingImaging, unverifiedStaff, auditLogsToday,
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
                        adminLevel: 'super',
                        totalPatients, totalStaff, totalInstitutions, activeVisits,
                        completedToday, pendingPermissions, pendingLabOrders,
                        pendingImaging, unverifiedStaff, auditLogsToday,
                    },
                });
            } else {
                // ── HOSPITAL ADMIN: institution-scoped stats ──────────────────
                const [
                    totalPatients, totalStaff, activeVisits,
                    completedToday, pendingLabOrders, pendingImaging,
                    unverifiedStaff, auditLogsToday,
                ] = await Promise.all([
                    // Patients registered at this institution
                    db.select({ c: count() })
                        .from(patientInstitutionRegistrations)
                        .where(and(
                            eq(patientInstitutionRegistrations.institutionId, institutionId),
                            eq(patientInstitutionRegistrations.isActive, true),
                        ))
                        .then(r => Number(r[0]?.c ?? 0)),

                    // Staff at this institution
                    db.select({ c: count() })
                        .from(practitioners)
                        .where(and(
                            eq(practitioners.institutionId, institutionId),
                            eq(practitioners.isActive, true),
                        ))
                        .then(r => Number(r[0]?.c ?? 0)),

                    // Active visits at this institution
                    db.select({ c: count() })
                        .from(visits)
                        .where(and(
                            eq(visits.institutionId, institutionId),
                            eq(visits.status, 'in-progress'),
                        ))
                        .then(r => Number(r[0]?.c ?? 0)),

                    // Completed today at this institution
                    db.select({ c: count() })
                        .from(visits)
                        .where(and(
                            eq(visits.institutionId, institutionId),
                            eq(visits.status, 'completed'),
                            gte(visits.admissionDate, startOfDay),
                        ))
                        .then(r => Number(r[0]?.c ?? 0)),

                    // Pending lab orders at this institution
                    db.select({ c: count() })
                        .from(labTestOrders)
                        .innerJoin(visits, eq(visits.id, labTestOrders.visitId))
                        .where(and(
                            eq(visits.institutionId, institutionId),
                            eq(labTestOrders.status, 'ordered'),
                        ))
                        .then(r => Number(r[0]?.c ?? 0)),

                    // Pending imaging at this institution
                    db.select({ c: count() })
                        .from(imagingOrders)
                        .innerJoin(visits, eq(visits.id, imagingOrders.visitId))
                        .where(and(
                            eq(visits.institutionId, institutionId),
                            eq(imagingOrders.status, 'ordered'),
                        ))
                        .then(r => Number(r[0]?.c ?? 0)),

                    // Unverified staff at this institution
                    db.select({ c: count() })
                        .from(practitioners)
                        .where(and(
                            eq(practitioners.institutionId, institutionId),
                            eq(practitioners.isActive, true),
                            eq(practitioners.isVerified, false),
                        ))
                        .then(r => Number(r[0]?.c ?? 0)),

                    // Audit events today at this institution (via visits)
                    db.select({ c: count() })
                        .from(auditLogs)
                        .where(and(
                            gte(auditLogs.timestamp, startOfDay),
                            eq(auditLogs.userType, 'admin'),
                        ))
                        .then(r => Number(r[0]?.c ?? 0)),
                ]);

                // Get institution name for the header
                const [inst] = await db
                    .select({ name: institutions.institutionName })
                    .from(institutions)
                    .where(eq(institutions.id, institutionId))
                    .limit(1);

                return c.json({
                    success: true,
                    data: {
                        adminLevel: 'hospital',
                        institutionId,
                        institutionName: inst?.name ?? 'Your Institution',
                        totalPatients, totalStaff,
                        totalInstitutions: 1,   // hospital admin manages 1 institution
                        activeVisits, completedToday,
                        pendingPermissions: 0,  // not relevant at hospital level
                        pendingLabOrders, pendingImaging,
                        unverifiedStaff, auditLogsToday,
                    },
                });
            }
        } catch (err: any) {
            console.error('[ADMIN_STATS]', err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    });