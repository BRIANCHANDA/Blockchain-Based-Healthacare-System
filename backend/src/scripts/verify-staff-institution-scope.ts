// backend/src/scripts/verify-staff-institution-scope.ts
//
// Verifies who gets to choose the hospital when adding staff.
//
//   Hospital admin  → always their own institution; a body value is ignored.
//   Super admin     → chooses, and must name one.
//
// The UI hides the selector for hospital admins, but that is only cosmetic —
// these checks prove the server does not trust the client.
//
//   DATABASE_URL=postgresql://postgres:postgres@localhost:5433/healthcare_test \
//     API_URL=http://localhost:3010 \
//     bun run src/scripts/verify-staff-institution-scope.ts

import { sign } from 'jsonwebtoken';
import crypto from 'crypto';
import { eq, inArray, like, or } from 'drizzle-orm';
import { db } from '../db';
import { authSessions, institutions, practitioners } from '../db/schema';
import { encrypt } from '../services/crypto';

const API = process.env.API_URL ?? 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'healthcare_jwt_secret';

let passed = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail?: string) {
  if (ok) { passed++; console.log(`  PASS  ${label}`); }
  else { failures.push(label); console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`); }
}

const tag = Date.now();

// Everything this script creates is tagged, so cleanup can find it precisely.
// Runs even on failure — this script is safe to point at a real database.
async function cleanup() {
  const pracIds = (await db.select({ id: practitioners.id }).from(practitioners)
    .where(or(
      like(practitioners.licenseNumber, 'LIC-SCOPE-%'),
      like(practitioners.licenseNumber, 'LIC-ADM-%'),
      like(practitioners.licenseNumber, 'LIC-NEW-%'),
    )))
    .map((r) => r.id);
  const instIds = (await db.select({ id: institutions.id }).from(institutions)
    .where(like(institutions.institutionCode, 'SCOPE-%')))
    .map((r) => r.id);

  if (pracIds.length) {
    await db.delete(authSessions).where(inArray(authSessions.userId, pracIds));
    await db.delete(practitioners).where(inArray(practitioners.id, pracIds));
  }
  if (instIds.length) await db.delete(institutions).where(inArray(institutions.id, instIds));
}

async function makeInstitution(letter: string) {
  const [inst] = await db.insert(institutions).values({
    institutionCode: `SCOPE-${letter}-${tag}`,
    institutionName: `Scope Test Hospital ${letter} ${tag}`,
    institutionType: 'hospital',
    blockchainAddress: `0xscope${letter}${tag}`,
    addressEncrypted: encrypt(`${letter} Street`),
    phoneEncrypted: encrypt('+260970000009'),
    licenseNumber: `LIC-SCOPE-${letter}-${tag}`,
  }).returning({ id: institutions.id });
  return inst.id;
}

async function makeAdmin(label: string, institutionId: string | null) {
  const [admin] = await db.insert(practitioners).values({
    blockchainAddress: `0x${crypto.randomBytes(10).toString('hex')}`,
    institutionId,
    firstNameEncrypted: encrypt(label),
    lastNameEncrypted: encrypt('Admin'),
    phoneNumberEncrypted: encrypt('+260976666666'),
    emailEncrypted: encrypt(`${label.toLowerCase()}${tag}@test.local`),
    licenseNumber: `LIC-ADM-${label}-${tag}`,
    institutionalId: `INST-ADM-${label}-${tag}`,
    specialization: 'admin',
    role: 'admin',
    passwordHash: 'x',
    isVerified: true,
    isActive: true,
  }).returning({ id: practitioners.id });

  const token = sign({ userId: admin.id, userType: 'admin', blockchainAddress: 'x' }, JWT_SECRET, { expiresIn: '1h' });
  await db.insert(authSessions).values({
    userId: admin.id, userType: 'admin', jwtToken: token,
    refreshToken: `scope-${label}-${tag}`,
    expiresAt: new Date(Date.now() + 3600_000), isActive: true,
  });
  return { id: admin.id, token };
}

function staffPayload(suffix: string, institutionId?: string) {
  return {
    firstName: 'New', lastName: `Staff${suffix}`,
    role: 'nurse',
    licenseNumber: `LIC-NEW-${suffix}-${tag}`,
    institutionalId: `INST-NEW-${suffix}-${tag}`,
    phoneNumber: '+260977777777',
    email: `newstaff${suffix}${tag}@test.local`,
    ...(institutionId ? { institutionId } : {}),
  };
}

async function postStaff(token: string, body: object) {
  const res = await fetch(`${API}/api/auth/register/staff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) as any };
}

