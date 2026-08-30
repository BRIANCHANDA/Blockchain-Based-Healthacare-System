"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import {
  Activity,
  ClipboardList,
  ChevronRight,
  Clock,
  AlertTriangle,
  Users,
  FileText,
  Stethoscope,
  TrendingUp,
  Calendar,
  FlaskConical,
  RefreshCw,
  AlertCircle,
  Hourglass,
  Scan,
  QrCode,
  CheckCircle2,
  ArrowRight,
  PieChart as PieIcon,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
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
import { getPriority, PRIORITY_ORDER, getInitials, waitLabel } from "./vocab";

/* ==========================================================================
   Doctor overview.

   Two data sources with different lifetimes: /api/doctor/stats is loaded once
   (charts, historical counts) while /api/visits/assigned-to-me polls every 30
   seconds — the caseload changes during a shift, the 30-day trend does not.

   Recharts renders SVG presentation attributes, which accept var() the same
   way CSS does, so chart colours reference the same tokens as the page.
   ========================================================================== */

// ── Types ─────────────────────────────────────────────────────────────────────
interface TodayStats {
  total: number;
  triaged: number;
  completed: number;
  critical: number;
  urgent: number;
  activePatients: number;
}
interface ActivityStats {
  consultations: number;
  labOrders: number;
  imagingOrders: number;
  prescriptions: number;
}
interface TrendPoint {
  date: string;
  consultations: number;
  labOrders: number;
  imagingOrders: number;
  prescriptions: number;
}
interface FunnelStage {
  stage: string;
  count: number;
}
interface RecentPatient {
  visitId: string;
  visitNumber: string;
  priority: string;
  status: string;
  chiefComplaint: string;
  consultedAt: string;
  patient: { firstName: string; lastName: string } | null;
}

// assigned-to-me returns flat fields, not a nested patient object
interface QueueVisit {
  id: string;
  visitNumber: string;
  chiefComplaint: string;
  priority: string;
  status: string;
  admissionDate: string;
  hasConsultation: boolean;
  pendingLabCount: number;
  pendingImagingCount: number;
  patientName: string;
  gender: string;
  bloodType: string;
}

// The four measures plotted on the 30-day output chart.
const SERIES = [
  { key: "consultations", label: "Consults", color: "var(--green-700)" },
  { key: "labOrders", label: "Lab", color: "var(--blue-600)" },
  { key: "imagingOrders", label: "Imaging", color: "var(--violet-600)" },
  { key: "prescriptions", label: "Rx", color: "var(--amber-600)" },
] as const;

// Progressively cooler as a patient moves through to discharge.
const FUNNEL_COLORS = [
  "var(--blue-600)",
  "var(--blue-500)",
  "var(--green-700)",
  "var(--violet-600)",
];

const AXIS_TICK = { fontSize: 10, fill: "var(--text-muted)" };
const TOOLTIP_STYLE = {
  borderRadius: 10,
  border: "1px solid var(--hc-border)",
  boxShadow: "var(--elev-2)",
  fontFamily: "var(--font-sans)",
  fontSize: 12,
};

/* -------------------------------------------------------------------------- */
/* Rows                                                                       */
/* -------------------------------------------------------------------------- */

/** Avatar tinted by priority, with a count badge for outstanding results. */
function PriorityAvatar({
  name,
  priority,
  badge,
}: {
  name: string;
  priority: string;
  badge?: number;
}) {
  const t = TONES[getPriority(priority).tone];
  return (
    <span className="relative flex-shrink-0">
      <span
        className="inline-flex items-center justify-center"
        style={{
          width: 34,
          height: 34,
          borderRadius: "var(--r-sm)",
          background: t.tint,
          color: t.ink,
          font: "700 12px/1 var(--font-sans)",
        }}
      >
        {getInitials(name)}
      </span>
      {badge !== undefined && badge > 0 && (
        <span
          className="absolute inline-flex items-center justify-center"
          style={{
            top: -5,
            right: -5,
            minWidth: 18,
            height: 18,
            padding: "0 5px",
            borderRadius: "var(--r-pill)",
            background: "var(--urgent)",
            color: "var(--ink-900)",
            font: "700 9.5px/1 var(--font-sans)",
          }}
        >
          {badge}
        </span>
      )}
    </span>
  );
}

