"use client";

import {
  LayoutDashboard,
  Users,
  Building2,
  ShieldCheck,
  ClipboardList,
  UserCog,
  Settings,
  Activity,
  FileText,
  Link2,
  BedDouble,
  Layers,
  ShieldAlert,
  ScrollText,
} from "lucide-react";
import { useAuthStore } from "@/lib/store";
import {
  DashboardShell,
  type NavGroup,
} from "@/components/dashboard/DashboardShell";

/* -------------------------------------------------------------------------- */
/* Navigation                                                                 */
/* -------------------------------------------------------------------------- */

function getNavGroups(isSuperAdmin: boolean): NavGroup[] {
  return [
    {
      label: "Overview",
      items: [
        { label: "Dashboard", href: "/dashboard/admin", icon: LayoutDashboard },
      ],
    },

    {
      label: "People",
      items: [
        { label: "Staff", href: "/dashboard/admin/staff", icon: UserCog },
        { label: "Patients", href: "/dashboard/admin/patients", icon: Users },
      ],
    },

    {
      label: "Operations",
      items: [
        ...(isSuperAdmin
          ? [
              {
                label: "Institutions",
                href: "/dashboard/admin/institutions",
                icon: Building2,
              },
            ]
          : [
              {
                label: "Visits",
                href: "/dashboard/admin/visits",
                icon: ClipboardList,
              },
              {
                label: "Wards",
                href: "/dashboard/admin/wards",
                icon: BedDouble,
              },
              {
                label: "Departments",
                href: "/dashboard/admin/departments",
                icon: Layers,
              },
            ]),

        {
          label: "Permissions",
          href: "/dashboard/admin/permissions",
          icon: ShieldCheck,
        },
        { label: "Reports", href: "/dashboard/admin/reports", icon: FileText },
        {
          label: "My Report",
          href: "/dashboard/admin/report",
          icon: ScrollText,
        },
      ],
    },

    {
      label: "System",
      items: [
        { label: "Audit Logs", href: "/dashboard/admin/audit", icon: Activity },

        ...(isSuperAdmin
          ? [
              {
                label: "Security",
                href: "/dashboard/admin/security",
                icon: ShieldAlert,
              },
              {
                label: "Blockchain",
                href: "/dashboard/admin/blockchain",
                icon: Link2,
              },
            ]
          : []),

        {
          label: "Settings",
          href: "/dashboard/admin/settings",
          icon: Settings,
        },
      ],
    },
  ];
}

/* -------------------------------------------------------------------------- */
/* Layout                                                                      */
/* -------------------------------------------------------------------------- */

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuthStore();

  /* No institutionId = super admin; institutionId = hospital admin. */
  const isSuperAdmin = !(user as any)?.institutionId;
  const institutionName = (user as any)?.institutionName ?? null;

  const roleLabel = isSuperAdmin
    ? "System Administrator"
    : "Hospital Administrator";

  /* Scope indicator — unique to this portal, so it is passed in rather than
     baked into the shared shell. */
  const contextCard = (
    <div
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border ${
        isSuperAdmin
          ? "bg-emerald-50 border-emerald-100"
          : "bg-blue-50 border-blue-100"
      }`}
    >
      <div
        className={`w-7 h-7 rounded-lg flex items-center justify-center ${
          isSuperAdmin
            ? "bg-emerald-100 text-emerald-700"
            : "bg-blue-100 text-blue-700"
        }`}
      >
        {isSuperAdmin ? (
          <ShieldCheck className="w-3.5 h-3.5" />
        ) : (
          <Building2 className="w-3.5 h-3.5" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p
          className={`text-[10.5px] font-bold uppercase tracking-wider ${
            isSuperAdmin ? "text-emerald-600" : "text-blue-600"
          }`}
        >
          {isSuperAdmin ? "Super Administrator" : "Hospital Administrator"}
        </p>

        {!isSuperAdmin && (
          <p className="text-[12.5px] font-semibold text-slate-700 truncate mt-0.5">
            {institutionName ?? "Unknown Institution"}
          </p>
        )}
      </div>
    </div>
  );

  const headerExtra =
    !isSuperAdmin && institutionName ? (
      <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-100 max-w-[220px]">
        <Building2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
        <span className="text-[12.5px] font-semibold text-emerald-800 truncate">
          {institutionName}
        </span>
      </div>
    ) : isSuperAdmin ? (
      <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        <span className="text-[12px] font-semibold text-slate-600">
          Super Admin
        </span>
      </div>
    ) : null;

  return (
    <DashboardShell
      portalLabel="Admin Portal"
      basePath="/dashboard/admin"
      navGroups={getNavGroups(isSuperAdmin)}
      roleLabel={roleLabel}
      contextCard={contextCard}
      headerExtra={headerExtra}
    >
      {children}
    </DashboardShell>
  );
}
