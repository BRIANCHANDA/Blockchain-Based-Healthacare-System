# HealthChain — Patient App UI kit

Interactive recreation of all eight patient-app screens, composed from the design-system primitives. Open `index.html`.

## What's here
- `index.html` — entry point. Loads React + the compiled `_ds_bundle.js`, wraps the app in an Android device frame, and mounts it.
- `app.jsx` — app shell: navigation, bottom tab bar, and modals (change password, sign out, book appointment).
- `data.js` — fictional sample patient (Mwila Banda) with the exact data fields from the brief.
- `android-frame.jsx` — Material-3 Android device bezel (starter component).
- `screens/`
  - `Login.jsx` — National ID + password; idle / loading / error.
  - `RecordsHome.jsx` — allergy/blood safety banner, quick actions, visit cards.
  - `VisitDetail.jsx` — collapsible clinical sections (vitals, consultation, diagnoses, prescriptions, labs, imaging, discharge); away-institution visits show the lock → request → pending flow.
  - `HospitalId.jsx` — secure digital ID card with a QR (illustrative matrix).
  - `AccessCenter.jsx` — **signature**: approve/deny requests, manage grants, emergency overrides.
  - `HealthTrends.jsx` — vitals line charts with metric toggle + readings list.
  - `Referrals.jsx` — referrals sorted active-first with a count badge.
  - `Profile.jsx` — demographics, account, support, sign out.

## Try the connected access flow
Sign in → **Access** tab → **Approve** a pending request → it moves to **Access (granted)** → **Revoke** it.
Open the **emergency** visit in Records → **Request access** → watch it go pending → granted.

## Notes
- The QR is a **stylized matrix** (correct finder patterns, deterministic modules) — it is not scannable. Production uses a real QR library encoding `{ t: "hc-patient", id: <patientId> }`.
- This is a visual + interaction recreation; data is fictional and flows are mocked.
