"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";
import { patientApi, permissionApi } from "@/lib/api";
import { groupHistoryRecords, historyVisibility } from "@/lib/history-access";
import EmergencyOverrideModal from "@/components/EmergencyOverrideModal";
import {
  AlertCircle,
  Loader2,
  Clock,
  ShieldCheck,
  ShieldX,
  ShieldAlert,
  RefreshCw,
  Send,
  XCircle,
  Stethoscope,
  Pill,
  ChevronDown,
  ChevronRight,
  Calendar,
  Heart,
  Thermometer,
  Wind,
  Droplets,
  Gauge,
  Weight,
  User as UserIcon,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Ban,
  Building2,
  Lock,
  Unlock,
} from "lucide-react";
import {
  Card,
  TONES,
  type Tone,
} from "@/components/dashboard/ui";

/* ==========================================================================
   Patient history tab.

   The patient's full record across every visit — including visits at OTHER
   institutions, which is what AwayInstitutionSection handles. Those are
   grouped by institution after authorization. Patient consent is patient-wide;
   referral and emergency grants retain their existing source restrictions.
   ========================================================================== */

// ── Types ─────────────────────────────────────────────────────────────────────

interface PatientDemographics {
  emergencyOverrideEnabled?: boolean;
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  gender: string;
  dateOfBirth: string;
  phoneNumber: string;
  email?: string | null;
  bloodType: string;
  maritalStatus?: string | null;
  occupation?: string | null;
  blockchainAddress: string;
}
interface VitalSigns {
  id: string;
  temperature?: string | null;
  bloodPressureSystolic?: number | null;
  bloodPressureDiastolic?: number | null;
  pulseRate?: number | null;
  respiratoryRate?: number | null;
  oxygenSaturation?: number | null;
  weight?: string | null;
  height?: string | null;
  painLevel?: number | null;
  nurseNotes?: string | null;
  recordedAt: string;
}
interface Consultation {
  id: string;
  chiefComplaint: string;
  historyOfPresentIllness?: string | null;
  physicalExamination?: string | null;
  clinicalFindings?: string | null;
  assessment?: string | null;
  plan?: string | null;
  followUpInstructions?: string | null;
  nextAppointmentDate?: string | null;
}
interface Diagnosis {
  id: string;
  icdCode: string;
  diagnosisName: string;
  diagnosisType: string;
  severity?: string | null;
  notes?: string | null;
}
interface PrescriptionItem {
  id: string;
  medicationName: string;
  genericName?: string | null;
  strength: string;
  dosageForm: string;
  dose: string;
  frequency: string;
  route: string;
  duration: string;
  quantity: number;
  instructions?: string | null;
  isDispensed: boolean;
}
interface Prescription {
  id: string;
  prescriptionNumber: string;
  status: string;
  prescribedAt: string;
  items: PrescriptionItem[];
}
interface LabOrder {
  id: string;
  orderNumber: string;
  testName: string;
  testCode: string;
  specimenType: string;
  urgency: string;
  status: string;
  orderedAt: string;
  result?: {
    interpretation?: string | null;
    abnormalFindings?: string | null;
    resultsData?: any;
  } | null;
}
interface ImagingOrder {
  id: string;
  orderNumber: string;
  modality: string;
  bodyPart: string;
  indication: string;
  urgency: string;
  status: string;
  orderedAt: string;
  report?: {
    findings: string;
    impression: string;
    recommendations?: string | null;
  } | null;
}
interface VisitRecord {
  visit: {
    id: string;
    visitNumber: string;
    visitType: string;
    chiefComplaint: string;
    priority: string;
    status: string;
    admissionDate: string;
    dischargeDate?: string | null;
    dischargeDiagnosis?: string | null;
    dischargeSummary?: string | null;
    institutionId?: string | null;
  };
  consultations: Consultation[];
  diagnoses: Diagnosis[];
  prescriptions: Prescription[];
  labOrders: LabOrder[];
  imagingOrders: ImagingOrder[];
  vitals: VitalSigns[];
}
interface AwayInstitution {
  institutionId: string;
  institutionName: string;
  visitCount: number;
  hasPermission: boolean;
  // Why these records are readable: patient consent, or a cross-institution
  // grant from an emergency override / referral / transfer.
  accessVia?: "patient_consent" | "emergency" | "referral" | "transfer" | null;
  accessExpiresAt?: string | null;
  visits: VisitRecord[];
}

// Permission state is per-institution for away, or global for own
type PermState =
  | { phase: "idle" }
  | { phase: "form" }
  | { phase: "submitting" }
  | { phase: "pending"; requestId: string }
  | { phase: "rejected" }
  | { phase: "expired" };

