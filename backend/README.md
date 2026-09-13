# MedLink Backend API

REST + SSE API for the MedLink Blockchain-Secured EMR System.

---

## Overview

The MedLink backend is built with [Hono](https://hono.dev/) running on [Bun](https://bun.sh/). It exposes a comprehensive set of `/api/*` routes covering every clinical workflow in the system, from patient registration through to discharge and reporting. API documentation is auto-generated via OpenAPI and is available through the Scalar UI at `/reference`.

All personally identifiable information (PII) is encrypted with AES-256 before being written to the database. Every clinical action — record creation, record update, access, discharge — is logged to both PostgreSQL and Hyperledger Fabric. The Fabric log is immutable: once an event is written to the blockchain, it cannot be altered or deleted.

---

## Tech Stack

| Concern | Library / Tool |
|---|---|
| HTTP framework | [Hono](https://hono.dev/) + `@hono/zod-openapi` |
| Runtime | [Bun](https://bun.sh/) — fast cold-start, built-in TypeScript |
| ORM | [Drizzle ORM](https://orm.drizzle.team/) + `postgres` driver |
| Database | PostgreSQL 15 |
| Blockchain | `fabric-network` + `@hyperledger/fabric-gateway` |
| Auth | `jsonwebtoken` + `bcryptjs` |
| PII encryption | Custom AES-256 service (`src/services/crypto.ts`) |
| Email | [Resend](https://resend.com/) via `src/services/email.ts` |
| Validation | [Zod](https://zod.dev/) — all request/response schemas |

---

## Project Structure

```
backend/
├── src/
│   ├── index.ts              App entry point — registers all routes, starts server
│   ├── db/
│   │   ├── schema.ts         Drizzle ORM table definitions (single source of truth)
│   │   └── index.ts          Database connection pool
│   ├── routes/               One file per resource domain
│   │   ├── auth.ts             Login, logout, OTP, password reset, 2FA
│   │   ├── patients.ts         Patient CRUD, search, health summary
│   │   ├── practitioners.ts    Staff CRUD, verification, role management
│   │   ├── visits.ts           Visit lifecycle (create → admit → discharge), inpatients
│   │   ├── medical.ts          Allergies, conditions, family & sensitive records (doctor-only)
│   │   ├── wards.ts            Ward & bed management, bed assignment, queue
│   │   ├── lab.ts              Lab test orders and results
│   │   ├── referrals.ts        Inter-institution referrals
│   │   ├── institutions.ts     Institution & department CRUD
│   │   ├── notifications.ts    SSE event stream per authenticated user
│   │   ├── records.ts          Blockchain-anchored clinical records
│   │   ├── permissions.ts      Patient consent and access grant management
│   │   ├── audit.ts            Audit log queries (read-only)
│   │   ├── reports.ts          Clinical & statistical report generation
│   │   ├── pharmacy.ts         Prescriptions, dispensing workflow
│   │   ├── radiology.ts        Imaging orders, reports, image uploads
│   │   ├── stock.ts            Pharmacy medication stock management
│   │   ├── doctor-stats.ts     Doctor-specific dashboard statistics
│   │   ├── personal-report.ts  Per-practitioner performance reports
│   │   ├── appointments.ts     Appointment scheduling
│   │   ├── cross-institution.ts Cross-hospital access grants
│   │   ├── blockchain.ts       Admin blockchain utility endpoints
│   │   └── ai/                 AI clinical decision support assistant routes
│   ├── services/
│   │   ├── crypto.ts           AES-256 encrypt/decrypt helpers for PII fields
│   │   ├── fabric.ts           Hyperledger Fabric gateway wrapper (submit/evaluate)
│   │   ├── notifications.ts    SSE connection registry + notifyUser() broadcast
│   │   └── email.ts            Transactional email dispatch via Resend
│   ├── middleware/
│   │   └── auth.ts             JWT verification middleware — sets userId, userType,
│   │                           institutionId on Hono context for downstream handlers
│   ├── lib/
│   │   └── create-app.ts       Shared OpenAPI router factory
│   ├── constants/              Shared enum values and lookup tables
│   └── types/                  TypeScript type definitions
├── drizzle/                   Drizzle migration SQL files
│   └── meta/                  Migration metadata
├── scripts/                   Database seed and utility scripts
├── uploads/
│   └── radiology/             Uploaded imaging files (gitignored in production)
├── drizzle.config.ts          Drizzle Kit configuration
├── package.json
└── tsconfig.json
```

---

## API Route Groups

| Prefix | Description |
|---|---|
| `/api/auth` | Authentication — login, OTP verification, 2FA setup, password reset |
| `/api/patients` | Patient registration, search by NRC/name, health summary |
| `/api/practitioners` | Staff management — create, update, verify, assign roles |
| `/api/visits` | Visit workflow — create, triage, admit, discharge, inpatient list |
| `/api/medical` | Doctor-only medical profile — allergies, conditions, sensitive records |
| `/api/wards` | Ward & bed management, unassigned visit queue |
| `/api/lab` | Lab test orders, result entry, result retrieval |
| `/api/institutions` | Institution and department CRUD |
| `/api/referrals` | Cross-institution patient referrals |
| `/api/notifications` | SSE event stream — `GET /api/notifications/stream` |
| `/api/records` | Blockchain-hashed clinical records — create and verify |
| `/api/permissions` | Patient consent grants and access control |
| `/api/audit` | Immutable audit log — query by patient, user, or date range |
| `/api/reports` | Clinical and statistical report generation |
| `/api/stock` | Pharmacy medication inventory management |
| `/api/ai` | AI-powered clinical decision support assistant |

Full interactive documentation is available at `http://localhost:3000/reference` when the server is running.

---

## Authentication Flow

1. **Login** — `POST /api/auth/login` with `{ email, password }`. Returns a signed JWT. If the account has 2FA enabled, the response indicates that an OTP is required before the token is fully activated.
2. **OTP verification** — `POST /api/auth/verify-otp` with the code sent to the user's registered email or phone.
3. **Authenticated requests** — all protected routes require the header:
   ```
   Authorization: Bearer <token>
   ```
4. **Middleware** — `src/middleware/auth.ts` verifies the token signature and expiry, then sets `userId`, `userType`, and `institutionId` on the Hono request context. Downstream route handlers read these values to apply role-based access control.
5. **Role enforcement** — each route handler checks `context.get('userType')` and returns `403 Forbidden` if the caller's role is not permitted for that operation (e.g., only `doctor` may read sensitive records).

```
Client                        Backend
  │                              │
  │── POST /api/auth/login ────► │  Verify email + bcrypt password
  │◄── { token, user } ──────── │  Return JWT (24 h expiry)
  │                              │
  │  (if 2FA enabled)            │
  │── POST /api/auth/verify-otp ►│  Validate OTP code
  │◄── { token } ─────────────── │  Return full-access JWT
  │                              │
  │── GET /api/* ───────────────►│  Authorization: Bearer <token>
  │                              │  Middleware sets userId, userType, institutionId
```

---

## Real-Time Notifications (SSE)

The backend maintains an in-memory registry of SSE connections keyed by `userId`. When a clinical event occurs, the relevant users are notified without polling.

```typescript
// Notify a specific user of an event
notifyUser(userId, 'patient_admitted', {
  visitId, patientName, admittingDiagnosis, priority
});
```

Frontend clients connect via:
```
GET /api/notifications/stream?token=<jwt>
```

Key events pushed by the server:

| Event | Recipient | Trigger |
|---|---|---|
| `lab_result_ready` | Assigned doctor | Lab technician submits results |
| `imaging_result_ready` | Assigned doctor | Radiologist posts a report |
| `patient_admitted` | Active nurses at institution | Doctor admits a patient to a ward |

---

## Blockchain Integration

The `src/services/fabric.ts` service wraps the Hyperledger Fabric gateway. Three chaincode contracts are used:

- **`record`** — stores a SHA-256 hash of every clinical record. On retrieval, the backend re-hashes the database record and compares it against the on-chain hash to detect tampering.
- **`audit`** — receives an audit event object for every clinical action and appends it to the immutable ledger. The `GET /api/audit` routes query Fabric directly (not PostgreSQL) for the audit history of a patient or practitioner.
- **`accessControl`** — enforces on-chain consent: before a practitioner accesses a record, the chaincode verifies that a valid access grant exists for that patient–practitioner pair.

Fabric variables are optional at development time — if not set, blockchain operations log a warning and fall back gracefully without blocking the request.

---

## Database Schema Highlights

The Drizzle schema (`src/db/schema.ts`) is the single source of truth for the database structure. PII columns (names, NRC numbers, addresses, contact details) are stored as AES-256 ciphertext and decrypted in route handlers via `src/services/crypto.ts`.

| Table | Purpose |
|---|---|
| `Patients` | Core patient demographics (PII encrypted) |
| `Practitioners` | Hospital staff accounts and credentials |
| `Institutions` | Registered healthcare facilities |
| `Departments` | Departments within an institution |
| `Wards` | Hospital wards |
| `WardBeds` | Individual beds within a ward |
| `Visits` | Patient visit/encounter record |
| `VitalSigns` | Triage vitals attached to a visit |
| `Consultations` | Doctor consultation notes |
| `Diagnoses` | ICD-coded diagnoses per visit |
| `LabTestOrders` | Lab orders raised during a visit |
| `LabTestResults` | Results entered by lab technicians |
| `ImagingOrders` | Radiology orders |
| `ImagingReports` | Radiologist reports and image references |
| `Prescriptions` | Prescription headers per visit |
| `PrescriptionItems` | Individual medication lines per prescription |
| `Allergies` | Known patient allergies |
| `MedicalHistory` | Past medical conditions |
| `FamilyMedicalHistory` | Family history records |
| `PatientSensitiveRecords` | HIV status, mental health, substance use — doctor-only |
| `Referrals` | Cross-institution referral records |
| `AuditLogs` | Local PostgreSQL mirror of audit events (Fabric is authoritative) |
| `AccessPermissions` | Consent and access grants per patient–practitioner pair |
| `AuthSessions` | Active JWT sessions (for logout/revocation) |

Run `bun run db:studio` to open Drizzle Studio and browse the schema interactively.

---

## Running Locally

```bash
# Install dependencies
bun install

# Configure environment
cp .env.example .env
# Edit .env — minimum required:
#   DATABASE_URL=postgresql://user:pass@localhost:5432/healthcare_data
#   JWT_SECRET=your-long-random-secret
#   ENCRYPTION_KEY=32-byte-hex-key

# First-time setup of an EMPTY development database only.
# Older migrations omitted objects created via db:push, so bootstrap from schema.
bun run db:push
bun run db:baseline

# For an existing, baselined database, apply reviewed pending migrations instead:
bun run db:migrate

# Seed with sample data (optional)
bun run seed

# Start the development server (hot-reload)
bun run dev
```

Server starts at **http://localhost:3000**
Interactive API docs: **http://localhost:3000/reference**

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Long random string used to sign JWTs — keep secret |
| `ENCRYPTION_KEY` | Yes | 32-byte hex string for AES-256 PII encryption |
| `RESEND_API_KEY` | Yes | Resend API key for transactional email (OTP, password reset) |
| `FABRIC_CHANNEL` | No | Hyperledger Fabric channel name (default: `healthcare-channel`) |
| `FABRIC_CHAINCODE` | No | Deployed chaincode name (default: `healthcare`) |
| `FABRIC_MSP_ID` | No | MSP ID for the connecting organisation |
| `FABRIC_PEER_ENDPOINT` | No | Peer gRPC endpoint |
| `FABRIC_CERT_PATH` | No | Path to admin signing certificate |
| `FABRIC_KEY_PATH` | No | Path to admin private key |
| `FABRIC_TLS_CERT_PATH` | No | Path to peer TLS CA certificate |

---

## Key Design Decisions

**Hono over Express:** Hono provides first-class TypeScript support, a native OpenAPI integration via `@hono/zod-openapi`, and significantly faster request handling. It runs without modification on Bun's HTTP server.

**Bun as runtime:** Bun's built-in TypeScript execution removes the build step in development. Its faster I/O also benefits the many concurrent SSE connections the notification service maintains.

**Drizzle over Prisma:** Drizzle generates type-safe query builders that map directly to SQL, avoiding hidden N+1 queries. The schema file doubles as migration source, keeping the database and application models in sync.

**AES-256 at rest:** Patient names, NRC numbers, addresses, and contact details are encrypted before being written to PostgreSQL. The encryption key never leaves the backend process. Even with direct database access, patient PII is unreadable without the key.

**SSE over WebSockets:** Server-Sent Events are sufficient for the one-way push notifications MedLink requires (server to client). SSE works reliably through proxies and load balancers without the handshake complexity of WebSockets.

---

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start dev server with hot reload |
| `bun run start` | Start production server |
| `bun run db:generate` | Generate a Drizzle migration from schema changes |
| `bun run db:migrate` | Apply pending migrations to the database |
| `bun run db:status` | Read-only comparison of the configured database and application schema |
| `bun run db:baseline` | Record a verified checkpoint for an existing db:push-managed database with no migration history |
| `bun run db:studio` | Open Drizzle Studio (browser-based database browser) |
| `bun run seed` | Seed the database with sample institutions, staff, and patients |

Database maintenance commands require Node.js 20.12+ alongside Bun and load
`backend/.env` explicitly. If the shell and `.env` specify different database URLs,
they stop instead of choosing a target silently. They print only the host/database,
never the password, and do not fall back to a local database.

For Neon or another populated database, run `db:status` first. Review generated SQL
before `db:migrate`; do not use `db:push --force` or seed sample data into the online
database. Older databases created with `db:push` have no migration ledger:
reconcile only reviewed schema differences, then use `db:baseline`. Baseline is
refused if any schema drift remains. It records the existing verified schema, not
a claim that the historical SQL was replayed. Keep migration SQL unchanged after
it has been applied/baselined; `db:migrate` checks hashes before proceeding.
