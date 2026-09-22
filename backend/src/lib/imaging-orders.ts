import { z } from '@hono/zod-openapi';
import { and, eq, isNull, ne, or, sql } from 'drizzle-orm';
import { imagingOrders, visits } from '../db/schema';

export const imagingOrderSchema = z.object({
  modality: z.enum(['x-ray', 'ct_scan', 'mri', 'ultrasound', 'pet_scan', 'mammogram', 'fluoroscopy']),
  bodyPart: z.string(), indication: z.string(),
  urgency: z.enum(['routine', 'urgent', 'emergency', 'critical']).default('routine'),
  // Null in storage means one shared order, visible to hospital radiologists.
  assignedTo: z.string().uuid().optional(),
});

export function pendingImagingScope(userId: string, institutionId: string | null, isAdmin = false) {
  if (!institutionId && !isAdmin) return sql`false`;
  return and(
    ne(imagingOrders.status, 'reported'), ne(imagingOrders.status, 'cancelled'),
    institutionId ? eq(visits.institutionId, institutionId) : undefined,
    isAdmin ? undefined : or(eq(imagingOrders.assignedTo, userId), isNull(imagingOrders.assignedTo)),
  )!;
}
