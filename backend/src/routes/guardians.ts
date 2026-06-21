import { createRoute, z } from '@hono/zod-openapi';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import { patients, patientGuardians, practitioners } from '../db/schema';
import { createRouter } from '../lib/create-app';
import { authMiddleware } from '../middleware/auth';
import { decrypt } from '../services/crypto';
import { notifyUser } from '../services/notifications';

const err = z.object({ success: z.literal(false), error: z.object({ message: z.string() }) });
const ok  = z.object({ success: z.literal(true),  data: z.any() });

const VALID_RELATIONSHIPS = ['mother', 'father', 'legal_guardian', 'grandparent', 'other'] as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

function ageFromDob(dobEncrypted: string): number {
  try {
    const dob = new Date(decrypt(dobEncrypted));
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const m = now.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
    return age;
  } catch { return -1; }
}

// Returns the Date that is the minor's 16th birthday
function sixteenthBirthday(dobEncrypted: string): Date | null {
  try {
    const dob = new Date(decrypt(dobEncrypted));
    return new Date(dob.getFullYear() + 16, dob.getMonth(), dob.getDate());
  } catch { return null; }
}

async function decryptedGuardianRow(g: typeof patientGuardians.$inferSelect) {
  const guardian = await db.select().from(patients).where(eq(patients.id, g.guardianPatientId)).limit(1);
  const gp = guardian[0];
  return {
    id:                g.id,
    patientId:         g.patientId,
    guardianPatientId: g.guardianPatientId,
    relationship:      g.relationship,
    isPrimary:         g.isPrimary,
    canConsent:        g.canConsent,
    startsAt:          g.startsAt,
    endsAt:            g.endsAt,
    documentReference: g.documentReference,
    verifiedByStaffId: g.verifiedByStaffId,
    createdAt:         g.createdAt,
    guardianName:      gp ? `${decrypt(gp.firstNameEncrypted)} ${decrypt(gp.lastNameEncrypted)}` : null,
    guardianPhone:     gp ? decrypt(gp.phoneNumberEncrypted) : null,
  };
}

// ── Router ────────────────────────────────────────────────────────────────────

