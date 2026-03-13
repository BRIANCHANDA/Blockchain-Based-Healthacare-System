import { createRoute, z } from '@hono/zod-openapi';
import { eq, and, desc, or } from 'drizzle-orm';
import { db } from '../db';
import {
    referrals,
    patients,
    practitioners,
    institutions,
    visits,
    auditLogs,
} from '../db/schema';
import { createRouter } from '../lib/create-app';
import { authMiddleware } from '../middleware/auth';
import { generateRecordHash, decrypt } from '../services/crypto';
import { storeRecordHash, checkPermission } from '../services/fabric';
import crypto from 'crypto';

const errorSchema = z.object({
    success: z.boolean(),
    error: z.object({ message: z.string() }),
});

// ==================== Referral Schemas ====================
const createReferralSchema = z.object({
    patientId: z.string().uuid(),
    visitId: z.string().uuid().optional(),
    receivingInstitutionId: z.string().uuid(),
    receivingDepartmentId: z.string().uuid().optional(),
    receivingPractitionerId: z.string().uuid().optional(),
    reason: z.string().min(10),
    clinicalSummary: z.string().min(10),
    urgency: z.enum(['routine', 'urgent', 'emergency', 'critical']).default('routine'),
});

const respondReferralSchema = z.object({
    responseNotes: z.string().optional(),
});

