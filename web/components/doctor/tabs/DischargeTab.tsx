import { FieldGroup } from "../shared/FieldGroup";
import { InputField } from "../shared/InputField";
import { TextArea } from "../shared/TextArea";
import { SubmitBtn } from "../shared/SubmitBtn";
import { SectionCard } from "../shared/SectionCard";
import {
  CheckCircle2,
  Loader2,
  TriangleAlert,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Wand2,
  AlertCircle,
} from "lucide-react";
import { useState, useEffect } from "react";
import { visitApi } from "@/lib/api";
import { safeFormatDate } from "../utils/dateHelpers";
import { askClaude } from "@/lib/ai";

export function DischargeTab({ visitId, visit, onSaved, onError }: any) {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [aiError, setAiError] = useState("");
  const [visitData, setVisitData] = useState<any>(null);
  const [dataLoading, setDataLoading] = useState(false);

  const [form, setForm] = useState({
    dischargeDiagnosis: "",
    dischargeSummary: "",
    dischargeInstructions: "",
    followUpDate: "",
  });

  const f = (field: keyof typeof form) => (v: string) =>
    setForm((p) => ({ ...p, [field]: v }));

  const isCompleted = visit?.status === "completed";

  useEffect(() => {
    if (!showAI || visitData || dataLoading) return;
    setDataLoading(true);
    visitApi
      .getSummary(visitId)
      .then((res) => setVisitData(res.data.data))
      .catch((err) => console.error("[DischargeTab] getSummary failed:", err))
      .finally(() => setDataLoading(false));
  }, [showAI, visitId, visitData, dataLoading]);

  const buildPrompt = () => {
    const patient = visitData?.patient ?? {};
    const consultations = visitData?.consultations ?? [];
    const diagnoses = visitData?.diagnoses ?? [];
    const vitalSigns = visitData?.vitalSigns ?? [];
    const labOrders = visitData?.labOrders ?? [];
    const prescriptions = visitData?.prescriptions ?? [];

    const v0 = vitalSigns[0];
    const vitalsText = v0
      ? [
          v0.temperature && `Temp: ${v0.temperature}C`,
          v0.bloodPressureSystolic &&
            `BP: ${v0.bloodPressureSystolic}/${v0.bloodPressureDiastolic}`,
          v0.pulseRate && `HR: ${v0.pulseRate}bpm`,
          v0.oxygenSaturation && `SpO2: ${v0.oxygenSaturation}%`,
        ]
          .filter(Boolean)
          .join(", ")
      : "Not recorded";

    const diagnosesText = diagnoses.length
      ? diagnoses
          .map(
            (d: any) =>
              `${d.diagnosisName}${d.icdCode ? ` (${d.icdCode})` : ""}${d.severity ? ` - ${d.severity}` : ""}`,
          )
          .join("; ")
      : "No formal diagnosis";

    const consultText = consultations.length
      ? consultations
          .map((c: any) =>
            [
              c.chiefComplaint && `Complaint: ${c.chiefComplaint}`,
              c.clinicalFindings && `Findings: ${c.clinicalFindings}`,
              c.assessment && `Assessment: ${c.assessment}`,
              c.plan && `Plan: ${c.plan}`,
            ]
              .filter(Boolean)
              .join(". "),
          )
          .join(" | ")
          .slice(0, 400)
      : "No notes";

    const labText = labOrders.length
      ? labOrders
          .map((l: any) => `${l.testName}: ${l.status}`)
          .join("; ")
          .slice(0, 200)
      : "None";

    const rxText = prescriptions.length
      ? prescriptions.map((p: any) => p.prescriptionNumber ?? "Rx").join("; ")
      : "None";

    return `Write a discharge summary JSON for this hospital visit. Be concise.

Patient: ${patient.firstName ?? ""} ${patient.lastName ?? ""}, ${patient.gender ?? "unknown"}
Visit: ${visit?.visitNumber}, ${visit?.visitType}
Complaint: ${visit?.chiefComplaint ?? "Not recorded"}
Vitals: ${vitalsText}
Diagnoses: ${diagnosesText}
Notes: ${consultText}
Labs: ${labText}
Prescriptions: ${rxText}

Respond with ONLY valid JSON, no extra text, no markdown:
{"dischargeDiagnosis":"one line final diagnosis","dischargeSummary":"3 sentences max covering admission reason, treatment and condition at discharge","dischargeInstructions":"3 short practical instructions"}`;
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setAiError("");
    try {
      const raw = await askClaude(buildPrompt(), 1500);
      console.log("[DischargeTab] AI raw response:", raw);

      let parsed: any = null;

      // Strategy 1: direct parse
      try {
        parsed = JSON.parse(raw.trim());
      } catch {}

      // Strategy 2: extract from markdown fences
      if (!parsed) {
        const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (fenceMatch) {
          try {
            parsed = JSON.parse(fenceMatch[1].trim());
          } catch {}
        }
      }

      // Strategy 3: find first { ... } block
      if (!parsed) {
        const braceMatch = raw.match(/\{[\s\S]*\}/);
        if (braceMatch) {
          try {
            parsed = JSON.parse(braceMatch[0]);
          } catch {}
        }
      }

      if (!parsed) {
        console.error("[DischargeTab] Could not parse JSON from:", raw);
        setAiError(`Could not parse AI response. Raw: ${raw.slice(0, 200)}`);
        return;
      }

      setForm((prev) => ({
        ...prev,
        dischargeDiagnosis:
          parsed.dischargeDiagnosis || prev.dischargeDiagnosis,
        dischargeSummary: parsed.dischargeSummary || prev.dischargeSummary,
        dischargeInstructions:
          parsed.dischargeInstructions || prev.dischargeInstructions,
      }));
      setShowAI(false);
    } catch (err: any) {
      console.error("[DischargeTab] AI error:", err);
      setAiError(
        err?.response?.data?.error?.message ??
          err?.message ??
          "AI request failed.",
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = async () => {
    if (
      !form.dischargeDiagnosis.trim() ||
      !form.dischargeSummary.trim() ||
      !form.dischargeInstructions.trim()
    ) {
      onError("Diagnosis, summary, and instructions are all required.");
      return;
    }
    setLoading(true);
    try {
      await visitApi.discharge(visitId, {
        ...form,
        followUpDate: form.followUpDate
          ? new Date(form.followUpDate).toISOString()
          : undefined,
      });
      onSaved();
    } catch (err: any) {
      onError(err.response?.data?.error?.message ?? "Discharge failed.");
    } finally {
      setLoading(false);
    }
  };

  if (isCompleted) {
    return (
      <div className="p-5">
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-green-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            Patient Discharged
          </h3>
          <p className="text-gray-500 text-sm mb-4">
            Closed on{" "}
            {safeFormatDate(
              visit.dischargeDate ?? visit.updatedAt,
              "dd MMM yyyy, HH:mm",
            )}
          </p>
          {visit.dischargeDiagnosis && (
            <div className="max-w-md mx-auto text-left p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-3">
              {[
                ["Discharge Diagnosis", visit.dischargeDiagnosis],
                ["Summary", visit.dischargeSummary],
                ["Instructions", visit.dischargeInstructions],
              ]
                .filter(([, v]) => v)
                .map(([label, value]) => (
                  <div key={String(label)}>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      {label}
                    </p>
                    <p className="text-sm text-gray-800 mt-0.5 whitespace-pre-wrap">
                      {value}
                    </p>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="p-5 space-y-5"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
        <TriangleAlert
          size={18}
          className="text-amber-500 mt-0.5 flex-shrink-0"
        />
        <div>
          <p className="text-sm font-bold text-amber-800">
            This will close the visit
          </p>
          <p className="text-sm text-amber-700 mt-0.5">
            All permissions will be auto-revoked. This cannot be undone.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-green-100 overflow-hidden">
        <button
          onClick={() => setShowAI((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-green-50/40 transition-colors"
          style={{ background: showAI ? "rgba(240,253,244,0.6)" : "#fff" }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,#052e16,#166534)" }}
            >
              <Wand2 className="w-3.5 h-3.5 text-green-300" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800">
                AI Draft Assistant
              </p>
              <p className="text-xs text-gray-400">
                {form.dischargeSummary
                  ? "Fields pre-filled — review before discharging"
                  : "Generate discharge summary from visit data"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {form.dischargeSummary && (
              <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
                Filled ✓
              </span>
            )}
            {showAI ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </div>
        </button>

        {showAI && (
          <div className="border-t border-green-100 px-5 py-4 bg-green-50/20 space-y-3">
            {dataLoading && (
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-blue-50 border border-blue-100">
                <Loader2 className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />
                <p className="text-xs text-blue-700 font-medium">
                  Loading visit data…
                </p>
              </div>
            )}
            {aiError && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 border border-red-100">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-700 break-all">{aiError}</p>
              </div>
            )}
            {!dataLoading && (
              <p className="text-xs text-gray-500 leading-relaxed">
                Generates discharge diagnosis, summary and instructions from
                this visit's data. Review and edit before clicking Discharge
                Patient.
              </p>
            )}
            <button
              onClick={handleGenerate}
              disabled={generating || dataLoading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-60"
              style={{ background: "linear-gradient(135deg,#052e16,#166534)" }}
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Generating…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />{" "}
                  {form.dischargeSummary ? "Re-generate" : "Generate Summary"}
                </>
              )}
            </button>
          </div>
        )}
      </div>

      <SectionCard title="Discharge Summary">
        <div className="space-y-4">
          <FieldGroup label="Discharge Diagnosis *">
            <div className="relative">
              <InputField
                value={form.dischargeDiagnosis}
                onChange={f("dischargeDiagnosis")}
                placeholder="Final confirmed diagnosis"
              />
              {form.dischargeDiagnosis && (
                <Sparkles className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-green-400 pointer-events-none" />
              )}
            </div>
          </FieldGroup>

          <FieldGroup label="Discharge Summary *">
            <TextArea
              value={form.dischargeSummary}
              onChange={f("dischargeSummary")}
              placeholder="Summary of admission, treatment, response, condition at discharge…"
              rows={5}
            />
            {form.dischargeSummary && (
              <p className="text-[10px] text-green-600 font-semibold mt-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Review before saving
              </p>
            )}
          </FieldGroup>

          <FieldGroup label="Discharge Instructions *">
            <TextArea
              value={form.dischargeInstructions}
              onChange={f("dischargeInstructions")}
              placeholder="Medications, restrictions, warning signs, follow-up…"
              rows={4}
            />
          </FieldGroup>

          <FieldGroup label="Follow-up Date">
            <InputField
              value={form.followUpDate}
              onChange={f("followUpDate")}
              type="date"
            />
          </FieldGroup>

          <div className="flex justify-end pt-2 border-t border-gray-100">
            <SubmitBtn
              onClick={handleSubmit}
              loading={loading}
              label="Discharge Patient"
              danger
            />
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
