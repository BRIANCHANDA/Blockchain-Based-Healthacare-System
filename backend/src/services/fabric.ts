// backend/src/services/fabric.ts
//
// THE ONLY PLACE THE APPLICATION TALKS TO THE BLOCKCHAIN.
//
// Neither the web portal nor the mobile app holds a Fabric identity, a
// certificate or a gRPC client. They call the REST API; this module is what
// turns those calls into signed ledger transactions. Everything the system
// claims about immutability ultimately passes through here.
//
// Three ideas explain the whole file:
//
//  1. IDENTITY AND PEER ARE SEPARATE CHOICES. Which organisation SIGNS a
//     transaction is independent of which peer it is SENT THROUGH. Consent is
//     signed by a PatientOrgMSP identity, because the chaincode requires it,
//     but submitted via the hospital peer, because that one is reliably up.
//
//  2. WRITES GO THROUGH CONSENSUS, READS DO NOT. submitTransaction() is
//     endorsed by multiple peers, ordered into a block and committed.
//     evaluateTransaction() runs on a single peer and returns — cheap enough
//     to sit inside a request path.
//
//  3. FAILURE IS ASYMMETRIC ON PURPOSE. Queries and audit writes fail soft so
//     that infrastructure trouble never blocks clinical work; consent grants
//     fail hard so an authorisation is never silently lost.
//
// The channel's endorsement policy is OutOf(2, HospitalOrgMSP.peer,
// PractitionerOrgMSP.peer, PatientOrgMSP.peer). Endorsement plans are built by
// the peer's own discovery service, so no client-side discovery config is
// needed here — the peer we dial finds the second endorser via gossip.

import * as grpc from '@grpc/grpc-js';
import { connect, Contract, Gateway, Identity, Signer, signers, StatusCode } from '@hyperledger/fabric-gateway';
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
//
// Establishing a gateway means reading certificates from disk, building a TLS
// gRPC channel and completing a handshake — far too expensive to repeat per
// request. Connections are cached by (identity, peer) and reused.
//
// The TTL exists because a cached connection can go stale in ways the client
// does not notice, for example when the Docker network is recreated and the
// peer comes back on a new address. Expiring every few minutes bounds how long
// a broken connection can be reused; withTimeout() also clears the pool
// immediately on a connection-level gRPC error.
const POOL_TTL_MS = 5 * 60 * 1_000; // 5 minutes

type PoolEntry = { client: grpc.Client; gateway: Gateway; contract: Contract; createdAt: number };
const pool = new Map<string, PoolEntry>();

function getFirstFile(dirPath: string): string {
  const files = fs.readdirSync(dirPath);
  if (!files.length) throw new Error(`No files in ${dirPath}`);
  return path.join(dirPath, files[0]);
}

// ── getConnection: same identity and peer org ──────────────────────────────
//
// The common case: act as an organisation, through that organisation's own
// peer. Used for reads and for audit writes, where the hospital identity is
// the natural caller.
function getConnection(org: OrgKey): PoolEntry {
  const cacheKey = org;
  const cached = pool.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < POOL_TTL_MS) return cached;
  // Evict stale
  if (cached) {
    try { cached.gateway.close(); } catch { }
    try { cached.client.close(); } catch { }
    pool.delete(cacheKey);
  }

  const cfg = orgConfig(org);

  /*
   * HANDSHAKE 1 — TRANSPORT. Trust the peer's TLS CA and open an encrypted
   * gRPC channel. ssl_target_name_override is required because the peer's
   * certificate carries its DNS name (peer0.hospital.healthcare.com) in the
   * SAN: without it, dialling by container IP fails hostname verification.
   * This authenticates the PEER TO US. It says nothing about who we are.
   */
  const tlsCert = fs.readFileSync(cfg.tlsCertPath);
  const credentials = grpc.credentials.createSsl(tlsCert);
  const client = new grpc.Client(cfg.peerEndpoint, credentials, {
    'grpc.ssl_target_name_override': cfg.hostAlias,
    'grpc.keepalive_time_ms': 120_000,
    'grpc.keepalive_timeout_ms': 20_000,
    'grpc.keepalive_permit_without_calls': 0,
    'grpc.http2.max_pings_without_data': 0,
    'grpc.http2.min_time_between_pings_ms': 120_000,
  });

  /*
   * HANDSHAKE 2 — IDENTITY. The X.509 certificate and private key that sign
   * every proposal. Each peer validates this signature against the channel's
   * MSP before executing anything, and the chaincode sees it as
   * ctx.clientIdentity.getMSPID(). This is who we ARE.
   */
  const certPath = getFirstFile(path.join(cfg.adminMspPath, 'signcerts'));
  const keyPath = getFirstFile(path.join(cfg.adminMspPath, 'keystore'));
  const identity: Identity = { mspId: cfg.mspId, credentials: fs.readFileSync(certPath) };
  const signer: Signer = signers.newPrivateKeySigner(crypto.createPrivateKey(fs.readFileSync(keyPath)));

  /*
   * Deadlines are per phase because they measure different things: endorsing
   * runs the chaincode on several peers, whereas commitStatus waits for the
   * block to be ordered and validated and is therefore given the longest
   * allowance.
   */
  const gateway = connect({
    client, identity, signer,
    evaluateOptions: () => ({ deadline: Date.now() + 10_000 }),
    endorseOptions: () => ({ deadline: Date.now() + 15_000 }),
    submitOptions: () => ({ deadline: Date.now() + 15_000 }),
    commitStatusOptions: () => ({ deadline: Date.now() + 60_000 }),
  });

  const contract = gateway.getNetwork(CHANNEL).getContract(CHAINCODE);
  const entry: PoolEntry = { client, gateway, contract, createdAt: Date.now() };
  pool.set(cacheKey, entry);
  return entry;
}

