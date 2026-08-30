import { useState, useEffect } from "react";
import {
  ChevronLeft,
  AlertCircle,
  CheckCircle2,
  Shield,
  Clock,
  XCircle,
  Lock,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { visitApi, permissionApi } from "@/lib/api";
import { FieldGroup } from "../shared/FieldGroup";
import { TextArea } from "../shared/TextArea";
import {
  Card,
  Pill as Badge,
  Button,
  Banner,
  SectionLabel,
  LinkAction,
  TONES,
  type Tone,
} from "@/components/dashboard/ui";

/* ==========================================================================
   Permission gate.

   Stands in front of a visit the doctor has no blockchain consent for. The
   patient approves from their own device, so there is nothing to await —
   the gate polls the request every 3s and gives up after 10 minutes.

   Five stages: form → waiting → approved | rejected | expired.
   ========================================================================== */

/** Centred single-message screen shared by the terminal stages. */
function StageScreen({
  icon: Icon,
  tone,
  title,
  message,
  children,
}: {
  icon: React.ElementType;
  tone: Tone;
  title: string;
  message?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const t = TONES[tone];
  return (
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{ padding: "64px 20px", gap: 16 }}
    >
      <span
        className="inline-flex items-center justify-center"
        style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          background: t.tint,
          color: t.ink,
        }}
      >
        <Icon className="w-9 h-9" />
      </span>
      <div className="flex flex-col" style={{ gap: 6 }}>
        <p
          style={{
            margin: 0,
            font: "700 17px/1.2 var(--font-sans)",
            letterSpacing: "var(--ls-tight)",
            color: "var(--text-primary)",
          }}
        >
          {title}
        </p>
        {message && (
          <p
            style={{
              margin: 0,
              maxWidth: 340,
              font: "400 13px/1.5 var(--font-sans)",
              color: "var(--text-secondary)",
            }}
          >
            {message}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

const PERMISSION_OPTIONS = [
  {
    value: "read",
    label: "View Records",
    desc: "Read consultations, diagnoses, vitals",
  },
  {
    value: "write",
    label: "Write Records",
    desc: "Add consultations, orders, prescriptions",
  },
  {
    value: "lab_results",
    label: "Lab Results",
    desc: "View and receive lab test results",
  },
  {
    value: "imaging",
    label: "Imaging Reports",
    desc: "View radiology orders and reports",
  },
  {
    value: "prescriptions",
    label: "Prescriptions",
    desc: "View and create prescriptions",
  },
];

// ── Permission Gate (unchanged) ────────────────────────────────────────────────
export function PermissionGate({
  visitId,
  patientName,
  onGranted,
  onBack,
}: {
  visitId: string;
  patientName: string;
  onGranted: () => void;
  onBack: () => void;
}) {
  const [stage, setStage] = useState<
    "form" | "waiting" | "approved" | "rejected" | "expired"
  >("form");
  const [selectedPerms, setSelectedPerms] = useState<string[]>([
    "read",
    "write",
  ]);
  const [reason, setReason] = useState("");
  const [requestId, setRequestId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [patientId, setPatientId] = useState("");

  useEffect(() => {
    visitApi
      .getVisitInfo(visitId)
      .then((res) => {
        console.log("visit info response:", res.data);
        setPatientId(res.data.data?.patientId ?? "");
      })
      .catch((err) => console.error("getVisitInfo failed:", err));
  }, [visitId]);

  useEffect(() => {
    if (stage !== "waiting") return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [stage]);

  useEffect(() => {
    if (stage !== "waiting" || !requestId) return;
    const poll = setInterval(async () => {
      try {
        const res = await (permissionApi as any).getRequestStatus(requestId);
        const status = res.data.data?.status;
        if (status === "approved") {
          clearInterval(poll);
          setStage("approved");
          setTimeout(() => onGranted(), 1200);
        } else if (status === "rejected") {
          clearInterval(poll);
          setStage("rejected");
        } else if (status === "expired") {
          clearInterval(poll);
          setStage("expired");
        }
      } catch (_) {}
    }, 3000);
    const expire = setTimeout(() => {
      clearInterval(poll);
      setStage("expired");
    }, 600_000);
    return () => {
      clearInterval(poll);
      clearTimeout(expire);
    };
  }, [stage, requestId, onGranted]);

  const togglePerm = (v: string) =>
    setSelectedPerms((prev) =>
      prev.includes(v) ? prev.filter((p) => p !== v) : [...prev, v],
    );

  const handleSubmit = async () => {
    if (!reason.trim() || reason.trim().length < 10) {
      setSubmitError("Clinical reason must be at least 10 characters.");
      return;
    }
    if (!selectedPerms.length) {
      setSubmitError("Select at least one permission.");
      return;
    }
    if (!patientId) {
      setSubmitError("Could not resolve patient ID. Try refreshing.");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await permissionApi.requestAccess({
        patientId,
        reason: reason.trim(),
        requestedPermissions: selectedPerms,
        visitId,
      });
      setRequestId(res.data.data?.requestId ?? "");
      setStage("waiting");
    } catch (err: any) {
      setSubmitError(err.response?.data?.error?.message ?? "Request failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  if (stage === "approved") {
    return (
      <StageScreen
        icon={CheckCircle2}
        tone="success"
        title="Access granted"
        message="Opening the visit workspace…"
      >
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--brand)" }} />
      </StageScreen>
    );
  }

  if (stage === "rejected") {
    return (
      <StageScreen
        icon={XCircle}
        tone="critical"
        title="Request denied"
        message={`${patientName} declined to grant access to their records.`}
      >
        <div className="flex items-center" style={{ gap: 12 }}>
          <Button onClick={onBack}>Back to queue</Button>
          <Button
            variant="primary"
            icon={Shield}
            onClick={() => {
              setStage("form");
              setReason("");
              setRequestId("");
              setElapsed(0);
            }}
          >
            Request again
          </Button>
        </div>
      </StageScreen>
    );
  }

  if (stage === "expired") {
    return (
      <StageScreen
        icon={Clock}
        tone="urgent"
        title="Request timed out"
        message="The patient did not respond within the time window."
      >
        <div className="flex items-center" style={{ gap: 12 }}>
          <Button onClick={onBack}>Back to queue</Button>
          <Button
            variant="primary"
            icon={RefreshCw}
            onClick={() => {
              setStage("form");
              setRequestId("");
              setElapsed(0);
            }}
          >
            Try again
          </Button>
        </div>
      </StageScreen>
    );
  }

  if (stage === "waiting") {
    return (
      <StageScreen
        icon={Shield}
        tone="brand"
        title="Waiting for patient approval"
        message={
          <>
            A notification has been sent to <strong>{patientName}</strong>'s
            HealthChain app. This page updates automatically when they respond.
          </>
        }
      >
        {/* Elapsed timer — the only moving part while nothing else changes. */}
        <span
          className="inline-flex items-center"
          style={{
            gap: 8,
            height: 34,
            padding: "0 14px",
            borderRadius: "var(--r-md)",
            background: "var(--brand-tint)",
            border: "1px solid var(--green-100)",
          }}
        >
          <Clock className="w-3.5 h-3.5" style={{ color: "var(--green-700)" }} />
          <span
            style={{ font: "600 13px/1 var(--font-mono)", color: "var(--green-800)" }}
          >
            {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </span>
          <span
            style={{ font: "400 11.5px/1 var(--font-sans)", color: "var(--green-800)" }}
          >
            waiting
          </span>
        </span>

        <div className="flex flex-wrap justify-center" style={{ gap: 6 }}>
          {selectedPerms.map((perm) => {
            const opt = PERMISSION_OPTIONS.find((o) => o.value === perm);
            return opt ? (
              <Badge key={perm} tone="success">
                {opt.label}
              </Badge>
            ) : null;
          })}
        </div>

        <span
          style={{ font: "400 11px/1 var(--font-mono)", color: "var(--text-muted)" }}
        >
          Request {requestId.slice(0, 8)}…
        </span>

        <LinkAction
          arrow={false}
          onClick={() => {
            setStage("form");
            setRequestId("");
            setElapsed(0);
          }}
        >
          Cancel and go back
        </LinkAction>
      </StageScreen>
    );
  }

  const reasonOk = reason.trim().length >= 10;

  return (
    <div
      style={{
        maxWidth: 620,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div className="flex items-start" style={{ gap: 10 }}>
        <Button
          variant="ghost"
          icon={ChevronLeft}
          onClick={onBack}
          style={{ width: 30, padding: 0, marginTop: 2 }}
        />
        <div className="min-w-0 flex flex-col" style={{ gap: 5 }}>
          <h2
            style={{
              margin: 0,
              font: "700 18px/1.2 var(--font-sans)",
              letterSpacing: "var(--ls-tight)",
              color: "var(--text-primary)",
            }}
          >
            Request patient access
          </h2>
          <p
            style={{
              margin: 0,
              font: "400 13px/1.5 var(--font-sans)",
              color: "var(--text-secondary)",
            }}
          >
            You need blockchain consent from <strong>{patientName}</strong> to view
            this visit.
          </p>
        </div>
      </div>

      <Banner tone="info" icon={Shield} title="Blockchain consent required">
        The patient approves from their HealthChain mobile app. Once approved, access
        is recorded on Hyperledger Fabric and auto-revoked at discharge.
      </Banner>

      <Card pad={20}>
        <SectionLabel style={{ marginBottom: 12 }}>
          Step 1 — permissions needed
        </SectionLabel>
        <div className="flex flex-col" style={{ gap: 8 }}>
          {PERMISSION_OPTIONS.map(({ value, label, desc }) => {
            const checked = selectedPerms.includes(value);
            return (
              <button
                key={value}
                onClick={() => togglePerm(value)}
                className="w-full flex items-center text-left"
                style={{
                  gap: 12,
                  padding: 14,
                  borderRadius: "var(--r-sm)",
                  border: `1px solid ${checked ? "var(--brand)" : "var(--hc-border)"}`,
                  background: checked ? "var(--brand-tint)" : "var(--surface-sunken)",
                  cursor: "pointer",
                  transition: "all var(--dur-fast) var(--ease-standard)",
                }}
              >
                <span
                  className="inline-flex items-center justify-center flex-shrink-0"
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "var(--r-xs)",
                    border: `2px solid ${checked ? "var(--brand)" : "var(--ink-300)"}`,
                    background: checked ? "var(--brand)" : "var(--surface-card)",
                  }}
                >
                  {checked && (
                    <svg viewBox="0 0 10 8" className="w-2.5 h-2">
                      <path
                        d="M1 4l2.5 2.5L9 1"
                        stroke="var(--on-brand)"
                        strokeWidth="1.8"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>

                <span className="flex-1 min-w-0 flex flex-col" style={{ gap: 4 }}>
                  <span
                    style={{
                      font: "600 13.5px/1 var(--font-sans)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {label}
                  </span>
                  <span
                    style={{
                      font: "400 11.5px/1 var(--font-sans)",
                      color: "var(--text-muted)",
                    }}
                  >
                    {desc}
                  </span>
                </span>

                <Lock
                  className="w-3.5 h-3.5 flex-shrink-0"
                  style={{ color: "var(--text-disabled)" }}
                />
              </button>
            );
          })}
        </div>
      </Card>

      <Card pad={20}>
        <SectionLabel style={{ marginBottom: 12 }}>
          Step 2 — clinical reason
        </SectionLabel>
        <FieldGroup label="Reason (shown to the patient)">
          <TextArea
            value={reason}
            onChange={setReason}
            rows={3}
            placeholder="e.g. Attending physician for this admission — requires full access to manage treatment…"
          />
          <p
            style={{
              margin: "6px 0 0",
              font: "400 11.5px/1 var(--font-sans)",
              color: reasonOk ? "var(--green-800)" : "var(--text-muted)",
            }}
          >
            {reasonOk
              ? "Sufficient detail"
              : `${10 - reason.trim().length} more character${
                  10 - reason.trim().length !== 1 ? "s" : ""
                } needed`}
          </p>
        </FieldGroup>
      </Card>

      {submitError && (
        <Banner tone="critical" icon={AlertCircle}>
          {submitError}
        </Banner>
      )}

      <div className="flex justify-end">
        <Button
          variant="primary"
          icon={Shield}
          loading={submitting}
          disabled={!reasonOk || !selectedPerms.length}
          onClick={handleSubmit}
        >
          {submitting ? "Sending…" : "Send access request"}
        </Button>
      </div>
    </div>
  );
}
export default PermissionGate;
