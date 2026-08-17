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
