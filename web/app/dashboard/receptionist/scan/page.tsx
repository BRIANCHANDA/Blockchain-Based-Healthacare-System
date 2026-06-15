

"use client";
import { useRouter } from "next/navigation";
import PatientQRScanner from "@/components/PatientQRScanner";

const NEW_VISIT_PATH = "/dashboard/receptionist/visits/new"; // ← adapt to your wizard route

export default function ReceptionistScanPage() {
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
          Scan the patient's QR code to start a new visit instantly
        </p>
      </div>

      <PatientQRScanner
        onFound={(patient) =>
          router.push(`${NEW_VISIT_PATH}?patientId=${patient.id}`)
        }
        hint="Patients find their QR under Records → My Hospital ID. After scanning you'll go straight to the New Visit wizard with the patient pre-selected — the active-visit check runs automatically."
      />
    </div>
  );
}
