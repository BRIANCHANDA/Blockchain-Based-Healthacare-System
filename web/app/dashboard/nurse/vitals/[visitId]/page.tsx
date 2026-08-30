"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Vitals are recorded during triage — redirect there
export default function NurseVitalsRedirectPage({
  params,
}: {
  params: { visitId: string };
}) {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/dashboard/nurse/triage/${params.visitId}`);
  }, [params.visitId]);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "50vh",
        color: "var(--text-muted)",
        fontSize: 14,
      }}
    >
      Redirecting…
    </div>
  );
}
