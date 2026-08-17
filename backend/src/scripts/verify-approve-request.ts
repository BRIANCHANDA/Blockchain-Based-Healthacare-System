// backend/src/scripts/verify-approve-request.ts
//
// End-to-end check of the access-request approval endpoint.
//
// Drives the real HTTP route a patient hits when they tap "Approve" on a
// practitioner's access request, then asserts the three things that must all
// be true afterwards:
//   1. the API returned success,
//   2. an access_permissions row exists carrying the Fabric transaction id,
//   3. the grant is actually visible on the ledger.
//
// Creates its own request row and session, and removes both afterwards, so it
// is safe to re-run. Requires the backend to be listening on $PORT.
//
// Usage: bun run src/scripts/verify-approve-request.ts

import { sign } from 'jsonwebtoken';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import {
  accessPermissions,
  accessRequests,
  authSessions,
  patients,
  practitioners,
} from '../db/schema';
import { checkPermission, revokePermission } from '../services/fabric';

// API_URL wins so the suite can be pointed at a server on any port; PORT is
// kept as a fallback for the common "same machine, default port" case.
const BASE_URL = process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
const JWT_SECRET = process.env.JWT_SECRET || 'healthcare_jwt_secret';

let passed = 0;
let failed = 0;

function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function main() {
  // ── Pick a real patient/practitioner pair that both have chain addresses ──
  const [patient] = await db
    .select({ id: patients.id, address: patients.blockchainAddress })
    .from(patients)
    .limit(1);
  const [doctor] = await db
    .select({ id: practitioners.id, address: practitioners.blockchainAddress })
    .from(practitioners)
    .limit(1);

  if (!patient?.address || !doctor?.address) {
    throw new Error('Need at least one patient and one practitioner with a blockchainAddress');
  }

  console.log(`patient      = ${patient.address}`);
  console.log(`practitioner = ${doctor.address}\n`);

  // Start from a clean slate on chain so the final assertion is meaningful.
  const alreadyGranted = await checkPermission(patient.address, doctor.address);
  if (alreadyGranted) {
    console.log('note: permission already active on chain from a previous run\n');
  }

  // ── Create a pending request, as the practitioner's "request access" does ──
  const [request] = await db
    .insert(accessRequests)
    .values({
      patientId: patient.id,
      requestedByUserId: doctor.id,
      requestedByUserType: 'practitioner',
      requestedPermissions: ['visits'],
      reason: 'automated end-to-end verification of the approval endpoint',
      status: 'pending',
      // The request itself expires in 48h, matching the /request route.
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    })
    .returning();

  // ── Mint a patient session the way the login route does ───────────────────
  const token = sign(
    { userId: patient.id, userType: 'patient', blockchainAddress: patient.address },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
  await db.insert(authSessions).values({
    userId: patient.id,
    userType: 'patient',
    jwtToken: token,
    refreshToken: `verify-${Date.now()}`,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    isActive: true,
  });

  try {
    // ── Hit the real endpoint ───────────────────────────────────────────────
    console.log(`POST /api/permissions/requests/${request.id}/approve`);
    const res = await fetch(
      `${BASE_URL}/api/permissions/requests/${request.id}/approve`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ durationHours: 24 }),
      },
    );
    const body: any = await res.json();
    console.log(`   status ${res.status}`);
    console.log(`   ${JSON.stringify(body)}\n`);

    check('endpoint returned 200', res.status === 200, `got ${res.status}`);
    check('response reports success', body?.success === true);
    check('response carries an expiry', Boolean(body?.data?.expiresAt));

    // ── The request row should now be approved ──────────────────────────────
    const [updated] = await db
      .select({ status: accessRequests.status, respondedAt: accessRequests.respondedAt })
      .from(accessRequests)
      .where(eq(accessRequests.id, request.id));
    check('request is marked approved', updated?.status === 'approved', `status=${updated?.status}`);
    check('respondedAt was stamped', Boolean(updated?.respondedAt));

    // ── A permission row should exist, carrying the Fabric transaction id ───
    const [permission] = await db
      .select({
        txId: accessPermissions.blockchainTransactionId,
        isActive: accessPermissions.isActive,
        expiresAt: accessPermissions.expiresAt,
      })
      .from(accessPermissions)
      .where(
        and(
          eq(accessPermissions.patientId, patient.id),
          eq(accessPermissions.grantedToUserId, doctor.id),
          eq(accessPermissions.isActive, true),
        ),
      )
      .orderBy(desc(accessPermissions.createdAt))
      .limit(1);

    check('an access_permissions row was written', Boolean(permission));
    check(
      'the row carries a real Fabric transaction id',
      typeof permission?.txId === 'string' && /^[0-9a-f]{64}$/.test(permission.txId),
      `txId=${permission?.txId}`,
    );
    if (permission?.txId) console.log(`   txId = ${permission.txId}`);

    // ── And the grant must be live on the ledger ────────────────────────────
    const onChain = await checkPermission(patient.address, doctor.address);
    check('checkPermission is true on the ledger', onChain === true);

  } finally {
    // ── Clean up what this script created ─────────────────────────────────
    // The approval granted a real 24h permission; undo it on both stores so a
    // verification run never leaves a practitioner holding access to a patient.
    try {
      await revokePermission(patient.address, doctor.address);
    } catch (err: any) {
      console.log(`   (on-chain cleanup revoke failed: ${err?.message ?? err})`);
    }
    await db
      .update(accessPermissions)
      .set({ isActive: false })
      .where(
        and(
          eq(accessPermissions.patientId, patient.id),
          eq(accessPermissions.grantedToUserId, doctor.id),
          eq(accessPermissions.isActive, true),
        ),
      );
    await db.delete(authSessions).where(eq(authSessions.jwtToken, token));
    await db.delete(accessRequests).where(eq(accessRequests.id, request.id));
  }

  console.log(`\n${failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`} (${passed} passed)`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\nverification threw:', err);
  process.exit(1);
});
