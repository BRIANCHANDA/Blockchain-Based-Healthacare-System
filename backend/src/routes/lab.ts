// backend/src/routes/lab.ts
//
// Mount in backend/src/index.ts:
//   import { labRouter } from './routes/lab';
//   app.route('/api/lab', labRouter);

import { createRoute, z } from '@hono/zod-openapi';
import { eq, desc, and, inArray, sql, isNotNull } from 'drizzle-orm';
import { db } from '../db';
import {
    patients, practitioners,
    labTestOrders, labTestResults,
    allergies, medicalHistory, diagnoses, visits,
    auditLogs,
} from '../db/schema';
import { createRouter } from '../lib/create-app';
import { authMiddleware } from '../middleware/auth';
import { decrypt } from '../services/crypto';
import crypto from 'crypto';

// ── Helpers ──────────────────────────────────────────────────────────────────

function safeDec(fn: () => string): string {
    try { return fn(); } catch { return ''; }
}

function calcAge(dobStr: string): number | null {
    try {
        const d = new Date(dobStr);
        if (isNaN(d.getTime())) return null;
        const ms = Date.now() - d.getTime();
        return Math.floor(ms / (365.25 * 86400000));
    } catch { return null; }
}

const errorSchema = z.object({
    success: z.boolean(),
    error: z.object({ message: z.string() }),
});

// ── Router ────────────────────────────────────────────────────────────────────

