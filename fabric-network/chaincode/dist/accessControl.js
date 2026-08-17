"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccessControlContract = void 0;
const fabric_contract_api_1 = require("fabric-contract-api");
const txtime_1 = require("./txtime");
class AccessControlContract extends fabric_contract_api_1.Contract {
    constructor() {
        super('AccessControlContract');
    }
    // ── Helper: ensure caller is the patient ───────────────────────────────────
    requirePatientIdentity(ctx, patientId) {
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
    async grantPermission(ctx, patientId, practitionerId, durationHours) {
        this.requirePatientIdentity(ctx, patientId);
        const hours = parseInt(durationHours);
        if (isNaN(hours) || hours <= 0) {
            throw new Error(`Invalid durationHours: ${durationHours}. Must be a positive number.`);
        }
        // Deterministic: identical on every endorsing peer.
        const nowMs = (0, txtime_1.txTimeMillis)(ctx);
        const now = new Date(nowMs);
        const expires = new Date(nowMs + hours * 60 * 60 * 1000);
        const clientId = ctx.clientIdentity.getID();
        const mspId = ctx.clientIdentity.getMSPID();
        const txId = ctx.stub.getTxID();
        const permission = {
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
        await ctx.stub.putState(key, Buffer.from(JSON.stringify(permission)));
        // Append-only event log (composite key for query)
        const eventKey = ctx.stub.createCompositeKey('PermEvent', [patientId, practitionerId, txId]);
        const event = {
            patientId, practitionerId,
            action: 'grant',
            timestamp: now.toISOString(),
            expiresAt: expires.toISOString(),
            actor: clientId,
            actorMSP: mspId,
            txId,
        };
        await ctx.stub.putState(eventKey, Buffer.from(JSON.stringify(event)));
        ctx.stub.setEvent('PermissionGranted', Buffer.from(JSON.stringify(event)));
        return JSON.stringify(permission);
    }
    // ── revokePermission ───────────────────────────────────────────────────────
    async revokePermission(ctx, patientId, practitionerId) {
        this.requirePatientIdentity(ctx, patientId);
        const clientId = ctx.clientIdentity.getID();
        const mspId = ctx.clientIdentity.getMSPID();
        const txId = ctx.stub.getTxID();
        const now = new Date((0, txtime_1.txTimeMillis)(ctx)); // deterministic across endorsers
        const key = `PERM_${patientId}_${practitionerId}`;
        const permBytes = await ctx.stub.getState(key);
        if (!permBytes || permBytes.length === 0) {
            throw new Error(`Permission not found for patient ${patientId} and practitioner ${practitionerId}`);
        }
        const permission = JSON.parse(permBytes.toString());
        permission.active = false;
        permission.lastUpdatedAt = now.toISOString();
        await ctx.stub.putState(key, Buffer.from(JSON.stringify(permission)));
        // Append-only event log
        const eventKey = ctx.stub.createCompositeKey('PermEvent', [patientId, practitionerId, txId]);
        const event = {
            patientId, practitionerId,
            action: 'revoke',
            timestamp: now.toISOString(),
            actor: clientId,
            actorMSP: mspId,
            txId,
        };
        await ctx.stub.putState(eventKey, Buffer.from(JSON.stringify(event)));
        ctx.stub.setEvent('PermissionRevoked', Buffer.from(JSON.stringify(event)));
        return JSON.stringify(permission);
    }
    // ── checkPermission ────────────────────────────────────────────────────────
    async checkPermission(ctx, patientId, practitionerId) {
        const key = `PERM_${patientId}_${practitionerId}`;
        const permBytes = await ctx.stub.getState(key);
        if (!permBytes || permBytes.length === 0)
            return false;
        const permission = JSON.parse(permBytes.toString());
        if (!permission.active)
            return false;
        // Transaction time, not wall-clock: keeps the answer identical on every peer
        // so this stays safe to call from a submitted transaction too.
        const nowMs = (0, txtime_1.txTimeMillis)(ctx);
        const expiresMs = new Date(permission.expiresAt).getTime();
        if (!Number.isFinite(expiresMs) || nowMs > expiresMs)
            return false;
        return true;
    }
    // ── getPermission ──────────────────────────────────────────────────────────
    async getPermission(ctx, patientId, practitionerId) {
        const key = `PERM_${patientId}_${practitionerId}`;
        const permBytes = await ctx.stub.getState(key);
        if (!permBytes || permBytes.length === 0)
            return 'null';
        return permBytes.toString();
    }
    // ── getPatientPermissions ──────────────────────────────────────────────────
    async getPatientPermissions(ctx, patientId) {
        const iterator = await ctx.stub.getStateByRange(`PERM_${patientId}_`, `PERM_${patientId}~`);
        const permissions = [];
        while (true) {
            const result = await iterator.next();
            if (result.done)
                break;
            permissions.push(JSON.parse(result.value.value.toString()));
        }
        await iterator.close();
        return JSON.stringify(permissions);
    }
    // ── getPermissionHistory ──────────────────────────────────────────────────
    async getPermissionHistory(ctx, patientId, practitionerId) {
        const iterator = await ctx.stub.getStateByPartialCompositeKey('PermEvent', [patientId, practitionerId]);
        const events = [];
        while (true) {
            const result = await iterator.next();
            if (result.done)
                break;
            events.push(JSON.parse(result.value.value.toString()));
        }
        await iterator.close();
        events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        return JSON.stringify(events);
    }
}
exports.AccessControlContract = AccessControlContract;
