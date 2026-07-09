// backend/src/services/fabric.ts
// REPLACE your existing fabric.ts with this version.
// Adds failure tracking + diagnostic logging for the admin dashboard.

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

export type OrgKey = 'hospital' | 'patient' | 'practitioner';

function orgConfig(org: OrgKey): OrgConfig {
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
// Each entry carries a createdAt timestamp. getConnection evicts and reconnects
// entries older than POOL_TTL_MS to prevent stale gRPC channels after a
// network restart or peer certificate rotation.
const POOL_TTL_MS = 5 * 60 * 1_000; // 5 minutes

type PoolEntry = { client: grpc.Client; gateway: Gateway; contract: Contract; createdAt: number };
const pool = new Map<string, PoolEntry>();

function getFirstFile(dirPath: string): string {
  const files = fs.readdirSync(dirPath);
  if (!files.length) throw new Error(`No files in ${dirPath}`);
  return path.join(dirPath, files[0]);
}

function getConnection(org: OrgKey): PoolEntry {
  const cached = pool.get(org);
  if (cached) {
    if (Date.now() - cached.createdAt < POOL_TTL_MS) return cached;
    // Evict stale connection before creating a new one
    try { cached.gateway.close(); } catch {}
    try { cached.client.close(); } catch {}
    pool.delete(org);
    console.log(`[FABRIC] Connection pool evicted stale entry for ${org} (TTL exceeded)`);
  }

  const cfg = orgConfig(org);
  const tlsCert = fs.readFileSync(cfg.tlsCertPath);
  const credentials = grpc.credentials.createSsl(tlsCert);

  const client = new grpc.Client(cfg.peerEndpoint, credentials, {
    'grpc.ssl_target_name_override': cfg.hostAlias,
    // Fabric peers reject pings more frequent than their server-side minimum
    // (default 300 s). 120 s gives headroom while still catching dead connections.
    'grpc.keepalive_time_ms': 120_000,
    'grpc.keepalive_timeout_ms': 20_000,
    // 0 = only ping when there are active RPC calls — stops idle connections
    // from flooding all 3 peers with pings every 10 s.
    'grpc.keepalive_permit_without_calls': 0,
    'grpc.http2.max_pings_without_data': 0,
    'grpc.http2.min_time_between_pings_ms': 120_000,
  });

  const certPath = getFirstFile(path.join(cfg.adminMspPath, 'signcerts'));
  const keyPath = getFirstFile(path.join(cfg.adminMspPath, 'keystore'));
  const identity: Identity = { mspId: cfg.mspId, credentials: fs.readFileSync(certPath) };
  const signer: Signer = signers.newPrivateKeySigner(
    crypto.createPrivateKey(fs.readFileSync(keyPath)),
  );

  const gateway = connect({
    client, identity, signer,
    evaluateOptions: () => ({ deadline: Date.now() + 10_000 }),
    endorseOptions: () => ({ deadline: Date.now() + 15_000 }),
    submitOptions: () => ({ deadline: Date.now() + 15_000 }),
    commitStatusOptions: () => ({ deadline: Date.now() + 60_000 }),
  });

  const contract = gateway.getNetwork(CHANNEL).getContract(CHAINCODE);
  const entry: PoolEntry = { client, gateway, contract, createdAt: Date.now() };
  pool.set(org, entry);
  return entry;
}

async function withTimeout<T>(fn: () => Promise<T>, timeoutMs: number, label: string, onTimeout: () => T): Promise<T> {
  const timer = new Promise<T>(resolve => setTimeout(() => resolve(onTimeout()), timeoutMs));
  try {
    return await Promise.race([fn(), timer]);
  } catch (err: any) {
    if (err?.code === 4 || err?.code === 14) {
      console.warn(`[FABRIC] ${label}: peer unreachable (code=${err.code}), clearing pool`);
      pool.clear();
    } else {
      console.warn(`[FABRIC] ${label}: ${err?.message ?? err}`);
    }
    return onTimeout();
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ── FAILURE TRACKING ──────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
//
// Every blockchain write goes through here. Failures are categorised and kept
// in an in-memory ring buffer, accessible from the admin dashboard.

type FailureEntry = {
  recordId: string;
  recordType: string;
  category: string;
  message: string;
  timestamp: string;
};

const failureLog: FailureEntry[] = [];
const MAX_FAILURE_LOG = 200;

function logFailure(recordId: string, recordType: string, category: string, message: string) {
  failureLog.push({
    recordId,
    recordType,
    category,
    message: message.slice(0, 300),
    timestamp: new Date().toISOString(),
  });
  if (failureLog.length > MAX_FAILURE_LOG) failureLog.shift();
}

export function getRecentFailures(): FailureEntry[] {
  return [...failureLog].reverse();
}

export function clearFailureLog() {
  failureLog.length = 0;
}

function categorizeError(err: any): string {
  const reason = err?.message ?? String(err);
  if (reason.includes('already exists')) return 'duplicate';
  if (reason.includes('timed out')) return 'timeout';
  if (reason.includes('UNAVAILABLE')) return 'peer_unreachable';
  if (reason.includes('Access denied')) return 'unauthorized';
  if (reason.includes('endorsement') || reason.includes('endorse transaction')) return 'endorsement_failed';
  if (reason.includes('DEADLINE')) return 'peer_timeout';
  if (err?.code === 4) return 'peer_timeout';
  if (err?.code === 14) return 'peer_unreachable';
  return 'unknown';
}

// ── ACCESS CONTROL ────────────────────────────────────────────────────────────
export async function grantPermission(patientId: string, practitionerId: string, durationHours: string): Promise<object> {
  const { contract } = getConnection('patient');
  const result = await contract.submitTransaction(
    'AccessControlContract:grantPermission',
    patientId, practitionerId, durationHours,
  );
  return JSON.parse(Buffer.from(result).toString());
}

export async function revokePermission(patientId: string, practitionerId: string): Promise<object> {
  const { contract } = getConnection('patient');
  const result = await contract.submitTransaction(
    'AccessControlContract:revokePermission',
    patientId, practitionerId,
  );
  return JSON.parse(Buffer.from(result).toString());
}

export async function checkPermission(patientId: string, practitionerId: string): Promise<boolean> {
  return withTimeout(
    async () => {
      const { contract } = getConnection('hospital');
      const result = await contract.evaluateTransaction(
        'AccessControlContract:checkPermission',
        patientId, practitionerId,
      );
      return Buffer.from(result).toString() === 'true';
    },
    8_000, 'checkPermission', () => false,
  );
}

export async function getPatientPermissions(patientAddress: string): Promise<any[]> {
  return withTimeout(
    async () => {
      const { contract } = getConnection('patient');
      const result = await contract.evaluateTransaction(
        'AccessControlContract:getPatientPermissions',
        patientAddress,
      );
      return JSON.parse(Buffer.from(result).toString());
    },
    8_000, 'getPatientPermissions', () => [],
  );
}

// ── AUDIT ─────────────────────────────────────────────────────────────────────
export async function logAccess(patientId: string, recordId: string, action: string, success: boolean): Promise<object> {
  return withTimeout(
    async () => {
      const { contract } = getConnection('hospital');
      const result = await contract.submitTransaction(
        'AuditContract:logAccess',
        patientId, recordId, action, success.toString(),
      );
      return JSON.parse(Buffer.from(result).toString());
    },
    12_000, 'logAccess', () => ({ success: false, skipped: true }),
  );
}

export async function getPatientAuditLog(patientId: string): Promise<object[]> {
  return withTimeout(
    async () => {
      const { contract } = getConnection('hospital');
      const result = await contract.evaluateTransaction(
        'AuditContract:getPatientAuditLog',
        patientId,
      );
      return JSON.parse(Buffer.from(result).toString());
    },
    8_000, 'getPatientAuditLog', () => [],
  );
}

// ── RECORDS ───────────────────────────────────────────────────────────────────
export async function storeRecordHash(
  recordId: string,
  patientId: string,
  sha256Hash: string,
  recordType: string,
): Promise<{ success: boolean; category?: string; error?: string }> {
  try {
    const { contract } = getConnection('hospital');
    const TIMEOUT = 12_000;

    // submitTransaction lets service discovery pick any 2 endorsing orgs.
    // All 3 MSPs are now in WRITER_MSPS so any 2-of-3 combination satisfies
    // both the endorsement policy and the chaincode requireMsp check.
    await Promise.race([
      contract.submitTransaction(
        'RecordContract:storeRecordHash',
        recordId, patientId, sha256Hash, recordType,
      ),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Fabric submit timed out after 12s')), TIMEOUT),
      ),
    ]);

    console.log(`[FABRIC ✓] Anchored ${recordType}:${recordId}`);
    return { success: true };
  } catch (err: any) {
    const category = categorizeError(err);
    const message = err?.message ?? String(err);
    console.warn(`[FABRIC ✗] ${recordType}:${recordId} — ${category}: ${message.slice(0, 200)}`);
    logFailure(recordId, recordType, category, message);

    if (category === 'peer_unreachable' || category === 'peer_timeout') {
      pool.clear();
    }
    return { success: false, category, error: message };
  }
}

export type VerifyResult = {
  verified: boolean;
  notFound: boolean;
  timedOut: boolean;
};

export async function verifyRecordHash(recordId: string, sha256Hash: string): Promise<VerifyResult> {
  return withTimeout<VerifyResult>(
    async () => {
      const { contract } = getConnection('hospital');
      const result = await contract.evaluateTransaction(
        'RecordContract:verifyRecordHash',
        recordId, sha256Hash,
      );
      const parsed = JSON.parse(Buffer.from(result).toString()) as { verified: boolean; notFound: boolean };
      return { ...parsed, timedOut: false };
    },
    8_000, 'verifyRecordHash',
    () => ({ verified: false, notFound: false, timedOut: true }),
  );
}

export async function getRecordHash(recordId: string): Promise<any | null> {
  return withTimeout(
    async () => {
      const { contract } = getConnection('hospital');
      const result = await contract.evaluateTransaction(
        'RecordContract:getRecordHash',
        recordId,
      );
      return JSON.parse(Buffer.from(result).toString());
    },
    8_000, 'getRecordHash', () => null,
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── NETWORK / ADMIN DASHBOARD HELPERS ────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
const ORGS = [
  { key: 'hospital' as OrgKey, label: 'Hospital Org', endpoint: 'peer0.hospital.healthcare.com:7051', mspId: 'HospitalOrgMSP' },
  { key: 'patient' as OrgKey, label: 'Patient Org', endpoint: 'peer0.patient.healthcare.com:11051', mspId: 'PatientOrgMSP' },
  { key: 'practitioner' as OrgKey, label: 'Practitioner Org', endpoint: 'peer0.practitioner.healthcare.com:9051', mspId: 'PractitionerOrgMSP' },
];

export async function getPeerStatus() {
  return Promise.all(ORGS.map(async (org) => {
    const start = Date.now();
    try {
      const { contract } = getConnection(org.key);
      await contract.evaluateTransaction(
        'AccessControlContract:checkPermission',
        '__ping__', '__ping__',
      );
      return { ...org, status: 'online' as const, latencyMs: Date.now() - start, error: null };
    } catch (err: any) {
      return { ...org, status: 'offline' as const, latencyMs: Date.now() - start, error: err?.message?.slice(0, 200) ?? 'unreachable' };
    }
  }));
}

export async function getChannelInfo(org: OrgKey = 'hospital') {
  return withTimeout(
    async () => {
      const { gateway } = getConnection(org);
      const qscc = gateway.getNetwork(CHANNEL).getContract('qscc');
      const result = await qscc.evaluateTransaction('GetChainInfo', CHANNEL);
      const bytes = Buffer.from(result);
      let height = 0;
      try {
        if (bytes[0] === 0x08) {
          let i = 1, shift = 0;
          while (i < bytes.length && i < 12) {
            const b = bytes[i++];
            height += (b & 0x7f) << shift;
            if ((b & 0x80) === 0) break;
            shift += 7;
          }
        }
      } catch { }
      return { channel: CHANNEL, chaincode: CHAINCODE, height, rawBytes: bytes.length };
    },
    8_000, 'getChannelInfo',
    () => ({ channel: CHANNEL, chaincode: CHAINCODE, height: 0, rawBytes: 0 }),
  );
}

export async function getBlockByNumber(blockNum: number, org: OrgKey = 'hospital') {
  return withTimeout(
    async () => {
      const { gateway } = getConnection(org);
      const qscc = gateway.getNetwork(CHANNEL).getContract('qscc');
      const result = await qscc.evaluateTransaction('GetBlockByNumber', CHANNEL, blockNum.toString());
      const bytes = Buffer.from(result);
      return {
        blockNumber: blockNum,
        sizeBytes: bytes.length,
        dataHash: crypto.createHash('sha256').update(bytes).digest('hex'),
      };
    },
    8_000, `getBlockByNumber(${blockNum})`, () => null,
  );
}

export async function getNetworkOverview() {
  const [peers, chain] = await Promise.all([getPeerStatus(), getChannelInfo('hospital')]);
  const onlinePeers = peers.filter(p => p.status === 'online').length;
  const totalPeers = peers.length;
  const status = onlinePeers === totalPeers && chain.height > 0
    ? 'healthy'
    : onlinePeers > 0 ? 'degraded' : 'down';
  return {
    health: { status, onlinePeers, totalPeers, blockHeight: chain.height },
    channel: { name: chain.channel, chaincode: chain.chaincode, height: chain.height },
    peers,
    organizations: ORGS,
  };
}


// ── Append to backend/src/services/fabric.ts ─────────────────────────────────
//
// Add this function alongside the other RecordContract wrappers
// (next to getRecordHash). Uses the new getRecordHistory chaincode method
// to return every version of a record from the ledger's built-in key history.

export async function getRecordHistory(recordId: string): Promise<any[]> {
  return withTimeout(
    async () => {
      const { contract } = getConnection('hospital');
      const result = await contract.evaluateTransaction(
        'RecordContract:getRecordHistory',
        recordId,
      );
      return JSON.parse(Buffer.from(result).toString());
    },
    10_000,
    `getRecordHistory(${recordId})`,
    () => [],
  );
}