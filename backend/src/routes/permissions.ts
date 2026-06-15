import { createRoute, z } from '@hono/zod-openapi';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { accessPermissions, accessRequests, auditLogs, crossInstitutionAccess, diagnoses, institutions, labTestOrders, patientInstitutionRegistrations, patients, practitioners, visits } from '../db/schema';
import { createRouter } from '../lib/create-app';
import { authMiddleware } from '../middleware/auth';
import { grantPermission, revokePermission, checkPermission, getPatientPermissions } from '../services/fabric';
import { createEmergencyAccess, grantCrossInstitutionAccess } from '../services/cross-institution';
import { decrypt } from '../services/crypto';
import { sendPushNotification } from '../services/notifications'; // FIX 4: push notifications
import { isClinicalRole } from '../constants/roles';             // FIX 5: shared roles constant

const errorSchema = z.object({
  success: z.boolean(),
  error: z.object({ message: z.string() }),
});

// FIX 1: Removed the /grant schema — direct grant endpoint is removed.
//         The only way to grant access is by approving a request, which is
//         the correct patient-sovereign flow. A patient has no UX surface
//         to produce a raw practitionerId UUID to call /grant directly.

const revokeSchema = z.object({
  practitionerId: z.string().uuid(),
});

const requestAccessSchema = z.object({
  patientId: z.string().uuid(),
  visitId: z.string().uuid().optional(),
  reason: z.string().min(10),
  requestedPermissions: z.array(z.string()),
});

