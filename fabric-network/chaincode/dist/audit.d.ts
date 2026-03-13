import { Contract, Context } from 'fabric-contract-api';
export declare class AuditContract extends Contract {
    constructor();
    logAccess(ctx: Context, patientId: string, recordId: string, action: string, success: string): Promise<string>;
    getPatientAuditLog(ctx: Context, patientId: string): Promise<string>;
    getAuditEntry(ctx: Context, patientId: string, logId: string): Promise<string>;
}
