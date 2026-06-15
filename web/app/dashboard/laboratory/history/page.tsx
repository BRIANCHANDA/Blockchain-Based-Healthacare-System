// web/src/app/dashboard/laboratory/history/page.tsx

"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { labApi } from "@/lib/api";
import {
  FlaskConical,
  Clock,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Search,
  TrendingUp,
  ClipboardList,
  User,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface ResultedTest {
  resultId: string;
  resultedAt: string;
  interpretation: string | null;
  hasAbnormal: boolean;
  abnormalFindings: string | null;
  parameterCount: number;
  order: {
    id: string;
    orderNumber: string;
    testName: string;
    testCategory: string | null;
    urgency: string;
    specimenType: string;
  };
  patient: { id: string; fullName: string };
  visit: { visitNumber: string };
}

const URGENCY: Record<string, { color: string; bg: string; label: string }> = {
  critical: { color: "#6D28D9", bg: "#EDE9FE", label: "Critical" },
  emergency: { color: "#C0392B", bg: "#FDECEA", label: "Emergency" },
  urgent: { color: "#C9952A", bg: "#FDF3DC", label: "Urgent" },
  routine: { color: "#0A6640", bg: "#E6F4EE", label: "Routine" },
};

function safeDistance(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return formatDistanceToNow(d, { addSuffix: true });
}

export default function LabHistoryPage() {
  const router = useRouter();
  const [results, setResults] = useState<ResultedTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "abnormal" | "normal">("all");

  const fetchPage = useCallback(
    async (silent = false, append = false) => {
      if (!append) {
        if (silent) setRefreshing(true);
        else setLoading(true);
      } else {
        setLoadingMore(true);
      }
      try {
        const res = await labApi.getMyResults({
          limit: 30,
          offset: append ? offset : 0,
        });
        const data = res.data?.data?.results ?? [];
        setHasMore(res.data?.data?.hasMore ?? false);
        if (append) {
          setResults((prev) => [...prev, ...data]);
          setOffset((o) => o + data.length);
        } else {
          setResults(data);
          setOffset(data.length);
        }
      } catch {
        if (!append) setResults([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [offset],
  );

  useEffect(() => {
    fetchPage();
  }, []);

  // Filter
  const filtered = useMemo(() => {
    let xs = results;
    if (filter === "abnormal") xs = xs.filter((r) => r.hasAbnormal);
    else if (filter === "normal") xs = xs.filter((r) => !r.hasAbnormal);
    if (search) {
      const q = search.toLowerCase();
      xs = xs.filter(
        (r) =>
          r.order.testName.toLowerCase().includes(q) ||
          r.patient.fullName.toLowerCase().includes(q) ||
          r.order.orderNumber.toLowerCase().includes(q) ||
          r.visit.visitNumber.toLowerCase().includes(q),
      );
    }
    return xs;
  }, [results, filter, search]);

  // Group by date
  const grouped = useMemo(() => {
    const map: Record<string, ResultedTest[]> = {};
    for (const r of filtered) {
      const d = new Date(r.resultedAt);
      const key = isNaN(d.getTime())
        ? "Unknown date"
        : format(d, "EEEE, d MMMM yyyy");
      (map[key] ??= []).push(r);
    }
    return Object.entries(map);
  }, [filtered]);

  const totalAbnormal = results.filter((r) => r.hasAbnormal).length;
  const today = results.filter((r) => {
    const d = new Date(r.resultedAt);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  }).length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 gap-3">
        <Loader2 size={28} className="animate-spin text-green-700" />
        <p className="text-sm text-gray-400">Loading your results…</p>
      </div>
    );
  }

  return (
    <div
      className="max-w-4xl mx-auto space-y-5"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold text-gray-900"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            My Results
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Tests you have resulted, newest first
          </p>
        </div>
        <button
          onClick={() => fetchPage(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />{" "}
          Refresh
        </button>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: "Total resulted",
            value: results.length,
            color: "#166534",
            bg: "linear-gradient(135deg,#f0fdf4,#dcfce7)",
            border: "#bbf7d0",
            icon: CheckCircle2,
          },
          {
            label: "Today",
            value: today,
            color: "#1d4ed8",
            bg: "linear-gradient(135deg,#eff6ff,#dbeafe)",
            border: "#bfdbfe",
            icon: TrendingUp,
          },
          {
            label: "Abnormal flagged",
            value: totalAbnormal,
            color: totalAbnormal > 0 ? "#dc2626" : "#9ca3af",
            bg:
              totalAbnormal > 0
                ? "linear-gradient(135deg,#fef2f2,#fee2e2)"
                : "linear-gradient(135deg,#f9fafb,#f3f4f6)",
            border: totalAbnormal > 0 ? "#fecaca" : "#e5e7eb",
            icon: AlertTriangle,
          },
        ].map(({ label, value, color, bg, border, icon: Icon }) => (
          <div
            key={label}
            className="rounded-2xl border p-4"
            style={{ background: bg, borderColor: border }}
          >
            <div className="flex items-center justify-between mb-2">
              <p
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color, opacity: 0.7 }}
              >
                {label}
              </p>
              <Icon className="w-3.5 h-3.5" style={{ color }} />
            </div>
            <p
              className="text-2xl font-extrabold tabular-nums"
              style={{ color }}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by test, patient, order no…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/10 placeholder:text-gray-400"
          />
        </div>
        <div className="flex gap-2">
          {(
            [
              {
                key: "all",
                label: "All",
                color: "#374151",
                count: results.length,
              },
              {
                key: "abnormal",
                label: "Abnormal",
                color: "#dc2626",
                count: totalAbnormal,
              },
              {
                key: "normal",
                label: "Normal",
                color: "#166534",
                count: results.length - totalAbnormal,
              },
            ] as const
          ).map((opt) => (
            <button
              key={opt.key}
              onClick={() => setFilter(opt.key)}
              className="px-3 py-2 rounded-xl text-xs font-semibold transition-all border"
              style={
                filter === opt.key
                  ? {
                      background: opt.color,
                      color: "#fff",
                      borderColor: "transparent",
                    }
                  : {
                      background: "#fff",
                      color: opt.color,
                      borderColor: "#e5e7eb",
                    }
              }
            >
              {opt.label} ({opt.count})
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-4">
            <ClipboardList size={28} className="text-green-600" />
          </div>
          <p className="text-gray-700 font-semibold">
            {results.length === 0 ? "No resulted tests yet" : "No matches"}
          </p>
          <p className="text-gray-400 text-sm mt-1">
            {results.length === 0
              ? "Once you result a test, it will appear here."
              : "Try a different search or filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([date, items]) => (
            <div key={date}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
                  {date}
                </p>
                <div className="h-px bg-gray-100 flex-1" />
                <span className="text-xs font-bold text-gray-400">
                  {items.length}
                </span>
              </div>
              <div className="space-y-2">
                {items.map((r) => {
                  const urg = URGENCY[r.order.urgency] ?? URGENCY.routine;
                  return (
                    <button
                      key={r.resultId}
                      onClick={() =>
                        router.push(`/dashboard/laboratory/queue/${r.order.id}`)
                      }
                      className="w-full bg-white rounded-2xl border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all text-left overflow-hidden group"
                      style={{ borderLeft: `4px solid ${urg.color}` }}
                    >
                      <div className="flex items-center gap-4 p-4">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: urg.bg }}
                        >
                          <FlaskConical
                            size={18}
                            style={{ color: urg.color }}
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <p className="text-sm font-bold text-gray-900">
                              {r.order.testName}
                            </p>
                            <span
                              className="text-xs font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: urg.bg, color: urg.color }}
                            >
                              {urg.label}
                            </span>
                            {r.hasAbnormal && (
                              <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-100">
                                <AlertTriangle size={10} /> Abnormal
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                            <User size={11} className="text-gray-400" />
                            <span className="font-semibold text-gray-700">
                              {r.patient.fullName}
                            </span>
                            <span className="text-gray-300">·</span>
                            <span>{r.visit.visitNumber}</span>
                            <span className="text-gray-300">·</span>
                            <span className="font-mono text-gray-400">
                              {r.order.orderNumber}
                            </span>
                            <span className="text-gray-300">·</span>
                            <span className="capitalize">
                              {r.order.specimenType}
                            </span>
                          </div>
                          {r.interpretation && (
                            <p className="text-xs text-gray-500 mt-1 truncate italic">
                              "{r.interpretation}"
                            </p>
                          )}
                        </div>

                        <div className="hidden sm:flex flex-col items-end gap-1 flex-shrink-0">
                          <span className="text-xs font-semibold text-gray-700">
                            {r.parameterCount}{" "}
                            {r.parameterCount === 1
                              ? "parameter"
                              : "parameters"}
                          </span>
                          <span className="text-xs flex items-center gap-1 text-gray-400">
                            <Clock size={11} /> {safeDistance(r.resultedAt)}
                          </span>
                        </div>

                        <ChevronRight
                          size={16}
                          className="text-gray-200 group-hover:text-green-600 transition-colors flex-shrink-0"
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Load more */}
          {hasMore && (
            <button
              onClick={() => fetchPage(false, true)}
              disabled={loadingMore}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {loadingMore ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <ChevronRight size={14} />
              )}
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
