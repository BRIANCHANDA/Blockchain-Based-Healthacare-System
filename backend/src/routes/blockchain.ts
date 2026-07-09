import { handleError } from '../lib/errors';
// backend/src/routes/admin/blockchain.ts

import { createRoute, z } from '@hono/zod-openapi';
import { desc, sql } from 'drizzle-orm';
import { db } from '../db';
import { auditLogs } from '../db/schema';
import { createRouter } from '../lib/create-app';
import { authMiddleware } from '../middleware/auth';
import {
    getNetworkOverview, getChannelInfo, getBlockByNumber,
    getPatientPermissions, getRecordHash, getRecentFailures, clearFailureLog, getRecordHistory,
} from '../services/fabric';
const errorSchema = z.object({ success: z.boolean(), error: z.object({ message: z.string() }) });
const successSchema = z.object({ success: z.boolean(), data: z.any() });

async function requireSuperAdmin(c: any): Promise<true | { status: number; message: string }> {
    const userType = c.get('userType');
    if (userType !== 'admin') return { status: 403, message: 'Super admin access required' };
    return true;
}

export const adminBlockchainRouter = createRouter()

    .openapi(createRoute({
        tags: ['Admin · Blockchain'], summary: 'Network overview',
        method: 'get', path: '/overview',
        security: [{ bearerAuth: [] }], middleware: [authMiddleware],
        responses: {
            200: { content: { 'application/json': { schema: successSchema } }, description: 'Overview' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
        },
    }), async (c) => {
        const guard = await requireSuperAdmin(c);
        if (guard !== true) return c.json({ success: false, error: { message: guard.message } }, guard.status as 403);
        try { return c.json({ success: true, data: await getNetworkOverview() }); }
        catch (err: any) { console.error('[ADMIN_BC_OVERVIEW]', err); return c.json({ success: false, error: { message: 'Failed to query network' } }, 500); }
    })

    .openapi(createRoute({
        tags: ['Admin · Blockchain'], summary: 'Recent blocks',
        method: 'get', path: '/blocks',
        security: [{ bearerAuth: [] }], middleware: [authMiddleware],
        request: { query: z.object({ limit: z.string().regex(/^\d+$/).transform(Number).optional().default('10') }) },
        responses: {
            200: { content: { 'application/json': { schema: successSchema } }, description: 'Blocks' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
        },
    }), async (c) => {
        const guard = await requireSuperAdmin(c);
        if (guard !== true) return c.json({ success: false, error: { message: guard.message } }, guard.status as 403);
        const { limit } = c.req.valid('query');
        try {
            const chain = await getChannelInfo('hospital');
            if (chain.height === 0) return c.json({ success: true, data: { blocks: [], height: 0 } });
            const start = Math.max(0, chain.height - limit);
            const blockNumbers = Array.from({ length: chain.height - start }, (_, i) => chain.height - 1 - i);
            const blocks = await Promise.all(blockNumbers.map(n => getBlockByNumber(n)));
            return c.json({ success: true, data: { blocks: blocks.filter(Boolean), height: chain.height } });
        } catch (err: any) {
            console.error('[ADMIN_BC_BLOCKS]', err);
            return c.json({ success: false, error: { message: 'Failed to query blocks' } }, 500);
        }
    })

    .openapi(createRoute({
        tags: ['Admin · Blockchain'], summary: 'Recent on-chain transactions',
        method: 'get', path: '/transactions',
        security: [{ bearerAuth: [] }], middleware: [authMiddleware],
        request: {
            query: z.object({
                limit: z.string().regex(/^\d+$/).transform(Number).optional().default('50'),
                offset: z.string().regex(/^\d+$/).transform(Number).optional().default('0'),
            }),
        },
        responses: {
            200: { content: { 'application/json': { schema: successSchema } }, description: 'Transactions' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
        },
    }), async (c) => {
        const guard = await requireSuperAdmin(c);
        if (guard !== true) return c.json({ success: false, error: { message: guard.message } }, guard.status as 403);
        const { limit, offset } = c.req.valid('query');
        try {
            const rows = await db.select({
                id: auditLogs.id, userId: auditLogs.userId, userType: auditLogs.userType,
                actionType: auditLogs.actionType, resourceType: auditLogs.resourceType,
                resourceId: auditLogs.resourceId, blockchainTxId: auditLogs.blockchainTransactionId,
                ipAddress: auditLogs.ipAddress, createdAt: auditLogs.createdAt,
            })
                .from(auditLogs)
                .where(sql`${auditLogs.blockchainTransactionId} IS NOT NULL`)
                .orderBy(desc(auditLogs.createdAt))
                .limit(limit).offset(offset);

            const stats = await db.execute(sql`
        SELECT resource_type, COUNT(*)::int AS count FROM audit_logs
        WHERE blockchain_transaction_id IS NOT NULL
        GROUP BY resource_type ORDER BY count DESC
      `);
            return c.json({ success: true, data: { transactions: rows, total: rows.length, byResource: stats as any[] } });
        } catch (err: any) {
            console.error('[ADMIN_BC_TX]', err);
            return c.json({ success: false, error: { message: 'Failed to load transactions' } }, 500);
        }
    })

    .openapi(createRoute({
        tags: ['Admin · Blockchain'], summary: 'Verify a record on the ledger',
        method: 'post', path: '/verify',
        security: [{ bearerAuth: [] }], middleware: [authMiddleware],
        request: {
            body: {
                content: {
                    'application/json': {
                        schema: z.object({
                            recordId: z.string().min(1),
                            sha256Hash: z.string().min(1).optional(),
                        })
                    }
                }
            },
        },
        responses: {
            200: { content: { 'application/json': { schema: successSchema } }, description: 'Result' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
        },
    }), async (c) => {
        const guard = await requireSuperAdmin(c);
        if (guard !== true) return c.json({ success: false, error: { message: guard.message } }, guard.status as 403);
        const { recordId, sha256Hash } = c.req.valid('json');
        try {
            const record = await getRecordHash(recordId);
            if (!record) return c.json({ success: true, data: { found: false, recordId, message: 'Record not found on ledger' } });
            const matches = sha256Hash ? record.sha256Hash === sha256Hash : null;
            return c.json({ success: true, data: { found: true, matches, recordId, record } });
        } catch (err: any) {
            console.error('[ADMIN_BC_VERIFY]', err);
            return c.json({ success: false, error: { message: 'Verification failed' } }, 500);
        }
    })

    .openapi(createRoute({
        tags: ['Admin · Blockchain'], summary: 'List records that can be verified on-chain',
        method: 'get', path: '/searchable-records',
        security: [{ bearerAuth: [] }], middleware: [authMiddleware],
        request: {
            query: z.object({
                type: z.string().optional(),
                limit: z.string().regex(/^\d+$/).transform(Number).optional().default('50'),
            })
        },
        responses: {
            200: { content: { 'application/json': { schema: successSchema } }, description: 'Records' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
        },
    }), async (c) => {
        const guard = await requireSuperAdmin(c);
        if (guard !== true) return c.json({ success: false, error: { message: guard.message } }, guard.status as 403);
        const { type, limit } = c.req.valid('query');
        try {
            const q = type
                ? sql`
            SELECT DISTINCT ON (resource_id)
              resource_id AS "recordId",
              resource_type AS "recordType",
              created_at AS "anchoredAt",
              blockchain_transaction_id AS "txId"
            FROM audit_logs
            WHERE blockchain_transaction_id IS NOT NULL AND resource_type = ${type}
            ORDER BY resource_id, created_at DESC LIMIT ${limit}
          `
                : sql`
            SELECT DISTINCT ON (resource_id)
              resource_id AS "recordId",
              resource_type AS "recordType",
              created_at AS "anchoredAt",
              blockchain_transaction_id AS "txId"
            FROM audit_logs
            WHERE blockchain_transaction_id IS NOT NULL
            ORDER BY resource_id, created_at DESC LIMIT ${limit}
          `;
            const rows = await db.execute(q);
            return c.json({
                success: true,
                data: {
                    records: (rows as any[]).map(r => ({
                        recordId: r.recordId,
                        recordType: r.recordType,
                        anchoredAt: r.anchoredAt ? new Date(r.anchoredAt).toISOString() : null,
                        txId: r.txId,
                    })),
                },
            });
        } catch (err: any) {
            console.error('[ADMIN_BC_SEARCHABLE]', err);
            return c.json({ success: false, error: { message: 'Failed to list records' } }, 500);
        }
    })

    // ── GET /failures — chain write failures with categorisation ──────────────
    .openapi(createRoute({
        tags: ['Admin · Blockchain'], summary: 'Recent blockchain anchor failures',
        method: 'get', path: '/failures',
        security: [{ bearerAuth: [] }], middleware: [authMiddleware],
        responses: {
            200: { content: { 'application/json': { schema: successSchema } }, description: 'Failures' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
        },
    }), async (c) => {
        const guard = await requireSuperAdmin(c);
        if (guard !== true) return c.json({ success: false, error: { message: guard.message } }, guard.status as 403);
        try {
            const failures = getRecentFailures();
            const byCategory: Record<string, number> = {};
            for (const f of failures) {
                byCategory[f.category] = (byCategory[f.category] ?? 0) + 1;
            }
            return c.json({ success: true, data: { failures, total: failures.length, byCategory } });
        } catch (err: any) {
            console.error('[ADMIN_BC_FAILURES]', err);
            return c.json({ success: false, error: { message: 'Failed to load failures' } }, 500);
        }
    })

    // ── DELETE /failures — clear the log ──────────────────────────────────────
    .openapi(createRoute({
        tags: ['Admin · Blockchain'], summary: 'Clear failure log',
        method: 'delete', path: '/failures',
        security: [{ bearerAuth: [] }], middleware: [authMiddleware],
        responses: {
            200: { content: { 'application/json': { schema: successSchema } }, description: 'Cleared' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
        },
    }), async (c) => {
        const guard = await requireSuperAdmin(c);
        if (guard !== true) return c.json({ success: false, error: { message: guard.message } }, guard.status as 403);
        clearFailureLog();
        return c.json({ success: true, data: { message: 'Failure log cleared' } });
    })

    .openapi(createRoute({
        tags: ['Admin · Blockchain'], summary: 'Patient permissions on-chain',
        method: 'get', path: '/permissions/:patientAddress',
        security: [{ bearerAuth: [] }], middleware: [authMiddleware],
        request: { params: z.object({ patientAddress: z.string() }) },
        responses: {
            200: { content: { 'application/json': { schema: successSchema } }, description: 'Permissions' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
        },
    }), async (c) => {
        const guard = await requireSuperAdmin(c);
        if (guard !== true) return c.json({ success: false, error: { message: guard.message } }, guard.status as 403);
        const { patientAddress } = c.req.valid('param');
        try {
            const perms = await getPatientPermissions(patientAddress);
            return c.json({ success: true, data: { permissions: perms } });
        } catch (err: any) {
            console.error('[ADMIN_BC_PERMS]', err);
            return c.json({ success: false, error: { message: 'Failed to query permissions' } }, 500);
        }
    })

    .openapi(createRoute({
        tags: ['Admin · Blockchain'], summary: 'Dashboard statistics',
        method: 'get', path: '/stats',
        security: [{ bearerAuth: [] }], middleware: [authMiddleware],
        responses: {
            200: { content: { 'application/json': { schema: successSchema } }, description: 'Stats' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
        },
    }), async (c) => {
        const guard = await requireSuperAdmin(c);
        if (guard !== true) return c.json({ success: false, error: { message: guard.message } }, guard.status as 403);
        try {
            const [patientCount, practitionerCount, institutionCount, anchoredCount, txByDay] = await Promise.all([
                db.execute(sql`SELECT COUNT(*)::int AS n FROM patients WHERE is_active = true`),
                db.execute(sql`SELECT COUNT(*)::int AS n FROM practitioners WHERE is_active = true`),
                db.execute(sql`SELECT COUNT(*)::int AS n FROM institutions WHERE is_active = true`),
                db.execute(sql`SELECT COUNT(*)::int AS n FROM audit_logs WHERE blockchain_transaction_id IS NOT NULL`),
                db.execute(sql`
          SELECT DATE(created_at) AS day, COUNT(*)::int AS count
          FROM audit_logs
          WHERE blockchain_transaction_id IS NOT NULL
            AND created_at > NOW() - INTERVAL '14 days'
          GROUP BY DATE(created_at) ORDER BY day ASC
        `),
            ]);
            return c.json({
                success: true,
                data: {
                    patients: (patientCount as any[])[0]?.n ?? 0,
                    practitioners: (practitionerCount as any[])[0]?.n ?? 0,
                    institutions: (institutionCount as any[])[0]?.n ?? 0,
                    anchoredTxs: (anchoredCount as any[])[0]?.n ?? 0,
                    txByDay: (txByDay as any[]).map(r => ({ day: new Date(r.day).toISOString(), count: Number(r.count) })),
                },
            });
        } catch (err: any) {
            console.error('[ADMIN_BC_STATS]', err);
            return c.json({ success: false, error: { message: 'Failed to load stats' } }, 500);
        }
    })

    // ── Append to backend/src/routes/admin/blockchain.ts ─────────────────────────
    //
    // 1. Add `getRecordHistory` to the import from '../../services/fabric'
    // 2. Add this endpoint to the router, before the closing semicolon.

    // ── GET /history/:recordId — full version history of a record ────────────
    .openapi(createRoute({
        tags: ['Admin · Blockchain'],
        summary: 'Get full version history of a record from the ledger',
        method: 'get',
        path: '/history/:recordId',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        request: { params: z.object({ recordId: z.string().min(1) }) },
        responses: {
            200: { content: { 'application/json': { schema: successSchema } }, description: 'History' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
        },
    }), async (c) => {
        const guard = await requireSuperAdmin(c);
        if (guard !== true) return c.json({ success: false, error: { message: guard.message } }, guard.status as 403);

        const { recordId } = c.req.valid('param');
        try {
            const history = await getRecordHistory(recordId);

            // Normalize timestamps and parse the inner record value where possible
            const normalized = history.map((h: any) => {
                let parsedValue: any = null;
                try {
                    if (typeof h.value === 'object') {
                        parsedValue = h.value;
                    } else if (typeof h.value === 'string') {
                        parsedValue = JSON.parse(h.value);
                    }
                } catch {
                    parsedValue = h.value;
                }

                // Fabric timestamp format: { seconds: { low, high }, nanos } OR ISO string
                let timestampIso: string | null = null;
                try {
                    if (typeof h.timestamp === 'string') {
                        timestampIso = h.timestamp;
                    } else if (h.timestamp?.seconds) {
                        const seconds = typeof h.timestamp.seconds === 'object'
                            ? h.timestamp.seconds.low
                            : h.timestamp.seconds;
                        timestampIso = new Date(seconds * 1000).toISOString();
                    }
                } catch { }

                return {
                    txId: h.txId,
                    timestamp: timestampIso,
                    isDelete: !!h.isDelete,
                    value: parsedValue,
                };
            });

            // Sort newest first
            normalized.sort((a, b) => {
                if (!a.timestamp) return 1;
                if (!b.timestamp) return -1;
                return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
            });

            return c.json({
                success: true,
                data: {
                    recordId,
                    totalVersions: normalized.length,
                    history: normalized,
                },
            });
        } catch (err: any) {
            console.error('[ADMIN_BC_HISTORY]', err);
            return c.json({ success: false, error: { message: 'Failed to fetch history' } }, 500);
        }
    });