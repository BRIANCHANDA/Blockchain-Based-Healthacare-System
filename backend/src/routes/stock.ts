/**
 * Pharmacy stock — the dispensary's inventory of medications.
 *
 * Quantities here move for two different reasons and only one of them lives in
 * this file. Restocking and manual correction are explicit endpoints below;
 * dispensing decrements stock as a side effect of fulfilling a prescription in
 * the pharmacy flow. Anything reconciling stock has to account for both.
 *
 * Stock is per-institution: each hospital pharmacy holds its own quantities of
 * the same drug, so rows are scoped by institutionId and a low-stock alert is
 * meaningful only within one institution.
 *
 * CAUTION: DELETE /:id is a HARD delete, and it removes the stock_movements
 * history for the drug along with the row. Unlike most of this codebase — where
 * clinical rows are deactivated so old references keep resolving — the movement
 * audit trail for that item does not survive. Deactivating instead would be the
 * safer behaviour if the dispensing history is ever needed retrospectively.
 */

import { handleError } from '../lib/errors';
// src/routes/stock.ts
// Mount as: app.route('/api/stock', stockRouter)
// Pharmacy inventory management — institution-scoped.

import { createRoute, z } from '@hono/zod-openapi';
import { eq, and, sql, desc, lte } from 'drizzle-orm';
import { db } from '../db';
import { medicationStock, stockMovements, practitioners } from '../db/schema';
import { createRouter } from '../lib/create-app';
import { authMiddleware } from '../middleware/auth';
import { optionalIsoDate as vOptionalIsoDate, optionalFutureDate as vOptionalFutureDate } from '../lib/validators';

const errorSchema = z.object({ success: z.boolean(), error: z.object({ message: z.string() }) });
const successSchema = z.object({ success: z.boolean(), data: z.any() });

async function getStaffInstitution(userId: string): Promise<string | null> {
    const rows = await db.select({ institutionId: practitioners.institutionId }).from(practitioners).where(eq(practitioners.id, userId)).limit(1);
    return rows[0]?.institutionId ?? null;
}

const stockBodySchema = z.object({
    medicationName: z.string().min(1),
    genericName: z.string().optional(),
    strength: z.string().min(1),
    dosageForm: z.string().min(1),
    unit: z.string().default('units'),
    quantity: z.number().int().min(0),
    reorderLevel: z.number().int().min(0).default(10),
    batchNumber: z.string().optional(),
    // A real, plausible date — NOT necessarily a future one.
    //
    // This was briefly vFutureDate, which broke editing: the schema is shared by
    // create and update, and 16 existing rows already hold a past expiry. A
    // pharmacist must be able to open expired stock to correct a quantity or
    // record its disposal — tracking expired medication is precisely what a
    // pharmacy system is for, so it has to be representable.
    //
    // Rejecting an already-expired delivery still happens, but on restock below,
    // where genuinely new stock is being received.
    //
    // clinicalDate was tried here too and was also wrong: it caps at one year
    // ahead, which suits a diagnosis date but not a medication expiry — 77 of
    // 124 rows expire further out than that. Any real date is accepted; the
    // rule's job is to reject "banana", not to second-guess a shelf life.
    expiryDate: vOptionalIsoDate,
    supplier: z.string().optional(),
});

