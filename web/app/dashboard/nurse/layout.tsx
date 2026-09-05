/**
 * Nurse dashboard layout.
 *
 * Defines the navigation for this role and hands it to DashboardShell, which
 * renders the sidebar, header and content frame shared by every dashboard. Each
 * role differs only in this NAV array — the shell itself is identical, so a
 * change to the chrome applies everywhere at once.
 *
 * Scope of this dashboard: ward rounds, vitals, and the patients currently under care.
 *
 * NAV IS PRESENTATION, NOT SECURITY. Hiding a link does not protect the page
 * behind it: authorisation is enforced by the backend on every request, and by
 * the consent check on anything that reads a patient's records. Adding an entry
 * here exposes no data that the API would not already return to this role.
 */

"use client";

import {
  LayoutDashboard,
  ClipboardList,
  Activity,
  Users,
  BedDouble,
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
      { label: "Overview", href: "/dashboard/nurse", icon: LayoutDashboard },
    ],
  },
  {
    label: "Care",
    items: [
      {
        label: "Today's Queue",
        href: "/dashboard/nurse/queue",
        icon: ClipboardList,
      },
      {
        label: "Triage Patient",
        href: "/dashboard/nurse/triage",
        icon: Activity,
      },
      { label: "My Patients", href: "/dashboard/nurse/patients", icon: Users },
      { label: "Ward View", href: "/dashboard/nurse/ward", icon: BedDouble },
    ],
  },
  {
    label: "Reports",
    items: [
      { label: "My Report", href: "/dashboard/nurse/report", icon: FileText },
    ],
  },
];

export default function NurseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardShell
      portalLabel="Nurse Portal"
      basePath="/dashboard/nurse"
      navGroups={NAV}
      roleLabel="Nurse"
    >
      {children}
    </DashboardShell>
  );
}
