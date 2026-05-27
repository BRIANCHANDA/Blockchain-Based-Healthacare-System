import * as grpc from '@grpc/grpc-js';
import { connect, Contract, Gateway, Identity, Signer, signers } from '@hyperledger/fabric-gateway';
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

// ── Connection pool ───────────────────────────────────────────────────────────
// Reuse grpc.Client and Gateway instances instead of creating a new one per
// call. Creating a gRPC channel is expensive and was contributing to timeouts.

type PoolEntry = { client: grpc.Client; gateway: Gateway; contract: Contract };
const pool = new Map<string, PoolEntry>();

function getFirstFile(dirPath: string): string {
  const files = fs.readdirSync(dirPath);
  if (!files.length) throw new Error(`No files in ${dirPath}`);
  return path.join(dirPath, files[0]);
}

function getConnection(org: 'hospital' | 'patient' | 'practitioner'): PoolEntry {
  const cached = pool.get(org);
  if (cached) return cached;

  const cfg = orgConfig(org);
  const tlsCert = fs.readFileSync(cfg.tlsCertPath);
  const credentials = grpc.credentials.createSsl(tlsCert);

  const client = new grpc.Client(cfg.peerEndpoint, credentials, {
    'grpc.ssl_target_name_override': cfg.hostAlias,
    // Keep-alive so idle connections don't drop
    'grpc.keepalive_time_ms': 10_000,
    'grpc.keepalive_timeout_ms': 5_000,
    'grpc.keepalive_permit_without_calls': 1,
    'grpc.http2.max_pings_without_data': 0,
    'grpc.http2.min_time_between_pings_ms': 10_000,
  });

  const certPath = getFirstFile(path.join(cfg.adminMspPath, 'signcerts'));
  const keyPath = getFirstFile(path.join(cfg.adminMspPath, 'keystore'));
  const identity: Identity = { mspId: cfg.mspId, credentials: fs.readFileSync(certPath) };
  const signer: Signer = signers.newPrivateKeySigner(
    crypto.createPrivateKey(fs.readFileSync(keyPath))
  );

  const gateway = connect({
    client,
    identity,
    signer,
    // Generous deadlines — evaluated once at gateway level
    evaluateOptions: () => ({ deadline: Date.now() + 10_000 }),
    endorseOptions: () => ({ deadline: Date.now() + 15_000 }),
    submitOptions: () => ({ deadline: Date.now() + 15_000 }), // was 5s — too tight
    commitStatusOptions: () => ({ deadline: Date.now() + 60_000 }),
  });

  const contract = gateway.getNetwork(CHANNEL).getContract(CHAINCODE);
  const entry: PoolEntry = { client, gateway, contract };
  pool.set(org, entry);
  return entry;
}

/**
 * Race a Fabric call against a timeout.
 * On timeout or any error, calls onFailure (default: throws).
 */
async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  label: string,
  onTimeout: () => T,
): Promise<T> {
  const timer = new Promise<T>((resolve) =>
    setTimeout(() => resolve(onTimeout()), timeoutMs)
  );
  try {
    return await Promise.race([fn(), timer]);
  } catch (err: any) {
    // If the pooled connection broke, clear it so next call gets a fresh one
    if (err?.code === 4 /* DEADLINE_EXCEEDED */ || err?.code === 14 /* UNAVAILABLE */) {
      console.warn(`[FABRIC] ${label}: peer unreachable (code=${err.code}), clearing pool`);
      pool.clear();
    } else {
      console.warn(`[FABRIC] ${label}: ${err?.message ?? err}`);
    }
    return onTimeout();
  }
}

// ── ACCESS CONTROL ────────────────────────────────────────────────────────────

/**
 * Grant permission — must be PatientOrg (chaincode enforces MSP check).
 */
export async function grantPermission(
  patientId: string,
  practitionerId: string,
  durationHours: string,
): Promise<object> {
  const { contract } = getConnection('patient');
  const result = await contract.submitTransaction(
    'AccessControlContract:grantPermission',
    patientId, practitionerId, durationHours
  );
  return JSON.parse(Buffer.from(result).toString());
}

/**
 * Revoke permission — must be PatientOrg.
 */
export async function revokePermission(
  patientId: string,
  practitionerId: string,
): Promise<object> {
  const { contract } = getConnection('patient');
  const result = await contract.submitTransaction(
    'AccessControlContract:revokePermission',
    patientId, practitionerId
  );
  return JSON.parse(Buffer.from(result).toString());
}

/**
 * Check permission — read-only evaluate.
 * Returns false on timeout or any error rather than throwing.
 * Callers should never crash because Fabric is slow.
 */
export async function checkPermission(
  patientId: string,
  practitionerId: string,
): Promise<boolean> {
  return withTimeout(
    async () => {
      const { contract } = getConnection('hospital');
      const result = await contract.evaluateTransaction(
        'AccessControlContract:checkPermission',
        patientId, practitionerId
      );
      return Buffer.from(result).toString() === 'true';
    },
    8_000,
    'checkPermission',
    () => false,  // deny on timeout — conservative
  );
}

export async function getPatientPermissions(patientAddress: string): Promise<any[]> {
  return withTimeout(
    async () => {
      const { contract } = getConnection('patient');
      const result = await contract.evaluateTransaction(
        'AccessControlContract:getPatientPermissions',
        patientAddress
      );
      return JSON.parse(Buffer.from(result).toString());
    },
    8_000,
    'getPatientPermissions',
    () => [],
  );
}

// ── AUDIT ─────────────────────────────────────────────────────────────────────

export async function logAccess(
  patientId: string,
  recordId: string,
  action: string,
  success: boolean,
): Promise<object> {
  return withTimeout(
    async () => {
      const { contract } = getConnection('hospital');
      const result = await contract.submitTransaction(
        'AuditContract:logAccess',
        patientId, recordId, action, success.toString()
      );
      return JSON.parse(Buffer.from(result).toString());
    },
    12_000,
    'logAccess',
    () => ({ success: false, skipped: true }),
  );
}

export async function getPatientAuditLog(patientId: string): Promise<object[]> {
  return withTimeout(
    async () => {
      const { contract } = getConnection('hospital');
      const result = await contract.evaluateTransaction(
        'AuditContract:getPatientAuditLog',
        patientId
      );
      return JSON.parse(Buffer.from(result).toString());
    },
    8_000,
    'getPatientAuditLog',
    () => [],
  );
}

// ── RECORDS ───────────────────────────────────────────────────────────────────

/**
 * Store a record hash on-chain.
 * Non-fatal — if Fabric is down, logs a warning and returns silently.
 * Never throws. Always call with .catch(() => {}) or fire-and-forget.
 */
export async function storeRecordHash(
  recordId: string,
  patientId: string,
  sha256Hash: string,
  recordType: string,
): Promise<void> {
  await withTimeout(
    async () => {
      const { contract } = getConnection('hospital');
      await contract.submitTransaction(
        'RecordContract:storeRecordHash',
        recordId, patientId, sha256Hash, recordType
      );
    },
    12_000,
    `storeRecordHash(${recordType}:${recordId})`,
    () => undefined,  // silent no-op on timeout
  );
}

export async function verifyRecordHash(
  recordId: string,
  sha256Hash: string,
): Promise<boolean> {
  return withTimeout(
    async () => {
      const { contract } = getConnection('hospital');
      const result = await contract.evaluateTransaction(
        'RecordContract:verifyRecordHash',
        recordId, sha256Hash
      );
      return Buffer.from(result).toString() === 'true';
    },
    8_000,
    'verifyRecordHash',
    () => false,
  );
}