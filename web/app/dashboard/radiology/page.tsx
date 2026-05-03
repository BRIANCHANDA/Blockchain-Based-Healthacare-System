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
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const URGENCY: Record<
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
    color: "#16a34a",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    dot: "#22c55e",
    label: "Routine",
  },
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

function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

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

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Hero banner with institution name */}
      <div
        className="relative rounded-3xl overflow-hidden mb-6 px-7 py-6"
        style={{
          background:
            "linear-gradient(130deg, #0d4a1f 0%, #166534 55%, #15803d 100%)",
        }}
      >
        <div
          className="absolute -right-8 -top-8 w-40 h-40 rounded-full opacity-10"
          style={{
            background: "radial-gradient(circle, #bbf7d0, transparent)",
          }}
        />
        <div
          className="absolute right-20 bottom-0 w-28 h-28 rounded-full opacity-5"
          style={{
            background: "radial-gradient(circle, #dcfce7, transparent)",
          }}
        />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-green-300/70 text-sm font-medium mb-1">
              {user?.institutionName ? `${user.institutionName} · ` : ""}
              {getGreeting()}
            </p>
            <h1
              className="text-white text-2xl font-bold leading-tight"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {user?.firstName} {user?.lastName}
            </h1>
            <p className="text-green-200/50 text-sm mt-1.5">
              {totalPending > 0
                ? `${totalPending} stud${totalPending !== 1 ? "ies" : "y"} pending${criticalCount > 0 ? ` · ${criticalCount} need immediate attention` : ""}`
                : "Worklist is clear — great work!"}
            </p>
          </div>
          <div className="flex gap-2.5 flex-wrap">
            <button
              onClick={() => router.push("/dashboard/radiology/queue")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105"
              style={{
                background: "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.2)",
              }}
            >
              <Scan className="w-4 h-4" /> Open Worklist
            </button>
            <button
              onClick={() => router.push("/dashboard/radiology/history")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: "rgba(0,0,0,0.2)",
                color: "#bbf7d0",
                border: "1px solid rgba(0,0,0,0.1)",
              }}
            >
              <ClipboardList className="w-4 h-4" /> My Reports
            </button>
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="flex items-center px-3 py-2.5 rounded-xl text-sm transition-all disabled:opacity-50"
              style={{
                background: "rgba(0,0,0,0.15)",
                color: "rgba(255,255,255,0.6)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>
      </div>
      {/* ── Critical alert ── */}
      {!loading && criticalCount > 0 && (
        <div
          className="flex items-center justify-between px-4 py-3 rounded-2xl mb-5 gap-3"
          style={{ background: "#fef2f2", border: "1px solid #fecaca" }}
        >
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
            </span>
            <p className="text-sm font-bold text-red-800">
              {criticalCount} critical / emergency stud
              {criticalCount !== 1 ? "ies" : "y"} awaiting report
            </p>
          </div>
          <button
            onClick={() => router.push("/dashboard/radiology/queue")}
            className="flex items-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-800 transition-colors whitespace-nowrap"
          >
            Report now <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {loading
          ? [...Array(4)].map((_, i) => (
              <div
                key={i}
                className="relative rounded-2xl border overflow-hidden p-4 animate-pulse"
                style={{ background: "#f9fafb", borderColor: "#f3f4f6" }}
              >
                <div className="h-4 w-24 bg-gray-100 rounded mb-4" />
                <div className="h-8 w-12 bg-gray-100 rounded" />
              </div>
            ))
          : [
              {
                label: "Pending Studies",
                value: totalPending,
                color: "#d97706",
                bg: "linear-gradient(135deg,#fffbeb,#fef3c7)",
                border: "#fde68a",
                icon: Scan,
                alert: totalPending > 0,
              },
              {
                label: "Critical / Urgent",
                value: criticalCount,
                color: "#dc2626",
                bg: "linear-gradient(135deg,#fef2f2,#fee2e2)",
                border: "#fecaca",
                icon: AlertTriangle,
                alert: criticalCount > 0,
              },
              {
                label: "Reported Today",
                value: reportedToday,
                color: "#166534",
                bg: "linear-gradient(135deg,#f0fdf4,#dcfce7)",
                border: "#bbf7d0",
                icon: CheckCircle2,
                alert: false,
              },
              {
                label: "Reported This Week",
                value: reportedWeek,
                color: "#1d4ed8",
                bg: "linear-gradient(135deg,#eff6ff,#dbeafe)",
                border: "#bfdbfe",
                icon: TrendingUp,
                alert: false,
              },
            ].map(({ label, value, color, bg, border, icon: Icon, alert }) => (
              <div
                key={label}
                className="relative rounded-2xl border overflow-hidden p-4"
                style={{
                  background: bg,
                  borderColor: alert ? color : border,
                  boxShadow: alert ? `0 0 0 2px ${color}20` : undefined,
                }}
              >
                <div
                  className="absolute -right-2 -bottom-2 w-14 h-14 rounded-full opacity-10"
                  style={{ background: color }}
                />
                <div className="flex items-start justify-between mb-3">
                  <p
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color, opacity: 0.7 }}
                  >
                    {label}
                  </p>
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: `${color}18` }}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color }} />
                  </div>
                </div>
                <p
                  className="text-3xl font-extrabold leading-none"
                  style={{ color }}
                >
                  {value}
                </p>
              </div>
            ))}
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left col: actions + breakdowns */}
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">
            Quick Actions
          </p>
          {[
            {
              label: "Open Worklist",
              desc: "All pending studies sorted by urgency",
              href: "/dashboard/radiology/queue",
              icon: Scan,
              color: "#166534",
              bg: "linear-gradient(135deg,#f0fdf4,#dcfce7)",
              border: "#bbf7d0",
            },
            {
              label: "My Reports",
              desc: "Studies you have already reported",
              href: "/dashboard/radiology/history",
              icon: ClipboardList,
              color: "#1d4ed8",
              bg: "linear-gradient(135deg,#eff6ff,#dbeafe)",
              border: "#bfdbfe",
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

          {/* My performance */}
          {myStats && !loading && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                My Performance
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    label: "This month",
                    value: myStats.monthReports ?? 0,
                    color: "#166534",
                  },
                  {
                    label: "Today",
                    value: myStats.todayReports ?? 0,
                    color: "#1d4ed8",
                  },
                  {
                    label: "Avg turnaround",
                    value: formatTA(myStats.avgTurnaroundMinutes ?? 0),
                    color: "#7c3aed",
                  },
                  {
                    label: "Top modality",
                    value: (() => {
                      const entries = Object.entries(
                        myStats.modalityBreakdown ?? {},
                      ).sort(([, a], [, b]) => (b as number) - (a as number));
                      return entries[0] ? getM(entries[0][0]).label : "—";
                    })(),
                    color: "#d97706",
                  },
                ].map(({ label, value, color }) => (
                  <div
                    key={label}
                    className="rounded-xl p-3"
                    style={{ background: `${color}08` }}
                  >
                    <p
                      className="text-lg font-extrabold leading-none"
                      style={{ color }}
                    >
                      {value}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Modality breakdown */}
          {!loading &&
            Object.keys(stats?.pendingByModality ?? {}).length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                  By Modality
                </p>
                <div className="space-y-2.5">
                  {Object.entries(stats.pendingByModality)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .map(([mod, cnt]) => {
                      const cfg = getM(mod);
                      const pct =
                        totalPending > 0
                          ? Math.round(((cnt as number) / totalPending) * 100)
                          : 0;
                      return (
                        <div key={mod}>
                          <div className="flex items-center justify-between mb-1">
                            <span
                              className="text-xs font-semibold"
                              style={{ color: cfg.color }}
                            >
                              {cfg.label}
                            </span>
                            <span className="text-xs font-bold text-gray-900">
                              {cnt as number}
                            </span>
                          </div>
                          <div
                            className="h-1.5 rounded-full overflow-hidden"
                            style={{ background: cfg.bg }}
                          >
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{
                                width: `${pct}%`,
                                background: cfg.color,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

          {/* 7-day sparkbar */}
          {!loading && (stats?.weeklyActivity ?? []).length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  7-Day Activity
                </p>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <span
                      className="w-2 h-2 rounded-sm inline-block"
                      style={{ background: "#bbf7d0" }}
                    />{" "}
                    Ordered
                  </span>
                  <span className="flex items-center gap-1">
                    <span
                      className="w-2 h-2 rounded-sm inline-block"
                      style={{ background: "#166534" }}
                    />{" "}
                    Reported
                  </span>
                </div>
              </div>
              {(() => {
                const days = stats.weeklyActivity ?? [];
                const maxV = Math.max(
                  ...days.map((d: any) =>
                    Math.max(
                      parseInt(d.ordered) || 0,
                      parseInt(d.reported) || 0,
                    ),
                  ),
                  1,
                );
                return (
                  <div className="flex items-end gap-2 h-14">
                    {days.map((day: any, i: number) => {
                      const ordered = parseInt(day.ordered) || 0;
                      const reported = parseInt(day.reported) || 0;
                      return (
                        <div
                          key={i}
                          className="flex-1 flex flex-col items-center gap-1"
                        >
                          <div
                            className="w-full flex items-end justify-center gap-0.5"
                            style={{ height: 40 }}
                          >
                            <div
                              className="w-[45%] rounded-t-sm"
                              style={{
                                height: `${Math.round((ordered / maxV) * 100)}%`,
                                background: "#bbf7d0",
                                minHeight: ordered > 0 ? 2 : 0,
                              }}
                            />
                            <div
                              className="w-[45%] rounded-t-sm"
                              style={{
                                height: `${Math.round((reported / maxV) * 100)}%`,
                                background: "#166534",
                                minHeight: reported > 0 ? 2 : 0,
                              }}
                            />
                          </div>
                          <span
                            className="text-gray-400 font-semibold"
                            style={{ fontSize: 9 }}
                          >
                            {new Date(day.date).toLocaleDateString("en-ZM", {
                              weekday: "short",
                            })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Right col: pending worklist */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
                Pending Studies
              </p>
              {!loading && totalPending > 0 && (
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-bold"
                  style={{
                    background: criticalCount > 0 ? "#fef2f2" : "#fffbeb",
                    color: criticalCount > 0 ? "#dc2626" : "#d97706",
                  }}
                >
                  {totalPending}
                </span>
              )}
            </div>
            <button
              onClick={() => router.push("/dashboard/radiology/queue")}
              className="text-xs font-semibold flex items-center gap-1"
              style={{ color: "#166534" }}
            >
              See all <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {loading ? (
              <div className="divide-y divide-gray-50">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 px-5 py-4 animate-pulse"
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-gray-100 flex-shrink-0" />
                    <div className="w-9 h-9 rounded-xl bg-gray-100 flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-36 bg-gray-100 rounded" />
                      <div className="h-3 w-52 bg-gray-100 rounded" />
                    </div>
                    <div className="w-16 h-6 bg-gray-100 rounded-full" />
                  </div>
                ))}
              </div>
            ) : sortedPending.length === 0 ? (
              <div className="py-16 text-center">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: "#f0fdf4" }}
                >
                  <CheckCircle2 className="w-6 h-6 text-green-400" />
                </div>
                <p className="text-sm font-semibold text-gray-500">
                  Worklist is clear
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  All studies have been reported
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {sortedPending.slice(0, 7).map((order, i) => {
                  const u = getU(order.urgency);
                  const m = getM(order.modality);
                  const isCrit = ["critical", "emergency"].includes(
                    order.urgency,
                  );
                  return (
                    <button
                      key={order.id}
                      onClick={() =>
                        router.push(`/dashboard/radiology/queue/${order.id}`)
                      }
                      className="w-full flex items-center gap-4 px-5 py-3.5 text-left transition-colors group"
                      style={{
                        background:
                          isCrit && i === 0 ? `${u.dot}08` : undefined,
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
                      <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                        {isCrit && i === 0 && (
                          <span
                            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-50"
                            style={{ background: u.dot }}
                          />
                        )}
                        <span
                          className="relative inline-flex rounded-full h-2.5 w-2.5"
                          style={{ background: u.dot }}
                        />
                      </span>

                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: m.bg }}
                      >
                        <Scan className="w-4 h-4" style={{ color: m.color }} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-900">
                            {m.label}
                            {order.bodyPart ? ` — ${order.bodyPart}` : ""}
                          </p>
                          <span className="font-mono text-xs text-gray-400">
                            {order.visitNumber || order.orderNumber}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 truncate mt-0.5 max-w-xs">
                          {order.indication}
                        </p>
                      </div>

                      <div className="hidden sm:flex flex-col items-end gap-1.5 flex-shrink-0">
                        <span
                          className="text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={{
                            background: u.bg,
                            color: u.color,
                            border: `1px solid ${u.border}`,
                          }}
                        >
                          {u.label}
                        </span>
                        <span className="text-xs flex items-center gap-1 text-gray-400">
                          <Clock className="w-3 h-3" />{" "}
                          {timeSince(order.orderedAt)}
                        </span>
                      </div>

                      <ChevronRight className="w-4 h-4 text-gray-200 group-hover:text-green-600 transition-colors flex-shrink-0" />
                    </button>
                  );
                })}
                {sortedPending.length > 7 && (
                  <button
                    onClick={() => router.push("/dashboard/radiology/queue")}
                    className="w-full flex items-center justify-center gap-2 px-5 py-3.5 text-sm font-semibold hover:bg-gray-50 transition-colors"
                    style={{ color: "#166534" }}
                  >
                    View {sortedPending.length - 7} more{" "}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
