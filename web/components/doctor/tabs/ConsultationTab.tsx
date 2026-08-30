import { FieldGroup } from "../shared/FieldGroup";
import { InputField } from "../shared/InputField";
import { TextArea } from "../shared/TextArea";
import { SubmitBtn } from "../shared/SubmitBtn";
import { useState } from "react";
import { visitApi } from "@/lib/api";
import { safeFormatDate } from "../utils/dateHelpers";
import {
  Stethoscope,
  ChevronDown,
  ChevronUp,
  BookOpen,
  ClipboardList,
  Eye,
  Microscope,
  Brain,
  Navigation,
  Clock,
  PlusCircle,
  FileText,
} from "lucide-react";
import {
  Card,
  CardHeader,
  Button,
  SectionLabel,
  hoverRow,
} from "@/components/dashboard/ui";

/* ==========================================================================
   Consultation tab.

   A consultation is one structured note per encounter. CONSULTATION_FIELDS
   drives both the form and the read-back view, so a section can never appear
   in one and not the other.
   ========================================================================== */

// ── Field config — icon + label for each consultation section ─────────────────
const CONSULTATION_FIELDS = [
  {
    key: "historyOfPresentIllness",
    label: "History of present illness",
    icon: BookOpen,
    placeholder: "Onset, duration, character, associated symptoms…",
    rows: 3,
  },
  {
    key: "reviewOfSystems",
    label: "Review of systems",
    icon: ClipboardList,
    placeholder: "Systematic review findings…",
    rows: 2,
  },
  {
    key: "physicalExamination",
    label: "Physical examination",
    icon: Eye,
    placeholder: "General appearance, systems examination…",
    rows: 3,
  },
  {
    key: "clinicalFindings",
    label: "Clinical findings",
    icon: Microscope,
    placeholder: "Significant positive and negative findings…",
    rows: 2,
  },
  {
    key: "assessment",
    label: "Assessment",
    icon: Brain,
    placeholder: "Clinical impression and differential diagnoses…",
    rows: 2,
  },
  {
    key: "plan",
    label: "Plan",
    icon: FileText,
    placeholder: "Investigations, treatment, referrals…",
    rows: 3,
  },
  {
    key: "followUpInstructions",
    label: "Follow-up instructions",
    icon: Navigation,
    placeholder: "Patient instructions on discharge or follow-up…",
    rows: 2,
  },
] as const;

const EMPTY_FORM = {
  chiefComplaint: "",
  historyOfPresentIllness: "",
  reviewOfSystems: "",
  physicalExamination: "",
  clinicalFindings: "",
  assessment: "",
  plan: "",
  followUpInstructions: "",
};

