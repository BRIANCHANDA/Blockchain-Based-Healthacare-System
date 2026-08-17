import { handleError } from '../lib/errors';
import { createRoute, z } from '@hono/zod-openapi';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db';
import { practitioners, institutions } from '../db/schema';
import { createRouter } from '../lib/create-app';
import { authMiddleware } from '../middleware/auth';
import { encrypt, decrypt, hashData, generateRecordHash } from '../services/crypto';
import { storeRecordHash } from '../services/fabric';
import crypto from 'crypto';

const errorSchema = z.object({ success: z.boolean(), error: z.object({ message: z.string() }) });

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getStaffInstitution(staffId: string): Promise<string | null> {
  const row = await db
    .select({ institutionId: practitioners.institutionId })
    .from(practitioners)
    .where(eq(practitioners.id, staffId))
    .limit(1);
  return row[0]?.institutionId ?? null;
}

// ── Router ────────────────────────────────────────────────────────────────────

export const practitionerRouter = createRouter()

  // ── REGISTER ─────────────────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Practitioners'],
    summary: 'Register a new practitioner (pending verification)',
    method: 'post',
    path: '/',
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              firstName: z.string().min(1),
              lastName: z.string().min(1),
              licenseNumber: z.string().min(1),
              institutionalId: z.string().min(1),
              specialization: z.string().min(1),
              department: z.string().optional(),
              phoneNumber: z.string().min(5),
              email: z.string().email(),
              credentials: z.string().optional(),
              qualifications: z.string().optional(),
              password: z.string().min(8),
              institutionId: z.string().uuid(),
            }),
          },
        },
      },
    },
    responses: {
      201: { content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.any() }) } }, description: 'Registered' },
      409: { content: { 'application/json': { schema: errorSchema } }, description: 'License exists' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const body = c.req.valid('json');
      const existing = await db.select({ id: practitioners.id }).from(practitioners).where(eq(practitioners.licenseNumber, body.licenseNumber)).limit(1);
      if (existing.length) return c.json({ success: false, error: { message: 'License number already registered' } }, 409);

      const blockchainAddress = `practitioner:${crypto.createHash('sha256').update(body.licenseNumber + (process.env.BLOCKCHAIN_SALT || 'salt')).digest('hex')}`;

      const result = await db.insert(practitioners).values({
        blockchainAddress,
        institutionId: body.institutionId,
        firstNameEncrypted: encrypt(body.firstName),
        lastNameEncrypted: encrypt(body.lastName),
        phoneNumberEncrypted: encrypt(body.phoneNumber),
        emailEncrypted: encrypt(body.email),
        credentialsEncrypted: body.credentials ? encrypt(body.credentials) : null,
        licenseNumber: body.licenseNumber,
        institutionalId: body.institutionalId,
        specialization: body.specialization,
        department: body.department ?? null,
        qualifications: body.qualifications ?? null,
        passwordHash: hashData(body.password),
        isVerified: false,
        isActive: true,
      }).returning({ id: practitioners.id, blockchainAddress: practitioners.blockchainAddress });

      const hash = generateRecordHash({ practitionerId: result[0].id, licenseNumber: body.licenseNumber, timestamp: new Date().toISOString() });
      storeRecordHash(result[0].id, blockchainAddress, hash, 'practitioner_registration').catch(() => { });

      return c.json({ success: true, data: { practitionerId: result[0].id, blockchainAddress: result[0].blockchainAddress, message: 'Registration successful. Awaiting admin verification.' } }, 201);
    } catch (err: any) {
      console.error('[PRACTITIONER_REGISTER]', err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ── GET ONLINE STAFF ──────────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Practitioners'],
    summary: 'Get recently active staff by role (same institution)',
    method: 'get',
    path: '/online',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: {
      query: z.object({
        role: z.enum(['nurse', 'practitioner', 'lab_technician', 'radiologist', 'pharmacist', 'receptionist', 'admin']).optional(),
      }).passthrough(),
    },
    responses: {
      200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.any() }) } }, description: 'Online staff' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userId = c.get('userId');
      const rawUrl = c.req.raw.url;
      const params = new URLSearchParams(rawUrl.split('?')[1] || '');
      const roleParam = params.get('role');

      const staffInstitutionId = await getStaffInstitution(userId);
      if (!staffInstitutionId)
        return c.json({ success: false, error: { message: 'Your account is not associated with an institution.' } }, 403);

      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      const conditions: any[] = [
        eq(practitioners.institutionId, staffInstitutionId),
        eq(practitioners.isActive, true),
        eq(practitioners.isVerified, true),
        sql`${practitioners.lastSeenAt} >= ${fiveMinutesAgo.toISOString()}`,
      ];
      if (roleParam) conditions.push(eq(practitioners.role, roleParam as any));

      const rows = await db
        .select({ id: practitioners.id, firstNameEncrypted: practitioners.firstNameEncrypted, lastNameEncrypted: practitioners.lastNameEncrypted, role: practitioners.role, specialization: practitioners.specialization, lastSeenAt: practitioners.lastSeenAt })
        .from(practitioners)
        .where(and(...conditions))
        .orderBy(desc(practitioners.lastSeenAt));

      const staff = rows.map(s => ({
        id: s.id,
        firstName: decrypt(s.firstNameEncrypted),
        lastName: decrypt(s.lastNameEncrypted),
        role: s.role,
        specialization: s.specialization,
        lastSeenAt: s.lastSeenAt?.toISOString() ?? null,
      }));

      return c.json({ success: true, data: { staff } });
    } catch (err: any) {
      console.error('[ONLINE_STAFF]', err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ── GET MY PROFILE ────────────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Practitioners'],
    summary: 'Get authenticated staff profile (any role)',
    method: 'get', path: '/me',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    responses: {
      200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.any() }) } }, description: 'Profile' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Patients not allowed' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      const userId = c.get('userId');

      if (userType === 'patient')
        return c.json({ success: false, error: { message: 'Patients cannot use this endpoint' } }, 403);

      const s = (await db.select().from(practitioners).where(eq(practitioners.id, userId)).limit(1))[0];
      if (!s) return c.json({ success: false, error: { message: 'Profile not found' } }, 404);

      // Resolve institution name
      let institutionName: string | null = null;
      if (s.institutionId) {
        const inst = await db
          .select({ name: institutions.institutionName })
          .from(institutions)
          .where(eq(institutions.id, s.institutionId))
          .limit(1);
        institutionName = inst[0]?.name ?? null;
      }

      const safe = (fn: () => string): string | null => { try { return fn(); } catch { return null; } };

      return c.json({
        success: true,
        data: {
          id: s.id,
          role: s.role,
          licenseNumber: s.licenseNumber,
          institutionalId: s.institutionalId ?? null,
          firstName: safe(() => decrypt(s.firstNameEncrypted)),
          lastName: safe(() => decrypt(s.lastNameEncrypted)),
          email: safe(() => decrypt(s.emailEncrypted)),
          phoneNumber: safe(() => decrypt(s.phoneNumberEncrypted)),
          specialization: s.specialization ?? null,
          department: s.department ?? null,
          qualifications: s.qualifications ?? null,
          credentials: s.credentialsEncrypted ? safe(() => decrypt(s.credentialsEncrypted!)) : null,
          institutionId: s.institutionId ?? null,
          institutionName,
          blockchainAddress: s.blockchainAddress,
          isVerified: s.isVerified,
          isActive: s.isActive,
          mustChangePassword: (s as any).mustChangePassword ?? false,
          lastSeenAt: s.lastSeenAt?.toISOString() ?? null,
          createdAt: s.createdAt?.toISOString() ?? null,
        },
      });
    } catch (err: any) {
      console.error('[PRACTITIONER_ME]', err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ── UPDATE MY PROFILE ─────────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Practitioners'],
    summary: 'Update authenticated practitioner profile',
    method: 'patch', path: '/me',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              firstName: z.string().min(1).optional(),
              lastName: z.string().min(1).optional(),
              specialization: z.string().min(1).optional(),
              department: z.string().optional(),
              phoneNumber: z.string().min(5).optional(),
              email: z.string().email().optional(),
              credentials: z.string().optional(),
              qualifications: z.string().optional(),
              password: z.string().min(8).optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.any() }) } }, description: 'Updated' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      if (!['practitioner', 'admin'].includes(userType)) return c.json({ success: false, error: { message: 'Access denied' } }, 403);
      const body = c.req.valid('json');
      const u: any = {};
      if (body.firstName) u.firstNameEncrypted = encrypt(body.firstName);
      if (body.lastName) u.lastNameEncrypted = encrypt(body.lastName);
      if (body.specialization) u.specialization = body.specialization;
      if (body.department !== undefined) u.department = body.department;
      if (body.phoneNumber) u.phoneNumberEncrypted = encrypt(body.phoneNumber);
      if (body.email) u.emailEncrypted = encrypt(body.email);
      if (body.credentials !== undefined) u.credentialsEncrypted = body.credentials ? encrypt(body.credentials) : null;
      if (body.qualifications !== undefined) u.qualifications = body.qualifications;
      if (body.password) u.passwordHash = hashData(body.password);
      u.updatedAt = new Date();
      if (Object.keys(u).length === 1) return c.json({ success: true, data: { message: 'No fields to update' } });
      const result = await db.update(practitioners).set(u).where(eq(practitioners.id, c.get('userId'))).returning({ blockchainAddress: practitioners.blockchainAddress });
      if (!result.length) return c.json({ success: false, error: { message: 'Not found' } }, 404);
      const hash = generateRecordHash({ practitionerId: c.get('userId'), updates: Object.keys(body), timestamp: new Date().toISOString() });
      storeRecordHash(c.get('userId'), result[0].blockchainAddress, hash, 'practitioner_update').catch(() => { });
      return c.json({ success: true, data: { message: 'Profile updated successfully' } });
    } catch (err: any) {
      console.error('[PRACTITIONER_UPDATE]', err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ── LIST PRACTITIONERS ────────────────────────────────────────────────────
  // Super admin (institutionId = null) → all practitioners, optionally filtered
  // Hospital admin / staff (institutionId set) → scoped to their institution
  // Supports: role, verified, active, search (in-memory after decrypt), page, limit
  .openapi(createRoute({
    tags: ['Practitioners'],
    summary: 'List practitioners — scoped by caller institution',
    method: 'get', path: '/',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    request: {
      query: z.object({
        limit: z.string().regex(/^\d+$/).transform(Number).optional().default('100'),
        offset: z.string().regex(/^\d+$/).transform(Number).optional().default('0'),
        page: z.string().regex(/^\d+$/).transform(Number).optional(),
        verified: z.enum(['true', 'false']).optional(),
        active: z.enum(['true', 'false']).optional(),
        role: z.enum(['nurse', 'practitioner', 'lab_technician', 'radiologist', 'pharmacist', 'receptionist', 'admin']).optional(),
        search: z.string().optional(),
        institutionId: z.string().uuid().optional(), // super admin can filter by specific institution
      }),
    },
    responses: {
      200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.any() }) } }, description: 'List' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      const userId = c.get('userId');

      if (!['admin', 'practitioner', 'nurse', 'receptionist', 'lab_technician', 'radiologist', 'pharmacist'].includes(userType))
        return c.json({ success: false, error: { message: 'Access denied' } }, 403);

      const { role, verified, active, search, institutionId: filterInstitutionId } = c.req.valid('query');

      // page param support: page=1 means offset=0, page=2 means offset=limit, etc.
      const rawQuery = c.req.valid('query');
      const limit = rawQuery.limit;
      const offset = rawQuery.page ? (rawQuery.page - 1) * limit : rawQuery.offset;

      // Determine institution scope
      const callerInstitutionId = await getStaffInstitution(userId);
      const isSuperAdmin = callerInstitutionId === null && userType === 'admin';

      const conditions: any[] = [];

      if (isSuperAdmin) {
        // Super admin: optionally filter by a specific institution
        if (filterInstitutionId) {
          conditions.push(eq(practitioners.institutionId, filterInstitutionId));
        }
        // No institution filter = return everyone
      } else if (callerInstitutionId) {
        // Hospital admin or staff: always scope to their institution
        conditions.push(eq(practitioners.institutionId, callerInstitutionId));
      }

      // Role filter
      if (role) conditions.push(eq(practitioners.role, role));

      // Verified filter
      if (verified !== undefined) conditions.push(eq(practitioners.isVerified, verified === 'true'));

      // Active filter — default to active only
      conditions.push(eq(practitioners.isActive, active === 'false' ? false : true));

      const rows = await db
        .select({
          id: practitioners.id,
          firstNameEncrypted: practitioners.firstNameEncrypted,
          lastNameEncrypted: practitioners.lastNameEncrypted,
          licenseNumber: practitioners.licenseNumber,
          role: practitioners.role,
          specialization: practitioners.specialization,
          department: practitioners.department,
          institutionId: practitioners.institutionId,
          isVerified: practitioners.isVerified,
          isActive: practitioners.isActive,
          createdAt: practitioners.createdAt,
        })
        .from(practitioners)
        .where(conditions.length ? and(...conditions) : undefined)
        // Newest first. Callers that ask for "the most recent N staff" pass a
        // limit and expect the latest registrations; ascending order returned
        // the oldest instead, so the admin dashboard's "Recent staff" panel was
        // listing the earliest-registered accounts.
        .orderBy(desc(practitioners.createdAt));

      // Decrypt + optionally join institution name
      let result = rows.map(p => {
        let firstName = '', lastName = '';
        try { firstName = decrypt(p.firstNameEncrypted); } catch { firstName = 'Unknown'; }
        try { lastName = decrypt(p.lastNameEncrypted); } catch { lastName = ''; }
        return { id: p.id, firstName, lastName, licenseNumber: p.licenseNumber, role: p.role, specialization: p.specialization, department: p.department, institutionId: p.institutionId, isVerified: p.isVerified, isActive: p.isActive, createdAt: p.createdAt };
      });

      // In-memory search (names are encrypted so SQL LIKE won't work)
      if (search) {
        const q = search.toLowerCase();
        result = result.filter(p =>
          `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
          p.licenseNumber.toLowerCase().includes(q) ||
          (p.specialization ?? '').toLowerCase().includes(q)
        );
      }

      // Join institution names for super admin view
      if (isSuperAdmin && result.length) {
        const instIds = [...new Set(result.map(p => p.institutionId).filter(Boolean))] as string[];
        if (instIds.length) {
          const instRows = await db
            .select({ id: institutions.id, name: institutions.institutionName })
            .from(institutions)
            .where(eq(institutions.id, instIds[0])); // simple — expand with inArray if needed

          const { inArray } = await import('drizzle-orm');
          const allInst = instIds.length > 1
            ? await db.select({ id: institutions.id, name: institutions.institutionName }).from(institutions).where(inArray(institutions.id, instIds))
            : instRows;

          const instMap = new Map(allInst.map(i => [i.id, i.name]));
          result = result.map(p => ({ ...p, institutionName: p.institutionId ? (instMap.get(p.institutionId) ?? null) : null }));
        }
      }

      const total = result.length;
      const paginated = result.slice(offset, offset + limit);

      return c.json({ success: true, data: { practitioners: paginated, total, limit, offset } });
    } catch (err: any) {
      console.error('[PRACTITIONERS_LIST]', err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ── GET BY ID ─────────────────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Practitioners'],
    summary: 'Get practitioner by ID (admin or self)',
    method: 'get', path: '/:practitionerId',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    request: { params: z.object({ practitionerId: z.string().uuid() }) },
    responses: {
      200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.any() }) } }, description: 'Practitioner' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      const userId = c.get('userId');
      const { practitionerId } = c.req.valid('param');
      if (userType !== 'admin' && userId !== practitionerId)
        return c.json({ success: false, error: { message: 'Access denied' } }, 403);
      const p = (await db.select().from(practitioners).where(eq(practitioners.id, practitionerId)).limit(1))[0];
      if (!p) return c.json({ success: false, error: { message: 'Not found' } }, 404);
      return c.json({ success: true, data: { id: p.id, blockchainAddress: p.blockchainAddress, firstName: decrypt(p.firstNameEncrypted), lastName: decrypt(p.lastNameEncrypted), licenseNumber: p.licenseNumber, institutionalId: p.institutionalId, specialization: p.specialization, department: p.department, phoneNumber: decrypt(p.phoneNumberEncrypted), email: decrypt(p.emailEncrypted), credentials: p.credentialsEncrypted ? decrypt(p.credentialsEncrypted) : null, qualifications: p.qualifications, institutionId: p.institutionId, isVerified: p.isVerified, isActive: p.isActive, createdAt: p.createdAt } });
    } catch (err: any) {
      console.error('[PRACTITIONER_GET]', err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ── VERIFY ────────────────────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Practitioners'],
    summary: 'Verify a practitioner (admin only)',
    method: 'patch', path: '/:practitionerId/verify',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    request: { params: z.object({ practitionerId: z.string().uuid() }) },
    responses: {
      200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.any() }) } }, description: 'Verified' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      if (c.get('userType') !== 'admin') return c.json({ success: false, error: { message: 'Admin only' } }, 403);
      const { practitionerId } = c.req.valid('param');
      const result = await db.update(practitioners).set({ isVerified: true, updatedAt: new Date() }).where(eq(practitioners.id, practitionerId)).returning({ blockchainAddress: practitioners.blockchainAddress });
      if (!result.length) return c.json({ success: false, error: { message: 'Not found' } }, 404);
      const hash = generateRecordHash({ practitionerId, action: 'verify', timestamp: new Date().toISOString() });
      storeRecordHash(practitionerId, result[0].blockchainAddress, hash, 'practitioner_verify').catch(() => { });
      return c.json({ success: true, data: { message: 'Practitioner verified successfully' } });
    } catch (err: any) {
      console.error('[PRACTITIONER_VERIFY]', err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })



  // ── TOGGLE ACTIVE ─────────────────────────────────────────────────────────
  // Add after the VERIFY endpoint in practitioners.ts
  .openapi(createRoute({
    tags: ['Practitioners'],
    summary: 'Toggle active status of a practitioner (admin only)',
    method: 'patch', path: '/:practitionerId/toggle-active',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    request: { params: z.object({ practitionerId: z.string().uuid() }) },
    responses: {
      200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.any() }) } }, description: 'Toggled' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      if (c.get('userType') !== 'admin')
        return c.json({ success: false, error: { message: 'Admin only' } }, 403);

      const { practitionerId } = c.req.valid('param');

      const existing = await db
        .select({ isActive: practitioners.isActive, blockchainAddress: practitioners.blockchainAddress })
        .from(practitioners)
        .where(eq(practitioners.id, practitionerId))
        .limit(1);

      if (!existing.length)
        return c.json({ success: false, error: { message: 'Not found' } }, 404);

      const newStatus = !existing[0].isActive;

      await db
        .update(practitioners)
        .set({ isActive: newStatus, updatedAt: new Date() })
        .where(eq(practitioners.id, practitionerId));

      const hash = generateRecordHash({
        practitionerId,
        action: newStatus ? 'activate' : 'deactivate',
        timestamp: new Date().toISOString(),
      });
      storeRecordHash(practitionerId, existing[0].blockchainAddress, hash, 'practitioner_status').catch(() => { });

      return c.json({
        success: true,
        data: {
          message: `Account ${newStatus ? 'activated' : 'deactivated'} successfully`,
          isActive: newStatus,
        },
      });
    } catch (err: any) {
      console.error('[PRACTITIONER_TOGGLE]', err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ── RESET PASSWORD (Admin) ────────────────────────────────────────────────
  // Add after TOGGLE ACTIVE in practitioners.ts
  .openapi(createRoute({
    tags: ['Practitioners'],
    summary: 'Admin resets a staff member password',
    method: 'patch', path: '/:practitionerId/reset-password',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    request: {
      params: z.object({ practitionerId: z.string().uuid() }),
      body: {
        content: {
          'application/json': {
            schema: z.object({
              newPassword: z.string().min(8),
            }),
          },
        },
      },
    },
    responses: {
      200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.any() }) } }, description: 'Reset' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      if (c.get('userType') !== 'admin')
        return c.json({ success: false, error: { message: 'Admin only' } }, 403);

      const { practitionerId } = c.req.valid('param');
      const { newPassword } = c.req.valid('json');

      // bcryptjs is already used in auth.ts — import at top of practitioners.ts:
      // import { hash } from 'bcryptjs';
      const { hash } = await import('bcryptjs');
      const passwordHash = await hash(newPassword, 12);

      const result = await db
        .update(practitioners)
        .set({
          passwordHash,
          mustChangePassword: true, // force them to change on next login
          updatedAt: new Date(),
        } as any)
        .where(eq(practitioners.id, practitionerId))
        .returning({ id: practitioners.id, blockchainAddress: practitioners.blockchainAddress });

      if (!result.length)
        return c.json({ success: false, error: { message: 'Not found' } }, 404);

      const recordHash = generateRecordHash({
        practitionerId,
        action: 'password_reset',
        resetBy: c.get('userId'),
        timestamp: new Date().toISOString(),
      });
      storeRecordHash(practitionerId, result[0].blockchainAddress, recordHash, 'password_reset').catch(() => { });

      return c.json({
        success: true,
        data: { message: 'Password reset successfully. Staff member must change password on next login.' },
      });
    } catch (err: any) {
      console.error('[PRACTITIONER_RESET_PW]', err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })


  // ── DEACTIVATE ────────────────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Practitioners'],
    summary: 'Deactivate a practitioner (admin only)',
    method: 'delete', path: '/:practitionerId',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    request: { params: z.object({ practitionerId: z.string().uuid() }) },
    responses: {
      200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.any() }) } }, description: 'Deactivated' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      if (c.get('userType') !== 'admin') return c.json({ success: false, error: { message: 'Admin only' } }, 403);
      const { practitionerId } = c.req.valid('param');
      const result = await db.update(practitioners).set({ isActive: false, updatedAt: new Date() }).where(eq(practitioners.id, practitionerId)).returning({ blockchainAddress: practitioners.blockchainAddress });
      if (!result.length) return c.json({ success: false, error: { message: 'Not found' } }, 404);
      const hash = generateRecordHash({ practitionerId, action: 'deactivate', timestamp: new Date().toISOString() });
      storeRecordHash(practitionerId, result[0].blockchainAddress, hash, 'practitioner_deactivate').catch(() => { });
      return c.json({ success: true, data: { message: 'Practitioner deactivated successfully' } });
    } catch (err: any) {
      console.error('[PRACTITIONER_DEACTIVATE]', err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  });