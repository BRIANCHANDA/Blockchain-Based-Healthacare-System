"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { visitApi } from "@/lib/api";
import {
  FlaskConical,
  ChevronLeft,
  CheckCircle2,
  AlertTriangle,
  TriangleAlert,
  Loader2,
  Save,
  Plus,
  Trash2,
  ClipboardList,
  Clock,
  Beaker,
  User,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

type ResultRow = {
  parameter: string;
  value: string;
  unit: string;
  referenceRange: string;
  flag: "normal" | "high" | "low" | "critical";
};

const URGENCY_CONFIG: Record<
  string,
  { color: string; bg: string; label: string }
> = {
  routine: { color: "#0A6640", bg: "#E6F4EE", label: "Routine" },
  urgent: { color: "#C9952A", bg: "#FDF3DC", label: "Urgent" },
  emergency: { color: "#C0392B", bg: "#FDECEA", label: "Emergency" },
  critical: { color: "#6D28D9", bg: "#EDE9FE", label: "Critical" },
};

const FLAG_CONFIG = {
  normal: { color: "#0A6640", bg: "#E6F4EE", label: "Normal" },
  high: { color: "#C0392B", bg: "#FDECEA", label: "High ↑" },
  low: { color: "#1A6B8A", bg: "#E3F2F8", label: "Low ↓" },
  critical: { color: "#6D28D9", bg: "#EDE9FE", label: "Critical" },
};

// Common test templates
const TEST_TEMPLATES: Record<string, ResultRow[]> = {
  FBC: [
    {
      parameter: "Haemoglobin",
      value: "",
      unit: "g/dL",
      referenceRange: "12.0–16.0",
      flag: "normal",
    },
    {
      parameter: "WBC",
      value: "",
      unit: "×10⁹/L",
      referenceRange: "4.0–11.0",
      flag: "normal",
    },
    {
      parameter: "Platelets",
      value: "",
      unit: "×10⁹/L",
      referenceRange: "150–400",
      flag: "normal",
    },
    {
      parameter: "RBC",
      value: "",
      unit: "×10¹²/L",
      referenceRange: "4.5–5.5",
      flag: "normal",
    },
    {
      parameter: "Haematocrit",
      value: "",
      unit: "%",
      referenceRange: "36–46",
      flag: "normal",
    },
    {
      parameter: "MCV",
      value: "",
      unit: "fL",
      referenceRange: "80–100",
      flag: "normal",
    },
  ],
  UE: [
    {
      parameter: "Sodium",
      value: "",
      unit: "mmol/L",
      referenceRange: "136–145",
      flag: "normal",
    },
    {
      parameter: "Potassium",
      value: "",
      unit: "mmol/L",
      referenceRange: "3.5–5.0",
      flag: "normal",
    },
    {
      parameter: "Urea",
      value: "",
      unit: "mmol/L",
      referenceRange: "2.5–7.8",
      flag: "normal",
    },
    {
      parameter: "Creatinine",
      value: "",
      unit: "µmol/L",
      referenceRange: "60–120",
      flag: "normal",
    },
    {
      parameter: "eGFR",
      value: "",
      unit: "mL/min",
      referenceRange: ">60",
      flag: "normal",
    },
  ],
  LFT: [
    {
      parameter: "ALT",
      value: "",
      unit: "U/L",
      referenceRange: "7–56",
      flag: "normal",
    },
    {
      parameter: "AST",
      value: "",
      unit: "U/L",
      referenceRange: "10–40",
      flag: "normal",
    },
    {
      parameter: "ALP",
      value: "",
      unit: "U/L",
      referenceRange: "44–147",
      flag: "normal",
    },
    {
      parameter: "Bilirubin Total",
      value: "",
      unit: "µmol/L",
      referenceRange: "3–17",
      flag: "normal",
    },
    {
      parameter: "Albumin",
      value: "",
      unit: "g/L",
      referenceRange: "35–50",
      flag: "normal",
    },
  ],
  BGL: [
    {
      parameter: "Blood Glucose",
      value: "",
      unit: "mmol/L",
      referenceRange: "4.0–7.8 (PP)",
      flag: "normal",
    },
  ],
  UA: [
    {
      parameter: "pH",
      value: "",
      unit: "",
      referenceRange: "4.5–8.0",
      flag: "normal",
    },
    {
      parameter: "Protein",
      value: "",
      unit: "",
      referenceRange: "Negative",
      flag: "normal",
    },
    {
      parameter: "Glucose",
      value: "",
      unit: "",
      referenceRange: "Negative",
      flag: "normal",
    },
    {
      parameter: "Leucocytes",
      value: "",
      unit: "",
      referenceRange: "Negative",
      flag: "normal",
    },
    {
      parameter: "Nitrites",
      value: "",
      unit: "",
      referenceRange: "Negative",
      flag: "normal",
    },
    {
      parameter: "Blood",
      value: "",
      unit: "",
      referenceRange: "Negative",
      flag: "normal",
    },
  ],
};

function Toast({
  message,
  type,
}: {
  message: string;
  type: "success" | "error";
}) {
  return (
    <div
      className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium
      ${type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-100"}`}
    >
      {type === "success" ? (
        <CheckCircle2 size={16} className="text-green-600" />
      ) : (
        <AlertTriangle size={16} className="text-red-500" />
      )}
      {message}
    </div>
  );
}

// Helper: normalize order data (handle both camelCase and snake_case)
function normalizeOrder(raw: any) {
  return {
    id: raw.id,
    orderNumber: raw.orderNumber ?? raw.order_number ?? "",
    testName: raw.testName ?? raw.test_name ?? "",
    testCode: raw.testCode ?? raw.test_code ?? "",
    specimenType: raw.specimenType ?? raw.specimen_type ?? "",
    urgency: raw.urgency ?? "routine",
    clinicalNotes: raw.clinicalNotes ?? raw.clinical_notes ?? "",
    status: raw.status ?? "",
    orderedAt: raw.orderedAt ?? raw.ordered_at ?? null,
    visitId: raw.visitId ?? raw.visit_id ?? "",
    patientId: raw.patientId ?? raw.patient_id ?? "",
    visitNumber: raw.visitNumber ?? raw.visit_number ?? "",
    chiefComplaint: raw.chiefComplaint ?? raw.chief_complaint ?? "",
  };
}

// Safe date formatter
function safeDistance(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return formatDistanceToNow(d, { addSuffix: true });
}

export default function LabOrderDetailPage() {
  const { id: orderId } = useParams<{ id: string }>();
  const router = useRouter();

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [rows, setRows] = useState<ResultRow[]>([
    { parameter: "", value: "", unit: "", referenceRange: "", flag: "normal" },
  ]);
  const [interpretation, setInterpretation] = useState("");
  const [abnormalFindings, setAbnormalFindings] = useState("");
  const [error, setError] = useState("");

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    (visitApi as any)
      .getPendingLabOrders()
      .then((res: any) => {
        const rawOrders = res.data.data?.orders ?? [];
        const foundRaw = rawOrders.find((o: any) => o.id === orderId);
        if (foundRaw) {
          const normalized = normalizeOrder(foundRaw);
          setOrder(normalized);
          if (normalized.testCode && TEST_TEMPLATES[normalized.testCode]) {
            setRows(TEST_TEMPLATES[normalized.testCode].map((r) => ({ ...r })));
          }
        } else {
          setOrder(null);
        }
      })
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [orderId]);

  const addRow = () =>
    setRows((p) => [
      ...p,
      {
        parameter: "",
        value: "",
        unit: "",
        referenceRange: "",
        flag: "normal",
      },
    ]);

  const removeRow = (i: number) =>
    setRows((p) => p.filter((_, idx) => idx !== i));

  const updateRow = (i: number, field: keyof ResultRow, value: string) =>
    setRows((p) =>
      p.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)),
    );

  const applyTemplate = (code: string) => {
    const tpl = TEST_TEMPLATES[code];
    if (tpl) setRows(tpl.map((r) => ({ ...r })));
  };

  const handleSubmit = async () => {
    const valid = rows.filter((r) => r.parameter.trim() && r.value.trim());
    if (!valid.length) {
      setError("Add at least one result parameter with a value.");
      return;
    }
    if (!order) return;
    setSubmitting(true);
    setError("");
    try {
      await (visitApi as any).enterLabResult(order.visitId, order.id, {
        resultsData: valid,
        interpretation: interpretation.trim() || undefined,
        abnormalFindings: abnormalFindings.trim() || undefined,
        referenceRanges: valid.reduce((acc: any, r) => {
          acc[r.parameter] = r.referenceRange;
          return acc;
        }, {}),
      });
      showToast("Results saved successfully.", "success");
      setTimeout(() => router.push("/dashboard/laboratory/queue"), 1500);
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? "Failed to save results.");
    } finally {
      setSubmitting(false);
    }
  };

  const hasAbnormal = rows.some((r) => r.flag !== "normal");

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 gap-3">
        <Loader2 size={28} className="animate-spin text-green-700" />
        <p className="text-sm text-gray-400">Loading order…</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <FlaskConical size={28} className="text-gray-400" />
        </div>
        <p className="text-gray-700 font-semibold mb-1">Order not found</p>
        <p className="text-gray-400 text-sm mb-4">
          This order may have already been resulted or doesn't exist.
        </p>
        <button
          onClick={() => router.push("/dashboard/laboratory/queue")}
          className="text-green-700 text-sm font-medium hover:underline"
        >
          ← Back to queue
        </button>
      </div>
    );
  }

  const urgency = URGENCY_CONFIG[order.urgency] ?? URGENCY_CONFIG.routine;

  return (
    <div
      className="max-w-3xl mx-auto space-y-5"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {toast && <Toast message={toast.message} type={toast.type} />}

      <button
        onClick={() => router.push("/dashboard/laboratory/queue")}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ChevronLeft size={16} /> Back to Queue
      </button>

      {/* Order header card */}
      <div
        className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
        style={{ borderTop: `4px solid ${urgency.color}` }}
      >
        <div className="p-5">
          <div className="flex items-start gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: urgency.bg }}
            >
              <FlaskConical size={26} style={{ color: urgency.color }} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-xl font-bold text-gray-900">
                  {order.testName}
                </h1>
                <span className="text-sm font-mono font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                  {order.testCode}
                </span>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: urgency.bg, color: urgency.color }}
                >
                  {urgency.label}
                </span>
                <span className="text-xs text-gray-500">
                  {order.orderNumber}
                </span>
                <span className="text-xs text-gray-300">·</span>
                <span className="text-xs text-gray-500">
                  {order.visitNumber}
                </span>
              </div>
            </div>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-gray-50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
                <Beaker size={14} className="text-gray-500" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Specimen</p>
                <p className="text-sm font-semibold text-gray-800 capitalize">
                  {order.specimenType}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
                <Clock size={14} className="text-gray-500" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Ordered</p>
                <p className="text-sm font-semibold text-gray-800">
                  {safeDistance(order.orderedAt)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
                <User size={14} className="text-gray-500" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Status</p>
                <p className="text-sm font-semibold text-gray-800 capitalize">
                  {order.status}
                </p>
              </div>
            </div>
          </div>

          {/* Clinical notes */}
          {order.chiefComplaint && (
            <div className="mt-4 flex items-start gap-2.5 p-3 rounded-xl bg-blue-50 border border-blue-100">
              <ClipboardList
                size={14}
                className="text-blue-500 mt-0.5 flex-shrink-0"
              />
              <div>
                <p className="text-xs font-semibold text-blue-700 mb-0.5">
                  Chief Complaint
                </p>
                <p className="text-sm text-blue-800">{order.chiefComplaint}</p>
              </div>
            </div>
          )}
          {order.clinicalNotes && (
            <div className="mt-3 flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-100">
              <ClipboardList
                size={14}
                className="text-amber-500 mt-0.5 flex-shrink-0"
              />
              <div>
                <p className="text-xs font-semibold text-amber-700 mb-0.5">
                  Clinical Notes
                </p>
                <p className="text-sm text-amber-800 italic">
                  "{order.clinicalNotes}"
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Template quick-fill */}
      {Object.keys(TEST_TEMPLATES).some((k) => order.testCode?.includes(k)) && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
            Quick Templates
          </p>
          <div className="flex gap-2 flex-wrap">
            {Object.keys(TEST_TEMPLATES).map((code) => (
              <button
                key={code}
                onClick={() => applyTemplate(code)}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-gray-200 hover:border-green-400 hover:text-green-700 hover:bg-green-50 transition-all"
              >
                {code}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results entry */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-bold text-gray-800">Enter Results</p>
          {hasAbnormal && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
              <TriangleAlert size={11} /> Abnormal values present
            </span>
          )}
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-12 gap-2 mb-2 px-1">
          {[
            { label: "Parameter", span: "col-span-3" },
            { label: "Value", span: "col-span-2" },
            { label: "Unit", span: "col-span-2" },
            { label: "Reference Range", span: "col-span-3" },
            { label: "Flag", span: "col-span-2" },
          ].map(({ label, span }) => (
            <p
              key={label}
              className={`${span} text-xs font-semibold text-gray-400 uppercase tracking-wide`}
            >
              {label}
            </p>
          ))}
        </div>

        <div className="space-y-2 mb-4">
          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <input
                className="col-span-3 px-2.5 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/20 focus:bg-white transition-all"
                placeholder="e.g. Haemoglobin"
                value={row.parameter}
                onChange={(e) => updateRow(i, "parameter", e.target.value)}
              />
              <input
                className="col-span-2 px-2.5 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/20 focus:bg-white transition-all"
                placeholder="12.5"
                value={row.value}
                onChange={(e) => updateRow(i, "value", e.target.value)}
              />
              <input
                className="col-span-2 px-2.5 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/20 focus:bg-white transition-all"
                placeholder="g/dL"
                value={row.unit}
                onChange={(e) => updateRow(i, "unit", e.target.value)}
              />
              <input
                className="col-span-3 px-2.5 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/20 focus:bg-white transition-all"
                placeholder="12.0–16.0"
                value={row.referenceRange}
                onChange={(e) => updateRow(i, "referenceRange", e.target.value)}
              />
              <div className="col-span-2 flex items-center gap-1">
                <select
                  value={row.flag}
                  onChange={(e) => updateRow(i, "flag", e.target.value as any)}
                  className="flex-1 px-1.5 py-2 rounded-lg border text-xs font-semibold outline-none cursor-pointer"
                  style={{
                    borderColor: "transparent",
                    backgroundColor: FLAG_CONFIG[row.flag].bg,
                    color: FLAG_CONFIG[row.flag].color,
                  }}
                >
                  <option value="normal">Normal</option>
                  <option value="high">High ↑</option>
                  <option value="low">Low ↓</option>
                  <option value="critical">Critical</option>
                </select>
                {rows.length > 1 && (
                  <button
                    onClick={() => removeRow(i)}
                    className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={addRow}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-gray-300 text-sm text-gray-500 hover:border-green-400 hover:text-green-700 transition-all mb-5"
        >
          <Plus size={14} /> Add parameter
        </button>

        {/* Interpretation */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">
              Interpretation
            </label>
            <textarea
              rows={2}
              value={interpretation}
              onChange={(e) => setInterpretation(e.target.value)}
              placeholder="Overall interpretation of results…"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/10 focus:bg-white resize-none placeholder:text-gray-400 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">
              Abnormal Findings{" "}
              <span className="text-gray-300 font-normal normal-case">
                (optional)
              </span>
            </label>
            <textarea
              rows={2}
              value={abnormalFindings}
              onChange={(e) => setAbnormalFindings(e.target.value)}
              placeholder="Highlight any critical or abnormal values for the clinician…"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/10 focus:bg-white resize-none placeholder:text-gray-400 transition-all"
            />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 mt-4 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100">
          <button
            onClick={() => router.push("/dashboard/laboratory/queue")}
            className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-md disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#0A6640,#15803d)" }}
          >
            {submitting ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Save size={15} />
            )}
            {submitting ? "Saving…" : "Save & Submit Results"}
          </button>
        </div>
      </div>
    </div>
  );
}
