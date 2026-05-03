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
  TrendingUp,
  AlertTriangle,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  FlaskConical,
  Scan,
  Pill,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

// ── Types ──────────────────────────────────────────────────────────────────────
interface AdminStats {
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

// ── UI primitives ──────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
  bg,
  border,
  alert = false,
  onClick,
}: {
  label: string;
  value: number | undefined;
  sub?: string;
  icon: any;
  color: string;
  bg: string;
  border: string;
  alert?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="group relative rounded-2xl border overflow-hidden text-left transition-all w-full"
      style={{
        background: bg,
        borderColor: alert ? color : border,
        boxShadow: alert ? `0 0 0 2px ${color}18` : undefined,
        cursor: onClick ? "pointer" : "default",
      }}
      onMouseEnter={(e) => {
        if (onClick) e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        if (onClick) e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <div style={{ padding: "20px 20px 18px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: `${color}15`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon size={17} style={{ color }} />
          </div>
          {alert && (
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: color,
                boxShadow: `0 0 0 3px ${color}25`,
                display: "block",
                marginTop: 4,
                animation: "pulse 2s ease-in-out infinite",
              }}
            />
          )}
        </div>
        <p
          style={{
            fontSize: 30,
            fontWeight: 800,
            color,
            lineHeight: 1,
            marginBottom: 4,
          }}
        >
          {value === undefined ? (
            <span
              style={{
                display: "inline-block",
                width: 40,
                height: 28,
                borderRadius: 6,
                background: `${color}15`,
                verticalAlign: "middle",
              }}
            />
          ) : (
            value.toLocaleString()
          )}
        </p>
        <p
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            color,
            opacity: 0.65,
            marginBottom: 2,
          }}
        >
          {label}
        </p>
        {sub && <p style={{ fontSize: 11.5, color, opacity: 0.4 }}>{sub}</p>}
      </div>
      {onClick && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 3,
            background: color,
            opacity: 0.15,
            transition: "opacity 0.15s",
          }}
          className="group-hover:opacity-40"
        />
      )}
    </button>
  );
}

function SectionTitle({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 14,
      }}
    >
      <h2
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: "#111827",
          letterSpacing: "-0.01em",
        }}
      >
        {children}
      </h2>
      {action}
    </div>
  );
}

function ViewAllBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        fontSize: 12.5,
        fontWeight: 600,
        color: "#166534",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 0,
      }}
    >
      View all <ChevronRight size={13} />
    </button>
  );
}

