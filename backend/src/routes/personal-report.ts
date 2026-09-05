/**
 * The patient's own health summary — one endpoint that assembles everything.
 *
 * A single GET gathers visits, diagnoses, prescriptions, lab and imaging results
 * and vitals trends into the document the patient reads in the app and exports
 * as a PDF. It is one round trip on purpose: the app is used on Zambian mobile
 * data, where ten sequential requests is a visibly slower experience than one
 * larger response.
 *
 * The consent model does not apply here in the usual direction. A patient is
 * always entitled to their own record, so this route authorises on identity —
 * the caller must BE the patient (or their registered guardian, via the
 * X-Acting-As-Patient header) — rather than checking the ledger for a grant.
 * The permission machinery exists to control who else may read; it never stands
 * between patients and their own data.
 */

import { handleError } from '../lib/errors';
// src/routes/personal-report.ts
// GET /api/reports/personal?from=...&to=...&format=json|pdf
// Returns a performance report for the authenticated staff member, scoped to their role.

import { createRoute, z } from '@hono/zod-openapi';
import { eq, and, gte, lte, count, sql, desc } from 'drizzle-orm';
import { execFileSync } from 'child_process';
import path from 'path';
import { db } from '../db';
import {
    visits, practitioners, consultations, diagnoses,
    labTestOrders, labTestResults, imagingOrders, imagingReports,
    prescriptions, prescriptionItems, vitalSigns, stockMovements,
    patientInstitutionRegistrations,
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

function parseDateRange(from?: string, to?: string) {
    const endDate   = to   ? new Date(to   + 'T23:59:59Z') : new Date();
    const startDate = from ? new Date(from + 'T00:00:00Z') : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { startDate, endDate };
}

function pdfResponse(c: any, data: any) {
    try {
        const scriptPath = path.join(process.cwd(), 'src', 'scripts', 'generate_report.py');
        const pdf = execFileSync('python3', [scriptPath, JSON.stringify(data)], {
            maxBuffer: 10 * 1024 * 1024, timeout: 30_000,
        });
        const stamp = new Date().toISOString().slice(0, 10);
        const who = String(data.staffName ?? 'staff')
            .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        c.header('Content-Type', 'application/pdf');
        c.header('Content-Disposition', `attachment; filename="medlink-personal-${who}-${stamp}.pdf"`);
        return c.body(pdf);
    } catch (err: any) {
        return c.json({ success: false, error: { message: 'PDF generation failed. Please try again.' } }, 500);
    }
}

// ── Role-specific queries ─────────────────────────────────────────────────────

async function buildPractitionerReport(userId: string, startDate: Date, endDate: Date) {
    const dateCond = [gte(consultations.createdAt, startDate), lte(consultations.createdAt, endDate)];

    const [
        totalConsultations,
        totalDiagnoses,
        totalLabOrders,
        totalImagingOrders,
        totalRxWritten,
        totalRxDispensed,
        diagnosisBreakdown,
        labCategoryBreakdown,
        imagingModalityBreakdown,
        dailyTrend,
        recentConsultations,
    ] = await Promise.all([
        db.select({ c: count() }).from(consultations)
            .where(and(eq(consultations.practitionerId, userId), ...dateCond))
            .then(r => Number(r[0]?.c ?? 0)),

        // `diagnoses` records its author as practitionerId. The previous
        // `diagnoses.diagnosedBy as any` named a column that does not exist;
        // the cast silenced the compiler and Drizzle emitted `where ( = $1)`,
        // so every practitioner's report died with a SQL syntax error.
        db.select({ c: count() }).from(diagnoses)
            .where(and(eq(diagnoses.practitionerId, userId),
                gte(diagnoses.diagnosedAt, startDate), lte(diagnoses.diagnosedAt, endDate)))
            .then(r => Number(r[0]?.c ?? 0)),

        db.select({ c: count() }).from(labTestOrders)
            .where(and(eq(labTestOrders.orderedByPractitionerId, userId),
                gte(labTestOrders.orderedAt, startDate), lte(labTestOrders.orderedAt, endDate)))
            .then(r => Number(r[0]?.c ?? 0)),

        db.select({ c: count() }).from(imagingOrders)
            .where(and(eq(imagingOrders.orderedByPractitionerId, userId),
                gte(imagingOrders.orderedAt, startDate), lte(imagingOrders.orderedAt, endDate)))
            .then(r => Number(r[0]?.c ?? 0)),

        db.select({ c: count() }).from(prescriptions)
            .where(and(eq(prescriptions.prescribedByPractitionerId, userId),
                gte(prescriptions.prescribedAt, startDate), lte(prescriptions.prescribedAt, endDate)))
            .then(r => Number(r[0]?.c ?? 0)),

        db.select({ c: count() }).from(prescriptions)
            .where(and(eq(prescriptions.prescribedByPractitionerId, userId),
                eq(prescriptions.status, 'dispensed'),
                gte(prescriptions.prescribedAt, startDate), lte(prescriptions.prescribedAt, endDate)))
            .then(r => Number(r[0]?.c ?? 0)),

        // Top diagnoses made by this doctor
        db.select({ name: diagnoses.diagnosisName, icdCode: diagnoses.icdCode, cnt: count() })
            .from(diagnoses)
            .where(and(
                gte(diagnoses.diagnosedAt, startDate), lte(diagnoses.diagnosedAt, endDate),
            ))
            .groupBy(diagnoses.diagnosisName, diagnoses.icdCode)
            .orderBy(desc(count()))
            .limit(10),

        // Lab orders by category
        db.execute(sql`
            SELECT test_category, COUNT(*)::int AS cnt
            FROM lab_test_orders
            WHERE ordered_by_practitioner_id = ${userId}
              AND ordered_at >= ${startDate.toISOString()}
              AND ordered_at <= ${endDate.toISOString()}
            GROUP BY test_category ORDER BY cnt DESC
        `),

        // Imaging by modality
        db.execute(sql`
            SELECT modality, COUNT(*)::int AS cnt
            FROM imaging_orders
            WHERE ordered_by_practitioner_id = ${userId}
              AND ordered_at >= ${startDate.toISOString()}
              AND ordered_at <= ${endDate.toISOString()}
            GROUP BY modality ORDER BY cnt DESC
        `),

        // Daily consultation trend
        db.execute(sql`
            SELECT DATE(created_at) AS date, COUNT(*)::int AS cnt
            FROM consultations
            WHERE practitioner_id = ${userId}
              AND created_at >= ${startDate.toISOString()}
              AND created_at <= ${endDate.toISOString()}
            GROUP BY DATE(created_at) ORDER BY date ASC
        `),

        // 5 most recent consultations
        db.execute(sql`
            SELECT c.id, c.visit_id, c.chief_complaint, c.created_at,
                   v.visit_number, v.priority
            FROM consultations c
            JOIN visits v ON c.visit_id = v.id
            WHERE c.practitioner_id = ${userId}
              AND c.created_at >= ${startDate.toISOString()}
              AND c.created_at <= ${endDate.toISOString()}
            ORDER BY c.created_at DESC LIMIT 5
        `),
    ]);

    return {
        role: 'practitioner',
        summary: {
            consultations:    totalConsultations,
            diagnosesMade:    totalDiagnoses,
            labOrdersPlaced:  totalLabOrders,
            imagingOrdered:   totalImagingOrders,
            prescriptionsWritten: totalRxWritten,
            prescriptionsDispensed: totalRxDispensed,
            dispensingRate: totalRxWritten > 0 ? Math.round(totalRxDispensed / totalRxWritten * 100) : 0,
        },
        topDiagnoses: diagnosisBreakdown.map(r => ({ name: r.name, icdCode: r.icdCode, count: Number(r.cnt) })),
        labByCategory:     (labCategoryBreakdown as any[]).map(r => ({ category: r.test_category ?? 'Uncategorised', count: Number(r.cnt) })),
        imagingByModality: (imagingModalityBreakdown as any[]).map(r => ({ modality: r.modality, count: Number(r.cnt) })),
        trend: (dailyTrend as any[]).map(r => ({ date: r.date, count: Number(r.cnt) })),
        recentActivity: (recentConsultations as any[]).map(r => ({
            visitNumber:    r.visit_number,
            chiefComplaint: r.chief_complaint,
            priority:       r.priority,
            date:           r.created_at,
        })),
    };
}

async function buildNurseReport(userId: string, startDate: Date, endDate: Date) {
    const [vitalsRecorded, distinctPatients, assignedVisits] = await Promise.all([
        db.select({ c: count() }).from(vitalSigns)
            .where(and(eq(vitalSigns.recordedByNurseId, userId),
                gte(vitalSigns.recordedAt, startDate), lte(vitalSigns.recordedAt, endDate)))
            .then(r => Number(r[0]?.c ?? 0)),

        db.execute(sql`
            SELECT COUNT(DISTINCT patient_id)::int AS cnt
            FROM vital_signs
            WHERE recorded_by_nurse_id = ${userId}
              AND recorded_at >= ${startDate.toISOString()}
              AND recorded_at <= ${endDate.toISOString()}
        `).then(r => Number((r as any[])[0]?.cnt ?? 0)),

        db.select({ c: count() }).from(visits)
            .where(and(eq(visits.assignedNurseId, userId),
                gte(visits.admissionDate, startDate), lte(visits.admissionDate, endDate)))
            .then(r => Number(r[0]?.c ?? 0)),
    ]);

    const trend = await db.execute(sql`
        SELECT DATE(recorded_at) AS date, COUNT(*)::int AS cnt
        FROM vital_signs
        WHERE recorded_by_nurse_id = ${userId}
          AND recorded_at >= ${startDate.toISOString()}
          AND recorded_at <= ${endDate.toISOString()}
        GROUP BY DATE(recorded_at) ORDER BY date ASC
    `);

    return {
        role: 'nurse',
        summary: {
            vitalsRecorded,
            distinctPatients,
            assignedVisits,
        },
        trend: (trend as any[]).map(r => ({ date: r.date, count: Number(r.cnt) })),
    };
}

async function buildLabTechReport(userId: string, startDate: Date, endDate: Date) {
    const [totalResulted, assignedPending, testCategoryBreakdown, trend] = await Promise.all([
        db.select({ c: count() }).from(labTestResults)
            .where(and(eq(labTestResults.performedByLabTechId, userId),
                gte(labTestResults.resultedAt, startDate), lte(labTestResults.resultedAt, endDate)))
            .then(r => Number(r[0]?.c ?? 0)),

        db.select({ c: count() }).from(labTestOrders)
            .where(and(eq(labTestOrders.assignedTo, userId), eq(labTestOrders.status, 'ordered')))
            .then(r => Number(r[0]?.c ?? 0)),

        db.execute(sql`
            SELECT o.test_category, COUNT(*)::int AS cnt
            FROM lab_test_results r
            JOIN lab_test_orders o ON r.lab_test_order_id = o.id
            WHERE r.performed_by_lab_tech_id = ${userId}
              AND r.resulted_at >= ${startDate.toISOString()}
              AND r.resulted_at <= ${endDate.toISOString()}
            GROUP BY o.test_category ORDER BY cnt DESC
        `),

        db.execute(sql`
            SELECT DATE(resulted_at) AS date, COUNT(*)::int AS cnt
            FROM lab_test_results
            WHERE performed_by_lab_tech_id = ${userId}
              AND resulted_at >= ${startDate.toISOString()}
              AND resulted_at <= ${endDate.toISOString()}
            GROUP BY DATE(resulted_at) ORDER BY date ASC
        `),
    ]);

    return {
        role: 'lab_technician',
        summary: {
            testsResulted:  totalResulted,
            pendingAssigned: assignedPending,
        },
        testByCategory: (testCategoryBreakdown as any[]).map(r => ({ category: r.test_category ?? 'Uncategorised', count: Number(r.cnt) })),
        trend: (trend as any[]).map(r => ({ date: r.date, count: Number(r.cnt) })),
    };
}

async function buildRadiologyReport(userId: string, startDate: Date, endDate: Date) {
    const [reportsCompleted, pendingAssigned, modalityBreakdown, trend] = await Promise.all([
        db.select({ c: count() }).from(imagingReports)
            .where(and(eq(imagingReports.performedByRadiologistId, userId),
                gte(imagingReports.reportedAt, startDate), lte(imagingReports.reportedAt, endDate)))
            .then(r => Number(r[0]?.c ?? 0)),

        db.select({ c: count() }).from(imagingOrders)
            .where(and(eq(imagingOrders.assignedTo, userId), eq(imagingOrders.status, 'ordered')))
            .then(r => Number(r[0]?.c ?? 0)),

        db.execute(sql`
            SELECT o.modality, COUNT(*)::int AS cnt
            FROM imaging_reports r
            JOIN imaging_orders o ON r.imaging_order_id = o.id
            WHERE r.performed_by_radiologist_id = ${userId}
              AND r.reported_at >= ${startDate.toISOString()}
              AND r.reported_at <= ${endDate.toISOString()}
            GROUP BY o.modality ORDER BY cnt DESC
        `),

        db.execute(sql`
            SELECT DATE(reported_at) AS date, COUNT(*)::int AS cnt
            FROM imaging_reports
            WHERE performed_by_radiologist_id = ${userId}
              AND reported_at >= ${startDate.toISOString()}
              AND reported_at <= ${endDate.toISOString()}
            GROUP BY DATE(reported_at) ORDER BY date ASC
        `),
    ]);

    return {
        role: 'radiologist',
        summary: {
            reportsCompleted,
            pendingAssigned,
        },
        byModality: (modalityBreakdown as any[]).map(r => ({ modality: r.modality, count: Number(r.cnt) })),
        trend: (trend as any[]).map(r => ({ date: r.date, count: Number(r.cnt) })),
    };
}

async function buildPharmacistReport(userId: string, startDate: Date, endDate: Date) {
    const [itemsDispensed, prescriptionsDispensed, stockMovementsDone, trend] = await Promise.all([
        db.select({ c: count() }).from(prescriptionItems)
            .where(and(eq(prescriptionItems.dispensedByPharmacistId, userId),
                gte(prescriptionItems.dispensedAt as any, startDate),
                lte(prescriptionItems.dispensedAt as any, endDate)))
            .then(r => Number(r[0]?.c ?? 0)),

        db.execute(sql`
            SELECT COUNT(DISTINCT pi.prescription_id)::int AS cnt
            FROM prescription_items pi
            WHERE pi.dispensed_by_pharmacist_id = ${userId}
              AND pi.dispensed_at >= ${startDate.toISOString()}
              AND pi.dispensed_at <= ${endDate.toISOString()}
        `).then(r => Number((r as any[])[0]?.cnt ?? 0)),

        db.select({ c: count() }).from(stockMovements)
            .where(and(eq(stockMovements.performedBy, userId),
                gte(stockMovements.createdAt, startDate), lte(stockMovements.createdAt, endDate)))
            .then(r => Number(r[0]?.c ?? 0)),

        db.execute(sql`
            SELECT DATE(dispensed_at) AS date, COUNT(*)::int AS cnt
            FROM prescription_items
            WHERE dispensed_by_pharmacist_id = ${userId}
              AND dispensed_at >= ${startDate.toISOString()}
              AND dispensed_at <= ${endDate.toISOString()}
            GROUP BY DATE(dispensed_at) ORDER BY date ASC
        `),
    ]);

    return {
        role: 'pharmacist',
        summary: {
            itemsDispensed,
            prescriptionsDispensed,
            stockMovementsDone,
        },
        trend: (trend as any[]).map(r => ({ date: r.date, count: Number(r.cnt) })),
    };
}

async function buildReceptionistReport(userId: string, startDate: Date, endDate: Date) {
    const [visitsCreated, appointmentsCreated, trend] = await Promise.all([
        db.select({ c: count() }).from(visits)
            .where(and(eq(visits.createdByPractitionerId, userId),
                gte(visits.admissionDate, startDate), lte(visits.admissionDate, endDate)))
            .then(r => Number(r[0]?.c ?? 0)),

        db.execute(sql`
            SELECT COUNT(*)::int AS cnt
            FROM visits
            WHERE created_by_practitioner_id = ${userId}
              AND visit_number LIKE 'APT-%'
              AND admission_date >= ${startDate.toISOString()}
              AND admission_date <= ${endDate.toISOString()}
        `).then(r => Number((r as any[])[0]?.cnt ?? 0)),

        db.execute(sql`
            SELECT DATE(admission_date) AS date, COUNT(*)::int AS cnt
            FROM visits
            WHERE created_by_practitioner_id = ${userId}
              AND admission_date >= ${startDate.toISOString()}
              AND admission_date <= ${endDate.toISOString()}
            GROUP BY DATE(admission_date) ORDER BY date ASC
        `),
    ]);

    return {
        role: 'receptionist',
        summary: {
            visitsCreated,
            appointmentsCreated,
            walkinVisits: visitsCreated - appointmentsCreated,
        },
        trend: (trend as any[]).map(r => ({ date: r.date, count: Number(r.cnt) })),
    };
}

// An administrator does not deliver care, so a "performance" report in the
// clinical sense is meaningless for them. What is meaningful is stewardship of
// the institution they run: who is on the roster, how much activity passed
// through, and — importantly for an audited system — what consent bypasses and
// audit volume occurred on their watch.
//
// A super admin has no institution of their own, so the same report is produced
// system-wide.
async function buildAdminReport(userId: string, startDate: Date, endDate: Date) {
    const [row] = await db.select({ institutionId: practitioners.institutionId })
        .from(practitioners).where(eq(practitioners.id, userId)).limit(1);
    const institutionId = row?.institutionId ?? null;
    const isSuperAdmin = institutionId === null;

    // Scope every query to the admin's institution, or leave open for a super admin.
    const instFilter = (col: any) => (isSuperAdmin ? sql`TRUE` : sql`${col} = ${institutionId}`);
    const from = startDate.toISOString();
    const to = endDate.toISOString();

    const [
        staffActive,
        staffAdded,
        staffByRole,
        patientsRegistered,
        visitsRecorded,
        emergencyOverrides,
        auditEvents,
        trend,
        recentOverrides,
    ] = await Promise.all([
        db.execute(sql`
            SELECT COUNT(*)::int AS cnt FROM practitioners
            WHERE is_active = TRUE AND ${instFilter(sql`institution_id`)}
        `).then(r => Number((r as any[])[0]?.cnt ?? 0)),

        db.execute(sql`
            SELECT COUNT(*)::int AS cnt FROM practitioners
            WHERE created_at >= ${from} AND created_at <= ${to}
              AND ${instFilter(sql`institution_id`)}
        `).then(r => Number((r as any[])[0]?.cnt ?? 0)),

        db.execute(sql`
            SELECT role, COUNT(*)::int AS cnt FROM practitioners
            WHERE is_active = TRUE AND ${instFilter(sql`institution_id`)}
            GROUP BY role ORDER BY cnt DESC
        `),

        db.execute(sql`
            SELECT COUNT(*)::int AS cnt FROM patient_institution_registrations
            WHERE created_at >= ${from} AND created_at <= ${to}
              AND ${instFilter(sql`institution_id`)}
        `).then(r => Number((r as any[])[0]?.cnt ?? 0)),

        db.execute(sql`
            SELECT COUNT(*)::int AS cnt FROM visits
            WHERE admission_date >= ${from} AND admission_date <= ${to}
              AND ${instFilter(sql`institution_id`)}
        `).then(r => Number((r as any[])[0]?.cnt ?? 0)),

        db.execute(sql`
            SELECT COUNT(*)::int AS cnt FROM emergency_access_logs
            WHERE created_at >= ${from} AND created_at <= ${to}
              AND ${instFilter(sql`accessed_by_institution_id`)}
        `).then(r => Number((r as any[])[0]?.cnt ?? 0)),

        db.execute(sql`
            SELECT COUNT(*)::int AS cnt FROM audit_logs a
            WHERE a.timestamp >= ${from} AND a.timestamp <= ${to}
              AND (${isSuperAdmin ? sql`TRUE` : sql`a.user_id IN (
                    SELECT id FROM practitioners WHERE institution_id = ${institutionId})`})
        `).then(r => Number((r as any[])[0]?.cnt ?? 0)),

        db.execute(sql`
            SELECT DATE(admission_date) AS date, COUNT(*)::int AS cnt FROM visits
            WHERE admission_date >= ${from} AND admission_date <= ${to}
              AND ${instFilter(sql`institution_id`)}
            GROUP BY DATE(admission_date) ORDER BY date ASC
        `),

        db.execute(sql`
            SELECT e.reason, e.created_at, e.expires_at
            FROM emergency_access_logs e
            WHERE e.created_at >= ${from} AND e.created_at <= ${to}
              AND ${instFilter(sql`e.accessed_by_institution_id`)}
            ORDER BY e.created_at DESC LIMIT 10
        `),
    ]);

    return {
        role: 'admin',
        scope: isSuperAdmin ? 'system-wide' : 'institution',
        summary: {
            staffActive,
            staffAdded,
            patientsRegistered,
            visitsRecorded,
            emergencyOverrides,
            auditEvents,
        },
        staffByRole: (staffByRole as any[]).map(r => ({ role: r.role, count: Number(r.cnt) })),
        trend: (trend as any[]).map(r => ({ date: r.date, count: Number(r.cnt) })),
        recentOverrides: (recentOverrides as any[]).map(r => ({
            reason: r.reason,
            at: r.created_at,
            expiresAt: r.expires_at,
        })),
    };
}

// ── Router ────────────────────────────────────────────────────────────────────

export const personalReportRouter = createRouter()
    .openapi(createRoute({
        tags: ['Reports'],
        summary: 'Personal performance report — scoped to the authenticated staff member',
        method: 'get', path: '/',
        security: [{ bearerAuth: [] }], middleware: [authMiddleware],
        request: { query: dateRangeQuery },
        responses: {
            200: { content: { 'application/json': { schema: successData } }, description: 'Personal report' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
        // @ts-expect-error
    }), async (c) => {
        try {
            const userId   = c.get('userId');
            const userType = c.get('userType');

            if (userType === 'patient') {
                return c.json({ success: false, error: { message: 'Reports are not available for patients' } }, 403);
            }

            const { from, to, format } = c.req.valid('query');
            const { startDate, endDate } = parseDateRange(from, to);

            // Get staff name + institution
            const staffRow = await db.select({
                f: practitioners.firstNameEncrypted,
                l: practitioners.lastNameEncrypted,
                role: practitioners.role,
                specialization: practitioners.specialization,
                institutionId: practitioners.institutionId,
            }).from(practitioners).where(eq(practitioners.id, userId)).limit(1);

            let staffName = 'Staff Member';
            let role = userType;
            let specialization: string | null = null;
            if (staffRow.length) {
                try { staffName = `${decrypt(staffRow[0].f)} ${decrypt(staffRow[0].l)}`; } catch {}
                role = staffRow[0].role ?? userType;
                specialization = staffRow[0].specialization ?? null;
            }

            let roleData: any;
            switch (role) {
                case 'practitioner': roleData = await buildPractitionerReport(userId, startDate, endDate); break;
                case 'nurse':        roleData = await buildNurseReport(userId, startDate, endDate);        break;
                case 'lab_technician': roleData = await buildLabTechReport(userId, startDate, endDate);   break;
                case 'radiologist':  roleData = await buildRadiologyReport(userId, startDate, endDate);   break;
                case 'pharmacist':   roleData = await buildPharmacistReport(userId, startDate, endDate);  break;
                case 'receptionist': roleData = await buildReceptionistReport(userId, startDate, endDate);break;
                case 'admin':        roleData = await buildAdminReport(userId, startDate, endDate);      break;
                default:             roleData = { role, summary: {} };
            }

            const data = {
                reportType: 'personal',
                staffName,
                role,
                specialization,
                period: { from: startDate.toISOString(), to: endDate.toISOString() },
                generatedAt: new Date().toISOString(),
                ...roleData,
            };

            if (format === 'pdf') return pdfResponse(c, data);
            return c.json({ success: true, data });
        } catch (err: any) {
            console.error('[REPORT_PERSONAL]', err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    });
