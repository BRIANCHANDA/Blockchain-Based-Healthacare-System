"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import {
  Users,
  Building2,
  ClipboardList,
  ShieldCheck,
  Activity,
  UserCog,
  ChevronRight,
  CheckCircle2,
  FlaskConical,
  Scan,
  ArrowUpRight,
  Clock3,
  ShieldAlert,
  UserCheck,
  FileText,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface AdminStats {
  adminLevel: "super" | "hospital";
  institutionName?: string;
  totalPatients: number;
  totalStaff: number;
  totalInstitutions: number;
  activeVisits: number;
  completedToday: number;
  pendingPermissions: number;
  pendingLabOrders: number;
  pendingImaging: number;
  unverifiedStaff: number;
  auditLogsToday: number;
}

interface Staff {
  id: string;
  firstName?: string;
  lastName?: string;
  licenseNumber?: string;
  role?: string;
  isVerified?: boolean;
}

interface Visit {
  id: string;
  visitNumber?: string;
  chiefComplaint?: string;
  priority?: string;
  admissionDate?: string;
}

interface AuditLog {
  id: string;
  actionType?: string;
  resourceType?: string;
  timestamp?: string;
  isEmergencyOverride?: boolean;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const ROLE_LABEL: Record<string, string> = {
  practitioner: "Doctor",
  nurse: "Nurse",
  lab_technician: "Lab Technician",
  radiologist: "Radiologist",
  pharmacist: "Pharmacist",
  admin: "Administrator",
  receptionist: "Receptionist",
};

const PRIORITY_CONFIG: Record<
  string,
  { color: string; bg: string; label: string }
> = {
  critical: {
    color: "#dc2626",
    bg: "#fef2f2",
    label: "Critical",
  },
  emergency: {
    color: "#ea580c",
    bg: "#fff7ed",
    label: "Emergency",
  },
  urgent: {
    color: "#d97706",
    bg: "#fffbeb",
    label: "Urgent",
  },
  routine: {
    color: "#16a34a",
    bg: "#f0fdf4",
    label: "Routine",
  },
};

const ACTION_CONFIG: Record<string, { color: string; bg: string }> = {
  view: {
    color: "#64748b",
    bg: "#f8fafc",
  },
  create: {
    color: "#16a34a",
    bg: "#f0fdf4",
  },
  update: {
    color: "#2563eb",
    bg: "#eff6ff",
  },
  delete: {
    color: "#dc2626",
    bg: "#fef2f2",
  },
  permission_grant: {
    color: "#d97706",
    bg: "#fffbeb",
  },
  permission_revoke: {
    color: "#7c3aed",
    bg: "#f5f3ff",
  },
  emergency_override: {
    color: "#dc2626",
    bg: "#fef2f2",
  },
};

/* -------------------------------------------------------------------------- */
/* Reusable components                                                        */
/* -------------------------------------------------------------------------- */

function KpiCard({
  label,
  value,
  description,
  icon: Icon,
  iconClass,
  href,
  trend,
}: {
  label: string;
  value: number | undefined;
  description: string;
  icon: React.ElementType;
  iconClass: string;
  href?: string;
  trend?: string;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={!href}
      onClick={() => href && router.push(href)}
      className={`
        group relative w-full text-left bg-white border border-slate-200
        rounded-2xl p-5 transition-all duration-200
        ${
          href
            ? "hover:border-emerald-200 hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
            : "cursor-default"
        }
      `}
    >
      <div className="flex items-start justify-between">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconClass}`}
        >
          <Icon className="w-[18px] h-[18px]" />
        </div>

        {href && (
          <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 transition-colors" />
        )}
      </div>

      <div className="mt-5">
        <p className="text-[13px] font-medium text-slate-500">{label}</p>

        <p className="mt-1 text-[28px] leading-none font-bold tracking-tight text-slate-900">
          {value === undefined ? (
            <span className="inline-block w-16 h-7 rounded-md bg-slate-100 animate-pulse" />
          ) : (
            value.toLocaleString()
          )}
        </p>

        <div className="flex items-center gap-2 mt-2">
          <p className="text-[12.5px] text-slate-400">{description}</p>

          {trend && (
            <>
              <span className="w-1 h-1 rounded-full bg-slate-300" />
              <span className="text-[12.5px] font-semibold text-emerald-600">
                {trend}
              </span>
            </>
          )}
        </div>
      </div>
    </button>
  );
}

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-white border border-slate-200 rounded-2xl overflow-hidden ${className}`}
    >
      {children}
    </div>
  );
}

