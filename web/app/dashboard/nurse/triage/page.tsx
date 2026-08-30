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
import { Page, PageHeader } from "@/components/dashboard/ui";

const bloodTypeColor: Record<string, string> = {
  "A+": "var(--blue-500)",
  "A-": "var(--blue-600)",
  "B+": "var(--violet-500)",
  "B-": "var(--coral-500)",
  "AB+": "var(--amber-500)",
  "AB-": "var(--coral-500)",
  "O+": "var(--green-600)",
  "O-": "var(--green-600)",
  unknown: "var(--text-muted)",
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
    <Page maxWidth={700}>
      <PageHeader
        eyebrow="Nursing"
        title="Triage patient"
        subtitle={
          queueVisitNumber
            ? "Requesting access for patient…"
            : "Enter the visit number to begin triage"
        }
      />

      {!queueVisitNumber && (
        <div className="bg-[var(--surface-card)] rounded-[var(--r-lg)] border border-[var(--border-faint)] shadow-[var(--elev-1)] p-6 mb-4">
          <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
            Visit Number
          </label>
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input
                value={visitNumber}
                onChange={(e) => setVisitNumber(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="e.g. VIS-2026-AB12CD34"
                className="w-full pl-10 pr-4 py-3 rounded-[var(--r-sm)] border border-[var(--hc-border)] bg-[var(--surface-sunken)] text-[var(--text-primary)] text-sm font-mono outline-none transition-all focus:border-[var(--green-600)] focus:ring-2 focus:ring-[var(--focus-ring)] focus:bg-[var(--surface-card)] placeholder:text-[var(--text-muted)] placeholder:font-sans"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={loading || !visitNumber.trim()}
              className="flex items-center gap-2 px-5 py-3 rounded-[var(--r-sm)] text-sm font-semibold text-[var(--white)] transition-all disabled:opacity-50"
              style={{
                background: "var(--brand)",
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
            <div className="flex items-start gap-2 mt-3 p-3 rounded-[var(--r-sm)] bg-[var(--coral-050)] border border-[var(--coral-100)]">
              <AlertCircle className="w-4 h-4 text-[var(--coral-500)] mt-0.5 flex-shrink-0" />
              <p className="text-sm text-[var(--critical-ink)]">{error}</p>
            </div>
          )}
          <p className="text-xs text-[var(--text-muted)] mt-3">
            💡 You can also click any patient in the{" "}
            <button
              onClick={() => router.push("/dashboard/nurse/queue")}
              className="text-[var(--green-700)] font-medium hover:underline"
            >
              Today's Queue
            </button>{" "}
            to go directly to their triage form.
          </p>
        </div>
      )}

      {loading && queueVisitNumber && (
        <div className="bg-[var(--surface-card)] rounded-[var(--r-lg)] border border-[var(--border-faint)] shadow-[var(--elev-1)] p-10 flex flex-col items-center gap-3 text-[var(--text-muted)]">
          <Loader2 className="w-7 h-7 animate-spin text-[var(--green-700)]" />
          <p className="text-sm">Loading patient visit…</p>
        </div>
      )}

      {!loading && error && queueVisitNumber && (
        <div className="flex items-start gap-2 p-4 rounded-[var(--r-lg)] bg-[var(--coral-050)] border border-[var(--coral-100)]">
          <AlertCircle className="w-4 h-4 text-[var(--coral-500)] mt-0.5 flex-shrink-0" />
          <p className="text-sm text-[var(--critical-ink)]">{error}</p>
        </div>
      )}

      {result && (
        <div className="bg-[var(--surface-card)] rounded-[var(--r-lg)] border border-[var(--green-100)] shadow-[var(--elev-1)] overflow-hidden">
          <div
            className="px-6 py-4 border-b border-[var(--border-faint)] flex items-center gap-3"
            style={{ background: "var(--brand-tint)" }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-[var(--white)] flex-shrink-0"
              style={{ background: "var(--green-800)" }}
            >
              {result.patient?.firstName?.[0]}
              {result.patient?.lastName?.[0]}
            </div>
            <div>
              <p className="font-bold text-[var(--text-primary)]">
                {result.patient
                  ? `${result.patient.firstName} ${result.patient.lastName}`
                  : "Unknown Patient"}
              </p>
              <p className="text-xs text-[var(--text-secondary)] font-mono">
                {result.visit?.visitNumber}
              </p>
            </div>
            <div className="ml-auto">
              {result.patient?.bloodType &&
                result.patient.bloodType !== "unknown" && (
                  <span
                    className="text-xs font-bold px-2.5 py-1 rounded-full text-[var(--white)]"
                    style={{
                      background:
                        bloodTypeColor[result.patient.bloodType] ?? "var(--text-secondary)",
                    }}
                  >
                    {result.patient.bloodType}
                  </span>
                )}
            </div>
          </div>

          <div className="px-6 py-4 grid grid-cols-2 gap-4 text-sm border-b border-[var(--border-faint)]">
            <div>
              <p className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wide mb-1">
                Chief Complaint
              </p>
              <p className="text-[var(--text-primary)] font-medium">
                {result.visit?.chiefComplaint}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wide mb-1">
                Priority
              </p>
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize"
                style={{
                  background:
                    result.visit?.priority === "critical"
                      ? "var(--coral-050)"
                      : result.visit?.priority === "urgent"
                        ? "var(--amber-050)"
                        : "var(--brand-tint)",
                  color:
                    result.visit?.priority === "critical"
                      ? "var(--critical-ink)"
                      : result.visit?.priority === "urgent"
                        ? "var(--urgent-ink)"
                        : "var(--green-600)",
                }}
              >
                {result.visit?.priority}
              </span>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wide mb-1">
                Visit Type
              </p>
              <p className="text-[var(--text-secondary)] capitalize">
                {result.visit?.visitType}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wide mb-1">
                Gender
              </p>
              <p className="text-[var(--text-secondary)] capitalize">
                {result.patient?.gender ?? "—"}
              </p>
            </div>
          </div>

          <div className="px-6 py-4">
            {permStatus === "idle" && (
              <button
                onClick={() => sendAccessRequest(result)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-[var(--r-sm)] text-sm font-semibold text-[var(--white)] transition-all hover:shadow-[var(--elev-2)]"
                style={{
                  background: "var(--brand)",
                }}
              >
                <Activity className="w-4 h-4" /> Begin Triage{" "}
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
            {permStatus === "requesting" && (
              <div className="flex items-center justify-center gap-3 py-4 text-[var(--text-secondary)] text-sm">
                <Loader2 className="w-5 h-5 animate-spin text-[var(--green-700)]" />{" "}
                Sending access request to patient…
              </div>
            )}
            {permStatus === "pending" && (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-4 rounded-[var(--r-sm)] bg-[var(--info-tint)] border border-[var(--blue-100)]">
                  <Clock className="w-5 h-5 text-[var(--blue-500)] mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-[var(--info-ink)]">
                      Waiting for patient approval
                    </p>
                    <p className="text-xs text-[var(--info-ink)] mt-0.5">
                      A notification has been sent to{" "}
                      <span className="font-medium">
                        {result.patient?.firstName} {result.patient?.lastName}
                      </span>
                      . This page will update automatically once they respond.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-2 py-1 text-xs text-[var(--text-muted)]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking for
                  response… ({pollCount * 5}s elapsed)
                </div>
              </div>
            )}
            {permStatus === "approved" && (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-4 rounded-[var(--r-sm)] bg-[var(--brand-tint)] border border-[var(--green-200)]">
                  <CheckCircle2 className="w-5 h-5 text-[var(--green-700)] mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-[var(--green-800)]">
                      Access approved
                    </p>
                    <p className="text-xs text-[var(--green-700)] mt-0.5">
                      {result.patient?.firstName} {result.patient?.lastName} has
                      granted you access.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() =>
                    router.push(`/dashboard/nurse/triage/${result.visit.id}`)
                  }
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-[var(--r-sm)] text-sm font-semibold text-[var(--white)] transition-all hover:shadow-[var(--elev-2)]"
                  style={{
                    background: "var(--brand)",
                  }}
                >
                  <Activity className="w-4 h-4" /> Begin Triage{" "}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
            {permStatus === "rejected" && (
              <div className="flex items-start gap-3 p-4 rounded-[var(--r-sm)] bg-[var(--coral-050)] border border-[var(--coral-100)]">
                <XCircle className="w-5 h-5 text-[var(--coral-500)] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-[var(--critical-ink)]">
                    Access denied
                  </p>
                  <p className="text-xs text-[var(--critical-ink)] mt-0.5">
                    The patient declined the request. Please speak with them
                    directly or escalate to the attending practitioner.
                  </p>
                </div>
              </div>
            )}
            {permStatus === "expired" && (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-4 rounded-[var(--r-sm)] bg-[var(--surface-sunken)] border border-[var(--hc-border)]">
                  <Clock className="w-5 h-5 text-[var(--text-muted)] mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      Request timed out
                    </p>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
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
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-[var(--r-sm)] text-sm font-semibold border border-[var(--hc-border)] text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] transition-all"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </Page>
  );
}

// ── Suspense wrapper ──────────────────────────────────────────────────────────
// The inner component reads useSearchParams, which Next requires be wrapped.
export default function NurseTriagePage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            padding: 40,
            textAlign: "center",
            font: "400 13px/1 var(--font-sans)",
            color: "var(--text-muted)",
          }}
        >
          Loading…
        </div>
      }
    >
      <NurseTriagePageInner />
    </Suspense>
  );
}
