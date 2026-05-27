import { FieldGroup } from "../shared/FieldGroup";
import { InputField } from "../shared/InputField";
import { TextArea } from "../shared/TextArea";
import { SelectField } from "../shared/SelectField";
import { StaffDropdown } from "../shared/StaffDropdown";
import { SubmitBtn } from "../shared/SubmitBtn";
import { SectionCard } from "../shared/SectionCard";
import { CollapsibleRecord } from "../shared/CollapsibleRecord";
import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react";
import { useState, useEffect } from "react";
import { practitionersApi, visitApi } from "@/lib/api";
import { safeFormatDate, safeDistanceToNow } from "../utils/dateHelpers";

// ── Discharge Tab (safe date) ─────────────────────────────────────────────────
export function DischargeTab({ visitId, visit, onSaved, onError }: any) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    dischargeDiagnosis: "",
    dischargeSummary: "",
    dischargeInstructions: "",
    followUpDate: "",
  });
  const f = (field: keyof typeof form) => (v: string) =>
    setForm((p) => ({ ...p, [field]: v }));
  const isCompleted = visit.status === "completed";

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

  return (
    <div className="p-5 space-y-5">
      {isCompleted ? (
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
                    <p className="text-sm text-gray-800 mt-0.5">{value}</p>
                  </div>
                ))}
            </div>
          )}
        </div>
      ) : (
        <>
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
          <SectionCard title="Discharge Summary">
            <div className="space-y-4">
              <FieldGroup label="Discharge Diagnosis *">
                <InputField
                  value={form.dischargeDiagnosis}
                  onChange={f("dischargeDiagnosis")}
                  placeholder="Final confirmed diagnosis"
                />
              </FieldGroup>
              <FieldGroup label="Discharge Summary *">
                <TextArea
                  value={form.dischargeSummary}
                  onChange={f("dischargeSummary")}
                  placeholder="Summary of admission, treatment, response, condition at discharge…"
                  rows={5}
                />
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
        </>
      )}
    </div>
  );
}
