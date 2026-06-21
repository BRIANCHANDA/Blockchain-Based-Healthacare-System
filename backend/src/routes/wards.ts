import { createRoute, z } from '@hono/zod-openapi';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  wards, wardBeds, visits, practitioners, departments,
} from '../db/schema';
import { createRouter } from '../lib/create-app';
import { authMiddleware } from '../middleware/auth';
import { decrypt } from '../services/crypto';

const err = z.object({ success: z.boolean(), error: z.object({ message: z.string() }) });
const ok  = z.object({ success: z.boolean(), data: z.any() });

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getStaffInstitution(userId: string): Promise<string | null> {
  const row = await db.select({ institutionId: practitioners.institutionId })
    .from(practitioners).where(eq(practitioners.id, userId)).limit(1);
  return row[0]?.institutionId ?? null;
}

async function decryptName(first: string, last: string) {
  try {
    return `${await decrypt(first)} ${await decrypt(last)}`;
  } catch {
    return 'Unknown Patient';
  }
}

// ── Router ────────────────────────────────────────────────────────────────────

export const wardRouter = createRouter()

// ── List wards with bed summary ───────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Wards'], summary: 'List wards with occupancy summary',
    method: 'get', path: '/',
    middleware: [authMiddleware],
    security: [{ bearerAuth: [] }],
    responses: { 200: { content: { 'application/json': { schema: ok } }, description: 'OK' } },
  }), async (c) => {
    const userId       = (c as any).get('userId') as string;
    const institutionId = await getStaffInstitution(userId);
    if (!institutionId) return c.json({ success: false, error: { message: 'No institution' } }, 403);

    // Wards for this institution with department name
    const wardRows = await db
      .select({
        id:            wards.id,
        wardCode:      wards.wardCode,
        wardName:      wards.wardName,
        wardType:      wards.wardType,
        bedCount:      wards.bedCount,
        availableBeds: wards.availableBeds,
        isActive:      wards.isActive,
        departmentName: departments.departmentName,
      })
      .from(wards)
      .leftJoin(departments, eq(wards.departmentId, departments.id))
      .where(and(eq(wards.institutionId, institutionId), eq(wards.isActive, true)));

    // For each ward, count beds from ward_beds table
    const bedCounts = await db.execute(sql`
      SELECT
        ward_id,
        COUNT(*)                                               AS total_beds,
        COUNT(*) FILTER (WHERE status = 'occupied')           AS occupied,
        COUNT(*) FILTER (WHERE status = 'available')          AS available,
        COUNT(*) FILTER (WHERE status = 'maintenance')        AS maintenance
      FROM ward_beds
      WHERE institution_id = ${institutionId}
      GROUP BY ward_id
    `);

    const bedMap: Record<string, any> = {};
    for (const r of bedCounts as any[]) {
      bedMap[r.ward_id] = r;
    }

    const result = wardRows.map(w => ({
      ...w,
      bedsTracked:   Number(bedMap[w.id]?.total_beds ?? 0),
      bedsOccupied:  Number(bedMap[w.id]?.occupied   ?? 0),
      bedsAvailable: Number(bedMap[w.id]?.available  ?? 0),
      bedsMaint:     Number(bedMap[w.id]?.maintenance ?? 0),
    }));

    return c.json({ success: true, data: result });
  })

