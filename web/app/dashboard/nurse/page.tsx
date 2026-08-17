"use client";
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
  X,
  UserCheck,
  CheckCircle2,
  RefreshCw,
  BedDouble,
  PieChart as PieIcon,
} from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import {
  KpiCard,
  Panel,
  PanelHeader,
  SkeletonRow,
  EmptyState,
  PageHeading,
} from "@/components/dashboard/primitives";

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

const PRIORITY: Record<string, { color: string; bg: string; label: string }> = {
  critical: { color: "#dc2626", bg: "#fef2f2", label: "Critical" },
  emergency: { color: "#ea580c", bg: "#fff7ed", label: "Emergency" },
  urgent: { color: "#d97706", bg: "#fffbeb", label: "Urgent" },
  routine: { color: "#16a34a", bg: "#f0fdf4", label: "Routine" },
};
const getP = (p: string) => PRIORITY[p] ?? PRIORITY.routine;

function timeSince(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

/* -------------------------------------------------------------------------- */
/* Patient row                                                                */
/* -------------------------------------------------------------------------- */

function PatientRow({
  p,
  isLast,
  onAssignDoctor,
  onTriage,
}: {
  p: AssignedPatient;
  isLast: boolean;
  onAssignDoctor: (p: AssignedPatient) => void;
  onTriage: (id: string) => void;
}) {
  const priority = getP(p.priority);
  const hasDoctor = !!p.assignedDoctorId;
  const triageDone = p.hasVitals;
  const waitingLong =
    !triageDone && Date.now() - new Date(p.admissionDate).getTime() > 30 * 60_000;

  return (
    <div
      className={`flex items-start gap-3 px-5 py-4 ${
        isLast ? "" : "border-b border-slate-50"
      }`}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: priority.bg }}
      >
        <Activity className="w-4 h-4" style={{ color: priority.color }} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[13px] font-semibold text-slate-800 truncate">
            {p.patientName}
          </p>

          <span
            className="px-2 py-0.5 rounded-full text-[11px] font-bold"
            style={{ background: priority.bg, color: priority.color }}
          >
            {priority.label}
          </span>

          {hasDoctor && (
            <span className="text-[11.5px] text-slate-500 flex items-center gap-1">
              <UserCheck className="w-3 h-3" /> Dr. {p.doctorName}
            </span>
          )}

          {triageDone && (
            <span className="text-[11.5px] text-emerald-700 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Triaged
            </span>
          )}

          {waitingLong && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
              Waiting long
            </span>
          )}
        </div>

        <p className="text-[12.5px] text-slate-400 truncate mt-0.5">
          {p.chiefComplaint || "No chief complaint recorded yet"}
        </p>

        <div className="flex items-center gap-3 mt-1.5 text-[11.5px] text-slate-400">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" /> {timeSince(p.admissionDate)}
          </span>
          <span>Visit #{p.visitNumber}</span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        <button
          onClick={() => onAssignDoctor(p)}
          disabled={hasDoctor}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
            hasDoctor
              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
              : "bg-white border border-slate-200 text-slate-700 hover:border-emerald-200"
          }`}
        >
          <Stethoscope className="w-3 h-3" />
          {hasDoctor ? "Assigned" : "Assign Doctor"}
        </button>

        <button
          onClick={() => onTriage(p.id)}
          disabled={triageDone}
          title={
            triageDone ? "Vitals already recorded for this visit" : "Record vitals"
          }
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
            triageDone
              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
              : "bg-emerald-700 text-white hover:bg-emerald-800"
          }`}
        >
          {triageDone ? (
            <>
              <CheckCircle2 className="w-3 h-3" /> Triaged
            </>
          ) : (
            <>
              <Activity className="w-3 h-3" /> Triage
            </>
          )}
        </button>
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

  useEffect(() => {
    fetchAssignedPatients();
    const iv = setInterval(() => fetchAssignedPatients(true), 30_000);
    return () => clearInterval(iv);
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
    { key: "triaged", label: "Triaged", value: triagedCount, color: "#16a34a" },
    {
      key: "pending",
      label: "Awaiting Triage",
      value: pendingTriageCount,
      color: "#f59e0b",
    },
  ].filter((d) => d.value > 0);

  /* triage/[visitId] is a dynamic route — the visit id goes in the path, not
     a query string (the bare /triage page reads ?visitNumber= instead). */
  const goTriage = (id: string) => router.push(`/dashboard/nurse/triage/${id}`);

  return (
    <div className="w-full max-w-[1280px] mx-auto pb-8">
      <PageHeading
        eyebrow="Nursing"
        title={(user as any)?.institutionName || "Ward Overview"}
        actions={
          <>
            <button
              onClick={() => router.push("/dashboard/nurse/queue")}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-[13px] font-semibold shadow-sm transition-colors"
            >
              <ClipboardList className="w-3.5 h-3.5" />
              Today's Queue
            </button>

            <button
              onClick={() => router.push("/dashboard/nurse/ward")}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-emerald-200 text-slate-700 text-[13px] font-semibold transition-colors"
            >
              <BedDouble className="w-3.5 h-3.5" />
              Ward View
            </button>

            <button
              onClick={() => fetchAssignedPatients(true)}
              disabled={refreshing}
              className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
              />
            </button>
          </>
        }
      />

      {/* Untriaged patients are the nurse's queue — surface them first. */}
      {!loading && pendingTriageCount > 0 && (
        <button
          onClick={() => router.push("/dashboard/nurse/queue")}
          className="w-full flex items-center gap-3 p-4 rounded-2xl mb-5 bg-amber-50 border border-amber-200 text-left hover:bg-amber-100/60 transition-colors"
        >
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <p className="text-[13px] font-semibold text-amber-800 flex-1">
            {pendingTriageCount} patient{pendingTriageCount > 1 ? "s" : ""}{" "}
            awaiting triage
          </p>
          <span className="text-[13px] font-bold text-amber-700 flex items-center gap-1 whitespace-nowrap">
            Open queue <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </button>
      )}

      {/* KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Assigned to Me"
          value={loading ? undefined : myPatients.length}
          description="In my care"
          icon={Users}
          iconClass="bg-blue-50 text-blue-600"
          href="/dashboard/nurse/patients"
        />
        <KpiCard
          label="Critical / Emergency"
          value={loading ? undefined : criticalCount}
          description="Highest priority"
          icon={AlertTriangle}
          iconClass="bg-red-50 text-red-600"
        />
        <KpiCard
          label="Urgent"
          value={loading ? undefined : urgentCount}
          description="Needs prompt care"
          icon={Clock}
          iconClass="bg-amber-50 text-amber-600"
        />
        <KpiCard
          label="Routine"
          value={loading ? undefined : routineCount}
          description="Standard priority"
          icon={CheckCircle2}
          iconClass="bg-emerald-50 text-emerald-600"
        />
      </section>

      {/* Patients + triage progress */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Panel>
            <PanelHeader
              title="My Patients"
              icon={Users}
              meta={
                !loading && myPatients.length > 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                    {myPatients.length}
                  </span>
                ) : undefined
              }
              action="View all"
              onAction={() => router.push("/dashboard/nurse/patients")}
            />

            {loading ? (
              [...Array(3)].map((_, i) => <SkeletonRow key={i} />)
            ) : myPatients.length === 0 ? (
              <EmptyState
                icon={Users}
                message="No patients are currently assigned to you."
              />
            ) : (
              myPatients.map((p, i) => (
                <PatientRow
                  key={p.id}
                  p={p}
                  isLast={i === myPatients.length - 1}
                  onAssignDoctor={openAssignModal}
                  onTriage={goTriage}
                />
              ))
            )}
          </Panel>

          <Panel>
            <PanelHeader
              title="Unassigned Patients"
              icon={ClipboardList}
              meta={
                !loading && unassignedPatients.length > 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                    {unassignedPatients.length}
                  </span>
                ) : undefined
              }
            />

            {loading ? (
              [...Array(2)].map((_, i) => <SkeletonRow key={i} />)
            ) : unassignedPatients.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                message="Every patient has a nurse assigned."
              />
            ) : (
              unassignedPatients.map((p, i) => (
                <PatientRow
                  key={p.id}
                  p={p}
                  isLast={i === unassignedPatients.length - 1}
                  onAssignDoctor={openAssignModal}
                  onTriage={goTriage}
                />
              ))
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Triage Progress" icon={PieIcon} />
            <div className="p-5">
              {loading ? (
                <div className="h-24 rounded-xl bg-slate-50 animate-pulse" />
              ) : triageProgress.length === 0 ? (
                <p className="text-[13px] text-slate-400 text-center py-4">
                  No patients to triage.
                </p>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 flex-shrink-0">
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
                            borderRadius: 12,
                            border: "1px solid #eaecf0",
                            fontSize: 12,
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex-1 space-y-2 min-w-0">
                    {triageProgress.map((d) => (
                      <div key={d.key} className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: d.color }}
                        />
                        <span className="text-[12.5px] text-slate-600 flex-1 truncate">
                          {d.label}
                        </span>
                        <span className="text-[13px] font-bold text-slate-900">
                          {d.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Quick Actions" icon={ArrowRight} />
            <div className="p-3 space-y-2">
              {[
                {
                  label: "Today's Queue",
                  href: "/dashboard/nurse/queue",
                  icon: ClipboardList,
                  cls: "bg-emerald-50 text-emerald-600",
                },
                {
                  label: "Triage Patient",
                  href: "/dashboard/nurse/triage",
                  icon: Activity,
                  cls: "bg-blue-50 text-blue-600",
                },
                {
                  label: "Ward View",
                  href: "/dashboard/nurse/ward",
                  icon: BedDouble,
                  cls: "bg-violet-50 text-violet-600",
                },
              ].map(({ label, href, icon: Icon, cls }) => (
                <button
                  key={href}
                  onClick={() => router.push(href)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-200 text-left hover:border-emerald-200 hover:shadow-sm transition-all group"
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${cls}`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  <p className="flex-1 text-[13px] font-semibold text-slate-800">
                    {label}
                  </p>

                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 transition-colors" />
                </button>
              ))}
            </div>
          </Panel>
        </div>
      </section>

      {/* ── Doctor assignment modal ─────────────────────────────────────────── */}
      {showAssignModal && selectedVisit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-[2px]">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-[15px] font-bold text-slate-900">
                Assign Doctor
              </h3>
              <button
                onClick={() => setShowAssignModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5">
              <p className="text-[13px] text-slate-600 mb-4">
                Select a doctor for{" "}
                <span className="font-semibold text-slate-900">
                  {selectedVisit.patientName}
                </span>
              </p>

              {assignError && (
                <div className="mb-3 px-3 py-2 rounded-xl bg-red-50 border border-red-100 text-[12.5px] text-red-700">
                  {assignError}
                </div>
              )}

              {doctors.length === 0 ? (
                <p className="text-[13px] text-slate-400 text-center py-6">
                  No doctors are currently online.
                </p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {doctors.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => assignDoctor(d.id)}
                      disabled={assigning}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-200 text-left hover:border-emerald-200 hover:bg-slate-50 transition-all disabled:opacity-50"
                    >
                      <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                        <Stethoscope className="w-4 h-4" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-slate-800 truncate">
                          Dr. {d.firstName} {d.lastName}
                        </p>
                        {d.specialization && (
                          <p className="text-[11.5px] text-slate-400 truncate mt-0.5">
                            {d.specialization}
                          </p>
                        )}
                      </div>

                      {assigning ? (
                        <Loader2 className="w-4 h-4 text-slate-300 animate-spin" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
