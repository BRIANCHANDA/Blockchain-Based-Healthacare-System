# MedLink — Blockchain-Secured Electronic Medical Records (EMR) System

**Final Year Project · University of Zambia / Copperbelt University**
**Author: Brian Chanda**

---

## Overview

MedLink is a full-stack healthcare information system designed for the Zambian healthcare context. It combines a traditional relational database (PostgreSQL) with a Hyperledger Fabric blockchain network to deliver tamper-proof audit trails and guaranteed medical record integrity.

The system serves multiple hospital roles — receptionist, doctor, nurse, lab technician, radiologist, pharmacist, and administrator — through a web portal, while patients interact with the system through a dedicated mobile application. Every clinical action is cryptographically anchored to the blockchain, ensuring that records cannot be silently altered or deleted.

---

## Monorepo Structure

```
/
├── backend/          Hono + Bun API server (TypeScript)
├── web/              Next.js 16 staff web portal (TypeScript + Tailwind)
├── mobile/           Expo React Native patient app (TypeScript)
├── fabric-network/   Hyperledger Fabric blockchain network + chaincode
└── designs/          Figma/design system hand-off assets
```

---

## Key Features

- **Role-based dashboards:** Receptionist · Doctor · Nurse · Lab · Radiology · Pharmacy · Admin
- **Patient registration** with encrypted PII (AES-256 encryption at rest)
- **Blockchain-anchored audit log** for every clinical action — immutable and verifiable
- **On-chain patient consent** — practitioners request access, the patient (or a guardian) approves, and the time-limited grant is written to the ledger with an auditable grant/revoke history
- **Real-time SSE notifications** between roles (e.g., doctor admits a patient → nurse is notified instantly)
- **Ward & bed management** with a full inpatient admission and discharge flow
- **Full clinical workflow:** triage → consultation → diagnosis → lab orders → imaging → prescriptions → discharge
- **Sensitive record gating:** HIV status, mental health notes, and other sensitive fields are accessible to doctors only
- **QR-code based patient identification** in the mobile app
- **Cross-institution referrals and patient transfers**
- **AI-assisted clinical decision support**

---

## Tech Stack

| Layer       | Technology                                       |
| ----------- | ------------------------------------------------ |
| Backend API | Hono · Bun · TypeScript · Drizzle ORM            |
| Web Portal  | Next.js 16 · React 19 · Tailwind CSS 4 · Zustand |
| Mobile App  | Expo 56 · React Native 0.85 · React Navigation   |
| Database    | PostgreSQL 15                                    |
| Blockchain  | Hyperledger Fabric 2.5 · TypeScript chaincode    |
| Auth        | JWT · bcrypt · OTP 2FA                           |

---

## Prerequisites

Before running any part of the system, ensure the following are installed:

