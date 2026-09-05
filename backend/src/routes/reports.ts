/**
 * Aggregate reporting for the admin dashboard.
 *
 * Three views over the same data, separated by audience rather than by table:
 *
 *   /clinical       — case mix, diagnoses, outcomes: what was treated
 *   /operational    — throughput, occupancy, waiting times: how the place ran
 *   /administrative — staffing and institution-level totals
 *
 * NO ENDPOINT HERE RETURNS AN IDENTIFIABLE PATIENT — only counts and
 * aggregates. That is what allows these to be read by administrators who hold no
 * consent to any individual record. Adding a patient name or identifier to a
 * response here would quietly turn a statistics endpoint into a way around the
 * consent model, so treat that as the invariant when extending this file.
 *
 * Practitioner names are a deliberate exception: /clinical decrypts and returns
 * the treating doctor for per-doctor breakdowns. Staff attribution is
 * administrative information, not patient data.
 *
 * Queries are scoped to the caller's institution unless they are a system
 * administrator.
 */

import { handleError } from '../lib/errors';
// src/routes/reports.ts
// Mount as: app.route('/api/reports', reportsRouter)

import { createRoute, z } from '@hono/zod-openapi';
import { eq, and, gte, lte, count, sql, desc } from 'drizzle-orm';
import { execFileSync } from 'child_process';
import path from 'path';
import { db } from '../db';
import {
    visits, patients, practitioners, institutions,
    labTestOrders, imagingOrders, prescriptions,
    referrals, auditLogs, patientInstitutionRegistrations, diagnoses,
} from '../db/schema';
import { createRouter } from '../lib/create-app';
import { authMiddleware } from '../middleware/auth';
import { decrypt } from '../services/crypto';

const errorSchema = z.object({ success: z.boolean(), error: z.object({ message: z.string() }) });
const successData = z.object({ success: z.boolean(), data: z.any() });

