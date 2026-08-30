import { FieldGroup } from "../shared/FieldGroup";
import { InputField } from "../shared/InputField";
import { TextArea } from "../shared/TextArea";
import { SubmitBtn } from "../shared/SubmitBtn";
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
import {
  Card,
  Button,
  Pill as Badge,
  Banner,
  SectionLabel,
  hoverRow,
} from "@/components/dashboard/ui";

/* ==========================================================================
   Discharge tab.

   Discharging closes the visit and auto-revokes every permission granted for
   it — irreversible, so the warning sits above the form rather than in a
   confirm dialog the doctor would click through.

   The AI assistant only DRAFTS: it fills the three text fields from the
   visit's own data and the doctor still has to review and submit.
   ========================================================================== */

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
      <div
        className="flex flex-col items-center text-center"
        style={{ padding: "48px 20px", gap: 14 }}
      >
        <span
          className="inline-flex items-center justify-center"
          style={{
            width: 60,
            height: 60,
            borderRadius: "50%",
            background: "var(--brand-tint)",
            color: "var(--green-700)",
          }}
        >
          <CheckCircle2 className="w-7 h-7" />
        </span>

        <h3
          style={{
            margin: 0,
            font: "700 18px/1.2 var(--font-sans)",
            letterSpacing: "var(--ls-tight)",
            color: "var(--text-primary)",
          }}
        >
          Patient discharged
        </h3>

        <p
          style={{
            margin: 0,
            font: "400 13px/1 var(--font-sans)",
            color: "var(--text-muted)",
          }}
        >
          Closed on{" "}
          {safeFormatDate(
            visit.dischargeDate ?? visit.updatedAt,
            "dd MMM yyyy, HH:mm",
          )}
        </p>

        {visit.dischargeDiagnosis && (
          <div className="w-full text-left" style={{ maxWidth: 480, marginTop: 6 }}>
            <Card pad={18}>
              <div className="flex flex-col" style={{ gap: 14 }}>
                {(
                  [
                    ["Discharge diagnosis", visit.dischargeDiagnosis],
                    ["Summary", visit.dischargeSummary],
                    ["Instructions", visit.dischargeInstructions],
                  ] as [string, string][]
                )
                  .filter(([, v]) => v)
                  .map(([label, value]) => (
                    <div key={label} className="flex flex-col" style={{ gap: 5 }}>
                      <SectionLabel>{label}</SectionLabel>
                      <p
                        style={{
                          margin: 0,
                          font: "400 13px/1.6 var(--font-sans)",
                          color: "var(--text-secondary)",
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {value}
                      </p>
                    </div>
                  ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Banner tone="urgent" icon={TriangleAlert} title="This will close the visit">
        All permissions granted for this visit are auto-revoked on discharge. This
        cannot be undone.
      </Banner>

      {/* ── AI draft assistant ──────────────────────────────────────────── */}
      <Card>
        <button
          onClick={() => setShowAI((v) => !v)}
          className="w-full flex items-center justify-between text-left"
          style={{
            gap: 12,
            padding: "14px 20px",
            border: "none",
            background: showAI ? "var(--green-050)" : "transparent",
            cursor: "pointer",
            transition: "background var(--dur-fast) var(--ease-standard)",
          }}
          {...(showAI ? {} : hoverRow)}
        >
          <span className="flex items-center min-w-0" style={{ gap: 11 }}>
            <span
              className="inline-flex items-center justify-center flex-shrink-0"
              style={{
                width: 30,
                height: 30,
                borderRadius: "var(--r-xs)",
                background: "var(--sidebar-bg)",
                color: "var(--green-300)",
              }}
            >
              <Wand2 className="w-3.5 h-3.5" />
            </span>
            <span className="min-w-0 flex flex-col" style={{ gap: 4 }}>
              <span
                style={{
                  font: "700 13.5px/1 var(--font-sans)",
                  color: "var(--text-primary)",
                }}
              >
                AI draft assistant
              </span>
              <span
                style={{
                  font: "400 11.5px/1 var(--font-sans)",
                  color: "var(--text-muted)",
                }}
              >
                {form.dischargeSummary
                  ? "Fields pre-filled — review before discharging"
                  : "Generate a discharge summary from this visit's data"}
              </span>
            </span>
          </span>

          <span className="flex items-center flex-shrink-0" style={{ gap: 8 }}>
            {form.dischargeSummary && (
              <Badge tone="success" icon={CheckCircle2} style={{ height: 18, fontSize: 10 }}>
                Filled
              </Badge>
            )}
            {showAI ? (
              <ChevronUp className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
            ) : (
              <ChevronDown className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
            )}
          </span>
        </button>

        {showAI && (
          <div
            style={{
              padding: 20,
              borderTop: "1px solid var(--border-faint)",
              background: "var(--green-050)",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {dataLoading && (
              <Banner tone="info" icon={Loader2}>
                Loading visit data…
              </Banner>
            )}

            {aiError && (
              <Banner tone="critical" icon={AlertCircle}>
                {aiError}
              </Banner>
            )}

            {!dataLoading && (
              <p
                style={{
                  margin: 0,
                  font: "400 12.5px/1.6 var(--font-sans)",
                  color: "var(--text-secondary)",
                }}
              >
                Generates a discharge diagnosis, summary, and instructions from this
                visit's records. Review and edit before discharging — nothing is
                submitted automatically.
              </p>
            )}

            <Button
              variant="primary"
              icon={Sparkles}
              loading={generating}
              disabled={dataLoading}
              onClick={handleGenerate}
              style={{
                alignSelf: "flex-start",
                background: "var(--sidebar-bg)",
                boxShadow: "none",
              }}
            >
              {generating
                ? "Generating…"
                : form.dischargeSummary
                  ? "Re-generate"
                  : "Generate summary"}
            </Button>
          </div>
        )}
      </Card>

      <Card>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
          <SectionLabel>Discharge summary</SectionLabel>

          <FieldGroup label="Discharge diagnosis *">
            <InputField
              value={form.dischargeDiagnosis}
              onChange={f("dischargeDiagnosis")}
              placeholder="Final confirmed diagnosis"
            />
          </FieldGroup>

          <FieldGroup label="Discharge summary *">
            <TextArea
              value={form.dischargeSummary}
              onChange={f("dischargeSummary")}
              placeholder="Summary of admission, treatment, response, condition at discharge…"
              rows={5}
            />
          </FieldGroup>

          <FieldGroup label="Discharge instructions *">
            <TextArea
              value={form.dischargeInstructions}
              onChange={f("dischargeInstructions")}
              placeholder="Medications, restrictions, warning signs, follow-up…"
              rows={4}
            />
          </FieldGroup>

          <FieldGroup label="Follow-up date">
            <InputField
              value={form.followUpDate}
              onChange={f("followUpDate")}
              type="date"
            />
          </FieldGroup>

          <div
            className="flex justify-end"
            style={{ paddingTop: 14, borderTop: "1px solid var(--border-faint)" }}
          >
            <SubmitBtn
              onClick={handleSubmit}
              loading={loading}
              label="Discharge patient"
              danger
            />
          </div>
        </div>
      </Card>
    </div>
  );
}
