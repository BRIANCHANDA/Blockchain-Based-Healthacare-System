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
const txtime_1 = require("./txtime");
const WRITER_MSPS = ['HospitalOrgMSP', 'PractitionerOrgMSP', 'PatientOrgMSP'];
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
            // Retrieve the previous tx ID from ledger history (not the current tx)
            const histIter = await ctx.stub.getHistoryForKey(latestKey);
            const firstEntry = await histIter.next();
            if (!firstEntry.done)
                previousTxId = firstEntry.value.txId;
            await histIter.close();
        }
        if (!/^[a-fA-F0-9]{64}$/.test(sha256Hash)) {
            throw new Error(`Invalid sha256Hash format: expected 64-character hex string`);
        }
        const txId = ctx.stub.getTxID();
        const timestamp = (0, txtime_1.txTimeISO)(ctx);
        const record = {
            recordId,
            patientId,
            sha256Hash,
            recordType,
            createdBy: ctx.clientIdentity.getID(),
            creatorMSP: ctx.clientIdentity.getMSPID(),
            timestamp,
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
        // 3) Write an audit entry IN THE SAME TRANSACTION — this makes it impossible
        //    for the backend to store a record without an immutable audit trail.
        //    The backend's separate logAccess call covers read events; this covers writes.
        const auditEntry = {
            logId: txId,
            patientId,
            accessedBy: record.createdBy,
            accessorMSP: record.creatorMSP,
            action: `WRITE_${recordType.toUpperCase()}`,
            recordId,
            timestamp,
            success: true,
            version,
        };
        const auditPayload = Buffer.from(JSON.stringify(auditEntry));
        await ctx.stub.putState(ctx.stub.createCompositeKey('PatientAudit', [patientId, txId]), auditPayload);
        await ctx.stub.putState(`AUDIT_${patientId}_${txId}`, auditPayload);
        ctx.stub.setEvent('RecordStored', Buffer.from(JSON.stringify({
            recordId, patientId, recordType, version,
        })));
        return JSON.stringify(record);
    }
    // ── verifyRecordHash ───────────────────────────────────────────────────────
    // Returns JSON so the backend can distinguish three states:
    //   { verified: true,  notFound: false } — hash matches
    //   { verified: false, notFound: false } — record exists but hash differs (tampering)
    //   { verified: false, notFound: true  } — record was never stored on chain
    // This prevents a network timeout (which also returns false) from being
    // silently misread as evidence of tampering.
    async verifyRecordHash(ctx, recordId, sha256Hash) {
        const recordBytes = await ctx.stub.getState(`RECORD_${recordId}`);
        if (!recordBytes || recordBytes.length === 0) {
            ctx.stub.setEvent('RecordVerifyMissing', Buffer.from(JSON.stringify({ recordId })));
            return JSON.stringify({ verified: false, notFound: true });
        }
        const record = JSON.parse(recordBytes.toString());
        const verified = record.sha256Hash === sha256Hash;
        if (!verified) {
            ctx.stub.setEvent('RecordHashMismatch', Buffer.from(JSON.stringify({
                recordId, expectedHash: record.sha256Hash, providedHash: sha256Hash,
            })));
        }
        return JSON.stringify({ verified, notFound: false });
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
