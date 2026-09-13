import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pgTable, uuid, getTableConfig } from 'drizzle-orm/pg-core';
import { postgresIdentifier, withPostgresForeignKeyNames } from '../scripts/pg-identifiers.mjs';

test('PostgreSQL identifier truncation respects bytes and UTF-8 boundaries', () => {
  assert.equal(postgresIdentifier('short_name'), 'short_name');
  assert.equal(postgresIdentifier('x'.repeat(70)), 'x'.repeat(63));
  assert.equal(postgresIdentifier('é'.repeat(40)), 'é'.repeat(31));
});

test('comparison normalizes only foreign-key names and restores them afterwards', async () => {
  const destination = pgTable('destination_with_a_long_descriptive_table_name', { id: uuid().primaryKey() });
  const source = pgTable('source_with_a_long_descriptive_table_name', {
    destinationId: uuid('destination_id').references(() => destination.id, { onDelete: 'cascade' }),
  });
  const key = getTableConfig(source).foreignKeys[0];
  const original = key.getName();
  assert.ok(Buffer.byteLength(original) > 63);
  const result = await withPostgresForeignKeyNames({ source, destination, unrelated: 1 }, async () => {
    assert.equal(key.getName(), postgresIdentifier(original));
    assert.equal(key.reference().foreignColumns[0], destination.id);
    assert.equal(key.reference().columns[0], source.destinationId);
    assert.equal(key.onDelete, 'cascade');
    return 'verified';
  });
  assert.equal(result, 'verified');
  assert.equal(key.getName(), original);
  await assert.rejects(withPostgresForeignKeyNames({ source }, async () => { throw new Error('inspection failed'); }));
  assert.equal(key.getName(), original);
});
