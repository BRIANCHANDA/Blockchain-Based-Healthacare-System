"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { api, practitionersApi, visitApi } from "@/lib/api";
import {
  UserPlus,
  Users,
  ClipboardList,
  Clock,
  Activity,
  Zap,
  RefreshCw,
  User,
  UserCheck,
  Droplets,
  QrCode,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Plus,
  ChevronRight,
} from "lucide-react";
import { format, getHours } from "date-fns";
import {
  Page,
  PageHeader,
  Card,
  CardHeader,
  KpiCard,
  KpiGrid,
  Pill,
  Avatar,
  Button,
  LinkAction,
  Banner,
  EmptyState,
  SkeletonRow,
  SkeletonBlock,
  SectionLabel,
  hoverRow,
  TONES,
  type Tone,
} from "@/components/dashboard/ui";

/* ==========================================================================
   Receptionist overview.

   Styling follows the HealthChain design system imported from claude.ai/design
   ("MedLink EMR Sidebar Layout"). Layout primitives live in
   components/dashboard/ui.tsx; only the two charts and the queue row below are
   specific enough to this page to stay local.
   ========================================================================== */

// ── Types ─────────────────────────────────────────────────────────────────────
interface QueueItem {
  id: string;
  visitNumber: string;
  chiefComplaint: string;
  priority: string;
  status: string;
  admissionDate: string;
  wardOrRoom?: string;
  patientName?: string;
  patient?: {
    firstName: string;
    lastName: string;
    gender: string;
    bloodType: string;
  } | null;
  assignedNurseId?: string;
  assignedNurseName?: string;
  /*
   * Supplied by /api/visits/today. That endpoint returns only visits whose
   * status is "in-progress", so `status` cannot distinguish a patient still
   * waiting from one already in care — this flag is what actually separates
   * them: no vitals recorded yet means triage has not happened.
   */
  hasVitals?: boolean;
}

interface Nurse {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  specialization: string | null;
  lastSeenAt: string | null;
}

const PRIORITY: Record<string, { tone: Tone; label: string }> = {
  critical: { tone: "accent", label: "Critical" },
  emergency: { tone: "critical", label: "Emergency" },
  urgent: { tone: "urgent", label: "Urgent" },
  routine: { tone: "success", label: "Routine" },
};
const getP = (p: string) => PRIORITY[p] ?? PRIORITY.routine;

function getPatientName(item: QueueItem) {
  if (item.patientName) return item.patientName;
  if (item.patient) return `${item.patient.firstName} ${item.patient.lastName}`;
  return "Unknown Patient";
}

const waitMinutes = (iso: string) =>
  Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);

const waitLabel = (m: number) =>
  m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;

/* ──────────────────────────────────────────────────────────────────────────
   Arrivals sparkline — check-ins bucketed by hour, 06:00–18:00.
   Hand-built SVG rather than a chart library: a single series over a fixed
   domain would cost more to configure than to draw.
   ────────────────────────────────────────────────────────────────────────── */
