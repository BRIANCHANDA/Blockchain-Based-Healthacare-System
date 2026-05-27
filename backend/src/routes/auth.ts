import { createRoute, z } from '@hono/zod-openapi';
import { sign } from 'jsonwebtoken';
import { hash, compare } from 'bcryptjs';
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { patients, practitioners, authSessions, institutions, patientInstitutionRegistrations } from '../db/schema';
import { encrypt, decrypt } from '../services/crypto';
import { createRouter } from '../lib/create-app';
import { authMiddleware } from '../middleware/auth';
import { sessionMiddleware } from '../middleware/session';
import crypto from 'crypto';

const JWT_SECRET = (process.env.JWT_SECRET || 'healthcare_jwt_secret') as string;
const JWT_EXPIRES_IN = '24h';
const DEFAULT_PASSWORD = 'test1234';

// ── Schemas ───────────────────────────────────────────────────────────────────

const registerPatientSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  middleName: z.string().optional(),
  dateOfBirth: z.string(),
  gender: z.enum(['male', 'female', 'other']),
  bloodType: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown']).optional(),
  phoneNumber: z.string(),
  email: z.string().email().optional(),
  address: z.string(),
  nationalId: z.string(),
  emergencyContact: z.string(),
  maritalStatus: z.enum(['single', 'married', 'divorced', 'widowed']).optional(),
  occupation: z.string().optional(),
  password: z.string().optional(), // ignored — default used
  institutionId: z.string().uuid().optional(),
});

const loginPatientSchema = z.object({
  nationalId: z.string(),
  password: z.string(),
});

const loginStaffSchema = z.object({
  licenseNumber: z.string(),
  password: z.string(),
});

const authResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    token: z.string(),
    user: z.object({
      id: z.string(),
      type: z.string(),
      blockchainAddress: z.string(),
      firstName: z.string(),
      lastName: z.string(),
      institutionId: z.string().optional(),
      institutionName: z.string().nullable().optional(),
      mustChangePassword: z.boolean().optional(),
    }),
  }),
});

