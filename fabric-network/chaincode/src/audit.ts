/**
 * AuditContract — the tamper-evident access log.
 *
 * Every read of a patient's records is written here, on-chain, so the log cannot
 * be edited or pruned by the institution that produced it. That is the whole
 * point: an audit trail a hospital can rewrite is not evidence, and this is what
 * lets a patient see who actually opened their record rather than who a hospital
 * says did.
 *
 * Entries are append-only by construction — there is no update or delete
 * operation on this contract, only writes and queries.
 *
 * Reads are themselves access-controlled: a patient may read their own log and
 * nobody else's, while hospital and practitioner identities may query more
 * broadly for their own compliance purposes.
 *
 * Composite keys index entries by patient, so a patient's log is retrieved by
 * an indexed lookup rather than a scan of the whole namespace, and
 * getAuditLogByDateRange narrows that to a time window.
 */

// fabric/chaincode/src/audit.ts
//
// Improvements over the original:
// 1. getPatientAuditLog now checks the caller's identity — patients can only
//    read their own log. Hospital/practitioner reads are still allowed.
// 2. Composite keys for efficient queries by patient.
// 3. NEW: getAuditLogByDateRange — queries by patient + date window.
// 4. Better event emission with structured payload.

import { Contract, Context } from 'fabric-contract-api';
import { txTimeISO } from './txtime';

interface AuditLog {
  logId: string;
  patientId: string;
  accessedBy: string;
  accessorMSP: string;
  action: string;
  recordId: string;
  timestamp: string;
  success: boolean;
}

export class AuditContract extends Contract {

  constructor() {
    super('AuditContract');
  }

  // ── logAccess ──────────────────────────────────────────────────────────────
  async logAccess(
    ctx: Context,
    patientId: string,
    recordId: string,
    action: string,
    success: string,
  ): Promise<string> {
    const txId = ctx.stub.getTxID();
    const clientId = ctx.clientIdentity.getID();
    const mspId = ctx.clientIdentity.getMSPID();
    const timestamp = txTimeISO(ctx);

    const log: AuditLog = {
      logId: txId,
      patientId,
      accessedBy: clientId,
      accessorMSP: mspId,
      action,
      recordId,
      timestamp,
      success: success === 'true',
    };

    const payload = Buffer.from(JSON.stringify(log));

    // Original range key (kept for backward compatibility)
    const rangeKey = `AUDIT_${patientId}_${txId}`;
    await ctx.stub.putState(rangeKey, payload as unknown as Uint8Array);

    // Composite key for indexed queries
    const compositeKey = ctx.stub.createCompositeKey('PatientAudit', [patientId, txId]);
    await ctx.stub.putState(compositeKey, payload as unknown as Uint8Array);

    ctx.stub.setEvent('AccessLogged', payload as unknown as Uint8Array);

    return JSON.stringify(log);
  }

  // ── getPatientAuditLog ─────────────────────────────────────────────────────
  // Patients can only read their own log. Hospital/practitioner are allowed
  // (they may need it for clinical context). Backend can layer additional checks.
  async getPatientAuditLog(
    ctx: Context,
    patientId: string,
  ): Promise<string> {
    const mspId = ctx.clientIdentity.getMSPID();
    const clientId = ctx.clientIdentity.getID();

    // If caller is from PatientOrgMSP, their identity must match the patientId.
    // (The patient's enrollment cert should encode their patientId in the CN
    //  or as an attribute — adapt this check to your enrollment setup.)
    if (mspId === 'PatientOrgMSP' && !clientId.includes(patientId)) {
      throw new Error('Patients can only read their own audit log');
    }

    // Only allow expected MSPs to read at all
    if (!['PatientOrgMSP', 'HospitalOrgMSP', 'PractitionerOrgMSP'].includes(mspId)) {
      throw new Error(`Access denied: MSP ${mspId} not allowed to read audit logs`);
    }

    const iterator = await ctx.stub.getStateByPartialCompositeKey('PatientAudit', [patientId]);
    const logs: AuditLog[] = [];

    while (true) {
      const result = await iterator.next();
      if (result.done) break;
      logs.push(JSON.parse(result.value.value.toString()));
    }

    await iterator.close();
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return JSON.stringify(logs);
  }

  // ── getAuditEntry ──────────────────────────────────────────────────────────
  async getAuditEntry(
    ctx: Context,
    patientId: string,
    logId: string,
  ): Promise<string> {
    const mspId = ctx.clientIdentity.getMSPID();
    const clientId = ctx.clientIdentity.getID();

    if (mspId === 'PatientOrgMSP' && !clientId.includes(patientId)) {
      throw new Error('Patients can only read their own audit entries');
    }

    const key = `AUDIT_${patientId}_${logId}`;
    const logBytes = await ctx.stub.getState(key);
    if (!logBytes || logBytes.length === 0) {
      throw new Error(`Audit log ${logId} not found`);
    }
    return logBytes.toString();
  }

  // ── NEW: getAuditLogByDateRange ────────────────────────────────────────────
  // Returns audit entries for a patient within a date window. Helps build
  // "who accessed my record in November" type views without scanning everything.
  async getAuditLogByDateRange(
    ctx: Context,
    patientId: string,
    startDate: string,  // ISO
    endDate: string,  // ISO
  ): Promise<string> {
    const mspId = ctx.clientIdentity.getMSPID();
    const clientId = ctx.clientIdentity.getID();

    if (mspId === 'PatientOrgMSP' && !clientId.includes(patientId)) {
      throw new Error('Patients can only read their own audit log');
    }
    if (!['PatientOrgMSP', 'HospitalOrgMSP', 'PractitionerOrgMSP'].includes(mspId)) {
      throw new Error(`Access denied: MSP ${mspId} not allowed`);
    }

    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    if (isNaN(start) || isNaN(end)) {
      throw new Error('startDate and endDate must be valid ISO date strings');
    }

    const iterator = await ctx.stub.getStateByPartialCompositeKey('PatientAudit', [patientId]);
    const logs: AuditLog[] = [];

    while (true) {
      const result = await iterator.next();
      if (result.done) break;
      const log = JSON.parse(result.value.value.toString()) as AuditLog;
      const t = new Date(log.timestamp).getTime();
      if (t >= start && t <= end) logs.push(log);
    }

    await iterator.close();
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return JSON.stringify(logs);
  }
}
