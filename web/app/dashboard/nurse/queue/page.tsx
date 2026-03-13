"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { visitApi } from "@/lib/api";
import {
  RefreshCw,
  ChevronRight,
  Activity,
  Users,
  Clock,
  Search,
  X,
  Zap,
  AlertTriangle,
  ClipboardList,
} from "lucide-react";
import { format } from "date-fns";

interface QueueVisit {
  id: string;
  visitNumber: string;
  visitType: string;
  chiefComplaint: string;
  priority: string;
  status: string;
  wardOrRoom: string | null;
  admissionDate: string;
  patient: {
    firstName: string;
    lastName: string;
    gender: string;
    bloodType: string;
  } | null;
}

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  emergency: 1,
  urgent: 2,
  routine: 3,
};

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
    color: "#16a34a",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    dot: "#22c55e",
    label: "Routine",
  },
};
const getP = (p: string) => PC[p] ?? PC.routine;

function timeSince(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}
function waitColor(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins > 60) return "#dc2626";
  if (mins > 30) return "#d97706";
  return "#9ca3af";
}

type FilterKey = "all" | "critical" | "emergency" | "urgent" | "routine";

export default function NurseQueuePage() {
  const router = useRouter();
  const [visits, setVisits] = useState<QueueVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await visitApi.getTodayQueue();
      const sorted = (res.data.data.visits ?? []).sort(
        (a: QueueVisit, b: QueueVisit) =>
          (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9),
      );
      setVisits(sorted);
      setLastRefresh(new Date());
    } catch {
      setVisits([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const i = setInterval(() => load(true), 30_000);
    return () => clearInterval(i);
  }, [load]);

  const counts = {
    all: visits.length,
    critical: visits.filter((v) => v.priority === "critical").length,
    emergency: visits.filter((v) => v.priority === "emergency").length,
    urgent: visits.filter((v) => v.priority === "urgent").length,
    routine: visits.filter((v) => v.priority === "routine").length,
  };

  const filtered = visits.filter((v) => {
    const matchP = filter === "all" || v.priority === filter;
    const q = search.toLowerCase();
    const matchS =
      !q ||
      [
        v.visitNumber,
        v.patient?.firstName,
        v.patient?.lastName,
        v.chiefComplaint,
      ].some((f) => f?.toLowerCase().includes(q));
    return matchP && matchS;
  });

  const filterTabs: { key: FilterKey; label: string }[] = [
    { key: "all", label: "All" },
    { key: "critical", label: "Critical" },
    { key: "emergency", label: "Emergency" },
    { key: "urgent", label: "Urgent" },
    { key: "routine", label: "Routine" },
  ];

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1
            className="text-2xl font-bold text-gray-900"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Today's Queue
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {format(new Date(), "EEEE, d MMMM yyyy")}
            {!loading && (
              <>
                {" "}
                ·{" "}
                <span className="font-medium text-gray-700">
                  {visits.length}
                </span>{" "}
                visit{visits.length !== 1 ? "s" : ""}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastRefresh && !loading && (
            <span className="text-xs text-gray-400 hidden sm:block">
              Updated {format(lastRefresh, "HH:mm")}
            </span>
          )}
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="p-2.5 rounded-xl border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-white transition-all disabled:opacity-40"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Summary cards — clickable filters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          {
            key: "critical",
            label: "Critical",
            icon: AlertTriangle,
            color: "#dc2626",
            bg: "linear-gradient(135deg,#fef2f2,#fee2e2)",
            border: "#fecaca",
          },
          {
            key: "emergency",
            label: "Emergency",
            icon: Zap,
            color: "#ea580c",
            bg: "linear-gradient(135deg,#fff7ed,#ffedd5)",
            border: "#fed7aa",
          },
          {
            key: "urgent",
            label: "Urgent",
            icon: Clock,
            color: "#d97706",
            bg: "linear-gradient(135deg,#fffbeb,#fef3c7)",
            border: "#fde68a",
          },
          {
            key: "routine",
            label: "Routine",
            icon: ClipboardList,
            color: "#166534",
            bg: "linear-gradient(135deg,#f0fdf4,#dcfce7)",
            border: "#bbf7d0",
          },
        ].map(({ key, label, icon: Icon, color, bg, border }) => (
          <button
            key={key}
            onClick={() =>
              setFilter(filter === key ? "all" : (key as FilterKey))
            }
            className="relative rounded-2xl border overflow-hidden p-4 text-left transition-all hover:shadow-md hover:-translate-y-px"
            style={{
              background: bg,
              borderColor: filter === key ? color : border,
              boxShadow: filter === key ? `0 0 0 2px ${color}25` : undefined,
            }}
          >
            <div
              className="absolute -right-2 -bottom-2 w-12 h-12 rounded-full opacity-10"
              style={{ background: color }}
            />
            <Icon className="w-3.5 h-3.5 mb-2" style={{ color }} />
            <p
              className="text-2xl font-extrabold leading-none"
              style={{ color }}
            >
              {loading ? (
                <span
                  className="inline-block w-5 h-5 rounded animate-pulse"
                  style={{ background: `${color}20` }}
                />
              ) : (
                counts[key as FilterKey]
              )}
            </p>
            <p
              className="text-xs font-semibold mt-1"
              style={{ color, opacity: 0.65 }}
            >
              {label}
            </p>
          </button>
        ))}
      </div>

      {/* Filter tabs + search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div
          className="flex gap-1 p-1 rounded-xl w-fit"
          style={{ background: "#e8ede9" }}
        >
          {filterTabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap"
              style={
                filter === key
                  ? {
                      background: "#fff",
                      color: key === "all" ? "#166534" : getP(key).color,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                    }
                  : { color: "#6b7280" }
              }
            >
              {label}
              {counts[key] > 0 && (
                <span
                  className="text-xs font-bold px-1.5 rounded-full"
                  style={
                    filter === key
                      ? {
                          background: key === "all" ? "#f0fdf4" : getP(key).bg,
                          color: key === "all" ? "#166534" : getP(key).color,
                        }
                      : { background: "rgba(0,0,0,0.06)", color: "#9ca3af" }
                  }
                >
                  {counts[key]}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="relative max-w-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patient, visit no…"
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 outline-none
              focus:border-green-500 focus:ring-2 focus:ring-green-500/10 placeholder:text-gray-400 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="divide-y divide-gray-50">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 px-5 py-4 animate-pulse"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-gray-100 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-36 bg-gray-100 rounded" />
                  <div className="h-3 w-56 bg-gray-100 rounded" />
                </div>
                <div className="w-16 h-6 bg-gray-100 rounded-full" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: "#f0fdf4" }}
            >
              <Users className="w-6 h-6 text-green-300" />
            </div>
            <p className="text-sm font-semibold text-gray-500">
              {visits.length === 0
                ? "Queue is empty"
                : "No patients match filters"}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {visits.length === 0
                ? "Patients will appear as visits are registered"
                : "Try clearing your search or filter"}
            </p>
            {(search || filter !== "all") && (
              <button
                onClick={() => {
                  setSearch("");
                  setFilter("all");
                }}
                className="mt-4 text-xs font-semibold px-4 py-2 rounded-xl transition-all"
                style={{ background: "#f0fdf4", color: "#166534" }}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-50/80">
            {filtered.map((v, i) => {
              const p = getP(v.priority);
              const isCritical = ["critical", "emergency"].includes(v.priority);
              return (
                <button
                  key={v.id}
                  onClick={() =>
                    router.push(
                      `/dashboard/nurse/triage?visitNumber=${v.visitNumber}`,
                    )
                  }
                  className="w-full flex items-center gap-4 px-5 py-4 text-left transition-all group"
                  style={{
                    background:
                      i === 0 && isCritical ? `${p.dot}08` : undefined,
                  }}
                  onMouseEnter={(e) => {
                    if (!(i === 0 && isCritical))
                      e.currentTarget.style.background = "#f9fafb";
                  }}
                  onMouseLeave={(e) => {
                    if (!(i === 0 && isCritical))
                      e.currentTarget.style.background = "transparent";
                  }}
                >
                  {/* Priority dot */}
                  <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                    {isCritical && i === 0 && (
                      <span
                        className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-50"
                        style={{ background: p.dot }}
                      />
                    )}
                    <span
                      className="relative inline-flex rounded-full h-2.5 w-2.5"
                      style={{ background: p.dot }}
                    />
                  </span>

                  {/* Patient */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">
                        {v.patient
                          ? `${v.patient.firstName} ${v.patient.lastName}`
                          : "—"}
                      </p>
                      <span className="font-mono text-xs text-gray-400">
                        {v.visitNumber}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 truncate mt-0.5 max-w-xs">
                      {v.chiefComplaint}
                    </p>
                  </div>

                  {/* Ward */}
                  {v.wardOrRoom && (
                    <span className="hidden md:block text-xs text-gray-400 whitespace-nowrap">
                      {v.wardOrRoom}
                    </span>
                  )}

                  {/* Wait */}
                  <div
                    className="hidden sm:flex items-center gap-1 text-xs whitespace-nowrap"
                    style={{ color: waitColor(v.admissionDate) }}
                  >
                    <Clock className="w-3 h-3" /> {timeSince(v.admissionDate)}
                  </div>

                  {/* Priority badge */}
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
                    style={{
                      background: p.bg,
                      color: p.color,
                      border: `1px solid ${p.border}`,
                    }}
                  >
                    {p.label}
                  </span>

                  {/* Triage CTA */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span
                      className="hidden lg:flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      style={{ background: "#166534", color: "#fff" }}
                    >
                      <Activity className="w-3 h-3" /> Triage
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-200 group-hover:text-green-600 transition-colors" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {!loading && visits.length > 0 && (
        <p className="text-xs text-center text-gray-400 mt-4">
          Showing {filtered.length} of {visits.length} visit
          {visits.length !== 1 ? "s" : ""}
          {(search || filter !== "all") && (
            <>
              {" "}
              ·{" "}
              <button
                onClick={() => {
                  setSearch("");
                  setFilter("all");
                }}
                className="underline hover:text-gray-600 transition-colors"
              >
                clear
              </button>
            </>
          )}
        </p>
      )}
    </div>
  );
}
