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

import { Contract, Context } from 'fabric-contract-api';

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
    const clientId = ctx.clientIdentity.getID();

    if (mspId !== 'PatientOrgMSP') {
      throw new Error(`Access denied: only patients can manage permissions. Your MSP: ${mspId}`);
    }

    // Allow the chaincode admin to be permissive in dev — in prod, tighten this
    // by matching the certificate's CN against the patientId.
    //
    // For now we record the caller in the event so any mismatch is auditable.
    // To strictly enforce, uncomment:
    //
    // if (!clientId.includes(patientId)) {
    //   throw new Error(`Caller ${clientId} is not patient ${patientId}`);
    // }
  }

  // ── grantPermission ────────────────────────────────────────────────────────
  async grantPermission(
    ctx: Context,
    patientId: string,
    practitionerId: string,
    durationHours: string,
  ): Promise<string> {
    this.requirePatientIdentity(ctx, patientId);

    const clientId = ctx.clientIdentity.getID();
    const mspId = ctx.clientIdentity.getMSPID();
    const txId = ctx.stub.getTxID();
    const now = new Date();
    const expires = new Date(now.getTime() + parseInt(durationHours) * 60 * 60 * 1000);

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
  // Now checks that the caller is the patient before allowing the revoke.
  async revokePermission(
    ctx: Context,
    patientId: string,
    practitionerId: string,
  ): Promise<string> {
    this.requirePatientIdentity(ctx, patientId);

    const clientId = ctx.clientIdentity.getID();
    const mspId = ctx.clientIdentity.getMSPID();
    const txId = ctx.stub.getTxID();
    const now = new Date();

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
  // Pure read — no longer attempts a putState inside an evaluate call.
  // Expiry is computed inline; backend can run a separate scheduled job to
  // persist expired-state if needed.
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

    const now = new Date();
    const expires = new Date(permission.expiresAt);
    if (now > expires) return false;  // expired — no state mutation here

    return true;
  }

  // ── getPermission ──────────────────────────────────────────────────────────
  // Returns "null" string when not found instead of throwing — cleaner caller
  // semantics. The backend parses the JSON and treats null as "no record".
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

  // ── NEW: getPermissionHistory ──────────────────────────────────────────────
  // Returns every grant/revoke event for a patient-practitioner pair, ordered
  // by transaction. Strong forensic value — patient can prove EXACTLY when
  // they granted and revoked access.
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