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
