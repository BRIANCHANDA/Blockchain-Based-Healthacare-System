"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { patientApi } from "@/lib/api";
import {
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Phone,
  Calendar,
  User,
  Activity,
  PlusCircle,
  MapPin,
  Heart,
  Briefcase,
  Users,
} from "lucide-react";
import { format, differenceInYears } from "date-fns";

const bloodTypeColor: Record<string, string> = {
  "A+": "#3b82f6",
  "A-": "#6366f1",
  "B+": "#8b5cf6",
  "B-": "#ec4899",
  "AB+": "#f59e0b",
  "AB-": "#ef4444",
  "O+": "#10b981",
  "O-": "#14b8a6",
  unknown: "#9ca3af",
};

const PRIORITY_STYLE: Record<
  string,
  { bg: string; text: string; dot: string }
> = {
  routine: { bg: "#f0fdf4", text: "#15803d", dot: "#16a34a" },
  urgent: { bg: "#fffbeb", text: "#d97706", dot: "#f59e0b" },
  emergency: { bg: "#fef2f2", text: "#dc2626", dot: "#ef4444" },
  critical: { bg: "#fdf4ff", text: "#7c3aed", dot: "#a855f7" },
};

const SEVERITY_COLOR: Record<string, string> = {
  mild: "#16a34a",
  moderate: "#d97706",
  severe: "#dc2626",
  life_threatening: "#7c3aed",
};

