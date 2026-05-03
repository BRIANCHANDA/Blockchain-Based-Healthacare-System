"use client";
import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, permissionApi, visitApi } from "@/lib/api";
import {
  Scan,
  ChevronLeft,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Save,
  Clock,
  ClipboardList,
  Calendar,
  Upload,
  X,
  Shield,
  Mail,
  RefreshCw,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

// ── Constants ──────────────────────────────────────────────────────────────
const URGENCY_CONFIG: Record<
  string,
  { color: string; bg: string; label: string }
> = {
  critical: { color: "#6D28D9", bg: "#EDE9FE", label: "Critical" },
  emergency: { color: "#C0392B", bg: "#FDECEA", label: "Emergency" },
  urgent: { color: "#C9952A", bg: "#FDF3DC", label: "Urgent" },
  routine: { color: "#0A6640", bg: "#E6F4EE", label: "Routine" },
};

const MODALITY_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  "x-ray": { label: "X-Ray", color: "#1A6B8A", bg: "#E3F2F8" },
  ct_scan: { label: "CT Scan", color: "#6D28D9", bg: "#EDE9FE" },
  mri: { label: "MRI", color: "#C9952A", bg: "#FDF3DC" },
  ultrasound: { label: "Ultrasound", color: "#0A6640", bg: "#E6F4EE" },
  pet_scan: { label: "PET Scan", color: "#C0392B", bg: "#FDECEA" },
  mammogram: { label: "Mammogram", color: "#047857", bg: "#ECFDF5" },
  fluoroscopy: { label: "Fluoroscopy", color: "#374151", bg: "#F3F4F6" },
};

const FINDINGS_TEMPLATES: Record<
  string,
  { findings: string; impression: string }
