# MedLink Fabric Network — Blockchain Infrastructure

Hyperledger Fabric 2.5 permissioned blockchain network that provides tamper-proof audit logging and medical record integrity verification for the MedLink EMR system. Every clinical action in the system is anchored to the blockchain, making records independently verifiable and protecting against silent data tampering.

---

## Why Blockchain for Healthcare?

Traditional databases can be modified by a database administrator without leaving a trace. By writing a cryptographic hash of every clinical record and a log of every access action to Hyperledger Fabric, MedLink ensures:

- **Immutability** — records written to the ledger cannot be altered retroactively
- **Independent verification** — any record can be verified against its on-chain hash at any time
- **Non-repudiation** — all access and modification actions are permanently logged with user identity and timestamp
- **Consent tracking** — patient data-access grants and revocations are on-chain, providing a trustworthy consent audit trail

---

## Network Topology

```
fabric-network/
├── network/                       Docker Compose Fabric network
│   ├── docker-compose.yaml        Peers, orderer, CA, and cli services
│   ├── channel-artifacts/
│   │   └── healthcare-channel.block   Genesis block for the healthcare channel
│   ├── organizations/
│   │   ├── ordererOrganizations/
│   │   │   └── healthcare.com/            Orderer MSP — certs, TLS, admin keys
│   │   └── peerOrganizations/
│   │       ├── hospital.healthcare.com/       HospitalOrg MSP
│   │       ├── practitioner.healthcare.com/   PractitionerOrg MSP
│   │       └── patient.healthcare.com/        PatientOrg MSP (+ Fabric CA)
│   └── scripts/                   enroll-patient, upgrade-chaincode helpers
├── scripts/                       Day-to-day network operations
│   ├── peer-exec.sh               Run any peer command as a given org
│   ├── package-chaincode.sh       Compile + package the chaincode
│   ├── deploy-chaincode.sh        Approve for all 3 orgs, then commit
│   └── set-anchor-peers.sh        One-off: enable cross-org gossip
├── chaincode/                     TypeScript smart contracts
│   ├── src/
│   │   ├── index.ts               Exports all contract classes
│   │   ├── record.ts              RecordContract
│   │   ├── accessControl.ts       AccessControlContract
│   │   ├── audit.ts               AuditContract
│   │   └── txtime.ts              Deterministic transaction timestamps
│   ├── dist/                      Compiled JavaScript (deployed to peers)
│   ├── package.json
│   └── tsconfig.json
├── blockchain-explorer/           Hyperledger Explorer — block browser UI
│   ├── docker-compose.yaml        Explorer + its PostgreSQL backend
│   └── examples/net1/
│       ├── config.json            Registers the healthcare-network profile
│       └── connection-profile/
│           └── healthcare-network.json   Peer URL, TLS + admin identity paths
└── fabric-samples/                Upstream Hyperledger Fabric samples (reference only)
```

---

## Network Configuration

| Property | Value |
|---|---|
| Fabric version | 2.5 |
| Channel | `healthcare` |
| Chaincode label | `healthcare` |
| Organisations | 3 — `HospitalOrgMSP`, `PractitionerOrgMSP`, `PatientOrgMSP` |
| Peers | 3 — one per organisation |
| Orderer | 1 — `orderer.healthcare.com` (RAFT single-node) |
| State database | LevelDB (`goleveldb`, the peer default) |
| Endorsement policy | `OutOf(2, Hospital, Practitioner, Patient)` |
| TLS | Enabled |

### Peer endpoints

| Organisation | Peer | gRPC | Operations |
|---|---|---|---|
| HospitalOrg | `peer0.hospital.healthcare.com` | 7051 | 9444 |
| PractitionerOrg | `peer0.practitioner.healthcare.com` | 9051 | 9446 |
| PatientOrg | `peer0.patient.healthcare.com` | 11051 | 9448 |
| Orderer | `orderer.healthcare.com` | 7050 | 9443 |
| PatientOrg CA | `ca.patient.healthcare.com` | 7054 | 17054 |

The host's `/etc/hosts` maps each of these names to its container IP on the
`healthcare-network` bridge, so the backend can dial them by name from outside Docker.

> **Note on the state database.** These peers use LevelDB, not CouchDB, so there is
> no Fauxton UI. Use Blockchain Explorer (below) to inspect ledger contents. Switching
> to CouchDB is possible but requires recreating all three peers and rebuilding the
> world state from the blocks.

