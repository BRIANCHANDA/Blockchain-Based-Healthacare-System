"use client";
import { useEffect, useState, useCallback } from "react";
import { visitApi } from "@/lib/api";
import { ClipboardList, RefreshCw, Search, X } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

const PRIORITY_STYLE: Record<string, { bg: string; color: string }> = {
  critical: { bg: "#fef2f2", color: "#dc2626" },
  emergency: { bg: "#fff7ed", color: "#ea580c" },
  urgent: { bg: "#fffbeb", color: "#d97706" },
  routine: { bg: "#f0fdf4", color: "#16a34a" },
};

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  "in-progress": { bg: "#eff6ff", color: "#2563eb" },
  completed: { bg: "#f0fdf4", color: "#16a34a" },
  cancelled: { bg: "#fef2f2", color: "#dc2626" },
  scheduled: { bg: "#f5f3ff", color: "#7c3aed" },
};

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-50">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <td key={i} className="py-4 px-3">
          <div
            className="h-4 bg-gray-100 rounded animate-pulse"
            style={{ width: i === 1 ? "80%" : "60%" }}
          />
        </td>
      ))}
    </tr>
  );
}

export default function AdminVisitsPage() {
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await visitApi.getTodayQueue();
      setVisits(res.data.data?.visits ?? []);
    } catch {
      setVisits([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = search
    ? visits.filter((v) =>
        [
          v.visitNumber,
          v.chiefComplaint,
          v.priority,
          v.status,
          v.patient?.firstName,
          v.patient?.lastName,
        ].some((f) => f?.toLowerCase().includes(search.toLowerCase())),
      )
    : visits;

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl font-bold text-gray-900"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Visits
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Today's active visits — {visits.length} total
          </p>
        </div>
        <button
          onClick={() => load(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <RefreshCw
            className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
          />{" "}
          Refresh
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by patient, visit number, priority…"
            className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/10 focus:bg-white transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {Object.entries(PRIORITY_STYLE).map(([priority, style]) => {
          const count = visits.filter((v) => v.priority === priority).length;
          return (
            <div
              key={priority}
              className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3"
            >
              <p
                className="text-xs font-semibold uppercase tracking-wide mb-1"
                style={{ color: style.color }}
              >
                {priority}
              </p>
              <p className="text-2xl font-bold text-gray-900">{count}</p>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100">
                {[
                  "Patient",
                  "Visit No.",
                  "Chief Complaint",
                  "Priority",
                  "Status",
                  "Admitted",
                ].map((h, i) => (
                  <th
                    key={i}
                    className={`py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide ${i === 0 ? "pl-5 pr-3" : "px-3"}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <ClipboardList className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-gray-400">
                      No visits found
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((v) => {
                  const ps =
                    PRIORITY_STYLE[v.priority] ?? PRIORITY_STYLE.routine;
                  const ss = STATUS_STYLE[v.status] ?? {
                    bg: "#f3f4f6",
                    color: "#6b7280",
                  };
                  return (
                    <tr
                      key={v.id}
                      className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors"
                    >
                      <td className="py-3.5 pl-5 pr-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                            style={{
                              background:
                                "linear-gradient(135deg, #166534, #15803d)",
                            }}
                          >
                            {v.patient?.firstName?.[0]}
                            {v.patient?.lastName?.[0]}
                          </div>
                          <p className="text-sm font-semibold text-gray-800">
                            {v.patient
                              ? `${v.patient.firstName} ${v.patient.lastName}`
                              : "—"}
                          </p>
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="font-mono text-xs text-gray-600">
                          {v.visitNumber}
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        <p className="text-sm text-gray-600 truncate max-w-[180px]">
                          {v.chiefComplaint}
                        </p>
                      </td>
                      <td className="py-3.5 px-3">
                        <span
                          className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize"
                          style={{ background: ps.bg, color: ps.color }}
                        >
                          {v.priority}
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        <span
                          className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize"
                          style={{ background: ss.bg, color: ss.color }}
                        >
                          {v.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        <p className="text-xs text-gray-500">
                          {v.admissionDate
                            ? format(new Date(v.admissionDate), "dd MMM, HH:mm")
                            : "—"}
                        </p>
                        <p className="text-xs text-gray-400">
                          {v.admissionDate
                            ? formatDistanceToNow(new Date(v.admissionDate), {
                                addSuffix: true,
                              })
                            : ""}
                        </p>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
