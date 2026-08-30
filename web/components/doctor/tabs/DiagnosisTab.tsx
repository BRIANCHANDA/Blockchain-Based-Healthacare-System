import { FieldGroup } from "../shared/FieldGroup";
import { InputField } from "../shared/InputField";
import { TextArea } from "../shared/TextArea";
import { SelectField } from "../shared/SelectField";
import { SubmitBtn } from "../shared/SubmitBtn";
import { useState } from "react";
import { visitApi } from "@/lib/api";
import {
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  XCircle,
  GitBranch,
  PlusCircle,
  Hash,
  Stethoscope,
} from "lucide-react";
import {
  Card,
  CardHeader,
  Button,
  Banner,
  EmptyState,
  SectionLabel,
  TONES,
  type Tone,
} from "@/components/dashboard/ui";

/* ==========================================================================
   Diagnosis tab.

   A diagnosis hangs off a consultation, so the form is gated until one
   exists — the warning below is not decoration, the API rejects a diagnosis
   with no consultationId.

   Status keys mirror diagnosisStatusEnum in backend/src/db/schema.ts:
   provisional | confirmed | ruled_out | differential
   ========================================================================== */

const STATUS_CONFIG: Record<
  string,
  { tone: Tone; icon: React.ElementType; label: string }
> = {
  confirmed: { tone: "success", icon: CheckCircle2, label: "Confirmed" },
  provisional: { tone: "urgent", icon: HelpCircle, label: "Provisional" },
  differential: { tone: "info", icon: GitBranch, label: "Differential" },
  ruled_out: { tone: "neutral", icon: XCircle, label: "Ruled out" },
};

/** Severity climbs mild → critical. */
const SEVERITY_TONE: Record<string, Tone> = {
  mild: "success",
  moderate: "urgent",
  severe: "critical",
  critical: "accent",
};

function SeverityBadge({ severity }: { severity: string }) {
  const tone = SEVERITY_TONE[severity?.toLowerCase()] ?? "neutral";
  const t = TONES[tone];
  return (
    <span
      className="inline-flex items-center"
      style={{
        gap: 5,
        font: "600 11.5px/1 var(--font-sans)",
        color: t.ink,
        textTransform: "capitalize",
      }}
    >
      <span
        style={{ width: 6, height: 6, borderRadius: "50%", background: t.dot }}
      />
      {severity}
    </span>
  );
}

