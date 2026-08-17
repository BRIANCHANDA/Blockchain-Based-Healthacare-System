// backend/src/scripts/verify-emergency-override.ts
//
// End-to-end check of the emergency override.
//
// Scenario: a patient is registered at two hospitals. A doctor at hospital A
// hits the consent wall on records held by hospital B, and uses the emergency
// override to get 24h access without the patient's approval.
//
// Asserts the override endpoint succeeds AND that it actually unlocks
// /away-records — a 201 that grants nothing would be a false pass.
//
// Requires the API server running against the same DATABASE_URL. Point both at
// a throwaway database; this script writes institutions, patients, and staff.
//
//   DATABASE_URL=postgresql://postgres:postgres@localhost:5433/healthcare_test \
//     bun run src/scripts/verify-emergency-override.ts

import { sign } from 'jsonwebtoken';
import crypto from 'crypto';
import { and, eq, inArray, like, or } from 'drizzle-orm';
import { db } from '../db';
import {
  authSessions,
  crossInstitutionAccess,
  emergencyAccessLogs,
  auditLogs,
  institutions,
  patients,
  patientInstitutionRegistrations,
  practitioners,
  visits,
} from '../db/schema';
import { encrypt } from '../services/crypto';

const API = process.env.API_URL ?? 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'healthcare_jwt_secret';

let passed = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

const tag = Date.now();

// Everything this script creates is tagged, so cleanup can find it precisely.
// Runs even on failure — this script is safe to point at a real database.
async function cleanup() {
  const instIds = (await db.select({ id: institutions.id }).from(institutions)
    .where(or(like(institutions.institutionCode, 'EMG-A-%'), like(institutions.institutionCode, 'EMG-B-%'))))
    .map((r) => r.id);
  const patIds = (await db.select({ id: patients.id }).from(patients)
    .where(or(like(patients.blockchainAddress, 'patient:emgtest%'), like(patients.blockchainAddress, 'patient:emgsolo%'))))
    .map((r) => r.id);
  const pracIds = (await db.select({ id: practitioners.id }).from(practitioners)
    .where(like(practitioners.licenseNumber, 'LIC-EMG-%')))
    .map((r) => r.id);

  if (pracIds.length) await db.delete(authSessions).where(inArray(authSessions.userId, pracIds));
  if (patIds.length) {
    await db.delete(crossInstitutionAccess).where(inArray(crossInstitutionAccess.patientId, patIds));
    await db.delete(emergencyAccessLogs).where(inArray(emergencyAccessLogs.patientId, patIds));
    await db.delete(auditLogs).where(inArray(auditLogs.patientId, patIds));
    await db.delete(visits).where(inArray(visits.patientId, patIds));
    await db.delete(patientInstitutionRegistrations).where(inArray(patientInstitutionRegistrations.patientId, patIds));
  }
  if (pracIds.length) await db.delete(practitioners).where(inArray(practitioners.id, pracIds));
  if (patIds.length) await db.delete(patients).where(inArray(patients.id, patIds));
  if (instIds.length) await db.delete(institutions).where(inArray(institutions.id, instIds));
}

