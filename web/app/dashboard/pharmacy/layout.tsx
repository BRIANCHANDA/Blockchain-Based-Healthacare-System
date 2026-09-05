/**
 * Pharmacy dashboard layout.
 *
 * Defines the navigation for this role and hands it to DashboardShell, which
 * renders the sidebar, header and content frame shared by every dashboard. Each
 * role differs only in this NAV array — the shell itself is identical, so a
 * change to the chrome applies everywhere at once.
 *
 * Scope of this dashboard: prescription dispensing and stock.
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
  Package,
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
      { label: "Overview", href: "/dashboard/pharmacy", icon: LayoutDashboard },
    ],
  },
  {
    label: "Dispensing",
    items: [
      {
        label: "Pending Rx",
        href: "/dashboard/pharmacy/queue",
        icon: ClipboardList,
      },
      {
        label: "Dispense History",
        href: "/dashboard/pharmacy/dispensed",
        icon: History,
      },
    ],
  },
  {
    label: "Stock",
    items: [
      {
        label: "Inventory",
        href: "/dashboard/pharmacy/inventory",
        icon: Package,
      },
    ],
  },
  {
    label: "Reports",
    items: [
      {
        label: "My Report",
        href: "/dashboard/pharmacy/report",
        icon: FileText,
      },
    ],
  },
];

export default function PharmacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardShell
      portalLabel="Pharmacy Portal"
      basePath="/dashboard/pharmacy"
      navGroups={NAV}
      roleLabel="Pharmacist"
    >
      {children}
    </DashboardShell>
  );
}
