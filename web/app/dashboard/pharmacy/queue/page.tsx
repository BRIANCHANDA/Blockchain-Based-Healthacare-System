"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { visitApi } from "@/lib/api";
import {
  Pill,
  Clock,
  ChevronRight,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Search,
  AlertCircle,
  Package,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

const STATUS_CONFIG: Record<
  string,
  { color: string; bg: string; label: string }
> = {
  prescribed: { color: "#C9952A", bg: "#FDF3DC", label: "Prescribed" },
  dispensing: { color: "#1A6B8A", bg: "#E3F2F8", label: "In Progress" },
};

export default function PharmacyQueuePage() {
  const router = useRouter();
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "prescribed" | "dispensing">(
    "all",
  );

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await (visitApi as any).getPendingPrescriptions();
      setPrescriptions(res.data.data?.prescriptions ?? []);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const filtered = prescriptions
    .filter((p) => filter === "all" || p.status === filter)
    .filter(
      (p) =>
        !search ||
        p.prescriptionNumber?.toLowerCase().includes(search.toLowerCase()) ||
        p.visitNumber?.toLowerCase().includes(search.toLowerCase()),
    );

  const longWaiting = prescriptions.filter(
    (p) => Date.now() - new Date(p.prescribedAt).getTime() > 30 * 60 * 1000,
  ).length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 gap-3">
        <Loader2 size={28} className="animate-spin text-green-700" />
        <p className="text-sm text-gray-400">Loading queue…</p>
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
            Dispensing Queue
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {prescriptions.length} prescription
            {prescriptions.length !== 1 ? "s" : ""} pending · auto-refreshes
            every 60s
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />{" "}
          Refresh
        </button>
      </div>

      {/* Long-waiting alert */}
      {longWaiting > 0 && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200">
          <AlertCircle size={18} className="text-amber-500 flex-shrink-0" />
          <p className="text-sm font-semibold text-amber-800">
            {longWaiting} prescription{longWaiting > 1 ? "s have" : " has"} been
            waiting over 30 minutes
          </p>
        </div>
      )}

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
            placeholder="Search by prescription no. or visit number…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm outline-none
              focus:border-green-500 focus:ring-2 focus:ring-green-500/10 placeholder:text-gray-400"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "prescribed", "dispensing"] as const).map((f) => {
            const cfg = f === "all" ? null : STATUS_CONFIG[f];
            const count =
              f === "all"
                ? prescriptions.length
                : prescriptions.filter((p) => p.status === f).length;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                style={
                  filter === f
                    ? { background: cfg?.color ?? "#374151", color: "#fff" }
                    : {
                        background: cfg?.bg ?? "#F3F4F6",
                        color: cfg?.color ?? "#374151",
                      }
                }
              >
                {f === "all" ? "All" : cfg?.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Queue list */}
      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={28} className="text-green-600" />
          </div>
          <p className="text-gray-700 font-semibold">Queue is clear</p>
          <p className="text-gray-400 text-sm mt-1">
            {search
              ? "No results found"
              : "All prescriptions have been dispensed"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((rx) => {
            const cfg = STATUS_CONFIG[rx.status] ?? STATUS_CONFIG.prescribed;
            const waited = Date.now() - new Date(rx.prescribedAt).getTime();
            const isOld = waited > 30 * 60 * 1000;
            const isVeryOld = waited > 60 * 60 * 1000;
            return (
              <button
                key={rx.id}
                onClick={() =>
                  router.push(`/dashboard/pharmacy/queue/${rx.id}`)
                }
                className="w-full bg-white rounded-2xl overflow-hidden border hover:shadow-md transition-all text-left group"
                style={{
                  borderColor: isVeryOld
                    ? "#F5C6C6"
                    : isOld
                      ? "#F0D080"
                      : "#F3F4F6",
                  borderLeft: `4px solid ${isVeryOld ? "#C0392B" : isOld ? "#C9952A" : "#0A6640"}`,
                }}
              >
                <div className="flex items-center gap-4 p-4">
                  {/* Icon */}
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: isVeryOld
                        ? "#FDECEA"
                        : isOld
                          ? "#FDF3DC"
                          : "#E6F4EE",
                    }}
                  >
                    <Pill
                      size={22}
                      style={{
                        color: isVeryOld
                          ? "#C0392B"
                          : isOld
                            ? "#C9952A"
                            : "#0A6640",
                      }}
                    />
                  </div>

                  {/* Main */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-bold text-gray-900 font-mono">
                        {rx.prescriptionNumber}
                      </p>
                      {isVeryOld && (
                        <span className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                          <AlertCircle size={10} /> Urgent
                        </span>
                      )}
                      {isOld && !isVeryOld && (
                        <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                          Waiting long
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">
                        {rx.visitNumber}
                      </span>
                      <span className="text-xs text-gray-300">·</span>
                      <span className="text-xs text-gray-500">
                        {rx.pendingItems} of {rx.totalItems} item
                        {rx.totalItems != 1 ? "s" : ""} pending
                      </span>
                    </div>
                    {rx.chiefComplaint && (
                      <p className="text-xs text-gray-400 italic truncate mt-0.5">
                        "{rx.chiefComplaint}"
                      </p>
                    )}
                  </div>

                  {/* Right */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: cfg.bg, color: cfg.color }}
                    >
                      {cfg.label}
                    </span>
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock size={11} />
                      {rx.prescribedAt &&
                      !isNaN(new Date(rx.prescribedAt).getTime())
                        ? formatDistanceToNow(new Date(rx.prescribedAt), {
                            addSuffix: true,
                          })
                        : "Unknown"}
                    </div>
                    <ChevronRight
                      size={16}
                      className="text-gray-300 group-hover:text-gray-600 transition-colors"
                    />
                  </div>
                </div>

                {/* Item progress bar */}
                {rx.totalItems > 0 && (
                  <div className="px-4 pb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-400">
                        Dispensing progress
                      </span>
                      <span className="text-xs font-semibold text-gray-600">
                        {rx.totalItems - rx.pendingItems}/{rx.totalItems}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-green-500 transition-all"
                        style={{
                          width: `${((rx.totalItems - rx.pendingItems) / rx.totalItems) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
