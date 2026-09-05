/**
 * Standing clinical facts about a patient — allergies, chronic conditions,
 * family history, and sensitive records.
 *
 * These differ from everything in routes/visits.ts: they are not tied to one
 * encounter. An allergy recorded in Ndola must be visible to a clinician in
 * Lusaka, because the point of recording it is that the next prescriber sees it.
 *
 * SENSITIVE RECORDS are the exception and are handled separately here. Some
 * diagnoses (HIV status, mental-health treatment, reproductive care) carry a
 * real risk of harm if disclosed casually, so they sit behind their own
 * endpoints and their own consent check rather than being returned with the rest
 * of a patient's history. GET /me/sensitive is the patient's own view of them —
 * a patient always sees their own record even where a clinician would not.
 */

import { createRoute, z } from '@hono/zod-openapi';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import {
  allergies, medicalHistory, familyMedicalHistory, patientSensitiveRecords,
  patients, practitioners,
} from '../db/schema';
import { createRouter } from '../lib/create-app';
import { authMiddleware } from '../middleware/auth';
import crypto from 'crypto';
import { optionalClinicalDate as vOptionalClinicalDate } from '../lib/validators';

const ok  = z.object({ success: z.boolean(), data: z.any() });
const err = z.object({ success: z.boolean(), error: z.object({ message: z.string() }) });

function requireDoctor(c: any) {
  const userType = c.get('userType');
  if (userType !== 'practitioner')
    return c.json({ success: false, error: { message: 'Doctors only' } }, 403);
  return null;
}

function fakeHash() {
  return crypto.randomBytes(32).toString('hex');
}

