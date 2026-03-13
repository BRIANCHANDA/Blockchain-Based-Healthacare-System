"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { visitApi } from "@/lib/api";
import {
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Stethoscope,
  FlaskConical,
  Scan,
  Pill,
  LogOut,
  PlusCircle,
  Trash2,
  ChevronDown,
  ChevronUp,
  TriangleAlert,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

// ── Types ──────────────────────────────────────────────────────────────────
type Tab =
  | "overview"
  | "consultation"
  | "diagnosis"
  | "labs"
  | "imaging"
  | "prescriptions"
  | "discharge";

const PRIORITY_STYLE: Record<
  string,
  { bg: string; text: string; border: string; dot: string }
> = {
  routine: {
    bg: "#f0fdf4",
    text: "#15803d",
    border: "#86efac",
    dot: "#16a34a",
  },
  urgent: { bg: "#fffbeb", text: "#d97706", border: "#fcd34d", dot: "#f59e0b" },
  emergency: {
    bg: "#fef2f2",
    text: "#dc2626",
    border: "#fca5a5",
    dot: "#ef4444",
  },
  critical: {
    bg: "#fdf4ff",
    text: "#7c3aed",
    border: "#d8b4fe",
    dot: "#a855f7",
  },
};

const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: "overview", label: "Overview", icon: ClipboardList },
  { key: "consultation", label: "Consultation", icon: Stethoscope },
  { key: "diagnosis", label: "Diagnosis", icon: AlertCircle },
  { key: "labs", label: "Lab Orders", icon: FlaskConical },
  { key: "imaging", label: "Imaging", icon: Scan },
  { key: "prescriptions", label: "Prescriptions", icon: Pill },
  { key: "discharge", label: "Discharge", icon: LogOut },
];

