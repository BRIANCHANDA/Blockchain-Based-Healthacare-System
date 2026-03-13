"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditContract = void 0;
const fabric_contract_api_1 = require("fabric-contract-api");
class AuditContract extends fabric_contract_api_1.Contract {
    constructor() {
        super('AuditContract');
    }
    async logAccess(ctx, patientId, recordId, action, success) {
        const txId = ctx.stub.getTxID();
        const clientId = ctx.clientIdentity.getID();
        const mspId = ctx.clientIdentity.getMSPID();
        const timestamp = new Date().toISOString();
        const log = {
            logId: txId,
            patientId,
            accessedBy: clientId,
            accessorMSP: mspId,
            action,
            recordId,
            timestamp,
            success: success === 'true'
        };
        const key = `AUDIT_${patientId}_${txId}`;
        await ctx.stub.putState(key, Buffer.from(JSON.stringify(log)));
        ctx.stub.setEvent('AccessLogged', Buffer.from(JSON.stringify(log)));
        return JSON.stringify(log);
    }
    async getPatientAuditLog(ctx, patientId) {
        const iterator = await ctx.stub.getStateByRange(`AUDIT_${patientId}_`, `AUDIT_${patientId}~`);
        const logs = [];
        while (true) {
            const result = await iterator.next();
            if (result.done)
                break;
            const log = JSON.parse(result.value.value.toString());
            logs.push(log);
        }
        await iterator.close();
        // Sort by timestamp newest first
        logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return JSON.stringify(logs);
    }
    async getAuditEntry(ctx, patientId, logId) {
        const key = `AUDIT_${patientId}_${logId}`;
        const logBytes = await ctx.stub.getState(key);
        if (!logBytes || logBytes.length === 0) {
            throw new Error(`Audit log ${logId} not found`);
        }
        return logBytes.toString();
    }
}
exports.AuditContract = AuditContract;