function PendingResultRow({
  visit,
  onClick,
}: {
  visit: QueueVisit;
  onClick: () => void;
}) {
  const totalPending = visit.pendingLabCount + visit.pendingImagingCount;

  return (
    <button
      onClick={onClick}
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
      <PriorityAvatar
        name={visit.patientName}
        priority={visit.priority}
        badge={totalPending}
      />

      <span className="flex-1 min-w-0 flex flex-col" style={{ gap: 5 }}>
        <span
          className="truncate"
          style={{
            font: "600 13.5px/1 var(--font-sans)",
            color: "var(--text-primary)",
          }}
        >
          {visit.patientName}
        </span>
        <span
          className="truncate"
          style={{
            font: "400 12.5px/1 var(--font-sans)",
            color: "var(--text-muted)",
          }}
        >
          {visit.chiefComplaint}
        </span>

        <span className="flex items-center flex-wrap" style={{ gap: 7 }}>
          {visit.pendingLabCount > 0 && (
            <Badge tone="urgent" icon={FlaskConical} style={{ height: 18, fontSize: 10 }}>
              {visit.pendingLabCount} lab
            </Badge>
          )}
          {visit.pendingImagingCount > 0 && (
            <Badge tone="accent" icon={Scan} style={{ height: 18, fontSize: 10 }}>
              {visit.pendingImagingCount} imaging
            </Badge>
          )}
          <span
            className="inline-flex items-center"
            style={{
              gap: 4,
              marginLeft: "auto",
              font: "500 11px/1 var(--font-mono)",
              color: "var(--text-muted)",
            }}
          >
            <Clock className="w-3 h-3" />
            {waitLabel(visit.admissionDate)}
          </span>
        </span>
      </span>

      <ChevronRight
        className="w-4 h-4 flex-shrink-0"
        style={{ color: "var(--text-disabled)" }}
      />
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Overview                                                                   */
/* -------------------------------------------------------------------------- */

export default function DoctorOverview() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [stats, setStats] = useState<TodayStats | null>(null);
  const [activity, setActivity] = useState<ActivityStats | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [funnel, setFunnel] = useState<FunnelStage[]>([]);
  const [recentPatients, setRecentPatients] = useState<RecentPatient[]>([]);
  const [queue, setQueue] = useState<QueueVisit[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get("/api/doctor/stats");
      const d = res.data.data;
      setStats(d.today);
      setActivity(d.activity);
      setTrend(d.trend ?? []);
      setFunnel(d.funnel ?? []);
      setRecentPatients(d.recentPatients ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? "Failed to load stats");
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const fetchQueue = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    try {
      const res = await api.get("/api/visits/assigned-to-me");
      const raw: any[] = res.data?.data ?? [];
      const sorted = [...raw].sort((a, b) => {
        const po =
          (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
        // Within a band, whoever arrived first goes first.
        return po !== 0
          ? po
          : new Date(a.admissionDate).getTime() -
              new Date(b.admissionDate).getTime();
      });
      setQueue(sorted as QueueVisit[]);
    } catch (err: any) {
      // A silent refresh failing should not replace the visible queue with an error.
      if (!silent)
        setError(err?.response?.data?.error?.message ?? "Failed to load queue");
    } finally {
      setLoadingQueue(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchQueue();
    const iv = setInterval(() => fetchQueue(true), 30_000);
    return () => clearInterval(iv);
  }, [fetchStats, fetchQueue]);

  // Derived
  const pendingConsult = queue.filter((v) => !v.hasConsultation);
  const waitingForResults = queue.filter(
    (v) => v.hasConsultation && (v.pendingLabCount > 0 || v.pendingImagingCount > 0),
  );
  const totalPendingResults = waitingForResults.reduce(
    (s, v) => s + v.pendingLabCount + v.pendingImagingCount,
    0,
  );

  // An all-zero series would render as a flat line pinned to the axis, which
  // reads as a broken chart rather than a quiet month.
  const hasTrendData = trend.some(
    (d) => d.consultations + d.labOrders + d.imagingOrders + d.prescriptions > 0,
  );

  const caseloadByPriority = ["critical", "emergency", "urgent", "routine"]
    .map((key) => ({
      key,
      label: getPriority(key).label,
      value: queue.filter((v) => v.priority === key).length,
      color: TONES[getPriority(key).tone].dot,
    }))
    .filter((d) => d.value > 0);

  return (
    <Page>
      {error && (
        <Banner
          tone="critical"
          icon={AlertCircle}
          action={
            <Button variant="ghost" size="sm" onClick={() => setError(null)}>
              Dismiss
            </Button>
          }
        >
          {error}
        </Banner>
      )}

      <PageHeader
        eyebrow="Clinical"
        title={`Dr. ${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim()}
        subtitle={
          loadingQueue
            ? "Loading your caseload…"
            : `${pendingConsult.length} awaiting consult · ${waitingForResults.length} awaiting results · refreshes every 30 seconds`
        }
        actions={
          <>
            <Button
              variant="primary"
              icon={ClipboardList}
              onClick={() => router.push("/dashboard/doctor/queue")}
            >
              Today's queue
            </Button>
            <Button
              icon={Users}
              onClick={() => router.push("/dashboard/doctor/patients")}
            >
              Patients
            </Button>
            <Button
              icon={RefreshCw}
              onClick={() => fetchQueue(true)}
              disabled={refreshing || loadingQueue}
              style={{ padding: 0, width: 38 }}
            />
          </>
        }
      />

      <KpiGrid min={190}>
        <KpiCard
          label="In my care"
          value={stats?.activePatients ?? 0}
          sub="Active patients"
          icon={Stethoscope}
          tone="info"
          loading={loadingStats}
          onClick={() => router.push("/dashboard/doctor/patients")}
        />
        <KpiCard
          label="Today"
          value={stats?.total ?? 0}
          sub="Registered visits"
          icon={Calendar}
          tone="success"
          loading={loadingStats}
        />
        <KpiCard
          label="Awaiting me"
          value={stats?.triaged ?? 0}
          sub="Ready for consult"
          icon={Clock}
          tone="urgent"
          loading={loadingStats}
          onClick={() => router.push("/dashboard/doctor/queue")}
        />
        <KpiCard
          label="Discharged"
          value={stats?.completed ?? 0}
          sub="Completed today"
          icon={CheckCircle2}
          tone="accent"
          loading={loadingStats}
        />
        <KpiCard
          label="Critical / urgent"
          value={(stats?.critical ?? 0) + (stats?.urgent ?? 0)}
          sub="Highest priority"
          icon={AlertTriangle}
          tone="critical"
          loading={loadingStats}
        />
      </KpiGrid>

      {/* Workflow: output over time, and where today's patients are */}
      <div className="flex flex-wrap" style={{ gap: 16, alignItems: "flex-start" }}>
        <div style={{ flex: "2 1 460px", minWidth: 0 }}>
          <Card>
            <CardHeader
              icon={Activity}
              title="My output · 30 days"
              right={
                /* The legend doubles as today's tally, so the four "today"
                   counters it replaced are still readable at a glance. */
                <div className="hidden sm:flex items-center" style={{ gap: 14 }}>
                  {SERIES.map((s) => (
                    <span key={s.key} className="inline-flex items-center" style={{ gap: 6 }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: s.color,
                        }}
                      />
                      <span
                        style={{
                          font: "500 11.5px/1 var(--font-sans)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {s.label}
                      </span>
                      <span
                        style={{ font: "700 12px/1 var(--font-sans)", color: s.color }}
                      >
                        {loadingStats ? "·" : ((activity?.[s.key] ?? 0) as number)}
                      </span>
                    </span>
                  ))}
                </div>
              }
            />

            <div style={{ padding: "16px 8px", height: 224 }}>
              {loadingStats ? (
                <div style={{ margin: "0 12px" }}>
                  <SkeletonBlock height={192} />
                </div>
              ) : hasTrendData ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={trend}
                    margin={{ top: 4, right: 12, left: -22, bottom: 0 }}
                  >
                    <defs>
                      {SERIES.map((s) => (
                        <linearGradient
                          key={s.key}
                          id={`g-${s.key}`}
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop offset="0%" stopColor={s.color} stopOpacity={0.26} />
                          <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border-100)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v) => format(new Date(v), "d MMM")}
                      tick={AXIS_TICK}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                      minTickGap={24}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={AXIS_TICK}
                      axisLine={false}
                      tickLine={false}
                      width={38}
                    />
                    <Tooltip
                      labelFormatter={(v) => format(new Date(v), "EEE d MMM")}
                      contentStyle={TOOLTIP_STYLE}
                    />
                    {SERIES.map((s) => (
                      <Area
                        key={s.key}
                        type="monotone"
                        dataKey={s.key}
                        name={s.label}
                        stroke={s.color}
                        strokeWidth={2}
                        fill={`url(#g-${s.key})`}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center">
                  <Activity
                    className="w-6 h-6"
                    style={{ color: "var(--text-disabled)", marginBottom: 8 }}
                  />
                  <p
                    style={{
                      margin: 0,
                      font: "400 13px/1 var(--font-sans)",
                      color: "var(--text-muted)",
                    }}
                  >
                    No recorded activity in the last 30 days
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>

        <div style={{ flex: "1 1 280px", minWidth: 260 }}>
          <Card>
            <CardHeader icon={TrendingUp} title="Patient flow · today" />
            <div style={{ padding: "16px 8px", height: 224 }}>
              {loadingStats ? (
                <div style={{ margin: "0 12px" }}>
                  <SkeletonBlock height={192} />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={funnel}
                    layout="vertical"
                    margin={{ top: 2, right: 26, left: 6, bottom: 2 }}
                  >
                    <XAxis type="number" hide allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="stage"
                      tick={{ fontSize: 10.5, fill: "var(--text-secondary)" }}
                      axisLine={false}
                      tickLine={false}
                      width={104}
                    />
                    <Tooltip
                      formatter={(v: any) => [`${v} patients`, ""]}
                      contentStyle={TOOLTIP_STYLE}
                    />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={18}>
                      {funnel.map((_, i) => (
                        <Cell key={i} fill={FUNNEL_COLORS[i % FUNNEL_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Queues */}
      <div className="flex flex-wrap" style={{ gap: 16, alignItems: "flex-start" }}>
        <div
          style={{
            flex: "2 1 460px",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {/* Only rendered when there is something waiting — an empty
              "Awaiting results" panel is noise. */}
          {(loadingQueue || waitingForResults.length > 0) && (
            <Card>
              <CardHeader
                icon={Hourglass}
                title="Awaiting results"
                right={
                  !loadingQueue && totalPendingResults > 0 ? (
                    <Badge tone="urgent">{totalPendingResults} pending</Badge>
                  ) : undefined
                }
              />

              {loadingQueue
                ? [...Array(3)].map((_, i) => <SkeletonRow key={i} />)
                : waitingForResults.map((v) => (
                    <PendingResultRow
                      key={v.id}
                      visit={v}
                      onClick={() => router.push(`/dashboard/doctor/visit/${v.id}`)}
                    />
                  ))}
            </Card>
          )}

          <Card>
            <CardHeader
              icon={ClipboardList}
              title="Live queue"
              subtitle="Most urgent first"
              right={
                <>
                  {!loadingQueue && pendingConsult.length > 0 && (
                    <Badge tone="critical">
                      {pendingConsult.length} need consult
                    </Badge>
                  )}
                  <LinkAction onClick={() => router.push("/dashboard/doctor/queue")}>
                    See all
                  </LinkAction>
                </>
              }
            />

            {loadingQueue ? (
              [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
            ) : pendingConsult.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="No patients needing consult"
                message={
                  waitingForResults.length > 0
                    ? `${waitingForResults.length} patient${waitingForResults.length !== 1 ? "s are" : " is"} awaiting results above.`
                    : "Your queue is clear."
                }
              />
            ) : (
              pendingConsult.slice(0, 6).map((visit) => {
                const p = getPriority(visit.priority);

                return (
                  <button
                    key={visit.id}
                    onClick={() => router.push(`/dashboard/doctor/visit/${visit.id}`)}
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
                    <PriorityAvatar
                      name={visit.patientName}
                      priority={visit.priority}
                    />

                    <span className="flex-1 min-w-0 flex flex-col" style={{ gap: 5 }}>
                      <span className="flex items-center flex-wrap" style={{ gap: 8 }}>
                        <span
                          className="truncate"
                          style={{
                            font: "600 13.5px/1 var(--font-sans)",
                            color: "var(--text-primary)",
                          }}
                        >
                          {visit.patientName}
                        </span>
                        <Badge tone={p.tone} style={{ height: 18, fontSize: 10 }}>
                          {p.label}
                        </Badge>
                      </span>
                      <span
                        className="truncate"
                        style={{
                          font: "400 12.5px/1 var(--font-sans)",
                          color: "var(--text-muted)",
                        }}
                      >
                        {visit.chiefComplaint || "No chief complaint recorded"}
                      </span>
                    </span>

                    <span
                      className="flex-shrink-0"
                      style={{
                        font: "500 11px/1 var(--font-mono)",
                        color: "var(--text-muted)",
                      }}
                    >
                      {visit.visitNumber}
                    </span>

                    <ChevronRight
                      className="w-4 h-4 flex-shrink-0"
                      style={{ color: "var(--text-disabled)" }}
                    />
                  </button>
                );
              })
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
            <CardHeader icon={PieIcon} title="Caseload by priority" />
            <div style={{ padding: 20 }}>
              {loadingQueue ? (
                <SkeletonBlock height={96} />
              ) : caseloadByPriority.length === 0 ? (
                <p
                  style={{
                    margin: 0,
                    padding: "16px 0",
                    textAlign: "center",
                    font: "400 13px/1 var(--font-sans)",
                    color: "var(--text-muted)",
                  }}
                >
                  No patients in your queue.
                </p>
              ) : (
                <div className="flex items-center" style={{ gap: 16 }}>
                  <div style={{ width: 96, height: 96, flexShrink: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={caseloadByPriority}
                          dataKey="value"
                          nameKey="label"
                          innerRadius={28}
                          outerRadius={42}
                          strokeWidth={0}
                        >
                          {caseloadByPriority.map((d) => (
                            <Cell key={d.key} fill={d.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v: any, n: any) => [`${v} patients`, n]}
                          contentStyle={TOOLTIP_STYLE}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div
                    className="flex-1 min-w-0 flex flex-col"
                    style={{ gap: 10 }}
                  >
                    {caseloadByPriority.map((d) => (
                      <div key={d.key} className="flex items-center" style={{ gap: 8 }}>
                        <span
                          className="flex-shrink-0"
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: d.color,
                          }}
                        />
                        <span
                          className="flex-1 truncate"
                          style={{
                            font: "500 12.5px/1 var(--font-sans)",
                            color: "var(--text-secondary)",
                          }}
                        >
                          {d.label}
                        </span>
                        <span
                          style={{
                            font: "700 13px/1 var(--font-sans)",
                            color: "var(--text-primary)",
                          }}
                        >
                          {d.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader icon={ArrowRight} title="Quick actions" />
            <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 2 }}>
              {[
                {
                  label: "Today's queue",
                  sub: "Patients assigned to you",
                  href: "/dashboard/doctor/queue",
                  icon: ClipboardList,
                  tint: "var(--brand-tint)",
                  ink: "var(--green-700)",
                },
                {
                  label: "Patient search",
                  sub: "Find a record",
                  href: "/dashboard/doctor/patients",
                  icon: Users,
                  tint: "var(--info-tint)",
                  ink: "var(--info-ink)",
                },
                {
                  label: "Scan patient",
                  sub: "Open by hospital ID",
                  href: "/dashboard/doctor/scan",
                  icon: QrCode,
                  tint: "var(--accent-tint)",
                  ink: "var(--accent-ink)",
                },
                {
                  label: "New visit",
                  sub: "Start an encounter",
                  href: "/dashboard/doctor/visit/new",
                  icon: FileText,
                  tint: "var(--urgent-tint)",
                  ink: "var(--urgent-ink)",
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

      {/* Recently consulted */}
      {recentPatients.length > 0 && (
        <Card>
          <CardHeader icon={Stethoscope} title="Recently consulted" />
          {recentPatients.map((r) => {
            const name = r.patient
              ? `${r.patient.firstName} ${r.patient.lastName}`
              : "Unknown Patient";

            return (
              <button
                key={r.visitId}
                onClick={() => router.push(`/dashboard/doctor/visit/${r.visitId}`)}
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
                <PriorityAvatar name={name} priority={r.priority} />

                <span className="flex-1 min-w-0 flex flex-col" style={{ gap: 5 }}>
                  <span
                    className="truncate"
                    style={{
                      font: "600 13.5px/1 var(--font-sans)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {name}
                  </span>
                  <span
                    className="truncate"
                    style={{
                      font: "400 12.5px/1 var(--font-sans)",
                      color: "var(--text-muted)",
                    }}
                  >
                    {r.chiefComplaint}
                  </span>
                </span>

                <Badge tone={r.status === "completed" ? "success" : "neutral"}>
                  {r.status === "completed" ? "Completed" : "In progress"}
                </Badge>

                <span
                  className="hidden sm:inline flex-shrink-0"
                  style={{
                    font: "400 11.5px/1 var(--font-sans)",
                    color: "var(--text-muted)",
                  }}
                >
                  {r.consultedAt
                    ? formatDistanceToNow(new Date(r.consultedAt), { addSuffix: true })
                    : "—"}
                </span>

                <ChevronRight
                  className="w-4 h-4 flex-shrink-0"
                  style={{ color: "var(--text-disabled)" }}
                />
              </button>
            );
          })}
        </Card>
      )}
    </Page>
  );
}
