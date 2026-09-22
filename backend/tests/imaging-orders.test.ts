import { describe, expect, test } from 'bun:test';
import { PgDialect } from 'drizzle-orm/pg-core';
import { imagingOrderSchema, pendingImagingScope } from '../src/lib/imaging-orders';

describe('imaging assignment', () => {
  const order = { modality: 'x-ray', bodyPart: 'Chest', indication: 'Clinical review' };
  test('accepts a shared order without a radiologist and retains urgency defaults', () => {
    const parsed = imagingOrderSchema.parse(order);
    expect(parsed.assignedTo).toBeUndefined();
    expect(parsed.urgency).toBe('routine');
  });
  test('accepts a valid personal assignment and rejects malformed IDs', () => {
    const id = 'b9b7fd64-6ad2-4a12-9021-a2015bd283ad';
    expect(imagingOrderSchema.parse({ ...order, assignedTo: id }).assignedTo).toBe(id);
    for (const assignedTo of ['', 'not-a-uuid', null]) {
      expect(imagingOrderSchema.safeParse({ ...order, assignedTo }).success).toBe(false);
    }
  });
});

describe('radiologist queue visibility', () => {
  const dialect = new PgDialect();
  test('personal OR unassigned orders remain AND-scoped to the hospital', () => {
    const query = dialect.sqlToQuery(pendingImagingScope('rad-a', 'hospital-a'));
    expect(query.sql).toContain('"visits"."institution_id" =');
    expect(query.sql).toContain('("imaging_orders"."assigned_to" =');
    expect(query.sql).toContain('or "imaging_orders"."assigned_to" is null)');
    expect(query.params).toEqual(['reported', 'cancelled', 'hospital-a', 'rad-a']);
  });
  test('each radiologist gets their own personal scope plus the same shared branch', () => {
    const a = dialect.sqlToQuery(pendingImagingScope('rad-a', 'hospital-a'));
    const b = dialect.sqlToQuery(pendingImagingScope('rad-b', 'hospital-a'));
    const otherHospital = dialect.sqlToQuery(pendingImagingScope('rad-c', 'hospital-b'));
    expect(a.sql).toBe(b.sql);
    expect(b.params).toEqual(['reported', 'cancelled', 'hospital-a', 'rad-b']);
    expect(otherHospital.params).toEqual(['reported', 'cancelled', 'hospital-b', 'rad-c']);
  });
  test('a radiologist with no hospital cannot see any queue', () => {
    expect(dialect.sqlToQuery(pendingImagingScope('rad-a', null)).sql).toBe('false');
  });
  test('hospital admins retain hospital-wide visibility', () => {
    const query = dialect.sqlToQuery(pendingImagingScope('admin', 'hospital-a', true));
    expect(query.params).toEqual(['reported', 'cancelled', 'hospital-a']);
    expect(query.sql).not.toContain('assigned_to');
  });
  test('super admins retain global visibility over pending orders', () => {
    const query = dialect.sqlToQuery(pendingImagingScope('admin', null, true));
    expect(query.params).toEqual(['reported', 'cancelled']);
    expect(query.sql).not.toContain('institution_id');
  });
});
