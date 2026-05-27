"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { visitApi, patientApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import {
  ChevronLeft,
  AlertCircle,
  Loader2,
  Zap,
  AlertTriangle,
  Clock,
  User,
  FileText,
  Send,
  ShieldAlert,
  Stethoscope,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type Priority = "routine" | "urgent" | "emergency" | "critical";
type VisitType = "outpatient" | "inpatient" | "emergency" | "consultation";

const PRIORITY = [
  {
    value: "routine" as Priority,
    label: "Routine",
    desc: "Scheduled, non-urgent",
    color: "#166534",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    icon: Clock,
  },
  {
    value: "urgent" as Priority,
    label: "Urgent",
    desc: "Needs prompt attention",
    color: "#d97706",
    bg: "#fffbeb",
    border: "#fde68a",
    icon: AlertTriangle,
  },
  {
    value: "emergency" as Priority,
    label: "Emergency",
    desc: "Immediate care required",
    color: "#ea580c",
    bg: "#fff7ed",
    border: "#fed7aa",
    icon: AlertTriangle,
  },
  {
    value: "critical" as Priority,
    label: "Critical",
    desc: "Life-threatening — direct to doctor",
    color: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca",
    icon: Zap,
  },
] as const;

const VISIT_TYPES: { value: VisitType; label: string; desc: string }[] = [
  {
    value: "outpatient",
    label: "Outpatient",
    desc: "Patient visits and leaves same day",
  },
  {
    value: "inpatient",
    label: "Inpatient",
    desc: "Patient admitted for overnight stay",
  },
  { value: "emergency", label: "Emergency", desc: "Unscheduled urgent care" },
  {
    value: "consultation",
    label: "Consultation",
    desc: "Specialist opinion or review",
  },
];

// ── Skip-triage priorities — doctor assumes triage responsibility ─────────────
const SKIP_TRIAGE: Priority[] = ["emergency", "critical"];