// ── Get beds for a ward (with patient info on occupied beds) ──────────────────
  .openapi(createRoute({
    tags: ['Wards'], summary: 'List beds in a ward with occupant info',
    method: 'get', path: '/:wardId/beds',
    middleware: [authMiddleware],
    security: [{ bearerAuth: [] }],
    request: { params: z.object({ wardId: z.string() }) },
    responses: { 200: { content: { 'application/json': { schema: ok } }, description: 'OK' } },
  }), async (c) => {
    const userId       = (c as any).get('userId') as string;
    const institutionId = await getStaffInstitution(userId);
    if (!institutionId) return c.json({ success: false, error: { message: 'No institution' } }, 403);

    const { wardId } = c.req.valid('param');

    const bedRows = await db
      .select({
        id:             wardBeds.id,
        bedCode:        wardBeds.bedCode,
        bedType:        wardBeds.bedType,
        status:         wardBeds.status,
        notes:          wardBeds.notes,
        currentVisitId: wardBeds.currentVisitId,
        updatedAt:      wardBeds.updatedAt,
      })
      .from(wardBeds)
      .where(and(eq(wardBeds.wardId, wardId), eq(wardBeds.institutionId, institutionId)))
      .orderBy(wardBeds.bedCode);

    // Enrich occupied beds with patient/visit info
    const occupiedBedIds = bedRows
      .filter(b => b.currentVisitId)
      .map(b => b.currentVisitId as string);

    let visitMap: Record<string, any> = {};
    if (occupiedBedIds.length > 0) {
      const visitRows = await db.execute(sql`
        SELECT
          v.id,
          v.visit_number,
          v.admission_date,
          v.priority,
          v.status,
          v.chief_complaint,
          v.assigned_doctor_id,
          p.first_name_encrypted,
          p.last_name_encrypted,
          p.gender,
          pr.first_name_encrypted AS doc_first,
          pr.last_name_encrypted  AS doc_last
        FROM visits v
        JOIN patients p ON v.patient_id = p.id
        LEFT JOIN practitioners pr ON v.assigned_doctor_id = pr.id
        JOIN ward_beds wb ON wb.current_visit_id = v.id
          AND wb.institution_id = ${institutionId}
          AND wb.ward_id = ${wardId}
      `);

      for (const row of visitRows as any[]) {
        const patientName = await decryptName(row.first_name_encrypted, row.last_name_encrypted);
        let doctorName = null;
        if (row.doc_first) {
          doctorName = 'Dr. ' + await decryptName(row.doc_first, row.doc_last);
        }
        visitMap[row.id] = {
          visitId:       row.id,
          visitNumber:   row.visit_number,
          admissionDate: row.admission_date,
          priority:      row.priority,
          visitStatus:   row.status,
          chiefComplaint: row.chief_complaint,
          patientName,
          gender:        row.gender,
          doctorName,
        };
      }
    }

    const beds = bedRows.map(b => ({
      ...b,
      visit: b.currentVisitId ? (visitMap[b.currentVisitId] ?? null) : null,
    }));

    return c.json({ success: true, data: beds });
  })

// ── Add beds to a ward ────────────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Wards'], summary: 'Add beds to a ward',
    method: 'post', path: '/:wardId/beds',
    middleware: [authMiddleware],
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ wardId: z.string() }),
      body: {
        content: {
          'application/json': {
            schema: z.object({
              beds: z.array(z.object({
                bedCode: z.string(),
                bedType: z.string().optional(),
                notes:   z.string().optional(),
              })),
            }),
          },
        },
      },
    },
    responses: { 200: { content: { 'application/json': { schema: ok } }, description: 'OK' } },
  }), async (c) => {
    const userId        = (c as any).get('userId') as string;
    const institutionId = await getStaffInstitution(userId);
    if (!institutionId) return c.json({ success: false, error: { message: 'No institution' } }, 403);

    const { wardId } = c.req.valid('param');
    const { beds }   = c.req.valid('json');

    const ward = await db.select({ id: wards.id })
      .from(wards)
      .where(and(eq(wards.id, wardId), eq(wards.institutionId, institutionId)))
      .limit(1);
    if (!ward.length) return c.json({ success: false, error: { message: 'Ward not found' } }, 404);

    const inserted = await db.insert(wardBeds).values(
      beds.map(b => ({
        wardId,
        institutionId,
        bedCode:  b.bedCode,
        bedType:  b.bedType ?? 'general',
        notes:    b.notes ?? null,
        status:   'available',
      }))
    ).returning();

    // Update ward available_beds count
    await db.execute(sql`
      UPDATE wards
      SET available_beds = (SELECT COUNT(*) FROM ward_beds WHERE ward_id = ${wardId} AND status = 'available'),
          bed_count      = (SELECT COUNT(*) FROM ward_beds WHERE ward_id = ${wardId})
      WHERE id = ${wardId}
    `);

    return c.json({ success: true, data: inserted });
  })

