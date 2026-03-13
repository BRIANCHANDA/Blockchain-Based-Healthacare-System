import { Contract, Context } from 'fabric-contract-api';

interface AuditLog {
  logId: string;
  patientId: string;
  accessedBy: string;
  accessorMSP: string;
  action: string;
  recordId: string;
  timestamp: string;
  success: boolean;
}

export class AuditContract extends Contract {

  constructor() {
    super('AuditContract');
  }

  async logAccess(
    ctx: Context,
    patientId: string,
    recordId: string,
    action: string,
    success: string
  ): Promise<string> {
    const txId = ctx.stub.getTxID();
    const clientId = ctx.clientIdentity.getID();
    const mspId = ctx.clientIdentity.getMSPID();
    const timestamp = new Date().toISOString();

    const log: AuditLog = {
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
    await ctx.stub.putState(key, Buffer.from(JSON.stringify(log)) as unknown as Uint8Array);

    ctx.stub.setEvent('AccessLogged', Buffer.from(JSON.stringify(log)) as unknown as Uint8Array);

    return JSON.stringify(log);
  }

  async getPatientAuditLog(
    ctx: Context,
    patientId: string
  ): Promise<string> {
    const iterator = await ctx.stub.getStateByRange(
      `AUDIT_${patientId}_`,
      `AUDIT_${patientId}~`
    );

    const logs: AuditLog[] = [];

    while (true) {
      const result = await iterator.next();
      if (result.done) break;
      const log = JSON.parse(result.value.value.toString());
      logs.push(log);
    }

    await iterator.close();

    // Sort by timestamp newest first
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return JSON.stringify(logs);
  }

  async getAuditEntry(
    ctx: Context,
    patientId: string,
    logId: string
  ): Promise<string> {
    const key = `AUDIT_${patientId}_${logId}`;
    const logBytes = await ctx.stub.getState(key);

    if (!logBytes || logBytes.length === 0) {
      throw new Error(`Audit log ${logId} not found`);
    }

    return logBytes.toString();
  }
}
