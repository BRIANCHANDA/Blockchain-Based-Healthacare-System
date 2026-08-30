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
import {
  Card,
  Pill as Badge,
  EmptyState,
  SectionLabel,
  TONES,
  type Tone,
} from "@/components/dashboard/ui";
import { getPriority } from "@/app/dashboard/doctor/vocab";

/* ==========================================================================
   Visit overview tab.

   The at-a-glance state of one encounter: how urgent, where it came from,
   the latest vitals, and how much clinical work has been recorded so far.
   The summary tiles double as navigation into the other tabs.
   ========================================================================== */

// ── Vitals config ─────────────────────────────────────────────────────────────
/*
 * `alertFn` decides whether a reading is out of range. Blood pressure is the
 * odd one out — it is stored as two columns, so it reads `row` rather than a
 * single keyed value, which is why every formatter takes both.
 */
const VITAL_CONFIG = [
  {
    key: "temperature",
    label: "Temperature",
    unit: "°C",
    icon: Thermometer,
    tone: "critical" as Tone,
    alertFn: (v: any) => parseFloat(v ?? "0") >= 38,
    format: (v: any) => v,
  },
  {
    key: "bp",
    label: "Blood pressure",
    unit: "mmHg",
    icon: Gauge,
    tone: "info" as Tone,
    alertFn: (_v: any, row: any) => row.bloodPressureSystolic >= 160,
    format: (_v: any, row: any) =>
      row.bloodPressureSystolic != null
        ? `${row.bloodPressureSystolic}/${row.bloodPressureDiastolic}`
        : null,
  },
  {
    key: "pulseRate",
    label: "Heart rate",
    unit: "bpm",
    icon: Heart,
    tone: "critical" as Tone,
    alertFn: (v: any) => v > 100 || v < 50,
    format: (v: any) => v,
  },
  {
    key: "oxygenSaturation",
    label: "SpO₂",
    unit: "%",
    icon: Droplets,
    tone: "info" as Tone,
    alertFn: (v: any) => v < 94,
    format: (v: any) => v,
  },
  {
    key: "respiratoryRate",
    label: "Resp. rate",
    unit: "/min",
    icon: Wind,
    tone: "success" as Tone,
    alertFn: (v: any) => v > 20,
    format: (v: any) => v,
  },
  {
    key: "painLevel",
    label: "Pain",
    unit: "/10",
    icon: Activity,
    tone: "urgent" as Tone,
    alertFn: (v: any) => v >= 7,
    format: (v: any) => v,
  },
] as const;