---

## Smart Contracts

All contracts are in `chaincode/src/` and written in TypeScript using the `fabric-contract-api` library. They are compiled to `chaincode/dist/` and installed on the peer.

### RecordContract (`record.ts`)

Manages cryptographic hashes of medical records. The backend hashes each clinical record (consultation, lab result, prescription, etc.) using SHA-256 before storing it in PostgreSQL, then writes the hash to the blockchain via this contract. Any subsequent tampering with the PostgreSQL record will cause the hash to no longer match.

| Function | Description |
|---|---|
| `storeRecordHash(recordId, patientId, sha256Hash, recordType)` | Store a record hash on-chain. Re-storing the same `recordId` creates a new version rather than failing, and writes an audit entry in the same transaction |
| `verifyRecordHash(recordId, sha256Hash)` | Verify a hash against the ledger. Returns `{ verified, notFound }` so a missing record is distinguishable from a tampered one |
| `getRecordHash(recordId)` | Retrieve the latest record proof by ID |
| `getRecordHistory(recordId)` | Every version of a record, from the ledger's key history |
| `getPatientRecords(patientId)` | All on-chain record references for a patient |

### AccessControlContract (`accessControl.ts`)

Manages patient data-access consent on-chain. When a patient grants an institution access to their records, a consent entry is written to the ledger. Revocations are also recorded, providing an immutable consent history.

| Function | Description |
|---|---|
| `grantPermission(patientId, practitionerId, durationHours)` | Write a consent grant to the ledger, expiring after `durationHours` |
| `revokePermission(patientId, practitionerId)` | Record a consent revocation |
| `checkPermission(patientId, practitionerId)` | Current access status as a boolean, accounting for expiry |
| `getPermission(patientId, practitionerId)` | The raw permission record, or the string `null` if none exists |
| `getPatientPermissions(patientId)` | Every permission currently held against a patient |
| `getPermissionHistory(patientId, practitionerId)` | Append-only grant/revoke event log, so a patient can prove exactly when they granted and revoked access |

Only `PatientOrgMSP` identities may grant or revoke. If the calling certificate
carries a `patientId` attribute (issued by `scripts/enroll-patient.sh`), it must
match the patient being acted on — one patient cannot alter another's consent.

### AuditContract (`audit.ts`)

Appends immutable audit entries for every clinical action: viewing a record, creating a prescription, ordering a lab test, etc. Because Fabric's ledger is append-only, these entries cannot be deleted or modified.

| Function | Description |
|---|---|
| `logAccess(patientId, recordId, action, success)` | Append an audit event, stamped with the caller's identity and MSP |
| `getPatientAuditLog(patientId)` | Full audit trail for a patient, newest first |
| `getAuditEntry(patientId, logId)` | A single audit entry by transaction ID |
| `getAuditLogByDateRange(patientId, startDate, endDate)` | Entries within an ISO date window |

Patients may only read their own audit log; other MSPs are rejected outright.

---

## Starting the Network

**If the network already exists** (the normal case — after a reboot or a Docker
restart), just start the containers. The ledger lives in Docker volumes and
survives:

```bash
cd network
docker compose up -d
docker ps                    # 3 peers + orderer + CA + cli, all Up
```

**To build the network from scratch** — this generates fresh crypto material and
a new genesis block, and **destroys any existing ledger**. Only for a clean rebuild:

```bash
cd network
./start-network.sh
```

Afterwards, set anchor peers and deploy the chaincode as described below.

### Running peer commands

Peer CLI commands need the right MSP, address, and TLS certificate for the
organisation you are acting as. `scripts/peer-exec.sh` sets all of that:

```bash
./scripts/peer-exec.sh <hospital|practitioner|patient> <peer command...>

# e.g.
./scripts/peer-exec.sh hospital peer channel getinfo -c healthcare
./scripts/peer-exec.sh patient  peer lifecycle chaincode queryinstalled
```

### Setting Anchor Peers

Run this once per channel. Without anchor peers, gossip membership never forms
*between* organisations: each peer only ever knows about itself, so the peer's
discovery service cannot assemble an endorsement plan spanning two orgs. Since
the chaincode's policy requires two, every submit fails with:

```
FailedPrecondition ... no combination of peers can be derived which satisfy the endorsement policy
```

```bash
./scripts/set-anchor-peers.sh     # idempotent; skips orgs already configured
```