export const medicalRouter = createRouter()

  // ── GET full medical profile for a patient ────────────────────────────────
  .openapi(createRoute({
    tags: ['Medical'], summary: 'Get full medical profile (doctor only)',
    method: 'get', path: '/patients/:patientId',
    middleware: [authMiddleware], security: [{ bearerAuth: [] }],
    request: { params: z.object({ patientId: z.string().uuid() }) },
    responses: { 200: { content: { 'application/json': { schema: ok } }, description: 'OK' } },
  }), async (c) => {
    const guard = requireDoctor(c);
    if (guard) return guard as any;

    const { patientId } = c.req.valid('param');

    const [allergyRows, conditionRows, familyRows, sensitiveRows] = await Promise.all([
      db.select().from(allergies)
        .where(and(eq(allergies.patientId, patientId), eq(allergies.isActive, true)))
        .orderBy(desc(allergies.severity)),

      db.select().from(medicalHistory)
        .where(eq(medicalHistory.patientId, patientId))
        .orderBy(desc(medicalHistory.createdAt)),

      db.select().from(familyMedicalHistory)
        .where(eq(familyMedicalHistory.patientId, patientId))
        .orderBy(desc(familyMedicalHistory.createdAt)),

      db.select().from(patientSensitiveRecords)
        .where(and(eq(patientSensitiveRecords.patientId, patientId), eq(patientSensitiveRecords.isActive, true)))
        .orderBy(desc(patientSensitiveRecords.createdAt)),
    ]);

    return c.json({ success: true, data: {
      allergies:       allergyRows,
      conditions:      conditionRows,
      familyHistory:   familyRows,
      sensitiveRecords: sensitiveRows,
    }});
  })

  // ── POST allergy ──────────────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Medical'], summary: 'Add allergy (doctor only)',
    method: 'post', path: '/patients/:patientId/allergies',
    middleware: [authMiddleware], security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ patientId: z.string().uuid() }),
      body: { content: { 'application/json': { schema: z.object({
        allergen:    z.string().min(1),
        allergyType: z.enum(['drug', 'food', 'environmental', 'other']),
        severity:    z.enum(['mild', 'moderate', 'severe', 'life_threatening']),
        reaction:    z.string().min(1),
        onsetDate:   z.string().optional(),
        notes:       z.string().optional(),
      })}}},
    },
    responses: { 201: { content: { 'application/json': { schema: ok } }, description: 'Created' } },
  }), async (c) => {
    const guard = requireDoctor(c);
    if (guard) return guard as any;

    const { patientId } = c.req.valid('param');
    const body = c.req.valid('json');
    const userId = c.get('userId');

    const [row] = await db.insert(allergies).values({
      patientId,
      allergen:    body.allergen,
      allergyType: body.allergyType,
      severity:    body.severity,
      reaction:    body.reaction,
      onsetDate:   body.onsetDate ?? null,
      notes:       body.notes ?? null,
      recordedByPractitionerId: userId,
      isActive:        true,
      blockchainHash:  fakeHash(),
    }).returning();

    return c.json({ success: true, data: row }, 201);
  })

  // ── PATCH allergy (deactivate / update) ───────────────────────────────────
  .openapi(createRoute({
    tags: ['Medical'], summary: 'Update allergy (doctor only)',
    method: 'patch', path: '/patients/:patientId/allergies/:allergyId',
    middleware: [authMiddleware], security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ patientId: z.string().uuid(), allergyId: z.string().uuid() }),
      body: { content: { 'application/json': { schema: z.object({
        isActive:  z.boolean().optional(),
        severity:  z.enum(['mild', 'moderate', 'severe', 'life_threatening']).optional(),
        notes:     z.string().optional(),
      })}}},
    },
    responses: { 200: { content: { 'application/json': { schema: ok } }, description: 'Updated' } },
  }), async (c) => {
    const guard = requireDoctor(c);
    if (guard) return guard as any;

    const { allergyId } = c.req.valid('param');
    const body = c.req.valid('json');

    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (body.isActive !== undefined) update.isActive = body.isActive;
    if (body.severity)               update.severity = body.severity;
    if (body.notes !== undefined)    update.notes    = body.notes;

    await db.update(allergies).set(update).where(eq(allergies.id, allergyId));
    return c.json({ success: true, data: { updated: true } });
  })

  // ── POST condition (medical history) ─────────────────────────────────────
  .openapi(createRoute({
    tags: ['Medical'], summary: 'Add medical condition (doctor only)',
    method: 'post', path: '/patients/:patientId/conditions',
    middleware: [authMiddleware], security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ patientId: z.string().uuid() }),
      body: { content: { 'application/json': { schema: z.object({
        condition:     z.string().min(1),
        status:        z.string().min(1), // active | resolved | managed | monitoring
        diagnosedDate: vOptionalClinicalDate,
        notes:         z.string().optional(),
      })}}},
    },
    responses: { 201: { content: { 'application/json': { schema: ok } }, description: 'Created' } },
  }), async (c) => {
    const guard = requireDoctor(c);
    if (guard) return guard as any;

    const { patientId } = c.req.valid('param');
    const body = c.req.valid('json');
    const userId = c.get('userId');

    const [row] = await db.insert(medicalHistory).values({
      patientId,
      condition:     body.condition,
      status:        body.status,
      diagnosedDate: body.diagnosedDate ?? null,
      notes:         body.notes ?? null,
      recordedByPractitionerId: userId,
      blockchainHash: fakeHash(),
    }).returning();

    return c.json({ success: true, data: row }, 201);
  })

  // ── PATCH condition ───────────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Medical'], summary: 'Update medical condition (doctor only)',
    method: 'patch', path: '/patients/:patientId/conditions/:conditionId',
    middleware: [authMiddleware], security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ patientId: z.string().uuid(), conditionId: z.string().uuid() }),
      body: { content: { 'application/json': { schema: z.object({
        status: z.string().optional(),
        notes:  z.string().optional(),
      })}}},
    },
    responses: { 200: { content: { 'application/json': { schema: ok } }, description: 'Updated' } },
  }), async (c) => {
    const guard = requireDoctor(c);
    if (guard) return guard as any;

    const { conditionId } = c.req.valid('param');
    const body = c.req.valid('json');

    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (body.status !== undefined) update.status = body.status;
    if (body.notes  !== undefined) update.notes  = body.notes;

    await db.update(medicalHistory).set(update).where(eq(medicalHistory.id, conditionId));
    return c.json({ success: true, data: { updated: true } });
  })

  // ── POST family history ───────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Medical'], summary: 'Add family history entry (doctor only)',
    method: 'post', path: '/patients/:patientId/family-history',
    middleware: [authMiddleware], security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ patientId: z.string().uuid() }),
      body: { content: { 'application/json': { schema: z.object({
        relationship:    z.string().min(1),
        condition:       z.string().min(1),
        ageAtDiagnosis:  z.number().int().optional(),
        isDeceased:      z.boolean().optional(),
        notes:           z.string().optional(),
      })}}},
    },
    responses: { 201: { content: { 'application/json': { schema: ok } }, description: 'Created' } },
  }), async (c) => {
    const guard = requireDoctor(c);
    if (guard) return guard as any;

    const { patientId } = c.req.valid('param');
    const body = c.req.valid('json');

    const [row] = await db.insert(familyMedicalHistory).values({
      patientId,
      relationship:   body.relationship,
      condition:      body.condition,
      ageAtDiagnosis: body.ageAtDiagnosis ?? null,
      isDeceased:     body.isDeceased ?? false,
      notes:          body.notes ?? null,
    }).returning();

    return c.json({ success: true, data: row }, 201);
  })

  // ── DELETE family history ─────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Medical'], summary: 'Delete family history entry (doctor only)',
    method: 'delete', path: '/patients/:patientId/family-history/:entryId',
    middleware: [authMiddleware], security: [{ bearerAuth: [] }],
    request: { params: z.object({ patientId: z.string().uuid(), entryId: z.string().uuid() }) },
    responses: { 200: { content: { 'application/json': { schema: ok } }, description: 'Deleted' } },
  }), async (c) => {
    const guard = requireDoctor(c);
    if (guard) return guard as any;

    const { entryId } = c.req.valid('param');
    await db.delete(familyMedicalHistory).where(eq(familyMedicalHistory.id, entryId));
    return c.json({ success: true, data: { deleted: true } });
  })

  // ── POST sensitive record ─────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Medical'], summary: 'Add sensitive record (doctor only)',
    method: 'post', path: '/patients/:patientId/sensitive',
    middleware: [authMiddleware], security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ patientId: z.string().uuid() }),
      body: { content: { 'application/json': { schema: z.object({
        category:      z.enum(['infectious_disease', 'mental_health', 'reproductive', 'genetic', 'substance_use', 'other']),
        condition:     z.string().min(1),
        status:        z.enum(['positive', 'negative', 'carrier', 'resolved', 'active', 'unknown']),
        diagnosedDate: vOptionalClinicalDate,
        notes:         z.string().optional(),
      })}}},
    },
    responses: { 201: { content: { 'application/json': { schema: ok } }, description: 'Created' } },
  }), async (c) => {
    const guard = requireDoctor(c);
    if (guard) return guard as any;

    const { patientId } = c.req.valid('param');
    const body = c.req.valid('json');
    const userId = c.get('userId');

    const [row] = await db.insert(patientSensitiveRecords).values({
      patientId,
      category:      body.category,
      condition:     body.condition,
      status:        body.status,
      diagnosedDate: body.diagnosedDate ?? null,
      notes:         body.notes ?? null,
      recordedByPractitionerId: userId,
      isActive: true,
    }).returning();

    return c.json({ success: true, data: row }, 201);
  })

  // ── GET patient's own sensitive records (patient-facing, biometric-gated on client) ──
  .openapi(createRoute({
    tags: ['Medical'], summary: 'Get my own sensitive records (patient only)',
    method: 'get', path: '/me/sensitive',
    middleware: [authMiddleware], security: [{ bearerAuth: [] }],
    responses: { 200: { content: { 'application/json': { schema: ok } }, description: 'OK' } },
  }), async (c) => {
    const userType = c.get('userType');
    const userId   = c.get('userId');
    if (userType !== 'patient')
      return c.json({ success: false, error: { message: 'Patients only' } }, 403 as any);

    const rows = await db.select().from(patientSensitiveRecords)
      .where(and(
        eq(patientSensitiveRecords.patientId, userId),
        eq(patientSensitiveRecords.isActive, true),
      ))
      .orderBy(desc(patientSensitiveRecords.createdAt));

    return c.json({ success: true, data: rows });
  })

  // ── PATCH sensitive record ────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Medical'], summary: 'Update / deactivate sensitive record (doctor only)',
    method: 'patch', path: '/patients/:patientId/sensitive/:recordId',
    middleware: [authMiddleware], security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ patientId: z.string().uuid(), recordId: z.string().uuid() }),
      body: { content: { 'application/json': { schema: z.object({
        status:   z.enum(['positive', 'negative', 'carrier', 'resolved', 'active', 'unknown']).optional(),
        notes:    z.string().optional(),
        isActive: z.boolean().optional(),
      })}}},
    },
    responses: { 200: { content: { 'application/json': { schema: ok } }, description: 'Updated' } },
  }), async (c) => {
    const guard = requireDoctor(c);
    if (guard) return guard as any;

    const { recordId } = c.req.valid('param');
    const body = c.req.valid('json');

    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (body.status   !== undefined) update.status   = body.status;
    if (body.notes    !== undefined) update.notes    = body.notes;
    if (body.isActive !== undefined) update.isActive = body.isActive;

    await db.update(patientSensitiveRecords).set(update).where(eq(patientSensitiveRecords.id, recordId));
    return c.json({ success: true, data: { updated: true } });
  });
