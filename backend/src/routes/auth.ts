import { handleError } from '../lib/errors';
// src/routes/auth.ts
// Full auth router with 2FA OTP support
// New endpoints:
//   POST /auth/login/staff   → returns { requiresOTP: true, userId } instead of token
//   POST /auth/verify-otp    → accepts OTP, returns full token
//   POST /auth/login/email   → login with email + password (staff only)

import { createRoute, z } from '@hono/zod-openapi';
import { sign } from 'jsonwebtoken';
import { hash, compare } from 'bcryptjs';
import { eq, and, gte } from 'drizzle-orm';
import { db } from '../db';
import {
  patients, practitioners, authSessions, institutions,
  patientInstitutionRegistrations, otpCodes,
} from '../db/schema';
import { encrypt, decrypt } from '../services/crypto';
import { sendOTPEmail } from '../services/email';
import { createRouter } from '../lib/create-app';
import { authMiddleware } from '../middleware/auth';
import {
  loginLimiter, otpLimiter, resendOtpLimiter,
  registerLimiter, passwordLimiter,
} from '../middleware/rateLimit';
import { sessionMiddleware } from '../middleware/session';
import crypto from 'crypto';

const JWT_SECRET = (process.env.JWT_SECRET || 'healthcare_jwt_secret') as string;
const JWT_EXPIRES_IN = '24h';
const DEFAULT_PASSWORD = 'test1234';

// ── Schemas ───────────────────────────────────────────────────────────────────
const errorSchema = z.object({ success: z.boolean(), error: z.object({ message: z.string() }) });
const successSchema = z.object({ success: z.boolean(), data: z.any() });

const registerPatientSchema = z.object({
  firstName: z.string().min(2), lastName: z.string().min(2),
  middleName: z.string().optional(), dateOfBirth: z.string(),
  gender: z.enum(['male', 'female', 'other']),
  bloodType: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown']).optional(),
  phoneNumber: z.string(), email: z.string().email().optional(),
  address: z.string(), nationalId: z.string(), emergencyContact: z.string(),
  maritalStatus: z.enum(['single', 'married', 'divorced', 'widowed']).optional(),
  occupation: z.string().optional(), password: z.string().optional(),
  institutionId: z.string().uuid().optional(),
});

// identifier = NRC (adults) or HC-MINOR-* temporary clinic ID (minors)
const loginPatientSchema = z.object({ identifier: z.string().min(1), password: z.string() });

// Staff can login with licenseNumber OR email
const loginStaffSchema = z.object({
  licenseNumber: z.string().optional(),
  email: z.string().email().optional(),
  password: z.string(),
}).refine(d => d.licenseNumber || d.email, { message: 'Provide licenseNumber or email' });

const verifyOtpSchema = z.object({
  userId: z.string().uuid(),
  userType: z.enum(['staff', 'patient']),
  otp: z.string().length(6),
});

// ── Helpers ───────────────────────────────────────────────────────────────────
async function createSession(userId: string, userType: string, token: string, ip?: string, userAgent?: string) {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.insert(authSessions).values({
    userId, userType: userType as any, jwtToken: token,
    refreshToken: crypto.randomBytes(32).toString('hex'),
    expiresAt, isActive: true, ipAddress: ip, userAgent,
  });
}

