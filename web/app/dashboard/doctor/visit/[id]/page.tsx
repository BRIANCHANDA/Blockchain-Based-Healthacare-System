"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { visitApi } from "@/lib/api";
import {
  ChevronLeft,
  AlertCircle,
  ClipboardList,
  Stethoscope,
  FlaskConical,
  Scan,
  Pill,
  LogOut,
  Loader2,
  RefreshCw,
  Shield,
  ArrowLeftRight,
  User,
  Droplets,
  CheckCircle2,
  Activity,
  History,
  FileHeart,
  ChevronRight,
  Bed,
  HeartPulse,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Toast } from "@/components/doctor/shared/Toast";
import { PermissionGate } from "@/components/doctor/tabs/PermissionGate";
import { OverviewTab } from "@/components/doctor/tabs/OverviewTab";
import { ConsultationTab } from "@/components/doctor/tabs/ConsultationTab";
import { DiagnosisTab } from "@/components/doctor/tabs/DiagnosisTab";
import { LabOrdersTab } from "@/components/doctor/tabs/LabOrdersTab";
import { ImagingTab } from "@/components/doctor/tabs/ImagingTab";
import { PrescriptionsTab } from "@/components/doctor/tabs/PrescriptionsTab";
import { DischargeTab } from "@/components/doctor/tabs/DischargeTab";
import PatientHistoryTab from "@/components/doctor/tabs/PatientHistoryTab";
import { ReferralTab } from "@/components/doctor/tabs/ReferralTab";
import { MedicalProfileTab } from "@/components/doctor/tabs/MedicalProfileTab";
import { MinorBadge, ageFromDob } from "@/components/ui/MinorBadge";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab =
  | "overview"
  | "history"
  | "medical"
  | "consultation"
  | "diagnosis"
  | "labs"
  | "imaging"
  | "prescriptions"
  | "referrals"
  | "discharge";

type PermStage =
  | "checking"
  | "granted"
  | "denied"
  | "requesting"
  | "waiting"
  | "rejected"
  | "expired";

// ── Priority / status configs ─────────────────────────────────────────────────

const PRIORITY: Record<string, { bg: string; text: string; border: string; dot: string; label: string }> = {
  routine:   { bg: "#f0fdf4", text: "#15803d", border: "#86efac", dot: "#16a34a",  label: "Routine"   },
  urgent:    { bg: "#fffbeb", text: "#d97706", border: "#fcd34d", dot: "#f59e0b",  label: "Urgent"    },
  emergency: { bg: "#fef2f2", text: "#dc2626", border: "#fca5a5", dot: "#ef4444",  label: "Emergency" },
  critical:  { bg: "#fdf4ff", text: "#7c3aed", border: "#d8b4fe", dot: "#a855f7",  label: "Critical"  },
};

const BLOOD_COLOR: Record<string, string> = {
  "A+": "#3b82f6", "A-": "#6366f1", "B+": "#8b5cf6", "B-": "#ec4899",
  "AB+": "#f59e0b", "AB-": "#ef4444", "O+": "#10b981", "O-": "#14b8a6",
};

// ── Navigation groups ─────────────────────────────────────────────────────────

const NAV_GROUPS: {
  section: string;
  items: { key: Tab; label: string; icon: any; countKey?: string }[];
}[] = [
  {
    section: "Patient",
    items: [
      { key: "overview", label: "Overview",        icon: ClipboardList },
      { key: "history",  label: "Patient History", icon: History       },
      { key: "medical",  label: "Medical Profile", icon: FileHeart     },
    ],
  },
  {
    section: "Assessment",
    items: [
      { key: "consultation", label: "Consultation", icon: Stethoscope, countKey: "consultation" },
      { key: "diagnosis",    label: "Diagnosis",    icon: AlertCircle,  countKey: "diagnosis"   },
    ],
  },
  {
    section: "Investigations",
    items: [
      { key: "labs",    label: "Lab Orders", icon: FlaskConical, countKey: "labs"    },
      { key: "imaging", label: "Imaging",    icon: Scan,         countKey: "imaging" },
    ],
  },
  {
    section: "Treatment",
    items: [
      { key: "prescriptions", label: "Prescriptions", icon: Pill,          countKey: "prescriptions" },
      { key: "referrals",     label: "Referrals",     icon: ArrowLeftRight                           },
    ],
  },
  {
    section: "Discharge",
    items: [
      { key: "discharge", label: "Discharge Summary", icon: LogOut },
    ],
  },
];

// ── Sidebar nav item ──────────────────────────────────────────────────────────

