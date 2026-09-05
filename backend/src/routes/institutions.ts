/**
 * Institutions, departments and wards — the organisational tree.
 *
 * Three levels, nested: an institution owns departments, a department owns
 * wards. The routes reflect that nesting, which is why some paths are addressed
 * through a parent (/:institutionId/departments) and some directly by id
 * (/departments/:departmentId) once the client already holds one.
 *
 * This tree matters beyond administration: institutionId is the tenancy
 * boundary for the entire system. Hyperledger Fabric here has a single Hospital
 * organisation rather than one per hospital, so it is this column — not the
 * ledger — that separates one hospital's staff and records from another's.
 * Reaching across the boundary is a referral or an emergency override, never a
 * plain query.
 *
 * Deletes are soft wherever clinical history could reference the row: an
 * institution that has admitted patients cannot be erased without orphaning
 * their visits, so it is deactivated instead.
 */

import { handleError } from '../lib/errors';
import { createRoute, z } from '@hono/zod-openapi';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

import { db } from '../db';
import {
    institutions,
    departments,
    wards,
    practitioners,
} from '../db/schema';
import { createRouter } from '../lib/create-app';
import { authMiddleware } from '../middleware/auth';
import { encrypt, decrypt, generateRecordHash } from '../services/crypto';
import { storeRecordHash } from '../services/fabric';
import { phoneNumber as vPhone, nationalId as vNationalId, dateOfBirth as vDob, clinicalDate as vClinicalDate, futureDate as vFutureDate, email as vEmail } from '../lib/validators';

// ── Zod Schemas ──────────────────────────────────────────

const errorSchema = z.object({
    success: z.boolean(),
    error: z.object({ message: z.string() }),
});

const successData = z.object({ success: z.boolean(), data: z.any() });

const institutionPublicSchema = z.object({
    id: z.string(),
    institutionCode: z.string(),
    institutionName: z.string(),
    institutionType: z.string(),
    address: z.string(),
    phone: vPhone,
    email: vEmail.optional(),
    bedCapacity: z.number().optional(),
    specialties: z.array(z.string()).optional(),
    services: z.array(z.string()).optional(),
});

const createInstitutionSchema = z.object({
    institutionCode: z.string().min(1),
    institutionName: z.string().min(1),
    institutionType: z.string().min(1),
    address: z.string().min(1),
    phone: vPhone,
    email: vEmail.optional(),
    licenseNumber: z.string().min(1),
    accreditationStatus: z.string().optional(),
    accreditationExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    bedCapacity: z.number().int().positive().optional(),
    specialties: z.array(z.string()).optional(),
    services: z.array(z.string()).optional(),
    adminUserId: z.string().uuid().optional(),
});

const updateInstitutionSchema = createInstitutionSchema.partial();

const createDepartmentSchema = z.object({
    departmentCode: z.string().min(1),
    departmentName: z.string().min(1),
    departmentType: z.string().optional(),
    location: z.string().optional(),
    phone: vPhone.optional(),
});

const updateDepartmentSchema = createDepartmentSchema.partial().extend({ isActive: z.boolean().optional() });

const createWardSchema = z.object({
    wardCode: z.string().min(1),
    wardName: z.string().min(1),
    wardType: z.string().optional(),
    bedCount: z.number().int().positive(),
    availableBeds: z.number().int().min(0),
});

const updateWardSchema = createWardSchema.partial();

// Helper to check if staff belongs to an institution
async function getStaffInstitution(staffId: string): Promise<string | null> {
    const staff = await db.select({ institutionId: practitioners.institutionId })
        .from(practitioners)
        .where(eq(practitioners.id, staffId))
        .limit(1);
    return staff[0]?.institutionId || null;
}

// ── Router ───────────────────────────────────────────────

