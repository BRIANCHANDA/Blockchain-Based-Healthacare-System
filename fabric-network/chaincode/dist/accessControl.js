"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccessControlContract = void 0;
const fabric_contract_api_1 = require("fabric-contract-api");
class AccessControlContract extends fabric_contract_api_1.Contract {
    constructor() {
        super('AccessControlContract');
    }
    async grantPermission(ctx, patientId, practitionerId, durationHours) {
        const clientId = ctx.clientIdentity.getID();
        const mspId = ctx.clientIdentity.getMSPID();
        // Only patients can grant permissions
        if (mspId !== 'PatientOrgMSP') {
            throw new Error(`Access denied: only patients can grant permissions. Your MSP: ${mspId}`);
        }
        const now = new Date();
        const expires = new Date(now.getTime() + parseInt(durationHours) * 60 * 60 * 1000);
        const permission = {
            patientId,
            practitionerId,
            grantedAt: now.toISOString(),
            expiresAt: expires.toISOString(),
            active: true,
            grantedBy: clientId
        };
        const key = `PERM_${patientId}_${practitionerId}`;
        await ctx.stub.putState(key, Buffer.from(JSON.stringify(permission)));
        ctx.stub.setEvent('PermissionGranted', Buffer.from(JSON.stringify({
            patientId,
            practitionerId,
            expiresAt: expires.toISOString()
        })));
        return JSON.stringify(permission);
    }
    async revokePermission(ctx, patientId, practitionerId) {
        const mspId = ctx.clientIdentity.getMSPID();
        if (mspId !== 'PatientOrgMSP') {
            throw new Error(`Access denied: only patients can revoke permissions. Your MSP: ${mspId}`);
        }
        const key = `PERM_${patientId}_${practitionerId}`;
        const permBytes = await ctx.stub.getState(key);
        if (!permBytes || permBytes.length === 0) {
            throw new Error(`Permission not found for patient ${patientId} and practitioner ${practitionerId}`);
        }
        const permission = JSON.parse(permBytes.toString());
        permission.active = false;
        await ctx.stub.putState(key, Buffer.from(JSON.stringify(permission)));
        ctx.stub.setEvent('PermissionRevoked', Buffer.from(JSON.stringify({
            patientId,
            practitionerId
        })));
        return JSON.stringify(permission);
    }
    async checkPermission(ctx, patientId, practitionerId) {
        const key = `PERM_${patientId}_${practitionerId}`;
        const permBytes = await ctx.stub.getState(key);
        if (!permBytes || permBytes.length === 0) {
            return false;
        }
        const permission = JSON.parse(permBytes.toString());
        if (!permission.active) {
            return false;
        }
        const now = new Date();
        const expires = new Date(permission.expiresAt);
        if (now > expires) {
            // Auto-expire
            permission.active = false;
            await ctx.stub.putState(key, Buffer.from(JSON.stringify(permission)));
            return false;
        }
        return true;
    }
    async getPermission(ctx, patientId, practitionerId) {
        const key = `PERM_${patientId}_${practitionerId}`;
        const permBytes = await ctx.stub.getState(key);
        if (!permBytes || permBytes.length === 0) {
            throw new Error(`No permission record found`);
        }
        return permBytes.toString();
    }
    async getPatientPermissions(ctx, patientId) {
        const iterator = await ctx.stub.getStateByRange(`PERM_${patientId}_`, `PERM_${patientId}~`);
        const permissions = [];
        while (true) {
            const result = await iterator.next();
            if (result.done)
                break;
            const perm = JSON.parse(result.value.value.toString());
            permissions.push(perm);
        }
        await iterator.close();
        return JSON.stringify(permissions);
    }
}
exports.AccessControlContract = AccessControlContract;
