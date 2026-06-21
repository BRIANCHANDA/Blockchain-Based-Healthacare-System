"use client";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { visitApi, practitionersApi } from "@/lib/api";
import {
  ArrowLeft,
  ClipboardList,
  User,
  Calendar,
  Clock,
  Tag,
  BedDouble,
  Stethoscope,
  CheckCircle2,
  AlertTriangle,
  Heart,
  Thermometer,
  Wind,
  Gauge,
  UserCheck,
  RefreshCw,
  Hash,
  ChevronDown,
  Loader2,
  UserPlus,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { MinorBadge, ageFromDob } from "@/components/ui/MinorBadge";

const PRIORITY: Record<
  string,
  { color: string; bg: string; border: string; label: string }
> = {
  routine: {
    color: "#166534",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    label: "Routine",
  },
  urgent: {
    color: "#b45309",
    bg: "#fffbeb",
    border: "#fde68a",
    label: "Urgent",
  },
  emergency: {
    color: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca",
    label: "Emergency",
  },
  critical: {
    color: "#7c3aed",
    bg: "#faf5ff",
    border: "#e9d5ff",
    label: "Critical",
  },
};
const VISIT_TYPE: Record<string, { label: string; color: string; bg: string }> =
  {
    outpatient: { label: "Outpatient", color: "#1d4ed8", bg: "#eff6ff" },
    inpatient: { label: "Inpatient", color: "#166534", bg: "#f0fdf4" },
    emergency: { label: "Emergency", color: "#dc2626", bg: "#fef2f2" },
    consultation: { label: "Consultation", color: "#7c3aed", bg: "#faf5ff" },
  };
const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  "in-progress": { label: "In Progress", color: "#166534", bg: "#f0fdf4" },
  completed: { label: "Completed", color: "#6b7280", bg: "#f3f4f6" },
  cancelled: { label: "Cancelled", color: "#dc2626", bg: "#fef2f2" },
};
const BLOOD: Record<string, string> = {
  "A+": "#3b82f6",
  "A-": "#6366f1",
  "B+": "#8b5cf6",
  "B-": "#ec4899",
  "AB+": "#f59e0b",
  "AB-": "#ef4444",
  "O+": "#10b981",
  "O-": "#14b8a6",
};

