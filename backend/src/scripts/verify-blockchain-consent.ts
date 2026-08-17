// backend/src/scripts/verify-blockchain-consent.ts
//
// End-to-end check of the consent path that POST /permissions/requests/:id/approve
// depends on. Runs against the live Fabric network using the same
// services/fabric.ts helpers the route calls.
//
//   bun run src/scripts/verify-blockchain-consent.ts
//
// Exits non-zero on the first failed assertion.

import {
  grantPermission,
  revokePermission,
  checkPermission,
  getPatientPermissions,
} from '../services/fabric';

const PATIENT = `patient:verify-${Date.now()}`;
const PRACTITIONER = `0xverify${Date.now().toString(16)}`;

let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${label}${ok ? '' : `  (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`}`);
  if (!ok) failures++;
}

async function main() {
  console.log(`patient      = ${PATIENT}`);
  console.log(`practitioner = ${PRACTITIONER}\n`);

  console.log('1. No permission exists yet');
  check('checkPermission is false', await checkPermission(PATIENT, PRACTITIONER), false);

  console.log('\n2. Patient grants 24h access (what approving a request does)');
  const granted = await grantPermission(PATIENT, PRACTITIONER, '24') as any;
  console.log(`   txId      = ${granted.txId}`);
  console.log(`   grantedAt = ${granted.grantedAt}`);
  console.log(`   expiresAt = ${granted.expiresAt}`);
  check('a transaction id came back', typeof granted.txId === 'string' && granted.txId.length === 64, true);
  check('grantedAt is a valid date', !Number.isNaN(Date.parse(granted.grantedAt)), true);
  check('expiresAt is a valid date', !Number.isNaN(Date.parse(granted.expiresAt)), true);
  check('expiry is 24h after grant',
    Date.parse(granted.expiresAt) - Date.parse(granted.grantedAt), 24 * 60 * 60 * 1000);
  check('permission is active', granted.active, true);

  console.log('\n3. The grant is visible on the ledger');
  check('checkPermission is true', await checkPermission(PATIENT, PRACTITIONER), true);
  const listed = (await getPatientPermissions(PATIENT)).find((p: any) => p.practitionerId === PRACTITIONER);
  check('grant appears in getPatientPermissions', listed?.active, true);

  console.log('\n4. Patient revokes access');
  const revoked = await revokePermission(PATIENT, PRACTITIONER) as any;
  console.log(`   txId = ${revoked.txId}`);
  check('a transaction id came back', typeof revoked.txId === 'string' && revoked.txId.length === 64, true);
  check('permission is inactive', revoked.active, false);
  check('checkPermission is false again', await checkPermission(PATIENT, PRACTITIONER), false);

  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\nERROR:', err?.message ?? err);
  process.exit(1);
});
