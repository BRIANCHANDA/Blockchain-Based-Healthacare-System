"use client";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { api, practitionersApi, visitApi } from "@/lib/api";
import {
  Activity,
  ClipboardList,
  ChevronRight,
  AlertTriangle,
  Users,
  ArrowRight,
  Clock,
  Stethoscope,
  Loader2,
  UserCheck,
  CheckCircle2,
  RefreshCw,
  BedDouble,
  PieChart as PieIcon,
} from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import {
  Page,
  PageHeader,
  Card,
  CardHeader,
  KpiCard,
  KpiGrid,
  Pill as Badge,
  Button,
  LinkAction,
  Banner,
  EmptyState,
  SkeletonRow,
  SkeletonBlock,
  Modal,
  hoverRow,
  TONES,
} from "@/components/dashboard/ui";
import { getPriority, timeSince } from "./vocab";

/* ==========================================================================
   Nurse overview.

   Two lists that mean different things: patients assigned to THIS nurse, and
   patients at the institution with no nurse at all. Both need triage, but
   only the second is anybody's to pick up.

   Recharts renders SVG presentation attributes, which accept var() the same
   way CSS does, so chart colours reference the same tokens as the page.
   ========================================================================== */

interface AssignedPatient {
  id: string;
  visitNumber: string;
  patientName: string;
  chiefComplaint: string;
  priority: string;
  status: string;
  admissionDate: string;
  assignedDoctorId?: string;
  assignedNurseId?: string | null;
  doctorName?: string | null;
  // Returned directly by the updated /assigned-to-me endpoint
  hasVitals: boolean;
}

interface Doctor {
  id: string;
  firstName: string;
  lastName: string;
  specialization?: string | null;
}

/* -------------------------------------------------------------------------- */
/* Patient row                                                                */
/* -------------------------------------------------------------------------- */

