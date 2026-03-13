"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  Clock,
  Users,
  RefreshCw,
  Activity,
  ChevronRight,
  UserPlus,
  CheckCircle2,
  Loader2,
  Play,
  Zap,
  Search,
  X,
} from "lucide-react";
import { format } from "date-fns";

interface QueueItem {
  id: string;
  ticket: string;
  name: string;
  age: number;
  reason: string;
  priority: string;
  doctor: string | null;
  waitMins: number;
  status: string;
}

const PRIORITY: Record<
  string,
  { color: string; bg: string; border: string; dot: string; label: string }
> = {
  urgent: {
    color: "#b45309",
    bg: "#fffbeb",
    border: "#fde68a",
    dot: "#f59e0b",
    label: "Urgent",
  },
  normal: {
    color: "#166534",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    dot: "#16a34a",
    label: "Normal",
  },
  elderly: {
    color: "#92400e",
    bg: "#fff7ed",
    border: "#fed7aa",
    dot: "#f97316",
    label: "Elderly",
  },
  routine: {
    color: "#166534",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    dot: "#16a34a",
    label: "Routine",
  },
  emergency: {
    color: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca",
    dot: "#ef4444",
    label: "Emergency",
  },
  critical: {
    color: "#7c3aed",
    bg: "#faf5ff",
    border: "#e9d5ff",
    dot: "#a855f7",
    label: "Critical",
  },
};
const P_FALLBACK = {
  color: "#374151",
  bg: "#f9fafb",
  border: "#e5e7eb",
  dot: "#9ca3af",
  label: "—",
};
function getP(p: string) {
  return PRIORITY[p] ?? P_FALLBACK;
}
function waitColor(m: number) {
  return m > 60 ? "#dc2626" : m > 30 ? "#d97706" : "#6b7280";
}

function PulseDot({
  color,
  animate = false,
}: {
  color: string;
  animate?: boolean;
}) {
  return (
    <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
      {animate && (
        <span
          className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-40"
          style={{ background: color }}
        />
      )}
      <span
        className="relative inline-flex rounded-full h-2.5 w-2.5"
        style={{ background: color }}
      />
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "in-progress")
    return (
      <span
        className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
        style={{
          background: "#f0fdf4",
          color: "#15803d",
          border: "1px solid #bbf7d0",
        }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        In Progress
      </span>
    );
  if (status === "completed")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-400">
        <CheckCircle2 size={11} /> Done
      </span>
    );
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{
        background: "#fafafa",
        color: "#6b7280",
        border: "1px solid #e5e7eb",
      }}
    >
      <Clock size={11} /> Waiting
    </span>
  );
}

type FilterStatus = "all" | "waiting" | "in-progress" | "completed";