function InfoRow({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon: any;
  label: string;
  value: any;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-3.5 h-3.5 text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
          {label}
        </p>
        <p
          className={`text-sm font-semibold text-gray-800 ${mono ? "font-mono" : ""}`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

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

  // Nurse assignment
  const [nurses, setNurses] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState("");
  const [assignSuccess, setAssignSuccess] = useState("");

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

  const assignNurse = async (nurseId: string) => {
    setAssigning(true);
    setAssignError("");
    setAssignSuccess("");
    try {
      await visitApi.assignNurse(visitId, nurseId);
      setShowDropdown(false);
      setAssignSuccess("Nurse assigned successfully.");
      await load(true);
    } catch (err: any) {
      setAssignError(
        err.response?.data?.error?.message ?? "Failed to assign nurse.",
      );
    } finally {
      setAssigning(false);
    }
  };

  if (loading)
    return (
      <div
        className="flex items-center justify-center h-64 gap-3"
        style={{ fontFamily: "'DM Sans',sans-serif" }}
      >
        <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Loading visit…</p>
      </div>
    );

  if (error)
    return (
      <div style={{ fontFamily: "'DM Sans',sans-serif" }}>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-5"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 border border-red-100">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-800">
              Could not load visit
            </p>
            <p className="text-xs text-red-600 mt-0.5">{error}</p>
          </div>
          <button
            onClick={() => load()}
            className="ml-auto text-xs font-semibold text-red-700 hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    );

  const visit = data?.visit;
  const patient = data?.patient;
  const vitals = data?.vitalSigns?.[0] ?? null;
  const pr = PRIORITY[visit?.priority] ?? PRIORITY.routine;
  const vt = VISIT_TYPE[visit?.visitType] ?? {
    label: visit?.visitType ?? "—",
    color: "#374151",
    bg: "#f9fafb",
  };
  const st = STATUS[visit?.status] ?? {
    label: visit?.status ?? "—",
    color: "#374151",
    bg: "#f9fafb",
  };
  const patientName = patient
    ? `${patient.firstName} ${patient.lastName}`
    : "Unknown Patient";
  const hasNurse = !!visit?.assignedNurseId;
  const isCompleted = visit?.status === "completed";

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", maxWidth: 800 }}>
      {/* Back + refresh */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to queue
        </button>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-40"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
          />{" "}
          Refresh
        </button>
      </div>

      {/* Visit header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
        <div
          className="px-6 py-5"
          style={{ background: "linear-gradient(135deg,#052e16,#064e23)" }}
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span
                  className="flex items-center gap-1.5 text-xs font-bold font-mono px-2.5 py-1 rounded-full"
                  style={{
                    background: "rgba(255,255,255,0.12)",
                    color: "#bbf7d0",
                  }}
                >
                  <Hash className="w-3 h-3" />
                  {visit?.visitNumber ?? "—"}
                </span>
                <span
                  className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ background: vt.bg, color: vt.color }}
                >
                  {vt.label}
                </span>
                <span
                  className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{
                    background: pr.bg,
                    color: pr.color,
                    border: `1px solid ${pr.border}`,
                  }}
                >
                  {pr.label}
                </span>
              </div>
              <h1
                className="text-white text-xl font-bold flex items-center gap-2 flex-wrap"
                style={{ fontFamily: "'Playfair Display',serif" }}
              >
                {patientName}
                {patient?.isMinor && (
                  <MinorBadge age={patient.dateOfBirth ? ageFromDob(patient.dateOfBirth) : undefined} />
                )}
              </h1>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                {patient?.gender && (
                  <span className="text-green-300/70 text-xs capitalize">
                    {patient.gender}
                  </span>
                )}
                {patient?.bloodType && patient.bloodType !== "unknown" && (
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                    style={{
                      background: BLOOD[patient.bloodType] ?? "#6b7280",
                    }}
                  >
                    {patient.bloodType}
                  </span>
                )}
              </div>
            </div>
            <span
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full"
              style={{ background: st.bg, color: st.color }}
            >
              {visit?.status === "in-progress" && (
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              )}
              {st.label}
            </span>
          </div>
        </div>

        {/* Meta strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-50 border-t border-gray-50">
          {[
            {
              label: "Admitted",
              value: visit?.admissionDate
                ? format(new Date(visit.admissionDate), "dd MMM yyyy · HH:mm")
                : "—",
            },
            {
              label: "Wait time",
              value: visit?.admissionDate
                ? formatDistanceToNow(new Date(visit.admissionDate))
                : "—",
            },
            { label: "Ward/Room", value: visit?.wardOrRoom ?? "Not assigned" },
            { label: "Bed", value: visit?.bedNumber ?? "Not assigned" },
          ].map(({ label, value }) => (
            <div key={label} className="px-4 py-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                {label}
              </p>
              <p className="text-sm font-semibold text-gray-700">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Nurse Assignment Card ── */}
      {!isCompleted && (
        <div
          className="bg-white rounded-2xl border shadow-sm p-5 mb-4"
          style={{ borderColor: hasNurse ? "#bbf7d0" : "#fde68a" }}
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: hasNurse ? "#f0fdf4" : "#fffbeb" }}
              >
                <UserCheck
                  className={`w-5 h-5 ${hasNurse ? "text-green-600" : "text-amber-500"}`}
                />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">
                  {hasNurse ? "Nurse Assigned" : "No Nurse Assigned"}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {hasNurse
                    ? (visit?.assignedNurseName ??
                      "Nurse assigned to this visit")
                    : "Assign a nurse to begin triage"}
                </p>
              </div>
            </div>

            {/* Assign / reassign button */}
            {!hasNurse && (
              <div className="relative">
                <button
                  onClick={() => setShowDropdown((v) => !v)}
                  disabled={assigning}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-md disabled:opacity-50"
                  style={{
                    background: "linear-gradient(135deg,#7c3aed,#6d28d9)",
                  }}
                >
                  {assigning ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                  Assign Nurse
                  {!assigning && <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showDropdown && (
                  <div className="absolute right-0 top-full mt-2 z-20 bg-white rounded-2xl shadow-xl border border-gray-100 w-56">
                    <div className="p-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-2 py-1.5">
                        Online Nurses
                      </p>
                      {nurses.length === 0 ? (
                        <div className="px-3 py-4 text-center">
                          <p className="text-xs text-gray-400 font-medium">
                            No nurses online
                          </p>
                          <p className="text-xs text-gray-300 mt-0.5">
                            Check back shortly
                          </p>
                        </div>
                      ) : (
                        nurses.map((nurse: any) => (
                          <button
                            key={nurse.id}
                            onClick={() => assignNurse(nurse.id)}
                            disabled={assigning}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-left"
                          >
                            <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                              <span className="text-[10px] font-bold text-violet-700">
                                {nurse.firstName?.[0]}
                                {nurse.lastName?.[0]}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-800 truncate">
                                {nurse.firstName} {nurse.lastName}
                              </p>
                              {nurse.lastSeenAt && (
                                <p className="text-xs text-green-600">
                                  ● Online
                                </p>
                              )}
                            </div>
                            {assigning && (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400 flex-shrink-0" />
                            )}
                          </button>
                        ))
                      )}
                      <div className="border-t border-gray-100 mt-1 pt-1">
                        <button
                          onClick={() => setShowDropdown(false)}
                          className="w-full text-xs text-gray-400 px-3 py-2 hover:bg-gray-50 rounded-xl text-left"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Reassign if already assigned */}
            {hasNurse && (
              <div className="relative">
                <button
                  onClick={() => setShowDropdown((v) => !v)}
                  disabled={assigning}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Reassign
                </button>
                {showDropdown && (
                  <div className="absolute right-0 top-full mt-2 z-20 bg-white rounded-2xl shadow-xl border border-gray-100 w-56">
                    <div className="p-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-2 py-1.5">
                        Online Nurses
                      </p>
                      {nurses.length === 0 ? (
                        <p className="text-xs text-gray-400 px-3 py-3">
                          No nurses online
                        </p>
                      ) : (
                        nurses.map((nurse: any) => (
                          <button
                            key={nurse.id}
                            onClick={() => assignNurse(nurse.id)}
                            disabled={assigning}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-left"
                          >
                            <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                              <span className="text-[10px] font-bold text-violet-700">
                                {nurse.firstName?.[0]}
                                {nurse.lastName?.[0]}
                              </span>
                            </div>
                            <p className="text-sm font-semibold text-gray-800">
                              {nurse.firstName} {nurse.lastName}
                            </p>
                          </button>
                        ))
                      )}
                      <div className="border-t border-gray-100 mt-1 pt-1">
                        <button
                          onClick={() => setShowDropdown(false)}
                          className="w-full text-xs text-gray-400 px-3 py-2 hover:bg-gray-50 rounded-xl text-left"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {assignError && (
            <p className="mt-3 text-xs text-red-600 font-medium">
              {assignError}
            </p>
          )}
          {assignSuccess && (
            <p className="mt-3 text-xs text-green-600 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {assignSuccess}
            </p>
          )}
        </div>
      )}

      {/* Two column layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
            Visit Details
          </h2>
          <InfoRow
            icon={ClipboardList}
            label="Chief Complaint"
            value={visit?.chiefComplaint}
          />
          <InfoRow icon={Tag} label="Visit Type" value={vt.label} />
          <InfoRow icon={AlertTriangle} label="Priority" value={pr.label} />
          <InfoRow
            icon={Calendar}
            label="Admission Date"
            value={
              visit?.admissionDate
                ? format(new Date(visit.admissionDate), "dd MMM yyyy")
                : "—"
            }
          />
          <InfoRow
            icon={Clock}
            label="Admission Time"
            value={
              visit?.admissionDate
                ? format(new Date(visit.admissionDate), "HH:mm")
                : "—"
            }
          />
          <InfoRow
            icon={BedDouble}
            label="Ward / Room"
            value={visit?.wardOrRoom}
          />
          <InfoRow
            icon={BedDouble}
            label="Bed Number"
            value={visit?.bedNumber}
          />
          <InfoRow
            icon={Hash}
            label="Visit Number"
            value={visit?.visitNumber}
            mono
          />
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
              Patient Info
            </h2>
            <InfoRow icon={User} label="Full Name" value={patientName} />
            <InfoRow icon={User} label="Gender" value={patient?.gender} />
            <InfoRow
              icon={Heart}
              label="Blood Type"
              value={
                patient?.bloodType !== "unknown" ? patient?.bloodType : null
              }
            />
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
              Doctor
            </h2>
            {visit?.assignedDoctorId ? (
              <InfoRow
                icon={Stethoscope}
                label="Assigned Doctor"
                value={visit?.assignedDoctorName ?? "Doctor assigned"}
              />
            ) : (
              <div className="flex items-center gap-3 py-2">
                <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                  <Stethoscope className="w-3.5 h-3.5 text-gray-300" />
                </div>
                <p className="text-sm text-gray-400">No doctor assigned yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Vitals */}
      {vitals && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">
              Vitals
            </h2>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-green-700">
              <CheckCircle2 className="w-3.5 h-3.5" /> Triaged
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                icon: Heart,
                label: "Heart Rate",
                value: vitals.pulseRate,
                unit: "bpm",
              },
              {
                icon: Thermometer,
                label: "Temperature",
                value: vitals.temperature,
                unit: "°C",
              },
              {
                icon: Wind,
                label: "Resp. Rate",
                value: vitals.respiratoryRate,
                unit: "/min",
              },
              {
                icon: Gauge,
                label: "Blood Pressure",
                value: vitals.bloodPressureSystolic
                  ? `${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic}`
                  : null,
                unit: "mmHg",
              },
            ]
              .filter((f) => f.value)
              .map((f) => (
                <div
                  key={f.label}
                  className="bg-gray-50 rounded-xl p-3 border border-gray-100"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <f.icon className="w-3 h-3 text-gray-400" />
                    <p className="text-xs text-gray-400 font-semibold">
                      {f.label}
                    </p>
                  </div>
                  <p className="text-base font-bold text-gray-800">
                    {f.value}{" "}
                    <span className="text-xs font-normal text-gray-400">
                      {f.unit}
                    </span>
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Progress timeline */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">
          Visit Progress
        </h2>
        <div className="space-y-3">
          {[
            {
              label: "Visit Registered",
              done: true,
              icon: ClipboardList,
              note: visit?.admissionDate
                ? format(new Date(visit.admissionDate), "HH:mm")
                : "",
            },
            {
              label: "Nurse Assigned",
              done: !!visit?.assignedNurseId,
              icon: UserCheck,
              note: visit?.assignedNurseId
                ? (visit?.assignedNurseName ?? "Assigned")
                : "Pending",
            },
            {
              label: "Triage Completed",
              done: !!visit?.hasVitals,
              icon: Heart,
              note: visit?.hasVitals ? "Vitals recorded" : "Pending",
            },
            {
              label: "Doctor Assigned",
              done: !!visit?.assignedDoctorId,
              icon: Stethoscope,
              note: visit?.assignedDoctorId ? "Assigned" : "Pending",
            },
            {
              label: "Consultation Done",
              done: (data?.consultations?.length ?? 0) > 0,
              icon: Stethoscope,
              note: "",
            },
            {
              label: "Discharged",
              done: visit?.status === "completed",
              icon: CheckCircle2,
              note: visit?.dischargeDate
                ? format(new Date(visit.dischargeDate), "HH:mm")
                : "",
            },
          ].map(({ label, done, icon: Icon, note }) => (
            <div key={label} className="flex items-center gap-3">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${done ? "bg-green-50" : "bg-gray-50"}`}
              >
                <Icon
                  className={`w-3.5 h-3.5 ${done ? "text-green-600" : "text-gray-300"}`}
                />
              </div>
              <p
                className={`text-sm font-medium flex-1 ${done ? "text-gray-800" : "text-gray-400"}`}
              >
                {label}
              </p>
              {note && (
                <span
                  className={`text-xs ${done ? "text-green-600 font-semibold" : "text-gray-400"}`}
                >
                  {note}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
