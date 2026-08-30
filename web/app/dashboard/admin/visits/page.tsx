"use client";
import { useEffect, useState, useCallback } from "react";
import { visitApi } from "@/lib/api";
import { ClipboardList, RefreshCw, Search, X } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

const PRIORITY_STYLE: Record<string, { bg: string; color: string }> = {
  critical: { bg: "var(--coral-050)", color: "var(--critical-ink)" },
  emergency: { bg: "var(--coral-050)", color: "var(--critical-ink)" },
  urgent: { bg: "var(--amber-050)", color: "var(--urgent-ink)" },
  routine: { bg: "var(--brand-tint)", color: "var(--success-ink)" },
};

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  "in-progress": { bg: "var(--info-tint)", color: "var(--blue-600)" },
  completed: { bg: "var(--brand-tint)", color: "var(--success-ink)" },
  cancelled: { bg: "var(--coral-050)", color: "var(--critical-ink)" },
  scheduled: { bg: "var(--violet-050)", color: "var(--accent-ink)" },
};

function SkeletonRow() {
  return (
    <tr className="border-b border-[var(--border-faint)]">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <td key={i} className="py-4 px-3">
          <div
            className="h-4 bg-[var(--surface-sunken)] rounded animate-pulse"
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
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ margin: 0, font: "700 27px/1.1 var(--font-sans)", letterSpacing: "var(--ls-tight)", color: "var(--text-primary)" }}>
            Visits
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            Today's active visits — {visits.length} total
          </p>
        </div>
        <button
          onClick={() => load(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-[var(--r-sm)] border border-[var(--hc-border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] transition-colors"
        >
          <RefreshCw
            className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
          />{" "}
          Refresh
        </button>
      </div>

      {/* Search */}
      <div className="bg-[var(--surface-card)] rounded-[var(--r-lg)] border border-[var(--border-faint)] shadow-[var(--elev-1)] p-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by patient, visit number, priority…"
            className="w-full pl-10 pr-10 py-2.5 rounded-[var(--r-sm)] border border-[var(--hc-border)] bg-[var(--surface-sunken)] text-sm outline-none focus:border-[var(--green-600)] focus:ring-2 focus:ring-[var(--green-600)] focus:bg-[var(--surface-card)] transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
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
              className="bg-[var(--surface-card)] rounded-[var(--r-sm)] border border-[var(--border-faint)] shadow-[var(--elev-1)] px-4 py-3"
            >
              <p
                className="text-xs font-semibold uppercase tracking-wide mb-1"
                style={{ color: style.color }}
              >
                {priority}
              </p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">{count}</p>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-[var(--surface-card)] rounded-[var(--r-lg)] border border-[var(--border-faint)] shadow-[var(--elev-1)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[var(--border-faint)]">
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
                    className={`py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide ${i === 0 ? "pl-5 pr-3" : "px-3"}`}
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
                    <ClipboardList className="w-10 h-10 text-[var(--text-disabled)] mx-auto mb-3" />
                    <p className="text-sm font-semibold text-[var(--text-muted)]">
                      No visits found
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((v) => {
                  const ps =
                    PRIORITY_STYLE[v.priority] ?? PRIORITY_STYLE.routine;
                  const ss = STATUS_STYLE[v.status] ?? {
                    bg: "var(--surface-sunken)",
                    color: "var(--text-secondary)",
                  };
                  return (
                    <tr
                      key={v.id}
                      className="border-b border-[var(--border-faint)] hover:bg-[var(--surface-sunken)] transition-colors"
                    >
                      <td className="py-3.5 pl-5 pr-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-[var(--white)] flex-shrink-0"
                            style={{
                              background:
                                "var(--brand)",
                            }}
                          >
                            {v.patient?.firstName?.[0]}
                            {v.patient?.lastName?.[0]}
                          </div>
                          <p className="text-sm font-semibold text-[var(--text-primary)]">
                            {v.patient
                              ? `${v.patient.firstName} ${v.patient.lastName}`
                              : "—"}
                          </p>
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="font-mono text-xs text-[var(--text-secondary)]">
                          {v.visitNumber}
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        <p className="text-sm text-[var(--text-secondary)] truncate max-w-[180px]">
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
                        <p className="text-xs text-[var(--text-secondary)]">
                          {v.admissionDate
                            ? format(new Date(v.admissionDate), "dd MMM, HH:mm")
                            : "—"}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
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
