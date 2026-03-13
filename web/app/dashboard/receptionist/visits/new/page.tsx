"use client";
import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api, visitApi, patientApi } from "@/lib/api";
import {
  Search,
  UserPlus,
  ChevronLeft,
  AlertCircle,
  CheckCircle2,
  Loader2,
  User,
  ClipboardList,
  Activity,
  Clock,
  ChevronRight,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface PatientResult {
  id: string;
  firstName: string;
  lastName: string;
  gender: string;
  blockchainAddress: string;
}

// ── Schema ────────────────────────────────────────────────────────────────────
const visitSchema = z.object({
  chiefComplaint: z
    .string()
    .min(5, "Please describe the reason for visit (min 5 chars)"),
  visitType: z.enum(["outpatient", "inpatient", "emergency", "consultation"]),
  priority: z
    .enum(["routine", "urgent", "emergency", "critical"])
    .default("routine"),
  wardOrRoom: z.string().optional(),
});
type VisitForm = z.infer<typeof visitSchema>;

// ── Priority config ───────────────────────────────────────────────────────────
const PRIORITIES = [
  {
    value: "routine",
    label: "Routine",
    color: "#166534",
    bg: "rgba(22,101,52,0.08)",
  },
  {
    value: "urgent",
    label: "Urgent",
    color: "#d97706",
    bg: "rgba(217,119,6,0.08)",
  },
  {
    value: "emergency",
    label: "Emergency",
    color: "#dc2626",
    bg: "rgba(220,38,38,0.08)",
  },
  {
    value: "critical",
    label: "Critical",
    color: "#7c3aed",
    bg: "rgba(124,58,237,0.08)",
  },
];

const VISIT_TYPES = [
  { value: "outpatient", label: "Outpatient" },
  { value: "inpatient", label: "Inpatient" },
  { value: "emergency", label: "Emergency" },
  { value: "consultation", label: "Consultation" },
];

// ── Step indicator ────────────────────────────────────────────────────────────
function Steps({ current }: { current: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: "Find Patient" },
    { n: 2, label: "Visit Details" },
    { n: 3, label: "Confirm" },
  ];
  return (
    <div className="flex items-center gap-2 mb-7">
      {steps.map(({ n, label }, i) => {
        const done = current > n;
        const active = current === n;
        return (
          <div key={n} className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{
                  background: done ? "#166534" : active ? "#166534" : "#f3f4f6",
                  color: done || active ? "#fff" : "#9ca3af",
                }}
              >
                {done ? <CheckCircle2 className="w-4 h-4" /> : n}
              </div>
              <span
                className={`text-sm font-semibold hidden sm:block ${active ? "text-gray-900" : done ? "text-gray-500" : "text-gray-400"}`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className="h-px w-8 flex-shrink-0"
                style={{ background: current > n ? "#166534" : "#e5e7eb" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Inner component (uses useSearchParams — must be inside Suspense) ──────────
function NewVisitInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: patient search
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<PatientResult[]>([]);
  const [searchError, setSearchError] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<PatientResult | null>(
    null,
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 2: visit form
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<VisitForm>({
    resolver: zodResolver(visitSchema) as Resolver<VisitForm>,
    defaultValues: { visitType: "outpatient", priority: "routine" },
  });
  const priority = watch("priority");

  // Step 3: result
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [result, setResult] = useState<{
    visitId: string;
    visitNumber: string;
  } | null>(null);

  // Pre-select patient from URL (coming from queue page)
  useEffect(() => {
    const patientId = searchParams.get("patientId");
    if (patientId) {
      patientApi
        .getById(patientId)
        .then((res) => {
          setSelectedPatient(res.data.data);
          setStep(2);
        })
        .catch((err) => {
          console.error("Failed to fetch patient by ID:", err);
        });
    }
  }, []);

  // Search patients
  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      setSearchError("");
      try {
        const res = await patientApi.search(q);
        setSearchResults(res.data.data.patients ?? []);
      } catch (err: any) {
        setSearchError("Search failed. Try a patient UUID.");
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  }, []);

  const selectPatient = (p: PatientResult) => {
    setSelectedPatient(p);
    setStep(2);
  };

  const onSubmitVisit = async (data: VisitForm) => {
    if (!selectedPatient) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await visitApi.create({
        patientId: selectedPatient.id,
        visitType: data.visitType,
        chiefComplaint: data.chiefComplaint,
        priority: data.priority,
        wardOrRoom: data.wardOrRoom || undefined,
      });
      setResult(res.data.data);
      setStep(3);
    } catch (err: any) {
      setSubmitError(
        err.response?.data?.error?.message ??
          "Failed to create visit. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    "w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 text-sm outline-none transition-all focus:border-green-500 focus:ring-2 focus:ring-green-500/10 placeholder:text-gray-400";

  return (
    <div
      className="max-w-2xl mx-auto"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() =>
            step > 1 ? setStep((step - 1) as 1 | 2) : router.back()
          }
          className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors text-gray-500"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">New Visit</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Register a patient visit and add them to the nurse queue
          </p>
        </div>
      </div>

      <Steps current={step} />

      {/* ── STEP 1: Find Patient ── */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <Search className="w-4 h-4 text-green-700" />
              <h2 className="text-sm font-bold text-gray-800">
                Search for Patient
              </h2>
            </div>

            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Enter patient UUID or name…"
                className={`${inputCls} pl-10`}
                autoFocus
              />
              {searching && (
                <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
              )}
            </div>

            {/* Encryption note */}
            <p className="text-xs text-gray-400 mt-2.5 flex items-center gap-1.5">
              <AlertCircle className="w-3 h-3" />
              Patient names are encrypted — enter the patient's UUID for exact
              lookup.
            </p>

            {searchError && (
              <p className="text-xs text-red-600 mt-2 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                {searchError}
              </p>
            )}

            {/* Results */}
            {searchResults.length > 0 && (
              <div className="mt-4 space-y-2">
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => selectPatient(p)}
                    className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-gray-100 hover:border-green-200 hover:bg-green-50/30 transition-all text-left group"
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                      style={{ background: "#166534" }}
                    >
                      {p.firstName?.[0]}
                      {p.lastName?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">
                        {p.firstName} {p.lastName}
                      </p>
                      <p className="text-xs text-gray-400 font-mono truncate">
                        {p.id}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-green-600 transition-colors" />
                  </button>
                ))}
              </div>
            )}

            {searchQuery &&
              !searching &&
              searchResults.length === 0 &&
              !searchError && (
                <div className="mt-4 py-8 text-center">
                  <User className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No patients found</p>
                </div>
              )}
          </div>

          {/* Register new option */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-sm text-gray-600 mb-3">
              Patient not in the system yet?
            </p>
            <button
              onClick={() => router.push("/dashboard/receptionist/register")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-green-200 hover:border-green-400 text-sm font-semibold text-green-700 hover:bg-green-50/50 transition-all w-full justify-center"
            >
              <UserPlus className="w-4 h-4" />
              Register New Patient First
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Visit Details ── */}
      {step === 2 && selectedPatient && (
        <form onSubmit={handleSubmit(onSubmitVisit)} className="space-y-4">
          {/* Selected patient card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
              style={{ background: "#166534" }}
            >
              {selectedPatient.firstName?.[0]}
              {selectedPatient.lastName?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-800">
                {selectedPatient.firstName} {selectedPatient.lastName}
              </p>
              <p className="text-xs text-gray-400 font-mono truncate">
                {selectedPatient.id}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedPatient(null);
                setStep(1);
              }}
              className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2"
            >
              Change
            </button>
          </div>

          {/* Visit form */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <ClipboardList className="w-4 h-4 text-green-700" />
              <h2 className="text-sm font-bold text-gray-800">
                Visit Information
              </h2>
            </div>

            {/* Chief complaint */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700">
                Reason for Visit <span className="text-red-500">*</span>
              </label>
              <textarea
                {...register("chiefComplaint")}
                rows={3}
                placeholder="e.g. Patient presents with chest pain and shortness of breath for 2 days…"
                className={`${inputCls} resize-none`}
              />
              {errors.chiefComplaint && (
                <p className="flex items-center gap-1.5 text-xs text-red-600">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.chiefComplaint.message}
                </p>
              )}
            </div>

            {/* Visit Type */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700">
                Visit Type <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {VISIT_TYPES.map((t) => (
                  <label
                    key={t.value}
                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all"
                    style={
                      watch("visitType") === t.value
                        ? {
                            background: "#166534",
                            color: "#fff",
                            borderColor: "#166534",
                          }
                        : {
                            background: "#f9fafb",
                            color: "#6b7280",
                            borderColor: "#e5e7eb",
                          }
                    }
                  >
                    <input
                      type="radio"
                      value={t.value}
                      {...register("visitType")}
                      className="sr-only"
                    />
                    {t.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Priority */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700">
                Priority <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PRIORITIES.map((p) => (
                  <label
                    key={p.value}
                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all"
                    style={
                      priority === p.value
                        ? {
                            background: p.bg,
                            color: p.color,
                            borderColor: p.color,
                          }
                        : {
                            background: "#f9fafb",
                            color: "#6b7280",
                            borderColor: "#e5e7eb",
                          }
                    }
                  >
                    <input
                      type="radio"
                      value={p.value}
                      {...register("priority")}
                      className="sr-only"
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Ward / Room (optional) */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700">
                Ward / Room{" "}
                <span className="text-xs font-normal text-gray-400">
                  (optional)
                </span>
              </label>
              <input
                {...register("wardOrRoom")}
                placeholder="e.g. OPD Ward 3, Room 12B"
                className={inputCls}
              />
            </div>
          </div>

          {submitError && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-100">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{submitError}</p>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pb-6">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm font-semibold shadow-sm disabled:opacity-60 hover:shadow-md transition-all"
              style={{
                background: "linear-gradient(135deg, #166534, #15803d)",
              }}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating Visit…
                </>
              ) : (
                <>
                  <Activity className="w-4 h-4" />
                  Create Visit & Add to Queue
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ── STEP 3: Success ── */}
      {step === 3 && result && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center space-y-5">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
            style={{ background: "rgba(22,101,52,0.1)" }}
          >
            <CheckCircle2 className="w-8 h-8" style={{ color: "#166534" }} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Visit Created!</h2>
            <p className="text-sm text-gray-500 mt-1">
              The patient has been added to the nurse triage queue.
            </p>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 text-left space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Visit Number</span>
              <span className="font-bold font-mono text-gray-800">
                {result.visitNumber}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Patient</span>
              <span className="font-semibold text-gray-800">
                {selectedPatient?.firstName} {selectedPatient?.lastName}
              </span>
            </div>
            <div
              className="flex items-center gap-2 p-3 rounded-xl mt-2"
              style={{
                background: "rgba(22,101,52,0.08)",
                border: "1px solid rgba(22,101,52,0.15)",
              }}
            >
              <Activity
                className="w-4 h-4 flex-shrink-0"
                style={{ color: "#166534" }}
              />
              <p className="text-xs font-medium" style={{ color: "#166534" }}>
                This visit is now live in the nurse triage queue. A nurse will
                be notified to take vitals.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setStep(1);
                setSelectedPatient(null);
                setResult(null);
                setSearchQuery("");
                setSearchResults([]);
              }}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              New Visit
            </button>
            <button
              onClick={() => router.push("/dashboard/receptionist/queue")}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{
                background: "linear-gradient(135deg, #166534, #15803d)",
              }}
            >
              View Queue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Default export: wraps inner component in Suspense ─────────────────────────
// Required because useSearchParams() needs a Suspense boundary in Next.js App Router.
export default function NewVisitPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64 gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-green-700" />
          <span className="text-sm text-gray-500">Loading…</span>
        </div>
      }
    >
      <NewVisitInner />
    </Suspense>
  );
}