// ── Past consultation record ──────────────────────────────────────────────────
function ConsultationRecord({ record, index }: { record: any; index: number }) {
  // The most recent note is the one a doctor usually wants, so it opens first.
  const [open, setOpen] = useState(index === 0);

  const filledFields = CONSULTATION_FIELDS.filter(({ key }) => record[key]);

  return (
    <div
      style={{
        border: "1px solid var(--hc-border)",
        borderRadius: "var(--r-md)",
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center text-left"
        style={{
          gap: 12,
          padding: "12px 16px",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          transition: "background var(--dur-fast) var(--ease-standard)",
        }}
        {...hoverRow}
      >
        <span
          className="inline-flex items-center justify-center flex-shrink-0"
          style={{
            width: 32,
            height: 32,
            borderRadius: "var(--r-sm)",
            background: "var(--info-tint)",
            color: "var(--info-ink)",
          }}
        >
          <Stethoscope className="w-4 h-4" />
        </span>

        <span className="flex-1 min-w-0 flex flex-col" style={{ gap: 5 }}>
          <span
            style={{
              font: "700 13.5px/1 var(--font-sans)",
              color: "var(--text-primary)",
            }}
          >
            Consultation {index + 1}
          </span>
          <span
            className="inline-flex items-center flex-wrap"
            style={{
              gap: 7,
              font: "400 11.5px/1 var(--font-sans)",
              color: "var(--text-muted)",
            }}
          >
            <Clock className="w-3 h-3" />
            {safeFormatDate(
              record.consultationDate ?? record.createdAt,
              "dd MMM yyyy, HH:mm",
            )}
            <span style={{ color: "var(--text-disabled)" }}>·</span>
            {filledFields.length} section{filledFields.length !== 1 ? "s" : ""}
          </span>
        </span>

        {open ? (
          <ChevronUp
            className="w-4 h-4 flex-shrink-0"
            style={{ color: "var(--text-muted)" }}
          />
        ) : (
          <ChevronDown
            className="w-4 h-4 flex-shrink-0"
            style={{ color: "var(--text-muted)" }}
          />
        )}
      </button>

      {open && (
        <div style={{ borderTop: "1px solid var(--border-faint)" }}>
          {/* Chief complaint always shows — it frames everything below it. */}
          <div
            style={{
              padding: "14px 16px",
              background: "var(--info-tint)",
              borderBottom: "1px solid var(--border-faint)",
              display: "flex",
              flexDirection: "column",
              gap: 5,
            }}
          >
            <SectionLabel style={{ color: "var(--info-ink)" }}>
              Chief complaint
            </SectionLabel>
            <p
              style={{
                margin: 0,
                font: "600 13.5px/1.4 var(--font-sans)",
                color: "var(--text-primary)",
              }}
            >
              {record.chiefComplaint || "—"}
            </p>
          </div>

          {filledFields.map(({ key, label, icon: Icon }) => (
            <div
              key={key}
              className="flex"
              style={{
                gap: 12,
                padding: "14px 16px",
                borderBottom: "1px solid var(--border-faint)",
              }}
            >
              <span
                className="inline-flex items-center justify-center flex-shrink-0"
                style={{
                  width: 24,
                  height: 24,
                  marginTop: 2,
                  borderRadius: "var(--r-xs)",
                  background: "var(--surface-sunken)",
                  color: "var(--text-muted)",
                }}
              >
                <Icon className="w-3 h-3" />
              </span>
              <div className="flex-1 min-w-0 flex flex-col" style={{ gap: 5 }}>
                <SectionLabel>{label}</SectionLabel>
                <p
                  style={{
                    margin: 0,
                    font: "400 13px/1.6 var(--font-sans)",
                    color: "var(--text-secondary)",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {record[key]}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function ConsultationTab({
  visitId,
  consultations,
  onSaved,
  onError,
  isCompleted,
}: any) {
  const [loading, setLoading] = useState(false);
  // With no notes yet, the form is the whole point of the tab — open it.
  const [showForm, setShowForm] = useState(consultations.length === 0);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const f = (field: keyof typeof form) => (v: string) =>
    setForm((prev) => ({ ...prev, [field]: v }));

  const handleSubmit = async () => {
    if (!form.chiefComplaint.trim()) {
      onError("Chief complaint is required.");
      return;
    }
    setLoading(true);
    try {
      await (visitApi as any).addConsultation(visitId, form);
      setForm({ ...EMPTY_FORM });
      setShowForm(false);
      onSaved();
    } catch (err: any) {
      onError(err.response?.data?.error?.message ?? "Failed to save.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ── Past consultations ─────────────────────────────────────────────── */}
      {consultations.length > 0 && (
        <div className="flex flex-col" style={{ gap: 10 }}>
          <SectionLabel>Consultation notes ({consultations.length})</SectionLabel>
          {consultations.map((c: any, i: number) => (
            <ConsultationRecord key={c.id} record={c} index={i} />
          ))}
        </div>
      )}

      {/* ── New consultation form / toggle ────────────────────────────────── */}
      {!isCompleted &&
        (!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="w-full inline-flex items-center justify-center"
            style={{
              gap: 8,
              padding: "14px",
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
            Add consultation note
          </button>
        ) : (
          <Card>
            <CardHeader
              icon={Stethoscope}
              title="New consultation note"
              subtitle="Complete as many sections as applicable"
              tone="info"
              right={
                consultations.length > 0 ? (
                  <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                    Cancel
                  </Button>
                ) : undefined
              }
            />

            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Chief complaint is mandatory, so it gets its own surface. */}
              <div
                style={{
                  padding: 16,
                  borderRadius: "var(--r-sm)",
                  background: "var(--info-tint)",
                  border: "1px solid var(--blue-100)",
                }}
              >
                <FieldGroup label="Chief complaint *">
                  <InputField
                    value={form.chiefComplaint}
                    onChange={f("chiefComplaint")}
                    placeholder="Primary reason for this visit"
                  />
                </FieldGroup>
              </div>

              {CONSULTATION_FIELDS.map(({ key, label, icon: Icon, placeholder, rows }) => (
                <div key={key} className="flex" style={{ gap: 12 }}>
                  <span
                    className="inline-flex items-center justify-center flex-shrink-0"
                    style={{
                      width: 28,
                      height: 28,
                      marginTop: 22,
                      borderRadius: "var(--r-xs)",
                      background: "var(--surface-sunken)",
                      color: "var(--text-muted)",
                    }}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <FieldGroup label={label}>
                      <TextArea
                        value={(form as any)[key]}
                        onChange={f(key as keyof typeof form)}
                        placeholder={placeholder}
                        rows={rows}
                      />
                    </FieldGroup>
                  </div>
                </div>
              ))}

              <div
                className="flex justify-end"
                style={{ paddingTop: 14, borderTop: "1px solid var(--border-faint)" }}
              >
                <SubmitBtn
                  onClick={handleSubmit}
                  loading={loading}
                  label="Save consultation"
                />
              </div>
            </div>
          </Card>
        ))}
    </div>
  );
}
