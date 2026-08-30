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
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  Page,
  PageHeader,
  Card,
  Pill as Badge,
  MonoTag,
  Button,
  Banner,
  EmptyState,
  SearchInput,
  SegmentedControl,
  TONES,
} from "@/components/dashboard/ui";
import { getUrgency, getStatus, normalizeOrder } from "../vocab";

/* ==========================================================================
   Lab queue — every order awaiting the laboratory.

   Urgency drives the whole visual hierarchy: the left edge, the icon tint and
   the pill all come from one decision, so a critical order cannot look
   routine in one place and urgent in another.
   ========================================================================== */

function safeDistance(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return formatDistanceToNow(d, { addSuffix: true });
}

type FilterKey = "all" | "critical" | "emergency" | "urgent" | "routine";

export default function LabQueuePage() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

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

  const countFor = (f: FilterKey) =>
    f === "all" ? orders.length : orders.filter((o) => o.urgency === f).length;

  const isFiltered = !!search || filter !== "all";

  if (loading) {
    return (
      <div
        className="flex flex-col items-center justify-center"
        style={{ minHeight: 256, gap: 12 }}
      >
        <Loader2 className="w-7 h-7 animate-spin" style={{ color: "var(--brand)" }} />
        <p
          style={{
            margin: 0,
            font: "400 13px/1 var(--font-sans)",
            color: "var(--text-muted)",
          }}
        >
          Loading queue…
        </p>
      </div>
    );
  }

  return (
    <Page maxWidth={1000}>
      <PageHeader
        eyebrow="Laboratory"
        title="Sample queue"
        subtitle={`${orders.length} pending order${
          orders.length !== 1 ? "s" : ""
        } · auto-refreshes every 60 seconds`}
        actions={
          <Button icon={RefreshCw} onClick={() => fetchOrders(true)} disabled={refreshing}>
            Refresh
          </Button>
        }
      />

      {criticalCount > 0 && (
        <Banner tone="critical" icon={TriangleAlert}>
          {criticalCount} critical or emergency order
          {criticalCount > 1 ? "s" : ""} — process immediately.
        </Banner>
      )}

      {/* Search + filter */}
      <div className="flex items-center justify-between flex-wrap" style={{ gap: 12 }}>
        <SegmentedControl<FilterKey>
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: countFor("all") },
            { value: "critical", label: "Critical", count: countFor("critical") },
            { value: "emergency", label: "Emergency", count: countFor("emergency") },
            { value: "urgent", label: "Urgent", count: countFor("urgent") },
            { value: "routine", label: "Routine", count: countFor("routine") },
          ]}
        />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search test, visit number, order no…"
          icon={Search}
          clearIcon={X}
          style={{ flex: "1 1 220px", maxWidth: 340 }}
        />
      </div>

      {/* Orders list */}
      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={CheckCircle2}
            title="No orders found"
            message={
              isFiltered
                ? "No orders match the current filters."
                : "All tests have been resulted."
            }
            pad={64}
          />
        </Card>
      ) : (
        <div className="flex flex-col" style={{ gap: 12 }}>
          {filtered.map((order) => {
            const u = getUrgency(order.urgency);
            const st = getStatus(order.status);
            const uTone = TONES[u.tone];

            return (
              <button
                key={order.id}
                onClick={() => router.push(`/dashboard/laboratory/queue/${order.id}`)}
                className="w-full text-left"
                style={{
                  background: "var(--surface-card)",
                  border: "1px solid var(--hc-border)",
                  // The left edge carries urgency at a glance.
                  borderLeft: `4px solid ${uTone.dot}`,
                  borderRadius: "var(--r-md)",
                  boxShadow: "var(--elev-1)",
                  overflow: "hidden",
                  cursor: "pointer",
                  transition: "box-shadow var(--dur-base) var(--ease-standard)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "var(--elev-2)")}
                onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "var(--elev-1)")}
              >
                <div className="flex items-center" style={{ gap: 14, padding: 16 }}>
                  <span
                    className="inline-flex items-center justify-center flex-shrink-0"
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "var(--r-sm)",
                      background: uTone.tint,
                      color: uTone.ink,
                    }}
                  >
                    <FlaskConical className="w-5 h-5" />
                  </span>

                  <span className="flex-1 min-w-0 flex flex-col" style={{ gap: 6 }}>
                    <span className="flex items-center flex-wrap" style={{ gap: 8 }}>
                      <span
                        style={{
                          font: "700 13.5px/1 var(--font-sans)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {order.testName}
                      </span>
                      <MonoTag style={{ height: 18, fontSize: 10 }}>
                        {order.testCode}
                      </MonoTag>
                      <Badge tone={u.tone} style={{ height: 18, fontSize: 10 }}>
                        {u.label}
                      </Badge>
                    </span>

                    <span
                      className="flex items-center flex-wrap"
                      style={{
                        gap: 8,
                        font: "400 12px/1 var(--font-sans)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      <span>{order.visitNumber}</span>
                      <span style={{ color: "var(--text-disabled)" }}>·</span>
                      <span style={{ textTransform: "capitalize" }}>
                        {order.specimenType}
                      </span>
                      <span style={{ color: "var(--text-disabled)" }}>·</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
                        {order.orderNumber}
                      </span>
                    </span>

                    {order.chiefComplaint && (
                      <span
                        className="truncate"
                        style={{
                          font: "400 12px/1.3 var(--font-sans)",
                          color: "var(--text-muted)",
                          fontStyle: "italic",
                        }}
                      >
                        “{order.chiefComplaint}”
                      </span>
                    )}
                  </span>

                  <span
                    className="flex flex-col items-end flex-shrink-0"
                    style={{ gap: 7 }}
                  >
                    <Badge tone={st.tone}>{st.label}</Badge>
                    <span
                      className="inline-flex items-center"
                      style={{
                        gap: 5,
                        font: "500 11.5px/1 var(--font-mono)",
                        color: "var(--text-muted)",
                      }}
                    >
                      <Clock className="w-3 h-3" />
                      {safeDistance(order.orderedAt)}
                    </span>
                  </span>

                  <ChevronRight
                    className="w-4 h-4 flex-shrink-0"
                    style={{ color: "var(--text-disabled)" }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Page>
  );
}
