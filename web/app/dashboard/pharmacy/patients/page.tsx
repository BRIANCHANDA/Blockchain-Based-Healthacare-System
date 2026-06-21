"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PharmacyPatientsPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/dashboard/pharmacy/queue"); }, [router]);
  return null;
}
