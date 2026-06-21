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
  Zap,
  Clock,
  TrendingUp,
  Stethoscope,
  Loader2,
  X,
  UserCheck,
  User,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";

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

const PRIORITY_CONFIG: Record<string, any> = {
  critical: {
    color: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca",
    dot: "#ef4444",
    label: "Critical",
  },
  emergency: {
    color: "#ea580c",
    bg: "#fff7ed",
    border: "#fed7aa",
    dot: "#f97316",
    label: "Emergency",
  },
  urgent: {
    color: "#d97706",
    bg: "#fffbeb",
    border: "#fde68a",
    dot: "#f59e0b",
    label: "Urgent",
  },
  routine: {
    color: "#16a34a",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    dot: "#22c55e",
    label: "Routine",
  },
};
const getPriority = (p: string) =>
  PRIORITY_CONFIG[p] ?? PRIORITY_CONFIG.routine;

function timeSince(dateStr: string) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

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
  const hasDoctor = !!p.assignedDoctorId;
  // hasVitals comes from the API — triage is complete when vitals exist
  const triageDone = p.hasVitals === true;
  const waitMins = Math.floor(
    (Date.now() - new Date(p.admissionDate).getTime()) / 60_000,
  );
  const isUrgentPriority = ["critical", "emergency"].includes(p.priority);
  const waitingLong = !triageDone && waitMins > 15;

  return (
    <div
      className="px-5 py-4 flex items-start gap-3"
      style={{
        background: waitingLong ? "#fffbeb" : undefined,
      }}
    >
      <span className="relative flex h-2.5 w-2.5 mt-2 flex-shrink-0">
        {!triageDone && isUrgentPriority && (
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-50"
            style={{ background: priority.dot }}
          />
        )}
        <span
          className="relative inline-flex rounded-full h-2.5 w-2.5"
          style={{ background: priority.dot }}
        />
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="text-sm font-bold text-gray-900">
            {p.patientName}
          </span>
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: priority.bg,
              color: priority.color,
              border: `1px solid ${priority.border}`,
            }}
          >
            {priority.label}
          </span>
          {hasDoctor && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <UserCheck size={12} /> Dr. {p.doctorName}
            </span>
          )}
          {triageDone && (
            <span className="text-xs text-green-700 flex items-center gap-1">
              <CheckCircle2 size={12} /> Triage Done
            </span>
          )}
          {waitingLong && (
            <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              Waiting long
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 truncate">
          {p.chiefComplaint || "No chief complaint recorded yet"}
        </p>
        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <Clock size={11} /> {timeSince(p.admissionDate)}
          </span>
          <span>Visit #{p.visitNumber}</span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-2 flex-shrink-0">
        {/* Assign doctor button */}
        <button
          onClick={() => onAssignDoctor(p)}
          disabled={hasDoctor}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            hasDoctor
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-purple-600 text-white hover:bg-purple-700"
          }`}
        >
          <Stethoscope size={12} />
          {hasDoctor ? "Assigned" : "Assign Doctor"}
        </button>

        {/* Triage button — disabled once vitals exist */}
        <button
          onClick={() => onTriage(p.id)}
          disabled={triageDone}
          title={triageDone ? "Vitals already recorded for this visit" : "Record vitals"}
          className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
            triageDone
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-green-600 text-white hover:bg-green-700"
          }`}
        >
          {triageDone ? (
            <>
              <CheckCircle2 size={12} /> Triaged
            </>
          ) : (
            <>
              <Activity size={12} /> Triage
            </>
          )}
        </button>
      </div>
    </div>
  );
}

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
      // Backend now returns hasVitals per visit — no extra calls needed
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

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* ── Hero banner ── */}
      <div
        className="relative rounded-3xl overflow-hidden mb-6 px-7 py-6"
        style={{
          background:
            "linear-gradient(130deg, #0d4a1f 0%, #166534 55%, #15803d 100%)",
        }}
      >
        <div
          className="absolute -right-8 -top-8 w-40 h-40 rounded-full opacity-10"
          style={{
            background: "radial-gradient(circle, #bbf7d0, transparent)",
          }}
        />
        <div
          className="absolute right-20 bottom-0 w-28 h-28 rounded-full opacity-5"
          style={{
            background: "radial-gradient(circle, #dcfce7, transparent)",
          }}
        />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-green-300/70 text-sm font-medium mb-1">
              {getGreeting()},
            </p>
            <h1
              className="text-white text-2xl font-bold leading-tight"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {user?.firstName} {user?.lastName}
            </h1>
            <p className="text-green-200/50 text-sm mt-1.5">
              {myPatients.length > 0
                ? `${myPatients.length} assigned patient${myPatients.length !== 1 ? "s" : ""}`
                : "No assigned patients"}
              {unassignedPatients.length > 0 && (
                <>
                  {" "}
                  ·{" "}
                  <span className="text-amber-300">
                    {unassignedPatients.length} unassigned
                  </span>
                </>
              )}
              {criticalCount > 0 ? ` · ${criticalCount} need immediate attention` : ""}
            </p>
          </div>
          <div className="flex gap-2.5">
            <button
              onClick={() => router.push("/dashboard/nurse/triage")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105"
              style={{
                background: "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.2)",
              }}
            >
              <Activity className="w-4 h-4" /> Start Triage
            </button>
            <button
              onClick={() => router.push("/dashboard/nurse/queue")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: "rgba(0,0,0,0.2)",
                color: "#bbf7d0",
                border: "1px solid rgba(0,0,0,0.1)",
              }}
            >
              <ClipboardList className="w-4 h-4" /> View Queue
            </button>
          </div>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          {
            label: "Assigned to Me",
            value: myPatients.length,
            color: "#166534",
            bg: "linear-gradient(135deg,#f0fdf4,#dcfce7)",
            border: "#bbf7d0",
            icon: Users,
          },
          {
            label: "Critical/Emergency",
            value: criticalCount,
            color: "#dc2626",
            bg: "linear-gradient(135deg,#fef2f2,#fee2e2)",
            border: "#fecaca",
            icon: AlertTriangle,
          },
          {
            label: "Urgent",
            value: urgentCount,
            color: "#d97706",
            bg: "linear-gradient(135deg,#fffbeb,#fef3c7)",
            border: "#fde68a",
            icon: Zap,
          },
          {
            label: "Routine",
            value: routineCount,
            color: "#1d4ed8",
            bg: "linear-gradient(135deg,#eff6ff,#dbeafe)",
            border: "#bfdbfe",
            icon: ClipboardList,
          },
        ].map(({ label, value, color, bg, border, icon: Icon }) => (
          <div
            key={label}
            className="relative rounded-2xl border overflow-hidden p-4"
            style={{ background: bg, borderColor: border }}
          >
            <div
              className="absolute -right-2 -bottom-2 w-14 h-14 rounded-full opacity-10"
              style={{ background: color }}
            />
            <div className="flex items-start justify-between mb-3">
              <p
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color, opacity: 0.7 }}
              >
                {label}
              </p>
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: `${color}18` }}
              >
                <Icon className="w-3.5 h-3.5" style={{ color }} />
              </div>
            </div>
            <p
              className="text-3xl font-extrabold leading-none"
              style={{ color }}
            >
              {loading ? (
                <span
                  className="inline-block w-7 h-7 rounded-lg animate-pulse"
                  style={{ background: `${color}20` }}
                />
              ) : (
                value
              )}
            </p>
          </div>
        ))}
      </div>

      {/* ── Main content ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Patient lists */}
        <div className="lg:col-span-2 space-y-5">
          {/* My assigned patients */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
                My Assigned Patients
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => fetchAssignedPatients(true)}
                  disabled={refreshing || loading}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all disabled:opacity-40"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
                  />
                </button>
                {myPatients.length > 0 && (
                  <button
                    onClick={() => router.push("/dashboard/nurse/queue")}
                    className="text-xs font-semibold flex items-center gap-1"
                    style={{ color: "#166534" }}
                  >
                    View all <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {loading ? (
                <div className="divide-y divide-gray-50">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-5 py-4 animate-pulse"
                    >
                      <div className="w-2.5 h-2.5 rounded-full bg-gray-100" />
                      <div className="flex-1">
                        <div className="h-3.5 w-32 bg-gray-100 rounded" />
                        <div className="h-3 w-48 bg-gray-100 rounded mt-1" />
                      </div>
                      <div className="w-16 h-6 bg-gray-100 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : myPatients.length === 0 ? (
                <div className="py-16 text-center">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
                    style={{ background: "#f0fdf4" }}
                  >
                    <TrendingUp className="w-5 h-5 text-green-400" />
                  </div>
                  <p className="text-sm font-semibold text-gray-500">
                    No assigned patients
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    The receptionist will assign patients to you
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {myPatients.map((p) => (
                    <PatientRow
                      key={p.id}
                      p={p}
                      onAssignDoctor={openAssignModal}
                      onTriage={(id) =>
                        router.push(`/dashboard/nurse/triage/${id}`)
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Unassigned patients — visible to every nurse at the institution */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
                Unassigned Patients
              </p>
              {!loading && unassignedPatients.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                  {unassignedPatients.length} need a nurse
                </span>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {loading ? (
                <div className="divide-y divide-gray-50">
                  {[...Array(2)].map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-5 py-4 animate-pulse"
                    >
                      <div className="w-2.5 h-2.5 rounded-full bg-gray-100" />
                      <div className="flex-1">
                        <div className="h-3.5 w-32 bg-gray-100 rounded" />
                        <div className="h-3 w-48 bg-gray-100 rounded mt-1" />
                      </div>
                      <div className="w-16 h-6 bg-gray-100 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : unassignedPatients.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm font-semibold text-gray-500">
                    No unassigned patients
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Every active visit at your institution has a nurse
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {unassignedPatients.map((p) => (
                    <PatientRow
                      key={p.id}
                      p={p}
                      onAssignDoctor={openAssignModal}
                      onTriage={(id) =>
                        router.push(`/dashboard/nurse/triage/${id}`)
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick actions sidebar */}
        <div className="space-y-3">
          {/* Triage progress */}
          {!loading && triageProgress.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-1">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
                Triage Progress
              </p>
              <div className="flex items-center gap-3">
                <div className="w-20 h-20 flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={triageProgress}
                        dataKey="value"
                        nameKey="label"
                        innerRadius={24}
                        outerRadius={36}
                        strokeWidth={0}
                      >
                        {triageProgress.map((d) => (
                          <Cell key={d.key} fill={d.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: any, n: any) => [`${v} patients`, n]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-1.5 min-w-0">
                  {triageProgress.map((d) => (
                    <div key={d.key} className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: d.color }}
                      />
                      <span className="text-xs text-gray-600 flex-1 truncate">
                        {d.label}
                      </span>
                      <span className="text-xs font-bold text-gray-900">
                        {d.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">
            Quick Actions
          </p>
          {[
            {
              label: "Triage a Patient",
              desc: "Enter visit number to record vitals",
              href: "/dashboard/nurse/triage",
              icon: Activity,
              color: "#166534",
              bg: "linear-gradient(135deg,#f0fdf4,#dcfce7)",
              border: "#bbf7d0",
            },
            {
              label: "View Full Queue",
              desc: "All visits sorted by priority",
              href: "/dashboard/nurse/queue",
              icon: ClipboardList,
              color: "#1d4ed8",
              bg: "linear-gradient(135deg,#eff6ff,#dbeafe)",
              border: "#bfdbfe",
            },
            {
              label: "My Patients",
              desc: "Recently triaged patients",
              href: "/dashboard/nurse/patients",
              icon: Users,
              color: "#7c3aed",
              bg: "linear-gradient(135deg,#faf5ff,#ede9fe)",
              border: "#ddd6fe",
            },
          ].map(({ label, desc, href, icon: Icon, color, bg, border }) => (
            <button
              key={href}
              onClick={() => router.push(href)}
              className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl border text-left transition-all hover:shadow-md hover:-translate-y-px group"
              style={{ background: bg, borderColor: border }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${color}15` }}
              >
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
              </div>
              <ArrowRight
                className="w-4 h-4 flex-shrink-0 transition-transform group-hover:translate-x-0.5"
                style={{ color }}
              />
            </button>
          ))}
        </div>
      </div>

      {/* ── Doctor assignment modal ── */}
      {showAssignModal && selectedVisit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Assign Doctor</h3>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Select a doctor for <strong>{selectedVisit.patientName}</strong>
            </p>
            {assignError && (
              <div className="mb-3 p-2 rounded-lg bg-red-50 text-red-600 text-sm">
                {assignError}
              </div>
            )}
            <div className="max-h-64 overflow-y-auto space-y-2">
              {doctors.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => assignDoctor(doc.id)}
                  disabled={assigning}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <User size={14} className="text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">
                      Dr. {doc.firstName} {doc.lastName}
                    </p>
                    {doc.specialization && (
                      <p className="text-xs text-gray-400">
                        {doc.specialization}
                      </p>
                    )}
                  </div>
                  {assigning && (
                    <Loader2
                      size={14}
                      className="animate-spin text-gray-400 flex-shrink-0"
                    />
                  )}
                </button>
              ))}
              {doctors.length === 0 && !assignError && (
                <p className="text-center text-gray-400 text-sm py-4">
                  No doctors online at the moment
                </p>
              )}
            </div>
            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setShowAssignModal(false)}
                className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
