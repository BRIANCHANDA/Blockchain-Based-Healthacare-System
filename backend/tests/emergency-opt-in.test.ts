import { beforeEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { PgDialect } from 'drizzle-orm/pg-core';
import { requireEmergencyOptIn } from '../src/lib/emergency-access';
import { patients, visits, crossInstitutionAccess, emergencyAccessLogs } from '../src/db/schema';

let enabled = false;
let inserts: unknown[] = [];
let reads: unknown[] = [];
let locks = 0;
let anchors = 0;
const database = {
  transaction: async (fn: (tx: any) => unknown) => fn(database),
  select: () => ({ from: (table: unknown) => ({ where: () => {
    reads.push(table);
    const rows = table === patients ? [{ id: 'patient', enabled }] : [];
    return { for: async (mode: string) => { expect(mode).toBe('update'); locks++; return rows; },
      limit: async () => rows };
  } }) }),
  insert: (table: unknown) => ({ values: () => {
    inserts.push(table);
    const query = { returning: async () => [{ id: 'grant' }], onConflictDoUpdate: () => query };
    return query;
  } }),
};
// Isolate dependency substitution: never replace shared modules in other tests.
const filename = new URL('../src/services/cross-institution.ts', import.meta.url);
const localRequire = createRequire(filename);
const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true,
} }).outputText;
const exports: any = {};
runInNewContext(compiled, { exports, console, require: (name: string) => {
  if (name === '../db') return { db: database };
  if (name === './fabric') return { storeRecordHash: async () => { anchors++; } };
  return localRequire(name);
} });
const { createEmergencyAccess, grantCrossInstitutionAccess, canAccessPatient, permittedGrant } = exports;
const grant = { patientId: 'patient', sourceInstitutionId: 'a', targetInstitutionId: 'b',
  accessType: 'emergency' as const, grantedBy: 'doctor', durationHours: 24, reason: 'Emergency requiring access' };
beforeEach(() => { enabled = false; inserts = []; reads = []; locks = 0; anchors = 0; });
describe('emergency opt-in enforcement', () => {
  test('only explicit boolean true opts in', () => {
    for (const value of [false, undefined, null, 1, 'true']) expect(() => requireEmergencyOptIn(value)).toThrow();
    expect(() => requireEmergencyOptIn(true)).not.toThrow();
  });
  test('default-off denies override before any log or ledger write', async () => {
    await expect(createEmergencyAccess('patient', 'doctor', 'b', grant.reason)).rejects.toMatchObject({ statusCode: 403 });
    expect(inserts).toEqual([]); expect(anchors).toBe(0); expect(locks).toBe(1);
  });
  test('direct emergency grant cannot bypass opt-in', async () => {
    await expect(grantCrossInstitutionAccess(grant)).rejects.toMatchObject({ statusCode: 403 });
    expect(inserts).toEqual([]); expect(anchors).toBe(0);
  });
  test('enabled patient permits logged override and grant', async () => {
    enabled = true;
    await createEmergencyAccess('patient', 'doctor', 'b', grant.reason);
    await grantCrossInstitutionAccess(grant);
    expect(inserts).toEqual([emergencyAccessLogs, crossInstitutionAccess]);
    expect(locks).toBe(2); expect(anchors).toBe(2);
  });
  test('disabling between log and grant prevents grant creation', async () => {
    enabled = true;
    await createEmergencyAccess('patient', 'doctor', 'b', grant.reason);
    enabled = false;
    await expect(grantCrossInstitutionAccess(grant)).rejects.toMatchObject({ statusCode: 403 });
    expect(inserts).toEqual([emergencyAccessLogs]);
  });
  test('ordinary referral grants do not require emergency consent', async () => {
    await grantCrossInstitutionAccess({ ...grant, accessType: 'referral' });
    expect(inserts).toEqual([crossInstitutionAccess]); expect(locks).toBe(0);
  });
  test('audit logs cannot restore revoked access', async () => {
    const result = await canAccessPatient('patient', 'b', 'doctor');
    expect(result.allowed).toBe(false);
    expect(reads).toEqual([patients, visits, crossInstitutionAccess]);
  });
  test('read predicate correlates emergency grants to current patient opt-in', () => {
    const { sql } = new PgDialect().sqlToQuery(permittedGrant);
    expect(sql).toContain('"patients"."id" = "cross_institution_access"."patient_id"');
    expect(sql).toContain('"patients"."emergency_override_enabled" = true');
    expect(sql).toContain("<> 'emergency'");
  });
});
