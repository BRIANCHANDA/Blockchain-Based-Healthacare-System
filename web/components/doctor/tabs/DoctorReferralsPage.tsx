"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, appointmentApi } from "@/lib/api";
import {
  ArrowLeftRight,
  Building2,
  Clock,
  CheckCircle2,
  XCircle,
  Hourglass,
  AlertTriangle,
  Zap,
  RefreshCw,
  AlertCircle,
  ChevronRight,
  Search,
  X,
  Stethoscope,
  CalendarDays,
  User,
  ArrowRight,
} from "lucide-react";
import { format, formatDistanceToNow, isToday, isTomorrow } from "date-fns";

// ── Types ─────────────────────────────────────────────────────────────────────
interface ExternalReferral {
  id: string;
  referralNumber: string;
  patientName: string;
  patientId: string;
  reason: string;
  clinicalSummary: string;
  urgency: string;
  status: string;
  referredAt: string;
  acceptedAt?: string;
  completedAt?: string;
  responseNotes?: string;
  receivingInstitutionName: string;
}

interface InternalReferral {
  id: string;
  visitNumber: string;
  patientName: string;
  patientId: string;
  chiefComplaint: string;
  admittingDiagnosis: string;
  priority: string;
  admissionDate: string;
  status: string;
  // for outgoing (I sent it)
  assignedDoctorId?: string;
  doctorName?: string;
  // for incoming (sent to me)
  createdByPractitionerId?: string;
  referringDoctorName?: string;
}

// ── Config ────────────────────────────────────────────────────────────────────
const URGENCY: Record<
  string,
  {
    color: string;
    bg: string;
    border: string;
    dot: string;
    label: string;
    icon: any;
  }
> = {
  routine: {
    color: "#166534",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    dot: "#16a34a",
    label: "Routine",
    icon: Clock,
  },
  urgent: {
    color: "#d97706",
    bg: "#fffbeb",
    border: "#fde68a",
    dot: "#f59e0b",
    label: "Urgent",
    icon: AlertTriangle,
  },
  emergency: {
    color: "#ea580c",
    bg: "#fff7ed",
    border: "#fed7aa",
    dot: "#f97316",
    label: "Emergency",
    icon: AlertTriangle,
  },
  critical: {
    color: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca",
    dot: "#ef4444",
    label: "Critical",
    icon: Zap,
  },
};
const getU = (u: string) => URGENCY[u] ?? URGENCY.routine;

const STATUS: Record<
  string,
  { color: string; bg: string; border: string; label: string; icon: any }
> = {
  pending: {
    color: "#d97706",
    bg: "#fffbeb",
    border: "#fde68a",
    label: "Awaiting response",
    icon: Hourglass,
  },
  accepted: {
    color: "#1d4ed8",
    bg: "#eff6ff",
    border: "#bfdbfe",
    label: "Accepted",
    icon: CheckCircle2,
  },
  completed: {
    color: "#166534",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    label: "Completed",
    icon: CheckCircle2,
  },
  rejected: {
    color: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca",
    label: "Rejected",
    icon: XCircle,
  },
  cancelled: {
    color: "#6b7280",
    bg: "#f9fafb",
    border: "#e5e7eb",
    label: "Cancelled",
    icon: XCircle,
  },
  scheduled: {
    color: "#0891b2",
    bg: "#ecfeff",
    border: "#a5f3fc",
    label: "Scheduled",
    icon: CalendarDays,
  },
  "in-progress": {
    color: "#166534",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    label: "In Progress",
    icon: CheckCircle2,
  },
};
const getS = (s: string) => STATUS[s] ?? STATUS.pending;

type FilterKey = "all" | "pending" | "accepted" | "completed" | "rejected";
type MainTab = "incoming" | "outgoing-internal" | "outgoing-external";

