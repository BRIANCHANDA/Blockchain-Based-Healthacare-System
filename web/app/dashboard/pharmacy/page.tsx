"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { visitApi, pharmacyStatsApi } from "@/lib/api";
import {
  Package,
  Pill,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  ArrowRight,
  RefreshCw,
  ClipboardList,
  History,
  BarChart3,
} from "lucide-react";
import { format } from "date-fns";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import {
  KpiCard,
  Panel,
  PanelHeader,
  SkeletonRow,
  EmptyState,
  PageHeading,
} from "@/components/dashboard/primitives";

const MED_COLORS = ["#166534", "#16a34a", "#22c55e", "#4ade80", "#86efac"];

function timeSince(dateStr: string) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function PharmacyOverviewPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [pending, setPending] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const [pendingRes, statsRes] = await Promise.allSettled([
        (visitApi as any).getPendingPrescriptions(),
        pharmacyStatsApi.getOverview(),
      ]);

      if (pendingRes.status === "fulfilled") {
        setPending(pendingRes.value.data.data?.prescriptions ?? []);
      }
      if (statsRes.status === "fulfilled") {
        setStats(statsRes.value.data.data);
      }
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(() => load(true), 60_000);
    return () => clearInterval(iv);
  }, [load]);

  const longWaiting = pending.filter(
    (p) =>
      Date.now() - new Date(p.prescribedAt ?? p.prescribed_at).getTime() >
      30 * 60 * 1000,
  ).length;

  const totalPending = pending.length;
  const dispensedToday = stats?.dispensedToday ?? 0;
  const avgWaitMins = stats?.avgWaitMinutes ?? 0;

  /*
   * The weekly query selects COUNT(*) without an ::int cast, so Postgres
   * returns bigint and the driver hands back strings. Recharts needs numbers
   * for the Y scale, so coerce rather than plotting silently-broken axes.
   */
  const weekly = (stats?.weeklyActivity ?? []).map((d: any) => ({
    ...d,
    prescribed: Number(d.prescribed ?? 0),
    dispensed: Number(d.dispensed ?? 0),
  }));

  const topMeds = (stats?.topMedications ?? []).map((m: any) => ({
    ...m,
    count: Number(m.count ?? 0),
  }));

  return (
    <div className="w-full max-w-[1280px] mx-auto pb-8">
      <PageHeading
        eyebrow="Pharmacy"
        title={(user as any)?.institutionName || "Pharmacy"}
        actions={
          <>
            <button
              onClick={() => router.push("/dashboard/pharmacy/queue")}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-[13px] font-semibold shadow-sm transition-colors"
            >
              <Pill className="w-3.5 h-3.5" />
              Dispense Queue
            </button>

            <button
              onClick={() => router.push("/dashboard/pharmacy/inventory")}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-emerald-200 text-slate-700 text-[13px] font-semibold transition-colors"
            >
              <Package className="w-3.5 h-3.5" />
              Inventory
            </button>

            <button
              onClick={() => load(true)}
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

      {/* Long-wait alert — the one thing on this page that demands action now. */}
      {!loading && longWaiting > 0 && (
        <button
          onClick={() => router.push("/dashboard/pharmacy/queue")}
          className="w-full flex items-center gap-3 p-4 rounded-2xl mb-5 bg-amber-50 border border-amber-200 text-left hover:bg-amber-100/60 transition-colors"
        >
          <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <p className="text-[13px] font-semibold text-amber-800 flex-1">
            {longWaiting} prescription{longWaiting > 1 ? "s have" : " has"} been
            waiting over 30 minutes
          </p>
          <span className="text-[13px] font-bold text-amber-700 flex items-center gap-1 whitespace-nowrap">
            Dispense now <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </button>
      )}

      {/* KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Pending Rx"
          value={loading ? undefined : totalPending}
          description="Awaiting dispensing"
          icon={Pill}
          iconClass="bg-amber-50 text-amber-600"
          href="/dashboard/pharmacy/queue"
        />
        <KpiCard
          label="Dispensed Today"
          value={loading ? undefined : dispensedToday}
          description="Completed"
          icon={CheckCircle2}
          iconClass="bg-emerald-50 text-emerald-600"
          href="/dashboard/pharmacy/dispensed"
        />
        <KpiCard
          label="Average Wait"
          value={loading ? undefined : avgWaitMins > 0 ? `${avgWaitMins}m` : "—"}
          description="Prescription to dispense"
          icon={Clock}
          iconClass="bg-blue-50 text-blue-600"
        />
        <KpiCard
          label="Long Waiting"
          value={loading ? undefined : longWaiting}
          description="Over 30 minutes"
          icon={AlertCircle}
          iconClass="bg-red-50 text-red-600"
        />
      </section>

      {/* Charts */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Panel className="lg:col-span-2">
          <PanelHeader title="Weekly Activity" icon={BarChart3} />
          <div className="px-2 py-4" style={{ height: 232 }}>
            {loading ? (
              <div className="h-full mx-3 rounded-xl bg-slate-50 animate-pulse" />
            ) : weekly.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={weekly}
                  margin={{ top: 4, right: 12, left: -22, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="prescribedFill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#d97706" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#d97706" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient
                      id="dispensedFill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
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
                      v ? format(new Date(v), "MMM d") : v
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="prescribed"
                    name="Prescribed"
                    stroke="#d97706"
                    fill="url(#prescribedFill)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="dispensed"
                    name="Dispensed"
                    stroke="#166534"
                    fill="url(#dispensedFill)"
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
          <PanelHeader title="Top Medications" icon={Pill} />
          <div className="px-2 py-4" style={{ height: 232 }}>
            {loading ? (
              <div className="h-full mx-3 rounded-xl bg-slate-50 animate-pulse" />
            ) : topMeds.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topMeds}
                  layout="vertical"
                  margin={{ top: 2, right: 16, left: 6, bottom: 2 }}
                >
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="medicationName"
                    tick={{ fontSize: 10, fill: "#6b7280" }}
                    axisLine={false}
                    tickLine={false}
                    width={92}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #eaecf0",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={16}>
                    {topMeds.map((_: any, i: number) => (
                      <Cell key={i} fill={MED_COLORS[i % MED_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-[13px] text-slate-400">
                No dispenses in the last 7 days
              </div>
            )}
          </div>
        </Panel>
      </section>

      {/* Queue + quick actions */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel className="lg:col-span-2">
          <PanelHeader
            title="Pending Prescriptions"
            icon={ClipboardList}
            action={totalPending > 0 ? "View all" : undefined}
            onAction={
              totalPending > 0
                ? () => router.push("/dashboard/pharmacy/queue")
                : undefined
            }
          />

          {loading ? (
            [...Array(4)].map((_, i) => <SkeletonRow key={i} />)
          ) : pending.length === 0 ? (
            <EmptyState icon={CheckCircle2} message="No pending prescriptions." />
          ) : (
            <>
              {pending.slice(0, 6).map((rx: any, index: number) => {
                const prescribedAt = rx.prescribedAt ?? rx.prescribed_at;
                const isOld =
                  Date.now() - new Date(prescribedAt).getTime() >
                  30 * 60 * 1000;
                const rxNum = rx.prescriptionNumber ?? rx.prescription_number;
                const visitNum = rx.visitNumber ?? rx.visit_number;
                const patientName =
                  rx.patientName ?? rx.patient_name ?? "Unknown Patient";
                const pendingItems = rx.pendingItems ?? rx.pending_items ?? 0;
                const totalItems = rx.totalItems ?? rx.total_items ?? 0;

                return (
                  <button
                    key={rx.id}
                    onClick={() =>
                      router.push(`/dashboard/pharmacy/queue/${rx.id}`)
                    }
                    className={`w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-50 transition-colors group ${
                      index < Math.min(pending.length, 6) - 1
                        ? "border-b border-slate-50"
                        : ""
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isOld
                          ? "bg-amber-50 text-amber-600"
                          : "bg-emerald-50 text-emerald-600"
                      }`}
                    >
                      <Pill className="w-4 h-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[13px] font-semibold text-slate-800 truncate">
                          {patientName}
                        </p>
                        <span className="text-[11.5px] font-mono text-slate-400">
                          {rxNum}
                        </span>
                        {isOld && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                            Waiting long
                          </span>
                        )}
                      </div>

                      <p className="text-[12.5px] text-slate-400 mt-0.5 truncate">
                        {visitNum} · {pendingItems} of {totalItems} item
                        {totalItems !== 1 ? "s" : ""} pending
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[11.5px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {timeSince(prescribedAt)}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-600 transition-colors" />
                    </div>
                  </button>
                );
              })}

              {pending.length > 6 && (
                <button
                  onClick={() => router.push("/dashboard/pharmacy/queue")}
                  className="w-full py-3 text-[12.5px] font-semibold text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5 border-t border-slate-50"
                >
                  +{pending.length - 6} more
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="Quick Actions" icon={ArrowRight} />
          <div className="p-3 space-y-2">
            {[
              {
                label: "Dispense Queue",
                href: "/dashboard/pharmacy/queue",
                icon: Pill,
                cls: "bg-emerald-50 text-emerald-600",
              },
              {
                label: "Dispense History",
                href: "/dashboard/pharmacy/dispensed",
                icon: History,
                cls: "bg-blue-50 text-blue-600",
              },
              {
                label: "Inventory",
                href: "/dashboard/pharmacy/inventory",
                icon: Package,
                cls: "bg-violet-50 text-violet-600",
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
      </section>
    </div>
  );
}