export default function NewVisitPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();

  const patientId = searchParams.get("patientId") ?? "";

  const [patient, setPatient] = useState<any>(null);
  const [loadingPatient, setLoadingPatient] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [priority, setPriority] = useState<Priority>("routine");
  const [visitType, setVisitType] = useState<VisitType>("outpatient");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [wardOrRoom, setWardOrRoom] = useState("");
  const [notes, setNotes] = useState("");

  // Load patient info
  useEffect(() => {
    if (!patientId) {
      setLoadingPatient(false);
      return;
    }
    patientApi
      .getById(patientId)
      .then((res) => setPatient(res.data.data))
      .catch(() => setError("Could not load patient."))
      .finally(() => setLoadingPatient(false));
  }, [patientId]);

  // Auto-set visit type when priority changes
  useEffect(() => {
    if (priority === "emergency" || priority === "critical") {
      setVisitType("emergency");
    }
  }, [priority]);

  const skipsTriage = SKIP_TRIAGE.includes(priority);

  const handleSubmit = async () => {
    if (!chiefComplaint.trim() || chiefComplaint.trim().length < 5) {
      setError("Chief complaint must be at least 5 characters.");
      return;
    }
    if (!patientId) {
      setError("No patient selected.");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      // Single call — backend handles visit creation, self-assignment,
      // and placeholder vitals for emergency/critical priority.
      const res = await visitApi.doctorAdmit({
        patientId,
        visitType,
        priority,
        chiefComplaint: chiefComplaint.trim(),
        admittingDiagnosis: notes.trim() || undefined,
        wardOrRoom: wardOrRoom.trim() || undefined,
      });

      const { visitId } = res.data.data;

      router.replace(`/dashboard/doctor/visit/${visitId}`);
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? "Failed to create visit.");
      setSubmitting(false);
    }
  };

  // ── Loading patient ───────────────────────────────────────────────────────
  if (loadingPatient) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader2 size={28} className="animate-spin text-green-700" />
      </div>
    );
  }

  if (!patient && !loadingPatient) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <AlertCircle size={40} className="text-red-400 mx-auto mb-3" />
        <p className="text-gray-700 font-semibold">
          {patientId ? "Patient not found" : "No patient selected"}
        </p>
        <p className="text-gray-400 text-sm mt-1 max-w-xs mx-auto">
          {patientId
            ? "This patient may no longer be active or you may not have access."
            : "Open this page from a patient\'s profile to create a visit."}
        </p>
        <button
          onClick={() => router.back()}
          className="mt-4 text-green-700 text-sm font-medium hover:underline"
        >
          ← Go back
        </button>
      </div>
    );
  }

  const selectedPriority = PRIORITY.find((p) => p.value === priority)!;

  return (
    <div
      className="max-w-2xl mx-auto"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5 transition-colors"
      >
        <ChevronLeft size={16} /> Back
      </button>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
            <Stethoscope className="w-4 h-4 text-green-700" />
          </div>
          <h1
            className="text-xl font-bold text-gray-900"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            New Visit
          </h1>
        </div>
        <p className="text-sm text-gray-500 ml-12">
          Creating visit for{" "}
          <span className="font-semibold text-gray-800">
            {patient?.firstName} {patient?.lastName}
          </span>
        </p>
      </div>

      <div className="space-y-4">
        {/* ── Skip-triage warning ─────────────────────────────────────────── */}
        {skipsTriage && (
          <div
            className="flex items-start gap-3 px-4 py-3.5 rounded-2xl border"
            style={{ background: "#fef2f2", borderColor: "#fecaca" }}
          >
            <ShieldAlert className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-800">Triage bypassed</p>
              <p className="text-xs text-red-700 mt-0.5 leading-relaxed">
                <span className="capitalize">{priority}</span> priority visits
                go directly to the doctor. This visit will not appear in the
                nurse triage queue. You are assuming responsibility for initial
                assessment.
              </p>
            </div>
          </div>
        )}

        {/* ── Priority ────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
            Priority *
          </p>
          <div className="grid grid-cols-2 gap-2">
            {PRIORITY.map(
              ({ value, label, desc, color, bg, border, icon: Icon }) => {
                const active = priority === value;
                return (
                  <button
                    key={value}
                    onClick={() => setPriority(value)}
                    className="flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-all"
                    style={
                      active
                        ? {
                            background: bg,
                            borderColor: color,
                            borderWidth: 1.5,
                          }
                        : { background: "#fafafa", borderColor: "#f1f5f9" }
                    }
                  >
                    <Icon
                      className="w-4 h-4 flex-shrink-0 mt-0.5"
                      style={{ color: active ? color : "#9ca3af" }}
                    />
                    <div>
                      <p
                        className="text-sm font-bold"
                        style={{ color: active ? color : "#374151" }}
                      >
                        {label}
                      </p>
                      <p
                        className="text-[10px] leading-tight mt-0.5"
                        style={{
                          color: active ? color : "#9ca3af",
                          opacity: active ? 0.8 : 1,
                        }}
                      >
                        {desc}
                      </p>
                    </div>
                  </button>
                );
              },
            )}
          </div>
        </div>

        {/* ── Visit type ──────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
            Visit Type *
          </p>
          <div className="grid grid-cols-2 gap-2">
            {VISIT_TYPES.map(({ value, label, desc }) => {
              const active = visitType === value;
              return (
                <button
                  key={value}
                  onClick={() => setVisitType(value)}
                  className="flex flex-col gap-0.5 px-4 py-3 rounded-xl border text-left transition-all"
                  style={
                    active
                      ? {
                          background: "#eff6ff",
                          borderColor: "#2563eb",
                          borderWidth: 1.5,
                        }
                      : { background: "#fafafa", borderColor: "#f1f5f9" }
                  }
                >
                  <p
                    className="text-sm font-bold"
                    style={{ color: active ? "#1d4ed8" : "#374151" }}
                  >
                    {label}
                  </p>
                  <p
                    className="text-[10px] leading-tight"
                    style={{ color: active ? "#3b82f6" : "#9ca3af" }}
                  >
                    {desc}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Chief complaint ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-3">
            Chief Complaint *
          </label>
          <textarea
            value={chiefComplaint}
            onChange={(e) => setChiefComplaint(e.target.value)}
            rows={3}
            placeholder="Why is the patient presenting? What are the primary symptoms?"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/10 resize-none placeholder:text-gray-400 transition-all"
          />
          <p className="text-[10px] text-gray-400 mt-1.5 text-right">
            {chiefComplaint.length} chars
          </p>
        </div>

        {/* ── Initial notes (optional) ────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1">
            Initial Clinical Notes{" "}
            <span className="normal-case font-normal text-gray-400">
              (optional)
            </span>
          </label>
          <p className="text-[10px] text-gray-400 mb-3">
            Preliminary findings, relevant history, working diagnosis. Goes into
            admitting diagnosis field.
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="e.g. 45yo male with 2hr chest pain radiating to left arm, diaphoresis, BP 160/100…"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/10 resize-none placeholder:text-gray-400 transition-all"
          />
        </div>

        {/* ── Ward / Room (optional) ──────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1.5">
            Ward / Room{" "}
            <span className="normal-case font-normal text-gray-400">
              (optional)
            </span>
          </label>
          <input
            value={wardOrRoom}
            onChange={(e) => setWardOrRoom(e.target.value)}
            placeholder="e.g. Emergency Bay 2, Ward 4 Bed 12"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/10 placeholder:text-gray-400 transition-all"
          />
        </div>

        {/* ── Summary before submit ───────────────────────────────────────── */}
        <div
          className="flex items-start gap-3 px-4 py-3.5 rounded-2xl border"
          style={{
            background: selectedPriority.bg,
            borderColor: selectedPriority.border,
          }}
        >
          <FileText
            className="w-4 h-4 flex-shrink-0 mt-0.5"
            style={{ color: selectedPriority.color }}
          />
          <div>
            <p
              className="text-xs font-bold"
              style={{ color: selectedPriority.color }}
            >
              Visit summary
            </p>
            <p
              className="text-xs mt-0.5"
              style={{ color: selectedPriority.color, opacity: 0.8 }}
            >
              <span className="font-semibold capitalize">{visitType}</span>
              {" · "}
              <span className="font-semibold capitalize">{priority}</span>{" "}
              priority
              {skipsTriage
                ? " · Bypasses nurse triage"
                : " · Goes through nurse triage"}
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-50 border border-red-100">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting || chiefComplaint.trim().length < 5}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold text-white transition-all disabled:opacity-40 hover:shadow-lg hover:-translate-y-px"
          style={{ background: "linear-gradient(135deg, #166534, #15803d)" }}
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          {submitting ? "Creating visit…" : "Create Visit & Open Workspace"}
        </button>

        <p className="text-center text-xs text-gray-400 pb-6">
          Visit will be assigned to you and appear in your queue immediately.
        </p>
      </div>
    </div>
  );
}
