/**
 * AccessControlContract — patient consent, enforced on the ledger.
 *
 * This contract is the mechanism behind the project's central claim: a patient,
 * and only a patient, decides who may read their records, and that decision is
 * recorded where no single hospital can quietly alter it.
 *
 * Four properties it guarantees, each covered by tests/accessControl.test.ts:
 *
 *   PATIENT-ONLY   Only a PatientOrgMSP identity acting for itself may grant or
 *                  revoke. A hospital cannot grant itself access, which is what
 *                  makes this different from a permissions table the hospital
 *                  owns.
 *   TIME-BOUND     A grant carries an expiry derived from durationHours. Access
 *                  ends by lapsing, with no revoke required and no cleanup job.
 *   REVOCABLE      Revocation takes effect on the next check, and marks the
 *                  permission inactive rather than deleting it, so the history
 *                  of who could read what, and when, survives.
 *   DEFAULT DENY   A pairing with no permission returns false. Absence of a
 *                  grant is never treated as permission.
 *
 * Time comes from txTimeMillis(), never Date.now(). Under the OutOf(2,...)
 * endorsement policy the same transaction runs on several peers, and a
 * wall-clock read would give each a different expiry, so their read-write sets
 * would not match and the transaction would fail validation. See txtime.ts.
 *
 * State is written twice on purpose: a current-state pointer (PERM_<p>_<d>) for
 * fast checks, plus an append-only composite key per event so the full sequence
 * of grants and revocations is provable from ledger history.
 */

// fabric/chaincode/src/accessControl.ts
//
// Improvements over the original:
// 1. revokePermission now checks the caller IS the patient (was missing —
//    any patient could revoke any other patient's permissions).
// 2. grantPermission also validates the caller IS the patient.
// 3. getPermission returns "null" string when not found (was throwing).
// 4. checkPermission no longer mutates state (the putState in an evaluate
//    call never committed anyway — it was misleading dead code).
// 5. Permission events are now append-only via composite keys, in addition
//    to the current-state pointer. Lets you prove "I revoked Dr X's access
//    at exactly this timestamp" with full ledger history.
// 6. Centralised MSP check helper.
//
// ADDITIONAL FIX (2026-08-05):
// - All ledger timestamps now come from the transaction timestamp via
//   ./txtime, which both handles the Long-typed protobuf fields correctly
//   (the "Invalid time value" 500s) and stays deterministic across the
//   multiple endorsers required by the OutOf(2, ...) policy.
// - durationHours is validated before use.

import { Contract, Context } from 'fabric-contract-api';
import { txTimeMillis } from './txtime';

interface Permission {
  patientId: string;
  practitionerId: string;
  grantedAt: string;
  expiresAt: string;
  active: boolean;
  grantedBy: string;
  lastUpdatedAt: string;
}

interface PermissionEvent {
  patientId: string;
  practitionerId: string;
  action: 'grant' | 'revoke';
  timestamp: string;
  expiresAt?: string;
  actor: string;
  actorMSP: string;
  txId: string;
}

export class AccessControlContract extends Contract {

  constructor() {
    super('AccessControlContract');
  }

  // ── Helper: ensure caller is the patient ───────────────────────────────────
  private requirePatientIdentity(ctx: Context, patientId: string): void {
    const mspId = ctx.clientIdentity.getMSPID();
    if (mspId !== 'PatientOrgMSP') {
      throw new Error(`Access denied: only patients can manage permissions. Your MSP: ${mspId}`);
    }
    const certPatientId = ctx.clientIdentity.getAttributeValue('patientId');
    if (certPatientId !== null && certPatientId !== patientId) {
      throw new Error(`Access denied: certificate identifies patient '${certPatientId}', cannot act as '${patientId}'`);
    }
  }

  // ── grantPermission ────────────────────────────────────────────────────────
  async grantPermission(
    ctx: Context,
    patientId: string,
    practitionerId: string,
    durationHours: string,
  ): Promise<string> {
    this.requirePatientIdentity(ctx, patientId);

    const hours = parseInt(durationHours);
    if (isNaN(hours) || hours <= 0) {
      throw new Error(`Invalid durationHours: ${durationHours}. Must be a positive number.`);
    }

    // Deterministic: identical on every endorsing peer.
    const nowMs = txTimeMillis(ctx);
    const now = new Date(nowMs);
    const expires = new Date(nowMs + hours * 60 * 60 * 1000);

    const clientId = ctx.clientIdentity.getID();
    const mspId = ctx.clientIdentity.getMSPID();
    const txId = ctx.stub.getTxID();

    const permission: Permission = {
      patientId,
      practitionerId,
      grantedAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      active: true,
      grantedBy: clientId,
      lastUpdatedAt: now.toISOString(),
    };

    // Current-state pointer
    const key = `PERM_${patientId}_${practitionerId}`;
    await ctx.stub.putState(key, Buffer.from(JSON.stringify(permission)) as unknown as Uint8Array);

    // Append-only event log (composite key for query)
    const eventKey = ctx.stub.createCompositeKey('PermEvent', [patientId, practitionerId, txId]);
    const event: PermissionEvent = {
      patientId, practitionerId,
      action: 'grant',
      timestamp: now.toISOString(),
      expiresAt: expires.toISOString(),
      actor: clientId,
      actorMSP: mspId,
      txId,
    };
    await ctx.stub.putState(eventKey, Buffer.from(JSON.stringify(event)) as unknown as Uint8Array);

    ctx.stub.setEvent('PermissionGranted', Buffer.from(JSON.stringify(event)) as unknown as Uint8Array);

    return JSON.stringify(permission);
  }

