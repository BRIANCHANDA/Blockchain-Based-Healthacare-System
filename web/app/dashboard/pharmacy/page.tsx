"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { visitApi, pharmacyStatsApi } from "@/lib/api";
import {
  Package,
  Pill,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  ArrowRight,
  RefreshCw,
  ClipboardList,
  History,
  BarChart3,
} from "lucide-react";
import { format } from "date-fns";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import {
  Page,
  PageHeader,
  Card,
  CardHeader,
  KpiCard,
  KpiGrid,
  Button,
  LinkAction,
  Banner,
  EmptyState,
  SkeletonRow,
  hoverRow,
} from "@/components/dashboard/ui";

/* ==========================================================================
   Pharmacy overview.

   Styling follows the HealthChain design system (app/design-tokens.css);
   layout primitives come from components/dashboard/ui.tsx.

   Recharts renders SVG presentation attributes, which accept var() the same
   way CSS does — so the chart colours below reference the same tokens as the
   rest of the page rather than a parallel hard-coded palette.
   ========================================================================== */

/* Ramp for the top-medications bars: one brand green stepping lighter. */
const MED_COLORS = [
  "var(--green-900)",
  "var(--green-800)",
  "var(--green-700)",
  "var(--green-600)",
  "var(--green-300)",
];

const AXIS_TICK = { fontSize: 10, fill: "var(--text-muted)" };
const TOOLTIP_STYLE = {
  borderRadius: 10,
  border: "1px solid var(--hc-border)",
  boxShadow: "var(--elev-2)",
  fontFamily: "var(--font-sans)",
  fontSize: 12,
};

