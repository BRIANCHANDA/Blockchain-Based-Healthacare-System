

import { createRoute, z } from '@hono/zod-openapi';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { accessPermissions, accessRequests, patients, practitioners } from '../db/schema';
import { createRouter } from '../lib/create-app';
import { authMiddleware } from '../middleware/auth';
import { grantPermission, revokePermission, checkPermission, getPatientPermissions } from '../services/fabric';
import { decrypt } from '../services/crypto';

const errorSchema = z.object({
  success: z.boolean(),
  error: z.object({ message: z.string() }),
});

const grantSchema = z.object({
  practitionerId: z.string().uuid(),
  durationHours: z.number().min(1).max(720),
  permissionType: z.enum(['read', 'write', 'full']).default('read'),
  allowedRecordTypes: z.array(z.string()).default(['all']),
});

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

  // ── GRANT PERMISSION (Patient only) ──────────────────
  .openapi(createRoute({
    tags: ['Permissions'],
    summary: 'Patient grants a practitioner or nurse access to their records',
    method: 'post',
    path: '/grant',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: {
      body: { content: { 'application/json': { schema: grantSchema } } },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              data: z.object({
                message: z.string(),
                expiresAt: z.string(),
                blockchainTxId: z.string().optional(),
              })
            })
          }
        },
        description: 'Permission granted successfully',
      },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Only patients can grant permissions' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'User not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      if (userType !== 'patient') {
        return c.json({ success: false, error: { message: 'Only patients can grant permissions' } }, 403);
      }

      const patientId = c.get('userId');
      const patientBlockchainAddress = c.get('blockchainAddress');
      const body = c.req.valid('json');

      // Check practitioners table first, then nurses
      let granteeBlockchainAddress: string;
      let granteeName: string;
      let granteeUserType: string = 'practitioner';

      const practitioner = await db.select({
        id: practitioners.id,
        blockchainAddress: practitioners.blockchainAddress,
        firstNameEncrypted: practitioners.firstNameEncrypted,
        lastNameEncrypted: practitioners.lastNameEncrypted,
      }).from(practitioners)
        .where(eq(practitioners.id, body.practitionerId))
        .limit(1);

      if (practitioner.length) {
        granteeBlockchainAddress = practitioner[0].blockchainAddress;
        granteeName = `${decrypt(practitioner[0].firstNameEncrypted)} ${decrypt(practitioner[0].lastNameEncrypted)}`;
        granteeUserType = 'practitioner';
      } else {
        // Try nurses table
        const nurse = await db.select({
          id: nurses.id,
          blockchainAddress: nurses.blockchainAddress,
          firstNameEncrypted: nurses.firstNameEncrypted,
          lastNameEncrypted: nurses.lastNameEncrypted,
        }).from(nurses)
          .where(eq(nurses.id, body.practitionerId))
          .limit(1);

        if (!nurse.length) {
          return c.json({ success: false, error: { message: 'User not found' } }, 404);
        }

        granteeBlockchainAddress = nurse[0].blockchainAddress;
        granteeName = `${decrypt(nurse[0].firstNameEncrypted)} ${decrypt(nurse[0].lastNameEncrypted)}`;
        granteeUserType = 'nurse';
      }

      // Submit to blockchain
      const blockchainResult = await grantPermission(
        patientBlockchainAddress,
        granteeBlockchainAddress,
        body.durationHours.toString()
      ) as any;

      // Save to database
      const expiresAt = new Date(Date.now() + body.durationHours * 60 * 60 * 1000);

      await db.insert(accessPermissions).values({
        patientId,
        grantedToUserId: body.practitionerId,
        grantedToUserType: granteeUserType as any,
        permissionType: body.permissionType,
        allowedRecordTypes: body.allowedRecordTypes,
        expiresAt,
        blockchainTransactionId: blockchainResult?.transactionId ?? blockchainResult?.logId ?? null,
        isActive: true,
      });

      return c.json({
        success: true,
        data: {
          message: `Access granted to ${granteeName}`,
          expiresAt: expiresAt.toISOString(),
          blockchainTxId: blockchainResult?.logId,
        }
      });

    } catch (err: any) {
      console.error('Grant permission error:', err);
      return c.json({ success: false, error: { message: err.message } }, 500);
    }
  })

  // ── REVOKE PERMISSION (Patient only) ─────────────────
  .openapi(createRoute({
    tags: ['Permissions'],
    summary: 'Patient revokes a practitioner access',
    method: 'post',
    path: '/revoke',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: {
      body: { content: { 'application/json': { schema: revokeSchema } } },
    },
    responses: {
      200: {
        content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.object({ message: z.string() }) }) } },
        description: 'Permission revoked',
      },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
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

      // Check practitioners then nurses
      let granteeBlockchainAddress: string;

      const practitioner = await db.select({
        blockchainAddress: practitioners.blockchainAddress
      }).from(practitioners)
        .where(eq(practitioners.id, practitionerId))
        .limit(1);

      if (practitioner.length) {
        granteeBlockchainAddress = practitioner[0].blockchainAddress;
      } else {
        const nurse = await db.select({
          blockchainAddress: nurses.blockchainAddress
        }).from(nurses)
          .where(eq(nurses.id, practitionerId))
          .limit(1);

        if (!nurse.length) {
          return c.json({ success: false, error: { message: 'User not found' } }, 404);
        }
        granteeBlockchainAddress = nurse[0].blockchainAddress;
      }

      // Revoke on blockchain
      await revokePermission(patientBlockchainAddress, granteeBlockchainAddress);

      // Update database
      await db.update(accessPermissions)
        .set({ isActive: false })
        .where(and(
          eq(accessPermissions.patientId, patientId),
          eq(accessPermissions.grantedToUserId, practitionerId),
          eq(accessPermissions.isActive, true)
        ));

      return c.json({ success: true, data: { message: 'Permission revoked successfully' } });

    } catch (err: any) {
      return c.json({ success: false, error: { message: err.message } }, 500);
    }
  })

  // ── CHECK PERMISSION ──────────────────────────────────
  .openapi(createRoute({
    tags: ['Permissions'],
    summary: 'Check if a practitioner has permission to access a patient',
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
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              data: z.object({ hasPermission: z.boolean() })
            })
          }
        },
        description: 'Permission check result',
      },
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
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              data: z.object({ permissions: z.array(z.any()) })
            })
          }
        },
        description: 'List of permissions',
      },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      const userId = c.get('userId');
      const blockchainAddress = c.get('blockchainAddress');

      if (userType !== 'patient') {
        return c.json({ success: false, error: { message: 'Only patients can view their permissions' } }, 403);
      }

      const blockchainPerms = await getPatientPermissions(blockchainAddress);

      const dbPerms = await db.select({
        id: accessPermissions.id,
        grantedToUserId: accessPermissions.grantedToUserId,
        permissionType: accessPermissions.permissionType,
        allowedRecordTypes: accessPermissions.allowedRecordTypes,
        grantedAt: accessPermissions.grantedAt,
        expiresAt: accessPermissions.expiresAt,
        isActive: accessPermissions.isActive,
      }).from(accessPermissions)
        .where(and(
          eq(accessPermissions.patientId, userId),
          eq(accessPermissions.isActive, true)
        ));

      return c.json({ success: true, data: { permissions: dbPerms, blockchainPermissions: blockchainPerms } });

    } catch (err: any) {
      return c.json({ success: false, error: { message: err.message } }, 500);
    }
  })

  // ── REQUEST ACCESS (Clinical staff requests from patient) ──
  .openapi(createRoute({
    tags: ['Permissions'],
    summary: 'Clinical staff requests access to a patient record',
    method: 'post',
    path: '/request',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: {
      body: { content: { 'application/json': { schema: requestAccessSchema } } },
    },
    responses: {
      201: {
        content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.object({ requestId: z.string() }) }) } },
        description: 'Access request submitted',
      },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      const allowedRoles = ['practitioner', 'nurse', 'lab_technician', 'radiologist', 'pharmacist'];
      if (!allowedRoles.includes(userType)) {
        return c.json({ success: false, error: { message: 'Only clinical staff can request access' } }, 403);
      }

      const requesterId = c.get('userId');
      const body = c.req.valid('json');

      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

      const result = await db.insert(accessRequests).values({
        requestedByUserId: requesterId,
        requestedByUserType: userType as any,
        patientId: body.patientId,
        visitId: body.visitId ?? null,
        requestedPermissions: body.requestedPermissions,
        reason: body.reason,
        status: 'pending',
        expiresAt,
      }).returning({ id: accessRequests.id });

      return c.json({ success: true, data: { requestId: result[0].id } }, 201);

    } catch (err: any) {
      return c.json({ success: false, error: { message: err.message } }, 500);
    }
  })

  // ── GET PENDING REQUESTS FOR PATIENT ─────────────────
  .openapi(createRoute({
    tags: ['Permissions'],
    summary: 'Patient views all pending access requests from clinical staff',
    method: 'get',
    path: '/requests',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              data: z.object({ requests: z.array(z.any()) })
            })
          }
        },
        description: 'List of access requests',
      },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      const patientId = c.get('userId');

      if (userType !== 'patient') {
        return c.json({ success: false, error: { message: 'Only patients can view access requests' } }, 403);
      }

      const requests = await db.select({
        id: accessRequests.id,
        requestedByUserId: accessRequests.requestedByUserId,
        requestedByUserType: accessRequests.requestedByUserType,
        visitId: accessRequests.visitId,
        requestedPermissions: accessRequests.requestedPermissions,
        reason: accessRequests.reason,
        status: accessRequests.status,
        expiresAt: accessRequests.expiresAt,
        createdAt: accessRequests.createdAt,
      }).from(accessRequests)
        .where(and(
          eq(accessRequests.patientId, patientId),
          eq(accessRequests.status, 'pending')
        ));

      // Enrich with requester name from practitioners table
      const enriched = await Promise.all(requests.map(async (req) => {
        const practitioner = await db.select({
          firstNameEncrypted: practitioners.firstNameEncrypted,
          lastNameEncrypted: practitioners.lastNameEncrypted,
          specialization: practitioners.specialization,
        }).from(practitioners)
          .where(eq(practitioners.id, req.requestedByUserId))
          .limit(1);

        return {
          ...req,
          requesterName: practitioner.length
            ? `${decrypt(practitioner[0].firstNameEncrypted)} ${decrypt(practitioner[0].lastNameEncrypted)}`
            : 'Unknown',
          specialization: practitioner[0]?.specialization ?? null,
        };
      }));

      return c.json({ success: true, data: { requests: enriched } });

    } catch (err: any) {
      console.error('Get access requests error:', err);
      return c.json({ success: false, error: { message: err.message } }, 500);
    }
  })

  // ── APPROVE ACCESS REQUEST (Patient) ─────────────────
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
            schema: z.object({
              durationHours: z.number().min(1).max(720).default(24),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              data: z.object({ message: z.string(), expiresAt: z.string() })
            })
          }
        },
        description: 'Request approved',
      },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Request not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      const patientId = c.get('userId');
      const patientBlockchainAddress = c.get('blockchainAddress');

      if (userType !== 'patient') {
        return c.json({ success: false, error: { message: 'Only patients can approve requests' } }, 403);
      }

      const { requestId } = c.req.valid('param');
      const { durationHours } = c.req.valid('json');

      // Get the request
      const request = await db.select().from(accessRequests)
        .where(and(
          eq(accessRequests.id, requestId),
          eq(accessRequests.patientId, patientId),
          eq(accessRequests.status, 'pending')
        )).limit(1);

      if (!request.length) {
        return c.json({ success: false, error: { message: 'Request not found or already handled' } }, 404);
      }

      const req = request[0];

      // Get requester blockchain address
      const practitioner = await db.select({
        blockchainAddress: practitioners.blockchainAddress,
        firstNameEncrypted: practitioners.firstNameEncrypted,
        lastNameEncrypted: practitioners.lastNameEncrypted,
      }).from(practitioners)
        .where(eq(practitioners.id, req.requestedByUserId))
        .limit(1);

      if (!practitioner.length) {
        return c.json({ success: false, error: { message: 'Requester not found' } }, 404);
      }

      // Grant on blockchain
      const { grantPermission } = await import('../services/fabric');
      const blockchainResult = await grantPermission(
        patientBlockchainAddress,
        practitioner[0].blockchainAddress,
        durationHours.toString()
      ) as any;

      const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);

      // Save permission to DB
      await db.insert(accessPermissions).values({
        patientId,
        grantedToUserId: req.requestedByUserId,
        grantedToUserType: req.requestedByUserType,
        permissionType: 'read',
        allowedRecordTypes: req.requestedPermissions,
        expiresAt,
        blockchainTransactionId: blockchainResult?.logId ?? null,
        isActive: true,
      });

      // Mark request as approved
      await db.update(accessRequests)
        .set({ status: 'approved' })
        .where(eq(accessRequests.id, requestId));

      const requesterName = `${decrypt(practitioner[0].firstNameEncrypted)} ${decrypt(practitioner[0].lastNameEncrypted)}`;

      return c.json({
        success: true,
        data: {
          message: `Access granted to ${requesterName} for ${durationHours} hours`,
          expiresAt: expiresAt.toISOString(),
        }
      });

    } catch (err: any) {
      console.error('Approve request error:', err);
      return c.json({ success: false, error: { message: err.message } }, 500);
    }
  })

  // ── GET REQUEST STATUS (Practitioner polls their own request) ──
  .openapi(createRoute({
    tags: ['Permissions'],
    summary: 'Get status of a specific access request (practitioner polls their own)',
    method: 'get',
    path: '/requests/:requestId',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: {
      params: z.object({ requestId: z.string().uuid() }),
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              data: z.object({
                requestId: z.string(),
                status: z.enum(['pending', 'approved', 'rejected', 'expired']),
                patientId: z.string(),
                visitId: z.string().nullable(),
                requestedPermissions: z.array(z.string()),
                reason: z.string(),
                createdAt: z.string(),
                expiresAt: z.string(),
              }),
            }),
          },
        },
        description: 'Request status',
      },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Request not found' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      const userId = c.get('userId');

      if (userType !== 'practitioner') {
        return c.json({ success: false, error: { message: 'Only practitioners can check request status' } }, 403);
      }

      const { requestId } = c.req.valid('param');

      const request = await db
        .select()
        .from(accessRequests)
        .where(
          and(
            eq(accessRequests.id, requestId),
            eq(accessRequests.requestedByUserId, userId), // can only view own requests
          )
        )
        .limit(1);

      if (!request.length) {
        return c.json({ success: false, error: { message: 'Request not found' } }, 404);
      }

      const r = request[0];

      // Auto-expire if past expiry and still pending
      const isExpired = r.status === 'pending' && new Date(r.expiresAt) < new Date();
      if (isExpired) {
        await db
          .update(accessRequests)
          .set({ status: 'expired' })
          .where(eq(accessRequests.id, requestId));
        r.status = 'expired';
      }

      return c.json({
        success: true,
        data: {
          requestId: r.id,
          status: r.status,
          patientId: r.patientId,
          visitId: (r as any).visitId ?? null,
          requestedPermissions: r.requestedPermissions ?? [],
          reason: r.reason,
          createdAt: r.createdAt?.toISOString(),
          expiresAt: r.expiresAt?.toISOString(),
        },
      });

    } catch (err: any) {
      return c.json({ success: false, error: { message: err.message } }, 500);
    }
  })


  // ── REJECT ACCESS REQUEST (Patient) ──────────────────
  .openapi(createRoute({
    tags: ['Permissions'],
    summary: 'Patient rejects an access request',
    method: 'post',
    path: '/requests/:requestId/reject',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: {
      params: z.object({ requestId: z.string().uuid() }),
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              data: z.object({ message: z.string() })
            })
          }
        },
        description: 'Request rejected',
      },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Request not found' },
      500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
    },
  }), async (c) => {
    try {
      const userType = c.get('userType');
      const patientId = c.get('userId');

      if (userType !== 'patient') {
        return c.json({ success: false, error: { message: 'Only patients can reject requests' } }, 403);
      }

      const { requestId } = c.req.valid('param');

      const request = await db.select().from(accessRequests)
        .where(and(
          eq(accessRequests.id, requestId),
          eq(accessRequests.patientId, patientId),
          eq(accessRequests.status, 'pending')
        )).limit(1);

      if (!request.length) {
        return c.json({ success: false, error: { message: 'Request not found or already handled' } }, 404);
      }

      await db.update(accessRequests)
        .set({ status: 'rejected' })
        .where(eq(accessRequests.id, requestId));

      return c.json({ success: true, data: { message: 'Access request rejected' } });

    } catch (err: any) {
      console.error('Reject request error:', err);
      return c.json({ success: false, error: { message: err.message } }, 500);
    }
  });