- **Node.js** 20+
- **Bun** 1.x — [https://bun.sh](https://bun.sh)
- **Docker & Docker Compose** — for the Fabric network and auxiliary services
- **Hyperledger Fabric 2.5 binaries** — `peer`, `orderer`, `configtxgen`, etc.
- **PostgreSQL** 15+ — either local or containerised

---

## Quick Start

```bash
# 1. Clone the repository
git clone <repo-url>
cd Final_year_project

# 2. Generate the Fabric network's crypto material and start the network
#    Do this FIRST — the backend reads its blockchain identity from the files
#    this produces. They are deliberately not in version control: they include
#    private signing keys for every organisation.
cd fabric-network/network
./start-network.sh              # runs cryptogen, then brings up the peers

# 3. Start the backend API server
cd ../../backend
cp .env.example .env
#    Then set, at minimum:
#      DATABASE_URL         your PostgreSQL connection string
#      JWT_SECRET           openssl rand -base64 48
#      AES_SECRET_KEY       openssl rand -base64 48
#      FABRIC_NETWORK_PATH  absolute path to fabric-network/network/organizations
#    The server refuses to start in production if a secret is missing or weak.
bun install
bun run db:push                 # apply the schema
bun run dev                     # http://localhost:3000

# 4. Start the web staff portal
cd ../web
npm install
npm run dev                     # http://localhost:3001

# 5. Start the mobile patient app
cd ../mobile
cp .env.example .env            # set EXPO_PUBLIC_API_URL to your machine's LAN IP
npm install
npx expo start

# 6. (Optional) Blockchain Explorer, to view the ledger in a browser
cd ../fabric-network/blockchain-explorer
docker compose up -d            # http://localhost:8080
```

### Running the tests

No database, Fabric network or Docker required — the suites that need Postgres
skip themselves with an explanation when it is unreachable.

```bash
cd backend && bun test                      # 91 tests
cd fabric-network/chaincode && bun test     # 67 tests
```

> The Fabric ledger lives in Docker volumes and survives restarts. Use
> `docker compose up -d` to bring the network back after a reboot — never
> `docker compose down -v`, which deletes the volumes and the channel with them.

---

## Environment Variables

The backend requires a `.env` file (copy from `.env.example`). Key variables:

| Variable         | Purpose                                          |
| ---------------- | ------------------------------------------------ |
| `DATABASE_URL`   | PostgreSQL connection string                     |
| `JWT_SECRET`     | Secret used to sign and verify JSON Web Tokens   |
| `ENCRYPTION_KEY` | AES-256 key for encrypting PII fields at rest    |
| `FABRIC_*`       | Hyperledger Fabric gateway connection parameters |

Refer to `backend/.env.example` and `backend/README.md` for the full list.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                             │
│   Next.js Web Portal (staff)    Expo Mobile App (patients)      │
└───────────────────┬─────────────────────────┬───────────────────┘
                    │  REST + SSE              │  REST + SSE
                    ▼                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Backend API (Hono / Bun)                    │
│   Auth · Patients · Visits · Lab · Imaging · Pharmacy · AI      │
└──────────────┬────────────────────────────────┬────────────────-┘
               │  Drizzle ORM                   │  Fabric Gateway
               ▼                                ▼
┌──────────────────────────┐   ┌────────────────────────────────┐
│   PostgreSQL 15          │   │   Hyperledger Fabric 2.5       │
│   (relational data)      │   │   (immutable audit + records)  │
└──────────────────────────┘   └────────────────────────────────┘
```

The backend is the single source of truth for business logic. PostgreSQL stores all operational data. Hyperledger Fabric stores cryptographic hashes and audit events that allow any record in PostgreSQL to be independently verified.

---

## Fabric Network

The `fabric-network/` directory contains:

- **`network/`** — Docker Compose configuration for peers, orderer, and CA nodes
- **`scripts/`** — operational helpers: `peer-exec.sh`, `package-chaincode.sh`, `deploy-chaincode.sh`, `set-anchor-peers.sh`
- **`chaincode/`** — TypeScript chaincode implementing `record`, `audit`, and `accessControl` contracts
- **`blockchain-explorer/`** — Hyperledger Fabric Explorer for visualising blocks and transactions

The network runs **three organisations** — `HospitalOrgMSP`, `PractitionerOrgMSP`,
and `PatientOrgMSP` — one peer each, on the channel `healthcare`. The endorsement
policy is `OutOf(2, ...)`: two of the three organisations must endorse every
transaction, so no single organisation can forge a consent grant on its own.

To deploy the chaincode after the network is running, follow the instructions in `fabric-network/README.md`.

### Blockchain Explorer

Browse blocks, transactions, and read-write sets in the browser. Start the Fabric
network first, then:

```bash
cd fabric-network/blockchain-explorer
docker compose up -d          # allow ~30s to sync
```

Open **http://localhost:8080** and sign in with `exploreradmin` / `exploreradminpw`,
selecting the **healthcare-network** profile. Explorer only reads from the peers —
running it never modifies the ledger.

### Verifying the blockchain integration

```bash
cd backend
bun run src/scripts/verify-blockchain-consent.ts   # consent lifecycle, no DB needed
bun run src/scripts/verify-approve-request.ts      # full HTTP approval path
```

---

## Project Status

This is a final year academic project submitted in partial fulfilment of the requirements for a Bachelor of Science degree. The system is functional and demonstrates the integration of blockchain technology with a conventional healthcare information system in a Zambian context.

---

## Author

**Brian Chanda**
Copperbelt University
Email: chandabrian02@gmail.com