Confirm it worked — each peer should report the other two:

```bash
docker logs peer0.hospital.healthcare.com 2>&1 | grep "Membership view has changed"
```

### Deploying the Chaincode

Two scripts cover the whole lifecycle. Bump the label/version each time you
change the contracts, and increment the sequence.

```bash
# 1. Compile, strip devDependencies, and package (writes network/<label>.tar.gz
#    and leaves a copy inside the cli container at /tmp/<label>.tar.gz)
./scripts/package-chaincode.sh healthcare_4.4

# 2. Install on all three peers. Each install builds the chaincode in a
#    throwaway container via `npm install`, which takes 5-10 minutes per peer.
for org in hospital practitioner patient; do
  ./scripts/peer-exec.sh $org peer lifecycle chaincode install /tmp/healthcare_4.4.tar.gz
done

# 3. Approve for all three orgs and commit the new sequence
./scripts/deploy-chaincode.sh healthcare_4.4 4.4 5
```

Verify every peer is actually running the chaincode:

```bash
docker ps --format '{{.Names}}' | grep dev-peer   # expect one per peer
```

**Endorsement policy.** `OutOf(2, 'HospitalOrgMSP.peer', 'PractitionerOrgMSP.peer',
'PatientOrgMSP.peer')` — two of the three organisations must endorse, so no single
organisation can forge a consent grant. `deploy-chaincode.sh` reapplies this on
every sequence; if you omit `--signature-policy` the channel default silently
replaces it.

**Determinism.** Because two peers execute every transaction independently,
chaincode must never write wall-clock time (`new Date()`) to the ledger — the
peers would produce different write sets and the transaction would be rejected
with `ENDORSEMENT_POLICY_FAILURE`. Use `txTimeISO()` / `txTimeMillis()` from
`src/txtime.ts`, which read the transaction timestamp from the proposal.

---

## Blockchain Explorer

Hyperledger Explorer gives a browser view of the ledger — blocks, transactions,
read-write sets, chaincode activity, and the org/peer topology. It is the
presentation-friendly way to show what the blockchain is actually doing.

Explorer reads from `peer0.hospital` over gRPC and indexes blocks into its own
PostgreSQL container. It **never writes to the ledger**, and starting or stopping
it does not touch the Fabric peers.

### Running it

The Fabric network must already be up (Explorer attaches to the same
`healthcare-network` Docker network).

```bash
cd blockchain-explorer
docker compose up -d
```

Give it about 30 seconds to sync, then open:

| | |
|---|---|
| **URL** | http://localhost:8080 |
| **Username** | `exploreradmin` |
| **Password** | `exploreradminpw` |
| **Network** | `healthcare-network` (dropdown on the login page) |

Credentials come from `client.adminCredential` in
`examples/net1/connection-profile/healthcare-network.json`.

Confirm it synced. Explorer polls continuously, so grep rather than reading the
tail — you want at least one `syncBlocks: Finish`:

```bash
docker logs explorer.mynetwork.com 2>&1 | grep -c "syncBlocks: Finish"
```

### What to show in a demo

- **Blocks** — each block with its hash, timestamp, and transaction count
- **Transactions** — drill into any transaction to see the read-write set: the
  actual keys the chaincode wrote, plus which organisations endorsed it
- **Chaincode** — invocation counts per contract and version
- **Network** — all three organisations and their peers

For a live demo, approve an access request in the app and refresh the Blocks
page: the new block appears within a few seconds. Rehearse this once, since the
sync is not instant.

### Troubleshooting

**`network <id> not found` on startup.** The Explorer containers were created
against a previous `healthcare-network`, whose ID changes whenever the Docker
daemon restarts. Recreate just the two Explorer containers — this keeps their
volumes, and never touches the Fabric network:

```bash
docker rm -f explorerdb.mynetwork.com explorer.mynetwork.com
docker compose up -d
```

**Explorer exits immediately.** It usually means `explorerdb` was not healthy
yet; its reconnect path crashes instead of retrying cleanly. The command above
fixes this too, because Compose waits for the database's health check.

**Login succeeds but everything reads zero.** Explorer indexes on startup. Check
the logs for `syncBlocks: Finish`, and confirm the channel name in
`healthcare-network.json` is `healthcare`.

---

## Backend Integration

The backend (`backend/src/services/fabric.ts`) connects to the Fabric network using `@hyperledger/fabric-gateway`:

