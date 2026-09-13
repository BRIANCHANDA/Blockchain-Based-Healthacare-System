"use client";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";

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
    color: "var(--critical-ink)",
    bg: "var(--coral-050)",
    label: "Critical",
  },
  emergency: {
    color: "var(--critical-ink)",
    bg: "var(--coral-050)",
    label: "Emergency",
  },
  urgent: {
    color: "var(--urgent-ink)",
    bg: "var(--amber-050)",
    label: "Urgent",
  },
  routine: {
    color: "var(--success-ink)",
    bg: "var(--brand-tint)",
    label: "Routine",
  },
};

const ACTION_CONFIG: Record<string, { color: string; bg: string }> = {
  view: {
    color: "var(--text-secondary)",
    bg: "var(--surface-sunken)",
  },
  create: {
    color: "var(--success-ink)",
    bg: "var(--brand-tint)",
  },
  update: {
    color: "var(--blue-600)",
    bg: "var(--info-tint)",
  },
  delete: {
    color: "var(--critical-ink)",
    bg: "var(--coral-050)",
  },
  permission_grant: {
    color: "var(--urgent-ink)",
    bg: "var(--amber-050)",
  },
  permission_revoke: {
    color: "var(--accent-ink)",
    bg: "var(--violet-050)",
  },
  emergency_override: {
    color: "var(--critical-ink)",
    bg: "var(--coral-050)",
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
        group relative w-full text-left bg-[var(--surface-card)] border border-[var(--hc-border)]
        rounded-[var(--r-lg)] p-5 transition-all duration-200
        ${
          href
            ? "hover:border-[var(--green-200)] hover:shadow-[var(--elev-2)] hover:-translate-y-0.5 cursor-pointer"
            : "cursor-default"
        }
      `}
    >
      <div className="flex items-start justify-between">
        <div
          className={`w-10 h-10 rounded-[var(--r-sm)] flex items-center justify-center ${iconClass}`}
        >
          <Icon className="w-[18px] h-[18px]" />
        </div>

        {href && (
          <ArrowUpRight className="w-4 h-4 text-[var(--text-disabled)] group-hover:text-[var(--green-700)] transition-colors" />
        )}
      </div>

      <div className="mt-5">
        <p className="text-[13px] font-medium text-[var(--text-secondary)]">{label}</p>

        <p className="mt-1 text-[28px] leading-none font-bold tracking-tight text-[var(--text-primary)]">
          {value === undefined ? (
            <span className="inline-block w-16 h-7 rounded-[var(--r-xs)] bg-[var(--surface-sunken)] animate-pulse" />
          ) : (
            value.toLocaleString()
          )}
        </p>

        <div className="flex items-center gap-2 mt-2">
          <p className="text-[12.5px] text-[var(--text-muted)]">{description}</p>

          {trend && (
            <>
              <span className="w-1 h-1 rounded-full bg-[var(--ink-300)]" />
              <span className="text-[12.5px] font-semibold text-[var(--green-700)]">
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
      className={`bg-[var(--surface-card)] border border-[var(--hc-border)] rounded-[var(--r-lg)] overflow-hidden ${className}`}
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
    <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-faint)]">
      <div className="flex items-center gap-2.5">
        {Icon && (
          <div className="w-8 h-8 rounded-[var(--r-xs)] bg-[var(--surface-sunken)] flex items-center justify-center">
            <Icon className="w-4 h-4 text-[var(--text-secondary)]" />
          </div>
        )}

        <h3 className="text-[15px] font-bold text-[var(--text-primary)]">{title}</h3>
      </div>

      {action && onAction && (
        <button
          onClick={onAction}
          className="flex items-center gap-1 text-[13px] font-semibold text-[var(--green-700)] hover:text-[var(--green-800)]"
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
    <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[var(--border-faint)]">
      <div className="w-9 h-9 rounded-[var(--r-sm)] bg-[var(--surface-sunken)] animate-pulse" />

      <div className="flex-1">
        <div className="w-2/5 h-3 rounded bg-[var(--surface-sunken)] animate-pulse mb-2" />
        <div className="w-3/5 h-2.5 rounded bg-[var(--surface-sunken)] animate-pulse" />
      </div>

      <div className="w-14 h-5 rounded-full bg-[var(--surface-sunken)] animate-pulse" />
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
      <div className="w-10 h-10 rounded-[var(--r-sm)] bg-[var(--surface-sunken)] flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-[var(--text-disabled)]" />
      </div>

      <p className="text-[13px] text-[var(--text-muted)]">{message}</p>
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
      color: "text-[var(--urgent-ink)]",
      bg: "bg-[var(--amber-050)]",
      href: "/dashboard/admin/permissions",
    });
  }

  if ((stats?.unverifiedStaff ?? 0) > 0) {
    items.push({
      icon: UserCheck,
      label: "Unverified staff",
      description: "Require verification",
      value: stats?.unverifiedStaff ?? 0,
      color: "text-[var(--critical-ink)]",
      bg: "bg-[var(--coral-050)]",
      href: "/dashboard/admin/staff?filter=unverified",
    });
  }

  if ((stats?.pendingLabOrders ?? 0) > 0) {
    items.push({
      icon: FlaskConical,
      label: "Laboratory orders",
      description: "Pending processing",
      value: stats?.pendingLabOrders ?? 0,
      color: "text-[var(--urgent-ink)]",
      bg: "bg-[var(--amber-050)]",
    });
  }

  if ((stats?.pendingImaging ?? 0) > 0) {
    items.push({
      icon: Scan,
      label: "Imaging requests",
      description: "Pending processing",
      value: stats?.pendingImaging ?? 0,
      color: "text-[var(--info-ink)]",
      bg: "bg-[var(--info-tint)]",
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
          <div className="flex items-center gap-3 rounded-[var(--r-sm)] bg-[var(--brand-tint)] border border-[var(--green-100)] px-4 py-3">
            <div className="w-8 h-8 rounded-[var(--r-xs)] bg-[var(--green-100)] flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-[var(--green-700)]" />
            </div>

            <div>
              <p className="text-[13px] font-semibold text-[var(--green-800)]">
                Everything looks good
              </p>
              <p className="text-[12.5px] text-[var(--green-700)] mt-0.5">
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
                  ${index < items.length - 1 ? "border-b border-[var(--border-faint)]" : ""}
                  ${item.href ? "hover:bg-[var(--surface-sunken)] cursor-pointer" : ""}
                `}
              >
                <div
                  className={`w-9 h-9 rounded-[var(--r-sm)] flex items-center justify-center ${item.bg}`}
                >
                  <Icon className={`w-4 h-4 ${item.color}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[var(--text-primary)]">
                    {item.label}
                  </p>

                  <p className="text-[12.5px] text-[var(--text-muted)] mt-0.5">
                    {item.description}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-[15px] font-bold ${item.color}`}>
                    {item.value}
                  </span>

                  {item.href && (
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--text-disabled)]" />
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
                hover:bg-[var(--surface-sunken)] transition-colors
                ${index < staff.length - 1 ? "border-b border-[var(--border-faint)]" : ""}
              `}
            >
              <div className="w-9 h-9 rounded-[var(--r-sm)] bg-[var(--surface-sunken)] flex items-center justify-center text-[12.5px] font-bold text-[var(--text-secondary)] flex-shrink-0">
                {initials || "?"}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                  {person.firstName} {person.lastName}
                </p>

                <p className="text-[12px] text-[var(--text-muted)] truncate mt-0.5">
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
                        ? "bg-[var(--brand-tint)] text-[var(--green-700)]"
                        : "bg-[var(--coral-050)] text-[var(--critical-ink)]"
                    }
                  `}
                >
                  {person.isVerified ? "Verified" : "Pending"}
                </span>

                <ChevronRight className="w-3 h-3 text-[var(--text-disabled)]" />
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
                ${index < visits.length - 1 ? "border-b border-[var(--border-faint)]" : ""}
              `}
            >
              <div
                className="w-9 h-9 rounded-[var(--r-sm)] flex items-center justify-center flex-shrink-0"
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
                <p className="text-[13px] font-bold text-[var(--text-primary)] font-mono">
                  {visit.visitNumber ?? "—"}
                </p>

                <p className="text-[12px] text-[var(--text-muted)] truncate mt-0.5">
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

                <span className="flex items-center gap-1 text-[11.5px] text-[var(--text-muted)]">
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
                ${index < logs.length - 1 ? "border-b border-[var(--border-faint)]" : ""}
              `}
            >
              <div
                className="w-8 h-8 rounded-[var(--r-xs)] flex items-center justify-center flex-shrink-0"
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
                <p className="text-[13px] text-[var(--text-secondary)] leading-snug">
                  <span
                    className="font-semibold capitalize"
                    style={{ color: action.color }}
                  >
                    {log.actionType?.replace(/_/g, " ") ?? "Activity"}
                  </span>{" "}
                  <span className="text-[var(--text-muted)]">
                    {log.resourceType ?? "resource"}
                  </span>
                </p>

                <p className="text-[12px] text-[var(--text-muted)] mt-1">
                  {log.timestamp
                    ? formatDistanceToNow(new Date(log.timestamp), {
                        addSuffix: true,
                      })
                    : "—"}
                </p>
              </div>

              {log.isEmergencyOverride && (
                <span className="px-1.5 py-0.5 rounded bg-[var(--coral-050)] text-[var(--critical-ink)] text-[10px] font-bold">
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

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);

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

  useLiveRefresh(() => fetchAll(true));

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
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand)]" />

              <p className="text-[12.5px] font-semibold uppercase tracking-[0.12em] text-[var(--green-700)]">
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
            <h1 style={{ margin: 0, font: "700 27px/1.1 var(--font-sans)", letterSpacing: "var(--ls-tight)", color: "var(--text-primary)" }}>
              {isSuperAdmin
                ? "All Institutions"
                : institutionName || "My Institution"}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/dashboard/admin/staff/new")}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[var(--r-sm)] bg-[var(--brand)] hover:bg-[var(--brand-deep)] text-[var(--white)] text-[13px] font-semibold shadow-[var(--elev-1)] transition-colors"
            >
              <UserCog className="w-3.5 h-3.5" />
              Add Staff
            </button>

            {isSuperAdmin && (
              <button
                onClick={() => router.push("/dashboard/admin/institutions")}
                className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-[var(--r-sm)] bg-[var(--surface-card)] border border-[var(--hc-border)] hover:border-[var(--green-200)] text-[var(--text-secondary)] text-[13px] font-semibold transition-colors"
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
          iconClass="bg-[var(--info-tint)] text-[var(--info-ink)]"
          href="/dashboard/admin/patients"
        />

        <KpiCard
          label="Staff Members"
          value={stats?.totalStaff}
          description="Across all roles"
          icon={UserCog}
          iconClass="bg-[var(--violet-050)] text-[var(--accent-ink)]"
          href="/dashboard/admin/staff"
        />

        <KpiCard
          label="Active Visits"
          value={stats?.activeVisits}
          description="Currently in progress"
          icon={ClipboardList}
          iconClass="bg-[var(--brand-tint)] text-[var(--green-700)]"
          href="/dashboard/admin/visits"
        />

        <KpiCard
          label="Completed Today"
          value={stats?.completedToday}
          description="Visits completed today"
          icon={CheckCircle2}
          iconClass="bg-[var(--info-tint)] text-[var(--info-ink)]"
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
            className="group bg-[var(--surface-card)] border border-[var(--hc-border)] rounded-[var(--r-lg)] p-4 text-left hover:border-[var(--blue-100)] hover:shadow-[var(--elev-1)] transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[var(--r-sm)] bg-[var(--info-tint)] flex items-center justify-center">
                <Building2 className="w-4 h-4 text-[var(--info-ink)]" />
              </div>

              <div className="flex-1">
                <p className="text-[12.5px] text-[var(--text-secondary)]">Institutions</p>

                <p className="text-lg font-bold text-[var(--text-primary)]">
                  {stats?.totalInstitutions === undefined
                    ? "—"
                    : stats.totalInstitutions.toLocaleString()}
                </p>
              </div>

              <ChevronRight className="w-4 h-4 text-[var(--text-disabled)] group-hover:text-[var(--info-ink)]" />
            </div>
          </button>
        )}

        <button
          onClick={() => router.push("/dashboard/admin/audit")}
          className="group bg-[var(--surface-card)] border border-[var(--hc-border)] rounded-[var(--r-lg)] p-4 text-left hover:border-[var(--ink-300)] hover:shadow-[var(--elev-1)] transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[var(--r-sm)] bg-[var(--surface-sunken)] flex items-center justify-center">
              <Activity className="w-4 h-4 text-[var(--text-secondary)]" />
            </div>

            <div className="flex-1">
              <p className="text-[12.5px] text-[var(--text-secondary)]">Audit events today</p>

              <p className="text-lg font-bold text-[var(--text-primary)]">
                {stats?.auditLogsToday === undefined
                  ? "—"
                  : stats.auditLogsToday.toLocaleString()}
              </p>
            </div>

            <ChevronRight className="w-4 h-4 text-[var(--text-disabled)] group-hover:text-[var(--text-secondary)]" />
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
