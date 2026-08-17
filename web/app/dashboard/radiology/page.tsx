"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { visitApi, radiologyStatsApi } from "@/lib/api";
import {
  Scan,
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ArrowRight,
  Clock,
  RefreshCw,
  TrendingUp,
  Activity,
  Users,
  ScrollText,
} from "lucide-react";
import { format } from "date-fns";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  KpiCard,
  Panel,
  PanelHeader,
  SkeletonRow,
  EmptyState,
  PageHeading,
} from "@/components/dashboard/primitives";

const URGENCY: Record<string, { color: string; bg: string; label: string }> = {
  critical: { color: "#dc2626", bg: "#fef2f2", label: "Critical" },
  emergency: { color: "#ea580c", bg: "#fff7ed", label: "Emergency" },
  urgent: { color: "#d97706", bg: "#fffbeb", label: "Urgent" },
  routine: { color: "#16a34a", bg: "#f0fdf4", label: "Routine" },
};

const MODALITY: Record<string, { label: string; color: string; bg: string }> = {
  "x-ray": { label: "X-Ray", color: "#1d4ed8", bg: "#eff6ff" },
  ct_scan: { label: "CT Scan", color: "#7c3aed", bg: "#faf5ff" },
  mri: { label: "MRI", color: "#d97706", bg: "#fffbeb" },
  ultrasound: { label: "Ultrasound", color: "#166534", bg: "#f0fdf4" },
  pet_scan: { label: "PET Scan", color: "#dc2626", bg: "#fef2f2" },
  mammogram: { label: "Mammogram", color: "#0e7490", bg: "#ecfeff" },
  fluoroscopy: { label: "Fluoroscopy", color: "#374151", bg: "#f9fafb" },
};

const getU = (u: string) => URGENCY[u] ?? URGENCY.routine;
const getM = (m: string) =>
  MODALITY[m] ?? { label: m, color: "#374151", bg: "#f9fafb" };

