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
  Clock,
  BedDouble,
  AlertTriangle,
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
  createdAt?: string;
}

interface StaffMember {
  id: string;
  name: string;
}

type Step = "vitals" | "assign-doctor" | "done";
type PageMode = "loading" | "view" | "new-triage";

// ── Helpers ───────────────────────────────────────────────────────────────────
const PRIORITY_STYLE: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  routine:   { bg: "var(--brand-tint)", text: "var(--green-700)", border: "var(--green-300)", dot: "var(--green-600)" },
  urgent:    { bg: "var(--amber-050)", text: "var(--urgent-ink)", border: "var(--amber-100)", dot: "var(--amber-500)" },
  emergency: { bg: "var(--coral-050)", text: "var(--critical-ink)", border: "var(--coral-100)", dot: "var(--coral-500)" },
  critical:  { bg: "var(--violet-050)", text: "var(--accent-ink)", border: "var(--violet-100)", dot: "var(--accent-ink)" },
};

const BLOOD_TYPE_COLOR: Record<string, string> = {
  "A+": "var(--blue-500)", "A-": "var(--blue-600)", "B+": "var(--violet-500)", "B-": "var(--coral-500)",
  "AB+": "var(--amber-500)", "AB-": "var(--coral-500)", "O+": "var(--green-600)", "O-": "var(--green-600)",
};

const VISIT_TYPE_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  outpatient:   { label: "Outpatient",   color: "var(--info-ink)", bg: "var(--info-tint)" },
  inpatient:    { label: "Inpatient",    color: "var(--green-800)", bg: "var(--brand-tint)" },
  emergency:    { label: "Emergency",    color: "var(--critical-ink)", bg: "var(--coral-050)" },
  consultation: { label: "Consultation", color: "var(--accent-ink)", bg: "var(--violet-050)" },
};

const toNum = (v?: string) => (v && v.trim() !== "" ? parseFloat(v) : undefined);
const toInt = (v?: string) => (v && v.trim() !== "" ? parseInt(v, 10) : undefined);
const fmt   = (v?: number | null, unit = "") => (v != null ? `${v}${unit}` : "—");