// ── Clinical summary cards ────────────────────────────────────────────────────
const SUMMARY_CARDS: {
  key: string;
  label: string;
  icon: React.ElementType;
  tone: Tone;
}[] = [
  { key: "consultation", label: "Consultations", icon: Stethoscope, tone: "info" },
  { key: "diagnosis", label: "Diagnoses", icon: AlertCircle, tone: "success" },
  { key: "labs", label: "Lab orders", icon: FlaskConical, tone: "urgent" },
  { key: "imaging", label: "Imaging", icon: Scan, tone: "accent" },
  { key: "prescriptions", label: "Prescriptions", icon: Pill, tone: "brand" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function InfoChip({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start" style={{ gap: 10 }}>
      <span
        className="inline-flex items-center justify-center flex-shrink-0"
        style={{
          width: 28,
          height: 28,
          marginTop: 1,
          borderRadius: "var(--r-xs)",
          background: "var(--surface-sunken)",
          color: "var(--text-muted)",
        }}
      >
        <Icon className="w-3.5 h-3.5" />
      </span>
      <div className="min-w-0 flex flex-col" style={{ gap: 4 }}>
        <SectionLabel>{label}</SectionLabel>
        <span
          style={{
            font: "600 13px/1.4 var(--font-sans)",
            color: "var(--text-primary)",
            textTransform: "capitalize",
          }}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

/** Ten segments; colour steps up with the reported level. */
function PainBar({ level }: { level: number }) {
  const tone: Tone = level <= 3 ? "success" : level <= 6 ? "urgent" : "critical";
  const fill = TONES[tone].dot;
  return (
    <div className="flex" style={{ gap: 2, marginTop: 6 }}>
      {Array.from({ length: 10 }, (_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: 5,
            borderRadius: "var(--r-pill)",
            background: i < level ? fill : "var(--surface-sunken)",
            transition: "background var(--dur-base) var(--ease-standard)",
          }}
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
  tone,
  alert,
}: {
  icon: React.ElementType;
  label: string;
  value: any;
  unit: string;
  tone: Tone;
  alert: boolean;
}) {
  /* An out-of-range reading overrides the vital's own colour — the alert is
     what matters, not which measurement it happens to be. */
  const t = TONES[alert ? "critical" : tone];

  return (
    <div
      style={{
        padding: 16,
        borderRadius: "var(--r-md)",
        background: alert ? "var(--critical-tint)" : "var(--surface-sunken)",
        border: `1px solid ${alert ? "var(--coral-100)" : "transparent"}`,
      }}
    >
      <div
        className="flex items-start justify-between"
        style={{ gap: 8, marginBottom: 10 }}
      >
        <span
          className="inline-flex items-center justify-center"
          style={{
            width: 28,
            height: 28,
            borderRadius: "var(--r-xs)",
            background: "var(--surface-card)",
            color: t.ink,
          }}
        >
          <Icon className="w-3.5 h-3.5" />
        </span>
        {alert && (
          <Badge tone="critical" icon={TriangleAlert} style={{ height: 18, fontSize: 9.5 }}>
            Alert
          </Badge>
        )}
      </div>

      <p
        style={{
          margin: 0,
          font: "700 22px/1 var(--font-sans)",
          letterSpacing: "var(--ls-tight)",
          color: alert ? "var(--critical-ink)" : "var(--text-primary)",
        }}
      >
        {value}
        <span
          style={{
            font: "600 12px/1 var(--font-sans)",
            marginLeft: 4,
            color: alert ? "var(--critical-ink)" : "var(--text-muted)",
          }}
        >
          {unit}
        </span>
      </p>

      {label === "Pain" && typeof value === "number" && <PainBar level={value} />}

      <p
        style={{
          margin: "8px 0 0",
          font: "500 11px/1 var(--font-sans)",
          color: "var(--text-muted)",
        }}
      >
        {label}
      </p>
    </div>
  );
}

// ── Referral context banner ───────────────────────────────────────────────────
/*
 * Shown when the visit was created from a referral rather than walk-in triage.
 * The source is inferred from the visit-number prefix, because the visit row
 * itself carries no referral-type column:
 *
 *   APT-        internal referral (appointmentApi.book)
 *   V- / REF-   external referral (convert-to-visit)
 *   otherwise   direct doctor admission
 *
 * All three set admittingDiagnosis, which is why its absence hides the banner
 * entirely — that is the walk-in case.
 */
function ReferralBanner({ visit }: { visit: any }) {
  const num = visit?.visitNumber ?? "";
  const diag = visit?.admittingDiagnosis;

  if (!diag) return null;

  const isInternal = num.startsWith("APT-");
  const isExternal = num.startsWith("V-") || num.startsWith("REF-");

  const config = isInternal
    ? {
        icon: Stethoscope,
        label: "Internal referral",
        desc: "Patient referred by a colleague within this institution.",
        tone: "success" as Tone,
      }
    : isExternal
      ? {
          icon: ArrowLeftRight,
          label: "External referral",
          desc: "Patient referred from another institution.",
          tone: "info" as Tone,
        }
      : {
          icon: Stethoscope,
          label: "Direct doctor admission",
          desc: "Patient admitted directly by the attending physician.",
          tone: "urgent" as Tone,
        };

  const t = TONES[config.tone];
  const Icon = config.icon;

  return (
    <div
      style={{
        borderRadius: "var(--r-md)",
        border: "1px solid var(--hc-border)",
        background: t.tint,
        overflow: "hidden",
      }}
    >
      <div
        className="flex items-center"
        style={{
          gap: 10,
          padding: "10px 16px",
          borderBottom: "1px solid var(--border-faint)",
        }}
      >
        <span
          className="inline-flex items-center justify-center flex-shrink-0"
          style={{
            width: 24,
            height: 24,
            borderRadius: "var(--r-xs)",
            background: "var(--surface-card)",
            color: t.ink,
          }}
        >
          <Icon className="w-3.5 h-3.5" />
        </span>
        <p
          style={{
            margin: 0,
            font: "700 11px/1 var(--font-sans)",
            letterSpacing: "var(--ls-caps)",
            textTransform: "uppercase",
            color: t.ink,
          }}
        >
          {config.label}
        </p>
      </div>

      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="flex flex-col" style={{ gap: 5 }}>
          <SectionLabel style={{ color: t.ink }}>
            Referral summary / admitting notes
          </SectionLabel>
          <p
            style={{
              margin: 0,
              font: "400 13px/1.6 var(--font-sans)",
              color: "var(--text-primary)",
            }}
          >
            {diag}
          </p>
        </div>

        <p
          style={{
            margin: 0,
            font: "400 11px/1.5 var(--font-sans)",
            color: t.ink,
            opacity: 0.75,
          }}
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
  const p = getPriority(visit?.priority);
  const pTone = TONES[p.tone];
  const v0 = vitals?.[0] ?? null;

  const hasAlerts =
    v0 &&
    VITAL_CONFIG.some(({ key, alertFn, format }) => {
      const val = key === "bp" ? null : (v0 as any)[key];
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
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ── 1. Visit header card ─────────────────────────────────────────── */}
      <Card>
        <div
          className="flex items-center justify-between flex-wrap"
          style={{ gap: 10, padding: "11px 20px", background: pTone.tint }}
        >
          <span className="inline-flex items-center" style={{ gap: 8 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: pTone.dot,
              }}
            />
            <span
              style={{
                font: "700 11px/1 var(--font-sans)",
                letterSpacing: "var(--ls-caps)",
                textTransform: "uppercase",
                color: pTone.ink,
              }}
            >
              {p.label} priority
            </span>
          </span>

          <span
            className="inline-flex items-center"
            style={{
              height: 22,
              padding: "0 10px",
              borderRadius: "var(--r-pill)",
              background: "var(--surface-card)",
              color: pTone.ink,
              font: "600 11.5px/1 var(--font-sans)",
              textTransform: "capitalize",
            }}
          >
            {visit?.status}
          </span>
        </div>

        <div
          style={{
            padding: "18px 20px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 18,
          }}
        >
          <InfoChip icon={Tag} label="Visit type" value={visit?.visitType ?? "—"} />
          <InfoChip
            icon={CalendarDays}
            label="Admitted"
            value={safeFormatDate(visit?.admissionDate, "dd MMM yyyy, HH:mm")}
          />
          <InfoChip icon={MapPin} label="Ward / room" value={visit?.wardOrRoom ?? "—"} />
          <InfoChip
            icon={Clock}
            label="Department"
            value={visit?.department?.departmentName ?? "—"}
          />
          {visit?.chiefComplaint && (
            <div
              style={{
                gridColumn: "1 / -1",
                paddingTop: 14,
                borderTop: "1px solid var(--border-faint)",
              }}
            >
              <InfoChip
                icon={MessageSquare}
                label="Chief complaint"
                value={visit.chiefComplaint}
              />
            </div>
          )}
        </div>
      </Card>

      {/* ── 2. Referral / admission context banner ───────────────────────── */}
      <ReferralBanner visit={visit} />

      {/* ── 3. Vitals ────────────────────────────────────────────────────── */}
      {v0 ? (
        <div className="flex flex-col" style={{ gap: 10 }}>
          <div
            className="flex items-center justify-between flex-wrap"
            style={{ gap: 10 }}
          >
            <SectionLabel>Vital signs</SectionLabel>
            <span className="inline-flex items-center" style={{ gap: 10 }}>
              {hasAlerts && (
                <Badge tone="critical" icon={TriangleAlert} style={{ height: 18, fontSize: 9.5 }}>
                  Abnormal values
                </Badge>
              )}
              <span
                style={{
                  font: "400 11px/1 var(--font-sans)",
                  color: "var(--text-muted)",
                }}
              >
                {safeDistanceToNow(v0.recordedAt)}
              </span>
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 10,
            }}
          >
            {VITAL_CONFIG.map(({ key, label, unit, icon, tone, alertFn, format }) => {
              const rawVal = key === "bp" ? null : (v0 as any)[key];
              const display = format(rawVal, v0);
              if (display == null) return null;
              return (
                <VitalCard
                  key={key}
                  icon={icon}
                  label={label}
                  value={display}
                  unit={unit}
                  tone={tone}
                  alert={alertFn(rawVal, v0)}
                />
              );
            })}
          </div>

          {v0.nurseNotes && (
            <div
              className="flex"
              style={{
                gap: 12,
                padding: 16,
                borderRadius: "var(--r-md)",
                background: "var(--surface-sunken)",
              }}
            >
              <MessageSquare
                className="w-4 h-4 flex-shrink-0"
                style={{ color: "var(--text-muted)", marginTop: 2 }}
              />
              <div className="flex flex-col" style={{ gap: 5 }}>
                <SectionLabel>Nurse notes</SectionLabel>
                <p
                  style={{
                    margin: 0,
                    font: "400 13px/1.6 var(--font-sans)",
                    color: "var(--text-secondary)",
                  }}
                >
                  {v0.nurseNotes}
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            borderRadius: "var(--r-md)",
            border: "1.5px dashed var(--hc-border)",
            background: "var(--surface-sunken)",
          }}
        >
          <EmptyState
            icon={Activity}
            title="No vitals recorded yet"
            message="Vitals appear here after triage."
            tone="neutral"
            pad={28}
          />
        </div>
      )}

      {/* ── 4. Clinical summary tiles — also the tab navigation ──────────── */}
      <div className="flex flex-col" style={{ gap: 10 }}>
        <SectionLabel>Clinical summary</SectionLabel>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: 10,
          }}
        >
          {SUMMARY_CARDS.map(({ key, label, icon: Icon, tone }) => {
            const count = counts[key] ?? 0;
            const t = TONES[tone];
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className="flex items-center text-left"
                style={{
                  gap: 12,
                  padding: 14,
                  borderRadius: "var(--r-md)",
                  border: `1px solid ${count > 0 ? "var(--hc-border)" : "var(--border-faint)"}`,
                  background: "var(--surface-card)",
                  cursor: "pointer",
                  transition: "box-shadow var(--dur-base) var(--ease-standard)",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.boxShadow = "var(--elev-2)")
                }
                onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
              >
                <span
                  className="inline-flex items-center justify-center flex-shrink-0"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "var(--r-sm)",
                    background: t.tint,
                    color: t.ink,
                  }}
                >
                  <Icon className="w-4 h-4" />
                </span>

                <span className="flex-1 min-w-0 flex flex-col" style={{ gap: 4 }}>
                  <span
                    style={{
                      font: "700 19px/1 var(--font-sans)",
                      letterSpacing: "var(--ls-tight)",
                      color: count > 0 ? t.ink : "var(--text-disabled)",
                    }}
                  >
                    {count}
                  </span>
                  <span
                    className="truncate"
                    style={{
                      font: "500 11.5px/1 var(--font-sans)",
                      color: "var(--text-muted)",
                    }}
                  >
                    {label}
                  </span>
                </span>

                <ChevronRight
                  className="w-3.5 h-3.5 flex-shrink-0"
                  style={{ color: "var(--text-disabled)" }}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
