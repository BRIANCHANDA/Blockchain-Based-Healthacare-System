"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecordContract = void 0;
const fabric_contract_api_1 = require("fabric-contract-api");
class RecordContract extends fabric_contract_api_1.Contract {
    constructor() {
        super('RecordContract');
    }
    async storeRecordHash(ctx, recordId, patientId, sha256Hash, recordType) {
        const mspId = ctx.clientIdentity.getMSPID();
        // Only hospital or practitioner can create records
        if (mspId !== 'HospitalOrgMSP' && mspId !== 'PractitionerOrgMSP') {
            throw new Error(`Access denied: only hospitals and practitioners can store records`);
        }
        const existing = await ctx.stub.getState(`RECORD_${recordId}`);
        if (existing && existing.length > 0) {
            throw new Error(`Record ${recordId} already exists`);
        }
        const record = {
            recordId,
            patientId,
            sha256Hash,
            recordType,
            createdBy: ctx.clientIdentity.getID(),
            creatorMSP: mspId,
            timestamp: new Date().toISOString()
        };
        await ctx.stub.putState(`RECORD_${recordId}`, Buffer.from(JSON.stringify(record)));
        ctx.stub.setEvent('RecordStored', Buffer.from(JSON.stringify({
            recordId,
            patientId,
            recordType
        })));
        return JSON.stringify(record);
    }
    async verifyRecordHash(ctx, recordId, sha256Hash) {
        const recordBytes = await ctx.stub.getState(`RECORD_${recordId}`);
        if (!recordBytes || recordBytes.length === 0) {
            throw new Error(`Record ${recordId} not found on blockchain`);
        }
        const record = JSON.parse(recordBytes.toString());
        return record.sha256Hash === sha256Hash;
    }
    async getRecordHash(ctx, recordId) {
        const recordBytes = await ctx.stub.getState(`RECORD_${recordId}`);
        if (!recordBytes || recordBytes.length === 0) {
            throw new Error(`Record ${recordId} not found`);
        }
        return recordBytes.toString();
    }
    async getPatientRecords(ctx, patientId, requestorId) {
        const mspId = ctx.clientIdentity.getMSPID();
        // Patients can see their own, practitioners need permission check
        if (mspId !== 'PatientOrgMSP' && mspId !== 'HospitalOrgMSP' && mspId !== 'PractitionerOrgMSP') {
            throw new Error('Access denied');
        }
        const iterator = await ctx.stub.getStateByRange(`RECORD_`, `RECORD_~`);
        const records = [];
        while (true) {
            const result = await iterator.next();
            if (result.done)
                break;
            const record = JSON.parse(result.value.value.toString());
            if (record.patientId === patientId) {
                records.push(record);
            }
        }
        await iterator.close();
        return JSON.stringify(records);
    }
}
exports.RecordContract = RecordContract;
