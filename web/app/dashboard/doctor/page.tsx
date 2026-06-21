"use client";
import { useEffect, useState, useCallback } from "react";
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
  AlertCircle,
  Hourglass,
  Scan,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";

// ── Types ─────────────────────────────────────────────────────────────────────
interface TodayStats {
  total: number;
  triaged: number;
  completed: number;
  critical: number;
  urgent: number;
  activePatients: number;
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
  patient: { firstName: string; lastName: string } | null;
}

// assigned-to-me returns flat fields, not nested patient object
interface QueueVisit {
  id: string;
  visitNumber: string;
  chiefComplaint: string;
  priority: string;
  status: string;
  admissionDate: string;
  hasConsultation: boolean;
  pendingLabCount: number;
  pendingImagingCount: number;
  // Flat fields from assigned-to-me practitioner branch
  patientName: string;
  gender: string;
  bloodType: string;
}

// ── Config ────────────────────────────────────────────────────────────────────
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

const BLOOD_COLORS: Record<string, string> = {
  "A+": "#3b82f6",
  "A-": "#6366f1",
  "B+": "#8b5cf6",
  "B-": "#ec4899",
  "AB+": "#f59e0b",
  "AB-": "#ef4444",
  "O+": "#10b981",
  "O-": "#14b8a6",
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

// Get initials from flat patientName string e.g. "John Doe" → "JD"
function getInitials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

// ── Pending result card ───────────────────────────────────────────────────────
function PendingResultCard({
  visit,
  onClick,
}: {
  visit: QueueVisit;
  onClick: () => void;
}) {
  const p = getP(visit.priority);
  const totalPending = visit.pendingLabCount + visit.pendingImagingCount;
  const waitMins = Math.floor(
    (Date.now() - new Date(visit.admissionDate).getTime()) / 60_000,
  );
  const waitStr =
    waitMins > 60
      ? `${Math.floor(waitMins / 60)}h ${waitMins % 60}m`
      : `${waitMins}m`;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left hover:bg-gray-50/80 transition-colors group"
    >
      <div className="relative flex-shrink-0">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold"
          style={{ background: p.bg, color: p.color }}
        >
          {getInitials(visit.patientName)}
        </div>
        <div
          className="absolute -top-1 -right-1 min-w-[18px] px-1 h-[18px] rounded-full flex items-center justify-center font-bold text-white"
          style={{ background: "#f59e0b", fontSize: "9px" }}
        >
          {totalPending}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">
          {visit.patientName}
        </p>
        <p className="text-xs text-gray-400 truncate mt-0.5">
          {visit.chiefComplaint}
        </p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {visit.pendingLabCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
              <FlaskConical className="w-2.5 h-2.5" /> {visit.pendingLabCount}{" "}
              lab
            </span>
          )}
          {visit.pendingImagingCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100">
              <Scan className="w-2.5 h-2.5" /> {visit.pendingImagingCount}{" "}
              imaging
            </span>
          )}
          <span className="text-[10px] text-gray-400 flex items-center gap-1 ml-auto">
            <Clock className="w-2.5 h-2.5" /> {waitStr}
          </span>
        </div>
      </div>

      <ChevronRight className="w-4 h-4 text-gray-200 group-hover:text-amber-500 transition-colors flex-shrink-0" />
    </button>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function DoctorOverview() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [stats, setStats] = useState<TodayStats | null>(null);
  const [activity, setActivity] = useState<ActivityStats | null>(null);
  const [recentPatients, setRecentPatients] = useState<RecentPatient[]>([]);
  const [queue, setQueue] = useState<QueueVisit[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get("/api/doctor/stats");
      const d = res.data.data;
      setStats(d.today);
      setActivity(d.activity);
      setRecentPatients(d.recentPatients ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? "Failed to load stats");
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const fetchQueue = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    try {
      const res = await api.get("/api/visits/assigned-to-me");
      // assigned-to-me returns an array directly in data
      const raw: any[] = res.data?.data ?? [];
      const sorted = [...raw].sort((a, b) => {
        const order: Record<string, number> = {
          critical: 0,
          emergency: 1,
          urgent: 2,
          routine: 3,
        };
        const po = (order[a.priority] ?? 9) - (order[b.priority] ?? 9);
        return po !== 0
          ? po
          : new Date(a.admissionDate).getTime() -
              new Date(b.admissionDate).getTime();
      });
      setQueue(sorted as QueueVisit[]);
    } catch (err: any) {
      if (!silent)
        setError(err?.response?.data?.error?.message ?? "Failed to load queue");
    } finally {
      setLoadingQueue(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchQueue();
    const iv = setInterval(() => fetchQueue(true), 30_000);
    return () => clearInterval(iv);
  }, [fetchStats, fetchQueue]);

  // Derived
  const pendingConsultCount = queue.filter((v) => !v.hasConsultation).length;
  const waitingForResults = queue.filter(
    (v) =>
      v.hasConsultation && (v.pendingLabCount > 0 || v.pendingImagingCount > 0),
  );
  const totalPendingResults = waitingForResults.reduce(
    (s, v) => s + v.pendingLabCount + v.pendingImagingCount,
    0,
  );

  const caseloadByPriority = ["critical", "emergency", "urgent", "routine"]
    .map((key) => ({
      key,
      label: getP(key).label,
      value: queue.filter((v) => v.priority === key).length,
      color: getP(key).dot,
    }))
    .filter((d) => d.value > 0);

  function Skel({ color }: { color: string }) {
    return (
      <span
        className="inline-block w-8 h-7 rounded-lg animate-pulse"
        style={{ background: `${color}18` }}
      />
    );
  }

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl border flex items-center gap-3 bg-red-50 border-red-100 text-red-800">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <p className="text-sm font-medium flex-1">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-sm font-semibold hover:opacity-70"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Hero */}
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
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-green-300/70 text-sm font-medium mb-1">
              {greeting()}, Dr.
            </p>
            <h1
              className="text-white text-2xl font-bold"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {user?.firstName} {user?.lastName}
            </h1>
            <p className="text-green-200/50 text-sm mt-1.5">
              {format(new Date(), "EEEE, d MMMM yyyy")}
              {stats?.total ? (
                <>
                  {" "}
                  ·{" "}
                  <span className="text-green-200/80">
                    {stats.total} patients today
                  </span>
                </>
              ) : null}
              {stats?.critical ? (
                <>
                  {" "}
                  ·{" "}
                  <span className="text-red-300">
                    {stats.critical} critical
                  </span>
                </>
              ) : null}
            </p>
          </div>
          <div className="flex gap-2.5 flex-wrap">
            <button
              onClick={() => router.push("/dashboard/doctor/queue")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{
                background: "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.2)",
              }}
            >
              <ClipboardList className="w-4 h-4" /> Today's Queue
            </button>
            <button
              onClick={() => router.push("/dashboard/doctor/patients")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
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

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        {[
          {
            label: "Active Patients",
            value: stats?.activePatients,
            sub: "currently in my care",
            color: "#0369a1",
            bg: "linear-gradient(135deg,#f0f9ff,#e0f2fe)",
            border: "#bae6fd",
            icon: Stethoscope,
          },
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
            sub: "ready for consult",
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
        ].map(({ label, value, sub, color, bg, border, icon: Icon }) => (
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
              {loadingStats ? <Skel color={color} /> : (value ?? 0)}
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

      {/* Activity strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
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
        ].map(({ label, value, color, icon: Icon }) => (
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

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Quick actions */}
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
            Quick Actions
          </p>
          {[
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
          ].map(({ label, desc, href, icon: Icon, color, bg, border }) => (
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

          {/* Caseload by priority */}
          {!loadingQueue && caseloadByPriority.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mt-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
                Caseload by Priority
              </p>
              <div className="flex items-center gap-3">
                <div className="w-24 h-24 flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={caseloadByPriority}
                        dataKey="value"
                        nameKey="label"
                        innerRadius={28}
                        outerRadius={42}
                        strokeWidth={0}
                      >
                        {caseloadByPriority.map((d) => (
                          <Cell key={d.key} fill={d.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: any, n: any) => [`${v} patients`, n]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-1.5 min-w-0">
                  {caseloadByPriority.map((d) => (
                    <div key={d.key} className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: d.color }}
                      />
                      <span className="text-xs text-gray-600 flex-1 truncate">
                        {d.label}
                      </span>
                      <span className="text-xs font-bold text-gray-900">
                        {d.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Waiting for results */}
          {(loadingQueue || waitingForResults.length > 0) && (
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    Waiting for Results
                  </p>
                  {!loadingQueue && totalPendingResults > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                      {totalPendingResults} pending
                    </span>
                  )}
                </div>
                {refreshing && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
                )}
              </div>

              <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2.5 px-4 py-3 border-b border-amber-50 bg-amber-50/50">
                  <Hourglass className="w-4 h-4 text-amber-500" />
                  <p className="text-xs font-semibold text-amber-700">
                    Consulted — awaiting lab or imaging results before further
                    action
                  </p>
                </div>

                {loadingQueue ? (
                  <div className="divide-y divide-gray-50">
                    {[...Array(3)].map((_, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-4 px-5 py-4 animate-pulse"
                      >
                        <div className="w-10 h-10 rounded-xl bg-gray-100 flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3.5 w-28 bg-gray-100 rounded" />
                          <div className="h-3 w-40 bg-gray-100 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {waitingForResults.map((v) => (
                      <PendingResultCard
                        key={v.id}
                        visit={v}
                        onClick={() =>
                          router.push(`/dashboard/doctor/visit/${v.id}`)
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Live queue — only visits needing consult */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  Live Queue
                </p>
                {!loadingQueue && pendingConsultCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-600 border border-red-100">
                    {pendingConsultCount} need consult
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchQueue(true)}
                  disabled={refreshing || loadingQueue}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all disabled:opacity-40"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
                  />
                </button>
                <button
                  onClick={() => router.push("/dashboard/doctor/queue")}
                  className="text-xs font-semibold flex items-center gap-1 hover:opacity-70"
                  style={{ color: "#166634" }}
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
              ) : queue.filter((v) => !v.hasConsultation).length === 0 ? (
                <div className="py-16 text-center">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{ background: "#f0fdf4" }}
                  >
                    <TrendingUp className="w-6 h-6 text-green-400" />
                  </div>
                  <p className="text-sm font-semibold text-gray-500">
                    No patients needing consult
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {waitingForResults.length > 0
                      ? `${waitingForResults.length} patient${waitingForResults.length !== 1 ? "s" : ""} waiting for results above`
                      : "All caught up for now"}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {queue
                    .filter((v) => !v.hasConsultation)
                    .slice(0, 6)
                    .map((visit, idx) => {
                      const p = getP(visit.priority);
                      const isCrit = ["critical", "emergency"].includes(
                        visit.priority,
                      );
                      return (
                        <button
                          key={visit.id}
                          onClick={() =>
                            router.push(`/dashboard/doctor/visit/${visit.id}`)
                          }
                          className="w-full flex items-center gap-4 px-5 py-3.5 text-left hover:bg-gray-50/80 transition-all group"
                          style={{
                            background:
                              isCrit && idx === 0 ? `${p.dot}06` : undefined,
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
                              {getInitials(visit.patientName)}
                            </div>
                            {isCrit && idx === 0 && (
                              <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                                <span
                                  className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-50"
                                  style={{ background: p.dot }}
                                />
                                <span
                                  className="relative inline-flex rounded-full h-3 w-3"
                                  style={{ background: p.dot }}
                                />
                              </span>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-gray-900 truncate">
                                {visit.patientName}
                              </p>
                              {visit.bloodType &&
                                visit.bloodType !== "unknown" && (
                                  <span
                                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white flex-shrink-0"
                                    style={{
                                      background:
                                        BLOOD_COLORS[visit.bloodType] ??
                                        "#6b7280",
                                    }}
                                  >
                                    {visit.bloodType}
                                  </span>
                                )}
                            </div>
                            <p className="text-xs text-gray-400 truncate mt-0.5">
                              {visit.chiefComplaint}
                            </p>
                          </div>

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
                            <span className="text-xs text-amber-600 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />{" "}
                              Needs consult
                            </span>
                          </div>

                          <ChevronRight className="w-4 h-4 text-gray-200 group-hover:text-green-600 transition-colors flex-shrink-0" />
                        </button>
                      );
                    })}

                  {waitingForResults.length > 0 && (
                    <div className="px-5 py-3 bg-amber-50/60 border-t border-amber-100 flex items-center gap-2">
                      <Hourglass className="w-3.5 h-3.5 text-amber-500" />
                      <p className="text-xs text-amber-700 font-medium">
                        {waitingForResults.length} visit
                        {waitingForResults.length !== 1 ? "s" : ""} waiting for
                        results — shown above
                      </p>
                    </div>
                  )}

                  {queue.filter((v) => !v.hasConsultation).length > 6 && (
                    <button
                      onClick={() => router.push("/dashboard/doctor/queue")}
                      className="w-full flex items-center justify-center gap-2 px-5 py-3.5 text-sm font-semibold hover:bg-gray-50 transition-colors"
                      style={{ color: "#166534" }}
                    >
                      View {queue.filter((v) => !v.hasConsultation).length - 6}{" "}
                      more <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Recently consulted */}
          {recentPatients.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2.5">
                Recently Consulted
              </p>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="divide-y divide-gray-50">
                  {recentPatients.map((r) => {
                    const p = getP(r.priority);
                    const name = r.patient
                      ? `${r.patient.firstName} ${r.patient.lastName}`
                      : "Unknown";
                    const ini = r.patient
                      ? `${r.patient.firstName?.[0] ?? ""}${r.patient.lastName?.[0] ?? ""}`
                      : "?";
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
                          {ini.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">
                            {name}
                          </p>
                          <p className="text-xs text-gray-400 truncate">
                            {r.chiefComplaint}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span
                            className="text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{
                              background:
                                r.status === "completed"
                                  ? "#f0fdf4"
                                  : "#eff6ff",
                              color:
                                r.status === "completed"
                                  ? "#166534"
                                  : "#1d4ed8",
                            }}
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
