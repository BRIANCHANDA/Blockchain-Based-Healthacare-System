"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { patientApi, permissionApi, visitApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import {
  Shield,
  Search,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Info,
  Lock,
  ChevronRight,
  Clock,
  RefreshCw,
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

type Stage =
  | "form" // filling out the request
  | "waiting" // request sent, polling for approval
  | "approved" // patient approved — redirecting
  | "rejected" // patient rejected
  | "expired"; // 48hr timeout

export default function DoctorPermissionsPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  // ── Patient search ──────────────────────────────────
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [patient, setPatient] = useState<any>(null);

  // ── Form ────────────────────────────────────────────
  const [reason, setReason] = useState("");
  const [selectedPerms, setSelectedPerms] = useState<string[]>([
    "read",
    "write",
  ]);
  const [visitId, setVisitId] = useState<string | null>(null); // active visit to redirect to
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // ── Polling state ───────────────────────────────────
  const [stage, setStage] = useState<Stage>("form");
  const [requestId, setRequestId] = useState("");
  const [secondsWaited, setSecondsWaited] = useState(0);
  const [pollError, setPollError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stop polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Fetch patient's active visit so we can redirect after approval
  useEffect(() => {
    if (!patient) return;
    visitApi
      .getPatientVisits(patient.id)
      .then((res) => {
        const active = (res.data.data?.visits ?? []).find(
          (v: any) => v.status === "in-progress",
        );
        setVisitId(active?.id ?? null);
      })
      .catch(() => {});
  }, [patient]);

  // ── Polling logic ───────────────────────────────────
  const startPolling = useCallback(
    (reqId: string) => {
      setSecondsWaited(0);

      // Tick counter every second
      timerRef.current = setInterval(() => {
        setSecondsWaited((s) => s + 1);
      }, 1000);

      // Poll every 3 seconds
      pollRef.current = setInterval(async () => {
        try {
          const res = await permissionApi.getRequestStatus(reqId);
          const { status, visitId: approvedVisitId } = res.data.data;

          if (status === "approved") {
            clearInterval(pollRef.current!);
            clearInterval(timerRef.current!);
            setStage("approved");
            // Redirect after 1.5s so user sees the success flash
            const destination = approvedVisitId
              ? `/dashboard/doctor/visits/${approvedVisitId}`
              : visitId
                ? `/dashboard/doctor/visits/${visitId}`
                : `/dashboard/doctor/patients/${patient?.id}`;
            setTimeout(() => router.push(destination), 1500);
          } else if (status === "rejected") {
            clearInterval(pollRef.current!);
            clearInterval(timerRef.current!);
            setStage("rejected");
          } else if (status === "expired") {
            clearInterval(pollRef.current!);
            clearInterval(timerRef.current!);
            setStage("expired");
          }
        } catch (_) {
          setPollError("Connection issue — still waiting…");
          setTimeout(() => setPollError(""), 3000);
        }
      }, 3000);
    },
    [patient, visitId, router],
  );

  // ── Handlers ────────────────────────────────────────
  const handleSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearchError("");
    setResults([]);
    setPatient(null);
    try {
      const res = await patientApi.search(q);
      const list = res.data.data?.patients ?? [];
      if (!list.length) {
        setSearchError(`No patients found for "${q}".`);
      } else if (list.length === 1) {
        setPatient(list[0]);
      } else {
        setResults(list);
      }
    } catch (err: any) {
      setSearchError(err.response?.data?.error?.message ?? "Search failed.");
    } finally {
      setSearching(false);
    }
  }, [query]);

  const togglePerm = (value: string) => {
    setSelectedPerms((prev) =>
      prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value],
    );
  };

  const handleSubmit = async () => {
    if (!patient) return;
    if (reason.trim().length < 10) {
      setSubmitError("Please provide a reason (minimum 10 characters).");
      return;
    }
    if (!selectedPerms.length) {
      setSubmitError("Select at least one permission type.");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await permissionApi.requestAccess({
        patientId: patient.id,
        visitId: visitId ?? undefined,
        reason: reason.trim(),
        requestedPermissions: selectedPerms,
      });
      const reqId = res.data.data?.requestId ?? "";
      setRequestId(reqId);
      setStage("waiting");
      startPolling(reqId);
    } catch (err: any) {
      setSubmitError(
        err.response?.data?.error?.message ??
          "Request failed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    setStage("form");
    setPatient(null);
    setResults([]);
    setQuery("");
    setReason("");
    setSelectedPerms(["read", "write"]);
    setRequestId("");
    setSubmitError("");
    setPollError("");
    setSecondsWaited(0);
    setVisitId(null);
  };

  const formatWait = (s: number) => {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  // ── WAITING STATE ────────────────────────────────────
  if (stage === "waiting") {
    return (
      <div
        className="max-w-lg mx-auto"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          {/* Animated pulse ring */}
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full bg-green-100 animate-ping opacity-60" />
            <div className="relative w-20 h-20 rounded-full bg-green-50 border-2 border-green-200 flex items-center justify-center">
              <Clock size={28} className="text-green-600" />
            </div>
          </div>

          <h2 className="text-lg font-bold text-gray-900 mb-1">
            Waiting for patient approval
          </h2>
          <p className="text-gray-500 text-sm mb-1">
            Request sent to{" "}
            <strong>
              {patient?.firstName} {patient?.lastName}
            </strong>
          </p>
          <p className="text-gray-400 text-xs mb-6">
            They will see a notification on their HealthChain app
          </p>

          {/* Timer */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-50 border border-gray-200 mb-6">
            <RefreshCw
              size={13}
              className="text-gray-400 animate-spin"
              style={{ animationDuration: "3s" }}
            />
            <span className="text-sm font-medium text-gray-600">
              Checking every 3s · waited {formatWait(secondsWaited)}
            </span>
          </div>

          {/* Permission summary */}
          <div className="text-left p-4 rounded-xl bg-gray-50 border border-gray-100 mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Requested permissions
            </p>
            <div className="flex flex-wrap gap-1.5">
              {selectedPerms.map((p) => (
                <span
                  key={p}
                  className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{
                    background: "#f0fdf4",
                    color: "#15803d",
                    border: "1px solid #86efac",
                  }}
                >
                  {PERMISSION_OPTIONS.find((o) => o.value === p)?.label ?? p}
                </span>
              ))}
            </div>
          </div>

          {pollError && (
            <p className="text-xs text-amber-600 mb-3">{pollError}</p>
          )}

          <p className="text-xs text-gray-400 mb-4">
            This page will update automatically. Keep it open.
          </p>

          <button
            onClick={reset}
            className="text-sm text-gray-400 hover:text-gray-600 underline transition-colors"
          >
            Cancel request
          </button>
        </div>
      </div>
    );
  }

  // ── APPROVED STATE ───────────────────────────────────
  if (stage === "approved") {
    return (
      <div
        className="max-w-lg mx-auto"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        <div className="bg-white rounded-2xl border border-green-200 shadow-sm p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={36} className="text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Access Approved!
          </h2>
          <p className="text-gray-500 text-sm mb-1">
            <strong>
              {patient?.firstName} {patient?.lastName}
            </strong>{" "}
            has granted you access.
          </p>
          <p className="text-gray-400 text-xs mb-6">
            Redirecting you to the visit workspace…
          </p>
          <div className="flex items-center justify-center gap-2 text-green-600">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm font-medium">Opening visit…</span>
          </div>
        </div>
      </div>
    );
  }

  // ── REJECTED STATE ───────────────────────────────────
  if (stage === "rejected") {
    return (
      <div
        className="max-w-lg mx-auto"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <XCircle size={36} className="text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Access Denied
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            <strong>
              {patient?.firstName} {patient?.lastName}
            </strong>{" "}
            declined your access request.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={reset}
              className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Try again
            </button>
            <button
              onClick={() => router.push("/dashboard/doctor/queue")}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
              style={{
                background: "linear-gradient(135deg, #166534, #15803d)",
              }}
            >
              Back to queue
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── EXPIRED STATE ─────────────────────────────────────
  if (stage === "expired") {
    return (
      <div
        className="max-w-lg mx-auto"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
            <Clock size={36} className="text-amber-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Request Expired
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            The patient did not respond within 48 hours. You can submit a new
            request.
          </p>
          <button
            onClick={reset}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: "linear-gradient(135deg, #166534, #15803d)" }}
          >
            Send new request
          </button>
        </div>
      </div>
    );
  }

  // ── FORM STATE ────────────────────────────────────────
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
          Request Patient Access
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Send an access request — the patient approves on their HealthChain app
          and you're redirected automatically
        </p>
      </div>

      {/* How it works */}
      <div className="flex items-start gap-3 p-4 rounded-2xl border border-blue-100 bg-blue-50 mb-5">
        <Info size={15} className="text-blue-500 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-blue-700">
          Once you submit, this page will{" "}
          <strong>automatically detect approval</strong> and open the visit
          workspace — no need to refresh.
        </p>
      </div>

      <div className="space-y-4">
        {/* ── Step 1: Patient ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
            Step 1 — Find Patient
          </p>

          {patient ? (
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-green-50 border border-green-200">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                style={{ background: "#166534" }}
              >
                {patient.firstName?.[0]}
                {patient.lastName?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900">
                  {patient.firstName} {patient.lastName}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-gray-500 capitalize">
                    {patient.gender} · {patient.dateOfBirth}
                  </p>
                  {visitId && (
                    <span
                      className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
                      style={{ background: "#fef2f2", color: "#dc2626" }}
                    >
                      Active visit
                    </span>
                  )}
                </div>
              </div>
              {patient.bloodType && patient.bloodType !== "unknown" && (
                <span
                  className="text-xs font-bold px-2 py-1 rounded-full text-white flex-shrink-0"
                  style={{
                    background: bloodTypeColor[patient.bloodType] ?? "#6b7280",
                  }}
                >
                  {patient.bloodType}
                </span>
              )}
              <button
                onClick={() => {
                  setPatient(null);
                  setResults([]);
                  setVisitId(null);
                }}
                className="text-xs text-gray-400 hover:text-gray-600 underline flex-shrink-0"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder="Search by name or National ID…"
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900
                      outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/10 focus:bg-white
                      placeholder:text-gray-400 transition-all"
                  />
                </div>
                <button
                  onClick={handleSearch}
                  disabled={searching || !query.trim()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
                  style={{
                    background: "linear-gradient(135deg, #166534, #15803d)",
                  }}
                >
                  {searching ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Search size={15} />
                  )}
                  Search
                </button>
              </div>

              {searchError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
                  <AlertCircle size={14} className="flex-shrink-0" />{" "}
                  {searchError}
                </div>
              )}

              {results.length > 0 && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <p className="px-4 py-2 text-xs font-semibold text-gray-400 bg-gray-50 border-b border-gray-200">
                    {results.length} patients found — select one
                  </p>
                  {results.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setPatient(p);
                        setResults([]);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-100 last:border-0 group"
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ background: "#166534" }}
                      >
                        {p.firstName?.[0]}
                        {p.lastName?.[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">
                          {p.firstName} {p.lastName}
                        </p>
                        <p className="text-xs text-gray-400 capitalize">
                          {p.gender} · {p.dateOfBirth}
                        </p>
                      </div>
                      <ChevronRight
                        size={14}
                        className="text-gray-300 group-hover:text-gray-500 flex-shrink-0 transition-colors"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Steps 2 & 3 — greyed out until patient selected ── */}
        <div
          className={`space-y-4 transition-opacity ${!patient ? "opacity-40 pointer-events-none" : ""}`}
        >
          {/* Step 2: Permissions */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
              Step 2 — Permissions Needed
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
                        <svg
                          viewBox="0 0 10 8"
                          className="w-2.5 h-2 fill-white"
                        >
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
                      <p className="text-sm font-semibold text-gray-900">
                        {label}
                      </p>
                      <p className="text-xs text-gray-400">{desc}</p>
                    </div>
                    <Lock size={13} className="text-gray-300 flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 3: Reason */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
              Step 3 — Clinical Reason
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Attending physician for this admission — requires access to review full medical history and manage ongoing treatment…"
              rows={4}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900
                outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/10 focus:bg-white
                resize-none placeholder:text-gray-400 transition-all"
            />
            <p className="text-xs text-gray-400 mt-1.5">
              {reason.trim().length} / 10 minimum ·{" "}
              <span
                style={{
                  color: reason.trim().length >= 10 ? "#15803d" : "#9ca3af",
                }}
              >
                {reason.trim().length >= 10
                  ? "✓ Good"
                  : `${10 - reason.trim().length} more needed`}
              </span>
            </p>

            {/* Blockchain note */}
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-gray-50 border border-gray-100 mt-4">
              <Shield
                size={13}
                className="text-gray-400 mt-0.5 flex-shrink-0"
              />
              <p className="text-xs text-gray-500">
                Approval is recorded and is automatically revoked at discharge.
                This page will redirect you to the visit workspace the moment
                the patient approves.
              </p>
            </div>

            {submitError && (
              <div className="flex items-start gap-2 p-3.5 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700 mt-3">
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />{" "}
                {submitError}
              </div>
            )}

            <div className="flex justify-end mt-4 pt-4 border-t border-gray-100">
              <button
                onClick={handleSubmit}
                disabled={
                  submitting ||
                  !patient ||
                  reason.trim().length < 10 ||
                  !selectedPerms.length
                }
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-md disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg, #166534, #15803d)",
                }}
              >
                {submitting ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> Sending…
                  </>
                ) : (
                  <>
                    <Shield size={15} /> Send Access Request
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
