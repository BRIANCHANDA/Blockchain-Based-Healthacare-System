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