// ── Assign a patient visit to a bed ──────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Wards'], summary: 'Assign a visit to a bed',
    method: 'patch', path: '/beds/:bedId/assign',
    middleware: [authMiddleware],
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ bedId: z.string() }),
      body: {
        content: {
          'application/json': {
            schema: z.object({ visitId: z.string() }),
          },
        },
      },
    },
    responses: {
      200: { content: { 'application/json': { schema: ok } }, description: 'OK' },
      400: { content: { 'application/json': { schema: err } }, description: 'Error' },
    },
  }), async (c) => {
    const userId        = (c as any).get('userId') as string;
    const institutionId = await getStaffInstitution(userId);
    if (!institutionId) return c.json({ success: false, error: { message: 'No institution' } }, 403);

    const { bedId }  = c.req.valid('param');
    const { visitId } = c.req.valid('json');

    // Verify bed belongs to institution and is available
    const bed = await db.select().from(wardBeds)
      .where(and(eq(wardBeds.id, bedId), eq(wardBeds.institutionId, institutionId)))
      .limit(1);
    if (!bed.length) return c.json({ success: false, error: { message: 'Bed not found' } }, 404);
    if (bed[0].status === 'occupied')
      return c.json({ success: false, error: { message: 'Bed is already occupied' } }, 400);

    // Verify visit is active and in same institution
    const visit = await db.select({
      id: visits.id, status: visits.status, institutionId: visits.institutionId,
    }).from(visits).where(eq(visits.id, visitId)).limit(1);
    if (!visit.length) return c.json({ success: false, error: { message: 'Visit not found' } }, 404);
    if (visit[0].status === 'completed' || visit[0].status === 'cancelled')
      return c.json({ success: false, error: { message: 'Visit is not active' } }, 400);
    if (visit[0].institutionId !== institutionId)
      return c.json({ success: false, error: { message: 'Visit belongs to a different institution' } }, 403);

    // Release any bed currently holding this visit
    await db.execute(sql`
      UPDATE ward_beds SET status = 'available', current_visit_id = NULL, updated_at = NOW()
      WHERE current_visit_id = ${visitId}
    `);

    // Assign bed
    await db.update(wardBeds)
      .set({ status: 'occupied', currentVisitId: visitId, updatedAt: new Date() })
      .where(eq(wardBeds.id, bedId));

    // Update visit with ward/bed info
    const ward = await db.select({ wardId: wardBeds.wardId, wardCode: wards.wardCode, wardName: wards.wardName })
      .from(wardBeds)
      .leftJoin(wards, eq(wardBeds.wardId, wards.id))
      .where(eq(wardBeds.id, bedId))
      .limit(1);

    if (ward.length) {
      await db.update(visits).set({
        wardId:    ward[0].wardId,
        wardOrRoom: ward[0].wardName ?? null,
        bedNumber:  bed[0].bedCode,
        updatedAt: new Date(),
      }).where(eq(visits.id, visitId));
    }

    // Sync ward available_beds
    await db.execute(sql`
      UPDATE wards SET available_beds = (
        SELECT COUNT(*) FROM ward_beds WHERE ward_id = ${bed[0].wardId} AND status = 'available'
      ) WHERE id = ${bed[0].wardId}
    `);

    return c.json({ success: true, data: { message: 'Patient assigned to bed' } });
  })

// ── Release a bed ─────────────────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Wards'], summary: 'Release a bed (manual)',
    method: 'patch', path: '/beds/:bedId/release',
    middleware: [authMiddleware],
    security: [{ bearerAuth: [] }],
    request: { params: z.object({ bedId: z.string() }) },
    responses: { 200: { content: { 'application/json': { schema: ok } }, description: 'OK' } },
  }), async (c) => {
    const userId        = (c as any).get('userId') as string;
    const institutionId = await getStaffInstitution(userId);
    if (!institutionId) return c.json({ success: false, error: { message: 'No institution' } }, 403);

    const { bedId } = c.req.valid('param');

    const bed = await db.select().from(wardBeds)
      .where(and(eq(wardBeds.id, bedId), eq(wardBeds.institutionId, institutionId)))
      .limit(1);
    if (!bed.length) return c.json({ success: false, error: { message: 'Bed not found' } }, 404);

    const prevVisitId = bed[0].currentVisitId;
    await db.update(wardBeds)
      .set({ status: 'available', currentVisitId: null, updatedAt: new Date() })
      .where(eq(wardBeds.id, bedId));

    if (prevVisitId) {
      await db.update(visits)
        .set({ wardOrRoom: null, bedNumber: null, updatedAt: new Date() })
        .where(eq(visits.id, prevVisitId));
    }

    await db.execute(sql`
      UPDATE wards SET available_beds = (
        SELECT COUNT(*) FROM ward_beds WHERE ward_id = ${bed[0].wardId} AND status = 'available'
      ) WHERE id = ${bed[0].wardId}
    `);

    return c.json({ success: true, data: { message: 'Bed released' } });
  })