const errorSchema = z.object({
  success: z.boolean(),
  error: z.object({ message: z.string() }),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function createSession(
  userId: string,
  userType: string,
  token: string,
  ip?: string,
  userAgent?: string,
) {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.insert(authSessions).values({
    userId,
    userType: userType as any,
    jwtToken: token,
    refreshToken: crypto.randomBytes(32).toString('hex'),
    expiresAt,
    isActive: true,
    ipAddress: ip,
    userAgent,
  });
}

// ── Router ────────────────────────────────────────────────────────────────────

export const authRouter = createRouter()

  // ── REGISTER PATIENT ─────────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Auth'],
    summary: 'Register a new patient — default password is "test1234", forced to change on first login',
    method: 'post',
    path: '/register/patient',
    request: {
      body: { content: { 'application/json': { schema: registerPatientSchema } } },
    },
    responses: {
      201: {
        content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.object({ patientId: z.string(), blockchainAddress: z.string() }) }) } },
        description: 'Patient registered',
      },
      409: { content: { 'application/json': { schema: errorSchema } }, description: 'National ID already registered' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const body = c.req.valid('json');

      // Duplicate national ID check — decrypt-and-compare since field is encrypted
      const existingPatients = await db
        .select({ id: patients.id, nationalIdEncrypted: patients.nationalIdEncrypted })
        .from(patients);

      for (const p of existingPatients) {
        try {
          if (decrypt(p.nationalIdEncrypted) === body.nationalId) {
            return c.json({ success: false, error: { message: 'National ID already registered' } }, 409);
          }
        } catch { /* skip corrupted rows */ }
      }

      const passwordHash = await hash(DEFAULT_PASSWORD, 12);
      const blockchainAddress = `0x${crypto.randomBytes(20).toString('hex')}`;

      const result = await db.insert(patients).values({
        blockchainAddress,
        firstNameEncrypted: encrypt(body.firstName),
        lastNameEncrypted: encrypt(body.lastName),
        middleNameEncrypted: body.middleName ? encrypt(body.middleName) : null,
        dateOfBirthEncrypted: encrypt(body.dateOfBirth),
        gender: body.gender,
        bloodType: body.bloodType ?? 'unknown',
        phoneNumberEncrypted: encrypt(body.phoneNumber),
        emailEncrypted: body.email ? encrypt(body.email) : null,
        addressEncrypted: encrypt(body.address),
        nationalIdEncrypted: encrypt(body.nationalId),
        emergencyContactEncrypted: encrypt(body.emergencyContact),
        maritalStatus: body.maritalStatus ?? null,
        occupation: body.occupation ?? null,
        passwordHash,
        mustChangePassword: true,
      }).returning({ id: patients.id, blockchainAddress: patients.blockchainAddress });

      const patientId = result[0].id;

      // Link to institution if provided — auto-generate hospital patient number
      if (body.institutionId) {
        try {
          await db.insert(patientInstitutionRegistrations).values({
            patientId,
            institutionId: body.institutionId,
            hospitalPatientNumber: `HPN-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
            isActive: true,
            isHomeInstitution: true,
          });
        } catch (err) {
          console.error('Failed to create institution registration:', err);
        }
      }

      return c.json({ success: true, data: { patientId, blockchainAddress: result[0].blockchainAddress } }, 201);
    } catch (err: unknown) {
      console.error('Patient registration error:', err);
      return c.json({ success: false, error: { message: err instanceof Error ? err.message : 'Internal server error' } }, 500);
    }
  })

  // ── REGISTER STAFF (admin only) ───────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Auth'],
    summary: 'Register a new staff member (admin only)',
    method: 'post',
    path: '/register/staff',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              firstName: z.string().min(2),
              lastName: z.string().min(2),
              role: z.enum(['practitioner', 'nurse', 'receptionist', 'lab_technician', 'radiologist', 'pharmacist', 'admin']),
              licenseNumber: z.string().min(1),
              institutionalId: z.string().optional(),
              institutionId: z.string().uuid(),
              specialization: z.string().optional(),
              department: z.string().optional(),
              phoneNumber: z.string().min(10),
              email: z.string().email(),
              credentials: z.string().optional(),
              qualifications: z.string().optional(),
              password: z.string().min(8).optional(),
            }),
          },
        },
      },
    },
    responses: {
      201: {
        content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.object({ staffId: z.string(), blockchainAddress: z.string(), role: z.string() }) }) } },
        description: 'Staff registered',
      },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Admin only' },
      409: { content: { 'application/json': { schema: errorSchema } }, description: 'License number exists' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      if (userType !== 'admin')
        return c.json({ success: false, error: { message: 'Admin access required' } }, 403);

      const body = c.req.valid('json');

      const existing = await db
        .select({ id: practitioners.id })
        .from(practitioners)
        .where(eq(practitioners.licenseNumber, body.licenseNumber))
        .limit(1);

      if (existing.length)
        return c.json({ success: false, error: { message: 'License number already registered' } }, 409);

      const rawPassword = body.password?.trim() || DEFAULT_PASSWORD;
      const passwordHash = await hash(rawPassword, 12);
      const blockchainAddress = `0x${crypto.randomBytes(20).toString('hex')}`;
      const finalInstitutionalId = body.institutionalId?.trim() || body.licenseNumber;

      const result = await db.insert(practitioners).values({
        blockchainAddress,
        firstNameEncrypted: encrypt(body.firstName),
        lastNameEncrypted: encrypt(body.lastName),
        licenseNumber: body.licenseNumber,
        institutionalId: finalInstitutionalId,
        institutionId: body.institutionId,
        role: body.role as any,
        specialization: body.specialization ?? body.role,
        department: body.department ?? null,
        phoneNumberEncrypted: encrypt(body.phoneNumber),
        emailEncrypted: encrypt(body.email),
        credentialsEncrypted: body.credentials ? encrypt(body.credentials) : null,
        qualifications: body.qualifications ?? null,
        passwordHash,
        mustChangePassword: true,  // staff must change on first login
        isVerified: true,
        isActive: true,
      }).returning({ id: practitioners.id, blockchainAddress: practitioners.blockchainAddress });

      return c.json({ success: true, data: { staffId: result[0].id, blockchainAddress: result[0].blockchainAddress, role: body.role } }, 201);
    } catch (err: unknown) {
      console.error('Staff registration error:', err);
      return c.json({ success: false, error: { message: err instanceof Error ? err.message : 'Internal server error' } }, 500);
    }
  })

  // ── LOGIN PATIENT ─────────────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Auth'],
    summary: 'Patient login using National ID',
    method: 'post',
    path: '/login/patient',
    request: {
      body: { content: { 'application/json': { schema: loginPatientSchema } } },
    },
    responses: {
      200: { content: { 'application/json': { schema: authResponseSchema } }, description: 'Login successful' },
      401: { content: { 'application/json': { schema: errorSchema } }, description: 'Invalid credentials' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const { nationalId, password } = c.req.valid('json');
      const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip');
      const userAgent = c.req.header('user-agent');

      const allPatients = await db.select().from(patients).where(eq(patients.isActive, true));

      let matched: typeof allPatients[0] | null = null;
      for (const p of allPatients) {
        try {
          if (decrypt(p.nationalIdEncrypted) === nationalId) { matched = p; break; }
        } catch { /* skip */ }
      }

      if (!matched)
        return c.json({ success: false, error: { message: 'Invalid credentials' } }, 401);
      if (matched.isDeceased)
        return c.json({ success: false, error: { message: 'Account unavailable' } }, 401);

      const validPassword = await compare(password, matched.passwordHash);
      if (!validPassword)
        return c.json({ success: false, error: { message: 'Invalid credentials' } }, 401);

      const token = sign(
        { userId: matched.id, userType: 'patient', blockchainAddress: matched.blockchainAddress },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN },
      );

      await createSession(matched.id, 'patient', token, ip, userAgent);

      return c.json({
        success: true,
        data: {
          token,
          user: {
            id: matched.id,
            type: 'patient',
            blockchainAddress: matched.blockchainAddress,
            firstName: decrypt(matched.firstNameEncrypted),
            lastName: decrypt(matched.lastNameEncrypted),
            institutionId: undefined,
            institutionName: null,
            mustChangePassword: matched.mustChangePassword ?? false,  // ← required by mobile navigator
          },
        },
      });
    } catch (err: unknown) {
      console.error('Patient login error:', err);
      return c.json({ success: false, error: { message: err instanceof Error ? err.message : 'Internal server error' } }, 500);
    }
  })

  // ── LOGIN STAFF ───────────────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Auth'],
    summary: 'Staff login using license number',
    method: 'post',
    path: '/login/staff',
    request: {
      body: { content: { 'application/json': { schema: loginStaffSchema } } },
    },
    responses: {
      200: { content: { 'application/json': { schema: authResponseSchema } }, description: 'Login successful' },
      401: { content: { 'application/json': { schema: errorSchema } }, description: 'Invalid credentials' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Account not verified' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const { licenseNumber, password } = c.req.valid('json');
      const ip = c.req.header('x-forwarded-for');
      const userAgent = c.req.header('user-agent');

      const result = await db
        .select()
        .from(practitioners)
        .where(and(eq(practitioners.licenseNumber, licenseNumber), eq(practitioners.isActive, true)))
        .limit(1);

      if (!result.length)
        return c.json({ success: false, error: { message: 'Invalid credentials' } }, 401);

      const staff = result[0];

      if (!staff.isVerified)
        return c.json({ success: false, error: { message: 'Account pending verification by administrator' } }, 403);

      const validPassword = await compare(password, staff.passwordHash);
      if (!validPassword)
        return c.json({ success: false, error: { message: 'Invalid credentials' } }, 401);

      let institutionName = null;
      if (staff.institutionId) {
        const inst = await db
          .select({ name: institutions.institutionName })
          .from(institutions)
          .where(eq(institutions.id, staff.institutionId))
          .limit(1);
        if (inst.length) institutionName = inst[0].name;
      }

      const token = sign(
        { userId: staff.id, userType: staff.role, blockchainAddress: staff.blockchainAddress, institutionId: staff.institutionId },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN },
      );

      await createSession(staff.id, staff.role, token, ip, userAgent);

      return c.json({
        success: true,
        data: {
          token,
          user: {
            id: staff.id,
            type: staff.role,
            blockchainAddress: staff.blockchainAddress,
            firstName: decrypt(staff.firstNameEncrypted),
            lastName: decrypt(staff.lastNameEncrypted),
            institutionId: staff.institutionId ?? undefined,
            institutionName,
            mustChangePassword: (staff as any).mustChangePassword ?? false,  // ← required by web portal
          },
        },
      });
    } catch (err: unknown) {
      console.error('Staff login error:', err);
      return c.json({ success: false, error: { message: err instanceof Error ? err.message : 'Internal server error' } }, 500);
    }
  })

  // ── LOGOUT ────────────────────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Auth'],
    summary: 'Logout — invalidates current session',
    method: 'post',
    path: '/logout',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    responses: {
      200: {
        content: { 'application/json': { schema: z.object({ success: z.boolean(), message: z.string() }) } },
        description: 'Logged out',
      },
    },
  }), async (c) => {
    try {
      const sessionId = c.get('sessionId');
      if (sessionId) {
        await db.update(authSessions).set({ isActive: false }).where(eq(authSessions.id, sessionId));
      }
      return c.json({ success: true, message: 'Logged out successfully' });
    } catch {
      return c.json({ success: true, message: 'Logged out' });
    }
  })

  // ── CHECK SESSION ─────────────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Auth'],
    summary: 'Check if current session is valid',
    method: 'get',
    path: '/session/check',
    security: [{ bearerAuth: [] }],
    middleware: [sessionMiddleware],
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              data: z.object({
                isValid: z.boolean(),
                user: z.object({
                  id: z.string(), type: z.string(),
                  firstName: z.string(), lastName: z.string(),
                }),
              }),
            }),
          },
        },
        description: 'Session valid',
      },
      401: { content: { 'application/json': { schema: errorSchema } }, description: 'Invalid' },
    },
  }), async (c) => {
    const userId = c.get('userId');
    const userType = c.get('userType');

    if (userType === 'patient') {
      const patient = await db.select().from(patients).where(eq(patients.id, userId)).limit(1);
      if (patient.length) {
        return c.json({
          success: true,
          data: {
            isValid: true,
            user: {
              id: patient[0].id,
              type: 'patient',
              firstName: decrypt(patient[0].firstNameEncrypted),
              lastName: decrypt(patient[0].lastNameEncrypted),
            },
          },
        });
      }
    } else {
      const staff = await db.select().from(practitioners).where(eq(practitioners.id, userId)).limit(1);
      if (staff.length) {
        return c.json({
          success: true,
          data: {
            isValid: true,
            user: {
              id: staff[0].id,
              type: staff[0].role,
              firstName: decrypt(staff[0].firstNameEncrypted),
              lastName: decrypt(staff[0].lastNameEncrypted),
            },
          },
        });
      }
    }

    return c.json({ success: false, error: { message: 'User not found' } }, 401);
  })

  // ── CHANGE PASSWORD (Patient) ─────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Auth'],
    summary: 'Change password for authenticated patient',
    method: 'post',
    path: '/change-password/patient',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              oldPassword: z.string(),
              newPassword: z.string().min(8),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        content: { 'application/json': { schema: z.object({ success: z.boolean(), message: z.string() }) } },
        description: 'Password changed',
      },
      401: { content: { 'application/json': { schema: errorSchema } }, description: 'Unauthorized' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      const userId = c.get('userId');

      if (userType !== 'patient')
        return c.json({ success: false, error: { message: 'Only patients can use this endpoint' } }, 403);

      const { oldPassword, newPassword } = c.req.valid('json');

      const patientRows = await db.select().from(patients).where(eq(patients.id, userId)).limit(1);
      if (!patientRows.length)
        return c.json({ success: false, error: { message: 'Patient not found' } }, 404);

      const patient = patientRows[0];

      const isOldValid = await compare(oldPassword, patient.passwordHash);
      if (!isOldValid)
        return c.json({ success: false, error: { message: 'Incorrect current password' } }, 401);

      if (newPassword === oldPassword)
        return c.json({ success: false, error: { message: 'New password must differ from current password' } }, 400);

      const newHash = await hash(newPassword, 12);

      await db.update(patients)
        .set({ passwordHash: newHash, mustChangePassword: false, updatedAt: new Date() })
        .where(eq(patients.id, userId));

      // Invalidate all sessions — forces re-login with new password
      await db.update(authSessions).set({ isActive: false }).where(eq(authSessions.userId, userId));

      return c.json({ success: true, message: 'Password changed successfully. Please log in again with your new password.' });
    } catch (err: any) {
      console.error('Change password error:', err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ── CHANGE PASSWORD (Staff) ───────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Auth'],
    summary: 'Change password for authenticated staff member',
    method: 'post',
    path: '/change-password/staff',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              oldPassword: z.string(),
              newPassword: z.string().min(8),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        content: { 'application/json': { schema: z.object({ success: z.boolean(), message: z.string() }) } },
        description: 'Password changed',
      },
      401: { content: { 'application/json': { schema: errorSchema } }, description: 'Unauthorized' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      const userId = c.get('userId');

      const staffRoles = ['practitioner', 'nurse', 'receptionist', 'lab_technician', 'radiologist', 'pharmacist', 'admin'];
      if (!staffRoles.includes(userType))
        return c.json({ success: false, error: { message: 'Staff accounts only' } }, 403);

      const { oldPassword, newPassword } = c.req.valid('json');

      const staffRows = await db.select().from(practitioners).where(eq(practitioners.id, userId)).limit(1);
      if (!staffRows.length)
        return c.json({ success: false, error: { message: 'Account not found' } }, 404);

      const staff = staffRows[0];

      const isOldValid = await compare(oldPassword, staff.passwordHash);
      if (!isOldValid)
        return c.json({ success: false, error: { message: 'Incorrect current password' } }, 401);

      if (newPassword === oldPassword)
        return c.json({ success: false, error: { message: 'New password must differ from current password' } }, 400);

      const newHash = await hash(newPassword, 12);

      await db.update(practitioners)
        .set({ passwordHash: newHash, mustChangePassword: false, updatedAt: new Date() } as any)
        .where(eq(practitioners.id, userId));

      // Invalidate all sessions — forces re-login with new password
      await db.update(authSessions).set({ isActive: false }).where(eq(authSessions.userId, userId));

      return c.json({ success: true, message: 'Password changed successfully. Please log in again with your new password.' });
    } catch (err: any) {
      console.error('[CHANGE_PASSWORD_STAFF]', err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  });