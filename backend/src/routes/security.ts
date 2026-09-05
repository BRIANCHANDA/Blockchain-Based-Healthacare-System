import { createRoute, z } from '@hono/zod-openapi';
import { eq, desc, and, gte, sql, inArray, lt } from 'drizzle-orm';
import { db } from '../db';
import {
  auditLogs, practitioners, authSessions, institutions,
} from '../db/schema';
import { createRouter } from '../lib/create-app';
import { authMiddleware } from '../middleware/auth';
import { decrypt } from '../services/crypto';

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeDec(fn: () => string): string {
  try { return fn(); } catch { return ''; }
}

function practitionerName(p: { firstNameEncrypted: string; lastNameEncrypted: string }): string {
  const first = safeDec(() => decrypt(p.firstNameEncrypted));
  const last  = safeDec(() => decrypt(p.lastNameEncrypted));
  return `${first} ${last}`.trim() || 'Unknown';
}

const errorSchema = z.object({ success: z.boolean(), error: z.object({ message: z.string() }) });

// ── Router ────────────────────────────────────────────────────────────────────

export const securityRouter = createRouter()

  // ── GET /overview — quick summary stats ──────────────────────────────────
  .openapi(createRoute({
    tags: ['Security'],
    summary: 'Security overview statistics (SuperAdmin)',
    method: 'get', path: '/overview',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    responses: {
      200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.any() }) } }, description: 'Overview stats' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
    },
    // @ts-expect-error
  }), async (c) => {
    // @ts-expect-error
    const userType  = c.get('userType');
    // @ts-expect-error
    const institutionId: string | null = c.get('institutionId') ?? null;
    if (userType !== 'admin') return c.json({ success: false, error: { message: 'Admin only' } }, 403);

    const since24h  = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const since30d  = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const now       = new Date();

    const [overrideCount, blockedCount, sessionCount, recentHighVol] = await Promise.all([
      // Emergency overrides last 30 days
      db.select({ n: sql<number>`count(*)` }).from(auditLogs)
        .where(and(eq(auditLogs.isEmergencyOverride, true), gte(auditLogs.timestamp, since30d))),

      // Blocked practitioners
      db.select({ n: sql<number>`count(*)` }).from(practitioners)
        .where(and(eq(practitioners.isActive, false), institutionId ? eq(practitioners.institutionId, institutionId) : sql`1=1`)),

      // Active sessions
      db.select({ n: sql<number>`count(*)` }).from(authSessions)
        .where(and(eq(authSessions.isActive, true), gte(authSessions.expiresAt, now))),

      // Users with > 15 audit events in last 24h (high-volume flag)
      db.select({ userId: auditLogs.userId, n: sql<number>`count(*)` })
        .from(auditLogs)
        .where(gte(auditLogs.timestamp, since24h))
        .groupBy(auditLogs.userId)
        .having(sql`count(*) > 15`),
    ]);

    return c.json({
      success: true,
      data: {
        emergencyOverridesLast30d: Number(overrideCount[0]?.n ?? 0),
        blockedAccounts:           Number(blockedCount[0]?.n ?? 0),
        activeSessions:            Number(sessionCount[0]?.n ?? 0),
        highVolumeUsers:           recentHighVol.length,
      },
    });
  })

  // ── GET /flags — detailed flagged activity list ───────────────────────────
  .openapi(createRoute({
    tags: ['Security'],
    summary: 'List flagged security events (SuperAdmin)',
    method: 'get', path: '/flags',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: {
      query: z.object({
        type:  z.enum(['emergency_override', 'high_volume', 'all']).optional(),
        days:  z.string().optional(),
        page:  z.string().optional(),
        limit: z.string().optional(),
      }),
    },
    responses: {
      200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.any() }) } }, description: 'Flagged events' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
    },
    // @ts-expect-error
  }), async (c) => {
    // @ts-expect-error
    const userType = c.get('userType');
    if (userType !== 'admin') return c.json({ success: false, error: { message: 'Admin only' } }, 403);

    const query = c.req.valid('query');
    const type  = query.type ?? 'all';
    const days  = Math.min(90, Math.max(1, parseInt(query.days ?? '30')));
    const page  = Math.max(1, parseInt(query.page ?? '1'));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '50')));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const flags: any[] = [];

    // ── Emergency Overrides ──────────────────────────────────────────────────
    if (type === 'all' || type === 'emergency_override') {
      const overrides = await db.select().from(auditLogs)
        .where(and(eq(auditLogs.isEmergencyOverride, true), gte(auditLogs.timestamp, since)))
        .orderBy(desc(auditLogs.timestamp))
        .limit(200);

      if (overrides.length) {
        const actorIds   = [...new Set(overrides.map(l => l.userId).filter(Boolean))];
        const actorRows  = actorIds.length
          ? await db.select({
              id: practitioners.id,
              firstNameEncrypted: practitioners.firstNameEncrypted,
              lastNameEncrypted:  practitioners.lastNameEncrypted,
              role:        practitioners.role,
              department:  practitioners.department,
              isActive:    practitioners.isActive,
              institutionId: practitioners.institutionId,
            }).from(practitioners).where(inArray(practitioners.id, actorIds))
          : [];

        // Fetch institution names
        const instIds  = [...new Set(actorRows.map(a => a.institutionId).filter(Boolean))] as string[];
        const instRows = instIds.length
          ? await db.select({ id: institutions.id, name: institutions.institutionName })
              .from(institutions).where(inArray(institutions.id, instIds))
          : [];
        const instMap = new Map(instRows.map(i => [i.id, i.name]));
        const actorMap = new Map(actorRows.map(a => ({ ...a, name: practitionerName(a) })).map(a => [a.id, a]));

        for (const log of overrides) {
          const actor = actorMap.get(log.userId);
          flags.push({
            id:        log.id,
            type:      'emergency_override',
            severity:  'high',
            timestamp: log.timestamp,
            title:     'Emergency Override Used',
            detail:    `${actor?.name ?? 'Unknown'} bypassed normal access controls`,
            actor: {
              id:          log.userId,
              name:        actor?.name ?? 'Unknown',
              role:        actor?.role ?? 'unknown',
              department:  actor?.department ?? null,
              isActive:    actor?.isActive ?? true,
              institution: actor?.institutionId ? (instMap.get(actor.institutionId) ?? null) : null,
            },
            patientId:      log.patientId,
            resourceType:   log.resourceType,
            accessReason:   log.accessReason,
            ipAddress:      log.ipAddress,
          });
        }
      }
    }

    // ── High-Volume Access ───────────────────────────────────────────────────
    if (type === 'all' || type === 'high_volume') {
      const volRows = await db.select({ userId: auditLogs.userId, n: sql<number>`count(*)` })
        .from(auditLogs)
        .where(gte(auditLogs.timestamp, since24h))
        .groupBy(auditLogs.userId)
        .having(sql`count(*) > 15`);

      if (volRows.length) {
        const actorIds  = volRows.map(r => r.userId).filter(Boolean);
        const actorRows = await db.select({
          id: practitioners.id,
          firstNameEncrypted: practitioners.firstNameEncrypted,
          lastNameEncrypted:  practitioners.lastNameEncrypted,
          role:        practitioners.role,
          department:  practitioners.department,
          isActive:    practitioners.isActive,
          institutionId: practitioners.institutionId,
          lastSeenAt:  practitioners.lastSeenAt,
        }).from(practitioners).where(inArray(practitioners.id, actorIds));

        const instIds  = [...new Set(actorRows.map(a => a.institutionId).filter(Boolean))] as string[];
        const instRows = instIds.length
          ? await db.select({ id: institutions.id, name: institutions.institutionName })
              .from(institutions).where(inArray(institutions.id, instIds))
          : [];
        const instMap  = new Map(instRows.map(i => [i.id, i.name]));

        for (const row of volRows) {
          const actor = actorRows.find(a => a.id === row.userId);
          flags.push({
            id:        `hv-${row.userId}`,
            type:      'high_volume',
            severity:  Number(row.n) > 50 ? 'critical' : 'medium',
            timestamp: new Date(),
            title:     'Unusually High Record Access',
            detail:    `${actor ? practitionerName(actor) : 'Unknown'} accessed ${row.n} records in the last 24 hours`,
            actor: {
              id:          row.userId,
              name:        actor ? practitionerName(actor) : 'Unknown',
              role:        actor?.role ?? 'unknown',
              department:  actor?.department ?? null,
              isActive:    actor?.isActive ?? true,
              institution: actor?.institutionId ? (instMap.get(actor.institutionId) ?? null) : null,
            },
            accessCount: Number(row.n),
            patientId:   null,
            ipAddress:   null,
          });
        }
      }
    }

    // Sort by timestamp desc, then paginate
    flags.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const total      = flags.length;
    const paginated  = flags.slice((page - 1) * limit, page * limit);

    return c.json({ success: true, data: { flags: paginated, total, page, totalPages: Math.ceil(total / limit) } });
  })

  // ── GET /sessions — list all active sessions ──────────────────────────────
  .openapi(createRoute({
    tags: ['Security'],
    summary: 'List active sessions (SuperAdmin)',
    method: 'get', path: '/sessions',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: {
      query: z.object({
        page:  z.string().optional(),
        limit: z.string().optional(),
      }),
    },
    responses: {
      200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.any() }) } }, description: 'Active sessions' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
    },
    // @ts-expect-error
  }), async (c) => {
    // @ts-expect-error
    const userType = c.get('userType');
    if (userType !== 'admin') return c.json({ success: false, error: { message: 'Admin only' } }, 403);

    const query = c.req.valid('query');
    const page  = Math.max(1, parseInt(query.page ?? '1'));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '50')));
    const now   = new Date();

    const [sessions, countResult] = await Promise.all([
      db.select().from(authSessions)
        .where(and(eq(authSessions.isActive, true), gte(authSessions.expiresAt, now)))
        .orderBy(desc(authSessions.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      db.select({ n: sql<number>`count(*)` }).from(authSessions)
        .where(and(eq(authSessions.isActive, true), gte(authSessions.expiresAt, now))),
    ]);

    if (!sessions.length)
      return c.json({ success: true, data: { sessions: [], total: 0, page, totalPages: 0 } });

    const practIds  = [...new Set(sessions.filter(s => s.userType !== 'patient').map(s => s.userId))];
    const practRows = practIds.length
      ? await db.select({
          id: practitioners.id,
          firstNameEncrypted: practitioners.firstNameEncrypted,
          lastNameEncrypted:  practitioners.lastNameEncrypted,
          role:        practitioners.role,
          institutionId: practitioners.institutionId,
          isActive:    practitioners.isActive,
        }).from(practitioners).where(inArray(practitioners.id, practIds))
      : [];

    const instIds  = [...new Set(practRows.map(p => p.institutionId).filter(Boolean))] as string[];
    const instRows = instIds.length
      ? await db.select({ id: institutions.id, name: institutions.institutionName })
          .from(institutions).where(inArray(institutions.id, instIds))
      : [];
    const instMap  = new Map(instRows.map(i => [i.id, i.name]));
    const practMap = new Map(practRows.map(p => [p.id, p]));

    const enriched = sessions.map(s => {
      const p = practMap.get(s.userId);
      return {
        id:          s.id,
        userId:      s.userId,
        userType:    s.userType,
        userName:    p ? practitionerName(p) : 'Patient / Unknown',
        userRole:    p?.role ?? s.userType,
        institution: p?.institutionId ? (instMap.get(p.institutionId) ?? null) : null,
        isActive:    p?.isActive ?? true,
        createdAt:   s.createdAt,
        expiresAt:   s.expiresAt,
        ipAddress:   s.ipAddress,
        userAgent:   s.userAgent,
        twoFaVerified: s.twoFaVerified,
      };
    });

    const total = Number(countResult[0]?.n ?? 0);
    return c.json({ success: true, data: { sessions: enriched, total, page, totalPages: Math.ceil(total / limit) } });
  })

  // ── DELETE /sessions/user/:userId — revoke all sessions for a user ────────
  .openapi(createRoute({
    tags: ['Security'],
    summary: 'Revoke all sessions for a user (SuperAdmin)',
    method: 'delete', path: '/sessions/user/:userId',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: { params: z.object({ userId: z.string().uuid() }) },
    responses: {
      200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.any() }) } }, description: 'Sessions revoked' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
    },
    // @ts-expect-error
  }), async (c) => {
    // @ts-expect-error
    const userType = c.get('userType');
    if (userType !== 'admin') return c.json({ success: false, error: { message: 'Admin only' } }, 403);

    const { userId } = c.req.valid('param');

    const result = await db.update(authSessions)
      .set({ isActive: false })
      .where(and(eq(authSessions.userId, userId), eq(authSessions.isActive, true)))
      .returning({ id: authSessions.id });

    return c.json({ success: true, data: { revokedCount: result.length } });
  })

  // ── GET /blocked-accounts — practitioners with isActive = false ───────────
  .openapi(createRoute({
    tags: ['Security'],
    summary: 'List blocked practitioner accounts (SuperAdmin)',
    method: 'get', path: '/blocked-accounts',
    security: [{ bearerAuth: [] }],
    middleware: [authMiddleware],
    request: {
      query: z.object({
        page:  z.string().optional(),
        limit: z.string().optional(),
      }),
    },
    responses: {
      200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.any() }) } }, description: 'Blocked accounts' },
      403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
    },
    // @ts-expect-error
  }), async (c) => {
    // @ts-expect-error
    const userType      = c.get('userType');
    // @ts-expect-error
    const institutionId: string | null = c.get('institutionId') ?? null;
    if (userType !== 'admin') return c.json({ success: false, error: { message: 'Admin only' } }, 403);

    const query = c.req.valid('query');
    const page  = Math.max(1, parseInt(query.page ?? '1'));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '50')));

    const whereClause = institutionId
      ? and(eq(practitioners.isActive, false), eq(practitioners.institutionId, institutionId))
      : eq(practitioners.isActive, false);

    const [rows, countResult] = await Promise.all([
      db.select({
        id:          practitioners.id,
        firstNameEncrypted: practitioners.firstNameEncrypted,
        lastNameEncrypted:  practitioners.lastNameEncrypted,
        role:        practitioners.role,
        department:  practitioners.department,
        institutionId: practitioners.institutionId,
        isVerified:  practitioners.isVerified,
        updatedAt:   practitioners.updatedAt,
      }).from(practitioners)
        .where(whereClause)
        .orderBy(desc(practitioners.updatedAt))
        .limit(limit).offset((page - 1) * limit),
      db.select({ n: sql<number>`count(*)` }).from(practitioners).where(whereClause),
    ]);

    const instIds  = [...new Set(rows.map(r => r.institutionId).filter(Boolean))] as string[];
    const instRows = instIds.length
      ? await db.select({ id: institutions.id, name: institutions.institutionName })
          .from(institutions).where(inArray(institutions.id, instIds))
      : [];
    const instMap  = new Map(instRows.map(i => [i.id, i.name]));

    const enriched = rows.map(r => ({
      id:          r.id,
      name:        practitionerName(r),
      role:        r.role,
      department:  r.department,
      institution: r.institutionId ? (instMap.get(r.institutionId) ?? null) : null,
      isVerified:  r.isVerified,
      blockedSince: r.updatedAt,
    }));

    const total = Number(countResult[0]?.n ?? 0);
    return c.json({ success: true, data: { accounts: enriched, total, page, totalPages: Math.ceil(total / limit) } });
  });
