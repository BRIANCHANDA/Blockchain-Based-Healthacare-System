"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  ClipboardList,
  ChevronRight,
  RefreshCw,
  Clock,
  Search,
  X,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Users,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface QueueVisit {
  id: string;
  visitNumber: string;
  visitType: string;
  chiefComplaint: string;
  priority: string;
  status: string;
  wardOrRoom: string | null;
  admissionDate: string;
  hasConsultation: boolean;
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
    color: "#166534",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    dot: "#16a34a",
    label: "Routine",
  },
};
const getP = (p: string) => PC[p] ?? PC.routine;

const VISIT_TYPE_LABEL: Record<string, string> = {
  outpatient: "OPD",
  inpatient: "IPD",
  emergency: "EMG",
  consultation: "CONS",
};

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

type FilterKey = "all" | "critical" | "emergency" | "urgent" | "awaiting";

export default function DoctorQueuePage() {
  const router = useRouter();
  const [queue, setQueue] = useState<QueueVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await api.get("/api/doctor/today-queue");
      setQueue(res.data.data?.visits ?? []);
      setLastRefresh(new Date());
    } catch (_) {
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
    all: queue.length,
    critical: queue.filter((v) => v.priority === "critical").length,
    emergency: queue.filter((v) => v.priority === "emergency").length,
    urgent: queue.filter((v) => v.priority === "urgent").length,
    awaiting: queue.filter((v) => !v.hasConsultation).length,
  };

  const filtered = queue.filter((v) => {
    const matchFilter =
      filter === "all"
        ? true
        : filter === "awaiting"
          ? !v.hasConsultation
          : v.priority === filter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      [
        v.visitNumber,
        v.chiefComplaint,
        v.wardOrRoom,
        v.patient?.firstName,
        v.patient?.lastName,
      ].some((f) => f?.toLowerCase().includes(q));
    return matchFilter && matchSearch;
  });

  const filterTabs: {
    key: FilterKey;
    label: string;
    icon?: React.ElementType;
  }[] = [
    { key: "all", label: "All" },
    { key: "critical", label: "Critical", icon: Zap },
    { key: "emergency", label: "Emergency", icon: AlertTriangle },
    { key: "urgent", label: "Urgent", icon: Clock },
    { key: "awaiting", label: "Awaiting", icon: ClipboardList },
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
                  {queue.length}
                </span>{" "}
                visit{queue.length !== 1 ? "s" : ""} ready
                {counts.awaiting > 0 && (
                  <>
                    {" "}
                    ·{" "}
                    <span className="font-medium text-amber-600">
                      {counts.awaiting} awaiting review
                    </span>
                  </>
                )}
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

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          {
            key: "critical",
            label: "Critical",
            icon: Zap,
            color: "#dc2626",
            bg: "linear-gradient(135deg,#fef2f2,#fee2e2)",
            border: "#fecaca",
          },
          {
            key: "emergency",
            label: "Emergency",
            icon: AlertTriangle,
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
            key: "awaiting",
            label: "Needs Review",
            icon: ClipboardList,
            color: "#1d4ed8",
            bg: "linear-gradient(135deg,#eff6ff,#dbeafe)",
            border: "#bfdbfe",
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
                  style={{ background: `${color}18` }}
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
                      color:
                        key === "all"
                          ? "#166534"
                          : key === "awaiting"
                            ? "#1d4ed8"
                            : getP(key).color,
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
                          background:
                            key === "all"
                              ? "#f0fdf4"
                              : key === "awaiting"
                                ? "#eff6ff"
                                : getP(key).bg,
                          color:
                            key === "all"
                              ? "#166534"
                              : key === "awaiting"
                                ? "#1d4ed8"
                                : getP(key).color,
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
            placeholder="Search patient, visit, complaint…"
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

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Column headers */}
        {!loading && filtered.length > 0 && (
          <div
            className="px-5 py-2.5 border-b border-gray-100 hidden md:grid grid-cols-12 gap-3
            text-xs font-semibold text-gray-400 uppercase tracking-wide"
          >
            <div className="col-span-1" />
            <div className="col-span-3">Patient</div>
            <div className="col-span-3">Chief Complaint</div>
            <div className="col-span-1">Type</div>
            <div className="col-span-2">Admitted</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-1" />
          </div>
        )}

        {loading ? (
          <div className="divide-y divide-gray-50">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 px-5 py-4 animate-pulse"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-gray-100 flex-shrink-0" />
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-32 bg-gray-100 rounded" />
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
              {queue.length === 0
                ? "No patients ready yet"
                : "No patients match filters"}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {queue.length === 0
                ? "Patients appear here after nurse triage is complete"
                : "Try clearing your search or filters"}
            </p>
            {(search || filter !== "all") && (
              <button
                onClick={() => {
                  setSearch("");
                  setFilter("all");
                }}
                className="mt-4 text-xs font-semibold px-4 py-2 rounded-xl"
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
              const isCrit = ["critical", "emergency"].includes(v.priority);
              const needsReview = !v.hasConsultation;
              return (
                <button
                  key={v.id}
                  onClick={() => router.push(`/dashboard/doctor/visit/${v.id}`)}
                  className="w-full px-5 py-3.5 text-left transition-all group hover:bg-gray-50/80
                    hidden md:grid grid-cols-12 gap-3 items-center"
                  style={{
                    background: i === 0 && isCrit ? `${p.dot}06` : undefined,
                  }}
                >
                  {/* Priority dot */}
                  <div className="col-span-1 flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                      {isCrit && i === 0 && (
                        <span
                          className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-40"
                          style={{ background: p.dot }}
                        />
                      )}
                      <span
                        className="relative inline-flex rounded-full h-2.5 w-2.5"
                        style={{ background: p.dot }}
                      />
                    </span>
                  </div>

                  {/* Patient */}
                  <div className="col-span-3 flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{
                        background: isCrit ? p.bg : "#f1f5f9",
                        color: isCrit ? p.color : "#64748b",
                      }}
                    >
                      {v.patient
                        ? `${v.patient.firstName?.[0]}${v.patient.lastName?.[0]}`
                        : "?"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {v.patient
                          ? `${v.patient.firstName} ${v.patient.lastName}`
                          : "—"}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className="text-xs font-semibold px-1.5 py-0.5 rounded-full capitalize"
                          style={{ background: p.bg, color: p.color }}
                        >
                          {v.priority}
                        </span>
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
                      </div>
                    </div>
                  </div>

                  {/* Complaint */}
                  <div className="col-span-3 min-w-0">
                    <p className="text-sm text-gray-700 truncate font-medium">
                      {v.chiefComplaint}
                    </p>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">
                      {v.visitNumber}
                    </p>
                  </div>

                  {/* Type */}
                  <div className="col-span-1">
                    <span
                      className="text-xs font-semibold px-2 py-1 rounded-full"
                      style={{ background: "#f1f5f9", color: "#475569" }}
                    >
                      {VISIT_TYPE_LABEL[v.visitType] ?? v.visitType}
                    </span>
                  </div>

                  {/* Admitted */}
                  <div className="col-span-2">
                    <p className="text-xs font-medium text-gray-700">
                      {format(new Date(v.admissionDate), "HH:mm")}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDistanceToNow(new Date(v.admissionDate), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>

                  {/* Status */}
                  <div className="col-span-1">
                    {needsReview ? (
                      <span
                        className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full"
                        style={{ background: "#fffbeb", color: "#d97706" }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />{" "}
                        Pending
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full"
                        style={{ background: "#f0fdf4", color: "#15803d" }}
                      >
                        <CheckCircle2 className="w-3 h-3" /> Done
                      </span>
                    )}
                  </div>

                  <div className="col-span-1 flex justify-end">
                    <ChevronRight className="w-4 h-4 text-gray-200 group-hover:text-green-600 transition-colors" />
                  </div>
                </button>
              );
            })}

            {/* Mobile card view */}
            {filtered.map((v, i) => {
              const p = getP(v.priority);
              const isCrit = ["critical", "emergency"].includes(v.priority);
              const needsReview = !v.hasConsultation;
              return (
                <button
                  key={`m-${v.id}`}
                  onClick={() => router.push(`/dashboard/doctor/visit/${v.id}`)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-all group md:hidden"
                >
                  <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                    {isCrit && i === 0 && (
                      <span
                        className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-40"
                        style={{ background: p.dot }}
                      />
                    )}
                    <span
                      className="relative inline-flex rounded-full h-2.5 w-2.5"
                      style={{ background: p.dot }}
                    />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">
                        {v.patient
                          ? `${v.patient.firstName} ${v.patient.lastName}`
                          : "—"}
                      </p>
                      <span className="font-mono text-xs text-gray-400">
                        {v.visitNumber}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 truncate mt-0.5">
                      {v.chiefComplaint}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: p.bg, color: p.color }}
                      >
                        {p.label}
                      </span>
                      {needsReview ? (
                        <span className="text-xs text-amber-600 font-medium">
                          Needs review
                        </span>
                      ) : (
                        <span className="text-xs text-green-600 font-medium">
                          Consulted
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-200 group-hover:text-green-600 flex-shrink-0 transition-colors" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {!loading && queue.length > 0 && (
        <p className="text-xs text-center text-gray-400 mt-4">
          Showing {filtered.length} of {queue.length} visit
          {queue.length !== 1 ? "s" : ""}
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
