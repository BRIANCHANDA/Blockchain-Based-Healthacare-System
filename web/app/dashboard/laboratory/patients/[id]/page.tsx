"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { labApi } from "@/lib/api";
import {
  ChevronLeft,
  FlaskConical,
  User,
  Droplets,
  AlertTriangle,
  ShieldAlert,
  Activity,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Heart,
  Stethoscope,
  ClipboardList,
  History as HistoryIcon,
  ChevronDown,
  ChevronUp,
  Beaker,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

// ── Helpers ──────────────────────────────────────────────────────────────────

function safeDistance(d: string | null | undefined) {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return formatDistanceToNow(date, { addSuffix: true });
}

function safeFormat(d: string | null | undefined) {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return format(date, "dd MMM yyyy, HH:mm");
}

const BLOOD_COLOR: Record<string, string> = {
  "A+": "#3b82f6",
  "A-": "#6366f1",
  "B+": "#8b5cf6",
  "B-": "#ec4899",
  "AB+": "#f59e0b",
  "AB-": "#ef4444",
  "O+": "#10b981",
  "O-": "#14b8a6",
};

const URGENCY_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  routine: { color: "#0A6640", bg: "#E6F4EE", label: "Routine" },
  urgent: { color: "#C9952A", bg: "#FDF3DC", label: "Urgent" },
  emergency: { color: "#C0392B", bg: "#FDECEA", label: "Emergency" },
  critical: { color: "#6D28D9", bg: "#EDE9FE", label: "Critical" },
};

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string; icon: React.ReactNode }> = {
  pending: {
    color: "#C9952A",
    bg: "#FDF3DC",
    label: "Pending Collection",
    icon: <Clock size={11} />,
  },
  collection_in_progress: {
    color: "#1A6B8A",
    bg: "#E3F2F8",
    label: "In Progress",
    icon: <Activity size={11} />,
  },
  resulted: {
    color: "#0A6640",
    bg: "#E6F4EE",
    label: "Resulted",
    icon: <CheckCircle2 size={11} />,
  },
  cancelled: {
    color: "#6b7280",
    bg: "#f3f4f6",
    label: "Cancelled",
    icon: <XCircle size={11} />,
  },
};

// ── Flag pill ─────────────────────────────────────────────────────────────────

function FlagPill({ flag }: { flag: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    normal: { bg: "#E6F4EE", color: "#0A6640" },
    high: { bg: "#FDECEA", color: "#C0392B" },
    low: { bg: "#E3F2F8", color: "#1A6B8A" },
    critical: { bg: "#EDE9FE", color: "#6D28D9" },
  };
  const s = styles[flag] ?? styles.normal;
  return (
    <span
      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase"
      style={{ background: s.bg, color: s.color }}
    >
      {flag}
    </span>
  );
}

// ── Lab order card (expandable) ───────────────────────────────────────────────

