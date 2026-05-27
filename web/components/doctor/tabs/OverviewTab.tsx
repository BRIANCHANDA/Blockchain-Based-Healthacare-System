import {
  AlertCircle,
  ChevronRight,
  FlaskConical,
  Pill,
  Scan,
  Stethoscope,
  TriangleAlert,
  Thermometer,
  Heart,
  Wind,
  Droplets,
  Gauge,
  Activity,
  Clock,
  MapPin,
  Tag,
  CalendarDays,
  MessageSquare,
  ArrowLeftRight,
} from "lucide-react";
import { safeFormatDate, safeDistanceToNow } from "../utils/dateHelpers";

// ── Priority config ───────────────────────────────────────────────────────────
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

// ── Vitals config ─────────────────────────────────────────────────────────────
const VITAL_CONFIG = [
  {
    key: "temperature",
    label: "Temperature",
    unit: "°C",
    icon: Thermometer,
    color: "#ef4444",
    alertFn: (v: any) => parseFloat(v ?? "0") >= 38,
    format: (v: any) => v,
  },
  {
    key: "bp",
    label: "Blood Pressure",
    unit: "mmHg",
    icon: Gauge,
    color: "#3b82f6",
    alertFn: (_v: any, row: any) => row.bloodPressureSystolic >= 160,
    format: (_v: any, row: any) =>
      row.bloodPressureSystolic != null
        ? `${row.bloodPressureSystolic}/${row.bloodPressureDiastolic}`
        : null,
  },
  {
    key: "pulseRate",
    label: "Heart Rate",
    unit: "bpm",
    icon: Heart,
    color: "#ec4899",
    alertFn: (v: any) => v > 100 || v < 50,
    format: (v: any) => v,
  },
  {
    key: "oxygenSaturation",
    label: "SpO₂",
    unit: "%",
    icon: Droplets,
    color: "#0ea5e9",
    alertFn: (v: any) => v < 94,
    format: (v: any) => v,
  },
  {
    key: "respiratoryRate",
    label: "Resp. Rate",
    unit: "/min",
    icon: Wind,
    color: "#14b8a6",
    alertFn: (v: any) => v > 20,
    format: (v: any) => v,
  },
  {
    key: "painLevel",
    label: "Pain",
    unit: "/10",
    icon: Activity,
    color: "#f97316",
    alertFn: (v: any) => v >= 7,
    format: (v: any) => v,
  },
] as const;

// ── Clinical summary cards ────────────────────────────────────────────────────
const SUMMARY_CARDS = [
  {
    key: "consultation",
    label: "Consultations",
    icon: Stethoscope,
    color: "#2563eb",
    bg: "#eff6ff",
    border: "#bfdbfe",
  },
  {
    key: "diagnosis",
    label: "Diagnoses",
    icon: AlertCircle,
    color: "#166534",
    bg: "#f0fdf4",
    border: "#bbf7d0",
  },
  {
    key: "labs",
    label: "Lab Orders",
    icon: FlaskConical,
    color: "#d97706",
    bg: "#fffbeb",
    border: "#fde68a",
  },
  {
    key: "imaging",
    label: "Imaging",
    icon: Scan,
    color: "#7c3aed",
    bg: "#fdf4ff",
    border: "#e9d5ff",
  },
  {
    key: "prescriptions",
    label: "Prescriptions",
    icon: Pill,
    color: "#0e7490",
    bg: "#ecfeff",
    border: "#a5f3fc",
  },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────
function InfoChip({
  icon: Icon,
  label,
  value,
  highlight = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: highlight ? "#fef2f2" : "#f8fafc" }}
      >
        <Icon
          className="w-3.5 h-3.5"
          style={{ color: highlight ? "#ef4444" : "#94a3b8" }}
        />
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 leading-none mb-0.5">
          {label}
        </p>
        <p className="text-sm font-semibold text-gray-800 capitalize leading-snug">
          {value}
        </p>
      </div>
    </div>
  );
}

function PainBar({ level }: { level: number }) {
  const getColor = (n: number) =>
    n <= 3 ? "#22c55e" : n <= 6 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex gap-0.5 mt-1">
      {Array.from({ length: 10 }, (_, i) => (
        <div
          key={i}
          className="flex-1 h-1.5 rounded-full transition-all"
          style={{ background: i < level ? getColor(level) : "#e5e7eb" }}
        />
      ))}
    </div>
  );
}

