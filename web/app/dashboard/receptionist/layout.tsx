"use client";

import {
  LayoutDashboard,
  UserPlus,
  QrCode,
  ClipboardList,
  Calendar,
  ArrowLeftRight,
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
        href: "/dashboard/receptionist",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: "Front Desk",
    items: [
      {
        label: "Register Patient",
        href: "/dashboard/receptionist/register",
        icon: UserPlus,
      },
      {
        label: "Scan Patient",
        href: "/dashboard/receptionist/scan",
        icon: QrCode,
      },
      {
        label: "Today's Queue",
        href: "/dashboard/receptionist/queue",
        icon: ClipboardList,
      },
      {
        label: "Appointments",
        href: "/dashboard/receptionist/appointments",
        icon: Calendar,
      },
    ],
  },
  {
    label: "Records",
    items: [
      {
        label: "All Patients",
        href: "/dashboard/receptionist/patients",
        icon: Users,
      },
      {
        label: "Referrals",
        href: "/dashboard/receptionist/referrals",
        icon: ArrowLeftRight,
      },
    ],
  },
  {
    label: "Reports",
    items: [
      {
        label: "My Report",
        href: "/dashboard/receptionist/report",
        icon: FileText,
      },
    ],
  },
];

export default function ReceptionistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardShell
      portalLabel="Reception Portal"
      basePath="/dashboard/receptionist"
      navGroups={NAV}
      roleLabel="Receptionist"
    >
      {children}
    </DashboardShell>
  );
}
