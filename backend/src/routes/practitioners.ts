import { createRoute, z } from '@hono/zod-openapi';
import { eq, and, ilike, or, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  practitioners,
  institutions,
  userTypeEnum,
} from '../db/schema';
import { createRouter } from '../lib/create-app';
import { authMiddleware } from '../middleware/auth';
import { encrypt, decrypt, hashData, generateRecordHash } from '../services/crypto';
import { storeRecordHash, checkPermission } from '../services/fabric';
import crypto from 'crypto';

const errorSchema = z.object({
  success: z.boolean(),
  error: z.object({ message: z.string() }),
});

// ==================== Registration Schema ====================
const registerPractitionerSchema = z.object({
  // Personal Information (encrypted)
  firstName: z.string().min(1),
  lastName: z.string().min(1),

  // Professional Information
  licenseNumber: z.string().min(1),
  institutionalId: z.string().min(1),
  specialization: z.string().min(1),
  department: z.string().optional(),

  // Contact (encrypted)
  phoneNumber: z.string().min(5),
  email: z.string().email(),

  // Credentials (optional, encrypted)
  credentials: z.string().optional(),
  qualifications: z.string().optional(),

  // Authentication
  password: z.string().min(8),

  // Optional institution association at creation
  institutionId: z.string().uuid().optional(),
});

// ==================== Update Profile Schema ====================
const updatePractitionerSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  specialization: z.string().min(1).optional(),
  department: z.string().optional(),
  phoneNumber: z.string().min(5).optional(),
  email: z.string().email().optional(),
  credentials: z.string().optional(),
  qualifications: z.string().optional(),
  password: z.string().min(8).optional(),
});

