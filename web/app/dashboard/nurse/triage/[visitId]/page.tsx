"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { visitApi } from "@/lib/api";
import { MinorBadge, ageFromDob } from "@/components/ui/MinorBadge";
import {
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Thermometer,
  Heart,
  Wind,
  Activity,
  Weight,
  Gauge,
  User,
  Droplets,
  Stethoscope,
  ChevronRight,
  Edit3,
  X,
  Save,
  Lock,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Patient {
  firstName: string;
  lastName: string;
  gender: string;
  bloodType: string;
  isMinor?: boolean;
  dateOfBirth?: string;
}

interface Vitals {
  temperature?: number | null;
  bloodPressureSystolic?: number | null;
  bloodPressureDiastolic?: number | null;
  pulseRate?: number | null;
  respiratoryRate?: number | null;
  oxygenSaturation?: number | null;
  weight?: number | null;
  height?: number | null;
  painLevel?: number | null;
  nurseNotes?: string | null;
  recordedAt?: string;
}

interface Visit {
  id: string;
  visitNumber: string;
  chiefComplaint: string;
  priority: string;
  visitType: string;
  status: string;
  wardOrRoom: string | null;
  patientId: string;
  assignedDoctorId: string | null;
  assignedDoctorName?: string | null;
  vitals?: Vitals | null;
  hasVitals?: boolean;
}

interface StaffMember {
  id: string;
  name: string;
}

type Step = "vitals" | "assign-doctor" | "done";
type PageMode = "loading" | "view" | "new-triage";

// ── Helpers ───────────────────────────────────────────────────────────────────
const PRIORITY_STYLE: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  routine: { bg: "#f0fdf4", text: "#15803d", border: "#86efac" },
  urgent: { bg: "#fffbeb", text: "#d97706", border: "#fcd34d" },
  emergency: { bg: "#fef2f2", text: "#dc2626", border: "#fca5a5" },
  critical: { bg: "#fdf4ff", text: "#7c3aed", border: "#d8b4fe" },
};

