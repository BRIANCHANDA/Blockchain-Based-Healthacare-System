"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import {
  Activity,
  ClipboardList,
  ChevronRight,
  Clock,
  AlertTriangle,
  Users,
  FileText,
  Stethoscope,
  TrendingUp,
  ArrowRight,
  Calendar,
  FlaskConical,
  Microscope,
  Pill,
  RefreshCw,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

// ── Types ──────────────────────────────────────────────────────────────────────
interface TodayStats {
  total: number;
  triaged: number;
  completed: number;
  critical: number;
  urgent: number;
}
interface ActivityStats {
  consultations: number;
  labOrders: number;
  imagingOrders: number;
  prescriptions: number;
}
interface RecentPatient {
  visitId: string;
  visitNumber: string;
  priority: string;
  status: string;
  chiefComplaint: string;
  consultedAt: string;
  patient: {
    firstName: string;
    lastName: string;
    gender: string;
    bloodType: string;
  } | null;
}
interface QueueVisit {
  id: string;
  visitNumber: string;
  chiefComplaint: string;
  priority: string;
  status: string;
  admissionDate: string;
  hasConsultation: boolean;
  patient: {
    firstName: string;
    lastName: string;
    gender: string;
    bloodType: string;
  } | null;
}

// ── Priority config ────────────────────────────────────────────────────────────
const PC: Record<
  string,
  { color: string; bg: string; border: string; dot: string; label: string }
> = {
  critical: {
    color: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca",
    dot: "#ef4444",
    label: "Critical",
  },
  emergency: {
    color: "#ea580c",
    bg: "#fff7ed",
    border: "#fed7aa",
    dot: "#f97316",
    label: "Emergency",
  },
  urgent: {
    color: "#d97706",
    bg: "#fffbeb",
    border: "#fde68a",
    dot: "#f59e0b",
    label: "Urgent",
  },
  routine: {
    color: "#166534",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    dot: "#16a34a",
    label: "Routine",
  },
};
const getP = (p: string) => PC[p] ?? PC.routine;

const bloodTypeColor: Record<string, string> = {
  "A+": "#3b82f6",
  "A-": "#6366f1",
  "B+": "#8b5cf6",
  "B-": "#ec4899",
  "AB+": "#f59e0b",
  "AB-": "#ef4444",
  "O+": "#10b981",
  "O-": "#14b8a6",
};