function VitalCard({
  icon: Icon,
  label,
  value,
  unit,
  color,
  alert,
}: {
  icon: React.ElementType;
  label: string;
  value: any;
  unit: string;
  color: string;
  alert: boolean;
}) {
  return (
    <div
      className="relative rounded-2xl p-4 overflow-hidden"
      style={
        alert
          ? { background: "#fef2f2", border: "1px solid #fecaca" }
          : { background: "#f8fafc", border: "1px solid #f1f5f9" }
      }
    >
      <div
        className="absolute -right-3 -bottom-3 w-14 h-14 rounded-full opacity-[0.08]"
        style={{ background: alert ? "#ef4444" : color }}
      />

      <div className="flex items-start justify-between mb-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: alert ? "#fef2f2" : `${color}15` }}
        >
          <Icon
            className="w-3.5 h-3.5"
            style={{ color: alert ? "#ef4444" : color }}
          />
        </div>
        {alert && (
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-100">
            <TriangleAlert className="w-2.5 h-2.5 text-red-500" />
            <span className="text-[9px] font-bold text-red-600 uppercase tracking-wide">
              Alert
            </span>
          </div>
        )}
      </div>

      <p
        className="text-2xl font-black leading-none tabular-nums"
        style={{ color: alert ? "#dc2626" : "#0f172a" }}
      >
        {value}
        <span
          className="text-xs font-semibold ml-1"
          style={{ color: alert ? "#ef4444" : "#94a3b8" }}
        >
          {unit}
        </span>
      </p>

      {label === "Pain" && typeof value === "number" && (
        <PainBar level={value} />
      )}
      <p className="text-[11px] font-medium text-gray-400 mt-1.5">{label}</p>
    </div>
  );
}

