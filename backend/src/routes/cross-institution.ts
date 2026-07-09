import { handleError } from '../lib/errors';
import { createRoute, z } from '@hono/zod-openapi';
import { eq, and, or, ilike, sql } from 'drizzle-orm';
import { db } from '../db';
import { patients, visits, patientInstitutionRegistrations, institutions } from '../db/schema';
import { createRouter } from '../lib/create-app';
import { authMiddleware } from '../middleware/auth';
import { grantCrossInstitutionAccess, canAccessPatient, createEmergencyAccess, revokeAccess } from '../services/cross-institution';
import { decrypt } from '../services/crypto';
import crypto from 'crypto';

type AppContext = {
    Variables: {
        userId: string;
        userType: string;
        blockchainAddress: string;
    };
};

const errorSchema = z.object({
    success: z.boolean(),
    error: z.object({ message: z.string() }),
});

const successData = z.object({ success: z.boolean(), data: z.any() });

// Helper to get staff institution
async function getStaffInstitution(userId: string): Promise<string | null> {
    const staff = await db.select({ institutionId: practitioners.institutionId })
        .from(practitioners)
        .where(eq(practitioners.id, userId))
        .limit(1);
    return staff[0]?.institutionId || null;
}

export const crossInstitutionRouter = createRouter<AppContext>()

    // ═══════════════════════════════════════════════════════════════
    // 1. PATIENT SEARCH - Find patients from other institutions with access
    // ═══════════════════════════════════════════════════════════════
    .openapi(createRoute({
        tags: ['Cross-Institution'],
        summary: 'Search patients across institutions (with valid access)',
        method: 'get',
        path: '/patient-search',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        request: {
            query: z.object({
                q: z.string().min(2),
                limit: z.string().optional().default('20'),
            }),
        },
        responses: {
            200: { content: { 'application/json': { schema: successData } }, description: 'Search results' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userType = c.get('userType');
            const userId = c.get('userId');
            const staffInstitutionId = await getStaffInstitution(userId);

            if (!['practitioner', 'nurse', 'receptionist', 'admin'].includes(userType)) {
                return c.json({ success: false, error: { message: 'Access denied' } }, 403);
            }

            const { q, limit } = c.req.valid('query');
            const limitNum = parseInt(limit);

            // First, search for patients at the staff's own institution
            const localPatients = await db.select({
                id: patients.id,
                firstNameEncrypted: patients.firstNameEncrypted,
                lastNameEncrypted: patients.lastNameEncrypted,
                dateOfBirthEncrypted: patients.dateOfBirthEncrypted,
                nationalIdEncrypted: patients.nationalIdEncrypted,
                gender: patients.gender,
                institutionId: visits.institutionId,
            })
                .from(patients)
                .leftJoin(visits, eq(visits.patientId, patients.id))
                .where(and(
                    eq(visits.institutionId, staffInstitutionId),
                    or(
                        sql`${patients.firstNameEncrypted} ILIKE ${`%${q}%`}`,
                        sql`${patients.lastNameEncrypted} ILIKE ${`%${q}%`}`,
                        sql`${patients.nationalIdEncrypted} ILIKE ${`%${q}%`}`
                    )
                ))
                .limit(limitNum);

            // Second, search for patients from other institutions with access grants
            const crossAccessPatients = await db.select({
                id: patients.id,
                firstNameEncrypted: patients.firstNameEncrypted,
                lastNameEncrypted: patients.lastNameEncrypted,
                dateOfBirthEncrypted: patients.dateOfBirthEncrypted,
                nationalIdEncrypted: patients.nationalIdEncrypted,
                gender: patients.gender,
                sourceInstitutionId: crossInstitutionAccess.sourceInstitutionId,
                accessType: crossInstitutionAccess.accessType,
                expiresAt: crossInstitutionAccess.expiresAt,
            })
                .from(patients)
                .innerJoin(crossInstitutionAccess, eq(crossInstitutionAccess.patientId, patients.id))
                .where(and(
                    eq(crossInstitutionAccess.targetInstitutionId, staffInstitutionId),
                    eq(crossInstitutionAccess.status, 'active'),
                    or(
                        sql`${crossInstitutionAccess.expiresAt} IS NULL`,
                        gte(crossInstitutionAccess.expiresAt, new Date())
                    ),
                    or(
                        sql`${patients.firstNameEncrypted} ILIKE ${`%${q}%`}`,
                        sql`${patients.lastNameEncrypted} ILIKE ${`%${q}%`}`,
                        sql`${patients.nationalIdEncrypted} ILIKE ${`%${q}%`}`
                    )
                ))
                .limit(limitNum);

            // Decrypt patient names
            const { decrypt } = await import('../services/crypto');

            const enrichedLocal = await Promise.all(localPatients.map(async (p) => ({
                id: p.id,
                firstName: await decrypt(p.firstNameEncrypted),
                lastName: await decrypt(p.lastNameEncrypted),
                dateOfBirth: await decrypt(p.dateOfBirthEncrypted),
                nationalId: await decrypt(p.nationalIdEncrypted),
                gender: p.gender,
                accessType: 'local',
                institutionId: p.institutionId,
            })));

            const enrichedCross = await Promise.all(crossAccessPatients.map(async (p) => ({
                id: p.id,
                firstName: await decrypt(p.firstNameEncrypted),
                lastName: await decrypt(p.lastNameEncrypted),
                dateOfBirth: await decrypt(p.dateOfBirthEncrypted),
                nationalId: await decrypt(p.nationalIdEncrypted),
                gender: p.gender,
                accessType: p.accessType,
                sourceInstitutionId: p.sourceInstitutionId,
                expiresAt: p.expiresAt,
            })));

            return c.json({
                success: true,
                data: {
                    local: enrichedLocal,
                    crossInstitution: enrichedCross,
                    total: enrichedLocal.length + enrichedCross.length,
                },
            });
        } catch (err: any) {
            console.error('Patient search error:', err);
            return handleError(err, c);
        }
    })

    // ═══════════════════════════════════════════════════════════════
    // 2. CREATE REFERRAL - Grant temporary access to another institution
    // ═══════════════════════════════════════════════════════════════
    .openapi(createRoute({
        tags: ['Cross-Institution'],
        summary: 'Create a referral to another institution',
        method: 'post',
        path: '/referral',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        request: {
            body: {
                content: {
                    'application/json': {
                        schema: z.object({
                            patientId: z.string().uuid(),
                            targetInstitutionId: z.string().uuid(),
                            durationHours: z.number().min(1).max(720).default(72),
                            reason: z.string().min(10),
                            clinicalSummary: z.string().optional(),
                        }),
                    },
                },
            },
        },
        responses: {
            201: { content: { 'application/json': { schema: successData } }, description: 'Referral created' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            404: { content: { 'application/json': { schema: errorSchema } }, description: 'Patient or institution not found' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userType = c.get('userType');
            const userId = c.get('userId');
            const staffInstitutionId = await getStaffInstitution(userId);

            if (!['practitioner', 'admin'].includes(userType)) {
                return c.json({ success: false, error: { message: 'Only practitioners can create referrals' } }, 403);
            }

            const { patientId, targetInstitutionId, durationHours, reason, clinicalSummary } = c.req.valid('json');

            // Verify patient exists
            const patient = await db.select().from(patients).where(eq(patients.id, patientId)).limit(1);
            if (!patient.length) {
                return c.json({ success: false, error: { message: 'Patient not found' } }, 404);
            }

            // Verify target institution exists
            const targetInst = await db.select().from(institutions).where(eq(institutions.id, targetInstitutionId)).limit(1);
            if (!targetInst.length) {
                return c.json({ success: false, error: { message: 'Target institution not found' } }, 404);
            }

            // Grant access
            const accessId = await grantCrossInstitutionAccess({
                patientId,
                sourceInstitutionId: staffInstitutionId!,
                targetInstitutionId,
                accessType: 'referral',
                grantedBy: userId,
                durationHours,
                reason,
            });

            // Store referral in referrals table (you already have this table)
            const referralNumber = `REF-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
            await db.insert(referrals).values({
                referralNumber,
                patientId,
                referringInstitutionId: staffInstitutionId!,
                referringPractitionerId: userId,
                receivingInstitutionId: targetInstitutionId,
                reason,
                clinicalSummary: clinicalSummary || null,
                urgency: 'routine',
                status: 'pending',
                blockchainHash: generateRecordHash({ referralNumber, patientId, reason }),
            });

            return c.json({
                success: true,
                data: {
                    accessId,
                    message: `Referral created. ${targetInst[0].institutionName} can now access patient records for ${durationHours} hours.`,
                    expiresAt: new Date(Date.now() + durationHours * 60 * 60 * 1000),
                },
            }, 201);
        } catch (err: any) {
            console.error('Referral error:', err);
            return handleError(err, c);
        }
    })

    // ═══════════════════════════════════════════════════════════════
    // 3. EMERGENCY ACCESS - Override for immediate care (24 hours)
    // ═══════════════════════════════════════════════════════════════
    .openapi(createRoute({
        tags: ['Cross-Institution'],
        summary: 'Request emergency access to a patient (24-hour override)',
        method: 'post',
        path: '/emergency',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        request: {
            body: {
                content: {
                    'application/json': {
                        schema: z.object({
                            patientId: z.string().uuid(),
                            reason: z.string().min(10),
                        }),
                    },
                },
            },
        },
        responses: {
            201: { content: { 'application/json': { schema: successData } }, description: 'Emergency access granted' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            404: { content: { 'application/json': { schema: errorSchema } }, description: 'Patient not found' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userType = c.get('userType');
            const userId = c.get('userId');
            const staffInstitutionId = await getStaffInstitution(userId);

            if (!['practitioner', 'nurse', 'admin'].includes(userType)) {
                return c.json({ success: false, error: { message: 'Only clinical staff can request emergency access' } }, 403);
            }

            const { patientId, reason } = c.req.valid('json');

            // Verify patient exists
            const patient = await db.select().from(patients).where(eq(patients.id, patientId)).limit(1);
            if (!patient.length) {
                return c.json({ success: false, error: { message: 'Patient not found' } }, 404);
            }

            // Grant emergency access (24 hours)
            const accessId = await createEmergencyAccess(
                patientId,
                userId,
                staffInstitutionId!,
                reason
            );

            // Log to audit with emergency flag
            await db.insert(auditLogs).values({
                userId,
                userType: userType as any,
                patientId,
                actionType: 'emergency_override',
                resourceType: 'patient_access',
                blockchainTransactionId: accessId,
                accessReason: reason,
                isEmergencyOverride: true,
            });

            const { decrypt } = await import('../services/crypto');
            const patientName = `${await decrypt(patient[0].firstNameEncrypted)} ${await decrypt(patient[0].lastNameEncrypted)}`;

            return c.json({
                success: true,
                data: {
                    accessId,
                    message: `Emergency access granted for ${patientName}. Access expires in 24 hours.`,
                    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                },
            }, 201);
        } catch (err: any) {
            console.error('Emergency access error:', err);
            return handleError(err, c);
        }
    })

    // ═══════════════════════════════════════════════════════════════
    // 4. CHECK ACCESS - Verify if current user can access a patient
    // ═══════════════════════════════════════════════════════════════
    .openapi(createRoute({
        tags: ['Cross-Institution'],
        summary: 'Check if you have access to a patient',
        method: 'get',
        path: '/check-access/:patientId',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        request: {
            params: z.object({ patientId: z.string().uuid() }),
        },
        responses: {
            200: { content: { 'application/json': { schema: successData } }, description: 'Access check result' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userId = c.get('userId');
            const staffInstitutionId = await getStaffInstitution(userId);
            const { patientId } = c.req.valid('param');

            if (!staffInstitutionId) {
                return c.json({ success: true, data: { hasAccess: false, reason: 'No institution assigned' } });
            }

            const access = await canAccessPatient(patientId, staffInstitutionId, userId);

            return c.json({
                success: true,
                data: {
                    hasAccess: access.allowed,
                    reason: access.reason,
                    accessGrant: access.accessGrant || null,
                },
            });
        } catch (err: any) {
            console.error('Access check error:', err);
            return handleError(err, c);
        }
    })

    // ═══════════════════════════════════════════════════════════════
    // 5. REVOKE ACCESS - Revoke cross-institution access
    // ═══════════════════════════════════════════════════════════════
    .openapi(createRoute({
        tags: ['Cross-Institution'],
        summary: 'Revoke cross-institution access',
        method: 'post',
        path: '/revoke/:accessId',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        request: {
            params: z.object({ accessId: z.string().uuid() }),
        },
        responses: {
            200: { content: { 'application/json': { schema: successData } }, description: 'Access revoked' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            404: { content: { 'application/json': { schema: errorSchema } }, description: 'Access not found' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userId = c.get('userId');
            const { accessId } = c.req.valid('param');

            await revokeAccess(accessId, userId);

            return c.json({
                success: true,
                data: { message: 'Access revoked successfully' },
            });
        } catch (err: any) {
            console.error('Revoke access error:', err);
            return handleError(err, c);
        }
    });