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
  Droplets,
  CheckCircle2,
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
import {
  Card,
  Field,
  Select,
  Textarea,
  Button,
  Pill as Badge,
  MonoTag,
  Banner,
  Modal,
  SectionLabel,
  TONES,
} from "@/components/dashboard/ui";
import { getPriority } from "../../vocab";

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
  /* Discharge stays highlighted once done — it is the terminal step, so its
     completed state is worth seeing from any other tab. */
  const dischargeDone = item.key === "discharge" && isCompleted;

  const bg = active
    ? "var(--brand)"
    : dischargeDone
      ? "var(--brand-tint)"
      : "transparent";

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center text-left"
      style={{
        gap: 10,
        padding: "9px 12px",
        border: "none",
        borderRadius: "var(--r-sm)",
        background: bg,
        color: active
          ? "var(--on-brand)"
          : dischargeDone
            ? "var(--green-800)"
            : "var(--text-secondary)",
        font: `${active ? 600 : 500} 13px/1 var(--font-sans)`,
        cursor: "pointer",
        transition: "background var(--dur-fast) var(--ease-standard)",
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = "var(--green-050)";
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = bg;
      }}
    >
      <Icon
        className="w-4 h-4 flex-shrink-0"
        style={{
          color: active
            ? "var(--green-200)"
            : dischargeDone
              ? "var(--green-700)"
              : "var(--text-muted)",
        }}
      />
      <span className="flex-1 truncate">{item.label}</span>

      {count > 0 && (
        <span
          className="inline-flex items-center justify-center flex-shrink-0"
          style={{
            minWidth: 19,
            height: 17,
            padding: "0 5px",
            borderRadius: "var(--r-pill)",
            background: active ? "var(--on-dark-line)" : "var(--surface-sunken)",
            color: active ? "var(--on-brand)" : "var(--text-secondary)",
            font: "700 10px/1 var(--font-sans)",
          }}
        >
          {count}
        </span>
      )}

      {/* A quiet dot for "something recorded here", when there is no count. */}
      {done && !active && count === 0 && (
        <span
          className="flex-shrink-0"
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--green-600)",
          }}
        />
      )}

      {dischargeDone && !active && (
        <CheckCircle2
          className="w-3.5 h-3.5 flex-shrink-0"
          style={{ color: "var(--green-700)" }}
        />
      )}
    </button>
  );
}

// ── Admit-to-ward modal ───────────────────────────────────────────────────────

/**
 * Converts an outpatient visit to inpatient. The bed itself is assigned later
 * by a nurse from the ward view — this only records the admitting diagnosis
 * and, optionally, a revised priority.
 */