// ── getConnectionForIdentity: separate identity and peer org ──────────────
//
// This split is what keeps consent patient-sovereign without making it depend
// on the patient organisation's own peer being online.
//
// The chaincode requires a PatientOrgMSP signature to grant or revoke consent,
// so the IDENTITY must be the patient org's. But the transaction can be
// submitted through ANY peer on the channel, so we dial the hospital peer,
// which is the one guaranteed to be running. The signature — not the route —
// is what the policy checks.
function getConnectionForIdentity(identityOrg: OrgKey, peerOrg: OrgKey): PoolEntry {
  const cacheKey = `${identityOrg}:${peerOrg}`;
  const cached = pool.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < POOL_TTL_MS) return cached;
  if (cached) {
    try { cached.gateway.close(); } catch { }
    try { cached.client.close(); } catch { }
    pool.delete(cacheKey);
  }

  const idCfg = orgConfig(identityOrg);
  const peerCfg = orgConfig(peerOrg);

  const tlsCert = fs.readFileSync(peerCfg.tlsCertPath);
  const credentials = grpc.credentials.createSsl(tlsCert);
  const client = new grpc.Client(peerCfg.peerEndpoint, credentials, {
    'grpc.ssl_target_name_override': peerCfg.hostAlias,
    'grpc.keepalive_time_ms': 120_000,
    'grpc.keepalive_timeout_ms': 20_000,
    'grpc.keepalive_permit_without_calls': 0,
    'grpc.http2.max_pings_without_data': 0,
    'grpc.http2.min_time_between_pings_ms': 120_000,
  });

  const certPath = getFirstFile(path.join(idCfg.adminMspPath, 'signcerts'));
  const keyPath = getFirstFile(path.join(idCfg.adminMspPath, 'keystore'));
  const identity: Identity = { mspId: idCfg.mspId, credentials: fs.readFileSync(certPath) };
  const signer: Signer = signers.newPrivateKeySigner(crypto.createPrivateKey(fs.readFileSync(keyPath)));

  const gateway = connect({
    client, identity, signer,
    evaluateOptions: () => ({ deadline: Date.now() + 10_000 }),
    endorseOptions: () => ({ deadline: Date.now() + 15_000 }),
    submitOptions: () => ({ deadline: Date.now() + 15_000 }),
    commitStatusOptions: () => ({ deadline: Date.now() + 60_000 }),
  });

  const contract = gateway.getNetwork(CHANNEL).getContract(CHAINCODE);
  const entry: PoolEntry = { client, gateway, contract, createdAt: Date.now() };
  pool.set(cacheKey, entry);
  return entry;
}

// ── Timeout helper ───────────────────────────────────────────────────────────
//
// Wraps a ledger call so a slow or dead peer degrades instead of hanging the
// HTTP request behind it. Promise.race means the caller waits at most
// timeoutMs, after which onTimeout() supplies a safe default.
//
// The default must FAIL CLOSED: checkPermission passes () => false, so a peer
// outage denies access rather than granting it.
//
// gRPC codes 4 (DEADLINE_EXCEEDED) and 14 (UNAVAILABLE) mean the connection
// itself is bad, not the request. The pooled gateway is then discarded so the
// next call redials rather than reusing a broken socket.
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
//
// Because most ledger calls fail soft, a failure would otherwise vanish into a
// log line. This in-memory ring buffer keeps the last MAX_FAILURE_LOG of them
// so the admin Blockchain page can show what did not reach the ledger and why.
//
// It is deliberately in-memory: it is an operational aid, not an audit trail
// (the audit trail is on-chain), and it resets when the process restarts.
// ══════════════════════════════════════════════════════════════════════════════

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

/*
 * Turn a raw error into a small, stable vocabulary so the admin view can group
 * failures. The distinction that matters most operationally:
 *   peer_unreachable / peer_timeout → infrastructure, retry later
 *   endorsement_failed              → policy or determinism, will not fix itself
 *   unauthorized                    → the signing identity lacked permission
 */
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

