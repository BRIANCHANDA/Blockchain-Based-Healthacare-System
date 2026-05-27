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
      <div className="flex flex-col items-center justify-center min-h-64 gap-4 text-center py-16">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 size={40} className="text-green-600" />
        </div>
        <div>
          <p className="text-lg font-bold text-gray-900">Access Granted</p>
          <p className="text-sm text-gray-500 mt-1">Opening visit workspace…</p>
        </div>
        <Loader2 className="animate-spin text-green-600" size={20} />
      </div>
    );
  }

  if (stage === "rejected") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 text-center py-16">
        <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
          <XCircle size={40} className="text-red-500" />
        </div>
        <div>
          <p className="text-lg font-bold text-gray-900">Request Denied</p>
          <p className="text-sm text-gray-500 mt-1 max-w-xs">
            {patientName} declined to grant access to their records.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            Back to Queue
          </button>
          <button
            onClick={() => {
              setStage("form");
              setReason("");
              setRequestId("");
              setElapsed(0);
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg,#166534,#15803d)" }}
          >
            <Shield size={14} /> Request Again
          </button>
        </div>
      </div>
    );
  }

  if (stage === "expired") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 text-center py-16">
        <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center">
          <Clock size={40} className="text-amber-500" />
        </div>
        <div>
          <p className="text-lg font-bold text-gray-900">Request Timed Out</p>
          <p className="text-sm text-gray-500 mt-1 max-w-xs">
            The patient did not respond within the time window.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            Back to Queue
          </button>
          <button
            onClick={() => {
              setStage("form");
              setRequestId("");
              setElapsed(0);
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg,#166534,#15803d)" }}
          >
            <RefreshCw size={14} /> Try Again
          </button>
        </div>
      </div>
    );
  }

  if (stage === "waiting") {
    return (
      <div className="flex flex-col items-center justify-center gap-6 text-center py-16 max-w-sm mx-auto">
        <div className="relative">
          <div
            className="absolute inset-0 rounded-full animate-ping opacity-20"
            style={{ background: "#166534" }}
          />
          <div
            className="relative w-24 h-24 rounded-full flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg,#f0fdf4,#dcfce7)",
              border: "2px solid #86efac",
            }}
          >
            <Shield size={40} className="text-green-700" />
          </div>
        </div>
        <div>
          <p className="text-lg font-bold text-gray-900">
            Waiting for Patient Approval
          </p>
          <p className="text-sm text-gray-500 mt-1.5 max-w-xs">
            A notification has been sent to <strong>{patientName}</strong>'s
            HealthChain app. This page will update automatically when they
            respond.
          </p>
        </div>
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-xl"
          style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}
        >
          <Clock size={14} className="text-green-600" />
          <span className="font-mono text-sm font-semibold text-green-800">
            {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </span>
          <span className="text-xs text-green-600">waiting</span>
        </div>
        <div className="flex flex-wrap gap-1.5 justify-center">
          {selectedPerms.map((p) => {
            const opt = PERMISSION_OPTIONS.find((o) => o.value === p);
            return opt ? (
              <span
                key={p}
                className="text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{
                  background: "#f0fdf4",
                  color: "#166534",
                  border: "1px solid #bbf7d0",
                }}
              >
                {opt.label}
              </span>
            ) : null;
          })}
        </div>
        <div className="flex gap-1.5">
          {[0, 0.3, 0.6].map((d, i) => (
            <span
              key={i}
              className="w-2 h-2 rounded-full bg-green-400 animate-bounce"
              style={{ animationDelay: `${d}s` }}
            />
          ))}
        </div>
        <p className="text-xs text-gray-400 font-mono">
          Req ID: {requestId.slice(0, 8)}…
        </p>
        <button
          onClick={() => {
            setStage("form");
            setRequestId("");
            setElapsed(0);
          }}
          className="text-xs text-gray-400 underline hover:text-gray-600"
        >
          Cancel and go back
        </button>
      </div>
    );
  }

  return (
    <div
      className="max-w-xl mx-auto space-y-4"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <div className="flex items-start gap-3 mb-2">
        <button
          onClick={onBack}
          className="mt-0.5 p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <ChevronLeft size={18} className="text-gray-600" />
        </button>
        <div>
          <h2
            className="text-lg font-bold text-gray-900"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Request Patient Access
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            You need blockchain consent from <strong>{patientName}</strong> to
            view this visit
          </p>
        </div>
      </div>
      <div className="flex items-start gap-3 p-4 rounded-2xl border border-blue-100 bg-blue-50">
        <Shield size={15} className="text-blue-500 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-800">
          <p className="font-semibold mb-0.5">Blockchain consent required</p>
          <p className="text-blue-700 text-xs">
            The patient approves via their HealthChain mobile app. Once
            approved, access is recorded on Hyperledger Fabric and auto-revoked
            at discharge.
          </p>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
          Step 1 — Permissions Needed
        </p>
        <div className="space-y-2">
          {PERMISSION_OPTIONS.map(({ value, label, desc }) => {
            const checked = selectedPerms.includes(value);
            return (
              <button
                key={value}
                onClick={() => togglePerm(value)}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all"
                style={
                  checked
                    ? { background: "#f0fdf4", borderColor: "#86efac" }
                    : { background: "#fafafa", borderColor: "#e5e7eb" }
                }
              >
                <div
                  className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border-2 transition-all"
                  style={
                    checked
                      ? { background: "#166534", borderColor: "#166534" }
                      : { background: "#fff", borderColor: "#d1d5db" }
                  }
                >
                  {checked && (
                    <svg viewBox="0 0 10 8" className="w-2.5 h-2 fill-white">
                      <path
                        d="M1 4l2.5 2.5L9 1"
                        stroke="white"
                        strokeWidth="1.5"
                        fill="none"
                        strokeLinecap="round"
                      />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">{label}</p>
                  <p className="text-xs text-gray-400">{desc}</p>
                </div>
                <Lock size={13} className="text-gray-300 flex-shrink-0" />
              </button>
            );
          })}
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
          Step 2 — Clinical Reason
        </p>
        <FieldGroup label="Reason (shown to patient)">
          <TextArea
            value={reason}
            onChange={setReason}
            rows={3}
            placeholder="e.g. Attending physician for this admission — requires full access to manage treatment…"
          />
          <p className="text-xs text-gray-400 mt-1">
            {reason.trim().length}/10 min ·{" "}
            <span
              style={{
                color: reason.trim().length >= 10 ? "#15803d" : "#9ca3af",
              }}
            >
              {reason.trim().length >= 10
                ? "✓ Sufficient"
                : `${10 - reason.trim().length} more needed`}
            </span>
          </p>
        </FieldGroup>
      </div>
      {submitError && (
        <div className="flex items-start gap-2 p-3.5 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />{" "}
          {submitError}
        </div>
      )}
      <div className="flex justify-end pb-2">
        <button
          onClick={handleSubmit}
          disabled={
            submitting || reason.trim().length < 10 || !selectedPerms.length
          }
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-md disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,#166534,#15803d)" }}
        >
          {submitting ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Shield size={15} />
          )}
          {submitting ? "Sending…" : "Send Access Request"}
        </button>
      </div>
    </div>
  );
}
export default PermissionGate;
