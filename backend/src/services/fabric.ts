import * as grpc from '@grpc/grpc-js';
import { connect, Contract, Identity, Signer, signers } from '@hyperledger/fabric-gateway';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const NETWORK_PATH = process.env.FABRIC_NETWORK_PATH!;
const CHANNEL = process.env.FABRIC_CHANNEL!;
const CHAINCODE = process.env.FABRIC_CHAINCODE!;

// ── Org configs ───────────────────────────────────────────────────────────────

type OrgConfig = {
  mspId: string;
  peerEndpoint: string;
  hostAlias: string;
  tlsCertPath: string;
  adminMspPath: string;
};

function orgConfig(org: 'hospital' | 'patient' | 'practitioner'): OrgConfig {
  const base = NETWORK_PATH;
  switch (org) {
    case 'hospital':
      return {
        mspId: 'HospitalOrgMSP',
        peerEndpoint: 'peer0.hospital.healthcare.com:7051',
        hostAlias: 'peer0.hospital.healthcare.com',
        tlsCertPath: path.join(base, 'organizations/peerOrganizations/hospital.healthcare.com/peers/peer0.hospital.healthcare.com/tls/ca.crt'),
        adminMspPath: path.join(base, 'organizations/peerOrganizations/hospital.healthcare.com/users/Admin@hospital.healthcare.com/msp'),
      };
    case 'patient':
      return {
        mspId: 'PatientOrgMSP',
        peerEndpoint: 'peer0.patient.healthcare.com:11051',
        hostAlias: 'peer0.patient.healthcare.com',
        tlsCertPath: path.join(base, 'organizations/peerOrganizations/patient.healthcare.com/peers/peer0.patient.healthcare.com/tls/ca.crt'),
        adminMspPath: path.join(base, 'organizations/peerOrganizations/patient.healthcare.com/users/Admin@patient.healthcare.com/msp'),
      };
    case 'practitioner':
      return {
        mspId: 'PractitionerOrgMSP',
        peerEndpoint: 'peer0.practitioner.healthcare.com:9051',
        hostAlias: 'peer0.practitioner.healthcare.com',
        tlsCertPath: path.join(base, 'organizations/peerOrganizations/practitioner.healthcare.com/peers/peer0.practitioner.healthcare.com/tls/ca.crt'),
        adminMspPath: path.join(base, 'organizations/peerOrganizations/practitioner.healthcare.com/users/Admin@practitioner.healthcare.com/msp'),
      };
  }
}

// ── Connection helpers ────────────────────────────────────────────────────────

function getFirstFile(dirPath: string): string {
  const files = fs.readdirSync(dirPath);
  if (!files.length) throw new Error(`No files found in ${dirPath}`);
  return path.join(dirPath, files[0]);
}

async function getContract(org: 'hospital' | 'patient' | 'practitioner' = 'hospital'): Promise<{ contract: Contract; client: grpc.Client }> {
  const cfg = orgConfig(org);

  const tlsCert = fs.readFileSync(cfg.tlsCertPath);
  const tlsCredentials = grpc.credentials.createSsl(tlsCert);
  const client = new grpc.Client(cfg.peerEndpoint, tlsCredentials, {
    'grpc.ssl_target_name_override': cfg.hostAlias,
  });

  const certPath = getFirstFile(path.join(cfg.adminMspPath, 'signcerts'));
  const keyPath = getFirstFile(path.join(cfg.adminMspPath, 'keystore'));
  const credentials = fs.readFileSync(certPath);
  const privateKey = crypto.createPrivateKey(fs.readFileSync(keyPath));

  const identity: Identity = { mspId: cfg.mspId, credentials };
  const signer: Signer = signers.newPrivateKeySigner(privateKey);

  const gateway = connect({
    client,
    identity,
    signer,
    evaluateOptions: () => ({ deadline: Date.now() + 5000 }),
    endorseOptions: () => ({ deadline: Date.now() + 15000 }),
    submitOptions: () => ({ deadline: Date.now() + 5000 }),
    commitStatusOptions: () => ({ deadline: Date.now() + 60000 }),
  });

  const network = gateway.getNetwork(CHANNEL);
  const contract = network.getContract(CHAINCODE);
  return { contract, client };
}