export const practitionerRouter = createRouter()

  // ========== REGISTER NEW PRACTITIONER ==========
  .openapi(createRoute({
    tags: ['Practitioners'],
    summary: 'Register a new practitioner (requires admin verification)',
    method: 'post',
    path: '/',
    request: {
      body: { content: { 'application/json': { schema: registerPractitionerSchema } } },
    },
    responses: {
      201: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              data: z.object({
                practitionerId: z.string().uuid(),
                blockchainAddress: z.string(),
                message: z.string(),
              })
            })
          }
        },
        description: 'Practitioner registered successfully, pending verification',
      },
      409: { content: { 'application/json': { schema: errorSchema } }, description: 'License number already exists' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const body = c.req.valid('json');

      // Check if license number already exists (unique)
      const existing = await db.select().from(practitioners)
        .where(eq(practitioners.licenseNumber, body.licenseNumber))
        .limit(1);
      if (existing.length) {
        return c.json({ success: false, error: { message: 'License number already registered' } }, 409);
      }

      // Generate blockchain address (deterministic based on license number + salt)
      const blockchainAddress = `practitioner:${crypto.createHash('sha256').update(body.licenseNumber + process.env.BLOCKCHAIN_SALT || 'salt').digest('hex')}`;

      // Encrypt fields
      const encrypted = {
        firstNameEncrypted: encrypt(body.firstName),
        lastNameEncrypted: encrypt(body.lastName),
        phoneNumberEncrypted: encrypt(body.phoneNumber),
        emailEncrypted: encrypt(body.email),
        credentialsEncrypted: body.credentials ? encrypt(body.credentials) : null,
      };

      // Hash password
      const passwordHash = hashData(body.password);

      // Insert practitioner (not verified initially)
      const result = await db.insert(practitioners).values({
        blockchainAddress,
        institutionId: body.institutionId ?? null,
        ...encrypted,
        licenseNumber: body.licenseNumber,
        institutionalId: body.institutionalId,
        specialization: body.specialization,
        department: body.department ?? null,
        qualifications: body.qualifications ?? null,
        passwordHash,
        isVerified: false,
        isActive: true,
      }).returning({ id: practitioners.id, blockchainAddress: practitioners.blockchainAddress });

      // Store creation hash on blockchain
      const creationHash = generateRecordHash({ practitionerId: result[0].id, licenseNumber: body.licenseNumber, timestamp: new Date().toISOString() });
      await storeRecordHash(result[0].id, blockchainAddress, creationHash, 'practitioner_registration').catch(() => { });

      return c.json({
        success: true,
        data: {
          practitionerId: result[0].id,
          blockchainAddress: result[0].blockchainAddress,
          message: 'Registration successful. Awaiting admin verification.',
        }
      }, 201);

    } catch (err: any) {
      console.error('Practitioner registration error:', err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ========== GET MY PROFILE ==========
  .openapi(createRoute({
    tags: ['Practitioners'],
    summary: 'Get authenticated practitioner profile',
    method: 'get',
    path: '/me',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              data: z.object({
                id: z.string(),
                blockchainAddress: z.string(),
                firstName: z.string(),
                lastName: z.string(),
                licenseNumber: z.string(),
                institutionalId: z.string(),
                specialization: z.string(),
                department: z.string().optional(),
                phoneNumber: z.string(),
                email: z.string(),
                credentials: z.string().optional(),
                qualifications: z.string().optional(),
                institutionId: z.string().optional(),
                isVerified: z.boolean(),
                isActive: z.boolean(),
                createdAt: z.string(),
              })
            })
          }
        },
        description: 'Practitioner profile',
      },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Practitioner not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      if (userType !== 'practitioner') {
        return c.json({ success: false, error: { message: 'Access denied' } }, 403);
      }

      const practitionerId = c.get('userId');

      const practitioner = await db.select().from(practitioners).where(eq(practitioners.id, practitionerId)).limit(1);
      if (!practitioner.length) {
        return c.json({ success: false, error: { message: 'Practitioner not found' } }, 404);
      }

      const p = practitioner[0];

      // Decrypt fields
      const profile = {
        id: p.id,
        blockchainAddress: p.blockchainAddress,
        firstName: decrypt(p.firstNameEncrypted),
        lastName: decrypt(p.lastNameEncrypted),
        licenseNumber: p.licenseNumber,
        institutionalId: p.institutionalId,
        specialization: p.specialization,
        department: p.department ?? undefined,
        phoneNumber: decrypt(p.phoneNumberEncrypted),
        email: decrypt(p.emailEncrypted),
        credentials: p.credentialsEncrypted ? decrypt(p.credentialsEncrypted) : undefined,
        qualifications: p.qualifications ?? undefined,
        institutionId: p.institutionId ?? undefined,
        isVerified: p.isVerified,
        isActive: p.isActive,
        createdAt: p.createdAt.toISOString(),
      };

      return c.json({ success: true, data: profile });

    } catch (err: any) {
      console.error('Get practitioner profile error:', err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ========== UPDATE MY PROFILE ==========
  .openapi(createRoute({
    tags: ['Practitioners'],
    summary: 'Update authenticated practitioner profile',
    method: 'patch',
    path: '/me',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: {
      body: { content: { 'application/json': { schema: updatePractitionerSchema } } },
    },
    responses: {
      200: {
        content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.object({ message: z.string() }) }) } },
        description: 'Profile updated',
      },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Practitioner not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      if (userType !== 'practitioner') {
        return c.json({ success: false, error: { message: 'Access denied' } }, 403);
      }

      const practitionerId = c.get('userId');
      const body = c.req.valid('json');

      // Build update object with encrypted fields where needed
      const updateData: any = {};

      if (body.firstName) updateData.firstNameEncrypted = encrypt(body.firstName);
      if (body.lastName) updateData.lastNameEncrypted = encrypt(body.lastName);
      if (body.specialization) updateData.specialization = body.specialization;
      if (body.department !== undefined) updateData.department = body.department;
      if (body.phoneNumber) updateData.phoneNumberEncrypted = encrypt(body.phoneNumber);
      if (body.email) updateData.emailEncrypted = encrypt(body.email);
      if (body.credentials !== undefined) updateData.credentialsEncrypted = body.credentials ? encrypt(body.credentials) : null;
      if (body.qualifications !== undefined) updateData.qualifications = body.qualifications;
      if (body.password) updateData.passwordHash = hashData(body.password);

      updateData.updatedAt = new Date();

      if (Object.keys(updateData).length === 0) {
        return c.json({ success: true, data: { message: 'No fields to update' } });
      }

      const result = await db.update(practitioners)
        .set(updateData)
        .where(eq(practitioners.id, practitionerId))
        .returning({ blockchainAddress: practitioners.blockchainAddress });

      if (!result.length) {
        return c.json({ success: false, error: { message: 'Practitioner not found' } }, 404);
      }

      // Optionally store update hash on blockchain
      const updateHash = generateRecordHash({ practitionerId, updates: Object.keys(body), timestamp: new Date().toISOString() });
      await storeRecordHash(practitionerId, result[0].blockchainAddress, updateHash, 'practitioner_update').catch(() => { });

      return c.json({ success: true, data: { message: 'Profile updated successfully' } });

    } catch (err: any) {
      console.error('Update practitioner error:', err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ========== LIST PRACTITIONERS (Admin only) ==========
  .openapi(createRoute({
    tags: ['Practitioners'],
    summary: 'List all practitioners (admin only)',
    method: 'get',
    path: '/',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: {
      query: z.object({
        limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
        offset: z.string().regex(/^\d+$/).transform(Number).optional().default('0'),
        verified: z.enum(['true', 'false']).optional(),
        active: z.enum(['true', 'false']).optional(),
      }),
    },
    responses: {
      200: {
        content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.any() }) } },
        description: 'List of practitioners',
      },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      if (userType !== 'admin') {
        return c.json({ success: false, error: { message: 'Admin access required' } }, 403);
      }

      const { limit, offset, verified, active } = c.req.valid('query');

      let query = db.select({
        id: practitioners.id,
        blockchainAddress: practitioners.blockchainAddress,
        firstNameEncrypted: practitioners.firstNameEncrypted,
        lastNameEncrypted: practitioners.lastNameEncrypted,
        licenseNumber: practitioners.licenseNumber,
        specialization: practitioners.specialization,
        department: practitioners.department,
        institutionId: practitioners.institutionId,
        isVerified: practitioners.isVerified,
        isActive: practitioners.isActive,
        createdAt: practitioners.createdAt,
      }).from(practitioners);

      if (verified !== undefined) {
        query = query.where(eq(practitioners.isVerified, verified === 'true'));
      }
      if (active !== undefined) {
        query = query.where(eq(practitioners.isActive, active === 'true'));
      }

      const practitionersList = await query.limit(limit).offset(offset);

      // Decrypt names for response
      const result = practitionersList.map(p => ({
        id: p.id,
        blockchainAddress: p.blockchainAddress,
        firstName: decrypt(p.firstNameEncrypted),
        lastName: decrypt(p.lastNameEncrypted),
        licenseNumber: p.licenseNumber,
        specialization: p.specialization,
        department: p.department,
        institutionId: p.institutionId,
        isVerified: p.isVerified,
        isActive: p.isActive,
        createdAt: p.createdAt,
      }));

      return c.json({ success: true, data: { practitioners: result, limit, offset } });

    } catch (err: any) {
      console.error('List practitioners error:', err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ========== GET PRACTITIONER BY ID (Admin or self) ==========
  .openapi(createRoute({
    tags: ['Practitioners'],
    summary: 'Get practitioner details by ID (admin or self)',
    method: 'get',
    path: '/:practitionerId',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: {
      params: z.object({ practitionerId: z.string().uuid() }),
    },
    responses: {
      200: {
        content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.any() }) } },
        description: 'Practitioner details',
      },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Practitioner not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      const userId = c.get('userId');
      const { practitionerId } = c.req.valid('param');

      // Allow access only if admin or the practitioner themselves
      if (userType !== 'admin' && userId !== practitionerId) {
        return c.json({ success: false, error: { message: 'Access denied' } }, 403);
      }

      const practitioner = await db.select().from(practitioners).where(eq(practitioners.id, practitionerId)).limit(1);
      if (!practitioner.length) {
        return c.json({ success: false, error: { message: 'Practitioner not found' } }, 404);
      }

      const p = practitioner[0];

      const profile = {
        id: p.id,
        blockchainAddress: p.blockchainAddress,
        firstName: decrypt(p.firstNameEncrypted),
        lastName: decrypt(p.lastNameEncrypted),
        licenseNumber: p.licenseNumber,
        institutionalId: p.institutionalId,
        specialization: p.specialization,
        department: p.department,
        phoneNumber: decrypt(p.phoneNumberEncrypted),
        email: decrypt(p.emailEncrypted),
        credentials: p.credentialsEncrypted ? decrypt(p.credentialsEncrypted) : null,
        qualifications: p.qualifications,
        institutionId: p.institutionId,
        isVerified: p.isVerified,
        isActive: p.isActive,
        createdAt: p.createdAt,
      };

      return c.json({ success: true, data: profile });

    } catch (err: any) {
      console.error('Get practitioner by ID error:', err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ========== VERIFY PRACTITIONER (Admin only) ==========
  .openapi(createRoute({
    tags: ['Practitioners'],
    summary: 'Verify a practitioner (admin only)',
    method: 'patch',
    path: '/:practitionerId/verify',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: {
      params: z.object({ practitionerId: z.string().uuid() }),
    },
    responses: {
      200: {
        content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.object({ message: z.string() }) }) } },
        description: 'Practitioner verified',
      },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Practitioner not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      if (userType !== 'admin') {
        return c.json({ success: false, error: { message: 'Admin access required' } }, 403);
      }

      const { practitionerId } = c.req.valid('param');

      const result = await db.update(practitioners)
        .set({ isVerified: true, updatedAt: new Date() })
        .where(eq(practitioners.id, practitionerId))
        .returning({ blockchainAddress: practitioners.blockchainAddress });

      if (!result.length) {
        return c.json({ success: false, error: { message: 'Practitioner not found' } }, 404);
      }

      // Blockchain log
      const verifyHash = generateRecordHash({ practitionerId, action: 'verify', timestamp: new Date().toISOString() });
      await storeRecordHash(practitionerId, result[0].blockchainAddress, verifyHash, 'practitioner_verify').catch(() => { });

      return c.json({ success: true, data: { message: 'Practitioner verified successfully' } });

    } catch (err: any) {
      console.error('Verify practitioner error:', err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ========== DEACTIVATE PRACTITIONER (Admin only) ==========
  .openapi(createRoute({
    tags: ['Practitioners'],
    summary: 'Deactivate a practitioner (admin only)',
    method: 'delete',
    path: '/:practitionerId',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: {
      params: z.object({ practitionerId: z.string().uuid() }),
    },
    responses: {
      200: {
        content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.object({ message: z.string() }) }) } },
        description: 'Practitioner deactivated',
      },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Practitioner not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      if (userType !== 'admin') {
        return c.json({ success: false, error: { message: 'Admin access required' } }, 403);
      }

      const { practitionerId } = c.req.valid('param');

      const result = await db.update(practitioners)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(practitioners.id, practitionerId))
        .returning({ blockchainAddress: practitioners.blockchainAddress });

      if (!result.length) {
        return c.json({ success: false, error: { message: 'Practitioner not found' } }, 404);
      }

      const deactivateHash = generateRecordHash({ practitionerId, action: 'deactivate', timestamp: new Date().toISOString() });
      await storeRecordHash(practitionerId, result[0].blockchainAddress, deactivateHash, 'practitioner_deactivate').catch(() => { });

      return c.json({ success: true, data: { message: 'Practitioner deactivated successfully' } });

    } catch (err: any) {
      console.error('Deactivate practitioner error:', err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  });