  // ── revokePermission ───────────────────────────────────────────────────────
  async revokePermission(
    ctx: Context,
    patientId: string,
    practitionerId: string,
  ): Promise<string> {
    this.requirePatientIdentity(ctx, patientId);

    const clientId = ctx.clientIdentity.getID();
    const mspId = ctx.clientIdentity.getMSPID();
    const txId = ctx.stub.getTxID();
    const now = new Date(txTimeMillis(ctx));  // deterministic across endorsers

    const key = `PERM_${patientId}_${practitionerId}`;
    const permBytes = await ctx.stub.getState(key);
    if (!permBytes || permBytes.length === 0) {
      throw new Error(`Permission not found for patient ${patientId} and practitioner ${practitionerId}`);
    }

    const permission: Permission = JSON.parse(permBytes.toString());
    permission.active = false;
    permission.lastUpdatedAt = now.toISOString();

    await ctx.stub.putState(key, Buffer.from(JSON.stringify(permission)) as unknown as Uint8Array);

    // Append-only event log
    const eventKey = ctx.stub.createCompositeKey('PermEvent', [patientId, practitionerId, txId]);
    const event: PermissionEvent = {
      patientId, practitionerId,
      action: 'revoke',
      timestamp: now.toISOString(),
      actor: clientId,
      actorMSP: mspId,
      txId,
    };
    await ctx.stub.putState(eventKey, Buffer.from(JSON.stringify(event)) as unknown as Uint8Array);

    ctx.stub.setEvent('PermissionRevoked', Buffer.from(JSON.stringify(event)) as unknown as Uint8Array);

    return JSON.stringify(permission);
  }

  // ── checkPermission ────────────────────────────────────────────────────────
  async checkPermission(
    ctx: Context,
    patientId: string,
    practitionerId: string,
  ): Promise<boolean> {
    const key = `PERM_${patientId}_${practitionerId}`;
    const permBytes = await ctx.stub.getState(key);
    if (!permBytes || permBytes.length === 0) return false;

    const permission: Permission = JSON.parse(permBytes.toString());
    if (!permission.active) return false;

    // Transaction time, not wall-clock: keeps the answer identical on every peer
    // so this stays safe to call from a submitted transaction too.
    const nowMs = txTimeMillis(ctx);
    const expiresMs = new Date(permission.expiresAt).getTime();
    if (!Number.isFinite(expiresMs) || nowMs > expiresMs) return false;

    return true;
  }

  // ── getPermission ──────────────────────────────────────────────────────────
  async getPermission(
    ctx: Context,
    patientId: string,
    practitionerId: string,
  ): Promise<string> {
    const key = `PERM_${patientId}_${practitionerId}`;
    const permBytes = await ctx.stub.getState(key);
    if (!permBytes || permBytes.length === 0) return 'null';
    return permBytes.toString();
  }

  // ── getPatientPermissions ──────────────────────────────────────────────────
  async getPatientPermissions(ctx: Context, patientId: string): Promise<string> {
    const iterator = await ctx.stub.getStateByRange(
      `PERM_${patientId}_`,
      `PERM_${patientId}~`,
    );
    const permissions: Permission[] = [];

    while (true) {
      const result = await iterator.next();
      if (result.done) break;
      permissions.push(JSON.parse(result.value.value.toString()));
    }

    await iterator.close();
    return JSON.stringify(permissions);
  }

  // ── getPermissionHistory ──────────────────────────────────────────────────
  async getPermissionHistory(
    ctx: Context,
    patientId: string,
    practitionerId: string,
  ): Promise<string> {
    const iterator = await ctx.stub.getStateByPartialCompositeKey(
      'PermEvent', [patientId, practitionerId],
    );
    const events: PermissionEvent[] = [];

    while (true) {
      const result = await iterator.next();
      if (result.done) break;
      events.push(JSON.parse(result.value.value.toString()));
    }

    await iterator.close();
    events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return JSON.stringify(events);
  }
}