const dateRangeQuery = z.object({
    from: z.string().optional(),
    to: z.string().optional(),
    format: z.enum(['json', 'pdf']).optional().default('json'),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getAdminScope(userId: string): Promise<{ institutionId: string | null; isSuperAdmin: boolean; institutionName: string }> {
    const row = await db
        .select({ institutionId: practitioners.institutionId })
        .from(practitioners)
        .where(eq(practitioners.id, userId))
        .limit(1);

    const institutionId = row[0]?.institutionId ?? null;
    const isSuperAdmin = institutionId === null;

    let institutionName = 'All Institutions';
    if (!isSuperAdmin && institutionId) {
        const inst = await db.select({ name: institutions.institutionName }).from(institutions).where(eq(institutions.id, institutionId)).limit(1);
        institutionName = inst[0]?.name ?? 'Unknown Institution';
    }

    return { institutionId, isSuperAdmin, institutionName };
}

function parseDateRange(from?: string, to?: string): { startDate: Date; endDate: Date } {
    const endDate = to ? new Date(to + 'T23:59:59Z') : new Date();
    const startDate = from ? new Date(from + 'T00:00:00Z') : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { startDate, endDate };
}

function generatePDF(data: object): Buffer {
    const scriptPath = path.join(process.cwd(), 'src', 'scripts', 'generate_report.py');
    return execFileSync('python3', [scriptPath, JSON.stringify(data)], {
        maxBuffer: 10 * 1024 * 1024,
        timeout: 30_000,
    });
}

function pdfResponse(c: any, data: any) {
    try {
        const pdf = generatePDF(data);
        // Dated filename so a user downloading several reports gets distinct,
        // self-describing files rather than "(1)", "(2)" duplicates.
        const stamp = new Date().toISOString().slice(0, 10);
        const scope = String(data.institutionName ?? 'report')
            .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const filename = `medlink-${data.reportType}-${scope}-${stamp}.pdf`;
        c.header('Content-Type', 'application/pdf');
        c.header('Content-Disposition', `attachment; filename="${filename}"`);
        return c.body(pdf);
    } catch (err: any) {
        console.error('[PDF_GENERATE]', err);
        return c.json({ success: false, error: { message: 'PDF generation failed. Please try again.' } }, 500);
    }
}

// ── Router ────────────────────────────────────────────────────────────────────

export const reportsRouter = createRouter()

    // ── CLINICAL ──────────────────────────────────────────────────────────────
    .openapi(createRoute({
        tags: ['Reports'],
        summary: 'Clinical report — visits, lab, imaging, prescriptions',
        method: 'get', path: '/clinical',
        security: [{ bearerAuth: [] }], middleware: [authMiddleware],
        request: { query: dateRangeQuery },
        responses: {
            200: { content: { 'application/json': { schema: successData } }, description: 'Clinical report' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
        // @ts-expect-error
    }), async (c) => {
        try {
            if (c.get('userType') !== 'admin') return c.json({ success: false, error: { message: 'Admin only' } }, 403);

            const { from, to, format } = c.req.valid('query');
            const { startDate, endDate } = parseDateRange(from, to);
            const { institutionId, isSuperAdmin, institutionName } = await getAdminScope(c.get('userId'));

            const instCondition = institutionId ? eq(visits.institutionId, institutionId) : undefined;
            const visitConditions = [
                gte(visits.admissionDate, startDate),
                lte(visits.admissionDate, endDate),
                ...(instCondition ? [instCondition] : []),
            ];

            const [totalVisits, completedVisits, activeVisits, cancelledVisits] = await Promise.all([
                db.select({ c: count() }).from(visits).where(and(...visitConditions)).then(r => Number(r[0]?.c ?? 0)),
                db.select({ c: count() }).from(visits).where(and(...visitConditions, eq(visits.status, 'completed'))).then(r => Number(r[0]?.c ?? 0)),
                db.select({ c: count() }).from(visits).where(and(...visitConditions, eq(visits.status, 'in-progress'))).then(r => Number(r[0]?.c ?? 0)),
                db.select({ c: count() }).from(visits).where(and(...visitConditions, eq(visits.status, 'cancelled'))).then(r => Number(r[0]?.c ?? 0)),
            ]);

            const visitsByType = await db.select({ type: visits.visitType, count: count() }).from(visits).where(and(...visitConditions)).groupBy(visits.visitType);
            const visitsByPriority = await db.select({ priority: visits.priority, count: count() }).from(visits).where(and(...visitConditions)).groupBy(visits.priority);
            const visitsTrend = await db.execute(sql`SELECT DATE(admission_date) as date, COUNT(*) as count FROM visits WHERE admission_date >= ${startDate.toISOString()} AND admission_date <= ${endDate.toISOString()} ${institutionId ? sql`AND institution_id = ${institutionId}` : sql``} GROUP BY DATE(admission_date) ORDER BY date ASC`);

            const labConditions = [gte(labTestOrders.orderedAt, startDate), lte(labTestOrders.orderedAt, endDate)];
            const [totalLab, completedLab, pendingLab] = await Promise.all([
                db.select({ c: count() }).from(labTestOrders).innerJoin(visits, eq(visits.id, labTestOrders.visitId)).where(and(...labConditions, ...(institutionId ? [eq(visits.institutionId, institutionId)] : []))).then(r => Number(r[0]?.c ?? 0)),
                db.select({ c: count() }).from(labTestOrders).innerJoin(visits, eq(visits.id, labTestOrders.visitId)).where(and(...labConditions, eq(labTestOrders.status, 'resulted'), ...(institutionId ? [eq(visits.institutionId, institutionId)] : []))).then(r => Number(r[0]?.c ?? 0)),
                db.select({ c: count() }).from(labTestOrders).innerJoin(visits, eq(visits.id, labTestOrders.visitId)).where(and(...labConditions, eq(labTestOrders.status, 'ordered'), ...(institutionId ? [eq(visits.institutionId, institutionId)] : []))).then(r => Number(r[0]?.c ?? 0)),
            ]);

            const imagingConditions = [gte(imagingOrders.orderedAt, startDate), lte(imagingOrders.orderedAt, endDate)];
            const [totalImaging, completedImaging] = await Promise.all([
                db.select({ c: count() }).from(imagingOrders).innerJoin(visits, eq(visits.id, imagingOrders.visitId)).where(and(...imagingConditions, ...(institutionId ? [eq(visits.institutionId, institutionId)] : []))).then(r => Number(r[0]?.c ?? 0)),
                db.select({ c: count() }).from(imagingOrders).innerJoin(visits, eq(visits.id, imagingOrders.visitId)).where(and(...imagingConditions, eq(imagingOrders.status, 'reported'), ...(institutionId ? [eq(visits.institutionId, institutionId)] : []))).then(r => Number(r[0]?.c ?? 0)),
            ]);

            const rxConditions = [gte(prescriptions.createdAt, startDate), lte(prescriptions.createdAt, endDate)];
            const [totalRx, dispensedRx] = await Promise.all([
                db.select({ c: count() }).from(prescriptions).innerJoin(visits, eq(visits.id, prescriptions.visitId)).where(and(...rxConditions, ...(institutionId ? [eq(visits.institutionId, institutionId)] : []))).then(r => Number(r[0]?.c ?? 0)),
                db.select({ c: count() }).from(prescriptions).innerJoin(visits, eq(visits.id, prescriptions.visitId)).where(and(...rxConditions, eq(prescriptions.status, 'dispensed'), ...(institutionId ? [eq(visits.institutionId, institutionId)] : []))).then(r => Number(r[0]?.c ?? 0)),
            ]);

            const instSql = institutionId ? sql` AND v.institution_id = ${institutionId}` : sql``;
            const [avgLOSResult, topDiagnosesResult, patientsByGenderResult] = await Promise.all([
                db.execute(sql`
                    SELECT ROUND(AVG(EXTRACT(EPOCH FROM (discharge_date - admission_date)) / 86400.0)::numeric, 1) AS avg_los
                    FROM visits
                    WHERE status = 'completed' AND discharge_date IS NOT NULL
                      AND admission_date >= ${startDate.toISOString()} AND admission_date <= ${endDate.toISOString()}
                      ${institutionId ? sql`AND institution_id = ${institutionId}` : sql``}
                `),
                db.execute(sql`
                    SELECT d.diagnosis_name, d.icd_code, COUNT(*)::int AS cnt
                    FROM diagnoses d
                    JOIN visits v ON d.visit_id = v.id
                    WHERE v.admission_date >= ${startDate.toISOString()} AND v.admission_date <= ${endDate.toISOString()}
                    ${instSql}
                    GROUP BY d.diagnosis_name, d.icd_code
                    ORDER BY cnt DESC
                    LIMIT 10
                `),
                db.execute(sql`
                    SELECT p.gender, COUNT(DISTINCT v.patient_id)::int AS cnt
                    FROM visits v
                    JOIN patients p ON v.patient_id = p.id
                    WHERE v.admission_date >= ${startDate.toISOString()} AND v.admission_date <= ${endDate.toISOString()}
                    ${instSql}
                    GROUP BY p.gender
                `),
            ]);

            const avgLengthOfStay = Number((avgLOSResult as any[])[0]?.avg_los ?? 0);
            const topDiagnosesList = (topDiagnosesResult as any[]).map(r => ({
                name: String(r.diagnosis_name ?? ''),
                icdCode: r.icd_code ? String(r.icd_code) : null,
                count: Number(r.cnt),
            }));
            const patientsByGender = (patientsByGenderResult as any[]).map(r => ({
                gender: String(r.gender ?? 'unknown'),
                count: Number(r.cnt),
            }));

            const data = {
                reportType: 'clinical', institutionName, isSuperAdmin,
                period: { from: startDate.toISOString(), to: endDate.toISOString() },
                generatedAt: new Date().toISOString(),
                visits: {
                    total: totalVisits, completed: completedVisits, active: activeVisits, cancelled: cancelledVisits,
                    completionRate: totalVisits > 0 ? Math.round(completedVisits / totalVisits * 100) : 0,
                    byType: visitsByType.map(r => ({ type: r.type, count: Number(r.count) })),
                    byPriority: visitsByPriority.map(r => ({ priority: r.priority, count: Number(r.count) })),
                    trend: (visitsTrend as any[]).map(r => ({ date: r.date, count: Number(r.count) })),
                },
                laboratory: { total: totalLab, completed: completedLab, pending: pendingLab },
                imaging: { total: totalImaging, completed: completedImaging, pending: totalImaging - completedImaging },
                pharmacy: { total: totalRx, dispensed: dispensedRx, pending: totalRx - dispensedRx },
                avgLengthOfStay,
                topDiagnoses: topDiagnosesList,
                patientsByGender,
            };

            if (format === 'pdf') return pdfResponse(c, data);
            return c.json({ success: true, data });
        } catch (err: any) {
            console.error('[REPORT_CLINICAL]', err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    })

    // ── OPERATIONAL ───────────────────────────────────────────────────────────
    .openapi(createRoute({
        tags: ['Reports'],
        summary: 'Operational report — staff activity, referrals, appointments',
        method: 'get', path: '/operational',
        security: [{ bearerAuth: [] }], middleware: [authMiddleware],
        request: { query: dateRangeQuery },
        responses: {
            200: { content: { 'application/json': { schema: successData } }, description: 'Operational report' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
        // @ts-expect-error
    }), async (c) => {
        try {
            if (c.get('userType') !== 'admin') return c.json({ success: false, error: { message: 'Admin only' } }, 403);

            const { from, to, format } = c.req.valid('query');
            const { startDate, endDate } = parseDateRange(from, to);
            const { institutionId, isSuperAdmin, institutionName } = await getAdminScope(c.get('userId'));

            const visitConditions = [
                gte(visits.admissionDate, startDate),
                lte(visits.admissionDate, endDate),
                ...(institutionId ? [eq(visits.institutionId, institutionId)] : []),
            ];

            const doctorActivity = await db
                .select({ doctorId: visits.assignedDoctorId, visitCount: count() })
                .from(visits)
                .where(and(...visitConditions, sql`${visits.assignedDoctorId} IS NOT NULL`))
                .groupBy(visits.assignedDoctorId)
                .orderBy(desc(count()))
                .limit(20);

            const doctorActivityWithNames = await Promise.all(doctorActivity.map(async row => {
                if (!row.doctorId) return null;
                const doc = await db.select({ f: practitioners.firstNameEncrypted, l: practitioners.lastNameEncrypted, spec: practitioners.specialization }).from(practitioners).where(eq(practitioners.id, row.doctorId)).limit(1);
                let name = 'Unknown';
                try { if (doc.length) name = `${decrypt(doc[0].f)} ${decrypt(doc[0].l)}`; } catch { }
                return { doctorId: row.doctorId, name, specialization: doc[0]?.spec ?? null, visitCount: Number(row.visitCount) };
            }));

            const refConditions = [gte(referrals.referredAt, startDate), lte(referrals.referredAt, endDate)];
            const [totalReferrals, pendingRef, acceptedRef, completedRef, rejectedRef] = await Promise.all([
                db.select({ c: count() }).from(referrals).where(and(...refConditions, ...(institutionId ? [eq(referrals.referringInstitutionId, institutionId)] : []))).then(r => Number(r[0]?.c ?? 0)),
                db.select({ c: count() }).from(referrals).where(and(...refConditions, eq(referrals.status, 'pending'), ...(institutionId ? [eq(referrals.referringInstitutionId, institutionId)] : []))).then(r => Number(r[0]?.c ?? 0)),
                db.select({ c: count() }).from(referrals).where(and(...refConditions, eq(referrals.status, 'accepted'), ...(institutionId ? [eq(referrals.referringInstitutionId, institutionId)] : []))).then(r => Number(r[0]?.c ?? 0)),
                db.select({ c: count() }).from(referrals).where(and(...refConditions, eq(referrals.status, 'completed'), ...(institutionId ? [eq(referrals.referringInstitutionId, institutionId)] : []))).then(r => Number(r[0]?.c ?? 0)),
                db.select({ c: count() }).from(referrals).where(and(...refConditions, eq(referrals.status, 'rejected'), ...(institutionId ? [eq(referrals.referringInstitutionId, institutionId)] : []))).then(r => Number(r[0]?.c ?? 0)),
            ]);

            const incomingRef = institutionId
                ? await db.select({ c: count() }).from(referrals).where(and(...refConditions, eq(referrals.receivingInstitutionId, institutionId))).then(r => Number(r[0]?.c ?? 0))
                : 0;

            const [totalAppts, attendedAppts, cancelledAppts] = await Promise.all([
                db.select({ c: count() }).from(visits).where(and(gte(visits.admissionDate, startDate), lte(visits.admissionDate, endDate), sql`visit_number LIKE 'APT-%'`, ...(institutionId ? [eq(visits.institutionId, institutionId)] : []))).then(r => Number(r[0]?.c ?? 0)),
                db.select({ c: count() }).from(visits).where(and(gte(visits.admissionDate, startDate), lte(visits.admissionDate, endDate), sql`visit_number LIKE 'APT-%'`, eq(visits.status, 'completed'), ...(institutionId ? [eq(visits.institutionId, institutionId)] : []))).then(r => Number(r[0]?.c ?? 0)),
                db.select({ c: count() }).from(visits).where(and(gte(visits.admissionDate, startDate), lte(visits.admissionDate, endDate), sql`visit_number LIKE 'APT-%'`, eq(visits.status, 'cancelled'), ...(institutionId ? [eq(visits.institutionId, institutionId)] : []))).then(r => Number(r[0]?.c ?? 0)),
            ]);

            const data = {
                reportType: 'operational', institutionName, isSuperAdmin,
                period: { from: startDate.toISOString(), to: endDate.toISOString() },
                generatedAt: new Date().toISOString(),
                staffActivity: (() => {
                    const totalDoctorVisits = doctorActivity.reduce((s, r) => s + Number(r.visitCount), 0);
                    return {
                        topDoctors: doctorActivityWithNames.filter(Boolean),
                        totalActiveDoctors: doctorActivity.length,
                        avgVisitsPerDoctor: doctorActivity.length > 0 ? Math.round(totalDoctorVisits / doctorActivity.length) : 0,
                    };
                })(),
                referrals: {
                    totalOutgoing: totalReferrals, totalIncoming: incomingRef,
                    pending: pendingRef, accepted: acceptedRef, completed: completedRef, rejected: rejectedRef,
                    acceptanceRate: totalReferrals > 0 ? Math.round((acceptedRef + completedRef) / totalReferrals * 100) : 0,
                },
                appointments: {
                    total: totalAppts, attended: attendedAppts, cancelled: cancelledAppts,
                    attendanceRate: totalAppts > 0 ? Math.round(attendedAppts / totalAppts * 100) : 0,
                },
            };

            if (format === 'pdf') return pdfResponse(c, data);
            return c.json({ success: true, data });
        } catch (err: any) {
            console.error('[REPORT_OPERATIONAL]', err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    })

    // ── ADMINISTRATIVE ────────────────────────────────────────────────────────
    .openapi(createRoute({
        tags: ['Reports'],
        summary: 'Administrative report — patients, staff, institutions, audit',
        method: 'get', path: '/administrative',
        security: [{ bearerAuth: [] }], middleware: [authMiddleware],
        request: { query: dateRangeQuery },
        responses: {
            200: { content: { 'application/json': { schema: successData } }, description: 'Administrative report' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
        // @ts-expect-error
    }), async (c) => {
        try {
            if (c.get('userType') !== 'admin') return c.json({ success: false, error: { message: 'Admin only' } }, 403);

            const { from, to, format } = c.req.valid('query');
            const { startDate, endDate } = parseDateRange(from, to);
            const { institutionId, isSuperAdmin, institutionName } = await getAdminScope(c.get('userId'));

            const patientRegConditions = [
                gte(patientInstitutionRegistrations.registeredAt, startDate),
                lte(patientInstitutionRegistrations.registeredAt, endDate),
                ...(institutionId ? [eq(patientInstitutionRegistrations.institutionId, institutionId)] : []),
            ];

            const [newPatients, totalPatients] = await Promise.all([
                db.select({ c: count() }).from(patientInstitutionRegistrations).where(and(...patientRegConditions)).then(r => Number(r[0]?.c ?? 0)),
                institutionId
                    ? db.select({ c: count() }).from(patientInstitutionRegistrations).where(and(eq(patientInstitutionRegistrations.institutionId, institutionId), eq(patientInstitutionRegistrations.isActive, true))).then(r => Number(r[0]?.c ?? 0))
                    : db.select({ c: count() }).from(patients).where(eq(patients.isActive, true)).then(r => Number(r[0]?.c ?? 0)),
            ]);

            const staffConditions = [eq(practitioners.isActive, true), ...(institutionId ? [eq(practitioners.institutionId, institutionId)] : [])];
            const staffByRole = await db.select({ role: practitioners.role, count: count() }).from(practitioners).where(and(...staffConditions)).groupBy(practitioners.role);
            const [totalStaff, unverifiedStaff] = await Promise.all([
                db.select({ c: count() }).from(practitioners).where(and(...staffConditions)).then(r => Number(r[0]?.c ?? 0)),
                db.select({ c: count() }).from(practitioners).where(and(...staffConditions, eq(practitioners.isVerified, false))).then(r => Number(r[0]?.c ?? 0)),
            ]);

            let institutionStats: any = null;
            if (isSuperAdmin) {
                const instList = await db.select({ id: institutions.id, name: institutions.institutionName, type: institutions.institutionType, isActive: institutions.isActive }).from(institutions);
                const instWithStats = await Promise.all(instList.map(async inst => {
                    const [vCount, pCount, sCount] = await Promise.all([
                        db.select({ c: count() }).from(visits).where(eq(visits.institutionId, inst.id)).then(r => Number(r[0]?.c ?? 0)),
                        db.select({ c: count() }).from(patientInstitutionRegistrations).where(and(eq(patientInstitutionRegistrations.institutionId, inst.id), eq(patientInstitutionRegistrations.isActive, true))).then(r => Number(r[0]?.c ?? 0)),
                        db.select({ c: count() }).from(practitioners).where(and(eq(practitioners.institutionId, inst.id), eq(practitioners.isActive, true))).then(r => Number(r[0]?.c ?? 0)),
                    ]);
                    return { ...inst, totalVisits: vCount, totalPatients: pCount, totalStaff: sCount };
                }));
                institutionStats = { total: instList.length, active: instList.filter(i => i.isActive).length, list: instWithStats };
            }

            const auditConditions = [gte(auditLogs.timestamp, startDate), lte(auditLogs.timestamp, endDate)];
            const auditByType = await db.select({ actionType: auditLogs.actionType, count: count() }).from(auditLogs).where(and(...auditConditions)).groupBy(auditLogs.actionType).orderBy(desc(count()));
            const totalAuditEvents = auditByType.reduce((sum, r) => sum + Number(r.count), 0);

            const registrationTrend = await db.execute(sql`SELECT DATE(registered_at) as date, COUNT(*) as count FROM patient_institution_registrations WHERE registered_at >= ${startDate.toISOString()} AND registered_at <= ${endDate.toISOString()} ${institutionId ? sql`AND institution_id = ${institutionId}` : sql``} GROUP BY DATE(registered_at) ORDER BY date ASC`);

            const data = {
                reportType: 'administrative', institutionName, isSuperAdmin,
                period: { from: startDate.toISOString(), to: endDate.toISOString() },
                generatedAt: new Date().toISOString(),
                patients: {
                    total: totalPatients, newInPeriod: newPatients,
                    registrationTrend: (registrationTrend as any[]).map(r => ({ date: r.date, count: Number(r.count) })),
                },
                staff: {
                    total: totalStaff,
                    verified: totalStaff - unverifiedStaff,
                    unverified: unverifiedStaff,
                    verificationRate: totalStaff > 0 ? Math.round(((totalStaff - unverifiedStaff) / totalStaff) * 100) : 100,
                    byRole: staffByRole.map(r => ({ role: r.role, count: Number(r.count) })),
                },
                ...(institutionStats ? { institutions: institutionStats } : {}),
                audit: { totalEvents: totalAuditEvents, byAction: auditByType.map(r => ({ action: r.actionType, count: Number(r.count) })) },
            };

            if (format === 'pdf') return pdfResponse(c, data);
            return c.json({ success: true, data });
        } catch (err: any) {
            console.error('[REPORT_ADMINISTRATIVE]', err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    });