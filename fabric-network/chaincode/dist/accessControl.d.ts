import { Contract, Context } from 'fabric-contract-api';
export declare class AccessControlContract extends Contract {
    constructor();
    private requirePatientIdentity;
    grantPermission(ctx: Context, patientId: string, practitionerId: string, durationHours: string): Promise<string>;
    revokePermission(ctx: Context, patientId: string, practitionerId: string): Promise<string>;
    checkPermission(ctx: Context, patientId: string, practitionerId: string): Promise<boolean>;
    getPermission(ctx: Context, patientId: string, practitionerId: string): Promise<string>;
    getPatientPermissions(ctx: Context, patientId: string): Promise<string>;
    getPermissionHistory(ctx: Context, patientId: string, practitionerId: string): Promise<string>;
}