// ── Single diagnosis card ─────────────────────────────────────────────────────
function DiagnosisCard({ d }: { d: any }) {
  const sc = STATUS_CONFIG[d.diagnosisStatus] ?? STATUS_CONFIG.provisional;
  const t = TONES[sc.tone];
  const Icon = sc.icon;

  return (
    <div
      style={{
        border: "1px solid var(--hc-border)",
        borderRadius: "var(--r-md)",
        overflow: "hidden",
      }}
    >
      <div
        className="flex items-center flex-wrap"
        style={{ gap: 10, padding: "10px 16px", background: t.tint }}
      >
        <Icon className="w-4 h-4 flex-shrink-0" style={{ color: t.ink }} />
        <span
          style={{
            font: "700 11px/1 var(--font-sans)",
            letterSpacing: "var(--ls-caps)",
            textTransform: "uppercase",
            color: t.ink,
          }}
        >
          {sc.label}
        </span>

        {d.severity && (
          <>
            <span style={{ color: "var(--text-disabled)" }}>·</span>
            <SeverityBadge severity={d.severity} />
          </>
        )}

        {d.icdCode && (
          <span
            className="inline-flex items-center"
            style={{
              marginLeft: "auto",
              gap: 4,
              height: 20,
              padding: "0 8px",
              borderRadius: "var(--r-xs)",
              background: "var(--surface-card)",
              color: t.ink,
              font: "700 11px/1 var(--font-mono)",
            }}
          >
            <Hash className="w-2.5 h-2.5" />
            {d.icdCode}
          </span>
        )}
      </div>

      <div
        style={{
          padding: "14px 16px",
          background: "var(--surface-card)",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <p
          style={{
            margin: 0,
            font: "700 13.5px/1.3 var(--font-sans)",
            color: "var(--text-primary)",
          }}
        >
          {d.diagnosisName}
        </p>
        {d.notes && (
          <p
            style={{
              margin: 0,
              font: "400 12.5px/1.6 var(--font-sans)",
              color: "var(--text-secondary)",
            }}
          >
            {d.notes}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function DiagnosisTab({
  visitId,
  diagnoses,
  consultationId,
  onSaved,
  onError,
  isCompleted,
}: any) {
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    consultationId: consultationId ?? "",
    icdCode: "",
    diagnosisName: "",
    diagnosisStatus: "provisional" as
      | "provisional"
      | "confirmed"
      | "ruled_out"
      | "differential",
    severity: "",
    notes: "",
  });

  const f = (field: keyof typeof form) => (v: string) =>
    setForm((prev) => ({ ...prev, [field]: v }));

  const handleSubmit = async () => {
    if (!form.diagnosisName.trim()) {
      onError("Diagnosis name is required.");
      return;
    }
    if (!form.icdCode.trim()) {
      onError("ICD code is required.");
      return;
    }
    if (!form.consultationId) {
      onError("Save a consultation note first.");
      return;
    }

    setLoading(true);
    try {
      await (visitApi as any).addDiagnosis(visitId, {
        ...form,
        consultationId: consultationId ?? form.consultationId,
      });
      // Keep the status selection — a doctor often adds several at once.
      setForm((prev) => ({
        ...prev,
        icdCode: "",
        diagnosisName: "",
        severity: "",
        notes: "",
      }));
      setShowForm(false);
      onSaved();
    } catch (err: any) {
      onError(err.response?.data?.error?.message ?? "Failed.");
    } finally {
      setLoading(false);
    }
  };

  const noConsultation = !consultationId;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ── Diagnosis list ─────────────────────────────────────────────────── */}
      {diagnoses.length > 0 && (
        <div className="flex flex-col" style={{ gap: 10 }}>
          <SectionLabel>Diagnoses ({diagnoses.length})</SectionLabel>
          {diagnoses.map((d: any) => (
            <DiagnosisCard key={d.id} d={d} />
          ))}
        </div>
      )}

      {/* The API rejects a diagnosis with no consultation, so say so up front. */}
      {noConsultation && !isCompleted && (
        <Banner tone="urgent" icon={AlertCircle} title="Consultation required">
          Save a consultation note before adding a diagnosis.
        </Banner>
      )}

      {/* ── Add button / form ──────────────────────────────────────────────── */}
      {!isCompleted &&
        !noConsultation &&
        (!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="w-full inline-flex items-center justify-center"
            style={{
              gap: 8,
              padding: 14,
              borderRadius: "var(--r-md)",
              border: "1.5px dashed var(--hc-border)",
              background: "transparent",
              font: "600 13.5px/1 var(--font-sans)",
              color: "var(--text-muted)",
              cursor: "pointer",
              transition: "all var(--dur-fast) var(--ease-standard)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--brand)";
              e.currentTarget.style.color = "var(--green-700)";
              e.currentTarget.style.background = "var(--green-050)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--hc-border)";
              e.currentTarget.style.color = "var(--text-muted)";
              e.currentTarget.style.background = "transparent";
            }}
          >
            <PlusCircle className="w-4 h-4" />
            Add diagnosis
          </button>
        ) : (
          <Card>
            <CardHeader
              icon={Stethoscope}
              title="Add diagnosis"
              subtitle="ICD-10 coded diagnosis entry"
              right={
                <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              }
            />

            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Status is a four-way choice, so show all four rather than
                  hiding them behind a dropdown. */}
              <div className="flex flex-col" style={{ gap: 8 }}>
                <SectionLabel>Status *</SectionLabel>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                    gap: 8,
                  }}
                >
                  {Object.entries(STATUS_CONFIG).map(([val, cfg]) => {
                    const Icon = cfg.icon;
                    const selected = form.diagnosisStatus === val;
                    const t = TONES[cfg.tone];
                    return (
                      <button
                        key={val}
                        onClick={() => f("diagnosisStatus")(val)}
                        className="flex items-center text-left"
                        style={{
                          gap: 9,
                          height: 40,
                          padding: "0 12px",
                          borderRadius: "var(--r-sm)",
                          border: `1px solid ${selected ? t.ink : "var(--hc-border)"}`,
                          background: selected ? t.tint : "var(--surface-sunken)",
                          cursor: "pointer",
                          transition: "all var(--dur-fast) var(--ease-standard)",
                        }}
                      >
                        <Icon
                          className="w-4 h-4 flex-shrink-0"
                          style={{
                            color: selected ? t.ink : "var(--text-muted)",
                          }}
                        />
                        <span
                          style={{
                            font: `${selected ? 700 : 500} 12.5px/1 var(--font-sans)`,
                            color: selected ? t.ink : "var(--text-secondary)",
                          }}
                        >
                          {cfg.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(120px, 1fr) minmax(200px, 2fr)",
                  gap: 14,
                }}
              >
                <FieldGroup label="ICD-10 code *">
                  <InputField
                    value={form.icdCode}
                    onChange={f("icdCode")}
                    placeholder="e.g. I21.4"
                  />
                </FieldGroup>
                <FieldGroup label="Diagnosis name *">
                  <InputField
                    value={form.diagnosisName}
                    onChange={f("diagnosisName")}
                    placeholder="e.g. Non-ST elevation MI"
                  />
                </FieldGroup>
              </div>

              <FieldGroup label="Severity">
                <SelectField
                  value={form.severity}
                  onChange={f("severity")}
                  options={[
                    { value: "", label: "Not specified" },
                    { value: "mild", label: "Mild" },
                    { value: "moderate", label: "Moderate" },
                    { value: "severe", label: "Severe" },
                    { value: "critical", label: "Critical" },
                  ]}
                />
              </FieldGroup>

              <FieldGroup label="Notes">
                <TextArea
                  value={form.notes}
                  onChange={f("notes")}
                  placeholder="Additional clinical notes…"
                  rows={2}
                />
              </FieldGroup>

              <div
                className="flex justify-end"
                style={{ paddingTop: 14, borderTop: "1px solid var(--border-faint)" }}
              >
                <SubmitBtn
                  onClick={handleSubmit}
                  loading={loading}
                  label="Add diagnosis"
                />
              </div>
            </div>
          </Card>
        ))}

      {/* ── Empty state ────────────────────────────────────────────────────── */}
      {diagnoses.length === 0 && (isCompleted || noConsultation) && (
        <div
          style={{
            borderRadius: "var(--r-md)",
            border: "1.5px dashed var(--hc-border)",
            background: "var(--surface-sunken)",
          }}
        >
          <EmptyState
            icon={Stethoscope}
            title="No diagnoses recorded"
            message={
              isCompleted
                ? "This visit has been discharged."
                : "Diagnoses appear here once a consultation is saved."
            }
            tone="neutral"
            pad={32}
          />
        </div>
      )}
    </div>
  );
}
