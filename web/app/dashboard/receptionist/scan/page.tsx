"use client";
import { useRouter } from "next/navigation";
import PatientQRScanner from "@/components/PatientQRScanner";
import { Page, PageHeader, Card } from "@/components/dashboard/ui";

const NEW_VISIT_PATH = "/dashboard/receptionist/visits/new";

export default function ReceptionistScanPage() {
  const router = useRouter();

  return (
    <Page maxWidth={560}>
      <PageHeader
        eyebrow="Front desk"
        title="Scan patient ID"
        subtitle="Scan the patient's QR code to start a new visit instantly"
      />

      <Card pad={20}>
        <PatientQRScanner
          /* The wizard re-checks for an active visit on arrival, so passing
             the id through the URL is enough — no state handoff needed. */
          onFound={(patient) => router.push(`${NEW_VISIT_PATH}?patientId=${patient.id}`)}
          hint="Patients find their QR under Records → My Hospital ID. After scanning you'll go straight to the New Visit wizard with the patient pre-selected — the active-visit check runs automatically."
        />
      </Card>
    </Page>
  );
}
