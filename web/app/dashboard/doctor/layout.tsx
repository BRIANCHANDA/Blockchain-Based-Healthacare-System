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