export const labRouter = createRouter()

    // ─── GET /patient-context/:patientId ───────────────────────────────────────
    // Returns patient demographics + allergies + active conditions + recent
    // diagnoses, so the lab tech has the clinical picture while entering results.
    .openapi(createRoute({
        tags: ['Lab'],
        summary: 'Get patient context for lab result entry',
        method: 'get',
        path: '/patient-context/:patientId',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        request: { params: z.object({ patientId: z.string().uuid() }) },
        responses: {
            200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.any() }) } }, description: 'Patient context' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
        },
        // @ts-expect-error
    }), async (c) => {
        try {
            // @ts-expect-error
            const userType = c.get('userType');
            if (!['lab_technician', 'practitioner', 'nurse', 'admin', 'radiologist'].includes(userType))
                return c.json({ success: false, error: { message: 'Forbidden' } }, 403);

            const { patientId } = c.req.valid('param');

            // Patient core
            const [p] = await db.select({
                id: patients.id,
                firstNameEncrypted: patients.firstNameEncrypted,
                lastNameEncrypted: patients.lastNameEncrypted,
                dateOfBirthEncrypted: patients.dateOfBirthEncrypted,
                gender: patients.gender,
                bloodType: patients.bloodType,
            }).from(patients).where(eq(patients.id, patientId)).limit(1);

            if (!p) return c.json({ success: false, error: { message: 'Patient not found' } }, 404);

            const firstName = safeDec(() => decrypt(p.firstNameEncrypted));
            const lastName = safeDec(() => decrypt(p.lastNameEncrypted));
            const dob = safeDec(() => decrypt(p.dateOfBirthEncrypted));
            const age = dob ? calcAge(dob) : null;

            // Allergies (active only)
            const allergyRows = await db.select({
                id: allergies.id,
                allergen: allergies.allergen,
                allergyType: allergies.allergyType,
                severity: allergies.severity,
                reaction: allergies.reaction,
            })
                .from(allergies)
                .where(and(eq(allergies.patientId, patientId), eq(allergies.isActive, true)))
                .orderBy(desc(allergies.severity));

            // Active medical history
            const historyRows = await db.select({
                id: medicalHistory.id,
                condition: medicalHistory.condition,
                diagnosedDate: medicalHistory.diagnosedDate,
                status: medicalHistory.status,
                notes: medicalHistory.notes,
            })
                .from(medicalHistory)
                .where(eq(medicalHistory.patientId, patientId))
                .orderBy(desc(medicalHistory.diagnosedDate))
                .limit(10);

            // Recent diagnoses (this visit / last few)
            const diagnosisRows = await db.select({
                id: diagnoses.id,
                diagnosisName: diagnoses.diagnosisName,
                icdCode: diagnoses.icdCode,
                diagnosisType: diagnoses.diagnosisType,
                severity: diagnoses.severity,
                diagnosedAt: diagnoses.diagnosedAt,
            })
                .from(diagnoses)
                .where(eq(diagnoses.patientId, patientId))
                .orderBy(desc(diagnoses.diagnosedAt))
                .limit(8);

            // Recent lab orders for this patient with results
            const recentLabs = await db.select({
                id: labTestOrders.id,
                testName: labTestOrders.testName,
                testCode: labTestOrders.testCode,
                testCategory: labTestOrders.testCategory,
                specimenType: labTestOrders.specimenType,
                urgency: labTestOrders.urgency,
                status: labTestOrders.status,
                orderedAt: labTestOrders.orderedAt,
                orderNumber: labTestOrders.orderNumber,
                clinicalNotes: labTestOrders.clinicalNotes,
                // result fields (null when not yet resulted)
                resultId: labTestResults.id,
                interpretation: labTestResults.interpretation,
                abnormalFindings: labTestResults.abnormalFindings,
                resultsData: labTestResults.resultsData,
                resultedAt: labTestResults.resultedAt,
            })
                .from(labTestOrders)
                .leftJoin(labTestResults, eq(labTestResults.labTestOrderId, labTestOrders.id))
                .where(eq(labTestOrders.patientId, patientId))
                .orderBy(desc(labTestOrders.orderedAt))
                .limit(20);

            const enrichedLabs = recentLabs.map(o => ({
                id: o.id,
                testName: o.testName,
                testCode: o.testCode,
                testCategory: o.testCategory,
                specimenType: o.specimenType,
                urgency: o.urgency,
                status: o.status,
                orderedAt: o.orderedAt,
                orderNumber: o.orderNumber,
                clinicalNotes: o.clinicalNotes,
                result: o.resultId ? {
                    interpretation: o.interpretation,
                    abnormalFindings: o.abnormalFindings,
                    resultsData: o.resultsData,
                    resultedAt: o.resultedAt,
                } : null,
            }));

            return c.json({
                success: true,
                data: {
                    patient: {
                        id: p.id,
                        firstName,
                        lastName,
                        fullName: `${firstName} ${lastName}`.trim(),
                        age,
                        gender: p.gender,
                        bloodType: p.bloodType,
                    },
                    allergies: allergyRows,
                    medicalHistory: historyRows,
                    recentDiagnoses: diagnosisRows,
                    recentLabs: enrichedLabs,
                    summary: {
                        allergyCount: allergyRows.length,
                        severeAllergies: allergyRows.filter(a => ['severe', 'life_threatening'].includes(a.severity)).length,
                        activeConditions: historyRows.filter(h => h.status === 'active').length,
                        pendingOrders: enrichedLabs.filter(l => ['pending', 'collection_in_progress'].includes(l.status)).length,
                        resultedOrders: enrichedLabs.filter(l => l.status === 'resulted').length,
                    },
                },
            });
        } catch (err: any) {
            console.error('[LAB_PATIENT_CONTEXT]', err);
            return c.json({ success: false, error: { message: err.message ?? 'Server error' } }, 500);
        }
    })

    // ─── POST /reject-specimen/:orderId ────────────────────────────────────────
    // Lab tech rejects a sample (haemolysed, insufficient, wrong tube, etc.)
    // Sets the order status to 'cancelled' and appends rejection details
    // to clinicalNotes so the ordering doctor sees why.
    .openapi(createRoute({
        tags: ['Lab'],
        summary: 'Reject a specimen and cancel the lab order',
        method: 'post',
        path: '/reject-specimen/:orderId',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        request: {
            params: z.object({ orderId: z.string().uuid() }),
            body: {
                content: {
                    'application/json': {
                        schema: z.object({
                            reason: z.enum([
                                'haemolysed',
                                'insufficient_quantity',
                                'wrong_container',
                                'clotted',
                                'contaminated',
                                'mislabelled',
                                'transport_delay',
                                'other',
                            ]),
                            notes: z.string().optional(),
                        }),
                    },
                },
            },
        },
        responses: {
            200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.any() }) } }, description: 'Rejected' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
        },
        // @ts-expect-error
    }), async (c) => {
        try {
            // @ts-expect-error
            const userType = c.get('userType');
            // @ts-expect-error
            const userId = c.get('userId');

            if (userType !== 'lab_technician' && userType !== 'admin')
                return c.json({ success: false, error: { message: 'Only lab technicians can reject specimens' } }, 403);

            const { orderId } = c.req.valid('param');
            const { reason, notes } = c.req.valid('json');

            const [order] = await db.select({
                id: labTestOrders.id,
                patientId: labTestOrders.patientId,
                clinicalNotes: labTestOrders.clinicalNotes,
                status: labTestOrders.status,
            }).from(labTestOrders).where(eq(labTestOrders.id, orderId)).limit(1);

            if (!order) return c.json({ success: false, error: { message: 'Order not found' } }, 404);

            if (order.status === 'resulted' || order.status === 'cancelled')
                return c.json({ success: false, error: { message: `Order is already ${order.status}` } }, 400);

            const reasonLabels: Record<string, string> = {
                haemolysed: 'Sample haemolysed',
                insufficient_quantity: 'Insufficient sample quantity',
                wrong_container: 'Wrong container/tube used',
                clotted: 'Sample clotted',
                contaminated: 'Sample contaminated',
                mislabelled: 'Sample mislabelled',
                transport_delay: 'Excessive transport delay',
                other: 'Other (see notes)',
            };

            const rejectionLine = `🛑 SPECIMEN REJECTED (${new Date().toISOString().slice(0, 16).replace('T', ' ')}): ${reasonLabels[reason]}${notes ? ` — ${notes}` : ''}`;
            const updatedNotes = order.clinicalNotes
                ? `${order.clinicalNotes}\n\n${rejectionLine}`
                : rejectionLine;

            await db.update(labTestOrders)
                .set({ status: 'cancelled', clinicalNotes: updatedNotes, updatedAt: new Date() })
                .where(eq(labTestOrders.id, orderId));

            // Audit log
            await db.insert(auditLogs).values({
                userId, userType,
                patientId: order.patientId,
                actionType: 'update',
                resourceType: 'lab_order',
                resourceId: orderId,
                blockchainTransactionId: crypto.randomBytes(16).toString('hex'),
                accessReason: `Specimen rejected: ${reasonLabels[reason]}`,
                ipAddress: c.req.header('x-forwarded-for'),
            }).catch(() => { });

            return c.json({
                success: true,
                data: {
                    orderId,
                    status: 'cancelled',
                    reason,
                    reasonLabel: reasonLabels[reason],
                    message: 'Specimen rejected — ordering doctor will be notified to re-order',
                },
            });
        } catch (err: any) {
            console.error('[LAB_REJECT_SPECIMEN]', err);
            return c.json({ success: false, error: { message: err.message ?? 'Server error' } }, 500);
        }
    })

    // ─── GET /my-results ───────────────────────────────────────────────────────
    // Lab tech's own resulted tests, for the "My Results" history page.
    .openapi(createRoute({
        tags: ['Lab'],
        summary: 'Get lab technician\'s own resulted tests',
        method: 'get',
        path: '/my-results',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        request: {
            query: z.object({
                limit: z.string().optional(),
                offset: z.string().optional(),
            }),
        },
        responses: {
            200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.any() }) } }, description: 'My results' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
        },
        // @ts-expect-error
    }), async (c) => {
        try {
            // @ts-expect-error
            const userType = c.get('userType');
            // @ts-expect-error
            const userId = c.get('userId');

            if (userType !== 'lab_technician')
                return c.json({ success: false, error: { message: 'Lab technicians only' } }, 403);

            const query = c.req.valid('query');
            const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '50')));
            const offset = Math.max(0, parseInt(query.offset ?? '0'));

            // Join results with order + patient
            const rows = await db.select({
                resultId: labTestResults.id,
                resultedAt: labTestResults.resultedAt,
                interpretation: labTestResults.interpretation,
                abnormalFindings: labTestResults.abnormalFindings,
                resultsData: labTestResults.resultsData,
                orderId: labTestOrders.id,
                orderNumber: labTestOrders.orderNumber,
                testName: labTestOrders.testName,
                testCategory: labTestOrders.testCategory,
                urgency: labTestOrders.urgency,
                specimenType: labTestOrders.specimenType,
                patientId: patients.id,
                firstNameEncrypted: patients.firstNameEncrypted,
                lastNameEncrypted: patients.lastNameEncrypted,
                visitNumber: visits.visitNumber,
            })
                .from(labTestResults)
                .innerJoin(labTestOrders, eq(labTestOrders.id, labTestResults.labTestOrderId))
                .innerJoin(patients, eq(patients.id, labTestOrders.patientId))
                .innerJoin(visits, eq(visits.id, labTestOrders.visitId))
                .where(eq(labTestResults.performedByLabTechId, userId))
                .orderBy(desc(labTestResults.resultedAt))
                .limit(limit)
                .offset(offset);

            const enriched = rows.map(r => ({
                resultId: r.resultId,
                resultedAt: r.resultedAt,
                interpretation: r.interpretation,
                hasAbnormal: !!r.abnormalFindings,
                abnormalFindings: r.abnormalFindings,
                parameterCount: Array.isArray(r.resultsData) ? r.resultsData.length : 0,
                order: {
                    id: r.orderId,
                    orderNumber: r.orderNumber,
                    testName: r.testName,
                    testCategory: r.testCategory,
                    urgency: r.urgency,
                    specimenType: r.specimenType,
                },
                patient: {
                    id: r.patientId,
                    fullName: `${safeDec(() => decrypt(r.firstNameEncrypted))} ${safeDec(() => decrypt(r.lastNameEncrypted))}`.trim() || 'Unknown',
                },
                visit: {
                    visitNumber: r.visitNumber,
                },
            }));

            return c.json({
                success: true,
                data: {
                    results: enriched,
                    limit,
                    offset,
                    hasMore: enriched.length === limit,
                },
            });
        } catch (err: any) {
            console.error('[LAB_MY_RESULTS]', err);
            return c.json({ success: false, error: { message: err.message ?? 'Server error' } }, 500);
        }
    });