// StatusCode maps name -> numeric code; invert it so a commit failure reports
// e.g. "ENDORSEMENT_POLICY_FAILURE" instead of a bare 10.
const STATUS_NAME_BY_CODE: Record<number, string> = Object.fromEntries(
  Object.entries(StatusCode).map(([name, code]) => [code as number, name]),
);
function statusName(code: number): string {
  return STATUS_NAME_BY_CODE[code] ?? 'UNKNOWN';
}

// Submits a transaction and returns both the chaincode payload and the Fabric
// transaction ID. submitTransaction() alone discards the tx ID, which is what
// we need to persist in access_permissions.blockchain_transaction_id so a grant
// can be traced back to its block.
async function submitWithTxId(
  contract: Contract,
  transactionName: string,
  ...args: string[]
): Promise<{ payload: any; txId: string }> {
  const proposal = contract.newProposal(transactionName, { arguments: args });
  const transaction = await proposal.endorse();
  const commit = await transaction.submit();
  const status = await commit.getStatus();

  if (!status.successful) {
    throw new Error(
      `Transaction ${status.transactionId} failed to commit: ${statusName(status.code)} (code ${status.code})`,
    );
  }

  return {
    payload: JSON.parse(Buffer.from(transaction.getResult()).toString()),
    txId: status.transactionId,
  };
}

export async function grantPermission(patientId: string, practitionerId: string, durationHours: string): Promise<object> {
  // Use patient identity but connect to hospital peer (which is online)
  const { contract } = getConnectionForIdentity('patient', 'hospital');
  const { payload, txId } = await submitWithTxId(
    contract,
    'AccessControlContract:grantPermission',
    patientId, practitionerId, durationHours,
  );
  return { ...payload, txId };
}

export async function revokePermission(patientId: string, practitionerId: string): Promise<object> {
  const { contract } = getConnectionForIdentity('patient', 'hospital');
  const { payload, txId } = await submitWithTxId(
    contract,
    'AccessControlContract:revokePermission',
    patientId, practitionerId,
  );
  return { ...payload, txId };
}

/**
 * Does this practitioner currently hold patient consent?
 *
 * EVALUATE, not submit — a single peer answers from its world state, with no
 * ordering or commit, which is what makes it cheap enough to call inside a
 * request. It is the authoritative consent check: the answer comes from the
 * ledger, not from PostgreSQL.
 *
 * Fails CLOSED. If the peer is unreachable the fallback is false, so an outage
 * denies access rather than granting it.
 */
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
      // This is a query, we can use patient identity via patient peer (or hospital if offline)
      // For safety, use hospital peer with patient identity.
      const { contract } = getConnectionForIdentity('patient', 'hospital');
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
/**
 * Append an access event to the on-chain audit trail.
 *
 * A submit, so it goes through consensus, but wrapped in a fail-soft timeout:
 * a ledger outage must not stop a clinician reading a record. The honest
 * consequence is that READ auditing is best-effort.
 *
 * Write auditing is stronger: RecordContract.storeRecordHash writes the record
 * hash and its audit entry in the SAME chaincode transaction, so a record
 * cannot be committed without its audit row.
 */
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
/**
 * Anchor a SHA-256 fingerprint of an off-chain record on the ledger.
 *
 * This is the tier-2 mechanism: the record itself stays in PostgreSQL, and only
 * its hash is committed. That makes later tampering with the row DETECTABLE
 * (verifyRecordHash recomputes and compares) without putting clinical data on
 * a replicated ledger.
 *
 * Used for clinical records, emergency overrides and cross-institution grants.
 *
 * Fails soft and records the reason in the failure log, so a clinical action
 * still completes if the network is down — at the cost of that particular
 * anchor being missing. Anchoring is best-effort; consent grants are not.
 */
export async function storeRecordHash(
  recordId: string,
  patientId: string,
  sha256Hash: string,
  recordType: string,
): Promise<{ success: boolean; category?: string; error?: string }> {
  try {
    const { contract } = getConnection('hospital');
    const TIMEOUT = 12_000;

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

/**
 * Tamper check: recompute a record's hash and compare with the ledger.
 *
 * Returns a three-state result rather than a boolean, because "no anchor
 * found" and "anchor found but does not match" mean very different things —
 * the first is a gap in coverage, the second is evidence of alteration. A
 * network timeout must not be reported as tampering.
 */
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

// ── ADDITIONAL: getRecordHistory ────────────────────────────────────────────
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

/**
 * Ledger height and current block hash, read through Fabric's own system
 * chaincode (qscc) rather than our application chaincode. Powers the admin
 * Blockchain page and is the quickest way to confirm peers agree on the chain.
 */
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