function LabOrderCard({ order }: { order: any }) {
  const [expanded, setExpanded] = useState(false);
  const status = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
  const urgency = URGENCY_CONFIG[order.urgency] ?? URGENCY_CONFIG.routine;
  const results: any[] = Array.isArray(order.result?.resultsData)
    ? order.result.resultsData
    : [];
  const hasAbnormal = results.some((r) => r.flag && r.flag !== "normal");

  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-4 py-3.5 flex items-center gap-3 hover:bg-gray-50 transition-colors"
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: urgency.bg }}
        >
          <FlaskConical size={16} style={{ color: urgency.color }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-800 truncate">
              {order.testName}
            </p>
            {order.testCode && (
              <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                {order.testCode}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{ background: status.bg, color: status.color }}
            >
              {status.icon}
              {status.label}
            </span>
            <span className="text-[10px] text-gray-400">
              {safeDistance(order.orderedAt)}
            </span>
            {hasAbnormal && (
              <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-100">
                Abnormal
              </span>
            )}
          </div>
        </div>

        <div className="text-gray-400 flex-shrink-0">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3.5 bg-gray-50/50">
          <div className="flex flex-wrap gap-4 mb-3 text-xs text-gray-500">
            {order.specimenType && (
              <span className="flex items-center gap-1.5">
                <Beaker size={12} className="text-gray-400" />
                <span className="font-medium">Specimen:</span>{" "}
                <span className="capitalize">{order.specimenType}</span>
              </span>
            )}
            {order.orderNumber && (
              <span className="flex items-center gap-1.5">
                <ClipboardList size={12} className="text-gray-400" />
                <span className="font-medium">Order:</span> {order.orderNumber}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Clock size={12} className="text-gray-400" />
              <span className="font-medium">Ordered:</span>{" "}
              {safeFormat(order.orderedAt)}
            </span>
            {order.result?.resultedAt && (
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-green-600" />
                <span className="font-medium">Resulted:</span>{" "}
                {safeFormat(order.result.resultedAt)}
              </span>
            )}
          </div>

          {order.clinicalNotes && !order.clinicalNotes.startsWith("🛑") && (
            <div className="mb-3 p-2.5 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-800 italic">
              <span className="not-italic font-semibold">Notes: </span>
              {order.clinicalNotes}
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                Results
              </p>
              {results.map((r: any, i: number) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-3 py-2 rounded-xl bg-white border border-gray-100"
                >
                  <div>
                    <p className="text-xs font-semibold text-gray-800">
                      {r.parameter}
                    </p>
                    {r.referenceRange && (
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Ref: {r.referenceRange}
                        {r.unit ? ` ${r.unit}` : ""}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <span className="text-base font-bold text-gray-900 tabular-nums">
                      {r.value}
                    </span>
                    {r.unit && (
                      <span className="text-xs text-gray-400">{r.unit}</span>
                    )}
                    {r.flag && <FlagPill flag={r.flag} />}
                  </div>
                </div>
              ))}
              {order.result?.interpretation && (
                <div className="mt-2 p-2.5 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-800">
                  <span className="font-semibold">Interpretation: </span>
                  {order.result.interpretation}
                </div>
              )}
              {order.result?.abnormalFindings && (
                <div className="mt-1.5 p-2.5 rounded-xl bg-red-50 border border-red-100 text-xs text-red-800">
                  <span className="font-semibold">Abnormal Findings: </span>
                  {order.result.abnormalFindings}
                </div>
              )}
            </div>
          )}

          {!order.result && order.status !== "cancelled" && (
            <p className="text-xs text-gray-400 italic">
              Results not yet entered.
            </p>
          )}

          {order.status === "cancelled" && (
            <div className="p-2.5 rounded-xl bg-gray-100 text-xs text-gray-500">
              {order.clinicalNotes?.startsWith("🛑")
                ? order.clinicalNotes
                : "Order was cancelled."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LabPatientDetailPage() {
  const { id: patientId } = useParams<{ id: string }>();
  const router = useRouter();

  const [context, setContext] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    labApi
      .getPatientContext(patientId)
      .then((res) => {
        setContext(res.data?.data ?? null);
      })
      .catch((err: any) => {
        setError(
          err.response?.data?.error?.message ?? "Failed to load patient data.",
        );
      })
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 gap-3">
        <Loader2 size={28} className="animate-spin text-green-700" />
        <p className="text-sm text-gray-400">Loading patient profile…</p>
      </div>
    );
  }

  if (error || !context) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={28} className="text-red-500" />
        </div>
        <p className="text-gray-700 font-semibold mb-1">Patient not found</p>
        <p className="text-gray-400 text-sm mb-4">
          {error ?? "This patient profile could not be loaded."}
        </p>
        <button
          onClick={() => router.push("/dashboard/laboratory/patients")}
          className="text-green-700 text-sm font-medium hover:underline"
        >
          ← Back to patients
        </button>
      </div>
    );
  }

  const { patient, allergies, medicalHistory, recentDiagnoses, recentLabs, summary } =
    context;

  const severeAllergies =
    allergies?.filter((a: any) =>
      ["severe", "life_threatening"].includes(a.severity),
    ) ?? [];
  const otherAllergies =
    allergies?.filter(
      (a: any) => !["severe", "life_threatening"].includes(a.severity),
    ) ?? [];

  const pendingOrders = (recentLabs ?? []).filter((o: any) =>
    ["pending", "collection_in_progress"].includes(o.status),
  );
  const resultedOrders = (recentLabs ?? []).filter(
    (o: any) => o.status === "resulted",
  );
  const cancelledOrders = (recentLabs ?? []).filter(
    (o: any) => o.status === "cancelled",
  );

  return (
    <div
      className="max-w-5xl mx-auto"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <button
        onClick={() => router.push("/dashboard/laboratory/patients")}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5"
      >
        <ChevronLeft size={16} /> Back to Patients
      </button>

      {/* Severe allergy banner */}
      {severeAllergies.length > 0 && (
        <div className="mb-4 px-5 py-3 rounded-2xl flex items-center gap-3 bg-red-50 border border-red-200">
          <ShieldAlert size={18} className="text-red-600 flex-shrink-0" />
          <p className="text-sm font-bold text-red-700">
            SEVERE ALLERGY —{" "}
            {severeAllergies.map((a: any) => a.allergen).join(", ")}
          </p>
        </div>
      )}

      {/* Patient header card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-5">
        <div className="flex items-start gap-5 flex-wrap">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg,#f0fdf4,#dcfce7)" }}
          >
            <User size={30} className="text-green-700" />
          </div>

          <div className="flex-1">
            <h1
              className="text-2xl font-bold text-gray-900"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {patient.fullName}
            </h1>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap text-sm text-gray-500">
              {patient.age != null && (
                <span className="font-semibold text-gray-700">
                  {patient.age} yrs
                </span>
              )}
              {patient.gender && (
                <>
                  <span className="text-gray-300">·</span>
                  <span className="capitalize">{patient.gender}</span>
                </>
              )}
              {patient.bloodType && patient.bloodType !== "unknown" && (
                <>
                  <span className="text-gray-300">·</span>
                  <span className="flex items-center gap-1.5">
                    <Droplets size={13} className="text-red-500" />
                    <span
                      className="font-bold text-white text-xs px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor:
                          BLOOD_COLOR[patient.bloodType] ?? "#6b7280",
                      }}
                    >
                      {patient.bloodType}
                    </span>
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Summary chips */}
          <div className="flex gap-2 flex-wrap">
            {summary.pendingOrders > 0 && (
              <div className="px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-100 text-center min-w-[56px]">
                <p className="text-lg font-extrabold text-amber-700">
                  {summary.pendingOrders}
                </p>
                <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide">
                  Pending
                </p>
              </div>
            )}
            {summary.resultedOrders > 0 && (
              <div className="px-3.5 py-2 rounded-xl bg-green-50 border border-green-100 text-center min-w-[56px]">
                <p className="text-lg font-extrabold text-green-700">
                  {summary.resultedOrders}
                </p>
                <p className="text-[10px] font-semibold text-green-600 uppercase tracking-wide">
                  Resulted
                </p>
              </div>
            )}
            {summary.severeAllergies > 0 && (
              <div className="px-3.5 py-2 rounded-xl bg-red-50 border border-red-200 text-center min-w-[56px]">
                <p className="text-lg font-extrabold text-red-700">
                  {summary.severeAllergies}
                </p>
                <p className="text-[10px] font-semibold text-red-600 uppercase tracking-wide">
                  Severe Allergy
                </p>
              </div>
            )}
            {summary.activeConditions > 0 && (
              <div className="px-3.5 py-2 rounded-xl bg-blue-50 border border-blue-100 text-center min-w-[56px]">
                <p className="text-lg font-extrabold text-blue-700">
                  {summary.activeConditions}
                </p>
                <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide">
                  Conditions
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: clinical context */}
        <div className="space-y-4">
          {/* Allergies */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center">
                <ShieldAlert size={14} className="text-red-600" />
              </div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
                Allergies
              </p>
            </div>
            {allergies && allergies.length > 0 ? (
              <div className="space-y-2">
                {severeAllergies.map((a: any) => (
                  <div
                    key={a.id}
                    className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-red-50 border border-red-100"
                  >
                    <AlertTriangle
                      size={13}
                      className="text-red-600 mt-0.5 flex-shrink-0"
                    />
                    <div>
                      <p className="text-xs font-bold text-red-800">
                        {a.allergen}
                      </p>
                      {a.reaction && (
                        <p className="text-[10px] text-red-600 mt-0.5">
                          {a.reaction}
                        </p>
                      )}
                      <span className="text-[10px] font-bold uppercase text-red-500">
                        {a.severity?.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                ))}
                {otherAllergies.map((a: any) => (
                  <div
                    key={a.id}
                    className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-100"
                  >
                    <AlertTriangle
                      size={13}
                      className="text-amber-600 mt-0.5 flex-shrink-0"
                    />
                    <div>
                      <p className="text-xs font-semibold text-amber-800">
                        {a.allergen}
                      </p>
                      {a.reaction && (
                        <p className="text-[10px] text-amber-700 mt-0.5">
                          {a.reaction}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">No known allergies</p>
            )}
          </div>

          {/* Medical Conditions */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                <Heart size={14} className="text-blue-600" />
              </div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
                Medical Conditions
              </p>
            </div>
            {medicalHistory && medicalHistory.length > 0 ? (
              <div className="space-y-1.5">
                {medicalHistory.map((h: any) => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-gray-50 border border-gray-100"
                  >
                    <div>
                      <p className="text-xs font-semibold text-gray-800">
                        {h.condition}
                      </p>
                      {h.diagnosedDate && (
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          Dx: {safeFormat(h.diagnosedDate).split(",")[0]}
                        </p>
                      )}
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                        h.status === "active"
                          ? "bg-blue-50 text-blue-700 border border-blue-100"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {h.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">
                No conditions recorded
              </p>
            )}
          </div>

          {/* Recent Diagnoses */}
          {recentDiagnoses && recentDiagnoses.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
                  <Stethoscope size={14} className="text-violet-600" />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
                  Recent Diagnoses
                </p>
              </div>
              <div className="space-y-1.5">
                {recentDiagnoses.map((d: any) => (
                  <div
                    key={d.id}
                    className="flex items-start justify-between px-3 py-2 rounded-xl bg-violet-50 border border-violet-100"
                  >
                    <div>
                      <p className="text-xs font-semibold text-violet-900">
                        {d.diagnosisName}
                      </p>
                      {d.icdCode && (
                        <p className="text-[10px] font-mono text-violet-500 mt-0.5">
                          {d.icdCode}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] text-violet-400 ml-3 whitespace-nowrap">
                      {safeDistance(d.diagnosedAt)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: lab orders */}
        <div className="lg:col-span-2 space-y-4">
          {pendingOrders.length > 0 && (
            <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
                  <Clock size={14} className="text-amber-600" />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-amber-600">
                  Pending Orders ({pendingOrders.length})
                </p>
              </div>
              <div className="space-y-2">
                {pendingOrders.map((o: any) => (
                  <LabOrderCard key={o.id} order={o} />
                ))}
              </div>
            </div>
          )}

          {resultedOrders.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center">
                  <HistoryIcon size={14} className="text-green-700" />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
                  Lab History ({resultedOrders.length})
                </p>
              </div>
              <div className="space-y-2">
                {resultedOrders.map((o: any) => (
                  <LabOrderCard key={o.id} order={o} />
                ))}
              </div>
            </div>
          )}

          {cancelledOrders.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
                  <XCircle size={14} className="text-gray-500" />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
                  Cancelled ({cancelledOrders.length})
                </p>
              </div>
              <div className="space-y-2">
                {cancelledOrders.map((o: any) => (
                  <LabOrderCard key={o.id} order={o} />
                ))}
              </div>
            </div>
          )}

          {(!recentLabs || recentLabs.length === 0) && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <FlaskConical size={24} className="text-gray-400" />
              </div>
              <p className="text-sm font-semibold text-gray-500 mb-1">
                No lab orders
              </p>
              <p className="text-xs text-gray-400">
                No lab tests have been ordered for this patient yet.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