function formatTime(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-ZM", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

// ── Vital range helpers ───────────────────────────────────────────────────────
function vitalStatus(key: string, value?: number | null): "normal" | "warning" | "critical" | "none" {
  if (value == null) return "none";
  const ranges: Record<string, [number, number, number, number]> = {
    temperature:           [35.5, 37.5, 34, 39],
    bloodPressureSystolic: [90,   140,  80, 180],
    pulseRate:             [60,   100,  40, 140],
    respiratoryRate:       [12,   20,   8,  30 ],
    oxygenSaturation:      [95,   100,  90, 100],
    weight:                [0,    999,  0,  999],
  };
  const r = ranges[key];
  if (!r) return "normal";
  const [lo, hi, crit_lo, crit_hi] = r;
  if (value < crit_lo || value > crit_hi) return "critical";
  if (value < lo || value > hi) return "warning";
  return "normal";
}

const STATUS_COLOR = {
  normal:   { color: "var(--green-800)", bg: "var(--brand-tint)", border: "var(--green-100)" },
  warning:  { color: "var(--urgent-ink)", bg: "var(--amber-050)", border: "var(--amber-100)" },
  critical: { color: "var(--critical-ink)", bg: "var(--coral-050)", border: "var(--coral-100)" },
  none:     { color: "var(--text-muted)", bg: "var(--surface-sunken)", border: "var(--surface-sunken)" },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function VitalCard({
  icon: Icon,
  label,
  value,
  statusKey,
  rawValue,
  iconColor,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  statusKey: string;
  rawValue?: number | null;
  iconColor: string;
}) {
  const status = vitalStatus(statusKey, rawValue);
  const sc = STATUS_COLOR[status];
  const isEmpty = rawValue == null;
  return (
    <div style={{
      background: "var(--white)", borderRadius: 14, border: `1px solid ${isEmpty ? "var(--surface-sunken)" : sc.border}`,
      padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8,
      opacity: isEmpty ? 0.55 : 1,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          background: isEmpty ? "var(--surface-sunken)" : `${sc.bg}`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={14} style={{ color: isEmpty ? "var(--text-disabled)" : iconColor }} />
        </div>
        {!isEmpty && status !== "normal" && (
          <AlertTriangle size={12} style={{ color: sc.color }} />
        )}
      </div>
      <div>
        <p style={{ fontSize: 20, fontWeight: 800, color: isEmpty ? "var(--text-disabled)" : sc.color, margin: 0, lineHeight: 1 }}>
          {value}
        </p>
        <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "4px 0 0", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {label}
        </p>
      </div>
    </div>
  );
}

function VitalInput({
  icon: Icon,
  label,
  unit,
  value,
  onChange,
  placeholder,
  color = "var(--green-800)",
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
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
        <Icon size={12} style={{ color }} />
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <input
          type="number"
          step="any"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: "100%", boxSizing: "border-box",
            padding: unit ? "10px 46px 10px 14px" : "10px 14px",
            borderRadius: 10, border: "1px solid var(--hc-border)", background: "var(--white)",
            color: "var(--text-primary)", fontSize: 14, outline: "none", transition: "border-color 0.15s",
            fontFamily: "inherit",
          }}
          onFocus={(e) => { e.target.style.borderColor = "var(--green-600)"; e.target.style.boxShadow = "0 0 0 3px var(--focus-ring)"; }}
          onBlur={(e)  => { e.target.style.borderColor = "var(--hc-border)"; e.target.style.boxShadow = "none"; }}
        />
        {unit && (
          <span style={{
            position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
            fontSize: 11, fontWeight: 700, color: "var(--text-muted)", pointerEvents: "none",
          }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

function PainScale({ value, onChange, readOnly = false }: { value: string; onChange: (v: string) => void; readOnly?: boolean }) {
  const levels = Array.from({ length: 11 }, (_, i) => i);
  const getColor = (n: number) =>
    n === 0 ? "var(--green-600)" : n <= 3 ? "var(--green-600)" : n <= 5 ? "var(--amber-500)" : n <= 7 ? "var(--coral-500)" : "var(--coral-500)";
  const selected = value !== "" ? parseInt(value, 10) : null;

  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 10 }}>
        Pain Level
      </label>
      <div style={{ display: "flex", gap: 4 }}>
        {levels.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => !readOnly && onChange(String(n))}
            disabled={readOnly}
            style={{
              flex: 1, padding: readOnly ? "6px 0" : "8px 0", borderRadius: 8,
              fontSize: 12, fontWeight: 800, border: `1.5px solid ${getColor(n)}`,
              background: selected === n ? getColor(n) : "transparent",
              color: selected === n ? "var(--white)" : getColor(n),
              opacity: selected !== null && selected !== n ? 0.3 : 1,
              cursor: readOnly ? "default" : "pointer",
              transition: "all 0.12s",
            }}
          >
            {n}
          </button>
        ))}
      </div>
      <p style={{ fontSize: 11.5, color: "var(--text-muted)", textAlign: "center", marginTop: 6 }}>
        {selected === null ? "Not assessed"
          : selected === 0 ? "No pain"
          : selected <= 3 ? "Mild pain"
          : selected <= 6 ? "Moderate pain"
          : selected <= 8 ? "Severe pain"
          : "Worst possible pain"}
      </p>
    </div>
  );
}

function StepBar({ current, vitalsSubmitted }: { current: Step; vitalsSubmitted: boolean }) {
  const steps = [
    { key: "vitals",        label: "Vital Signs",    done: vitalsSubmitted },
    { key: "assign-doctor", label: "Assign Doctor",  done: current === "done" },
    { key: "done",          label: "Complete",       done: false },
  ] as const;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 24 }}>
      {steps.map(({ key, label, done }, i) => {
        const active = current === key;
        return (
          <div key={key} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : undefined }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <div style={{
                width: 30, height: 30, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 800, flexShrink: 0, transition: "all 0.2s",
                background: done ? "var(--green-800)" : active ? "var(--green-800)" : "var(--surface-sunken)",
                color: (done || active) ? "var(--white)" : "var(--text-muted)",
                boxShadow: active ? "0 0 0 4px var(--focus-ring)" : "none",
              }}>
                {done ? <CheckCircle2 size={14} /> : i + 1}
              </div>
              <span style={{
                fontSize: 13, fontWeight: 600,
                color: active ? "var(--text-primary)" : done ? "var(--text-secondary)" : "var(--text-muted)",
                display: "none",
              }}
              className="hidden sm:block">
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 2, margin: "0 8px", background: done ? "var(--green-800)" : "var(--hc-border)", borderRadius: 2 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Patient header card ───────────────────────────────────────────────────────
function PatientHeader({ visit, patient }: { visit: Visit; patient: Patient | null }) {
  const p   = PRIORITY_STYLE[visit.priority] ?? PRIORITY_STYLE.routine;
  const vt  = VISIT_TYPE_STYLE[visit.visitType];
  const age = patient?.dateOfBirth ? ageFromDob(patient.dateOfBirth) : null;

  return (
    <div style={{
      background: "var(--white)", borderRadius: 16, border: "1px solid var(--hc-border)",
      overflow: "hidden", marginBottom: 24,
      boxShadow: "var(--elev-1)",
    }}>
      {/* Top gradient strip */}
      <div style={{
        background: "var(--sidebar-bg)",
        padding: "20px 24px", display: "flex", alignItems: "center", gap: 16,
      }}>
        {/* Avatar */}
        <div style={{
          width: 52, height: 52, borderRadius: 14, flexShrink: 0,
          background: "var(--on-dark-raise)", border: "2px solid var(--on-dark-line)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, fontWeight: 800, color: "var(--white)",
        }}>
          {(patient?.firstName?.[0] ?? "?")}
          {(patient?.lastName?.[0] ?? "")}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
            <p style={{ fontSize: 18, fontWeight: 800, color: "var(--white)", margin: 0 }}>
              {patient ? `${patient.firstName} ${patient.lastName}` : "Unknown Patient"}
            </p>
            {patient?.isMinor && (
              <MinorBadge age={patient.dateOfBirth ? ageFromDob(patient.dateOfBirth) : undefined} />
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "var(--on-dark-text)", fontFamily: "var(--font-mono)" }}>
              {visit.visitNumber}
            </span>
            {age !== null && (
              <span style={{ fontSize: 12, color: "var(--on-dark-text-dim)" }}>·</span>
            )}
            {age !== null && (
              <span style={{ fontSize: 12, color: "var(--on-dark-text)" }}>{age} yrs</span>
            )}
            {patient?.gender && (
              <>
                <span style={{ fontSize: 12, color: "var(--on-dark-text-dim)" }}>·</span>
                <span style={{ fontSize: 12, color: "var(--on-dark-text)", textTransform: "capitalize" }}>{patient.gender}</span>
              </>
            )}
          </div>
        </div>

        {/* Right side badges */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", flexShrink: 0 }}>
          {patient?.bloodType && patient.bloodType !== "unknown" && (
            <span style={{
              fontSize: 12, fontWeight: 800, padding: "3px 10px", borderRadius: 999,
              background: BLOOD_TYPE_COLOR[patient.bloodType] ?? "var(--text-secondary)", color: "var(--white)",
            }}>
              {patient.bloodType}
            </span>
          )}
          <span style={{
            fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 999,
            background: p.bg, color: p.text, border: `1px solid ${p.border}`,
            textTransform: "capitalize",
            display: "flex", alignItems: "center", gap: 5,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: p.dot }} />
            {visit.priority}
          </span>
        </div>
      </div>

      {/* Info row */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
        borderTop: "1px solid var(--surface-sunken)",
      }}>
        {[
          {
            icon: AlertCircle,
            label: "Chief Complaint",
            value: visit.chiefComplaint || "—",
            color: "var(--critical-ink)",
          },
          {
            icon: Activity,
            label: "Visit Type",
            value: vt?.label ?? visit.visitType,
            color: vt?.color ?? "var(--text-secondary)",
          },
          {
            icon: BedDouble,
            label: "Ward / Room",
            value: visit.wardOrRoom || "Not assigned",
            color: "var(--text-secondary)",
          },
          {
            icon: Clock,
            label: "Arrived",
            value: visit.createdAt ? formatTime(visit.createdAt) : "—",
            color: "var(--text-secondary)",
          },
        ].map(({ icon: Icon, label, value, color }, i, arr) => (
          <div key={label} style={{
            padding: "14px 18px",
            borderRight: i < arr.length - 1 ? "1px solid var(--surface-sunken)" : "none",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
              <Icon size={11} style={{ color, flexShrink: 0 }} />
              <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", margin: 0 }}>
                {label}
              </p>
            </div>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
              {value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── VIEW MODE ─────────────────────────────────────────────────────────────────
function TriageViewMode({ visit, onEdit }: { visit: Visit; onEdit: () => void }) {
  const v = visit.vitals;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20, alignItems: "start" }}>
      {/* Left: vitals */}
      <div>
        {/* Status bar */}
        <div style={{
          background: "var(--white)", borderRadius: 14, border: "1px solid var(--border-faint)",
          padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 16, boxShadow: "var(--elev-1)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9, background: "var(--brand-tint)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Lock size={15} style={{ color: "var(--green-800)" }} />
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Triage Recorded</p>
              <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: 0 }}>{formatTime(v?.recordedAt)}</p>
            </div>
          </div>
          <button
            onClick={onEdit}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
              borderRadius: 10, border: "1px solid var(--hc-border)", background: "var(--white)",
              fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", cursor: "pointer",
              transition: "all 0.12s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-sunken)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--white)"; }}
          >
            <Edit3 size={13} /> Edit Triage
          </button>
        </div>

        {/* Vital cards grid */}
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
            Vital Signs
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 10 }}>
            <VitalCard icon={Thermometer}  label="Temperature"      value={fmt(v?.temperature, "°C")}     statusKey="temperature"           rawValue={v?.temperature}           iconColor="var(--coral-500)" />
            <VitalCard icon={Gauge}        label="Blood Pressure"   value={v?.bloodPressureSystolic != null ? `${v.bloodPressureSystolic}/${v.bloodPressureDiastolic}` : "—"} statusKey="bloodPressureSystolic" rawValue={v?.bloodPressureSystolic} iconColor="var(--blue-500)" />
            <VitalCard icon={Heart}        label="Pulse Rate"       value={fmt(v?.pulseRate, " bpm")}      statusKey="pulseRate"              rawValue={v?.pulseRate}             iconColor="var(--coral-500)" />
            <VitalCard icon={Wind}         label="Resp. Rate"       value={fmt(v?.respiratoryRate, "/min")} statusKey="respiratoryRate"       rawValue={v?.respiratoryRate}       iconColor="var(--green-600)" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            <VitalCard icon={Droplets}     label="SpO₂"             value={fmt(v?.oxygenSaturation, "%")}  statusKey="oxygenSaturation"      rawValue={v?.oxygenSaturation}      iconColor="var(--blue-500)" />
            <VitalCard icon={Weight}       label="Weight"           value={fmt(v?.weight, " kg")}          statusKey="weight"                rawValue={v?.weight}                iconColor="var(--amber-500)" />
            <VitalCard icon={User}         label="Height"           value={fmt(v?.height, " cm")}          statusKey="height"                rawValue={v?.height}                iconColor="var(--violet-500)" />
            <div style={{
              background: "var(--white)", borderRadius: 14, border: "1px solid var(--surface-sunken)",
              padding: "14px 16px", display: "flex", flexDirection: "column", justifyContent: "center",
            }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 6px" }}>BMI</p>
              {v?.weight && v?.height ? (
                <p style={{ fontSize: 20, fontWeight: 800, color: "var(--text-secondary)", margin: 0 }}>
                  {(v.weight / ((v.height / 100) ** 2)).toFixed(1)}
                </p>
              ) : (
                <p style={{ fontSize: 20, fontWeight: 800, color: "var(--text-disabled)", margin: 0 }}>—</p>
              )}
            </div>
          </div>
        </div>

        {/* Pain scale */}
        <div style={{ background: "var(--white)", borderRadius: 14, border: "1px solid var(--border-faint)", padding: "18px 20px", marginBottom: 16 }}>
          <PainScale value={v?.painLevel != null ? String(v.painLevel) : ""} onChange={() => {}} readOnly />
        </div>

        {/* Nurse notes */}
        {v?.nurseNotes ? (
          <div style={{ background: "var(--white)", borderRadius: 14, border: "1px solid var(--border-faint)", padding: "18px 20px" }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
              Nurse Notes
            </p>
            <p style={{ fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap" }}>
              {v.nurseNotes}
            </p>
          </div>
        ) : (
          <div style={{ background: "var(--surface-sunken)", borderRadius: 14, border: "1px dashed var(--hc-border)", padding: "16px 20px" }}>
            <p style={{ fontSize: 13, color: "var(--text-disabled)", textAlign: "center", margin: 0 }}>No nurse notes recorded</p>
          </div>
        )}
      </div>

      {/* Right: doctor + quick info */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Assigned doctor */}
        <div style={{ background: "var(--white)", borderRadius: 14, border: "1px solid var(--border-faint)", padding: "18px", boxShadow: "var(--elev-1)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--info-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Stethoscope size={14} style={{ color: "var(--blue-600)" }} />
            </div>
            <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Assigned Doctor</p>
          </div>

          {visit.assignedDoctorName ? (
            <div style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
              borderRadius: 10, background: "var(--brand-tint)", border: "1px solid var(--green-100)",
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: "var(--green-800)", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 800, color: "var(--white)",
              }}>
                {visit.assignedDoctorName.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--green-800)", margin: 0 }}>
                  Dr. {visit.assignedDoctorName}
                </p>
                <p style={{ fontSize: 11, color: "var(--green-300)", margin: 0 }}>Doctor</p>
              </div>
              <CheckCircle2 size={15} style={{ color: "var(--success-ink)", flexShrink: 0 }} />
            </div>
          ) : (
            <div style={{
              display: "flex", alignItems: "center", gap: 8, padding: "12px",
              borderRadius: 10, background: "var(--amber-050)", border: "1px solid var(--amber-100)",
            }}>
              <AlertCircle size={14} style={{ color: "var(--urgent-ink)", flexShrink: 0 }} />
              <p style={{ fontSize: 12.5, color: "var(--urgent-ink)", margin: 0, fontWeight: 500 }}>No doctor assigned yet</p>
            </div>
          )}
        </div>

        {/* Quick vitals summary for abnormal values */}
        {v && (
          <div style={{ background: "var(--white)", borderRadius: 14, border: "1px solid var(--border-faint)", padding: "18px" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12, margin: "0 0 12px" }}>
              Ranges
            </p>
            {[
              { key: "temperature",           label: "Temp",   val: v.temperature,           unit: "°C"   },
              { key: "bloodPressureSystolic",  label: "BP Sys", val: v.bloodPressureSystolic, unit: "mmHg" },
              { key: "pulseRate",              label: "Pulse",  val: v.pulseRate,              unit: "bpm"  },
              { key: "oxygenSaturation",       label: "SpO₂",  val: v.oxygenSaturation,       unit: "%"    },
              { key: "respiratoryRate",        label: "RR",     val: v.respiratoryRate,        unit: "/min" },
            ].map(({ key, label, val, unit }) => {
              const status = vitalStatus(key, val);
              const sc = STATUS_COLOR[status];
              return (
                <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--surface-sunken)" }}>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{label}</span>
                  <span style={{
                    fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                    background: val == null ? "transparent" : sc.bg,
                    color: val == null ? "var(--text-disabled)" : sc.color,
                  }}>
                    {val != null ? `${val} ${unit}` : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function TriagePage() {
  const router   = useRouter();
  const params   = useParams();
  const visitId  = Array.isArray(params?.visitId) ? params.visitId[0] : (params?.visitId as string);

  const [visit,    setVisit]    = useState<Visit | null>(null);
  const [patient,  setPatient]  = useState<Patient | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [pageMode, setPageMode] = useState<PageMode>("loading");

  const [step,        setStep]        = useState<Step>("vitals");
  const [submitting,  setSubmitting]  = useState(false);
  const [submitError, setSubmitError] = useState("");

  const [vitals, setVitals] = useState({
    temperature: "", bloodPressureSystolic: "", bloodPressureDiastolic: "",
    pulseRate: "", respiratoryRate: "", oxygenSaturation: "", weight: "", height: "", nurseNotes: "",
  });
  const [painLevel, setPainLevel] = useState("");

  const [doctors,        setDoctors]        = useState<StaffMember[]>([]);
  const [doctorsLoading, setDoctorsLoading] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");

  const setVital = (key: keyof typeof vitals) => (v: string) =>
    setVitals((prev) => ({ ...prev, [key]: v }));

  useEffect(() => {
    if (!visitId) return;
    visitApi.getSummary(visitId)
      .then((res) => {
        const data = res.data.data;
        const v: Visit = data.visit;
        setVisit(v);
        setPatient(data.patient ?? null);
        if (v.assignedDoctorId) setSelectedDoctorId(v.assignedDoctorId);
        setPageMode(v.hasVitals || v.vitals ? "view" : "new-triage");
      })
      .catch((err) => setError(err.response?.data?.error?.message ?? "Failed to load visit."))
      .finally(() => setLoading(false));
  }, [visitId]);

  useEffect(() => {
    if (step !== "assign-doctor") return;
    setDoctorsLoading(true);
    visitApi.getStaffByRole("practitioner")
      .then((res) => setDoctors(res.data.data ?? []))
      .catch(() => setDoctors([]))
      .finally(() => setDoctorsLoading(false));
  }, [step]);

  const enterEditMode = () => {
    if (!visit?.vitals) { setPageMode("new-triage"); return; }
    const v = visit.vitals;
    setVitals({
      temperature:            v.temperature           != null ? String(v.temperature)           : "",
      bloodPressureSystolic:  v.bloodPressureSystolic != null ? String(v.bloodPressureSystolic) : "",
      bloodPressureDiastolic: v.bloodPressureDiastolic != null ? String(v.bloodPressureDiastolic) : "",
      pulseRate:              v.pulseRate             != null ? String(v.pulseRate)             : "",
      respiratoryRate:        v.respiratoryRate       != null ? String(v.respiratoryRate)       : "",
      oxygenSaturation:       v.oxygenSaturation      != null ? String(v.oxygenSaturation)      : "",
      weight:                 v.weight                != null ? String(v.weight)                : "",
      height:                 v.height                != null ? String(v.height)                : "",
      nurseNotes:             v.nurseNotes            ?? "",
    });
    setPainLevel(v.painLevel != null ? String(v.painLevel) : "");
    setStep("vitals");
    setSubmitError("");
    setPageMode("new-triage");
  };

  const handleSubmitVitals = async () => {
    setSubmitting(true);
    setSubmitError("");
    try {
      await visitApi.recordVitals(visitId, {
        temperature:            toNum(vitals.temperature),
        bloodPressureSystolic:  toInt(vitals.bloodPressureSystolic),
        bloodPressureDiastolic: toInt(vitals.bloodPressureDiastolic),
        pulseRate:              toInt(vitals.pulseRate),
        respiratoryRate:        toInt(vitals.respiratoryRate),
        oxygenSaturation:       toNum(vitals.oxygenSaturation),
        weight:                 toNum(vitals.weight),
        height:                 toNum(vitals.height),
        painLevel:              painLevel !== "" ? parseInt(painLevel, 10) : undefined,
        nurseNotes:             vitals.nurseNotes || undefined,
      });
      setStep("assign-doctor");
    } catch (err: any) {
      setSubmitError(err.response?.data?.error?.message ?? "Failed to save vitals.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignDoctor = async () => {
    if (!selectedDoctorId) { setSubmitError("Please select a doctor."); return; }
    setSubmitting(true);
    setSubmitError("");
    try {
      await visitApi.assignDoctor(visitId, selectedDoctorId);
      setStep("done");
    } catch (err: any) {
      setSubmitError(err.response?.data?.error?.message ?? "Failed to assign doctor.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading / error states ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 260, gap: 10, color: "var(--text-secondary)" }}>
        <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
        <span style={{ fontSize: 14 }}>Loading visit…</span>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !visit) {
    return (
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div style={{
          background: "var(--coral-050)", border: "1px solid var(--coral-100)", borderRadius: 16,
          padding: 32, textAlign: "center",
        }}>
          <AlertCircle size={32} style={{ color: "var(--coral-500)", margin: "0 auto 12px" }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--critical-ink)", margin: "0 0 16px" }}>
            {error || "Visit not found"}
          </p>
          <button onClick={() => router.back()} style={{
            fontSize: 13, fontWeight: 600, color: "var(--critical-ink)", background: "none",
            border: "none", cursor: "pointer", textDecoration: "underline",
          }}>Go back</button>
        </div>
      </div>
    );
  }

  const isFormMode = pageMode === "new-triage";
  const maxW = pageMode === "view" ? 1100 : 740;

  return (
    <div style={{ maxWidth: maxW, margin: "0 auto", }}>

      {/* ── Page header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button
          onClick={() => router.back()}
          style={{
            width: 36, height: 36, borderRadius: 10, border: "1px solid var(--hc-border)",
            background: "var(--white)", display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "var(--text-secondary)", flexShrink: 0,
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-sunken)"}
          onMouseLeave={(e) => e.currentTarget.style.background = "var(--white)"}
        >
          <ChevronLeft size={16} />
        </button>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>Nurse Triage</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
            {pageMode === "view" ? "View recorded triage data" : "Record vitals and assign a doctor"}
          </p>
        </div>
      </div>

      <PatientHeader visit={visit} patient={patient} />

      {/* ── VIEW MODE ── */}
      {pageMode === "view" && (
        <TriageViewMode visit={visit} onEdit={enterEditMode} />
      )}

      {/* ── TRIAGE FORM MODE ── */}
      {isFormMode && (
        <>
          {/* Edit banner */}
          {visit.hasVitals && step === "vitals" && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 16px", borderRadius: 10, background: "var(--info-tint)",
              border: "1px solid var(--blue-100)", marginBottom: 16,
            }}>
              <p style={{ fontSize: 12.5, color: "var(--info-ink)", fontWeight: 500, margin: 0 }}>
                Editing existing triage record
              </p>
              <button
                onClick={() => { setPageMode("view"); setSubmitError(""); }}
                style={{
                  display: "flex", alignItems: "center", gap: 4,
                  fontSize: 12, fontWeight: 700, color: "var(--info-ink)",
                  background: "none", border: "none", cursor: "pointer",
                }}
              >
                <X size={13} /> Cancel
              </button>
            </div>
          )}

          <StepBar current={step} vitalsSubmitted={step !== "vitals"} />

          {/* Error */}
          {submitError && (
            <div style={{
              display: "flex", alignItems: "flex-start", gap: 10,
              padding: "12px 16px", borderRadius: 10, background: "var(--coral-050)",
              border: "1px solid var(--coral-100)", marginBottom: 16,
            }}>
              <AlertCircle size={15} style={{ color: "var(--coral-500)", flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 13, color: "var(--critical-ink)", margin: 0 }}>{submitError}</p>
            </div>
          )}

          {/* ── STEP 1: VITALS ── */}
          {step === "vitals" && (
            <div style={{ background: "var(--white)", borderRadius: 16, border: "1px solid var(--hc-border)", padding: 24, boxShadow: "var(--elev-1)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, background: "var(--brand-tint)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Activity size={16} style={{ color: "var(--green-800)" }} />
                </div>
                <div>
                  <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Vital Signs</h2>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>Record all measurable physiological values</p>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 14 }}>
                <VitalInput icon={Thermometer} label="Temperature"  unit="°C"   placeholder="36.6" color="var(--coral-500)" value={vitals.temperature}           onChange={setVital("temperature")} />
                <VitalInput icon={Gauge}       label="BP Systolic"  unit="mmHg" placeholder="120"  color="var(--blue-500)" value={vitals.bloodPressureSystolic}  onChange={setVital("bloodPressureSystolic")} />
                <VitalInput icon={Gauge}       label="BP Diastolic" unit="mmHg" placeholder="80"   color="var(--blue-600)" value={vitals.bloodPressureDiastolic} onChange={setVital("bloodPressureDiastolic")} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 14 }}>
                <VitalInput icon={Heart}    label="Pulse Rate" unit="bpm"  placeholder="72"  color="var(--coral-500)" value={vitals.pulseRate}         onChange={setVital("pulseRate")} />
                <VitalInput icon={Wind}     label="Resp. Rate" unit="/min" placeholder="16"  color="var(--green-600)" value={vitals.respiratoryRate}   onChange={setVital("respiratoryRate")} />
                <VitalInput icon={Droplets} label="SpO₂"       unit="%"    placeholder="98"  color="var(--blue-500)" value={vitals.oxygenSaturation}  onChange={setVital("oxygenSaturation")} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, marginBottom: 20 }}>
                <VitalInput icon={Weight} label="Weight" unit="kg" placeholder="70"  color="var(--amber-500)" value={vitals.weight} onChange={setVital("weight")} />
                <VitalInput icon={User}   label="Height" unit="cm" placeholder="170" color="var(--violet-500)" value={vitals.height} onChange={setVital("height")} />
              </div>

              <div style={{ marginBottom: 20, padding: "18px", background: "var(--surface-sunken)", borderRadius: 12, border: "1px solid var(--surface-sunken)" }}>
                <PainScale value={painLevel} onChange={setPainLevel} />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 8 }}>
                  Nurse Notes
                </label>
                <textarea
                  value={vitals.nurseNotes}
                  onChange={(e) => setVital("nurseNotes")(e.target.value)}
                  rows={3}
                  placeholder="Any observations, allergies, or additional notes…"
                  style={{
                    width: "100%", boxSizing: "border-box", padding: "10px 14px", borderRadius: 10,
                    border: "1px solid var(--hc-border)", background: "var(--white)", color: "var(--text-primary)", fontSize: 13.5,
                    outline: "none", resize: "none", fontFamily: "inherit", lineHeight: 1.6,
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "var(--green-600)"; e.target.style.boxShadow = "0 0 0 3px var(--focus-ring)"; }}
                  onBlur={(e)  => { e.target.style.borderColor = "var(--hc-border)"; e.target.style.boxShadow = "none"; }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 16, borderTop: "1px solid var(--surface-sunken)" }}>
                <button
                  onClick={() => visit.hasVitals ? (setPageMode("view"), setSubmitError("")) : router.back()}
                  style={{
                    padding: "10px 20px", borderRadius: 10, border: "1px solid var(--hc-border)",
                    fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", background: "var(--white)", cursor: "pointer",
                  }}
                >
                  {visit.hasVitals ? "Cancel" : "Back"}
                </button>
                <button
                  onClick={handleSubmitVitals}
                  disabled={submitting}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "10px 24px", borderRadius: 10,
                    background: "var(--brand)",
                    color: "var(--white)", fontSize: 13, fontWeight: 700, border: "none", cursor: submitting ? "not-allowed" : "pointer",
                    opacity: submitting ? 0.7 : 1, boxShadow: "var(--elev-brand)",
                  }}
                >
                  {submitting ? (
                    <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Saving…</>
                  ) : visit.hasVitals ? (
                    <><Save size={15} /> Update Vitals</>
                  ) : (
                    <>Save Vitals <ChevronRight size={15} /></>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: ASSIGN DOCTOR ── */}
          {step === "assign-doctor" && (
            <div style={{ background: "var(--white)", borderRadius: 16, border: "1px solid var(--hc-border)", padding: 24, boxShadow: "var(--elev-1)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, background: "var(--info-tint)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Stethoscope size={16} style={{ color: "var(--blue-600)" }} />
                </div>
                <div>
                  <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Assign Doctor</h2>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>Select the doctor who will handle this visit</p>
                </div>
              </div>

              {doctorsLoading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "40px 0", color: "var(--text-muted)", fontSize: 13 }}>
                  <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Loading doctors…
                </div>
              ) : !doctors.length ? (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "14px 16px",
                  borderRadius: 10, background: "var(--amber-050)", border: "1px solid var(--amber-100)",
                }}>
                  <AlertCircle size={14} style={{ color: "var(--urgent-ink)", flexShrink: 0 }} />
                  <p style={{ fontSize: 13, color: "var(--urgent-ink)", margin: 0 }}>No doctors available in your institution right now.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                  {doctors.map((doc) => {
                    const selected = selectedDoctorId === doc.id;
                    return (
                      <button
                        key={doc.id}
                        onClick={() => { setSelectedDoctorId(doc.id); setSubmitError(""); }}
                        style={{
                          display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                          borderRadius: 12, border: `1.5px solid ${selected ? "var(--green-300)" : "var(--hc-border)"}`,
                          background: selected ? "var(--brand-tint)" : "var(--surface-app)",
                          cursor: "pointer", textAlign: "left", transition: "all 0.12s",
                        }}
                        onMouseEnter={(e) => { if (!selected) { e.currentTarget.style.background = "var(--surface-sunken)"; e.currentTarget.style.borderColor = "var(--text-disabled)"; } }}
                        onMouseLeave={(e) => { if (!selected) { e.currentTarget.style.background = "var(--surface-app)"; e.currentTarget.style.borderColor = "var(--hc-border)"; } }}
                      >
                        <div style={{
                          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                          background: selected ? "var(--green-800)" : "var(--hc-border)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 13, fontWeight: 800, color: selected ? "var(--white)" : "var(--text-secondary)",
                          transition: "all 0.12s",
                        }}>
                          {doc.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Dr. {doc.name}</p>
                          <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: 0 }}>Physician</p>
                        </div>
                        {selected && <CheckCircle2 size={16} style={{ color: "var(--success-ink)", flexShrink: 0 }} />}
                      </button>
                    );
                  })}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 16, borderTop: "1px solid var(--surface-sunken)" }}>
                <button
                  onClick={() => { setStep("vitals"); setSubmitError(""); }}
                  style={{
                    padding: "10px 20px", borderRadius: 10, border: "1px solid var(--hc-border)",
                    fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", background: "var(--white)", cursor: "pointer",
                  }}
                >
                  Back
                </button>
                <button
                  onClick={handleAssignDoctor}
                  disabled={submitting || !selectedDoctorId}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "10px 24px", borderRadius: 10,
                    background: "var(--brand)",
                    color: "var(--white)", fontSize: 13, fontWeight: 700, border: "none",
                    cursor: (submitting || !selectedDoctorId) ? "not-allowed" : "pointer",
                    opacity: (submitting || !selectedDoctorId) ? 0.6 : 1,
                    boxShadow: "var(--elev-brand)",
                  }}
                >
                  {submitting ? (
                    <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Assigning…</>
                  ) : (
                    <><Save size={15} /> {visit.hasVitals ? "Update Doctor" : "Assign Doctor"}</>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: DONE ── */}
          {step === "done" && (
            <div style={{
              background: "var(--white)", borderRadius: 16, border: "1px solid var(--hc-border)",
              padding: 40, textAlign: "center", boxShadow: "var(--elev-1)",
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: "50%", margin: "0 auto 20px",
                background: "var(--brand-tint)", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <CheckCircle2 size={32} style={{ color: "var(--green-800)" }} />
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", margin: "0 0 8px" }}>
                {visit.hasVitals ? "Triage Updated" : "Triage Complete"}
              </h2>
              <p style={{ fontSize: 13.5, color: "var(--text-secondary)", margin: "0 0 28px", lineHeight: 1.6 }}>
                Vitals {visit.hasVitals ? "updated" : "recorded"} and doctor assigned.
                The patient is now ready for consultation.
              </p>
              <div style={{
                background: "var(--surface-sunken)", borderRadius: 12, padding: "16px 20px",
                textAlign: "left", marginBottom: 24,
              }}>
                {[
                  { label: "Patient",          value: `${patient?.firstName} ${patient?.lastName}` },
                  { label: "Visit Number",     value: visit.visitNumber },
                  { label: "Assigned Doctor",  value: selectedDoctorId && doctors.find(d => d.id === selectedDoctorId) ? `Dr. ${doctors.find(d => d.id === selectedDoctorId)!.name}` : "—" },
                  { label: "Chief Complaint",  value: visit.chiefComplaint || "—" },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--surface-sunken)" }}>
                    <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{value}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => router.push("/dashboard/nurse")}
                  style={{
                    flex: 1, padding: "11px", borderRadius: 10, border: "1px solid var(--hc-border)",
                    fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", background: "var(--white)", cursor: "pointer",
                  }}
                >
                  Back to Dashboard
                </button>
                <button
                  onClick={() => router.push("/dashboard/nurse/queue")}
                  style={{
                    flex: 1, padding: "11px", borderRadius: 10, border: "none",
                    fontSize: 13, fontWeight: 700, color: "var(--white)", cursor: "pointer",
                    background: "var(--brand)",
                    boxShadow: "var(--elev-brand)",
                  }}
                >
                  Next Patient
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 860px) { .triage-view-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}