> = {
  "x-ray": {
    findings:
      "The cardiac silhouette is of normal size and contour. The lung fields are clear with no consolidation, effusion, or pneumothorax identified. The mediastinal contours are within normal limits. The bony thorax is intact.",
    impression: "Normal chest X-ray. No acute cardiopulmonary abnormality.",
  },
  ct_scan: {
    findings:
      "No acute intracranial hemorrhage, mass effect, or midline shift. The ventricles and sulci are of normal size and configuration. No abnormal enhancement. The visualized osseous structures are unremarkable.",
    impression: "No acute intracranial abnormality identified.",
  },
  ultrasound: {
    findings:
      "The liver is normal in size and echogenicity with no focal lesions. The gallbladder is normal with no gallstones or wall thickening. The common bile duct is not dilated. The pancreas, spleen, and kidneys appear normal.",
    impression: "Normal abdominal ultrasound.",
  },
  mri: {
    findings:
      "No acute infarction or hemorrhage. No abnormal signal intensity or enhancement. The ventricles and sulci are normal in size. The cerebral cortex and white matter appear normal. No mass effect or midline shift.",
    impression: "No acute intracranial pathology identified on MRI.",
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────
function safeDateDistance(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? "—" : formatDistanceToNow(d, { addSuffix: true });
}

function normalizeOrder(o: any) {
  return {
    ...o,
    visitId: o.visitId ?? o.visit_id ?? "",
    orderNumber: o.orderNumber ?? o.order_number ?? "",
    bodyPart: o.bodyPart ?? o.body_part ?? "",
    orderedAt: o.orderedAt ?? o.ordered_at ?? null,
    visitNumber: o.visitNumber ?? o.visit_number ?? "",
    chiefComplaint: o.chiefComplaint ?? o.chief_complaint ?? "",
    patientId: o.patientId ?? o.patient_id ?? "",
  };
}

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

// ── Permission Gate ────────────────────────────────────────────────────────
type PermStatus =
  | "checking"
  | "granted"
  | "requesting"
  | "pending"
  | "rejected"
  | "expired"
  | "error";

function PermissionGate({
  order,
  onGranted,
}: {
  order: any;
  onGranted: () => void;
}) {
  const [status, setStatus] = useState<PermStatus>("checking");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [pollCount, setPollCount] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  // Step 1: Check if permission already exists
  useEffect(() => {
    const check = async () => {
      try {
        const res = await visitApi.checkMyPermission(order.visitId);
        if (res.data?.data?.hasPermission) {
          setStatus("granted");
          onGranted();
        } else {
          setStatus("requesting");
        }
      } catch {
        setStatus("requesting");
      }
    };
    check();
    return stopPolling;
  }, []);

  // Step 3: Poll for approval once request is sent
  useEffect(() => {
    if (status !== "pending" || !requestId) return;
    stopPolling();
    pollRef.current = setInterval(async () => {
      setPollCount((c) => c + 1);
      try {
        // Poll request status
        const res = await permissionApi.getRequestStatus(requestId);
        const reqStatus = res.data?.data?.status;
        if (reqStatus === "approved") {
          stopPolling();
          setStatus("granted");
          onGranted();
        } else if (reqStatus === "rejected") {
          stopPolling();
          setStatus("rejected");
        } else if (reqStatus === "expired") {
          stopPolling();
          setStatus("expired");
        }
      } catch {
        /* keep polling */
      }
    }, 4000);
    return stopPolling;
  }, [status, requestId]);

  // Step 2: Send access request
  const handleRequest = async () => {
    if (!reason.trim()) {
      setError("Please provide a reason for access.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await permissionApi.requestAccess({
        patientId: order.patientId,
        visitId: order.visitId,
        reason: reason.trim(),
        requestedPermissions: ["imaging_report:write", "records:read"],
      });
      setRequestId(res.data.data.requestId);
      setStatus("pending");
      setPollCount(0);
    } catch (err: any) {
      const msg = err.response?.data?.error?.message;
      // If duplicate pending request, start polling on the existing one
      if (err.response?.status === 409) {
        setStatus("pending");
      } else {
        setError(msg || "Failed to send request. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Checking
  if (status === "checking") {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 gap-3">
        <Loader2 size={28} className="animate-spin text-green-700" />
        <p className="text-sm text-gray-400">Checking access permission…</p>
      </div>
    );
  }

  // Requesting — show form
  if (status === "requesting") {
    return (
      <div
        className="max-w-md mx-auto mt-10"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div
            className="px-6 py-5 border-b border-gray-100 flex items-center gap-3"
            style={{ background: "linear-gradient(135deg,#faf5ff,#f3e8ff)" }}
          >
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
              <Shield size={18} className="text-purple-700" />
            </div>
            <div>
              <p className="font-bold text-gray-900">
                Patient Consent Required
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Request access to submit a radiology report
              </p>
            </div>
          </div>
          <div className="px-6 py-5">
            <p className="text-sm text-gray-600 mb-4">
              You need the patient's approval before accessing their imaging
              records. A notification will be sent to them immediately.
            </p>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Reason for access <span className="text-red-400">*</span>
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. I need to review and report on the MRI study for this patient's ongoing neurological assessment."
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none
                  focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 focus:bg-white resize-none transition-all placeholder:text-gray-400"
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700 mb-4">
                <AlertTriangle size={13} /> {error}
              </div>
            )}
            <button
              onClick={handleRequest}
              disabled={submitting || !reason.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all hover:shadow-md"
              style={{ background: "linear-gradient(135deg,#6d28d9,#7c3aed)" }}
            >
              {submitting ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Mail size={15} />
              )}
              {submitting ? "Sending request…" : "Request Patient Approval"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Pending — waiting for patient
  if (status === "pending") {
    return (
      <div
        className="max-w-md mx-auto mt-10"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        <div className="bg-white rounded-2xl border border-blue-100 shadow-sm overflow-hidden">
          <div
            className="px-6 py-5 border-b border-blue-50 flex items-center gap-3"
            style={{ background: "linear-gradient(135deg,#eff6ff,#dbeafe)" }}
          >
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Mail size={18} className="text-blue-700" />
            </div>
            <div>
              <p className="font-bold text-gray-900">
                Waiting for Patient Approval
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Notification sent to patient's device
              </p>
            </div>
          </div>
          <div className="px-6 py-5 text-center">
            <p className="text-sm text-gray-600 mb-6">
              The patient has been notified. This page will automatically update
              once they respond.
            </p>
            <div className="flex items-center justify-center gap-2 text-xs text-gray-400 mb-2">
              <Loader2 size={13} className="animate-spin" />
              Checking for response… ({pollCount * 4}s elapsed)
            </div>
            <p className="text-xs text-gray-400">
              You can leave this page — the request will remain pending.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Rejected
  if (status === "rejected") {
    return (
      <div
        className="max-w-md mx-auto mt-10"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
            <X size={20} className="text-red-500" />
          </div>
          <p className="font-bold text-gray-900 mb-1">Access Denied</p>
          <p className="text-sm text-gray-500 mb-5">
            The patient has declined your access request. Please speak with them
            directly or contact the attending practitioner.
          </p>
          <button
            onClick={() => setStatus("requesting")}
            className="text-sm font-semibold text-purple-700 hover:underline"
          >
            Send a new request
          </button>
        </div>
      </div>
    );
  }

  // Expired
  if (status === "expired") {
    return (
      <div
        className="max-w-md mx-auto mt-10"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <Clock size={20} className="text-gray-400" />
          </div>
          <p className="font-bold text-gray-900 mb-1">Request Expired</p>
          <p className="text-sm text-gray-500 mb-5">
            The patient did not respond in time. You can send a new request.
          </p>
          <button
            onClick={() => {
              setStatus("requesting");
              setReason("");
              setRequestId(null);
              setPollCount(0);
            }}
            className="flex items-center gap-2 mx-auto px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg,#6d28d9,#7c3aed)" }}
          >
            <RefreshCw size={14} /> Try Again
          </button>
        </div>
      </div>
    );
  }

  return null;
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function RadiologyOrderDetailPage() {
  const { id: orderId } = useParams<{ id: string }>();
  const router = useRouter();

  const [order, setOrder] = useState<any>(null);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [error, setError] = useState("");

  const [findings, setFindings] = useState("");
  const [impression, setImpression] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Load order data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [ordersRes, reportRes] = await Promise.all([
          api.get("/api/visits/imaging-orders/pending"),
          api
            .get(`/api/visits/imaging-orders/${orderId}/report`)
            .catch(() => ({ data: { data: null } })),
        ]);
        const found = (ordersRes.data.data?.orders ?? []).find(
          (o: any) => o.id === orderId,
        );
        const normalizedOrder = found ? normalizeOrder(found) : null;
        setOrder(normalizedOrder);
        const reportData = reportRes.data.data;
        setReport(reportData);
        if (reportData) {
          if (reportData.findings) setFindings(reportData.findings);
          if (reportData.impression) setImpression(reportData.impression);
          if (reportData.recommendations)
            setRecommendations(reportData.recommendations);
        } else if (
          normalizedOrder?.modality &&
          FINDINGS_TEMPLATES[normalizedOrder.modality]
        ) {
          const tpl = FINDINGS_TEMPLATES[normalizedOrder.modality];
          setFindings(tpl.findings);
          setImpression(tpl.impression);
        }
      } catch {
        setOrder(null);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [orderId]);

  const applyTemplate = (modality: string) => {
    const tpl = FINDINGS_TEMPLATES[modality];
    if (tpl) {
      setFindings(tpl.findings);
      setImpression(tpl.impression);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles((prev) => [...prev, ...files]);
    setImagePreviews((prev) => [
      ...prev,
      ...files.map((f) => URL.createObjectURL(f)),
    ]);
  };

  const removeImage = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    URL.revokeObjectURL(imagePreviews[index]);
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!findings.trim()) {
      setError("Findings are required.");
      return;
    }
    if (!impression.trim()) {
      setError("Impression is required.");
      return;
    }
    if (!order) return;
    setSubmitting(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("findings", findings.trim());
      formData.append("impression", impression.trim());
      if (recommendations.trim())
        formData.append("recommendations", recommendations.trim());
      selectedFiles.forEach((file) => formData.append("images", file));
      await api.post(
        `/api/visits/${order.visitId}/imaging-report/${order.id}`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );
      showToast("Report submitted successfully.", "success");
      setTimeout(() => router.push("/dashboard/radiology/queue"), 1500);
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ?? "Failed to submit report.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 gap-3">
        <Loader2 size={28} className="animate-spin text-green-700" />
        <p className="text-sm text-gray-400">Loading study…</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <Scan size={28} className="text-gray-400" />
        </div>
        <p className="text-gray-700 font-semibold mb-1">Study not found</p>
        <p className="text-gray-400 text-sm mb-4">
          This study may have already been reported or doesn't exist.
        </p>
        <button
          onClick={() => router.push("/dashboard/radiology/queue")}
          className="text-green-700 text-sm font-medium hover:underline"
        >
          ← Back to worklist
        </button>
      </div>
    );
  }

  const urgency = URGENCY_CONFIG[order.urgency] ?? URGENCY_CONFIG.routine;
  const modality = MODALITY_CONFIG[order.modality] ?? {
    label: order.modality,
    color: "#374151",
    bg: "#F3F4F6",
  };
  const existingImages = report?.imageUrls || [];

  // ── PERMISSION GATE — shown until patient approves ──
  if (!hasPermission) {
    return (
      <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <button
          onClick={() => router.push("/dashboard/radiology/queue")}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors mb-6"
        >
          <ChevronLeft size={16} /> Back to Worklist
        </button>

        {/* Compact study header while waiting */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6 flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: modality.bg }}
          >
            <Scan size={22} style={{ color: modality.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900">
              {modality.label} — {order.bodyPart}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {order.orderNumber} · {order.visitNumber}
            </p>
          </div>
          <span
            className="text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0"
            style={{ background: urgency.bg, color: urgency.color }}
          >
            {urgency.label}
          </span>
        </div>

        <PermissionGate
          order={order}
          onGranted={() => setHasPermission(true)}
        />
      </div>
    );
  }

  // ── FULL REPORT FORM — shown after permission granted ──
  return (
    <div
      className="max-w-3xl mx-auto space-y-5"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {toast && <Toast message={toast.message} type={toast.type} />}

      <button
        onClick={() => router.push("/dashboard/radiology/queue")}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ChevronLeft size={16} /> Back to Worklist
      </button>

      {/* Study header */}
      <div
        className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
        style={{ borderTop: `4px solid ${urgency.color}` }}
      >
        <div className="p-5">
          <div className="flex items-start gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: modality.bg }}
            >
              <Scan size={26} style={{ color: modality.color }} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-xl font-bold text-gray-900">
                  {modality.label} — {order.bodyPart}
                </h1>
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: urgency.bg, color: urgency.color }}
                >
                  {urgency.label}
                </span>
                {/* Permission granted badge */}
                <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-100">
                  <CheckCircle2 size={11} /> Access Granted
                </span>
              </div>
              <p className="text-sm text-gray-500">
                {order.orderNumber} · {order.visitNumber}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-gray-50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
                <Clock size={14} className="text-gray-500" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Ordered</p>
                <p className="text-sm font-semibold text-gray-800">
                  {safeDateDistance(order.orderedAt)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
                <Scan size={14} className="text-gray-500" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Modality</p>
                <p className="text-sm font-semibold text-gray-800">
                  {modality.label}
                </p>
              </div>
            </div>
            {order.scheduledDateTime && (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
                  <Calendar size={14} className="text-gray-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Scheduled</p>
                  <p className="text-sm font-semibold text-gray-800">
                    {format(new Date(order.scheduledDateTime), "dd MMM, HH:mm")}
                  </p>
                </div>
              </div>
            )}
          </div>

          {order.indication && (
            <div className="mt-4 flex items-start gap-2.5 p-3 rounded-xl bg-blue-50 border border-blue-100">
              <ClipboardList
                size={14}
                className="text-blue-500 mt-0.5 flex-shrink-0"
              />
              <div>
                <p className="text-xs font-semibold text-blue-700 mb-0.5">
                  Clinical Indication
                </p>
                <p className="text-sm text-blue-800">{order.indication}</p>
              </div>
            </div>
          )}
          {order.chiefComplaint && (
            <div className="mt-3 flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-100">
              <ClipboardList
                size={14}
                className="text-amber-500 mt-0.5 flex-shrink-0"
              />
              <div>
                <p className="text-xs font-semibold text-amber-700 mb-0.5">
                  Chief Complaint
                </p>
                <p className="text-sm text-amber-800">{order.chiefComplaint}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Image upload */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-gray-800">Study Images</p>
          <label
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-white cursor-pointer hover:shadow-md transition-all"
            style={{ background: "linear-gradient(135deg,#0A6640,#15803d)" }}
          >
            <Upload size={14} /> Select Images
            <input
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
          </label>
        </div>
        {existingImages.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 mb-2">
              Existing Images
            </p>
            <div className="grid grid-cols-3 gap-2">
              {existingImages.map((url: string, idx: number) => (
                <a
                  key={idx}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img
                    src={url}
                    alt={`Study ${idx + 1}`}
                    className="w-full h-24 object-cover rounded-lg border border-gray-200"
                  />
                </a>
              ))}
            </div>
          </div>
        )}
        {imagePreviews.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 mb-2">
              New Images to Upload
            </p>
            <div className="grid grid-cols-3 gap-2">
              {imagePreviews.map((preview, idx) => (
                <div key={idx} className="relative group">
                  <img
                    src={preview}
                    alt={`Preview ${idx + 1}`}
                    className="w-full h-24 object-cover rounded-lg border border-gray-200"
                  />
                  <button
                    onClick={() => removeImage(idx)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Templates */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
          Normal Report Templates
        </p>
        <div className="flex gap-2 flex-wrap">
          {Object.keys(FINDINGS_TEMPLATES).map((m) => {
            const cfg = MODALITY_CONFIG[m] ?? {
              label: m,
              color: "#374151",
              bg: "#F3F4F6",
            };
            return (
              <button
                key={m}
                onClick={() => applyTemplate(m)}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all hover:shadow-sm"
                style={{
                  backgroundColor: cfg.bg,
                  color: cfg.color,
                  borderColor: "transparent",
                }}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Templates auto-fill for normal studies. Edit as needed.
        </p>
      </div>

      {/* Report form */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
        <p className="text-sm font-bold text-gray-800">Radiology Report</p>
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">
            Findings <span className="text-red-400">*</span>
          </label>
          <textarea
            rows={6}
            value={findings}
            onChange={(e) => setFindings(e.target.value)}
            placeholder="Describe the imaging findings in detail…"
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none
              focus:border-green-500 focus:ring-2 focus:ring-green-500/10 focus:bg-white resize-none placeholder:text-gray-400 transition-all"
          />
          <p className="text-xs text-gray-400 mt-1">
            {findings.length} characters
          </p>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">
            Impression <span className="text-red-400">*</span>
          </label>
          <textarea
            rows={3}
            value={impression}
            onChange={(e) => setImpression(e.target.value)}
            placeholder="Concise summary of the most significant findings and diagnosis…"
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none
              focus:border-green-500 focus:ring-2 focus:ring-green-500/10 focus:bg-white resize-none placeholder:text-gray-400 transition-all"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">
            Recommendations{" "}
            <span className="text-gray-300 font-normal normal-case">
              (optional)
            </span>
          </label>
          <textarea
            rows={2}
            value={recommendations}
            onChange={(e) => setRecommendations(e.target.value)}
            placeholder="Suggest follow-up imaging, clinical correlation, or further investigations…"
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none
              focus:border-green-500 focus:ring-2 focus:ring-green-500/10 focus:bg-white resize-none placeholder:text-gray-400 transition-all"
          />
        </div>
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
            <AlertTriangle size={14} /> {error}
          </div>
        )}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <button
            onClick={() => router.push("/dashboard/radiology/queue")}
            className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !findings.trim() || !impression.trim()}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-md disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#0A6640,#15803d)" }}
          >
            {submitting ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Save size={15} />
            )}
            {submitting ? "Submitting…" : "Submit Report"}
          </button>
        </div>
      </div>
    </div>
  );
}
