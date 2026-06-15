"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { appointmentApi, practitionersApi, patientApi } from "@/lib/api";
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Plus,
  Search,
  AlertCircle,
  Stethoscope,
  User,
  AlertTriangle,
  Loader2,
  X,
  RotateCcw,
  Inbox,
  MessageSquare,
  Send,
} from "lucide-react";
import {
  format,
  formatDistanceToNow,
  isToday,
  isTomorrow,
  isPast,
} from "date-fns";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Appointment {
  id: string;
  visitNumber: string;
  visitType: string;
  priority: string;
  status: string;
  admissionDate: string;
  chiefComplaint: string;
  admittingDiagnosis?: string; // department hint for patient requests
  wardOrRoom?: string;
  patientId: string;
  patientName: string;
  gender: string;
  bloodType: string;
  assignedDoctorId?: string;
  doctorName?: string;
  createdByPractitionerId?: string | null;
}

interface FollowUp {
  visitId: string;
  visitNumber: string;
  followUpDate: string;
  patientId: string;
  patientName: string;
  gender: string;
  dischargeDiagnosis: string;
  assignedDoctorId?: string;
  doctorName?: string;
  alreadyBooked: boolean;
  daysUntilDue: number;
}

interface Doctor {
  id: string;
  name: string;
  specialization?: string;
}

// ── Config ────────────────────────────────────────────────────────────────────
const PRIORITY = {
  routine: {
    color: "#166534",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    dot: "#16a34a",
    label: "Routine",
  },
  urgent: {
    color: "#d97706",
    bg: "#fffbeb",
    border: "#fde68a",
    dot: "#f59e0b",
    label: "Urgent",
  },
  emergency: {
    color: "#ea580c",
    bg: "#fff7ed",
    border: "#fed7aa",
    dot: "#f97316",
    label: "Emergency",
  },
  critical: {
    color: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca",
    dot: "#ef4444",
    label: "Critical",
  },
} as const;
const getP = (p: string) =>
  PRIORITY[p as keyof typeof PRIORITY] ?? PRIORITY.routine;

