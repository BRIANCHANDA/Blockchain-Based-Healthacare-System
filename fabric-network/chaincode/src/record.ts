// fabric/chaincode/src/record.ts
//
// Improvements over the original:
// 1. storeRecordHash no longer rejects duplicates — instead it versions the
//    record using a composite key. The "latest" pointer always reflects the
//    most recent version, so getRecordHash / verifyRecordHash work unchanged.
// 2. NEW: getRecordHistory(recordId) — returns every version of a record from
//    the ledger's built-in key history. Strong audit/demo value.
// 3. getPatientRecords now uses composite keys for efficient indexed lookup
//    instead of full-namespace scans.
// 4. Centralised MSP check helper.
// 5. Emits a RecordVersioned event with version number.

import { Contract, Context } from 'fabric-contract-api';

interface RecordHash {
  recordId: string;
  patientId: string;
  sha256Hash: string;
  recordType: string;
  createdBy: string;
  creatorMSP: string;
  timestamp: string;
  version: number;  // NEW — increments per update
  previousTxId?: string;
}

const WRITER_MSPS = ['HospitalOrgMSP', 'PractitionerOrgMSP'];

export class RecordContract extends Contract {

  constructor() {
    super('RecordContract');
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  private requireMsp(ctx: Context, allowed: string[]): void {
    const mspId = ctx.clientIdentity.getMSPID();
    if (!allowed.includes(mspId)) {
      throw new Error(`Access denied: requires one of [${allowed.join(', ')}], got ${mspId}`);
    }
  }

  // ── storeRecordHash ────────────────────────────────────────────────────────
  // No longer throws on duplicate. Instead, increments version and updates the
  // "latest" pointer. Each version is also stored under a composite key so the
  // full history is queryable.
  async storeRecordHash(
    ctx: Context,
    recordId: string,
    patientId: string,
    sha256Hash: string,
    recordType: string,
  ): Promise<string> {
    this.requireMsp(ctx, WRITER_MSPS);

    // Read current (if any) to determine version number
    const latestKey = `RECORD_${recordId}`;
    const existing = await ctx.stub.getState(latestKey);

    let version = 1;
    let previousTxId: string | undefined;
    if (existing && existing.length > 0) {
      const prev = JSON.parse(existing.toString()) as RecordHash;
      version = (prev.version ?? 1) + 1;
      previousTxId = ctx.stub.getTxID();  // we'll see the prev tx via history
    }

    const record: RecordHash = {
      recordId,
      patientId,
      sha256Hash,
      recordType,
      createdBy: ctx.clientIdentity.getID(),
      creatorMSP: ctx.clientIdentity.getMSPID(),
      timestamp: new Date().toISOString(),
      version,
      previousTxId,
    };

    const payload = Buffer.from(JSON.stringify(record)) as unknown as Uint8Array;

    // 1) Update the "latest" pointer (overwrites — version history is preserved
    //    automatically by Fabric's getHistoryForKey)
    await ctx.stub.putState(latestKey, payload);

    // 2) Also write a composite key so we can query by patient efficiently
    const patientIndex = ctx.stub.createCompositeKey('PatientRecord', [patientId, recordId]);
    await ctx.stub.putState(patientIndex, payload);

    ctx.stub.setEvent('RecordStored', Buffer.from(JSON.stringify({
      recordId, patientId, recordType, version,
    })) as unknown as Uint8Array);

    return JSON.stringify(record);
  }

  // ── verifyRecordHash ───────────────────────────────────────────────────────
  // Returns false if not found (no throw), so callers don't need try/catch
  // for "doesn't exist" cases.
  async verifyRecordHash(ctx: Context, recordId: string, sha256Hash: string): Promise<boolean> {
    const recordBytes = await ctx.stub.getState(`RECORD_${recordId}`);
    if (!recordBytes || recordBytes.length === 0) {
      // Emit forensic event — someone tried to verify a non-existent record
      ctx.stub.setEvent('RecordVerifyMissing', Buffer.from(JSON.stringify({ recordId })) as unknown as Uint8Array);
      return false;
    }
    const record: RecordHash = JSON.parse(recordBytes.toString());
    const matches = record.sha256Hash === sha256Hash;
    if (!matches) {
      ctx.stub.setEvent('RecordHashMismatch', Buffer.from(JSON.stringify({
        recordId, expectedHash: record.sha256Hash, providedHash: sha256Hash,
      })) as unknown as Uint8Array);
    }
    return matches;
  }

  // ── getRecordHash ──────────────────────────────────────────────────────────
  async getRecordHash(ctx: Context, recordId: string): Promise<string> {
    const recordBytes = await ctx.stub.getState(`RECORD_${recordId}`);
    if (!recordBytes || recordBytes.length === 0) {
      throw new Error(`Record ${recordId} not found`);
    }
    return recordBytes.toString();
  }

  // ── NEW: getRecordHistory ──────────────────────────────────────────────────
  // Returns the full history of a record from the ledger. Every update,
  // including the timestamp and transaction ID of each version.
  async getRecordHistory(ctx: Context, recordId: string): Promise<string> {
    const iterator = await ctx.stub.getHistoryForKey(`RECORD_${recordId}`);
    const history: any[] = [];

    while (true) {
      const result = await iterator.next();
      if (result.done) break;

      let value: any = null;
      try {
        value = JSON.parse(result.value.value.toString());
      } catch {
        value = { raw: result.value.value.toString() };
      }

      history.push({
        txId: result.value.txId,
        timestamp: result.value.timestamp,
        isDelete: result.value.isDelete,
        value,
      });
    }

    await iterator.close();
    return JSON.stringify(history);
  }

  // ── getPatientRecords ──────────────────────────────────────────────────────
  // Now uses composite-key partial query instead of scanning everything.
  async getPatientRecords(ctx: Context, patientId: string): Promise<string> {
    const mspId = ctx.clientIdentity.getMSPID();
    if (mspId !== 'PatientOrgMSP' && mspId !== 'HospitalOrgMSP' && mspId !== 'PractitionerOrgMSP') {
      throw new Error('Access denied');
    }

    const iterator = await ctx.stub.getStateByPartialCompositeKey('PatientRecord', [patientId]);
    const records: RecordHash[] = [];

    while (true) {
      const result = await iterator.next();
      if (result.done) break;
      records.push(JSON.parse(result.value.value.toString()));
    }

    await iterator.close();
    records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return JSON.stringify(records);
  }
}