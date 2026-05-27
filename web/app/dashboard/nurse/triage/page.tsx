"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { visitApi, permissionApi } from "@/lib/api";
import {
  Search,
  Activity,
  AlertCircle,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";

const bloodTypeColor: Record<string, string> = {
  "A+": "#3b82f6",
  "A-": "#6366f1",
  "B+": "#8b5cf6",
  "B-": "#ec4899",
  "AB+": "#f59e0b",
  "AB-": "#ef4444",
  "O+": "#10b981",
  "O-": "#14b8a6",
  unknown: "#9ca3af",
};

type PermissionStatus =
  | "idle"
  | "requesting"
  | "pending"
  | "approved"
  | "rejected"
  | "expired";

// ── Inner component (uses useSearchParams — must be inside Suspense) ──────────
function NurseTriagePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queueVisitNumber = searchParams.get("visitNumber");

  const [visitNumber, setVisitNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<any>(null);
  const [permStatus, setPermStatus] = useState<PermissionStatus>("idle");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => () => stopPolling(), []);

  useEffect(() => {
    if (!queueVisitNumber) return;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await visitApi.getByVisitNumber(
          queueVisitNumber.toUpperCase(),
        );
        const data = res.data.data;
        setResult(data);
        await sendAccessRequest(data);
      } catch (err: any) {
        setError(err.response?.data?.error?.message || "Failed to load visit.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (permStatus !== "pending" || !requestId || !result) return;
    stopPolling();
    pollRef.current = setInterval(async () => {
      setPollCount((c) => {
        if (c >= 60) {
          stopPolling();
          setPermStatus("expired");
        }
        return c + 1;
      });
      try {
        const res = await visitApi.checkMyPermission(result.visit.id);
        if (res.data?.data?.hasPermission) {
          stopPolling();
          setPermStatus("approved");
        }
      } catch {
        /* keep polling */
      }
    }, 5000);
    return stopPolling;
  }, [permStatus, requestId]);

  const handleSearch = async () => {
    const trimmed = visitNumber.trim().toUpperCase();
    if (!trimmed) return;
    setLoading(true);
    setError("");
    setResult(null);
    setPermStatus("idle");
    setRequestId(null);
    stopPolling();
    try {
      const res = await visitApi.getByVisitNumber(trimmed);
      setResult(res.data.data);
    } catch (err: any) {
      const msg = err.response?.data?.error?.message;
      setError(
        err.response?.status === 404
          ? `No visit found for "${trimmed}". Please check the visit number.`
          : msg || "Failed to look up visit. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const sendAccessRequest = async (visitData: any) => {
    setPermStatus("requesting");
    setError("");
    try {
      const res = await permissionApi.requestAccess({
        patientId: visitData.visit.patientId,
        visitId: visitData.visit.id,
        reason: `Nurse triage access requested for visit ${visitData.visit.visitNumber}`,
        requestedPermissions: [
          "vitals:write",
          "nursing_assessment:write",
          "records:read",
        ],
      });
      setRequestId(res.data.data.requestId);
      setPermStatus("pending");
      setPollCount(0);
    } catch (err: any) {
      setPermStatus("idle");
      setError(
        err.response?.data?.error?.message ||
          "Failed to send access request. Please try again.",
      );
    }
  };

  return (
    <div
      className="max-w-2xl mx-auto"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <div className="mb-6">
        <h1
          className="text-2xl font-bold text-gray-900"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Triage Patient
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {queueVisitNumber
            ? "Requesting access for patient…"
            : "Enter the visit number to begin triage"}
        </p>
      </div>

      {!queueVisitNumber && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
            Visit Number
          </label>
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={visitNumber}
                onChange={(e) => setVisitNumber(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="e.g. VIS-2026-AB12CD34"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-sm font-mono outline-none transition-all focus:border-green-600 focus:ring-2 focus:ring-green-600/10 focus:bg-white placeholder:text-gray-400 placeholder:font-sans"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={loading || !visitNumber.trim()}
              className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, #166534, #15803d)",
              }}
            >
              {loading ? (
                <svg
                  className="animate-spin w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
              ) : (
                <>
                  <Search className="w-4 h-4" /> Look Up
                </>
              )}
            </button>
          </div>
          {error && (
            <div className="flex items-start gap-2 mt-3 p-3 rounded-xl bg-red-50 border border-red-100">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          <p className="text-xs text-gray-400 mt-3">
            💡 You can also click any patient in the{" "}
            <button
              onClick={() => router.push("/dashboard/nurse/queue")}
              className="text-green-700 font-medium hover:underline"
            >
              Today's Queue
            </button>{" "}
            to go directly to their triage form.
          </p>
        </div>
      )}

      {loading && queueVisitNumber && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 flex flex-col items-center gap-3 text-gray-400">
          <Loader2 className="w-7 h-7 animate-spin text-green-700" />
          <p className="text-sm">Loading patient visit…</p>
        </div>
      )}

      {!loading && error && queueVisitNumber && (
        <div className="flex items-start gap-2 p-4 rounded-2xl bg-red-50 border border-red-100">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {result && (
        <div className="bg-white rounded-2xl border border-green-100 shadow-sm overflow-hidden">
          <div
            className="px-6 py-4 border-b border-gray-100 flex items-center gap-3"
            style={{ background: "linear-gradient(135deg, #f0fdf4, #dcfce7)" }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
              style={{ background: "#166534" }}
            >
              {result.patient?.firstName?.[0]}
              {result.patient?.lastName?.[0]}
            </div>
            <div>
              <p className="font-bold text-gray-900">
                {result.patient
                  ? `${result.patient.firstName} ${result.patient.lastName}`
                  : "Unknown Patient"}
              </p>
              <p className="text-xs text-gray-500 font-mono">
                {result.visit?.visitNumber}
              </p>
            </div>
            <div className="ml-auto">
              {result.patient?.bloodType &&
                result.patient.bloodType !== "unknown" && (
                  <span
                    className="text-xs font-bold px-2.5 py-1 rounded-full text-white"
                    style={{
                      background:
                        bloodTypeColor[result.patient.bloodType] ?? "#6b7280",
                    }}
                  >
                    {result.patient.bloodType}
                  </span>
                )}
            </div>
          </div>

          <div className="px-6 py-4 grid grid-cols-2 gap-4 text-sm border-b border-gray-100">
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">
                Chief Complaint
              </p>
              <p className="text-gray-800 font-medium">
                {result.visit?.chiefComplaint}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">
                Priority
              </p>
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize"
                style={{
                  background:
                    result.visit?.priority === "critical"
                      ? "#fef2f2"
                      : result.visit?.priority === "urgent"
                        ? "#fffbeb"
                        : "#f0fdf4",
                  color:
                    result.visit?.priority === "critical"
                      ? "#dc2626"
                      : result.visit?.priority === "urgent"
                        ? "#d97706"
                        : "#16a34a",
                }}
              >
                {result.visit?.priority}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">
                Visit Type
              </p>
              <p className="text-gray-600 capitalize">
                {result.visit?.visitType}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">
                Gender
              </p>
              <p className="text-gray-600 capitalize">
                {result.patient?.gender ?? "—"}
              </p>
            </div>
          </div>

          <div className="px-6 py-4">
            {permStatus === "idle" && (
              <button
                onClick={() => sendAccessRequest(result)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-md"
                style={{
                  background: "linear-gradient(135deg, #166534, #15803d)",
                }}
              >
                <Activity className="w-4 h-4" /> Begin Triage{" "}
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
            {permStatus === "requesting" && (
              <div className="flex items-center justify-center gap-3 py-4 text-gray-500 text-sm">
                <Loader2 className="w-5 h-5 animate-spin text-green-700" />{" "}
                Sending access request to patient…
              </div>
            )}
            {permStatus === "pending" && (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 border border-blue-100">
                  <Clock className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-blue-900">
                      Waiting for patient approval
                    </p>
                    <p className="text-xs text-blue-700 mt-0.5">
                      A notification has been sent to{" "}
                      <span className="font-medium">
                        {result.patient?.firstName} {result.patient?.lastName}
                      </span>
                      . This page will update automatically once they respond.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-2 py-1 text-xs text-gray-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking for
                  response… ({pollCount * 5}s elapsed)
                </div>
              </div>
            )}
            {permStatus === "approved" && (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-4 rounded-xl bg-green-50 border border-green-200">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-green-900">
                      Access approved
                    </p>
                    <p className="text-xs text-green-700 mt-0.5">
                      {result.patient?.firstName} {result.patient?.lastName} has
                      granted you access.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() =>
                    router.push(`/dashboard/nurse/triage/${result.visit.id}`)
                  }
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-md"
                  style={{
                    background: "linear-gradient(135deg, #166534, #15803d)",
                  }}
                >
                  <Activity className="w-4 h-4" /> Begin Triage{" "}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
            {permStatus === "rejected" && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-100">
                <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-900">
                    Access denied
                  </p>
                  <p className="text-xs text-red-700 mt-0.5">
                    The patient declined the request. Please speak with them
                    directly or escalate to the attending practitioner.
                  </p>
                </div>
              </div>
            )}
            {permStatus === "expired" && (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-4 rounded-xl bg-gray-50 border border-gray-200">
                  <Clock className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">
                      Request timed out
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      No response from the patient. You can try again.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setPermStatus("idle");
                    setRequestId(null);
                    setPollCount(0);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-all"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Suspense wrapper ──────────────────────────────────────────────────────────
export default function NurseTriagePage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
          Loading…
        </div>
      }
    >
      <NurseTriagePageInner />
    </Suspense>
  );
}