async function main() {
  // ── Seed two hospitals ──────────────────────────────────────────────────
  const [hospA] = await db.insert(institutions).values({
    institutionCode: `EMG-A-${tag}`,
    institutionName: `Override Test Hospital A ${tag}`,
    institutionType: 'hospital',
    blockchainAddress: `0xinstA${tag}`,
    addressEncrypted: encrypt('A Street, Lusaka'),
    phoneEncrypted: encrypt('+260970000001'),
    licenseNumber: `LIC-INST-A-${tag}`,
  }).returning({ id: institutions.id });

  const [hospB] = await db.insert(institutions).values({
    institutionCode: `EMG-B-${tag}`,
    institutionName: `Override Test Hospital B ${tag}`,
    institutionType: 'hospital',
    blockchainAddress: `0xinstB${tag}`,
    addressEncrypted: encrypt('B Street, Ndola'),
    phoneEncrypted: encrypt('+260970000002'),
    licenseNumber: `LIC-INST-B-${tag}`,
  }).returning({ id: institutions.id });

  // ── A patient registered at BOTH hospitals ──────────────────────────────
  const [patient] = await db.insert(patients).values({
    blockchainAddress: `patient:emgtest${tag}`,
    firstNameEncrypted: encrypt('Override'),
    lastNameEncrypted: encrypt('TestPatient'),
    dateOfBirthEncrypted: encrypt('1990-04-04'),
    phoneNumberEncrypted: encrypt('+260971111111'),
    addressEncrypted: encrypt('Somewhere'),
    emergencyContactEncrypted: encrypt('+260972222222'),
    nationalIdEncrypted: encrypt(`NRC-EMG-${tag}`),
    gender: 'male',
    passwordHash: 'x',
  }).returning({ id: patients.id });

  for (const inst of [hospA, hospB]) {
    await db.insert(patientInstitutionRegistrations).values({
      patientId: patient.id,
      institutionId: inst.id,
      hospitalPatientNumber: `HPN-${inst.id.slice(0, 6)}-${tag}`,
      isActive: true,
      isHomeInstitution: inst.id === hospB.id,
    });
  }

  // A visit at hospital B — the record the doctor at A wants to see.
  await db.insert(visits).values({
    patientId: patient.id,
    institutionId: hospB.id,
    visitNumber: `VN-EMG-${tag}`,
    visitType: 'outpatient',
    admissionDate: new Date(),
    status: 'completed',
    chiefComplaint: 'Chest pain seen at hospital B',
    blockchainHash: crypto.createHash('sha256').update(`visit-${tag}`).digest('hex'),
  });

  // ── A doctor at hospital A ──────────────────────────────────────────────
  const [doctor] = await db.insert(practitioners).values({
    blockchainAddress: `0xemg${crypto.randomBytes(8).toString('hex')}`,
    institutionId: hospA.id,
    firstNameEncrypted: encrypt('Emergency'),
    lastNameEncrypted: encrypt('Doctor'),
    phoneNumberEncrypted: encrypt('+260973333333'),
    emailEncrypted: encrypt(`emg${tag}@test.local`),
    licenseNumber: `LIC-EMG-${tag}`,
    institutionalId: `INST-EMG-${tag}`,
    specialization: 'general',
    role: 'practitioner',
    passwordHash: 'x',
    isVerified: true,
    isActive: true,
  }).returning({ id: practitioners.id });

  // ── Session for the doctor ──────────────────────────────────────────────
  const token = sign(
    { userId: doctor.id, userType: 'practitioner', blockchainAddress: 'x', institutionId: hospA.id },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
  await db.insert(authSessions).values({
    userId: doctor.id,
    userType: 'practitioner',
    jwtToken: token,
    refreshToken: `emg-verify-${tag}`,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    isActive: true,
  });

  console.log(`hospital A (requesting) = ${hospA.id}`);
  console.log(`hospital B (holds data) = ${hospB.id}`);
  console.log(`patient                = ${patient.id}`);
  console.log(`doctor at A            = ${doctor.id}\n`);

  const authed = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  // ── 1. Away records should be refused before the override ───────────────
  // With no grant in place the route returns 403 outright.
  const beforeRes = await fetch(`${API}/api/permissions/away-records/${patient.id}`, { headers: authed });
  const before: any = await beforeRes.json().catch(() => ({}));
  console.log('1. Before override');
  check("hospital B's records are refused", beforeRes.status === 403, `status ${beforeRes.status}`);
  check(
    'refusal explains there is no cross-institution access',
    /no active cross-institution access/i.test(before?.error?.message ?? ''),
    JSON.stringify(before).slice(0, 200),
  );

  // ── 2. The override itself ──────────────────────────────────────────────
  console.log('\n2. Emergency override');
  const reason = 'Patient unconscious in casualty, needs full cross-hospital history now';
  const res = await fetch(`${API}/api/permissions/emergency-override`, {
    method: 'POST',
    headers: authed,
    body: JSON.stringify({ patientId: patient.id, reason }),
  });
  const body: any = await res.json().catch(() => ({}));
  console.log(`   status ${res.status}`);
  console.log(`   ${JSON.stringify(body).slice(0, 400)}\n`);

  check('override returned 201', res.status === 201, `status ${res.status}`);
  check('response reports success', body?.success === true);
  check('an emergency log id came back', typeof body?.data?.emergencyLogId === 'string');
  check(
    'access was granted for hospital B',
    body?.data?.sourcesGranted >= 1,
    `sourcesGranted=${body?.data?.sourcesGranted}`,
  );

  // ── 3. It must be recorded, not just reported ───────────────────────────
  console.log('\n3. Recorded on both stores');
  const logs = await db.select().from(emergencyAccessLogs)
    .where(eq(emergencyAccessLogs.patientId, patient.id));
  check('emergency_access_logs row written', logs.length === 1);
  check('the stated reason was stored', logs[0]?.reason === reason);

  const grants = await db.select().from(crossInstitutionAccess).where(and(
    eq(crossInstitutionAccess.patientId, patient.id),
    eq(crossInstitutionAccess.sourceInstitutionId, hospB.id),
    eq(crossInstitutionAccess.targetInstitutionId, hospA.id),
  ));
  check('cross_institution_access row written', grants.length === 1);
  check('grant is active', grants[0]?.status === 'active');
  check('grant is typed as emergency', grants[0]?.accessType === 'emergency');
  check('grant expires (not permanent)', !!grants[0]?.expiresAt);

  const audits = await db.select().from(auditLogs).where(and(
    eq(auditLogs.patientId, patient.id),
    eq(auditLogs.actionType, 'emergency_override'),
  ));
  check('audit_logs row written', audits.length === 1);
  check('audit row flags the override', audits[0]?.isEmergencyOverride === true);

  // ── 4. The override must actually unlock the records ────────────────────
  console.log('\n4. Away records after the override');
  const afterRes = await fetch(`${API}/api/permissions/away-records/${patient.id}`, { headers: authed });
  const after: any = await afterRes.json().catch(() => ({}));
  const grantList: any[] = after?.data?.grants ?? [];
  const awayVisits: any[] = after?.data?.visits ?? [];

  check("hospital B's records are now reachable", afterRes.status === 200, `status ${afterRes.status}`);
  check(
    'the grant from hospital B is listed',
    grantList.some((g) => g.sourceInstitutionId === hospB.id && g.accessType === 'emergency'),
    JSON.stringify(grantList).slice(0, 200),
  );
  check(
    'the visit recorded at hospital B is returned',
    awayVisits.some((v) => v.institutionId === hospB.id),
    `visits=${awayVisits.length}`,
  );
  check(
    'the clinical detail of that visit came through',
    awayVisits.some((v) => v.chiefComplaint === 'Chest pain seen at hospital B'),
    JSON.stringify(awayVisits[0] ?? {}).slice(0, 200),
  );

  // ── 4b. The endpoint the patient-history page actually renders from ─────
  // /away-records and /history gate on different things. The doctor's page
  // calls /history, so the override is only really working if this unlocks.
  console.log('\n4b. Patient history page (GET /api/patients/:id/history)');
  const histRes = await fetch(`${API}/api/patients/${patient.id}/history`, { headers: authed });
  const hist: any = await histRes.json().catch(() => ({}));
  const awayInsts: any[] = hist?.data?.awayInstitutions ?? [];
  const hospBEntry = awayInsts.find((i) => i.institutionId === hospB.id);

  check('history endpoint returns 200', histRes.status === 200, `status ${histRes.status}`);
  check('hospital B appears as an away institution', !!hospBEntry, JSON.stringify(awayInsts).slice(0, 200));
  check(
    'hospital B is UNLOCKED on the history page',
    hospBEntry?.hasPermission === true,
    `hasPermission=${hospBEntry?.hasPermission}`,
  );
  check(
    'it reports that access came from the emergency override',
    hospBEntry?.accessVia === 'emergency',
    `accessVia=${hospBEntry?.accessVia}`,
  );
  check(
    'the away visit rows are actually populated (not just unlocked)',
    (hospBEntry?.visits?.length ?? 0) >= 1,
    `visits=${hospBEntry?.visits?.length ?? 0}`,
  );

  // ── 5. A patient with no records elsewhere ──────────────────────────────
  // The override has nothing to unlock. It must say so rather than reporting
  // a success the doctor cannot act on.
  console.log('\n5. Patient registered only at the doctor\'s own hospital');
  const [soloPatient] = await db.insert(patients).values({
    blockchainAddress: `patient:emgsolo${tag}`,
    firstNameEncrypted: encrypt('Solo'),
    lastNameEncrypted: encrypt('TestPatient'),
    dateOfBirthEncrypted: encrypt('1991-05-05'),
    phoneNumberEncrypted: encrypt('+260974444444'),
    addressEncrypted: encrypt('Somewhere'),
    emergencyContactEncrypted: encrypt('+260975555555'),
    nationalIdEncrypted: encrypt(`NRC-SOLO-${tag}`),
    gender: 'female',
    passwordHash: 'x',
  }).returning({ id: patients.id });

  await db.insert(patientInstitutionRegistrations).values({
    patientId: soloPatient.id,
    institutionId: hospA.id,
    hospitalPatientNumber: `HPN-SOLO-${tag}`,
    isActive: true,
    isHomeInstitution: true,
  });

  const soloRes = await fetch(`${API}/api/permissions/emergency-override`, {
    method: 'POST',
    headers: authed,
    body: JSON.stringify({
      patientId: soloPatient.id,
      reason: 'Unconscious patient, checking for any history held elsewhere now',
    }),
  });
  const solo: any = await soloRes.json().catch(() => ({}));
  console.log(`   status ${soloRes.status}`);
  console.log(`   ${JSON.stringify(solo).slice(0, 320)}`);
  check(
    'the response does not claim access was granted when nothing was',
    solo?.data?.sourcesGranted === 0 && !/^Emergency access granted/.test(solo?.data?.message ?? ''),
    `sourcesGranted=${solo?.data?.sourcesGranted}, message="${solo?.data?.message}"`,
  );
  check(
    'the override is still logged for audit even with nothing to unlock',
    (await db.select().from(emergencyAccessLogs).where(eq(emergencyAccessLogs.patientId, soloPatient.id))).length === 1,
  );

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
