import { Contract, Context } from 'fabric-contract-api';

interface RecordHash {
  recordId: string;
  patientId: string;
  sha256Hash: string;
  recordType: string;
  createdBy: string;
  creatorMSP: string;
  timestamp: string;
}

export class RecordContract extends Contract {

  constructor() {
    super('RecordContract');
  }

  async storeRecordHash(
    ctx: Context,
    recordId: string,
    patientId: string,
    sha256Hash: string,
    recordType: string
  ): Promise<string> {
    const mspId = ctx.clientIdentity.getMSPID();

    // Only hospital or practitioner can create records
    if (mspId !== 'HospitalOrgMSP' && mspId !== 'PractitionerOrgMSP') {
      throw new Error(`Access denied: only hospitals and practitioners can store records`);
    }

    const existing = await ctx.stub.getState(`RECORD_${recordId}`);
    if (existing && existing.length > 0) {
      throw new Error(`Record ${recordId} already exists`);
    }

    const record: RecordHash = {
      recordId,
      patientId,
      sha256Hash,
      recordType,
      createdBy: ctx.clientIdentity.getID(),
      creatorMSP: mspId,
      timestamp: new Date().toISOString()
    };

    await ctx.stub.putState(
      `RECORD_${recordId}`,
      Buffer.from(JSON.stringify(record))
    );

    ctx.stub.setEvent('RecordStored', Buffer.from(JSON.stringify({
      recordId,
      patientId,
      recordType
    })));

    return JSON.stringify(record);
  }

  async verifyRecordHash(
    ctx: Context,
    recordId: string,
    sha256Hash: string
  ): Promise<boolean> {
    const recordBytes = await ctx.stub.getState(`RECORD_${recordId}`);

    if (!recordBytes || recordBytes.length === 0) {
      throw new Error(`Record ${recordId} not found on blockchain`);
    }

    const record: RecordHash = JSON.parse(recordBytes.toString());
    return record.sha256Hash === sha256Hash;
  }

  async getRecordHash(
    ctx: Context,
    recordId: string
  ): Promise<string> {
    const recordBytes = await ctx.stub.getState(`RECORD_${recordId}`);

    if (!recordBytes || recordBytes.length === 0) {
      throw new Error(`Record ${recordId} not found`);
    }

    return recordBytes.toString();
  }

  async getPatientRecords(
    ctx: Context,
    patientId: string,
    requestorId: string
  ): Promise<string> {
    const mspId = ctx.clientIdentity.getMSPID();

    // Patients can see their own, practitioners need permission check
    if (mspId !== 'PatientOrgMSP' && mspId !== 'HospitalOrgMSP' && mspId !== 'PractitionerOrgMSP') {
      throw new Error('Access denied');
    }

    const iterator = await ctx.stub.getStateByRange(
      `RECORD_`,
      `RECORD_~`
    );

    const records: RecordHash[] = [];

    while (true) {
      const result = await iterator.next();
      if (result.done) break;
      const record: RecordHash = JSON.parse(result.value.value.toString());
      if (record.patientId === patientId) {
        records.push(record);
      }
    }

    await iterator.close();
    return JSON.stringify(records);
  }
}
