"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  Building2,
  Search,
  Clock,
  Zap,
  AlertTriangle,
  CheckCircle2,
  X,
  RefreshCw,
  UserPlus,
  AlertCircle,
  Loader2,
  ArrowRight,
  Hash,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

// ── Types ─────────────────────────────────────────────────────────────────────
interface IncomingReferral {
  id: string;
  referralNumber: string;
  patientId: string;
  patientName: string;
  gender: string;
  bloodType: string;
  reason: string;
  clinicalSummary: string;
  urgency: string;
  status: string;
  referredAt: string;
  referringInstitutionName: string;
  receivingDepartmentId?: string;
  receivingPractitionerId?: string;
}

interface Doctor {
  id: string;
  firstName: string;
  lastName: string;
  specialization: string | null;
  lastSeenAt: string | null;
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

const STATUS: Record<string, { color: string; bg: string; label: string }> = {
  pending: { color: "#d97706", bg: "#fffbeb", label: "Pending" },
  accepted: { color: "#1d4ed8", bg: "#eff6ff", label: "Accepted" },
  completed: { color: "#166534", bg: "#f0fdf4", label: "Completed" },
  rejected: { color: "#dc2626", bg: "#fef2f2", label: "Rejected" },
  cancelled: { color: "#6b7280", bg: "#f9fafb", label: "Cancelled" },
};

// ── Referral row ──────────────────────────────────────────────────────────────
// NOTE: do NOT name the prop "ref" — it is a reserved React prop and will be dropped silently.
function ReferralRow({
  referral,
  onAdmit,
}: {
  referral: IncomingReferral;
  onAdmit: (r: IncomingReferral) => void;
}) {
  const u = getU(referral.urgency);
  const st = STATUS[referral.status] ?? STATUS.pending;
  const Icon = u.icon;
  const isCrit = referral.urgency === "critical";

  return (
    <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors">
      {/* Urgency dot */}
      <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
        {isCrit && (
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-40"
            style={{ background: u.dot }}
          />
        )}
        <span
          className="relative inline-flex rounded-full h-2.5 w-2.5"
          style={{ background: u.dot }}
        />
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <p className="text-sm font-bold text-gray-900">
            {referral.patientName}
          </p>
          <span className="text-xs font-mono text-gray-400">
            {referral.referralNumber}
          </span>
          <span
            className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{
              background: u.bg,
              color: u.color,
              border: `1px solid ${u.border}`,
            }}
          >
            <Icon className="w-2.5 h-2.5" />
            {u.label}
          </span>
        </div>
        <p className="text-xs text-gray-500 truncate">{referral.reason}</p>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-[10px] text-gray-400 flex items-center gap-1">
            <Building2 className="w-2.5 h-2.5" />
            {referral.referringInstitutionName}
          </span>
          <span className="text-[10px] text-gray-400">
            {formatDistanceToNow(new Date(referral.referredAt), {
              addSuffix: true,
            })}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <span
          className="hidden sm:inline-flex text-xs font-semibold px-2 py-1 rounded-full"
          style={{ background: st.bg, color: st.color }}
        >
          {st.label}
        </span>
        {referral.status === "pending" && (
          <button
            onClick={() => onAdmit(referral)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:shadow-sm hover:-translate-y-px"
            style={{ background: "linear-gradient(135deg, #166534, #15803d)" }}
          >
            <UserPlus className="w-3 h-3" /> Admit
          </button>
        )}
      </div>
    </div>
  );
}

// ── Admit modal ───────────────────────────────────────────────────────────────
function AdmitModal({
  referral,
  onClose,
  onAdmitted,
}: {
  referral: IncomingReferral;
  onClose: () => void;
  onAdmitted: (visitId: string, visitNumber: string) => void;
}) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState("");
  const [visitType, setVisitType] = useState<
    "consultation" | "outpatient" | "inpatient"
  >("consultation");
  const [wardOrRoom, setWardOrRoom] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch online practitioners; if none, fall back to ALL practitioners at institution
  useEffect(() => {
    api
      .get("/api/practitioners/online?role=practitioner")
      .then((res) => {
        const online: Doctor[] = res.data.data?.staff ?? [];
        if (online.length > 0) {
          setDoctors(online);
          return;
        }
        // Fallback: all active practitioners
        return api
          .get("/api/practitioners?role=practitioner&limit=50")
          .then((r2) => setDoctors(r2.data.data?.practitioners ?? []));
      })
      .catch(() => setDoctors([]))
      .finally(() => setLoadingDocs(false));
  }, []);