function timeSince(dateStr: string) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function PharmacyOverviewPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [pending, setPending] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      // allSettled: a stats failure must not blank out the actionable queue.
      const [pendingRes, statsRes] = await Promise.allSettled([
        (visitApi as any).getPendingPrescriptions(),
        pharmacyStatsApi.getOverview(),
      ]);

      if (pendingRes.status === "fulfilled") {
        setPending(pendingRes.value.data.data?.prescriptions ?? []);
      }
      if (statsRes.status === "fulfilled") {
        setStats(statsRes.value.data.data);
      }
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(() => load(true), 60_000);
    return () => clearInterval(iv);
  }, [load]);

  const longWaiting = pending.filter(
    (p) =>
      Date.now() - new Date(p.prescribedAt ?? p.prescribed_at).getTime() >
      30 * 60 * 1000,
  ).length;

  const totalPending = pending.length;
  const dispensedToday = stats?.dispensedToday ?? 0;
  const avgWaitMins = stats?.avgWaitMinutes ?? 0;

  /*
   * The weekly query selects COUNT(*) without an ::int cast, so Postgres
   * returns bigint and the driver hands back strings. Recharts needs numbers
   * for the Y scale, so coerce rather than plotting silently-broken axes.
   */
  const weekly = (stats?.weeklyActivity ?? []).map((d: any) => ({
    ...d,
    prescribed: Number(d.prescribed ?? 0),
    dispensed: Number(d.dispensed ?? 0),
  }));

  const topMeds = (stats?.topMedications ?? []).map((m: any) => ({
    ...m,
    count: Number(m.count ?? 0),
  }));

  return (
    <Page>
      <PageHeader
        eyebrow="Pharmacy"
        title={(user as any)?.institutionName || "Pharmacy"}
        subtitle={
          loading
            ? "Loading dispensing activity…"
            : `${totalPending} prescription${totalPending !== 1 ? "s" : ""} awaiting dispensing · refreshes every minute`
        }
        actions={
          <>
            <Button
              variant="primary"
              icon={Pill}
              onClick={() => router.push("/dashboard/pharmacy/queue")}
            >
              Dispense queue
            </Button>
            <Button
              icon={Package}
              onClick={() => router.push("/dashboard/pharmacy/inventory")}
            >
              Inventory
            </Button>
            <Button
              icon={RefreshCw}
              onClick={() => load(true)}
              disabled={refreshing}
              style={{ padding: 0, width: 38 }}
            />
          </>
        }
      />

      {/* Long-wait alert — the one thing on this page that demands action now. */}
      {!loading && longWaiting > 0 && (
        <Banner
          tone="urgent"
          icon={AlertCircle}
          onClick={() => router.push("/dashboard/pharmacy/queue")}
          action={
            <span
              className="inline-flex items-center whitespace-nowrap"
              style={{
                gap: 4,
                font: "700 12.5px/1 var(--font-sans)",
                color: "var(--urgent-ink)",
              }}
            >
              Dispense now
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          }
        >
          {longWaiting} prescription{longWaiting > 1 ? "s have" : " has"} been waiting
          over 30 minutes.
        </Banner>
      )}

      {/* KPIs */}
      <KpiGrid>
        <KpiCard
          label="Pending Rx"
          value={totalPending}
          sub="Awaiting dispensing"
          icon={Pill}
          tone="urgent"
          loading={loading}
          onClick={() => router.push("/dashboard/pharmacy/queue")}
        />
        <KpiCard
          label="Dispensed today"
          value={dispensedToday}
          sub="Completed"
          icon={CheckCircle2}
          tone="success"
          loading={loading}
          onClick={() => router.push("/dashboard/pharmacy/dispensed")}
        />
        <KpiCard
          label="Average wait"
          value={avgWaitMins > 0 ? `${avgWaitMins}m` : "—"}
          sub="Prescription to dispense"
          icon={Clock}
          tone="info"
          loading={loading}
        />
        <KpiCard
          label="Long waiting"
          value={longWaiting}
          sub="Over 30 minutes"
          icon={AlertCircle}
          tone="critical"
          loading={loading}
        />
      </KpiGrid>

      {/* Charts */}
      <div className="flex flex-wrap" style={{ gap: 16, alignItems: "flex-start" }}>
        <div style={{ flex: "2 1 460px", minWidth: 0 }}>
          <Card>
            <CardHeader icon={BarChart3} title="Weekly activity" subtitle="Last 7 days" />
            <div style={{ padding: "16px 8px", height: 232 }}>
              {loading ? (
                <div
                  className="animate-pulse h-full"
                  style={{
                    margin: "0 12px",
                    borderRadius: "var(--r-sm)",
                    background: "var(--surface-sunken)",
                  }}
                />
              ) : weekly.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={weekly}
                    margin={{ top: 4, right: 12, left: -22, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="prescribedFill" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor="var(--amber-500)"
                          stopOpacity={0.25}
                        />
                        <stop
                          offset="100%"
                          stopColor="var(--amber-500)"
                          stopOpacity={0}
                        />
                      </linearGradient>
                      <linearGradient id="dispensedFill" x1="0" y1="0" x2="0" y2="1">
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
                      labelFormatter={(v) => (v ? format(new Date(v), "MMM d") : v)}
                    />
                    <Area
                      type="monotone"
                      dataKey="prescribed"
                      name="Prescribed"
                      stroke="var(--amber-500)"
                      fill="url(#prescribedFill)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="dispensed"
                      name="Dispensed"
                      stroke="var(--green-700)"
                      fill="url(#dispensedFill)"
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
            <CardHeader icon={Pill} title="Top medications" subtitle="Last 7 days" />
            <div style={{ padding: "16px 8px", height: 232 }}>
              {loading ? (
                <div
                  className="animate-pulse h-full"
                  style={{
                    margin: "0 12px",
                    borderRadius: "var(--r-sm)",
                    background: "var(--surface-sunken)",
                  }}
                />
              ) : topMeds.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topMeds}
                    layout="vertical"
                    margin={{ top: 2, right: 16, left: 6, bottom: 2 }}
                  >
                    <XAxis
                      type="number"
                      tick={AXIS_TICK}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="medicationName"
                      tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
                      axisLine={false}
                      tickLine={false}
                      width={92}
                    />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={16}>
                      {topMeds.map((_: any, i: number) => (
                        <Cell key={i} fill={MED_COLORS[i % MED_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div
                  className="h-full flex items-center justify-center"
                  style={{
                    font: "400 13px/1 var(--font-sans)",
                    color: "var(--text-muted)",
                  }}
                >
                  No dispenses in the last 7 days
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Queue + quick actions */}
      <div className="flex flex-wrap" style={{ gap: 16, alignItems: "flex-start" }}>
        <div style={{ flex: "2 1 460px", minWidth: 0 }}>
          <Card>
            <CardHeader
              icon={ClipboardList}
              title="Pending prescriptions"
              subtitle="Oldest first"
              right={
                totalPending > 0 ? (
                  <LinkAction onClick={() => router.push("/dashboard/pharmacy/queue")}>
                    View all
                  </LinkAction>
                ) : undefined
              }
            />

            {loading ? (
              [...Array(4)].map((_, i) => <SkeletonRow key={i} />)
            ) : pending.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="Queue is clear"
                message="No prescriptions are waiting to be dispensed."
              />
            ) : (
              <>
                {pending.slice(0, 6).map((rx: any) => {
                  /* The endpoint returns snake_case from a raw SQL join but
                     camelCase from the ORM path, so every field is read both
                     ways rather than assuming one shape. */
                  const prescribedAt = rx.prescribedAt ?? rx.prescribed_at;
                  const isOld =
                    Date.now() - new Date(prescribedAt).getTime() > 30 * 60 * 1000;
                  const rxNum = rx.prescriptionNumber ?? rx.prescription_number;
                  const visitNum = rx.visitNumber ?? rx.visit_number;
                  const patientName =
                    rx.patientName ?? rx.patient_name ?? "Unknown Patient";
                  const pendingItems = rx.pendingItems ?? rx.pending_items ?? 0;
                  const totalItems = rx.totalItems ?? rx.total_items ?? 0;

                  return (
                    <button
                      key={rx.id}
                      onClick={() => router.push(`/dashboard/pharmacy/queue/${rx.id}`)}
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
                          background: isOld ? "var(--urgent-tint)" : "var(--brand-tint)",
                          color: isOld ? "var(--urgent-ink)" : "var(--green-700)",
                        }}
                      >
                        <Pill className="w-4 h-4" />
                      </span>

                      <span className="flex-1 min-w-0 flex flex-col" style={{ gap: 5 }}>
                        <span
                          className="flex items-center flex-wrap"
                          style={{ gap: 8 }}
                        >
                          <span
                            className="truncate"
                            style={{
                              font: "600 13.5px/1 var(--font-sans)",
                              color: "var(--text-primary)",
                            }}
                          >
                            {patientName}
                          </span>
                          <span
                            style={{
                              font: "500 11px/1 var(--font-mono)",
                              color: "var(--text-muted)",
                            }}
                          >
                            {rxNum}
                          </span>
                          {isOld && (
                            <span
                              className="inline-flex items-center flex-shrink-0"
                              style={{
                                height: 18,
                                padding: "0 8px",
                                borderRadius: "var(--r-pill)",
                                background: "var(--urgent-tint)",
                                color: "var(--urgent-ink)",
                                font: "700 10px/1 var(--font-sans)",
                              }}
                            >
                              Waiting long
                            </span>
                          )}
                        </span>

                        <span
                          className="truncate"
                          style={{
                            font: "400 12.5px/1 var(--font-sans)",
                            color: "var(--text-muted)",
                          }}
                        >
                          {visitNum} · {pendingItems} of {totalItems} item
                          {totalItems !== 1 ? "s" : ""} pending
                        </span>
                      </span>

                      <span
                        className="inline-flex items-center flex-shrink-0"
                        style={{
                          gap: 5,
                          font: "500 11.5px/1 var(--font-mono)",
                          color: isOld ? "var(--urgent-ink)" : "var(--text-muted)",
                        }}
                      >
                        <Clock className="w-3 h-3" />
                        {timeSince(prescribedAt)}
                      </span>

                      <ChevronRight
                        className="w-4 h-4 flex-shrink-0"
                        style={{ color: "var(--text-disabled)" }}
                      />
                    </button>
                  );
                })}

                {pending.length > 6 && (
                  <div className="flex justify-center" style={{ padding: 12 }}>
                    <LinkAction onClick={() => router.push("/dashboard/pharmacy/queue")}>
                      +{pending.length - 6} more
                    </LinkAction>
                  </div>
                )}
              </>
            )}
          </Card>
        </div>

        <div style={{ flex: "1 1 280px", minWidth: 260 }}>
          <Card>
            <CardHeader icon={ArrowRight} title="Quick actions" />
            <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 2 }}>
              {[
                {
                  label: "Dispense queue",
                  sub: "Prescriptions awaiting you",
                  href: "/dashboard/pharmacy/queue",
                  icon: Pill,
                  tint: "var(--brand-tint)",
                  ink: "var(--green-700)",
                },
                {
                  label: "Dispense history",
                  sub: "What has gone out",
                  href: "/dashboard/pharmacy/dispensed",
                  icon: History,
                  tint: "var(--info-tint)",
                  ink: "var(--info-ink)",
                },
                {
                  label: "Inventory",
                  sub: "Stock levels and expiry",
                  href: "/dashboard/pharmacy/inventory",
                  icon: Package,
                  tint: "var(--accent-tint)",
                  ink: "var(--accent-ink)",
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
