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
  Calendar,
  FlaskConical,
  RefreshCw,
  AlertCircle,
  Hourglass,
  Scan,
  QrCode,
  CheckCircle2,
  ArrowRight,
  PieChart as PieIcon,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import {
  KpiCard,
  Panel,
  PanelHeader,
  SkeletonRow,
  EmptyState,
  PageHeading,
} from "@/components/dashboard/primitives";

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
interface TrendPoint {
  date: string;
  consultations: number;
  labOrders: number;
  imagingOrders: number;
  prescriptions: number;
}
interface FunnelStage {
  stage: string;
  count: number;
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

// assigned-to-me returns flat fields, not a nested patient object
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
  patientName: string;
  gender: string;
  bloodType: string;
}

// ── Config ────────────────────────────────────────────────────────────────────
const PC: Record<string, { color: string; bg: string; label: string }> = {
  critical: { color: "#dc2626", bg: "#fef2f2", label: "Critical" },
  emergency: { color: "#ea580c", bg: "#fff7ed", label: "Emergency" },
  urgent: { color: "#d97706", bg: "#fffbeb", label: "Urgent" },
  routine: { color: "#16a34a", bg: "#f0fdf4", label: "Routine" },
};
const getP = (p: string) => PC[p] ?? PC.routine;

// The four measures plotted on the 30-day output chart.
const SERIES = [
  { key: "consultations", label: "Consults", color: "#166534" },
  { key: "labOrders", label: "Lab", color: "#0369a1" },
  { key: "imagingOrders", label: "Imaging", color: "#7c3aed" },
  { key: "prescriptions", label: "Rx", color: "#d97706" },
] as const;

// Progressively cooler as a patient moves through to discharge.
const FUNNEL_COLORS = ["#0369a1", "#1d4ed8", "#166534", "#7c3aed"];

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

/* -------------------------------------------------------------------------- */
/* Rows                                                                       */
/* -------------------------------------------------------------------------- */

function PendingResultRow({
  visit,
  isLast,
  onClick,
}: {
  visit: QueueVisit;
  isLast: boolean;
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
      className={`w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-50 transition-colors group ${
        isLast ? "" : "border-b border-slate-50"
      }`}
    >
      <div className="relative flex-shrink-0">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-[12.5px] font-bold"
          style={{ background: p.bg, color: p.color }}
        >
          {getInitials(visit.patientName)}
        </div>
        <div className="absolute -top-1 -right-1 min-w-[18px] px-1 h-[18px] rounded-full flex items-center justify-center font-bold text-white bg-amber-500 text-[9px]">
          {totalPending}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-slate-800 truncate">
          {visit.patientName}
        </p>
        <p className="text-[12.5px] text-slate-400 truncate mt-0.5">
          {visit.chiefComplaint}
        </p>

        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {visit.pendingLabCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
              <FlaskConical className="w-2.5 h-2.5" /> {visit.pendingLabCount}{" "}
              lab
            </span>
          )}
          {visit.pendingImagingCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100">
              <Scan className="w-2.5 h-2.5" /> {visit.pendingImagingCount}{" "}
              imaging
            </span>
          )}
          <span className="text-[11px] text-slate-400 flex items-center gap-1 ml-auto">
            <Clock className="w-2.5 h-2.5" /> {waitStr}
          </span>
        </div>
      </div>

      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 transition-colors flex-shrink-0" />
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Overview                                                                   */
/* -------------------------------------------------------------------------- */

