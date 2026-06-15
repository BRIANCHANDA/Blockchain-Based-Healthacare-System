"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { patientApi, labApi } from "@/lib/api";
import PatientBanner from "@/components/PatientBanner";
import { use } from "react";
import {
  Scan,
  ArrowLeft,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  FileText,
} from "lucide-react";
import { format } from "date-fns";

const STATUS_COLORS: Record<
  string,
  { bg: string; color: string; label: string }
> = {
  ordered: { bg: "#fef3c7", color: "#d97706", label: "Ordered" },
  scheduled: { bg: "#eff6ff", color: "#2563eb", label: "Scheduled" },
  completed: { bg: "#f0fdf4", color: "#16a34a", label: "Completed" },
  reported: { bg: "#faf5ff", color: "#7c3aed", label: "Reported" },
  cancelled: { bg: "#f3f4f6", color: "#6b7280", label: "Cancelled" },
};

export default function RadiologyPatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [patient, setPatient] = useState<any>(null);
  const [history, setHistory] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  // Patient context for the shared banner (allergies, conditions, diagnoses)
  const [context, setContext] = useState<any>(null);
  const [ctxLoading, setCtxLoading] = useState(true);
  const [ctxError, setCtxError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [pRes, hRes] = await Promise.all([
          patientApi.getById(id),
          patientApi.getHistory(id),
        ]);
        setPatient(pRes.data.data);
        setHistory(hRes.data.data);
      } catch {
        setError("Could not load patient data.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Load the clinical context banner (reuses /api/lab/patient-context —
  // the endpoint already permits radiologists)
  useEffect(() => {
    labApi
      .getPatientContext(id)
      .then((res) => setContext(res.data?.data ?? null))
      .catch((err: any) =>
        setCtxError(
          err.response?.data?.error?.message ??
            "Failed to load patient details",
        ),
      )
      .finally(() => setCtxLoading(false));
  }, [id]);

  const allImagingOrders =
    history?.ownVisits?.flatMap((v: any) =>
      (v.imagingOrders ?? []).map((o: any) => ({
        ...o,
        visitNumber: v.visit?.visitNumber,
        visitDate: v.visit?.admissionDate,
      })),
    ) ?? [];

  if (loading)
    return (
      <div className="flex items-center justify-center h-64 gap-3">
        <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Loading patient data…</p>
      </div>
    );

  if (error)
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-100">
        <AlertCircle className="w-4 h-4 text-red-500" />
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );

  return (
    <div style={{ maxWidth: 900, fontFamily: "'DM Sans',sans-serif" }}>
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to patients
      </button>

      {/* ── Patient banner — name, age, allergies, conditions, diagnoses ── */}
      <div className="mb-6">
        <PatientBanner
          context={context}
          loading={ctxLoading}
          error={ctxError}
        />
      </div>

      {/* Imaging summary chip row */}
      <div className="flex items-center justify-end mb-6">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-50 border border-purple-200">
          <Scan className="w-4 h-4 text-purple-600" />
          <span className="text-sm font-bold text-purple-700">
            {allImagingOrders.length} imaging order
            {allImagingOrders.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Imaging orders */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">Imaging History</h2>
          <span className="text-xs font-semibold text-gray-400">
            {allImagingOrders.length} orders total
          </span>
        </div>

        {allImagingOrders.length === 0 ? (
          <div className="py-16 text-center">
            <Scan className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-400">
              No imaging orders found for this patient
            </p>
          </div>
        ) : (
          allImagingOrders.map((order: any, i: number) => {
            const st = STATUS_COLORS[order.status] ?? STATUS_COLORS.ordered;
            const isOpen = expanded === (order.id ?? i.toString());
            return (
              <div
                key={order.id ?? i}
                className="border-b border-gray-50 last:border-0"
              >
                <button
                  onClick={() =>
                    setExpanded(isOpen ? null : (order.id ?? i.toString()))
                  }
                  className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors text-left"
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: st.bg }}
                  >
                    <Scan className="w-4 h-4" style={{ color: st.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">
                      {order.imagingType ||
                        order.imaging_type ||
                        "Imaging Study"}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5 font-mono">
                      {order.visitNumber} ·{" "}
                      {order.visitDate
                        ? format(new Date(order.visitDate), "dd MMM yyyy")
                        : "—"}
                    </p>
                  </div>
                  <span
                    className="text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{ background: st.bg, color: st.color }}
                  >
                    {st.label}
                  </span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  )}
                </button>

                {isOpen && (
                  <div className="px-6 pb-4 bg-gray-50/50">
                    <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                      {[
                        {
                          label: "Body Part",
                          value: order.bodyPart || order.body_part || "—",
                        },
                        { label: "Modality", value: order.modality || "—" },
                        {
                          label: "Ordered At",
                          value:
                            order.orderedAt || order.ordered_at
                              ? format(
                                  new Date(order.orderedAt || order.ordered_at),
                                  "dd MMM yyyy HH:mm",
                                )
                              : "—",
                        },
                        {
                          label: "Clinical Notes",
                          value:
                            order.clinicalNotes || order.clinical_notes || "—",
                        },
                      ].map((f) => (
                        <div
                          key={f.label}
                          className="bg-white rounded-lg p-3 border border-gray-100"
                        >
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                            {f.label}
                          </p>
                          <p className="text-sm font-semibold text-gray-700">
                            {f.value}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Report */}
                    {order.report && (
                      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <FileText className="w-4 h-4 text-purple-600" />
                          <p className="text-sm font-bold text-purple-800">
                            Radiology Report
                          </p>
                        </div>
                        {order.report.findings && (
                          <div className="mb-2">
                            <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-1">
                              Findings
                            </p>
                            <p className="text-sm text-gray-700 leading-relaxed">
                              {order.report.findings}
                            </p>
                          </div>
                        )}
                        {order.report.impression && (
                          <div className="mb-2">
                            <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-1">
                              Impression
                            </p>
                            <p className="text-sm text-gray-700 leading-relaxed">
                              {order.report.impression}
                            </p>
                          </div>
                        )}
                        {order.report.reportedAt && (
                          <p className="text-xs text-gray-400 mt-2">
                            Reported:{" "}
                            {format(
                              new Date(order.report.reportedAt),
                              "dd MMM yyyy HH:mm",
                            )}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
