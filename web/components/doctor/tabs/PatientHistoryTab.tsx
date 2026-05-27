"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { patientApi, permissionApi } from "@/lib/api";
import {
  AlertCircle,
  Loader2,
  Clock,
  ShieldCheck,
  ShieldX,
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

// ── Types ─────────────────────────────────────────────────────────────────────

interface PatientDemographics {
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

const PRIORITY_STYLE: Record<
  string,
  { bg: string; text: string; dot: string }
> = {
  routine: { bg: "#f0fdf4", text: "#166534", dot: "#22c55e" },
  urgent: { bg: "#fffbeb", text: "#92400e", dot: "#f59e0b" },
  emergency: { bg: "#fef2f2", text: "#991b1b", dot: "#ef4444" },
  critical: { bg: "#faf5ff", text: "#6b21a8", dot: "#a855f7" },
};
const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  "in-progress": { bg: "#eff6ff", text: "#1d4ed8" },
  completed: { bg: "#f0fdf4", text: "#166534" },
  cancelled: { bg: "#f9fafb", text: "#6b7280" },
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

function Badge({
  label,
  bg = "#f3f4f6",
  text = "#374151",
}: {
  label: string;
  bg?: string;
  text?: string;
}) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold capitalize"
      style={{ background: bg, color: text }}
    >
      {label.replace(/_/g, " ")}
    </span>
  );
}

