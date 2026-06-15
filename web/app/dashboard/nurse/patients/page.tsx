"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { patientApi, visitApi } from "@/lib/api";
import {
  Search,
  X,
  Users,
  ChevronRight,
  RefreshCw,
  Activity,
  CheckCircle2,
  Clock,
  Droplets,
  AlertCircle,
  ArrowLeft,
  Heart,
  Thermometer,
  Wind,
  Gauge,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

const BLOOD_COLOR: Record<string, string> = {
  "A+": "#3b82f6",
  "A-": "#6366f1",
  "B+": "#8b5cf6",
  "B-": "#ec4899",
  "AB+": "#f59e0b",
  "AB-": "#ef4444",
  "O+": "#10b981",
  "O-": "#14b8a6",
};

const PRIORITY: Record<string, { color: string; bg: string; label: string }> = {
  critical: { color: "#dc2626", bg: "#fef2f2", label: "Critical" },
  emergency: { color: "#ea580c", bg: "#fff7ed", label: "Emergency" },
  urgent: { color: "#d97706", bg: "#fffbeb", label: "Urgent" },
  routine: { color: "#16a34a", bg: "#f0fdf4", label: "Routine" },
};

function calcAge(dob?: string) {
  if (!dob) return null;
  return Math.floor(
    (Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25),
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-50">
      {[1, 2, 3, 4, 5].map((i) => (
        <td key={i} className="py-4 px-4">
          <div
            className="h-4 bg-gray-100 rounded animate-pulse"
            style={{ width: i === 1 ? "70%" : "50%" }}
          />
        </td>
      ))}
    </tr>
  );
}

// ── Patient detail panel ──────────────────────────────────────────────────────
function PatientDetailPanel({
  patientId,
  onClose,
}: {
  patientId: string;
  onClose: () => void;
}) {
  const [patient, setPatient] = useState<any>(null);
  const [history, setHistory] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [pRes, hRes] = await Promise.all([
          patientApi.getById(patientId),
          patientApi.getHistory(patientId),
        ]);
        setPatient(pRes.data.data);
        setHistory(hRes.data.data);
      } catch {
        setError("Could not load patient data.");
      } finally {
        setLoading(false);
      }
    })();
  }, [patientId]);

  // Extract triage-relevant data: vitals + nursing assessments from all visits
  const triageHistory =
    history?.ownVisits?.map((v: any) => ({
      visit: v.visit,
      vitals: v.vitals ?? [],
      nursingAssessment: v.nursingAssessment ?? null,
    })) ?? [];

  const age = calcAge(patient?.dateOfBirth);

  if (loading)
    return (
      <div className="flex items-center justify-center h-64 gap-3">
        <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Loading patient…</p>
      </div>
    );

  if (error)
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-100">
        <AlertCircle className="w-4 h-4 text-red-500" />
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );

  return (
    <div>
      {/* Back */}
      <button
        onClick={onClose}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-5 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to all patients
      </button>

      {/* Patient header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-5">
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold text-white flex-shrink-0"
            style={{
              background:
                patient?.gender === "female"
                  ? "linear-gradient(135deg,#ec4899,#db2777)"
                  : "linear-gradient(135deg,#166534,#15803d)",
            }}
          >
            {patient?.firstName?.[0]}
            {patient?.lastName?.[0]}
          </div>
          <div className="flex-1">
            <h2
              className="text-xl font-bold text-gray-900"
              style={{ fontFamily: "'Playfair Display',serif" }}
            >
              {patient?.firstName} {patient?.lastName}
            </h2>
            <div className="flex flex-wrap gap-3 mt-1.5">
              {age !== null && (
                <span className="text-sm text-gray-500">{age} yrs</span>
              )}
              {patient?.gender && (
                <span className="text-sm text-gray-500 capitalize">
                  {patient.gender}
                </span>
              )}
              {patient?.bloodType && patient.bloodType !== "unknown" && (
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                  style={{
                    background: BLOOD_COLOR[patient.bloodType] ?? "#6b7280",
                  }}
                >
                  {patient.bloodType}
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">
              Total Visits
            </p>
            <p className="text-2xl font-bold text-gray-900">
              {triageHistory.length}
            </p>
          </div>
        </div>
      </div>

      {/* Triage history */}
      <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">
        Triage & Nursing History
      </h3>

      {triageHistory.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-12 text-center">
          <Activity className="w-8 h-8 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-400">
            No triage history found
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {triageHistory.map((item: any, i: number) => {
            const v = item.visit;
            const p = PRIORITY[v?.priority] ?? PRIORITY.routine;
            const latestVitals = item.vitals?.[0];
            const na = item.nursingAssessment;

            return (
              <div
                key={v?.id ?? i}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
              >
                {/* Visit header */}
                <div
                  className="px-5 py-3 border-b border-gray-50 flex items-center justify-between"
                  style={{ background: p.bg }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="text-xs font-bold px-2.5 py-1 rounded-full"
                      style={{ background: "#fff", color: p.color }}
                    >
                      {p.label}
                    </span>
                    <span className="text-sm font-semibold text-gray-700 font-mono">
                      {v?.visitNumber}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {item.vitals?.length > 0 ? (
                      <span className="flex items-center gap-1 text-xs font-semibold text-green-700">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Triaged
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-semibold text-amber-600">
                        <Clock className="w-3.5 h-3.5" /> Not triaged
                      </span>
                    )}
                    {v?.admissionDate && (
                      <span className="text-xs text-gray-500">
                        {format(new Date(v.admissionDate), "dd MMM yyyy")}
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-5">
                  {/* Chief complaint */}
                  {v?.chiefComplaint && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                        Chief Complaint
                      </p>
                      <p className="text-sm text-gray-700">
                        {v.chiefComplaint}
                      </p>
                    </div>
                  )}

                  {/* Latest vitals */}
                  {latestVitals && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                        Latest Vitals
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          {
                            icon: Heart,
                            label: "Heart Rate",
                            value: latestVitals.heartRate,
                            unit: "bpm",
                          },
                          {
                            icon: Thermometer,
                            label: "Temperature",
                            value: latestVitals.temperature,
                            unit: "°C",
                          },
                          {
                            icon: Wind,
                            label: "Respiratory",
                            value: latestVitals.respiratoryRate,
                            unit: "/min",
                          },
                          {
                            icon: Gauge,
                            label: "Blood Pressure",
                            value: latestVitals.bloodPressureSystolic
                              ? `${latestVitals.bloodPressureSystolic}/${latestVitals.bloodPressureDiastolic}`
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
                      {latestVitals.oxygenSaturation && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-gray-400">SpO₂:</span>
                          <span
                            className={`text-sm font-bold ${latestVitals.oxygenSaturation < 95 ? "text-red-600" : "text-green-600"}`}
                          >
                            {latestVitals.oxygenSaturation}%
                          </span>
                        </div>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        Recorded{" "}
                        {latestVitals.recordedAt
                          ? formatDistanceToNow(
                              new Date(latestVitals.recordedAt),
                              { addSuffix: true },
                            )
                          : "—"}
                      </p>
                    </div>
                  )}

                  {/* Nursing assessment */}
                  {na && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                        Nursing Assessment
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                        {[
                          {
                            label: "Pain Scale",
                            value:
                              na.painScale !== undefined
                                ? `${na.painScale}/10`
                                : null,
                          },
                          {
                            label: "Consciousness",
                            value: na.consciousnessLevel,
                          },
                          { label: "Skin Condition", value: na.skinCondition },
                          { label: "Mobility", value: na.mobilityStatus },
                        ]
                          .filter((f) => f.value)
                          .map((f) => (
                            <div
                              key={f.label}
                              className="flex justify-between bg-gray-50 rounded-lg px-3 py-2 border border-gray-100"
                            >
                              <span className="text-xs text-gray-500 font-semibold">
                                {f.label}
                              </span>
                              <span className="text-xs text-gray-800 font-bold capitalize">
                                {f.value}
                              </span>
                            </div>
                          ))}
                      </div>
                      {na.notes && (
                        <p className="text-xs text-gray-500 italic mt-2 bg-gray-50 rounded-lg p-3">
                          {na.notes}
                        </p>
                      )}
                    </div>
                  )}

                  {!latestVitals && !na && (
                    <p className="text-sm text-gray-400 italic">
                      No triage data recorded for this visit.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main patients list ────────────────────────────────────────────────────────
export default function NursePatientsPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const PER_PAGE = 20;

  const load = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      try {
        const res = await patientApi.searchPaginated({
          q: search,
          limit: PER_PAGE,
          offset: (page - 1) * PER_PAGE,
        });
        setPatients(res.data.data?.patients ?? []);
        setTotal(res.data.data?.total ?? 0);
      } catch {
        setPatients([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [search, page],
  );

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    setPage(1);
  }, [search]);

  const totalPages = Math.ceil(total / PER_PAGE);

  if (selectedId)
    return (
      <PatientDetailPanel
        patientId={selectedId}
        onClose={() => setSelectedId(null)}
      />
    );

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif" }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl font-bold text-gray-900"
            style={{ fontFamily: "'Playfair Display',serif" }}
          >
            All Patients
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Search and view patient triage history
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40"
        >
          <RefreshCw
            className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setSearch(inputVal.trim())}
              placeholder="Search by name or patient ID…"
              className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/10 focus:bg-white transition-all"
            />
            {inputVal && (
              <button
                onClick={() => {
                  setInputVal("");
                  setSearch("");
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => setSearch(inputVal.trim())}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-md"
            style={{ background: "linear-gradient(135deg,#166534,#15803d)" }}
          >
            Search
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100">
                {["Patient", "Age", "Gender", "Blood Type", ""].map((h, i) => (
                  <th
                    key={i}
                    className={`py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide ${i === 0 ? "pl-5 pr-3" : i === 4 ? "pl-3 pr-5" : "px-3"}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
              ) : patients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-gray-400">
                      {search
                        ? "No patients found"
                        : "Search for a patient above"}
                    </p>
                  </td>
                </tr>
              ) : (
                patients.map((p) => {
                  const age = calcAge(p.dateOfBirth);
                  return (
                    <tr
                      key={p.id}
                      onClick={() => setSelectedId(p.id)}
                      className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 pl-5 pr-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                            style={{
                              background:
                                p.gender === "female"
                                  ? "linear-gradient(135deg,#ec4899,#db2777)"
                                  : "linear-gradient(135deg,#166534,#15803d)",
                            }}
                          >
                            {p.firstName?.[0]}
                            {p.lastName?.[0]}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">
                              {p.firstName} {p.lastName}
                            </p>
                            <p className="text-xs text-gray-400 font-mono">
                              {p.id?.slice(0, 8)}…
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-sm text-gray-600">
                        {age !== null ? `${age} yrs` : "—"}
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize bg-gray-100 text-gray-600">
                          {p.gender ?? "—"}
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        {p.bloodType && p.bloodType !== "unknown" ? (
                          <span
                            className="text-xs font-bold px-2.5 py-1 rounded-full text-white"
                            style={{
                              background: BLOOD_COLOR[p.bloodType] ?? "#6b7280",
                            }}
                          >
                            {p.bloodType}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5 pl-3 pr-5">
                        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors ml-auto" />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              Page {page} of {totalPages} · {total} total
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 disabled:opacity-40 hover:bg-gray-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 disabled:opacity-40 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
