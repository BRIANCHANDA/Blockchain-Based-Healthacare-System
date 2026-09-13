# MedLink Mobile — Patient App

Expo (React Native) patient-facing application for the MedLink EMR system. Patients can view their medical records, track visits and appointments, manage data-access consent, and use a QR code for fast hospital check-in. Available on iOS and Android.

---

## Tech Stack

| Technology | Purpose |
|---|---|
| **Expo 56** SDK | Managed workflow, OTA updates |
| **React Native 0.85** | Cross-platform mobile framework |
| **React Navigation 6** | Native stack + bottom tab navigation |
| **Zustand** | Global auth state |
| **Axios** | HTTP client for backend API |
| **Expo Notifications** | Push notifications (lab results, appointment reminders) |
| **react-native-qrcode-svg** | QR code generation for patient identification |
| **React Hook Form** + **Zod** | Form handling and validation |
| **react-native-chart-kit** | Health data visualisation charts |
| **Expo Linear Gradient** | UI gradient accents |

---

## Project Structure

```
mobile/
├── src/
│   ├── api/
│   │   └── index.ts              Axios instance — base URL + JWT auth header
│   ├── components/
│   │   ├── common/               Reusable UI components (Button, Card, Input, Loader)
│   │   └── access/               Access permission request and display components
│   ├── hooks/
│   │   └── useAuth.ts            Auth state hook — login, logout, token refresh
│   ├── navigation/
│   │   ├── AppNavigator.tsx      Root navigator — auth stack vs. main tabs
│   │   ├── AuthStack.tsx         Login, OTP, change-password screens
│   │   └── MainTabs.tsx          Bottom tab bar for authenticated users
│   ├── screens/
│   │   ├── auth/
│   │   │   ├── LoginScreen.tsx        Email + password login
│   │   │   ├── OtpScreen.tsx          2FA OTP verification
│   │   │   └── ChangePasswordScreen.tsx  First-login forced password change
│   │   ├── health/
│   │   │   └── HealthSummaryScreen.tsx   Blood type, allergies, chronic conditions
│   │   ├── records/
│   │   │   ├── RecordsListScreen.tsx     Medical record list with blockchain badges
│   │   │   └── RecordDetailScreen.tsx    Full record with hash verification status
│   │   ├── visits/
│   │   │   ├── VisitHistoryScreen.tsx    Past and active visit timeline
│   │   │   └── VisitDetailScreen.tsx     Visit details (diagnosis, prescriptions, labs)
│   │   ├── appointments/
│   │   │   ├── AppointmentsScreen.tsx    Upcoming and past appointments
│   │   │   └── BookAppointmentScreen.tsx Book a new appointment
│   │   ├── referrals/
│   │   │   └── ReferralsScreen.tsx       Inter-hospital referral status tracking
│   │   ├── access/
│   │   │   ├── AccessListScreen.tsx      All institutions granted data access
│   │   │   └── AccessDetailScreen.tsx    Manage or revoke a specific grant
│   │   ├── qr/
│   │   │   └── QrCodeScreen.tsx          Patient QR code for reception check-in
│   │   └── profile/
│   │       └── ProfileScreen.tsx         Personal details, notification settings, logout
│   ├── store/
│   │   └── authStore.ts          Zustand store — user, token, institutionId
│   ├── types/
│   │   └── index.ts              TypeScript interfaces for API responses
│   └── utils/
│       ├── dateHelpers.ts        Date formatting and age calculation
│       └── formatters.ts         Phone number, name, blood type formatters
├── android/                      Android native project (Gradle)
├── ios/
│   ├── MedChain/                 iOS native project files
│   └── MedChain.xcodeproj/       Xcode project
├── app.json                      Expo configuration (app name, bundle ID, icons)
├── babel.config.js
└── package.json
```

---

## Screens Overview

### Authentication

| Screen | Description |
|---|---|
| **Login** | Email + password form with "Forgot password" link |
| **OTP Verification** | 6-digit code entry for two-factor authentication |
| **Change Password** | Shown on first login — sets a personal password |

### Main Tabs

| Tab | Screens | Description |
|---|---|---|
| **Health** | Health Summary | Blood type, allergies, active conditions |
| **Records** | Records List → Record Detail | Blockchain-verified medical records with hash badge |
| **Visits** | Visit History → Visit Detail | Full visit timeline including prescriptions and diagnoses |
| **Appointments** | Appointments → Book | Upcoming and past appointments; booking form |
| **Profile** | Profile | Personal info, notification preferences, access log, sign out |

### Additional Screens

| Screen | Description |
|---|---|
| **QR Code** | Displays the patient's unique QR for reception scan-based identification |
| **Referrals** | Tracks status of referrals to other hospitals (pending / accepted / completed) |
| **Access Management** | Lists all institutions with data access; patient can revoke any grant |

---

## Access & Consent Model

Patients control which institutions can view their medical records. The access management screens reflect the `access_permissions` table on the backend and the corresponding on-chain consent grants written by the `AccessControlContract` chaincode.

- **Grant access**: When a patient registers at a new institution, they can authorise access for a defined period
- **Revoke access**: Patient can revoke at any time from the Access Management screen
- Each grant shows the institution name, granted date, expiry, and record types covered

---

## QR Code Check-In

The QR Code screen generates a signed QR containing the patient's `patientId` and a short-lived token. Reception staff scan this with the web portal or a dedicated scanner to instantly pull up the patient's record without manual search.

---

## Push Notifications

The app registers with Expo's push notification service on first launch. Notifications are triggered by the backend for:
- Lab results ready
- Appointment reminders
- Referral status updates

The backend uses `expo-server-sdk` to send to registered device tokens.

---

## Running Locally

```bash
# Install dependencies
npm install

# Start Expo dev server
npx expo start

# Run on a device / simulator
npx expo run:android    # Android
npx expo run:ios        # iOS (macOS only, requires Xcode)

# Or use Expo Go on a physical device (limited native modules)
npx expo start --tunnel
```

### Backend URL

Edit `src/api/index.ts` and set `BASE_URL` to your backend address:
```typescript
const BASE_URL = 'http://192.168.x.x:3000';  // use your machine's LAN IP for physical device
```

---

## Build for Production

```bash
# EAS Build (recommended)
npm install -g eas-cli
eas login
eas build --platform android   # APK / AAB
eas build --platform ios       # IPA (requires Apple Developer account)
```