function NavItem({
  item,
  active,
  count,
  done,
  isCompleted,
  onClick,
}: {
  item: (typeof NAV_GROUPS)[0]["items"][0];
  active: boolean;
  count: number;
  done: boolean;
  isCompleted: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  const isDischarge = item.key === "discharge";

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all text-left group"
      style={
        active
          ? { background: "#166534", color: "#fff" }
          : isDischarge && isCompleted
          ? { color: "#15803d", background: "#f0fdf4" }
          : { color: "#6b7280", background: "transparent" }
      }
      onMouseEnter={(e) => {
        if (!active)
          (e.currentTarget as HTMLButtonElement).style.background = "#f9fafb";
      }}
      onMouseLeave={(e) => {
        if (!active)
          (e.currentTarget as HTMLButtonElement).style.background = isDischarge && isCompleted ? "#f0fdf4" : "transparent";
      }}
    >
      <Icon
        className="w-4 h-4 flex-shrink-0"
        style={{ color: active ? "#86efac" : isDischarge && isCompleted ? "#15803d" : "#9ca3af" }}
      />
      <span className="flex-1 truncate">{item.label}</span>

      {/* Count badge */}
      {count > 0 && !active && (
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
          style={{ background: "#e5e7eb", color: "#374151" }}
        >
          {count}
        </span>
      )}

      {/* Done dot */}
      {done && !active && count === 0 && (
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
      )}

      {/* Discharged check */}
      {isDischarge && isCompleted && !active && (
        <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
      )}

      {/* Active: count shown white */}
      {count > 0 && active && (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/20 text-white min-w-[20px] text-center">
          {count}
        </span>
      )}
    </button>
  );
}

// ── Admit-to-ward modal ───────────────────────────────────────────────────────

