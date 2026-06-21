import { redirect } from "next/navigation";

export default function PharmacyPatientsPage() {
  redirect("/dashboard/pharmacy/queue");
}
