"use client";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { appointmentApi, practitionersApi, patientApi } from "@/lib/api";
import {
  Calendar,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Plus,
  Search,
  AlertCircle,
  Stethoscope,
  AlertTriangle,
  Loader2,
  X,
  RotateCcw,
  Inbox,
  Send,
  Clock,
} from "lucide-react";
import { format, formatDistanceToNow, isToday, isTomorrow, isPast } from "date-fns";
import {
  Page,
  PageHeader,
  Card,
  KpiCard,
  KpiGrid,
  Field,
  Input,
  Select,
  Textarea,
  Button,
  Pill,
  Avatar,
  Banner,
  EmptyState,
  SkeletonRow,
  SkeletonBlock,
  SectionLabel,
  SearchInput,
  SegmentedControl,
  Modal,
  Toast,
  hoverRow,
  TONES,
  type Tone,
} from "@/components/dashboard/ui";

/* ==========================================================================
   Appointments.

   Three streams share this page and come from two endpoints:
     · Upcoming  — staff-booked appointments
     · Requests  — patient-submitted, identified by an APT-REQ- visit number
                   with no createdByPractitionerId (see the split in load())
     · Follow-ups — discharge records carrying a followUpDate, not yet booked

   A "request" becomes a normal appointment by being rescheduled to a
   confirmed date; there is no separate accept endpoint.
   ========================================================================== */

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
const PRIORITY: Record<string, { tone: Tone; label: string }> = {
  routine: { tone: "success", label: "Routine" },
  urgent: { tone: "urgent", label: "Urgent" },
  emergency: { tone: "critical", label: "Emergency" },
  critical: { tone: "accent", label: "Critical" },
};
const getP = (p: string) => PRIORITY[p] ?? PRIORITY.routine;

/** Human-readable day label — "Today"/"Tomorrow" beat a date the reader must parse. */
function dayLabel(date: Date) {
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "EEE, d MMM yyyy");
}

