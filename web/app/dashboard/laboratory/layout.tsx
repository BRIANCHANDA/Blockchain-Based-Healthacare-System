/**
 * Laboratory dashboard layout.
 *
 * Defines the navigation for this role and hands it to DashboardShell, which
 * renders the sidebar, header and content frame shared by every dashboard. Each
 * role differs only in this NAV array — the shell itself is identical, so a
 * change to the chrome applies everywhere at once.
 *
 * Scope of this dashboard: test orders and result entry.
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
  History,
  Users,
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
      {
        label: "Overview",
        href: "/dashboard/laboratory",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: "Laboratory",
    items: [
      {
        label: "Lab Queue",
        href: "/dashboard/laboratory/queue",
        icon: ClipboardList,
      },
      {
        label: "My Results",
        href: "/dashboard/laboratory/history",
        icon: History,
      },
      {
        label: "Patients",
        href: "/dashboard/laboratory/patients",
        icon: Users,
      },
    ],
  },
  {
    label: "Reports",
    items: [
      {
        label: "My Report",
        href: "/dashboard/laboratory/report",
        icon: FileText,
      },
    ],
  },
];

export default function LaboratoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardShell
      portalLabel="Laboratory Portal"
      basePath="/dashboard/laboratory"
      navGroups={NAV}
      roleLabel="Lab Technician"
    >
      {children}
    </DashboardShell>
  );
}
