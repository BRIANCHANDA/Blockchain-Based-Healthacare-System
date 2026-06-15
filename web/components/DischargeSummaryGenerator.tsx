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
  ChevronDown,
  ChevronUp,
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

// ── Helpers ───────────────────────────────────────────────────────────────────
function Section({
  title,
  icon: Icon,
  color,
  children,
  defaultOpen = true,
}: any) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-gray-100 overflow-hidden">
      <button
        onClick={() => setOpen((o: any) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-gray-50"
        style={{ background: open ? `${color}08` : "#fff" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center"
            style={{ background: `${color}15` }}
          >
            <Icon className="w-3.5 h-3.5" style={{ color }} />
          </div>
          <p
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color }}
          >
            {title}
          </p>
        </div>
        {open ? (
          <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
        )}
      </button>
      {open && <div className="px-4 pb-3 pt-1">{children}</div>}
    </div>
  );
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
    <div className="space-y-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* ── Header card ─────────────────────────────────────────────────── */}
      <div
        className="relative rounded-2xl overflow-hidden px-5 py-4"
        style={{
          background:
            "linear-gradient(135deg,#052e16 0%,#166534 60%,#15803d 100%)",
        }}
      >
        <div
          className="absolute -right-6 -top-6 w-32 h-32 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle,#bbf7d0,transparent)" }}
        />
        <div className="relative flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-green-300" />
              <p className="text-xs font-bold uppercase tracking-widest text-green-300/70">
                AI Assistant
              </p>
            </div>
            <p
              className="text-white font-bold text-base"
              style={{ fontFamily: "'Playfair Display',serif" }}
            >
              Discharge Summary Generator
            </p>
            <p className="text-green-300/60 text-xs mt-0.5">
              Drafts a clinical summary from this visit's data for your review
            </p>
          </div>
          <button
            onClick={generate}
            disabled={generating || !hasData}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50 flex-shrink-0"
            style={{
              background: "rgba(255,255,255,0.15)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.2)",
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
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200">
          <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <p className="text-xs font-semibold text-amber-800">
            No clinical data found for this visit. Add at least a chief
            complaint, consultation or diagnosis before generating.
          </p>
        </div>
      )}

      {/* ── Data context preview ─────────────────────────────────────────── */}
      {hasData && !summary && !generating && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
            Data available for summary
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              {
                label: "Vitals",
                count: vitalSigns?.length ?? 0,
                icon: Activity,
                color: "#ef4444",
              },
              {
                label: "Consultations",
                count: consultations?.length ?? 0,
                icon: Stethoscope,
                color: "#2563eb",
              },
              {
                label: "Diagnoses",
                count: diagnoses?.length ?? 0,
                icon: ClipboardList,
                color: "#166534",
              },
              {
                label: "Lab Orders",
                count: labOrders?.length ?? 0,
                icon: FlaskConical,
                color: "#d97706",
              },
              {
                label: "Prescriptions",
                count: prescriptions?.length ?? 0,
                icon: Pill,
                color: "#0e7490",
              },
            ].map(({ label, count, icon: Icon, color }) => (
              <div
                key={label}
                className="flex items-center gap-2.5 p-3 rounded-xl border"
                style={{
                  background: count > 0 ? `${color}08` : "#f9fafb",
                  borderColor: count > 0 ? `${color}20` : "#f3f4f6",
                }}
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${color}15` }}
                >
                  <Icon
                    className="w-3.5 h-3.5"
                    style={{ color: count > 0 ? color : "#d1d5db" }}
                  />
                </div>
                <div>
                  <p
                    className="text-lg font-black leading-none tabular-nums"
                    style={{ color: count > 0 ? color : "#d1d5db" }}
                  >
                    {count}
                  </p>
                  <p className="text-[10px] text-gray-400 font-medium mt-0.5">
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
        <div className="flex flex-col items-center gap-3 py-10 rounded-2xl border border-dashed border-green-200 bg-green-50/40">
          <div className="relative">
            <div className="w-10 h-10 rounded-full border-2 border-green-200 border-t-green-600 animate-spin" />
            <Sparkles className="w-4 h-4 text-green-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-sm font-semibold text-green-700">
            Analysing visit data…
          </p>
          <p className="text-xs text-green-600/60">Drafting clinical summary</p>
        </div>
      )}

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-red-50 border border-red-200">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-xs font-semibold text-red-700">{error}</p>
        </div>
      )}

      {/* ── Generated summary ────────────────────────────────────────────── */}
      {summary && !generating && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <p className="text-xs font-bold text-gray-700">
                Summary generated — review and edit before saving
              </p>
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-green-500" /> Copied
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
              <Edit3 className="w-3.5 h-3.5 text-gray-300" />
            </div>
            <textarea
              value={edited}
              onChange={(e) => setEdited(e.target.value)}
              rows={16}
              className="w-full px-4 py-3.5 pr-8 rounded-2xl border border-gray-200 text-sm text-gray-800 bg-gray-50 focus:outline-none focus:border-green-400 focus:bg-white transition-colors resize-none leading-relaxed"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
              placeholder="Generated summary will appear here…"
            />
          </div>

          {/* AI disclaimer */}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100">
            <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-700 leading-relaxed">
              AI-generated content. Review carefully before saving. You are
              responsible for the clinical accuracy of this summary.
            </p>
          </div>

          {/* Save button */}
          {saved ? (
            <div className="flex items-center justify-center gap-2 p-3.5 rounded-xl bg-green-50 border border-green-200">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <p className="text-sm font-bold text-green-700">
                Discharge summary saved and visit closed
              </p>
            </div>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving || !edited.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#052e16,#166534)" }}
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