// ── External referral card ────────────────────────────────────────────────────
function ExternalCard({ referral }: { referral: ExternalReferral }) {
  const u = getU(referral.urgency);
  const s = getS(referral.status);
  const StatusIcon = s.icon;
  const UrgencyIcon = u.icon;

  return (
    <div
      className="w-full bg-white rounded-2xl border overflow-hidden"
      style={{ borderColor: s.border }}
    >
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ background: s.bg }}
      >
        <div className="flex items-center gap-2">
          <StatusIcon className="w-3.5 h-3.5" style={{ color: s.color }} />
          <span className="text-xs font-bold" style={{ color: s.color }}>
            {s.label}
          </span>
        </div>
        <span className="text-xs font-mono text-gray-400">
          {referral.referralNumber}
        </span>
      </div>

      <div className="px-4 py-4 space-y-3">
        <div>
          <p className="text-sm font-bold text-gray-900">
            {referral.patientName}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <ArrowRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
            <p className="text-xs text-gray-500">
              {referral.receivingInstitutionName}
            </p>
          </div>
        </div>

        <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">
          {referral.reason}
        </p>

        <div className="flex items-center justify-between pt-1 border-t border-gray-50">
          <span
            className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full"
            style={{
              background: u.bg,
              color: u.color,
              border: `1px solid ${u.border}`,
            }}
          >
            <UrgencyIcon className="w-2.5 h-2.5" />
            {u.label}
          </span>
          <div className="text-right">
            <p className="text-[10px] text-gray-400">
              {formatDistanceToNow(new Date(referral.referredAt), {
                addSuffix: true,
              })}
            </p>
            {referral.acceptedAt && (
              <p className="text-[10px] text-blue-500 mt-0.5">
                Accepted{" "}
                {format(new Date(referral.acceptedAt), "dd MMM, HH:mm")}
              </p>
            )}
          </div>
        </div>

        {referral.responseNotes &&
          !referral.responseNotes.startsWith("Converted to visit") && (
            <div className="flex gap-2 px-3 py-2 rounded-xl bg-gray-50 border border-gray-100">
              <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wide flex-shrink-0 mt-0.5">
                Note
              </span>
              <p className="text-xs text-gray-600 italic">
                {referral.responseNotes}
              </p>
            </div>
          )}
        {referral.responseNotes?.startsWith("Converted to visit") && (
          <div className="flex gap-2 px-3 py-2 rounded-xl bg-green-50 border border-green-100">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-green-700 font-medium">
              Patient admitted at receiving institution
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Internal referral card ────────────────────────────────────────────────────
function InternalCard({
  referral,
  direction,
  onOpen,
}: {
  referral: InternalReferral;
  direction: "incoming" | "outgoing";
  onOpen?: () => void;
}) {
  const u = getU(referral.priority);
  const s = getS(referral.status);
  const UIcon = u.icon;
  const StatusIcon = s.icon;
  const date = new Date(referral.admissionDate);
  const dateLabel = isToday(date)
    ? "Today"
    : isTomorrow(date)
      ? "Tomorrow"
      : format(date, "EEE d MMM");

  return (
    <button
      onClick={onOpen}
      className={`w-full text-left bg-white rounded-2xl border overflow-hidden transition-all ${onOpen ? "hover:shadow-md hover:-translate-y-px" : ""} group`}
      style={{ borderColor: u.border }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ background: u.bg }}
      >
        <div className="flex items-center gap-2">
          <Stethoscope className="w-3.5 h-3.5" style={{ color: u.color }} />
          <span className="text-xs font-bold" style={{ color: u.color }}>
            {direction === "incoming"
              ? "Internal Referral — Incoming"
              : "Internal Referral — Sent"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Status pill */}
          <span
            className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{
              background: s.bg,
              color: s.color,
              border: `1px solid ${s.border}`,
            }}
          >
            <StatusIcon className="w-2.5 h-2.5" />
            {s.label}
          </span>
          <span className="text-xs font-mono text-gray-400">
            {referral.visitNumber}
          </span>
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {/* Patient */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <p className="text-sm font-bold text-gray-900">
                {referral.patientName}
              </p>
            </div>

            {/* Direction context */}
            {direction === "outgoing" && referral.doctorName && (
              <div className="flex items-center gap-1.5 mt-1 ml-5">
                <ArrowRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                <p className="text-xs text-gray-500">
                  Referred to{" "}
                  <span className="font-semibold text-gray-700">
                    Dr. {referral.doctorName}
                  </span>
                </p>
              </div>
            )}
            {direction === "incoming" && referral.referringDoctorName && (
              <div className="flex items-center gap-1.5 mt-1 ml-5">
                <ArrowRight
                  className="w-3 h-3 text-gray-400 flex-shrink-0"
                  style={{ transform: "scaleX(-1)" }}
                />
                <p className="text-xs text-gray-500">
                  From{" "}
                  <span className="font-semibold text-gray-700">
                    Dr. {referral.referringDoctorName}
                  </span>
                </p>
              </div>
            )}
          </div>
          {onOpen && (
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-green-600 transition-colors flex-shrink-0 mt-0.5" />
          )}
        </div>

        {/* Referral message / reason */}
        <div className="px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
            {direction === "outgoing"
              ? "Your Referral Note"
              : "Reason for Referral"}
          </p>
          <p className="text-xs text-gray-700 leading-relaxed">
            {referral.admittingDiagnosis || referral.chiefComplaint}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1 border-t border-gray-50">
          <span
            className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full"
            style={{
              background: u.bg,
              color: u.color,
              border: `1px solid ${u.border}`,
            }}
          >
            <UIcon className="w-2.5 h-2.5" />
            {u.label}
          </span>
          <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
            <CalendarDays className="w-3 h-3" />
            <span>
              {dateLabel} · {format(date, "h:mm a")}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
      <div className="h-9 bg-gray-50" />
      <div className="p-4 space-y-3">
        <div className="h-4 w-36 bg-gray-100 rounded" />
        <div className="h-3 w-48 bg-gray-100 rounded" />
        <div className="h-12 bg-gray-100 rounded-xl" />
        <div className="flex justify-between pt-1">
          <div className="h-6 w-20 bg-gray-100 rounded-full" />
          <div className="h-3 w-24 bg-gray-100 rounded" />
        </div>
      </div>
    </div>
  );
}

// ── Tabs config ───────────────────────────────────────────────────────────────
const TABS: { key: MainTab; label: string; icon: any }[] = [
  { key: "incoming", label: "Incoming", icon: Stethoscope },
  { key: "outgoing-internal", label: "Sent — Internal", icon: ArrowRight },
  { key: "outgoing-external", label: "Sent — External", icon: ArrowLeftRight },
];

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DoctorReferralsPage() {
  const router = useRouter();

  const [outgoingExternal, setOutgoingExternal] = useState<ExternalReferral[]>(
    [],
  );
  const [outgoingInternal, setOutgoingInternal] = useState<InternalReferral[]>(
    [],
  );
  const [incoming, setIncoming] = useState<InternalReferral[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mainTab, setMainTab] = useState<MainTab>("incoming");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      // Get my user ID first — needed to split incoming vs outgoing
      const myProfileRes = await api.get("/api/auth/session/check");
      const myId = myProfileRes.data?.data?.user?.id;

      const [extRes, incomingRes, outgoingInternalRes] = await Promise.all([
        // Outgoing external referrals
        api.get("/api/referrals/outgoing"),
        // Incoming internal: APT- visits assigned TO me (doctorId filter)
        myId
          ? appointmentApi.list({
              status: "scheduled",
              doctorId: myId,
              limit: 100,
            })
          : Promise.resolve({ data: { data: { appointments: [] } } }),
        // Outgoing internal: all scheduled APT- visits at institution,
        // filtered client-side for ones I created for someone else
        appointmentApi.list({ status: "scheduled", limit: 200 }),
      ]);

      setOutgoingExternal(extRes.data?.data?.referrals ?? []);

      // INCOMING: assigned to me, has admittingDiagnosis (= internal referral)
      const incomingRaw: any[] = incomingRes.data?.data?.appointments ?? [];
      const myIncoming = incomingRaw
        .filter(
          (a: any) => a.visitNumber?.startsWith("APT-") && a.admittingDiagnosis,
        )
        .map((a: any) => ({
          id: a.id,
          visitNumber: a.visitNumber,
          patientName: a.patientName,
          patientId: a.patientId,
          chiefComplaint: a.chiefComplaint,
          admittingDiagnosis: a.admittingDiagnosis,
          priority: a.priority,
          admissionDate: a.admissionDate,
          status: a.status,
          assignedDoctorId: a.assignedDoctorId,
          doctorName: a.doctorName,
          createdByPractitionerId: a.createdByPractitionerId,
          referringDoctorName: a.referringDoctorName ?? null,
        }));

      // OUTGOING INTERNAL: I created it, assigned to someone else
      const allScheduled: any[] =
        outgoingInternalRes.data?.data?.appointments ?? [];
      const myOutgoing = allScheduled
        .filter(
          (a: any) =>
            a.visitNumber?.startsWith("APT-") &&
            a.admittingDiagnosis &&
            a.createdByPractitionerId === myId &&
            a.assignedDoctorId !== myId,
        )
        .map((a: any) => ({
          id: a.id,
          visitNumber: a.visitNumber,
          patientName: a.patientName,
          patientId: a.patientId,
          chiefComplaint: a.chiefComplaint,
          admittingDiagnosis: a.admittingDiagnosis,
          priority: a.priority,
          admissionDate: a.admissionDate,
          status: a.status,
          assignedDoctorId: a.assignedDoctorId,
          doctorName: a.doctorName,
          createdByPractitionerId: a.createdByPractitionerId,
        }));

      setOutgoingInternal(myOutgoing);
      setIncoming(myIncoming);
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ?? "Failed to load referrals.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    const iv = setInterval(() => load(true), 60_000);
    return () => clearInterval(iv);
  }, [load]);

  // Counts
  const extCounts: Record<FilterKey, number> = {
    all: outgoingExternal.length,
    pending: outgoingExternal.filter((r) => r.status === "pending").length,
    accepted: outgoingExternal.filter((r) => r.status === "accepted").length,
    completed: outgoingExternal.filter((r) => r.status === "completed").length,
    rejected: outgoingExternal.filter((r) => r.status === "rejected").length,
  };

  const applySearch = (items: any[], fields: string[]) =>
    !search
      ? items
      : items.filter((i) =>
          fields.some((f) =>
            i[f]?.toLowerCase?.().includes(search.toLowerCase()),
          ),
        );

  const filteredExternal = outgoingExternal
    .filter((r) => filter === "all" || r.status === filter)
    .filter(
      (r) =>
        !search ||
        [
          r.patientName,
          r.referralNumber,
          r.receivingInstitutionName,
          r.reason,
        ].some((f) => f?.toLowerCase().includes(search.toLowerCase())),
    );

  const filteredOutInternal = applySearch(outgoingInternal, [
    "patientName",
    "visitNumber",
    "admittingDiagnosis",
    "doctorName",
  ]);
  const filteredIncoming = applySearch(incoming, [
    "patientName",
    "visitNumber",
    "admittingDiagnosis",
    "referringDoctorName",
  ]);

  const filterTabs: {
    key: FilterKey;
    label: string;
    color: string;
    bg: string;
  }[] = [
    { key: "all", label: "All", color: "#374151", bg: "#f3f4f6" },
    { key: "pending", label: "Pending", color: "#d97706", bg: "#fffbeb" },
    { key: "accepted", label: "Accepted", color: "#1d4ed8", bg: "#eff6ff" },
    { key: "completed", label: "Completed", color: "#166534", bg: "#f0fdf4" },
    { key: "rejected", label: "Rejected", color: "#dc2626", bg: "#fef2f2" },
  ];

  const tabBadge: Record<MainTab, number> = {
    incoming: incoming.length,
    "outgoing-internal": outgoingInternal.length,
    "outgoing-external": extCounts.pending,
  };

  const badgeColor: Record<MainTab, string> = {
    incoming: "#166534",
    "outgoing-internal": "#0891b2",
    "outgoing-external": "#d97706",
  };

  const badgeBg: Record<MainTab, string> = {
    incoming: "#f0fdf4",
    "outgoing-internal": "#ecfeff",
    "outgoing-external": "#fffbeb",
  };

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }} className="space-y-5">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold text-gray-900"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Referrals
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {format(new Date(), "EEEE, d MMMM yyyy")}
            {!loading && incoming.length > 0 && (
              <>
                {" "}
                ·{" "}
                <span className="text-green-700 font-medium">
                  {incoming.length} incoming
                </span>
              </>
            )}
            {!loading && extCounts.pending > 0 && (
              <>
                {" "}
                ·{" "}
                <span className="text-amber-600 font-medium">
                  {extCounts.pending} awaiting response
                </span>
              </>
            )}
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="p-2.5 rounded-xl border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-white transition-all disabled:opacity-40"
        >
          <RefreshCw
            className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {/* ── Stat pills ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: "Incoming",
            value: incoming.length,
            color: "#166534",
            bg: "linear-gradient(135deg,#f0fdf4,#dcfce7)",
            border: "#bbf7d0",
          },
          {
            label: "Sent — Internal",
            value: outgoingInternal.length,
            color: "#0891b2",
            bg: "linear-gradient(135deg,#ecfeff,#cffafe)",
            border: "#a5f3fc",
          },
          {
            label: "Sent — External",
            value: outgoingExternal.length,
            color: "#d97706",
            bg: "linear-gradient(135deg,#fffbeb,#fef3c7)",
            border: "#fde68a",
          },
        ].map(({ label, value, color, bg, border }) => (
          <div
            key={label}
            className="relative rounded-2xl border overflow-hidden p-4"
            style={{ background: bg, borderColor: border }}
          >
            <div
              className="absolute -right-3 -bottom-3 w-12 h-12 rounded-full opacity-[0.08]"
              style={{ background: color }}
            />
            <p
              className="text-2xl font-extrabold leading-none tabular-nums"
              style={{ color }}
            >
              {loading ? (
                <span className="inline-block w-7 h-6 rounded-lg bg-black/5 animate-pulse" />
              ) : (
                value
              )}
            </p>
            <p
              className="text-xs font-bold mt-1"
              style={{ color, opacity: 0.7 }}
            >
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* ── Main tabs + search ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 p-1 rounded-xl bg-gray-100/80">
          {TABS.map(({ key, label }) => {
            const badge = tabBadge[key];
            const active = mainTab === key;
            return (
              <button
                key={key}
                onClick={() => setMainTab(key)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={
                  active
                    ? {
                        background: "#fff",
                        color: "#111827",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                      }
                    : { color: "#6b7280" }
                }
              >
                {label}
                {badge > 0 && (
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={
                      active
                        ? { background: badgeBg[key], color: badgeColor[key] }
                        : { background: "rgba(0,0,0,0.06)", color: "#9ca3af" }
                    }
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Status filter — only for external outgoing */}
        {mainTab === "outgoing-external" && (
          <div className="flex gap-1 p-1 rounded-xl bg-gray-100/80">
            {filterTabs.map(({ key, label, color, bg }) => {
              const active = filter === key;
              return (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={
                    active
                      ? {
                          background: "#fff",
                          color,
                          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                        }
                      : { color: "#6b7280" }
                  }
                >
                  {label}
                  {extCounts[key] > 0 && (
                    <span
                      className="text-xs font-bold px-1.5 rounded-full"
                      style={
                        active
                          ? { background: bg, color }
                          : { background: "rgba(0,0,0,0.06)", color: "#9ca3af" }
                      }
                    >
                      {extCounts[key]}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patient, doctor, reason…"
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/10 placeholder:text-gray-400 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-50 border border-red-100">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 flex-1">{error}</p>
          <button
            onClick={() => load(false)}
            className="text-xs font-semibold text-red-700 underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── INCOMING INTERNAL ────────────────────────────────────────────── */}
      {mainTab === "incoming" &&
        (loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filteredIncoming.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-4">
              <Stethoscope className="w-6 h-6 text-green-300" />
            </div>
            <p className="text-sm font-semibold text-gray-500">
              No incoming referrals
            </p>
            <p className="text-xs text-gray-400 mt-1">
              When a colleague refers a patient to you, it will appear here
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredIncoming.map((r) => (
              <InternalCard
                key={r.id}
                referral={r}
                direction="incoming"
                onOpen={() => router.push(`/dashboard/doctor/visit/${r.id}`)}
              />
            ))}
          </div>
        ))}

      {/* ── OUTGOING INTERNAL ────────────────────────────────────────────── */}
      {mainTab === "outgoing-internal" &&
        (loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filteredOutInternal.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-cyan-50 flex items-center justify-center mx-auto mb-4">
              <ArrowRight className="w-6 h-6 text-cyan-300" />
            </div>
            <p className="text-sm font-semibold text-gray-500">
              No internal referrals sent
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Patients you refer to a colleague within this institution appear
              here
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredOutInternal.map((r) => (
              <InternalCard key={r.id} referral={r} direction="outgoing" />
            ))}
          </div>
        ))}

      {/* ── OUTGOING EXTERNAL ────────────────────────────────────────────── */}
      {mainTab === "outgoing-external" &&
        (loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filteredExternal.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
              <ArrowLeftRight className="w-6 h-6 text-blue-300" />
            </div>
            <p className="text-sm font-semibold text-gray-500">
              {outgoingExternal.length === 0
                ? "No external referrals sent"
                : "No referrals match your filters"}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {outgoingExternal.length === 0
                ? "Referrals to other institutions appear here"
                : "Try clearing your filters"}
            </p>
            {(search || filter !== "all") && (
              <button
                onClick={() => {
                  setSearch("");
                  setFilter("all");
                }}
                className="mt-4 text-xs font-semibold px-4 py-2 rounded-xl"
                style={{ background: "#f0fdf4", color: "#166534" }}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredExternal.map((r) => (
              <ExternalCard key={r.id} referral={r} />
            ))}
          </div>
        ))}

      {/* Footer count */}
      {!loading && (
        <p className="text-xs text-center text-gray-400">
          {mainTab === "incoming" &&
            `${filteredIncoming.length} incoming referral${filteredIncoming.length !== 1 ? "s" : ""}`}
          {mainTab === "outgoing-internal" &&
            `${filteredOutInternal.length} internal referral${filteredOutInternal.length !== 1 ? "s" : ""} sent`}
          {mainTab === "outgoing-external" &&
            `${filteredExternal.length} of ${outgoingExternal.length} external referral${outgoingExternal.length !== 1 ? "s" : ""}`}
        </p>
      )}
    </div>
  );
}
