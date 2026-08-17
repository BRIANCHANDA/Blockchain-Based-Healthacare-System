# MedLink Chaincode — Healthcare Smart Contracts

TypeScript Hyperledger Fabric chaincode implementing the three smart contracts that underpin MedLink's blockchain layer: medical record integrity, patient consent / access control, and the immutable audit log.

---

## Tech Stack

| Technology | Purpose |
|---|---|
| **fabric-contract-api 2.5** | Fabric chaincode base class and decorator framework |
| **fabric-shim 2.5** | Low-level Fabric shim (stub) — transaction context, state management |
| **TypeScript 4.9** | Language (compiled to JavaScript before deployment) |
| **Node.js** | Chaincode runtime on the Fabric peer |

---

## Project Structure

```
chaincode/
├── src/
│   ├── index.ts          Exports all contract classes — entry point for the peer
│   ├── record.ts         RecordContract — hash storage and tamper verification
│   ├── accessControl.ts  AccessControlContract — patient consent on-chain
│   └── audit.ts          AuditContract — immutable action audit log
├── dist/                 Compiled JavaScript output (git-tracked for deployment)
├── package.json
└── tsconfig.json
```

---

## Contracts

### RecordContract (`src/record.ts`)

Stores SHA-256 hashes of medical records so they can be independently verified. The backend hashes each record before writing it to PostgreSQL, then calls this contract to anchor the hash on the ledger. Any later modification to the database record would change its hash — which would no longer match what's on the blockchain, immediately signalling tampering.

**State key format:** `RECORD::{id}`

```typescript
// Store a record hash
createRecord(ctx, id, patientId, recordType, hash, metadataJSON)

// Read back a proof
getRecord(ctx, id)  // returns { id, patientId, recordType, hash, createdAt, txId }

// Tamper check — returns true if hash matches ledger entry, false otherwise
verifyRecord(ctx, id, hash)

// All record proofs for a patient (rich query via CouchDB)
getPatientRecords(ctx, patientId)
```

### AccessControlContract (`src/accessControl.ts`)

Records patient consent grants and revocations on the ledger. Because Fabric's ledger is append-only and cannot be silently modified, this provides a trustworthy history of when access was granted, to whom, and for what record types — satisfying healthcare data governance requirements.

**State key format:** `ACCESS::{patientId}::{granteeId}`

```typescript
// Write a consent grant
grantAccess(ctx, patientId, granteeId, recordTypesJSON, expiresAt)

// Record a revocation
revokeAccess(ctx, patientId, granteeId)

// Real-time access check (returns 'true'/'false' as string)
checkAccess(ctx, patientId, granteeId, recordType)

// Full consent history for a patient
getPatientAccessLog(ctx, patientId)
```

### AuditContract (`src/audit.ts`)

Appends a permanent, unmodifiable entry for every clinical action — viewing a record, ordering a test, prescribing medication, admitting a patient, etc. The combination of user identity, timestamp, patient ID, and action type creates a non-repudiation trail that satisfies healthcare audit requirements.

**State key format:** `AUDIT::{txId}`

```typescript
// Append an audit event
logAction(ctx, userId, userType, patientId, actionType, resourceType, resourceId, ip)

// Retrieve the complete audit trail for a patient
getPatientAuditLog(ctx, patientId)

// Retrieve all actions taken by a specific user
getUserAuditLog(ctx, userId)
```

---

## Data Structures

### RecordProof
```typescript
{
  id: string;
  patientId: string;
  recordType: string;       // 'consultation' | 'lab_result' | 'prescription' | 'imaging' | ...
  hash: string;             // SHA-256 hex digest
  metadata: Record<string, any>;
  createdAt: string;        // ISO timestamp
  txId: string;             // Fabric transaction ID
}
```

### AccessGrant
```typescript
{
  patientId: string;
  granteeId: string;        // practitioner or institution ID
  recordTypes: string[];    // e.g. ['lab_results', 'prescriptions']
  grantedAt: string;
  expiresAt: string;
  isRevoked: boolean;
  revokedAt?: string;
  txId: string;
}
```

### AuditEntry
```typescript
{
  userId: string;
  userType: string;         // 'practitioner' | 'admin' | 'patient' | ...
  patientId: string;
  actionType: string;       // 'view' | 'create' | 'update' | 'delete' | 'emergency_override'
  resourceType: string;     // 'consultation' | 'lab_result' | 'prescription' | ...
  resourceId: string;
  ipAddress: string;
  timestamp: string;
  txId: string;
}
```

---

## Building

```bash
npm install
npm run build   # compiles src/ → dist/ using tsc
```

The compiled `dist/` directory is what gets installed on the Fabric peer.

---

## Deploying to the Peer

From the `fabric-network/` directory (requires Fabric peer binaries and environment):

```bash
# 1. Package
peer lifecycle chaincode package healthcare.tar.gz \
  --path ./chaincode/dist \
  --lang node \
  --label healthcare_1.0

# 2. Install on peer
peer lifecycle chaincode install healthcare.tar.gz

# 3. Approve for Org1
peer lifecycle chaincode approveformyorg \
  --channelID healthcare-channel \
  --name healthcare \
  --version 1.0 \
  --sequence 1 \
  --waitForEvent

# 4. Commit to channel
peer lifecycle chaincode commit \
  --channelID healthcare-channel \
  --name healthcare \
  --version 1.0 \
  --sequence 1

# 5. Verify
peer lifecycle chaincode querycommitted --channelID healthcare-channel
```

---

## Testing a Function Directly

```bash
# Invoke createRecord
peer chaincode invoke \
  -C healthcare-channel \
  -n healthcare \
  -c '{"function":"RecordContract:createRecord","Args":["rec-001","pat-abc","consultation","abc123hash","{}"]}'

# Query getRecord
peer chaincode query \
  -C healthcare-channel \
  -n healthcare \
  -c '{"function":"RecordContract:getRecord","Args":["rec-001"]}'
```
