"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { visitApi } from "@/lib/api";
import {
  ClipboardList,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  Clock,
  Search,
  Filter,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

const PRIORITY_ORDER = { critical: 0, emergency: 1, urgent: 2, routine: 3 };
const PRIORITY_STYLE: Record<
  string,
  { bg: string; text: string; dot: string }
> = {
  routine: { bg: "#f0fdf4", text: "#15803d", dot: "#16a34a" },
  urgent: { bg: "#fffbeb", text: "#d97706", dot: "#f59e0b" },
  emergency: { bg: "#fef2f2", text: "#dc2626", dot: "#ef4444" },
  critical: { bg: "#fdf4ff", text: "#7c3aed", dot: "#a855f7" },
};
const VISIT_TYPE_LABEL: Record<string, string> = {
  outpatient: "OPD",
  inpatient: "IPD",
  emergency: "EMG",
  consultation: "CONS",
};

type FilterType = "all" | "critical" | "emergency" | "urgent" | "awaiting";

export default function DoctorQueuePage() {
  const router = useRouter();
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await visitApi.getTodayQueue();
      const all: any[] = res.data.data?.visits ?? [];
      const active = all
        .filter((v: any) => v.status === "in-progress")
        .sort(
          (a: any, b: any) =>
            (PRIORITY_ORDER[a.priority as keyof typeof PRIORITY_ORDER] ?? 9) -
            (PRIORITY_ORDER[b.priority as keyof typeof PRIORITY_ORDER] ?? 9),
        );
      setQueue(active);
    } catch (_) {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = queue.filter((v) => {
    const matchFilter =
      filter === "all"
        ? true
        : filter === "awaiting"
          ? !v.hasConsultation
          : v.priority === filter;
    const matchSearch =
      !search ||
      [v.visitNumber, v.chiefComplaint, v.wardOrRoom].some((f) =>
        f?.toLowerCase().includes(search.toLowerCase()),
      );
    return matchFilter && matchSearch;
  });

  const filters: { key: FilterType; label: string; count: number }[] = [
    { key: "all", label: "All", count: queue.length },
    {
      key: "critical",
      label: "Critical",
      count: queue.filter((v) => v.priority === "critical").length,
    },
    {
      key: "emergency",
      label: "Emergency",
      count: queue.filter((v) => v.priority === "emergency").length,
    },
    {
      key: "urgent",
      label: "Urgent",
      count: queue.filter((v) => v.priority === "urgent").length,
    },
    {
      key: "awaiting",
      label: "Awaiting Review",
      count: queue.filter((v) => !v.hasConsultation).length,
    },
  ];

  return (
    <div
      className="max-w-5xl mx-auto"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1
            className="text-2xl font-bold text-gray-900"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Today's Queue
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {format(new Date(), "EEEE, dd MMMM yyyy")} · {queue.length} active
            patient{queue.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by visit number or complaint…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/10 placeholder:text-gray-400 transition-all"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {filters.map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all"
              style={
                filter === key
                  ? {
                      background: "#166534",
                      color: "#fff",
                      borderColor: "#166534",
                    }
                  : {
                      background: "#fff",
                      color: "#374151",
                      borderColor: "#e5e7eb",
                    }
              }
            >
              {label}
              {count > 0 && (
                <span
                  className="px-1.5 py-0.5 rounded-full text-xs font-bold"
                  style={
                    filter === key
                      ? { background: "rgba(255,255,255,0.25)", color: "#fff" }
                      : { background: "#f3f4f6", color: "#6b7280" }
                  }
                >
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Queue table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-14 text-center">
            <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Loading queue…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-14 text-center">
            <ClipboardList size={38} className="text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400 text-sm font-medium">
              No patients match
            </p>
          </div>
        ) : (
          <>
            {/* Column headers */}
            <div className="px-5 py-2.5 border-b border-gray-100 grid grid-cols-12 gap-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">
              <div className="col-span-1" />
              <div className="col-span-3">Visit / Complaint</div>
              <div className="col-span-2">Location</div>
              <div className="col-span-2">Type</div>
              <div className="col-span-2">Admitted</div>
              <div className="col-span-1">Status</div>
              <div className="col-span-1" />
            </div>

            <div className="divide-y divide-gray-50">
              {filtered.map((visit) => {
                const ps =
                  PRIORITY_STYLE[visit.priority] ?? PRIORITY_STYLE.routine;
                const reviewed = !!visit.hasConsultation;
                return (
                  <button
                    key={visit.id}
                    onClick={() =>
                      router.push(`/dashboard/doctor/visits/${visit.id}`)
                    }
                    className="w-full px-5 py-3.5 grid grid-cols-12 gap-3 items-center hover:bg-gray-50/80 transition-colors text-left group"
                  >
                    {/* Priority indicator */}
                    <div className="col-span-1 flex items-center justify-center">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ background: ps.dot }}
                      />
                    </div>

                    {/* Visit + Complaint */}
                    <div className="col-span-3 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <p className="text-xs font-bold text-gray-500 font-mono">
                          {visit.visitNumber}
                        </p>
                        <span
                          className="text-xs font-semibold px-1.5 py-0.5 rounded-full capitalize"
                          style={{ background: ps.bg, color: ps.text }}
                        >
                          {visit.priority}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {visit.chiefComplaint}
                      </p>
                    </div>

                    {/* Location */}
                    <div className="col-span-2">
                      <p className="text-sm text-gray-600 truncate">
                        {visit.wardOrRoom ?? "—"}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {visit.department?.departmentName ?? ""}
                      </p>
                    </div>

                    {/* Type */}
                    <div className="col-span-2">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: "#f3f4f6", color: "#374151" }}
                      >
                        {VISIT_TYPE_LABEL[visit.visitType] ?? visit.visitType}
                      </span>
                    </div>

                    {/* Time */}
                    <div className="col-span-2">
                      <p className="text-xs text-gray-600">
                        {format(new Date(visit.admissionDate), "HH:mm")}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatDistanceToNow(new Date(visit.admissionDate), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>

                    {/* Status */}
                    <div className="col-span-1">
                      {reviewed ? (
                        <span
                          className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
                          style={{ background: "#f0fdf4", color: "#15803d" }}
                        >
                          Reviewed
                        </span>
                      ) : (
                        <span
                          className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
                          style={{ background: "#eff6ff", color: "#2563eb" }}
                        >
                          Pending
                        </span>
                      )}
                    </div>

                    <div className="col-span-1 flex justify-end">
                      <ChevronRight
                        size={16}
                        className="text-gray-300 group-hover:text-gray-500 transition-colors"
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