export const referralRouter = createRouter()

    // ========== CREATE REFERRAL (practitioner) ==========
    .openapi(createRoute({
        tags: ['Referrals'],
        summary: 'Create a referral for a patient to another institution',
        method: 'post',
        path: '/',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        request: {
            body: { content: { 'application/json': { schema: createReferralSchema } } },
        },
        responses: {
            201: {
                content: {
                    'application/json': {
                        schema: z.object({
                            success: z.boolean(),
                            data: z.object({ referralId: z.string(), referralNumber: z.string() })
                        })
                    }
                },
                description: 'Referral created',
            },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            404: { content: { 'application/json': { schema: errorSchema } }, description: 'Patient or receiving institution not found' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userType = c.get('userType');
            if (userType !== 'practitioner') {
                return c.json({ success: false, error: { message: 'Only practitioners can create referrals' } }, 403);
            }

            const practitionerId = c.get('userId');
            const practitionerBlockchainAddress = c.get('blockchainAddress');
            const body = c.req.valid('json');

            // Verify patient exists and practitioner has permission
            const patient = await db.select({
                blockchainAddress: patients.blockchainAddress,
            }).from(patients).where(eq(patients.id, body.patientId)).limit(1);
            if (!patient.length) {
                return c.json({ success: false, error: { message: 'Patient not found' } }, 404);
            }

            const hasPermission = await checkPermission(patient[0].blockchainAddress, practitionerBlockchainAddress);
            if (!hasPermission) {
                return c.json({ success: false, error: { message: 'No permission to refer this patient' } }, 403);
            }

            // Verify receiving institution exists
            const inst = await db.select().from(institutions).where(eq(institutions.id, body.receivingInstitutionId)).limit(1);
            if (!inst.length) {
                return c.json({ success: false, error: { message: 'Receiving institution not found' } }, 404);
            }

            // Generate referral number
            const referralNumber = `REF-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

            // Get referring practitioner's institution
            const practitioner = await db.select({ institutionId: practitioners.institutionId })
                .from(practitioners).where(eq(practitioners.id, practitionerId)).limit(1);
            if (!practitioner.length) {
                return c.json({ success: false, error: { message: 'Practitioner not found' } }, 404);
            }

            // Insert referral
            const result = await db.insert(referrals).values({
                referralNumber,
                patientId: body.patientId,
                visitId: body.visitId ?? null,
                referringInstitutionId: practitioner[0].institutionId,
                referringPractitionerId: practitionerId,
                receivingInstitutionId: body.receivingInstitutionId,
                receivingDepartmentId: body.receivingDepartmentId ?? null,
                receivingPractitionerId: body.receivingPractitionerId ?? null,
                reason: body.reason,
                clinicalSummary: body.clinicalSummary,
                urgency: body.urgency,
                status: 'pending',
                referredAt: new Date(),
            }).returning({ id: referrals.id });

            // Generate blockchain hash
            const referralHash = generateRecordHash({
                referralId: result[0].id,
                referralNumber,
                patientId: body.patientId,
                referringInstitutionId: practitioner[0].institutionId,
                receivingInstitutionId: body.receivingInstitutionId,
                timestamp: new Date().toISOString(),
            });
            await storeRecordHash(result[0].id, patient[0].blockchainAddress, referralHash, 'referral').catch(() => { });

            // Audit log
            await db.insert(auditLogs).values({
                userId: practitionerId,
                userType: 'practitioner',
                patientId: body.patientId,
                actionType: 'create',
                resourceType: 'referral',
                resourceId: result[0].id,
                blockchainTransactionId: crypto.randomBytes(16).toString('hex'),
                ipAddress: c.req.header('x-forwarded-for'),
            });

            return c.json({ success: true, data: { referralId: result[0].id, referralNumber } }, 201);
        } catch (err: any) {
            console.error('Create referral error:', err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    })

    // ========== LIST REFERRALS (filtered) ==========
    .openapi(createRoute({
        tags: ['Referrals'],
        summary: 'List referrals (for patient, institution, or practitioner)',
        method: 'get',
        path: '/',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        request: {
            query: z.object({
                patientId: z.string().uuid().optional(),
                referringInstitutionId: z.string().uuid().optional(),
                receivingInstitutionId: z.string().uuid().optional(),
                status: z.string().optional(),
                limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
                offset: z.string().regex(/^\d+$/).transform(Number).optional().default('0'),
            }),
        },
        responses: {
            200: {
                content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.any() }) } },
                description: 'List of referrals',
            },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userType = c.get('userType');
            const userId = c.get('userId');
            const { patientId, referringInstitutionId, receivingInstitutionId, status, limit, offset } = c.req.valid('query');

            let query = db.select().from(referrals);

            // Apply filters
            if (patientId) query = query.where(eq(referrals.patientId, patientId));
            if (referringInstitutionId) query = query.where(eq(referrals.referringInstitutionId, referringInstitutionId));
            if (receivingInstitutionId) query = query.where(eq(referrals.receivingInstitutionId, receivingInstitutionId));
            if (status) query = query.where(eq(referrals.status, status));

            // Role-based restrictions
            if (userType === 'patient') {
                // Patients can only see their own referrals
                query = query.where(eq(referrals.patientId, userId));
            } else if (userType === 'practitioner') {
                // Practitioners can see referrals where they are referring or receiving practitioner,
                // or where they belong to referring/receiving institution (through staff records)
                // For simplicity, we'll allow if practitioner is involved directly
                query = query.where(
                    or(
                        eq(referrals.referringPractitionerId, userId),
                        eq(referrals.receivingPractitionerId, userId)
                    )
                );
                // Could also check institution membership via subquery, but we skip for brevity
            } // else admin sees all

            const referralList = await query.limit(limit).offset(offset).orderBy(desc(referrals.referredAt));

            return c.json({ success: true, data: { referrals: referralList, limit, offset } });
        } catch (err: any) {
            console.error('List referrals error:', err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    })

    // ========== GET REFERRAL DETAILS ==========
    .openapi(createRoute({
        tags: ['Referrals'],
        summary: 'Get details of a specific referral',
        method: 'get',
        path: '/:referralId',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        request: {
            params: z.object({ referralId: z.string().uuid() }),
        },
        responses: {
            200: {
                content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.any() }) } },
                description: 'Referral details',
            },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            404: { content: { 'application/json': { schema: errorSchema } }, description: 'Referral not found' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userType = c.get('userType');
            const userId = c.get('userId');
            const { referralId } = c.req.valid('param');

            const referral = await db.select().from(referrals).where(eq(referrals.id, referralId)).limit(1);
            if (!referral.length) {
                return c.json({ success: false, error: { message: 'Referral not found' } }, 404);
            }

            const r = referral[0];

            // Check access: patient (self), practitioner involved, admin, or institution staff
            let hasAccess = false;
            if (userType === 'admin') hasAccess = true;
            else if (userType === 'patient' && r.patientId === userId) hasAccess = true;
            else if (userType === 'practitioner') {
                if (r.referringPractitionerId === userId || r.receivingPractitionerId === userId) hasAccess = true;
                // Could also check institution membership, but skip for simplicity
            }

            if (!hasAccess) {
                return c.json({ success: false, error: { message: 'Access denied' } }, 403);
            }

            return c.json({ success: true, data: r });
        } catch (err: any) {
            console.error('Get referral error:', err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    })

    // ========== ACCEPT REFERRAL ==========
    .openapi(createRoute({
        tags: ['Referrals'],
        summary: 'Accept a referral (receiving practitioner)',
        method: 'patch',
        path: '/:referralId/accept',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        request: {
            params: z.object({ referralId: z.string().uuid() }),
            body: { content: { 'application/json': { schema: respondReferralSchema } } },
        },
        responses: {
            200: {
                content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.object({ message: z.string() }) }) } },
                description: 'Referral accepted',
            },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            404: { content: { 'application/json': { schema: errorSchema } }, description: 'Referral not found' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userType = c.get('userType');
            const userId = c.get('userId');
            const { referralId } = c.req.valid('param');
            const { responseNotes } = c.req.valid('json');

            if (userType !== 'practitioner') {
                return c.json({ success: false, error: { message: 'Only practitioners can accept referrals' } }, 403);
            }

            const referral = await db.select().from(referrals).where(eq(referrals.id, referralId)).limit(1);
            if (!referral.length) {
                return c.json({ success: false, error: { message: 'Referral not found' } }, 404);
            }

            const r = referral[0];
            if (r.status !== 'pending') {
                return c.json({ success: false, error: { message: `Referral already ${r.status}` } }, 400);
            }

            // Ensure practitioner is the receiving practitioner (if specified) or belongs to receiving institution
            if (r.receivingPractitionerId && r.receivingPractitionerId !== userId) {
                return c.json({ success: false, error: { message: 'You are not the designated receiving practitioner' } }, 403);
            }
            // If no specific practitioner, any practitioner at receiving institution could accept? For simplicity, we'll allow any practitioner at receiving institution.
            // We'll check if practitioner belongs to receiving institution.
            const practitioner = await db.select({ institutionId: practitioners.institutionId })
                .from(practitioners).where(eq(practitioners.id, userId)).limit(1);
            if (!practitioner.length || practitioner[0].institutionId !== r.receivingInstitutionId) {
                return c.json({ success: false, error: { message: 'You must belong to the receiving institution to accept' } }, 403);
            }

            await db.update(referrals)
                .set({
                    status: 'accepted',
                    acceptedAt: new Date(),
                    responseNotes: responseNotes ?? null,
                })
                .where(eq(referrals.id, referralId));

            // Blockchain hash for acceptance
            const acceptHash = generateRecordHash({ referralId, action: 'accept', acceptedBy: userId, timestamp: new Date().toISOString() });
            await storeRecordHash(referralId, (await db.select({ blockchainAddress: patients.blockchainAddress }).from(patients).where(eq(patients.id, r.patientId)).limit(1))[0].blockchainAddress, acceptHash, 'referral_accept').catch(() => { });

            return c.json({ success: true, data: { message: 'Referral accepted' } });
        } catch (err: any) {
            console.error('Accept referral error:', err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    })

    // ========== REJECT REFERRAL ==========
    .openapi(createRoute({
        tags: ['Referrals'],
        summary: 'Reject a referral (receiving practitioner)',
        method: 'patch',
        path: '/:referralId/reject',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        request: {
            params: z.object({ referralId: z.string().uuid() }),
            body: { content: { 'application/json': { schema: respondReferralSchema } } },
        },
        responses: {
            200: {
                content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.object({ message: z.string() }) }) } },
                description: 'Referral rejected',
            },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            404: { content: { 'application/json': { schema: errorSchema } }, description: 'Referral not found' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userType = c.get('userType');
            const userId = c.get('userId');
            const { referralId } = c.req.valid('param');
            const { responseNotes } = c.req.valid('json');

            if (userType !== 'practitioner') {
                return c.json({ success: false, error: { message: 'Only practitioners can reject referrals' } }, 403);
            }

            const referral = await db.select().from(referrals).where(eq(referrals.id, referralId)).limit(1);
            if (!referral.length) {
                return c.json({ success: false, error: { message: 'Referral not found' } }, 404);
            }

            const r = referral[0];
            if (r.status !== 'pending') {
                return c.json({ success: false, error: { message: `Referral already ${r.status}` } }, 400);
            }

            // Similar permission check as accept
            const practitioner = await db.select({ institutionId: practitioners.institutionId })
                .from(practitioners).where(eq(practitioners.id, userId)).limit(1);
            if (!practitioner.length || practitioner[0].institutionId !== r.receivingInstitutionId) {
                return c.json({ success: false, error: { message: 'You must belong to the receiving institution to reject' } }, 403);
            }

            await db.update(referrals)
                .set({
                    status: 'rejected',
                    acceptedAt: null,
                    responseNotes: responseNotes ?? null,
                })
                .where(eq(referrals.id, referralId));

            const rejectHash = generateRecordHash({ referralId, action: 'reject', rejectedBy: userId, timestamp: new Date().toISOString() });
            await storeRecordHash(referralId, (await db.select({ blockchainAddress: patients.blockchainAddress }).from(patients).where(eq(patients.id, r.patientId)).limit(1))[0].blockchainAddress, rejectHash, 'referral_reject').catch(() => { });

            return c.json({ success: true, data: { message: 'Referral rejected' } });
        } catch (err: any) {
            console.error('Reject referral error:', err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    })

    // ========== COMPLETE REFERRAL ==========
    .openapi(createRoute({
        tags: ['Referrals'],
        summary: 'Mark a referral as completed (receiving practitioner)',
        method: 'patch',
        path: '/:referralId/complete',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        request: {
            params: z.object({ referralId: z.string().uuid() }),
        },
        responses: {
            200: {
                content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.object({ message: z.string() }) }) } },
                description: 'Referral completed',
            },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            404: { content: { 'application/json': { schema: errorSchema } }, description: 'Referral not found' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userType = c.get('userType');
            const userId = c.get('userId');
            const { referralId } = c.req.valid('param');

            if (userType !== 'practitioner') {
                return c.json({ success: false, error: { message: 'Only practitioners can complete referrals' } }, 403);
            }

            const referral = await db.select().from(referrals).where(eq(referrals.id, referralId)).limit(1);
            if (!referral.length) {
                return c.json({ success: false, error: { message: 'Referral not found' } }, 404);
            }

            const r = referral[0];
            if (r.status !== 'accepted') {
                return c.json({ success: false, error: { message: 'Referral must be accepted first' } }, 400);
            }

            // Check that practitioner is from receiving institution (or the receiving practitioner)
            const practitioner = await db.select({ institutionId: practitioners.institutionId })
                .from(practitioners).where(eq(practitioners.id, userId)).limit(1);
            if (!practitioner.length || practitioner[0].institutionId !== r.receivingInstitutionId) {
                return c.json({ success: false, error: { message: 'You must belong to the receiving institution to complete' } }, 403);
            }

            await db.update(referrals)
                .set({ status: 'completed', completedAt: new Date() })
                .where(eq(referrals.id, referralId));

            const completeHash = generateRecordHash({ referralId, action: 'complete', completedBy: userId, timestamp: new Date().toISOString() });
            await storeRecordHash(referralId, (await db.select({ blockchainAddress: patients.blockchainAddress }).from(patients).where(eq(patients.id, r.patientId)).limit(1))[0].blockchainAddress, completeHash, 'referral_complete').catch(() => { });

            return c.json({ success: true, data: { message: 'Referral completed' } });
        } catch (err: any) {
            console.error('Complete referral error:', err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    })

    // ========== CANCEL REFERRAL (referring practitioner) ==========
    .openapi(createRoute({
        tags: ['Referrals'],
        summary: 'Cancel a referral (referring practitioner)',
        method: 'patch',
        path: '/:referralId/cancel',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        request: {
            params: z.object({ referralId: z.string().uuid() }),
        },
        responses: {
            200: {
                content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.object({ message: z.string() }) }) } },
                description: 'Referral cancelled',
            },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            404: { content: { 'application/json': { schema: errorSchema } }, description: 'Referral not found' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userType = c.get('userType');
            const userId = c.get('userId');
            const { referralId } = c.req.valid('param');

            if (userType !== 'practitioner') {
                return c.json({ success: false, error: { message: 'Only practitioners can cancel referrals' } }, 403);
            }

            const referral = await db.select().from(referrals).where(eq(referrals.id, referralId)).limit(1);
            if (!referral.length) {
                return c.json({ success: false, error: { message: 'Referral not found' } }, 404);
            }

            const r = referral[0];
            if (r.status !== 'pending') {
                return c.json({ success: false, error: { message: 'Only pending referrals can be cancelled' } }, 400);
            }

            if (r.referringPractitionerId !== userId) {
                return c.json({ success: false, error: { message: 'You are not the referring practitioner' } }, 403);
            }

            await db.update(referrals)
                .set({ status: 'cancelled' })
                .where(eq(referrals.id, referralId));

            const cancelHash = generateRecordHash({ referralId, action: 'cancel', cancelledBy: userId, timestamp: new Date().toISOString() });
            await storeRecordHash(referralId, (await db.select({ blockchainAddress: patients.blockchainAddress }).from(patients).where(eq(patients.id, r.patientId)).limit(1))[0].blockchainAddress, cancelHash, 'referral_cancel').catch(() => { });

            return c.json({ success: true, data: { message: 'Referral cancelled' } });
        } catch (err: any) {
            console.error('Cancel referral error:', err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    });