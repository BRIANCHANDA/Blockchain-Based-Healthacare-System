import { Contract, Context } from 'fabric-contract-api';

interface Permission {
  patientId: string;
  practitionerId: string;
  grantedAt: string;
  expiresAt: string;
  active: boolean;
  grantedBy: string;
}

export class AccessControlContract extends Contract {

  constructor() {
    super('AccessControlContract');
  }

  async grantPermission(
    ctx: Context,
    patientId: string,
    practitionerId: string,
    durationHours: string
  ): Promise<string> {
    const clientId = ctx.clientIdentity.getID();
    const mspId = ctx.clientIdentity.getMSPID();

    // Only patients can grant permissions
    if (mspId !== 'PatientOrgMSP') {
      throw new Error(`Access denied: only patients can grant permissions. Your MSP: ${mspId}`);
    }

    const now = new Date();
    const expires = new Date(now.getTime() + parseInt(durationHours) * 60 * 60 * 1000);

    const permission: Permission = {
      patientId,
      practitionerId,
      grantedAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      active: true,
      grantedBy: clientId
    };

    const key = `PERM_${patientId}_${practitionerId}`;
    await ctx.stub.putState(key, Buffer.from(JSON.stringify(permission)) as unknown as Uint8Array);

    ctx.stub.setEvent('PermissionGranted', Buffer.from(JSON.stringify({
      patientId,
      practitionerId,
      expiresAt: expires.toISOString()
    })) as unknown as Uint8Array);

    return JSON.stringify(permission);
  }

  async revokePermission(
    ctx: Context,
    patientId: string,
    practitionerId: string
  ): Promise<string> {
    const mspId = ctx.clientIdentity.getMSPID();

    if (mspId !== 'PatientOrgMSP') {
      throw new Error(`Access denied: only patients can revoke permissions. Your MSP: ${mspId}`);
    }

    const key = `PERM_${patientId}_${practitionerId}`;
    const permBytes = await ctx.stub.getState(key);

    if (!permBytes || permBytes.length === 0) {
      throw new Error(`Permission not found for patient ${patientId} and practitioner ${practitionerId}`);
    }

    const permission: Permission = JSON.parse(permBytes.toString());
    permission.active = false;

    await ctx.stub.putState(key, Buffer.from(JSON.stringify(permission)) as unknown as Uint8Array);

    ctx.stub.setEvent('PermissionRevoked', Buffer.from(JSON.stringify({
      patientId,
      practitionerId
    })) as unknown as Uint8Array);

    return JSON.stringify(permission);
  }

  async checkPermission(
    ctx: Context,
    patientId: string,
    practitionerId: string
  ): Promise<boolean> {
    const key = `PERM_${patientId}_${practitionerId}`;
    const permBytes = await ctx.stub.getState(key);

    if (!permBytes || permBytes.length === 0) {
      return false;
    }

    const permission: Permission = JSON.parse(permBytes.toString());

    if (!permission.active) {
      return false;
    }

    const now = new Date();
    const expires = new Date(permission.expiresAt);

    if (now > expires) {
      // Auto-expire
      permission.active = false;
      await ctx.stub.putState(key, Buffer.from(JSON.stringify(permission)) as unknown as Uint8Array);
      return false;
    }

    return true;
  }

  async getPermission(
    ctx: Context,
    patientId: string,
    practitionerId: string
  ): Promise<string> {
    const key = `PERM_${patientId}_${practitionerId}`;
    const permBytes = await ctx.stub.getState(key);

    if (!permBytes || permBytes.length === 0) {
      throw new Error(`No permission record found`);
    }

    return permBytes.toString();
  }

  async getPatientPermissions(
    ctx: Context,
    patientId: string
  ): Promise<string> {
    const iterator = await ctx.stub.getStateByRange(
      `PERM_${patientId}_`,
      `PERM_${patientId}~`
    );

    const permissions: Permission[] = [];

    while (true) {
      const result = await iterator.next();
      if (result.done) break;
      const perm = JSON.parse(result.value.value.toString());
      permissions.push(perm);
    }

    await iterator.close();
    return JSON.stringify(permissions);
  }
}
