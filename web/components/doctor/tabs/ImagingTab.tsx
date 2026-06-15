// ── ImagingTab.tsx ────────────────────────────────────────────────────────────
import { FieldGroup } from "../shared/FieldGroup";
import { InputField } from "../shared/InputField";
import { TextArea } from "../shared/TextArea";
import { SelectField } from "../shared/SelectField";
import { StaffDropdown } from "../shared/StaffDropdown";
import { SubmitBtn } from "../shared/SubmitBtn";
import { useState, useEffect } from "react";
import { practitionersApi, visitApi } from "@/lib/api";
import { safeFormatDate, safeDistanceToNow } from "../utils/dateHelpers";
import {
  Scan,
  ChevronDown,
  ChevronUp,
  Clock,
  Image as ImageIcon,
  FileText,
  Loader2,
  PlusCircle,
  AlertCircle,
  CheckCircle2,
  Radio,
  ExternalLink,
} from "lucide-react";

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  specialization: string | null;
  lastSeenAt: string | null;
}

const MODALITIES = [
  "x-ray",
  "ct_scan",
  "mri",
  "ultrasound",
  "pet_scan",
  "mammogram",
  "fluoroscopy",
] as const;

const MODALITY_COLOR: Record<string, { color: string; bg: string }> = {
  "x-ray": { color: "#0ea5e9", bg: "#f0f9ff" },
  ct_scan: { color: "#8b5cf6", bg: "#f5f3ff" },
  mri: { color: "#7c3aed", bg: "#fdf4ff" },
  ultrasound: { color: "#0891b2", bg: "#ecfeff" },
  pet_scan: { color: "#f59e0b", bg: "#fffbeb" },
  mammogram: { color: "#ec4899", bg: "#fdf2f8" },
  fluoroscopy: { color: "#6366f1", bg: "#eef2ff" },
};

const STATUS_STYLE: Record<
  string,
  { bg: string; text: string; icon: React.ElementType }
> = {
  ordered: { bg: "#fffbeb", text: "#d97706", icon: Clock },
  pending: { bg: "#eff6ff", text: "#2563eb", icon: Clock },
  reported: { bg: "#f0fdf4", text: "#15803d", icon: CheckCircle2 },
  cancelled: { bg: "#f9fafb", text: "#6b7280", icon: AlertCircle },
};

