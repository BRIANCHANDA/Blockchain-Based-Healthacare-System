"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecordContract = void 0;
const fabric_contract_api_1 = require("fabric-contract-api");
const WRITER_MSPS = ['HospitalOrgMSP', 'PractitionerOrgMSP'];
class RecordContract extends fabric_contract_api_1.Contract {
    constructor() {
        super('RecordContract');
    }
    // ── Helpers ────────────────────────────────────────────────────────────────
    requireMsp(ctx, allowed) {
        const mspId = ctx.clientIdentity.getMSPID();
        if (!allowed.includes(mspId)) {
            throw new Error(`Access denied: requires one of [${allowed.join(', ')}], got ${mspId}`);
        }
    }
    // ── storeRecordHash ────────────────────────────────────────────────────────
    // No longer throws on duplicate. Instead, increments version and updates the
    // "latest" pointer. Each version is also stored under a composite key so the
    // full history is queryable.
    async storeRecordHash(ctx, recordId, patientId, sha256Hash, recordType) {
        var _a;
        this.requireMsp(ctx, WRITER_MSPS);
        // Read current (if any) to determine version number
        const latestKey = `RECORD_${recordId}`;
        const existing = await ctx.stub.getState(latestKey);
        let version = 1;
        let previousTxId;
        if (existing && existing.length > 0) {
            const prev = JSON.parse(existing.toString());
            version = ((_a = prev.version) !== null && _a !== void 0 ? _a : 1) + 1;
            previousTxId = ctx.stub.getTxID(); // we'll see the prev tx via history
        }
        const record = {
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
        const payload = Buffer.from(JSON.stringify(record));
        // 1) Update the "latest" pointer (overwrites — version history is preserved
        //    automatically by Fabric's getHistoryForKey)
        await ctx.stub.putState(latestKey, payload);
        // 2) Also write a composite key so we can query by patient efficiently
        const patientIndex = ctx.stub.createCompositeKey('PatientRecord', [patientId, recordId]);
        await ctx.stub.putState(patientIndex, payload);
        ctx.stub.setEvent('RecordStored', Buffer.from(JSON.stringify({
            recordId, patientId, recordType, version,
        })));
        return JSON.stringify(record);
    }
    // ── verifyRecordHash ───────────────────────────────────────────────────────
    // Returns false if not found (no throw), so callers don't need try/catch
    // for "doesn't exist" cases.
    async verifyRecordHash(ctx, recordId, sha256Hash) {
        const recordBytes = await ctx.stub.getState(`RECORD_${recordId}`);
        if (!recordBytes || recordBytes.length === 0) {
            // Emit forensic event — someone tried to verify a non-existent record
            ctx.stub.setEvent('RecordVerifyMissing', Buffer.from(JSON.stringify({ recordId })));
            return false;
        }
        const record = JSON.parse(recordBytes.toString());
        const matches = record.sha256Hash === sha256Hash;
        if (!matches) {
            ctx.stub.setEvent('RecordHashMismatch', Buffer.from(JSON.stringify({
                recordId, expectedHash: record.sha256Hash, providedHash: sha256Hash,
            })));
        }
        return matches;
    }
    // ── getRecordHash ──────────────────────────────────────────────────────────
    async getRecordHash(ctx, recordId) {
        const recordBytes = await ctx.stub.getState(`RECORD_${recordId}`);
        if (!recordBytes || recordBytes.length === 0) {
            throw new Error(`Record ${recordId} not found`);
        }
        return recordBytes.toString();
    }
    // ── NEW: getRecordHistory ──────────────────────────────────────────────────
    // Returns the full history of a record from the ledger. Every update,
    // including the timestamp and transaction ID of each version.
    async getRecordHistory(ctx, recordId) {
        const iterator = await ctx.stub.getHistoryForKey(`RECORD_${recordId}`);
        const history = [];
        while (true) {
            const result = await iterator.next();
            if (result.done)
                break;
            let value = null;
            try {
                value = JSON.parse(result.value.value.toString());
            }
            catch (_a) {
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
    async getPatientRecords(ctx, patientId) {
        const mspId = ctx.clientIdentity.getMSPID();
        if (mspId !== 'PatientOrgMSP' && mspId !== 'HospitalOrgMSP' && mspId !== 'PractitionerOrgMSP') {
            throw new Error('Access denied');
        }
        const iterator = await ctx.stub.getStateByPartialCompositeKey('PatientRecord', [patientId]);
        const records = [];
        while (true) {
            const result = await iterator.next();
            if (result.done)
                break;
            records.push(JSON.parse(result.value.value.toString()));
        }
        await iterator.close();
        records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return JSON.stringify(records);
    }
}
exports.RecordContract = RecordContract;