function PanelHeader({
  title,
  icon: Icon,
  action,
  onAction,
}: {
  title: string;
  icon?: React.ElementType;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
      <div className="flex items-center gap-2.5">
        {Icon && (
          <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
            <Icon className="w-4 h-4 text-slate-500" />
          </div>
        )}

        <h3 className="text-[15px] font-bold text-slate-900">{title}</h3>
      </div>

      {action && onAction && (
        <button
          onClick={onAction}
          className="flex items-center gap-1 text-[13px] font-semibold text-emerald-700 hover:text-emerald-800"
        >
          {action}
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-50">
      <div className="w-9 h-9 rounded-xl bg-slate-100 animate-pulse" />

      <div className="flex-1">
        <div className="w-2/5 h-3 rounded bg-slate-100 animate-pulse mb-2" />
        <div className="w-3/5 h-2.5 rounded bg-slate-100 animate-pulse" />
      </div>

      <div className="w-14 h-5 rounded-full bg-slate-100 animate-pulse" />
    </div>
  );
}

function EmptyState({
  icon: Icon,
  message,
}: {
  icon: React.ElementType;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-5 text-center">
      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-slate-300" />
      </div>

      <p className="text-[13px] text-slate-400">{message}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Attention panel                                                            */
/* -------------------------------------------------------------------------- */

function AttentionPanel({
  stats,
  isSuperAdmin,
  router,
}: {
  stats: AdminStats | null;
  isSuperAdmin: boolean;
  router: ReturnType<typeof useRouter>;
}) {
  const items = [];

  // Shown to both roles. Hospital admins have a "Permissions" nav entry and
  // approve requests too, so gating this on super admin hid the count from the
  // people most likely to act on it.
  if ((stats?.pendingPermissions ?? 0) > 0) {
    items.push({
      icon: ShieldCheck,
      label: "Permission requests",
      description: "Awaiting approval",
      value: stats?.pendingPermissions ?? 0,
      color: "text-amber-600",
      bg: "bg-amber-50",
      href: "/dashboard/admin/permissions",
    });
  }

  if ((stats?.unverifiedStaff ?? 0) > 0) {
    items.push({
      icon: UserCheck,
      label: "Unverified staff",
      description: "Require verification",
      value: stats?.unverifiedStaff ?? 0,
      color: "text-red-600",
      bg: "bg-red-50",
      href: "/dashboard/admin/staff?filter=unverified",
    });
  }

  if ((stats?.pendingLabOrders ?? 0) > 0) {
    items.push({
      icon: FlaskConical,
      label: "Laboratory orders",
      description: "Pending processing",
      value: stats?.pendingLabOrders ?? 0,
      color: "text-amber-600",
      bg: "bg-amber-50",
    });
  }

  if ((stats?.pendingImaging ?? 0) > 0) {
    items.push({
      icon: Scan,
      label: "Imaging requests",
      description: "Pending processing",
      value: stats?.pendingImaging ?? 0,
      color: "text-blue-600",
      bg: "bg-blue-50",
    });
  }

  return (
    <Panel>
      <PanelHeader
        title="Attention required"
        icon={ShieldAlert}
        action="View all"
        onAction={() => router.push("/dashboard/admin/permissions")}
      />

      {items.length === 0 ? (
        <div className="px-5 py-8">
          <div className="flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>

            <div>
              <p className="text-[13px] font-semibold text-emerald-800">
                Everything looks good
              </p>
              <p className="text-[12.5px] text-emerald-600 mt-0.5">
                No outstanding administrative actions.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div>
          {items.map((item, index) => {
            const Icon = item.icon;

            return (
              <button
                key={item.label}
                onClick={() => item.href && router.push(item.href)}
                disabled={!item.href}
                className={`
                  w-full flex items-center gap-3 px-5 py-3.5 text-left
                  transition-colors
                  ${index < items.length - 1 ? "border-b border-slate-50" : ""}
                  ${item.href ? "hover:bg-slate-50 cursor-pointer" : ""}
                `}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${item.bg}`}
                >
                  <Icon className={`w-4 h-4 ${item.color}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-slate-800">
                    {item.label}
                  </p>

                  <p className="text-[12.5px] text-slate-400 mt-0.5">
                    {item.description}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-[15px] font-bold ${item.color}`}>
                    {item.value}
                  </span>

                  {item.href && (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */
/* Recent staff                                                               */
/* -------------------------------------------------------------------------- */

function RecentStaff({
  staff,
  loading,
  router,
}: {
  staff: Staff[];
  loading: boolean;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <Panel>
      <PanelHeader
        title="Recent staff"
        icon={UserCog}
        action="View all"
        onAction={() => router.push("/dashboard/admin/staff")}
      />

      {loading ? (
        [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
      ) : staff.length === 0 ? (
        <EmptyState icon={Users} message="No staff members found." />
      ) : (
        staff.map((person, index) => {
          const initials = `${person.firstName?.[0] ?? ""}${
            person.lastName?.[0] ?? ""
          }`;

          return (
            <button
              key={person.id}
              onClick={() => router.push(`/dashboard/admin/staff/${person.id}`)}
              className={`
                w-full flex items-center gap-3 px-5 py-3.5 text-left
                hover:bg-slate-50 transition-colors
                ${index < staff.length - 1 ? "border-b border-slate-50" : ""}
              `}
            >
              <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-[12.5px] font-bold text-slate-600 flex-shrink-0">
                {initials || "?"}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-slate-800 truncate">
                  {person.firstName} {person.lastName}
                </p>

                <p className="text-[12px] text-slate-400 truncate mt-0.5">
                  {ROLE_LABEL[person.role ?? ""] ?? person.role ?? "Staff"}
                  {person.licenseNumber ? ` · ${person.licenseNumber}` : ""}
                </p>
              </div>

              <div className="flex flex-col items-end gap-1.5">
                <span
                  className={`
                    px-2 py-0.5 rounded-full text-[11px] font-bold
                    ${
                      person.isVerified
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-red-50 text-red-600"
                    }
                  `}
                >
                  {person.isVerified ? "Verified" : "Pending"}
                </span>

                <ChevronRight className="w-3 h-3 text-slate-300" />
              </div>
            </button>
          );
        })
      )}
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */
/* Recent visits                                                              */
/* -------------------------------------------------------------------------- */

function RecentVisits({
  visits,
  loading,
  router,
}: {
  visits: Visit[];
  loading: boolean;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <Panel>
      <PanelHeader
        title="Active visits"
        icon={ClipboardList}
        action="View all"
        onAction={() => router.push("/dashboard/admin/visits")}
      />

      {loading ? (
        [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
      ) : visits.length === 0 ? (
        <EmptyState icon={ClipboardList} message="No active visits." />
      ) : (
        visits.map((visit, index) => {
          const priority =
            PRIORITY_CONFIG[visit.priority ?? "routine"] ??
            PRIORITY_CONFIG.routine;

          return (
            // Rendered as a plain row, not a button: there is no
            // admin/visits/[id] page, so making these clickable was a false
            // affordance that led to a 404. "View all" above goes to the list.
            <div
              key={visit.id}
              className={`
                w-full flex items-center gap-3 px-5 py-4 text-left
                ${index < visits.length - 1 ? "border-b border-slate-50" : ""}
              `}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: priority.bg,
                }}
              >
                <ClipboardList
                  className="w-4 h-4"
                  style={{ color: priority.color }}
                />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-slate-800 font-mono">
                  {visit.visitNumber ?? "—"}
                </p>

                <p className="text-[12px] text-slate-400 truncate mt-0.5">
                  {visit.chiefComplaint || "No complaint recorded"}
                </p>
              </div>

              <div className="flex flex-col items-end gap-1.5">
                <span
                  className="px-2 py-0.5 rounded-full text-[11px] font-bold"
                  style={{
                    background: priority.bg,
                    color: priority.color,
                  }}
                >
                  {priority.label}
                </span>

                <span className="flex items-center gap-1 text-[11.5px] text-slate-400">
                  <Clock3 className="w-3 h-3" />

                  {visit.admissionDate
                    ? format(new Date(visit.admissionDate), "HH:mm")
                    : "—"}
                </span>
              </div>
            </div>
          );
        })
      )}
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */
/* Audit activity                                                             */
/* -------------------------------------------------------------------------- */

function AuditActivity({
  logs,
  loading,
  router,
}: {
  logs: AuditLog[];
  loading: boolean;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <Panel>
      <PanelHeader
        title="Audit activity"
        icon={Activity}
        action="View all"
        onAction={() => router.push("/dashboard/admin/audit")}
      />

      {loading ? (
        [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
      ) : logs.length === 0 ? (
        <EmptyState icon={FileText} message="No audit events recorded." />
      ) : (
        logs.map((log, index) => {
          const action =
            ACTION_CONFIG[log.actionType ?? ""] ?? ACTION_CONFIG.view;

          return (
            <div
              key={log.id}
              className={`
                flex items-start gap-3 px-5 py-3.5
                ${index < logs.length - 1 ? "border-b border-slate-50" : ""}
              `}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  background: action.bg,
                }}
              >
                <Activity
                  className="w-3.5 h-3.5"
                  style={{ color: action.color }}
                />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-slate-700 leading-snug">
                  <span
                    className="font-semibold capitalize"
                    style={{ color: action.color }}
                  >
                    {log.actionType?.replace(/_/g, " ") ?? "Activity"}
                  </span>{" "}
                  <span className="text-slate-400">
                    {log.resourceType ?? "resource"}
                  </span>
                </p>

                <p className="text-[12px] text-slate-400 mt-1">
                  {log.timestamp
                    ? formatDistanceToNow(new Date(log.timestamp), {
                        addSuffix: true,
                      })
                    : "—"}
                </p>
              </div>

              {log.isEmergencyOverride && (
                <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-600 text-[10px] font-bold">
                  OVERRIDE
                </span>
              )}
            </div>
          );
        })
      )}
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */
/* Dashboard                                                                  */
/* -------------------------------------------------------------------------- */

export default function AdminDashboard() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentStaff, setRecentStaff] = useState<Staff[]>([]);
  const [recentVisits, setRecentVisits] = useState<Visit[]>([]);
  const [recentAudit, setRecentAudit] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);

    try {
      const [statsRes, staffRes, visitsRes, auditRes] =
        await Promise.allSettled([
          api.get("/api/dashboard/admin"),
          // The list endpoint has no sort parameters; it returns newest-first
          // and honours `limit`.
          api.get("/api/practitioners?limit=5"),
          // There is no `GET /api/visits` — the only bare-path route is the
          // create POST, so the previous call 404'd and this panel was
          // permanently empty. `/today` returns the in-progress visits for the
          // caller's institution (all institutions for a super admin).
          api.get("/api/visits/today"),
          api.get("/api/audit?limit=6"),
        ]);

      if (statsRes.status === "fulfilled") {
        setStats(statsRes.value.data.data);
      }

      if (staffRes.status === "fulfilled") {
        setRecentStaff(staffRes.value.data.data?.practitioners ?? []);
      }

      if (visitsRes.status === "fulfilled") {
        setRecentVisits((visitsRes.value.data.data?.visits ?? []).slice(0, 5));
      }

      if (auditRes.status === "fulfilled") {
        setRecentAudit(auditRes.value.data.data?.logs ?? []);
      }
    } catch (error) {
      console.error("Failed to load admin dashboard:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  /*
   * Keep the same role determination used by the original dashboard:
   * an administrator without an institution is a super administrator.
   *
   * During loading we use the authenticated user's institutionId when
   * available so the UI does not briefly show the wrong navigation/content.
   */
  const isSuperAdmin =
    stats?.adminLevel === "super" || (!stats && !(user as any)?.institutionId);

  const institutionName =
    stats?.institutionName ?? (user as any)?.institutionName ?? "";

  return (
    <div className="w-full max-w-[1280px] mx-auto pb-8">
      {/* ------------------------------------------------------------------ */}
      {/* Page heading                                                        */}
      {/* ------------------------------------------------------------------ */}

      <section className="mb-7">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />

              <p className="text-[12.5px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
                {isSuperAdmin
                  ? "System Administration"
                  : "Hospital Administration"}
              </p>
            </div>

            {/*
              Names the thing being administered rather than greeting the
              reader. The greeting and the "here's what's happening" line said
              nothing the numbers below don't, and the date is already shown
              twice in the layout header.
            */}
            <h1 className="text-[27px] sm:text-[30px] font-bold tracking-tight text-slate-900">
              {isSuperAdmin
                ? "All Institutions"
                : institutionName || "My Institution"}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/dashboard/admin/staff/new")}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-[13px] font-semibold shadow-sm transition-colors"
            >
              <UserCog className="w-3.5 h-3.5" />
              Add Staff
            </button>

            {isSuperAdmin && (
              <button
                onClick={() => router.push("/dashboard/admin/institutions")}
                className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-emerald-200 text-slate-700 text-[13px] font-semibold transition-colors"
              >
                <Building2 className="w-3.5 h-3.5" />
                Institutions
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Primary KPI cards                                                   */}
      {/* ------------------------------------------------------------------ */}

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Total Patients"
          value={stats?.totalPatients}
          description="Registered patients"
          icon={Users}
          iconClass="bg-blue-50 text-blue-600"
          href="/dashboard/admin/patients"
        />

        <KpiCard
          label="Staff Members"
          value={stats?.totalStaff}
          description="Across all roles"
          icon={UserCog}
          iconClass="bg-violet-50 text-violet-600"
          href="/dashboard/admin/staff"
        />

        <KpiCard
          label="Active Visits"
          value={stats?.activeVisits}
          description="Currently in progress"
          icon={ClipboardList}
          iconClass="bg-emerald-50 text-emerald-600"
          href="/dashboard/admin/visits"
        />

        <KpiCard
          label="Completed Today"
          value={stats?.completedToday}
          description="Visits completed today"
          icon={CheckCircle2}
          iconClass="bg-cyan-50 text-cyan-600"
        />
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Attention required                                                  */}
      {/* ------------------------------------------------------------------ */}
      {/*
        The former "Operational overview" panel sat here and repeated four
        figures already on the page: active visits and completed today from the
        KPI row above, and pending lab/imaging from the attention panel beside
        it. Attention now takes the full width, since it is the only part of
        this page that asks the administrator to do something.
      */}

      <section className="mb-6">
        <AttentionPanel
          stats={stats}
          isSuperAdmin={isSuperAdmin}
          router={router}
        />
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Secondary system metrics                                            */}
      {/* ------------------------------------------------------------------ */}

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {isSuperAdmin && (
          <button
            onClick={() => router.push("/dashboard/admin/institutions")}
            className="group bg-white border border-slate-200 rounded-2xl p-4 text-left hover:border-sky-200 hover:shadow-sm transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-sky-600" />
              </div>

              <div className="flex-1">
                <p className="text-[12.5px] text-slate-500">Institutions</p>

                <p className="text-lg font-bold text-slate-900">
                  {stats?.totalInstitutions === undefined
                    ? "—"
                    : stats.totalInstitutions.toLocaleString()}
                </p>
              </div>

              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-sky-600" />
            </div>
          </button>
        )}

        <button
          onClick={() => router.push("/dashboard/admin/audit")}
          className="group bg-white border border-slate-200 rounded-2xl p-4 text-left hover:border-slate-300 hover:shadow-sm transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
              <Activity className="w-4 h-4 text-slate-600" />
            </div>

            <div className="flex-1">
              <p className="text-[12.5px] text-slate-500">Audit events today</p>

              <p className="text-lg font-bold text-slate-900">
                {stats?.auditLogsToday === undefined
                  ? "—"
                  : stats.auditLogsToday.toLocaleString()}
              </p>
            </div>

            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600" />
          </div>
        </button>

        {/*
          "Unverified staff" was here as well as in the attention panel above,
          which is where an item requiring action belongs. Removed rather than
          shown twice.
        */}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Activity panels                                                     */}
      {/* ------------------------------------------------------------------ */}

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <RecentStaff staff={recentStaff} loading={loading} router={router} />

        <RecentVisits visits={recentVisits} loading={loading} router={router} />

        <AuditActivity logs={recentAudit} loading={loading} router={router} />
      </section>
    </div>
  );
}
