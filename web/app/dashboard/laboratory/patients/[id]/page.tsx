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
import {
  Pill as Badge,
  TONES,
  type Tone,
} from "@/components/dashboard/ui";
import { getUrgency, getStatus } from "../../vocab";

/* ==========================================================================
   Patient lab history.

   Every lab order for one patient, newest first, each expandable to its
   result parameters.

   Status labels come from ../../vocab, which is keyed to labTestStatusEnum.
   The map previously declared here used keys like "pending" and
   "collection_in_progress" that the enum has never contained, so a completed
   order rendered as "Pending Collection".
   ========================================================================== */

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

/* Result flags — how a single parameter compares to its reference range. */
const FLAG_TONE: Record<string, Tone> = {
  normal: "success",
  low: "info",
  high: "critical",
  critical: "accent",
};

// ── Flag pill ─────────────────────────────────────────────────────────────────

function FlagPill({ flag }: { flag: string }) {
  const tone = FLAG_TONE[flag] ?? "neutral";
  const t = TONES[tone];
  return (
    <span
      className="inline-flex items-center flex-shrink-0"
      style={{
        height: 17,
        padding: "0 7px",
        borderRadius: "var(--r-pill)",
        background: t.tint,
        color: t.ink,
        font: "700 10px/1 var(--font-sans)",
        letterSpacing: "var(--ls-wide)",
        textTransform: "uppercase",
      }}
    >
      {flag}
    </span>
  );
}

// ── Lab order card (expandable) ───────────────────────────────────────────────

