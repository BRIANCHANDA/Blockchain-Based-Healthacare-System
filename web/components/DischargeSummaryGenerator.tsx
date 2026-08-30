"use client";
import { useState, useCallback } from "react";
import { visitApi } from "@/lib/api";
import { askClaude } from "@/lib/ai";
import {
  Sparkles,
  FileText,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  
  
  Stethoscope,
  Pill,
  FlaskConical,
  Activity,
  ClipboardList,
  Edit3,
  Copy,
  Check,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface DischargeSummaryProps {
  visitId: string;
  visitData: {
    visit: any;
    patient: any;
    consultations: any[];
    diagnoses: any[];
    vitalSigns: any[];
    labOrders: any[];
    imagingOrders: any[];
    prescriptions: any[];
  };
  onSummaryGenerated?: (summary: string) => void;
}

// ── Main component ────────────────────────────────────────────────────────────
export function DischargeSummaryGenerator({
  visitId,
  visitData,
  onSummaryGenerated,
}: DischargeSummaryProps) {
  const [generating, setGenerating] = useState(false);
  const [summary, setSummary] = useState("");
  const [edited, setEdited] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const {
    visit,
    patient,
    consultations,
    diagnoses,
    vitalSigns,
    labOrders,
    imagingOrders,
    prescriptions,
  } = visitData;

  // ── Build context payload for Claude ─────────────────────────────────────
  const buildPrompt = useCallback(() => {
    const v0 = vitalSigns?.[0];

    const vitalsText = v0
      ? [
          v0.temperature && `Temperature: ${v0.temperature}°C`,
          v0.bloodPressureSystolic &&
            `Blood Pressure: ${v0.bloodPressureSystolic}/${v0.bloodPressureDiastolic} mmHg`,
          v0.pulseRate && `Heart Rate: ${v0.pulseRate} bpm`,
          v0.oxygenSaturation && `SpO₂: ${v0.oxygenSaturation}%`,
          v0.respiratoryRate && `Respiratory Rate: ${v0.respiratoryRate}/min`,
          v0.weight && `Weight: ${v0.weight} kg`,
        ]
          .filter(Boolean)
          .join(", ")
      : "Not recorded";

    const diagnosesText = diagnoses?.length
      ? diagnoses
          .map(
            (d) =>
              `${d.diagnosisName} (${d.icdCode}) — ${d.diagnosisType}${d.severity ? `, ${d.severity}` : ""}`,
          )
          .join("; ")
      : "No formal diagnosis recorded";

    const consultText = consultations?.length
      ? consultations
          .map((c) =>
            [
              c.chiefComplaint && `Chief complaint: ${c.chiefComplaint}`,
              c.historyOfPresentIllness &&
                `History: ${c.historyOfPresentIllness}`,
              c.clinicalFindings && `Findings: ${c.clinicalFindings}`,
              c.assessment && `Assessment: ${c.assessment}`,
              c.plan && `Plan: ${c.plan}`,
            ]
              .filter(Boolean)
              .join(". "),
          )
          .join("\n")
      : "No consultation notes";

    const labText = labOrders?.length
      ? labOrders
          .map((l) => {
            const result = l.result;
            return `${l.testName} (${l.orderNumber}): ${
              result
                ? `${result.interpretation ?? "Resulted"}${result.abnormalFindings ? ` — Abnormal: ${result.abnormalFindings}` : ""}`
                : l.status
            }`;
          })
          .join("; ")
      : "No lab orders";

    const imagingText = imagingOrders?.length
      ? imagingOrders
          .map(
            (i) =>
              `${i.modality?.toUpperCase()} ${i.bodyPart} (${i.orderNumber}): ${i.status}`,
          )
          .join("; ")
      : "No imaging orders";

    const rxText = prescriptions?.length
      ? prescriptions
          .map((p) => `${p.prescriptionNumber} — ${p.status}`)
          .join("; ")
      : "No prescriptions";

    return `You are a clinical documentation assistant for MedLink, a Zambian healthcare EMR system. 
Generate a professional, concise discharge summary for the following patient visit.

PATIENT: ${patient?.firstName} ${patient?.lastName}, ${patient?.gender ?? "unknown gender"}, Blood type: ${patient?.bloodType ?? "unknown"}
VISIT: ${visit?.visitNumber}, Type: ${visit?.visitType}, Priority: ${visit?.priority}
ADMISSION DATE: ${visit?.admissionDate ? new Date(visit.admissionDate).toLocaleDateString("en-ZM", { day: "numeric", month: "long", year: "numeric" }) : "unknown"}
CHIEF COMPLAINT: ${visit?.chiefComplaint ?? "Not recorded"}

VITAL SIGNS ON ADMISSION:
${vitalsText}

DIAGNOSES:
${diagnosesText}

CLINICAL NOTES:
${consultText}

INVESTIGATIONS:
Lab: ${labText}
Imaging: ${imagingText}

TREATMENT:
Prescriptions: ${rxText}

Write a discharge summary with these sections:
1. Reason for Admission
2. Clinical Findings & Investigations
3. Diagnosis
4. Treatment Given
5. Condition at Discharge
6. Discharge Instructions & Follow-up

Keep it clinical, concise, and professional. Use plain English suitable for a Zambian healthcare context. Do not invent any clinical details not provided above. If information is missing, note it as "not documented". Do not include any preamble or meta-commentary — output only the discharge summary text.`;
  }, [visitData]);

  // ── Call Claude via backend proxy ───────────────────────────────────────────
  const generate = useCallback(async () => {
    setGenerating(true);
    setError("");
    setSummary("");
    setEdited("");
    setSaved(false);

    try {
      const text = await askClaude(buildPrompt(), 1200);

      setSummary(text);
      setEdited(text);
      onSummaryGenerated?.(text);
    } catch (err: any) {
      setError("Failed to generate summary. Please try again.");
      console.error("[DISCHARGE_AI]", err);
    } finally {
      setGenerating(false);
    }
  }, [buildPrompt, onSummaryGenerated]);

  // ── Save to discharge endpoint ────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!edited.trim()) return;
    setSaving(true);
    try {
      await visitApi.discharge(visitId, {
        dischargeDiagnosis:
          diagnoses?.[0]?.diagnosisName ??
          visit?.chiefComplaint ??
          "See summary",
        dischargeSummary: edited,
        dischargeInstructions: edited,
      });
      setSaved(true);
      onSummaryGenerated?.(edited);
    } catch (err: any) {
      setError(
        err?.response?.data?.error?.message ??
          "Failed to save discharge summary.",
      );
    } finally {
      setSaving(false);
    }
  }, [edited, visitId, diagnoses, visit, onSummaryGenerated]);

  const handleCopy = () => {
    navigator.clipboard.writeText(edited);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Context preview ───────────────────────────────────────────────────────
  // Has enough data if ANY clinical record exists.
  // Doctor-direct admissions have no vitals — that's fine.
  // Only block if literally nothing is recorded.
  const hasData =
    (consultations?.length ?? 0) > 0 ||
    (diagnoses?.length ?? 0) > 0 ||
    (vitalSigns?.length ?? 0) > 0 ||
    (labOrders?.length ?? 0) > 0 ||
    (prescriptions?.length ?? 0) > 0 ||
    (imagingOrders?.length ?? 0) > 0 ||
    !!visit?.chiefComplaint ||
    !!visit?.admittingDiagnosis;

  return (
    <div className="space-y-4" style={{ fontFamily: "var(--font-sans)" }}>
      {/* ── Header card ─────────────────────────────────────────────────── */}
      <div
        className="relative rounded-[var(--r-lg)] overflow-hidden px-5 py-4"
        style={{ background: "var(--sidebar-bg)" }}
      >
        <div className="relative flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-[var(--green-300)]" />
              <p className="text-xs font-bold uppercase tracking-[var(--ls-caps)] text-[var(--green-300)] opacity-70">
                AI Assistant
              </p>
            </div>
            <p
              className="text-[var(--white)] font-bold text-base"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Discharge Summary Generator
            </p>
            <p className="text-[var(--green-300)]/60 text-xs mt-0.5">
              Drafts a clinical summary from this visit's data for your review
            </p>
          </div>
          <button
            onClick={generate}
            disabled={generating || !hasData}
            className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--r-sm)] text-sm font-bold transition-all disabled:opacity-50 flex-shrink-0"
            style={{
              background: "var(--on-dark-raise)",
              color: "var(--white)",
              border: "1px solid var(--on-dark-line)",
            }}
          >
            {generating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Generating…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />{" "}
                {summary ? "Regenerate" : "Generate"}
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── No data warning ──────────────────────────────────────────────── */}
      {!hasData && (
        <div className="flex items-center gap-3 p-3.5 rounded-[var(--r-sm)] bg-[var(--amber-050)] border border-[var(--urgent-tint)]">
          <AlertCircle className="w-4 h-4 text-[var(--urgent)] flex-shrink-0" />
          <p className="text-xs font-semibold text-[var(--urgent-ink)]">
            No clinical data found for this visit. Add at least a chief
            complaint, consultation or diagnosis before generating.
          </p>
        </div>
      )}

      {/* ── Data context preview ─────────────────────────────────────────── */}
      {hasData && !summary && !generating && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[var(--ls-caps)] text-[var(--text-muted)]">
            Data available for summary
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              {
                label: "Vitals",
                count: vitalSigns?.length ?? 0,
                icon: Activity,
                color: "var(--critical-ink)",
                tint: "var(--critical-tint)",
              },
              {
                label: "Consultations",
                count: consultations?.length ?? 0,
                icon: Stethoscope,
                color: "var(--info-ink)",
                tint: "var(--info-tint)",
              },
              {
                label: "Diagnoses",
                count: diagnoses?.length ?? 0,
                icon: ClipboardList,
                color: "var(--success-ink)",
                tint: "var(--success-tint)",
              },
              {
                label: "Lab Orders",
                count: labOrders?.length ?? 0,
                icon: FlaskConical,
                color: "var(--urgent-ink)",
                tint: "var(--urgent-tint)",
              },
              {
                label: "Prescriptions",
                count: prescriptions?.length ?? 0,
                icon: Pill,
                color: "var(--accent-ink)",
                tint: "var(--accent-tint)",
              },
            ].map(({ label, count, icon: Icon, color, tint }) => (
              <div
                key={label}
                className="flex items-center gap-2.5 p-3 rounded-[var(--r-sm)] border"
                style={{
                  background: count > 0 ? tint : "var(--surface-inset)",
                  borderColor: count > 0 ? tint : "var(--border-faint)",
                }}
              >
                <div
                  className="w-7 h-7 rounded-[var(--r-xs)] flex items-center justify-center flex-shrink-0"
                  style={{ background: tint }}
                >
                  <Icon
                    className="w-3.5 h-3.5"
                    style={{ color: count > 0 ? color : "var(--text-disabled)" }}
                  />
                </div>
                <div>
                  <p
                    className="text-lg font-black leading-none tabular-nums"
                    style={{ color: count > 0 ? color : "var(--text-disabled)" }}
                  >
                    {count}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)] font-medium mt-0.5">
                    {label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Generating state ─────────────────────────────────────────────── */}
      {generating && (
        <div className="flex flex-col items-center gap-3 py-10 rounded-[var(--r-lg)] border border-dashed border-[var(--green-200)] bg-[var(--brand-tint)]/40">
          <div className="relative">
            <div className="w-10 h-10 rounded-full border-2 border-[var(--green-200)] border-t-green-600 animate-spin" />
            <Sparkles className="w-4 h-4 text-[var(--brand)] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-sm font-semibold text-[var(--success-ink)]">
            Analysing visit data…
          </p>
          <p className="text-xs text-[var(--brand)]/60">Drafting clinical summary</p>
        </div>
      )}

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-3 p-3.5 rounded-[var(--r-sm)] bg-[var(--coral-050)] border border-[var(--coral-100)]">
          <AlertCircle className="w-4 h-4 text-[var(--critical)] flex-shrink-0" />
          <p className="text-xs font-semibold text-[var(--critical-ink)]">{error}</p>
        </div>
      )}

      {/* ── Generated summary ────────────────────────────────────────────── */}
      {summary && !generating && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[var(--brand)]" />
              <p className="text-xs font-bold text-[var(--text-secondary)]">
                Summary generated — review and edit before saving
              </p>
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--r-xs)] text-xs font-semibold border border-[var(--hc-border)] bg-[var(--surface-card)] text-[var(--text-secondary)] hover:bg-[var(--surface-inset)] transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-[var(--brand)]" /> Copied
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" /> Copy
                </>
              )}
            </button>
          </div>

          {/* Editable textarea */}
          <div className="relative">
            <div className="absolute top-3 right-3 z-10">
              <Edit3 className="w-3.5 h-3.5 text-[var(--text-disabled)]" />
            </div>
            <textarea
              value={edited}
              onChange={(e) => setEdited(e.target.value)}
              rows={16}
              className="w-full px-4 py-3.5 pr-8 rounded-[var(--r-lg)] border border-[var(--hc-border)] text-sm text-[var(--text-primary)] bg-[var(--surface-inset)] focus:outline-none focus:border-[var(--brand)] focus:bg-[var(--surface-card)] transition-colors resize-none leading-relaxed"
              style={{ fontFamily: "var(--font-sans)" }}
              placeholder="Generated summary will appear here…"
            />
          </div>

          {/* AI disclaimer */}
          <div className="flex items-start gap-2 p-3 rounded-[var(--r-sm)] bg-[var(--amber-050)] border border-[var(--urgent-tint)]">
            <AlertCircle className="w-3.5 h-3.5 text-[var(--urgent)] flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-[var(--urgent-ink)] leading-relaxed">
              AI-generated content. Review carefully before saving. You are
              responsible for the clinical accuracy of this summary.
            </p>
          </div>

          {/* Save button */}
          {saved ? (
            <div className="flex items-center justify-center gap-2 p-3.5 rounded-[var(--r-sm)] bg-[var(--brand-tint)] border border-[var(--green-200)]">
              <CheckCircle2 className="w-4 h-4 text-[var(--brand)]" />
              <p className="text-sm font-bold text-[var(--success-ink)]">
                Discharge summary saved and visit closed
              </p>
            </div>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving || !edited.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-[var(--r-sm)] text-sm font-bold text-[var(--white)] transition-all disabled:opacity-50"
              style={{ background: "var(--brand)", color: "var(--on-brand)" }}
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" /> Save & Close Visit
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