export const stockRouter = createRouter()

    // ── LIST STOCK ──────────────────────────────────────────────────────────
    .openapi(createRoute({
        tags: ['Stock'], summary: 'List medication stock for the institution',
        method: 'get', path: '/',
        security: [{ bearerAuth: [] }], middleware: [authMiddleware],
        request: { query: z.object({ search: z.string().optional(), lowOnly: z.string().optional() }) },
        responses: {
            200: { content: { 'application/json': { schema: successSchema } }, description: 'Stock list' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
        },
        // @ts-expect-error
    }), async (c) => {
        try {
            const userType = c.get('userType');
            const userId = c.get('userId');
            if (!['pharmacist', 'admin'].includes(userType))
                return c.json({ success: false, error: { message: 'Access denied' } }, 403);

            const institutionId = await getStaffInstitution(userId);
            if (!institutionId) return c.json({ success: false, error: { message: 'No institution associated' } }, 403);

            const { search, lowOnly } = c.req.valid('query');

            const conditions = [eq(medicationStock.institutionId, institutionId)];
            if (lowOnly === 'true') conditions.push(lte(medicationStock.quantity, medicationStock.reorderLevel) as any);

            let rows = await db.select().from(medicationStock).where(and(...conditions)).orderBy(medicationStock.medicationName);

            if (search?.trim()) {
                const q = search.toLowerCase();
                rows = rows.filter(r =>
                    r.medicationName.toLowerCase().includes(q) ||
                    (r.genericName?.toLowerCase().includes(q) ?? false)
                );
            }

            const totalItems = rows.length;
            const lowStock = rows.filter(r => r.quantity <= r.reorderLevel).length;
            const outOfStock = rows.filter(r => r.quantity === 0).length;
            const expiringSoon = rows.filter(r => {
                if (!r.expiryDate) return false;
                const days = (new Date(r.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
                return days >= 0 && days <= 90;
            }).length;

            return c.json({ success: true, data: { stock: rows, stats: { totalItems, lowStock, outOfStock, expiringSoon } } });
        } catch (err: any) {
            console.error('[STOCK_LIST]', err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    })

    // ── ADD STOCK ITEM ────────────────────────────────────────────────────────
    .openapi(createRoute({
        tags: ['Stock'], summary: 'Add a new stock item',
        method: 'post', path: '/',
        security: [{ bearerAuth: [] }], middleware: [authMiddleware],
        request: { body: { content: { 'application/json': { schema: stockBodySchema } } } },
        responses: {
            201: { content: { 'application/json': { schema: successSchema } }, description: 'Created' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
        },
        // @ts-expect-error
    }), async (c) => {
        try {
            const userType = c.get('userType');
            const userId = c.get('userId');
            if (!['pharmacist', 'admin'].includes(userType))
                return c.json({ success: false, error: { message: 'Access denied' } }, 403);

            const institutionId = await getStaffInstitution(userId);
            if (!institutionId) return c.json({ success: false, error: { message: 'No institution associated' } }, 403);

            const body = c.req.valid('json');
            const [created] = await db.insert(medicationStock).values({
                institutionId,
                medicationName: body.medicationName,
                genericName: body.genericName ?? null,
                strength: body.strength,
                dosageForm: body.dosageForm,
                unit: body.unit,
                quantity: body.quantity,
                reorderLevel: body.reorderLevel,
                batchNumber: body.batchNumber ?? null,
                expiryDate: body.expiryDate ?? null,
                supplier: body.supplier ?? null,
            }).returning();

            // Log initial stock as a movement
            if (body.quantity > 0) {
                await db.insert(stockMovements).values({
                    stockId: created.id, institutionId, changeType: 'restock',
                    quantityChange: body.quantity, quantityAfter: body.quantity,
                    performedBy: userId, notes: 'Initial stock entry',
                });
            }

            return c.json({ success: true, data: { stock: created } }, 201);
        } catch (err: any) {
            console.error('[STOCK_ADD]', err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    })

    // ── UPDATE STOCK ITEM ───────────────────────────────────────────────────
    .openapi(createRoute({
        tags: ['Stock'], summary: 'Update a stock item',
        method: 'patch', path: '/:id',
        security: [{ bearerAuth: [] }], middleware: [authMiddleware],
        request: {
            params: z.object({ id: z.string().uuid() }),
            body: { content: { 'application/json': { schema: stockBodySchema.partial() } } },
        },
        responses: {
            200: { content: { 'application/json': { schema: successSchema } }, description: 'Updated' },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
        },
        // @ts-expect-error
    }), async (c) => {
        try {
            const userType = c.get('userType');
            const userId = c.get('userId');
            if (!['pharmacist', 'admin'].includes(userType))
                return c.json({ success: false, error: { message: 'Access denied' } }, 403);

            const institutionId = await getStaffInstitution(userId);
            const { id } = c.req.valid('param');
            const body = c.req.valid('json');

            const existing = await db.select().from(medicationStock).where(and(eq(medicationStock.id, id), eq(medicationStock.institutionId, institutionId!))).limit(1);
            if (!existing.length) return c.json({ success: false, error: { message: 'Stock item not found' } }, 404);

            const oldQty = existing[0].quantity;

            const [updated] = await db.update(medicationStock).set({
                ...(body.medicationName !== undefined && { medicationName: body.medicationName }),
                ...(body.genericName !== undefined && { genericName: body.genericName }),
                ...(body.strength !== undefined && { strength: body.strength }),
                ...(body.dosageForm !== undefined && { dosageForm: body.dosageForm }),
                ...(body.unit !== undefined && { unit: body.unit }),
                ...(body.quantity !== undefined && { quantity: body.quantity }),
                ...(body.reorderLevel !== undefined && { reorderLevel: body.reorderLevel }),
                ...(body.batchNumber !== undefined && { batchNumber: body.batchNumber }),
                ...(body.expiryDate !== undefined && { expiryDate: body.expiryDate }),
                ...(body.supplier !== undefined && { supplier: body.supplier }),
                updatedAt: new Date(),
            }).where(eq(medicationStock.id, id)).returning();

            // Log manual quantity adjustment
            if (body.quantity !== undefined && body.quantity !== oldQty) {
                await db.insert(stockMovements).values({
                    stockId: id, institutionId: institutionId!, changeType: 'adjustment',
                    quantityChange: body.quantity - oldQty, quantityAfter: body.quantity,
                    performedBy: userId, notes: 'Manual stock adjustment',
                });
            }

            return c.json({ success: true, data: { stock: updated } });
        } catch (err: any) {
            console.error('[STOCK_UPDATE]', err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    })

    // ── RESTOCK (add quantity) ──────────────────────────────────────────────
    .openapi(createRoute({
        tags: ['Stock'], summary: 'Add quantity to existing stock',
        method: 'post', path: '/:id/restock',
        security: [{ bearerAuth: [] }], middleware: [authMiddleware],
        request: {
            params: z.object({ id: z.string().uuid() }),
            body: { content: { 'application/json': { schema: z.object({ quantity: z.number().int().positive(), batchNumber: z.string().optional(), expiryDate: vOptionalFutureDate, notes: z.string().optional() }) } } },
        },
        responses: {
            200: { content: { 'application/json': { schema: successSchema } }, description: 'Restocked' },
            404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
        },
        // @ts-expect-error
    }), async (c) => {
        try {
            const userType = c.get('userType');
            const userId = c.get('userId');
            if (!['pharmacist', 'admin'].includes(userType))
                return c.json({ success: false, error: { message: 'Access denied' } }, 403);

            const institutionId = await getStaffInstitution(userId);
            const { id } = c.req.valid('param');
            const { quantity, batchNumber, expiryDate, notes } = c.req.valid('json');

            const existing = await db.select().from(medicationStock).where(and(eq(medicationStock.id, id), eq(medicationStock.institutionId, institutionId!))).limit(1);
            if (!existing.length) return c.json({ success: false, error: { message: 'Stock item not found' } }, 404);

            const newQty = existing[0].quantity + quantity;
            const [updated] = await db.update(medicationStock).set({
                quantity: newQty,
                ...(batchNumber && { batchNumber }),
                ...(expiryDate && { expiryDate }),
                updatedAt: new Date(),
            }).where(eq(medicationStock.id, id)).returning();

            await db.insert(stockMovements).values({
                stockId: id, institutionId: institutionId!, changeType: 'restock',
                quantityChange: quantity, quantityAfter: newQty,
                performedBy: userId, notes: notes ?? 'Restocked',
            });

            return c.json({ success: true, data: { stock: updated } });
        } catch (err: any) {
            console.error('[STOCK_RESTOCK]', err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    })

    // ── DELETE STOCK ITEM ───────────────────────────────────────────────────
    .openapi(createRoute({
        tags: ['Stock'], summary: 'Delete a stock item',
        method: 'delete', path: '/:id',
        security: [{ bearerAuth: [] }], middleware: [authMiddleware],
        request: { params: z.object({ id: z.string().uuid() }) },
        responses: {
            200: { content: { 'application/json': { schema: successSchema } }, description: 'Deleted' },
            404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
        },
        // @ts-expect-error
    }), async (c) => {
        try {
            const userType = c.get('userType');
            const userId = c.get('userId');
            if (!['pharmacist', 'admin'].includes(userType))
                return c.json({ success: false, error: { message: 'Access denied' } }, 403);

            const institutionId = await getStaffInstitution(userId);
            const { id } = c.req.valid('param');

            const existing = await db.select().from(medicationStock).where(and(eq(medicationStock.id, id), eq(medicationStock.institutionId, institutionId!))).limit(1);
            if (!existing.length) return c.json({ success: false, error: { message: 'Stock item not found' } }, 404);

            await db.delete(stockMovements).where(eq(stockMovements.stockId, id));
            await db.delete(medicationStock).where(eq(medicationStock.id, id));

            return c.json({ success: true, data: { message: 'Stock item deleted' } });
        } catch (err: any) {
            console.error('[STOCK_DELETE]', err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    });