function VitalRow({
  label,
  value,
  unit,
  icon: Icon,
  color,
}: {
  label: string;
  value?: string | number | null;
  unit?: string;
  icon: React.ElementType;
  color: string;
}) {
  if (value == null || value === "") return null;
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-2">
        <Icon className="w-3.5 h-3.5" style={{ color }} />
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <span className="text-sm font-semibold text-gray-800">
        {value}
        {unit && <span className="text-xs text-gray-400 ml-1">{unit}</span>}
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
  const p = PRIORITY_STYLE[visit.priority] ?? PRIORITY_STYLE.routine;
  const s = STATUS_STYLE[visit.status] ?? STATUS_STYLE.completed;
  const totalRecords =
    consultations.length +
    diagnoses.length +
    prescriptions.length +
    labOrders.length +
    imagingOrders.length;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="w-full text-left">
        <div className="px-5 py-4 flex items-start gap-4">
          <div
            className="w-2 self-stretch rounded-full flex-shrink-0 mt-1"
            style={{ background: p.dot }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-mono text-sm font-bold text-gray-800">
                {visit.visitNumber}
              </span>
              <Badge
                label={visit.status.replace("-", " ")}
                bg={s.bg}
                text={s.text}
              />
              <Badge label={visit.priority} bg={p.bg} text={p.text} />
              <Badge label={visit.visitType} />
            </div>
            <p className="text-sm text-gray-600 truncate">
              {visit.chiefComplaint || "No complaint recorded"}
            </p>
            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDateTime(visit.admissionDate)}
              {visit.dischargeDate && <> → {formatDate(visit.dischargeDate)}</>}
            </p>
          </div>
          <div className="flex-shrink-0 flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-gray-400">Records</p>
              <p className="text-xs font-bold text-gray-700">{totalRecords}</p>
            </div>
            {open ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
          </div>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-5 py-5 space-y-5">
          {/* Vitals */}
          {vitals.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                Vital Signs · {formatDateTime(vitals[0].recordedAt)}
              </p>
              <div className="bg-gray-50/60 rounded-xl p-3">
                <VitalRow
                  icon={Thermometer}
                  label="Temperature"
                  value={vitals[0].temperature}
                  unit="°C"
                  color="#ef4444"
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
                  color="#3b82f6"
                />
                <VitalRow
                  icon={Heart}
                  label="Pulse Rate"
                  value={vitals[0].pulseRate}
                  unit="bpm"
                  color="#ec4899"
                />
                <VitalRow
                  icon={Wind}
                  label="Respiratory Rate"
                  value={vitals[0].respiratoryRate}
                  unit="/min"
                  color="#14b8a6"
                />
                <VitalRow
                  icon={Droplets}
                  label="SpO₂"
                  value={vitals[0].oxygenSaturation}
                  unit="%"
                  color="#0ea5e9"
                />
                <VitalRow
                  icon={Weight}
                  label="Weight"
                  value={vitals[0].weight}
                  unit="kg"
                  color="#f59e0b"
                />
                <VitalRow
                  icon={UserIcon}
                  label="Height"
                  value={vitals[0].height}
                  unit="cm"
                  color="#8b5cf6"
                />
                {vitals[0].painLevel != null && (
                  <div className="flex items-center justify-between py-2">
                    <span className="text-xs text-gray-500">Pain Level</span>
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
                                    ? "#22c55e"
                                    : vitals[0].painLevel! <= 6
                                      ? "#f59e0b"
                                      : "#ef4444"
                                  : "#e5e7eb",
                            }}
                          />
                        ))}
                      </div>
                      <span className="text-sm font-semibold text-gray-800">
                        {vitals[0].painLevel}/10
                      </span>
                    </div>
                  </div>
                )}
                {vitals[0].nurseNotes && (
                  <p className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100 italic">
                    {vitals[0].nurseNotes}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Consultations */}
          {consultations.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                Consultations ({consultations.length})
              </p>
              <div className="space-y-3">
                {consultations.map((c) => (
                  <div
                    key={c.id}
                    className="bg-blue-50/40 rounded-xl p-4 border border-blue-100/60 space-y-2"
                  >
                    {c.historyOfPresentIllness && (
                      <div>
                        <p className="text-xs font-semibold text-blue-600 uppercase mb-0.5">
                          History
                        </p>
                        <p className="text-sm text-gray-700">
                          {c.historyOfPresentIllness}
                        </p>
                      </div>
                    )}
                    {c.physicalExamination && (
                      <div>
                        <p className="text-xs font-semibold text-blue-600 uppercase mb-0.5">
                          Examination
                        </p>
                        <p className="text-sm text-gray-700">
                          {c.physicalExamination}
                        </p>
                      </div>
                    )}
                    {c.clinicalFindings && (
                      <div>
                        <p className="text-xs font-semibold text-blue-600 uppercase mb-0.5">
                          Clinical Findings
                        </p>
                        <p className="text-sm text-gray-700">
                          {c.clinicalFindings}
                        </p>
                      </div>
                    )}
                    {c.assessment && (
                      <div>
                        <p className="text-xs font-semibold text-blue-600 uppercase mb-0.5">
                          Assessment
                        </p>
                        <p className="text-sm text-gray-700">{c.assessment}</p>
                      </div>
                    )}
                    {c.plan && (
                      <div>
                        <p className="text-xs font-semibold text-blue-600 uppercase mb-0.5">
                          Plan
                        </p>
                        <p className="text-sm text-gray-700">{c.plan}</p>
                      </div>
                    )}
                    {c.followUpInstructions && (
                      <div>
                        <p className="text-xs font-semibold text-blue-600 uppercase mb-0.5">
                          Follow-up
                        </p>
                        <p className="text-sm text-gray-700">
                          {c.followUpInstructions}
                        </p>
                      </div>
                    )}
                    {c.nextAppointmentDate && (
                      <p className="text-xs text-gray-400">
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
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                Diagnoses ({diagnoses.length})
              </p>
              <div className="space-y-2">
                {diagnoses.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl"
                  >
                    <span className="font-mono text-xs bg-white px-2 py-1 rounded-lg border border-gray-200 text-gray-600 flex-shrink-0 mt-0.5">
                      {d.icdCode}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">
                        {d.diagnosisName}
                      </p>
                      <div className="flex gap-1.5 mt-1">
                        <Badge
                          label={d.diagnosisType.replace("_", " ")}
                          bg="#eff6ff"
                          text="#1d4ed8"
                        />
                        {d.severity && <Badge label={d.severity} />}
                      </div>
                      {d.notes && (
                        <p className="text-xs text-gray-500 mt-1">{d.notes}</p>
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
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                Prescriptions ({prescriptions.length})
              </p>
              <div className="space-y-3">
                {prescriptions.map((rx) => (
                  <div
                    key={rx.id}
                    className="border border-green-100 rounded-xl overflow-hidden"
                  >
                    <div className="flex items-center justify-between px-4 py-2.5 bg-green-50/60">
                      <span className="font-mono text-xs font-bold text-green-800">
                        {rx.prescriptionNumber}
                      </span>
                      <Badge
                        label={rx.status}
                        bg={rx.status === "dispensed" ? "#f0fdf4" : "#fffbeb"}
                        text={rx.status === "dispensed" ? "#166534" : "#92400e"}
                      />
                    </div>
                    <div className="divide-y divide-gray-50">
                      {rx.items.map((item) => (
                        <div
                          key={item.id}
                          className="px-4 py-3 flex items-start justify-between gap-3"
                        >
                          <div>
                            <p className="text-sm font-semibold text-gray-800">
                              {item.medicationName}
                              {item.genericName && (
                                <span className="text-xs text-gray-400 ml-1">
                                  ({item.genericName})
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {item.strength} · {item.dosageForm} · {item.dose}{" "}
                              · {item.frequency.replace(/_/g, " ")} ·{" "}
                              {item.route} · {item.duration}
                            </p>
                            {item.instructions && (
                              <p className="text-xs text-gray-400 italic mt-0.5">
                                {item.instructions}
                              </p>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs font-semibold text-gray-700">
                              ×{item.quantity}
                            </p>
                            {item.isDispensed && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-500 ml-auto mt-1" />
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
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                Lab Orders ({labOrders.length})
              </p>
              <div className="space-y-2">
                {labOrders.map((lo) => (
                  <div
                    key={lo.id}
                    className="p-3 bg-purple-50/40 rounded-xl border border-purple-100/60"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          {lo.testName}
                        </p>
                        <p className="text-xs text-gray-500 font-mono">
                          {lo.testCode} · {lo.specimenType}
                        </p>
                      </div>
                      <Badge
                        label={lo.status}
                        bg={lo.status === "resulted" ? "#f0fdf4" : "#eff6ff"}
                        text={lo.status === "resulted" ? "#166534" : "#1d4ed8"}
                      />
                    </div>
                    {lo.result && (
                      <div className="mt-2 pt-2 border-t border-purple-100 space-y-1">
                        {lo.result.interpretation && (
                          <p className="text-xs text-gray-600">
                            <span className="font-semibold">
                              Interpretation:
                            </span>{" "}
                            {lo.result.interpretation}
                          </p>
                        )}
                        {lo.result.abnormalFindings && (
                          <p className="text-xs text-amber-700 flex items-center gap-1">
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
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                Imaging ({imagingOrders.length})
              </p>
              <div className="space-y-2">
                {imagingOrders.map((io) => (
                  <div
                    key={io.id}
                    className="p-3 bg-sky-50/40 rounded-xl border border-sky-100/60"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <p className="text-sm font-semibold text-gray-800 uppercase">
                          {io.modality.replace("_", " ")} — {io.bodyPart}
                        </p>
                        <p className="text-xs text-gray-500">{io.indication}</p>
                      </div>
                      <Badge
                        label={io.status}
                        bg={io.status === "reported" ? "#f0fdf4" : "#eff6ff"}
                        text={io.status === "reported" ? "#166534" : "#1d4ed8"}
                      />
                    </div>
                    {io.report && (
                      <div className="mt-2 pt-2 border-t border-sky-100 space-y-1">
                        {io.report.findings && (
                          <p className="text-xs text-gray-600">
                            <span className="font-semibold">Findings:</span>{" "}
                            {io.report.findings}
                          </p>
                        )}
                        {io.report.impression && (
                          <p className="text-xs text-gray-600">
                            <span className="font-semibold">Impression:</span>{" "}
                            {io.report.impression}
                          </p>
                        )}
                        {io.report.recommendations && (
                          <p className="text-xs text-gray-600">
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
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Discharge Summary
              </p>
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Diagnosis:</span>{" "}
                {visit.dischargeDiagnosis}
              </p>
              {visit.dischargeSummary && (
                <p className="text-sm text-gray-700 mt-1">
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
}: {
  institution: AwayInstitution;
  patientId: string;
  onPermissionGranted: () => void;
}) {
  const [permState, setPermState] = useState<PermState>({ phase: "idle" });
  const [reason, setReason] = useState("");
  const [selectedPerms, setSelectedPerms] = useState<string[]>([
    "visits",
    "vitals",
    "diagnoses",
    "prescriptions",
    "lab_results",
    "imaging",
  ]);
  const [formError, setFormError] = useState("");
  const [open, setOpen] = useState(false);
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
        reason: reason.trim(),
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
      <div className="rounded-2xl border border-green-200 overflow-hidden">
        {/* Header */}
        <div
          className="px-5 py-3.5 flex items-center gap-3"
          style={{ background: "linear-gradient(135deg,#f0fdf4,#dcfce7)" }}
        >
          <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-4 h-4 text-green-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900">
              {institution.institutionName}
            </p>
            <p className="text-xs text-gray-500">
              {institution.visitCount} visit
              {institution.visitCount !== 1 ? "s" : ""}
            </p>
          </div>
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{ background: "#f0fdf4", color: "#166534" }}
          >
            <Unlock className="w-3 h-3" /> Access granted
          </div>
        </div>
        {/* Visits */}
        <div className="p-4 space-y-3" style={{ background: "#fafafa" }}>
          {institution.visits.map((record, i) => (
            <VisitCard key={record.visit.id} record={record} index={i} />
          ))}
        </div>
      </div>
    );
  }

  // ── LOCKED — permission gate ───────────────────────────────────────────────
  return (
    <div className="rounded-2xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 flex items-center gap-3 bg-white">
        <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
          <Building2 className="w-4 h-4 text-gray-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800">
            {institution.institutionName}
          </p>
          <p className="text-xs text-gray-400">
            {institution.visitCount} visit
            {institution.visitCount !== 1 ? "s" : ""} · access required
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
          <Lock className="w-3 h-3" /> Locked
        </div>
      </div>

      {/* Body */}
      <div
        className="border-t border-gray-100 px-5 py-4"
        style={{ background: "#fafafa" }}
      >
        {/* Idle — show prompt */}
        {permState.phase === "idle" && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-700">
                Records from this institution are protected
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Request consent from the patient to view their history from{" "}
                {institution.institutionName}.
              </p>
            </div>
            <button
              onClick={() => setPermState({ phase: "form" })}
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-white text-xs font-semibold shadow-sm hover:shadow-md transition-all"
              style={{ background: "linear-gradient(135deg,#166534,#15803d)" }}
            >
              <Send className="w-3.5 h-3.5" /> Request Access
            </button>
          </div>
        )}

        {/* Form */}
        {permState.phase === "form" && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <ShieldX className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                The patient will receive a notification on their mobile app and
                must approve your request.
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Requested Permissions
              </p>
              <div className="flex flex-wrap gap-2">
                {PERMISSIONS.map(({ key, label }) => {
                  const selected = selectedPerms.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => togglePerm(key)}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all"
                      style={
                        selected
                          ? {
                              background: "#f0fdf4",
                              borderColor: "#86efac",
                              color: "#166534",
                            }
                          : {
                              background: "#fafafa",
                              borderColor: "#e5e7eb",
                              color: "#6b7280",
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
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block">
                Clinical Reason <span className="text-red-400">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setFormError("");
                }}
                rows={2}
                placeholder={`Need to review ${institution.institutionName} records for…`}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-900 text-sm outline-none transition-all focus:border-green-500 focus:ring-2 focus:ring-green-500/10 placeholder:text-gray-400 resize-none"
              />
              <p className="text-xs text-gray-400">
                {reason.length} chars · minimum 10
              </p>
            </div>
            {formError && (
              <div className="flex items-start gap-2 p-2.5 rounded-xl bg-red-50 border border-red-100">
                <AlertCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-red-700">{formError}</p>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setPermState({ phase: "idle" });
                  setReason("");
                  setFormError("");
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                <XCircle className="w-3.5 h-3.5" /> Cancel
              </button>
              <button
                onClick={handleRequest}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-white text-xs font-semibold"
                style={{
                  background: "linear-gradient(135deg,#166534,#15803d)",
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
            <Loader2 className="w-4 h-4 animate-spin text-green-700" />
            <span className="text-sm text-gray-500">Sending request…</span>
          </div>
        )}

        {/* Pending */}
        {permState.phase === "pending" && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 border border-blue-100">
              <div className="relative w-8 h-8 flex-shrink-0">
                <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-green-600" />
                <div className="relative w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-green-700" />
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">
                  Waiting for patient approval
                </p>
                <p className="text-xs text-gray-500">
                  Checking every 5 seconds…
                </p>
              </div>
              <Loader2 className="w-4 h-4 animate-spin text-green-700 ml-auto flex-shrink-0" />
            </div>
            <button
              onClick={() => {
                stopPolling();
                setPermState({ phase: "idle" });
                setReason("");
              }}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50"
            >
              <XCircle className="w-3.5 h-3.5" /> Cancel request
            </button>
          </div>
        )}

        {/* Rejected */}
        {permState.phase === "rejected" && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-100">
              <Ban className="w-5 h-5 text-red-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-gray-800">
                  Request declined
                </p>
                <p className="text-xs text-gray-500">
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
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-white text-xs font-semibold"
              style={{ background: "linear-gradient(135deg,#166534,#15803d)" }}
            >
              <Send className="w-3.5 h-3.5" /> Send New Request
            </button>
          </div>
        )}

        {/* Expired */}
        {permState.phase === "expired" && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
              <Clock className="w-5 h-5 text-amber-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-gray-800">
                  Request expired
                </p>
                <p className="text-xs text-gray-500">
                  The patient didn't respond in time.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setPermState({ phase: "form" });
                setReason("");
              }}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-white text-xs font-semibold"
              style={{ background: "linear-gradient(135deg,#166534,#15803d)" }}
            >
              <RefreshCw className="w-3.5 h-3.5" /> Send New Request
            </button>
          </div>
        )}
      </div>
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
  const loadHistory = useCallback(async (pid: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await patientApi.getHistory(pid);
      const data = res.data.data;
      setPatient(data.patient);
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

  // Called when a permission is granted for an away institution — reload to get visits
  const handlePermissionGranted = useCallback(() => {
    if (resolvedPatientId) loadHistory(resolvedPatientId);
  }, [resolvedPatientId, loadHistory]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-green-700" />
        <p className="text-sm text-gray-500">Loading patient history…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-100 rounded-2xl p-8 text-center">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
        <p className="text-sm font-semibold text-red-700">{error}</p>
      </div>
    );
  }

  if (!patient) return null;

  const totalVisits =
    ownVisits.length + awayInstitutions.reduce((a, i) => a + i.visitCount, 0);
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
    <div style={{ fontFamily: "'DM Sans', sans-serif" }} className="space-y-5">
      {/* Patient demographics card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div
          className="px-5 py-4 flex items-center gap-4"
          style={{ background: "linear-gradient(135deg,#f0fdf4,#dcfce7)" }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold text-white flex-shrink-0"
            style={{ background: "#166534" }}
          >
            {patient.firstName[0]}
            {patient.lastName[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-lg">
              {patient.firstName}
              {patient.middleName ? ` ${patient.middleName}` : ""}{" "}
              {patient.lastName}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)}{" "}
              · Age {calculateAge(patient.dateOfBirth)} · DOB{" "}
              {formatDate(patient.dateOfBirth)}
            </p>
          </div>
          {patient.bloodType && patient.bloodType !== "unknown" && (
            <span
              className="text-xs font-bold px-2.5 py-1 rounded-full text-white flex-shrink-0"
              style={{
                background: BLOOD_TYPE_COLOR[patient.bloodType] ?? "#6b7280",
              }}
            >
              {patient.bloodType}
            </span>
          )}
        </div>
        <div className="px-5 py-3 grid grid-cols-2 gap-3 bg-gray-50/40 border-t border-gray-100">
          {[
            { label: "Phone", value: patient.phoneNumber },
            { label: "Marital Status", value: patient.maritalStatus },
            { label: "Occupation", value: patient.occupation },
            { label: "Email", value: patient.email },
          ]
            .filter(({ value }) => !!value)
            .map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-gray-400 uppercase tracking-wide">
                  {label}
                </p>
                <p className="text-sm font-semibold text-gray-700 capitalize truncate">
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
            color: "#166534",
          },
          {
            label: "Diagnoses",
            value: totalDiagnoses,
            icon: Stethoscope,
            color: "#2563eb",
          },
          {
            label: "Prescriptions",
            value: totalRx,
            icon: Pill,
            color: "#7c3aed",
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center"
          >
            <Icon className="w-5 h-5 mx-auto mb-1" style={{ color }} />
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      {/* ── OWN INSTITUTION RECORDS ─────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <ShieldCheck className="w-4 h-4 text-green-600" />
          <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">
            Own Institution Records
          </p>
          <span className="ml-auto text-xs font-semibold text-gray-400">
            {ownVisits.length} visit{ownVisits.length !== 1 ? "s" : ""}
          </span>
        </div>

        {ownVisits.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <FileText className="w-7 h-7 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">
              No visits at your institution yet.
            </p>
          </div>
        ) : (
          ownVisits.map((record, i) => (
            <VisitCard key={record.visit.id} record={record} index={i} />
          ))
        )}
      </div>

      {/* ── AWAY INSTITUTION RECORDS ────────────────────────────────────────── */}
      {awayInstitutions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Building2 className="w-4 h-4 text-gray-400" />
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">
              Away Institution Records
            </p>
            <span className="ml-auto text-xs font-semibold text-gray-400">
              {awayInstitutions.length} institution
              {awayInstitutions.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
            <ShieldX className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              Records from other institutions are protected by blockchain
              consent. Click <strong>Request Access</strong> on each institution
              — the patient will approve or deny from their mobile app.
            </p>
          </div>

          {awayInstitutions.map((inst) => (
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
