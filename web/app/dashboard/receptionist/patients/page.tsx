"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import PatientList from "@/components/receptionist/PatientList";
import PatientDetail from "@/components/receptionist/PatientDetail";

/**
 * Master/detail pair. Selecting a patient swaps the list out for the detail
 * view rather than navigating, so returning to the list is instant and keeps
 * the previously loaded page of results.
 */
export default function PatientsPage() {
  const router = useRouter();
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  return selectedPatientId ? (
    <PatientDetail
      patientId={selectedPatientId}
      onBack={() => setSelectedPatientId(null)}
    />
  ) : (
    <PatientList
      onSelectPatient={setSelectedPatientId}
      onRegister={() => router.push("/dashboard/receptionist/register")}
    />
  );
}