  const u = getU(referral.urgency);

  const handleAdmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.post(
        `/api/referrals/${referral.id}/convert-to-visit`,
        {
          assignedDoctorId: selectedDoc || undefined,
          visitType,
          wardOrRoom: wardOrRoom || undefined,
        },
      );
      onAdmitted(res.data.data.visitId, res.data.data.visitNumber);
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ?? "Failed to admit patient.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              Admit Referred Patient
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Convert referral to a visit
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Referral summary card */}
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ borderColor: u.border }}
          >
            <div
              className="flex items-center gap-2 px-4 py-2.5"
              style={{ background: u.bg }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: u.dot }}
              />
              <span
                className="text-xs font-bold uppercase tracking-wide"
                style={{ color: u.color }}
              >
                {u.label} · {referral.referralNumber}
              </span>
            </div>
            <div className="px-4 py-3 bg-white space-y-1">
              <p className="text-sm font-bold text-gray-900">
                {referral.patientName}
              </p>
              <p className="text-xs text-gray-500">{referral.reason}</p>
              <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-1">
                <Building2 className="w-2.5 h-2.5" />
                Referred from: {referral.referringInstitutionName}
              </p>
            </div>
          </div>

          {/* Visit type */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-2">
              Visit Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["consultation", "outpatient", "inpatient"] as const).map(
                (vt) => (
                  <button
                    key={vt}
                    onClick={() => setVisitType(vt)}
                    className="py-2.5 rounded-xl border text-xs font-semibold capitalize transition-all"
                    style={
                      visitType === vt
                        ? {
                            background: "#f0fdf4",
                            borderColor: "#16a34a",
                            color: "#166534",
                          }
                        : {
                            background: "#fafafa",
                            borderColor: "#f1f5f9",
                            color: "#6b7280",
                          }
                    }
                  >
                    {vt}
                  </button>
                ),
              )}
            </div>
          </div>

          {/* Ward / Room */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1.5">
              Ward / Room{" "}
              <span className="normal-case font-normal">(optional)</span>
            </label>
            <input
              value={wardOrRoom}
              onChange={(e) => setWardOrRoom(e.target.value)}
              placeholder="e.g. Ward 3, Room 12"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/10 placeholder:text-gray-400 transition-all"
            />
          </div>

          {/* Doctor */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-2">
              Assign Doctor{" "}
              <span className="normal-case font-normal text-gray-400">
                (optional)
              </span>
            </label>
            {loadingDocs ? (
              <div className="h-10 bg-gray-50 rounded-xl animate-pulse" />
            ) : (
              <div className="space-y-1 max-h-44 overflow-y-auto">
                {/* Unassigned option */}
                <button
                  onClick={() => setSelectedDoc("")}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all"
                  style={
                    !selectedDoc
                      ? { background: "#f0fdf4", borderColor: "#16a34a" }
                      : { background: "#fafafa", borderColor: "#f1f5f9" }
                  }
                >
                  <span className="text-xs text-gray-500 italic">
                    Unassigned — assign later
                  </span>
                </button>

                {doctors.length === 0 && (
                  <p className="text-xs text-gray-400 px-3 py-2">
                    No doctors found
                  </p>
                )}

                {doctors.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => setSelectedDoc(doc.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all"
                    style={
                      selectedDoc === doc.id
                        ? { background: "#f0fdf4", borderColor: "#16a34a" }
                        : { background: "#fafafa", borderColor: "#f1f5f9" }
                    }
                  >
                    <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-bold text-green-700">
                        {doc.firstName[0]}
                        {doc.lastName[0]}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">
                        Dr. {doc.firstName} {doc.lastName}
                      </p>
                      {doc.specialization && (
                        <p className="text-xs text-gray-400">
                          {doc.specialization}
                        </p>
                      )}
                    </div>
                    {doc.lastSeenAt && (
                      <span className="flex items-center gap-1 text-[10px] text-green-600 font-medium flex-shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />{" "}
                        Online
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-50 border border-red-100">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleAdmit}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #166534, #15803d)" }}
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UserPlus className="w-4 h-4" />
            )}
            {submitting ? "Admitting…" : "Admit Patient"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function IncomingReferralsPage() {
  const router = useRouter();

  const [referrals, setReferrals] = useState<IncomingReferral[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<
    "all" | "pending" | "accepted" | "completed"
  >("pending");
  const [lookup, setLookup] = useState("");
  const [lookupResult, setLookupResult] = useState<IncomingReferral | null>(
    null,
  );
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const [admitting, setAdmitting] = useState<IncomingReferral | null>(null);
  const [admitted, setAdmitted] = useState<{
    visitId: string;
    visitNumber: string;
  } | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const params = filter !== "all" ? `?status=${filter}` : "";
        const res = await api.get(`/api/referrals/incoming${params}`);
        setReferrals(res.data.data.referrals ?? []);
      } catch (err: any) {
        setError(
          err.response?.data?.error?.message ?? "Failed to load referrals.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filter],
  );

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    const iv = setInterval(() => load(true), 30_000);
    return () => clearInterval(iv);
  }, [load]);

  const handleLookup = async () => {
    const val = lookup.trim();
    if (!val) return;
    setLooking(true);
    setLookupError(null);
    setLookupResult(null);
    try {
      // Send as-is — backend matches case-insensitively or we store uppercase
      const res = await api.get(`/api/referrals/lookup/${val}`);
      setLookupResult(res.data.data);
    } catch (err: any) {
      setLookupError(
        err.response?.data?.error?.message ?? "Referral not found.",
      );
    } finally {
      setLooking(false);
    }
  };

  const counts = {
    all: referrals.length,
    pending: referrals.filter((r) => r.status === "pending").length,
    accepted: referrals.filter((r) => r.status === "accepted").length,
    completed: referrals.filter((r) => r.status === "completed").length,
  };

  const filterTabs = [
    { key: "pending", label: "Pending", color: "#d97706", bg: "#fffbeb" },
    { key: "accepted", label: "Accepted", color: "#1d4ed8", bg: "#eff6ff" },
    { key: "completed", label: "Completed", color: "#166534", bg: "#f0fdf4" },
    { key: "all", label: "All", color: "#374151", bg: "#f3f4f6" },
  ] as const;

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }} className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold text-gray-900"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Incoming Referrals
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {format(new Date(), "EEEE, d MMMM yyyy")}
            {!loading && counts.pending > 0 && (
              <>
                {" "}
                ·{" "}
                <span className="text-amber-600 font-medium">
                  {counts.pending} pending
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

      {/* ── Referral number lookup — primary action ──────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
          Patient has a referral number?
        </p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              value={lookup}
              onChange={(e) => setLookup(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleLookup()}
              placeholder="REF-1234567890-ABC"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm font-mono text-gray-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/10 placeholder:text-gray-400 transition-all uppercase"
            />
          </div>
          <button
            onClick={handleLookup}
            disabled={looking || !lookup.trim()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, #166534, #15803d)" }}
          >
            {looking ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Look up
          </button>
        </div>

        {lookupError && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-50 border border-red-100">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-xs text-red-700">{lookupError}</p>
          </div>
        )}

        {lookupResult && (
          <div
            className="mt-3 rounded-2xl border overflow-hidden"
            style={{ borderColor: getU(lookupResult.urgency).border }}
          >
            <div
              className="flex items-center gap-2 px-4 py-2.5"
              style={{ background: getU(lookupResult.urgency).bg }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: getU(lookupResult.urgency).dot }}
              />
              <span
                className="text-xs font-bold"
                style={{ color: getU(lookupResult.urgency).color }}
              >
                {getU(lookupResult.urgency).label} ·{" "}
                {lookupResult.referralNumber}
              </span>
              <span
                className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{
                  background: STATUS[lookupResult.status]?.bg,
                  color: STATUS[lookupResult.status]?.color,
                }}
              >
                {STATUS[lookupResult.status]?.label}
              </span>
            </div>
            <div className="px-4 py-3 bg-white">
              <p className="text-sm font-bold text-gray-900">
                {lookupResult.patientName}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {lookupResult.reason}
              </p>
              <p className="text-[10px] text-gray-400 mt-1.5 flex items-center gap-1">
                <Building2 className="w-2.5 h-2.5" />
                From: {lookupResult.referringInstitutionName}
              </p>
              {lookupResult.status === "pending" && (
                <button
                  onClick={() => setAdmitting(lookupResult)}
                  className="mt-3 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                  style={{
                    background: "linear-gradient(135deg, #166534, #15803d)",
                  }}
                >
                  <UserPlus className="w-4 h-4" /> Admit this patient
                </button>
              )}
              {lookupResult.status !== "pending" && (
                <p className="mt-3 text-xs text-gray-500 italic">
                  This referral is already {lookupResult.status} and cannot be
                  re-admitted.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Filter tabs ──────────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 rounded-xl bg-gray-100/80 w-fit">
        {filterTabs.map(({ key, label, color, bg }) => {
          const active = filter === key;
          return (
            <button
              key={key}
              onClick={() => setFilter(key as any)}
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
              {counts[key as keyof typeof counts] > 0 && (
                <span
                  className="text-xs font-bold px-1.5 rounded-full"
                  style={
                    active
                      ? { background: bg, color }
                      : { background: "rgba(0,0,0,0.06)", color: "#9ca3af" }
                  }
                >
                  {counts[key as keyof typeof counts]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Error */}
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

      {/* ── Referral list ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="divide-y divide-gray-50">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 px-5 py-4 animate-pulse"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-gray-100 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-40 bg-gray-100 rounded" />
                  <div className="h-3 w-56 bg-gray-100 rounded" />
                </div>
                <div className="w-16 h-7 bg-gray-100 rounded-xl" />
              </div>
            ))}
          </div>
        ) : referrals.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            </div>
            <p className="text-sm font-semibold text-gray-500">
              {filter === "pending"
                ? "No pending referrals"
                : `No ${filter} referrals`}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Referrals from other institutions appear here
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {referrals.map((r) => (
              <ReferralRow key={r.id} referral={r} onAdmit={setAdmitting} />
            ))}
          </div>
        )}
      </div>

      {/* Admit modal */}
      {admitting && (
        <AdmitModal
          referral={admitting}
          onClose={() => {
            setAdmitting(null);
            setLookupResult(null);
          }}
          onAdmitted={(visitId, visitNumber) => {
            setAdmitting(null);
            setLookupResult(null);
            setAdmitted({ visitId, visitNumber });
            load(true);
          }}
        />
      )}

      {/* Success toast */}
      {admitted && (
        <div
          className="fixed bottom-6 right-6 z-50 bg-white rounded-2xl border border-green-100 shadow-xl p-5 w-80"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900">
                Patient Admitted
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Visit{" "}
                <span className="font-mono font-semibold">
                  {admitted.visitNumber}
                </span>{" "}
                created
              </p>
            </div>
            <button
              onClick={() => setAdmitted(null)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => {
              router.push(`/dashboard/receptionist/visits/${admitted.visitId}`);
              setAdmitted(null);
            }}
            className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #166534, #15803d)" }}
          >
            Open Visit <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