// ── Appointment card ──────────────────────────────────────────────────────────
function AppointmentCard({
  appt,
  onConfirm,
  onCancel,
  onReschedule,
}: {
  appt: Appointment;
  onConfirm: (a: Appointment) => void;
  onCancel: (a: Appointment) => void;
  onReschedule: (a: Appointment) => void;
}) {
  const p = getP(appt.priority);
  const date = new Date(appt.admissionDate);
  const overdue = isPast(date) && appt.status === "scheduled";

  return (
    <div
      className="bg-white rounded-2xl border overflow-hidden transition-all hover:shadow-md"
      style={{ borderColor: overdue ? "#fca5a5" : p.border }}
    >
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ background: overdue ? "#fef2f2" : p.bg }}
      >
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: overdue ? "#ef4444" : p.dot }}
          />
          <span
            className="text-xs font-bold"
            style={{ color: overdue ? "#dc2626" : p.color }}
          >
            {overdue ? "Overdue" : p.label}
          </span>
        </div>
        <span className="text-xs font-mono text-gray-400">
          {appt.visitNumber}
        </span>
      </div>

      <div className="px-4 py-4 space-y-3">
        <div>
          <p className="text-sm font-bold text-gray-900">{appt.patientName}</p>
          <p className="text-xs text-gray-500 capitalize mt-0.5">
            {appt.gender} · {appt.bloodType}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <div>
            <p className="text-xs font-semibold text-gray-800">
              {isToday(date)
                ? "Today"
                : isTomorrow(date)
                  ? "Tomorrow"
                  : format(date, "EEE, d MMM yyyy")}
              {" · "}
              {format(date, "h:mm a")}
            </p>
            <p className="text-[10px] text-gray-400">
              {formatDistanceToNow(date, { addSuffix: true })}
            </p>
          </div>
        </div>
        <p className="text-xs text-gray-600 leading-relaxed">
          {appt.chiefComplaint}
        </p>
        {appt.doctorName && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Stethoscope className="w-3 h-3 text-gray-400" />
            Dr. {appt.doctorName}
          </div>
        )}
        {appt.status === "scheduled" && (
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => onConfirm(appt)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-white"
              style={{ background: "linear-gradient(135deg,#166534,#15803d)" }}
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Check In
            </button>
            <button
              onClick={() => onReschedule(appt)}
              className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all"
              title="Reschedule"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onCancel(appt)}
              className="p-2 rounded-xl border border-red-100 text-red-400 hover:text-red-600 hover:bg-red-50 transition-all"
              title="Cancel"
            >
              <XCircle className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Patient Request card ──────────────────────────────────────────────────────
function RequestCard({
  appt,
  onRespond,
  onReject,
}: {
  appt: Appointment;
  onRespond: (a: Appointment) => void;
  onReject: (a: Appointment) => void;
}) {
  const p = getP(appt.priority);

  return (
    <div className="bg-white rounded-2xl border border-amber-200 overflow-hidden transition-all hover:shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50">
        <div className="flex items-center gap-2">
          <Inbox className="w-3.5 h-3.5 text-amber-600" />
          <span className="text-xs font-bold text-amber-700">
            Patient Request
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize"
            style={{ background: p.bg, color: p.color }}
          >
            {p.label}
          </span>
          <span className="text-xs font-mono text-gray-400">
            {appt.visitNumber}
          </span>
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {/* Patient */}
        <div>
          <p className="text-sm font-bold text-gray-900">{appt.patientName}</p>
          <p className="text-xs text-gray-500 capitalize mt-0.5">
            {appt.gender} · {appt.bloodType}
          </p>
        </div>

        {/* Preferred date */}
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">
              Preferred date
            </p>
            <p className="text-xs font-semibold text-gray-800">
              {format(new Date(appt.admissionDate), "EEE, d MMM yyyy · h:mm a")}
            </p>
          </div>
        </div>

        {/* Reason */}
        <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">
            Reason
          </p>
          <p className="text-xs text-gray-700 leading-relaxed">
            {appt.chiefComplaint}
          </p>
        </div>

        {/* Department if set */}
        {appt.admittingDiagnosis && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Stethoscope className="w-3 h-3 text-gray-400" />
            Requested dept:{" "}
            <span className="font-semibold text-gray-700">
              {appt.admittingDiagnosis}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => onRespond(appt)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-white"
            style={{ background: "linear-gradient(135deg,#166534,#15803d)" }}
          >
            <Send className="w-3.5 h-3.5" /> Confirm & Schedule
          </button>
          <button
            onClick={() => onReject(appt)}
            className="p-2 rounded-xl border border-red-100 text-red-400 hover:text-red-600 hover:bg-red-50 transition-all"
            title="Reject request"
          >
            <XCircle className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Respond to request modal ──────────────────────────────────────────────────
// Receptionist picks confirmed date/time and optionally assigns a doctor.
// On submit it calls reschedule (to update the date) — the visit stays scheduled.
function RespondModal({
  appt,
  doctors,
  onClose,
  onResponded,
}: {
  appt: Appointment;
  doctors: Doctor[];
  onClose: () => void;
  onResponded: () => void;
}) {
  const [confirmedDate, setConfirmedDate] = useState(
    format(new Date(appt.admissionDate), "yyyy-MM-dd'T'HH:mm"),
  );
  const [selectedDoctor, setSelectedDoctor] = useState(
    appt.assignedDoctorId ?? "",
  );
  const [wardOrRoom, setWardOrRoom] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!confirmedDate) {
      setError("Select a confirmed date and time.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      // Step 1 — update the date to the confirmed one (and optionally assign doctor)
      await appointmentApi.reschedule(appt.id, {
        appointmentDate: new Date(confirmedDate).toISOString(),
        assignedDoctorId: selectedDoctor || undefined,
        reason: "Confirmed by receptionist",
      });

      // Step 2 — if wardOrRoom provided, patch it in (reuse confirm endpoint without changing status)
      // The visit stays "scheduled" — it becomes a normal appointment at this point.
      // The APT-REQ- prefix remains but it will show up in upcoming appointments.
      onResponded();
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ?? "Failed to confirm appointment.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
        style={{ fontFamily: "'DM Sans',sans-serif" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              Confirm Appointment Request
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">{appt.patientName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:bg-gray-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Patient preferred date — read-only reference */}
          <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-100">
            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-600 mb-1">
              Patient's preferred date
            </p>
            <p className="text-sm font-semibold text-amber-900">
              {format(new Date(appt.admissionDate), "EEE, d MMM yyyy · h:mm a")}
            </p>
            <p className="text-xs text-amber-700 mt-1 italic">
              "{appt.chiefComplaint}"
            </p>
          </div>

          {/* Confirmed date */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1.5">
              Confirmed Date & Time *
            </label>
            <input
              type="datetime-local"
              value={confirmedDate}
              onChange={(e) => setConfirmedDate(e.target.value)}
              min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/10 transition-all"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              You can adjust the date/time to match your schedule. The patient
              should be informed.
            </p>
          </div>

          {/* Assign doctor */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1.5">
              Assign Doctor{" "}
              <span className="normal-case font-normal">(optional)</span>
            </label>
            <select
              value={selectedDoctor}
              onChange={(e) => setSelectedDoctor(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 outline-none focus:border-green-500 transition-all bg-white"
            >
              <option value="">Unassigned — assign on arrival</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  Dr. {d.name}
                  {d.specialization ? ` · ${d.specialization}` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Ward/room */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1.5">
              Ward / Room{" "}
              <span className="normal-case font-normal">(optional)</span>
            </label>
            <input
              value={wardOrRoom}
              onChange={(e) => setWardOrRoom(e.target.value)}
              placeholder="e.g. OPD Room 3"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 outline-none focus:border-green-500 transition-all"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-50 border border-red-100">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#166534,#15803d)" }}
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            {submitting ? "Confirming…" : "Confirm Appointment"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Book Appointment Modal ─────────────────────────────────────────────────────
function BookModal({
  prefill,
  doctors,
  onClose,
  onBooked,
}: {
  prefill?: FollowUp | null;
  doctors: Doctor[];
  onClose: () => void;
  onBooked: () => void;
}) {
  const [patientSearch, setPatientSearch] = useState("");
  const [patientResults, setPatientResults] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(
    prefill ? { id: prefill.patientId, name: prefill.patientName } : null,
  );
  const [searching, setSearching] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(
    prefill?.assignedDoctorId ?? "",
  );
  const [apptDate, setApptDate] = useState(
    prefill?.followUpDate
      ? format(new Date(prefill.followUpDate), "yyyy-MM-dd'T'HH:mm")
      : "",
  );
  const [visitType, setVisitType] = useState("consultation");
  const [chiefComplaint, setChiefComplaint] = useState(
    prefill?.dischargeDiagnosis
      ? `Follow-up: ${prefill.dischargeDiagnosis}`
      : "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientSearch.trim() || selectedPatient) return;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await patientApi.search(patientSearch);
        setPatientResults(res.data.data?.patients ?? []);
      } catch {
        setPatientResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [patientSearch, selectedPatient]);

  const handleBook = async () => {
    if (!selectedPatient) {
      setError("Select a patient.");
      return;
    }
    if (!apptDate) {
      setError("Select a date and time.");
      return;
    }
    if (chiefComplaint.trim().length < 5) {
      setError("Reason must be at least 5 characters.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await appointmentApi.book({
        patientId: selectedPatient.id,
        appointmentDate: new Date(apptDate).toISOString(),
        visitType: visitType as any,
        chiefComplaint: chiefComplaint.trim(),
        assignedDoctorId: selectedDoctor || undefined,
        originVisitId: prefill?.visitId,
      });
      onBooked();
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ?? "Failed to book appointment.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col"
        style={{ fontFamily: "'DM Sans',sans-serif", maxHeight: "90vh" }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              Book Appointment
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {prefill
                ? `Follow-up for ${prefill.patientName}`
                : "Schedule a new appointment"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:bg-gray-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {!prefill && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1.5">
                Patient *
              </label>
              {selectedPatient ? (
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-green-50 border border-green-200">
                  <User className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <p className="text-sm font-semibold text-green-800 flex-1">
                    {selectedPatient.firstName} {selectedPatient.lastName}
                  </p>
                  <button
                    onClick={() => {
                      setSelectedPatient(null);
                      setPatientSearch("");
                    }}
                    className="text-green-400 hover:text-green-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    placeholder="Search by name or national ID…"
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 outline-none focus:border-green-500 placeholder:text-gray-400 transition-all"
                  />
                  {patientResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-100 shadow-lg z-10 overflow-hidden">
                      {patientResults.slice(0, 5).map((p) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setSelectedPatient(p);
                            setPatientSearch("");
                            setPatientResults([]);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left border-b border-gray-50 last:border-0"
                        >
                          <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-[10px] font-bold text-green-700">
                              {p.firstName?.[0]}
                              {p.lastName?.[0]}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {p.firstName} {p.lastName}
                            </p>
                            <p className="text-xs text-gray-400">
                              {p.nationalId}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {searching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-gray-400" />
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1.5">
              Date & Time *
            </label>
            <input
              type="datetime-local"
              value={apptDate}
              onChange={(e) => setApptDate(e.target.value)}
              min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 outline-none focus:border-green-500 transition-all"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-2">
              Visit Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {["consultation", "outpatient", "inpatient", "emergency"].map(
                (vt) => (
                  <button
                    key={vt}
                    onClick={() => setVisitType(vt)}
                    className="py-2 rounded-xl border text-xs font-semibold capitalize transition-all"
                    style={
                      visitType === vt
                        ? {
                            background: "#f0fdf4",
                            borderColor: "#16a34a",
                            color: "#166534",
                          }
                        : {
                            background: "#fafafa",
                            borderColor: "#f1f5f9",
                            color: "#6b7280",
                          }
                    }
                  >
                    {vt}
                  </button>
                ),
              )}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1.5">
              Reason / Chief Complaint *
            </label>
            <textarea
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              rows={2}
              placeholder="Why is the patient coming in?"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 outline-none focus:border-green-500 resize-none placeholder:text-gray-400 transition-all"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1.5">
              Assign Doctor{" "}
              <span className="normal-case font-normal text-gray-400">
                (optional)
              </span>
            </label>
            <select
              value={selectedDoctor}
              onChange={(e) => setSelectedDoctor(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 outline-none focus:border-green-500 transition-all bg-white"
            >
              <option value="">Unassigned — assign on arrival</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  Dr. {d.name}
                  {d.specialization ? ` · ${d.specialization}` : ""}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-50 border border-red-100">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleBook}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#166534,#15803d)" }}
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Calendar className="w-4 h-4" />
            )}
            {submitting ? "Booking…" : "Book Appointment"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Confirm arrival modal ─────────────────────────────────────────────────────
function ConfirmModal({
  appt,
  doctors,
  onClose,
  onConfirmed,
}: {
  appt: Appointment;
  doctors: Doctor[];
  onClose: () => void;
  onConfirmed: (visitId: string) => void;
}) {
  const [selectedDoctor, setSelectedDoctor] = useState(
    appt.assignedDoctorId ?? "",
  );
  const [wardOrRoom, setWardOrRoom] = useState(appt.wardOrRoom ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await appointmentApi.confirm(appt.id, {
        assignedDoctorId: selectedDoctor || undefined,
        wardOrRoom: wardOrRoom || undefined,
      });
      onConfirmed(appt.id);
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ?? "Failed to check in patient.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
        style={{ fontFamily: "'DM Sans',sans-serif" }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              Check In Patient
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Confirm arrival and start visit
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:bg-gray-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="px-4 py-3 rounded-xl bg-green-50 border border-green-100">
            <p className="text-sm font-bold text-green-900">
              {appt.patientName}
            </p>
            <p className="text-xs text-green-700 mt-0.5">
              {appt.chiefComplaint}
            </p>
            <p className="text-[10px] text-green-600 mt-1">
              Scheduled:{" "}
              {format(new Date(appt.admissionDate), "d MMM yyyy · h:mm a")}
            </p>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1.5">
              Assign Doctor
            </label>
            <select
              value={selectedDoctor}
              onChange={(e) => setSelectedDoctor(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 outline-none focus:border-green-500 transition-all bg-white"
            >
              <option value="">Unassigned</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  Dr. {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1.5">
              Ward / Room{" "}
              <span className="normal-case font-normal">(optional)</span>
            </label>
            <input
              value={wardOrRoom}
              onChange={(e) => setWardOrRoom(e.target.value)}
              placeholder="e.g. OPD Room 3"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 outline-none focus:border-green-500 transition-all"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-50 border border-red-100">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#166534,#15803d)" }}
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            {submitting ? "Checking in…" : "Confirm Arrival"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AppointmentsPage() {
  const router = useRouter();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [requests, setRequests] = useState<Appointment[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"upcoming" | "requests" | "followups">(
    "upcoming",
  );
  const [search, setSearch] = useState("");

  // Modals
  const [showBook, setShowBook] = useState(false);
  const [bookPrefill, setBookPrefill] = useState<FollowUp | null>(null);
  const [confirming, setConfirming] = useState<Appointment | null>(null);
  const [responding, setResponding] = useState<Appointment | null>(null);
  const [cancelling, setCancelling] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [apptRes, followRes, docRes] = await Promise.all([
        appointmentApi.list({ status: "scheduled" }),
        appointmentApi.followUps(60),
        practitionersApi.list({ role: "practitioner", limit: 100 }),
      ]);

      const all: Appointment[] = apptRes.data?.data?.appointments ?? [];

      // Split: patient requests have APT-REQ- prefix and no createdByPractitionerId
      setRequests(
        all.filter(
          (a) =>
            a.visitNumber.startsWith("APT-REQ-") && !a.createdByPractitionerId,
        ),
      );
      setAppointments(
        all.filter(
          (a) =>
            !a.visitNumber.startsWith("APT-REQ-") || a.createdByPractitionerId,
        ),
      );

      setFollowUps(followRes.data?.data?.followUps ?? []);
      const rawDocs = docRes.data?.data?.practitioners ?? [];
      setDoctors(
        rawDocs.map((d: any) => ({
          id: d.id,
          name: `${d.firstName} ${d.lastName}`,
          specialization: d.specialization,
        })),
      );
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ?? "Failed to load appointments.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    const iv = setInterval(() => load(true), 60_000);
    return () => clearInterval(iv);
  }, [load]);

  const handleCancelConfirm = async () => {
    if (!cancelling || cancelReason.trim().length < 5) return;
    setCancelLoading(true);
    try {
      await appointmentApi.cancel(cancelling.id, cancelReason.trim());
      setCancelling(null);
      setCancelReason("");
      showToast("Appointment cancelled");
      load(true);
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? "Failed to cancel.");
    } finally {
      setCancelLoading(false);
    }
  };

  const filteredAppts = appointments.filter(
    (a) =>
      !search ||
      [a.patientName, a.visitNumber, a.chiefComplaint, a.doctorName ?? ""].some(
        (f) => f.toLowerCase().includes(search.toLowerCase()),
      ),
  );
  const filteredRequests = requests.filter(
    (a) =>
      !search ||
      [a.patientName, a.visitNumber, a.chiefComplaint].some((f) =>
        f.toLowerCase().includes(search.toLowerCase()),
      ),
  );
  const filteredFollowUps = followUps.filter(
    (f) =>
      !search ||
      [f.patientName, f.visitNumber, f.dischargeDiagnosis ?? ""].some((s) =>
        s.toLowerCase().includes(search.toLowerCase()),
      ),
  );

  const todayCount = appointments.filter((a) =>
    isToday(new Date(a.admissionDate)),
  ).length;
  const overdueCount = appointments.filter((a) =>
    isPast(new Date(a.admissionDate)),
  ).length;
  const pendingFollowUps = followUps.filter((f) => !f.alreadyBooked).length;

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif" }} className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1
            className="text-2xl font-bold text-gray-900"
            style={{ fontFamily: "'Playfair Display',serif" }}
          >
            Appointments
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {format(new Date(), "EEEE, d MMMM yyyy")}
            {!loading && todayCount > 0 && (
              <>
                {" "}
                ·{" "}
                <span className="text-green-700 font-medium">
                  {todayCount} today
                </span>
              </>
            )}
            {!loading && overdueCount > 0 && (
              <>
                {" "}
                ·{" "}
                <span className="text-red-600 font-medium">
                  {overdueCount} overdue
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="p-2.5 rounded-xl border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-white transition-all disabled:opacity-40"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
            />
          </button>
          <button
            onClick={() => {
              setBookPrefill(null);
              setShowBook(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:shadow-md transition-all"
            style={{ background: "linear-gradient(135deg,#166534,#15803d)" }}
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Book Appointment</span>
            <span className="sm:hidden">Book</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: "Upcoming",
            value: appointments.length,
            color: "#166534",
            bg: "linear-gradient(135deg,#f0fdf4,#dcfce7)",
            border: "#bbf7d0",
          },
          {
            label: "Requests",
            value: requests.length,
            color: "#d97706",
            bg: "linear-gradient(135deg,#fffbeb,#fef3c7)",
            border: "#fde68a",
          },
          {
            label: "Today",
            value: todayCount,
            color: "#1d4ed8",
            bg: "linear-gradient(135deg,#eff6ff,#dbeafe)",
            border: "#bfdbfe",
          },
          {
            label: "Follow-ups Due",
            value: pendingFollowUps,
            color: "#9333ea",
            bg: "linear-gradient(135deg,#faf5ff,#ede9fe)",
            border: "#ddd6fe",
          },
        ].map(({ label, value, color, bg, border }) => (
          <div
            key={label}
            className="rounded-2xl border px-4 py-3"
            style={{ background: bg, borderColor: border }}
          >
            <p
              className="text-2xl font-extrabold tabular-nums"
              style={{ color }}
            >
              {loading ? (
                <span className="inline-block w-8 h-6 rounded bg-black/5 animate-pulse" />
              ) : (
                value
              )}
            </p>
            <p
              className="text-xs font-bold mt-0.5"
              style={{ color, opacity: 0.7 }}
            >
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* Tabs + search */}
      <div className="flex items-center gap-3 flex-wrap min-w-0">
        <div className="flex gap-1 p-1 rounded-xl bg-gray-100/80 flex-shrink-0">
          {(
            [
              { key: "upcoming", label: "Upcoming" },
              {
                key: "requests",
                label: `Requests${requests.length > 0 ? ` (${requests.length})` : ""}`,
              },
              {
                key: "followups",
                label: `Follow-ups${pendingFollowUps > 0 ? ` (${pendingFollowUps})` : ""}`,
              },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all relative"
              style={
                tab === key
                  ? {
                      background: "#fff",
                      color: "#166534",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                    }
                  : { color: "#6b7280" }
              }
            >
              {label}
              {/* Red dot on Requests tab if there are pending requests */}
              {key === "requests" &&
                requests.length > 0 &&
                tab !== "requests" && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500" />
                )}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patient, doctor, reason…"
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 outline-none focus:border-green-500 placeholder:text-gray-400 transition-all"
          />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-50 border border-red-100">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 flex-1">{error}</p>
          <button
            onClick={() => load(false)}
            className="text-xs font-semibold text-red-700 underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Upcoming tab ── */}
      {tab === "upcoming" &&
        (loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-52 rounded-2xl bg-white border border-gray-100 animate-pulse"
              />
            ))}
          </div>
        ) : filteredAppts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-6 h-6 text-green-300" />
            </div>
            <p className="text-sm font-semibold text-gray-500">
              No upcoming appointments
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Book a new appointment or check follow-ups due
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredAppts.map((a) => (
              <AppointmentCard
                key={a.id}
                appt={a}
                onConfirm={setConfirming}
                onCancel={setCancelling}
                onReschedule={() => {}}
              />
            ))}
          </div>
        ))}

      {/* ── Requests tab ── */}
      {tab === "requests" &&
        (loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-52 rounded-2xl bg-white border border-gray-100 animate-pulse"
              />
            ))}
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
              <Inbox className="w-6 h-6 text-amber-300" />
            </div>
            <p className="text-sm font-semibold text-gray-500">
              No pending requests
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Patient-submitted appointment requests will appear here
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-100">
              <Inbox className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-800">
                <span className="font-bold">
                  {filteredRequests.length} pending request
                  {filteredRequests.length !== 1 ? "s" : ""}
                </span>{" "}
                from patients. Review and confirm a date/time for each.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredRequests.map((a) => (
                <RequestCard
                  key={a.id}
                  appt={a}
                  onRespond={setResponding}
                  onReject={setCancelling}
                />
              ))}
            </div>
          </>
        ))}

      {/* ── Follow-ups tab ── */}
      {tab === "followups" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            [...Array(3)].map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 px-5 py-4 border-b border-gray-50 animate-pulse"
              >
                <div className="w-10 h-10 rounded-full bg-gray-100 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-40 bg-gray-100 rounded" />
                  <div className="h-3 w-56 bg-gray-100 rounded" />
                </div>
              </div>
            ))
          ) : filteredFollowUps.length === 0 ? (
            <div className="py-16 text-center">
              <CheckCircle2 className="w-10 h-10 text-green-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-500">
                No follow-ups due
              </p>
              <p className="text-xs text-gray-400 mt-1">
                All discharged patients have been booked or have no follow-up
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filteredFollowUps.map((f) => (
                <div
                  key={f.visitId}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-green-700">
                      {f.patientName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-gray-900">
                        {f.patientName}
                      </p>
                      {f.alreadyBooked ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-100">
                          Already booked
                        </span>
                      ) : f.daysUntilDue <= 3 ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100 flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          Due in {f.daysUntilDue}d
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                          Due in {f.daysUntilDue}d
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {f.dischargeDiagnosis ?? "—"} · Follow-up{" "}
                      {format(new Date(f.followUpDate), "d MMM yyyy")}
                    </p>
                    {f.doctorName && (
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Dr. {f.doctorName}
                      </p>
                    )}
                  </div>
                  {!f.alreadyBooked && (
                    <button
                      onClick={() => {
                        setBookPrefill(f);
                        setShowBook(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex-shrink-0"
                      style={{
                        background: "linear-gradient(135deg,#166534,#15803d)",
                      }}
                    >
                      <Plus className="w-3 h-3" /> Book
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Modals ── */}
      {showBook && (
        <BookModal
          prefill={bookPrefill}
          doctors={doctors}
          onClose={() => {
            setShowBook(false);
            setBookPrefill(null);
          }}
          onBooked={() => {
            setShowBook(false);
            setBookPrefill(null);
            showToast("Appointment booked successfully");
            load(true);
          }}
        />
      )}

      {confirming && (
        <ConfirmModal
          appt={confirming}
          doctors={doctors}
          onClose={() => setConfirming(null)}
          onConfirmed={(visitId) => {
            setConfirming(null);
            showToast("Patient checked in — visit is now active");
            load(true);
            router.push(`/dashboard/receptionist/visits/${visitId}`);
          }}
        />
      )}

      {/* Respond to patient request */}
      {responding && (
        <RespondModal
          appt={responding}
          doctors={doctors}
          onClose={() => setResponding(null)}
          onResponded={() => {
            setResponding(null);
            showToast("Appointment confirmed — patient will be notified");
            load(true);
          }}
        />
      )}

      {/* Cancel / reject */}
      {cancelling && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
            style={{ fontFamily: "'DM Sans',sans-serif" }}
          >
            <h3 className="text-base font-bold text-gray-900 mb-1">
              {cancelling.visitNumber.startsWith("APT-REQ-")
                ? "Reject Request"
                : "Cancel Appointment"}
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              {cancelling.visitNumber.startsWith("APT-REQ-")
                ? "Rejecting request from "
                : "Cancelling appointment for "}
              <span className="font-semibold">{cancelling.patientName}</span>
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              placeholder="Reason (min. 5 characters)"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 outline-none focus:border-red-400 resize-none placeholder:text-gray-400 transition-all mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setCancelling(null);
                  setCancelReason("");
                }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50 transition-all"
              >
                Keep
              </button>
              <button
                onClick={handleCancelConfirm}
                disabled={cancelLoading || cancelReason.trim().length < 5}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg,#dc2626,#b91c1c)",
                }}
              >
                {cancelLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                {cancelling.visitNumber.startsWith("APT-REQ-")
                  ? "Reject"
                  : "Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-5 py-3.5 rounded-2xl bg-white border border-green-100 shadow-xl">
          <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
          <p className="text-sm font-semibold text-gray-800">{toast}</p>
        </div>
      )}
    </div>
  );
}
