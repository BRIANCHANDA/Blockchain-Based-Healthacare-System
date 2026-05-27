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
  FlaskConical,
  Scan,
  Hourglass,
  AlertCircle,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

// ── Types — flat shape from assigned-to-me practitioner branch ────────────────
interface QueueVisit {
  id: string;
  visitNumber: string;
  chiefComplaint: string;
  priority: string;
  status: string;
  admissionDate: string;
  wardOrRoom: string | null;
  hasConsultation: boolean;
  pendingLabCount: number;
  pendingImagingCount: number;
  // Flat — already decrypted server-side
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

type FilterKey =
  | "all"
  | "critical"
  | "emergency"
  | "urgent"
  | "awaiting"
  | "pending_results";

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DoctorQueuePage() {
  const router = useRouter();
  const [queue, setQueue] = useState<QueueVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
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
      setLastRefresh(new Date());
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? "Failed to load queue.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(() => load(true), 30_000);
    return () => clearInterval(iv);
  }, [load]);

  // Counts
  const counts = {
    all: queue.length,
    critical: queue.filter((v) => v.priority === "critical").length,
    emergency: queue.filter((v) => v.priority === "emergency").length,
    urgent: queue.filter((v) => v.priority === "urgent").length,
    awaiting: queue.filter((v) => !v.hasConsultation).length,
    pending_results: queue.filter(
      (v) =>
        v.hasConsultation &&
        (v.pendingLabCount > 0 || v.pendingImagingCount > 0),
    ).length,
  };

  const filtered = queue.filter((v) => {
    const matchFilter =
      filter === "all"
        ? true
        : filter === "awaiting"
          ? !v.hasConsultation
          : filter === "pending_results"
            ? v.hasConsultation &&
              (v.pendingLabCount > 0 || v.pendingImagingCount > 0)
            : v.priority === filter;

    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      [v.visitNumber, v.chiefComplaint, v.wardOrRoom, v.patientName].some((f) =>
        f?.toLowerCase().includes(q),
      );

    return matchFilter && matchSearch;
  });

  const filterTabs: { key: FilterKey; label: string }[] = [
    { key: "all", label: "All" },
    { key: "awaiting", label: "Needs Consult" },
    { key: "pending_results", label: "Await Results" },
    { key: "critical", label: "Critical" },
    { key: "emergency", label: "Emergency" },
    { key: "urgent", label: "Urgent" },
  ];

  const tabColor = (key: FilterKey) =>
    key === "awaiting"
      ? "#1d4ed8"
      : key === "pending_results"
        ? "#7c3aed"
        : key === "all"
          ? "#166534"
          : getP(key).color;
  const tabBg = (key: FilterKey) =>
    key === "awaiting"
      ? "#eff6ff"
      : key === "pending_results"
        ? "#faf5ff"
        : key === "all"
          ? "#f0fdf4"
          : getP(key).bg;

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
                {" · "}
                <span className="font-medium text-gray-700">
                  {queue.length}
                </span>{" "}
                visit{queue.length !== 1 ? "s" : ""}
                {counts.awaiting > 0 && (
                  <>
                    {" "}
                    ·{" "}
                    <span className="text-amber-600 font-medium">
                      {counts.awaiting} awaiting consult
                    </span>
                  </>
                )}
                {counts.pending_results > 0 && (
                  <>
                    {" "}
                    ·{" "}
                    <span className="text-purple-600 font-medium">
                      {counts.pending_results} awaiting results
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

      {/* Error */}
      {error && (
        <div className="mb-5 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-50 border border-red-100">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 flex-1">{error}</p>
          <button
            onClick={() => load(false)}
            className="text-xs font-semibold text-red-700 underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-5">
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
            label: "Needs Consult",
            icon: ClipboardList,
            color: "#1d4ed8",
            bg: "linear-gradient(135deg,#eff6ff,#dbeafe)",
            border: "#bfdbfe",
          },
          {
            key: "pending_results",
            label: "Await Results",
            icon: Hourglass,
            color: "#7c3aed",
            bg: "linear-gradient(135deg,#faf5ff,#ede9fe)",
            border: "#ddd6fe",
          },
          {
            key: "all",
            label: "Total",
            icon: Users,
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
            className="relative rounded-2xl border overflow-hidden p-3.5 text-left transition-all hover:shadow-md hover:-translate-y-px"
            style={{
              background: bg,
              borderColor: filter === key ? color : border,
              boxShadow: filter === key ? `0 0 0 2px ${color}25` : undefined,
            }}
          >
            <div
              className="absolute -right-2 -bottom-2 w-10 h-10 rounded-full opacity-10"
              style={{ background: color }}
            />
            <Icon className="w-3.5 h-3.5 mb-1.5" style={{ color }} />
            <p
              className="text-xl font-extrabold leading-none"
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
              className="text-[10px] font-semibold mt-1 leading-snug"
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
          className="flex gap-1 p-1 rounded-xl w-fit overflow-x-auto"
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
                      color: tabColor(key),
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
                      ? { background: tabBg(key), color: tabColor(key) }
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
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/10 placeholder:text-gray-400 transition-all"
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
          <div className="px-5 py-2.5 border-b border-gray-100 hidden md:grid grid-cols-12 gap-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">
            <div className="col-span-1" />
            <div className="col-span-3">Patient</div>
            <div className="col-span-4">Chief Complaint</div>
            <div className="col-span-2">Admitted</div>
            <div className="col-span-2">Status</div>
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
                ? "No patients assigned yet"
                : "No patients match filters"}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {queue.length === 0
                ? "Patients appear here after nurse triage assigns you"
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
              const needsConsult = !v.hasConsultation;
              const hasPending =
                v.pendingLabCount > 0 || v.pendingImagingCount > 0;
              const totalPending = v.pendingLabCount + v.pendingImagingCount;

              return (
                <button
                  key={v.id}
                  onClick={() => router.push(`/dashboard/doctor/visit/${v.id}`)}
                  className="w-full px-5 py-3.5 text-left transition-all group hover:bg-gray-50/80 grid grid-cols-12 gap-3 items-center"
                  style={{
                    background: i === 0 && isCrit ? `${p.dot}06` : undefined,
                  }}
                >
                  {/* Priority dot */}
                  <div className="col-span-1 flex items-center">
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
                      {getInitials(v.patientName)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {v.patientName}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className="text-xs font-semibold px-1.5 py-0.5 rounded-full capitalize"
                          style={{ background: p.bg, color: p.color }}
                        >
                          {v.priority}
                        </span>
                        {v.bloodType && v.bloodType !== "unknown" && (
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
                            style={{
                              background:
                                BLOOD_COLORS[v.bloodType] ?? "#6b7280",
                            }}
                          >
                            {v.bloodType}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Complaint */}
                  <div className="col-span-4 min-w-0">
                    <p className="text-sm text-gray-700 truncate font-medium">
                      {v.chiefComplaint}
                    </p>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">
                      {v.visitNumber}
                    </p>
                  </div>

                  {/* Admitted */}
                  <div className="col-span-2 hidden md:block">
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
                  <div className="col-span-2 hidden md:flex flex-col gap-1">
                    {needsConsult ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full w-fit bg-amber-50 text-amber-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />{" "}
                        Needs consult
                      </span>
                    ) : hasPending ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full w-fit bg-purple-50 text-purple-700">
                        <Hourglass className="w-3 h-3" /> {totalPending} pending
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full w-fit bg-green-50 text-green-700">
                        <CheckCircle2 className="w-3 h-3" /> Complete
                      </span>
                    )}
                    {hasPending && (
                      <div className="flex gap-1">
                        {v.pendingLabCount > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700">
                            <FlaskConical className="w-2.5 h-2.5" />
                            {v.pendingLabCount}
                          </span>
                        )}
                        {v.pendingImagingCount > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700">
                            <Scan className="w-2.5 h-2.5" />
                            {v.pendingImagingCount}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Mobile: chevron only, status in row */}
                  <div className="col-span-1 flex justify-end md:hidden">
                    <ChevronRight className="w-4 h-4 text-gray-200 group-hover:text-green-600 transition-colors" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

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
