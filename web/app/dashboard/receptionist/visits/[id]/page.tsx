"use client";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";
import { use, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { visitApi, practitionersApi } from "@/lib/api";
import {
  ArrowLeft,
  ClipboardList,
  User,
  Clock,
  Stethoscope,
  CheckCircle2,
  AlertTriangle,
  Heart,
  Thermometer,
  Wind,
  Gauge,
  UserCheck,
  RefreshCw,
  Loader2,
  UserPlus,
  Activity,
  Droplets,
  Weight,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { MinorBadge, ageFromDob } from "@/components/ui/MinorBadge";
import {
  Page,
  Card,
  CardHeader,
  Pill,
  Avatar,
  Button,
  Banner,
  DataRow,
  SectionLabel,
  hoverRow,
  TONES,
  type Tone,
} from "@/components/dashboard/ui";

/* ==========================================================================
   Visit detail — the receptionist's read-only view of one encounter.

   The page is assembled from visitApi.getSummary(), which returns the visit,
   the patient, and the most recent vital-sign record together. The only
   mutation available here is assigning (or reassigning) a nurse.
   ========================================================================== */

// ── Lookup maps ───────────────────────────────────────────────────────────────

const PRIORITY: Record<string, { tone: Tone; label: string }> = {
  routine: { tone: "success", label: "Routine" },
  urgent: { tone: "urgent", label: "Urgent" },
  emergency: { tone: "critical", label: "Emergency" },
  critical: { tone: "accent", label: "Critical" },
};
const VISIT_TYPE: Record<string, { tone: Tone; label: string }> = {
  outpatient: { tone: "info", label: "Outpatient" },
  inpatient: { tone: "success", label: "Inpatient" },
  emergency: { tone: "critical", label: "Emergency" },
  consultation: { tone: "accent", label: "Consultation" },
};
const STATUS: Record<string, { tone: Tone; label: string }> = {
  "in-progress": { tone: "success", label: "In progress" },
  completed: { tone: "neutral", label: "Completed" },
  cancelled: { tone: "critical", label: "Cancelled" },
};

// ── Vital range helper ────────────────────────────────────────────────────────

/**
 * Classify a vital against [normalLow, normalHigh, criticalLow, criticalHigh].
 * Anything outside the critical bounds is "critical"; outside normal but
 * inside critical is "warning". Vitals with no range (weight, height) read as
 * normal — they carry no threshold on their own.
 */
function vitalStatus(
  key: string,
  val?: number | null,
): "normal" | "warning" | "critical" | "empty" {
  if (val == null) return "empty";
  const r: Record<string, [number, number, number, number]> = {
    temperature: [35.5, 37.5, 34, 39],
    bloodPressureSystolic: [90, 140, 80, 180],
    pulseRate: [60, 100, 40, 140],
    respiratoryRate: [12, 20, 8, 30],
    oxygenSaturation: [95, 100, 90, 100],
  };
  const range = r[key];
  if (!range) return "normal";
  const [lo, hi, cLo, cHi] = range;
  if (val < cLo || val > cHi) return "critical";
  if (val < lo || val > hi) return "warning";
  return "normal";
}

const VITAL_TONE: Record<string, Tone> = {
  normal: "success",
  warning: "urgent",
  critical: "critical",
  empty: "neutral",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function VitalCard({
  icon: Icon,
  label,
  value,
  rangeKey,
  rawValue,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  rangeKey: string;
  rawValue?: number | null;
}) {
  const stat = vitalStatus(rangeKey, rawValue);
  const empty = stat === "empty";
  const t = TONES[VITAL_TONE[stat]];

  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: "var(--r-sm)",
        background: empty ? "var(--surface-sunken)" : t.tint,
        border: `1px solid ${empty ? "var(--border-faint)" : "transparent"}`,
        opacity: empty ? 0.6 : 1,
      }}
    >
      <div
        className="flex items-center justify-between"
        style={{ marginBottom: 10 }}
      >
        <span
          className="inline-flex items-center justify-center"
          style={{
            width: 28,
            height: 28,
            borderRadius: "var(--r-xs)",
            background: "var(--surface-card)",
            color: empty ? "var(--text-disabled)" : t.ink,
          }}
        >
          <Icon className="w-[13px] h-[13px]" />
        </span>
        {/* Only out-of-range values get an icon — a clean reading needs none. */}
        {!empty && stat !== "normal" && (
          <AlertTriangle className="w-3 h-3" style={{ color: t.ink }} />
        )}
      </div>

      <p
        style={{
          margin: "0 0 4px",
          font: "700 20px/1 var(--font-sans)",
          letterSpacing: "var(--ls-tight)",
          color: empty ? "var(--text-disabled)" : t.ink,
        }}
      >
        {empty ? "—" : value}
      </p>

      <SectionLabel style={{ fontSize: 10 }}>{label}</SectionLabel>
    </div>
  );
}

