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
  CheckCircle2,
  AlertCircle,
  Activity,
  ChevronRight,
  Zap,
  RefreshCw,
  User,
  UserCheck,
  Loader2,
  Building2,
  TrendingUp,
  ArrowRight,
  Droplets,
} from "lucide-react";
import { formatDistanceToNow, format, getHours } from "date-fns";

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
}

interface Nurse {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  specialization: string | null;
  lastSeenAt: string | null;
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  forest: "#052e16",
  forestMid: "#064e23",
  green: "#16a34a",
  greenLight: "#86efac",
  greenGhost: "#f0fdf4",
  ink: "#0a0f0d",
  inkSoft: "#374151",
  inkMuted: "#6b7280",
  inkFaint: "#e5e7eb",
  white: "#ffffff",
  amber: "#f59e0b",
  amberLight: "#fef3c7",
  coral: "#ef4444",
  coralLight: "#fef2f2",
  blue: "#2563eb",
  blueLight: "#eff6ff",
  violet: "#7c3aed",
  violetLight: "#faf5ff",
  border: "#f3f4f6",
  bg: "#f8faf9",
};

const PRIORITY: Record<
  string,
  { color: string; bg: string; border: string; dot: string; label: string }
> = {
  routine: {
    color: T.green,
    bg: T.greenGhost,
    border: "#bbf7d0",
    dot: T.green,
    label: "Routine",
  },
  urgent: {
    color: "#b45309",
    bg: T.amberLight,
    border: "#fde68a",
    dot: T.amber,
    label: "Urgent",
  },
  emergency: {
    color: T.coral,
    bg: T.coralLight,
    border: "#fecaca",
    dot: T.coral,
    label: "Emergency",
  },
  critical: {
    color: T.violet,
    bg: T.violetLight,
    border: "#e9d5ff",
    dot: T.violet,
    label: "Critical",
  },
};