interface PatientHistoryTabProps {
  patientId?: string;
  visitId?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/* Priority and visit status keyed to the Postgres enums. Tones are shared
   with the rest of the doctor portal via TONES, so a "critical" visit reads
   the same colour here as it does in the queue. */
const PRIORITY_TONE: Record<string, Tone> = {
  routine: "success",
  urgent: "urgent",
  emergency: "critical",
  critical: "accent",
};
const priorityTone = (p: string): Tone => PRIORITY_TONE[p] ?? "neutral";

const VISIT_STATUS_TONE: Record<string, Tone> = {
  "in-progress": "info",
  completed: "success",
  cancelled: "neutral",
};
const visitStatusTone = (s: string): Tone => VISIT_STATUS_TONE[s] ?? "neutral";

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
function formatDateTime(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function calculateAge(dob: string) {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (
    today.getMonth() - birth.getMonth() < 0 ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  )
    age--;
  return age;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Badge({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  const t = TONES[tone];
  return (
    <span
      className="inline-flex items-center flex-shrink-0"
      style={{
        height: 19,
        padding: "0 8px",
        borderRadius: "var(--r-xs)",
        background: t.tint,
        color: t.ink,
        font: "600 11.5px/1 var(--font-sans)",
        textTransform: "capitalize",
        whiteSpace: "nowrap",
      }}
    >
      {label.replace(/_/g, " ")}
    </span>
  );
}

/** One vital reading. Renders nothing when the value is absent. */
function VitalRow({
  label,
  value,
  unit,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value?: string | number | null;
  unit?: string;
  icon: React.ElementType;
  tone?: Tone;
}) {
  if (value == null || value === "") return null;
  return (
    <div
      className="flex items-center justify-between"
      style={{
        gap: 12,
        padding: "8px 0",
        borderBottom: "1px solid var(--border-faint)",
      }}
    >
      <span className="inline-flex items-center" style={{ gap: 8 }}>
        <Icon className="w-3.5 h-3.5" style={{ color: TONES[tone].ink }} />
        <span
          style={{
            font: "400 11.5px/1 var(--font-sans)",
            color: "var(--text-secondary)",
          }}
        >
          {label}
        </span>
      </span>
      <span
        style={{
          font: "600 13px/1 var(--font-mono)",
          color: "var(--text-primary)",
        }}
      >
        {value}
        {unit && (
          <span
            style={{
              font: "400 11px/1 var(--font-sans)",
              color: "var(--text-muted)",
              marginLeft: 4,
            }}
          >
            {unit}
          </span>
        )}
      </span>
    </div>
  );
}

function VisitCard({ record, index }: { record: VisitRecord; index: number }) {
  const [open, setOpen] = useState(index === 0);
  const {
    visit,
    consultations,
    diagnoses,
    prescriptions,
    labOrders,
    imagingOrders,
    vitals,
  } = record;
  const pTone = priorityTone(visit.priority);
  const sTone = visitStatusTone(visit.status);
  const totalRecords =
    consultations.length +
    diagnoses.length +
    prescriptions.length +
    labOrders.length +
    imagingOrders.length;

  return (
    <div className="bg-[var(--surface-card)] rounded-[var(--r-lg)] border border-[var(--border-faint)] shadow-[var(--elev-1)] overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="w-full text-left">
        <div className="px-5 py-4 flex items-start gap-4">
          {/* Priority spine — the visit's urgency, readable while collapsed. */}
          <div
            className="w-2 self-stretch rounded-full flex-shrink-0 mt-1"
            style={{ background: TONES[pTone].dot }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-mono text-sm font-bold text-[var(--text-primary)]">
                {visit.visitNumber}
              </span>
              <Badge label={visit.status.replace("-", " ")} tone={sTone} />
              <Badge label={visit.priority} tone={pTone} />
              <Badge label={visit.visitType} />
            </div>
            <p className="text-sm text-[var(--text-secondary)] truncate">
              {visit.chiefComplaint || "No complaint recorded"}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDateTime(visit.admissionDate)}
              {visit.dischargeDate && <> → {formatDate(visit.dischargeDate)}</>}
            </p>
          </div>
          <div className="flex-shrink-0 flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-[var(--text-muted)]">Records</p>
              <p className="text-xs font-bold text-[var(--text-secondary)]">{totalRecords}</p>
            </div>
            {open ? (
              <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
            ) : (
              <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
            )}
          </div>
        </div>
      </button>

      {open && (
        <div className="border-t border-[var(--border-faint)] px-5 py-5 space-y-5">
          {/* Vitals */}
          {vitals.length > 0 && (
            <div>
              <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
                Vital Signs · {formatDateTime(vitals[0].recordedAt)}
              </p>
              <div className="bg-[var(--surface-sunken)] rounded-[var(--r-sm)] p-3">
                <VitalRow
                  icon={Thermometer}
                  label="Temperature"
                  value={vitals[0].temperature}
                  unit="°C"
                  tone="critical"
                />
                <VitalRow
                  icon={Gauge}
                  label="Blood Pressure"
                  value={
                    vitals[0].bloodPressureSystolic &&
                    vitals[0].bloodPressureDiastolic
                      ? `${vitals[0].bloodPressureSystolic}/${vitals[0].bloodPressureDiastolic}`
                      : null
                  }
                  unit="mmHg"
                  tone="info"
                />
                <VitalRow
                  icon={Heart}
                  label="Pulse Rate"
                  value={vitals[0].pulseRate}
                  unit="bpm"
                  tone="critical"
                />
                <VitalRow
                  icon={Wind}
                  label="Respiratory Rate"
                  value={vitals[0].respiratoryRate}
                  unit="/min"
                  tone="success"
                />
                <VitalRow
                  icon={Droplets}
                  label="SpO₂"
                  value={vitals[0].oxygenSaturation}
                  unit="%"
                  tone="info"
                />
                <VitalRow
                  icon={Weight}
                  label="Weight"
                  value={vitals[0].weight}
                  unit="kg"
                  tone="urgent"
                />
                <VitalRow
                  icon={UserIcon}
                  label="Height"
                  value={vitals[0].height}
                  unit="cm"
                  tone="accent"
                />
                {vitals[0].painLevel != null && (
                  <div className="flex items-center justify-between py-2">
                    <span className="text-xs text-[var(--text-secondary)]">Pain Level</span>
                    <div className="flex items-center gap-1.5">
                      <div className="flex gap-0.5">
                        {Array.from({ length: 10 }, (_, i) => (
                          <div
                            key={i}
                            className="w-2.5 h-2.5 rounded-full"
                            style={{
                              background:
                                i < (vitals[0].painLevel ?? 0)
                                  ? vitals[0].painLevel! <= 3
                                    ? "var(--green-600)"
                                    : vitals[0].painLevel! <= 6
                                      ? "var(--amber-500)"
                                      : "var(--coral-500)"
                                  : "var(--hc-border)",
                            }}
                          />
                        ))}
                      </div>
                      <span className="text-sm font-semibold text-[var(--text-primary)]">
                        {vitals[0].painLevel}/10
                      </span>
                    </div>
                  </div>
                )}
                {vitals[0].nurseNotes && (
                  <p className="text-xs text-[var(--text-secondary)] mt-2 pt-2 border-t border-[var(--border-faint)] italic">
                    {vitals[0].nurseNotes}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Consultations */}
          {consultations.length > 0 && (
            <div>
              <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
                Consultations ({consultations.length})
              </p>
              <div className="space-y-3">
                {consultations.map((c) => (
                  <div
                    key={c.id}
                    className="bg-[var(--info-tint)] rounded-[var(--r-sm)] p-4 border border-[var(--blue-100)] space-y-2"
                  >
                    {c.historyOfPresentIllness && (
                      <div>
                        <p className="text-xs font-semibold text-[var(--info-ink)] uppercase mb-0.5">
                          History
                        </p>
                        <p className="text-sm text-[var(--text-secondary)]">
                          {c.historyOfPresentIllness}
                        </p>
                      </div>
                    )}
                    {c.physicalExamination && (
                      <div>
                        <p className="text-xs font-semibold text-[var(--info-ink)] uppercase mb-0.5">
                          Examination
                        </p>
                        <p className="text-sm text-[var(--text-secondary)]">
                          {c.physicalExamination}
                        </p>
                      </div>
                    )}
                    {c.clinicalFindings && (
                      <div>
                        <p className="text-xs font-semibold text-[var(--info-ink)] uppercase mb-0.5">
                          Clinical Findings
                        </p>
                        <p className="text-sm text-[var(--text-secondary)]">
                          {c.clinicalFindings}
                        </p>
                      </div>
                    )}
                    {c.assessment && (
                      <div>
                        <p className="text-xs font-semibold text-[var(--info-ink)] uppercase mb-0.5">
                          Assessment
                        </p>
                        <p className="text-sm text-[var(--text-secondary)]">{c.assessment}</p>
                      </div>
                    )}
                    {c.plan && (
                      <div>
                        <p className="text-xs font-semibold text-[var(--info-ink)] uppercase mb-0.5">
                          Plan
                        </p>
                        <p className="text-sm text-[var(--text-secondary)]">{c.plan}</p>
                      </div>
                    )}
                    {c.followUpInstructions && (
                      <div>
                        <p className="text-xs font-semibold text-[var(--info-ink)] uppercase mb-0.5">
                          Follow-up
                        </p>
                        <p className="text-sm text-[var(--text-secondary)]">
                          {c.followUpInstructions}
                        </p>
                      </div>
                    )}
                    {c.nextAppointmentDate && (
                      <p className="text-xs text-[var(--text-muted)]">
                        Next appointment: {formatDate(c.nextAppointmentDate)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Diagnoses */}
          {diagnoses.length > 0 && (
            <div>
              <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
                Diagnoses ({diagnoses.length})
              </p>
              <div className="space-y-2">
                {diagnoses.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-start gap-3 p-3 bg-[var(--surface-sunken)] rounded-[var(--r-sm)]"
                  >
                    <span className="font-mono text-xs bg-[var(--surface-card)] px-2 py-1 rounded-[var(--r-xs)] border border-[var(--hc-border)] text-[var(--text-secondary)] flex-shrink-0 mt-0.5">
                      {d.icdCode}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        {d.diagnosisName}
                      </p>
                      <div className="flex gap-1.5 mt-1">
                        <Badge
                          label={d.diagnosisType.replace("_", " ")}
                          tone="info"
                        />
                        {d.severity && <Badge label={d.severity} />}
                      </div>
                      {d.notes && (
                        <p className="text-xs text-[var(--text-secondary)] mt-1">{d.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Prescriptions */}
          {prescriptions.length > 0 && (
            <div>
              <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
                Prescriptions ({prescriptions.length})
              </p>
              <div className="space-y-3">
                {prescriptions.map((rx) => (
                  <div
                    key={rx.id}
                    className="border border-[var(--green-100)] rounded-[var(--r-sm)] overflow-hidden"
                  >
                    <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--brand-tint)]">
                      <span className="font-mono text-xs font-bold text-[var(--green-800)]">
                        {rx.prescriptionNumber}
                      </span>
                      <Badge
                        label={rx.status}
                        tone={rx.status === "dispensed" ? "success" : "urgent"}
                      />
                    </div>
                    <div className="divide-y divide-[var(--border-faint)]">
                      {rx.items.map((item) => (
                        <div
                          key={item.id}
                          className="px-4 py-3 flex items-start justify-between gap-3"
                        >
                          <div>
                            <p className="text-sm font-semibold text-[var(--text-primary)]">
                              {item.medicationName}
                              {item.genericName && (
                                <span className="text-xs text-[var(--text-muted)] ml-1">
                                  ({item.genericName})
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                              {item.strength} · {item.dosageForm} · {item.dose}{" "}
                              · {item.frequency.replace(/_/g, " ")} ·{" "}
                              {item.route} · {item.duration}
                            </p>
                            {item.instructions && (
                              <p className="text-xs text-[var(--text-muted)] italic mt-0.5">
                                {item.instructions}
                              </p>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs font-semibold text-[var(--text-secondary)]">
                              ×{item.quantity}
                            </p>
                            {item.isDispensed && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-[var(--success-ink)] ml-auto mt-1" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lab Orders */}
          {labOrders.length > 0 && (
            <div>
              <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
                Lab Orders ({labOrders.length})
              </p>
              <div className="space-y-2">
                {labOrders.map((lo) => (
                  <div
                    key={lo.id}
                    className="p-3 bg-[var(--violet-050)] rounded-[var(--r-sm)] border border-[var(--violet-100)]"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          {lo.testName}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)] font-mono">
                          {lo.testCode} · {lo.specimenType}
                        </p>
                      </div>
                      <Badge
                        label={lo.status}
                        tone={lo.status === "resulted" ? "success" : "info"}
                      />
                    </div>
                    {lo.result && (
                      <div className="mt-2 pt-2 border-t border-[var(--violet-100)] space-y-1">
                        {lo.result.interpretation && (
                          <p className="text-xs text-[var(--text-secondary)]">
                            <span className="font-semibold">
                              Interpretation:
                            </span>{" "}
                            {lo.result.interpretation}
                          </p>
                        )}
                        {lo.result.abnormalFindings && (
                          <p className="text-xs text-[var(--urgent-ink)] flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />{" "}
                            {lo.result.abnormalFindings}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Imaging */}
          {imagingOrders.length > 0 && (
            <div>
              <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
                Imaging ({imagingOrders.length})
              </p>
              <div className="space-y-2">
                {imagingOrders.map((io) => (
                  <div
                    key={io.id}
                    className="p-3 bg-[var(--info-tint)] rounded-[var(--r-sm)] border border-[var(--blue-100)]"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)] uppercase">
                          {io.modality.replace("_", " ")} — {io.bodyPart}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)]">{io.indication}</p>
                      </div>
                      <Badge
                        label={io.status}
                        tone={io.status === "reported" ? "success" : "info"}
                      />
                    </div>
                    {io.report && (
                      <div className="mt-2 pt-2 border-t border-[var(--blue-100)] space-y-1">
                        {io.report.findings && (
                          <p className="text-xs text-[var(--text-secondary)]">
                            <span className="font-semibold">Findings:</span>{" "}
                            {io.report.findings}
                          </p>
                        )}
                        {io.report.impression && (
                          <p className="text-xs text-[var(--text-secondary)]">
                            <span className="font-semibold">Impression:</span>{" "}
                            {io.report.impression}
                          </p>
                        )}
                        {io.report.recommendations && (
                          <p className="text-xs text-[var(--text-secondary)]">
                            <span className="font-semibold">
                              Recommendations:
                            </span>{" "}
                            {io.report.recommendations}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Discharge summary */}
          {visit.dischargeDiagnosis && (
            <div className="bg-[var(--surface-sunken)] rounded-[var(--r-sm)] p-4 border border-[var(--hc-border)]">
              <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                Discharge Summary
              </p>
              <p className="text-sm text-[var(--text-secondary)]">
                <span className="font-semibold">Diagnosis:</span>{" "}
                {visit.dischargeDiagnosis}
              </p>
              {visit.dischargeSummary && (
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                  {visit.dischargeSummary}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Away Institution Card ─────────────────────────────────────────────────────

function AwayInstitutionSection({
  institution,
  patientId,
  onPermissionGranted,
  patientWide = false,
  directAccess = false,
  emergencyOverrideEnabled = false,
}: {
  institution: AwayInstitution;
  patientId: string;
  onPermissionGranted: () => void;
  patientWide?: boolean;
  directAccess?: boolean;
  emergencyOverrideEnabled?: boolean;
}) {
  const [permState, setPermState] = useState<PermState>({ phase: "idle" });
  const [reason, setReason] = useState("");
  const [selectedPerms, setSelectedPerms] = useState<string[]>([
    "visits",
    "consultations",
    "vitals",
    "diagnoses",
    "prescriptions",
    "lab_results",
    "imaging",
  ]);
  const [formError, setFormError] = useState("");
  const [open, setOpen] = useState(false);
  const [showOverride, setShowOverride] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const startPolling = useCallback(
    (requestId: string) => {
      pollCountRef.current = 0;
      pollRef.current = setInterval(async () => {
        pollCountRef.current++;
        if (pollCountRef.current > 60) {
          stopPolling();
          setPermState({ phase: "expired" });
          return;
        }
        try {
          const res = await permissionApi.getRequestStatus(requestId);
          const req = res.data.data;
          if (req.status === "approved") {
            stopPolling();
            onPermissionGranted();
          } else if (req.status === "rejected") {
            stopPolling();
            setPermState({ phase: "rejected" });
          } else if (req.status === "expired") {
            stopPolling();
            setPermState({ phase: "expired" });
          }
        } catch {
          /* ignore */
        }
      }, 5000);
    },
    [stopPolling, onPermissionGranted],
  );

  const handleRequest = async () => {
    if (reason.trim().length < 10) {
      setFormError("Please provide a reason (at least 10 characters).");
      return;
    }
    if (selectedPerms.length === 0) {
      setFormError("Select at least one permission.");
      return;
    }
    setPermState({ phase: "submitting" });
    setFormError("");
    try {
      const res = await permissionApi.requestAccess({
        patientId,
        reason: patientWide ? `Patient history across all hospitals: ${reason.trim()}` : reason.trim(),
        requestedPermissions: selectedPerms,
      });
      const requestId = res.data.data.requestId;
      setPermState({ phase: "pending", requestId });
      startPolling(requestId);
    } catch (err: any) {
      const msg =
        err.response?.data?.error?.message ?? "Failed to send request.";
      setFormError(
        msg.includes("already pending")
          ? "You already have a pending request for this patient."
          : msg,
      );
      setPermState({ phase: "form" });
    }
  };

  const PERMISSIONS = [
    { key: "visits", label: "Visit Records" },
    { key: "consultations", label: "Consultations" },
    { key: "vitals", label: "Vital Signs" },
    { key: "diagnoses", label: "Diagnoses" },
    { key: "prescriptions", label: "Prescriptions" },
    { key: "lab_results", label: "Lab Results" },
    { key: "imaging", label: "Imaging Reports" },
  ];
  const togglePerm = (key: string) =>
    setSelectedPerms((p) =>
      p.includes(key) ? p.filter((k) => k !== key) : [...p, key],
    );

  // ── UNLOCKED — show visits ─────────────────────────────────────────────────
  if (institution.hasPermission) {
    return (
      <div className="rounded-[var(--r-lg)] border border-[var(--green-200)] overflow-hidden">
        {/* Header */}
        <div
          className="px-5 py-3.5 flex items-center gap-3"
          style={{ background: "var(--brand-tint)" }}
        >
          <div className="w-8 h-8 rounded-[var(--r-sm)] bg-[var(--green-100)] flex items-center justify-center flex-shrink-0">
            <Building2 className="w-4 h-4 text-[var(--green-700)]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
              {institution.institutionName}
              {institution.accessVia === "emergency" && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--coral-100)] text-[var(--critical-ink)] border border-[var(--coral-100)]">
                  EMERGENCY ACCESS
                </span>
              )}
            </p>
            <p className="text-xs text-[var(--text-secondary)]">
              {institution.visitCount} visit
              {institution.visitCount !== 1 ? "s" : ""}
            </p>
          </div>
          {!directAccess && <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{ background: "var(--brand-tint)", color: "var(--green-800)" }}
          >
            <Unlock className="w-3 h-3" /> Access granted
          </div>}
        </div>
        {/* Visits */}
        <div className="p-4 space-y-3" style={{ background: "var(--surface-app)" }}>
          {institution.visits.map((record, i) => (
            <VisitCard key={record.visit.id} record={record} index={i} />
          ))}
        </div>
      </div>
    );
  }

  // ── LOCKED — permission gate ───────────────────────────────────────────────
  return (
    <div className="rounded-[var(--r-lg)] border border-[var(--hc-border)] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 flex items-center gap-3 bg-[var(--surface-card)]">
        <div className="w-8 h-8 rounded-[var(--r-sm)] bg-[var(--surface-sunken)] flex items-center justify-center flex-shrink-0">
          <Building2 className="w-4 h-4 text-[var(--text-secondary)]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[var(--text-primary)]">
            {institution.institutionName}
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            {patientWide ? 'All hospitals · patient approval required' : `${institution.visitCount} visits · access required`}
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--surface-sunken)] text-[var(--text-secondary)]">
          <Lock className="w-3 h-3" /> Locked
        </div>
      </div>

      {/* Body */}
      <div
        className="border-t border-[var(--border-faint)] px-5 py-4"
        style={{ background: "var(--surface-app)" }}
      >
        {/* Idle — show prompt */}
        {permState.phase === "idle" && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-semibold text-[var(--text-secondary)]">
                {patientWide ? 'Patient history is protected' : 'Records from this institution are protected'}
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {patientWide ? 'Request consent once to view the patient’s full history across all hospitals. After approval, records are grouped by institution.' : `Request consent to view records from ${institution.institutionName}.`}
              </p>
            </div>
            <div className="flex-shrink-0 flex items-center gap-2">
              {emergencyOverrideEnabled === true && <button
                onClick={() => setShowOverride(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-[var(--r-sm)] text-xs font-semibold border border-[var(--coral-100)] text-[var(--critical-ink)] bg-[var(--coral-050)] hover:bg-[var(--coral-100)] transition-all"
              >
                <ShieldAlert className="w-3.5 h-3.5" /> Emergency
              </button>}
              <button
                onClick={() => setPermState({ phase: "form" })}
                className="flex items-center gap-2 px-4 py-2 rounded-[var(--r-sm)] text-[var(--white)] text-xs font-semibold shadow-[var(--elev-1)] hover:shadow-[var(--elev-2)] transition-all"
                style={{
                  background: "var(--brand)",
                }}
              >
                <Send className="w-3.5 h-3.5" /> Request Access
              </button>
            </div>
          </div>
        )}

        {/* Form */}
        {permState.phase === "form" && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-[var(--r-sm)] bg-[var(--amber-050)] border border-[var(--amber-100)]">
              <ShieldX className="w-4 h-4 text-[var(--urgent-ink)] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[var(--urgent-ink)]">
                The patient will receive a notification on their mobile app and
                must approve your request. {patientWide && 'This request covers the full patient history across all hospitals, not just one institution.'}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                Requested Permissions
              </p>
              <div className="flex flex-wrap gap-2">
                {PERMISSIONS.map(({ key, label }) => {
                  const selected = selectedPerms.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={patientWide}
                      onClick={() => togglePerm(key)}
                      className="px-2.5 py-1 rounded-[var(--r-xs)] text-xs font-semibold border transition-all"
                      style={
                        selected
                          ? {
                              background: "var(--brand-tint)",
                              borderColor: "var(--green-300)",
                              color: "var(--green-800)",
                            }
                          : {
                              background: "var(--surface-app)",
                              borderColor: "var(--hc-border)",
                              color: "var(--text-secondary)",
                            }
                      }
                    >
                      {selected && <span className="mr-1">✓</span>}
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide block">
                Clinical Reason <span className="text-[var(--coral-500)]">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setFormError("");
                }}
                rows={2}
                placeholder={`Need to review ${institution.institutionName} records for…`}
                className="w-full px-3 py-2 rounded-[var(--r-sm)] border border-[var(--hc-border)] bg-[var(--surface-card)] text-[var(--text-primary)] text-sm outline-none transition-all focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--focus-ring)] placeholder:text-[var(--text-muted)] resize-none"
              />
              <p className="text-xs text-[var(--text-muted)]">
                {reason.length} chars · minimum 10
              </p>
            </div>
            {formError && (
              <div className="flex items-start gap-2 p-2.5 rounded-[var(--r-sm)] bg-[var(--coral-050)] border border-[var(--coral-100)]">
                <AlertCircle className="w-3.5 h-3.5 text-[var(--critical-ink)] mt-0.5 flex-shrink-0" />
                <p className="text-xs text-[var(--critical-ink)]">{formError}</p>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setPermState({ phase: "idle" });
                  setReason("");
                  setFormError("");
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[var(--r-sm)] border border-[var(--hc-border)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]"
              >
                <XCircle className="w-3.5 h-3.5" /> Cancel
              </button>
              <button
                onClick={handleRequest}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[var(--r-sm)] text-[var(--white)] text-xs font-semibold"
                style={{
                  background: "var(--brand)",
                }}
              >
                <Send className="w-3.5 h-3.5" /> Send Request
              </button>
            </div>
          </div>
        )}

        {/* Submitting */}
        {permState.phase === "submitting" && (
          <div className="flex items-center justify-center gap-2 py-4">
            <Loader2 className="w-4 h-4 animate-spin text-[var(--green-700)]" />
            <span className="text-sm text-[var(--text-secondary)]">Sending request…</span>
          </div>
        )}

        {/* Pending */}
        {permState.phase === "pending" && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-[var(--r-sm)] bg-[var(--info-tint)] border border-[var(--blue-100)]">
              <div className="relative w-8 h-8 flex-shrink-0">
                <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-[var(--brand)]" />
                <div className="relative w-8 h-8 rounded-full bg-[var(--green-100)] flex items-center justify-center">
                  <Clock className="w-4 h-4 text-[var(--green-700)]" />
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  Waiting for patient approval
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  Checking every 5 seconds…
                </p>
              </div>
              <Loader2 className="w-4 h-4 animate-spin text-[var(--green-700)] ml-auto flex-shrink-0" />
            </div>
            <button
              onClick={() => {
                stopPolling();
                setPermState({ phase: "idle" });
                setReason("");
              }}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-[var(--r-sm)] border border-[var(--hc-border)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]"
            >
              <XCircle className="w-3.5 h-3.5" /> Cancel request
            </button>
          </div>
        )}

        {/* Rejected */}
        {permState.phase === "rejected" && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-[var(--r-sm)] bg-[var(--coral-050)] border border-[var(--coral-100)]">
              <Ban className="w-5 h-5 text-[var(--critical-ink)] flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  Request declined
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  The patient declined to share records from{" "}
                  {institution.institutionName}.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setPermState({ phase: "form" });
                setReason("");
              }}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-[var(--r-sm)] text-[var(--white)] text-xs font-semibold"
              style={{ background: "var(--brand)" }}
            >
              <Send className="w-3.5 h-3.5" /> Send New Request
            </button>
          </div>
        )}

        {/* Expired */}
        {permState.phase === "expired" && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-[var(--r-sm)] bg-[var(--amber-050)] border border-[var(--amber-100)]">
              <Clock className="w-5 h-5 text-[var(--amber-500)] flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  Request expired
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  The patient didn't respond in time.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setPermState({ phase: "form" });
                setReason("");
              }}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-[var(--r-sm)] text-[var(--white)] text-xs font-semibold"
              style={{ background: "var(--brand)" }}
            >
              <RefreshCw className="w-3.5 h-3.5" /> Send New Request
            </button>
          </div>
        )}
      </div>

      {/* Emergency override — 24h access without patient approval, heavily logged */}
      <EmergencyOverrideModal
        open={emergencyOverrideEnabled === true && showOverride}
        patientId={patientId}
        onClose={() => setShowOverride(false)}
        onGranted={() => {
          setShowOverride(false);
          onPermissionGranted();
        }}
      />
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PatientHistoryTab({
  patientId: patientIdProp,
  visitId,
}: PatientHistoryTabProps) {
  const [resolvedPatientId, setResolvedPatientId] = useState<string | null>(
    patientIdProp ?? null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [patient, setPatient] = useState<PatientDemographics | null>(null);
  const [ownVisits, setOwnVisits] = useState<VisitRecord[]>([]);
  const [hasHistoryPermission, setHasHistoryPermission] = useState(false);
  const [institutionNames, setInstitutionNames] = useState<Record<string, string>>({});
  const [awayInstitutions, setAwayInstitutions] = useState<AwayInstitution[]>(
    [],
  );

  // Step 1: resolve patientId from visitId if needed
  useEffect(() => {
    if (patientIdProp) {
      setResolvedPatientId(patientIdProp);
      return;
    }
    if (!visitId) {
      setError("No patient or visit ID provided.");
      setLoading(false);
      return;
    }
    import("@/lib/api").then(({ visitApi }) => {
      visitApi
        .getVisitInfo(visitId)
        .then((res) => {
          const pid = res.data.data?.patientId;
          if (pid) setResolvedPatientId(pid);
          else {
            setError("Could not find patient for this visit.");
            setLoading(false);
          }
        })
        .catch(() => {
          setError("Could not load visit info.");
          setLoading(false);
        });
    });
  }, [patientIdProp, visitId]);

  // Step 2: load history once patientId is resolved
  const loadHistory = useCallback(async (pid: string, silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await patientApi.getHistory(pid);
      const data = res.data.data;
      setPatient(data.patient);
      setHasHistoryPermission(data.hasHistoryPermission === true);
      setInstitutionNames(data.institutionNames ?? {});
      setOwnVisits(data.ownVisits ?? []);
      setAwayInstitutions(data.awayInstitutions ?? []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? "Failed to load history.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!resolvedPatientId) return;
    loadHistory(resolvedPatientId);
  }, [resolvedPatientId, loadHistory]);

  useLiveRefresh(() => resolvedPatientId && loadHistory(resolvedPatientId, true), !!resolvedPatientId);

  // Called when a permission is granted for an away institution — reload to get visits
  const handlePermissionGranted = useCallback(() => {
    if (resolvedPatientId) loadHistory(resolvedPatientId);
  }, [resolvedPatientId, loadHistory]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--green-700)]" />
        <p className="text-sm text-[var(--text-secondary)]">Loading patient history…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[var(--coral-050)] border border-[var(--coral-100)] rounded-[var(--r-lg)] p-8 text-center">
        <AlertCircle className="w-8 h-8 text-[var(--coral-500)] mx-auto mb-3" />
        <p className="text-sm font-semibold text-[var(--critical-ink)]">{error}</p>
      </div>
    );
  }

  if (!patient) return null;

  const { accessibleInstitutions, needsPatientConsent } = historyVisibility(hasHistoryPermission, awayInstitutions);
  const historyRequest = (
    <AwayInstitutionSection
      key={patient.id}
      patientWide
      emergencyOverrideEnabled={patient.emergencyOverrideEnabled}
      patientId={patient.id}
      institution={{ institutionId: 'patient-history', institutionName: 'Patient history', visitCount: 0, hasPermission: false, visits: [] }}
      onPermissionGranted={handlePermissionGranted}
    />
  );
  // Home-institution records are directly readable. Consent only gates
  // records from other institutions, never the whole history page.

  const totalVisits =
    ownVisits.length + accessibleInstitutions.reduce((a, i) => a + i.visits.length, 0);
  const totalDiagnoses =
    ownVisits.reduce((a, v) => a + v.diagnoses.length, 0) +
    awayInstitutions
      .filter((i) => i.hasPermission)
      .reduce(
        (a, i) => a + i.visits.reduce((b, v) => b + v.diagnoses.length, 0),
        0,
      );
  const totalRx =
    ownVisits.reduce((a, v) => a + v.prescriptions.length, 0) +
    awayInstitutions
      .filter((i) => i.hasPermission)
      .reduce(
        (a, i) => a + i.visits.reduce((b, v) => b + v.prescriptions.length, 0),
        0,
      );

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold text-[var(--text-primary)]">Patient history</h2>
      {/* Patient demographics card */}
      <div className="bg-[var(--surface-card)] rounded-[var(--r-lg)] border border-[var(--border-faint)] shadow-[var(--elev-1)] overflow-hidden">
        <div
          className="px-5 py-4 flex items-center gap-4"
          style={{ background: "var(--brand-tint)" }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold text-[var(--white)] flex-shrink-0"
            style={{ background: "var(--green-800)" }}
          >
            {patient.firstName[0]}
            {patient.lastName[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-[var(--text-primary)] text-lg">
              {patient.firstName}
              {patient.middleName ? ` ${patient.middleName}` : ""}{" "}
              {patient.lastName}
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              {patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)}{" "}
              · Age {calculateAge(patient.dateOfBirth)} · DOB{" "}
              {formatDate(patient.dateOfBirth)}
            </p>
          </div>
          {patient.bloodType && patient.bloodType !== "unknown" && (
            <span
              className="text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0"
              style={{
                background: "var(--critical-tint)",
                color: "var(--critical-ink)",
              }}
            >
              {patient.bloodType}
            </span>
          )}
        </div>
        <div className="px-5 py-3 grid grid-cols-2 gap-3 bg-[var(--surface-sunken)] border-t border-[var(--border-faint)]">
          {[
            { label: "Phone", value: patient.phoneNumber },
            { label: "Marital Status", value: patient.maritalStatus },
            { label: "Occupation", value: patient.occupation },
            { label: "Email", value: patient.email },
          ]
            .filter(({ value }) => !!value)
            .map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide">
                  {label}
                </p>
                <p className="text-sm font-semibold text-[var(--text-secondary)] capitalize truncate">
                  {value}
                </p>
              </div>
            ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: "Total Visits",
            value: totalVisits,
            icon: FileText,
            color: "var(--green-800)",
          },
          {
            label: "Diagnoses",
            value: totalDiagnoses,
            icon: Stethoscope,
            color: "var(--blue-600)",
          },
          {
            label: "Prescriptions",
            value: totalRx,
            icon: Pill,
            color: "var(--accent-ink)",
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="bg-[var(--surface-card)] rounded-[var(--r-lg)] border border-[var(--border-faint)] shadow-[var(--elev-1)] p-4 text-center"
          >
            <Icon className="w-5 h-5 mx-auto mb-1" style={{ color }} />
            <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
            <p className="text-xs text-[var(--text-secondary)]">{label}</p>
          </div>
        ))}
      </div>

      {/* Authorized history, grouped by the actual institution of each visit. */}
      {groupHistoryRecords(ownVisits, institutionNames).map(group => (
        <AwayInstitutionSection
          directAccess
          key={group.institutionId}
          institution={{ ...group, visitCount: group.visits.length, hasPermission: true }}
          patientId={patient.id}
          onPermissionGranted={handlePermissionGranted}
        />
      ))}
      {totalVisits === 0 && <p className="text-sm text-[var(--text-secondary)]">No accessible visit records to display.</p>}

      {needsPatientConsent && historyRequest}

      {/* ── AWAY INSTITUTION RECORDS ────────────────────────────────────────── */}
      {accessibleInstitutions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Building2 className="w-4 h-4 text-[var(--text-muted)]" />
            <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              Other institutions
            </p>
            <span className="ml-auto text-xs font-semibold text-[var(--text-muted)]">
              {accessibleInstitutions.length} institution
              {accessibleInstitutions.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="bg-[var(--amber-050)] border border-[var(--amber-100)] rounded-[var(--r-sm)] px-4 py-3 flex items-start gap-2.5">
            <ShieldX className="w-4 h-4 text-[var(--urgent-ink)] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[var(--urgent-ink)]">
              {hasHistoryPermission
                ? 'Patient-approved access covers the history across all hospitals. Records are grouped below by institution.'
                : 'Showing records covered by existing access grants. Any remaining protected records require patient-wide consent.'}
            </p>
          </div>

          {accessibleInstitutions.map((inst) => (
            <AwayInstitutionSection
              key={inst.institutionId}
              institution={inst}
              patientId={patient.id}
              onPermissionGranted={handlePermissionGranted}
            />
          ))}
        </div>
      )}
    </div>
  );
}