// ── Referral context banner ───────────────────────────────────────────────────
// Shown when the visit was created from a referral (external or internal).
// Detection:
//   - External referral: visitNumber starts with "V-" AND admittingDiagnosis populated
//     (convert-to-visit sets admittingDiagnosis = referral.clinicalSummary)
//   - Internal referral: visitNumber starts with "APT-" AND admittingDiagnosis populated
//     (appointmentApi.book sets chiefComplaint = reason, admittingDiagnosis = reason)
//   - Doctor direct admission: admittingDiagnosis populated, visitNumber starts with "VIS-"
function ReferralBanner({ visit }: { visit: any }) {
  const num = visit?.visitNumber ?? "";
  const diag = visit?.admittingDiagnosis;

  if (!diag) return null;

  // Determine referral type from visit number prefix
  const isInternal = num.startsWith("APT-");
  const isExternal = num.startsWith("V-") || num.startsWith("REF-");
  const isDoctorDirect = !isInternal && !isExternal && diag;

  if (!isInternal && !isExternal && !isDoctorDirect) return null;

  const config = isInternal
    ? {
        icon: Stethoscope,
        label: "Internal Referral",
        desc: "Patient referred by a colleague within this institution.",
        color: "#166534",
        bg: "#f0fdf4",
        border: "#bbf7d0",
        iconBg: "#dcfce7",
      }
    : isExternal
      ? {
          icon: ArrowLeftRight,
          label: "External Referral",
          desc: "Patient referred from another institution.",
          color: "#1d4ed8",
          bg: "#eff6ff",
          border: "#bfdbfe",
          iconBg: "#dbeafe",
        }
      : {
          icon: Stethoscope,
          label: "Direct Doctor Admission",
          desc: "Patient admitted directly by attending physician.",
          color: "#d97706",
          bg: "#fffbeb",
          border: "#fde68a",
          iconBg: "#fef3c7",
        };

  const Icon = config.icon;

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: config.border, background: config.bg }}
    >
      {/* Header strip */}
      <div
        className="flex items-center gap-2.5 px-4 py-2.5 border-b"
        style={{ borderColor: config.border }}
      >
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: config.iconBg }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color: config.color }} />
        </div>
        <p
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: config.color }}
        >
          {config.label}
        </p>
      </div>

      {/* Clinical summary from referral */}
      <div className="px-4 py-3.5 space-y-2">
        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-widest mb-1"
            style={{ color: config.color, opacity: 0.7 }}
          >
            Referral Summary / Admitting Notes
          </p>
          <p className="text-sm text-gray-800 leading-relaxed">{diag}</p>
        </div>

        <p
          className="text-[10px]"
          style={{ color: config.color, opacity: 0.6 }}
        >
          {config.desc} Review the Consultation tab to add your own assessment.
        </p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function OverviewTab({
  visit,
  consultations,
  diagnoses,
  vitals,
  labOrders,
  imagingOrders,
  prescriptions,
  setActiveTab,
}: any) {
  const ps = PRIORITY_STYLE[visit?.priority] ?? PRIORITY_STYLE.routine;
  const v0 = vitals?.[0] ?? null;

  const hasAlerts =
    v0 &&
    VITAL_CONFIG.some(({ key, alertFn, format }) => {
      const val = key === "bp" ? null : v0[key];
      const formatted = format(val, v0);
      return formatted != null && alertFn(val, v0);
    });

  const counts: Record<string, number> = {
    consultation: consultations?.length ?? 0,
    diagnosis: diagnoses?.length ?? 0,
    labs: labOrders?.length ?? 0,
    imaging: imagingOrders?.length ?? 0,
    prescriptions: prescriptions?.length ?? 0,
  };

  return (
    <div
      className="p-5 space-y-4"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* ── 1. Visit header card ─────────────────────────────────────────── */}
      <div
        className="rounded-2xl overflow-hidden border"
        style={{ borderColor: ps.border }}
      >
        {/* Coloured top strip */}
        <div
          className="px-5 py-3 flex items-center justify-between"
          style={{ background: ps.bg }}
        >
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ background: ps.dot }}
            />
            <span
              className="text-xs font-bold uppercase tracking-widest"
              style={{ color: ps.text }}
            >
              {visit?.priority ?? "routine"} priority
            </span>
          </div>
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize"
            style={{
              background: "white",
              color: ps.text,
              border: `1px solid ${ps.border}`,
            }}
          >
            {visit?.status}
          </span>
        </div>

        {/* Details grid */}
        <div className="bg-white px-5 py-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
          <InfoChip
            icon={Tag}
            label="Visit Type"
            value={visit?.visitType ?? "—"}
          />
          <InfoChip
            icon={CalendarDays}
            label="Admitted"
            value={safeFormatDate(visit?.admissionDate, "dd MMM yyyy, HH:mm")}
          />
          <InfoChip
            icon={MapPin}
            label="Ward / Room"
            value={visit?.wardOrRoom ?? "—"}
          />
          <InfoChip
            icon={Clock}
            label="Department"
            value={visit?.department?.departmentName ?? "—"}
          />
          {visit?.chiefComplaint && (
            <div className="col-span-2 sm:col-span-3 pt-1 border-t border-gray-50">
              <InfoChip
                icon={MessageSquare}
                label="Chief Complaint"
                value={visit.chiefComplaint}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── 2. Referral / admission context banner ───────────────────────── */}
      {/* Only renders when admittingDiagnosis is set — i.e. referral or
          direct doctor admission. Hidden for regular walk-in triage visits. */}
      <ReferralBanner visit={visit} />

      {/* ── 3. Clinical summary tiles ────────────────────────────────────── */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2.5 px-0.5">
          Clinical Summary
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {SUMMARY_CARDS.map(
            ({ key, label, icon: Icon, color, bg, border }) => {
              const count = counts[key] ?? 0;
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className="group relative flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all hover:shadow-md hover:-translate-y-px active:translate-y-0"
                  style={{
                    background: "#fff",
                    borderColor: count > 0 ? border : "#f1f5f9",
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105"
                    style={{ background: bg }}
                  >
                    <Icon className="w-4 h-4" style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-xl font-black leading-none tabular-nums"
                      style={{ color: count > 0 ? color : "#d1d5db" }}
                    >
                      {count}
                    </p>
                    <p className="text-[11px] text-gray-400 font-medium mt-0.5 truncate">
                      {label}
                    </p>
                  </div>
                  <ChevronRight
                    className="w-3.5 h-3.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color }}
                  />
                </button>
              );
            },
          )}
        </div>
      </div>

      {/* ── 4. Vitals ────────────────────────────────────────────────────── */}
      {v0 && (
        <div>
          <div className="flex items-center justify-between mb-2.5 px-0.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Vital Signs
            </p>
            <div className="flex items-center gap-2">
              {hasAlerts && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-red-500 uppercase tracking-wide">
                  <TriangleAlert className="w-3 h-3" />
                  Abnormal values
                </span>
              )}
              <span className="text-[10px] text-gray-400">
                {safeDistanceToNow(v0.recordedAt)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {VITAL_CONFIG.map(
              ({ key, label, unit, icon, color, alertFn, format }) => {
                const rawVal = key === "bp" ? null : (v0 as any)[key];
                const display = format(rawVal, v0);
                const isAlert = display != null && alertFn(rawVal, v0);
                if (display == null) return null;
                return (
                  <VitalCard
                    key={key}
                    icon={icon}
                    label={label}
                    value={display}
                    unit={unit}
                    color={color}
                    alert={isAlert}
                  />
                );
              },
            )}
          </div>

          {v0.nurseNotes && (
            <div className="mt-3 flex gap-3 p-4 rounded-2xl bg-gray-50 border border-gray-100">
              <MessageSquare className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                  Nurse Notes
                </p>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {v0.nurseNotes}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 5. No vitals placeholder ─────────────────────────────────────── */}
      {!v0 && (
        <div className="flex flex-col items-center gap-2 py-8 rounded-2xl border border-dashed border-gray-200 bg-gray-50/60">
          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
            <Activity className="w-5 h-5 text-gray-300" />
          </div>
          <p className="text-sm font-semibold text-gray-400">
            No vitals recorded yet
          </p>
          <p className="text-xs text-gray-300">
            Vitals will appear here after triage
          </p>
        </div>
      )}
    </div>
  );
}
