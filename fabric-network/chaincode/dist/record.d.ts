import { Contract, Context } from 'fabric-contract-api';
export declare class RecordContract extends Contract {
    constructor();
    storeRecordHash(ctx: Context, recordId: string, patientId: string, sha256Hash: string, recordType: string): Promise<string>;
    verifyRecordHash(ctx: Context, recordId: string, sha256Hash: string): Promise<boolean>;
    getRecordHash(ctx: Context, recordId: string): Promise<string>;
    getPatientRecords(ctx: Context, patientId: string, requestorId: string): Promise<string>;
}
