"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { visitApi, labStatsApi } from "@/lib/api";
import {
  FlaskConical,
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ArrowRight,
  Clock,
  RefreshCw,
  TrendingUp,
  Activity,
  History,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  Page,
  PageHeader,
  Card,
  CardHeader,
  KpiCard,
  KpiGrid,
  Pill as Badge,
  Button,
  LinkAction,
  Banner,
  EmptyState,
  SkeletonRow,
  SkeletonBlock,
  hoverRow,
  TONES,
} from "@/components/dashboard/ui";
import {
  getUrgency,
  URGENCY_ORDER,
  timeSince,
  formatTurnaround,
  normalizeOrder,
} from "./vocab";

/* ==========================================================================
   Laboratory overview.

   Styling follows the HealthChain design system (app/design-tokens.css);
   layout primitives come from components/dashboard/ui.tsx and the domain
   vocabulary (urgency / status / specimen labels) from ./vocab.

   Recharts renders SVG presentation attributes, which accept var() the same
   way CSS does, so chart colours reference the same tokens as the page.
   ========================================================================== */

const AXIS_TICK = { fontSize: 10, fill: "var(--text-muted)" };
const TOOLTIP_STYLE = {
  borderRadius: 10,
  border: "1px solid var(--hc-border)",
  boxShadow: "var(--elev-2)",
  fontFamily: "var(--font-sans)",
  fontSize: 12,
};

