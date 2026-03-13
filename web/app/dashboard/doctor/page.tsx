"use client";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { patientApi, permissionApi } from "@/lib/api";
import {
  Shield,
  Search,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Info,
  Lock,
  ChevronRight,
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

function FieldGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

export default function DoctorPermissionsPage() {
  const router = useRouter();

  // Patient search state
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [patient, setPatient] = useState<any>(null);

  // Form state
  const [reason, setReason] = useState("");
  const [selectedPerms, setSelectedPerms] = useState<string[]>([
    "read",
    "write",
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [requestId, setRequestId] = useState("");

  const handleSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearchError("");
    setResults([]);
    setPatient(null);
    setSubmitted(false);
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
    if (!reason.trim() || reason.trim().length < 10) {
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
        reason: reason.trim(),
        requestedPermissions: selectedPerms,
      });
      setRequestId(res.data.data?.requestId ?? "");
      setSubmitted(true);
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
    setPatient(null);
    setResults([]);
    setQuery("");
    setReason("");
    setSelectedPerms(["read", "write"]);
    setSubmitted(false);
    setRequestId("");
    setSubmitError("");
  };

  return (
    <div
      className="max-w-2xl mx-auto"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Header */}
      <div className="mb-6">
        <h1
          className="text-2xl font-bold text-gray-900"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Permissions
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Request access to a patient's records — the patient approves via their
          mobile app
        </p>
      </div>

      {/* How it works banner */}
      <div className="flex items-start gap-3 p-4 rounded-2xl border border-blue-100 bg-blue-50 mb-6">
        <Info size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-800 space-y-1">
          <p className="font-semibold">How patient consent works</p>
          <p className="text-blue-700">
            Submit a request below with your reason for needing access. The
            patient receives a notification on their HealthChain app and can
            approve or reject it. Once approved, access is recorded on the
            Hyperledger Fabric blockchain and automatically expires at
            discharge.
          </p>
        </div>
      </div>

      {/* ── Success state ── */}
      {submitted ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-green-600" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">
            Access Request Sent
          </h2>
          <p className="text-gray-500 text-sm mb-1">
            Your request has been sent to{" "}
            <strong>
              {patient?.firstName} {patient?.lastName}
            </strong>
            .
          </p>
          <p className="text-gray-400 text-xs mb-1">
            They will receive a notification on their HealthChain app.
          </p>
          {requestId && (
            <p className="text-xs text-gray-400 font-mono mt-2">
              Request ID: {requestId}
            </p>
          )}

          <div className="flex gap-3 justify-center mt-6">
            <button
              onClick={reset}
              className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Request for another patient
            </button>
            <button
              onClick={() =>
                router.push(
                  `/dashboard/doctor/patients?highlight=${patient?.id}`,
                )
              }
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-md"
              style={{
                background: "linear-gradient(135deg, #166534, #15803d)",
              }}
            >
              View Patient <ChevronRight size={14} />
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* ── Step 1: Find patient ── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
              Step 1 — Find Patient
            </p>

            {patient ? (
              // Patient selected
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
                  <p className="text-xs text-gray-500 capitalize">
                    {patient.gender} · {patient.dateOfBirth}
                  </p>
                </div>
                {patient.bloodType && patient.bloodType !== "unknown" && (
                  <span
                    className="text-xs font-bold px-2 py-1 rounded-full text-white flex-shrink-0"
                    style={{
                      background:
                        bloodTypeColor[patient.bloodType] ?? "#6b7280",
                    }}
                  >
                    {patient.bloodType}
                  </span>
                )}
                <button
                  onClick={() => {
                    setPatient(null);
                    setResults([]);
                  }}
                  className="text-xs text-gray-400 hover:text-gray-600 underline flex-shrink-0"
                >
                  Change
                </button>
              </div>
            ) : (
              // Search input
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

          {/* ── Step 2 & 3: Permissions + Reason ── */}
          <div
            className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5 transition-opacity ${!patient ? "opacity-40 pointer-events-none" : ""}`}
          >
            <div>
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

            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
                Step 3 — Reason for Access
              </p>
              <FieldGroup label="Clinical reason (shown to patient)">
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Attending physician for admission — requires access to review full medical history and manage ongoing treatment…"
                  rows={4}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900
                    outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/10 focus:bg-white
                    resize-none placeholder:text-gray-400 transition-all"
                />
                <p className="text-xs text-gray-400 mt-1">
                  {reason.trim().length}/10 characters minimum ·{" "}
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

            {/* Blockchain note */}
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-gray-50 border border-gray-200">
              <Shield
                size={14}
                className="text-gray-400 mt-0.5 flex-shrink-0"
              />
              <p className="text-xs text-gray-500">
                This request will be sent to the patient for approval. Once
                approved, access is recorded on{" "}
                <strong>Hyperledger Fabric</strong> and is automatically revoked
                when the visit ends.
              </p>
            </div>

            {submitError && (
              <div className="flex items-start gap-2 p-3.5 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />{" "}
                {submitError}
              </div>
            )}

            <div className="flex justify-end pt-1 border-t border-gray-100">
              <button
                onClick={handleSubmit}
                disabled={
                  submitting ||
                  !patient ||
                  !reason.trim() ||
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
                    <Loader2 size={15} className="animate-spin" /> Sending
                    request…
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
      )}
    </div>
  );
}