export default function QueuePage() {
  const router = useRouter();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [search, setSearch] = useState("");
  const [starting, setStarting] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchQueue = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await api.get("/api/dashboard/receptionist");
      setQueue(res.data.data.queue ?? []);
      setLastRefresh(new Date());
    } catch (_) {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
    const i = setInterval(() => fetchQueue(true), 30_000);
    return () => clearInterval(i);
  }, [fetchQueue]);

  const counts = {
    waiting: queue.filter((q) => q.status === "waiting").length,
    inProgress: queue.filter((q) => q.status === "in-progress").length,
    done: queue.filter((q) => q.status === "completed").length,
    urgent: queue.filter((q) =>
      ["urgent", "emergency", "critical"].includes(q.priority),
    ).length,
  };

  const filtered = queue.filter((item) => {
    const matchStatus = filterStatus === "all" || item.status === filterStatus;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      [item.ticket, item.name, item.reason, item.priority].some((f) =>
        f?.toLowerCase().includes(q),
      );
    return matchStatus && matchSearch;
  });

  const sorted = [...filtered].sort((a, b) => {
    const order: Record<string, number> = {
      critical: 0,
      emergency: 1,
      urgent: 2,
      elderly: 3,
      normal: 4,
      routine: 4,
    };
    const po = (order[a.priority] ?? 5) - (order[b.priority] ?? 5);
    return po !== 0 ? po : (b.waitMins ?? 0) - (a.waitMins ?? 0);
  });

  const filterTabs: { key: FilterStatus; label: string; count: number }[] = [
    { key: "all", label: "All", count: queue.length },
    { key: "waiting", label: "Waiting", count: counts.waiting },
    { key: "in-progress", label: "In Progress", count: counts.inProgress },
    { key: "completed", label: "Done", count: counts.done },
  ];

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <h1
            className="text-2xl font-bold text-gray-900"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Today's Queue
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {format(new Date(), "EEEE, dd MMMM yyyy")} ·{" "}
            {loading
              ? "Loading…"
              : `${queue.length} visit${queue.length !== 1 ? "s" : ""} registered`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 mr-1">
            {refreshing
              ? "Refreshing…"
              : lastRefresh
                ? `Updated ${format(lastRefresh, "HH:mm")}`
                : ""}
          </span>
          <button
            onClick={() => fetchQueue(true)}
            disabled={refreshing}
            className="p-2.5 rounded-xl border border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => router.push("/dashboard/receptionist/visits/new")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold hover:shadow-md transition-all"
            style={{ background: "linear-gradient(135deg, #166534, #15803d)" }}
          >
            <UserPlus size={15} /> New Visit
          </button>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          {
            label: "Waiting",
            value: counts.waiting,
            color: "#b45309",
            bg: "linear-gradient(135deg,#fffbeb,#fef3c7)",
            border: "#fde68a",
            icon: Clock,
          },
          {
            label: "In Progress",
            value: counts.inProgress,
            color: "#1d4ed8",
            bg: "linear-gradient(135deg,#eff6ff,#dbeafe)",
            border: "#bfdbfe",
            icon: Activity,
          },
          {
            label: "Completed",
            value: counts.done,
            color: "#166534",
            bg: "linear-gradient(135deg,#f0fdf4,#dcfce7)",
            border: "#bbf7d0",
            icon: CheckCircle2,
          },
          {
            label: "Urgent+",
            value: counts.urgent,
            color: "#dc2626",
            bg: "linear-gradient(135deg,#fef2f2,#fee2e2)",
            border: "#fecaca",
            icon: Zap,
          },
        ].map(({ label, value, color, bg, border, icon: Icon }) => (
          <div
            key={label}
            className="relative rounded-2xl p-4 border overflow-hidden"
            style={{ background: bg, borderColor: border }}
          >
            <div
              className="absolute -right-3 -bottom-3 w-16 h-16 rounded-full opacity-10"
              style={{ background: color }}
            />
            <Icon size={15} style={{ color }} className="mb-2" />
            <p
              className="text-2xl font-extrabold leading-none"
              style={{ color }}
            >
              {loading ? (
                <span className="inline-block w-6 h-6 rounded bg-black/5 animate-pulse" />
              ) : (
                value
              )}
            </p>
            <p className="text-xs font-medium text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters + search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex gap-1.5 p-1 rounded-xl bg-gray-100/80 w-fit">
          {filterTabs.map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setFilterStatus(key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={
                filterStatus === key
                  ? {
                      background: "#fff",
                      color: "#166534",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                    }
                  : { color: "#6b7280" }
              }
            >
              {label}
              {count > 0 && (
                <span
                  className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                  style={
                    filterStatus === key
                      ? { background: "#f0fdf4", color: "#166534" }
                      : { background: "rgba(0,0,0,0.06)", color: "#9ca3af" }
                  }
                >
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search
            size={14}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ticket, name, reason…"
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 outline-none
              focus:border-green-500 focus:ring-2 focus:ring-green-500/10 placeholder:text-gray-400 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Queue list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 animate-pulse"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-24 bg-gray-100 rounded" />
                  <div className="h-4 w-48 bg-gray-100 rounded" />
                  <div className="h-3 w-32 bg-gray-100 rounded" />
                </div>
                <div className="w-20 h-8 bg-gray-100 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-20 text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "#f0fdf4" }}
          >
            <Users size={24} style={{ color: "#166534" }} />
          </div>
          <p className="text-sm font-semibold text-gray-600">
            {filterStatus === "all" && !search
              ? "Queue is empty"
              : "No patients match"}
          </p>
          <p className="text-xs text-gray-400 mt-1 mb-5">
            {filterStatus === "all" && !search
              ? "Add the first visit to get started"
              : "Try adjusting your filters"}
          </p>
          {filterStatus === "all" && !search && (
            <button
              onClick={() => router.push("/dashboard/receptionist/visits/new")}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{
                background: "linear-gradient(135deg, #166534, #15803d)",
              }}
            >
              <UserPlus size={14} /> Create First Visit
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((item, idx) => {
            const p = getP(item.priority);
            const isDone = item.status === "completed";
            const isActive = item.status === "in-progress";
            const isUrgent = ["critical", "emergency"].includes(item.priority);
            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl border shadow-sm transition-all overflow-hidden ${isDone ? "opacity-55" : "hover:shadow-md"}`}
                style={{
                  borderColor: isActive || isUrgent ? p.border : "#f1f5f9",
                }}
              >
                {/* Priority top bar */}
                <div
                  className="h-0.5 w-full"
                  style={{ background: isDone ? "#e5e7eb" : p.dot }}
                />

                <div className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Position + ticket */}
                    <div className="flex flex-col items-center gap-1 flex-shrink-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-extrabold"
                        style={
                          isActive
                            ? {
                                background: p.bg,
                                color: p.color,
                                border: `1.5px solid ${p.border}`,
                              }
                            : { background: "#f8fafc", color: "#94a3b8" }
                        }
                      >
                        {idx + 1}
                      </div>
                      <span
                        className="text-xs font-bold font-mono"
                        style={{ color: p.color }}
                      >
                        {item.ticket}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize"
                          style={{
                            background: p.bg,
                            color: p.color,
                            border: `1px solid ${p.border}`,
                          }}
                        >
                          <PulseDot
                            color={p.dot}
                            animate={isUrgent && !isDone}
                          />
                          {p.label}
                        </span>
                        <StatusBadge status={item.status} />
                      </div>
                      <p className="text-base font-bold text-gray-900 leading-snug">
                        {item.name}
                        {item.age ? (
                          <span className="text-sm font-normal text-gray-400 ml-1.5">
                            {item.age} yrs
                          </span>
                        ) : null}
                      </p>
                      <p className="text-sm text-gray-500 mt-0.5 truncate">
                        {item.reason}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 mt-2">
                        <div
                          className="flex items-center gap-1 text-xs font-medium"
                          style={{ color: waitColor(item.waitMins) }}
                        >
                          <Clock size={11} />
                          {item.waitMins > 60
                            ? `${Math.floor(item.waitMins / 60)}h ${item.waitMins % 60}m`
                            : `${item.waitMins}m`}{" "}
                          wait
                          {item.waitMins > 45 && !isDone && (
                            <span className="ml-1">· overdue</span>
                          )}
                        </div>
                        {item.doctor && (
                          <span className="text-xs text-gray-400">
                            Dr. {item.doctor}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      {!isDone && (
                        <button
                          onClick={() =>
                            router.push(
                              `/dashboard/receptionist/visits/new?patientId=${item.id}&ticket=${item.ticket}`,
                            )
                          }
                          disabled={!!starting}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all hover:shadow-md disabled:opacity-50"
                          style={{
                            background: isActive
                              ? `linear-gradient(135deg,${p.color},${p.dot})`
                              : "linear-gradient(135deg,#166534,#15803d)",
                          }}
                        >
                          {starting === item.id ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Play size={13} />
                          )}
                          {isActive ? "Continue" : "Start"}
                        </button>
                      )}
                      <button
                        onClick={() =>
                          router.push(
                            `/dashboard/receptionist/visits/${item.id}`,
                          )
                        }
                        className="flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        Details <ChevronRight size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      {!loading && queue.length > 0 && (
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-400">
            Showing {sorted.length} of {queue.length} visit
            {queue.length !== 1 ? "s" : ""}
            {(filterStatus !== "all" || search) && (
              <>
                {" "}
                ·{" "}
                <button
                  onClick={() => {
                    setFilterStatus("all");
                    setSearch("");
                  }}
                  className="underline hover:text-gray-600 transition-colors"
                >
                  clear filters
                </button>
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
