"use client";
import { useRouter } from "next/navigation";
import PatientQRScanner from "@/components/PatientQRScanner";
import { Page, PageHeader, Card } from "@/components/dashboard/ui";

/**
 * Doctor scans the patient's QR and lands in the direct-admission form with
 * the patient pre-selected. NewVisitPage reads ?patientId from the URL, so
 * the id is all that needs handing over.
 */
const DOCTOR_ADMIT_PATH = "/dashboard/doctor/visit/new";

export default function DoctorScanPage() {
  const router = useRouter();

  return (
    <Page maxWidth={560}>
      <PageHeader
        eyebrow="Clinical"
        title="Scan patient ID"
        subtitle="Scan the patient's QR to begin direct admission — ideal for emergencies"
      />

      <Card pad={20}>
        <PatientQRScanner
          onFound={(patient) =>
            router.push(`${DOCTOR_ADMIT_PATH}?patientId=${patient.id}`)
          }
          hint="After scanning you'll go straight to the direct-admission form with the patient pre-selected. Emergency and critical priority bypass nurse triage."
        />
      </Card>
    </Page>
  );
}