```typescript
// Consent — signed by the patient identity, submitted via the hospital peer
await grantPermission(patientAddress, practitionerAddress, '24');
await revokePermission(patientAddress, practitionerAddress);
const allowed = await checkPermission(patientAddress, practitionerAddress);

// Record integrity and audit
await storeRecordHash(recordId, patientId, sha256Hash, recordType);
await logAccess(patientId, recordId, 'VIEW_RECORD', true);
```

Identity and peer are chosen separately. Consent writes must be signed by a
`PatientOrgMSP` identity — the chaincode enforces this — but they are submitted
through whichever peer is reachable, so a patient-org outage does not block
consent. Grants and revokes return the real Fabric transaction ID, which the
backend persists in `access_permissions.blockchain_transaction_id` so a consent
row can be traced back to its block.

Queries are wrapped in a timeout and fail soft: if the network is unreachable the
backend logs a warning and continues, so infrastructure problems never block
patient care. Writes propagate their error to the caller.

### Required Environment Variables (in `backend/.env`)

`FABRIC_NETWORK_PATH` points at the `network/` directory; all certificate and key
paths are derived from it per organisation, so individual cert paths are not configured.

```
FABRIC_CHANNEL=healthcare
FABRIC_CHAINCODE=healthcare
FABRIC_MSP_ID=HospitalOrgMSP
FABRIC_PEER_ENDPOINT=peer0.hospital.healthcare.com:7051
FABRIC_PEER_HOST_ALIAS=peer0.hospital.healthcare.com
FABRIC_NETWORK_PATH=/absolute/path/to/Final_year_project/fabric-network/network
```

---

## Verifying the Network

Two scripts in `backend/src/scripts/` check the stack end to end. Both are
re-runnable and clean up after themselves.

```bash
cd ../backend

# Consent lifecycle straight through the Fabric gateway. No database needed —
# useful for isolating whether a problem is blockchain-side or backend-side.
bun run src/scripts/verify-blockchain-consent.ts

# The full HTTP path: creates a pending request, approves it via the real
# endpoint, then asserts the database row, the transaction ID, and the ledger.
# Requires PostgreSQL and the API server to be running.
bun run src/scripts/verify-approve-request.ts
```

Quick health checks against the network itself:

```bash
cd ../fabric-network

# Block height — should be identical on all three peers
for org in hospital practitioner patient; do
  ./scripts/peer-exec.sh $org peer channel getinfo -c healthcare
done

# Committed chaincode definition and which orgs approved it
./scripts/peer-exec.sh hospital peer lifecycle chaincode \
  querycommitted -C healthcare -n healthcare --output json

# One chaincode container per peer means all three can endorse
docker ps --format '{{.Names}}' | grep dev-peer
```

---

## Restarting After a Reboot

Docker restarts leave the containers stopped but the volumes — and therefore the
ledger — intact. Bring them back with Compose. **Never** run `docker compose down -v`
or a network teardown script: those delete the volumes and the channel is gone.

```bash
cd network && docker compose up -d
```

The chaincode containers are relaunched automatically by the peers on the first
invocation, so the initial call after a restart may take a few seconds longer.

---

## Troubleshooting

**`no combination of peers can be derived which satisfy the endorsement policy`**
Fewer than two organisations can endorse. Either a peer is missing the chaincode
(`peer lifecycle chaincode queryinstalled` per org), an org never approved the
current sequence (`querycommitted --output json` shows the approvals), or anchor
peers were never set so the orgs cannot discover each other.

**`chaincode response 500, Invalid time value`**
Chaincode built a `Date` from a protobuf timestamp read as a plain property.
`ctx.stub.getTxTimestamp()` exposes `getSeconds()` / `getNanos()` *methods* under
fabric-shim 2.5, so `txTs.seconds` is `undefined` and the arithmetic yields `NaN`.
Always go through `txTimeISO()` / `txTimeMillis()` in `src/txtime.ts`.

**Transactions fail validation with `ENDORSEMENT_POLICY_FAILURE`**
Usually non-determinism: two endorsers produced different write sets. Look for
`new Date()`, `Math.random()`, or iteration over an unordered map in any code
path that writes to the ledger.

**Chaincode install hangs or fails with `ETIMEDOUT`**
Each install builds the chaincode in a throwaway container that runs `npm install`,
so the peer needs registry access and 5–10 minutes. Re-run the install for the
affected org; the other peers keep whatever they already had.
