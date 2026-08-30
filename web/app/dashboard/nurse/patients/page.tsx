"use client";
import { useEffect, useState, useCallback } from "react";
import { patientApi } from "@/lib/api";
import {
  Search,
  X,
  Users,
  ChevronRight,
  RefreshCw,
  Activity,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowLeft,
  Heart,
  Thermometer,
  Wind,
  Gauge,
  Weight,
  User,
  Droplets,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

// ── Constants ─────────────────────────────────────────────────────────────────

const BLOOD_COLOR: Record<string, string> = {
  "A+": "var(--blue-500)", "A-": "var(--blue-600)", "B+": "var(--violet-500)", "B-": "var(--coral-500)",
  "AB+": "var(--amber-500)", "AB-": "var(--coral-500)", "O+": "var(--green-600)", "O-": "var(--green-600)",
};

const PRIORITY: Record<string, { color: string; bg: string; border: string; dot: string; label: string }> = {
  critical:  { color: "var(--critical-ink)", bg: "var(--coral-050)", border: "var(--coral-100)", dot: "var(--coral-500)",  label: "Critical"  },
  emergency: { color: "var(--critical-ink)", bg: "var(--coral-050)", border: "var(--coral-100)", dot: "var(--coral-500)",  label: "Emergency" },
  urgent:    { color: "var(--urgent-ink)", bg: "var(--amber-050)", border: "var(--amber-100)", dot: "var(--amber-500)",  label: "Urgent"    },
  routine:   { color: "var(--success-ink)", bg: "var(--brand-tint)", border: "var(--green-100)", dot: "var(--green-600)",  label: "Routine"   },
};

const VISIT_TYPE: Record<string, { label: string; color: string }> = {
  outpatient:   { label: "Outpatient",   color: "var(--info-ink)" },
  inpatient:    { label: "Inpatient",    color: "var(--green-800)" },
  emergency:    { label: "Emergency",    color: "var(--critical-ink)" },
  consultation: { label: "Consultation", color: "var(--accent-ink)" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcAge(dob?: string) {
  if (!dob) return null;
  return Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
}

function vitalRange(key: string, val?: number | null): "normal" | "warning" | "critical" | "empty" {
  if (val == null) return "empty";
  const r: Record<string, [number, number, number, number]> = {
    temperature:           [35.5, 37.5, 34.0, 39.0],
    bloodPressureSystolic: [90,   140,  80,   180  ],
    pulseRate:             [60,   100,  40,   140  ],
    respiratoryRate:       [12,   20,   8,    30   ],
    oxygenSaturation:      [95,   100,  90,   100  ],
  };
  const range = r[key];
  if (!range) return "normal";
  const [lo, hi, cLo, cHi] = range;
  if (val < cLo || val > cHi) return "critical";
  if (val < lo  || val > hi)  return "warning";
  return "normal";
}

const RANGE_STYLE = {
  normal:   { color: "var(--green-800)", bg: "var(--brand-tint)", border: "var(--green-100)" },
  warning:  { color: "var(--urgent-ink)", bg: "var(--amber-050)", border: "var(--amber-100)" },
  critical: { color: "var(--critical-ink)", bg: "var(--coral-050)", border: "var(--coral-100)" },
  empty:    { color: "var(--text-disabled)", bg: "var(--surface-sunken)", border: "var(--surface-sunken)" },
};

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr style={{ borderBottom: "1px solid var(--surface-sunken)" }}>
      {[160, 60, 80, 70, 30].map((w, i) => (
        <td key={i} style={{ padding: "14px 16px" }}>
          <div style={{
            height: 13, width: w, borderRadius: 6,
            background: "var(--surface-sunken)", animation: "pulse 1.4s ease infinite",
            animationDelay: `${i * 0.08}s`,
          }} />
        </td>
      ))}
    </tr>
  );
}

// ── Mini vital card ───────────────────────────────────────────────────────────

function MiniVital({ icon: Icon, label, value, rangeKey, iconColor }: {
  icon: React.ElementType;
  label: string;
  value: string;
  rangeKey: string;
  iconColor: string;
}) {
  const raw  = parseFloat(value);
  const stat = vitalRange(rangeKey, isNaN(raw) ? null : raw);
  const sc   = RANGE_STYLE[stat];
  const empty = stat === "empty";

  return (
    <div style={{
      padding: "12px 14px", borderRadius: 12,
      background: empty ? "var(--surface-sunken)" : sc.bg,
      border: `1px solid ${empty ? "var(--surface-sunken)" : sc.border}`,
      opacity: empty ? 0.5 : 1,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
        <Icon size={12} style={{ color: empty ? "var(--text-disabled)" : iconColor }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {label}
        </span>
      </div>
      <p style={{ fontSize: 17, fontWeight: 800, color: empty ? "var(--text-disabled)" : sc.color, margin: 0, lineHeight: 1 }}>
        {empty ? "—" : value}
      </p>
    </div>
  );
}

// ── Patient Detail Panel ──────────────────────────────────────────────────────

function PatientDetailPanel({ patientId, onClose }: { patientId: string; onClose: () => void }) {
  const [patient,  setPatient]  = useState<any>(null);
  const [history,  setHistory]  = useState<any>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const [pRes, hRes] = await Promise.all([
          patientApi.getById(patientId),
          patientApi.getHistory(patientId),
        ]);
        setPatient(pRes.data.data);
        setHistory(hRes.data.data);
        // Auto-expand first visit
        const firstId = hRes.data.data?.ownVisits?.[0]?.visit?.id;
        if (firstId) setExpanded(new Set([firstId]));
      } catch {
        setError("Could not load patient data.");
      } finally {
        setLoading(false);
      }
    })();
  }, [patientId]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const triageHistory = history?.ownVisits?.map((v: any) => ({
    visit:             v.visit,
    vitals:            v.vitals ?? [],
    nursingAssessment: v.nursingAssessment ?? null,
  })) ?? [];

  const age = calcAge(patient?.dateOfBirth);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 280, gap: 10, color: "var(--text-muted)" }}>
      <div style={{
        width: 22, height: 22, borderRadius: "50%",
        border: "2.5px solid var(--green-600)", borderTopColor: "transparent",
        animation: "spin 0.8s linear infinite",
      }} />
      <span style={{ fontSize: 14 }}>Loading patient…</span>
    </div>
  );

  if (error) return (
    <div>
      <button onClick={onClose} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer", marginBottom: 20 }}>
        <ArrowLeft size={15} /> Back
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px", borderRadius: 12, background: "var(--coral-050)", border: "1px solid var(--coral-100)" }}>
        <AlertCircle size={16} style={{ color: "var(--coral-500)", flexShrink: 0 }} />
        <p style={{ fontSize: 13, color: "var(--critical-ink)", margin: 0 }}>{error}</p>
      </div>
    </div>
  );

  const lastVisit = triageHistory[0]?.visit;

  return (
    <div>

      {/* Back button */}
      <button
        onClick={onClose}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 13, fontWeight: 600, color: "var(--text-secondary)",
          background: "none", border: "none", cursor: "pointer",
          marginBottom: 20, padding: 0,
          transition: "color 0.12s",
        }}
        onMouseEnter={(e) => e.currentTarget.style.color = "var(--text-primary)"}
        onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-secondary)"}
      >
        <ArrowLeft size={15} /> Back to all patients
      </button>

      {/* ── Patient Header Card ─────────────────────────────────────────────── */}
      <div style={{
        borderRadius: 18, overflow: "hidden", marginBottom: 24,
        boxShadow: "var(--elev-2)",
        border: "1px solid var(--hc-border)",
      }}>
        {/* Top gradient section */}
        <div style={{
          background: patient?.gender === "female"
            ? "var(--sidebar-bg)"
            : "var(--sidebar-bg)",
          padding: "28px 28px 24px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {/* Avatar */}
            <div style={{
              width: 64, height: 64, borderRadius: 18, flexShrink: 0,
              background: "var(--on-dark-raise)", border: "2.5px solid var(--on-dark-line)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, fontWeight: 800, color: "var(--white)",
            }}>
              {patient?.firstName?.[0]}{patient?.lastName?.[0]}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--white)", margin: "0 0 6px", lineHeight: 1.2 }}>
                {patient?.firstName} {patient?.lastName}
              </h2>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                {age !== null && (
                  <span style={{ fontSize: 13, color: "var(--on-dark-text)" }}>{age} yrs</span>
                )}
                {patient?.gender && (
                  <>
                    <span style={{ color: "var(--on-dark-text-dim)", fontSize: 12 }}>·</span>
                    <span style={{ fontSize: 13, color: "var(--on-dark-text)", textTransform: "capitalize" }}>{patient.gender}</span>
                  </>
                )}
                {patient?.dateOfBirth && (
                  <>
                    <span style={{ color: "var(--on-dark-text-dim)", fontSize: 12 }}>·</span>
                    <span style={{ fontSize: 13, color: "var(--on-dark-text)" }}>
                      DOB: {format(new Date(patient.dateOfBirth), "dd MMM yyyy")}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Blood type badge */}
            {patient?.bloodType && patient.bloodType !== "unknown" && (
              <div style={{
                padding: "8px 16px", borderRadius: 12,
                background: BLOOD_COLOR[patient.bloodType] ?? "var(--text-secondary)",
                boxShadow: "var(--elev-2)",
                textAlign: "center", flexShrink: 0,
              }}>
                <p style={{ fontSize: 9, fontWeight: 700, color: "var(--on-dark-text)", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 1px" }}>Blood</p>
                <p style={{ fontSize: 18, fontWeight: 900, color: "var(--white)", margin: 0, lineHeight: 1 }}>{patient.bloodType}</p>
              </div>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
          background: "var(--white)", borderTop: "1px solid var(--border-faint)",
        }}>
          {[
            { label: "Total Visits",  value: triageHistory.length,                                           color: "var(--green-800)" },
            { label: "Last Visit",    value: lastVisit?.admissionDate ? format(new Date(lastVisit.admissionDate), "dd MMM yyyy") : "—", color: "var(--text-secondary)" },
            { label: "Last Priority", value: lastVisit ? (PRIORITY[lastVisit.priority]?.label ?? lastVisit.priority) : "—", color: lastVisit ? (PRIORITY[lastVisit.priority]?.color ?? "var(--text-secondary)") : "var(--text-muted)" },
            { label: "Last Complaint", value: lastVisit?.chiefComplaint ?? "—",                              color: "var(--text-secondary)" },
          ].map(({ label, value, color }, i, arr) => (
            <div key={label} style={{
              padding: "14px 20px",
              borderRight: i < arr.length - 1 ? "1px solid var(--surface-sunken)" : "none",
            }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 4px" }}>
                {label}
              </p>
              <p style={{
                fontSize: i === 0 ? 24 : 13, fontWeight: 700, color,
                margin: 0, lineHeight: 1.3,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Visit History ───────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, background: "var(--brand-tint)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Activity size={13} style={{ color: "var(--success-ink)" }} />
          </div>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            Triage &amp; Nursing History
          </p>
          {triageHistory.length > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 999,
              background: "var(--surface-sunken)", color: "var(--text-secondary)",
            }}>
              {triageHistory.length} visit{triageHistory.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {triageHistory.length === 0 ? (
        <div style={{
          background: "var(--white)", borderRadius: 14, border: "1px solid var(--border-faint)",
          padding: "48px 24px", textAlign: "center",
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, background: "var(--surface-sunken)",
            margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Activity size={20} style={{ color: "var(--text-disabled)" }} />
          </div>
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-secondary)", margin: "0 0 4px" }}>No triage history</p>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>This patient has not been triaged yet</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {triageHistory.map((item: any, idx: number) => {
            const v    = item.visit;
            const vit  = item.vitals?.[0];
            const na   = item.nursingAssessment;
            const pri  = PRIORITY[v?.priority] ?? PRIORITY.routine;
            const vt   = VISIT_TYPE[v?.visitType];
            const open = expanded.has(v?.id);
            const hasData = !!vit || !!na;

            return (
              <div key={v?.id ?? idx} style={{
                background: "var(--white)", borderRadius: 14,
                border: "1px solid var(--border-faint)",
                boxShadow: "var(--elev-1)",
                overflow: "hidden",
              }}>
                {/* Visit header — always visible */}
                <button
                  onClick={() => toggleExpand(v?.id)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 14,
                    padding: "14px 18px", background: "none", border: "none", cursor: "pointer",
                    textAlign: "left",
                    borderBottom: open ? "1px solid var(--surface-sunken)" : "none",
                    transition: "background 0.12s",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-app)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                >
                  {/* Priority dot */}
                  <span style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: pri.dot, flexShrink: 0,
                    boxShadow: `0 0 0 3px ${pri.bg}`,
                  }} />

                  {/* Visit number */}
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", fontFamily: "var(--font-mono)", flexShrink: 0 }}>
                    {v?.visitNumber}
                  </span>

                  {/* Priority badge */}
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999,
                    background: pri.bg, color: pri.color, border: `1px solid ${pri.border}`,
                    flexShrink: 0,
                  }}>
                    {pri.label}
                  </span>

                  {/* Visit type */}
                  {vt && (
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: vt.color, flexShrink: 0 }}>
                      {vt.label}
                    </span>
                  )}

                  {/* Chief complaint */}
                  {v?.chiefComplaint && (
                    <span style={{
                      fontSize: 12.5, color: "var(--text-secondary)", flex: 1, minWidth: 0,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {v.chiefComplaint}
                    </span>
                  )}

                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, marginLeft: "auto" }}>
                    {/* Triage status */}
                    {hasData ? (
                      <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 600, color: "var(--success-ink)" }}>
                        <CheckCircle2 size={12} /> Triaged
                      </span>
                    ) : (
                      <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 600, color: "var(--urgent-ink)" }}>
                        <Clock size={12} /> Pending
                      </span>
                    )}

                    {/* Date */}
                    {v?.admissionDate && (
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {format(new Date(v.admissionDate), "dd MMM yyyy")}
                      </span>
                    )}

                    {open ? <ChevronUp size={15} style={{ color: "var(--text-muted)" }} /> : <ChevronDown size={15} style={{ color: "var(--text-muted)" }} />}
                  </div>
                </button>

                {/* Expanded content */}
                {open && (
                  <div style={{ padding: "18px 20px" }}>
                    {!hasData ? (
                      <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "20px 0", margin: 0 }}>
                        No triage data recorded for this visit
                      </p>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: 20, alignItems: "start" }}>
                        {/* Left: vitals */}
                        <div>
                          {vit && (
                            <>
                              <p style={{ fontSize: 10, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 10px" }}>
                                Vital Signs
                              </p>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12 }}>
                                <MiniVital
                                  icon={Thermometer}
                                  label="Temp"
                                  value={vit.temperature != null ? `${vit.temperature}°C` : ""}
                                  rangeKey="temperature"
                                  iconColor="var(--coral-500)"
                                />
                                <MiniVital
                                  icon={Gauge}
                                  label="BP"
                                  value={vit.bloodPressureSystolic != null ? `${vit.bloodPressureSystolic}/${vit.bloodPressureDiastolic}` : ""}
                                  rangeKey="bloodPressureSystolic"
                                  iconColor="var(--blue-500)"
                                />
                                <MiniVital
                                  icon={Heart}
                                  label="Pulse"
                                  value={vit.pulseRate != null ? `${vit.pulseRate} bpm` : (vit.heartRate != null ? `${vit.heartRate} bpm` : "")}
                                  rangeKey="pulseRate"
                                  iconColor="var(--coral-500)"
                                />
                                <MiniVital
                                  icon={Wind}
                                  label="Resp."
                                  value={vit.respiratoryRate != null ? `${vit.respiratoryRate}/min` : ""}
                                  rangeKey="respiratoryRate"
                                  iconColor="var(--green-600)"
                                />
                              </div>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                                <MiniVital
                                  icon={Droplets}
                                  label="SpO₂"
                                  value={vit.oxygenSaturation != null ? `${vit.oxygenSaturation}%` : ""}
                                  rangeKey="oxygenSaturation"
                                  iconColor="var(--blue-500)"
                                />
                                {vit.weight != null && (
                                  <MiniVital icon={Weight} label="Weight" value={`${vit.weight} kg`} rangeKey="weight" iconColor="var(--amber-500)" />
                                )}
                                {vit.height != null && (
                                  <MiniVital icon={User} label="Height" value={`${vit.height} cm`} rangeKey="height" iconColor="var(--violet-500)" />
                                )}
                                {vit.painLevel != null && (
                                  <div style={{
                                    padding: "12px 14px", borderRadius: 12,
                                    background: vit.painLevel >= 7 ? "var(--coral-050)" : vit.painLevel >= 4 ? "var(--amber-050)" : "var(--brand-tint)",
                                    border: `1px solid ${vit.painLevel >= 7 ? "var(--coral-100)" : vit.painLevel >= 4 ? "var(--amber-100)" : "var(--green-100)"}`,
                                  }}>
                                    <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>
                                      Pain
                                    </p>
                                    <p style={{
                                      fontSize: 17, fontWeight: 800, margin: 0, lineHeight: 1,
                                      color: vit.painLevel >= 7 ? "var(--critical-ink)" : vit.painLevel >= 4 ? "var(--urgent-ink)" : "var(--green-600)",
                                    }}>
                                      {vit.painLevel}/10
                                    </p>
                                  </div>
                                )}
                              </div>
                              {vit.recordedAt && (
                                <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 10, display: "flex", alignItems: "center", gap: 4 } as any}>
                                  <Clock size={11} style={{ display: "inline" }} />
                                  Recorded {formatDistanceToNow(new Date(vit.recordedAt), { addSuffix: true })}
                                </p>
                              )}
                            </>
                          )}

                          {/* Nurse notes */}
                          {vit?.nurseNotes && (
                            <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 10, background: "var(--surface-sunken)", border: "1px solid var(--surface-sunken)" }}>
                              <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 6px" }}>
                                Nurse Notes
                              </p>
                              <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                                {vit.nurseNotes}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Right: nursing assessment */}
                        {na && (
                          <div>
                            <p style={{ fontSize: 10, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 10px" }}>
                              Nursing Assessment
                            </p>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              {[
                                { label: "Pain Scale",     value: na.painScale != null ? `${na.painScale}/10` : null },
                                { label: "Consciousness",  value: na.consciousnessLevel },
                                { label: "Skin Condition", value: na.skinCondition },
                                { label: "Mobility",       value: na.mobilityStatus },
                              ].filter(f => f.value).map(({ label, value }) => (
                                <div key={label} style={{
                                  display: "flex", justifyContent: "space-between", alignItems: "center",
                                  padding: "8px 12px", borderRadius: 9,
                                  background: "var(--surface-sunken)", border: "1px solid var(--surface-sunken)",
                                }}>
                                  <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>{label}</span>
                                  <span style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 700, textTransform: "capitalize" }}>{value}</span>
                                </div>
                              ))}
                              {na.notes && (
                                <div style={{ padding: "10px 12px", borderRadius: 9, background: "var(--brand-tint)", border: "1px solid var(--green-100)", marginTop: 4 }}>
                                  <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px" }}>
                                    Notes
                                  </p>
                                  <p style={{ fontSize: 12.5, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5, fontStyle: "italic" }}>{na.notes}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes spin  { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}

// ── Main patients list ────────────────────────────────────────────────────────

export default function NursePatientsPage() {
  const [patients,   setPatients]   = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inputVal,   setInputVal]   = useState("");
  const [search,     setSearch]     = useState("");
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const PER_PAGE = 20;

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const res = await patientApi.searchPaginated({ q: search, limit: PER_PAGE, offset: (page - 1) * PER_PAGE });
      setPatients(res.data.data?.patients ?? []);
      setTotal(res.data.data?.total ?? 0);
    } catch {
      setPatients([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search]);

  const totalPages = Math.ceil(total / PER_PAGE);

  if (selectedId)
    return <PatientDetailPanel patientId={selectedId} onClose={() => setSelectedId(null)} />;

  return (
    <div>

      {/* Page header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10, background: "var(--brand-tint)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Users size={16} style={{ color: "var(--green-800)" }} />
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>All Patients</h1>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Search and view patient triage history</p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 14px", borderRadius: 10, border: "1px solid var(--hc-border)",
            background: "var(--white)", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)",
            cursor: refreshing ? "not-allowed" : "pointer", opacity: refreshing ? 0.6 : 1,
          }}
        >
          <RefreshCw size={14} style={{ animation: refreshing ? "spin 0.8s linear infinite" : "none" }} />
          Refresh
        </button>
      </div>

      {/* Search bar */}
      <div style={{ background: "var(--white)", borderRadius: 14, border: "1px solid var(--border-faint)", padding: "14px 16px", marginBottom: 16, boxShadow: "var(--elev-1)" }}>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <Search size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
            <input
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setSearch(inputVal.trim())}
              placeholder="Search by name or patient ID…"
              style={{
                width: "100%", boxSizing: "border-box",
                padding: "10px 36px 10px 38px", borderRadius: 10,
                border: "1px solid var(--hc-border)", background: "var(--surface-sunken)",
                fontSize: 13.5, color: "var(--text-primary)", outline: "none",
                fontFamily: "inherit", transition: "border-color 0.15s, background 0.15s",
              }}
              onFocus={(e) => { e.target.style.borderColor = "var(--green-600)"; e.target.style.background = "var(--white)"; e.target.style.boxShadow = "0 0 0 3px var(--focus-ring)"; }}
              onBlur={(e)  => { e.target.style.borderColor = "var(--hc-border)"; e.target.style.background = "var(--surface-sunken)"; e.target.style.boxShadow = "none"; }}
            />
            {inputVal && (
              <button
                onClick={() => { setInputVal(""); setSearch(""); }}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={() => setSearch(inputVal.trim())}
            style={{
              padding: "10px 22px", borderRadius: 10, border: "none",
              background: "var(--brand)",
              fontSize: 13, fontWeight: 700, color: "var(--white)", cursor: "pointer",
              boxShadow: "var(--elev-brand)",
            }}
          >
            Search
          </button>
        </div>
        {search && (
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "10px 0 0" }}>
            Results for "<strong style={{ color: "var(--text-secondary)" }}>{search}</strong>" · {total} found
          </p>
        )}
      </div>

      {/* Table */}
      <div style={{ background: "var(--white)", borderRadius: 16, border: "1px solid var(--border-faint)", overflow: "hidden", boxShadow: "var(--elev-1)" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--surface-sunken)", borderBottom: "1px solid var(--border-faint)" }}>
                {["Patient", "Age", "Gender", "Blood Type", ""].map((h, i) => (
                  <th key={i} style={{
                    padding: "11px 16px", textAlign: "left",
                    fontSize: 11, fontWeight: 800, color: "var(--text-muted)",
                    textTransform: "uppercase", letterSpacing: "0.07em",
                    paddingLeft: i === 0 ? 20 : 16,
                    paddingRight: i === 4 ? 20 : 16,
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                : patients.length === 0
                ? (
                  <tr>
                    <td colSpan={5} style={{ padding: "60px 24px", textAlign: "center" }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 12, background: "var(--surface-sunken)",
                        margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Users size={20} style={{ color: "var(--text-disabled)" }} />
                      </div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-secondary)", margin: "0 0 4px" }}>
                        {search ? "No patients found" : "Search for a patient above"}
                      </p>
                      <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
                        {search ? `No results for "${search}"` : "Enter a name or patient ID to search"}
                      </p>
                    </td>
                  </tr>
                )
                : patients.map((p, i) => {
                  const age = calcAge(p.dateOfBirth);
                  const isFemale = p.gender === "female";
                  return (
                    <tr
                      key={p.id}
                      onClick={() => setSelectedId(p.id)}
                      style={{
                        borderBottom: i < patients.length - 1 ? "1px solid var(--surface-sunken)" : "none",
                        cursor: "pointer", transition: "background 0.1s",
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-sunken)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <td style={{ padding: "13px 16px 13px 20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                            background: isFemale
                              ? "var(--coral-600)"
                              : "var(--brand)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 12, fontWeight: 800, color: "var(--white)",
                          }}>
                            {p.firstName?.[0]}{p.lastName?.[0]}
                          </div>
                          <div>
                            <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                              {p.firstName} {p.lastName}
                            </p>
                            <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: 0, fontFamily: "var(--font-mono)" }}>
                              {p.id?.slice(0, 8)}…
                            </p>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "13px 16px" }}>
                        <span style={{ fontSize: 13.5, color: "var(--text-secondary)" }}>
                          {age !== null ? `${age} yrs` : "—"}
                        </span>
                      </td>
                      <td style={{ padding: "13px 16px" }}>
                        <span style={{
                          fontSize: 11.5, fontWeight: 600, padding: "3px 10px", borderRadius: 999,
                          background: isFemale ? "var(--coral-050)" : "var(--brand-tint)",
                          color: isFemale ? "var(--critical-ink)" : "var(--green-800)",
                          textTransform: "capitalize",
                        }}>
                          {p.gender ?? "—"}
                        </span>
                      </td>
                      <td style={{ padding: "13px 16px" }}>
                        {p.bloodType && p.bloodType !== "unknown" ? (
                          <span style={{
                            fontSize: 12, fontWeight: 800, padding: "3px 10px", borderRadius: 999,
                            background: BLOOD_COLOR[p.bloodType] ?? "var(--text-secondary)", color: "var(--white)",
                          }}>
                            {p.bloodType}
                          </span>
                        ) : (
                          <span style={{ fontSize: 13, color: "var(--text-disabled)" }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: "13px 20px 13px 16px", textAlign: "right" }}>
                        <ChevronRight size={15} style={{ color: "var(--text-disabled)" }} />
                      </td>
                    </tr>
                  );
                })
              }
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 20px", borderTop: "1px solid var(--surface-sunken)",
          }}>
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: 0 }}>
              Page {page} of {totalPages} · <strong style={{ color: "var(--text-secondary)" }}>{total}</strong> patients
            </p>
            <div style={{ display: "flex", gap: 6 }}>
              {[
                { label: "Previous", disabled: page === 1,         action: () => setPage(p => Math.max(1, p - 1)) },
                { label: "Next",     disabled: page === totalPages, action: () => setPage(p => Math.min(totalPages, p + 1)) },
              ].map(({ label, disabled, action }) => (
                <button
                  key={label}
                  onClick={action}
                  disabled={disabled}
                  style={{
                    padding: "6px 14px", borderRadius: 8, border: "1px solid var(--hc-border)",
                    fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)", background: "var(--white)",
                    cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1,
                    transition: "all 0.12s",
                  }}
                  onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = "var(--surface-sunken)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "var(--white)"; }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin  { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
