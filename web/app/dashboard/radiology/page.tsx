"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { visitApi, radiologyStatsApi } from "@/lib/api";
import {
  Scan,
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ArrowRight,
  Clock,
  RefreshCw,
  TrendingUp,
  Activity,
  Users,
  ScrollText,
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
  getModality,
  URGENCY_ORDER,
  timeSince,
  formatTurnaround,
  normalizeOrder,
} from "./vocab";

/* ==========================================================================
   Radiology overview.

   Styling follows the HealthChain design system (app/design-tokens.css);
   layout primitives come from components/dashboard/ui.tsx and the domain
   vocabulary (modality / urgency labels) from ./vocab.

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

export default function RadiologyOverviewPage() {
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
      // allSettled: one failing stat endpoint must not blank the worklist.
      const [a, b, c] = await Promise.allSettled([
        radiologyStatsApi.getOverview(),
        radiologyStatsApi.getMyStats(),
        (visitApi as any).getPendingImagingOrders(),
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
  const reportedToday = stats?.reportedToday ?? 0;
  const reportedWeek = stats?.reportedWeek ?? 0;

  const sortedPending = [...pending].sort(
    (a, b) => (URGENCY_ORDER[a.urgency] ?? 9) - (URGENCY_ORDER[b.urgency] ?? 9),
  );

  // The overview endpoint already coerces these counts to numbers.
  const weekly = stats?.weeklyActivity ?? [];

  const byModality: Array<[string, number]> = Object.entries(
    stats?.pendingByModality ?? {},
  )
    .map(([k, v]) => [k, Number(v ?? 0)] as [string, number])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);

  const topModality =
    myStats?.modalityBreakdown && myStats.modalityBreakdown.length > 0
      ? getModality(myStats.modalityBreakdown[0].modality).label
      : "—";

  return (
    <Page>
      <PageHeader
        eyebrow="Radiology"
        title={(user as any)?.institutionName || "Radiology"}
        subtitle={
          loading
            ? "Loading worklist…"
            : `${totalPending} stud${totalPending !== 1 ? "ies" : "y"} awaiting a report`
        }
        actions={
          <>
            <Button
              variant="primary"
              icon={Scan}
              onClick={() => router.push("/dashboard/radiology/queue")}
            >
              Open worklist
            </Button>
            <Button
              icon={ScrollText}
              onClick={() => router.push("/dashboard/radiology/report")}
            >
              My report
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

      {/* Critical studies outrank everything else on this page. */}
      {!loading && criticalCount > 0 && (
        <Banner
          tone="critical"
          icon={AlertTriangle}
          onClick={() => router.push("/dashboard/radiology/queue")}
          action={
            <span
              className="inline-flex items-center whitespace-nowrap"
              style={{
                gap: 4,
                font: "700 12.5px/1 var(--font-sans)",
                color: "var(--critical-ink)",
              }}
            >
              Open worklist
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          }
        >
          {criticalCount} stud{criticalCount > 1 ? "ies" : "y"} marked critical or
          urgent await reporting.
        </Banner>
      )}

      <KpiGrid>
        <KpiCard
          label="Pending studies"
          value={totalPending}
          sub="Awaiting a report"
          icon={Scan}
          tone="urgent"
          loading={loading}
          onClick={() => router.push("/dashboard/radiology/queue")}
        />
        <KpiCard
          label="Critical / urgent"
          value={criticalCount}
          sub="Need attention now"
          icon={AlertTriangle}
          tone="critical"
          loading={loading}
          onClick={() => router.push("/dashboard/radiology/queue")}
        />
        <KpiCard
          label="Reported today"
          value={reportedToday}
          sub="Released to clinicians"
          icon={CheckCircle2}
          tone="success"
          loading={loading}
        />
        <KpiCard
          label="Reported this week"
          value={reportedWeek}
          sub="Last 7 days"
          icon={TrendingUp}
          tone="accent"
          loading={loading}
        />
      </KpiGrid>

      {/* Activity + modality mix */}
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
                    { label: "Reported", color: "var(--green-700)" },
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
                <div style={{ margin: "0 12px", height: "100%" }}>
                  <SkeletonBlock height={192} />
                </div>
              ) : weekly.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={weekly}
                    margin={{ top: 4, right: 12, left: -22, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="radOrdered" x1="0" y1="0" x2="0" y2="1">
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
                      <linearGradient id="radReported" x1="0" y1="0" x2="0" y2="1">
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
                      fill="url(#radOrdered)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="reported"
                      name="Reported"
                      stroke="var(--green-700)"
                      fill="url(#radReported)"
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
            <CardHeader icon={Scan} title="Pending by modality" />
            <div style={{ padding: 14 }}>
              {loading ? (
                <SkeletonBlock height={160} />
              ) : byModality.length === 0 ? (
                <p
                  style={{
                    margin: 0,
                    padding: "36px 0",
                    textAlign: "center",
                    font: "400 13px/1 var(--font-sans)",
                    color: "var(--text-muted)",
                  }}
                >
                  Nothing pending.
                </p>
              ) : (
                byModality.map(([mod, count]) => {
                  const cfg = getModality(mod);
                  const dot = TONES[cfg.tone].dot;
                  // Share of the total pending queue, not of the largest bar.
                  const pct = totalPending > 0 ? (count / totalPending) * 100 : 0;

                  return (
                    <div key={mod} style={{ padding: "8px 4px" }}>
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
                          {count}
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
                })
              )}
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
              title="Pending worklist"
              subtitle="Most urgent first"
              right={
                sortedPending.length > 0 ? (
                  <LinkAction onClick={() => router.push("/dashboard/radiology/queue")}>
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
                title="The worklist is clear"
                message="New imaging orders will appear here."
              />
            ) : (
              <>
                {sortedPending.slice(0, 8).map((order: any) => {
                  const u = getUrgency(order.urgency);
                  const m = getModality(order.modality);
                  const mTone = TONES[m.tone];

                  return (
                    <button
                      key={order.id}
                      onClick={() =>
                        router.push(`/dashboard/radiology/queue/${order.id}`)
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
                          background: mTone.tint,
                          color: mTone.ink,
                        }}
                      >
                        <Scan className="w-4 h-4" />
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
                            {m.label}
                            {order.bodyPart ? ` · ${order.bodyPart}` : ""}
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
                          }}
                        >
                          {order.visitNumber}
                          {order.chiefComplaint ? ` · ${order.chiefComplaint}` : ""}
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
                      onClick={() => router.push("/dashboard/radiology/queue")}
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
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
              }}
            >
              {[
                { label: "This month", value: myStats?.monthReports ?? 0, ink: "var(--green-700)" },
                { label: "Today", value: myStats?.todayReports ?? 0, ink: "var(--info-ink)" },
                {
                  label: "Avg turnaround",
                  value: formatTurnaround(myStats?.avgTurnaroundMinutes ?? 0),
                  ink: "var(--accent-ink)",
                },
                { label: "Top modality", value: topModality, ink: "var(--urgent-ink)" },
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
                  label: "Worklist",
                  sub: "Studies awaiting a report",
                  href: "/dashboard/radiology/queue",
                  icon: Scan,
                  tint: "var(--urgent-tint)",
                  ink: "var(--urgent-ink)",
                },
                {
                  label: "Patients",
                  sub: "Search imaging history",
                  href: "/dashboard/radiology/patients",
                  icon: Users,
                  tint: "var(--info-tint)",
                  ink: "var(--info-ink)",
                },
                {
                  label: "My report",
                  sub: "Your reporting activity",
                  href: "/dashboard/radiology/report",
                  icon: ScrollText,
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