function timeSince(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function formatTA(minutes: number) {
  if (!minutes) return "—";
  if (minutes >= 60) return `${(minutes / 60).toFixed(1)}h`;
  return `${minutes}m`;
}

// Normalize an order: handles both camelCase (Drizzle) and snake_case (raw SQL)
function normalizeOrder(o: any) {
  return {
    ...o,
    orderedAt: o.orderedAt ?? o.ordered_at ?? null,
    bodyPart: o.bodyPart ?? o.body_part ?? "",
    orderNumber: o.orderNumber ?? o.order_number ?? "",
    visitNumber: o.visitNumber ?? o.visit_number ?? "",
    chiefComplaint: o.chiefComplaint ?? o.chief_complaint ?? "",
  };
}

export default function RadiologyOverviewPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<any>(null);
  const [myStats, setMyStats] = useState<any>(null);
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [a, b, c] = await Promise.allSettled([
        radiologyStatsApi.getOverview(),
        radiologyStatsApi.getMyStats(),
        (visitApi as any).getPendingImagingOrders(),
      ]);
      if (a.status === "fulfilled") setStats(a.value.data.data);
      if (b.status === "fulfilled") setMyStats(b.value.data.data);
      if (c.status === "fulfilled") {
        const raw = c.value.data.data?.orders ?? [];
        setPending(raw.map(normalizeOrder));
      }
    } catch (_) {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const criticalCount = stats?.criticalCount ?? 0;
  const totalPending = stats?.totalPending ?? 0;
  const reportedToday = stats?.reportedToday ?? 0;
  const reportedWeek = stats?.reportedWeek ?? 0;

  const urgencyOrder: Record<string, number> = {
    critical: 0,
    emergency: 1,
    urgent: 2,
    routine: 3,
  };
  const sortedPending = [...pending].sort(
    (a, b) => (urgencyOrder[a.urgency] ?? 9) - (urgencyOrder[b.urgency] ?? 9),
  );

  // The overview endpoint already coerces these counts to numbers.
  const weekly = stats?.weeklyActivity ?? [];

  const byModality: Array<[string, number]> = Object.entries(
    stats?.pendingByModality ?? {},
  )
    .map(([k, v]) => [k, Number(v ?? 0)] as [string, number])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);

  const topModality =
    myStats?.modalityBreakdown && myStats.modalityBreakdown.length > 0
      ? getM(myStats.modalityBreakdown[0].modality).label
      : "—";

  return (
    <div className="w-full max-w-[1280px] mx-auto pb-8">
      <PageHeading
        eyebrow="Radiology"
        title={(user as any)?.institutionName || "Radiology"}
        actions={
          <>
            <button
              onClick={() => router.push("/dashboard/radiology/queue")}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-[13px] font-semibold shadow-sm transition-colors"
            >
              <Scan className="w-3.5 h-3.5" />
              Open Worklist
            </button>

            <button
              onClick={() => router.push("/dashboard/radiology/report")}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-emerald-200 text-slate-700 text-[13px] font-semibold transition-colors"
            >
              <ScrollText className="w-3.5 h-3.5" />
              My Report
            </button>

            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
              />
            </button>
          </>
        }
      />

      {!loading && criticalCount > 0 && (
        <button
          onClick={() => router.push("/dashboard/radiology/queue")}
          className="w-full flex items-center gap-3 p-4 rounded-2xl mb-5 bg-red-50 border border-red-200 text-left hover:bg-red-100/60 transition-colors"
        >
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-[13px] font-semibold text-red-800 flex-1">
            {criticalCount} stud{criticalCount > 1 ? "ies" : "y"} marked critical
            or urgent await reporting
          </p>
          <span className="text-[13px] font-bold text-red-700 flex items-center gap-1 whitespace-nowrap">
            Open worklist <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </button>
      )}

      {/* KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Pending Studies"
          value={loading ? undefined : totalPending}
          description="Awaiting a report"
          icon={Scan}
          iconClass="bg-amber-50 text-amber-600"
          href="/dashboard/radiology/queue"
        />
        <KpiCard
          label="Critical / Urgent"
          value={loading ? undefined : criticalCount}
          description="Need attention now"
          icon={AlertTriangle}
          iconClass="bg-red-50 text-red-600"
          href="/dashboard/radiology/queue"
        />
        <KpiCard
          label="Reported Today"
          value={loading ? undefined : reportedToday}
          description="Released to clinicians"
          icon={CheckCircle2}
          iconClass="bg-emerald-50 text-emerald-600"
        />
        <KpiCard
          label="Reported This Week"
          value={loading ? undefined : reportedWeek}
          description="Last 7 days"
          icon={TrendingUp}
          iconClass="bg-violet-50 text-violet-600"
        />
      </section>

      {/* Activity + modality mix */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Panel className="lg:col-span-2">
          <PanelHeader
            title="7-Day Activity"
            icon={Activity}
            meta={
              <div className="hidden sm:flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-[11px] text-slate-500">Ordered</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  <span className="text-[11px] text-slate-500">Reported</span>
                </span>
              </div>
            }
          />
          <div className="px-2 py-4" style={{ height: 224 }}>
            {loading ? (
              <div className="h-full mx-3 rounded-xl bg-slate-50 animate-pulse" />
            ) : weekly.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={weekly}
                  margin={{ top: 4, right: 12, left: -22, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="radOrdered" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#d97706" stopOpacity={0.24} />
                      <stop offset="100%" stopColor="#d97706" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="radReported" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#166534" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#166534" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#f3f4f6"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => (v ? format(new Date(v), "EEE") : v)}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                    width={38}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #eaecf0",
                      fontSize: 12,
                    }}
                    labelFormatter={(v) =>
                      v ? format(new Date(v), "EEE d MMM") : v
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="ordered"
                    name="Ordered"
                    stroke="#d97706"
                    fill="url(#radOrdered)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="reported"
                    name="Reported"
                    stroke="#166534"
                    fill="url(#radReported)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-[13px] text-slate-400">
                No activity in the last 7 days
              </div>
            )}
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Pending by Modality" icon={Scan} />
          <div className="p-3">
            {loading ? (
              <div className="h-40 rounded-xl bg-slate-50 animate-pulse" />
            ) : byModality.length === 0 ? (
              <p className="text-[13px] text-slate-400 text-center py-10">
                Nothing pending.
              </p>
            ) : (
              byModality.map(([mod, count]) => {
                const cfg = getM(mod);
                const pct = totalPending > 0 ? (count / totalPending) * 100 : 0;

                return (
                  <div key={mod} className="px-2 py-2">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: cfg.color }}
                      />
                      <p className="text-[12.5px] text-slate-600 flex-1 truncate">
                        {cfg.label}
                      </p>
                      <p className="text-[13px] font-bold text-slate-800">
                        {count}
                      </p>
                    </div>

                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: cfg.color }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Panel>
      </section>

      {/* Worklist + performance */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel className="lg:col-span-2">
          <PanelHeader
            title="Pending Worklist"
            icon={ClipboardList}
            action={sortedPending.length > 0 ? "View all" : undefined}
            onAction={
              sortedPending.length > 0
                ? () => router.push("/dashboard/radiology/queue")
                : undefined
            }
          />

          {loading ? (
            [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
          ) : sortedPending.length === 0 ? (
            <EmptyState icon={CheckCircle2} message="The worklist is clear." />
          ) : (
            <>
              {sortedPending.slice(0, 8).map((order: any, index: number) => {
                const u = getU(order.urgency);
                const m = getM(order.modality);

                return (
                  <button
                    key={order.id}
                    onClick={() =>
                      router.push(`/dashboard/radiology/queue/${order.id}`)
                    }
                    className={`w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-50 transition-colors group ${
                      index < Math.min(sortedPending.length, 8) - 1
                        ? "border-b border-slate-50"
                        : ""
                    }`}
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: m.bg }}
                    >
                      <Scan className="w-4 h-4" style={{ color: m.color }} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[13px] font-semibold text-slate-800 truncate">
                          {m.label}
                          {order.bodyPart ? ` · ${order.bodyPart}` : ""}
                        </p>
                        <span className="text-[11.5px] font-mono text-slate-400">
                          {order.orderNumber}
                        </span>
                      </div>

                      <p className="text-[12.5px] text-slate-400 mt-0.5 truncate">
                        {order.visitNumber}
                        {order.chiefComplaint ? ` · ${order.chiefComplaint}` : ""}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span
                        className="px-2 py-0.5 rounded-full text-[11px] font-bold"
                        style={{ background: u.bg, color: u.color }}
                      >
                        {u.label}
                      </span>

                      <span className="text-[11.5px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {timeSince(order.orderedAt)}
                        <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-emerald-600" />
                      </span>
                    </div>
                  </button>
                );
              })}

              {sortedPending.length > 8 && (
                <button
                  onClick={() => router.push("/dashboard/radiology/queue")}
                  className="w-full py-3 text-[12.5px] font-semibold text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5 border-t border-slate-50"
                >
                  +{sortedPending.length - 8} more
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel>
            <PanelHeader title="My Performance" icon={TrendingUp} />
            <div className="grid grid-cols-2 divide-x divide-y divide-slate-100">
              {[
                {
                  label: "This month",
                  value: myStats?.monthReports ?? 0,
                  cls: "text-emerald-700",
                },
                {
                  label: "Today",
                  value: myStats?.todayReports ?? 0,
                  cls: "text-blue-700",
                },
                {
                  label: "Avg turnaround",
                  value: formatTA(myStats?.avgTurnaroundMinutes ?? 0),
                  cls: "text-violet-700",
                },
                {
                  label: "Top modality",
                  value: topModality,
                  cls: "text-amber-700",
                },
              ].map(({ label, value, cls }) => (
                <div key={label} className="p-4">
                  <p
                    className={`text-[20px] font-bold leading-none truncate ${cls}`}
                  >
                    {loading ? "—" : value}
                  </p>
                  <p className="text-[11.5px] text-slate-400 mt-1.5">{label}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Quick Actions" icon={ArrowRight} />
            <div className="p-3 space-y-2">
              {[
                {
                  label: "Worklist",
                  href: "/dashboard/radiology/queue",
                  icon: Scan,
                  cls: "bg-amber-50 text-amber-600",
                },
                {
                  label: "Patients",
                  href: "/dashboard/radiology/patients",
                  icon: Users,
                  cls: "bg-blue-50 text-blue-600",
                },
                {
                  label: "My Report",
                  href: "/dashboard/radiology/report",
                  icon: ScrollText,
                  cls: "bg-emerald-50 text-emerald-600",
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
    </div>
  );
}
