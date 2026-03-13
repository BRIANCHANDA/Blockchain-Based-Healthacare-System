"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { api, visitApi } from "@/lib/api";
import {
  UserPlus,
  Users,
  ClipboardList,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Activity,
  ChevronRight,
  Play,
  TrendingUp,
  Zap,
  CalendarDays,
  RefreshCw,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

// ── Priority config ───────────────────────────────────────────────────────────
const PRIORITY: Record<
  string,
  { color: string; bg: string; border: string; dot: string }
> = {
  routine: {
    color: "#15803d",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    dot: "#16a34a",
  },
  urgent: {
    color: "#b45309",
    bg: "#fffbeb",
    border: "#fde68a",
    dot: "#f59e0b",
  },
  emergency: {
    color: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca",
    dot: "#ef4444",
  },
  critical: {
    color: "#7c3aed",
    bg: "#faf5ff",
    border: "#e9d5ff",
    dot: "#a855f7",
  },
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function PulseDot({ color }: { color: string }) {
  return (
    <span className="relative flex h-2 w-2 flex-shrink-0">
      <span
        className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-50"
        style={{ background: color }}
      />
      <span
        className="relative inline-flex rounded-full h-2 w-2"
        style={{ background: color }}
      />
    </span>
  );
}

interface QueueItem {
  id: string;
  visitNumber: string;
  chiefComplaint: string;
  priority: string;
  status: string;
  admissionDate: string;
  wardOrRoom?: string;
  patient?: { firstName: string; lastName: string };
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
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

// ── Queue Row ─────────────────────────────────────────────────────────────────
function QueueRow({
  item,
  onOpen,
}: {
  item: QueueItem;
  onOpen: (id: string) => void;
}) {
  const p = PRIORITY[item.priority] ?? PRIORITY.routine;
  const isActive = item.status === "in-progress";

  return (
    <div className="flex items-center gap-4 px-5 py-3.5 border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors group">
      <PulseDot color={isActive ? p.dot : "#d1d5db"} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-bold font-mono text-gray-400">
            {item.visitNumber}
          </span>
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize"
            style={{
              background: p.bg,
              color: p.color,
              border: `1px solid ${p.border}`,
            }}
          >
            {item.priority}
          </span>
        </div>
        <p className="text-sm font-semibold text-gray-900 truncate">
          {item.chiefComplaint}
        </p>
        {item.wardOrRoom && (
          <p className="text-xs text-gray-400 mt-0.5">{item.wardOrRoom}</p>
        )}
      </div>

      <div className="text-right flex-shrink-0 hidden sm:block">
        <p className="text-xs text-gray-400">
          {formatDistanceToNow(new Date(item.admissionDate), {
            addSuffix: true,
          })}
        </p>
        <p className="text-xs text-gray-300">
          {format(new Date(item.admissionDate), "HH:mm")}
        </p>
      </div>

      <button
        onClick={() => onOpen(item.id)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex-shrink-0
          hover:shadow-sm"
        style={{
          background: "linear-gradient(135deg, #166534, #15803d)",
          color: "#fff",
        }}
      >
        <Play size={10} />
        Open
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ReceptionistOverviewPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await api.get("/api/visits/today");
      setQueue(res.data.data?.visits ?? res.data.data?.queue ?? []);
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

  const waiting = queue.filter((q) => q.status === "waiting").length;
  const inProgress = queue.filter((q) => q.status === "in-progress").length;
  const done = queue.filter(
    (q) => q.status === "completed" || q.status === "discharged",
  ).length;
  const urgent = queue.filter(
    (q) => q.priority === "critical" || q.priority === "emergency",
  ).length;

  const liveQueue = queue
    .filter((q) => q.status === "in-progress" || q.status === "waiting")
    .sort((a, b) => {
      const order: Record<string, number> = {
        critical: 0,
        emergency: 1,
        urgent: 2,
        routine: 3,
      };
      return (order[a.priority] ?? 9) - (order[b.priority] ?? 9);
    })
    .slice(0, 6);

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
              {greeting()}, {user?.firstName}
            </h1>
            <div className="flex flex-wrap items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5 text-sm text-green-300/80">
                <ClipboardList size={13} />
                <span>{queue.length} visits today</span>
              </div>
              {urgent > 0 && (
                <div className="flex items-center gap-1.5 text-sm text-red-300 animate-pulse">
                  <Zap size={13} />
                  <span>{urgent} urgent / critical</span>
                </div>
              )}
              {done > 0 && (
                <div className="flex items-center gap-1.5 text-sm text-green-400/70">
                  <CheckCircle2 size={13} />
                  <span>{done} completed</span>
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
              onClick={() => router.push("/dashboard/receptionist/visits/new")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:shadow-lg hover:-translate-y-0.5"
              style={{
                background: "linear-gradient(135deg, #16a34a, #15803d)",
                color: "#fff",
              }}
            >
              <UserPlus size={15} />
              New Visit
            </button>
          </div>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={ClipboardList}
          label="Total Today"
          value={queue.length}
          sub="all visits"
          color="#166534"
          bg="linear-gradient(135deg, #f0fdf4, #dcfce7)"
          border="#bbf7d0"
          onClick={() => router.push("/dashboard/receptionist/queue")}
          loading={loading}
        />
        <StatCard
          icon={Clock}
          label="Waiting"
          value={waiting}
          sub={waiting === 1 ? "patient waiting" : "patients waiting"}
          color="#b45309"
          bg="linear-gradient(135deg, #fffbeb, #fef3c7)"
          border="#fde68a"
          loading={loading}
        />
        <StatCard
          icon={Activity}
          label="In Progress"
          value={inProgress}
          sub="active encounters"
          color="#1d4ed8"
          bg="linear-gradient(135deg, #eff6ff, #dbeafe)"
          border="#bfdbfe"
          loading={loading}
        />
        <StatCard
          icon={CheckCircle2}
          label="Completed"
          value={done}
          sub="discharged today"
          color="#6d28d9"
          bg="linear-gradient(135deg, #faf5ff, #ede9fe)"
          border="#ddd6fe"
          loading={loading}
        />
      </div>

      {/* ── Main content row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Live queue — 2/3 width */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "#f0fdf4" }}
              >
                <Activity size={15} style={{ color: "#166534" }} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">Live Queue</h2>
                <p className="text-xs text-gray-400">
                  Priority-sorted · updates every 30s
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push("/dashboard/receptionist/queue")}
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
                  <div className="w-2 h-2 rounded-full bg-gray-200 flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-28 bg-gray-100 rounded" />
                    <div className="h-3.5 w-44 bg-gray-100 rounded" />
                  </div>
                  <div className="w-14 h-7 bg-gray-100 rounded-lg" />
                </div>
              ))}
            </div>
          ) : liveQueue.length === 0 ? (
            <div className="py-16 text-center">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                style={{ background: "#f0fdf4" }}
              >
                <ClipboardList size={22} style={{ color: "#16a34a" }} />
              </div>
              <p className="text-sm font-semibold text-gray-500">
                Queue is clear
              </p>
              <p className="text-xs text-gray-400 mt-1">
                No active or waiting patients right now
              </p>
              <button
                onClick={() =>
                  router.push("/dashboard/receptionist/visits/new")
                }
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white"
                style={{ background: "#166534" }}
              >
                <UserPlus size={13} /> Register first visit
              </button>
            </div>
          ) : (
            <div>
              {liveQueue.map((item) => (
                <QueueRow
                  key={item.id}
                  item={item}
                  onOpen={(id) =>
                    router.push(`/dashboard/receptionist/visits/${id}`)
                  }
                />
              ))}
              {queue.filter((q) => q.status !== "completed").length > 6 && (
                <button
                  onClick={() => router.push("/dashboard/receptionist/queue")}
                  className="w-full py-3 text-xs font-semibold text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors border-t border-gray-50 flex items-center justify-center gap-1"
                >
                  +{queue.filter((q) => q.status !== "completed").length - 6}{" "}
                  more in queue
                  <ChevronRight size={12} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Quick actions — 1/3 width */}
        <div className="space-y-3">
          {/* Quick actions card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-900">Quick Actions</h2>
              <p className="text-xs text-gray-400 mt-0.5">Common tasks</p>
            </div>
            <div className="p-3 space-y-2">
              {[
                {
                  icon: UserPlus,
                  label: "Register New Patient",
                  sub: "Create patient record",
                  href: "/dashboard/receptionist/register",
                  color: "#166534",
                  bg: "#f0fdf4",
                },
                {
                  icon: ClipboardList,
                  label: "New Visit",
                  sub: "Start an encounter",
                  href: "/dashboard/receptionist/visits/new",
                  color: "#1d4ed8",
                  bg: "#eff6ff",
                },
                {
                  icon: Users,
                  label: "All Patients",
                  sub: "Browse patient records",
                  href: "/dashboard/receptionist/patients",
                  color: "#6d28d9",
                  bg: "#faf5ff",
                },
              ].map(({ icon: Icon, label, sub, href, color, bg }) => (
                <button
                  key={href}
                  onClick={() => router.push(href)}
                  className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl hover:shadow-sm transition-all group text-left"
                  style={{ background: bg, border: "1px solid transparent" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.borderColor = color + "40")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.borderColor = "transparent")
                  }
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(255,255,255,0.8)" }}
                  >
                    <Icon size={15} style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 leading-tight">
                      {label}
                    </p>
                    <p className="text-xs text-gray-400">{sub}</p>
                  </div>
                  <ChevronRight
                    size={14}
                    className="text-gray-300 group-hover:text-gray-500 transition-all group-hover:translate-x-0.5 flex-shrink-0"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Today's summary card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-900">
                Today's Summary
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {format(new Date(), "dd MMM yyyy")}
              </p>
            </div>
            <div className="p-4 space-y-3">
              {[
                {
                  label: "Registered",
                  value: queue.length,
                  color: "#166534",
                  icon: CalendarDays,
                },
                {
                  label: "Waiting",
                  value: waiting,
                  color: "#b45309",
                  icon: Clock,
                },
                {
                  label: "In Progress",
                  value: inProgress,
                  color: "#1d4ed8",
                  icon: TrendingUp,
                },
                {
                  label: "Completed",
                  value: done,
                  color: "#6d28d9",
                  icon: CheckCircle2,
                },
                {
                  label: "Urgent/Crit",
                  value: urgent,
                  color: "#dc2626",
                  icon: AlertCircle,
                },
              ].map(({ label, value, color, icon: Icon }) => (
                <div key={label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon size={13} style={{ color }} />
                    <span className="text-xs text-gray-500 font-medium">
                      {label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Mini bar */}
                    <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          background: color,
                          width: queue.length
                            ? `${Math.min(100, (value / Math.max(queue.length, 1)) * 100)}%`
                            : "0%",
                          opacity: 0.7,
                        }}
                      />
                    </div>
                    <span
                      className="text-sm font-bold w-5 text-right"
                      style={{ color }}
                    >
                      {loading ? "—" : value}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