function PatientRow({
  p,
  onAssignDoctor,
  onTriage,
}: {
  p: AssignedPatient;
  onAssignDoctor: (p: AssignedPatient) => void;
  onTriage: (id: string) => void;
}) {
  const priority = getPriority(p.priority);
  const pTone = TONES[priority.tone];
  const hasDoctor = !!p.assignedDoctorId;
  const triageDone = p.hasVitals;
  /* Half an hour untriaged is the point at which it is worth chasing. */
  const waitingLong =
    !triageDone && Date.now() - new Date(p.admissionDate).getTime() > 30 * 60_000;

  return (
    <div
      className="flex items-start"
      style={{
        gap: 12,
        padding: "14px 20px",
        borderBottom: "1px solid var(--border-faint)",
      }}
    >
      <span
        className="inline-flex items-center justify-center flex-shrink-0"
        style={{
          width: 34,
          height: 34,
          borderRadius: "var(--r-sm)",
          background: pTone.tint,
          color: pTone.ink,
        }}
      >
        <Activity className="w-4 h-4" />
      </span>

      <div className="flex-1 min-w-0 flex flex-col" style={{ gap: 6 }}>
        <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
          <span
            className="truncate"
            style={{
              font: "600 13.5px/1 var(--font-sans)",
              color: "var(--text-primary)",
            }}
          >
            {p.patientName}
          </span>

          <Badge tone={priority.tone} style={{ height: 18, fontSize: 10 }}>
            {priority.label}
          </Badge>

          {hasDoctor && (
            <span
              className="inline-flex items-center"
              style={{
                gap: 5,
                font: "500 11.5px/1 var(--font-sans)",
                color: "var(--text-secondary)",
              }}
            >
              <UserCheck className="w-3 h-3" />
              Dr. {p.doctorName}
            </span>
          )}

          {triageDone && (
            <span
              className="inline-flex items-center"
              style={{
                gap: 5,
                font: "500 11.5px/1 var(--font-sans)",
                color: "var(--green-800)",
              }}
            >
              <CheckCircle2 className="w-3 h-3" />
              Triaged
            </span>
          )}

          {waitingLong && (
            <Badge tone="urgent" style={{ height: 18, fontSize: 10 }}>
              Waiting long
            </Badge>
          )}
        </div>

        <span
          className="truncate"
          style={{
            font: "400 12.5px/1 var(--font-sans)",
            color: "var(--text-muted)",
          }}
        >
          {p.chiefComplaint || "No chief complaint recorded yet"}
        </span>

        <span
          className="flex items-center flex-wrap"
          style={{
            gap: 12,
            font: "400 11.5px/1 var(--font-sans)",
            color: "var(--text-muted)",
          }}
        >
          <span className="inline-flex items-center" style={{ gap: 5 }}>
            <Clock className="w-3 h-3" />
            {timeSince(p.admissionDate)}
          </span>
          <span style={{ fontFamily: "var(--font-mono)" }}>{p.visitNumber}</span>
        </span>
      </div>

      <div className="flex flex-col items-end flex-shrink-0" style={{ gap: 7 }}>
        <Button
          size="sm"
          icon={Stethoscope}
          disabled={hasDoctor}
          onClick={() => onAssignDoctor(p)}
        >
          {hasDoctor ? "Assigned" : "Assign doctor"}
        </Button>

        <Button
          variant={triageDone ? "secondary" : "primary"}
          size="sm"
          icon={triageDone ? CheckCircle2 : Activity}
          disabled={triageDone}
          onClick={() => onTriage(p.id)}
        >
          {triageDone ? "Triaged" : "Triage"}
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Overview                                                                   */
/* -------------------------------------------------------------------------- */

export default function NurseOverview() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [patients, setPatients] = useState<AssignedPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<AssignedPatient | null>(
    null,
  );
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState("");

  const PRIORITY_ORDER: Record<string, number> = {
    critical: 0,
    emergency: 1,
    urgent: 2,
    routine: 3,
  };

  const fetchAssignedPatients = async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await api.get("/api/visits/assigned-to-me");
      // Backend returns hasVitals per visit — no extra calls needed
      const raw: AssignedPatient[] = res.data.data ?? [];
      const sorted = [...raw].sort((a, b) => {
        // Patients still needing triage surface above already-triaged ones
        if (a.hasVitals !== b.hasVitals) return a.hasVitals ? 1 : -1;
        const po =
          (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
        return po !== 0
          ? po
          : new Date(a.admissionDate).getTime() -
              new Date(b.admissionDate).getTime();
      });
      setPatients(sorted);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useLiveRefresh(() => fetchAssignedPatients(true));

  useEffect(() => {
    fetchAssignedPatients();
  }, []);

  const openAssignModal = async (visit: AssignedPatient) => {
    setSelectedVisit(visit);
    setAssignError("");
    try {
      const res = await practitionersApi.getOnlineStaff("practitioner");
      setDoctors(res.data.data?.staff ?? []);
      setShowAssignModal(true);
    } catch {
      setAssignError("Could not load doctors. Please try again.");
    }
  };

  const assignDoctor = async (doctorId: string) => {
    if (!selectedVisit) return;
    setAssigning(true);
    try {
      await visitApi.assignDoctor(selectedVisit.id, doctorId);
      await fetchAssignedPatients();
      setShowAssignModal(false);
      setSelectedVisit(null);
    } catch (err: any) {
      setAssignError(
        err.response?.data?.error?.message || "Failed to assign doctor.",
      );
    } finally {
      setAssigning(false);
    }
  };

  const myPatients = patients.filter((p) => p.assignedNurseId === user?.id);
  const unassignedPatients = patients.filter((p) => !p.assignedNurseId);

  const criticalCount = patients.filter((p) =>
    ["critical", "emergency"].includes(p.priority),
  ).length;
  const urgentCount = patients.filter((p) => p.priority === "urgent").length;
  const routineCount = patients.filter((p) => p.priority === "routine").length;

  const triagedCount = patients.filter((p) => p.hasVitals).length;
  const pendingTriageCount = patients.length - triagedCount;
  const triageProgress = [
    { key: "triaged", label: "Triaged", value: triagedCount, color: "var(--success-ink)" },
    {
      key: "pending",
      label: "Awaiting triage",
      value: pendingTriageCount,
      color: "var(--amber-500)",
    },
  ].filter((d) => d.value > 0);

  /* triage/[visitId] is a dynamic route — the visit id goes in the path, not
     a query string (the bare /triage page reads ?visitNumber= instead). */
  const goTriage = (id: string) => router.push(`/dashboard/nurse/triage/${id}`);

  return (
    <Page>
      <PageHeader
        eyebrow="Nursing"
        title={(user as any)?.institutionName || "Nursing"}
        subtitle={
          loading
            ? "Loading your patients…"
            : `${myPatients.length} assigned to you · ${pendingTriageCount} awaiting triage`
        }
        actions={
          <>
            <Button
              variant="primary"
              icon={ClipboardList}
              onClick={() => router.push("/dashboard/nurse/queue")}
            >
              Today's queue
            </Button>
            <Button
              icon={BedDouble}
              onClick={() => router.push("/dashboard/nurse/ward")}
            >
              Ward view
            </Button>
            <Button
              icon={RefreshCw}
              onClick={() => fetchAssignedPatients(true)}
              disabled={refreshing}
              style={{ padding: 0, width: 38 }}
            />
          </>
        }
      />

      {/* Untriaged patients are the nurse's queue — surface them first. */}
      {!loading && pendingTriageCount > 0 && (
        <Banner
          tone="urgent"
          icon={AlertTriangle}
          onClick={() => router.push("/dashboard/nurse/queue")}
          action={
            <span
              className="inline-flex items-center whitespace-nowrap"
              style={{
                gap: 4,
                font: "700 12.5px/1 var(--font-sans)",
                color: "var(--urgent-ink)",
              }}
            >
              Open queue
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          }
        >
          {pendingTriageCount} patient{pendingTriageCount > 1 ? "s are" : " is"}{" "}
          awaiting triage.
        </Banner>
      )}

      <KpiGrid>
        <KpiCard
          label="Assigned to me"
          value={myPatients.length}
          sub="In my care"
          icon={Users}
          tone="info"
          loading={loading}
          onClick={() => router.push("/dashboard/nurse/patients")}
        />
        <KpiCard
          label="Critical / emergency"
          value={criticalCount}
          sub="Highest priority"
          icon={AlertTriangle}
          tone="critical"
          loading={loading}
        />
        <KpiCard
          label="Urgent"
          value={urgentCount}
          sub="Needs prompt care"
          icon={Clock}
          tone="urgent"
          loading={loading}
        />
        <KpiCard
          label="Routine"
          value={routineCount}
          sub="Standard priority"
          icon={CheckCircle2}
          tone="success"
          loading={loading}
        />
      </KpiGrid>

      {/* Patients + triage progress */}
      <div className="flex flex-wrap" style={{ gap: 16, alignItems: "flex-start" }}>
        <div
          style={{
            flex: "2 1 460px",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <Card>
            <CardHeader
              icon={Users}
              title="My patients"
              right={
                <>
                  {!loading && myPatients.length > 0 && (
                    <Badge tone="info">{myPatients.length}</Badge>
                  )}
                  <LinkAction onClick={() => router.push("/dashboard/nurse/patients")}>
                    View all
                  </LinkAction>
                </>
              }
            />

            {loading ? (
              [...Array(3)].map((_, i) => <SkeletonRow key={i} />)
            ) : myPatients.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No patients assigned"
                message="Patients assigned to you appear here."
              />
            ) : (
              myPatients.map((p) => (
                <PatientRow
                  key={p.id}
                  p={p}
                  onAssignDoctor={openAssignModal}
                  onTriage={goTriage}
                />
              ))
            )}
          </Card>

          <Card>
            <CardHeader
              icon={ClipboardList}
              title="Unassigned patients"
              subtitle="No nurse taking care of these yet"
              right={
                !loading && unassignedPatients.length > 0 ? (
                  <Badge tone="urgent">{unassignedPatients.length}</Badge>
                ) : undefined
              }
            />

            {loading ? (
              [...Array(2)].map((_, i) => <SkeletonRow key={i} />)
            ) : unassignedPatients.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="Everyone is covered"
                message="Every patient has a nurse assigned."
              />
            ) : (
              unassignedPatients.map((p) => (
                <PatientRow
                  key={p.id}
                  p={p}
                  onAssignDoctor={openAssignModal}
                  onTriage={goTriage}
                />
              ))
            )}
          </Card>
        </div>

        <div
          style={{
            flex: "1 1 280px",
            minWidth: 260,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <Card>
            <CardHeader icon={PieIcon} title="Triage progress" />
            <div style={{ padding: 20 }}>
              {loading ? (
                <SkeletonBlock height={96} />
              ) : triageProgress.length === 0 ? (
                <p
                  style={{
                    margin: 0,
                    padding: "16px 0",
                    textAlign: "center",
                    font: "400 13px/1 var(--font-sans)",
                    color: "var(--text-muted)",
                  }}
                >
                  No patients to triage.
                </p>
              ) : (
                <div className="flex items-center" style={{ gap: 16 }}>
                  <div style={{ width: 96, height: 96, flexShrink: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={triageProgress}
                          dataKey="value"
                          nameKey="label"
                          innerRadius={28}
                          outerRadius={42}
                          strokeWidth={0}
                        >
                          {triageProgress.map((d) => (
                            <Cell key={d.key} fill={d.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v: any, n: any) => [`${v} patients`, n]}
                          contentStyle={{
                            borderRadius: 10,
                            border: "1px solid var(--hc-border)",
                            boxShadow: "var(--elev-2)",
                            fontFamily: "var(--font-sans)",
                            fontSize: 12,
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col" style={{ gap: 10 }}>
                    {triageProgress.map((d) => (
                      <div key={d.key} className="flex items-center" style={{ gap: 8 }}>
                        <span
                          className="flex-shrink-0"
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: d.color,
                          }}
                        />
                        <span
                          className="flex-1 truncate"
                          style={{
                            font: "500 12.5px/1 var(--font-sans)",
                            color: "var(--text-secondary)",
                          }}
                        >
                          {d.label}
                        </span>
                        <span
                          style={{
                            font: "700 13px/1 var(--font-sans)",
                            color: "var(--text-primary)",
                          }}
                        >
                          {d.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader icon={ArrowRight} title="Quick actions" />
            <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 2 }}>
              {[
                {
                  label: "Today's queue",
                  sub: "Patients awaiting triage",
                  href: "/dashboard/nurse/queue",
                  icon: ClipboardList,
                  tint: "var(--brand-tint)",
                  ink: "var(--green-700)",
                },
                {
                  label: "Triage patient",
                  sub: "Record vitals",
                  href: "/dashboard/nurse/triage",
                  icon: Activity,
                  tint: "var(--info-tint)",
                  ink: "var(--info-ink)",
                },
                {
                  label: "Ward view",
                  sub: "Beds and admissions",
                  href: "/dashboard/nurse/ward",
                  icon: BedDouble,
                  tint: "var(--accent-tint)",
                  ink: "var(--accent-ink)",
                },
              ].map(({ label, sub, href, icon: Icon, tint, ink }) => (
                <button
                  key={href}
                  onClick={() => router.push(href)}
                  className="flex items-center text-left"
                  style={{
                    gap: 12,
                    padding: 10,
                    border: "none",
                    borderRadius: "var(--r-sm)",
                    background: "transparent",
                    cursor: "pointer",
                    transition: "background var(--dur-fast) var(--ease-standard)",
                  }}
                  {...hoverRow}
                >
                  <span
                    className="inline-flex items-center justify-center flex-shrink-0"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "var(--r-xs)",
                      background: tint,
                      color: ink,
                    }}
                  >
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="flex-1 flex flex-col" style={{ gap: 3 }}>
                    <span
                      style={{
                        font: "600 13.5px/1 var(--font-sans)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {label}
                    </span>
                    <span
                      style={{
                        font: "400 11.5px/1 var(--font-sans)",
                        color: "var(--text-muted)",
                      }}
                    >
                      {sub}
                    </span>
                  </span>
                  <ChevronRight
                    className="w-4 h-4 flex-shrink-0"
                    style={{ color: "var(--text-disabled)" }}
                  />
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* ── Doctor assignment modal ─────────────────────────────────────────── */}
      {showAssignModal && selectedVisit && (
        <Modal
          title="Assign doctor"
          subtitle={selectedVisit.patientName}
          icon={Stethoscope}
          tone="info"
          onClose={() => setShowAssignModal(false)}
        >
          {assignError && (
            <Banner tone="critical" icon={AlertTriangle}>
              {assignError}
            </Banner>
          )}

          {doctors.length === 0 ? (
            <p
              style={{
                margin: 0,
                padding: "24px 0",
                textAlign: "center",
                font: "400 13px/1 var(--font-sans)",
                color: "var(--text-muted)",
              }}
            >
              No doctors are currently online.
            </p>
          ) : (
            <div
              className="flex flex-col"
              style={{ gap: 8, maxHeight: 300, overflowY: "auto" }}
            >
              {doctors.map((d) => (
                <button
                  key={d.id}
                  onClick={() => assignDoctor(d.id)}
                  disabled={assigning}
                  className="w-full flex items-center text-left"
                  style={{
                    gap: 12,
                    padding: 12,
                    borderRadius: "var(--r-sm)",
                    border: "1px solid var(--hc-border)",
                    background: "var(--surface-card)",
                    cursor: assigning ? "not-allowed" : "pointer",
                    opacity: assigning ? 0.6 : 1,
                    transition: "background var(--dur-fast) var(--ease-standard)",
                  }}
                  {...hoverRow}
                >
                  <span
                    className="inline-flex items-center justify-center flex-shrink-0"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "var(--r-sm)",
                      background: "var(--info-tint)",
                      color: "var(--info-ink)",
                    }}
                  >
                    <Stethoscope className="w-4 h-4" />
                  </span>

                  <span className="flex-1 min-w-0 flex flex-col" style={{ gap: 4 }}>
                    <span
                      className="truncate"
                      style={{
                        font: "600 13.5px/1 var(--font-sans)",
                        color: "var(--text-primary)",
                      }}
                    >
                      Dr. {d.firstName} {d.lastName}
                    </span>
                    {d.specialization && (
                      <span
                        className="truncate"
                        style={{
                          font: "400 11.5px/1 var(--font-sans)",
                          color: "var(--text-muted)",
                        }}
                      >
                        {d.specialization}
                      </span>
                    )}
                  </span>

                  {assigning ? (
                    <Loader2
                      className="w-4 h-4 animate-spin flex-shrink-0"
                      style={{ color: "var(--text-muted)" }}
                    />
                  ) : (
                    <ChevronRight
                      className="w-4 h-4 flex-shrink-0"
                      style={{ color: "var(--text-disabled)" }}
                    />
                  )}
                </button>
              ))}
            </div>
          )}
        </Modal>
      )}
    </Page>
  );
}
