import type { User } from "./store";
export const NOTIFICATION_EVENTS = [
  "lab_result_ready", "imaging_result_ready", "patient_admitted",
  "internal_referral_received", "external_referral_received", "patient_assigned",
] as const;
export const notificationTitles: Record<string, string> = {
  lab_result_ready: "Lab result ready",
  imaging_result_ready: "Imaging report ready",
  patient_admitted: "Patient admitted — needs a bed",
  internal_referral_received: "New internal referral",
  external_referral_received: "New hospital referral",
  patient_assigned: "Patient assigned to you",
};
export function notificationRoute(event: string, data: Record<string, unknown>, role?: User["type"]): string | undefined {
  const visitId = typeof data.visitId === "string" ? encodeURIComponent(data.visitId) : "";
  if (event === "external_referral_received") {
    const portal = role === "receptionist" ? "receptionist" : role === "admin" ? "admin" : "doctor";
    return `/dashboard/${portal}/referrals/incoming`;
  }
  if (event === "internal_referral_received") return "/dashboard/doctor/referrals";
  if (event === "patient_admitted") return "/dashboard/nurse/ward";
  if (event === "patient_assigned" && data.assignedRole === "nurse")
    return visitId ? `/dashboard/nurse/triage/${visitId}` : "/dashboard/nurse/queue";
  if (visitId) return `/dashboard/doctor/visit/${visitId}`;
}
