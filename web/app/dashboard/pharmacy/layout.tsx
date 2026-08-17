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