export default function DoctorOverview() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [stats, setStats] = useState<TodayStats | null>(null);
  const [activity, setActivity] = useState<ActivityStats | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [funnel, setFunnel] = useState<FunnelStage[]>([]);
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
      setTrend(d.trend ?? []);
      setFunnel(d.funnel ?? []);
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
  const pendingConsult = queue.filter((v) => !v.hasConsultation);
  const waitingForResults = queue.filter(
    (v) =>
      v.hasConsultation && (v.pendingLabCount > 0 || v.pendingImagingCount > 0),
  );
  const totalPendingResults = waitingForResults.reduce(
    (s, v) => s + v.pendingLabCount + v.pendingImagingCount,
    0,
  );

  // An all-zero series would render as a flat line pinned to the axis, which
  // reads as a broken chart rather than a quiet month.
  const hasTrendData = trend.some(
    (d) => d.consultations + d.labOrders + d.imagingOrders + d.prescriptions > 0,
  );

  const caseloadByPriority = ["critical", "emergency", "urgent", "routine"]
    .map((key) => ({
      key,
      label: getP(key).label,
      value: queue.filter((v) => v.priority === key).length,
      color: getP(key).color,
    }))
    .filter((d) => d.value > 0);

  return (
    <div className="w-full max-w-[1280px] mx-auto pb-8">
      {error && (
        <div className="mb-4 px-4 py-3 rounded-2xl border flex items-center gap-3 bg-red-50 border-red-200 text-red-800">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <p className="text-[13px] font-medium flex-1">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-[13px] font-semibold hover:opacity-70"
          >
            Dismiss
          </button>
        </div>
      )}

      <PageHeading
        eyebrow="Clinical"
        title={`Dr. ${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim()}
        actions={
          <>
            <button
              onClick={() => router.push("/dashboard/doctor/queue")}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-[13px] font-semibold shadow-sm transition-colors"
            >
              <ClipboardList className="w-3.5 h-3.5" />
              Today's Queue
            </button>

            <button
              onClick={() => router.push("/dashboard/doctor/patients")}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-emerald-200 text-slate-700 text-[13px] font-semibold transition-colors"
            >
              <Users className="w-3.5 h-3.5" />
              Patients
            </button>

            <button
              onClick={() => fetchQueue(true)}
              disabled={refreshing || loadingQueue}
              className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
              />
            </button>
          </>
        }
      />

      {/* KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
        <KpiCard
          label="In My Care"
          value={loadingStats ? undefined : stats?.activePatients}
          description="Active patients"
          icon={Stethoscope}
          iconClass="bg-blue-50 text-blue-600"
          href="/dashboard/doctor/patients"
        />
        <KpiCard
          label="Today"
          value={loadingStats ? undefined : stats?.total}
          description="Registered visits"
          icon={Calendar}
          iconClass="bg-emerald-50 text-emerald-600"
        />
        <KpiCard
          label="Awaiting Me"
          value={loadingStats ? undefined : stats?.triaged}
          description="Ready for consult"
          icon={Clock}
          iconClass="bg-amber-50 text-amber-600"
          href="/dashboard/doctor/queue"
        />
        <KpiCard
          label="Discharged"
          value={loadingStats ? undefined : stats?.completed}
          description="Completed today"
          icon={CheckCircle2}
          iconClass="bg-violet-50 text-violet-600"
        />
        <KpiCard
          label="Critical / Urgent"
          value={
            loadingStats
              ? undefined
              : (stats?.critical ?? 0) + (stats?.urgent ?? 0)
          }
          description="Highest priority"
          icon={AlertTriangle}
          iconClass="bg-red-50 text-red-600"
        />
      </section>

      {/* Workflow: output over time, and where today's patients are */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Panel className="lg:col-span-2">
          <PanelHeader
            title="My Output · 30 Days"
            icon={Activity}
            meta={
              /* The legend doubles as today's tally, so the four "today"
                 counters it replaced are still readable at a glance. */
              <div className="hidden sm:flex items-center gap-3.5">
                {SERIES.map((s) => (
                  <span key={s.key} className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: s.color }}
                    />
                    <span className="text-[11px] text-slate-500">{s.label}</span>
                    <span
                      className="text-[11.5px] font-bold"
                      style={{ color: s.color }}
                    >
                      {loadingStats
                        ? "·"
                        : ((activity?.[s.key] ?? 0) as number)}
                    </span>
                  </span>
                ))}
              </div>
            }
          />

          <div className="px-2 py-4" style={{ height: 224 }}>
            {loadingStats ? (
              <div className="h-full mx-3 rounded-xl bg-slate-50 animate-pulse" />
            ) : hasTrendData ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={trend}
                  margin={{ top: 4, right: 12, left: -22, bottom: 0 }}
                >
                  <defs>
                    {SERIES.map((s) => (
                      <linearGradient
                        key={s.key}
                        id={`g-${s.key}`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor={s.color}
                          stopOpacity={0.26}
                        />
                        <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#f3f4f6"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) => format(new Date(v), "d MMM")}
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                    minTickGap={24}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                    width={38}
                  />
                  <Tooltip
                    labelFormatter={(v) => format(new Date(v), "EEE d MMM")}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #eaecf0",
                      fontSize: 12,
                    }}
                  />
                  {SERIES.map((s) => (
                    <Area
                      key={s.key}
                      type="monotone"
                      dataKey={s.key}
                      name={s.label}
                      stroke={s.color}
                      strokeWidth={2}
                      fill={`url(#g-${s.key})`}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center">
                <Activity className="w-6 h-6 text-slate-300 mb-2" />
                <p className="text-[13px] text-slate-400">
                  No recorded activity in the last 30 days
                </p>
              </div>
            )}
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Patient Flow · Today" icon={TrendingUp} />
          <div className="px-2 py-4" style={{ height: 224 }}>
            {loadingStats ? (
              <div className="h-full mx-3 rounded-xl bg-slate-50 animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={funnel}
                  layout="vertical"
                  margin={{ top: 2, right: 26, left: 6, bottom: 2 }}
                >
                  <XAxis type="number" hide allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="stage"
                    tick={{ fontSize: 10.5, fill: "#6b7280" }}
                    axisLine={false}
                    tickLine={false}
                    width={104}
                  />
                  <Tooltip
                    formatter={(v: any) => [`${v} patients`, ""]}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #eaecf0",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={18}>
                    {funnel.map((_, i) => (
                      <Cell
                        key={i}
                        fill={FUNNEL_COLORS[i % FUNNEL_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>
      </section>

      {/* Queues */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 space-y-4">
          {(loadingQueue || waitingForResults.length > 0) && (
            <Panel>
              <PanelHeader
                title="Awaiting Results"
                icon={Hourglass}
                meta={
                  !loadingQueue && totalPendingResults > 0 ? (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                      {totalPendingResults} pending
                    </span>
                  ) : undefined
                }
              />

              {loadingQueue
                ? [...Array(3)].map((_, i) => <SkeletonRow key={i} />)
                : waitingForResults.map((v, i) => (
                    <PendingResultRow
                      key={v.id}
                      visit={v}
                      isLast={i === waitingForResults.length - 1}
                      onClick={() =>
                        router.push(`/dashboard/doctor/visit/${v.id}`)
                      }
                    />
                  ))}
            </Panel>
          )}

          <Panel>
            <PanelHeader
              title="Live Queue"
              icon={ClipboardList}
              meta={
                !loadingQueue && pendingConsult.length > 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-600 border border-red-100">
                    {pendingConsult.length} need consult
                  </span>
                ) : undefined
              }
              action="See all"
              onAction={() => router.push("/dashboard/doctor/queue")}
            />

            {loadingQueue ? (
              [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
            ) : pendingConsult.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                message={
                  waitingForResults.length > 0
                    ? `No patients needing consult — ${waitingForResults.length} awaiting results above.`
                    : "No patients needing consult."
                }
              />
            ) : (
              pendingConsult.slice(0, 6).map((visit, idx) => {
                const p = getP(visit.priority);

                return (
                  <button
                    key={visit.id}
                    onClick={() =>
                      router.push(`/dashboard/doctor/visit/${visit.id}`)
                    }
                    className={`w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-50 transition-colors group ${
                      idx < Math.min(pendingConsult.length, 6) - 1
                        ? "border-b border-slate-50"
                        : ""
                    }`}
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-[12.5px] font-bold flex-shrink-0"
                      style={{ background: p.bg, color: p.color }}
                    >
                      {getInitials(visit.patientName)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[13px] font-semibold text-slate-800 truncate">
                          {visit.patientName}
                        </p>
                        <span
                          className="px-2 py-0.5 rounded-full text-[11px] font-bold"
                          style={{ background: p.bg, color: p.color }}
                        >
                          {p.label}
                        </span>
                      </div>

                      <p className="text-[12.5px] text-slate-400 truncate mt-0.5">
                        {visit.chiefComplaint || "No chief complaint recorded"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[11.5px] text-slate-400">
                        {visit.visitNumber}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-600" />
                    </div>
                  </button>
                );
              })
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Caseload by Priority" icon={PieIcon} />
            <div className="p-5">
              {loadingQueue ? (
                <div className="h-24 rounded-xl bg-slate-50 animate-pulse" />
              ) : caseloadByPriority.length === 0 ? (
                <p className="text-[13px] text-slate-400 text-center py-4">
                  No patients in your queue.
                </p>
              ) : (
                <div className="flex items-center gap-4">
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
                          contentStyle={{
                            borderRadius: 12,
                            border: "1px solid #eaecf0",
                            fontSize: 12,
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex-1 space-y-2 min-w-0">
                    {caseloadByPriority.map((d) => (
                      <div key={d.key} className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: d.color }}
                        />
                        <span className="text-[12.5px] text-slate-600 flex-1 truncate">
                          {d.label}
                        </span>
                        <span className="text-[13px] font-bold text-slate-900">
                          {d.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Quick Actions" icon={ArrowRight} />
            <div className="p-3 space-y-2">
              {[
                {
                  label: "Today's Queue",
                  href: "/dashboard/doctor/queue",
                  icon: ClipboardList,
                  cls: "bg-emerald-50 text-emerald-600",
                },
                {
                  label: "Patient Search",
                  href: "/dashboard/doctor/patients",
                  icon: Users,
                  cls: "bg-blue-50 text-blue-600",
                },
                {
                  label: "Scan Patient",
                  href: "/dashboard/doctor/scan",
                  icon: QrCode,
                  cls: "bg-violet-50 text-violet-600",
                },
                {
                  label: "New Visit",
                  href: "/dashboard/doctor/visit/new",
                  icon: FileText,
                  cls: "bg-amber-50 text-amber-600",
                },
              ].map(({ label, href, icon: Icon, cls }) => (
                <button
                  key={href}
                  onClick={() => router.push(href)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-200 text-left hover:border-emerald-200 hover:shadow-sm transition-all group"
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${cls}`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  <p className="flex-1 text-[13px] font-semibold text-slate-800">
                    {label}
                  </p>

                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 transition-colors" />
                </button>
              ))}
            </div>
          </Panel>
        </div>
      </section>

      {/* Recently consulted */}
      {recentPatients.length > 0 && (
        <section>
          <Panel>
            <PanelHeader title="Recently Consulted" icon={Stethoscope} />
            {recentPatients.map((r, i) => {
              const p = getP(r.priority);
              const name = r.patient
                ? `${r.patient.firstName} ${r.patient.lastName}`
                : "Unknown Patient";

              return (
                <button
                  key={r.visitId}
                  onClick={() =>
                    router.push(`/dashboard/doctor/visit/${r.visitId}`)
                  }
                  className={`w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-50 transition-colors group ${
                    i < recentPatients.length - 1
                      ? "border-b border-slate-50"
                      : ""
                  }`}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-[12.5px] font-bold flex-shrink-0"
                    style={{ background: p.bg, color: p.color }}
                  >
                    {getInitials(name)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-slate-800 truncate">
                      {name}
                    </p>
                    <p className="text-[12.5px] text-slate-400 truncate mt-0.5">
                      {r.chiefComplaint}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        r.status === "completed"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {r.status === "completed" ? "Completed" : "In progress"}
                    </span>

                    <span className="text-[11.5px] text-slate-400 hidden sm:inline">
                      {r.consultedAt
                        ? formatDistanceToNow(new Date(r.consultedAt), {
                            addSuffix: true,
                          })
                        : "—"}
                    </span>

                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-600" />
                  </div>
                </button>
              );
            })}
          </Panel>
        </section>
      )}
    </div>
  );
}