// ── Set bed to maintenance ────────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Wards'], summary: 'Toggle bed maintenance status',
    method: 'patch', path: '/beds/:bedId/maintenance',
    middleware: [authMiddleware],
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ bedId: z.string() }),
      body: {
        content: {
          'application/json': {
            schema: z.object({ maintenance: z.boolean() }),
          },
        },
      },
    },
    responses: { 200: { content: { 'application/json': { schema: ok } }, description: 'OK' } },
  }), async (c) => {
    const userId        = (c as any).get('userId') as string;
    const institutionId = await getStaffInstitution(userId);
    if (!institutionId) return c.json({ success: false, error: { message: 'No institution' } }, 403);

    const { bedId }       = c.req.valid('param');
    const { maintenance } = c.req.valid('json');

    const bed = await db.select().from(wardBeds)
      .where(and(eq(wardBeds.id, bedId), eq(wardBeds.institutionId, institutionId)))
      .limit(1);
    if (!bed.length) return c.json({ success: false, error: { message: 'Bed not found' } }, 404);
    if (bed[0].status === 'occupied' && maintenance)
      return c.json({ success: false, error: { message: 'Cannot set occupied bed to maintenance' } }, 400);

    const newStatus = maintenance ? 'maintenance' : 'available';
    await db.update(wardBeds)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(wardBeds.id, bedId));

    await db.execute(sql`
      UPDATE wards SET available_beds = (
        SELECT COUNT(*) FROM ward_beds WHERE ward_id = ${bed[0].wardId} AND status = 'available'
      ) WHERE id = ${bed[0].wardId}
    `);

    return c.json({ success: true, data: { status: newStatus } });
  })

// ── Active visits not yet assigned to a bed ───────────────────────────────────
  .openapi(createRoute({
    tags: ['Wards'], summary: 'Get active visits without a bed assignment',
    method: 'get', path: '/unassigned-visits',
    middleware: [authMiddleware],
    security: [{ bearerAuth: [] }],
    responses: { 200: { content: { 'application/json': { schema: ok } }, description: 'OK' } },
  }), async (c) => {
    const userId        = (c as any).get('userId') as string;
    const institutionId = await getStaffInstitution(userId);
    if (!institutionId) return c.json({ success: false, error: { message: 'No institution' } }, 403);

    // Visits active but not currently assigned to any bed
    const rows = await db.execute(sql`
      SELECT
        v.id, v.visit_number, v.admission_date, v.priority, v.chief_complaint,
        v.admitting_diagnosis,
        v.visit_type, v.ward_or_room, v.bed_number,
        p.first_name_encrypted, p.last_name_encrypted, p.gender,
        EXISTS (
          SELECT 1 FROM ward_beds wb WHERE wb.current_visit_id = v.id
        ) AS has_bed
      FROM visits v
      JOIN patients p ON v.patient_id = p.id
      WHERE v.institution_id = ${institutionId}
        AND v.status = 'in-progress'
      ORDER BY v.admission_date ASC
    `);

    const result = [];
    for (const row of rows as any[]) {
      const patientName = await decryptName(row.first_name_encrypted, row.last_name_encrypted);
      result.push({
        visitId:             row.id,
        visitNumber:         row.visit_number,
        admissionDate:       row.admission_date,
        priority:            row.priority,
        chiefComplaint:      row.chief_complaint,
        admittingDiagnosis:  row.admitting_diagnosis,
        visitType:           row.visit_type,
        wardOrRoom:          row.ward_or_room,
        bedNumber:           row.bed_number,
        patientName,
        gender:              row.gender,
        hasBed:              row.has_bed,
      });
    }

    return c.json({ success: true, data: result });
  })