function AdmitModal({ visitId, onClose, onAdmitted }: {
  visitId: string;
  onClose: () => void;
  onAdmitted: () => void;
}) {
  const [diagnosis, setDiagnosis] = useState("");
  const [priority, setPriority]   = useState("");
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState("");

  async function submit() {
    if (!diagnosis.trim()) { setErr("Admitting diagnosis is required."); return; }
    setSaving(true); setErr("");
    try {
      await visitApi.admit(visitId, {
        admittingDiagnosis: diagnosis.trim(),
        priority: priority || undefined,
      });
      onAdmitted();
    } catch (e: any) {
      setErr(e?.response?.data?.error?.message ?? "Failed to admit patient.");
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#fef3c7" }}>
            <Bed size={18} className="text-amber-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Admit Patient to Ward</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              This will change the visit to inpatient. The nurse will assign a bed from the ward view.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Admitting Diagnosis *</label>
            <textarea
              value={diagnosis}
              onChange={e => setDiagnosis(e.target.value)}
              placeholder="e.g. Severe community-acquired pneumonia requiring IV antibiotics and oxygen support"
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm resize-none outline-none focus:border-green-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Priority (optional — updates current priority)</label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white outline-none focus:border-green-400"
            >
              <option value="">Keep current priority</option>
              <option value="routine">Routine</option>
              <option value="urgent">Urgent</option>
              <option value="emergency">Emergency</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>

        {err && (
          <p className="mt-3 text-xs text-red-600 flex items-center gap-1.5">
            <AlertCircle size={12} />{err}
          </p>
        )}

        <div className="flex gap-2 mt-5 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="px-4 py-2 rounded-xl text-sm font-bold text-white"
            style={{ background: saving ? "#fbbf24" : "#d97706" }}
          >
            {saving ? "Admitting…" : "Confirm Admission"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DoctorVisitPage() {
  const { id: visitId } = useParams<{ id: string }>();
  const router = useRouter();

  const [permStage, setPermStage] = useState<PermStage>("checking");
  const [patientName, setPatientName] = useState("this patient");
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [visitData, setVisitData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [admitOpen, setAdmitOpen] = useState(false);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const checkPermission = useCallback(async () => {
    setPermStage("checking");
    try {
      const res = await visitApi.checkMyPermission(visitId);
      setPermStage(res.data.data?.hasPermission ? "granted" : "denied");
    } catch {
      setPermStage("denied");
    }
  }, [visitId]);

  useEffect(() => { checkPermission(); }, [checkPermission]);

  const loadVisit = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await visitApi.getSummary(visitId);
      setVisitData(res.data.data);
      const p = res.data.data?.patient;
      if (p) setPatientName(`${p.firstName} ${p.lastName}`);
    } catch (err: any) {
      if (err.response?.status === 403) setPermStage("denied");
      else showToast(err.response?.data?.error?.message ?? "Failed to load visit.", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [visitId]);

  useEffect(() => {
    if (permStage === "granted") loadVisit();
  }, [permStage, loadVisit]);

  // ── Permission / loading states ───────────────────────────────────────────

  if (permStage === "checking") {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 gap-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#f0fdf4,#dcfce7)" }}>
          <Shield size={24} className="text-green-700" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-700">Verifying access…</p>
          <p className="text-xs text-gray-400 mt-1">Checking blockchain permissions</p>
        </div>
        <Loader2 size={20} className="animate-spin text-green-600" />
      </div>
    );
  }

  if (permStage === "denied") {
    return (
      <div className="max-w-xl mx-auto py-4">
        {toast && <Toast message={toast.message} type={toast.type} />}
        <PermissionGate
          visitId={visitId}
          patientName={patientName}
          onGranted={() => setPermStage("granted")}
          onBack={() => router.back()}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <Loader2 size={32} className="animate-spin text-green-700 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading visit…</p>
        </div>
      </div>
    );
  }

  // ── Data extraction ───────────────────────────────────────────────────────

  const visit        = visitData?.visit;
  const patient      = visitData?.patient;
  const consultations  = visitData?.consultations  ?? [];
  const diagnoses      = visitData?.diagnoses      ?? [];
  const vitals         = visitData?.vitalSigns     ?? [];
  const labOrders      = visitData?.labOrders      ?? [];
  const imagingOrders  = visitData?.imagingOrders  ?? [];
  const prescriptions  = visitData?.prescriptions  ?? [];

  if (!visit) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <AlertCircle size={40} className="text-red-400 mx-auto mb-3" />
        <p className="text-gray-700 font-semibold">Visit not found</p>
        <button onClick={() => router.back()} className="mt-4 text-green-700 text-sm font-medium hover:underline">
          ← Go back
        </button>
      </div>
    );
  }

  const isCompleted = visit.status === "completed";
  const ps = PRIORITY[visit.priority] ?? PRIORITY.routine;

  const counts: Record<string, number> = {
    consultation:  consultations.length,
    diagnosis:     diagnoses.length,
    labs:          labOrders.length,
    imaging:       imagingOrders.length,
    prescriptions: prescriptions.length,
  };

  const latestConsultation = consultations[consultations.length - 1];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }} className="flex flex-col min-h-full -m-6">
      {toast && <Toast message={toast.message} type={toast.type} />}

      {/* ══ Patient header bar ══════════════════════════════════════════════ */}
      <div className="bg-white border-b border-gray-100 shadow-sm px-5 py-4 flex-shrink-0">
        <div className="flex items-center gap-4 max-w-full">

          {/* Back */}
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0"
          >
            <ChevronLeft size={17} />
          </button>

          {/* Avatar */}
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-base font-bold text-green-700 flex-shrink-0 select-none"
            style={{ background: "linear-gradient(135deg,#f0fdf4,#dcfce7)" }}
          >
            {patient?.firstName?.[0] ?? "?"}{patient?.lastName?.[0] ?? ""}
          </div>

          {/* Name + demographics */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-lg font-bold text-gray-900 leading-none">
                {patient ? `${patient.firstName} ${patient.lastName}` : patientName}
              </h1>
              {patient?.isMinor && (
                <MinorBadge
                  age={patient.dateOfBirth ? ageFromDob(patient.dateOfBirth) : undefined}
                  primaryGuardianName={(patient as any).guardians?.[0]?.guardianName}
                  primaryGuardianRelationship={(patient as any).guardians?.[0]?.relationship}
                />
              )}

              {/* Blood type */}
              {patient?.bloodType && patient.bloodType !== "unknown" && (
                <span
                  className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: BLOOD_COLOR[patient.bloodType] ?? "#6b7280" }}
                >
                  <Droplets size={9} /> {patient.bloodType}
                </span>
              )}

              {/* Gender */}
              {patient?.gender && (
                <span className="text-xs text-gray-400 capitalize">{patient.gender}</span>
              )}
            </div>

            {/* Visit meta row */}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="font-mono text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-lg">
                {visit.visitNumber}
              </span>

              {/* Priority */}
              <span
                className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                style={{ background: ps.bg, color: ps.text, border: `1px solid ${ps.border}` }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: ps.dot }} />
                {ps.label}
              </span>

              {/* Status */}
              {isCompleted ? (
                <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-100">
                  <CheckCircle2 size={10} /> Discharged
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" /> Active
                </span>
              )}

              {/* Visit type */}
              <span className="text-[11px] text-gray-400 capitalize">{visit.visitType}</span>

              {/* Chief complaint */}
              {visit.chiefComplaint && (
                <>
                  <span className="text-gray-200">·</span>
                  <span className="text-[11px] text-gray-500 italic truncate max-w-xs">
                    "{visit.chiefComplaint}"
                  </span>
                </>
              )}

              {/* Admitted time */}
              {visit.admissionDate && (
                <>
                  <span className="text-gray-200">·</span>
                  <span className="text-[11px] text-gray-400">
                    {formatDistanceToNow(new Date(visit.admissionDate), { addSuffix: true })}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Doctor + room pill + refresh */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {visit.wardOrRoom && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-100 text-xs text-gray-500">
                <Bed size={12} className="text-gray-400" />
                {visit.wardOrRoom}
              </div>
            )}
            {visit.assignedDoctorName && (
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-100 text-xs text-gray-500">
                <HeartPulse size={12} className="text-gray-400" />
                Dr. {visit.assignedDoctorName}
              </div>
            )}
            <button
              onClick={() => loadVisit(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* ══ Body: sidebar + content ══════════════════════════════════════════ */}
      <div className="flex flex-1 min-h-0">

        {/* ── Left sidebar navigation ── */}
        <aside className="w-52 flex-shrink-0 border-r border-gray-100 bg-gray-50/60 overflow-y-auto">
          <div className="p-3 space-y-1">
            {NAV_GROUPS.map((group, gi) => (
              <div key={group.section} className={gi > 0 ? "pt-2" : ""}>
                {/* Section label */}
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 px-3.5 pb-1 pt-1">
                  {group.section}
                </p>

                {group.items.map((item) => {
                  const count = item.countKey ? (counts[item.countKey] ?? 0) : 0;
                  const done =
                    (item.key === "consultation" && consultations.length > 0) ||
                    (item.key === "diagnosis" && diagnoses.length > 0) ||
                    (item.key === "labs" && labOrders.length > 0) ||
                    (item.key === "imaging" && imagingOrders.length > 0) ||
                    (item.key === "prescriptions" && prescriptions.length > 0);

                  return (
                    <NavItem
                      key={item.key}
                      item={item}
                      active={activeTab === item.key}
                      count={count}
                      done={done}
                      isCompleted={isCompleted}
                      onClick={() => setActiveTab(item.key)}
                    />
                  );
                })}

                {/* Divider between groups */}
                {gi < NAV_GROUPS.length - 1 && (
                  <div className="mt-2 border-b border-gray-100" />
                )}
              </div>
            ))}
          </div>

          {/* Admit to Ward — only for active, non-inpatient visits */}
          {!isCompleted && visit?.visitType !== 'inpatient' && (
            <div className="mx-3 mb-3">
              <button
                onClick={() => setAdmitOpen(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors"
                style={{ background: "#fffbeb", color: "#d97706", border: "1px solid #fde68a" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#fef3c7"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#fffbeb"; }}
              >
                <Bed size={13} />
                Admit to Ward
              </button>
            </div>
          )}

          {/* Inpatient badge — shown when already admitted */}
          {visit?.visitType === 'inpatient' && !isCompleted && (
            <div className="mx-3 mb-3 px-3 py-2 rounded-xl text-xs font-semibold text-center"
              style={{ background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe" }}>
              Admitted · Inpatient
            </div>
          )}

          {/* Vitals quick glance at bottom of sidebar */}
          {vitals.length > 0 && (() => {
            const v = vitals[0];
            return (
              <div className="mx-3 mb-4 p-3 rounded-xl border border-gray-100 bg-white space-y-2">
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">
                  Latest Vitals
                </p>
                {v.bloodPressureSystolic && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">BP</span>
                    <span className="font-semibold text-gray-700 tabular-nums">
                      {v.bloodPressureSystolic}/{v.bloodPressureDiastolic}
                    </span>
                  </div>
                )}
                {v.pulseRate && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">HR</span>
                    <span className={`font-semibold tabular-nums ${v.pulseRate > 100 || v.pulseRate < 50 ? "text-red-600" : "text-gray-700"}`}>
                      {v.pulseRate} bpm
                    </span>
                  </div>
                )}
                {v.temperature && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Temp</span>
                    <span className={`font-semibold tabular-nums ${parseFloat(v.temperature) >= 38 ? "text-red-600" : "text-gray-700"}`}>
                      {v.temperature}°C
                    </span>
                  </div>
                )}
                {v.oxygenSaturation && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">SpO₂</span>
                    <span className={`font-semibold tabular-nums ${v.oxygenSaturation < 94 ? "text-red-600" : "text-gray-700"}`}>
                      {v.oxygenSaturation}%
                    </span>
                  </div>
                )}
              </div>
            );
          })()}
        </aside>

        {/* ── Main content area ── */}
        <div className="flex-1 min-w-0 overflow-y-auto bg-[#f8faf8]">
          {/* Tab label breadcrumb */}
          <div className="flex items-center gap-2 px-6 pt-5 pb-2">
            <span className="text-xs text-gray-400">
              {NAV_GROUPS.find((g) => g.items.some((i) => i.key === activeTab))?.section}
            </span>
            <ChevronRight size={12} className="text-gray-300" />
            <span className="text-xs font-semibold text-gray-600">
              {NAV_GROUPS.flatMap((g) => g.items).find((i) => i.key === activeTab)?.label}
            </span>
          </div>

          <div className="px-6 pb-8">
            {activeTab === "overview" && (
              <OverviewTab
                visit={visit}
                consultations={consultations}
                diagnoses={diagnoses}
                vitals={vitals}
                labOrders={labOrders}
                imagingOrders={imagingOrders}
                prescriptions={prescriptions}
                setActiveTab={setActiveTab}
              />
            )}

            {activeTab === "history" && <PatientHistoryTab visitId={visitId} />}

            {activeTab === "medical" && visit?.patientId && (
              <MedicalProfileTab patientId={visit.patientId} />
            )}

            {activeTab === "consultation" && (
              <ConsultationTab
                visitId={visitId}
                consultations={consultations}
                patient={patient}
                vitalSigns={vitals}
                diagnoses={diagnoses}
                onSaved={() => { showToast("Consultation saved.", "success"); loadVisit(true); }}
                onError={(msg: string) => showToast(msg, "error")}
                isCompleted={isCompleted}
              />
            )}

            {activeTab === "diagnosis" && (
              <DiagnosisTab
                visitId={visitId}
                diagnoses={diagnoses}
                consultationId={latestConsultation?.id}
                onSaved={() => { showToast("Diagnosis added.", "success"); loadVisit(true); }}
                onError={(msg: string) => showToast(msg, "error")}
                isCompleted={isCompleted}
              />
            )}

            {activeTab === "labs" && (
              <LabOrdersTab
                visitId={visitId}
                labOrders={labOrders}
                onSaved={() => { showToast("Lab order(s) submitted.", "success"); loadVisit(true); }}
                onError={(msg) => showToast(msg, "error")}
                isCompleted={isCompleted}
              />
            )}

            {activeTab === "imaging" && (
              <ImagingTab
                visitId={visitId}
                imagingOrders={imagingOrders}
                onSaved={() => { showToast("Imaging order submitted.", "success"); loadVisit(true); }}
                onError={(msg) => showToast(msg, "error")}
                isCompleted={isCompleted}
              />
            )}

            {activeTab === "prescriptions" && (
              <PrescriptionsTab
                visitId={visitId}
                prescriptions={prescriptions}
                onSaved={() => { showToast("Prescription created.", "success"); loadVisit(true); }}
                onError={(msg: string) => showToast(msg, "error")}
                isCompleted={isCompleted}
              />
            )}

            {activeTab === "referrals" && (
              <ReferralTab
                visitId={visitId}
                patientId={visit.patientId}
                patientName={visit.patientName ?? patientName}
                chiefComplaint={visit.chiefComplaint ?? ""}
                isCompleted={isCompleted}
                onSuccess={(msg) => showToast(msg, "success")}
                onError={(msg) => showToast(msg, "error")}
              />
            )}

            {activeTab === "discharge" && (
              <DischargeTab
                visitId={visitId}
                visit={visit}
                patient={patient}
                consultations={consultations}
                diagnoses={diagnoses}
                vitalSigns={vitals}
                labOrders={labOrders}
                imagingOrders={imagingOrders}
                prescriptions={prescriptions}
                onSaved={() => { showToast("Patient discharged.", "success"); loadVisit(true); }}
                onError={(msg: string) => showToast(msg, "error")}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Admit modal ── */}
      {admitOpen && (
        <AdmitModal
          visitId={visitId}
          onClose={() => setAdmitOpen(false)}
          onAdmitted={() => {
            setAdmitOpen(false);
            showToast("Patient admitted. Nurse can now assign a bed from the Ward View.", "success");
            loadVisit(true);
          }}
        />
      )}
    </div>
  );
}