function AdmitModal({
  visitId,
  onClose,
  onAdmitted,
}: {
  visitId: string;
  onClose: () => void;
  onAdmitted: () => void;
}) {
  const [diagnosis, setDiagnosis] = useState("");
  const [priority, setPriority] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    if (!diagnosis.trim()) {
      setErr("Admitting diagnosis is required.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      await visitApi.admit(visitId, {
        admittingDiagnosis: diagnosis.trim(),
        priority: priority || undefined,
      });
      onAdmitted();
    } catch (e: any) {
      setErr(e?.response?.data?.error?.message ?? "Failed to admit patient.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Admit patient to ward"
      subtitle="The nurse will assign a bed from the ward view"
      icon={Bed}
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
            icon={Bed}
            loading={saving}
            onClick={submit}
            style={{ background: "var(--amber-600)", boxShadow: "none" }}
          >
            {saving ? "Admitting…" : "Confirm admission"}
          </Button>
        </>
      }
    >
      <Field label="Admitting diagnosis" required>
        <Textarea
          value={diagnosis}
          onChange={(e) => setDiagnosis(e.target.value)}
          placeholder="e.g. Severe community-acquired pneumonia requiring IV antibiotics and oxygen support"
          rows={3}
        />
      </Field>

      <Field label="Priority" hint="Optional — leave blank to keep the current priority.">
        <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="">Keep current priority</option>
          <option value="routine">Routine</option>
          <option value="urgent">Urgent</option>
          <option value="emergency">Emergency</option>
          <option value="critical">Critical</option>
        </Select>
      </Field>

      {err && (
        <Banner tone="critical" icon={AlertCircle}>
          {err}
        </Banner>
      )}
    </Modal>
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
      <div
        className="flex flex-col items-center justify-center"
        style={{ minHeight: 256, gap: 14 }}
      >
        <span
          className="inline-flex items-center justify-center"
          style={{
            width: 52,
            height: 52,
            borderRadius: "var(--r-md)",
            background: "var(--brand-tint)",
            color: "var(--green-700)",
          }}
        >
          <Shield className="w-6 h-6" />
        </span>
        <div className="text-center flex flex-col" style={{ gap: 5 }}>
          <p
            style={{
              margin: 0,
              font: "600 13.5px/1 var(--font-sans)",
              color: "var(--text-primary)",
            }}
          >
            Verifying access…
          </p>
          <p
            style={{
              margin: 0,
              font: "400 12px/1 var(--font-sans)",
              color: "var(--text-muted)",
            }}
          >
            Checking blockchain permissions
          </p>
        </div>
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--brand)" }} />
      </div>
    );
  }

  if (permStage === "denied") {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px 0" }}>
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
      <div
        className="flex flex-col items-center justify-center"
        style={{ minHeight: 256, gap: 12 }}
      >
        <Loader2 className="w-7 h-7 animate-spin" style={{ color: "var(--brand)" }} />
        <p
          style={{
            margin: 0,
            font: "400 13px/1 var(--font-sans)",
            color: "var(--text-muted)",
          }}
        >
          Loading visit…
        </p>
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
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "64px 0" }}>
        <Banner tone="critical" icon={AlertCircle} title="Visit not found">
          This visit may have been removed, or you may not have access to it.
        </Banner>
        <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
          <Button icon={ChevronLeft} onClick={() => router.back()}>
            Go back
          </Button>
        </div>
      </div>
    );
  }

  const isCompleted = visit.status === "completed";
  const ps = getPriority(visit.priority);
  const psTone = TONES[ps.tone];

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
    <div
      className="flex flex-col min-h-full -m-6"
      style={{ background: "var(--surface-bg)" }}
    >
      {toast && <Toast message={toast.message} type={toast.type} />}

      {/* ══ Patient header bar ══════════════════════════════════════════════ */}
      <div
        className="flex-shrink-0"
        style={{
          background: "var(--surface-card)",
          borderBottom: "1px solid var(--hc-border)",
          boxShadow: "var(--elev-1)",
          padding: "14px 20px",
        }}
      >
        <div className="flex items-center" style={{ gap: 14 }}>
          <Button
            variant="ghost"
            icon={ChevronLeft}
            onClick={() => router.back()}
            style={{ width: 30, padding: 0 }}
          />

          <span
            className="inline-flex items-center justify-center flex-shrink-0 select-none"
            style={{
              width: 46,
              height: 46,
              borderRadius: "var(--r-md)",
              background: "var(--brand-tint)",
              color: "var(--green-700)",
              font: "700 15px/1 var(--font-sans)",
            }}
          >
            {patient?.firstName?.[0] ?? "?"}
            {patient?.lastName?.[0] ?? ""}
          </span>

          {/* Name + demographics */}
          <div className="flex-1 min-w-0 flex flex-col" style={{ gap: 7 }}>
            <div className="flex items-center flex-wrap" style={{ gap: 9 }}>
              <h1
                style={{
                  margin: 0,
                  font: "700 17px/1.1 var(--font-sans)",
                  letterSpacing: "var(--ls-tight)",
                  color: "var(--text-primary)",
                }}
              >
                {patient ? `${patient.firstName} ${patient.lastName}` : patientName}
              </h1>

              {patient?.isMinor && (
                <MinorBadge
                  age={patient.dateOfBirth ? ageFromDob(patient.dateOfBirth) : undefined}
                  primaryGuardianName={(patient as any).guardians?.[0]?.guardianName}
                  primaryGuardianRelationship={(patient as any).guardians?.[0]?.relationship}
                />
              )}

              {patient?.bloodType && patient.bloodType !== "unknown" && (
                <span
                  className="inline-flex items-center"
                  style={{
                    gap: 4,
                    height: 19,
                    padding: "0 8px",
                    borderRadius: "var(--r-pill)",
                    background: "var(--critical-tint)",
                    color: "var(--critical-ink)",
                    font: "700 10.5px/1 var(--font-mono)",
                  }}
                >
                  <Droplets className="w-2.5 h-2.5" />
                  {patient.bloodType}
                </span>
              )}

              {patient?.gender && (
                <span
                  style={{
                    font: "400 12px/1 var(--font-sans)",
                    color: "var(--text-muted)",
                    textTransform: "capitalize",
                  }}
                >
                  {patient.gender}
                </span>
              )}
            </div>

            {/* Visit meta row */}
            <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
              <MonoTag style={{ height: 18, fontSize: 10.5 }}>
                {visit.visitNumber}
              </MonoTag>

              <Badge tone={ps.tone} dot style={{ height: 18, fontSize: 10 }}>
                {ps.label}
              </Badge>

              {isCompleted ? (
                <Badge tone="success" icon={CheckCircle2} style={{ height: 18, fontSize: 10 }}>
                  Discharged
                </Badge>
              ) : (
                <Badge tone="info" dot style={{ height: 18, fontSize: 10 }}>
                  Active
                </Badge>
              )}

              <span
                style={{
                  font: "400 11.5px/1 var(--font-sans)",
                  color: "var(--text-muted)",
                  textTransform: "capitalize",
                }}
              >
                {visit.visitType}
              </span>

              {visit.chiefComplaint && (
                <>
                  <span style={{ color: "var(--text-disabled)" }}>·</span>
                  <span
                    className="truncate"
                    style={{
                      maxWidth: 280,
                      font: "400 11.5px/1 var(--font-sans)",
                      color: "var(--text-secondary)",
                      fontStyle: "italic",
                    }}
                  >
                    “{visit.chiefComplaint}”
                  </span>
                </>
              )}

              {visit.admissionDate && (
                <>
                  <span style={{ color: "var(--text-disabled)" }}>·</span>
                  <span
                    style={{
                      font: "400 11.5px/1 var(--font-sans)",
                      color: "var(--text-muted)",
                    }}
                  >
                    {formatDistanceToNow(new Date(visit.admissionDate), {
                      addSuffix: true,
                    })}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Ward / doctor pills + refresh */}
          <div className="flex items-center flex-shrink-0" style={{ gap: 8 }}>
            {visit.wardOrRoom && (
              <span
                className="hidden sm:inline-flex items-center"
                style={{
                  gap: 6,
                  height: 30,
                  padding: "0 11px",
                  borderRadius: "var(--r-sm)",
                  background: "var(--surface-sunken)",
                  font: "500 12px/1 var(--font-sans)",
                  color: "var(--text-secondary)",
                }}
              >
                <Bed className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                {visit.wardOrRoom}
              </span>
            )}
            {visit.assignedDoctorName && (
              <span
                className="hidden md:inline-flex items-center"
                style={{
                  gap: 6,
                  height: 30,
                  padding: "0 11px",
                  borderRadius: "var(--r-sm)",
                  background: "var(--surface-sunken)",
                  font: "500 12px/1 var(--font-sans)",
                  color: "var(--text-secondary)",
                }}
              >
                <HeartPulse className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                Dr. {visit.assignedDoctorName}
              </span>
            )}
            <Button
              size="sm"
              icon={RefreshCw}
              onClick={() => loadVisit(true)}
              disabled={refreshing}
            >
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* ══ Body: sidebar + content ══════════════════════════════════════════ */}
      <div className="flex flex-1 min-h-0">

        {/* ── Left sidebar navigation ── */}
        <aside
          className="flex-shrink-0 overflow-y-auto"
          style={{
            width: 210,
            borderRight: "1px solid var(--hc-border)",
            background: "var(--surface-card)",
          }}
        >
          <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 2 }}>
            {NAV_GROUPS.map((group, gi) => (
              <div key={group.section} style={{ paddingTop: gi > 0 ? 10 : 0 }}>
                <SectionLabel style={{ padding: "4px 12px 6px", fontSize: 9.5 }}>
                  {group.section}
                </SectionLabel>

                {group.items.map((item) => {
                  const count = item.countKey ? (counts[item.countKey] ?? 0) : 0;
                  /* "Done" means the tab has at least one record — a quiet
                     completeness cue for tabs that carry no count badge. */
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

                {gi < NAV_GROUPS.length - 1 && (
                  <div
                    style={{
                      marginTop: 10,
                      borderBottom: "1px solid var(--border-faint)",
                    }}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Admit to Ward — only for active, non-inpatient visits */}
          {!isCompleted && visit?.visitType !== "inpatient" && (
            <div style={{ margin: "0 12px 12px" }}>
              <Button
                full
                size="sm"
                icon={Bed}
                onClick={() => setAdmitOpen(true)}
                style={{
                  background: "var(--amber-050)",
                  borderColor: "var(--amber-100)",
                  color: "var(--urgent-ink)",
                  boxShadow: "none",
                }}
              >
                Admit to ward
              </Button>
            </div>
          )}

          {visit?.visitType === "inpatient" && !isCompleted && (
            <div style={{ margin: "0 12px 12px" }}>
              <div
                className="text-center"
                style={{
                  padding: "8px 12px",
                  borderRadius: "var(--r-sm)",
                  background: "var(--info-tint)",
                  border: "1px solid var(--blue-100)",
                  font: "600 11.5px/1 var(--font-sans)",
                  color: "var(--info-ink)",
                }}
              >
                Admitted · inpatient
              </div>
            </div>
          )}

          {/* Latest vitals — a glanceable anchor while working in any tab. */}
          {vitals.length > 0 &&
            (() => {
              const v = vitals[0];
              /* Out-of-range readings are the only ones that earn colour. */
              const rows = [
                v.bloodPressureSystolic && {
                  label: "BP",
                  value: `${v.bloodPressureSystolic}/${v.bloodPressureDiastolic}`,
                  alert: false,
                },
                v.pulseRate && {
                  label: "HR",
                  value: `${v.pulseRate} bpm`,
                  alert: v.pulseRate > 100 || v.pulseRate < 50,
                },
                v.temperature && {
                  label: "Temp",
                  value: `${v.temperature}°C`,
                  alert: parseFloat(v.temperature) >= 38,
                },
                v.oxygenSaturation && {
                  label: "SpO₂",
                  value: `${v.oxygenSaturation}%`,
                  alert: v.oxygenSaturation < 94,
                },
              ].filter(Boolean) as { label: string; value: string; alert: boolean }[];

              return (
                <div style={{ margin: "0 12px 16px" }}>
                  <Card pad={12}>
                    <SectionLabel style={{ marginBottom: 10, fontSize: 9.5 }}>
                      Latest vitals
                    </SectionLabel>
                    <div className="flex flex-col" style={{ gap: 8 }}>
                      {rows.map((r) => (
                        <div
                          key={r.label}
                          className="flex items-baseline justify-between"
                          style={{ gap: 10 }}
                        >
                          <span
                            style={{
                              font: "400 11.5px/1 var(--font-sans)",
                              color: "var(--text-muted)",
                            }}
                          >
                            {r.label}
                          </span>
                          <span
                            style={{
                              font: "600 12px/1 var(--font-mono)",
                              color: r.alert
                                ? "var(--critical-ink)"
                                : "var(--text-primary)",
                            }}
                          >
                            {r.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              );
            })()}
        </aside>

        {/* ── Main content area ── */}
        <div
          className="flex-1 min-w-0 overflow-y-auto"
          style={{ background: "var(--surface-bg)" }}
        >
          {/* Tab label breadcrumb */}
          <div
            className="flex items-center"
            style={{ gap: 7, padding: "20px 24px 8px" }}
          >
            <span
              style={{
                font: "400 11.5px/1 var(--font-sans)",
                color: "var(--text-muted)",
              }}
            >
              {NAV_GROUPS.find((g) => g.items.some((i) => i.key === activeTab))?.section}
            </span>
            <ChevronRight
              className="w-3 h-3"
              style={{ color: "var(--text-disabled)" }}
            />
            <span
              style={{
                font: "600 11.5px/1 var(--font-sans)",
                color: "var(--text-secondary)",
              }}
            >
              {NAV_GROUPS.flatMap((g) => g.items).find((i) => i.key === activeTab)?.label}
            </span>
          </div>

          <div style={{ padding: "0 24px 32px" }}>
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