function ArrivalsChart({ queue }: { queue: QueueItem[] }) {
  const SLOTS = 12; // one point per hour, 06:00 – 17:00
  const W = 320;
  const H = 96;

  const buckets = useMemo(() => {
    const b = Array(SLOTS).fill(0);
    queue.forEach((v) => {
      const h = getHours(new Date(v.admissionDate));
      // Anything outside the clinic day is clamped onto the nearest end.
      b[Math.min(Math.max(h - 6, 0), SLOTS - 1)]++;
    });
    return b;
  }, [queue]);

  const maxVal = Math.max(...buckets, 1);
  const pad = { l: 4, r: 4, t: 8, b: 4 };
  const gW = W - pad.l - pad.r;
  const gH = H - pad.t - pad.b;

  const pts = buckets.map((v, i) => ({
    x: pad.l + (i / (SLOTS - 1)) * gW,
    y: pad.t + gH - (v / maxVal) * gH,
  }));

  const line = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${(pad.t + gH).toFixed(1)} L${pts[0].x.toFixed(1)},${(pad.t + gH).toFixed(1)} Z`;

  const hour = getHours(new Date());
  const nowX = pad.l + (Math.min(Math.max(hour - 6, 0), SLOTS - 1) / (SLOTS - 1)) * gW;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      preserveAspectRatio="none"
      style={{ display: "block", overflow: "visible" }}
    >
      <defs>
        <linearGradient id="hcFlow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--green-700)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--green-700)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {[24, 48, 72].map((y) => (
        <line key={y} x1="4" y1={y} x2={W - 4} y2={y} stroke="var(--border-100)" strokeWidth="1" />
      ))}

      <path d={area} fill="url(#hcFlow)" />
      <path
        d={line}
        fill="none"
        stroke="var(--green-700)"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {pts.map((p, i) =>
        buckets[i] > 0 ? (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="2.5"
            fill="var(--white)"
            stroke="var(--green-700)"
            strokeWidth="1.5"
          />
        ) : null,
      )}

      {/* "You are here" marker, drawn only during clinic hours. */}
      {hour >= 6 && hour <= 18 && (
        <line
          x1={nowX}
          y1={pad.t}
          x2={nowX}
          y2={pad.t + gH}
          stroke="var(--coral-500)"
          strokeWidth="1"
          strokeDasharray="3 2"
          opacity="0.55"
        />
      )}
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Visit status donut. Only the ACTIVE queue is available from
   /api/visits/today, so this splits by triage state — there is deliberately
   no discharged slice, because that endpoint excludes completed visits.
   ────────────────────────────────────────────────────────────────────────── */
function StatusDonut({
  waiting,
  inProgress,
  total,
}: {
  waiting: number;
  inProgress: number;
  total: number;
}) {
  const R = 34;
  const C = 2 * Math.PI * R;

  const segments = [
    { value: inProgress, color: "var(--green-700)", label: "In care" },
    { value: waiting, color: "var(--amber-500)", label: "Waiting" },
  ];

  // Each arc starts where the previous one ended.
  let offset = 0;
  const arcs = segments.map((s) => {
    const dash = (total > 0 ? s.value / total : 0) * C;
    const arc = { ...s, dash: `${dash} ${C - dash}`, offset: -offset };
    offset += dash;
    return arc;
  });

  return (
    <div className="flex items-center" style={{ gap: 18 }}>
      <svg width="88" height="88" viewBox="0 0 88 88" style={{ display: "block", flexShrink: 0 }}>
        <circle cx="44" cy="44" r={R} fill="none" stroke="var(--surface-sunken)" strokeWidth="10" />
        {arcs.map((a) => (
          <circle
            key={a.label}
            cx="44"
            cy="44"
            r={R}
            fill="none"
            stroke={a.color}
            strokeWidth="10"
            strokeDasharray={a.dash}
            strokeDashoffset={a.offset}
            strokeLinecap="butt"
            style={{ transform: "rotate(-90deg)", transformOrigin: "44px 44px" }}
          />
        ))}
        <text
          x="44"
          y="42"
          textAnchor="middle"
          fontSize="19"
          fontWeight="700"
          fontFamily="var(--font-sans)"
          fill="var(--text-primary)"
        >
          {total}
        </text>
        <text
          x="44"
          y="55"
          textAnchor="middle"
          fontSize="8.5"
          fontFamily="var(--font-sans)"
          fill="var(--text-muted)"
        >
          visits
        </text>
      </svg>

      <div className="flex-1 flex flex-col" style={{ gap: 10 }}>
        {segments.map((s) => (
          <div key={s.label} className="flex items-center" style={{ gap: 8 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: s.color,
                flexShrink: 0,
              }}
            />
            <span
              className="flex-1 truncate"
              style={{ font: "500 12.5px/1 var(--font-sans)", color: "var(--text-secondary)" }}
            >
              {s.label}
            </span>
            <span style={{ font: "700 13px/1 var(--font-sans)", color: "var(--text-primary)" }}>
              {s.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Shared grid template for the live-queue header and its rows. */
const GRID = "16px 38px minmax(150px, 1fr) 84px 116px 104px";

/* ── Queue row ────────────────────────────────────────────────────────────── */
function QueueRow({
  item,
  idx,
  onOpen,
  onlineNurses,
  assignNurse,
  assigningVisitId,
  showDropdownFor,
  setShowDropdownFor,
}: {
  item: QueueItem;
  idx: number;
  onOpen: (id: string) => void;
  onlineNurses: Nurse[];
  assignNurse: (visitId: string, nurseId: string) => Promise<void>;
  assigningVisitId: string | null;
  showDropdownFor: string | null;
  setShowDropdownFor: (id: string | null) => void;
}) {
  const p = getP(item.priority);
  const dot = TONES[p.tone].dot;
  const name = getPatientName(item);
  const blood = item.patient?.bloodType;
  const mins = waitMinutes(item.admissionDate);
  const isWaiting = !item.hasVitals;
  const needsNurse = !item.assignedNurseId;

  /* Long waits earn colour; ordinary ones stay quiet so the exceptions read. */
  const waitInk =
    mins >= 60
      ? "var(--critical-ink)"
      : mins >= 30
        ? "var(--urgent-ink)"
        : "var(--text-secondary)";

  return (
    <div
      className="grid items-center"
      style={{
        gridTemplateColumns: GRID,
        gap: 14,
        padding: "12px 20px",
        borderBottom: "1px solid var(--border-faint)",
        transition: "background var(--dur-fast) var(--ease-standard)",
      }}
      {...hoverRow}
    >
      {/* Priority dot — pulses only while the patient is still untriaged. */}
      <span className="relative flex justify-self-center" style={{ width: 8, height: 8 }}>
        {isWaiting && (
          <span
            className="absolute inset-0 rounded-full"
            style={{
              background: dot,
              animation: "hcPing 2.4s cubic-bezier(0,0,0.2,1) infinite",
            }}
          />
        )}
        <span
          className="relative rounded-full"
          style={{ width: 8, height: 8, background: dot }}
        />
      </span>

      <Avatar name={name} seed={idx} />

      <div className="min-w-0 flex flex-col" style={{ gap: 4 }}>
        <div className="flex items-center min-w-0" style={{ gap: 8 }}>
          <button
            onClick={() => onOpen(item.id)}
            className="truncate text-left"
            style={{
              margin: 0,
              border: "none",
              background: "transparent",
              padding: 0,
              cursor: "pointer",
              font: "600 14px/1.2 var(--font-sans)",
              color: "var(--text-primary)",
            }}
          >
            {name}
          </button>

          {blood && (
            <span
              className="inline-flex items-center flex-shrink-0"
              style={{
                gap: 3,
                height: 18,
                padding: "0 7px",
                borderRadius: "var(--r-pill)",
                background: "var(--surface-sunken)",
                color: "var(--text-secondary)",
                font: "700 10px/1 var(--font-mono)",
              }}
            >
              <Droplets className="w-[10px] h-[10px]" />
              {blood}
            </span>
          )}

          <span
            className="flex-shrink-0"
            style={{ font: "500 11px/1 var(--font-mono)", color: "var(--text-disabled)" }}
          >
            {item.visitNumber}
          </span>
        </div>

        <div className="flex items-center min-w-0" style={{ gap: 8 }}>
          <p
            className="truncate"
            style={{
              margin: 0,
              font: "400 12.5px/1.2 var(--font-sans)",
              color: "var(--text-secondary)",
            }}
          >
            {item.chiefComplaint || "No chief complaint recorded"}
          </p>

          {item.assignedNurseName && (
            <span
              className="inline-flex items-center flex-shrink-0"
              style={{ gap: 4, font: "500 11.5px/1 var(--font-sans)", color: "var(--green-800)" }}
            >
              <CheckCircle2 className="w-3 h-3" />
              {item.assignedNurseName}
            </span>
          )}
        </div>
      </div>

      <div className="text-right flex flex-col" style={{ gap: 4 }}>
        <p style={{ margin: 0, font: "600 13px/1 var(--font-mono)", color: waitInk }}>
          {waitLabel(mins)}
        </p>
        <p style={{ margin: 0, font: "400 11px/1 var(--font-mono)", color: "var(--text-disabled)" }}>
          {format(new Date(item.admissionDate), "HH:mm")}
        </p>
      </div>

      <Pill tone={p.tone} style={{ justifySelf: "start" }}>
        {p.label}
      </Pill>

      <div className="relative flex justify-end">
        {needsNurse ? (
          <>
            <Button
              size="sm"
              icon={assigningVisitId === item.id ? undefined : UserCheck}
              loading={assigningVisitId === item.id}
              onClick={() =>
                setShowDropdownFor(showDropdownFor === item.id ? null : item.id)
              }
            >
              Assign
            </Button>

            {showDropdownFor === item.id && (
              <div
                className="absolute right-0 z-20"
                style={{
                  top: 34,
                  width: 200,
                  background: "var(--surface-card)",
                  borderRadius: "var(--r-sm)",
                  border: "1px solid var(--hc-border)",
                  boxShadow: "var(--elev-3)",
                  overflow: "hidden",
                }}
              >
                <SectionLabel
                  style={{ padding: "9px 12px", borderBottom: "1px solid var(--border-faint)" }}
                >
                  Assign nurse
                </SectionLabel>

                <div style={{ maxHeight: 200, overflowY: "auto", padding: 4 }}>
                  {onlineNurses.length === 0 ? (
                    <p
                      style={{
                        margin: 0,
                        padding: "14px 12px",
                        textAlign: "center",
                        font: "400 12.5px/1.3 var(--font-sans)",
                        color: "var(--text-muted)",
                      }}
                    >
                      No nurses online
                    </p>
                  ) : (
                    onlineNurses.map((nurse) => (
                      <button
                        key={nurse.id}
                        onClick={() => assignNurse(item.id, nurse.id)}
                        className="w-full flex items-center text-left"
                        style={{
                          gap: 9,
                          padding: "8px 9px",
                          border: "none",
                          borderRadius: "var(--r-xs)",
                          background: "transparent",
                          cursor: "pointer",
                        }}
                        {...hoverRow}
                      >
                        <Avatar
                          name={`${nurse.firstName} ${nurse.lastName}`}
                          size={26}
                          seed={1}
                        />
                        <span
                          className="flex-1 min-w-0 truncate"
                          style={{
                            font: "500 12.5px/1 var(--font-sans)",
                            color: "var(--text-primary)",
                          }}
                        >
                          {nurse.firstName} {nurse.lastName}
                        </span>
                      </button>
                    ))
                  )}
                </div>

                <button
                  onClick={() => setShowDropdownFor(null)}
                  className="w-full"
                  style={{
                    padding: 8,
                    border: "none",
                    borderTop: "1px solid var(--border-faint)",
                    background: "transparent",
                    font: "500 11.5px/1 var(--font-sans)",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
          </>
        ) : (
          <LinkAction onClick={() => onOpen(item.id)}>Open</LinkAction>
        )}
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */
export default function ReceptionistOverviewPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [onlineNurses, setOnlineNurses] = useState<Nurse[]>([]);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [dropdownFor, setDropdownFor] = useState<string | null>(null);

  const institutionName = (user as any)?.institutionName ?? null;
  const institutionId = (user as any)?.institutionId ?? null;
  const hasInstitution = !!institutionName || !!institutionId;

  const fetchData = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const [queueRes, nursesRes] = await Promise.all([
        api.get("/api/visits/today"),
        practitionersApi.getOnlineStaff("nurse"),
      ]);
      setQueue(queueRes.data.data?.visits ?? []);
      setOnlineNurses(nursesRes.data.data?.staff ?? []);
      setLastUpdated(new Date());
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const assignNurse = async (visitId: string, nurseId: string) => {
    setAssigningId(visitId);
    try {
      await visitApi.assignNurse(visitId, nurseId);
      await fetchData(true);
      setDropdownFor(null);
    } catch {
      alert("Failed to assign nurse. Please try again.");
    } finally {
      setAssigningId(null);
    }
  };

  useEffect(() => {
    fetchData();
    const iv = setInterval(() => fetchData(true), 30_000);
    return () => clearInterval(iv);
  }, [fetchData]);

  /*
   * Derived counts. /api/visits/today returns only status === "in-progress",
   * so filtering on "waiting" or "completed" always produced 0 — triage state
   * is what separates them in practice.
   */
  const waiting = queue.filter((q) => !q.hasVitals).length;
  const inProgress = queue.filter((q) => q.hasVitals).length;
  const urgent = queue.filter((q) =>
    ["critical", "emergency"].includes(q.priority),
  ).length;

  const liveQueue = useMemo(
    () =>
      [...queue].sort((a, b) => {
        const o: Record<string, number> = {
          critical: 0,
          emergency: 1,
          urgent: 2,
          routine: 3,
        };
        const po = (o[a.priority] ?? 9) - (o[b.priority] ?? 9);
        if (po !== 0) return po;
        // Within a priority band, longest wait first.
        return (
          new Date(a.admissionDate).getTime() - new Date(b.admissionDate).getTime()
        );
      }),
    [queue],
  );

  const untriagedUrgent = queue.filter(
    (q) => !q.hasVitals && ["critical", "emergency", "urgent"].includes(q.priority),
  ).length;

  const openVisit = (id: string) =>
    router.push(`/dashboard/receptionist/visits/${id}`);

  return (
    <Page>
      <PageHeader
        eyebrow="Front desk"
        title={hasInstitution ? institutionName : "No institution assigned"}
        subtitle={
          <>
            {loading
              ? "Loading today's queue…"
              : `${queue.length} encounter${queue.length !== 1 ? "s" : ""} today · queue auto-refreshes every 30 seconds`}
            {lastUpdated && !loading ? ` · updated ${format(lastUpdated, "HH:mm")}` : ""}
          </>
        }
        actions={
          <>
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => router.push("/dashboard/receptionist/visits/new")}
            >
              New visit
            </Button>
            <Button
              icon={User}
              onClick={() => router.push("/dashboard/receptionist/register")}
            >
              Register patient
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

      {/* Urgent arrivals still awaiting triage — the one thing that cannot wait. */}
      {!loading && untriagedUrgent > 0 && (
        <Banner
          tone="critical"
          icon={AlertTriangle}
          onClick={() => router.push("/dashboard/receptionist/queue")}
          action={
            <span
              className="inline-flex items-center whitespace-nowrap"
              style={{ gap: 4, font: "700 12.5px/1 var(--font-sans)", color: "var(--critical-ink)" }}
            >
              Open queue
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          }
        >
          {untriagedUrgent} patient{untriagedUrgent !== 1 ? "s are" : " is"} marked
          urgent or critical and still waiting on triage.
        </Banner>
      )}

      <KpiGrid>
        <KpiCard
          label="Total today"
          value={queue.length}
          sub="All encounters"
          icon={ClipboardList}
          tone="brand"
          loading={loading}
        />
        <KpiCard
          label="Waiting"
          value={waiting}
          sub="Not yet triaged"
          icon={Clock}
          tone="urgent"
          loading={loading}
        />
        <KpiCard
          label="In care"
          value={inProgress}
          sub="Triaged and active"
          icon={Activity}
          tone="info"
          loading={loading}
        />
        <KpiCard
          label="Urgent"
          value={urgent}
          sub="Critical or emergency"
          icon={Zap}
          tone="critical"
          loading={loading}
        />
      </KpiGrid>

      <div className="flex flex-wrap" style={{ gap: 16, alignItems: "flex-start" }}>
        {/* Live queue */}
        <div style={{ flex: "1 1 560px", minWidth: 0 }}>
          <Card>
            <CardHeader
              icon={Activity}
              title="Live queue"
              subtitle="Priority-sorted · longest wait first"
              right={
                <>
                  <div className="hidden sm:flex items-center" style={{ gap: 6 }}>
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background:
                          onlineNurses.length > 0 ? "var(--green-600)" : "var(--ink-300)",
                      }}
                    />
                    <span
                      style={{
                        font: "500 12px/1 var(--font-sans)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {onlineNurses.length} nurse{onlineNurses.length !== 1 ? "s" : ""} online
                    </span>
                  </div>
                  <LinkAction onClick={() => router.push("/dashboard/receptionist/queue")}>
                    Full queue
                  </LinkAction>
                </>
              }
            />

            {/* Column headers */}
            <div
              className="hidden md:grid items-center"
              style={{
                gridTemplateColumns: GRID,
                gap: 14,
                padding: "9px 20px",
                background: "var(--surface-sunken)",
                borderBottom: "1px solid var(--border-faint)",
              }}
            >
              <span />
              <span />
              <SectionLabel>Patient</SectionLabel>
              <SectionLabel style={{ textAlign: "right" }}>Wait</SectionLabel>
              <SectionLabel>Priority</SectionLabel>
              <SectionLabel style={{ textAlign: "right" }}>Action</SectionLabel>
            </div>

            {loading ? (
              [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
            ) : liveQueue.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="No active visits"
                message="New check-ins will appear here automatically."
              />
            ) : (
              liveQueue.slice(0, 8).map((item, idx) => (
                <QueueRow
                  key={item.id}
                  item={item}
                  idx={idx}
                  onOpen={openVisit}
                  onlineNurses={onlineNurses}
                  assignNurse={assignNurse}
                  assigningVisitId={assigningId}
                  showDropdownFor={dropdownFor}
                  setShowDropdownFor={setDropdownFor}
                />
              ))
            )}

            {!loading && liveQueue.length > 8 && (
              <div className="flex justify-center" style={{ padding: 12 }}>
                <LinkAction onClick={() => router.push("/dashboard/receptionist/queue")}>
                  +{liveQueue.length - 8} more in the full queue
                </LinkAction>
              </div>
            )}
          </Card>
        </div>

        {/* Side rail */}
        <div
          style={{
            flex: "1 1 320px",
            minWidth: 300,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <Card>
            <div style={{ padding: "16px 18px 14px" }}>
              <div
                className="flex items-baseline justify-between"
                style={{ gap: 10, marginBottom: 2 }}
              >
                <p
                  style={{
                    margin: 0,
                    font: "700 14.5px/1 var(--font-sans)",
                    color: "var(--text-primary)",
                  }}
                >
                  Arrivals today
                </p>
                <SectionLabel>06:00 – 18:00</SectionLabel>
              </div>
              <p
                style={{
                  margin: "0 0 14px",
                  font: "400 12px/1 var(--font-sans)",
                  color: "var(--text-muted)",
                }}
              >
                Check-ins by hour of arrival
              </p>

              {loading ? <SkeletonBlock /> : <ArrivalsChart queue={queue} />}
            </div>
          </Card>

          <Card pad={18}>
            <p
              style={{
                margin: "0 0 14px",
                font: "700 14.5px/1 var(--font-sans)",
                color: "var(--text-primary)",
              }}
            >
              Visit status
            </p>
            {loading ? (
              <SkeletonBlock height={88} />
            ) : (
              <StatusDonut waiting={waiting} inProgress={inProgress} total={queue.length} />
            )}
          </Card>

          <Card>
            <SectionLabel
              style={{ padding: "13px 18px", borderBottom: "1px solid var(--border-faint)" }}
            >
              Quick actions
            </SectionLabel>
            <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 2 }}>
              {[
                {
                  label: "Register patient",
                  sub: "Create a new record",
                  href: "/dashboard/receptionist/register",
                  icon: UserPlus,
                },
                {
                  label: "Scan hospital ID",
                  sub: "Check in from the patient app",
                  href: "/dashboard/receptionist/scan",
                  icon: QrCode,
                },
                {
                  label: "Book appointment",
                  sub: "Schedule a return visit",
                  href: "/dashboard/receptionist/appointments",
                  icon: Calendar,
                },
                {
                  label: "All patients",
                  sub: "Search the register",
                  href: "/dashboard/receptionist/patients",
                  icon: Users,
                },
              ].map(({ label, sub, href, icon: Icon }) => (
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
                      background: "var(--brand-tint)",
                      color: "var(--green-700)",
                    }}
                  >
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="flex-1 flex flex-col" style={{ gap: 3 }}>
                    <span
                      style={{ font: "600 13.5px/1 var(--font-sans)", color: "var(--text-primary)" }}
                    >
                      {label}
                    </span>
                    <span
                      style={{ font: "400 11.5px/1 var(--font-sans)", color: "var(--text-muted)" }}
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
