// web/src/app/dashboard/doctor/scan/page.tsx
//
// Doctor scans the patient's QR → jumps straight into the direct-admission
// (doctor-admit) page with the patient pre-selected (your NewVisitPage already
// reads ?patientId from the URL).
//
// ADAPT: DOCTOR_ADMIT_PATH below if your doctor new-visit page lives at a
// different route.
//
// Nav: add to doctor layout navItems:
//   { label: "Scan Patient", href: "/dashboard/doctor/scan", icon: QrCode },

"use client";
import { useRouter } from "next/navigation";
import PatientQRScanner from "@/components/PatientQRScanner";

const DOCTOR_ADMIT_PATH = "/dashboard/doctor/visit/new"; // ← adapt to your doctor new-visit route

export default function DoctorScanPage() {
  const router = useRouter();

  return (
    <div
      className="max-w-lg mx-auto space-y-5"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <div>
        <h1
          className="text-2xl font-bold text-gray-900"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Scan Patient ID
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Scan the patient's QR to begin direct admission — ideal for
          emergencies
        </p>
      </div>

      <PatientQRScanner
        onFound={(patient) =>
          router.push(`${DOCTOR_ADMIT_PATH}?patientId=${patient.id}`)
        }
        hint="After scanning you'll go straight to the direct-admission form with the patient pre-selected. Emergency/critical priority bypasses nurse triage."
      />
    </div>
  );
}
