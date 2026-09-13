import { is } from 'drizzle-orm';
import { PgTable, getTableConfig } from 'drizzle-orm/pg-core';

// PostgreSQL truncates identifiers at a UTF-8 character boundary, to 63 bytes.
export function postgresIdentifier(name) {
  let result = '';
  for (const character of name) {
    if (Buffer.byteLength(result + character) > 63) break;
    result += character;
  }
  return result;
}

// Comparison-only workaround for drizzle-kit 0.31 treating truncated FK names
// as different constraints. Definitions remain unchanged; always restore names.
export async function withPostgresForeignKeyNames(schema, compare) {
  const restore = [];
  for (const table of Object.values(schema)) {
    if (!is(table, PgTable)) continue;
    for (const key of getTableConfig(table).foreignKeys) {
      const original = key.getName;
      const name = original.call(key);
      if (Buffer.byteLength(name) <= 63) continue;
      key.getName = () => postgresIdentifier(name);
      restore.push(() => { key.getName = original; });
    }
  }
  try { return await compare(); }
  finally { restore.forEach(fn => fn()); }
}