function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function DoctorOverview() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [stats, setStats] = useState<TodayStats | null>(null);
  const [activity, setActivity] = useState<ActivityStats | null>(null);
  const [recentPatients, setRecent] = useState<RecentPatient[]>([]);
  const [queue, setQueue] = useState<QueueVisit[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    try {
      const res = await api.get("/api/doctor/stats");
      const d = res.data.data;
      setStats(d.today);
      setActivity(d.activity);
      setRecent(d.recentPatients ?? []);
    } catch (_) {
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchQueue = async (silent = false) => {
    if (silent) setRefreshing(true);
    try {
      const res = await api.get("/api/doctor/today-queue");
      setQueue(res.data.data.visits ?? []);
    } catch (_) {
    } finally {
      setLoadingQueue(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchQueue();
    const i = setInterval(() => fetchQueue(true), 30_000);
    return () => clearInterval(i);
  }, []);

  const skeletonVal = (v: number | undefined, color: string) =>
    loadingStats ? (
      <span
        className="inline-block w-8 h-7 rounded-lg animate-pulse"
        style={{ background: `${color}18` }}
      />
    ) : (
      <>{v ?? 0}</>
    );

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* ── Hero banner ── */}
      <div
        className="relative rounded-3xl overflow-hidden mb-6 px-7 py-6"
        style={{
          background:
            "linear-gradient(130deg, #0d4a1f 0%, #166534 55%, #15803d 100%)",
        }}
      >
        <div
          className="absolute -right-10 -top-10 w-48 h-48 rounded-full opacity-[0.07]"
          style={{ background: "radial-gradient(circle,#bbf7d0,transparent)" }}
        />
        <div
          className="absolute right-28 bottom-0 w-32 h-32 rounded-full opacity-[0.05]"
          style={{ background: "radial-gradient(circle,#dcfce7,transparent)" }}
        />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-green-300/70 text-sm font-medium mb-1">
              {getGreeting()}, Dr.
            </p>
            <h1
              className="text-white text-2xl font-bold leading-tight"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {user?.firstName} {user?.lastName}
            </h1>
            <p className="text-green-200/50 text-sm mt-1.5">
              {format(new Date(), "EEEE, d MMMM yyyy")}
              {stats && stats.total > 0 && (
                <>
                  {" · "}
                  <span className="text-green-200/80">
                    {stats.total} patient{stats.total !== 1 ? "s" : ""} today
                  </span>
                  {stats.critical > 0 && (
                    <>
                      {" "}
                      ·{" "}
                      <span className="text-red-300">
                        {stats.critical} critical
                      </span>
                    </>
                  )}
                </>
              )}
            </p>
          </div>
          <div className="flex gap-2.5 flex-wrap">
            <button
              onClick={() => router.push("/dashboard/doctor/queue")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.02]"
              style={{
                background: "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.2)",
              }}
            >
              <ClipboardList className="w-4 h-4" /> Today's Queue
            </button>
            <button
              onClick={() => router.push("/dashboard/doctor/patients")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: "rgba(0,0,0,0.2)",
                color: "#bbf7d0",
                border: "1px solid rgba(0,0,0,0.1)",
              }}
            >
              <Users className="w-4 h-4" /> Patient Search
            </button>
          </div>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {(
          [
            {
              label: "Total Today",
              value: stats?.total,
              sub: "registered visits",
              color: "#166534",
              bg: "linear-gradient(135deg,#f0fdf4,#dcfce7)",
              border: "#bbf7d0",
              icon: Calendar,
            },
            {
              label: "Awaiting Me",
              value: stats?.triaged,
              sub: "triaged · ready for consult",
              color: "#1d4ed8",
              bg: "linear-gradient(135deg,#eff6ff,#dbeafe)",
              border: "#bfdbfe",
              icon: Clock,
            },
            {
              label: "Completed",
              value: stats?.completed,
              sub: "discharged today",
              color: "#7c3aed",
              bg: "linear-gradient(135deg,#faf5ff,#ede9fe)",
              border: "#ddd6fe",
              icon: TrendingUp,
            },
            {
              label: "Critical/Urgent",
              value: (stats?.critical ?? 0) + (stats?.urgent ?? 0),
              sub: `${stats?.critical ?? 0} critical · ${stats?.urgent ?? 0} urgent`,
              color: "#dc2626",
              bg: "linear-gradient(135deg,#fef2f2,#fee2e2)",
              border: "#fecaca",
              icon: AlertTriangle,
            },
          ] as const
        ).map(({ label, value, sub, color, bg, border, icon: Icon }) => (
          <div
            key={label}
            className="relative rounded-2xl border overflow-hidden p-4"
            style={{ background: bg, borderColor: border }}
          >
            <div
              className="absolute -right-2 -bottom-2 w-16 h-16 rounded-full opacity-10"
              style={{ background: color }}
            />
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center mb-3"
              style={{ background: `${color}15` }}
            >
              <Icon className="w-4 h-4" style={{ color }} />
            </div>
            <p
              className="text-3xl font-extrabold leading-none mb-1"
              style={{ color }}
            >
              {skeletonVal(value, color)}
            </p>
            <p className="text-xs font-bold" style={{ color, opacity: 0.75 }}>
              {label}
            </p>
            <p className="text-xs mt-0.5" style={{ color, opacity: 0.45 }}>
              {sub}
            </p>
          </div>
        ))}
      </div>

      {/* ── My Activity strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {(
          [
            {
              label: "Consultations",
              value: activity?.consultations,
              color: "#166534",
              icon: Stethoscope,
            },
            {
              label: "Lab Orders",
              value: activity?.labOrders,
              color: "#0369a1",
              icon: Microscope,
            },
            {
              label: "Imaging Orders",
              value: activity?.imagingOrders,
              color: "#7c3aed",
              icon: FlaskConical,
            },
            {
              label: "Prescriptions",
              value: activity?.prescriptions,
              color: "#d97706",
              icon: Pill,
            },
          ] as const
        ).map(({ label, value, color, icon: Icon }) => (
          <div
            key={label}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3"
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${color}10` }}
            >
              <Icon className="w-4 h-4" style={{ color }} />
            </div>
            <div>
              <p className="text-xl font-extrabold leading-none text-gray-900">
                {loadingStats ? (
                  <span className="inline-block w-5 h-5 rounded bg-gray-100 animate-pulse" />
                ) : (
                  (value ?? 0)
                )}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{label} today</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Bottom grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Quick actions */}
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
            Quick Actions
          </p>
          {(
            [
              {
                label: "Today's Queue",
                desc: "Triaged patients ready for consult",
                href: "/dashboard/doctor/queue",
                icon: ClipboardList,
                color: "#166534",
                bg: "linear-gradient(135deg,#f0fdf4,#dcfce7)",
                border: "#bbf7d0",
              },
              {
                label: "Patient Search",
                desc: "Look up any registered patient",
                href: "/dashboard/doctor/patients",
                icon: Users,
                color: "#1d4ed8",
                bg: "linear-gradient(135deg,#eff6ff,#dbeafe)",
                border: "#bfdbfe",
              },
              {
                label: "Request Permissions",
                desc: "Blockchain consent from patient",
                href: "/dashboard/doctor/permissions",
                icon: Activity,
                color: "#7c3aed",
                bg: "linear-gradient(135deg,#faf5ff,#ede9fe)",
                border: "#ddd6fe",
              },
              {
                label: "New Visit",
                desc: "Register an emergency visit",
                href: "/dashboard/doctor/visit/new",
                icon: FileText,
                color: "#d97706",
                bg: "linear-gradient(135deg,#fffbeb,#fef3c7)",
                border: "#fde68a",
              },
            ] as const
          ).map(({ label, desc, href, icon: Icon, color, bg, border }) => (
            <button
              key={href}
              onClick={() => router.push(href)}
              className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl border text-left transition-all hover:shadow-md hover:-translate-y-px group"
              style={{ background: bg, borderColor: border }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${color}15` }}
              >
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
              </div>
              <ArrowRight
                className="w-4 h-4 flex-shrink-0 transition-transform group-hover:translate-x-0.5"
                style={{ color }}
              />
            </button>
          ))}
        </div>

        {/* Live queue — 2 cols */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
                Live Queue
              </p>
              {!loadingQueue &&
                queue.filter((v) => !v.hasConsultation).length > 0 && (
                  <span
                    className="px-1.5 py-0.5 rounded-full text-xs font-bold"
                    style={{ background: "#fef2f2", color: "#dc2626" }}
                  >
                    {queue.filter((v) => !v.hasConsultation).length} pending
                  </span>
                )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchQueue(true)}
                disabled={refreshing}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all disabled:opacity-40"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
                />
              </button>
              <button
                onClick={() => router.push("/dashboard/doctor/queue")}
                className="text-xs font-semibold flex items-center gap-1 transition-colors"
                style={{ color: "#166534" }}
              >
                See all <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {loadingQueue ? (
              <div className="divide-y divide-gray-50">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 px-5 py-4 animate-pulse"
                  >
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-32 bg-gray-100 rounded" />
                      <div className="h-3 w-52 bg-gray-100 rounded" />
                    </div>
                    <div className="w-16 h-6 bg-gray-100 rounded-full" />
                  </div>
                ))}
              </div>
            ) : queue.length === 0 ? (
              <div className="py-16 text-center">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: "#f0fdf4" }}
                >
                  <TrendingUp className="w-6 h-6 text-green-400" />
                </div>
                <p className="text-sm font-semibold text-gray-500">
                  No patients ready for consultation
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Patients will appear after nurse triage is complete
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {queue.slice(0, 7).map((v, i) => {
                  const p = getP(v.priority);
                  const isCrit = ["critical", "emergency"].includes(v.priority);
                  const needsReview = !v.hasConsultation;
                  return (
                    <button
                      key={v.id}
                      onClick={() =>
                        router.push(`/dashboard/doctor/visit/${v.id}`)
                      }
                      className="w-full flex items-center gap-4 px-5 py-3.5 text-left transition-all group"
                      style={{
                        background:
                          isCrit && i === 0 ? `${p.dot}08` : undefined,
                      }}
                      onMouseEnter={(e) => {
                        if (!(isCrit && i === 0))
                          e.currentTarget.style.background = "#f9fafb";
                      }}
                      onMouseLeave={(e) => {
                        if (!(isCrit && i === 0))
                          e.currentTarget.style.background = "transparent";
                      }}
                    >
                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold"
                          style={{
                            background: isCrit ? p.color : "#e2e8f0",
                            color: isCrit ? "#fff" : "#64748b",
                          }}
                        >
                          {v.patient
                            ? `${v.patient.firstName?.[0]}${v.patient.lastName?.[0]}`
                            : "?"}
                        </div>
                        <span
                          className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white"
                          style={{
                            background: needsReview
                              ? isCrit
                                ? p.dot
                                : "#f59e0b"
                              : "#16a34a",
                          }}
                        />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-900 leading-tight">
                            {v.patient
                              ? `${v.patient.firstName} ${v.patient.lastName}`
                              : "Unknown"}
                          </p>
                          {v.patient?.bloodType &&
                            v.patient.bloodType !== "unknown" && (
                              <span
                                className="text-xs font-bold px-1.5 py-0.5 rounded-full text-white"
                                style={{
                                  background:
                                    bloodTypeColor[v.patient.bloodType] ??
                                    "#6b7280",
                                  fontSize: "10px",
                                }}
                              >
                                {v.patient.bloodType}
                              </span>
                            )}
                          <span className="font-mono text-xs text-gray-400">
                            {v.visitNumber}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 truncate mt-0.5 max-w-xs">
                          {v.chiefComplaint}
                        </p>
                      </div>

                      {/* Right side */}
                      <div className="hidden sm:flex flex-col items-end gap-1.5 flex-shrink-0">
                        <span
                          className="text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={{
                            background: p.bg,
                            color: p.color,
                            border: `1px solid ${p.border}`,
                          }}
                        >
                          {p.label}
                        </span>
                        <span
                          className="text-xs flex items-center gap-1"
                          style={{ color: needsReview ? "#d97706" : "#16a34a" }}
                        >
                          {needsReview ? (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />{" "}
                              Needs review
                            </>
                          ) : (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />{" "}
                              Consulted
                            </>
                          )}
                        </span>
                      </div>

                      <ChevronRight className="w-4 h-4 text-gray-200 group-hover:text-green-600 transition-colors flex-shrink-0" />
                    </button>
                  );
                })}

                {queue.length > 7 && (
                  <button
                    onClick={() => router.push("/dashboard/doctor/queue")}
                    className="w-full flex items-center justify-center gap-2 px-5 py-3.5 text-sm font-semibold transition-colors hover:bg-gray-50"
                    style={{ color: "#166534" }}
                  >
                    View {queue.length - 7} more{" "}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Recently consulted */}
          {recentPatients.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
                Recently Consulted
              </p>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="divide-y divide-gray-50">
                  {recentPatients.map((r) => {
                    const p = getP(r.priority);
                    return (
                      <button
                        key={r.visitId}
                        onClick={() =>
                          router.push(`/dashboard/doctor/visit/${r.visitId}`)
                        }
                        className="w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-gray-50 transition-colors group"
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: `${p.color}15`, color: p.color }}
                        >
                          {r.patient
                            ? `${r.patient.firstName?.[0]}${r.patient.lastName?.[0]}`
                            : "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">
                            {r.patient
                              ? `${r.patient.firstName} ${r.patient.lastName}`
                              : "Unknown"}
                          </p>
                          <p className="text-xs text-gray-400 truncate">
                            {r.chiefComplaint}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.status === "completed" ? "" : ""}`}
                            style={
                              r.status === "completed"
                                ? { background: "#f0fdf4", color: "#166534" }
                                : { background: "#eff6ff", color: "#1d4ed8" }
                            }
                          >
                            {r.status === "completed" ? "Discharged" : "Active"}
                          </span>
                          <span className="text-xs text-gray-400">
                            {formatDistanceToNow(new Date(r.consultedAt), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-200 group-hover:text-green-600 transition-colors" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
