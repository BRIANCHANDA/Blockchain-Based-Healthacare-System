/**
 * Doctor dashboard layout.
 *
 * Defines the navigation for this role and hands it to DashboardShell, which
 * renders the sidebar, header and content frame shared by every dashboard. Each
 * role differs only in this NAV array — the shell itself is identical, so a
 * change to the chrome applies everywhere at once.
 *
 * Scope of this dashboard: consultations, diagnoses, orders and prescriptions.
 *
 * NAV IS PRESENTATION, NOT SECURITY. Hiding a link does not protect the page
 * behind it: authorisation is enforced by the backend on every request, and by
 * the consent check on anything that reads a patient's records. Adding an entry
 * here exposes no data that the API would not already return to this role.
 */

"use client";

import {
  LayoutDashboard,
  QrCode,
  ClipboardList,
  BedDouble,
  ArrowLeftRight,
  Search,
  FileText,
} from "lucide-react";
import {
  DashboardShell,
  type NavGroup,
} from "@/components/dashboard/DashboardShell";

const NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { label: "Overview", href: "/dashboard/doctor", icon: LayoutDashboard },
    ],
  },
  {
    label: "Clinical",
    items: [
      {
        label: "Today's Queue",
        href: "/dashboard/doctor/queue",
        icon: ClipboardList,
      },
      {
        label: "Admitted Patients",
        href: "/dashboard/doctor/admitted",
        icon: BedDouble,
      },
      { label: "Patients", href: "/dashboard/doctor/patients", icon: Search },
      { label: "Scan Patient", href: "/dashboard/doctor/scan", icon: QrCode },
    ],
  },
  {
    label: "Coordination",
    items: [
      {
        label: "Referrals",
        href: "/dashboard/doctor/referrals",
        icon: ArrowLeftRight,
      },
      {
        label: "Hospital Referrals",
        href: "/dashboard/doctor/referrals/incoming",
        icon: ArrowLeftRight,
      },
    ],
  },
  {
    label: "Reports",
    items: [
      { label: "My Report", href: "/dashboard/doctor/report", icon: FileText },
    ],
  },
];

export default function DoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardShell
      portalLabel="Doctor Portal"
      basePath="/dashboard/doctor"
      navGroups={NAV}
      roleLabel="Doctor"
    >
      {children}
    </DashboardShell>
  );
}