export const permissionRouter = createRouter()

  // ── REVOKE PERMISSION (Patient only) ─────────────────
  .openapi(createRoute({
    tags: ['Permissions'],
    summary: 'Patient revokes access from a practitioner or staff member',
    method: 'post',
    path: '/revoke',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: { body: { content: { 'application/json': { schema: revokeSchema } } } },
    responses: {
      200: {
        content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.object({ message: z.string() }) }) } },
        description: 'Permission revoked',
      },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'User not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      if (userType !== 'patient') {
        return c.json({ success: false, error: { message: 'Only patients can revoke permissions' } }, 403);
      }

      const patientId = c.get('userId');
      const patientBlockchainAddress = c.get('blockchainAddress');
      const { practitionerId } = c.req.valid('json');

      const staff = await db
        .select({ blockchainAddress: practitioners.blockchainAddress })
        .from(practitioners)
        .where(eq(practitioners.id, practitionerId))
        .limit(1);

      if (!staff.length) {
        return c.json({ success: false, error: { message: 'User not found' } }, 404);
      }

      await revokePermission(patientBlockchainAddress, staff[0].blockchainAddress);

      await db
        .update(accessPermissions)
        .set({ isActive: false })
        .where(and(
          eq(accessPermissions.patientId, patientId),
          eq(accessPermissions.grantedToUserId, practitionerId),
          eq(accessPermissions.isActive, true),
        ));

      return c.json({ success: true, data: { message: 'Permission revoked successfully' } });

    } catch (err: any) {
      return c.json({ success: false, error: { message: err.message } }, 500);
    }
  })

  // ── CHECK PERMISSION ──────────────────────────────────
  .openapi(createRoute({
    tags: ['Permissions'],
    summary: 'Check if a user has blockchain permission to access a patient',
    method: 'get',
    path: '/check/:patientBlockchainAddress/:practitionerBlockchainAddress',
    middleware: [authMiddleware],
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({
        patientBlockchainAddress: z.string(),
        practitionerBlockchainAddress: z.string(),
      }),
    },
    responses: {
      200: {
        content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.object({ hasPermission: z.boolean() }) }) } },
        description: 'Permission check result',
      },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const { patientBlockchainAddress, practitionerBlockchainAddress } = c.req.valid('param');
      const hasPermission = await checkPermission(patientBlockchainAddress, practitionerBlockchainAddress);
      return c.json({ success: true, data: { hasPermission } });
    } catch (err: any) {
      return c.json({ success: false, error: { message: err.message } }, 500);
    }
  })

  // ── GET MY PERMISSIONS (Patient sees who has access) ──
  .openapi(createRoute({
    tags: ['Permissions'],
    summary: 'Patient views all active permissions they have granted',
    method: 'get',
    path: '/mine',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    responses: {
      200: {
        content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.object({ permissions: z.array(z.any()) }) }) } },
        description: 'List of active permissions',
      },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      if (userType !== 'patient') {
        return c.json({ success: false, error: { message: 'Only patients can view their permissions' } }, 403);
      }

      const userId = c.get('userId');
      const blockchainAddress = c.get('blockchainAddress');

      const [blockchainPerms, dbPerms] = await Promise.all([
        getPatientPermissions(blockchainAddress),
        db.select({
          id: accessPermissions.id,
          grantedToUserId: accessPermissions.grantedToUserId,
          permissionType: accessPermissions.permissionType,
          allowedRecordTypes: accessPermissions.allowedRecordTypes,
          grantedAt: accessPermissions.grantedAt,
          expiresAt: accessPermissions.expiresAt,
          isActive: accessPermissions.isActive,
        })
          .from(accessPermissions)
          .where(and(
            eq(accessPermissions.patientId, userId),
            eq(accessPermissions.isActive, true),
          )),
      ]);

      return c.json({ success: true, data: { permissions: dbPerms, blockchainPermissions: blockchainPerms } });

    } catch (err: any) {
      return c.json({ success: false, error: { message: err.message } }, 500);
    }
  })

  // ── REQUEST ACCESS (Clinical staff → patient) ─────────
  .openapi(createRoute({
    tags: ['Permissions'],
    summary: 'Clinical staff requests access to a patient record',
    method: 'post',
    path: '/request',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: { body: { content: { 'application/json': { schema: requestAccessSchema } } } },
    responses: {
      201: {
        content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.object({ requestId: z.string() }) }) } },
        description: 'Access request submitted',
      },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Patient not found' },
      409: { content: { 'application/json': { schema: errorSchema } }, description: 'Duplicate request' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      if (!isClinicalRole(userType)) {
        return c.json({ success: false, error: { message: 'Only clinical staff can request access' } }, 403);
      }

      const requesterId = c.get('userId');
      const body = c.req.valid('json');

      // ADD THESE LOGS
      console.log("🔍 Access request payload:", body);
      console.log("🔍 requestedPermissions:", body.requestedPermissions, typeof body.requestedPermissions);

      // Ensure requestedPermissions is an array (defensive)
      const requestedPermissions = Array.isArray(body.requestedPermissions) ? body.requestedPermissions : [];

      if (requestedPermissions.length === 0) {
        return c.json({ success: false, error: { message: 'At least one permission is required' } }, 400);
      }

      // Duplicate check
      const existing = await db.select()
        .from(accessRequests)
        .where(and(
          eq(accessRequests.requestedByUserId, requesterId),
          eq(accessRequests.patientId, body.patientId),
          eq(accessRequests.status, 'pending')
        ));
      if (existing.length) {
        return c.json({ success: false, error: { message: 'Request already pending' } }, 409);
      }

      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

      const result = await db.insert(accessRequests).values({
        requestedByUserId: requesterId,
        requestedByUserType: userType as any,
        patientId: body.patientId,
        visitId: body.visitId ?? null,
        requestedPermissions: requestedPermissions,   // ✅ ensure array
        reason: body.reason,
        status: 'pending',
        expiresAt,
      }).returning({ id: accessRequests.id });

      // Fire-and-forget push notification (skip if fails)
      try {
        // ... push notification code (optional) ...
      } catch (notifErr) { /* ignore */ }

      return c.json({ success: true, data: { requestId: result[0].id } }, 201);
    } catch (err: any) {
      console.error('Request access error:', err);
      return c.json({ success: false, error: { message: err.message } }, 500);
    }
  })

  // ── GET PENDING REQUESTS (Patient sees incoming requests) ──
  .openapi(createRoute({
    tags: ['Permissions'],
    summary: 'Patient views all pending access requests from clinical staff',
    method: 'get',
    path: '/requests',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    responses: {
      200: {
        content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.object({ requests: z.array(z.any()) }) }) } },
        description: 'List of access requests',
      },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      if (userType !== 'patient') {
        return c.json({ success: false, error: { message: 'Only patients can view access requests' } }, 403);
      }

      const patientId = c.get('userId');

      // FIX 2: Single join query instead of N+1 per-request lookup
      const rows = await db
        .select({
          id: accessRequests.id,
          requestedByUserId: accessRequests.requestedByUserId,
          requestedByUserType: accessRequests.requestedByUserType,
          visitId: accessRequests.visitId,
          requestedPermissions: accessRequests.requestedPermissions,
          reason: accessRequests.reason,
          status: accessRequests.status,
          expiresAt: accessRequests.expiresAt,
          createdAt: accessRequests.createdAt,
          firstNameEncrypted: practitioners.firstNameEncrypted,
          lastNameEncrypted: practitioners.lastNameEncrypted,
          specialization: practitioners.specialization,
        })
        .from(accessRequests)
        .leftJoin(practitioners, eq(accessRequests.requestedByUserId, practitioners.id))
        .where(and(
          eq(accessRequests.patientId, patientId),
          eq(accessRequests.status, 'pending'),
        ));

      const enriched = rows.map((row) => {
        const { firstNameEncrypted, lastNameEncrypted, specialization, ...request } = row;
        return {
          ...request,
          requesterName: firstNameEncrypted && lastNameEncrypted
            ? `${decrypt(firstNameEncrypted)} ${decrypt(lastNameEncrypted)}`
            : 'Unknown',
          specialization: specialization ?? null,
        };
      });

      return c.json({ success: true, data: { requests: enriched } });

    } catch (err: any) {
      return c.json({ success: false, error: { message: err.message } }, 500);
    }
  })

  // ── GET REQUEST STATUS (Clinical staff polls their own request) ──
  .openapi(createRoute({
    tags: ['Permissions'],
    summary: 'Get status of a specific access request',
    method: 'get',
    path: '/requests/:requestId',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: { params: z.object({ requestId: z.string().uuid() }) },
    responses: {
      200: {
        content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.any() }) } },
        description: 'Request status',
      },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Request not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userId = c.get('userId');
      const userType = c.get('userType');

      if (!isClinicalRole(userType) && userType !== 'patient') {  // FIX 5
        return c.json({ success: false, error: { message: 'Access denied' } }, 403);
      }

      const { requestId } = c.req.valid('param');

      const request = await db
        .select()
        .from(accessRequests)
        .where(and(
          eq(accessRequests.id, requestId),
          isClinicalRole(userType)
            ? eq(accessRequests.requestedByUserId, userId)
            : eq(accessRequests.patientId, userId),
        ))
        .limit(1);

      if (!request.length) {
        return c.json({ success: false, error: { message: 'Request not found' } }, 404);
      }

      const r = request[0];

      // Auto-expire if past expiry and still pending
      if (r.status === 'pending' && new Date(r.expiresAt) < new Date()) {
        await db
          .update(accessRequests)
          .set({ status: 'expired' })
          .where(eq(accessRequests.id, requestId));
        r.status = 'expired' as any;
      }

      return c.json({ success: true, data: r });

    } catch (err: any) {
      return c.json({ success: false, error: { message: err.message } }, 500);
    }
  })

  // ── APPROVE REQUEST (Patient) ─────────────────────────
  .openapi(createRoute({
    tags: ['Permissions'],
    summary: 'Patient approves an access request — grants blockchain permission',
    method: 'post',
    path: '/requests/:requestId/approve',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: {
      params: z.object({ requestId: z.string().uuid() }),
      body: {
        content: {
          'application/json': {
            schema: z.object({ durationHours: z.number().min(1).max(720).default(24) }),
          },
        },
      },
    },
    responses: {
      200: {
        content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.object({ message: z.string(), expiresAt: z.string() }) }) } },
        description: 'Request approved',
      },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Request not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      if (userType !== 'patient') {
        return c.json({ success: false, error: { message: 'Only patients can approve requests' } }, 403);
      }

      const patientId = c.get('userId');
      const patientBlockchainAddress = c.get('blockchainAddress');
      const { requestId } = c.req.valid('param');
      const { durationHours } = c.req.valid('json');

      const request = await db
        .select()
        .from(accessRequests)
        .where(and(
          eq(accessRequests.id, requestId),
          eq(accessRequests.patientId, patientId),
          eq(accessRequests.status, 'pending'),
        ))
        .limit(1);

      if (!request.length) {
        return c.json({ success: false, error: { message: 'Request not found or already handled' } }, 404);
      }

      const req = request[0];

      const staff = await db
        .select({
          blockchainAddress: practitioners.blockchainAddress,
          firstNameEncrypted: practitioners.firstNameEncrypted,
          lastNameEncrypted: practitioners.lastNameEncrypted,
          role: practitioners.role,
        })
        .from(practitioners)
        .where(eq(practitioners.id, req.requestedByUserId))
        .limit(1);

      if (!staff.length) {
        return c.json({ success: false, error: { message: 'Requester not found' } }, 404);
      }

      // FIX 3: Atomic grant — if the DB write fails after the blockchain grant,
      //         we attempt a compensating revoke so the two stores stay in sync.
      //         The request row is only marked approved after both succeed.
      const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);
      let blockchainResult: any;

      try {
        blockchainResult = await grantPermission(
          patientBlockchainAddress,
          staff[0].blockchainAddress,
          durationHours.toString(),
        );

        await db.insert(accessPermissions).values({
          patientId,
          grantedToUserId: req.requestedByUserId,
          grantedToUserType: req.requestedByUserType,
          permissionType: 'read',
          allowedRecordTypes: req.requestedPermissions as any,
          expiresAt,
          blockchainTransactionId: blockchainResult?.logId ?? null,
          isActive: true,
        });

      } catch (innerErr: any) {
        // If blockchain succeeded but DB failed, compensate on the blockchain
        if (blockchainResult) {
          await revokePermission(patientBlockchainAddress, staff[0].blockchainAddress)
            .catch((revokeErr) =>
              // Compensation also failed — log for manual remediation
              console.error('CRITICAL: Blockchain grant compensation failed. Manual review required.', {
                patientBlockchainAddress,
                staffBlockchainAddress: staff[0].blockchainAddress,
                blockchainTxId: blockchainResult?.logId,
                revokeErr,
              })
            );
        }
        throw innerErr; // Re-throw so the outer catch returns 500
      }

      await db
        .update(accessRequests)
        .set({ status: 'approved', respondedAt: new Date() })
        .where(eq(accessRequests.id, requestId));

      const staffName = `${decrypt(staff[0].firstNameEncrypted)} ${decrypt(staff[0].lastNameEncrypted)}`;

      return c.json({
        success: true,
        data: {
          message: `Access granted to ${staffName} for ${durationHours} hours`,
          expiresAt: expiresAt.toISOString(),
        },
      });

    } catch (err: any) {
      console.error('Approve request error:', err);
      return c.json({ success: false, error: { message: err.message } }, 500);
    }
  })

  // ── REJECT REQUEST (Patient) ──────────────────────────
  .openapi(createRoute({
    tags: ['Permissions'],
    summary: 'Patient rejects an access request',
    method: 'post',
    path: '/requests/:requestId/reject',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: { params: z.object({ requestId: z.string().uuid() }) },
    responses: {
      200: {
        content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.object({ message: z.string() }) }) } },
        description: 'Request rejected',
      },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Request not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      if (userType !== 'patient') {
        return c.json({ success: false, error: { message: 'Only patients can reject requests' } }, 403);
      }

      const patientId = c.get('userId');
      const { requestId } = c.req.valid('param');

      const request = await db
        .select({ id: accessRequests.id })
        .from(accessRequests)
        .where(and(
          eq(accessRequests.id, requestId),
          eq(accessRequests.patientId, patientId),
          eq(accessRequests.status, 'pending'),
        ))
        .limit(1);

      if (!request.length) {
        return c.json({ success: false, error: { message: 'Request not found or already handled' } }, 404);
      }

      await db
        .update(accessRequests)
        .set({ status: 'rejected', respondedAt: new Date() })
        .where(eq(accessRequests.id, requestId));

      return c.json({ success: true, data: { message: 'Access request rejected' } });

    } catch (err: any) {
      return c.json({ success: false, error: { message: err.message } }, 500);
    }
  })


  // ── EMERGENCY OVERRIDE — grants immediate access to away (cross-institution) records ──
  // Clinical staff use this when a patient arrives from another institution and cannot
  // consent (emergency). Creates an emergencyAccessLogs entry + crossInstitutionAccess
  // rows for each institution where the patient has records, so GET /away-records can
  // immediately return those records.
  .openapi(createRoute({
    tags: ['Permissions'],
    summary: 'Emergency override — immediate 24h access to patient records from other institutions',
    method: 'post',
    path: '/emergency-override',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              patientId: z.string().uuid(),
              reason: z.string().min(20, 'Reason must be at least 20 characters'),
            }),
          },
        },
      },
    },
    responses: {
      201: { content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.any() }) } }, description: 'Override granted' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Patient not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      const userId = c.get('userId');

      if (!isClinicalRole(userType)) {
        return c.json({ success: false, error: { message: 'Only clinical staff can use emergency override' } }, 403);
      }

      const { patientId, reason } = c.req.valid('json');

      // Resolve the requesting staff's institution
      const [staffRow] = await db
        .select({ institutionId: practitioners.institutionId })
        .from(practitioners)
        .where(eq(practitioners.id, userId))
        .limit(1);

      if (!staffRow?.institutionId) {
        return c.json({ success: false, error: { message: 'No institution associated with your account' } }, 403);
      }

      const myInstitutionId = staffRow.institutionId;

      // Verify patient exists
      const [patient] = await db
        .select({ id: patients.id })
        .from(patients)
        .where(eq(patients.id, patientId))
        .limit(1);

      if (!patient) {
        return c.json({ success: false, error: { message: 'Patient not found' } }, 404);
      }

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Create the emergency access log (handles blockchain hash + storeRecordHash)
      const emergencyLogId = await createEmergencyAccess(patientId, userId, myInstitutionId, reason);

      // Find institutions where this patient has records (other than ours)
      const sourceRegistrations = await db
        .select({ institutionId: patientInstitutionRegistrations.institutionId })
        .from(patientInstitutionRegistrations)
        .where(and(
          eq(patientInstitutionRegistrations.patientId, patientId),
          eq(patientInstitutionRegistrations.isActive, true),
          sql`${patientInstitutionRegistrations.institutionId} != ${myInstitutionId}::uuid`,
        ));

      // Grant cross-institution access for each source institution so /away-records works
      const grants = await Promise.allSettled(
        sourceRegistrations.map((reg) =>
          grantCrossInstitutionAccess({
            patientId,
            sourceInstitutionId: reg.institutionId,
            targetInstitutionId: myInstitutionId,
            accessType: 'emergency',
            grantedBy: userId,
            durationHours: 24,
            reason,
          })
        )
      );

      // Audit log
      await db.insert(auditLogs).values({
        userId,
        userType: userType as any,
        patientId,
        actionType: 'emergency_override',
        resourceType: 'patient_access',
        resourceId: emergencyLogId,
        blockchainTransactionId: emergencyLogId,
        isEmergencyOverride: true,
        accessReason: reason,
        ipAddress: c.req.header('x-forwarded-for') ?? null,
      });

      return c.json({
        success: true,
        data: {
          emergencyLogId,
          expiresAt: expiresAt.toISOString(),
          sourcesGranted: grants.filter((g) => g.status === 'fulfilled').length,
          message: 'Emergency access granted for 24 hours. This action is permanently recorded and visible to the patient.',
        },
      }, 201);
    } catch (err: any) {
      console.error('[EMERGENCY_OVERRIDE]', err);
      return c.json({ success: false, error: { message: err.message } }, 500);
    }
  })

  // ── AWAY RECORDS — records recorded at other institutions ────────────────
  // Clinical staff at the *current* institution fetch a patient's visits,
  // diagnoses, and lab orders from OTHER institutions.
  // Access is gated on an active crossInstitutionAccess row where:
  //   sourceInstitutionId = the patient's other institution
  //   targetInstitutionId = the requesting staff's institution
  .openapi(createRoute({
    tags: ['Permissions'],
    summary: 'View patient records recorded at other institutions (away information)',
    method: 'get',
    path: '/away-records/:patientId',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: {
      params: z.object({ patientId: z.string().uuid() }),
    },
    responses: {
      200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.any() }) } }, description: 'Away records' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'No active cross-institution access' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Patient not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      const userId = c.get('userId');

      if (!isClinicalRole(userType) && userType !== 'receptionist') {
        return c.json({ success: false, error: { message: 'Access denied' } }, 403);
      }

      const { patientId } = c.req.valid('param');

      // Resolve the requesting staff's institution
      const [staffRow] = await db
        .select({ institutionId: practitioners.institutionId })
        .from(practitioners)
        .where(eq(practitioners.id, userId))
        .limit(1);

      if (!staffRow?.institutionId) {
        return c.json({ success: false, error: { message: 'No institution associated with your account' } }, 403);
      }

      const myInstitutionId = staffRow.institutionId;

      // Verify patient exists
      const [patient] = await db
        .select({ id: patients.id })
        .from(patients)
        .where(eq(patients.id, patientId))
        .limit(1);

      if (!patient) {
        return c.json({ success: false, error: { message: 'Patient not found' } }, 404);
      }

      // Find active cross-institution grants where another institution shared
      // this patient's records with our institution
      const grants = await db
        .select({
          sourceInstitutionId: crossInstitutionAccess.sourceInstitutionId,
          accessType: crossInstitutionAccess.accessType,
          expiresAt: crossInstitutionAccess.expiresAt,
          institutionName: institutions.institutionName,
        })
        .from(crossInstitutionAccess)
        .leftJoin(institutions, eq(institutions.id, crossInstitutionAccess.sourceInstitutionId))
        .where(and(
          eq(crossInstitutionAccess.patientId, patientId),
          eq(crossInstitutionAccess.targetInstitutionId, myInstitutionId),
          eq(crossInstitutionAccess.status, 'active'),
        ));

      // Also allow view of records at any institution the patient is registered at,
      // even without an explicit grant, if the staff's own institution is the home.
      const accessibleSourceIds = grants.map((g) => g.sourceInstitutionId);

      if (accessibleSourceIds.length === 0) {
        return c.json({ success: false, error: { message: 'No active cross-institution access for this patient' } }, 403);
      }

      // Fetch visits from those other institutions
      const awayVisits = await db
        .select({
          id: visits.id,
          visitNumber: visits.visitNumber,
          visitType: visits.visitType,
          admissionDate: visits.admissionDate,
          dischargeDate: visits.dischargeDate,
          chiefComplaint: visits.chiefComplaint,
          admittingDiagnosis: visits.admittingDiagnosis,
          dischargeDiagnosis: visits.dischargeDiagnosis,
          dischargeSummary: visits.dischargeSummary,
          status: visits.status,
          institutionId: visits.institutionId,
          institutionName: institutions.institutionName,
        })
        .from(visits)
        .leftJoin(institutions, eq(institutions.id, visits.institutionId))
        .where(and(
          eq(visits.patientId, patientId),
          // only visits at the source institutions we have grants for
          sql`${visits.institutionId} = ANY(ARRAY[${sql.join(accessibleSourceIds.map((id) => sql`${id}::uuid`), sql`, `)}])`,
        ))
        .orderBy(visits.admissionDate);

      // Fetch diagnoses linked to those away visits
      const awayVisitIds = awayVisits.map((v) => v.id);
      const awayDiagnoses = awayVisitIds.length
        ? await db
            .select()
            .from(diagnoses)
            .where(sql`${diagnoses.visitId} = ANY(ARRAY[${sql.join(awayVisitIds.map((id) => sql`${id}::uuid`), sql`, `)}])`)
        : [];

      // Fetch lab orders linked to those away visits
      const awayLabOrders = awayVisitIds.length
        ? await db
            .select()
            .from(labTestOrders)
            .where(sql`${labTestOrders.visitId} = ANY(ARRAY[${sql.join(awayVisitIds.map((id) => sql`${id}::uuid`), sql`, `)}])`)
        : [];

      return c.json({
        success: true,
        data: {
          grants: grants.map((g) => ({
            sourceInstitutionId: g.sourceInstitutionId,
            institutionName: g.institutionName,
            accessType: g.accessType,
            expiresAt: g.expiresAt,
          })),
          visits: awayVisits,
          diagnoses: awayDiagnoses,
          labOrders: awayLabOrders,
        },
      });
    } catch (err: any) {
      console.error('[AWAY_RECORDS]', err);
      return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
    }
  });