// ── ACCESS CONTROL ────────────────────────────────────────────────────────────

/**
 * Grant permission — MUST be called as PatientOrg because the chaincode
 * checks that the caller's MSP is PatientOrgMSP.
 */
export async function grantPermission(
  patientId: string,
  practitionerId: string,
  durationHours: string
): Promise<object> {
  const { contract, client } = await getContract('patient');
  try {
    const result = await contract.submitTransaction(
      'AccessControlContract:grantPermission',
      patientId,
      practitionerId,
      durationHours
    );
    return JSON.parse(Buffer.from(result).toString());
  } finally {
    client.close();
  }
}

/**
 * Revoke permission — also requires PatientOrg identity.
 */
export async function revokePermission(
  patientId: string,
  practitionerId: string
): Promise<object> {
  const { contract, client } = await getContract('patient');
  try {
    const result = await contract.submitTransaction(
      'AccessControlContract:revokePermission',
      patientId,
      practitionerId
    );
    return JSON.parse(Buffer.from(result).toString());
  } finally {
    client.close();
  }
}

/**
 * Check permission — read-only evaluate, any org works.
 */
export async function checkPermission(
  patientId: string,
  practitionerId: string
): Promise<boolean> {
  const { contract, client } = await getContract('hospital');
  try {
    const result = await contract.evaluateTransaction(
      'AccessControlContract:checkPermission',
      patientId,
      practitionerId
    );
    return Buffer.from(result).toString() === 'true';
  } finally {
    client.close();
  }
}

export async function getPatientPermissions(patientAddress: string): Promise<any[]> {
  const { contract, client } = await getContract('patient');
  try {
    const result = await contract.evaluateTransaction(
      'AccessControlContract:getPatientPermissions',
      patientAddress
    );
    return JSON.parse(Buffer.from(result).toString());
  } catch (err) {
    console.error('Failed to get patient permissions from blockchain:', err);
    return [];
  } finally {
    client.close();
  }
}

// ── AUDIT ─────────────────────────────────────────────────────────────────────

export async function logAccess(
  patientId: string,
  recordId: string,
  action: string,
  success: boolean
): Promise<object> {
  const { contract, client } = await getContract('hospital');
  try {
    const result = await contract.submitTransaction(
      'AuditContract:logAccess',
      patientId,
      recordId,
      action,
      success.toString()
    );
    return JSON.parse(Buffer.from(result).toString());
  } finally {
    client.close();
  }
}

export async function getPatientAuditLog(patientId: string): Promise<object[]> {
  const { contract, client } = await getContract('hospital');
  try {
    const result = await contract.evaluateTransaction(
      'AuditContract:getPatientAuditLog',
      patientId
    );
    return JSON.parse(Buffer.from(result).toString());
  } finally {
    client.close();
  }
}

// ── RECORDS ───────────────────────────────────────────────────────────────────

export async function storeRecordHash(
  recordId: string,
  patientId: string,
  sha256Hash: string,
  recordType: string
): Promise<object> {
  const { contract, client } = await getContract('hospital');
  try {
    const result = await contract.submitTransaction(
      'RecordContract:storeRecordHash',
      recordId,
      patientId,
      sha256Hash,
      recordType
    );
    return JSON.parse(Buffer.from(result).toString());
  } finally {
    client.close();
  }
}

export async function verifyRecordHash(
  recordId: string,
  sha256Hash: string
): Promise<boolean> {
  const { contract, client } = await getContract('hospital');
  try {
    const result = await contract.evaluateTransaction(
      'RecordContract:verifyRecordHash',
      recordId,
      sha256Hash
    );
    return Buffer.from(result).toString() === 'true';
  } finally {
    client.close();
  }
}