function NurseDropdown({
  nurses,
  assigning,
  onSelect,
  onClose,
}: {
  nurses: any[];
  assigning: boolean;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on any click outside the panel.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        right: 0,
        top: "calc(100% + 6px)",
        zIndex: 50,
        width: 240,
        background: "var(--surface-card)",
        borderRadius: "var(--r-sm)",
        border: "1px solid var(--hc-border)",
        boxShadow: "var(--elev-3)",
        overflow: "hidden",
      }}
    >
      <SectionLabel
        style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-faint)" }}
      >
        Available nurses
      </SectionLabel>

      <div style={{ maxHeight: 240, overflowY: "auto", padding: 4 }}>
        {nurses.length === 0 ? (
          <div style={{ padding: "20px 16px", textAlign: "center" }}>
            <p
              style={{
                margin: 0,
                font: "500 12.5px/1 var(--font-sans)",
                color: "var(--text-muted)",
              }}
            >
              No nurses online
            </p>
            <p
              style={{
                margin: "5px 0 0",
                font: "400 11.5px/1 var(--font-sans)",
                color: "var(--text-disabled)",
              }}
            >
              Check back shortly
            </p>
          </div>
        ) : (
          nurses.map((n: any) => (
            <button
              key={n.id}
              onClick={() => onSelect(n.id)}
              disabled={assigning}
              className="w-full flex items-center text-left"
              style={{
                gap: 10,
                padding: "8px 10px",
                border: "none",
                borderRadius: "var(--r-xs)",
                background: "transparent",
                cursor: assigning ? "not-allowed" : "pointer",
              }}
              {...hoverRow}
            >
              <Avatar name={`${n.firstName ?? ""} ${n.lastName ?? ""}`} size={30} seed={2} />
              <div className="flex-1 min-w-0 flex flex-col" style={{ gap: 3 }}>
                <p
                  className="truncate"
                  style={{
                    margin: 0,
                    font: "600 13px/1 var(--font-sans)",
                    color: "var(--text-primary)",
                  }}
                >
                  {n.firstName} {n.lastName}
                </p>
                <p
                  className="inline-flex items-center"
                  style={{
                    margin: 0,
                    gap: 4,
                    font: "500 11px/1 var(--font-sans)",
                    color: "var(--green-800)",
                  }}
                >
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: "var(--green-600)",
                    }}
                  />
                  Online
                </p>
              </div>
              {assigning && <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />}
            </button>
          ))
        )}
      </div>

      <button
        onClick={onClose}
        className="w-full"
        style={{
          padding: 8,
          border: "none",
          borderTop: "1px solid var(--border-faint)",
          background: "transparent",
          font: "500 11.5px/1 var(--font-sans)",
          color: "var(--text-muted)",
          cursor: "pointer",
        }}
      >
        Cancel
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReceptionistVisitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: visitId } = use(params);
  const router = useRouter();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [nurses, setNurses] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState("");
  const [assignOk, setAssignOk] = useState("");

  const load = async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const [visitRes, nurseRes] = await Promise.all([
        visitApi.getSummary(visitId),
        practitionersApi.getOnlineStaff("nurse"),
      ]);
      setData(visitRes.data.data);
      setNurses(nurseRes.data?.data?.staff ?? nurseRes.data?.staff ?? []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? "Could not load visit.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (visitId) load();
  }, [visitId]);

  useLiveRefresh(() => load(true), !!visitId);

  const assignNurse = async (nurseId: string) => {
    setAssigning(true);
    setAssignError("");
    setAssignOk("");
    try {
      await visitApi.assignNurse(visitId, nurseId);
      setShowDropdown(false);
      setAssignOk("Nurse assigned successfully.");
      setTimeout(() => setAssignOk(""), 4000);
      await load(true);
    } catch (err: any) {
      setAssignError(err.response?.data?.error?.message ?? "Failed to assign nurse.");
    } finally {
      setAssigning(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading)
    return (
      <div
        className="flex items-center justify-center"
        style={{ height: 280, gap: 10, color: "var(--text-secondary)" }}
      >
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--brand)" }} />
        <span style={{ font: "400 14px/1 var(--font-sans)" }}>Loading visit…</span>
      </div>
    );

  if (error)
    return (
      <Page maxWidth={1100}>
        <Button variant="ghost" icon={ArrowLeft} onClick={() => router.back()} style={{ alignSelf: "flex-start" }}>
          Back
        </Button>
        <Banner
          tone="critical"
          icon={AlertTriangle}
          title="Could not load visit"
          action={
            <Button variant="ghost" size="sm" onClick={() => load()}>
              Retry
            </Button>
          }
        >
          {error}
        </Banner>
      </Page>
    );

  // ── Data ───────────────────────────────────────────────────────────────────
  const visit = data?.visit;
  const patient = data?.patient;
  const vitals = data?.vitalSigns?.[0] ?? null;

  const pr = PRIORITY[visit?.priority] ?? PRIORITY.routine;
  const vt =
    VISIT_TYPE[visit?.visitType] ?? { tone: "neutral" as Tone, label: visit?.visitType ?? "—" };
  const st =
    STATUS[visit?.status] ?? { tone: "neutral" as Tone, label: visit?.status ?? "—" };

  const patientName = patient ? `${patient.firstName} ${patient.lastName}` : "Unknown Patient";
  const age = patient?.dateOfBirth ? ageFromDob(patient.dateOfBirth) : null;
  const hasNurse = !!visit?.assignedNurseId;
  const isCompleted = visit?.status === "completed";

  /* The encounter lifecycle, in the order the front desk sees it happen. */
  const timelineSteps = [
    {
      label: "Visit registered",
      done: true,
      icon: ClipboardList,
      note: visit?.admissionDate ? format(new Date(visit.admissionDate), "HH:mm") : "",
    },
    {
      label: "Nurse assigned",
      done: !!visit?.assignedNurseId,
      icon: UserCheck,
      note: visit?.assignedNurseName ?? (visit?.assignedNurseId ? "Assigned" : "Pending"),
    },
    {
      label: "Triage completed",
      done: !!visit?.hasVitals,
      icon: Activity,
      note: visit?.hasVitals ? "Vitals recorded" : "Pending",
    },
    {
      label: "Doctor assigned",
      done: !!visit?.assignedDoctorId,
      icon: Stethoscope,
      note: visit?.assignedDoctorName ?? (visit?.assignedDoctorId ? "Assigned" : "Pending"),
    },
    {
      label: "Consultation done",
      done: (data?.consultations?.length ?? 0) > 0,
      icon: Stethoscope,
      note: (data?.consultations?.length ?? 0) > 0 ? "Completed" : "Pending",
    },
    {
      label: "Discharged",
      done: visit?.status === "completed",
      icon: CheckCircle2,
      note: visit?.dischargeDate
        ? format(new Date(visit.dischargeDate), "HH:mm")
        : visit?.status === "completed"
          ? "Done"
          : "Pending",
    },
  ];

  const doneCount = timelineSteps.filter((s) => s.done).length;

  return (
    <Page maxWidth={1100}>
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between" style={{ gap: 12 }}>
        <Button variant="ghost" icon={ArrowLeft} onClick={() => router.back()}>
          Back to queue
        </Button>
        <Button icon={RefreshCw} onClick={() => load(true)} disabled={refreshing}>
          Refresh
        </Button>
      </div>

      {/* ── Patient / visit hero ── */}
      <Card>
        <div style={{ background: "var(--sidebar-bg)", padding: "24px 28px" }}>
          <div
            className="flex items-start justify-between flex-wrap"
            style={{ gap: 16 }}
          >
            <div className="flex items-center min-w-0" style={{ gap: 16, flex: 1 }}>
              <span
                className="inline-flex items-center justify-center flex-shrink-0"
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "var(--r-md)",
                  background: "var(--on-dark-raise)",
                  border: "1px solid var(--on-dark-line)",
                  font: "700 18px/1 var(--font-sans)",
                  color: "var(--white)",
                }}
              >
                {patient?.firstName?.[0]}
                {patient?.lastName?.[0]}
              </span>

              <div className="min-w-0 flex flex-col" style={{ gap: 9 }}>
                <div className="flex items-center flex-wrap" style={{ gap: 6 }}>
                  <span
                    className="inline-flex items-center"
                    style={{
                      height: 20,
                      padding: "0 9px",
                      borderRadius: "var(--r-pill)",
                      background: "var(--on-dark-raise)",
                      color: "var(--green-200)",
                      font: "500 11px/1 var(--font-mono)",
                    }}
                  >
                    {visit?.visitNumber}
                  </span>
                  <Pill tone={vt.tone}>{vt.label}</Pill>
                  <Pill tone={pr.tone} dot>
                    {pr.label}
                  </Pill>
                </div>

                <div className="flex items-center flex-wrap" style={{ gap: 10 }}>
                  <h1
                    style={{
                      margin: 0,
                      font: "700 22px/1.2 var(--font-sans)",
                      letterSpacing: "var(--ls-tight)",
                      color: "var(--white)",
                    }}
                  >
                    {patientName}
                  </h1>
                  {patient?.isMinor && (
                    <MinorBadge
                      age={patient.dateOfBirth ? ageFromDob(patient.dateOfBirth) : undefined}
                    />
                  )}
                </div>

                <div
                  className="flex items-center flex-wrap"
                  style={{
                    gap: 10,
                    font: "400 13px/1 var(--font-sans)",
                    color: "var(--on-dark-text)",
                  }}
                >
                  {age !== null && <span>{age} yrs</span>}
                  {patient?.gender && (
                    <>
                      <span style={{ color: "var(--on-dark-text-dim)" }}>·</span>
                      <span style={{ textTransform: "capitalize" }}>{patient.gender}</span>
                    </>
                  )}
                  {patient?.bloodType && patient.bloodType !== "unknown" && (
                    <span
                      className="inline-flex items-center"
                      style={{
                        gap: 4,
                        height: 20,
                        padding: "0 9px",
                        borderRadius: "var(--r-pill)",
                        background: "var(--on-dark-raise)",
                        color: "var(--white)",
                        font: "700 11px/1 var(--font-mono)",
                      }}
                    >
                      <Droplets className="w-[10px] h-[10px]" />
                      {patient.bloodType}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <Pill tone={st.tone} dot={visit?.status === "in-progress"} style={{ height: 26 }}>
              {st.label}
            </Pill>
          </div>
        </div>

        {/* Stats strip */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            background: "var(--surface-card)",
          }}
        >
          {[
            {
              label: "Admitted",
              value: visit?.admissionDate
                ? format(new Date(visit.admissionDate), "dd MMM · HH:mm")
                : "—",
            },
            {
              label: "Wait time",
              value: visit?.admissionDate
                ? formatDistanceToNow(new Date(visit.admissionDate))
                : "—",
            },
            { label: "Ward / room", value: visit?.wardOrRoom ?? "Not assigned" },
            { label: "Bed", value: visit?.bedNumber ?? "Not assigned" },
          ].map(({ label, value }) => (
            <div
              key={label}
              style={{
                padding: "13px 20px",
                borderRight: "1px solid var(--border-faint)",
                display: "flex",
                flexDirection: "column",
                gap: 5,
              }}
            >
              <SectionLabel>{label}</SectionLabel>
              <p
                style={{
                  margin: 0,
                  font: "600 13px/1.3 var(--font-sans)",
                  color: "var(--text-primary)",
                }}
              >
                {value}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Body: main + sidebar. Flex-wrap so it collapses on narrow screens. ── */}
      <div className="flex flex-wrap" style={{ gap: 16, alignItems: "flex-start" }}>
        {/* ── LEFT ── */}
        <div
          style={{
            flex: "1 1 520px",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {/* Nurse assignment */}
          {!isCompleted && (
            <Card pad={20}>
              <div
                className="flex items-center justify-between flex-wrap"
                style={{ gap: 12 }}
              >
                <div className="flex items-center min-w-0" style={{ gap: 12 }}>
                  <span
                    className="inline-flex items-center justify-center flex-shrink-0"
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "var(--r-sm)",
                      background: hasNurse ? "var(--brand-tint)" : "var(--amber-050)",
                      color: hasNurse ? "var(--green-700)" : "var(--urgent-ink)",
                    }}
                  >
                    <UserCheck className="w-[18px] h-[18px]" />
                  </span>
                  <div className="min-w-0 flex flex-col" style={{ gap: 4 }}>
                    <p
                      style={{
                        margin: 0,
                        font: "700 14px/1 var(--font-sans)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {hasNurse ? "Nurse assigned" : "No nurse assigned"}
                    </p>
                    <p
                      style={{
                        margin: 0,
                        font: "400 12.5px/1 var(--font-sans)",
                        color: "var(--text-muted)",
                      }}
                    >
                      {hasNurse
                        ? (visit?.assignedNurseName ?? "A nurse is handling this visit")
                        : "Assign a nurse to begin triage"}
                    </p>
                  </div>
                </div>

                <div className="relative flex-shrink-0">
                  <Button
                    variant={hasNurse ? "secondary" : "primary"}
                    icon={assigning ? undefined : UserPlus}
                    iconRight={assigning ? undefined : ChevronDown}
                    loading={assigning}
                    onClick={() => setShowDropdown((v) => !v)}
                  >
                    {hasNurse ? "Reassign" : "Assign nurse"}
                  </Button>

                  {showDropdown && (
                    <NurseDropdown
                      nurses={nurses}
                      assigning={assigning}
                      onSelect={assignNurse}
                      onClose={() => setShowDropdown(false)}
                    />
                  )}
                </div>
              </div>

              {assignError && (
                <div style={{ marginTop: 12 }}>
                  <Banner tone="critical" icon={AlertCircle}>
                    {assignError}
                  </Banner>
                </div>
              )}
              {assignOk && (
                <div style={{ marginTop: 12 }}>
                  <Banner tone="success" icon={CheckCircle2}>
                    {assignOk}
                  </Banner>
                </div>
              )}
            </Card>
          )}

          {/* Visit details */}
          <Card>
            <CardHeader icon={ClipboardList} title="Visit details" />
            <div style={{ padding: 20 }}>
              {visit?.chiefComplaint && (
                <div
                  style={{
                    padding: "12px 16px",
                    marginBottom: 14,
                    borderRadius: "var(--r-sm)",
                    background: "var(--amber-050)",
                    border: "1px solid var(--amber-100)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 5,
                  }}
                >
                  <SectionLabel style={{ color: "var(--urgent-ink)" }}>
                    Chief complaint
                  </SectionLabel>
                  <p
                    style={{
                      margin: 0,
                      font: "600 14px/1.45 var(--font-sans)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {visit.chiefComplaint}
                  </p>
                </div>
              )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  columnGap: 24,
                }}
              >
                <DataRow label="Visit number" value={visit?.visitNumber} mono />
                <DataRow label="Visit type" value={vt.label} />
                <DataRow label="Priority" value={pr.label} />
                <DataRow label="Status" value={st.label} />
                <DataRow
                  label="Admission date"
                  value={
                    visit?.admissionDate
                      ? format(new Date(visit.admissionDate), "dd MMM yyyy")
                      : "—"
                  }
                />
                <DataRow
                  label="Admission time"
                  value={
                    visit?.admissionDate
                      ? format(new Date(visit.admissionDate), "HH:mm")
                      : "—"
                  }
                  mono
                />
                <DataRow label="Ward / room" value={visit?.wardOrRoom ?? "—"} />
                <DataRow label="Bed number" value={visit?.bedNumber ?? "—"} />
              </div>
            </div>
          </Card>

          {/* Vitals */}
          <Card>
            <CardHeader
              icon={Activity}
              title="Vital signs"
              right={
                vitals ? (
                  <Pill tone="success" icon={CheckCircle2}>
                    Triaged
                  </Pill>
                ) : (
                  <Pill tone="urgent" icon={Clock}>
                    Awaiting triage
                  </Pill>
                )
              }
            />
            <div style={{ padding: 20 }}>
              {vitals ? (
                <>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                      gap: 10,
                    }}
                  >
                    <VitalCard
                      icon={Thermometer}
                      label="Temperature"
                      value={
                        vitals.temperature != null ? `${vitals.temperature}°C` : "—"
                      }
                      rangeKey="temperature"
                      rawValue={vitals.temperature}
                    />
                    <VitalCard
                      icon={Gauge}
                      label="Blood pressure"
                      value={
                        vitals.bloodPressureSystolic != null
                          ? `${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic}`
                          : "—"
                      }
                      rangeKey="bloodPressureSystolic"
                      rawValue={vitals.bloodPressureSystolic}
                    />
                    <VitalCard
                      icon={Heart}
                      label="Pulse rate"
                      value={vitals.pulseRate != null ? `${vitals.pulseRate} bpm` : "—"}
                      rangeKey="pulseRate"
                      rawValue={vitals.pulseRate}
                    />
                    <VitalCard
                      icon={Wind}
                      label="Resp. rate"
                      value={
                        vitals.respiratoryRate != null
                          ? `${vitals.respiratoryRate}/min`
                          : "—"
                      }
                      rangeKey="respiratoryRate"
                      rawValue={vitals.respiratoryRate}
                    />
                    <VitalCard
                      icon={Droplets}
                      label="SpO₂"
                      value={
                        vitals.oxygenSaturation != null
                          ? `${vitals.oxygenSaturation}%`
                          : "—"
                      }
                      rangeKey="oxygenSaturation"
                      rawValue={vitals.oxygenSaturation}
                    />
                    <VitalCard
                      icon={Weight}
                      label="Weight"
                      value={vitals.weight != null ? `${vitals.weight} kg` : "—"}
                      rangeKey="weight"
                      rawValue={vitals.weight}
                    />
                    <VitalCard
                      icon={User}
                      label="Height"
                      value={vitals.height != null ? `${vitals.height} cm` : "—"}
                      rangeKey="height"
                      rawValue={vitals.height}
                    />
                    {vitals.painLevel != null && (
                      /* Pain is self-reported on a 0–10 scale, so it gets its
                         own thresholds rather than a clinical range. */
                      <div
                        style={{
                          padding: "14px 16px",
                          borderRadius: "var(--r-sm)",
                          background:
                            vitals.painLevel >= 7
                              ? "var(--critical-tint)"
                              : vitals.painLevel >= 4
                                ? "var(--urgent-tint)"
                                : "var(--success-tint)",
                        }}
                      >
                        <span
                          className="inline-flex items-center justify-center"
                          style={{
                            width: 28,
                            height: 28,
                            marginBottom: 10,
                            borderRadius: "var(--r-xs)",
                            background: "var(--surface-card)",
                            color:
                              vitals.painLevel >= 7
                                ? "var(--critical-ink)"
                                : vitals.painLevel >= 4
                                  ? "var(--urgent-ink)"
                                  : "var(--success-ink)",
                          }}
                        >
                          <Activity className="w-[13px] h-[13px]" />
                        </span>
                        <p
                          style={{
                            margin: "0 0 4px",
                            font: "700 20px/1 var(--font-sans)",
                            letterSpacing: "var(--ls-tight)",
                            color:
                              vitals.painLevel >= 7
                                ? "var(--critical-ink)"
                                : vitals.painLevel >= 4
                                  ? "var(--urgent-ink)"
                                  : "var(--success-ink)",
                          }}
                        >
                          {vitals.painLevel}/10
                        </p>
                        <SectionLabel style={{ fontSize: 10 }}>Pain level</SectionLabel>
                      </div>
                    )}
                  </div>

                  {vitals.nurseNotes && (
                    <div
                      style={{
                        marginTop: 14,
                        padding: "12px 16px",
                        borderRadius: "var(--r-sm)",
                        background: "var(--surface-sunken)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 5,
                      }}
                    >
                      <SectionLabel>Nurse notes</SectionLabel>
                      <p
                        style={{
                          margin: 0,
                          font: "400 13px/1.6 var(--font-sans)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {vitals.nurseNotes}
                      </p>
                    </div>
                  )}

                  {vitals.recordedAt && (
                    <p
                      className="inline-flex items-center"
                      style={{
                        margin: "12px 0 0",
                        gap: 5,
                        font: "400 11.5px/1 var(--font-sans)",
                        color: "var(--text-muted)",
                      }}
                    >
                      <Clock className="w-3 h-3" />
                      Recorded{" "}
                      {formatDistanceToNow(new Date(vitals.recordedAt), {
                        addSuffix: true,
                      })}
                    </p>
                  )}
                </>
              ) : (
                <div
                  className="flex flex-col items-center text-center"
                  style={{
                    padding: "30px 24px",
                    borderRadius: "var(--r-sm)",
                    background: "var(--surface-sunken)",
                    border: "1px dashed var(--hc-border)",
                  }}
                >
                  <Activity
                    className="w-6 h-6"
                    style={{ color: "var(--text-disabled)", marginBottom: 10 }}
                  />
                  <p
                    style={{
                      margin: "0 0 5px",
                      font: "600 13.5px/1 var(--font-sans)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    No vitals recorded yet
                  </p>
                  <p
                    style={{
                      margin: 0,
                      font: "400 12.5px/1 var(--font-sans)",
                      color: "var(--text-muted)",
                    }}
                  >
                    The assigned nurse will record vitals during triage
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* ── RIGHT sidebar ── */}
        <div
          style={{
            flex: "1 1 280px",
            minWidth: 260,
            maxWidth: 320,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {/* Patient */}
          <Card>
            <SectionLabel
              style={{ padding: "13px 18px", borderBottom: "1px solid var(--border-faint)" }}
            >
              Patient
            </SectionLabel>
            <div style={{ padding: 18 }}>
              <div
                className="flex items-center"
                style={{
                  gap: 10,
                  marginBottom: 12,
                  padding: 12,
                  borderRadius: "var(--r-sm)",
                  background: "var(--surface-sunken)",
                }}
              >
                <Avatar name={patientName} size={38} seed={0} />
                <div className="flex-1 min-w-0 flex flex-col" style={{ gap: 3 }}>
                  <p
                    className="truncate"
                    style={{
                      margin: 0,
                      font: "700 13.5px/1 var(--font-sans)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {patientName}
                  </p>
                  {age !== null && (
                    <p
                      style={{
                        margin: 0,
                        font: "400 11.5px/1 var(--font-sans)",
                        color: "var(--text-muted)",
                        textTransform: "capitalize",
                      }}
                    >
                      {age} yrs · {patient?.gender}
                    </p>
                  )}
                </div>
              </div>

              <DataRow label="Gender" value={patient?.gender ?? "—"} />
              <DataRow
                label="Blood type"
                value={
                  patient?.bloodType && patient.bloodType !== "unknown"
                    ? patient.bloodType
                    : "—"
                }
                mono
              />
              {patient?.dateOfBirth && (
                <DataRow
                  label="Date of birth"
                  value={format(new Date(patient.dateOfBirth), "dd MMM yyyy")}
                />
              )}
            </div>
          </Card>

          {/* Doctor */}
          <Card>
            <SectionLabel
              style={{ padding: "13px 18px", borderBottom: "1px solid var(--border-faint)" }}
            >
              Assigned doctor
            </SectionLabel>
            <div style={{ padding: 18 }}>
              {visit?.assignedDoctorId ? (
                <div
                  className="flex items-center"
                  style={{
                    gap: 10,
                    padding: 12,
                    borderRadius: "var(--r-sm)",
                    background: "var(--brand-tint)",
                    border: "1px solid var(--green-100)",
                  }}
                >
                  <Avatar name={visit.assignedDoctorName ?? "Dr"} size={36} seed={1} />
                  <div className="flex-1 min-w-0 flex flex-col" style={{ gap: 3 }}>
                    <p
                      className="truncate"
                      style={{
                        margin: 0,
                        font: "700 13px/1 var(--font-sans)",
                        color: "var(--green-800)",
                      }}
                    >
                      Dr. {visit.assignedDoctorName ?? "Doctor"}
                    </p>
                    <p
                      style={{
                        margin: 0,
                        font: "400 11px/1 var(--font-sans)",
                        color: "var(--green-800)",
                        opacity: 0.8,
                      }}
                    >
                      Physician
                    </p>
                  </div>
                  <CheckCircle2
                    className="w-4 h-4 flex-shrink-0"
                    style={{ color: "var(--green-700)" }}
                  />
                </div>
              ) : (
                <div
                  className="flex items-center"
                  style={{
                    gap: 9,
                    padding: 12,
                    borderRadius: "var(--r-sm)",
                    background: "var(--surface-sunken)",
                    border: "1px dashed var(--hc-border)",
                  }}
                >
                  <Stethoscope
                    className="w-4 h-4 flex-shrink-0"
                    style={{ color: "var(--text-disabled)" }}
                  />
                  <p
                    style={{
                      margin: 0,
                      font: "400 12.5px/1 var(--font-sans)",
                      color: "var(--text-muted)",
                    }}
                  >
                    No doctor assigned yet
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Visit progress */}
          <Card>
            <div
              className="flex items-center justify-between"
              style={{
                gap: 10,
                padding: "13px 18px",
                borderBottom: "1px solid var(--border-faint)",
              }}
            >
              <SectionLabel>Visit progress</SectionLabel>
              <span
                style={{ font: "700 11.5px/1 var(--font-mono)", color: "var(--green-700)" }}
              >
                {doneCount}/{timelineSteps.length}
              </span>
            </div>

            <div style={{ padding: 18 }}>
              <div
                style={{
                  height: 4,
                  marginBottom: 18,
                  borderRadius: "var(--r-pill)",
                  background: "var(--surface-sunken)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${(doneCount / timelineSteps.length) * 100}%`,
                    borderRadius: "var(--r-pill)",
                    background: "var(--brand)",
                    transition: "width var(--dur-slow) var(--ease-out)",
                  }}
                />
              </div>

              <div className="flex flex-col">
                {timelineSteps.map(({ label, done, icon: Icon, note }, i) => {
                  const last = i === timelineSteps.length - 1;
                  return (
                    <div key={label} className="relative flex" style={{ gap: 12 }}>
                      {/* Connector to the next step. */}
                      {!last && (
                        <div
                          style={{
                            position: "absolute",
                            left: 13,
                            top: 26,
                            bottom: -6,
                            width: 2,
                            borderRadius: "var(--r-pill)",
                            background: done ? "var(--brand)" : "var(--surface-sunken)",
                          }}
                        />
                      )}

                      <span
                        className="inline-flex items-center justify-center flex-shrink-0 relative"
                        style={{
                          width: 28,
                          height: 28,
                          zIndex: 1,
                          borderRadius: "50%",
                          background: done ? "var(--brand-tint)" : "var(--surface-card)",
                          border: `2px solid ${done ? "var(--brand)" : "var(--hc-border)"}`,
                          color: done ? "var(--green-700)" : "var(--text-disabled)",
                          marginBottom: last ? 0 : 6,
                        }}
                      >
                        <Icon className="w-3 h-3" />
                      </span>

                      <div
                        className="flex-1 min-w-0 flex flex-col"
                        style={{ gap: 3, paddingBottom: last ? 0 : 14, paddingTop: 4 }}
                      >
                        <p
                          style={{
                            margin: 0,
                            font: `${done ? 700 : 500} 12.5px/1.2 var(--font-sans)`,
                            color: done ? "var(--text-primary)" : "var(--text-muted)",
                          }}
                        >
                          {label}
                        </p>
                        {note && (
                          <p
                            className="truncate"
                            style={{
                              margin: 0,
                              font: `${done ? 600 : 400} 11.5px/1.2 var(--font-sans)`,
                              color: done ? "var(--green-800)" : "var(--text-disabled)",
                            }}
                          >
                            {note}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </Page>
  );
}
