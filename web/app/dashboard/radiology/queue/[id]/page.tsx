"use client";
import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, visitApi, permissionApi } from "@/lib/api";
import {
  Scan,
  ChevronLeft,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Clock,
  ClipboardList,
  Calendar,
  Shield,
  Mail,
  X,
  Upload,
  Save,
  RefreshCw,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import {
  Page,
  Card,
  CardHeader,
  Field,
  Textarea,
  Button,
  Pill as Badge,
  Banner,
  Toast,
  SectionLabel,
  LinkAction,
  TONES,
} from "@/components/dashboard/ui";
import { getUrgency, getModality } from "../../vocab";

/* ==========================================================================
   Radiology report.

   Two screens in one route. Reporting on a study requires the patient's
   blockchain consent, so PermissionGate stands in front of the form until
   access is granted — checking first, then offering a request, then polling
   until the patient responds.

   The form itself is straightforward: findings + impression are mandatory,
   recommendations optional, and images upload alongside as multipart.
   ========================================================================== */

/* Boilerplate for a normal study, per modality. Radiologists start from these
   and edit — faster than typing "unremarkable" six different ways. */
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
  if (!dateStr) return "unknown";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "unknown";
  return formatDistanceToNow(d, { addSuffix: true });
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

/** Centred single-message panel used by the gate's terminal states. */
function GatePanel({
  icon: Icon,
  tone,
  title,
  message,
  action,
}: {
  icon: React.ElementType;
  tone: "brand" | "info" | "critical" | "neutral" | "accent";
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  const t = TONES[tone];
  return (
    <div style={{ maxWidth: 440, margin: "40px auto 0" }}>
      <Card pad={28}>
        <div className="flex flex-col items-center text-center" style={{ gap: 12 }}>
          <span
            className="inline-flex items-center justify-center"
            style={{
              width: 48,
              height: 48,
              borderRadius: "var(--r-sm)",
              background: t.tint,
              color: t.ink,
            }}
          >
            <Icon className="w-5 h-5" />
          </span>
          <p
            style={{
              margin: 0,
              font: "700 15px/1.2 var(--font-sans)",
              color: "var(--text-primary)",
            }}
          >
            {title}
          </p>
          <p
            style={{
              margin: 0,
              font: "400 13px/1.5 var(--font-sans)",
              color: "var(--text-secondary)",
            }}
          >
            {message}
          </p>
          {action && <div style={{ marginTop: 6 }}>{action}</div>}
        </div>
      </Card>
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
        // A failed check is not a denial — let them ask.
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
      // 409 means a request is already outstanding — go straight to waiting.
      if (err.response?.status === 409) {
        setStatus("pending");
      } else {
        setError(msg || "Failed to send request. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "checking") {
    return (
      <div
        className="flex flex-col items-center justify-center"
        style={{ minHeight: 256, gap: 12 }}
      >
        <Loader2 className="w-7 h-7 animate-spin" style={{ color: "var(--brand)" }} />
        <p
          style={{
            margin: 0,
            font: "400 13px/1 var(--font-sans)",
            color: "var(--text-muted)",
          }}
        >
          Checking access permission…
        </p>
      </div>
    );
  }

  if (status === "requesting") {
    return (
      <div style={{ maxWidth: 480, margin: "32px auto 0" }}>
        <Card>
          <CardHeader
            icon={Shield}
            title="Patient consent required"
            subtitle="Request access to submit a radiology report"
            tone="accent"
          />
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            <p
              style={{
                margin: 0,
                font: "400 13px/1.5 var(--font-sans)",
                color: "var(--text-secondary)",
              }}
            >
              You need the patient's approval before accessing their imaging records.
              A notification will be sent to them immediately.
            </p>

            <Field label="Reason for access" required>
              <Textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. I need to review and report on the MRI study for this patient's ongoing neurological assessment."
              />
            </Field>

            {error && (
              <Banner tone="critical" icon={AlertTriangle}>
                {error}
              </Banner>
            )}

            <Button
              variant="primary"
              full
              size="lg"
              icon={Mail}
              loading={submitting}
              disabled={!reason.trim()}
              onClick={handleRequest}
            >
              {submitting ? "Sending request…" : "Request patient approval"}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div style={{ maxWidth: 480, margin: "32px auto 0" }}>
        <Card>
          <CardHeader
            icon={Mail}
            title="Waiting for patient approval"
            subtitle="Notification sent to the patient's device"
            tone="info"
          />
          <div
            className="flex flex-col items-center text-center"
            style={{ padding: 24, gap: 14 }}
          >
            <p
              style={{
                margin: 0,
                font: "400 13px/1.5 var(--font-sans)",
                color: "var(--text-secondary)",
              }}
            >
              The patient has been notified. This page updates automatically once
              they respond.
            </p>
            <span
              className="inline-flex items-center"
              style={{
                gap: 7,
                font: "400 11.5px/1 var(--font-mono)",
                color: "var(--text-muted)",
              }}
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Checking… {pollCount * 4}s elapsed
            </span>
            <p
              style={{
                margin: 0,
                font: "400 11.5px/1.4 var(--font-sans)",
                color: "var(--text-muted)",
              }}
            >
              You can leave this page — the request stays pending.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (status === "rejected") {
    return (
      <GatePanel
        icon={X}
        tone="critical"
        title="Access denied"
        message="The patient has declined your access request. Speak with them directly, or contact the attending practitioner."
        action={
          <LinkAction arrow={false} onClick={() => setStatus("requesting")}>
            Send a new request
          </LinkAction>
        }
      />
    );
  }

  if (status === "expired") {
    return (
      <GatePanel
        icon={Clock}
        tone="neutral"
        title="Request expired"
        message="The patient did not respond in time. You can send a new request."
        action={
          <Button
            variant="primary"
            icon={RefreshCw}
            onClick={() => {
              setStatus("requesting");
              setReason("");
              setRequestId(null);
              setPollCount(0);
            }}
          >
            Try again
          </Button>
        }
      />
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

        // An existing draft wins over the template — never overwrite work.
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
    setImagePreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
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
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      showToast("Report submitted successfully.", "success");
      // Let the toast land before navigating away.
      setTimeout(() => router.push("/dashboard/radiology/queue"), 1500);
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? "Failed to submit report.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div
        className="flex flex-col items-center justify-center"
        style={{ minHeight: 256, gap: 12 }}
      >
        <Loader2 className="w-7 h-7 animate-spin" style={{ color: "var(--brand)" }} />
        <p
          style={{
            margin: 0,
            font: "400 13px/1 var(--font-sans)",
            color: "var(--text-muted)",
          }}
        >
          Loading study…
        </p>
      </div>
    );
  }

  if (!order) {
    return (
      <Page maxWidth={520}>
        <GatePanel
          icon={Scan}
          tone="neutral"
          title="Study not found"
          message="This study may have already been reported, or it no longer exists."
          action={
            <LinkAction
              arrow={false}
              onClick={() => router.push("/dashboard/radiology/queue")}
            >
              Back to worklist
            </LinkAction>
          }
        />
      </Page>
    );
  }

  const urgency = getUrgency(order.urgency);
  const modality = getModality(order.modality);
  const uTone = TONES[urgency.tone];
  const mTone = TONES[modality.tone];
  const existingImages = report?.imageUrls || [];

  const backButton = (
    <Button
      variant="ghost"
      icon={ChevronLeft}
      onClick={() => router.push("/dashboard/radiology/queue")}
      style={{ alignSelf: "flex-start" }}
    >
      Back to worklist
    </Button>
  );

  // ── PERMISSION GATE — shown until patient approves ──
  if (!hasPermission) {
    return (
      <Page maxWidth={900}>
        {backButton}

        {/* Compact study header while waiting */}
        <Card pad={16}>
          <div className="flex items-center" style={{ gap: 14 }}>
            <span
              className="inline-flex items-center justify-center flex-shrink-0"
              style={{
                width: 44,
                height: 44,
                borderRadius: "var(--r-sm)",
                background: mTone.tint,
                color: mTone.ink,
              }}
            >
              <Scan className="w-5 h-5" />
            </span>
            <div className="flex-1 min-w-0 flex flex-col" style={{ gap: 4 }}>
              <p
                style={{
                  margin: 0,
                  font: "700 14px/1.2 var(--font-sans)",
                  color: "var(--text-primary)",
                }}
              >
                {modality.label}
                {order.bodyPart ? ` — ${order.bodyPart}` : ""}
              </p>
              <p
                style={{
                  margin: 0,
                  font: "400 11.5px/1 var(--font-mono)",
                  color: "var(--text-muted)",
                }}
              >
                {order.orderNumber} · {order.visitNumber}
              </p>
            </div>
            <Badge tone={urgency.tone}>{urgency.label}</Badge>
          </div>
        </Card>

        <PermissionGate order={order} onGranted={() => setHasPermission(true)} />
      </Page>
    );
  }

  // ── FULL REPORT FORM — shown after permission granted ──
  return (
    <Page maxWidth={820}>
      {toast && (
        <Toast
          message={toast.message}
          icon={toast.type === "success" ? CheckCircle2 : AlertTriangle}
          tone={toast.type === "success" ? "success" : "critical"}
        />
      )}

      {backButton}

      {/* Study header */}
      <Card style={{ borderTop: `3px solid ${uTone.dot}` }}>
        <div style={{ padding: 20 }}>
          <div className="flex items-start" style={{ gap: 16 }}>
            <span
              className="inline-flex items-center justify-center flex-shrink-0"
              style={{
                width: 52,
                height: 52,
                borderRadius: "var(--r-md)",
                background: mTone.tint,
                color: mTone.ink,
              }}
            >
              <Scan className="w-6 h-6" />
            </span>

            <div className="flex-1 min-w-0 flex flex-col" style={{ gap: 7 }}>
              <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
                <h1
                  style={{
                    margin: 0,
                    font: "700 20px/1.2 var(--font-sans)",
                    letterSpacing: "var(--ls-tight)",
                    color: "var(--text-primary)",
                  }}
                >
                  {modality.label}
                  {order.bodyPart ? ` — ${order.bodyPart}` : ""}
                </h1>
                <Badge tone={urgency.tone}>{urgency.label}</Badge>
                <Badge tone="success" icon={CheckCircle2}>
                  Access granted
                </Badge>
              </div>
              <p
                style={{
                  margin: 0,
                  font: "400 12.5px/1 var(--font-mono)",
                  color: "var(--text-secondary)",
                }}
              >
                {order.orderNumber} · {order.visitNumber}
              </p>
            </div>
          </div>

          {/* Meta strip */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 16,
              marginTop: 20,
              paddingTop: 20,
              borderTop: "1px solid var(--border-faint)",
            }}
          >
            {[
              { icon: Clock, label: "Ordered", value: safeDateDistance(order.orderedAt) },
              { icon: Scan, label: "Modality", value: modality.label },
              ...(order.scheduledDateTime
                ? [
                    {
                      icon: Calendar,
                      label: "Scheduled",
                      value: format(new Date(order.scheduledDateTime), "dd MMM, HH:mm"),
                    },
                  ]
                : []),
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center" style={{ gap: 10 }}>
                <span
                  className="inline-flex items-center justify-center flex-shrink-0"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "var(--r-xs)",
                    background: "var(--surface-sunken)",
                    color: "var(--text-muted)",
                  }}
                >
                  <Icon className="w-3.5 h-3.5" />
                </span>
                <div className="min-w-0 flex flex-col" style={{ gap: 4 }}>
                  <span
                    style={{
                      font: "400 11.5px/1 var(--font-sans)",
                      color: "var(--text-muted)",
                    }}
                  >
                    {label}
                  </span>
                  <span
                    className="truncate"
                    style={{
                      font: "600 13px/1 var(--font-sans)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {value}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {order.indication && (
            <div style={{ marginTop: 16 }}>
              <Banner tone="info" icon={ClipboardList} title="Clinical indication">
                {order.indication}
              </Banner>
            </div>
          )}
          {order.chiefComplaint && (
            <div style={{ marginTop: 12 }}>
              <Banner tone="urgent" icon={ClipboardList} title="Chief complaint">
                {order.chiefComplaint}
              </Banner>
            </div>
          )}
        </div>
      </Card>

      {/* Image upload */}
      <Card>
        <CardHeader
          icon={Upload}
          title="Study images"
          right={
            <label
              className="inline-flex items-center"
              style={{
                gap: 7,
                height: 30,
                padding: "0 11px",
                borderRadius: "var(--r-sm)",
                border: "1px solid var(--hc-border)",
                background: "var(--surface-card)",
                color: "var(--text-primary)",
                font: "600 12px/1 var(--font-sans)",
                cursor: "pointer",
                boxShadow: "var(--elev-1)",
              }}
            >
              <Upload className="w-3.5 h-3.5" />
              Select images
              <input
                type="file"
                multiple
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleFileSelect}
              />
            </label>
          }
        />

        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          {existingImages.length === 0 && imagePreviews.length === 0 && (
            <p
              style={{
                margin: 0,
                font: "400 12.5px/1 var(--font-sans)",
                color: "var(--text-muted)",
              }}
            >
              No images attached to this study yet.
            </p>
          )}

          {existingImages.length > 0 && (
            <div className="flex flex-col" style={{ gap: 8 }}>
              <SectionLabel>Existing images</SectionLabel>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                  gap: 8,
                }}
              >
                {existingImages.map((url: string, idx: number) => (
                  <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                    <img
                      src={url}
                      alt={`Study ${idx + 1}`}
                      style={{
                        width: "100%",
                        height: 96,
                        objectFit: "cover",
                        borderRadius: "var(--r-xs)",
                        border: "1px solid var(--hc-border)",
                      }}
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

          {imagePreviews.length > 0 && (
            <div className="flex flex-col" style={{ gap: 8 }}>
              <SectionLabel>New images to upload</SectionLabel>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                  gap: 8,
                }}
              >
                {imagePreviews.map((preview, idx) => (
                  <div key={idx} className="relative">
                    <img
                      src={preview}
                      alt={`Preview ${idx + 1}`}
                      style={{
                        width: "100%",
                        height: 96,
                        objectFit: "cover",
                        borderRadius: "var(--r-xs)",
                        border: "1px solid var(--hc-border)",
                      }}
                    />
                    <button
                      onClick={() => removeImage(idx)}
                      className="absolute inline-flex items-center justify-center"
                      style={{
                        top: -6,
                        right: -6,
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        border: "none",
                        background: "var(--coral-500)",
                        color: "var(--white)",
                        boxShadow: "var(--elev-2)",
                        cursor: "pointer",
                      }}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Templates */}
      <Card pad={16}>
        <SectionLabel style={{ marginBottom: 10 }}>Normal report templates</SectionLabel>
        <div className="flex flex-wrap" style={{ gap: 8 }}>
          {Object.keys(FINDINGS_TEMPLATES).map((m) => {
            const cfg = getModality(m);
            const t = TONES[cfg.tone];
            return (
              <button
                key={m}
                onClick={() => applyTemplate(m)}
                style={{
                  height: 30,
                  padding: "0 12px",
                  borderRadius: "var(--r-sm)",
                  border: "1px solid transparent",
                  background: t.tint,
                  color: t.ink,
                  font: "600 12px/1 var(--font-sans)",
                  cursor: "pointer",
                  transition: "all var(--dur-fast) var(--ease-standard)",
                }}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>
        <p
          style={{
            margin: "10px 0 0",
            font: "400 11.5px/1.4 var(--font-sans)",
            color: "var(--text-muted)",
          }}
        >
          Templates fill in a normal study. Edit as needed — they replace whatever is
          currently in findings and impression.
        </p>
      </Card>

      {/* Report form */}
      <Card>
        <CardHeader icon={Save} title="Radiology report" />
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
          <Field
            label="Findings"
            required
            hint={`${findings.length} characters`}
          >
            <Textarea
              rows={6}
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
              placeholder="Describe the imaging findings in detail…"
              style={{ minHeight: 150 }}
            />
          </Field>

          <Field label="Impression" required>
            <Textarea
              rows={3}
              value={impression}
              onChange={(e) => setImpression(e.target.value)}
              placeholder="Concise summary of the most significant findings and diagnosis…"
            />
          </Field>

          <Field label="Recommendations" hint="Optional">
            <Textarea
              rows={2}
              value={recommendations}
              onChange={(e) => setRecommendations(e.target.value)}
              placeholder="Suggest follow-up imaging, clinical correlation, or further investigations…"
              style={{ minHeight: 68 }}
            />
          </Field>

          {error && (
            <Banner tone="critical" icon={AlertTriangle}>
              {error}
            </Banner>
          )}

          <div
            className="flex items-center justify-between"
            style={{
              gap: 12,
              paddingTop: 16,
              borderTop: "1px solid var(--border-faint)",
            }}
          >
            <Button onClick={() => router.push("/dashboard/radiology/queue")}>
              Cancel
            </Button>
            <Button
              variant="primary"
              icon={Save}
              loading={submitting}
              disabled={!findings.trim() || !impression.trim()}
              onClick={handleSubmit}
            >
              {submitting ? "Submitting…" : "Submit report"}
            </Button>
          </div>
        </div>
      </Card>
    </Page>
  );
}