function LabOrderCard({ order }: { order: any }) {
  const [expanded, setExpanded] = useState(false);
  const status = getStatus(order.status);
  const urgency = getUrgency(order.urgency);
  const sTone = TONES[status.tone];
  const uTone = TONES[urgency.tone];
  const results: any[] = Array.isArray(order.result?.resultsData)
    ? order.result.resultsData
    : [];
  const hasAbnormal = results.some((r) => r.flag && r.flag !== "normal");

  return (
    <div className="border border-[var(--border-faint)] rounded-[var(--r-lg)] overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-4 py-3.5 flex items-center gap-3 hover:bg-[var(--surface-sunken)] transition-colors"
      >
        <div
          className="w-9 h-9 rounded-[var(--r-sm)] flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: uTone.tint }}
        >
          <FlaskConical size={16} style={{ color: uTone.ink }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
              {order.testName}
            </p>
            {order.testCode && (
              <span className="text-[10px] font-mono text-[var(--text-muted)] bg-[var(--surface-sunken)] px-1.5 py-0.5 rounded">
                {order.testCode}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <Badge tone={status.tone} style={{ height: 17, fontSize: 10 }}>
              {status.label}
            </Badge>
            <span className="text-[10px] text-[var(--text-muted)]">
              {safeDistance(order.orderedAt)}
            </span>
            {hasAbnormal && (
              <span className="text-[10px] font-semibold text-[var(--urgent-ink)] bg-[var(--amber-050)] px-1.5 py-0.5 rounded-full border border-[var(--amber-100)]">
                Abnormal
              </span>
            )}
          </div>
        </div>

        <div className="text-[var(--text-muted)] flex-shrink-0">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[var(--border-faint)] px-4 py-3.5 bg-[var(--surface-sunken)]">
          <div className="flex flex-wrap gap-4 mb-3 text-xs text-[var(--text-secondary)]">
            {order.specimenType && (
              <span className="flex items-center gap-1.5">
                <Beaker size={12} className="text-[var(--text-muted)]" />
                <span className="font-medium">Specimen:</span>{" "}
                <span className="capitalize">{order.specimenType}</span>
              </span>
            )}
            {order.orderNumber && (
              <span className="flex items-center gap-1.5">
                <ClipboardList size={12} className="text-[var(--text-muted)]" />
                <span className="font-medium">Order:</span> {order.orderNumber}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Clock size={12} className="text-[var(--text-muted)]" />
              <span className="font-medium">Ordered:</span>{" "}
              {safeFormat(order.orderedAt)}
            </span>
            {order.result?.resultedAt && (
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-[var(--green-700)]" />
                <span className="font-medium">Resulted:</span>{" "}
                {safeFormat(order.result.resultedAt)}
              </span>
            )}
          </div>

          {order.clinicalNotes && !order.clinicalNotes.startsWith("🛑") && (
            <div className="mb-3 p-2.5 rounded-[var(--r-sm)] bg-[var(--amber-050)] border border-[var(--amber-100)] text-xs text-[var(--urgent-ink)] italic">
              <span className="not-italic font-semibold">Notes: </span>
              {order.clinicalNotes}
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">
                Results
              </p>
              {results.map((r: any, i: number) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-3 py-2 rounded-[var(--r-sm)] bg-[var(--surface-card)] border border-[var(--border-faint)]"
                >
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-primary)]">
                      {r.parameter}
                    </p>
                    {r.referenceRange && (
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                        Ref: {r.referenceRange}
                        {r.unit ? ` ${r.unit}` : ""}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <span className="text-base font-bold text-[var(--text-primary)] tabular-nums">
                      {r.value}
                    </span>
                    {r.unit && (
                      <span className="text-xs text-[var(--text-muted)]">{r.unit}</span>
                    )}
                    {r.flag && <FlagPill flag={r.flag} />}
                  </div>
                </div>
              ))}
              {order.result?.interpretation && (
                <div className="mt-2 p-2.5 rounded-[var(--r-sm)] bg-[var(--info-tint)] border border-[var(--blue-100)] text-xs text-[var(--info-ink)]">
                  <span className="font-semibold">Interpretation: </span>
                  {order.result.interpretation}
                </div>
              )}
              {order.result?.abnormalFindings && (
                <div className="mt-1.5 p-2.5 rounded-[var(--r-sm)] bg-[var(--coral-050)] border border-[var(--coral-100)] text-xs text-[var(--critical-ink)]">
                  <span className="font-semibold">Abnormal Findings: </span>
                  {order.result.abnormalFindings}
                </div>
              )}
            </div>
          )}

          {!order.result && order.status !== "cancelled" && (
            <p className="text-xs text-[var(--text-muted)] italic">
              Results not yet entered.
            </p>
          )}

          {order.status === "cancelled" && (
            <div className="p-2.5 rounded-[var(--r-sm)] bg-[var(--surface-sunken)] text-xs text-[var(--text-secondary)]">
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
        <Loader2 size={28} className="animate-spin text-[var(--green-700)]" />
        <p className="text-sm text-[var(--text-muted)]">Loading patient profile…</p>
      </div>
    );
  }

  if (error || !context) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <div className="w-16 h-16 rounded-[var(--r-lg)] bg-[var(--coral-050)] flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={28} className="text-[var(--coral-500)]" />
        </div>
        <p className="text-[var(--text-secondary)] font-semibold mb-1">Patient not found</p>
        <p className="text-[var(--text-muted)] text-sm mb-4">
          {error ?? "This patient profile could not be loaded."}
        </p>
        <button
          onClick={() => router.push("/dashboard/laboratory/patients")}
          className="text-[var(--green-700)] text-sm font-medium hover:underline"
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
    >
      <button
        onClick={() => router.push("/dashboard/laboratory/patients")}
        className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-5"
      >
        <ChevronLeft size={16} /> Back to Patients
      </button>

      {/* Severe allergy banner */}
      {severeAllergies.length > 0 && (
        <div className="mb-4 px-5 py-3 rounded-[var(--r-lg)] flex items-center gap-3 bg-[var(--coral-050)] border border-[var(--coral-100)]">
          <ShieldAlert size={18} className="text-[var(--critical-ink)] flex-shrink-0" />
          <p className="text-sm font-bold text-[var(--critical-ink)]">
            SEVERE ALLERGY —{" "}
            {severeAllergies.map((a: any) => a.allergen).join(", ")}
          </p>
        </div>
      )}

      {/* Patient header card */}
      <div className="bg-[var(--surface-card)] rounded-[var(--r-lg)] border border-[var(--border-faint)] shadow-[var(--elev-1)] p-6 mb-5">
        <div className="flex items-start gap-5 flex-wrap">
          <div
            className="w-16 h-16 rounded-[var(--r-lg)] flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--brand-tint)" }}
          >
            <User size={30} className="text-[var(--green-700)]" />
          </div>

          <div className="flex-1">
            <h1
              className="text-2xl font-bold text-[var(--text-primary)]"
              
            >
              {patient.fullName}
            </h1>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap text-sm text-[var(--text-secondary)]">
              {patient.age != null && (
                <span className="font-semibold text-[var(--text-secondary)]">
                  {patient.age} yrs
                </span>
              )}
              {patient.gender && (
                <>
                  <span className="text-[var(--text-disabled)]">·</span>
                  <span className="capitalize">{patient.gender}</span>
                </>
              )}
              {patient.bloodType && patient.bloodType !== "unknown" && (
                <>
                  <span className="text-[var(--text-disabled)]">·</span>
                  <span className="flex items-center gap-1.5">
                    <Droplets size={13} className="text-[var(--coral-500)]" />
                    <span
                      className="inline-flex items-center"
                      style={{
                        height: 20,
                        padding: "0 9px",
                        borderRadius: "var(--r-pill)",
                        background: "var(--critical-tint)",
                        color: "var(--critical-ink)",
                        font: "700 11px/1 var(--font-mono)",
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
              <div className="px-3.5 py-2 rounded-[var(--r-sm)] bg-[var(--amber-050)] border border-[var(--amber-100)] text-center min-w-[56px]">
                <p className="text-lg font-extrabold text-[var(--urgent-ink)]">
                  {summary.pendingOrders}
                </p>
                <p className="text-[10px] font-semibold text-[var(--urgent-ink)] uppercase tracking-wide">
                  Pending
                </p>
              </div>
            )}
            {summary.resultedOrders > 0 && (
              <div className="px-3.5 py-2 rounded-[var(--r-sm)] bg-[var(--brand-tint)] border border-[var(--green-100)] text-center min-w-[56px]">
                <p className="text-lg font-extrabold text-[var(--green-700)]">
                  {summary.resultedOrders}
                </p>
                <p className="text-[10px] font-semibold text-[var(--green-700)] uppercase tracking-wide">
                  Resulted
                </p>
              </div>
            )}
            {summary.severeAllergies > 0 && (
              <div className="px-3.5 py-2 rounded-[var(--r-sm)] bg-[var(--coral-050)] border border-[var(--coral-100)] text-center min-w-[56px]">
                <p className="text-lg font-extrabold text-[var(--critical-ink)]">
                  {summary.severeAllergies}
                </p>
                <p className="text-[10px] font-semibold text-[var(--critical-ink)] uppercase tracking-wide">
                  Severe Allergy
                </p>
              </div>
            )}
            {summary.activeConditions > 0 && (
              <div className="px-3.5 py-2 rounded-[var(--r-sm)] bg-[var(--info-tint)] border border-[var(--blue-100)] text-center min-w-[56px]">
                <p className="text-lg font-extrabold text-[var(--info-ink)]">
                  {summary.activeConditions}
                </p>
                <p className="text-[10px] font-semibold text-[var(--info-ink)] uppercase tracking-wide">
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
          <div className="bg-[var(--surface-card)] rounded-[var(--r-lg)] border border-[var(--border-faint)] shadow-[var(--elev-1)] p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-[var(--r-xs)] bg-[var(--coral-050)] flex items-center justify-center">
                <ShieldAlert size={14} className="text-[var(--critical-ink)]" />
              </div>
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                Allergies
              </p>
            </div>
            {allergies && allergies.length > 0 ? (
              <div className="space-y-2">
                {severeAllergies.map((a: any) => (
                  <div
                    key={a.id}
                    className="flex items-start gap-2.5 px-3 py-2.5 rounded-[var(--r-sm)] bg-[var(--coral-050)] border border-[var(--coral-100)]"
                  >
                    <AlertTriangle
                      size={13}
                      className="text-[var(--critical-ink)] mt-0.5 flex-shrink-0"
                    />
                    <div>
                      <p className="text-xs font-bold text-[var(--critical-ink)]">
                        {a.allergen}
                      </p>
                      {a.reaction && (
                        <p className="text-[10px] text-[var(--critical-ink)] mt-0.5">
                          {a.reaction}
                        </p>
                      )}
                      <span className="text-[10px] font-bold uppercase text-[var(--coral-500)]">
                        {a.severity?.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                ))}
                {otherAllergies.map((a: any) => (
                  <div
                    key={a.id}
                    className="flex items-start gap-2.5 px-3 py-2.5 rounded-[var(--r-sm)] bg-[var(--amber-050)] border border-[var(--amber-100)]"
                  >
                    <AlertTriangle
                      size={13}
                      className="text-[var(--urgent-ink)] mt-0.5 flex-shrink-0"
                    />
                    <div>
                      <p className="text-xs font-semibold text-[var(--urgent-ink)]">
                        {a.allergen}
                      </p>
                      {a.reaction && (
                        <p className="text-[10px] text-[var(--urgent-ink)] mt-0.5">
                          {a.reaction}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)] italic">No known allergies</p>
            )}
          </div>

          {/* Medical Conditions */}
          <div className="bg-[var(--surface-card)] rounded-[var(--r-lg)] border border-[var(--border-faint)] shadow-[var(--elev-1)] p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-[var(--r-xs)] bg-[var(--info-tint)] flex items-center justify-center">
                <Heart size={14} className="text-[var(--info-ink)]" />
              </div>
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                Medical Conditions
              </p>
            </div>
            {medicalHistory && medicalHistory.length > 0 ? (
              <div className="space-y-1.5">
                {medicalHistory.map((h: any) => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between px-3 py-2 rounded-[var(--r-sm)] bg-[var(--surface-sunken)] border border-[var(--border-faint)]"
                  >
                    <div>
                      <p className="text-xs font-semibold text-[var(--text-primary)]">
                        {h.condition}
                      </p>
                      {h.diagnosedDate && (
                        <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                          Dx: {safeFormat(h.diagnosedDate).split(",")[0]}
                        </p>
                      )}
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                        h.status === "active"
                          ? "bg-[var(--info-tint)] text-[var(--info-ink)] border border-[var(--blue-100)]"
                          : "bg-[var(--surface-sunken)] text-[var(--text-secondary)]"
                      }`}
                    >
                      {h.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)] italic">
                No conditions recorded
              </p>
            )}
          </div>

          {/* Recent Diagnoses */}
          {recentDiagnoses && recentDiagnoses.length > 0 && (
            <div className="bg-[var(--surface-card)] rounded-[var(--r-lg)] border border-[var(--border-faint)] shadow-[var(--elev-1)] p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-[var(--r-xs)] bg-[var(--violet-050)] flex items-center justify-center">
                  <Stethoscope size={14} className="text-[var(--accent-ink)]" />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  Recent Diagnoses
                </p>
              </div>
              <div className="space-y-1.5">
                {recentDiagnoses.map((d: any) => (
                  <div
                    key={d.id}
                    className="flex items-start justify-between px-3 py-2 rounded-[var(--r-sm)] bg-[var(--violet-050)] border border-[var(--violet-100)]"
                  >
                    <div>
                      <p className="text-xs font-semibold text-[var(--accent-ink)]">
                        {d.diagnosisName}
                      </p>
                      {d.icdCode && (
                        <p className="text-[10px] font-mono text-[var(--violet-500)] mt-0.5">
                          {d.icdCode}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] text-[var(--violet-500)] ml-3 whitespace-nowrap">
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
            <div className="bg-[var(--surface-card)] rounded-[var(--r-lg)] border border-[var(--amber-100)] shadow-[var(--elev-1)] p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-[var(--r-xs)] bg-[var(--amber-050)] flex items-center justify-center">
                  <Clock size={14} className="text-[var(--urgent-ink)]" />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-[var(--urgent-ink)]">
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
            <div className="bg-[var(--surface-card)] rounded-[var(--r-lg)] border border-[var(--border-faint)] shadow-[var(--elev-1)] p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-[var(--r-xs)] bg-[var(--brand-tint)] flex items-center justify-center">
                  <HistoryIcon size={14} className="text-[var(--green-700)]" />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">
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
            <div className="bg-[var(--surface-card)] rounded-[var(--r-lg)] border border-[var(--border-faint)] shadow-[var(--elev-1)] p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-[var(--r-xs)] bg-[var(--surface-sunken)] flex items-center justify-center">
                  <XCircle size={14} className="text-[var(--text-secondary)]" />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
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
            <div className="bg-[var(--surface-card)] rounded-[var(--r-lg)] border border-[var(--border-faint)] shadow-[var(--elev-1)] p-8 text-center">
              <div className="w-14 h-14 rounded-[var(--r-lg)] bg-[var(--surface-sunken)] flex items-center justify-center mx-auto mb-4">
                <FlaskConical size={24} className="text-[var(--text-muted)]" />
              </div>
              <p className="text-sm font-semibold text-[var(--text-secondary)] mb-1">
                No lab orders
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                No lab tests have been ordered for this patient yet.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
