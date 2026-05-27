"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import PatientList from "../../../../components/receptionist/PatientList";
import PatientDetail from "../../../../components/receptionist/PatientDetail";

export default function PatientsPage() {
  const router = useRouter();
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(
    null,
  );

  const handleSelectPatient = (patientId: string) => {
    setSelectedPatientId(patientId);
  };

  const handleBack = () => {
    setSelectedPatientId(null);
  };

  const handleRegister = () => {
    router.push("/dashboard/receptionist/register");
  };

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {selectedPatientId ? (
        <PatientDetail patientId={selectedPatientId} onBack={handleBack} />
      ) : (
        <PatientList
          onSelectPatient={handleSelectPatient}
          onRegister={handleRegister}
        />
      )}
    </div>
  );
}
