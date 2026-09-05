/**
 * Radiology dashboard layout.
 *
 * Defines the navigation for this role and hands it to DashboardShell, which
 * renders the sidebar, header and content frame shared by every dashboard. Each
 * role differs only in this NAV array — the shell itself is identical, so a
 * change to the chrome applies everywhere at once.
 *
 * Scope of this dashboard: imaging orders and report entry.
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
        href: "/dashboard/radiology",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: "Imaging",
    items: [
      {
        label: "Worklist",
        href: "/dashboard/radiology/queue",
        icon: ClipboardList,
      },
      { label: "Patients", href: "/dashboard/radiology/patients", icon: Users },
    ],
  },
  {
    label: "Reports",
    items: [
      {
        label: "My Report",
        href: "/dashboard/radiology/report",
        icon: FileText,
      },
    ],
  },
];

export default function RadiologyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardShell
      portalLabel="Radiology Portal"
      basePath="/dashboard/radiology"
      navGroups={NAV}
      roleLabel="Radiologist"
    >
      {children}
    </DashboardShell>
  );
}
