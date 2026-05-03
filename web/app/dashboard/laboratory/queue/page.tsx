"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { visitApi } from "@/lib/api";
import {
  FlaskConical,
  Clock,
  ChevronRight,
  TriangleAlert,
  Loader2,
  RefreshCw,
  CheckCircle2,
  Search,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const URGENCY_CONFIG: Record<
  string,
  { color: string; bg: string; border: string; label: string; order: number }
> = {
  critical: {
    color: "#6D28D9",
    bg: "#EDE9FE",
    border: "#C4B5FD",
    label: "Critical",
    order: 1,
  },
  emergency: {
    color: "#C0392B",
    bg: "#FDECEA",
    border: "#F5C6C6",
    label: "Emergency",
    order: 2,
  },
  urgent: {
    color: "#C9952A",
    bg: "#FDF3DC",
    border: "#F0D080",
    label: "Urgent",
    order: 3,
  },
  routine: {
    color: "#0A6640",
    bg: "#E6F4EE",
    border: "#B3D9C8",
    label: "Routine",
    order: 4,
  },
};

const STATUS_CONFIG: Record<
  string,
  { color: string; bg: string; label: string }
> = {
  ordered: { color: "#C9952A", bg: "#FDF3DC", label: "Ordered" },
  collected: { color: "#1A6B8A", bg: "#E3F2F8", label: "Collected" },
  processing: { color: "#6D28D9", bg: "#EDE9FE", label: "Processing" },
};

// Normalize an order from either camelCase (Drizzle) or snake_case (raw SQL)
function normalizeOrder(o: any) {
  return {
    ...o,
    orderedAt: o.orderedAt ?? o.ordered_at ?? null,
    specimenType: o.specimenType ?? o.specimen_type ?? "",
    visitNumber: o.visitNumber ?? o.visit_number ?? "",
    testName: o.testName ?? o.test_name ?? "",
    testCode: o.testCode ?? o.test_code ?? "",
    orderNumber: o.orderNumber ?? o.order_number ?? "",
    chiefComplaint: o.chiefComplaint ?? o.chief_complaint ?? "",
  };
}

function safeDistance(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return formatDistanceToNow(d, { addSuffix: true });
}

export default function LabQueuePage() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<
    "all" | "critical" | "emergency" | "urgent" | "routine"
  >("all");

  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await (visitApi as any).getPendingLabOrders();
      const raw = res.data.data?.orders ?? [];
      setOrders(raw.map(normalizeOrder));
    } catch (_) {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(() => fetchOrders(true), 60_000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const filtered = orders
    .filter((o) => filter === "all" || o.urgency === filter)
    .filter((o) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return [o.testName, o.visitNumber, o.testCode, o.orderNumber].some((f) =>
        f?.toLowerCase().includes(q),
      );
    });

  const criticalCount = orders.filter((o) =>
    ["critical", "emergency"].includes(o.urgency),
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
            Lab Queue
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {orders.length} pending order{orders.length !== 1 ? "s" : ""} ·
            auto-refreshes every 60s
          </p>
        </div>
        <button
          onClick={() => fetchOrders(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />{" "}
          Refresh
        </button>
      </div>

      {/* Critical banner */}
      {criticalCount > 0 && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-red-50 border border-red-200">
          <TriangleAlert size={18} className="text-red-500 flex-shrink-0" />
          <p className="text-sm font-semibold text-red-800">
            {criticalCount} critical/emergency order
            {criticalCount > 1 ? "s" : ""} — process immediately
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
            placeholder="Search by test, visit number, order no…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm outline-none
              focus:border-green-500 focus:ring-2 focus:ring-green-500/10 placeholder:text-gray-400"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["all", "critical", "emergency", "urgent", "routine"] as const).map(
            (f) => {
              const cfg = f === "all" ? null : URGENCY_CONFIG[f];
              const count =
                f === "all"
                  ? orders.length
                  : orders.filter((o) => o.urgency === f).length;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold transition-all border"
                  style={
                    filter === f
                      ? {
                          background: cfg?.color ?? "#374151",
                          color: "#fff",
                          borderColor: "transparent",
                        }
                      : {
                          background: cfg?.bg ?? "#F3F4F6",
                          color: cfg?.color ?? "#374151",
                          borderColor: "transparent",
                        }
                  }
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)} ({count})
                </button>
              );
            },
          )}
        </div>
      </div>

      {/* Orders list */}
      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={28} className="text-green-600" />
          </div>
          <p className="text-gray-700 font-semibold">No orders found</p>
          <p className="text-gray-400 text-sm mt-1">
            {search
              ? "Try a different search term"
              : "All tests have been resulted"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const urgency =
              URGENCY_CONFIG[order.urgency] ?? URGENCY_CONFIG.routine;
            const status = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.ordered;
            return (
              <button
                key={order.id}
                onClick={() =>
                  router.push(`/dashboard/laboratory/queue/${order.id}`)
                }
                className="w-full bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-all text-left group"
                style={{ borderLeft: `4px solid ${urgency.color}` }}
              >
                <div className="flex items-center gap-4 p-4">
                  {/* Icon */}
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: urgency.bg }}
                  >
                    <FlaskConical size={20} style={{ color: urgency.color }} />
                  </div>

                  {/* Main */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-bold text-gray-900">
                        {order.testName}
                      </p>
                      <span className="text-xs font-mono font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                        {order.testCode}
                      </span>
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: urgency.bg,
                          color: urgency.color,
                        }}
                      >
                        {urgency.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-xs text-gray-500 font-medium">
                        {order.visitNumber}
                      </span>
                      <span className="text-xs text-gray-300">·</span>
                      <span className="text-xs text-gray-500 capitalize">
                        {order.specimenType}
                      </span>
                      <span className="text-xs text-gray-300">·</span>
                      <span className="text-xs text-gray-500">
                        {order.orderNumber}
                      </span>
                    </div>
                    {order.chiefComplaint && (
                      <p className="text-xs text-gray-400 mt-1 truncate italic">
                        "{order.chiefComplaint}"
                      </p>
                    )}
                  </div>

                  {/* Right side */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: status.bg,
                        color: status.color,
                      }}
                    >
                      {status.label}
                    </span>
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock size={11} />
                      {safeDistance(order.orderedAt)}
                    </div>
                    <ChevronRight
                      size={16}
                      className="text-gray-300 group-hover:text-gray-600 transition-colors"
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