export const institutionRouter = createRouter()

    // ========== LIST INSTITUTIONS (public) ==========
    .openapi(createRoute({
        tags: ['Institutions'],
        summary: 'List all active institutions (public)',
        method: 'get',
        path: '/',
        responses: {
            200: {
                content: {
                    'application/json': {
                        schema: z.object({
                            success: z.boolean(),
                            data: z.object({ institutions: z.array(institutionPublicSchema) }),
                        }),
                    },
                },
                description: 'List of institutions',
            },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const instList = await db.select({
                id: institutions.id,
                institutionCode: institutions.institutionCode,
                institutionName: institutions.institutionName,
                institutionType: institutions.institutionType,
                addressEncrypted: institutions.addressEncrypted,
                phoneEncrypted: institutions.phoneEncrypted,
                emailEncrypted: institutions.emailEncrypted,
                bedCapacity: institutions.bedCapacity,
                specialties: institutions.specialties,
                services: institutions.services,
            }).from(institutions).where(eq(institutions.isActive, true));

            const result = instList.map(inst => ({
                id: inst.id,
                institutionCode: inst.institutionCode,
                institutionName: inst.institutionName,
                institutionType: inst.institutionType,
                address: decrypt(inst.addressEncrypted),
                phone: decrypt(inst.phoneEncrypted),
                email: inst.emailEncrypted ? decrypt(inst.emailEncrypted) : undefined,
                bedCapacity: inst.bedCapacity,
                specialties: inst.specialties,
                services: inst.services,
            }));

            return c.json({ success: true, data: { institutions: result } });
        } catch (err: unknown) {
            console.error('List institutions error:', err);
            return handleError(err, c);
        }
    })

    // ========== CREATE INSTITUTION (admin only) ==========
    .openapi(createRoute({
        tags: ['Institutions'],
        summary: 'Create a new institution (admin only)',
        method: 'post',
        path: '/',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        request: {
            body: { content: { 'application/json': { schema: createInstitutionSchema } } },
        },
        responses: {
            201: {
                content: {
                    'application/json': {
                        schema: z.object({
                            success: z.boolean(),
                            data: z.object({ institutionId: z.string(), blockchainAddress: z.string() }),
                        }),
                    },
                },
                description: 'Institution created',
            },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            409: { content: { 'application/json': { schema: errorSchema } }, description: 'Institution code or license already exists' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userType = c.get('userType');
            if (userType !== 'admin') {
                return c.json({ success: false, error: { message: 'Admin access required' } }, 403);
            }

            const body = c.req.valid('json');

            // Check uniqueness
            const existing = await db.select().from(institutions)
                .where(eq(institutions.institutionCode, body.institutionCode))
                .limit(1);
            if (existing.length) {
                return c.json({ success: false, error: { message: 'Institution code already exists' } }, 409);
            }
            const existingLicense = await db.select().from(institutions)
                .where(eq(institutions.licenseNumber, body.licenseNumber))
                .limit(1);
            if (existingLicense.length) {
                return c.json({ success: false, error: { message: 'License number already exists' } }, 409);
            }

            const blockchainAddress = `institution:${crypto.createHash('sha256').update(body.institutionCode + (process.env.BLOCKCHAIN_SALT || 'salt')).digest('hex')}`;

            const result = await db.insert(institutions).values({
                institutionCode: body.institutionCode,
                institutionName: body.institutionName,
                institutionType: body.institutionType,
                blockchainAddress,
                addressEncrypted: encrypt(body.address),
                phoneEncrypted: encrypt(body.phone),
                emailEncrypted: body.email ? encrypt(body.email) : null,
                licenseNumber: body.licenseNumber,
                accreditationStatus: body.accreditationStatus ?? null,
                accreditationExpiry: body.accreditationExpiry ? new Date(body.accreditationExpiry) : null,
                bedCapacity: body.bedCapacity ?? null,
                specialties: body.specialties ?? null,
                services: body.services ?? null,
                adminUserId: body.adminUserId ?? null,
                isActive: true,
            }).returning({ id: institutions.id });

            const creationHash = generateRecordHash({ institutionId: result[0].id, ...body, timestamp: new Date().toISOString() });
            await storeRecordHash(result[0].id, blockchainAddress, creationHash, 'institution').catch(() => { });

            return c.json({ success: true, data: { institutionId: result[0].id, blockchainAddress } }, 201);
        } catch (err: unknown) {
            console.error('Create institution error:', err);
            return handleError(err, c);
        }
    })

    // ========== GET INSTITUTION BY ID (admin or staff of that institution) ==========
    .openapi(createRoute({
        tags: ['Institutions'],
        summary: 'Get institution details (admin or staff of that institution)',
        method: 'get',
        path: '/:institutionId',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        request: {
            params: z.object({ institutionId: z.string().uuid() }),
        },
        responses: {
            200: {
                content: { 'application/json': { schema: successData } },
                description: 'Institution details',
            },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            404: { content: { 'application/json': { schema: errorSchema } }, description: 'Institution not found' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userType = c.get('userType');
            const userId = c.get('userId');
            const { institutionId } = c.req.valid('param');

            const inst = await db.select().from(institutions).where(eq(institutions.id, institutionId)).limit(1);
            if (!inst.length) {
                return c.json({ success: false, error: { message: 'Institution not found' } }, 404);
            }

            // Check access: admin or staff belonging to this institution
            let hasAccess = userType === 'admin';
            if (!hasAccess) {
                const staffInst = await getStaffInstitution(userId);
                hasAccess = staffInst === institutionId;
            }

            if (!hasAccess) {
                return c.json({ success: false, error: { message: 'Access denied' } }, 403);
            }

            const p = inst[0];
            const result = {
                id: p.id,
                institutionCode: p.institutionCode,
                institutionName: p.institutionName,
                institutionType: p.institutionType,
                blockchainAddress: p.blockchainAddress,
                address: decrypt(p.addressEncrypted),
                phone: decrypt(p.phoneEncrypted),
                email: p.emailEncrypted ? decrypt(p.emailEncrypted) : null,
                licenseNumber: p.licenseNumber,
                accreditationStatus: p.accreditationStatus,
                accreditationExpiry: p.accreditationExpiry,
                bedCapacity: p.bedCapacity,
                specialties: p.specialties,
                services: p.services,
                adminUserId: p.adminUserId,
                isActive: p.isActive,
                createdAt: p.createdAt,
                updatedAt: p.updatedAt,
            };

            return c.json({ success: true, data: result });
        } catch (err: unknown) {
            console.error('Get institution error:', err);
            return handleError(err, c);
        }
    })

    // ========== UPDATE INSTITUTION (admin only) ==========
    .openapi(createRoute({
        tags: ['Institutions'],
        summary: 'Update institution (admin only)',
        method: 'patch',
        path: '/:institutionId',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        request: {
            params: z.object({ institutionId: z.string().uuid() }),
            body: { content: { 'application/json': { schema: updateInstitutionSchema } } },
        },
        responses: {
            200: {
                content: { 'application/json': { schema: successData } },
                description: 'Institution updated',
            },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            404: { content: { 'application/json': { schema: errorSchema } }, description: 'Institution not found' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userType = c.get('userType');
            if (userType !== 'admin') {
                return c.json({ success: false, error: { message: 'Admin access required' } }, 403);
            }

            const { institutionId } = c.req.valid('param');
            const body = c.req.valid('json');

            const existing = await db.select().from(institutions).where(eq(institutions.id, institutionId)).limit(1);
            if (!existing.length) {
                return c.json({ success: false, error: { message: 'Institution not found' } }, 404);
            }

            const updateData: Record<string, unknown> = {};
            if (body.institutionCode) updateData.institutionCode = body.institutionCode;
            if (body.institutionName) updateData.institutionName = body.institutionName;
            if (body.institutionType) updateData.institutionType = body.institutionType;
            if (body.address) updateData.addressEncrypted = encrypt(body.address);
            if (body.phone) updateData.phoneEncrypted = encrypt(body.phone);
            if (body.email !== undefined) updateData.emailEncrypted = body.email ? encrypt(body.email) : null;
            if (body.licenseNumber) updateData.licenseNumber = body.licenseNumber;
            if (body.accreditationStatus !== undefined) updateData.accreditationStatus = body.accreditationStatus;
            if (body.accreditationExpiry !== undefined) updateData.accreditationExpiry = body.accreditationExpiry ? new Date(body.accreditationExpiry) : null;
            if (body.bedCapacity !== undefined) updateData.bedCapacity = body.bedCapacity;
            if (body.specialties) updateData.specialties = body.specialties;
            if (body.services) updateData.services = body.services;
            if (body.adminUserId !== undefined) updateData.adminUserId = body.adminUserId;
            updateData.updatedAt = new Date();

            if (Object.keys(updateData).length === 0) {
                return c.json({ success: true, data: { message: 'No changes' } });
            }

            await db.update(institutions).set(updateData).where(eq(institutions.id, institutionId));

            const updateHash = generateRecordHash({ institutionId, ...body, timestamp: new Date().toISOString() });
            await storeRecordHash(institutionId, existing[0].blockchainAddress, updateHash, 'institution_update').catch(() => { });

            return c.json({ success: true, data: { message: 'Institution updated successfully' } });
        } catch (err: unknown) {
            console.error('Update institution error:', err);
            return handleError(err, c);
        }
    })

    // ========== DEACTIVATE INSTITUTION (admin only) ==========
    .openapi(createRoute({
        tags: ['Institutions'],
        summary: 'Deactivate institution (admin only)',
        method: 'delete',
        path: '/:institutionId',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        request: {
            params: z.object({ institutionId: z.string().uuid() }),
        },
        responses: {
            200: { content: { 'application/json': { schema: successData } }, description: 'Institution deactivated' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            404: { content: { 'application/json': { schema: errorSchema } }, description: 'Institution not found' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userType = c.get('userType');
            if (userType !== 'admin') {
                return c.json({ success: false, error: { message: 'Admin access required' } }, 403);
            }

            const { institutionId } = c.req.valid('param');

            const result = await db.update(institutions)
                .set({ isActive: false, updatedAt: new Date() })
                .where(eq(institutions.id, institutionId))
                .returning({ blockchainAddress: institutions.blockchainAddress });

            if (!result.length) {
                return c.json({ success: false, error: { message: 'Institution not found' } }, 404);
            }

            const deactivateHash = generateRecordHash({ institutionId, action: 'deactivate', timestamp: new Date().toISOString() });
            await storeRecordHash(institutionId, result[0].blockchainAddress, deactivateHash, 'institution_deactivate').catch(() => { });

            return c.json({ success: true, data: { message: 'Institution deactivated successfully' } });
        } catch (err: unknown) {
            console.error('Deactivate institution error:', err);
            return handleError(err, c);
        }
    })

    // ========== LIST DEPARTMENTS under an institution ==========
    .openapi(createRoute({
        tags: ['Institutions'],
        summary: 'List departments of an institution',
        method: 'get',
        path: '/:institutionId/departments',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        request: {
            params: z.object({ institutionId: z.string().uuid() }),
            query: z.object({ includeInactive: z.string().optional() }),
        },
        responses: {
            200: { content: { 'application/json': { schema: successData } }, description: 'List of departments' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const { institutionId } = c.req.valid('param');
            const { includeInactive } = c.req.valid('query');
            const showAll = includeInactive === 'true';
            const deptList = await db.select().from(departments)
                .where(showAll
                    ? eq(departments.institutionId, institutionId)
                    : and(eq(departments.institutionId, institutionId), eq(departments.isActive, true)));
            return c.json({ success: true, data: { departments: deptList } });
        } catch (err: unknown) {
            console.error('List departments error:', err);
            return handleError(err, c);
        }
    })

    // ========== CREATE DEPARTMENT (admin only) ==========
    .openapi(createRoute({
        tags: ['Institutions'],
        summary: 'Create a department in an institution (admin only)',
        method: 'post',
        path: '/:institutionId/departments',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        request: {
            params: z.object({ institutionId: z.string().uuid() }),
            body: { content: { 'application/json': { schema: createDepartmentSchema } } },
        },
        responses: {
            201: { content: { 'application/json': { schema: successData } }, description: 'Department created' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            409: { content: { 'application/json': { schema: errorSchema } }, description: 'Department code already exists' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userType = c.get('userType');
            if (userType !== 'admin') {
                return c.json({ success: false, error: { message: 'Admin access required' } }, 403);
            }

            const { institutionId } = c.req.valid('param');
            const body = c.req.valid('json');

            const existing = await db.select().from(departments)
                .where(and(eq(departments.institutionId, institutionId), eq(departments.departmentCode, body.departmentCode)))
                .limit(1);
            if (existing.length) {
                return c.json({ success: false, error: { message: 'Department code already exists in this institution' } }, 409);
            }

            const result = await db.insert(departments).values({
                institutionId,
                departmentCode: body.departmentCode,
                departmentName: body.departmentName,
                departmentType: body.departmentType ?? null,
                location: body.location ?? null,
                phone: body.phone ?? null,
                isActive: true,
            }).returning({ id: departments.id });

            return c.json({ success: true, data: { departmentId: result[0].id } }, 201);
        } catch (err: unknown) {
            console.error('Create department error:', err);
            return handleError(err, c);
        }
    })

    // ========== UPDATE DEPARTMENT (admin only) ==========
    .openapi(createRoute({
        tags: ['Institutions'],
        summary: 'Update a department (admin only)',
        method: 'patch',
        path: '/departments/:departmentId',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        request: {
            params: z.object({ departmentId: z.string().uuid() }),
            body: { content: { 'application/json': { schema: updateDepartmentSchema } } },
        },
        responses: {
            200: { content: { 'application/json': { schema: successData } }, description: 'Department updated' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            404: { content: { 'application/json': { schema: errorSchema } }, description: 'Department not found' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userType = c.get('userType');
            if (userType !== 'admin') {
                return c.json({ success: false, error: { message: 'Admin access required' } }, 403);
            }

            const { departmentId } = c.req.valid('param');
            const body = c.req.valid('json');

            const existing = await db.select().from(departments).where(eq(departments.id, departmentId)).limit(1);
            if (!existing.length) {
                return c.json({ success: false, error: { message: 'Department not found' } }, 404);
            }

            const updateData: Record<string, unknown> = {};
            if (body.departmentCode !== undefined) updateData.departmentCode = body.departmentCode;
            if (body.departmentName !== undefined) updateData.departmentName = body.departmentName;
            if (body.departmentType !== undefined) updateData.departmentType = body.departmentType;
            if (body.location !== undefined) updateData.location = body.location;
            if (body.phone !== undefined) updateData.phone = body.phone;
            if (body.isActive !== undefined) updateData.isActive = body.isActive;

            if (Object.keys(updateData).length === 0) {
                return c.json({ success: true, data: { message: 'No changes' } });
            }

            await db.update(departments).set(updateData).where(eq(departments.id, departmentId));

            return c.json({ success: true, data: { message: 'Department updated successfully' } });
        } catch (err: unknown) {
            console.error('Update department error:', err);
            return handleError(err, c);
        }
    })

    // ========== DEACTIVATE DEPARTMENT (admin only) ==========
    .openapi(createRoute({
        tags: ['Institutions'],
        summary: 'Deactivate a department (admin only)',
        method: 'delete',
        path: '/departments/:departmentId',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        request: {
            params: z.object({ departmentId: z.string().uuid() }),
        },
        responses: {
            200: { content: { 'application/json': { schema: successData } }, description: 'Department deactivated' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            404: { content: { 'application/json': { schema: errorSchema } }, description: 'Department not found' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userType = c.get('userType');
            if (userType !== 'admin') {
                return c.json({ success: false, error: { message: 'Admin access required' } }, 403);
            }

            const { departmentId } = c.req.valid('param');
            const result = await db.update(departments)
                .set({ isActive: false })
                .where(eq(departments.id, departmentId))
                .returning();

            if (!result.length) {
                return c.json({ success: false, error: { message: 'Department not found' } }, 404);
            }

            return c.json({ success: true, data: { message: 'Department deactivated successfully' } });
        } catch (err: unknown) {
            console.error('Deactivate department error:', err);
            return handleError(err, c);
        }
    })

    // ========== LIST WARDS under a department ==========
    .openapi(createRoute({
        tags: ['Institutions'],
        summary: 'List wards of a department',
        method: 'get',
        path: '/departments/:departmentId/wards',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        request: {
            params: z.object({ departmentId: z.string().uuid() }),
        },
        responses: {
            200: { content: { 'application/json': { schema: successData } }, description: 'List of wards' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const { departmentId } = c.req.valid('param');
            const wardList = await db.select().from(wards)
                .where(and(eq(wards.departmentId, departmentId), eq(wards.isActive, true)));
            return c.json({ success: true, data: { wards: wardList } });
        } catch (err: unknown) {
            console.error('List wards error:', err);
            return handleError(err, c);
        }
    })

    // ========== CREATE WARD (admin only) ==========
    .openapi(createRoute({
        tags: ['Institutions'],
        summary: 'Create a ward in a department (admin only)',
        method: 'post',
        path: '/departments/:departmentId/wards',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        request: {
            params: z.object({ departmentId: z.string().uuid() }),
            body: { content: { 'application/json': { schema: createWardSchema } } },
        },
        responses: {
            201: { content: { 'application/json': { schema: successData } }, description: 'Ward created' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            409: { content: { 'application/json': { schema: errorSchema } }, description: 'Ward code already exists' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userType = c.get('userType');
            if (userType !== 'admin') {
                return c.json({ success: false, error: { message: 'Admin access required' } }, 403);
            }

            const { departmentId } = c.req.valid('param');
            const body = c.req.valid('json');

            const dept = await db.select({ institutionId: departments.institutionId }).from(departments).where(eq(departments.id, departmentId)).limit(1);
            if (!dept.length) {
                return c.json({ success: false, error: { message: 'Department not found' } }, 404);
            }
            const institutionId = dept[0].institutionId;

            const existing = await db.select().from(wards)
                .where(and(eq(wards.institutionId, institutionId), eq(wards.wardCode, body.wardCode)))
                .limit(1);
            if (existing.length) {
                return c.json({ success: false, error: { message: 'Ward code already exists in this institution' } }, 409);
            }

            const result = await db.insert(wards).values({
                departmentId,
                institutionId,
                wardCode: body.wardCode,
                wardName: body.wardName,
                wardType: body.wardType ?? null,
                bedCount: body.bedCount,
                availableBeds: body.availableBeds,
                isActive: true,
            }).returning({ id: wards.id });

            return c.json({ success: true, data: { wardId: result[0].id } }, 201);
        } catch (err: unknown) {
            console.error('Create ward error:', err);
            return handleError(err, c);
        }
    })

    // ========== UPDATE WARD (admin only) ==========
    .openapi(createRoute({
        tags: ['Institutions'],
        summary: 'Update a ward (admin only)',
        method: 'patch',
        path: '/wards/:wardId',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        request: {
            params: z.object({ wardId: z.string().uuid() }),
            body: { content: { 'application/json': { schema: updateWardSchema } } },
        },
        responses: {
            200: { content: { 'application/json': { schema: successData } }, description: 'Ward updated' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            404: { content: { 'application/json': { schema: errorSchema } }, description: 'Ward not found' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userType = c.get('userType');
            if (userType !== 'admin') {
                return c.json({ success: false, error: { message: 'Admin access required' } }, 403);
            }

            const { wardId } = c.req.valid('param');
            const body = c.req.valid('json');

            const existing = await db.select().from(wards).where(eq(wards.id, wardId)).limit(1);
            if (!existing.length) {
                return c.json({ success: false, error: { message: 'Ward not found' } }, 404);
            }

            const updateData: Record<string, unknown> = {};
            if (body.wardCode !== undefined) updateData.wardCode = body.wardCode;
            if (body.wardName !== undefined) updateData.wardName = body.wardName;
            if (body.wardType !== undefined) updateData.wardType = body.wardType;
            if (body.bedCount !== undefined) updateData.bedCount = body.bedCount;
            if (body.availableBeds !== undefined) updateData.availableBeds = body.availableBeds;

            if (Object.keys(updateData).length === 0) {
                return c.json({ success: true, data: { message: 'No changes' } });
            }

            await db.update(wards).set(updateData).where(eq(wards.id, wardId));

            return c.json({ success: true, data: { message: 'Ward updated successfully' } });
        } catch (err: unknown) {
            console.error('Update ward error:', err);
            return handleError(err, c);
        }
    })

    // ========== DEACTIVATE WARD (admin only) ==========
    .openapi(createRoute({
        tags: ['Institutions'],
        summary: 'Deactivate a ward (admin only)',
        method: 'delete',
        path: '/wards/:wardId',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        request: {
            params: z.object({ wardId: z.string().uuid() }),
        },
        responses: {
            200: { content: { 'application/json': { schema: successData } }, description: 'Ward deactivated' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            404: { content: { 'application/json': { schema: errorSchema } }, description: 'Ward not found' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userType = c.get('userType');
            if (userType !== 'admin') {
                return c.json({ success: false, error: { message: 'Admin access required' } }, 403);
            }

            const { wardId } = c.req.valid('param');
            const result = await db.update(wards)
                .set({ isActive: false })
                .where(eq(wards.id, wardId))
                .returning();

            if (!result.length) {
                return c.json({ success: false, error: { message: 'Ward not found' } }, 404);
            }

            return c.json({ success: true, data: { message: 'Ward deactivated successfully' } });
        } catch (err: unknown) {
            console.error('Deactivate ward error:', err);
            return handleError(err, c);
        }
    })

    // ========== GET DEPARTMENTS FILTERED BY INSTITUTION (clean endpoint) ==========
    .openapi(createRoute({
        tags: ['Institutions'],
        summary: 'Get departments (filter by institution)',
        method: 'get',
        path: '/departments',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        request: {
            query: z.object({
                institutionId: z.string().uuid().optional(),
            }),
        },
        responses: {
            200: { content: { 'application/json': { schema: successData } }, description: 'Departments list' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userType = c.get('userType');
            if (!['admin', 'receptionist', 'practitioner', 'nurse'].includes(userType)) {
                return c.json({ success: false, error: { message: 'Access denied' } }, 403);
            }

            const { institutionId } = c.req.valid('query');
            let query = db.select().from(departments).where(eq(departments.isActive, true));
            if (institutionId) {
                query = query.where(eq(departments.institutionId, institutionId));
            }
            const result = await query.orderBy(departments.departmentName);
            return c.json({ success: true, data: result });
        } catch (err: any) {
            console.error(err);
            return handleError(err, c);
        }
    });