export const guardiansRouter = createRouter()

  // POST / — create guardian link
  .openapi(createRoute({
    tags: ['Guardians'], summary: 'Link a guardian (adult patient) to a minor patient',
    method: 'post', path: '/',
    middleware: [authMiddleware], security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              patientId:         z.string().uuid(),
              guardianPatientId: z.string().uuid(),
              relationship:      z.enum(VALID_RELATIONSHIPS),
              isPrimary:         z.boolean().default(false),
              canConsent:        z.boolean().default(true),
              documentReference: z.string().optional(),
            }),
          },
        },
      },
    },
    responses: {
      201: { content: { 'application/json': { schema: ok  } }, description: 'Created' },
      400: { content: { 'application/json': { schema: err } }, description: 'Validation error' },
      403: { content: { 'application/json': { schema: err } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: err } }, description: 'Not found' },
      409: { content: { 'application/json': { schema: err } }, description: 'Already linked' },
    },
  }), async (c) => {
    const userType  = c.get('userType');
    const staffId   = c.get('userId');
    if (!['receptionist', 'admin', 'nurse'].includes(userType))
      return c.json({ success: false, error: { message: 'Staff only' } }, 403);

    const body = c.req.valid('json');

    // Load both patients
    const [minorRows, guardianRows] = await Promise.all([
      db.select().from(patients).where(eq(patients.id, body.patientId)).limit(1),
      db.select().from(patients).where(eq(patients.id, body.guardianPatientId)).limit(1),
    ]);
    if (!minorRows.length)    return c.json({ success: false, error: { message: 'Minor patient not found' } }, 404);
    if (!guardianRows.length) return c.json({ success: false, error: { message: 'Guardian patient not found' } }, 404);

    const minor   = minorRows[0];
    const guardian = guardianRows[0];

    // Age validations
    const minorAge    = ageFromDob(minor.dateOfBirthEncrypted);
    const guardianAge = ageFromDob(guardian.dateOfBirthEncrypted);
    if (minorAge >= 16)    return c.json({ success: false, error: { message: `Patient is ${minorAge} years old — must be under 16 to have a guardian` } }, 400);
    if (guardianAge < 18)  return c.json({ success: false, error: { message: `Guardian is ${guardianAge} years old — must be at least 18` } }, 400);
    if (!minor.isMinor)    return c.json({ success: false, error: { message: 'Patient is not flagged as a minor — update isMinor first' } }, 400);

    // Duplicate link check
    const existing = await db.select({ id: patientGuardians.id })
      .from(patientGuardians)
      .where(and(
        eq(patientGuardians.patientId, body.patientId),
        eq(patientGuardians.guardianPatientId, body.guardianPatientId),
      )).limit(1);
    if (existing.length) return c.json({ success: false, error: { message: 'Guardian link already exists' } }, 409);

    // If isPrimary requested, clear existing primary first
    if (body.isPrimary) {
      await db.update(patientGuardians)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(and(eq(patientGuardians.patientId, body.patientId), eq(patientGuardians.isPrimary, true)));
    }

    const endsAt = sixteenthBirthday(minor.dateOfBirthEncrypted);

    const [link] = await db.insert(patientGuardians).values({
      patientId:         body.patientId,
      guardianPatientId: body.guardianPatientId,
      relationship:      body.relationship,
      isPrimary:         body.isPrimary,
      canConsent:        body.canConsent,
      endsAt,
      documentReference: body.documentReference ?? null,
      verifiedByStaffId: staffId,
    }).returning();

    // Notify guardian their account is now linked to a minor
    try {
      const minorName = `${decrypt(minor.firstNameEncrypted)} ${decrypt(minor.lastNameEncrypted)}`;
      await notifyUser(body.guardianPatientId, 'guardian_linked', {
        message: `You have been linked as guardian (${body.relationship}) for ${minorName}`,
        minorPatientId: body.patientId,
        minorName,
      });
    } catch { /* non-blocking */ }

    return c.json({ success: true, data: await decryptedGuardianRow(link) }, 201);
  })

  // GET /patient/:patientId — list all guardians for a minor
  .openapi(createRoute({
    tags: ['Guardians'], summary: 'List guardians for a patient',
    method: 'get', path: '/patient/:patientId',
    middleware: [authMiddleware], security: [{ bearerAuth: [] }],
    request: { params: z.object({ patientId: z.string().uuid() }) },
    responses: {
      200: { content: { 'application/json': { schema: ok  } }, description: 'OK' },
      403: { content: { 'application/json': { schema: err } }, description: 'Forbidden' },
    },
  }), async (c) => {
    const userType  = c.get('userType');
    const userId    = c.get('userId');
    const { patientId } = c.req.valid('param');

    const allowed = ['receptionist', 'admin', 'nurse', 'practitioner', 'lab_technician', 'radiologist'].includes(userType)
      || (userType === 'patient' && userId === patientId);
    if (!allowed) return c.json({ success: false, error: { message: 'Access denied' } }, 403);

    const rows = await db.select().from(patientGuardians)
      .where(eq(patientGuardians.patientId, patientId))
      .orderBy(desc(patientGuardians.isPrimary), patientGuardians.createdAt);

    const active = rows.filter(r => !r.endsAt || r.endsAt > new Date());
    const data = await Promise.all(active.map(decryptedGuardianRow));
    return c.json({ success: true, data });
  })

  // GET /guardian/:guardianPatientId/dependents — list minors for a guardian (mobile family switcher)
  .openapi(createRoute({
    tags: ['Guardians'], summary: 'List dependents (minors) for a guardian — used by mobile switcher',
    method: 'get', path: '/guardian/:guardianPatientId/dependents',
    middleware: [authMiddleware], security: [{ bearerAuth: [] }],
    request: { params: z.object({ guardianPatientId: z.string().uuid() }) },
    responses: {
      200: { content: { 'application/json': { schema: ok  } }, description: 'OK' },
      403: { content: { 'application/json': { schema: err } }, description: 'Forbidden' },
    },
  }), async (c) => {
    const userType = c.get('userType');
    const userId   = c.get('userId');
    const { guardianPatientId } = c.req.valid('param');

    // Patient can only fetch their own dependents; staff can fetch any
    if (userType === 'patient' && userId !== guardianPatientId)
      return c.json({ success: false, error: { message: 'Access denied' } }, 403);

    const links = await db.select().from(patientGuardians)
      .where(and(
        eq(patientGuardians.guardianPatientId, guardianPatientId),
        eq(patientGuardians.canConsent, true),
      ));

    const now = new Date();
    const activeLinks = links.filter(l => !l.endsAt || l.endsAt > now);

    const dependents = await Promise.all(activeLinks.map(async (link) => {
      const [minor] = await db.select().from(patients).where(eq(patients.id, link.patientId)).limit(1);
      if (!minor) return null;
      const age = ageFromDob(minor.dateOfBirthEncrypted);
      return {
        linkId:            link.id,
        patientId:         minor.id,
        firstName:         decrypt(minor.firstNameEncrypted),
        lastName:          decrypt(minor.lastNameEncrypted),
        temporaryPatientId: minor.temporaryPatientId,
        age,
        relationship:      link.relationship,
        isPrimary:         link.isPrimary,
        canConsent:        link.canConsent,
      };
    }));

    return c.json({ success: true, data: dependents.filter(Boolean) });
  })

  // PATCH /:linkId — update relationship / isPrimary / documentReference
  .openapi(createRoute({
    tags: ['Guardians'], summary: 'Update a guardian link',
    method: 'patch', path: '/:linkId',
    middleware: [authMiddleware], security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ linkId: z.string().uuid() }),
      body: {
        content: {
          'application/json': {
            schema: z.object({
              relationship:      z.enum(VALID_RELATIONSHIPS).optional(),
              isPrimary:         z.boolean().optional(),
              canConsent:        z.boolean().optional(),
              documentReference: z.string().optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: { content: { 'application/json': { schema: ok  } }, description: 'Updated' },
      400: { content: { 'application/json': { schema: err } }, description: 'Validation error' },
      403: { content: { 'application/json': { schema: err } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: err } }, description: 'Not found' },
    },
  }), async (c) => {
    const userType = c.get('userType');
    if (!['receptionist', 'admin', 'nurse'].includes(userType))
      return c.json({ success: false, error: { message: 'Staff only' } }, 403);

    const { linkId } = c.req.valid('param');
    const body = c.req.valid('json');

    const [link] = await db.select().from(patientGuardians).where(eq(patientGuardians.id, linkId)).limit(1);
    if (!link) return c.json({ success: false, error: { message: 'Guardian link not found' } }, 404);

    // Prevent unsetting canConsent if it's the only consenting guardian
    if (body.canConsent === false) {
      const others = await db.select({ id: patientGuardians.id }).from(patientGuardians)
        .where(and(
          eq(patientGuardians.patientId, link.patientId),
          eq(patientGuardians.canConsent, true),
        ));
      const activeOthers = others.filter(o => o.id !== linkId);
      if (activeOthers.length === 0)
        return c.json({ success: false, error: { message: 'Cannot remove consent — minor must have at least one consenting guardian' } }, 400);
    }

    // If promoting to primary, demote others first
    if (body.isPrimary === true) {
      await db.update(patientGuardians)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(and(eq(patientGuardians.patientId, link.patientId), eq(patientGuardians.isPrimary, true)));
    }

    const u: Partial<typeof patientGuardians.$inferInsert> & { updatedAt: Date } = { updatedAt: new Date() };
    if (body.relationship      !== undefined) u.relationship      = body.relationship;
    if (body.isPrimary         !== undefined) u.isPrimary         = body.isPrimary;
    if (body.canConsent        !== undefined) u.canConsent        = body.canConsent;
    if (body.documentReference !== undefined) u.documentReference = body.documentReference;

    const [updated] = await db.update(patientGuardians).set(u).where(eq(patientGuardians.id, linkId)).returning();
    return c.json({ success: true, data: await decryptedGuardianRow(updated) });
  })

  // DELETE /:linkId — soft delete by setting endsAt = now
  .openapi(createRoute({
    tags: ['Guardians'], summary: 'Remove a guardian link (soft delete)',
    method: 'delete', path: '/:linkId',
    middleware: [authMiddleware], security: [{ bearerAuth: [] }],
    request: { params: z.object({ linkId: z.string().uuid() }) },
    responses: {
      200: { content: { 'application/json': { schema: ok  } }, description: 'Removed' },
      400: { content: { 'application/json': { schema: err } }, description: 'Last guardian' },
      403: { content: { 'application/json': { schema: err } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: err } }, description: 'Not found' },
    },
  }), async (c) => {
    const userType = c.get('userType');
    if (!['receptionist', 'admin'].includes(userType))
      return c.json({ success: false, error: { message: 'Receptionist or admin only' } }, 403);

    const { linkId } = c.req.valid('param');
    const [link] = await db.select().from(patientGuardians).where(eq(patientGuardians.id, linkId)).limit(1);
    if (!link) return c.json({ success: false, error: { message: 'Guardian link not found' } }, 404);

    // Block if this is the only active canConsent guardian
    const now = new Date();
    const allLinks = await db.select().from(patientGuardians)
      .where(eq(patientGuardians.patientId, link.patientId));
    const activeConsenting = allLinks.filter(l =>
      l.id !== linkId && l.canConsent && (!l.endsAt || l.endsAt > now),
    );
    if (activeConsenting.length === 0)
      return c.json({ success: false, error: { message: 'Cannot remove the only active guardian with consent — minor must have at least one' } }, 400);

    await db.update(patientGuardians)
      .set({ endsAt: now, isPrimary: false, updatedAt: now })
      .where(eq(patientGuardians.id, linkId));

    return c.json({ success: true, data: { message: 'Guardian link removed' } });
  });