const BLOOD_TYPE_COLOR: Record<string, string> = {
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

const toNum = (v?: string) =>
  v && v.trim() !== "" ? parseFloat(v) : undefined;
const toInt = (v?: string) =>
  v && v.trim() !== "" ? parseInt(v, 10) : undefined;
const fmt = (v?: number | null, unit = "") => (v != null ? `${v}${unit}` : "—");

function formatTime(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-ZM", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ── Shared atoms ──────────────────────────────────────────────────────────────
function VitalInput({
  icon: Icon,
  label,
  unit,
  value,
  onChange,
  placeholder,
  color = "#166534",
}: {
  icon: React.ElementType;
  label: string;
  unit?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  color?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 uppercase tracking-wide">
        <Icon className="w-3.5 h-3.5" style={{ color }} />
        {label}
      </label>
      <div className="relative">
        <input
          type="number"
          step="any"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 text-sm outline-none transition-all focus:border-green-500 focus:ring-2 focus:ring-green-500/10 placeholder:text-gray-400 tabular-nums"
          style={{ paddingRight: unit ? "3.5rem" : undefined }}
        />
        {unit && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400 pointer-events-none">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

// Read-only vital display row used in view mode
function VitalRow({
  icon: Icon,
  label,
  value,
  color = "#6b7280",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Icon className="w-3.5 h-3.5" style={{ color }} />
        {label}
      </div>
      <span className="text-sm font-semibold text-gray-800 tabular-nums">
        {value}
      </span>
    </div>
  );
}

function PainScale({
  value,
  onChange,
  readOnly = false,
}: {
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
}) {
  const levels = Array.from({ length: 11 }, (_, i) => i);
  const getColor = (n: number) =>
    n === 0
      ? "#10b981"
      : n <= 3
        ? "#84cc16"
        : n <= 5
          ? "#f59e0b"
          : n <= 7
            ? "#f97316"
            : "#ef4444";
  const selected = value !== "" ? parseInt(value, 10) : null;

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block">
        Pain Level
      </label>
      <div className="flex gap-1">
        {levels.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => !readOnly && onChange(String(n))}
            disabled={readOnly}
            className="flex-1 py-2 rounded-lg text-xs font-bold transition-all border"
            style={{
              background: selected === n ? getColor(n) : "transparent",
              color: selected === n ? "#fff" : getColor(n),
              borderColor: getColor(n),
              opacity: selected !== null && selected !== n ? 0.35 : 1,
              cursor: readOnly ? "default" : "pointer",
            }}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-400 text-center">
        {selected === null
          ? "—"
          : selected === 0
            ? "No pain"
            : selected <= 3
              ? "Mild"
              : selected <= 6
                ? "Moderate"
                : selected <= 8
                  ? "Severe"
                  : "Worst possible pain"}
      </p>
    </div>
  );
}

function Steps({
  current,
  vitalsSubmitted,
}: {
  current: Step;
  vitalsSubmitted: boolean;
}) {
  const steps = [
    { key: "vitals", label: "Vital Signs", done: vitalsSubmitted },
    { key: "assign-doctor", label: "Assign Doctor", done: current === "done" },
    { key: "done", label: "Complete", done: false },
  ];
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map(({ key, label, done }, i) => {
        const active = current === key;
        return (
          <div key={key} className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all"
                style={{
                  background: done ? "#166534" : active ? "#166534" : "#f3f4f6",
                  color: done || active ? "#fff" : "#9ca3af",
                }}
              >
                {done ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
              </div>
              <span
                className={`text-sm font-semibold hidden sm:block transition-colors ${active ? "text-gray-900" : done ? "text-gray-500" : "text-gray-400"}`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className="h-px w-5 flex-shrink-0 transition-all"
                style={{ background: done ? "#166534" : "#e5e7eb" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function PatientBanner({
  visit,
  patient,
}: {
  visit: Visit;
  patient: Patient | null;
}) {
  const p = PRIORITY_STYLE[visit.priority] ?? PRIORITY_STYLE.routine;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-5">
      <div
        className="px-5 py-4 flex items-center gap-4"
        style={{ background: "linear-gradient(135deg, #f0fdf4, #dcfce7)" }}
      >
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
          style={{ background: "#166534" }}
        >
          {patient?.firstName?.[0]}
          {patient?.lastName?.[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-gray-900">
              {patient
                ? `${patient.firstName} ${patient.lastName}`
                : "Unknown Patient"}
            </p>
            {patient?.isMinor && (
              <MinorBadge age={patient.dateOfBirth ? ageFromDob(patient.dateOfBirth) : undefined} />
            )}
          </div>
          <p className="text-xs text-gray-500 font-mono mt-0.5">
            {visit.visitNumber}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {patient?.bloodType && patient.bloodType !== "unknown" && (
            <span
              className="text-xs font-bold px-2.5 py-1 rounded-full text-white"
              style={{
                background: BLOOD_TYPE_COLOR[patient.bloodType] ?? "#6b7280",
              }}
            >
              {patient.bloodType}
            </span>
          )}
          <span
            className="text-xs font-bold px-2.5 py-1 rounded-full capitalize"
            style={{
              background: p.bg,
              color: p.text,
              border: `1px solid ${p.border}`,
            }}
          >
            {visit.priority}
          </span>
        </div>
      </div>
      <div className="px-5 py-3 grid grid-cols-2 gap-3 border-t border-gray-100 bg-gray-50/40">
        <div>
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
            Chief Complaint
          </p>
          <p className="text-sm font-semibold text-gray-700 mt-0.5">
            {visit.chiefComplaint || "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
            Visit Type
          </p>
          <p className="text-sm font-semibold text-gray-700 mt-0.5 capitalize">
            {visit.visitType}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── VIEW MODE — read-only triage summary ──────────────────────────────────────
function TriageViewMode({
  visit,
  patient,
  onEdit,
}: {
  visit: Visit;
  patient: Patient | null;
  onEdit: () => void;
}) {
  const v = visit.vitals;

  return (
    <div className="space-y-5">
      {/* Action bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center">
            <Lock className="w-3.5 h-3.5 text-green-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-800">Triage Recorded</p>
            <p className="text-xs text-gray-400">{formatTime(v?.recordedAt)}</p>
          </div>
        </div>
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Edit3 className="w-4 h-4" />
          Edit Triage
        </button>
      </div>

      {/* Vitals summary */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "#16663414" }}
          >
            <Activity className="w-4 h-4" style={{ color: "#166634" }} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-800">Vital Signs</h2>
            <p className="text-xs text-gray-400">
              Recorded vitals for this visit
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
          <div>
            <VitalRow
              icon={Thermometer}
              label="Temperature"
              value={fmt(v?.temperature, " °C")}
              color="#ef4444"
            />
            <VitalRow
              icon={Gauge}
              label="Blood Pressure"
              value={
                v?.bloodPressureSystolic != null
                  ? `${v.bloodPressureSystolic}/${v.bloodPressureDiastolic} mmHg`
                  : "—"
              }
              color="#3b82f6"
            />
            <VitalRow
              icon={Heart}
              label="Pulse Rate"
              value={fmt(v?.pulseRate, " bpm")}
              color="#ec4899"
            />
            <VitalRow
              icon={Wind}
              label="Resp. Rate"
              value={fmt(v?.respiratoryRate, "/min")}
              color="#14b8a6"
            />
          </div>
          <div>
            <VitalRow
              icon={Droplets}
              label="SpO₂"
              value={fmt(v?.oxygenSaturation, "%")}
              color="#0ea5e9"
            />
            <VitalRow
              icon={Weight}
              label="Weight"
              value={fmt(v?.weight, " kg")}
              color="#f59e0b"
            />
            <VitalRow
              icon={User}
              label="Height"
              value={fmt(v?.height, " cm")}
              color="#8b5cf6"
            />
          </div>
        </div>

        {/* Pain level */}
        <div className="mt-4">
          <PainScale
            value={v?.painLevel != null ? String(v.painLevel) : ""}
            onChange={() => {}}
            readOnly
          />
        </div>

        {/* Nurse notes */}
        {v?.nurseNotes && (
          <div className="mt-4 p-4 rounded-xl bg-gray-50 border border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
              Nurse Notes
            </p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {v.nurseNotes}
            </p>
          </div>
        )}
      </div>

      {/* Doctor assignment */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "#2563eb14" }}
          >
            <Stethoscope className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-800">Assigned Doctor</h2>
            <p className="text-xs text-gray-400">Doctor handling this visit</p>
          </div>
        </div>

        {visit.assignedDoctorName ? (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 border border-green-100">
            <div className="w-9 h-9 rounded-full bg-green-700 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
              {visit.assignedDoctorName
                .split(" ")
                .map((n: string) => n[0])
                .join("")
                .slice(0, 2)}
            </div>
            <p className="text-sm font-semibold text-gray-900">
              Dr. {visit.assignedDoctorName}
            </p>
            <CheckCircle2 className="w-4 h-4 text-green-600 ml-auto" />
          </div>
        ) : (
          <div className="flex items-center gap-2 p-4 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            No doctor assigned yet
          </div>
        )}
      </div>
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function TriagePage() {
  const router = useRouter();
  const params = useParams();
  const visitId = Array.isArray(params?.visitId)
    ? params.visitId[0]
    : (params?.visitId as string);

  const [visit, setVisit] = useState<Visit | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Page mode: loading → view (if vitals exist) or new-triage (if not)
  const [pageMode, setPageMode] = useState<PageMode>("loading");

  // Triage flow state
  const [step, setStep] = useState<Step>("vitals");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const [vitals, setVitals] = useState({
    temperature: "",
    bloodPressureSystolic: "",
    bloodPressureDiastolic: "",
    pulseRate: "",
    respiratoryRate: "",
    oxygenSaturation: "",
    weight: "",
    height: "",
    nurseNotes: "",
  });
  const [painLevel, setPainLevel] = useState("");

  const [doctors, setDoctors] = useState<StaffMember[]>([]);
  const [doctorsLoading, setDoctorsLoading] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");

  const setVital = (key: keyof typeof vitals) => (v: string) =>
    setVitals((prev) => ({ ...prev, [key]: v }));

  // ── Load visit ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!visitId) return;

    visitApi
      .getSummary(visitId)
      .then((res) => {
        const data = res.data.data;
        const v: Visit = data.visit;
        setVisit(v);
        setPatient(data.patient ?? null);

        if (v.assignedDoctorId) setSelectedDoctorId(v.assignedDoctorId);

        // Determine mode based on whether vitals already exist
        if (v.hasVitals || v.vitals) {
          setPageMode("view");
        } else {
          setPageMode("new-triage");
        }
      })
      .catch((err) =>
        setError(err.response?.data?.error?.message ?? "Failed to load visit."),
      )
      .finally(() => setLoading(false));
  }, [visitId]);

  // ── Load doctors when entering assign-doctor step ─────────────────────────
  useEffect(() => {
    if (step !== "assign-doctor") return;
    setDoctorsLoading(true);
    visitApi
      .getStaffByRole("practitioner")
      .then((res) => setDoctors(res.data.data ?? []))
      .catch(() => setDoctors([]))
      .finally(() => setDoctorsLoading(false));
  }, [step]);

  // ── Enter edit mode — pre-fill form from existing vitals ──────────────────
  const enterEditMode = () => {
    if (!visit?.vitals) {
      setPageMode("new-triage");
      return;
    }
    const v = visit.vitals;
    setVitals({
      temperature: v.temperature != null ? String(v.temperature) : "",
      bloodPressureSystolic:
        v.bloodPressureSystolic != null ? String(v.bloodPressureSystolic) : "",
      bloodPressureDiastolic:
        v.bloodPressureDiastolic != null
          ? String(v.bloodPressureDiastolic)
          : "",
      pulseRate: v.pulseRate != null ? String(v.pulseRate) : "",
      respiratoryRate:
        v.respiratoryRate != null ? String(v.respiratoryRate) : "",
      oxygenSaturation:
        v.oxygenSaturation != null ? String(v.oxygenSaturation) : "",
      weight: v.weight != null ? String(v.weight) : "",
      height: v.height != null ? String(v.height) : "",
      nurseNotes: v.nurseNotes ?? "",
    });
    setPainLevel(v.painLevel != null ? String(v.painLevel) : "");
    setStep("vitals");
    setSubmitError("");
    setPageMode("new-triage");
  };

  // ── Submit vitals ─────────────────────────────────────────────────────────
  const handleSubmitVitals = async () => {
    setSubmitting(true);
    setSubmitError("");
    try {
      await visitApi.recordVitals(visitId, {
        temperature: toNum(vitals.temperature),
        bloodPressureSystolic: toInt(vitals.bloodPressureSystolic),
        bloodPressureDiastolic: toInt(vitals.bloodPressureDiastolic),
        pulseRate: toInt(vitals.pulseRate),
        respiratoryRate: toInt(vitals.respiratoryRate),
        oxygenSaturation: toNum(vitals.oxygenSaturation),
        weight: toNum(vitals.weight),
        height: toNum(vitals.height),
        painLevel: painLevel !== "" ? parseInt(painLevel, 10) : undefined,
        nurseNotes: vitals.nurseNotes || undefined,
      });
      setStep("assign-doctor");
    } catch (err: any) {
      setSubmitError(
        err.response?.data?.error?.message ?? "Failed to save vitals.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ── Assign doctor ─────────────────────────────────────────────────────────
  const handleAssignDoctor = async () => {
    if (!selectedDoctorId) {
      setSubmitError("Please select a doctor.");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      await visitApi.assignDoctor(visitId, selectedDoctorId);
      setStep("done");
    } catch (err: any) {
      setSubmitError(
        err.response?.data?.error?.message ?? "Failed to assign doctor.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto flex items-center justify-center h-64 gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-green-700" />
        <span className="text-sm text-gray-500">Loading visit…</span>
      </div>
    );
  }

  if (error || !visit) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-red-50 border border-red-100 rounded-2xl p-8 text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="text-sm font-semibold text-red-700">
            {error || "Visit not found"}
          </p>
          <button
            onClick={() => router.back()}
            className="mt-4 text-sm font-semibold text-red-600 underline underline-offset-2"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="max-w-2xl mx-auto"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors text-gray-500"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Nurse Triage</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {pageMode === "view"
              ? "View recorded triage data"
              : "Record vitals and assign a doctor"}
          </p>
        </div>
      </div>

      <PatientBanner visit={visit} patient={patient} />

      {/* ── VIEW MODE ───────────────────────────────────────────────────────── */}
      {pageMode === "view" && (
        <TriageViewMode
          visit={visit}
          patient={patient}
          onEdit={enterEditMode}
        />
      )}

      {/* ── NEW / EDIT TRIAGE MODE ───────────────────────────────────────────── */}
      {pageMode === "new-triage" && (
        <>
          {/* Cancel edit button — only shown when editing existing vitals */}
          {visit.hasVitals && step === "vitals" && (
            <div className="mb-4 flex items-center justify-between px-4 py-2.5 rounded-xl bg-blue-50 border border-blue-100">
              <p className="text-xs text-blue-700 font-medium">
                Editing existing triage record
              </p>
              <button
                onClick={() => {
                  setPageMode("view");
                  setSubmitError("");
                }}
                className="flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900"
              >
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
            </div>
          )}

          <Steps current={step} vitalsSubmitted={step !== "vitals"} />

          {/* Submit error */}
          {submitError && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-100 mb-4">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{submitError}</p>
            </div>
          )}

          {/* ── STEP 1: VITALS ─────────────────────────────────────────────── */}
          {step === "vitals" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "#16663414" }}
                >
                  <Activity className="w-4 h-4" style={{ color: "#166634" }} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-800">
                    Vital Signs
                  </h2>
                  <p className="text-xs text-gray-400">
                    Record all measurable physiological values
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <VitalInput
                  icon={Thermometer}
                  label="Temperature"
                  unit="°C"
                  placeholder="36.6"
                  color="#ef4444"
                  value={vitals.temperature}
                  onChange={setVital("temperature")}
                />
                <VitalInput
                  icon={Gauge}
                  label="BP Systolic"
                  unit="mmHg"
                  placeholder="120"
                  color="#3b82f6"
                  value={vitals.bloodPressureSystolic}
                  onChange={setVital("bloodPressureSystolic")}
                />
                <VitalInput
                  icon={Gauge}
                  label="BP Diastolic"
                  unit="mmHg"
                  placeholder="80"
                  color="#6366f1"
                  value={vitals.bloodPressureDiastolic}
                  onChange={setVital("bloodPressureDiastolic")}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <VitalInput
                  icon={Heart}
                  label="Pulse Rate"
                  unit="bpm"
                  placeholder="72"
                  color="#ec4899"
                  value={vitals.pulseRate}
                  onChange={setVital("pulseRate")}
                />
                <VitalInput
                  icon={Wind}
                  label="Resp. Rate"
                  unit="/min"
                  placeholder="16"
                  color="#14b8a6"
                  value={vitals.respiratoryRate}
                  onChange={setVital("respiratoryRate")}
                />
                <VitalInput
                  icon={Droplets}
                  label="SpO₂"
                  unit="%"
                  placeholder="98"
                  color="#0ea5e9"
                  value={vitals.oxygenSaturation}
                  onChange={setVital("oxygenSaturation")}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <VitalInput
                  icon={Weight}
                  label="Weight"
                  unit="kg"
                  placeholder="70"
                  color="#f59e0b"
                  value={vitals.weight}
                  onChange={setVital("weight")}
                />
                <VitalInput
                  icon={User}
                  label="Height"
                  unit="cm"
                  placeholder="170"
                  color="#8b5cf6"
                  value={vitals.height}
                  onChange={setVital("height")}
                />
              </div>

              <PainScale value={painLevel} onChange={setPainLevel} />

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block">
                  Nurse Notes
                </label>
                <textarea
                  value={vitals.nurseNotes}
                  onChange={(e) => setVital("nurseNotes")(e.target.value)}
                  rows={3}
                  placeholder="Any observations, allergies, or additional notes…"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 text-sm outline-none transition-all focus:border-green-500 focus:ring-2 focus:ring-green-500/10 placeholder:text-gray-400 resize-none"
                />
              </div>

              <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() =>
                    visit.hasVitals
                      ? (setPageMode("view"), setSubmitError(""))
                      : router.back()
                  }
                  className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {visit.hasVitals ? "Cancel" : "Back"}
                </button>
                <button
                  type="button"
                  onClick={handleSubmitVitals}
                  disabled={submitting}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm font-semibold shadow-sm disabled:opacity-60 hover:shadow-md transition-all"
                  style={{
                    background: "linear-gradient(135deg, #166534, #15803d)",
                  }}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Saving…
                    </>
                  ) : (
                    <>
                      {visit.hasVitals ? (
                        <>
                          <Save className="w-4 h-4" /> Update Vitals
                        </>
                      ) : (
                        <>
                          Save Vitals <ChevronRight className="w-4 h-4" />
                        </>
                      )}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: ASSIGN DOCTOR ──────────────────────────────────────── */}
          {step === "assign-doctor" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "#2563eb14" }}
                >
                  <Stethoscope className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-800">
                    Assign Doctor
                  </h2>
                  <p className="text-xs text-gray-400">
                    Select the doctor who will handle this visit
                  </p>
                </div>
              </div>

              {doctorsLoading ? (
                <div className="flex items-center gap-2 py-8 justify-center text-gray-400 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading doctors…
                </div>
              ) : !doctors.length ? (
                <div className="flex items-center gap-2 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  No doctors available in your institution right now.
                </div>
              ) : (
                <div className="space-y-2">
                  {doctors.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => {
                        setSelectedDoctorId(doc.id);
                        setSubmitError("");
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all"
                      style={
                        selectedDoctorId === doc.id
                          ? { background: "#f0fdf4", borderColor: "#86efac" }
                          : { background: "#fafafa", borderColor: "#e5e7eb" }
                      }
                    >
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                        style={{
                          background:
                            selectedDoctorId === doc.id ? "#166534" : "#9ca3af",
                        }}
                      >
                        {doc.name
                          .split(" ")
                          .map((n: string) => n[0])
                          .join("")
                          .slice(0, 2)}
                      </div>
                      <p className="flex-1 text-sm font-semibold text-gray-900">
                        Dr. {doc.name}
                      </p>
                      {selectedDoctorId === doc.id && (
                        <CheckCircle2
                          className="w-4 h-4 flex-shrink-0"
                          style={{ color: "#166534" }}
                        />
                      )}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setStep("vitals");
                    setSubmitError("");
                  }}
                  className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleAssignDoctor}
                  disabled={submitting || !selectedDoctorId}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm font-semibold shadow-sm disabled:opacity-60 hover:shadow-md transition-all"
                  style={{
                    background: "linear-gradient(135deg, #166534, #15803d)",
                  }}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Assigning…
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />{" "}
                      {visit.hasVitals ? "Update Doctor" : "Assign Doctor"}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: DONE ───────────────────────────────────────────────── */}
          {step === "done" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center space-y-5">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
                style={{ background: "rgba(22,101,52,0.1)" }}
              >
                <CheckCircle2
                  className="w-8 h-8"
                  style={{ color: "#166534" }}
                />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {visit.hasVitals ? "Triage Updated" : "Triage Complete"}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Vitals {visit.hasVitals ? "updated" : "recorded"} and doctor
                  assigned. The visit is ready for consultation.
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Patient</span>
                  <span className="font-semibold text-gray-800">
                    {patient?.firstName} {patient?.lastName}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Visit</span>
                  <span className="font-mono font-semibold text-gray-800">
                    {visit.visitNumber}
                  </span>
                </div>
                {selectedDoctorId &&
                  doctors.find((d) => d.id === selectedDoctorId) && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Assigned Doctor</span>
                      <span className="font-semibold text-gray-800">
                        Dr.{" "}
                        {doctors.find((d) => d.id === selectedDoctorId)!.name}
                      </span>
                    </div>
                  )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => router.push("/dashboard/nurse")}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Back to Dashboard
                </button>
                <button
                  onClick={() => router.push("/dashboard/nurse")}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:shadow-md transition-all"
                  style={{
                    background: "linear-gradient(135deg, #166534, #15803d)",
                  }}
                >
                  Next Patient
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
