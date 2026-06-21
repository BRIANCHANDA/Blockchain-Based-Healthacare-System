# MedLink Web Portal

Next.js 16 (App Router) staff-facing web portal for the MedLink EMR system. Serves eight hospital roles — Receptionist, Doctor, Nurse, Lab Technician, Radiologist, Pharmacist, and Administrator — each with a dedicated dashboard at `/dashboard/<role>/`.

---

## Tech Stack

| Technology | Purpose |
|---|---|
| **Next.js 16.1** (App Router) | React framework — SSR, routing, layouts |
| **React 19** | UI rendering with Suspense boundaries |
| **Tailwind CSS 4** | Utility-first styling |
| **Zustand** | Global auth state (`useAuthStore`) |
| **Axios** | HTTP client — pre-configured with base URL + auth header interceptor |
| **React Hook Form** + **Zod** | Form handling and validation |
| **Recharts** | Analytics and statistics charts |
| **date-fns** | Date formatting and difference calculations |
| **Lucide React** | Icon library |
| **EventSource (SSE)** | Real-time push notifications from the backend |

---

## Project Structure

```
web/
├── app/
│   ├── layout.tsx                   Root layout (fonts, global styles)
│   ├── page.tsx                     Redirects to /login
│   ├── login/                       Login page
│   ├── change-password/             Forced password change (first login)
│   └── dashboard/
│       ├── admin/
│       │   ├── layout.tsx           Admin sidebar navigation
│       │   ├── page.tsx             Admin overview / stats
│       │   ├── departments/         Department CRUD (list, create, edit, deactivate)
│       │   ├── wards/               Ward creation with auto-bed generation
│       │   └── staff/               Practitioner management
│       ├── doctor/
│       │   ├── layout.tsx           Doctor sidebar + NotificationBell
│       │   ├── page.tsx             Doctor overview
│       │   ├── queue/               Today's patient queue
│       │   ├── visit/[id]/          Full visit workspace (10 tabs)
│       │   ├── admitted/            Admitted inpatients with length-of-stay
│       │   └── referrals/           Outgoing and incoming referrals
│       ├── nurse/
│       │   ├── layout.tsx           Nurse sidebar + NotificationBell
│       │   ├── page.tsx             Nurse overview
│       │   ├── triage/              Vital signs entry
│       │   ├── queue/               Current visit queue
│       │   ├── ward/                Bed grid, assignment panel, pick-bed modal
│       │   ├── patients/            Patient list
│       │   └── report/              Personal shift report
│       ├── laboratory/
│       │   ├── layout.tsx
│       │   ├── page.tsx             Lab overview + pending orders
│       │   └── orders/              Lab order processing and result entry
│       ├── radiology/
│       │   ├── layout.tsx
│       │   └── page.tsx             Imaging orders and report submission
│       ├── pharmacy/
│       │   ├── layout.tsx
│       │   ├── page.tsx             Prescription queue
│       │   └── stock/               Medication stock management
│       └── receptionist/
│           ├── layout.tsx
│           ├── page.tsx             Receptionist dashboard
│           ├── patients/            Patient registration and search
│           └── appointments/        Appointment management
├── components/
│   ├── doctor/
│   │   ├── tabs/                    Visit tab components
│   │   │   ├── OverviewTab.tsx      Patient overview — demographics, vitals, allergies
│   │   │   ├── PatientHistoryTab.tsx  Past visit history
│   │   │   ├── MedicalProfileTab.tsx  Allergies · Conditions · Family · Sensitive records
│   │   │   ├── ConsultationTab.tsx  SOAP notes — HPI, exam, plan
│   │   │   ├── DiagnosisTab.tsx     ICD diagnosis entry
│   │   │   ├── LabOrdersTab.tsx     Lab test ordering and results view
│   │   │   ├── ImagingTab.tsx       Imaging orders and reports
│   │   │   ├── PrescriptionsTab.tsx Drug prescribing
│   │   │   ├── ReferralTab.tsx      Create and manage referrals
│   │   │   ├── DischargeTab.tsx     Discharge summary and instructions
│   │   │   └── PermissionGate.tsx   Blockchain-backed permission check wrapper
│   │   └── shared/
│   │       └── Toast.tsx            In-page toast notification
│   ├── NotificationBell.tsx         Bell icon + dropdown panel for SSE events
│   ├── NotificationListener.tsx     Inline toast listener (doctor layout)
│   ├── ProfileDrawer.tsx            Slide-out profile/settings panel
│   ├── Logo.tsx                     MedLink logo component
│   └── ui/                          Generic UI primitives (buttons, modals, etc.)
├── hooks/
│   └── useNotification.ts           Opens SSE EventSource, stores events in state
├── lib/
│   ├── api.ts                       Axios instance + domain API helper objects
│   └── store.ts                     Zustand auth store (user, token, institutionId)
└── public/                          Static assets
```