function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 16,
        border: "1px solid #eaecf0",
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SkeletonRow() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "13px 20px",
        borderBottom: "1px solid #f3f4f6",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: "#f1f5f9",
        }}
      />
      <div style={{ flex: 1 }}>
        <div
          style={{
            width: "45%",
            height: 12,
            borderRadius: 4,
            background: "#f1f5f9",
            marginBottom: 6,
          }}
        />
        <div
          style={{
            width: "65%",
            height: 11,
            borderRadius: 4,
            background: "#f1f5f9",
          }}
        />
      </div>
      <div
        style={{
          width: 60,
          height: 22,
          borderRadius: 999,
          background: "#f1f5f9",
        }}
      />
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentStaff, setRecentStaff] = useState<any[]>([]);
  const [recentVisits, setRecentVisits] = useState<any[]>([]);
  const [recentAudit, setRecentAudit] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [statsRes, staffRes, visitsRes, auditRes] =
        await Promise.allSettled([
          api.get("/api/dashboard/admin"),
          api.get("/api/practitioners?limit=5&sort=createdAt&order=desc"),
          api.get("/api/visits?limit=5&sort=admissionDate&order=desc"),
          api.get("/api/audit?limit=6"),
        ]);
      if (statsRes.status === "fulfilled") setStats(statsRes.value.data.data);
      if (staffRes.status === "fulfilled")
        setRecentStaff(staffRes.value.data.data?.practitioners ?? []);
      if (visitsRes.status === "fulfilled")
        setRecentVisits(visitsRes.value.data.data?.visits ?? []);
      if (auditRes.status === "fulfilled")
        setRecentAudit(auditRes.value.data.data?.logs ?? []);
    } catch (_) {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  function greeting() {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  }

  const PRIORITY_COLOR: Record<string, string> = {
    critical: "#dc2626",
    emergency: "#ea580c",
    urgent: "#d97706",
    routine: "#16a34a",
  };

  const ROLE_LABEL: Record<string, string> = {
    practitioner: "Doctor",
    nurse: "Nurse",
    lab_technician: "Lab Tech",
    radiologist: "Radiologist",
    pharmacist: "Pharmacist",
    admin: "Admin",
    receptionist: "Receptionist",
  };

  return (
    <div style={{ maxWidth: 1200 }}>
      <style>{`
        @keyframes pulse {
          0%,100% { box-shadow: 0 0 0 3px rgba(220,38,38,0.25); }
          50%      { box-shadow: 0 0 0 6px rgba(220,38,38,0.08); }
        }
      `}</style>

      {/* ── Hero row ── */}
      <div
        style={{
          background:
            "linear-gradient(130deg, #0f172a 0%, #1e293b 55%, #1a3a2a 100%)",
          borderRadius: 20,
          padding: "28px 32px",
          marginBottom: 24,
          position: "relative",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        {/* Decorative rings */}
        <div
          style={{
            position: "absolute",
            right: -80,
            top: -80,
            width: 280,
            height: 280,
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.05)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: -30,
            top: -30,
            width: 160,
            height: 160,
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.06)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            width: 200,
            height: 200,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(22,101,52,0.15), transparent)",
            pointerEvents: "none",
          }}
        />

        <div style={{ position: "relative", zIndex: 1 }}>
          <p
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: 13,
              marginBottom: 4,
            }}
          >
            {greeting()}, {user?.firstName}
          </p>
          <h1
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 26,
              fontWeight: 700,
              color: "#fff",
              lineHeight: 1.2,
              marginBottom: 6,
            }}
          >
            System Overview
          </h1>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>
            {format(new Date(), "EEEE, d MMMM yyyy")}
            {stats && (
              <>
                {" · "}
                <span style={{ color: "rgba(255,255,255,0.6)" }}>
                  {stats.activeVisits} active visit
                  {stats.activeVisits !== 1 ? "s" : ""}
                </span>
                {stats.unverifiedStaff > 0 && (
                  <>
                    {" "}
                    ·{" "}
                    <span style={{ color: "#fca5a5" }}>
                      {stats.unverifiedStaff} unverified staff
                    </span>
                  </>
                )}
              </>
            )}
          </p>
        </div>

        {/* Quick actions */}
        <div
          style={{
            display: "flex",
            gap: 10,
            position: "relative",
            zIndex: 1,
            flexWrap: "wrap",
          }}
        >
          {[
            {
              label: "Add Staff",
              href: "/dashboard/admin/staff/new",
              color: "#166534",
            },
            {
              label: "Institutions",
              href: "/dashboard/admin/institutions",
              color: "rgba(255,255,255,0.1)",
            },
          ].map((a) => (
            <button
              key={a.label}
              onClick={() => router.push(a.href)}
              style={{
                padding: "9px 18px",
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                color: "#fff",
                background: a.color,
                border: "1px solid rgba(255,255,255,0.15)",
                cursor: "pointer",
                transition: "opacity 0.15s, transform 0.1s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "0.85";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "1";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Stat grid (2 rows × 4) ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 14,
          marginBottom: 24,
        }}
      >
        {[
          {
            label: "Total Patients",
            value: stats?.totalPatients,
            sub: "registered",
            icon: Users,
            color: "#2563eb",
            bg: "linear-gradient(135deg,#eff6ff,#dbeafe)",
            border: "#bfdbfe",
            href: "/dashboard/admin/patients",
          },
          {
            label: "Staff Members",
            value: stats?.totalStaff,
            sub: "across all roles",
            icon: UserCog,
            color: "#7c3aed",
            bg: "linear-gradient(135deg,#faf5ff,#ede9fe)",
            border: "#ddd6fe",
            href: "/dashboard/admin/staff",
          },
          {
            label: "Institutions",
            value: stats?.totalInstitutions,
            sub: "registered",
            icon: Building2,
            color: "#0369a1",
            bg: "linear-gradient(135deg,#f0f9ff,#e0f2fe)",
            border: "#bae6fd",
            href: "/dashboard/admin/institutions",
          },
          {
            label: "Active Visits",
            value: stats?.activeVisits,
            sub: "in progress now",
            icon: ClipboardList,
            color: "#166534",
            bg: "linear-gradient(135deg,#f0fdf4,#dcfce7)",
            border: "#bbf7d0",
            href: "/dashboard/admin/visits",
          },
          {
            label: "Completed Today",
            value: stats?.completedToday,
            sub: "discharged",
            icon: CheckCircle2,
            color: "#0e7490",
            bg: "linear-gradient(135deg,#ecfeff,#cffafe)",
            border: "#a5f3fc",
          },
          {
            label: "Pending Permissions",
            value: stats?.pendingPermissions,
            sub: "await patient",
            icon: ShieldCheck,
            color: "#d97706",
            bg: "linear-gradient(135deg,#fffbeb,#fef3c7)",
            border: "#fde68a",
            alert: (stats?.pendingPermissions ?? 0) > 0,
            href: "/dashboard/admin/permissions",
          },
          {
            label: "Unverified Staff",
            value: stats?.unverifiedStaff,
            sub: "need verification",
            icon: AlertTriangle,
            color: "#dc2626",
            bg: "linear-gradient(135deg,#fef2f2,#fee2e2)",
            border: "#fecaca",
            alert: (stats?.unverifiedStaff ?? 0) > 0,
            href: "/dashboard/admin/staff?filter=unverified",
          },
          {
            label: "Audit Events Today",
            value: stats?.auditLogsToday,
            sub: "blockchain recorded",
            icon: Activity,
            color: "#64748b",
            bg: "linear-gradient(135deg,#f8fafc,#f1f5f9)",
            border: "#e2e8f0",
            href: "/dashboard/admin/audit",
          },
        ].map((s) => (
          <StatCard
            key={s.label}
            {...s}
            onClick={s.href ? () => router.push(s.href!) : undefined}
          />
        ))}
      </div>

      {/* ── Pending work pills ── */}
      {stats && stats.pendingLabOrders + stats.pendingImaging > 0 && (
        <div
          style={{
            display: "flex",
            gap: 10,
            marginBottom: 24,
            flexWrap: "wrap",
          }}
        >
          {stats.pendingLabOrders > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 14px",
                borderRadius: 999,
                background: "#fefce8",
                border: "1px solid #fde047",
                fontSize: 12.5,
                color: "#854d0e",
                fontWeight: 600,
              }}
            >
              <FlaskConical size={13} /> {stats.pendingLabOrders} pending lab
              orders
            </div>
          )}
          {stats.pendingImaging > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 14px",
                borderRadius: 999,
                background: "#f0f9ff",
                border: "1px solid #7dd3fc",
                fontSize: 12.5,
                color: "#0369a1",
                fontWeight: 600,
              }}
            >
              <Scan size={13} /> {stats.pendingImaging} pending imaging
            </div>
          )}
        </div>
      )}

      {/* ── Bottom 3-col grid ── */}
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}
      >
        {/* Recent Staff */}
        <Card>
          <div
            style={{
              padding: "18px 20px 14px",
              borderBottom: "1px solid #f3f4f6",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <p style={{ fontSize: 13.5, fontWeight: 700, color: "#111" }}>
              Recent Staff
            </p>
            <ViewAllBtn onClick={() => router.push("/dashboard/admin/staff")} />
          </div>
          {loading ? (
            <>
              {[...Array(4)].map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </>
          ) : recentStaff.length === 0 ? (
            <div
              style={{
                padding: "32px 20px",
                textAlign: "center",
                color: "#9ca3af",
                fontSize: 13,
              }}
            >
              No staff found
            </div>
          ) : (
            <div>
              {recentStaff.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => router.push(`/dashboard/admin/staff/${s.id}`)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 20px",
                    borderBottom:
                      i < recentStaff.length - 1 ? "1px solid #f9fafb" : "none",
                    background: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 0.12s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "#f9fafb")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "none")
                  }
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 9,
                      flexShrink: 0,
                      background: "linear-gradient(135deg,#1e293b,#334155)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#fff",
                    }}
                  >
                    {s.firstName?.[0]}
                    {s.lastName?.[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#111",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {s.firstName} {s.lastName}
                    </p>
                    <p
                      style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 1 }}
                    >
                      {s.licenseNumber}
                    </p>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: 4,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: s.isVerified ? "#f0fdf4" : "#fef2f2",
                        color: s.isVerified ? "#15803d" : "#dc2626",
                      }}
                    >
                      {s.isVerified ? "Verified" : "Pending"}
                    </span>
                    <span
                      style={{
                        fontSize: 10.5,
                        color: "#d1d5db",
                        textTransform: "capitalize",
                      }}
                    >
                      {ROLE_LABEL[s.role] ?? s.role}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Recent Visits */}
        <Card>
          <div
            style={{
              padding: "18px 20px 14px",
              borderBottom: "1px solid #f3f4f6",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <p style={{ fontSize: 13.5, fontWeight: 700, color: "#111" }}>
              Recent Visits
            </p>
            <ViewAllBtn
              onClick={() => router.push("/dashboard/admin/visits")}
            />
          </div>
          {loading ? (
            <>
              {[...Array(4)].map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </>
          ) : recentVisits.length === 0 ? (
            <div
              style={{
                padding: "32px 20px",
                textAlign: "center",
                color: "#9ca3af",
                fontSize: 13,
              }}
            >
              No visits yet
            </div>
          ) : (
            <div>
              {recentVisits.map((v, i) => {
                const pc = PRIORITY_COLOR[v.priority] ?? "#16a34a";
                return (
                  <button
                    key={v.id}
                    onClick={() =>
                      router.push(`/dashboard/admin/visits/${v.id}`)
                    }
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 20px",
                      borderBottom:
                        i < recentVisits.length - 1
                          ? "1px solid #f9fafb"
                          : "none",
                      background: "none",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "background 0.12s",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "#f9fafb")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "none")
                    }
                  >
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 9,
                          background: `${pc}12`,
                          border: `1.5px solid ${pc}30`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <ClipboardList size={15} style={{ color: pc }} />
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: 12.5,
                          fontWeight: 700,
                          color: "#111",
                          fontFamily: "monospace",
                          letterSpacing: "0.02em",
                        }}
                      >
                        {v.visitNumber}
                      </p>
                      <p
                        style={{
                          fontSize: 11.5,
                          color: "#9ca3af",
                          marginTop: 1,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {v.chiefComplaint}
                      </p>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-end",
                        gap: 4,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: `${pc}12`,
                          color: pc,
                          textTransform: "capitalize",
                        }}
                      >
                        {v.priority}
                      </span>
                      <span style={{ fontSize: 10.5, color: "#d1d5db" }}>
                        {format(new Date(v.admissionDate), "HH:mm")}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        {/* Audit log */}
        <Card>
          <div
            style={{
              padding: "18px 20px 14px",
              borderBottom: "1px solid #f3f4f6",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <p style={{ fontSize: 13.5, fontWeight: 700, color: "#111" }}>
              Audit Log
            </p>
            <ViewAllBtn onClick={() => router.push("/dashboard/admin/audit")} />
          </div>
          {loading ? (
            <>
              {[...Array(5)].map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </>
          ) : recentAudit.length === 0 ? (
            <div
              style={{
                padding: "32px 20px",
                textAlign: "center",
                color: "#9ca3af",
                fontSize: 13,
              }}
            >
              No events yet
            </div>
          ) : (
            <div>
              {recentAudit.map((log, i) => {
                const actionColor: Record<string, string> = {
                  view: "#6b7280",
                  create: "#166534",
                  update: "#2563eb",
                  delete: "#dc2626",
                  permission_grant: "#d97706",
                  permission_revoke: "#7c3aed",
                  emergency_override: "#dc2626",
                };
                const color = actionColor[log.actionType] ?? "#6b7280";
                return (
                  <div
                    key={log.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      padding: "11px 20px",
                      borderBottom:
                        i < recentAudit.length - 1
                          ? "1px solid #f9fafb"
                          : "none",
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        flexShrink: 0,
                        marginTop: 1,
                        background: `${color}10`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Activity size={12} style={{ color }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: 12.5,
                          fontWeight: 600,
                          color: "#374151",
                          lineHeight: 1.3,
                        }}
                      >
                        <span style={{ textTransform: "capitalize", color }}>
                          {log.actionType?.replace("_", " ")}
                        </span>{" "}
                        <span style={{ color: "#9ca3af", fontWeight: 400 }}>
                          {log.resourceType}
                        </span>
                      </p>
                      <p
                        style={{ fontSize: 11, color: "#c4c9d4", marginTop: 2 }}
                      >
                        {log.timestamp
                          ? formatDistanceToNow(new Date(log.timestamp), {
                              addSuffix: true,
                            })
                          : "—"}
                      </p>
                    </div>
                    {log.isEmergencyOverride && (
                      <span
                        style={{
                          fontSize: 9.5,
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: "#fef2f2",
                          color: "#dc2626",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                      >
                        OVERRIDE
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
