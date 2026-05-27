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

// ── Field config — icon + label for each consultation section ─────────────────
const CONSULTATION_FIELDS = [
  {
    key: "historyOfPresentIllness",
    label: "History of Present Illness",
    icon: BookOpen,
    placeholder: "Onset, duration, character, associated symptoms…",
    rows: 3,
  },
  {
    key: "reviewOfSystems",
    label: "Review of Systems",
    icon: ClipboardList,
    placeholder: "Systematic review findings…",
    rows: 2,
  },
  {
    key: "physicalExamination",
    label: "Physical Examination",
    icon: Eye,
    placeholder: "General appearance, systems examination…",
    rows: 3,
  },
  {
    key: "clinicalFindings",
    label: "Clinical Findings",
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
    label: "Follow-up Instructions",
    icon: Navigation,
    placeholder: "Patient instructions on discharge or follow-up…",
    rows: 2,
  },
] as const;

// ── Past consultation record ──────────────────────────────────────────────────
function ConsultationRecord({ record, index }: { record: any; index: number }) {
  const [open, setOpen] = useState(index === 0);

  const filledFields = CONSULTATION_FIELDS.filter(({ key }) => record[key]);

  return (
    <div className="rounded-2xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50/60 transition-colors"
      >
        <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
          <Stethoscope className="w-4 h-4 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800">
            Consultation {index + 1}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Clock className="w-3 h-3 text-gray-400" />
            <span className="text-xs text-gray-400">
              {safeFormatDate(
                record.consultationDate ?? record.createdAt,
                "dd MMM yyyy, HH:mm",
              )}
            </span>
            <span className="text-gray-300">·</span>
            <span className="text-xs text-gray-400">
              {filledFields.length} sections
            </span>
          </div>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
        )}
      </button>

      {/* Body */}
      {open && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {/* Chief complaint — always shown */}
          <div className="px-4 py-3.5 bg-blue-50/40">
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-500 mb-1">
              Chief Complaint
            </p>
            <p className="text-sm font-semibold text-gray-800">
              {record.chiefComplaint || "—"}
            </p>
          </div>

          {filledFields.map(({ key, label, icon: Icon }) => (
            <div key={key} className="px-4 py-3.5 flex gap-3">
              <div className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Icon className="w-3 h-3 text-gray-400" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                  {label}
                </p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
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
  const [showForm, setShowForm] = useState(consultations.length === 0);
  const [form, setForm] = useState({
    chiefComplaint: "",
    historyOfPresentIllness: "",
    reviewOfSystems: "",
    physicalExamination: "",
    clinicalFindings: "",
    assessment: "",
    plan: "",
    followUpInstructions: "",
  });

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
      setForm({
        chiefComplaint: "",
        historyOfPresentIllness: "",
        reviewOfSystems: "",
        physicalExamination: "",
        clinicalFindings: "",
        assessment: "",
        plan: "",
        followUpInstructions: "",
      });
      setShowForm(false);
      onSaved();
    } catch (err: any) {
      onError(err.response?.data?.error?.message ?? "Failed to save.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="p-5 space-y-4"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* ── Past consultations ─────────────────────────────────────────────── */}
      {consultations.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2.5 px-0.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Consultation Notes ({consultations.length})
            </p>
          </div>
          <div className="space-y-2.5">
            {consultations.map((c: any, i: number) => (
              <ConsultationRecord key={c.id} record={c} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* ── New consultation form / toggle ────────────────────────────────── */}
      {!isCompleted && (
        <div>
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-gray-200 text-sm font-semibold text-gray-400 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/40 transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              Add Consultation Note
            </button>
          ) : (
            <div className="rounded-2xl border border-blue-100 overflow-hidden">
              {/* Form header */}
              <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-blue-50 to-white border-b border-blue-100">
                <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Stethoscope className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">
                    New Consultation Note
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Complete as many sections as applicable
                  </p>
                </div>
                {consultations.length > 0 && (
                  <button
                    onClick={() => setShowForm(false)}
                    className="ml-auto text-xs text-gray-400 hover:text-gray-600 font-medium"
                  >
                    Cancel
                  </button>
                )}
              </div>

              <div className="p-5 space-y-4 bg-white">
                {/* Chief complaint — prominent */}
                <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100">
                  <FieldGroup label="Chief Complaint *">
                    <InputField
                      value={form.chiefComplaint}
                      onChange={f("chiefComplaint")}
                      placeholder="Primary reason for this visit"
                    />
                  </FieldGroup>
                </div>

                {/* Other fields */}
                {CONSULTATION_FIELDS.map(
                  ({ key, label, icon: Icon, placeholder, rows }) => (
                    <div key={key} className="flex gap-3">
                      <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 mt-6">
                        <Icon className="w-3.5 h-3.5 text-gray-400" />
                      </div>
                      <div className="flex-1">
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
                  ),
                )}

                <div className="flex justify-end pt-3 border-t border-gray-100">
                  <SubmitBtn
                    onClick={handleSubmit}
                    loading={loading}
                    label="Save Consultation"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