---

## Dashboard Roles

### Doctor

The most feature-rich dashboard. Workflow:

1. **Queue** — see today's assigned patients
2. **Visit workspace** — 10-tab interface per patient:
   - **Overview** — demographics, vital signs summary, known allergies
   - **Patient History** — previous visits timeline
   - **Medical Profile** — allergies, chronic conditions, family history, sensitive records (HIV, mental health, etc.) — private to doctors
   - **Consultation** — SOAP notes (HPI, physical exam, assessment, plan)
   - **Diagnosis** — ICD-coded diagnoses (provisional/confirmed/differential)
   - **Lab Orders** — order tests, view results when ready
   - **Imaging** — order X-ray/CT/MRI, view radiologist reports
   - **Prescriptions** — prescribe medications
   - **Referrals** — refer to another institution or department
   - **Discharge** — discharge summary + instructions + follow-up date
3. **Admit to Ward** — changes visit type to `inpatient`; all nurses receive a live SSE notification
4. **Admitted Patients** — table of all current inpatients with ward/bed info and length-of-stay badges (turns red after 72 h)

### Nurse

- **Triage** — record vital signs (temperature, BP, pulse, SpO2, weight, height, pain score)
- **Ward View** — interactive bed grid; colour-coded by status (available/occupied/maintenance)
- **Awaiting Bed Assignment** — amber alert panel listing admitted patients who don't have a bed yet; click any patient → `PickBedModal` shows available beds across all wards → select and assign in one step
- **Notification Bell** — receives `patient_admitted` events from doctors in real time

### Admin

- Create and manage **departments** (soft-delete / reactivate)
- Create **wards** — entering a bed count auto-creates all individual `ward_bed` records immediately
- Manage staff accounts and institution settings

### Receptionist

- Register new patients with PII (encrypted at rest by the backend)
- Open visits (walk-in or scheduled)
- Manage appointments

### Lab / Radiology / Pharmacy

Dedicated order queues, result/report entry forms, and stock dashboards for each clinical support role.

---

## Notification System

```
Backend                                  Frontend
  │                                         │
  │  doctor admits patient                  │
  │  → notifyUser(nurseId, 'patient_admitted', {...})
  │                                         │
  │  SSE stream ──────────────────────────►│ useNotifications() hook
  │  event: patient_admitted               │ pushes to Zustand state
  │  data: { patientName, diagnosis, ... } │
  │                                         │
  │                                         │ NotificationBell shows badge
  │                                         │ click → /dashboard/nurse/ward
```

Supported SSE events:

| Event | Recipient | Description |
|---|---|---|
| `patient_admitted` | Nurses | Doctor admitted a patient — bed assignment needed |
| `lab_result_ready` | Assigned doctor | Lab tech posted results |
| `imaging_result_ready` | Assigned doctor | Radiologist posted imaging report |

---

## Running Locally

```bash
npm install

# Create local env file
cp .env.local.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:3000

npm run dev
```

Portal runs at **http://localhost:3001** (or `:3000` if you change the port).

---

## Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API base URL (e.g. `http://localhost:3000`) |

---

## Key Patterns

**API calls** — all requests go through `lib/api.ts`:
```typescript
// Axios instance auto-attaches Authorization: Bearer <token>
const res = await api.get('/api/visits/inpatients');
const patients = res.data?.data?.patients;  // backend always wraps in { success, data }
```

**Auth state** — accessed via Zustand:
```typescript
const { user, token, institutionId, clearAuth } = useAuthStore();
```

**SSE hook**:
```typescript
const { notifications, unreadCount, markAllRead } = useNotifications();
// Automatically opens EventSource at /api/notifications/stream?token=<jwt>
```