/* Shared card chrome for both appointment and request cards. */
function StripCard({
  tone,
  overdue,
  header,
  children,
}: {
  tone: Tone;
  overdue?: boolean;
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = TONES[overdue ? "critical" : tone];
  return (
    <div
      style={{
        background: "var(--surface-card)",
        border: "1px solid var(--hc-border)",
        borderRadius: "var(--r-md)",
        boxShadow: "var(--elev-1)",
        overflow: "hidden",
        transition: "box-shadow var(--dur-base) var(--ease-standard)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "var(--elev-2)")}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "var(--elev-1)")}
    >
      <div
        className="flex items-center justify-between"
        style={{ gap: 10, padding: "9px 14px", background: t.tint }}
      >
        {header}
      </div>
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {children}
      </div>
    </div>
  );
}

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
  // A scheduled appointment whose time has passed needs chasing, so overdue
  // overrides the priority colour entirely.
  const overdue = isPast(date) && appt.status === "scheduled";
  const t = TONES[overdue ? "critical" : p.tone];

  return (
    <StripCard
      tone={p.tone}
      overdue={overdue}
      header={
        <>
          <span className="inline-flex items-center" style={{ gap: 7 }}>
            <span
              style={{ width: 7, height: 7, borderRadius: "50%", background: t.dot }}
            />
            <span style={{ font: "700 11.5px/1 var(--font-sans)", color: t.ink }}>
              {overdue ? "Overdue" : p.label}
            </span>
          </span>
          <span style={{ font: "500 11px/1 var(--font-mono)", color: "var(--text-muted)" }}>
            {appt.visitNumber}
          </span>
        </>
      }
    >
      <div className="flex items-center" style={{ gap: 11 }}>
        <Avatar name={appt.patientName} size={34} seed={0} />
        <div className="min-w-0 flex flex-col" style={{ gap: 3 }}>
          <p
            className="truncate"
            style={{
              margin: 0,
              font: "700 13.5px/1 var(--font-sans)",
              color: "var(--text-primary)",
            }}
          >
            {appt.patientName}
          </p>
          <p
            style={{
              margin: 0,
              font: "400 11.5px/1 var(--font-sans)",
              color: "var(--text-muted)",
              textTransform: "capitalize",
            }}
          >
            {appt.gender} · {appt.bloodType}
          </p>
        </div>
      </div>

      <div className="flex items-start" style={{ gap: 9 }}>
        <Calendar
          className="w-3.5 h-3.5 flex-shrink-0"
          style={{ color: "var(--text-muted)", marginTop: 1 }}
        />
        <div className="min-w-0 flex flex-col" style={{ gap: 3 }}>
          <p
            style={{
              margin: 0,
              font: "600 12.5px/1.3 var(--font-sans)",
              color: "var(--text-primary)",
            }}
          >
            {dayLabel(date)} · {format(date, "h:mm a")}
          </p>
          <p
            style={{ margin: 0, font: "400 11px/1 var(--font-sans)", color: "var(--text-muted)" }}
          >
            {formatDistanceToNow(date, { addSuffix: true })}
          </p>
        </div>
      </div>

      <p
        style={{
          margin: 0,
          font: "400 12.5px/1.5 var(--font-sans)",
          color: "var(--text-secondary)",
        }}
      >
        {appt.chiefComplaint}
      </p>

      {appt.doctorName && (
        <span
          className="inline-flex items-center"
          style={{ gap: 6, font: "500 12px/1 var(--font-sans)", color: "var(--text-secondary)" }}
        >
          <Stethoscope className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
          Dr. {appt.doctorName}
        </span>
      )}

      {appt.status === "scheduled" && (
        <div className="flex items-center" style={{ gap: 8, paddingTop: 2 }}>
          <Button
            variant="primary"
            size="sm"
            icon={CheckCircle2}
            full
            onClick={() => onConfirm(appt)}
          >
            Check in
          </Button>
          <Button icon={RotateCcw} size="sm" onClick={() => onReschedule(appt)} />
          <Button variant="danger" icon={XCircle} size="sm" onClick={() => onCancel(appt)} />
        </div>
      )}
    </StripCard>
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
    <StripCard
      tone="urgent"
      header={
        <>
          <span className="inline-flex items-center" style={{ gap: 7 }}>
            <Inbox className="w-3.5 h-3.5" style={{ color: "var(--urgent-ink)" }} />
            <span
              style={{ font: "700 11.5px/1 var(--font-sans)", color: "var(--urgent-ink)" }}
            >
              Patient request
            </span>
          </span>
          <span className="inline-flex items-center" style={{ gap: 8 }}>
            <Pill tone={p.tone} style={{ height: 18, fontSize: 10 }}>
              {p.label}
            </Pill>
            <span
              style={{ font: "500 11px/1 var(--font-mono)", color: "var(--text-muted)" }}
            >
              {appt.visitNumber}
            </span>
          </span>
        </>
      }
    >
      <div className="flex items-center" style={{ gap: 11 }}>
        <Avatar name={appt.patientName} size={34} seed={3} />
        <div className="min-w-0 flex flex-col" style={{ gap: 3 }}>
          <p
            className="truncate"
            style={{
              margin: 0,
              font: "700 13.5px/1 var(--font-sans)",
              color: "var(--text-primary)",
            }}
          >
            {appt.patientName}
          </p>
          <p
            style={{
              margin: 0,
              font: "400 11.5px/1 var(--font-sans)",
              color: "var(--text-muted)",
              textTransform: "capitalize",
            }}
          >
            {appt.gender} · {appt.bloodType}
          </p>
        </div>
      </div>

      <div className="flex items-start" style={{ gap: 9 }}>
        <Calendar
          className="w-3.5 h-3.5 flex-shrink-0"
          style={{ color: "var(--urgent-ink)", marginTop: 1 }}
        />
        <div className="min-w-0 flex flex-col" style={{ gap: 4 }}>
          <SectionLabel>Preferred date</SectionLabel>
          <p
            style={{
              margin: 0,
              font: "600 12.5px/1.3 var(--font-sans)",
              color: "var(--text-primary)",
            }}
          >
            {format(new Date(appt.admissionDate), "EEE, d MMM yyyy · h:mm a")}
          </p>
        </div>
      </div>

      <div
        style={{
          padding: 12,
          borderRadius: "var(--r-sm)",
          background: "var(--surface-sunken)",
          display: "flex",
          flexDirection: "column",
          gap: 5,
        }}
      >
        <SectionLabel>Reason</SectionLabel>
        <p
          style={{
            margin: 0,
            font: "400 12.5px/1.5 var(--font-sans)",
            color: "var(--text-secondary)",
          }}
        >
          {appt.chiefComplaint}
        </p>
      </div>

      {appt.admittingDiagnosis && (
        <span
          className="inline-flex items-center"
          style={{ gap: 6, font: "400 12px/1 var(--font-sans)", color: "var(--text-muted)" }}
        >
          <Stethoscope className="w-3 h-3" />
          Requested dept:
          <span style={{ font: "600 12px/1 var(--font-sans)", color: "var(--text-secondary)" }}>
            {appt.admittingDiagnosis}
          </span>
        </span>
      )}

      <div className="flex items-center" style={{ gap: 8, paddingTop: 2 }}>
        <Button variant="primary" size="sm" icon={Send} full onClick={() => onRespond(appt)}>
          Confirm & schedule
        </Button>
        <Button variant="danger" icon={XCircle} size="sm" onClick={() => onReject(appt)} />
      </div>
    </StripCard>
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
  const [selectedDoctor, setSelectedDoctor] = useState(appt.assignedDoctorId ?? "");
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
      /*
       * Rescheduling to the confirmed date is what turns a request into a
       * normal appointment — the APT-REQ- prefix stays, but once a
       * practitioner is attached it stops being filtered into the Requests
       * tab and shows up under Upcoming.
       */
      await appointmentApi.reschedule(appt.id, {
        appointmentDate: new Date(confirmedDate).toISOString(),
        assignedDoctorId: selectedDoctor || undefined,
        reason: "Confirmed by receptionist",
      });
      onResponded();
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? "Failed to confirm appointment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Confirm appointment request"
      subtitle={appt.patientName}
      icon={Inbox}
      tone="urgent"
      onClose={onClose}
      footer={
        <>
          <Button full onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            full
            icon={CheckCircle2}
            loading={submitting}
            onClick={handleSubmit}
          >
            {submitting ? "Confirming…" : "Confirm"}
          </Button>
        </>
      }
    >
      {/* Patient's preferred date — read-only reference */}
      <div
        style={{
          padding: "12px 16px",
          borderRadius: "var(--r-sm)",
          background: "var(--amber-050)",
          border: "1px solid var(--amber-100)",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <SectionLabel style={{ color: "var(--urgent-ink)" }}>
          Patient's preferred date
        </SectionLabel>
        <p
          style={{
            margin: 0,
            font: "600 13.5px/1 var(--font-sans)",
            color: "var(--urgent-ink)",
          }}
        >
          {format(new Date(appt.admissionDate), "EEE, d MMM yyyy · h:mm a")}
        </p>
        <p
          style={{
            margin: 0,
            font: "400 12px/1.5 var(--font-sans)",
            color: "var(--urgent-ink)",
            opacity: 0.85,
            fontStyle: "italic",
          }}
        >
          “{appt.chiefComplaint}”
        </p>
      </div>

      <Field
        label="Confirmed date & time"
        required
        hint="Adjust to match your schedule — the patient should be informed."
      >
        <Input
          type="datetime-local"
          value={confirmedDate}
          onChange={(e) => setConfirmedDate(e.target.value)}
          min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
        />
      </Field>

      <Field label="Assign doctor" hint="Optional — can be assigned on arrival.">
        <Select
          value={selectedDoctor}
          onChange={(e) => setSelectedDoctor(e.target.value)}
        >
          <option value="">Unassigned — assign on arrival</option>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>
              Dr. {d.name}
              {d.specialization ? ` · ${d.specialization}` : ""}
            </option>
          ))}
        </Select>
      </Field>

      {error && (
        <Banner tone="critical" icon={AlertCircle}>
          {error}
        </Banner>
      )}
    </Modal>
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
  const [selectedDoctor, setSelectedDoctor] = useState(prefill?.assignedDoctorId ?? "");
  const [apptDate, setApptDate] = useState(
    prefill?.followUpDate
      ? format(new Date(prefill.followUpDate), "yyyy-MM-dd'T'HH:mm")
      : "",
  );
  const [visitType, setVisitType] = useState("consultation");
  const [chiefComplaint, setChiefComplaint] = useState(
    prefill?.dischargeDiagnosis ? `Follow-up: ${prefill.dischargeDiagnosis}` : "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced patient lookup; skipped once a patient is chosen.
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
        // Links the new appointment back to the discharge it follows up on.
        originVisitId: prefill?.visitId,
      });
      onBooked();
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? "Failed to book appointment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Book appointment"
      subtitle={
        prefill ? `Follow-up for ${prefill.patientName}` : "Schedule a new appointment"
      }
      icon={Calendar}
      width={520}
      scroll
      onClose={onClose}
      footer={
        <>
          <Button full onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            full
            icon={Calendar}
            loading={submitting}
            onClick={handleBook}
          >
            {submitting ? "Booking…" : "Book appointment"}
          </Button>
        </>
      }
    >
      {/* A follow-up already knows its patient, so the picker is hidden. */}
      {!prefill && (
        <Field label="Patient" required>
          {selectedPatient ? (
            <div
              className="flex items-center"
              style={{
                gap: 11,
                padding: "10px 12px",
                borderRadius: "var(--r-sm)",
                background: "var(--brand-tint)",
                border: "1px solid var(--green-100)",
              }}
            >
              <Avatar
                name={`${selectedPatient.firstName ?? ""} ${selectedPatient.lastName ?? selectedPatient.name ?? ""}`}
                size={30}
                seed={0}
              />
              <p
                className="flex-1 min-w-0 truncate"
                style={{
                  margin: 0,
                  font: "600 13px/1 var(--font-sans)",
                  color: "var(--green-800)",
                }}
              >
                {selectedPatient.firstName
                  ? `${selectedPatient.firstName} ${selectedPatient.lastName}`
                  : selectedPatient.name}
              </p>
              <Button
                variant="ghost"
                size="sm"
                icon={X}
                onClick={() => {
                  setSelectedPatient(null);
                  setPatientSearch("");
                }}
                style={{ width: 26 }}
              />
            </div>
          ) : (
            <div className="relative">
              <Search
                className="absolute w-4 h-4"
                style={{
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-muted)",
                }}
              />
              <Input
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                placeholder="Search by name or national ID…"
                style={{ paddingLeft: 36, paddingRight: 36 }}
              />
              {searching && (
                <Loader2
                  className="absolute w-4 h-4 animate-spin"
                  style={{
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-muted)",
                  }}
                />
              )}
              {patientResults.length > 0 && (
                <div
                  className="absolute left-0 right-0 z-10"
                  style={{
                    top: "calc(100% + 4px)",
                    background: "var(--surface-card)",
                    borderRadius: "var(--r-sm)",
                    border: "1px solid var(--hc-border)",
                    boxShadow: "var(--elev-2)",
                    overflow: "hidden",
                  }}
                >
                  {patientResults.slice(0, 5).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelectedPatient(p);
                        setPatientSearch("");
                        setPatientResults([]);
                      }}
                      className="w-full flex items-center text-left"
                      style={{
                        gap: 11,
                        padding: "10px 12px",
                        border: "none",
                        borderBottom: "1px solid var(--border-faint)",
                        background: "transparent",
                        cursor: "pointer",
                      }}
                      {...hoverRow}
                    >
                      <Avatar name={`${p.firstName} ${p.lastName}`} size={28} seed={0} />
                      <span className="flex-1 min-w-0 flex flex-col" style={{ gap: 3 }}>
                        <span
                          className="truncate"
                          style={{
                            font: "600 13px/1 var(--font-sans)",
                            color: "var(--text-primary)",
                          }}
                        >
                          {p.firstName} {p.lastName}
                        </span>
                        <span
                          style={{
                            font: "400 11px/1 var(--font-mono)",
                            color: "var(--text-muted)",
                          }}
                        >
                          {p.nationalId ?? "—"}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </Field>
      )}

      <Field label="Date & time" required>
        <Input
          type="datetime-local"
          value={apptDate}
          onChange={(e) => setApptDate(e.target.value)}
          min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
        />
      </Field>

      <Field label="Visit type">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
            gap: 8,
          }}
        >
          {["consultation", "outpatient", "inpatient", "emergency"].map((vt) => {
            const on = visitType === vt;
            return (
              <button
                key={vt}
                onClick={() => setVisitType(vt)}
                style={{
                  height: 38,
                  borderRadius: "var(--r-sm)",
                  border: `1px solid ${on ? "var(--brand)" : "var(--hc-border)"}`,
                  background: on ? "var(--brand-tint)" : "var(--surface-sunken)",
                  color: on ? "var(--green-800)" : "var(--text-secondary)",
                  font: `${on ? 700 : 500} 12.5px/1 var(--font-sans)`,
                  textTransform: "capitalize",
                  cursor: "pointer",
                  transition: "all var(--dur-fast) var(--ease-standard)",
                }}
              >
                {vt}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Reason / chief complaint" required>
        <Textarea
          value={chiefComplaint}
          onChange={(e) => setChiefComplaint(e.target.value)}
          rows={2}
          placeholder="Why is the patient coming in?"
          style={{ minHeight: 68 }}
        />
      </Field>

      <Field label="Assign doctor" hint="Optional — can be assigned on arrival.">
        <Select value={selectedDoctor} onChange={(e) => setSelectedDoctor(e.target.value)}>
          <option value="">Unassigned — assign on arrival</option>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>
              Dr. {d.name}
              {d.specialization ? ` · ${d.specialization}` : ""}
            </option>
          ))}
        </Select>
      </Field>

      {error && (
        <Banner tone="critical" icon={AlertCircle}>
          {error}
        </Banner>
      )}
    </Modal>
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
  const [selectedDoctor, setSelectedDoctor] = useState(appt.assignedDoctorId ?? "");
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
      setError(err.response?.data?.error?.message ?? "Failed to check in patient.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Check in patient"
      subtitle="Confirm arrival and start visit"
      icon={CheckCircle2}
      onClose={onClose}
      footer={
        <>
          <Button full onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            full
            icon={CheckCircle2}
            loading={submitting}
            onClick={handleConfirm}
          >
            {submitting ? "Checking in…" : "Confirm arrival"}
          </Button>
        </>
      }
    >
      <div
        style={{
          padding: "12px 16px",
          borderRadius: "var(--r-sm)",
          background: "var(--brand-tint)",
          border: "1px solid var(--green-100)",
          display: "flex",
          flexDirection: "column",
          gap: 5,
        }}
      >
        <p
          style={{ margin: 0, font: "700 13.5px/1 var(--font-sans)", color: "var(--green-800)" }}
        >
          {appt.patientName}
        </p>
        <p
          style={{
            margin: 0,
            font: "400 12.5px/1.5 var(--font-sans)",
            color: "var(--green-800)",
            opacity: 0.9,
          }}
        >
          {appt.chiefComplaint}
        </p>
        <p
          className="inline-flex items-center"
          style={{
            margin: 0,
            gap: 5,
            font: "400 11.5px/1 var(--font-sans)",
            color: "var(--green-800)",
            opacity: 0.8,
          }}
        >
          <Clock className="w-3 h-3" />
          Scheduled {format(new Date(appt.admissionDate), "d MMM yyyy · h:mm a")}
        </p>
      </div>

      <Field label="Assign doctor">
        <Select value={selectedDoctor} onChange={(e) => setSelectedDoctor(e.target.value)}>
          <option value="">Unassigned</option>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>
              Dr. {d.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Ward / room" hint="Optional">
        <Input
          value={wardOrRoom}
          onChange={(e) => setWardOrRoom(e.target.value)}
          placeholder="e.g. OPD Room 3"
        />
      </Field>

      {error && (
        <Banner tone="critical" icon={AlertCircle}>
          {error}
        </Banner>
      )}
    </Modal>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
type Tab = "upcoming" | "requests" | "followups";

export default function AppointmentsPage() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [requests, setRequests] = useState<Appointment[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("upcoming");
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

      /*
       * One endpoint returns both streams. A patient-submitted request carries
       * the APT-REQ- prefix AND no createdByPractitionerId; once a
       * practitioner is attached (by confirming it) the same record moves to
       * the Upcoming list, which is why both filters test the pair.
       */
      setRequests(
        all.filter(
          (a) => a.visitNumber.startsWith("APT-REQ-") && !a.createdByPractitionerId,
        ),
      );
      setAppointments(
        all.filter(
          (a) => !a.visitNumber.startsWith("APT-REQ-") || a.createdByPractitionerId,
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
      setError(err.response?.data?.error?.message ?? "Failed to load appointments.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useLiveRefresh(() => load(true));

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
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

  const q = search.toLowerCase();
  const filteredAppts = appointments.filter(
    (a) =>
      !search ||
      [a.patientName, a.visitNumber, a.chiefComplaint, a.doctorName ?? ""].some((f) =>
        f.toLowerCase().includes(q),
      ),
  );
  const filteredRequests = requests.filter(
    (a) =>
      !search ||
      [a.patientName, a.visitNumber, a.chiefComplaint].some((f) =>
        f.toLowerCase().includes(q),
      ),
  );
  const filteredFollowUps = followUps.filter(
    (f) =>
      !search ||
      [f.patientName, f.visitNumber, f.dischargeDiagnosis ?? ""].some((s) =>
        s.toLowerCase().includes(q),
      ),
  );

  const todayCount = appointments.filter((a) => isToday(new Date(a.admissionDate))).length;
  const overdueCount = appointments.filter((a) => isPast(new Date(a.admissionDate))).length;
  const pendingFollowUps = followUps.filter((f) => !f.alreadyBooked).length;

  const isRejection = cancelling?.visitNumber.startsWith("APT-REQ-") ?? false;

  /* Card grids share one responsive template. */
  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
    gap: 14,
  };

  return (
    <Page>
      <PageHeader
        eyebrow="Front desk"
        title="Appointments"
        subtitle={
          <>
            {format(new Date(), "EEEE, d MMMM yyyy")}
            {!loading && todayCount > 0 && (
              <span style={{ color: "var(--green-700)", fontWeight: 600 }}>
                {" "}
                · {todayCount} today
              </span>
            )}
            {!loading && overdueCount > 0 && (
              <span style={{ color: "var(--critical-ink)", fontWeight: 600 }}>
                {" "}
                · {overdueCount} overdue
              </span>
            )}
          </>
        }
        actions={
          <>
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => {
                setBookPrefill(null);
                setShowBook(true);
              }}
            >
              Book appointment
            </Button>
            <Button
              icon={RefreshCw}
              onClick={() => load(true)}
              disabled={refreshing}
              style={{ padding: 0, width: 38 }}
            />
          </>
        }
      />

      <KpiGrid>
        <KpiCard
          label="Upcoming"
          value={appointments.length}
          sub="Scheduled appointments"
          icon={Calendar}
          tone="brand"
          loading={loading}
          onClick={() => setTab("upcoming")}
        />
        <KpiCard
          label="Requests"
          value={requests.length}
          sub="Awaiting confirmation"
          icon={Inbox}
          tone="urgent"
          loading={loading}
          onClick={() => setTab("requests")}
        />
        <KpiCard
          label="Today"
          value={todayCount}
          sub="Expected today"
          icon={Clock}
          tone="info"
          loading={loading}
        />
        <KpiCard
          label="Follow-ups due"
          value={pendingFollowUps}
          sub="Not yet booked"
          icon={RotateCcw}
          tone="accent"
          loading={loading}
          onClick={() => setTab("followups")}
        />
      </KpiGrid>

      {/* Tabs + search */}
      <div className="flex items-center justify-between flex-wrap" style={{ gap: 12 }}>
        <SegmentedControl<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: "upcoming", label: "Upcoming", count: appointments.length },
            { value: "requests", label: "Requests", count: requests.length },
            { value: "followups", label: "Follow-ups", count: pendingFollowUps },
          ]}
        />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search patient, doctor, reason…"
          icon={Search}
          clearIcon={X}
          style={{ flex: "1 1 200px", maxWidth: 320 }}
        />
      </div>

      {error && (
        <Banner
          tone="critical"
          icon={AlertCircle}
          action={
            <Button variant="ghost" size="sm" onClick={() => load(false)}>
              Retry
            </Button>
          }
        >
          {error}
        </Banner>
      )}

      {/* ── Upcoming tab ── */}
      {tab === "upcoming" &&
        (loading ? (
          <div style={gridStyle}>
            {[...Array(6)].map((_, i) => (
              <SkeletonBlock key={i} height={208} radius="var(--r-md)" />
            ))}
          </div>
        ) : filteredAppts.length === 0 ? (
          <Card>
            <EmptyState
              icon={Calendar}
              title="No upcoming appointments"
              message="Book a new appointment, or check which follow-ups are due."
              pad={64}
            />
          </Card>
        ) : (
          <div style={gridStyle}>
            {filteredAppts.map((a) => (
              <AppointmentCard
                key={a.id}
                appt={a}
                onConfirm={setConfirming}
                onCancel={setCancelling}
                /* Rescheduling is the same operation as confirming a request
                   — both write a new date via appointmentApi.reschedule. */
                onReschedule={setResponding}
              />
            ))}
          </div>
        ))}

      {/* ── Requests tab ── */}
      {tab === "requests" &&
        (loading ? (
          <div style={gridStyle}>
            {[...Array(3)].map((_, i) => (
              <SkeletonBlock key={i} height={260} radius="var(--r-md)" />
            ))}
          </div>
        ) : filteredRequests.length === 0 ? (
          <Card>
            <EmptyState
              icon={Inbox}
              title="No pending requests"
              message="Patient-submitted appointment requests will appear here."
              tone="urgent"
              pad={64}
            />
          </Card>
        ) : (
          <>
            <Banner tone="urgent" icon={Inbox}>
              <strong>
                {filteredRequests.length} pending request
                {filteredRequests.length !== 1 ? "s" : ""}
              </strong>{" "}
              from patients. Review and confirm a date and time for each.
            </Banner>
            <div style={gridStyle}>
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
        <Card>
          {loading ? (
            [...Array(4)].map((_, i) => <SkeletonRow key={i} />)
          ) : filteredFollowUps.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No follow-ups due"
              message="All discharged patients have been booked, or have no follow-up scheduled."
              pad={64}
            />
          ) : (
            filteredFollowUps.map((f, i) => (
              <div
                key={f.visitId}
                className="flex items-center"
                style={{
                  gap: 14,
                  padding: "12px 20px",
                  borderBottom: "1px solid var(--border-faint)",
                  transition: "background var(--dur-fast) var(--ease-standard)",
                }}
                {...hoverRow}
              >
                <Avatar name={f.patientName} seed={i} />

                <div className="flex-1 min-w-0 flex flex-col" style={{ gap: 5 }}>
                  <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
                    <span
                      className="truncate"
                      style={{
                        font: "700 13.5px/1 var(--font-sans)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {f.patientName}
                    </span>
                    {/* Urgency of a follow-up is entirely about how soon it is due. */}
                    {f.alreadyBooked ? (
                      <Pill tone="success" style={{ height: 18, fontSize: 10 }}>
                        Already booked
                      </Pill>
                    ) : f.daysUntilDue <= 3 ? (
                      <Pill
                        tone="critical"
                        icon={AlertTriangle}
                        style={{ height: 18, fontSize: 10 }}
                      >
                        Due in {f.daysUntilDue}d
                      </Pill>
                    ) : (
                      <Pill tone="urgent" style={{ height: 18, fontSize: 10 }}>
                        Due in {f.daysUntilDue}d
                      </Pill>
                    )}
                  </div>

                  <span
                    className="truncate"
                    style={{
                      font: "400 12.5px/1 var(--font-sans)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {f.dischargeDiagnosis ?? "—"} · follow-up{" "}
                    {format(new Date(f.followUpDate), "d MMM yyyy")}
                    {f.doctorName ? ` · Dr. ${f.doctorName}` : ""}
                  </span>
                </div>

                {!f.alreadyBooked && (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={Plus}
                    onClick={() => {
                      setBookPrefill(f);
                      setShowBook(true);
                    }}
                  >
                    Book
                  </Button>
                )}
              </div>
            ))
          )}
        </Card>
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
        <Modal
          title={isRejection ? "Reject request" : "Cancel appointment"}
          subtitle={cancelling.patientName}
          icon={XCircle}
          tone="critical"
          width={400}
          onClose={() => {
            setCancelling(null);
            setCancelReason("");
          }}
          footer={
            <>
              <Button
                full
                onClick={() => {
                  setCancelling(null);
                  setCancelReason("");
                }}
              >
                Keep
              </Button>
              <Button
                variant="primary"
                full
                icon={XCircle}
                loading={cancelLoading}
                disabled={cancelReason.trim().length < 5}
                onClick={handleCancelConfirm}
                style={{
                  background: "var(--coral-600)",
                  boxShadow: "none",
                }}
              >
                {isRejection ? "Reject" : "Cancel"}
              </Button>
            </>
          }
        >
          <Field
            label="Reason"
            required
            hint="At least 5 characters — the patient sees this."
          >
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              placeholder={
                isRejection
                  ? "Why is this request being rejected?"
                  : "Why is this appointment being cancelled?"
              }
            />
          </Field>
        </Modal>
      )}

      {toast && <Toast message={toast} icon={CheckCircle2} />}
    </Page>
  );
}