// ── Helpers ─────────────────────────────────────────────────────────────────
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
function TextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/10 focus:bg-white resize-none placeholder:text-gray-400 transition-all"
    />
  );
}
function Input({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/10 focus:bg-white placeholder:text-gray-400 transition-all"
    />
  );
}
function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/10 focus:bg-white transition-all"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
function SubmitBtn({
  onClick,
  loading,
  label,
  disabled = false,
}: {
  onClick: () => void;
  loading: boolean;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-md disabled:opacity-50"
      style={{ background: "linear-gradient(135deg, #166534, #15803d)" }}
    >
      {loading ? (
        <Loader2 size={15} className="animate-spin" />
      ) : (
        <CheckCircle2 size={15} />
      )}
      {label}
    </button>
  );
}
function Toast({
  message,
  type,
}: {
  message: string;
  type: "success" | "error";
}) {
  return (
    <div
      className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-in slide-in-from-top-2 duration-300
      ${type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-100"}`}
    >
      {type === "success" ? (
        <CheckCircle2 size={16} className="text-green-600" />
      ) : (
        <AlertCircle size={16} className="text-red-500" />
      )}
      {message}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function DoctorVisitPage() {
  const { id: visitId } = useParams<{ id: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [visitData, setVisitData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadVisit = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      try {
        const res = await visitApi.getSummary(visitId);
        setVisitData(res.data.data);
      } catch (err: any) {
        showToast(
          err.response?.data?.error?.message ?? "Failed to load visit.",
          "error",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [visitId],
  );

  useEffect(() => {
    loadVisit();
  }, [loadVisit]);

  const visit = visitData?.visit;
  const consultations = visitData?.consultations ?? [];
  const diagnoses = visitData?.diagnoses ?? [];
  const vitals = visitData?.vitalSigns ?? [];
  const labOrders = visitData?.labOrders ?? [];
  const imagingOrders = visitData?.imagingOrders ?? [];
  const prescriptions = visitData?.prescriptions ?? [];
  const ps = PRIORITY_STYLE[visit?.priority] ?? PRIORITY_STYLE.routine;
  const latestConsultation = consultations[consultations.length - 1];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <Loader2
            size={32}
            className="animate-spin text-green-700 mx-auto mb-3"
          />
          <p className="text-gray-400 text-sm">Loading visit data…</p>
        </div>
      </div>
    );
  }

  if (!visit) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <AlertCircle size={40} className="text-red-400 mx-auto mb-3" />
        <p className="text-gray-700 font-semibold">Visit not found</p>
        <button
          onClick={() => router.back()}
          className="mt-4 text-green-700 text-sm font-medium hover:underline"
        >
          ← Go back
        </button>
      </div>
    );
  }

  return (
    <div
      className="max-w-5xl mx-auto"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {toast && <Toast message={toast.message} type={toast.type} />}

      {/* ── Page header ─────────────────────────────────────── */}
      <div className="flex items-start gap-3 mb-5">
        <button
          onClick={() => router.back()}
          className="mt-0.5 p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <ChevronLeft size={18} className="text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900 font-mono">
              {visit.visitNumber}
            </h1>
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize"
              style={{
                background: ps.bg,
                color: ps.text,
                border: `1px solid ${ps.border}`,
              }}
            >
              {visit.priority}
            </span>
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize"
              style={{ background: "#f3f4f6", color: "#374151" }}
            >
              {visit.visitType}
            </span>
            {visit.status === "in-progress" && (
              <span
                className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ background: "#fef2f2", color: "#dc2626" }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                Active
              </span>
            )}
          </div>
          <p className="text-gray-600 text-sm mt-0.5 truncate">
            {visit.chiefComplaint}
          </p>
        </div>
        <button
          onClick={() => loadVisit(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* ── Vitals strip (always visible) ────────────────────── */}
      {vitals.length > 0 &&
        (() => {
          const v = vitals[0];
          const chips = [
            v.temperature != null && {
              label: "Temp",
              value: `${v.temperature}°C`,
              alert: parseFloat(v.temperature) >= 38,
            },
            v.bloodPressureSystolic != null && {
              label: "BP",
              value: `${v.bloodPressureSystolic}/${v.bloodPressureDiastolic}`,
              alert:
                v.bloodPressureSystolic >= 160 || v.bloodPressureSystolic <= 90,
            },
            v.pulseRate != null && {
              label: "HR",
              value: `${v.pulseRate} bpm`,
              alert: v.pulseRate > 100 || v.pulseRate < 50,
            },
            v.oxygenSaturation != null && {
              label: "SpO₂",
              value: `${v.oxygenSaturation}%`,
              alert: v.oxygenSaturation < 94,
            },
            v.respiratoryRate != null && {
              label: "RR",
              value: `${v.respiratoryRate}/min`,
              alert: v.respiratoryRate > 20,
            },
            v.painLevel != null && {
              label: "Pain",
              value: `${v.painLevel}/10`,
              alert: v.painLevel >= 7,
            },
          ].filter(Boolean) as {
            label: string;
            value: string;
            alert: boolean;
          }[];

          if (!chips.length) return null;
          return (
            <div className="flex flex-wrap gap-2 mb-4 p-3.5 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <span className="text-xs font-semibold text-gray-400 self-center mr-1">
                Vitals
              </span>
              {chips.map((c) => (
                <span
                  key={c.label}
                  className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={
                    c.alert
                      ? {
                          background: "#fef2f2",
                          color: "#dc2626",
                          border: "1px solid #fca5a5",
                        }
                      : { background: "#f3f4f6", color: "#374151" }
                  }
                >
                  {c.alert && <TriangleAlert size={10} />}
                  <span className="text-gray-400 font-normal">
                    {c.label}
                  </span>{" "}
                  {c.value}
                </span>
              ))}
              <span className="text-xs text-gray-400 self-center ml-auto">
                Recorded{" "}
                {formatDistanceToNow(new Date(vitals[0].recordedAt), {
                  addSuffix: true,
                })}
              </span>
            </div>
          );
        })()}

      {/* ── Tab bar ─────────────────────────────────────────── */}
      <div className="flex gap-1 overflow-x-auto pb-1 mb-4 scrollbar-hide">
        {TABS.map(({ key, label, icon: Icon }) => {
          const done =
            key === "consultation"
              ? consultations.length > 0
              : key === "diagnosis"
                ? diagnoses.length > 0
                : key === "labs"
                  ? labOrders.length > 0
                  : key === "imaging"
                    ? imagingOrders.length > 0
                    : key === "prescriptions"
                      ? prescriptions.length > 0
                      : key === "discharge"
                        ? visit.status === "completed"
                        : false;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0"
              style={
                activeTab === key
                  ? { background: "#166534", color: "#fff" }
                  : {
                      background: "#fff",
                      color: "#6b7280",
                      border: "1px solid #e5e7eb",
                    }
              }
            >
              <Icon size={13} />
              {label}
              {done && activeTab !== key && (
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tab content ─────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* ── OVERVIEW ── */}
        {activeTab === "overview" && (
          <div className="p-5 space-y-5">
            <SectionCard title="Visit Details">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                {[
                  { label: "Visit Type", value: visit.visitType },
                  { label: "Priority", value: visit.priority },
                  {
                    label: "Department",
                    value: visit.department?.departmentName ?? "—",
                  },
                  { label: "Ward / Room", value: visit.wardOrRoom ?? "—" },
                  {
                    label: "Admitted",
                    value: format(
                      new Date(visit.admissionDate),
                      "dd MMM yyyy, HH:mm",
                    ),
                  },
                  {
                    label: "Institution",
                    value: visit.institution?.institutionName ?? "—",
                  },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-0.5">
                      {label}
                    </p>
                    <p className="text-gray-800 font-medium capitalize">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
              {visit.admittingDiagnosis && (
                <div className="mt-4 p-3 rounded-xl bg-blue-50 border border-blue-100">
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">
                    Admitting Diagnosis
                  </p>
                  <p className="text-sm text-blue-800">
                    {visit.admittingDiagnosis}
                  </p>
                </div>
              )}
            </SectionCard>

            {/* Summary of all sections */}
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  label: "Consultations",
                  count: consultations.length,
                  tab: "consultation" as Tab,
                  icon: Stethoscope,
                  color: "#2563eb",
                  bg: "#eff6ff",
                },
                {
                  label: "Diagnoses",
                  count: diagnoses.length,
                  tab: "diagnosis" as Tab,
                  icon: AlertCircle,
                  color: "#166534",
                  bg: "#f0fdf4",
                },
                {
                  label: "Lab Orders",
                  count: labOrders.length,
                  tab: "labs" as Tab,
                  icon: FlaskConical,
                  color: "#d97706",
                  bg: "#fffbeb",
                },
                {
                  label: "Imaging",
                  count: imagingOrders.length,
                  tab: "imaging" as Tab,
                  icon: Scan,
                  color: "#7c3aed",
                  bg: "#fdf4ff",
                },
                {
                  label: "Prescriptions",
                  count: prescriptions.length,
                  tab: "prescriptions" as Tab,
                  icon: Pill,
                  color: "#0e7490",
                  bg: "#ecfeff",
                },
              ].map(({ label, count, tab, icon: Icon, color, bg }) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="flex items-center gap-3 p-3.5 rounded-xl border border-gray-100 hover:border-gray-200 transition-all text-left"
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: bg }}
                  >
                    <Icon size={16} style={{ color }} />
                  </div>
                  <div>
                    <p className="text-lg font-extrabold text-gray-900 leading-none">
                      {count}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{label}</p>
                  </div>
                  <ChevronRight size={14} className="text-gray-300 ml-auto" />
                </button>
              ))}
            </div>

            {/* Latest vitals full display */}
            {vitals.length > 0 && (
              <SectionCard
                title={`Vital Signs · ${formatDistanceToNow(new Date(vitals[0].recordedAt), { addSuffix: true })}`}
              >
                <div className="grid grid-cols-3 gap-3">
                  {[
                    {
                      label: "Temperature",
                      value: vitals[0].temperature,
                      unit: "°C",
                      alert: parseFloat(vitals[0].temperature ?? "0") >= 38,
                    },
                    {
                      label: "Blood Pressure",
                      value:
                        vitals[0].bloodPressureSystolic != null
                          ? `${vitals[0].bloodPressureSystolic}/${vitals[0].bloodPressureDiastolic}`
                          : null,
                      unit: "mmHg",
                      alert: vitals[0].bloodPressureSystolic >= 160,
                    },
                    {
                      label: "Heart Rate",
                      value: vitals[0].pulseRate,
                      unit: "bpm",
                      alert:
                        vitals[0].pulseRate > 100 || vitals[0].pulseRate < 50,
                    },
                    {
                      label: "SpO₂",
                      value: vitals[0].oxygenSaturation,
                      unit: "%",
                      alert: vitals[0].oxygenSaturation < 94,
                    },
                    {
                      label: "Respiratory Rate",
                      value: vitals[0].respiratoryRate,
                      unit: "/min",
                      alert: vitals[0].respiratoryRate > 20,
                    },
                    {
                      label: "Pain Level",
                      value: vitals[0].painLevel,
                      unit: "/10",
                      alert: vitals[0].painLevel >= 7,
                    },
                  ]
                    .filter((c) => c.value != null)
                    .map((c) => (
                      <div
                        key={c.label}
                        className="p-3 rounded-xl text-center"
                        style={
                          c.alert
                            ? {
                                background: "#fef2f2",
                                border: "1px solid #fca5a5",
                              }
                            : { background: "#f9fafb" }
                        }
                      >
                        {c.alert && (
                          <TriangleAlert
                            size={12}
                            className="text-red-500 mx-auto mb-1"
                          />
                        )}
                        <p
                          className="text-lg font-extrabold leading-none"
                          style={{ color: c.alert ? "#dc2626" : "#1f2937" }}
                        >
                          {c.value}
                          <span
                            className="text-xs font-normal ml-0.5"
                            style={{ color: c.alert ? "#ef4444" : "#9ca3af" }}
                          >
                            {c.unit}
                          </span>
                        </p>
                        <p className="text-xs text-gray-400 mt-1">{c.label}</p>
                      </div>
                    ))}
                </div>
                {vitals[0].nurseNotes && (
                  <div className="mt-3 p-3 rounded-xl bg-gray-50 text-sm text-gray-600 italic">
                    "{vitals[0].nurseNotes}"
                  </div>
                )}
              </SectionCard>
            )}
          </div>
        )}

        {/* ── CONSULTATION ── */}
        {activeTab === "consultation" && (
          <ConsultationTab
            visitId={visitId}
            consultations={consultations}
            onSaved={() => {
              showToast("Consultation saved successfully.", "success");
              loadVisit(true);
            }}
            onError={(msg) => showToast(msg, "error")}
            isCompleted={visit.status === "completed"}
          />
        )}

        {/* ── DIAGNOSIS ── */}
        {activeTab === "diagnosis" && (
          <DiagnosisTab
            visitId={visitId}
            diagnoses={diagnoses}
            consultationId={latestConsultation?.id}
            onSaved={() => {
              showToast("Diagnosis added.", "success");
              loadVisit(true);
            }}
            onError={(msg) => showToast(msg, "error")}
            isCompleted={visit.status === "completed"}
          />
        )}

        {/* ── LAB ORDERS ── */}
        {activeTab === "labs" && (
          <LabOrdersTab
            visitId={visitId}
            labOrders={labOrders}
            onSaved={() => {
              showToast("Lab order(s) submitted.", "success");
              loadVisit(true);
            }}
            onError={(msg) => showToast(msg, "error")}
            isCompleted={visit.status === "completed"}
          />
        )}

        {/* ── IMAGING ── */}
        {activeTab === "imaging" && (
          <ImagingTab
            visitId={visitId}
            imagingOrders={imagingOrders}
            onSaved={() => {
              showToast("Imaging order submitted.", "success");
              loadVisit(true);
            }}
            onError={(msg) => showToast(msg, "error")}
            isCompleted={visit.status === "completed"}
          />
        )}

        {/* ── PRESCRIPTIONS ── */}
        {activeTab === "prescriptions" && (
          <PrescriptionsTab
            visitId={visitId}
            prescriptions={prescriptions}
            onSaved={() => {
              showToast("Prescription created.", "success");
              loadVisit(true);
            }}
            onError={(msg) => showToast(msg, "error")}
            isCompleted={visit.status === "completed"}
          />
        )}

        {/* ── DISCHARGE ── */}
        {activeTab === "discharge" && (
          <DischargeTab
            visitId={visitId}
            visit={visit}
            onSaved={() => {
              showToast("Patient discharged successfully.", "success");
              loadVisit(true);
            }}
            onError={(msg) => showToast(msg, "error")}
          />
        )}
      </div>
    </div>
  );
}

// ── SectionCard ───────────────────────────────────────────────────────────────
function SectionCard({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-800">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

// ── CollapsibleRecord ─────────────────────────────────────────────────────────
function CollapsibleRecord({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <div>
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          {subtitle && (
            <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
          )}
        </div>
        {open ? (
          <ChevronUp size={15} className="text-gray-400" />
        ) : (
          <ChevronDown size={15} className="text-gray-400" />
        )}
      </button>
      {open && <div className="p-4 border-t border-gray-100">{children}</div>}
    </div>
  );
}

// ── CONSULTATION TAB ──────────────────────────────────────────────────────────
function ConsultationTab({
  visitId,
  consultations,
  onSaved,
  onError,
  isCompleted,
}: {
  visitId: string;
  consultations: any[];
  onSaved: () => void;
  onError: (m: string) => void;
  isCompleted: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    chiefComplaint: "",
    historyOfPresentIllness: "",
    reviewOfSystems: "",
    physicalExamination: "",
    clinicalFindings: "",
    assessment: "",
    plan: "",
    followUpInstructions: "",
  });

  const f = (field: keyof typeof form) => (v: string) =>
    setForm((prev) => ({ ...prev, [field]: v }));

  const handleSubmit = async () => {
    if (!form.chiefComplaint.trim()) {
      onError("Chief complaint is required.");
      return;
    }
    setLoading(true);
    try {
      await (visitApi as any).addConsultation(visitId, form);
      setForm({
        chiefComplaint: "",
        historyOfPresentIllness: "",
        reviewOfSystems: "",
        physicalExamination: "",
        clinicalFindings: "",
        assessment: "",
        plan: "",
        followUpInstructions: "",
      });
      onSaved();
    } catch (err: any) {
      onError(
        err.response?.data?.error?.message ?? "Failed to save consultation.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-5 space-y-5">
      {/* Past consultations */}
      {consultations.length > 0 && (
        <SectionCard title={`Past Consultations (${consultations.length})`}>
          <div className="space-y-2">
            {consultations.map((c, i) => (
              <CollapsibleRecord
                key={c.id}
                title={`Consultation ${i + 1}`}
                subtitle={format(
                  new Date(c.consultationDate ?? c.createdAt),
                  "dd MMM yyyy, HH:mm",
                )}
              >
                <div className="space-y-3 text-sm">
                  {[
                    ["Chief Complaint", c.chiefComplaint],
                    ["History of Present Illness", c.historyOfPresentIllness],
                    ["Review of Systems", c.reviewOfSystems],
                    ["Physical Examination", c.physicalExamination],
                    ["Clinical Findings", c.clinicalFindings],
                    ["Assessment", c.assessment],
                    ["Plan", c.plan],
                    ["Follow-up Instructions", c.followUpInstructions],
                  ]
                    .filter(([, v]) => v)
                    .map(([label, value]) => (
                      <div key={String(label)}>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                          {label}
                        </p>
                        <p className="text-gray-700 whitespace-pre-wrap">
                          {value}
                        </p>
                      </div>
                    ))}
                </div>
              </CollapsibleRecord>
            ))}
          </div>
        </SectionCard>
      )}

      {/* New consultation form */}
      {!isCompleted && (
        <SectionCard title="New Consultation Note">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <FieldGroup label="Chief Complaint *">
                <Input
                  value={form.chiefComplaint}
                  onChange={f("chiefComplaint")}
                  placeholder="Primary reason for this visit"
                />
              </FieldGroup>
              <FieldGroup label="History of Present Illness">
                <TextArea
                  value={form.historyOfPresentIllness}
                  onChange={f("historyOfPresentIllness")}
                  placeholder="Onset, duration, character, associated symptoms…"
                  rows={3}
                />
              </FieldGroup>
              <FieldGroup label="Review of Systems">
                <TextArea
                  value={form.reviewOfSystems}
                  onChange={f("reviewOfSystems")}
                  placeholder="Systematic review findings…"
                  rows={2}
                />
              </FieldGroup>
              <FieldGroup label="Physical Examination">
                <TextArea
                  value={form.physicalExamination}
                  onChange={f("physicalExamination")}
                  placeholder="General appearance, systems examination…"
                  rows={3}
                />
              </FieldGroup>
              <FieldGroup label="Clinical Findings">
                <TextArea
                  value={form.clinicalFindings}
                  onChange={f("clinicalFindings")}
                  placeholder="Significant positive and negative findings…"
                  rows={2}
                />
              </FieldGroup>
              <FieldGroup label="Assessment">
                <TextArea
                  value={form.assessment}
                  onChange={f("assessment")}
                  placeholder="Clinical impression and differential diagnoses…"
                  rows={2}
                />
              </FieldGroup>
              <FieldGroup label="Plan">
                <TextArea
                  value={form.plan}
                  onChange={f("plan")}
                  placeholder="Investigations, treatment, referrals…"
                  rows={3}
                />
              </FieldGroup>
              <FieldGroup label="Follow-up Instructions">
                <TextArea
                  value={form.followUpInstructions}
                  onChange={f("followUpInstructions")}
                  placeholder="Patient instructions on discharge or follow-up…"
                  rows={2}
                />
              </FieldGroup>
            </div>

            <div className="flex justify-end pt-2 border-t border-gray-100">
              <SubmitBtn
                onClick={handleSubmit}
                loading={loading}
                label="Save Consultation"
              />
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ── DIAGNOSIS TAB ─────────────────────────────────────────────────────────────
function DiagnosisTab({
  visitId,
  diagnoses,
  consultationId,
  onSaved,
  onError,
  isCompleted,
}: {
  visitId: string;
  diagnoses: any[];
  consultationId?: string;
  onSaved: () => void;
  onError: (m: string) => void;
  isCompleted: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    consultationId: consultationId ?? "",
    icdCode: "",
    diagnosisName: "",
    diagnosisStatus: "provisional" as
      | "provisional"
      | "confirmed"
      | "ruled_out"
      | "differential",
    severity: "",
    notes: "",
  });

  const f = (field: keyof typeof form) => (v: string) =>
    setForm((prev) => ({ ...prev, [field]: v }));

  const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    confirmed: { bg: "#f0fdf4", text: "#15803d" },
    provisional: { bg: "#fffbeb", text: "#d97706" },
    differential: { bg: "#eff6ff", text: "#2563eb" },
    ruled_out: { bg: "#f9fafb", text: "#6b7280" },
  };

  const handleSubmit = async () => {
    if (!form.diagnosisName.trim()) {
      onError("Diagnosis name is required.");
      return;
    }
    if (!form.icdCode.trim()) {
      onError("ICD code is required.");
      return;
    }
    if (!form.consultationId) {
      onError("No consultation found. Please add a consultation note first.");
      return;
    }
    setLoading(true);
    try {
      await (visitApi as any).addDiagnosis(visitId, form);
      setForm((prev) => ({
        ...prev,
        icdCode: "",
        diagnosisName: "",
        severity: "",
        notes: "",
      }));
      onSaved();
    } catch (err: any) {
      onError(err.response?.data?.error?.message ?? "Failed to add diagnosis.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-5 space-y-5">
      {/* Existing diagnoses */}
      {diagnoses.length > 0 && (
        <SectionCard title={`Diagnoses (${diagnoses.length})`}>
          <div className="space-y-2">
            {diagnoses.map((d) => {
              const sc =
                STATUS_COLORS[d.diagnosisStatus] ?? STATUS_COLORS.provisional;
              return (
                <div
                  key={d.id}
                  className="flex items-start gap-3 p-3.5 rounded-xl border border-gray-100"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {d.icdCode && (
                        <span className="text-xs font-bold font-mono text-gray-500 px-1.5 py-0.5 rounded bg-gray-100">
                          {d.icdCode}
                        </span>
                      )}
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize"
                        style={{ background: sc.bg, color: sc.text }}
                      >
                        {d.diagnosisStatus?.replace("_", " ")}
                      </span>
                      {d.severity && (
                        <span className="text-xs text-gray-400 capitalize">
                          {d.severity}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-gray-900">
                      {d.diagnosisName}
                    </p>
                    {d.notes && (
                      <p className="text-xs text-gray-500 mt-1">{d.notes}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* New diagnosis form */}
      {!isCompleted && (
        <SectionCard title="Add Diagnosis">
          {!consultationId && (
            <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-700">
              <AlertCircle size={14} />
              You need to save a consultation note before adding a diagnosis.
            </div>
          )}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FieldGroup label="ICD-10 Code *">
                <Input
                  value={form.icdCode}
                  onChange={f("icdCode")}
                  placeholder="e.g. I21.4"
                />
              </FieldGroup>
              <FieldGroup label="Diagnosis Status *">
                <Select
                  value={form.diagnosisStatus}
                  onChange={f("diagnosisStatus")}
                  options={[
                    { value: "provisional", label: "Provisional" },
                    { value: "confirmed", label: "Confirmed" },
                    { value: "differential", label: "Differential" },
                    { value: "ruled_out", label: "Ruled Out" },
                  ]}
                />
              </FieldGroup>
            </div>
            <FieldGroup label="Diagnosis Name *">
              <Input
                value={form.diagnosisName}
                onChange={f("diagnosisName")}
                placeholder="e.g. Non-ST Elevation Myocardial Infarction"
              />
            </FieldGroup>
            <div className="grid grid-cols-2 gap-4">
              <FieldGroup label="Severity">
                <Input
                  value={form.severity}
                  onChange={f("severity")}
                  placeholder="e.g. moderate, severe"
                />
              </FieldGroup>
            </div>
            <FieldGroup label="Notes">
              <TextArea
                value={form.notes}
                onChange={f("notes")}
                placeholder="Additional clinical notes…"
                rows={2}
              />
            </FieldGroup>
            <div className="flex justify-end pt-2 border-t border-gray-100">
              <SubmitBtn
                onClick={handleSubmit}
                loading={loading}
                label="Add Diagnosis"
                disabled={!consultationId}
              />
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ── LAB ORDERS TAB ────────────────────────────────────────────────────────────
const SPECIMEN_TYPES = [
  "blood",
  "urine",
  "stool",
  "sputum",
  "csf",
  "tissue",
  "swab",
  "other",
];
const URGENCY_OPTS = [
  { value: "routine", label: "Routine" },
  { value: "urgent", label: "Urgent" },
  { value: "emergency", label: "Emergency" },
  { value: "critical", label: "Critical" },
];

const COMMON_TESTS = [
  { name: "Full Blood Count", code: "FBC", specimen: "blood" },
  { name: "Urea & Electrolytes", code: "UE", specimen: "blood" },
  { name: "Liver Function Tests", code: "LFT", specimen: "blood" },
  { name: "Troponin I", code: "TROP-I", specimen: "blood" },
  { name: "Blood Glucose", code: "BGL", specimen: "blood" },
  { name: "HbA1c", code: "HBA1C", specimen: "blood" },
  { name: "Malaria RDT", code: "MAL-RDT", specimen: "blood" },
  { name: "Lipid Profile", code: "LIPID", specimen: "blood" },
  { name: "Urinalysis", code: "UA", specimen: "urine" },
  { name: "Blood Culture", code: "BC", specimen: "blood" },
  { name: "ABG", code: "ABG", specimen: "blood" },
];

type LabTest = {
  testName: string;
  testCode: string;
  specimenType:
    | "blood"
    | "urine"
    | "stool"
    | "sputum"
    | "csf"
    | "tissue"
    | "swab"
    | "other";
  urgency: "routine" | "urgent" | "emergency" | "critical";
  clinicalNotes: string;
};

function LabOrdersTab({
  visitId,
  labOrders,
  onSaved,
  onError,
  isCompleted,
}: {
  visitId: string;
  labOrders: any[];
  onSaved: () => void;
  onError: (m: string) => void;
  isCompleted: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [tests, setTests] = useState<LabTest[]>([
    {
      testName: "",
      testCode: "",
      specimenType: "blood",
      urgency: "routine",
      clinicalNotes: "",
    },
  ]);

  const addTest = () =>
    setTests((prev) => [
      ...prev,
      {
        testName: "",
        testCode: "",
        specimenType: "blood",
        urgency: "routine",
        clinicalNotes: "",
      },
    ]);
  const removeTest = (i: number) =>
    setTests((prev) => prev.filter((_, idx) => idx !== i));
  const updateTest = (i: number, field: keyof LabTest, value: string) =>
    setTests((prev) =>
      prev.map((t, idx) => (idx === i ? { ...t, [field]: value } : t)),
    );
  const fillFromCommon = (i: number, test: (typeof COMMON_TESTS)[0]) =>
    setTests((prev) =>
      prev.map((t, idx) =>
        idx === i
          ? {
              ...t,
              testName: test.name,
              testCode: test.code,
              specimenType: test.specimen as LabTest["specimenType"],
            }
          : t,
      ),
    );

  const handleSubmit = async () => {
    const valid = tests.filter((t) => t.testName.trim() && t.testCode.trim());
    if (!valid.length) {
      onError("Add at least one test with name and code.");
      return;
    }
    setLoading(true);
    try {
      await visitApi.orderLabs(visitId, { tests: valid });
      setTests([
        {
          testName: "",
          testCode: "",
          specimenType: "blood",
          urgency: "routine",
          clinicalNotes: "",
        },
      ]);
      onSaved();
    } catch (err: any) {
      onError(
        err.response?.data?.error?.message ?? "Failed to submit lab orders.",
      );
    } finally {
      setLoading(false);
    }
  };

  const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
    pending: { bg: "#fffbeb", text: "#d97706" },
    resulted: { bg: "#f0fdf4", text: "#15803d" },
    cancelled: { bg: "#f9fafb", text: "#6b7280" },
  };

  return (
    <div className="p-5 space-y-5">
      {/* Existing orders */}
      {labOrders.length > 0 && (
        <SectionCard title={`Lab Orders (${labOrders.length})`}>
          <div className="space-y-2">
            {labOrders.map((order) => {
              const ss = STATUS_STYLE[order.status] ?? STATUS_STYLE.pending;
              return (
                <CollapsibleRecord
                  key={order.id}
                  title={order.testName}
                  subtitle={`${order.orderNumber} · ${order.specimenType} · ${format(new Date(order.orderedAt ?? order.createdAt), "dd MMM, HH:mm")}`}
                >
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize"
                        style={{ background: ss.bg, color: ss.text }}
                      >
                        {order.status}
                      </span>
                      <span className="text-xs text-gray-400 capitalize">
                        {order.urgency}
                      </span>
                    </div>
                    {order.result && (
                      <div className="mt-2 p-3 rounded-xl bg-green-50 border border-green-100">
                        <p className="text-xs font-bold text-green-700 mb-1">
                          Results Available
                        </p>
                        {order.result.abnormalFindings && (
                          <p className="text-sm text-red-700 font-medium mb-1">
                            ⚠ {order.result.abnormalFindings}
                          </p>
                        )}
                        {order.result.interpretation && (
                          <p className="text-sm text-gray-700">
                            {order.result.interpretation}
                          </p>
                        )}
                        <pre className="text-xs text-gray-600 mt-2 whitespace-pre-wrap font-mono">
                          {typeof order.result.resultsData === "object"
                            ? JSON.stringify(order.result.resultsData, null, 2)
                            : order.result.resultsData}
                        </pre>
                      </div>
                    )}
                  </div>
                </CollapsibleRecord>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* New orders form */}
      {!isCompleted && (
        <SectionCard title="Order Lab Tests">
          {/* Quick pick */}
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Quick Add Common Tests
            </p>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_TESTS.map((test) => (
                <button
                  key={test.code}
                  onClick={() => {
                    const empty = tests.findIndex((t) => !t.testName);
                    if (empty >= 0) fillFromCommon(empty, test);
                    else {
                      addTest();
                      setTimeout(() => fillFromCommon(tests.length, test), 0);
                    }
                  }}
                  className="text-xs font-medium px-2.5 py-1 rounded-full border border-gray-200 hover:border-green-400 hover:text-green-700 transition-all"
                >
                  + {test.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {tests.map((test, i) => (
              <div
                key={i}
                className="p-4 rounded-xl border border-gray-200 space-y-3 relative"
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-bold text-gray-500">
                    Test {i + 1}
                  </p>
                  {tests.length > 1 && (
                    <button
                      onClick={() => removeTest(i)}
                      className="text-red-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FieldGroup label="Test Name *">
                    <Input
                      value={test.testName}
                      onChange={(v) => updateTest(i, "testName", v)}
                      placeholder="e.g. Full Blood Count"
                    />
                  </FieldGroup>
                  <FieldGroup label="Test Code *">
                    <Input
                      value={test.testCode}
                      onChange={(v) => updateTest(i, "testCode", v)}
                      placeholder="e.g. FBC"
                    />
                  </FieldGroup>
                  <FieldGroup label="Specimen Type">
                    <Select
                      value={test.specimenType}
                      onChange={(v) => updateTest(i, "specimenType", v)}
                      options={SPECIMEN_TYPES.map((s) => ({
                        value: s,
                        label: s.charAt(0).toUpperCase() + s.slice(1),
                      }))}
                    />
                  </FieldGroup>
                  <FieldGroup label="Urgency">
                    <Select
                      value={test.urgency}
                      onChange={(v) => updateTest(i, "urgency", v)}
                      options={URGENCY_OPTS}
                    />
                  </FieldGroup>
                </div>
                <FieldGroup label="Clinical Notes">
                  <Input
                    value={test.clinicalNotes}
                    onChange={(v) => updateTest(i, "clinicalNotes", v)}
                    placeholder="Reason for test, clinical context…"
                  />
                </FieldGroup>
              </div>
            ))}

            <button
              onClick={addTest}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-gray-300 text-sm text-gray-500 hover:border-green-400 hover:text-green-700 transition-all"
            >
              <PlusCircle size={15} /> Add another test
            </button>

            <div className="flex justify-end pt-2 border-t border-gray-100">
              <SubmitBtn
                onClick={handleSubmit}
                loading={loading}
                label={`Order ${tests.filter((t) => t.testName).length || ""} Test${tests.filter((t) => t.testName).length !== 1 ? "s" : ""}`}
              />
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ── IMAGING TAB ───────────────────────────────────────────────────────────────
const MODALITIES = [
  "x-ray",
  "ct_scan",
  "mri",
  "ultrasound",
  "pet_scan",
  "mammogram",
  "fluoroscopy",
] as const;

function ImagingTab({
  visitId,
  imagingOrders,
  onSaved,
  onError,
  isCompleted,
}: {
  visitId: string;
  imagingOrders: any[];
  onSaved: () => void;
  onError: (m: string) => void;
  isCompleted: boolean;
}) {
  type ImagingForm = {
    modality: (typeof MODALITIES)[number];
    bodyPart: string;
    indication: string;
    urgency: "routine" | "urgent" | "emergency" | "critical";
  };

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<ImagingForm>({
    modality: "x-ray",
    bodyPart: "",
    indication: "",
    urgency: "routine",
  });
  const f = (field: keyof ImagingForm) => (v: string) =>
    setForm((prev) => ({ ...prev, [field]: v }) as ImagingForm);

  const handleSubmit = async () => {
    if (!form.bodyPart.trim() || !form.indication.trim()) {
      onError("Body part and indication are required.");
      return;
    }
    setLoading(true);
    try {
      await visitApi.orderImaging(visitId, form);
      setForm({
        modality: "x-ray",
        bodyPart: "",
        indication: "",
        urgency: "routine",
      });
      onSaved();
    } catch (err: any) {
      onError(
        err.response?.data?.error?.message ?? "Failed to submit imaging order.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-5 space-y-5">
      {/* Existing orders */}
      {imagingOrders.length > 0 && (
        <SectionCard title={`Imaging Orders (${imagingOrders.length})`}>
          <div className="space-y-2">
            {imagingOrders.map((order) => (
              <CollapsibleRecord
                key={order.id}
                title={`${order.modality?.replace("_", " ").toUpperCase()} — ${order.bodyPart}`}
                subtitle={`${order.orderNumber} · ${order.urgency} · ${order.status}`}
              >
                <div className="space-y-2 text-sm">
                  <p className="text-gray-600">
                    <span className="font-semibold text-gray-700">
                      Indication:{" "}
                    </span>
                    {order.indication}
                  </p>
                  {order.report && (
                    <div className="mt-2 p-3 rounded-xl bg-purple-50 border border-purple-100">
                      <p className="text-xs font-bold text-purple-700 mb-1">
                        Radiology Report
                      </p>
                      <p className="text-sm text-gray-800 font-medium mb-1">
                        Impression: {order.report.impression}
                      </p>
                      <p className="text-sm text-gray-600">
                        {order.report.findings}
                      </p>
                      {order.report.recommendations && (
                        <p className="text-xs text-gray-500 mt-2">
                          Rec: {order.report.recommendations}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </CollapsibleRecord>
            ))}
          </div>
        </SectionCard>
      )}

      {/* New order form */}
      {!isCompleted && (
        <SectionCard title="Order Imaging Study">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FieldGroup label="Modality *">
                <Select
                  value={form.modality}
                  onChange={f("modality")}
                  options={MODALITIES.map((m) => ({
                    value: m,
                    label: m.replace("_", " ").toUpperCase(),
                  }))}
                />
              </FieldGroup>
              <FieldGroup label="Urgency">
                <Select
                  value={form.urgency}
                  onChange={f("urgency")}
                  options={URGENCY_OPTS}
                />
              </FieldGroup>
            </div>
            <FieldGroup label="Body Part *">
              <Input
                value={form.bodyPart}
                onChange={f("bodyPart")}
                placeholder="e.g. Chest, Right knee, Abdomen"
              />
            </FieldGroup>
            <FieldGroup label="Clinical Indication *">
              <TextArea
                value={form.indication}
                onChange={f("indication")}
                placeholder="Clinical history and reason for imaging…"
                rows={3}
              />
            </FieldGroup>
            <div className="flex justify-end pt-2 border-t border-gray-100">
              <SubmitBtn
                onClick={handleSubmit}
                loading={loading}
                label="Submit Imaging Order"
              />
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ── PRESCRIPTIONS TAB ─────────────────────────────────────────────────────────
type Medication = {
  medicationName: string;
  genericName: string;
  strength: string;
  dosageForm: string;
  dose: string;
  frequency: string;
  route: string;
  duration: string;
  quantity: string;
  instructions: string;
  refillsAllowed: string;
};

const BLANK_MED: Medication = {
  medicationName: "",
  genericName: "",
  strength: "",
  dosageForm: "tablet",
  dose: "",
  frequency: "once_daily",
  route: "oral",
  duration: "",
  quantity: "1",
  instructions: "",
  refillsAllowed: "0",
};

const DOSAGE_FORMS = [
  "tablet",
  "capsule",
  "syrup",
  "injection",
  "cream",
  "ointment",
  "drops",
  "inhaler",
  "suppository",
];
const FREQUENCIES = [
  "once_daily",
  "twice_daily",
  "three_times_daily",
  "four_times_daily",
  "every_4_hours",
  "every_6_hours",
  "every_8_hours",
  "as_needed",
  "stat",
];
const ROUTES = [
  "oral",
  "intravenous",
  "intramuscular",
  "subcutaneous",
  "topical",
  "inhalation",
  "rectal",
  "sublingual",
];

function PrescriptionsTab({
  visitId,
  prescriptions,
  onSaved,
  onError,
  isCompleted,
}: {
  visitId: string;
  prescriptions: any[];
  onSaved: () => void;
  onError: (m: string) => void;
  isCompleted: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [meds, setMeds] = useState<Medication[]>([{ ...BLANK_MED }]);

  const addMed = () => setMeds((prev) => [...prev, { ...BLANK_MED }]);
  const removeMed = (i: number) =>
    setMeds((prev) => prev.filter((_, idx) => idx !== i));
  const updateMed = (i: number, field: keyof Medication, value: string) =>
    setMeds((prev) =>
      prev.map((m, idx) => (idx === i ? { ...m, [field]: value } : m)),
    );

  const handleSubmit = async () => {
    const valid = meds.filter(
      (m) =>
        m.medicationName.trim() &&
        m.strength.trim() &&
        m.dose.trim() &&
        m.duration.trim(),
    );
    if (!valid.length) {
      onError("Complete at least one medication row.");
      return;
    }
    setLoading(true);
    try {
      await (visitApi as any).addPrescription(visitId, {
        medications: valid.map((m) => ({
          ...m,
          quantity: parseInt(m.quantity) || 1,
          refillsAllowed: parseInt(m.refillsAllowed) || 0,
        })),
      });
      setMeds([{ ...BLANK_MED }]);
      onSaved();
    } catch (err: any) {
      onError(
        err.response?.data?.error?.message ?? "Failed to create prescription.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-5 space-y-5">
      {/* Existing prescriptions */}
      {prescriptions.length > 0 && (
        <SectionCard title={`Prescriptions (${prescriptions.length})`}>
          <div className="space-y-2">
            {prescriptions.map((rx) => (
              <CollapsibleRecord
                key={rx.id}
                title={rx.prescriptionNumber}
                subtitle={`${rx.status} · ${format(new Date(rx.prescribedAt ?? rx.createdAt), "dd MMM yyyy, HH:mm")}`}
              >
                <div className="space-y-2">
                  {rx.items?.map((item: any) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-2.5 p-2.5 rounded-lg bg-gray-50"
                    >
                      <div
                        className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                        style={{
                          background: item.isDispensed ? "#16a34a" : "#d1d5db",
                        }}
                      />
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {item.medicationName} {item.strength}
                        </p>
                        <p className="text-xs text-gray-500 capitalize">
                          {item.dose} · {item.frequency?.replace(/_/g, " ")} ·{" "}
                          {item.route} · {item.duration}
                        </p>
                        {item.instructions && (
                          <p className="text-xs text-gray-400 italic mt-0.5">
                            {item.instructions}
                          </p>
                        )}
                        {item.isDispensed && (
                          <p className="text-xs font-semibold text-green-600 mt-0.5">
                            ✓ Dispensed
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleRecord>
            ))}
          </div>
        </SectionCard>
      )}

      {/* New prescription form */}
      {!isCompleted && (
        <SectionCard title="New Prescription">
          <div className="space-y-4">
            {meds.map((med, i) => (
              <div
                key={i}
                className="p-4 rounded-xl border border-gray-200 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-gray-500">
                    Medication {i + 1}
                  </p>
                  {meds.length > 1 && (
                    <button
                      onClick={() => removeMed(i)}
                      className="text-red-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FieldGroup label="Drug Name *">
                    <Input
                      value={med.medicationName}
                      onChange={(v) => updateMed(i, "medicationName", v)}
                      placeholder="e.g. Aspirin"
                    />
                  </FieldGroup>
                  <FieldGroup label="Strength *">
                    <Input
                      value={med.strength}
                      onChange={(v) => updateMed(i, "strength", v)}
                      placeholder="e.g. 300mg"
                    />
                  </FieldGroup>
                  <FieldGroup label="Dosage Form">
                    <Select
                      value={med.dosageForm}
                      onChange={(v) => updateMed(i, "dosageForm", v)}
                      options={DOSAGE_FORMS.map((d) => ({
                        value: d,
                        label: d.charAt(0).toUpperCase() + d.slice(1),
                      }))}
                    />
                  </FieldGroup>
                  <FieldGroup label="Route">
                    <Select
                      value={med.route}
                      onChange={(v) => updateMed(i, "route", v)}
                      options={ROUTES.map((r) => ({
                        value: r,
                        label: r.charAt(0).toUpperCase() + r.slice(1),
                      }))}
                    />
                  </FieldGroup>
                  <FieldGroup label="Dose *">
                    <Input
                      value={med.dose}
                      onChange={(v) => updateMed(i, "dose", v)}
                      placeholder="e.g. 1 tablet, 5ml"
                    />
                  </FieldGroup>
                  <FieldGroup label="Frequency">
                    <Select
                      value={med.frequency}
                      onChange={(v) => updateMed(i, "frequency", v)}
                      options={FREQUENCIES.map((fr) => ({
                        value: fr,
                        label: fr.replace(/_/g, " "),
                      }))}
                    />
                  </FieldGroup>
                  <FieldGroup label="Duration *">
                    <Input
                      value={med.duration}
                      onChange={(v) => updateMed(i, "duration", v)}
                      placeholder="e.g. 7 days, 2 weeks"
                    />
                  </FieldGroup>
                  <FieldGroup label="Quantity">
                    <Input
                      value={med.quantity}
                      onChange={(v) => updateMed(i, "quantity", v)}
                      placeholder="e.g. 14"
                      type="number"
                    />
                  </FieldGroup>
                </div>
                <FieldGroup label="Instructions">
                  <Input
                    value={med.instructions}
                    onChange={(v) => updateMed(i, "instructions", v)}
                    placeholder="e.g. Take with food, avoid sun exposure"
                  />
                </FieldGroup>
              </div>
            ))}

            <button
              onClick={addMed}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-gray-300 text-sm text-gray-500 hover:border-green-400 hover:text-green-700 transition-all"
            >
              <PlusCircle size={15} /> Add another medication
            </button>

            <div className="flex justify-end pt-2 border-t border-gray-100">
              <SubmitBtn
                onClick={handleSubmit}
                loading={loading}
                label="Create Prescription"
              />
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ── DISCHARGE TAB ─────────────────────────────────────────────────────────────
function DischargeTab({
  visitId,
  visit,
  onSaved,
  onError,
}: {
  visitId: string;
  visit: any;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    dischargeDiagnosis: "",
    dischargeSummary: "",
    dischargeInstructions: "",
    followUpDate: "",
  });
  const f = (field: keyof typeof form) => (v: string) =>
    setForm((prev) => ({ ...prev, [field]: v }));

  const isCompleted = visit.status === "completed";

  const handleSubmit = async () => {
    if (
      !form.dischargeDiagnosis.trim() ||
      !form.dischargeSummary.trim() ||
      !form.dischargeInstructions.trim()
    ) {
      onError(
        "Discharge diagnosis, summary, and instructions are all required.",
      );
      return;
    }
    setLoading(true);
    try {
      await visitApi.discharge(visitId, {
        ...form,
        followUpDate: form.followUpDate
          ? new Date(form.followUpDate).toISOString()
          : undefined,
      });
      onSaved();
    } catch (err: any) {
      onError(err.response?.data?.error?.message ?? "Discharge failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-5 space-y-5">
      {isCompleted ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-green-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            Patient Discharged
          </h3>
          <p className="text-gray-500 text-sm mb-4">
            This visit was closed on{" "}
            {format(
              new Date(visit.dischargeDate ?? visit.updatedAt),
              "dd MMM yyyy, HH:mm",
            )}
          </p>
          {visit.dischargeDiagnosis && (
            <div className="max-w-md mx-auto text-left p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-2">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Discharge Diagnosis
                </p>
                <p className="text-sm text-gray-800 mt-0.5">
                  {visit.dischargeDiagnosis}
                </p>
              </div>
              {visit.dischargeSummary && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Summary
                  </p>
                  <p className="text-sm text-gray-700 mt-0.5">
                    {visit.dischargeSummary}
                  </p>
                </div>
              )}
              {visit.dischargeInstructions && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Instructions
                  </p>
                  <p className="text-sm text-gray-700 mt-0.5">
                    {visit.dischargeInstructions}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
            <TriangleAlert
              size={18}
              className="text-amber-500 mt-0.5 flex-shrink-0"
            />
            <div>
              <p className="text-sm font-bold text-amber-800">
                Discharging this patient will close the visit
              </p>
              <p className="text-sm text-amber-700 mt-0.5">
                All visit-scoped blockchain permissions will be automatically
                revoked. This action cannot be undone.
              </p>
            </div>
          </div>

          <SectionCard title="Discharge Summary">
            <div className="space-y-4">
              <FieldGroup label="Discharge Diagnosis *">
                <Input
                  value={form.dischargeDiagnosis}
                  onChange={f("dischargeDiagnosis")}
                  placeholder="Final confirmed diagnosis"
                />
              </FieldGroup>
              <FieldGroup label="Discharge Summary *">
                <TextArea
                  value={form.dischargeSummary}
                  onChange={f("dischargeSummary")}
                  placeholder="Brief summary of the admission, treatment provided, response to treatment, and condition at discharge…"
                  rows={5}
                />
              </FieldGroup>
              <FieldGroup label="Discharge Instructions *">
                <TextArea
                  value={form.dischargeInstructions}
                  onChange={f("dischargeInstructions")}
                  placeholder="Medications to continue, activity restrictions, diet, warning signs to watch for, when to return…"
                  rows={4}
                />
              </FieldGroup>
              <FieldGroup label="Follow-up Date">
                <Input
                  value={form.followUpDate}
                  onChange={f("followUpDate")}
                  type="date"
                />
              </FieldGroup>

              <div className="flex justify-end pt-2 border-t border-gray-100">
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-md disabled:opacity-50"
                  style={{
                    background: "linear-gradient(135deg, #dc2626, #b91c1c)",
                  }}
                >
                  {loading ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <LogOut size={15} />
                  )}
                  Discharge Patient
                </button>
              </div>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}