// ── ADMIN: Get departments for the institution ─────────────────────────────
  .openapi(createRoute({
    tags: ['Wards'], summary: 'List departments for ward creation (admin)',
    method: 'get', path: '/admin/departments',
    middleware: [authMiddleware],
    security: [{ bearerAuth: [] }],
    responses: { 200: { content: { 'application/json': { schema: ok } }, description: 'OK' } },
  }), async (c) => {
    const userType      = (c as any).get('userType') as string;
    const institutionId = (c as any).get('institutionId') as string | null;
    if (userType !== 'admin') return c.json({ success: false, error: { message: 'Admin only' } }, 403);
    if (!institutionId) return c.json({ success: false, error: { message: 'No institution assigned to your account' } }, 403);

    const depts = await db
      .select({
        id:             departments.id,
        departmentCode: departments.departmentCode,
        departmentName: departments.departmentName,
        departmentType: departments.departmentType,
        isActive:       departments.isActive,
      })
      .from(departments)
      .where(and(eq(departments.institutionId, institutionId), eq(departments.isActive, true)))
      .orderBy(departments.departmentName);

    return c.json({ success: true, data: depts });
  })

// ── ADMIN: Create a ward ───────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Wards'], summary: 'Create a ward (admin)',
    method: 'post', path: '/admin',
    middleware: [authMiddleware],
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              departmentId: z.string(),
              wardCode:     z.string().min(1),
              wardName:     z.string().min(1),
              wardType:     z.string().min(1),
              bedCount:     z.number().int().min(1),
            }),
          },
        },
      },
    },
    responses: {
      200: { content: { 'application/json': { schema: ok  } }, description: 'Created' },
      400: { content: { 'application/json': { schema: err } }, description: 'Error'   },
    },
  }), async (c) => {
    const userId   = (c as any).get('userId') as string;
    const userType = (c as any).get('userType') as string;
    if (userType !== 'admin') return c.json({ success: false, error: { message: 'Admin only' } }, 403);

    const institutionId = await getStaffInstitution(userId);
    if (!institutionId) return c.json({ success: false, error: { message: 'No institution assigned' } }, 403);

    const { departmentId, wardCode, wardName, wardType, bedCount } = c.req.valid('json');

    // Verify department belongs to this institution
    const dept = await db.select({ id: departments.id })
      .from(departments)
      .where(and(eq(departments.id, departmentId), eq(departments.institutionId, institutionId)))
      .limit(1);
    if (!dept.length) return c.json({ success: false, error: { message: 'Department not found in your institution' } }, 400);

    // Check ward code uniqueness
    const exists = await db.select({ id: wards.id })
      .from(wards)
      .where(and(eq(wards.institutionId, institutionId), eq(wards.wardCode, wardCode)))
      .limit(1);
    if (exists.length) return c.json({ success: false, error: { message: `Ward code "${wardCode}" already exists` } }, 400);

    const [ward] = await db.insert(wards).values({
      departmentId,
      institutionId,
      wardCode,
      wardName,
      wardType,
      bedCount,
      availableBeds: bedCount,
      isActive: true,
    }).returning();

    // Auto-create individual bed records so nurses can assign immediately
    const pad = bedCount > 99 ? 3 : 2;
    const bedRows = Array.from({ length: bedCount }, (_, i) => ({
      wardId:        ward.id,
      institutionId,
      bedCode:       String(i + 1).padStart(pad, '0'),
      bedType:       wardType === 'icu' ? 'icu' : wardType === 'isolation' ? 'isolation' : 'general',
      status:        'available' as const,
    }));
    await db.insert(wardBeds).values(bedRows);

    return c.json({ success: true, data: ward });
  })

