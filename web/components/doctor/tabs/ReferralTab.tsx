"use client";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { CreateReferralModal } from "@/components/doctor/tabs/CreateReferalModal";
import { InternalReferralModal } from "@/components/doctor/tabs/InternalReferralModal";
import {
  ArrowLeftRight,
  PlusCircle,
  Building2,
  Clock,
  CheckCircle2,
  XCircle,
  Hourglass,
  AlertTriangle,
  Zap,
  ChevronRight,
  Stethoscope,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Referral {
  id: string;
  referralNumber: string;
  patientName: string;
  reason: string;
  urgency: string;
  status: string;
  referredAt: string;
  acceptedAt?: string;
  completedAt?: string;
  responseNotes?: string;
  receivingInstitutionName: string;
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
    label: "Pending",
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
};
const getS = (s: string) => STATUS[s] ?? STATUS.pending;

// ── Referral card ─────────────────────────────────────────────────────────────
function ReferralCard({ referral }: { referral: Referral }) {
  const u = getU(referral.urgency);
  const s = getS(referral.status);
  const StatusIcon = s.icon;
  const UrgencyIcon = u.icon;

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: s.border }}
    >
      {/* Status strip */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ background: s.bg }}
      >
        <div className="flex items-center gap-2">
          <StatusIcon className="w-3.5 h-3.5" style={{ color: s.color }} />
          <span
            className="text-xs font-bold uppercase tracking-wide"
            style={{ color: s.color }}
          >
            {s.label}
          </span>
        </div>
        <span className="text-xs font-mono text-gray-500">
          {referral.referralNumber}
        </span>
      </div>

      <div className="px-4 py-3.5 bg-white space-y-2.5">
        {/* Patient + institution */}
        <div>
          <p className="text-sm font-bold text-gray-900">
            {referral.patientName}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Building2 className="w-3 h-3 text-gray-400" />
            <p className="text-xs text-gray-500">
              {referral.receivingInstitutionName}
            </p>
          </div>
        </div>

        {/* Reason */}
        <p className="text-xs text-gray-600 leading-relaxed">
          {referral.reason}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
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
              <p className="text-[10px] text-blue-500">
                Accepted {format(new Date(referral.acceptedAt), "dd MMM HH:mm")}
              </p>
            )}
            {referral.completedAt && (
              <p className="text-[10px] text-green-600">
                Completed{" "}
                {format(new Date(referral.completedAt), "dd MMM HH:mm")}
              </p>
            )}
          </div>
        </div>

        {/* Response notes */}
        {referral.responseNotes && (
          <div className="flex gap-2 px-3 py-2 rounded-xl bg-gray-50 border border-gray-100">
            <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-600 italic">
              {referral.responseNotes}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────
interface ReferralTabProps {
  visitId: string;
  patientId: string;
  patientName: string;
  chiefComplaint: string;
  isCompleted: boolean;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export function ReferralTab({
  visitId,
  patientId,
  patientName,
  chiefComplaint,
  isCompleted,
  onSuccess,
  onError,
}: ReferralTabProps) {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [showExternal, setShowExternal] = useState(false); // cross-institution modal
  const [showInternal, setShowInternal] = useState(false); // same-institution modal

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/referrals/outgoing");
      setReferrals(res.data?.data?.referrals ?? []);
    } catch {
      setReferrals([]);
    } finally {
      setLoading(false);
    }
  }, [visitId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div
      className="p-5 space-y-4"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
            Referrals
          </p>
          {referrals.length > 0 && (
            <p className="text-xs text-gray-500 mt-0.5">
              {referrals.length} referral{referrals.length !== 1 ? "s" : ""}{" "}
              sent
            </p>
          )}
        </div>

        {!isCompleted && (
          <div className="flex items-center gap-2">
            {/* Internal — same institution, different specialist */}
            <button
              onClick={() => setShowInternal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-green-200 text-green-700 hover:bg-green-50 transition-all"
            >
              <Stethoscope className="w-3.5 h-3.5" />
              Internal
            </button>

            {/* External — cross-institution blockchain referral */}
            <button
              onClick={() => setShowExternal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-md hover:-translate-y-px"
              style={{
                background: "linear-gradient(135deg, #1d4ed8, #1e40af)",
              }}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              External
            </button>
          </div>
        )}
      </div>

      {/* ── List ───────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => (
            <div
              key={i}
              className="h-32 rounded-2xl bg-gray-50 animate-pulse"
            />
          ))}
        </div>
      ) : referrals.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 rounded-2xl border border-dashed border-gray-200 bg-gray-50/60">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <ArrowLeftRight className="w-5 h-5 text-blue-400" />
          </div>
          <p className="text-sm font-semibold text-gray-400">
            No referrals yet
          </p>
          {!isCompleted && (
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => setShowInternal(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border border-green-200 text-green-700 hover:bg-green-50 transition-all"
              >
                <Stethoscope className="w-3.5 h-3.5" /> Internal
              </button>
              <button
                onClick={() => setShowExternal(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{
                  background: "linear-gradient(135deg, #1d4ed8, #1e40af)",
                }}
              >
                <ArrowLeftRight className="w-3.5 h-3.5" /> External
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {referrals.map((r) => (
            <ReferralCard key={r.id} referral={r} />
          ))}
        </div>
      )}

      {/* ── External referral modal (cross-institution, blockchain) ─────── */}
      {showExternal && (
        <CreateReferralModal
          visitId={visitId}
          patientId={patientId}
          patientName={patientName}
          chiefComplaint={chiefComplaint}
          onClose={() => setShowExternal(false)}
          onSuccess={(referralNumber) => {
            setShowExternal(false);
            onSuccess(`Referral ${referralNumber} created successfully`);
            load();
          }}
        />
      )}

      {/* ── Internal referral modal (same institution, specialist) ──────── */}
      {showInternal && (
        <InternalReferralModal
          visitId={visitId}
          patientId={patientId}
          patientName={patientName}
          chiefComplaint={chiefComplaint}
          onClose={() => setShowInternal(false)}
          onSuccess={(msg) => {
            setShowInternal(false);
            onSuccess(msg);
          }}
        />
      )}
    </div>
  );
}