export default function LabOverviewPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<any>(null);
  const [myStats, setMyStats] = useState<any>(null);
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      // allSettled: one failing stat endpoint must not blank the queue.
      const [a, b, c] = await Promise.allSettled([
        labStatsApi.getOverview(),
        labStatsApi.getMyStats(),
        (visitApi as any).getPendingLabOrders(),
      ]);
      if (a.status === "fulfilled") setStats(a.value.data.data);
      if (b.status === "fulfilled") setMyStats(b.value.data.data);
      if (c.status === "fulfilled") {
        const raw = c.value.data.data?.orders ?? [];
        setPending(raw.map(normalizeOrder));
      }
    } catch (_) {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const criticalCount = stats?.criticalCount ?? 0;
  const totalPending = stats?.totalPending ?? 0;
  const resultedToday = stats?.resultedToday ?? 0;
  const abnormalToday = stats?.abnormalToday ?? 0;

  const sortedPending = [...pending].sort(
    (a, b) => (URGENCY_ORDER[a.urgency] ?? 9) - (URGENCY_ORDER[b.urgency] ?? 9),
  );

  /*
   * The overview query selects COUNT(...) without an ::int cast, so Postgres
   * returns bigint and the driver hands back strings. Recharts needs numbers
   * for the Y scale, so coerce here rather than plotting silently-broken axes.
   */
  const weekly = (stats?.weeklyActivity ?? []).map((d: any) => ({
    ...d,
    ordered: Number(d.ordered ?? 0),
    resulted: Number(d.resulted ?? 0),
  }));

  return (
    <Page>
      <PageHeader
        eyebrow="Laboratory"
        title={(user as any)?.institutionName || "Laboratory"}
        subtitle={
          loading
            ? "Loading queue…"
            : `${totalPending} order${totalPending !== 1 ? "s" : ""} awaiting processing`
        }
        actions={
          <>
            <Button
              variant="primary"
              icon={FlaskConical}
              onClick={() => router.push("/dashboard/laboratory/queue")}
            >
              Open queue
            </Button>
            <Button
              icon={ClipboardList}
              onClick={() => router.push("/dashboard/laboratory/history")}
            >
              My results
            </Button>
            <Button
              icon={RefreshCw}
              onClick={() => fetchData(true)}
              disabled={refreshing}
              style={{ padding: 0, width: 38 }}
            />
          </>
        }
      />

      {/* Critical orders are the one thing that cannot wait for a scroll. */}
      {!loading && criticalCount > 0 && (
        <Banner
          tone="critical"
          icon={AlertTriangle}
          onClick={() => router.push("/dashboard/laboratory/queue")}
          action={
            <span
              className="inline-flex items-center whitespace-nowrap"
              style={{
                gap: 4,
                font: "700 12.5px/1 var(--font-sans)",
                color: "var(--critical-ink)",
              }}
            >
              Open queue
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          }
        >
          {criticalCount} order{criticalCount > 1 ? "s" : ""} marked critical or
          urgent need immediate attention.
        </Banner>
      )}

      <KpiGrid>
        <KpiCard
          label="Pending orders"
          value={totalPending}
          sub="Awaiting processing"
          icon={FlaskConical}
          tone="urgent"
          loading={loading}
          onClick={() => router.push("/dashboard/laboratory/queue")}
        />
        <KpiCard
          label="Critical / urgent"
          value={criticalCount}
          sub="Need attention now"
          icon={AlertTriangle}
          tone="critical"
          loading={loading}
          onClick={() => router.push("/dashboard/laboratory/queue")}
        />
        <KpiCard
          label="Resulted today"
          value={resultedToday}
          sub="Released to clinicians"
          icon={CheckCircle2}
          tone="success"
          loading={loading}
        />
        <KpiCard
          label="Abnormal today"
          value={abnormalToday}
          sub="Flagged out of range"
          icon={TrendingUp}
          tone="accent"
          loading={loading}
        />
      </KpiGrid>

      {/* Activity + urgency mix */}
      <div className="flex flex-wrap" style={{ gap: 16, alignItems: "flex-start" }}>
        <div style={{ flex: "2 1 460px", minWidth: 0 }}>
          <Card>
            <CardHeader
              icon={Activity}
              title="7-day activity"
              right={
                <div className="hidden sm:flex items-center" style={{ gap: 14 }}>
                  {[
                    { label: "Ordered", color: "var(--amber-500)" },
                    { label: "Resulted", color: "var(--green-700)" },
                  ].map(({ label, color }) => (
                    <span
                      key={label}
                      className="inline-flex items-center"
                      style={{ gap: 6 }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: color,
                        }}
                      />
                      <span
                        style={{
                          font: "500 11.5px/1 var(--font-sans)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {label}
                      </span>
                    </span>
                  ))}
                </div>
              }
            />
            <div style={{ padding: "16px 8px", height: 224 }}>
              {loading ? (
                <div style={{ margin: "0 12px" }}>
                  <SkeletonBlock height={192} />
                </div>
              ) : weekly.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={weekly}
                    margin={{ top: 4, right: 12, left: -22, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="labOrdered" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor="var(--amber-500)"
                          stopOpacity={0.24}
                        />
                        <stop
                          offset="100%"
                          stopColor="var(--amber-500)"
                          stopOpacity={0}
                        />
                      </linearGradient>
                      <linearGradient id="labResulted" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor="var(--green-700)"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="100%"
                          stopColor="var(--green-700)"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border-100)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tick={AXIS_TICK}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => (v ? format(new Date(v), "EEE") : v)}
                    />
                    <YAxis
                      tick={AXIS_TICK}
                      axisLine={false}
                      tickLine={false}
                      width={38}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      labelFormatter={(v) => (v ? format(new Date(v), "EEE d MMM") : v)}
                    />
                    <Area
                      type="monotone"
                      dataKey="ordered"
                      name="Ordered"
                      stroke="var(--amber-500)"
                      fill="url(#labOrdered)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="resulted"
                      name="Resulted"
                      stroke="var(--green-700)"
                      fill="url(#labResulted)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div
                  className="h-full flex items-center justify-center"
                  style={{
                    font: "400 13px/1 var(--font-sans)",
                    color: "var(--text-muted)",
                  }}
                >
                  No activity in the last 7 days
                </div>
              )}
            </div>
          </Card>
        </div>

        <div style={{ flex: "1 1 280px", minWidth: 260 }}>
          <Card>
            <CardHeader icon={AlertTriangle} title="Queue by urgency" />
            <div style={{ padding: 14 }}>
              {["critical", "emergency", "urgent", "routine"].map((u) => {
                const count = stats?.pendingByUrgency?.[u] ?? 0;
                const cfg = getUrgency(u);
                const dot = TONES[cfg.tone].dot;
                // Share of the whole pending queue, not of the largest bar.
                const pct = totalPending > 0 ? (count / totalPending) * 100 : 0;

                return (
                  <div key={u} style={{ padding: "8px 4px" }}>
                    <div
                      className="flex items-center"
                      style={{ gap: 8, marginBottom: 6 }}
                    >
                      <span
                        className="flex-shrink-0"
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: dot,
                        }}
                      />
                      <span
                        className="flex-1 truncate"
                        style={{
                          font: "500 12.5px/1 var(--font-sans)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {cfg.label}
                      </span>
                      <span
                        style={{
                          font: "700 13px/1 var(--font-sans)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {loading ? "—" : count}
                      </span>
                    </div>

                    <div
                      style={{
                        height: 5,
                        borderRadius: "var(--r-pill)",
                        background: "var(--surface-sunken)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${pct}%`,
                          borderRadius: "var(--r-pill)",
                          background: dot,
                          transition: "width var(--dur-slow) var(--ease-out)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      {/* Worklist + performance */}
      <div className="flex flex-wrap" style={{ gap: 16, alignItems: "flex-start" }}>
        <div style={{ flex: "2 1 460px", minWidth: 0 }}>
          <Card>
            <CardHeader
              icon={ClipboardList}
              title="Pending orders"
              subtitle="Most urgent first"
              right={
                sortedPending.length > 0 ? (
                  <LinkAction onClick={() => router.push("/dashboard/laboratory/queue")}>
                    View all
                  </LinkAction>
                ) : undefined
              }
            />

            {loading ? (
              [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
            ) : sortedPending.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="The queue is clear"
                message="New lab orders will appear here."
              />
            ) : (
              <>
                {sortedPending.slice(0, 8).map((order: any) => {
                  const u = getUrgency(order.urgency);
                  const uTone = TONES[u.tone];

                  return (
                    <button
                      key={order.id}
                      onClick={() =>
                        router.push(`/dashboard/laboratory/queue/${order.id}`)
                      }
                      className="w-full flex items-center text-left"
                      style={{
                        gap: 12,
                        padding: "12px 20px",
                        border: "none",
                        borderBottom: "1px solid var(--border-faint)",
                        background: "transparent",
                        cursor: "pointer",
                        transition: "background var(--dur-fast) var(--ease-standard)",
                      }}
                      {...hoverRow}
                    >
                      <span
                        className="inline-flex items-center justify-center flex-shrink-0"
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: "var(--r-sm)",
                          background: uTone.tint,
                          color: uTone.ink,
                        }}
                      >
                        <FlaskConical className="w-4 h-4" />
                      </span>

                      <span className="flex-1 min-w-0 flex flex-col" style={{ gap: 5 }}>
                        <span className="flex items-center flex-wrap" style={{ gap: 8 }}>
                          <span
                            className="truncate"
                            style={{
                              font: "600 13.5px/1 var(--font-sans)",
                              color: "var(--text-primary)",
                            }}
                          >
                            {order.testName || "Test"}
                          </span>
                          <span
                            style={{
                              font: "500 11px/1 var(--font-mono)",
                              color: "var(--text-muted)",
                            }}
                          >
                            {order.orderNumber}
                          </span>
                        </span>

                        <span
                          className="truncate"
                          style={{
                            font: "400 12.5px/1 var(--font-sans)",
                            color: "var(--text-muted)",
                            textTransform: "capitalize",
                          }}
                        >
                          {order.specimenType || "—"}
                          {order.visitNumber ? ` · ${order.visitNumber}` : ""}
                          {order.clinicalNotes ? ` · ${order.clinicalNotes}` : ""}
                        </span>
                      </span>

                      <span
                        className="flex flex-col items-end flex-shrink-0"
                        style={{ gap: 6 }}
                      >
                        <Badge tone={u.tone}>{u.label}</Badge>
                        <span
                          className="inline-flex items-center"
                          style={{
                            gap: 5,
                            font: "500 11.5px/1 var(--font-mono)",
                            color: "var(--text-muted)",
                          }}
                        >
                          <Clock className="w-3 h-3" />
                          {timeSince(order.orderedAt)}
                        </span>
                      </span>

                      <ChevronRight
                        className="w-4 h-4 flex-shrink-0"
                        style={{ color: "var(--text-disabled)" }}
                      />
                    </button>
                  );
                })}

                {sortedPending.length > 8 && (
                  <div className="flex justify-center" style={{ padding: 12 }}>
                    <LinkAction
                      onClick={() => router.push("/dashboard/laboratory/queue")}
                    >
                      +{sortedPending.length - 8} more
                    </LinkAction>
                  </div>
                )}
              </>
            )}
          </Card>
        </div>

        <div
          style={{
            flex: "1 1 280px",
            minWidth: 260,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <Card>
            <CardHeader icon={TrendingUp} title="My performance" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
              {[
                { label: "This month", value: myStats?.monthResults ?? 0, ink: "var(--green-700)" },
                { label: "Today", value: myStats?.todayResults ?? 0, ink: "var(--info-ink)" },
                {
                  label: "Avg turnaround",
                  value: formatTurnaround(myStats?.avgTurnaroundMinutes ?? 0),
                  ink: "var(--accent-ink)",
                },
                {
                  label: "Abnormal this month",
                  value: myStats?.abnormalThisMonth ?? 0,
                  ink: "var(--urgent-ink)",
                },
              ].map(({ label, value, ink }, i) => (
                <div
                  key={label}
                  style={{
                    padding: 16,
                    // Interior hairlines only — the card supplies the outer edge.
                    borderRight: i % 2 === 0 ? "1px solid var(--border-faint)" : "none",
                    borderTop: i > 1 ? "1px solid var(--border-faint)" : "none",
                    display: "flex",
                    flexDirection: "column",
                    gap: 7,
                  }}
                >
                  <span
                    className="truncate"
                    style={{
                      font: "700 19px/1 var(--font-sans)",
                      letterSpacing: "var(--ls-tight)",
                      color: ink,
                    }}
                  >
                    {loading ? "—" : value}
                  </span>
                  <span
                    style={{
                      font: "400 11.5px/1 var(--font-sans)",
                      color: "var(--text-muted)",
                    }}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader icon={ArrowRight} title="Quick actions" />
            <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 2 }}>
              {[
                {
                  label: "Sample queue",
                  sub: "Orders awaiting processing",
                  href: "/dashboard/laboratory/queue",
                  icon: FlaskConical,
                  tint: "var(--urgent-tint)",
                  ink: "var(--urgent-ink)",
                },
                {
                  label: "Result history",
                  sub: "What you have released",
                  href: "/dashboard/laboratory/history",
                  icon: History,
                  tint: "var(--info-tint)",
                  ink: "var(--info-ink)",
                },
                {
                  label: "Patients",
                  sub: "Search lab history",
                  href: "/dashboard/laboratory/patients",
                  icon: Users,
                  tint: "var(--brand-tint)",
                  ink: "var(--green-700)",
                },
              ].map(({ label, sub, href, icon: Icon, tint, ink }) => (
                <button
                  key={href}
                  onClick={() => router.push(href)}
                  className="flex items-center text-left"
                  style={{
                    gap: 12,
                    padding: 10,
                    border: "none",
                    borderRadius: "var(--r-sm)",
                    background: "transparent",
                    cursor: "pointer",
                    transition: "background var(--dur-fast) var(--ease-standard)",
                  }}
                  {...hoverRow}
                >
                  <span
                    className="inline-flex items-center justify-center flex-shrink-0"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "var(--r-xs)",
                      background: tint,
                      color: ink,
                    }}
                  >
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="flex-1 flex flex-col" style={{ gap: 3 }}>
                    <span
                      style={{
                        font: "600 13.5px/1 var(--font-sans)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {label}
                    </span>
                    <span
                      style={{
                        font: "400 11.5px/1 var(--font-sans)",
                        color: "var(--text-muted)",
                      }}
                    >
                      {sub}
                    </span>
                  </span>
                  <ChevronRight
                    className="w-4 h-4 flex-shrink-0"
                    style={{ color: "var(--text-disabled)" }}
                  />
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </Page>
  );
}