// ── Imaging order card ────────────────────────────────────────────────────────
function ImagingOrderCard({
  order,
  onOpen,
  report,
  isLoading,
}: {
  order: any;
  onOpen: () => void;
  report: any;
  isLoading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const mc = MODALITY_COLOR[order.modality] ?? {
    color: "#6b7280",
    bg: "#f9fafb",
  };
  const sc = STATUS_STYLE[order.status] ?? STATUS_STYLE.ordered;
  const StatusIcon = sc.icon;
  const hasReport = report && report !== null;

  const handleToggle = () => {
    if (!open) onOpen();
    setOpen((v) => !v);
  };

  return (
    <div className="rounded-2xl border border-gray-100 overflow-hidden">
      <button
        onClick={handleToggle}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50/60 transition-colors"
      >
        {/* Modality icon */}
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: mc.bg }}
        >
          <Radio className="w-4 h-4" style={{ color: mc.color }} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800">
            {order.modality?.replace(/_/g, " ").toUpperCase()} —{" "}
            {order.bodyPart}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs font-mono text-gray-400">
              {order.orderNumber}
            </span>
            <span className="text-gray-300">·</span>
            {order.assignedToName && (
              <span className="text-xs text-gray-400">
                {order.assignedToName}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full capitalize"
            style={{ background: sc.bg, color: sc.text }}
          >
            <StatusIcon className="w-3 h-3" />
            {order.status}
          </span>
          {open ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-4 py-4 bg-white space-y-4">
          {/* Indication */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
              Clinical Indication
            </p>
            <p className="text-sm text-gray-700">{order.indication}</p>
          </div>

          {/* Report section */}
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading report…
            </div>
          ) : hasReport ? (
            <div className="rounded-2xl border border-purple-100 bg-purple-50/50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-purple-100">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-600" />
                  <p className="text-xs font-bold text-purple-700 uppercase tracking-wide">
                    Radiology Report
                  </p>
                </div>
                {report.reportedAt && (
                  <span className="text-xs text-purple-400">
                    {safeFormatDate(report.reportedAt, "dd MMM yyyy")}
                  </span>
                )}
              </div>
              <div className="px-4 py-4 space-y-3">
                {report.findings && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-purple-500 mb-1">
                      Findings
                    </p>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                      {report.findings}
                    </p>
                  </div>
                )}
                {report.impression && (
                  <div className="p-3 rounded-xl bg-white border border-purple-100">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-purple-500 mb-1">
                      Impression
                    </p>
                    <p className="text-sm font-semibold text-gray-900">
                      {report.impression}
                    </p>
                  </div>
                )}
                {report.recommendations && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-purple-500 mb-1">
                      Recommendations
                    </p>
                    <p className="text-sm text-gray-700">
                      {report.recommendations}
                    </p>
                  </div>
                )}
                {report.imageUrls?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-purple-500 mb-2">
                      Images ({report.imageUrls.length})
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {report.imageUrls.map((url: string, i: number) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group relative block rounded-xl overflow-hidden border border-purple-100 hover:shadow-md transition-all"
                        >
                          <img
                            src={url}
                            alt={`Image ${i + 1}`}
                            className="w-full h-28 object-cover bg-gray-100"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                            <ExternalLink className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : order.status === "reported" ? (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 text-sm text-gray-500">
              <AlertCircle className="w-4 h-4" /> Report data unavailable.
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100 text-sm text-amber-700">
              <Clock className="w-4 h-4" /> Awaiting radiologist report.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main ImagingTab ───────────────────────────────────────────────────────────
export function ImagingTab({
  visitId,
  imagingOrders,
  onSaved,
  onError,
  isCompleted,
}: {
  visitId: string;
  imagingOrders: any[];
  onSaved: () => void;
  onError: (m: string) => void;
  isCompleted: boolean;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [radiologists, setRadiologists] = useState<StaffMember[]>([]);
  const [radiosLoading, setRadiosLoading] = useState(true);
  const [form, setForm] = useState({
    modality: "x-ray",
    bodyPart: "",
    indication: "",
    urgency: "routine",
    assignedTo: "",
  });
  const [reports, setReports] = useState<Record<string, any>>({});
  const [loadingReports, setLoadingReports] = useState<Record<string, boolean>>(
    {},
  );

  useEffect(() => {
    practitionersApi
      .getOnlineStaff("radiologist")
      .then((res) => setRadiologists(res.data.data?.staff ?? []))
      .catch(() => setRadiologists([]))
      .finally(() => setRadiosLoading(false));
  }, []);

  // Pre-populate reports from embedded report data in the order props
  useEffect(() => {
    const preloaded: Record<string, any> = {};
    for (const order of imagingOrders) {
      if (order.report !== undefined) {
        preloaded[order.id] = order.report; // null means no report yet
      }
    }
    if (Object.keys(preloaded).length > 0) {
      setReports((prev) => ({ ...preloaded, ...prev }));
    }
  }, [imagingOrders]);

  const f = (field: keyof typeof form) => (v: string) =>
    setForm((p) => ({ ...p, [field]: v }));

  const fetchReport = async (orderId: string) => {
    if (reports[orderId] !== undefined || loadingReports[orderId]) return;
    setLoadingReports((p) => ({ ...p, [orderId]: true }));
    try {
      const res = await visitApi.getImagingReport(orderId);
      setReports((p) => ({
        ...p,
        [orderId]: res.data.success ? res.data.data : null,
      }));
    } catch {
      setReports((p) => ({ ...p, [orderId]: null }));
    } finally {
      setLoadingReports((p) => ({ ...p, [orderId]: false }));
    }
  };

  const handleSubmit = async () => {
    if (!form.bodyPart.trim() || !form.indication.trim()) {
      onError("Body part and indication are required.");
      return;
    }
    if (!form.assignedTo) {
      onError("Please assign a radiologist.");
      return;
    }
    setSubmitting(true);
    try {
      await visitApi.orderImaging(visitId, form);
      setForm({
        modality: "x-ray",
        bodyPart: "",
        indication: "",
        urgency: "routine",
        assignedTo: "",
      });
      setShowForm(false);
      onSaved();
    } catch (err: any) {
      onError(err.response?.data?.error?.message ?? "Failed to order imaging.");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedRadio = radiologists.find((r) => r.id === form.assignedTo);

  return (
    <div
      className="p-5 space-y-4"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {imagingOrders.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2.5 px-0.5">
            Imaging Orders ({imagingOrders.length})
          </p>
          <div className="space-y-2.5">
            {imagingOrders.map((order: any) => (
              <ImagingOrderCard
                key={order.id}
                order={order}
                onOpen={() => fetchReport(order.id)}
                report={reports[order.id]}
                isLoading={!!loadingReports[order.id]}
              />
            ))}
          </div>
        </div>
      )}

      {!isCompleted &&
        (!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-gray-200 text-sm font-semibold text-gray-400 hover:border-purple-300 hover:text-purple-600 hover:bg-purple-50/40 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            Order Imaging Study
          </button>
        ) : (
          <div className="rounded-2xl border border-purple-100 overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-purple-50 to-white border-b border-purple-100">
              <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                <Scan className="w-4 h-4 text-purple-700" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">
                  Order Imaging Study
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Select modality and assign a radiologist
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
              {/* Modality visual picker */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Modality *
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {MODALITIES.map((m) => {
                    const mc = MODALITY_COLOR[m] ?? {
                      color: "#6b7280",
                      bg: "#f9fafb",
                    };
                    const selected = form.modality === m;
                    return (
                      <button
                        key={m}
                        onClick={() => f("modality")(m)}
                        className="py-2 px-2 rounded-xl border text-center transition-all text-xs font-semibold capitalize"
                        style={
                          selected
                            ? {
                                background: mc.bg,
                                borderColor: mc.color,
                                color: mc.color,
                              }
                            : {
                                background: "#fafafa",
                                borderColor: "#e5e7eb",
                                color: "#9ca3af",
                              }
                        }
                      >
                        {m.replace(/_/g, " ")}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FieldGroup label="Body Part *">
                  <InputField
                    value={form.bodyPart}
                    onChange={f("bodyPart")}
                    placeholder="e.g. Chest"
                  />
                </FieldGroup>
                <FieldGroup label="Urgency">
                  <SelectField
                    value={form.urgency}
                    onChange={f("urgency")}
                    options={[
                      { value: "routine", label: "Routine" },
                      { value: "urgent", label: "Urgent" },
                      { value: "emergency", label: "Emergency" },
                      { value: "critical", label: "Critical" },
                    ]}
                  />
                </FieldGroup>
              </div>

              <FieldGroup label="Clinical Indication *">
                <TextArea
                  value={form.indication}
                  onChange={f("indication")}
                  placeholder="Clinical history and reason for imaging…"
                  rows={3}
                />
              </FieldGroup>

              <FieldGroup label="Assign Radiologist *">
                <StaffDropdown
                  value={form.assignedTo}
                  onChange={f("assignedTo")}
                  staff={radiologists}
                  loading={radiosLoading}
                  placeholder="Select a radiologist…"
                />
                {selectedRadio?.lastSeenAt && (
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                    Online {safeDistanceToNow(selectedRadio.lastSeenAt)}
                    {selectedRadio.specialization &&
                      ` · ${selectedRadio.specialization}`}
                  </p>
                )}
              </FieldGroup>

              <div className="flex justify-end pt-3 border-t border-gray-100">
                <SubmitBtn
                  onClick={handleSubmit}
                  loading={submitting}
                  label="Submit Imaging Order"
                />
              </div>
            </div>
          </div>
        ))}

      {imagingOrders.length === 0 && isCompleted && (
        <div className="flex flex-col items-center gap-2 py-10 rounded-2xl border border-dashed border-gray-200 bg-gray-50/60">
          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
            <Scan className="w-5 h-5 text-gray-300" />
          </div>
          <p className="text-sm font-semibold text-gray-400">
            No imaging orders
          </p>
        </div>
      )}
    </div>
  );
}