export default function PatientDetailPage() {
  const { id: patientId } = useParams<{ id: string }>();
  const router = useRouter();
  const [patient, setPatient] = useState<any>(null);
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const patRes = await patientApi.getById(patientId);
      setPatient(patRes.data.data?.patient ?? null);
      // If the patient response includes visits, use them; otherwise default to an empty array
      setVisits(patRes.data.data?.patient?.visits ?? []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? "Failed to load patient.");
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <AlertCircle size={40} className="text-red-400 mx-auto mb-3" />
        <p className="text-gray-700 font-semibold">
          {error || "Patient not found"}
        </p>
        <p className="text-gray-400 text-sm mt-1">
          You may not have permission to view this patient's records.
        </p>
        <button
          onClick={() => router.back()}
          className="mt-4 text-green-700 text-sm font-medium hover:underline"
        >
          ← Go back
        </button>
      </div>
    );
  }

  const activeVisit = visits.find((v) => v.status === "in-progress");
  const age = patient.dateOfBirth
    ? differenceInYears(new Date(), new Date(patient.dateOfBirth))
    : null;

  return (
    <div
      className="max-w-4xl mx-auto"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Back nav */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5 transition-colors"
      >
        <ChevronLeft size={16} /> Back
      </button>

      <div className="space-y-4">
        {/* ── Patient header card ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div
            className="px-6 py-5"
            style={{ background: "linear-gradient(135deg, #f0fdf4, #dcfce7)" }}
          >
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white flex-shrink-0"
                style={{ background: "#166534" }}
              >
                {patient.firstName?.[0]}
                {patient.lastName?.[0]}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h1
                      className="text-xl font-bold text-gray-900"
                      style={{ fontFamily: "'Playfair Display', serif" }}
                    >
                      {patient.firstName} {patient.lastName}
                    </h1>
                    <p className="text-sm text-gray-500 mt-0.5 capitalize">
                      {patient.gender}
                      {age ? ` · ${age} years old` : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {patient.bloodType && patient.bloodType !== "unknown" && (
                      <span
                        className="text-sm font-bold px-3 py-1.5 rounded-full text-white"
                        style={{
                          background:
                            bloodTypeColor[patient.bloodType] ?? "#6b7280",
                        }}
                      >
                        {patient.bloodType}
                      </span>
                    )}
                    {activeVisit && (
                      <span
                        className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-full"
                        style={{
                          background: "#fef2f2",
                          color: "#dc2626",
                          border: "1px solid #fca5a5",
                        }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        Currently Admitted
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Info grid */}
          <div className="px-6 py-4 grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 border-b border-gray-100">
            {[
              { icon: User, label: "National ID", value: patient.nationalId },
              { icon: Phone, label: "Phone", value: patient.phoneNumber },
              {
                icon: Calendar,
                label: "Date of Birth",
                value: patient.dateOfBirth
                  ? format(new Date(patient.dateOfBirth), "dd MMM yyyy")
                  : "—",
              },
              { icon: MapPin, label: "Address", value: patient.address },
              {
                icon: Briefcase,
                label: "Occupation",
                value: patient.occupation ?? "—",
              },
              {
                icon: Users,
                label: "Marital Status",
                value: patient.maritalStatus ?? "—",
              },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-2.5">
                <Icon
                  size={14}
                  className="text-gray-400 flex-shrink-0 mt-0.5"
                />
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-0.5">
                    {label}
                  </p>
                  <p className="text-sm text-gray-800 font-medium capitalize">
                    {value ?? "—"}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Emergency contact */}
          {patient.emergencyContact && (
            <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-2 text-sm">
              <Phone size={13} className="text-gray-400" />
              <span className="text-gray-400 text-xs uppercase font-semibold tracking-wide">
                Emergency Contact:
              </span>
              <span className="text-gray-700 font-medium">
                {patient.emergencyContact}
              </span>
            </div>
          )}

          {/* Active visit CTA */}
          {activeVisit && (
            <div className="px-6 py-4">
              <button
                onClick={() =>
                  router.push(`/dashboard/doctor/visits/${activeVisit.id}`)
                }
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-md"
                style={{
                  background: "linear-gradient(135deg, #166534, #15803d)",
                }}
              >
                <Activity className="w-4 h-4" />
                Open Active Visit — {activeVisit.visitNumber}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* New visit button (no active visit) */}
          {!activeVisit && (
            <div className="px-6 py-4">
              <button
                onClick={() =>
                  router.push(
                    `/dashboard/doctor/visits/new?patientId=${patientId}`,
                  )
                }
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-green-200 text-green-700 text-sm font-semibold hover:bg-green-50 transition-colors"
              >
                <PlusCircle size={15} />
                Create New Visit
              </button>
            </div>
          )}
        </div>

        {/* ── Allergies ── */}
        {patient.allergies?.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
              <AlertCircle size={15} className="text-red-500" />
              <p className="text-sm font-bold text-gray-900">Known Allergies</p>
            </div>
            <div className="divide-y divide-gray-50">
              {patient.allergies.map((a: any) => (
                <div key={a.id} className="px-5 py-3 flex items-start gap-3">
                  <div
                    className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                    style={{
                      background: SEVERITY_COLOR[a.severity] ?? "#9ca3af",
                    }}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">
                        {a.allergen}
                      </p>
                      <span
                        className="text-xs font-semibold px-1.5 py-0.5 rounded-full capitalize"
                        style={{
                          background: SEVERITY_COLOR[a.severity] + "15",
                          color: SEVERITY_COLOR[a.severity] ?? "#6b7280",
                        }}
                      >
                        {a.severity?.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 capitalize">
                      {a.allergyType} · {a.reaction}
                    </p>
                    {a.notes && (
                      <p className="text-xs text-gray-400 mt-0.5 italic">
                        {a.notes}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Medical history ── */}
        {patient.medicalHistory?.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
              <Heart size={15} className="text-rose-500" />
              <p className="text-sm font-bold text-gray-900">Medical History</p>
            </div>
            <div className="divide-y divide-gray-50">
              {patient.medicalHistory.map((m: any) => (
                <div key={m.id} className="px-5 py-3 flex items-start gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-gray-900">
                        {m.condition}
                      </p>
                      <span
                        className="text-xs font-semibold px-1.5 py-0.5 rounded-full capitalize"
                        style={
                          m.status === "active"
                            ? { background: "#fef2f2", color: "#dc2626" }
                            : { background: "#f0fdf4", color: "#15803d" }
                        }
                      >
                        {m.status}
                      </span>
                    </div>
                    {m.diagnosedDate && (
                      <p className="text-xs text-gray-400">
                        Diagnosed: {m.diagnosedDate}
                      </p>
                    )}
                    {m.notes && (
                      <p className="text-xs text-gray-500 mt-0.5">{m.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Visit history ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-gray-900">Visit History</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {visits.length} total visit{visits.length !== 1 ? "s" : ""}
              </p>
            </div>
            <button
              onClick={() =>
                router.push(
                  `/dashboard/doctor/visits/new?patientId=${patientId}`,
                )
              }
              className="flex items-center gap-1.5 text-xs font-semibold text-green-700 hover:text-green-800 transition-colors"
            >
              <PlusCircle size={13} /> New visit
            </button>
          </div>

          {visits.length === 0 ? (
            <div className="py-10 text-center text-gray-400 text-sm">
              No visits on record
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {visits.map((v) => {
                const ps = PRIORITY_STYLE[v.priority] ?? PRIORITY_STYLE.routine;
                const isActive = v.status === "in-progress";
                return (
                  <button
                    key={v.id}
                    onClick={() =>
                      router.push(`/dashboard/doctor/visits/${v.id}`)
                    }
                    className="w-full px-5 py-3.5 flex items-center gap-4 hover:bg-gray-50 transition-colors text-left group"
                  >
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: isActive ? "#ef4444" : ps.dot }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-bold text-gray-500 font-mono">
                          {v.visitNumber}
                        </span>
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize"
                          style={{ background: ps.bg, color: ps.text }}
                        >
                          {v.priority}
                        </span>
                        {isActive && (
                          <span
                            className="text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: "#fef2f2", color: "#dc2626" }}
                          >
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {v.chiefComplaint}
                      </p>
                      <p className="text-xs text-gray-400">
                        {v.admissionDate
                          ? format(new Date(v.admissionDate), "dd MMM yyyy")
                          : "—"}{" "}
                        · {v.institution?.institutionName ?? "—"}
                      </p>
                    </div>
                    <ChevronRight
                      size={16}
                      className="text-gray-300 group-hover:text-gray-500 flex-shrink-0 transition-colors"
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
