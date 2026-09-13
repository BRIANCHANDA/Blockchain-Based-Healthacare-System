import { FieldGroup } from "../shared/FieldGroup";
import { InputField } from "../shared/InputField";
import { TextArea } from "../shared/TextArea";
import { SubmitBtn } from "../shared/SubmitBtn";
import {
  CheckCircle2,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { isAxiosError } from "axios";
import { visitApi } from "@/lib/api";
import { safeFormatDate } from "../utils/dateHelpers";
import {
  Card,
  Banner,
  SectionLabel,
} from "@/components/dashboard/ui";

/* ==========================================================================
   Discharge tab.

   Discharging closes the visit and auto-revokes every permission granted for
   it — irreversible, so the warning sits above the form rather than in a
   confirm dialog the doctor would click through.

   ========================================================================== */

type DischargeProps = {
  visitId: string;
  visit: {
    status?: string;
    dischargeDate?: string | null;
    updatedAt?: string | null;
    dischargeDiagnosis?: string | null;
    dischargeSummary?: string | null;
    dischargeInstructions?: string | null;
  };
  onSaved: () => void;
  onError: (message: string) => void;
};

export function DischargeTab({ visitId, visit, onSaved, onError }: DischargeProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    dischargeDiagnosis: "",
    dischargeSummary: "",
    dischargeInstructions: "",
    followUpDate: "",
  });

  const f = (field: keyof typeof form) => (v: string) =>
    setForm((p) => ({ ...p, [field]: v }));

  const isCompleted = visit?.status === "completed";

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
    } catch (err: unknown) {
      const message = isAxiosError<{ error?: { message?: string } }>(err) ? err.response?.data?.error?.message : undefined;
      onError(message ?? "Discharge failed.");
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