// ── ADMIN: Update a ward ──────────────────────────────────────────────────
  .openapi(createRoute({
    tags: ['Wards'], summary: 'Update ward details (admin)',
    method: 'patch', path: '/admin/:wardId',
    middleware: [authMiddleware],
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ wardId: z.string() }),
      body: {
        content: {
          'application/json': {
            schema: z.object({
              wardName:  z.string().optional(),
              wardType:  z.string().optional(),
              bedCount:  z.number().int().min(1).optional(),
              isActive:  z.boolean().optional(),
            }),
          },
        },
      },
    },
    responses: { 200: { content: { 'application/json': { schema: ok } }, description: 'OK' } },
  }), async (c) => {
    const userType      = (c as any).get('userType') as string;
    const institutionId = (c as any).get('institutionId') as string | null;
    if (userType !== 'admin') return c.json({ success: false, error: { message: 'Admin only' } }, 403);
    if (!institutionId) return c.json({ success: false, error: { message: 'No institution assigned' } }, 403);

    const { wardId } = c.req.valid('param');
    const body       = c.req.valid('json');

    const ward = await db.select().from(wards)
      .where(and(eq(wards.id, wardId), eq(wards.institutionId, institutionId)))
      .limit(1);
    if (!ward.length) return c.json({ success: false, error: { message: 'Ward not found' } }, 404);

    const updates: Partial<typeof ward[0]> = {};
    if (body.wardName !== undefined) updates.wardName = body.wardName;
    if (body.wardType !== undefined) updates.wardType = body.wardType;
    if (body.isActive !== undefined) updates.isActive = body.isActive;

    if (body.bedCount !== undefined) {
      updates.bedCount = body.bedCount;

      // How many beds already exist for this ward?
      const existingResult = await db.execute(sql`
        SELECT COUNT(*) AS cnt FROM ward_beds WHERE ward_id = ${wardId}
      `);
      const existingCount = Number(((existingResult as any[])[0] as any)?.cnt ?? 0);

      if (body.bedCount > existingCount) {
        // Add the gap beds, continuing from where existing codes left off
        const toAdd = body.bedCount - existingCount;
        const pad   = body.bedCount > 99 ? 3 : 2;
        const defaultBedType = (body.wardType ?? ward[0].wardType) === 'icu' ? 'icu'
                             : (body.wardType ?? ward[0].wardType) === 'isolation' ? 'isolation'
                             : 'general';
        const newBeds = Array.from({ length: toAdd }, (_, i) => ({
          wardId,
          institutionId,
          bedCode:  String(existingCount + i + 1).padStart(pad, '0'),
          bedType:  defaultBedType,
          status:   'available' as const,
        }));
        await db.insert(wardBeds).values(newBeds);
      }

      // Recalculate availableBeds from actual ward_beds rows
      const availResult = await db.execute(sql`
        SELECT COUNT(*) AS cnt FROM ward_beds WHERE ward_id = ${wardId} AND status = 'available'
      `);
      updates.availableBeds = Number(((availResult as any[])[0] as any)?.cnt ?? body.bedCount);
    }

    const [updated] = await db.update(wards).set(updates)
      .where(eq(wards.id, wardId)).returning();

    return c.json({ success: true, data: updated });
  })

// ── ADMIN: Delete (deactivate) a ward ─────────────────────────────────────
  .openapi(createRoute({
    tags: ['Wards'], summary: 'Deactivate a ward (admin)',
    method: 'delete', path: '/admin/:wardId',
    middleware: [authMiddleware],
    security: [{ bearerAuth: [] }],
    request: { params: z.object({ wardId: z.string() }) },
    responses: { 200: { content: { 'application/json': { schema: ok } }, description: 'OK' } },
  }), async (c) => {
    const userId   = (c as any).get('userId') as string;
    const userType = (c as any).get('userType') as string;
    if (userType !== 'admin') return c.json({ success: false, error: { message: 'Admin only' } }, 403);

    const institutionId = await getStaffInstitution(userId);
    if (!institutionId) return c.json({ success: false, error: { message: 'No institution assigned' } }, 403);

    const { wardId } = c.req.valid('param');

    // Block if any beds are currently occupied
    const occupied = await db.execute(sql`
      SELECT COUNT(*) AS cnt FROM ward_beds WHERE ward_id = ${wardId} AND status = 'occupied'
    `);
    if (Number(((occupied as any[])[0] as any)?.cnt ?? 0) > 0)
      return c.json({ success: false, error: { message: 'Cannot deactivate a ward with occupied beds' } }, 400);

    await db.update(wards).set({ isActive: false })
      .where(and(eq(wards.id, wardId), eq(wards.institutionId, institutionId)));

    return c.json({ success: true, data: { message: 'Ward deactivated' } });
  });
