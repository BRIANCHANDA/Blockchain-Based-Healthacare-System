/**
 * Administrator dashboard layout.
 *
 * Defines the navigation for this role and hands it to DashboardShell, which
 * renders the sidebar, header and content frame shared by every dashboard. Each
 * role differs only in this NAV array — the shell itself is identical, so a
 * change to the chrome applies everywhere at once.
 *
 * Scope of this dashboard: institutions, staff, reporting and the ledger view.
 *
 * NAV IS PRESENTATION, NOT SECURITY. Hiding a link does not protect the page
 * behind it: authorisation is enforced by the backend on every request, and by
 * the consent check on anything that reads a patient's records. Adding an entry
 * here exposes no data that the API would not already return to this role.
 */

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

  /*
   * A hospital admin already sees their institution in the sidebar card, so a
   * header chip would repeat it. A super admin has no institution card there,
   * so the system-wide scope is worth stating.
   */
  const headerExtra = isSuperAdmin ? (
    <div
      className="hidden md:flex items-center gap-2"
      style={{
        padding: "6px 12px",
        borderRadius: "var(--r-pill)",
        background: "var(--brand-tint)",
        border: "1px solid var(--green-100)",
      }}
    >
      <span
        className="rounded-full"
        style={{ width: 6, height: 6, background: "var(--brand)" }}
      />
      <span
        style={{
          font: "600 12px/1 var(--font-sans)",
          color: "var(--success-ink)",
        }}
      >
        All institutions
      </span>
    </div>
  ) : null;

  return (
    <DashboardShell
      portalLabel="Admin Portal"
      basePath="/dashboard/admin"
      navGroups={getNavGroups(isSuperAdmin)}
      roleLabel={roleLabel}
      headerExtra={headerExtra}
    >
      {children}
    </DashboardShell>
  );
}
