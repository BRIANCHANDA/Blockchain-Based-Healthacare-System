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

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<
  string,
  {
    bg: string;
    text: string;
    border: string;
    icon: React.ElementType;
    label: string;
  }
> = {
  confirmed: {
    bg: "#f0fdf4",
    text: "#15803d",
    border: "#86efac",
    icon: CheckCircle2,
    label: "Confirmed",
  },
  provisional: {
    bg: "#fffbeb",
    text: "#d97706",
    border: "#fcd34d",
    icon: HelpCircle,
    label: "Provisional",
  },
  differential: {
    bg: "#eff6ff",
    text: "#2563eb",
    border: "#bfdbfe",
    icon: GitBranch,
    label: "Differential",
  },
  ruled_out: {
    bg: "#f9fafb",
    text: "#6b7280",
    border: "#e5e7eb",
    icon: XCircle,
    label: "Ruled Out",
  },
};

// ── Severity dot ──────────────────────────────────────────────────────────────
const SEVERITY_COLOR: Record<string, string> = {
  mild: "#22c55e",
  moderate: "#f59e0b",
  severe: "#ef4444",
  critical: "#7c3aed",
};

function SeverityBadge({ severity }: { severity: string }) {
  const color = SEVERITY_COLOR[severity?.toLowerCase()] ?? "#9ca3af";
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-semibold capitalize"
      style={{ color }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: color }}
      />
      {severity}
    </span>
  );
}

// ── Single diagnosis card ─────────────────────────────────────────────────────
function DiagnosisCard({ d }: { d: any }) {
  const sc = STATUS_CONFIG[d.diagnosisStatus] ?? STATUS_CONFIG.provisional;
  const Icon = sc.icon;

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: sc.border }}
    >
      {/* Coloured left strip via gradient header */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ background: sc.bg }}
      >
        <Icon className="w-4 h-4 flex-shrink-0" style={{ color: sc.text }} />
        <span
          className="text-xs font-bold uppercase tracking-wider"
          style={{ color: sc.text }}
        >
          {sc.label}
        </span>
        {d.severity && (
          <>
            <span className="text-gray-300">·</span>
            <SeverityBadge severity={d.severity} />
          </>
        )}
        {d.icdCode && (
          <span
            className="ml-auto inline-flex items-center gap-1 text-xs font-bold font-mono px-2 py-0.5 rounded-lg bg-white/70"
            style={{ color: sc.text }}
          >
            <Hash className="w-2.5 h-2.5" />
            {d.icdCode}
          </span>
        )}
      </div>

      <div className="px-4 py-3.5 bg-white">
        <p className="text-sm font-bold text-gray-900">{d.diagnosisName}</p>
        {d.notes && (
          <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
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
    <div
      className="p-5 space-y-4"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* ── Diagnosis list ─────────────────────────────────────────────────── */}
      {diagnoses.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2.5 px-0.5">
            Diagnoses ({diagnoses.length})
          </p>
          <div className="space-y-2.5">
            {diagnoses.map((d: any) => (
              <DiagnosisCard key={d.id} d={d} />
            ))}
          </div>
        </div>
      )}

      {/* ── No consultation warning ────────────────────────────────────────── */}
      {noConsultation && !isCompleted && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              Consultation required
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              Save a consultation note before adding a diagnosis.
            </p>
          </div>
        </div>
      )}

      {/* ── Add button / form ──────────────────────────────────────────────── */}
      {!isCompleted && !noConsultation && (
        <div>
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-gray-200 text-sm font-semibold text-gray-400 hover:border-green-300 hover:text-green-600 hover:bg-green-50/40 transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              Add Diagnosis
            </button>
          ) : (
            <div className="rounded-2xl border border-green-100 overflow-hidden">
              {/* Form header */}
              <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-green-50 to-white border-b border-green-100">
                <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                  <Stethoscope className="w-4 h-4 text-green-700" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">
                    Add Diagnosis
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    ICD-10 coded diagnosis entry
                  </p>
                </div>
                <button
                  onClick={() => setShowForm(false)}
                  className="ml-auto text-xs text-gray-400 hover:text-gray-600 font-medium"
                >
                  Cancel
                </button>
              </div>

              <div className="p-5 space-y-4 bg-white">
                {/* Status selector — visual */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Status *
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      Object.entries(STATUS_CONFIG) as [
                        string,
                        (typeof STATUS_CONFIG)[string],
                      ][]
                    ).map(([val, cfg]) => {
                      const Icon = cfg.icon;
                      const selected = form.diagnosisStatus === val;
                      return (
                        <button
                          key={val}
                          onClick={() => f("diagnosisStatus")(val)}
                          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all"
                          style={
                            selected
                              ? { background: cfg.bg, borderColor: cfg.border }
                              : {
                                  background: "#fafafa",
                                  borderColor: "#e5e7eb",
                                }
                          }
                        >
                          <Icon
                            className="w-4 h-4 flex-shrink-0"
                            style={{ color: selected ? cfg.text : "#9ca3af" }}
                          />
                          <span
                            className="text-xs font-semibold"
                            style={{ color: selected ? cfg.text : "#6b7280" }}
                          >
                            {cfg.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ICD + Name */}
                <div className="grid grid-cols-3 gap-3">
                  <FieldGroup label="ICD-10 Code *">
                    <InputField
                      value={form.icdCode}
                      onChange={f("icdCode")}
                      placeholder="e.g. I21.4"
                    />
                  </FieldGroup>
                  <div className="col-span-2">
                    <FieldGroup label="Diagnosis Name *">
                      <InputField
                        value={form.diagnosisName}
                        onChange={f("diagnosisName")}
                        placeholder="e.g. Non-ST Elevation MI"
                      />
                    </FieldGroup>
                  </div>
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

                <div className="flex justify-end pt-3 border-t border-gray-100">
                  <SubmitBtn
                    onClick={handleSubmit}
                    loading={loading}
                    label="Add Diagnosis"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Empty state ────────────────────────────────────────────────────── */}
      {diagnoses.length === 0 && (isCompleted || noConsultation) && (
        <div className="flex flex-col items-center gap-2 py-10 rounded-2xl border border-dashed border-gray-200 bg-gray-50/60">
          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
            <Stethoscope className="w-5 h-5 text-gray-300" />
          </div>
          <p className="text-sm font-semibold text-gray-400">
            No diagnoses recorded
          </p>
        </div>
      )}
    </div>
  );
}