async function institutionOf(staffId: string) {
  const [row] = await db.select({ institutionId: practitioners.institutionId })
    .from(practitioners).where(eq(practitioners.id, staffId)).limit(1);
  return row?.institutionId ?? null;
}

async function main() {
  const hospA = await makeInstitution('A');
  const hospB = await makeInstitution('B');
  const hospitalAdmin = await makeAdmin('HospA', hospA);
  const superAdmin = await makeAdmin('Super', null);

  console.log(`hospital A = ${hospA}`);
  console.log(`hospital B = ${hospB}\n`);

  // ── 1. Hospital admin cannot plant staff at another hospital ────────────
  console.log('1. Hospital admin at A, body says hospital B');
  const r1 = await postStaff(hospitalAdmin.token, staffPayload('one', hospB));
  check('staff created', r1.status === 201, `status ${r1.status} ${JSON.stringify(r1.body).slice(0, 150)}`);
  const inst1 = r1.body?.data?.staffId ? await institutionOf(r1.body.data.staffId) : null;
  check("the body's hospital B was ignored", inst1 !== hospB, `landed at ${inst1}`);
  check('staff landed at the admin’s own hospital A', inst1 === hospA, `landed at ${inst1}`);

  // ── 2. Hospital admin sending no institution still works ────────────────
  console.log('\n2. Hospital admin at A, no institutionId sent (what the UI now does)');
  const r2 = await postStaff(hospitalAdmin.token, staffPayload('two'));
  check('staff created without naming a hospital', r2.status === 201, `status ${r2.status} ${JSON.stringify(r2.body).slice(0, 150)}`);
  const inst2 = r2.body?.data?.staffId ? await institutionOf(r2.body.data.staffId) : null;
  check('staff defaulted to hospital A', inst2 === hospA, `landed at ${inst2}`);

  // ── 3. Super admin chooses freely ──────────────────────────────────────
  console.log('\n3. Super admin selects hospital B');
  const r3 = await postStaff(superAdmin.token, staffPayload('three', hospB));
  check('staff created', r3.status === 201, `status ${r3.status} ${JSON.stringify(r3.body).slice(0, 150)}`);
  const inst3 = r3.body?.data?.staffId ? await institutionOf(r3.body.data.staffId) : null;
  check('super admin’s choice of hospital B was honoured', inst3 === hospB, `landed at ${inst3}`);

  // ── 4. Super admin must name one ───────────────────────────────────────
  console.log('\n4. Super admin sends no institutionId');
  const r4 = await postStaff(superAdmin.token, staffPayload('four'));
  check('rejected with 400', r4.status === 400, `status ${r4.status}`);
  check(
    'the error explains a hospital must be selected',
    /institutionid is required/i.test(r4.body?.error?.message ?? ''),
    JSON.stringify(r4.body).slice(0, 200),
  );

  // ── 5. Super admin naming a hospital that does not exist ───────────────
  console.log('\n5. Super admin sends an unknown institutionId');
  const r5 = await postStaff(superAdmin.token, staffPayload('five', crypto.randomUUID()));
  check('rejected with 400', r5.status === 400, `status ${r5.status}`);

  console.log(
    failures.length
      ? `\n${failures.length} CHECK(S) FAILED:\n  - ${failures.join('\n  - ')}`
      : `\nALL CHECKS PASSED (${passed} passed)`,
  );
  if (failures.length) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup().catch((err) => console.error('cleanup failed:', err?.message ?? err));
    process.exit(process.exitCode ?? 0);
  });