function generateOTP(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function createAndSendOTP(userId: string, userType: 'staff' | 'patient', emailPlain: string, name: string): Promise<void> {
  // Invalidate any existing unused OTPs for this user
  await db.update(otpCodes)
    .set({ used: true })
    .where(and(eq(otpCodes.userId, userId), eq(otpCodes.used, false)));

  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  await db.insert(otpCodes).values({ userId, userType, code: otp, expiresAt, used: false });
  await sendOTPEmail(emailPlain, name, otp);
}

// ── Router ────────────────────────────────────────────────────────────────────
export const authRouter = createRouter()

  // ── REGISTER PATIENT ─────────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Auth'], summary: 'Register a new patient',
    method: 'post', path: '/register/patient',
    middleware: [registerLimiter],
    request: { body: { content: { 'application/json': { schema: registerPatientSchema } } } },
    responses: {
      201: { content: { 'application/json': { schema: successSchema } }, description: 'Registered' },
      409: { content: { 'application/json': { schema: errorSchema } }, description: 'Duplicate' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Error' },
    },
  }), async (c) => {
    try {
      const body = c.req.valid('json');
      const allPatients = await db.select({ id: patients.id, nationalIdEncrypted: patients.nationalIdEncrypted }).from(patients);
      for (const p of allPatients) {
        try { if (decrypt(p.nationalIdEncrypted) === body.nationalId) return c.json({ success: false, error: { message: 'National ID already registered' } }, 409); } catch { }
      }
      const passwordHash = await hash(DEFAULT_PASSWORD, 12);
      const blockchainAddress = `0x${crypto.randomBytes(20).toString('hex')}`;
      const result = await db.insert(patients).values({
        blockchainAddress,
        firstNameEncrypted: encrypt(body.firstName), lastNameEncrypted: encrypt(body.lastName),
        middleNameEncrypted: body.middleName ? encrypt(body.middleName) : null,
        dateOfBirthEncrypted: encrypt(body.dateOfBirth), gender: body.gender,
        bloodType: body.bloodType ?? 'unknown',
        phoneNumberEncrypted: encrypt(body.phoneNumber),
        emailEncrypted: body.email ? encrypt(body.email) : null,
        addressEncrypted: encrypt(body.address), nationalIdEncrypted: encrypt(body.nationalId),
        emergencyContactEncrypted: encrypt(body.emergencyContact),
        maritalStatus: body.maritalStatus ?? null, occupation: body.occupation ?? null,
        passwordHash, mustChangePassword: true,
      }).returning({ id: patients.id, blockchainAddress: patients.blockchainAddress });

      const patientId = result[0].id;
      if (body.institutionId) {
        try {
          await db.insert(patientInstitutionRegistrations).values({
            patientId, institutionId: body.institutionId,
            hospitalPatientNumber: `HPN-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
            isActive: true, isHomeInstitution: true,
          });
        } catch (err) { console.error('Institution registration failed:', err); }
      }
      return c.json({ success: true, data: { patientId, blockchainAddress: result[0].blockchainAddress } }, 201);
    } catch (err: any) {
      return handleError(err, c);
    }
  })

  // ── REGISTER STAFF ────────────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Auth'], summary: 'Register a new staff member (admin only)',
    method: 'post', path: '/register/staff',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware, registerLimiter],
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              firstName: z.string().min(2), lastName: z.string().min(2),
              role: z.enum(['practitioner', 'nurse', 'receptionist', 'lab_technician', 'radiologist', 'pharmacist', 'admin']),
              licenseNumber: z.string().min(1), institutionalId: z.string().optional(),
              institutionId: z.string().uuid(), specialization: z.string().optional(),
              department: z.string().optional(), phoneNumber: z.string().min(10),
              email: z.string().email(), credentials: z.string().optional(),
              qualifications: z.string().optional(), password: z.string().min(8).optional(),
            }),
          },
        },
      },
    },
    responses: {
      201: { content: { 'application/json': { schema: successSchema } }, description: 'Registered' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      409: { content: { 'application/json': { schema: errorSchema } }, description: 'Duplicate' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Error' },
    },
  }), async (c) => {
    try {
      if (c.get('userType') !== 'admin') return c.json({ success: false, error: { message: 'Admin access required' } }, 403);
      const body = c.req.valid('json');
      const existing = await db.select({ id: practitioners.id }).from(practitioners).where(eq(practitioners.licenseNumber, body.licenseNumber)).limit(1);
      if (existing.length) return c.json({ success: false, error: { message: 'License number already registered' } }, 409);
      const rawPassword = body.password?.trim() || DEFAULT_PASSWORD;
      const passwordHash = await hash(rawPassword, 12);
      const blockchainAddress = `0x${crypto.randomBytes(20).toString('hex')}`;
      const result = await db.insert(practitioners).values({
        blockchainAddress, firstNameEncrypted: encrypt(body.firstName), lastNameEncrypted: encrypt(body.lastName),
        licenseNumber: body.licenseNumber, institutionalId: body.institutionalId?.trim() || body.licenseNumber,
        institutionId: body.institutionId, role: body.role as any,
        specialization: body.specialization ?? body.role, department: body.department ?? null,
        phoneNumberEncrypted: encrypt(body.phoneNumber), emailEncrypted: encrypt(body.email),
        credentialsEncrypted: body.credentials ? encrypt(body.credentials) : null,
        qualifications: body.qualifications ?? null, passwordHash,
        mustChangePassword: true, isVerified: true, isActive: true,
      }).returning({ id: practitioners.id, blockchainAddress: practitioners.blockchainAddress });
      return c.json({ success: true, data: { staffId: result[0].id, blockchainAddress: result[0].blockchainAddress, role: body.role } }, 201);
    } catch (err: any) {
      return handleError(err, c);
    }
  })

  // ── LOGIN PATIENT (no 2FA — patients use mobile app) ─────────────────────
  .openapi(createRoute({
    tags: ['Auth'], summary: 'Patient login — no 2FA',
    method: 'post', path: '/login/patient',
    middleware: [loginLimiter],
    request: { body: { content: { 'application/json': { schema: loginPatientSchema } } } },
    responses: {
      200: { content: { 'application/json': { schema: successSchema } }, description: 'OK' },
      401: { content: { 'application/json': { schema: errorSchema } }, description: 'Invalid' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Error' },
    },
  }), async (c) => {
    try {
      const { identifier, password } = c.req.valid('json');
      const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip');
      const userAgent = c.req.header('user-agent');

      const allPatients = await db.select().from(patients).where(eq(patients.isActive, true));
      let matched: typeof allPatients[0] | null = null;

      const isClinicId = identifier.startsWith('HC-MINOR-');

      if (isClinicId) {
        matched = allPatients.find(p => p.temporaryPatientId === identifier) ?? null;
      } else {
        for (const p of allPatients) {
          try { if (p.nationalIdEncrypted && decrypt(p.nationalIdEncrypted) === identifier) { matched = p; break; } } catch { }
        }
      }

      if (!matched) return c.json({ success: false, error: { message: 'Invalid credentials' } }, 401);
      if (matched.isDeceased) return c.json({ success: false, error: { message: 'Account unavailable' } }, 401);

      let passwordOk: boolean;
      try {
        passwordOk = await compare(password, matched.passwordHash);
      } catch (e: any) {
        console.error('[LOGIN_PATIENT] bcrypt.compare failed:', e.message, 'hash:', matched.passwordHash?.slice(0, 10));
        throw e;
      }
      if (!passwordOk) return c.json({ success: false, error: { message: 'Invalid credentials' } }, 401);

      const token = sign({ userId: matched.id, userType: 'patient', blockchainAddress: matched.blockchainAddress }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

      try {
        await createSession(matched.id, 'patient', token, ip, userAgent);
      } catch (e: any) {
        console.error('[LOGIN_PATIENT] createSession failed:', e.message);
        throw e;
      }

      let firstName: string, lastName: string;
      try {
        firstName = decrypt(matched.firstNameEncrypted);
        lastName = decrypt(matched.lastNameEncrypted);
      } catch (e: any) {
        console.error('[LOGIN_PATIENT] decrypt name failed:', e.message);
        throw e;
      }

      return c.json({ success: true, data: { token, user: {
        id: matched.id,
        type: 'patient',
        blockchainAddress: matched.blockchainAddress,
        firstName,
        lastName,
        isMinor: matched.isMinor,
        temporaryPatientId: matched.temporaryPatientId ?? undefined,
        institutionId: undefined,
        institutionName: null,
        mustChangePassword: matched.mustChangePassword ?? false,
      } } });
    } catch (err: any) {
      console.error('[LOGIN_PATIENT] unhandled error:', err?.message ?? err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ── LOGIN STAFF (with 2FA) ────────────────────────────────────────────────
  // Accepts licenseNumber OR email + password
  // Returns { requiresOTP: true, userId } — NOT a token yet
  .openapi(createRoute({
    tags: ['Auth'], summary: 'Staff login — triggers OTP email (2FA)',
    method: 'post', path: '/login/staff',
    middleware: [loginLimiter],
    request: { body: { content: { 'application/json': { schema: loginStaffSchema } } } },
    responses: {
      200: { content: { 'application/json': { schema: successSchema } }, description: 'OTP sent' },
      401: { content: { 'application/json': { schema: errorSchema } }, description: 'Invalid credentials' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Not verified' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Error' },
    },
  }), async (c) => {
    try {
      const { licenseNumber, email, password } = c.req.valid('json');

      let staff: any = null;

      if (licenseNumber) {
        // Login by license number
        const rows = await db.select().from(practitioners)
          .where(and(eq(practitioners.licenseNumber, licenseNumber), eq(practitioners.isActive, true)))
          .limit(1);
        staff = rows[0] ?? null;
      } else if (email) {
        // Login by email — decrypt and compare
        const allStaff = await db.select().from(practitioners).where(eq(practitioners.isActive, true));
        for (const s of allStaff) {
          try {
            if (decrypt(s.emailEncrypted) === email) { staff = s; break; }
          } catch { }
        }
      }

      if (!staff) return c.json({ success: false, error: { message: 'Invalid credentials' } }, 401);
      if (!staff.isVerified) return c.json({ success: false, error: { message: 'Account pending verification by administrator' } }, 403);
      if (!await compare(password, staff.passwordHash)) return c.json({ success: false, error: { message: 'Invalid credentials' } }, 401);

      // Credentials valid — generate and send OTP
      let emailPlain = '';
      try { emailPlain = decrypt(staff.emailEncrypted); } catch { }

      if (!emailPlain) {
        // No email on record — skip OTP and return token directly
        console.warn(`[2FA] Staff ${staff.id} has no email — skipping OTP`);
        return await issueToken(c, staff);
      }

      const firstName = (() => { try { return decrypt(staff.firstNameEncrypted); } catch { return 'Staff'; } })();

      await createAndSendOTP(staff.id, 'staff', emailPlain, firstName);

      // Mask the email for the response
      const [local, domain] = emailPlain.split('@');
      const maskedEmail = `${local.slice(0, 2)}***@${domain}`;

      return c.json({
        success: true,
        data: {
          requiresOTP: true,
          userId: staff.id,
          userType: 'staff',
          maskedEmail,
          message: `A 6-digit code has been sent to ${maskedEmail}`,
        },
      });
    } catch (err: any) {
      console.error('[LOGIN_STAFF]', err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ── VERIFY OTP ────────────────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Auth'], summary: 'Verify OTP and receive JWT token',
    method: 'post', path: '/verify-otp',
    middleware: [otpLimiter],
    request: { body: { content: { 'application/json': { schema: verifyOtpSchema } } } },
    responses: {
      200: { content: { 'application/json': { schema: successSchema } }, description: 'Token issued' },
      400: { content: { 'application/json': { schema: errorSchema } }, description: 'Invalid/expired OTP' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Error' },
    },
  }), async (c) => {
    try {
      const { userId, userType, otp } = c.req.valid('json');
      const ip = c.req.header('x-forwarded-for');
      const userAgent = c.req.header('user-agent');
      const now = new Date();

      // Find valid OTP
      const rows = await db.select().from(otpCodes)
        .where(and(
          eq(otpCodes.userId, userId),
          eq(otpCodes.userType, userType),
          eq(otpCodes.code, otp),
          eq(otpCodes.used, false),
          gte(otpCodes.expiresAt, now),
        ))
        .limit(1);

      if (!rows.length) {
        return c.json({ success: false, error: { message: 'Invalid or expired verification code. Please try again.' } }, 400);
      }

      // Mark OTP as used
      await db.update(otpCodes).set({ used: true }).where(eq(otpCodes.id, rows[0].id));

      if (userType === 'staff') {
        const staffRows = await db.select().from(practitioners).where(eq(practitioners.id, userId)).limit(1);
        if (!staffRows.length) return c.json({ success: false, error: { message: 'Account not found' } }, 400);
        return await issueToken(c, staffRows[0], ip, userAgent);
      }

      return c.json({ success: false, error: { message: 'Patient OTP not supported here' } }, 400);
    } catch (err: any) {
      console.error('[VERIFY_OTP]', err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ── RESEND OTP ────────────────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Auth'], summary: 'Resend OTP code',
    method: 'post', path: '/resend-otp',
    middleware: [resendOtpLimiter],
    request: { body: { content: { 'application/json': { schema: z.object({ userId: z.string().uuid(), userType: z.enum(['staff', 'patient']) }) } } } },
    responses: {
      200: { content: { 'application/json': { schema: successSchema } }, description: 'Resent' },
      400: { content: { 'application/json': { schema: errorSchema } }, description: 'Error' },
    },
  }), async (c) => {
    try {
      const { userId, userType } = c.req.valid('json');
      if (userType !== 'staff') return c.json({ success: false, error: { message: 'Not supported' } }, 400);

      const staffRows = await db.select().from(practitioners).where(eq(practitioners.id, userId)).limit(1);
      if (!staffRows.length) return c.json({ success: false, error: { message: 'Account not found' } }, 400);

      const staff = staffRows[0];
      let emailPlain = '';
      try { emailPlain = decrypt(staff.emailEncrypted); } catch { }
      if (!emailPlain) return c.json({ success: false, error: { message: 'No email on record' } }, 400);

      const firstName = (() => { try { return decrypt(staff.firstNameEncrypted); } catch { return 'Staff'; } })();
      await createAndSendOTP(staff.id, 'staff', emailPlain, firstName);

      const [local, domain] = emailPlain.split('@');
      return c.json({ success: true, data: { message: `Code resent to ${local.slice(0, 2)}***@${domain}` } });
    } catch (err: any) {
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ── LOGOUT ────────────────────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Auth'], summary: 'Logout',
    method: 'post', path: '/logout',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware],
    responses: { 200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), message: z.string() }) } }, description: 'OK' } },
  }), async (c) => {
    try {
      const sessionId = c.get('sessionId');
      if (sessionId) await db.update(authSessions).set({ isActive: false }).where(eq(authSessions.id, sessionId));
      return c.json({ success: true, message: 'Logged out successfully' });
    } catch {
      return c.json({ success: true, message: 'Logged out' });
    }
  })

  // ── CHECK SESSION ─────────────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Auth'], summary: 'Check session validity',
    method: 'get', path: '/session/check',
    security: [{ bearerAuth: [] }], middleware: [sessionMiddleware],
    responses: { 200: { content: { 'application/json': { schema: successSchema } }, description: 'Valid' }, 401: { content: { 'application/json': { schema: errorSchema } }, description: 'Invalid' } },
  }), async (c) => {
    const userId = c.get('userId');
    const userType = c.get('userType');
    if (userType === 'patient') {
      const p = (await db.select().from(patients).where(eq(patients.id, userId)).limit(1))[0];
      if (p) return c.json({ success: true, data: { isValid: true, user: { id: p.id, type: 'patient', firstName: decrypt(p.firstNameEncrypted), lastName: decrypt(p.lastNameEncrypted) } } });
    } else {
      const s = (await db.select().from(practitioners).where(eq(practitioners.id, userId)).limit(1))[0];
      if (s) return c.json({ success: true, data: { isValid: true, user: { id: s.id, type: s.role, firstName: decrypt(s.firstNameEncrypted), lastName: decrypt(s.lastNameEncrypted) } } });
    }
    return c.json({ success: false, error: { message: 'User not found' } }, 401);
  })

  // ── CHANGE PASSWORD (Patient) ─────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Auth'], summary: 'Change patient password',
    method: 'post', path: '/change-password/patient',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware, passwordLimiter],
    request: { body: { content: { 'application/json': { schema: z.object({ oldPassword: z.string(), newPassword: z.string().min(8) }) } } } },
    responses: { 200: { content: { 'application/json': { schema: successSchema } }, description: 'Changed' }, 401: { content: { 'application/json': { schema: errorSchema } }, description: 'Wrong password' } },
  }), async (c) => {
    try {
      if (c.get('userType') !== 'patient') return c.json({ success: false, error: { message: 'Patients only' } }, 403);
      const { oldPassword, newPassword } = c.req.valid('json');
      const userId = c.get('userId');
      const p = (await db.select().from(patients).where(eq(patients.id, userId)).limit(1))[0];
      if (!p) return c.json({ success: false, error: { message: 'Not found' } }, 404);
      if (!await compare(oldPassword, p.passwordHash)) return c.json({ success: false, error: { message: 'Incorrect current password' } }, 401);
      if (newPassword === oldPassword) return c.json({ success: false, error: { message: 'New password must differ' } }, 400);
      await db.update(patients).set({ passwordHash: await hash(newPassword, 12), mustChangePassword: false, updatedAt: new Date() }).where(eq(patients.id, userId));
      await db.update(authSessions).set({ isActive: false }).where(eq(authSessions.userId, userId));
      return c.json({ success: true, message: 'Password changed. Please log in again.' });
    } catch (err: any) {
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  })

  // ── CHANGE PASSWORD (Staff) ───────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Auth'], summary: 'Change staff password',
    method: 'post', path: '/change-password/staff',
    security: [{ bearerAuth: [] }], middleware: [authMiddleware, passwordLimiter],
    request: { body: { content: { 'application/json': { schema: z.object({ oldPassword: z.string(), newPassword: z.string().min(8) }) } } } },
    responses: { 200: { content: { 'application/json': { schema: successSchema } }, description: 'Changed' }, 401: { content: { 'application/json': { schema: errorSchema } }, description: 'Wrong password' } },
  }), async (c) => {
    try {
      const staffRoles = ['practitioner', 'nurse', 'receptionist', 'lab_technician', 'radiologist', 'pharmacist', 'admin'];
      if (!staffRoles.includes(c.get('userType'))) return c.json({ success: false, error: { message: 'Staff only' } }, 403);
      const { oldPassword, newPassword } = c.req.valid('json');
      const userId = c.get('userId');
      const s = (await db.select().from(practitioners).where(eq(practitioners.id, userId)).limit(1))[0];
      if (!s) return c.json({ success: false, error: { message: 'Not found' } }, 404);
      if (!await compare(oldPassword, s.passwordHash)) return c.json({ success: false, error: { message: 'Incorrect current password' } }, 401);
      if (newPassword === oldPassword) return c.json({ success: false, error: { message: 'New password must differ' } }, 400);
      await db.update(practitioners).set({ passwordHash: await hash(newPassword, 12), mustChangePassword: false, updatedAt: new Date() } as any).where(eq(practitioners.id, userId));
      await db.update(authSessions).set({ isActive: false }).where(eq(authSessions.userId, userId));
      return c.json({ success: true, message: 'Password changed. Please log in again.' });
    } catch (err: any) {
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  });

// ── Helper: issue token after successful auth ─────────────────────────────────
async function issueToken(c: any, staff: any, ip?: string, userAgent?: string) {
  let institutionName = null;
  if (staff.institutionId) {
    const inst = await db.select({ name: institutions.institutionName }).from(institutions).where(eq(institutions.id, staff.institutionId)).limit(1);
    if (inst.length) institutionName = inst[0].name;
  }
  const token = sign(
    { userId: staff.id, userType: staff.role, blockchainAddress: staff.blockchainAddress, institutionId: staff.institutionId },
    JWT_SECRET, { expiresIn: JWT_EXPIRES_IN },
  );
  await createSession(staff.id, staff.role, token, ip, userAgent);
  return c.json({
    success: true,
    data: {
      token,
      user: {
        id: staff.id, type: staff.role,
        blockchainAddress: staff.blockchainAddress,
        firstName: (() => { try { return decrypt(staff.firstNameEncrypted); } catch { return ''; } })(),
        lastName: (() => { try { return decrypt(staff.lastNameEncrypted); } catch { return ''; } })(),
        institutionId: staff.institutionId ?? undefined,
        institutionName,
        mustChangePassword: staff.mustChangePassword ?? false,
      },
    },
  });
}