const BLOOD: Record<string, string> = {
  "A+": "#3b82f6",
  "A-": "#6366f1",
  "B+": "#8b5cf6",
  "B-": "#ec4899",
  "AB+": "#f59e0b",
  "AB-": "#ef4444",
  "O+": "#10b981",
  "O-": "#14b8a6",
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function getInitials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

function getPatientName(item: QueueItem) {
  if (item.patientName) return item.patientName;
  if (item.patient) return `${item.patient.firstName} ${item.patient.lastName}`;
  return "Unknown Patient";
}

// ── SVG Sparkline area chart ──────────────────────────────────────────────────
function VisitSparkline({ queue }: { queue: QueueItem[] }) {
  const W = 340,
    H = 72;
  const SLOTS = 12; // 06:00 – 18:00, one per hour

  // Bucket visits by hour of day (06 – 17)
  const buckets = useMemo(() => {
    const b = Array(SLOTS).fill(0);
    queue.forEach((v) => {
      const h = getHours(new Date(v.admissionDate));
      const idx = Math.min(Math.max(h - 6, 0), SLOTS - 1);
      b[idx]++;
    });
    return b;
  }, [queue]);

  const maxVal = Math.max(...buckets, 1);
  const pad = { l: 4, r: 4, t: 8, b: 4 };
  const gW = W - pad.l - pad.r;
  const gH = H - pad.t - pad.b;

  // Build SVG path
  const pts = buckets.map((v, i) => ({
    x: pad.l + (i / (SLOTS - 1)) * gW,
    y: pad.t + gH - (v / maxVal) * gH,
  }));

  const linePath = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L${pts[pts.length - 1].x.toFixed(1)},${(pad.t + gH).toFixed(1)} L${pts[0].x.toFixed(1)},${(pad.t + gH).toFixed(1)} Z`;

  const currentHour = getHours(new Date());
  const nowX =
    pad.l +
    (Math.min(Math.max(currentHour - 6, 0), SLOTS - 1) / (SLOTS - 1)) * gW;

  const hourLabels = ["6am", "8am", "10am", "12pm", "2pm", "4pm", "6pm"];
  const labelIndices = [0, 2, 4, 6, 8, 10, 12];

  return (
    <div>
      <svg
        width="100%"
        viewBox={`0 0 ${W} ${H + 14}`}
        preserveAspectRatio="none"
        style={{ overflow: "visible" }}
      >
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={T.green} stopOpacity="0.18" />
            <stop offset="100%" stopColor={T.green} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={pad.l}
            y1={pad.t + gH - f * gH}
            x2={W - pad.r}
            y2={pad.t + gH - f * gH}
            stroke={T.inkFaint}
            strokeWidth="0.5"
            strokeDasharray="3 3"
          />
        ))}

        {/* Area fill */}
        <path d={areaPath} fill="url(#sparkGrad)" />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke={T.green}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data dots */}
        {pts.map(
          (p, i) =>
            buckets[i] > 0 && (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r="2.5"
                fill={T.white}
                stroke={T.green}
                strokeWidth="1.5"
              />
            ),
        )}

        {/* Now line */}
        {currentHour >= 6 && currentHour <= 18 && (
          <>
            <line
              x1={nowX}
              y1={pad.t}
              x2={nowX}
              y2={pad.t + gH}
              stroke={T.coral}
              strokeWidth="1"
              strokeDasharray="3 2"
              opacity="0.6"
            />
            <text
              x={nowX + 3}
              y={pad.t + 7}
              fontSize="7"
              fill={T.coral}
              opacity="0.7"
            >
              now
            </text>
          </>
        )}

        {/* Hour labels */}
        {labelIndices.map((idx, i) => (
          <text
            key={idx}
            x={pad.l + (idx / (SLOTS - 1)) * gW}
            y={H + 11}
            fontSize="8"
            fill={T.inkMuted}
            textAnchor="middle"
          >
            {hourLabels[i]}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ── Donut chart ───────────────────────────────────────────────────────────────
function StatusDonut({
  waiting,
  inProgress,
  done,
  total,
}: {
  waiting: number;
  inProgress: number;
  done: number;
  total: number;
}) {
  const R = 28,
    CX = 36,
    CY = 36,
    STROKE = 7;
  const circumference = 2 * Math.PI * R;

  const segments = [
    { value: done, color: T.green, label: "Done" },
    { value: inProgress, color: T.blue, label: "Active" },
    { value: waiting, color: T.amber, label: "Waiting" },
  ];

  let offset = 0;
  const arcs = segments.map((s) => {
    const frac = total > 0 ? s.value / total : 0;
    const dash = frac * circumference;
    const gap = circumference - dash;
    const start = offset;
    offset += dash;
    return { ...s, dash, gap, start };
  });

  return (
    <div className="flex items-center gap-4">
      <svg width="72" height="72">
        <circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke={T.inkFaint}
          strokeWidth={STROKE}
        />
        {arcs.map((arc, i) => (
          <circle
            key={i}
            cx={CX}
            cy={CY}
            r={R}
            fill="none"
            stroke={arc.color}
            strokeWidth={STROKE}
            strokeDasharray={`${arc.dash} ${arc.gap}`}
            strokeDashoffset={-arc.start}
            style={{
              transform: "rotate(-90deg)",
              transformOrigin: `${CX}px ${CY}px`,
            }}
          />
        ))}
        <text
          x={CX}
          y={CY + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="13"
          fontWeight="800"
          fill={T.ink}
        >
          {total}
        </text>
        <text
          x={CX}
          y={CY + 12}
          textAnchor="middle"
          fontSize="6.5"
          fill={T.inkMuted}
        >
          visits
        </text>
      </svg>
      <div className="space-y-1.5">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: s.color }}
            />
            <span className="text-xs text-gray-500 font-medium w-12">
              {s.label}
            </span>
            <span className="text-xs font-bold text-gray-800 tabular-nums">
              {s.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Queue row ─────────────────────────────────────────────────────────────────
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
  const p = PRIORITY[item.priority] ?? PRIORITY.routine;
  const isActive = item.status === "in-progress";
  const isWaiting = item.status === "waiting";
  const name = getPatientName(item);
  const bloodType = item.patient?.bloodType;
  const waitMins = Math.floor(
    (Date.now() - new Date(item.admissionDate).getTime()) / 60_000,
  );

  return (
    <div
      className="group grid items-center gap-3 px-5 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/70 transition-colors cursor-pointer"
      style={{ gridTemplateColumns: "20px 36px 1fr 80px 72px 88px" }}
      onClick={() => onOpen(item.id)}
    >
      {/* Priority indicator */}
      <div className="flex items-center justify-center">
        <span className="relative flex h-2 w-2">
          {(isActive || item.priority === "critical") && (
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-40"
              style={{ background: p.dot }}
            />
          )}
          <span
            className="relative inline-flex rounded-full h-2 w-2"
            style={{ background: p.dot }}
          />
        </span>
      </div>

      {/* Avatar */}
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
        style={{ background: `${p.dot}cc` }}
      >
        {getInitials(name)}
      </div>

      {/* Info */}
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
          {bloodType && bloodType !== "unknown" && (
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white flex-shrink-0 flex items-center gap-0.5"
              style={{ background: BLOOD[bloodType] ?? "#6b7280" }}
            >
              <Droplets className="w-2 h-2" />
              {bloodType}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 truncate">
          {item.chiefComplaint || "—"}
        </p>
        {item.assignedNurseName && (
          <p className="text-xs text-green-600 mt-0.5 flex items-center gap-1">
            <UserCheck className="w-2.5 h-2.5" />
            {item.assignedNurseName}
          </p>
        )}
      </div>

      {/* Wait time */}
      <div className="text-right">
        <p
          className="text-xs font-semibold tabular-nums"
          style={{
            color:
              waitMins > 60 ? T.coral : waitMins > 30 ? T.amber : T.inkMuted,
          }}
        >
          {waitMins < 60
            ? `${waitMins}m`
            : `${Math.floor(waitMins / 60)}h${waitMins % 60}m`}
        </p>
        <p className="text-[10px] text-gray-300">
          {format(new Date(item.admissionDate), "HH:mm")}
        </p>
      </div>

      {/* Priority pill */}
      <span
        className="text-[10px] font-bold px-2 py-1 rounded-full text-center capitalize leading-none"
        style={{
          background: p.bg,
          color: p.color,
          border: `1px solid ${p.border}`,
        }}
      >
        {p.label}
      </span>

      {/* Action */}
      <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
        {isWaiting ? (
          <div className="relative">
            {showDropdownFor === item.id ? (
              <div className="absolute right-0 top-0 mt-8 z-20 bg-white rounded-xl shadow-xl border border-gray-100 w-48">
                <div className="p-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-2 py-1">
                    Assign nurse
                  </p>
                  {onlineNurses.length === 0 ? (
                    <p className="text-xs text-gray-400 px-2 py-2">
                      No nurses online
                    </p>
                  ) : (
                    onlineNurses.map((nurse) => (
                      <button
                        key={nurse.id}
                        onClick={() => {
                          setShowDropdownFor(null);
                          assignNurse(item.id, nurse.id);
                        }}
                        disabled={assigningVisitId === item.id}
                        className="w-full text-left px-2 py-2 text-sm rounded-lg hover:bg-gray-50 flex items-center gap-2 transition-colors"
                      >
                        <div className="w-6 h-6 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-[9px] font-bold text-green-700">
                            {nurse.firstName[0]}
                            {nurse.lastName[0]}
                          </span>
                        </div>
                        <span className="font-medium text-gray-800">
                          {nurse.firstName} {nurse.lastName}
                        </span>
                        {assigningVisitId === item.id && (
                          <Loader2 className="w-3 h-3 animate-spin ml-auto text-gray-400" />
                        )}
                      </button>
                    ))
                  )}
                  <div className="border-t border-gray-100 mt-1 pt-1">
                    <button
                      onClick={() => setShowDropdownFor(null)}
                      className="w-full text-xs text-gray-400 px-2 py-1.5 hover:bg-gray-50 rounded-lg text-left"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowDropdownFor(item.id)}
                disabled={assigningVisitId === item.id}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border"
                style={{
                  background: T.violetLight,
                  color: T.violet,
                  borderColor: "#e9d5ff",
                }}
              >
                {assigningVisitId === item.id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <User className="w-3 h-3" />
                )}
                Assign
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={() => onOpen(item.id)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: T.greenGhost,
              color: T.green,
              border: "1px solid #bbf7d0",
            }}
          >
            Open <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
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
  const [mounted, setMounted] = useState(false);

  const institutionName = (user as any)?.institutionName ?? null;
  const institutionId = (user as any)?.institutionId ?? null;
  const hasInstitution = !!institutionName || !!institutionId;

  useEffect(() => {
    setMounted(true);
  }, []);

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

  // Derived
  const waiting = queue.filter((q) => q.status === "waiting").length;
  const inProgress = queue.filter((q) => q.status === "in-progress").length;
  const done = queue.filter((q) =>
    ["completed", "discharged"].includes(q.status),
  ).length;
  const urgent = queue.filter((q) =>
    ["critical", "emergency"].includes(q.priority),
  ).length;

  const liveQueue = useMemo(
    () =>
      queue
        .filter((q) => ["in-progress", "waiting"].includes(q.status))
        .sort((a, b) => {
          const o: Record<string, number> = {
            critical: 0,
            emergency: 1,
            urgent: 2,
            routine: 3,
          };
          return (o[a.priority] ?? 9) - (o[b.priority] ?? 9);
        }),
    [queue],
  );

  // Hourly throughput for last 6 hours (for the bar mini-chart)
  const hourlyBars = useMemo(() => {
    const now = new Date();
    const bars: { label: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const h = new Date(now);
      h.setHours(h.getHours() - i, 0, 0, 0);
      const label = format(h, "HH:mm");
      const count = queue.filter((v) => {
        const vh = new Date(v.admissionDate);
        return vh >= h && vh < new Date(h.getTime() + 3_600_000);
      }).length;
      bars.push({ label, count });
    }
    return bars;
  }, [queue]);
  const barMax = Math.max(...hourlyBars.map((b) => b.count), 1);

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }} className="space-y-5">
      {/* ── Header bar ────────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${T.forest} 0%, ${T.forestMid} 60%, #0a5c2e 100%)`,
        }}
      >
        {/* Subtle grid texture overlay */}
        <div
          className="px-7 py-6 relative"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        >
          {/* Glow blobs */}
          <div
            className="absolute top-0 right-0 w-96 h-40 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at top right, rgba(134,239,172,0.08), transparent 60%)",
            }}
          />
          <div
            className="absolute bottom-0 left-20 w-64 h-24 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse, rgba(74,222,128,0.06), transparent 70%)",
            }}
          />

          <div className="relative flex items-start justify-between gap-4 flex-wrap">
            <div>
              {/* Eyebrow */}
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                <span className="text-green-400/70 text-xs font-semibold tracking-widest uppercase">
                  {format(new Date(), "EEEE, dd MMMM yyyy")}
                </span>
              </div>

              <h1
                className="text-white text-2xl font-bold leading-tight mb-1"
                style={{
                  fontFamily: "'Playfair Display', serif",
                  letterSpacing: "-0.02em",
                }}
              >
                {greeting()}, {user?.firstName}
              </h1>

              {/* Institution */}
              {hasInstitution ? (
                <div className="flex items-center gap-1.5 mt-1">
                  <Building2 className="w-3.5 h-3.5 text-green-400/60 flex-shrink-0" />
                  <span className="text-green-200/70 text-sm font-medium">
                    {institutionName}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 mt-1">
                  <Building2 className="w-3.5 h-3.5 text-red-400/60" />
                  <span className="text-red-300/70 text-sm">
                    No institution — contact admin
                  </span>
                </div>
              )}

              {/* Live counts */}
              {!loading && (
                <div className="flex flex-wrap items-center gap-4 mt-3">
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-50" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
                    </span>
                    <span className="text-green-300/90 text-xs font-semibold">
                      {inProgress} active · {waiting} waiting
                    </span>
                  </div>
                  {urgent > 0 && (
                    <div className="flex items-center gap-1.5 text-red-300 text-xs font-semibold">
                      <Zap className="w-3 h-3" />
                      {urgent} urgent/critical
                    </div>
                  )}
                  {done > 0 && (
                    <div className="flex items-center gap-1.5 text-green-400/70 text-xs">
                      <CheckCircle2 className="w-3 h-3" />
                      {done} discharged
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-2 flex-shrink-0 mt-1">
              {lastUpdated && (
                <span className="text-green-400/30 text-xs hidden sm:block">
                  {format(lastUpdated, "HH:mm")}
                </span>
              )}
              <button
                onClick={() => fetchData(true)}
                disabled={refreshing}
                className="p-2.5 rounded-xl transition-all disabled:opacity-40"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.09)",
                }}
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 text-green-300 ${refreshing ? "animate-spin" : ""}`}
                />
              </button>
              <button
                onClick={() =>
                  router.push("/dashboard/receptionist/visits/new")
                }
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:-translate-y-px hover:shadow-lg"
                style={{
                  background: "linear-gradient(135deg, #16a34a, #15803d)",
                }}
              >
                <UserPlus className="w-4 h-4" />
                New Visit
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI strip ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            icon: ClipboardList,
            label: "Total Today",
            value: queue.length,
            color: T.forest,
            bg: "linear-gradient(135deg,#f0fdf4,#dcfce7)",
            border: "#bbf7d0",
            sub: "all encounters",
          },
          {
            icon: Clock,
            label: "Waiting",
            value: waiting,
            color: "#92400e",
            bg: "linear-gradient(135deg,#fffbeb,#fef3c7)",
            border: "#fde68a",
            sub: `avg ${Math.max(0, Math.floor((Date.now() - (queue.find((q) => q.status === "waiting") ? new Date(queue.find((q) => q.status === "waiting")!.admissionDate).getTime() : Date.now())) / 60_000))}m`,
          },
          {
            icon: Activity,
            label: "In Progress",
            value: inProgress,
            color: T.blue,
            bg: "linear-gradient(135deg,#eff6ff,#dbeafe)",
            border: "#bfdbfe",
            sub: "active right now",
          },
          {
            icon: CheckCircle2,
            label: "Completed",
            value: done,
            color: T.violet,
            bg: "linear-gradient(135deg,#faf5ff,#ede9fe)",
            border: "#ddd6fe",
            sub: "discharged today",
          },
        ].map(({ icon: Icon, label, value, color, bg, border, sub }, i) => (
          <div
            key={label}
            className="relative rounded-2xl p-4 border overflow-hidden"
            style={{
              background: bg,
              borderColor: border,
              animationDelay: `${i * 60}ms`,
              opacity: mounted ? 1 : 0,
              transform: mounted ? "none" : "translateY(6px)",
              transition: `opacity 0.3s ${i * 60}ms, transform 0.3s ${i * 60}ms`,
            }}
          >
            {/* Decorative circle */}
            <div
              className="absolute -right-3 -bottom-3 w-14 h-14 rounded-full opacity-[0.08]"
              style={{ background: color }}
            />
            <Icon className="w-4 h-4 mb-3" style={{ color }} />
            <p
              className="text-3xl font-extrabold leading-none tabular-nums"
              style={{ color }}
            >
              {loading ? (
                <span className="inline-block w-8 h-7 rounded-lg bg-black/5 animate-pulse" />
              ) : (
                value
              )}
            </p>
            <p
              className="text-xs font-bold mt-1"
              style={{ color, opacity: 0.8 }}
            >
              {label}
            </p>
            <p className="text-[10px] mt-0.5" style={{ color, opacity: 0.45 }}>
              {sub}
            </p>
          </div>
        ))}
      </div>

      {/* ── Main grid ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* ── Queue table — 8 cols ────────────────────────────────────────── */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-green-50">
                <Activity className="w-4 h-4 text-green-700" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">Live Queue</h2>
                <p className="text-xs text-gray-400">
                  Priority-sorted · auto-refresh 30s
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                <span>{onlineNurses.length} nurses online</span>
              </div>
              <button
                onClick={() => router.push("/dashboard/receptionist/queue")}
                className="flex items-center gap-1 text-xs font-semibold text-green-700 hover:underline"
              >
                Full queue <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Column headers */}
          {!loading && liveQueue.length > 0 && (
            <div
              className="grid px-5 py-2 border-b border-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-400"
              style={{ gridTemplateColumns: "20px 36px 1fr 80px 72px 88px" }}
            >
              <div />
              <div />
              <div>Patient</div>
              <div className="text-right">Wait</div>
              <div>Priority</div>
              <div className="text-right">Action</div>
            </div>
          )}

          {loading ? (
            <div className="divide-y divide-gray-50">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 px-5 py-3.5 animate-pulse"
                >
                  <div className="w-2 h-2 rounded-full bg-gray-100 flex-shrink-0" />
                  <div className="w-8 h-8 rounded-xl bg-gray-100 flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 w-32 bg-gray-100 rounded" />
                    <div className="h-3 w-48 bg-gray-100 rounded" />
                  </div>
                  <div className="w-14 h-6 bg-gray-100 rounded-full" />
                </div>
              ))}
            </div>
          ) : liveQueue.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-3">
                <ClipboardList className="w-5 h-5 text-green-300" />
              </div>
              <p className="text-sm font-semibold text-gray-500">
                Queue is clear
              </p>
              <p className="text-xs text-gray-400 mt-1">
                No active or waiting patients
              </p>
              <button
                onClick={() =>
                  router.push("/dashboard/receptionist/visits/new")
                }
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white"
                style={{ background: T.forest }}
              >
                <UserPlus className="w-3.5 h-3.5" /> Register first visit
              </button>
            </div>
          ) : (
            <>
              {liveQueue.slice(0, 8).map((item, idx) => (
                <QueueRow
                  key={item.id}
                  item={item}
                  idx={idx}
                  onOpen={(id) =>
                    router.push(`/dashboard/receptionist/visits/${id}`)
                  }
                  onlineNurses={onlineNurses}
                  assignNurse={assignNurse}
                  assigningVisitId={assigningId}
                  showDropdownFor={dropdownFor}
                  setShowDropdownFor={setDropdownFor}
                />
              ))}
              {liveQueue.length > 8 && (
                <button
                  onClick={() => router.push("/dashboard/receptionist/queue")}
                  className="w-full py-3 text-xs font-semibold text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5 border-t border-gray-50"
                >
                  +{liveQueue.length - 8} more in queue{" "}
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}
        </div>

        {/* ── Right column — 4 cols ───────────────────────────────────────── */}
        <div className="lg:col-span-4 space-y-4">
          {/* ── Analytics card ───────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 pt-5 pb-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-bold text-gray-900">Today's Flow</p>
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                  6AM – 6PM
                </span>
              </div>
              <p className="text-xs text-gray-400 mb-4">
                Visits by hour of arrival
              </p>

              {loading ? (
                <div className="h-[86px] bg-gray-50 rounded-xl animate-pulse" />
              ) : (
                <VisitSparkline queue={queue} />
              )}
            </div>

            {/* Mini bar chart — last 6 hours */}
            <div className="px-5 pb-4 pt-1 border-t border-gray-50">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
                Last 6 hours
              </p>
              <div className="flex items-end gap-1.5 h-10">
                {hourlyBars.map((bar, i) => (
                  <div
                    key={i}
                    className="flex-1 flex flex-col items-center gap-1"
                  >
                    <div
                      className="w-full rounded-t-sm transition-all"
                      style={{
                        height: `${Math.max(2, (bar.count / barMax) * 36)}px`,
                        background:
                          i === hourlyBars.length - 1
                            ? `linear-gradient(to top, ${T.green}, #22c55e)`
                            : "#e5e7eb",
                      }}
                    />
                    <span className="text-[8px] text-gray-400 tabular-nums">
                      {bar.label.slice(0, 5)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Status donut ─────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-sm font-bold text-gray-900 mb-4">Visit Status</p>
            {loading ? (
              <div className="h-[72px] bg-gray-50 rounded-xl animate-pulse" />
            ) : (
              <StatusDonut
                waiting={waiting}
                inProgress={inProgress}
                done={done}
                total={queue.length}
              />
            )}
            {urgent > 0 && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-100">
                <Zap className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                <p className="text-xs font-semibold text-red-700">
                  {urgent} critical/emergency patient{urgent !== 1 ? "s" : ""}
                </p>
              </div>
            )}
          </div>

          {/* ── Quick actions ─────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-50">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
                Quick actions
              </p>
            </div>
            <div className="p-3 space-y-1.5">
              {[
                {
                  icon: UserPlus,
                  label: "Register Patient",
                  sub: "New patient record",
                  href: "/dashboard/receptionist/register",
                  color: T.forest,
                },
                {
                  icon: ClipboardList,
                  label: "New Visit",
                  sub: "Start an encounter",
                  href: "/dashboard/receptionist/visits/new",
                  color: T.blue,
                },
                {
                  icon: Users,
                  label: "Patient Directory",
                  sub: "Browse records",
                  href: "/dashboard/receptionist/patients",
                  color: T.violet,
                },
              ].map(({ icon: Icon, label, sub, href, color }) => (
                <button
                  key={href}
                  onClick={() => router.push(href)}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl hover:bg-gray-50 transition-all group text-left"
                >
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${color}12` }}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">
                      {label}
                    </p>
                    <p className="text-xs text-gray-400">{sub}</p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-200 group-hover:text-gray-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
