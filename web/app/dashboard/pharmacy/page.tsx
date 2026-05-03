"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { visitApi, pharmacyStatsApi } from "@/lib/api";
import {
  Pill,
  Clock,
  CheckCircle2,
  TrendingUp,
  ChevronRight,
  RefreshCw,
  ArrowUpRight,
  Timer,
  Package,
  AlertCircle,
  Activity,
  BarChart3,
  Zap,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<
  string,
  { color: string; bg: string; border: string; label: string }
> = {
  prescribed: {
    color: "#b45309",
    bg: "#fffbeb",
    border: "#fde68a",
    label: "Prescribed",
  },
  dispensing: {
    color: "#1d4ed8",
    bg: "#eff6ff",
    border: "#bfdbfe",
    label: "Dispensing",
  },
  dispensed: {
    color: "#15803d",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    label: "Dispensed",
  },
  administered: {
    color: "#6d28d9",
    bg: "#faf5ff",
    border: "#e9d5ff",
    label: "Administered",
  },
  discontinued: {
    color: "#6b7280",
    bg: "#f9fafb",
    border: "#e5e7eb",
    label: "Discontinued",
  },
  cancelled: {
    color: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca",
    label: "Cancelled",
  },
};

// ── Stat Card (mirrors receptionist StatCard) ─────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  bg,
  border,
  onClick,
  loading,
}: {
  icon: any;
  label: string;
  value: number | string;
  sub?: string;
  color: string;
  bg: string;
  border: string;
  onClick?: () => void;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative text-left rounded-2xl p-5 border overflow-hidden transition-all group
        ${onClick ? "hover:shadow-lg hover:-translate-y-0.5 cursor-pointer" : "cursor-default"}`}
      style={{ background: bg, borderColor: border }}
    >
      {/* Decorative circle */}
      <div
        className="absolute -right-4 -bottom-4 w-20 h-20 rounded-full opacity-10"
        style={{ background: color }}
      />

      <div className="flex items-start justify-between mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{
            background: "rgba(255,255,255,0.75)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          <Icon size={18} style={{ color }} />
        </div>
        {onClick && (
          <ArrowUpRight
            size={15}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ color }}
          />
        )}
      </div>

      <p className="text-3xl font-extrabold leading-none" style={{ color }}>
        {loading ? (
          <span className="inline-block w-10 h-7 rounded-lg bg-black/5 animate-pulse" />
        ) : (
          value
        )}
      </p>
      <p className="text-sm font-semibold text-gray-700 mt-1">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </button>
  );
}

// ── Pending Row ───────────────────────────────────────────────────────────────
function PendingRow({ rx, onOpen }: { rx: any; onOpen: (id: string) => void }) {
  const cfg = STATUS_CONFIG[rx.status] ?? STATUS_CONFIG.prescribed;
  const waited = formatDistanceToNow(new Date(rx.prescribed_at), {
    addSuffix: true,
  });
  const isOld =
    Date.now() - new Date(rx.prescribed_at).getTime() > 30 * 60 * 1000;

  return (
    <div className="flex items-center gap-4 px-5 py-3.5 border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors group">
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: isOld ? "#fef2f2" : "#f0fdf4" }}
      >
        <Pill size={15} style={{ color: isOld ? "#dc2626" : "#15803d" }} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-bold font-mono text-gray-400">
            {rx.prescription_number}
          </span>
          {isOld && (
            <span className="flex items-center gap-1 text-xs font-semibold text-red-600">
              <AlertCircle size={10} /> Waiting long
            </span>
          )}
        </div>
        <p className="text-sm font-semibold text-gray-900 truncate">
          {rx.visit_number} · {rx.pending_items} item
          {rx.pending_items !== 1 ? "s" : ""} pending
        </p>
      </div>

      <div className="text-right flex-shrink-0 hidden sm:block">
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{
            background: cfg.bg,
            color: cfg.color,
            border: `1px solid ${cfg.border}`,
          }}
        >
          {cfg.label}
        </span>
        <p className="text-xs text-gray-400 mt-1">{waited}</p>
      </div>

      <button
        onClick={() => onOpen(rx.id)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex-shrink-0 hover:shadow-sm"
        style={{
          background: "linear-gradient(135deg, #166534, #15803d)",
          color: "#fff",
        }}
      >
        Dispense
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PharmacyOverviewPage() {
  const router = useRouter();

  const [stats, setStats] = useState<any>(null);
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const [overviewRes, pendingRes] = await Promise.all([
        pharmacyStatsApi.getOverview(),
        visitApi.getPendingPrescriptions(),
      ]);
      setStats(overviewRes.data.data);
      setPending(pendingRes.data.data?.prescriptions ?? []);
      setLastUpdated(new Date());
    } catch (_) {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const taDisplay = (min: number) => {
    if (!min) return "—";
    return min >= 60 ? `${(min / 60).toFixed(1)}hr` : `${min}min`;
  };

  const maxActivity = Math.max(
    ...(stats?.weeklyActivity ?? []).map(
      (d: any) => parseInt(d.prescribed) || 0,
    ),
    1,
  );

  return (
    <div
      className="max-w-5xl mx-auto space-y-6"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* ── Welcome banner ── */}
      <div
        className="relative rounded-2xl overflow-hidden px-7 py-6"
        style={{
          background:
            "linear-gradient(135deg, #052e16 0%, #064e23 55%, #166534 100%)",
        }}
      >
        {/* Decorative blobs */}
        <div
          className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-[0.07]"
          style={{
            background: "radial-gradient(circle, #86efac, transparent)",
            transform: "translate(30%, -30%)",
          }}
        />
        <div
          className="absolute bottom-0 left-32 w-40 h-40 rounded-full opacity-[0.05]"
          style={{
            background: "radial-gradient(circle, #4ade80, transparent)",
            transform: "translate(-50%, 50%)",
          }}
        />

        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-green-400/80 text-sm font-medium mb-1">
              {format(new Date(), "EEEE, dd MMMM yyyy")}
            </p>
            <h1
              className="text-white text-2xl font-bold leading-tight"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Pharmacy Overview
            </h1>
            <div className="flex flex-wrap items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5 text-sm text-green-300/80">
                <Pill size={13} />
                <span>{stats?.dispensedToday ?? 0} dispensed today</span>
              </div>
              {(stats?.pendingCount ?? 0) > 0 && (
                <div className="flex items-center gap-1.5 text-sm text-amber-300 animate-pulse">
                  <Zap size={13} />
                  <span>{stats.pendingCount} awaiting dispense</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {lastUpdated && (
              <p className="text-green-400/40 text-xs">
                Updated {format(lastUpdated, "HH:mm")}
              </p>
            )}
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="p-2 rounded-xl transition-colors"
              style={{ background: "rgba(255,255,255,0.08)" }}
              title="Refresh"
            >
              <RefreshCw
                size={14}
                className={`text-green-300 ${refreshing ? "animate-spin" : ""}`}
              />
            </button>
            <button
              onClick={() => router.push("/dashboard/pharmacy/queue")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:shadow-lg hover:-translate-y-0.5"
              style={{
                background: "linear-gradient(135deg, #16a34a, #15803d)",
                color: "#fff",
              }}
            >
              <Package size={15} />
              Open Queue
            </button>
          </div>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={Clock}
          label="Awaiting Dispense"
          value={stats?.pendingCount ?? 0}
          sub="prescriptions pending"
          color="#b45309"
          bg="linear-gradient(135deg, #fffbeb, #fef3c7)"
          border="#fde68a"
          onClick={() => router.push("/dashboard/pharmacy/queue")}
          loading={loading}
        />
        <StatCard
          icon={CheckCircle2}
          label="Dispensed Today"
          value={stats?.dispensedToday ?? 0}
          sub="completed today"
          color="#166534"
          bg="linear-gradient(135deg, #f0fdf4, #dcfce7)"
          border="#bbf7d0"
          onClick={() => router.push("/dashboard/pharmacy/history")}
          loading={loading}
        />
        <StatCard
          icon={TrendingUp}
          label="Dispensed This Week"
          value={stats?.dispensedWeek ?? 0}
          sub="last 7 days"
          color="#1d4ed8"
          bg="linear-gradient(135deg, #eff6ff, #dbeafe)"
          border="#bfdbfe"
          onClick={() => router.push("/dashboard/pharmacy/history")}
          loading={loading}
        />
        <StatCard
          icon={Timer}
          label="Avg Dispense Time"
          value={taDisplay(stats?.avgDispenseMinutes ?? 0)}
          sub="7-day average"
          color="#6d28d9"
          bg="linear-gradient(135deg, #faf5ff, #ede9fe)"
          border="#ddd6fe"
          loading={loading}
        />
      </div>

      {/* ── Main content row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pending queue — 2/3 width */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "#f0fdf4" }}
              >
                <Pill size={15} style={{ color: "#166534" }} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">
                  Awaiting Dispensing
                </h2>
                <p className="text-xs text-gray-400">
                  Priority order · updates every 30s
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push("/dashboard/pharmacy/queue")}
              className="flex items-center gap-1 text-xs font-semibold transition-colors hover:underline"
              style={{ color: "#166534" }}
            >
              Full queue <ArrowUpRight size={12} />
            </button>
          </div>

          {loading ? (
            <div className="divide-y divide-gray-50">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="px-5 py-4 flex items-center gap-4 animate-pulse"
                >
                  <div className="w-9 h-9 rounded-xl bg-gray-100 flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-28 bg-gray-100 rounded" />
                    <div className="h-3.5 w-44 bg-gray-100 rounded" />
                  </div>
                  <div className="w-16 h-7 bg-gray-100 rounded-lg" />
                </div>
              ))}
            </div>
          ) : pending.length === 0 ? (
            <div className="py-16 text-center">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                style={{ background: "#f0fdf4" }}
              >
                <CheckCircle2 size={22} style={{ color: "#16a34a" }} />
              </div>
              <p className="text-sm font-semibold text-gray-500">All clear!</p>
              <p className="text-xs text-gray-400 mt-1">
                No prescriptions awaiting dispense
              </p>
            </div>
          ) : (
            <div>
              {pending.slice(0, 6).map((rx) => (
                <PendingRow
                  key={rx.id}
                  rx={rx}
                  onOpen={(id) =>
                    router.push(`/dashboard/pharmacy/queue/${id}`)
                  }
                />
              ))}
              {pending.length > 6 && (
                <button
                  onClick={() => router.push("/dashboard/pharmacy/queue")}
                  className="w-full py-3 text-xs font-semibold text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors border-t border-gray-50 flex items-center justify-center gap-1"
                >
                  +{pending.length - 6} more in queue
                  <ChevronRight size={12} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right column — 1/3 width */}
        <div className="space-y-3">
          {/* Status breakdown */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-900">
                Status Breakdown
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">All prescriptions</p>
            </div>
            <div className="p-4 space-y-3">
              {(
                [
                  "prescribed",
                  "dispensing",
                  "dispensed",
                  "discontinued",
                  "cancelled",
                ] as const
              ).map((s) => {
                const count = stats?.statusBreakdown?.[s] ?? 0;
                if (count === 0) return null;
                const cfg = STATUS_CONFIG[s];
                const total = Object.values(
                  stats?.statusBreakdown ?? {},
                ).reduce((a: number, b) => a + (b as number), 0);
                const pct = total ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={s} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: cfg.color }}
                      />
                      <span className="text-xs text-gray-500 font-medium">
                        {cfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            background: cfg.color,
                            width: `${pct}%`,
                            opacity: 0.7,
                          }}
                        />
                      </div>
                      <span
                        className="text-sm font-bold w-5 text-right"
                        style={{ color: cfg.color }}
                      >
                        {loading ? "—" : count}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 7-day activity */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-gray-900">
                  7-Day Activity
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Prescribed vs dispensed
                </p>
              </div>
              <Activity size={14} className="text-gray-300" />
            </div>
            <div className="p-4">
              {(stats?.weeklyActivity ?? []).length === 0 ? (
                <div className="flex flex-col items-center py-6 text-center">
                  <BarChart3 size={24} className="text-gray-200 mb-2" />
                  <p className="text-xs text-gray-400">No activity yet</p>
                </div>
              ) : (
                <>
                  <div className="flex items-end gap-1.5 h-20 mb-2">
                    {(stats.weeklyActivity ?? []).map((day: any, i: number) => {
                      const prescribed = parseInt(day.prescribed) || 0;
                      const dispensed = parseInt(day.dispensed) || 0;
                      const prescH = Math.round(
                        (prescribed / maxActivity) * 100,
                      );
                      const dispH = Math.round((dispensed / maxActivity) * 100);
                      const label = new Date(day.date).toLocaleDateString(
                        "en-ZM",
                        { weekday: "short" },
                      );
                      return (
                        <div
                          key={i}
                          className="flex-1 flex flex-col items-center gap-0.5"
                        >
                          <div className="w-full flex items-end justify-center gap-0.5 h-16">
                            <div
                              className="w-2/5 rounded-t-sm transition-all"
                              style={{
                                height: `${prescH}%`,
                                backgroundColor: "#fde68a",
                                minHeight: prescribed > 0 ? 3 : 0,
                              }}
                            />
                            <div
                              className="w-2/5 rounded-t-sm transition-all"
                              style={{
                                height: `${dispH}%`,
                                backgroundColor: "#16a34a",
                                minHeight: dispensed > 0 ? 3 : 0,
                              }}
                            />
                          </div>
                          <span className="text-[10px] text-gray-400">
                            {label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full inline-block"
                        style={{ backgroundColor: "#fde68a" }}
                      />
                      Prescribed
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-green-600 inline-block" />
                      Dispensed
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Top medications ── */}
      {(stats?.topMedications ?? []).length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-900">
              Top Prescribed Medications
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Last 7 days</p>
          </div>
          <div className="p-5 space-y-3">
            {(stats.topMedications ?? []).map((med: any, i: number) => {
              const max = parseInt(stats.topMedications[0]?.count) || 1;
              const pct = Math.round((parseInt(med.count) / max) * 100);
              const colors = [
                "#166534",
                "#1d4ed8",
                "#6d28d9",
                "#b45309",
                "#dc2626",
              ];
              const color = colors[i] ?? "#374151";
              return (
                <div
                  key={med.medication_name}
                  className="flex items-center gap-4"
                >
                  <div
                    className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
                    style={{ backgroundColor: color }}
                  >
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-gray-800">
                        {med.medication_name}
                      </span>
                      <span className="text-sm font-bold text-gray-900">
                        {med.count}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
