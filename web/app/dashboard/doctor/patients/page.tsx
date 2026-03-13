"use client";
import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { patientApi, visitApi } from "@/lib/api";
import {
  Search,
  User,
  ChevronRight,
  AlertCircle,
  Calendar,
  Droplets,
  Phone,
  Activity,
} from "lucide-react";

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

const PRIORITY_STYLE: Record<string, { bg: string; text: string }> = {
  routine: { bg: "#f0fdf4", text: "#15803d" },
  urgent: { bg: "#fffbeb", text: "#d97706" },
  emergency: { bg: "#fef2f2", text: "#dc2626" },
  critical: { bg: "#fdf4ff", text: "#7c3aed" },
};

export default function PatientSearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [patients, setPatients] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [loadingVisits, setLoadingVisits] = useState(false);
  const [visits, setVisits] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError("");
    setPatients([]);
    setSelected(null);
    setVisits([]);
    try {
      const res = await patientApi.search(q);
      const list = res.data.data?.patients ?? [];
      if (list.length === 0) {
        setError(`No patients found matching "${q}".`);
      } else {
        setPatients(list);
        // If only one result, auto-select
        if (list.length === 1) handleSelectPatient(list[0]);
      }
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ??
          "Search failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleSelectPatient = useCallback(async (patient: any) => {
    setSelected(patient);
    setLoadingVisits(true);
    setVisits([]);
    try {
      // Try a likely visitApi method first, otherwise fall back to a direct fetch.
      let visitsList: any[] = [];

      if ((visitApi as any).getByPatientId) {
        const res = await (visitApi as any).getByPatientId(patient.id);
        visitsList = res.data?.data?.visits ?? res.data?.visits ?? [];
      } else {
        const res = await fetch(
          `/api/visits?patientId=${encodeURIComponent(patient.id)}`,
        );
        const json = await res.json();
        visitsList = json.data?.visits ?? json?.visits ?? [];
      }

      setVisits(visitsList);
    } catch (err) {
      // Log error for debugging; keep UI stable
      console.error(err);
    } finally {
      setLoadingVisits(false);
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const activeVisit = visits.find((v) => v.status === "in-progress");

  return (
    <div
      className="max-w-4xl mx-auto"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Header */}
      <div className="mb-6">
        <h1
          className="text-2xl font-bold text-gray-900"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Patient Search
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Search by patient name or National ID (NRC number)
        </p>
      </div>

      {/* Search box */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
        <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
          Patient Name or National ID
        </label>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Musonda or 123456/78/1"
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-sm outline-none transition-all focus:border-green-600 focus:ring-2 focus:ring-green-600/10 focus:bg-white placeholder:text-gray-400"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-md disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #166534, #15803d)" }}
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Search
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 mt-3 p-3 rounded-xl bg-red-50 border border-red-100">
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>

      {/* Multiple results list */}
      {patients.length > 1 && !selected && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-5">
          <div className="px-5 py-3.5 border-b border-gray-100">
            <p className="text-sm font-bold text-gray-900">
              {patients.length} results found
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              Select a patient to view their records
            </p>
          </div>
          <div className="divide-y divide-gray-50">
            {patients.map((p) => (
              <button
                key={p.id}
                onClick={() => handleSelectPatient(p)}
                className="w-full px-5 py-3.5 flex items-center gap-4 hover:bg-gray-50 transition-colors text-left group"
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                  style={{ background: "#166534" }}
                >
                  {p.firstName?.[0]}
                  {p.lastName?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    {p.firstName} {p.lastName}
                  </p>
                  <p className="text-xs text-gray-400">
                    {p.gender} · {p.dateOfBirth}
                  </p>
                </div>
                {p.bloodType && p.bloodType !== "unknown" && (
                  <span
                    className="text-xs font-bold px-2 py-1 rounded-full text-white flex-shrink-0"
                    style={{
                      background: bloodTypeColor[p.bloodType] ?? "#6b7280",
                    }}
                  >
                    {p.bloodType}
                  </span>
                )}
                <ChevronRight
                  size={16}
                  className="text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected patient detail */}
      {selected && (
        <div className="space-y-4">
          {/* Patient card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Patient header */}
            <div
              className="px-6 py-5 border-b border-gray-100"
              style={{
                background: "linear-gradient(135deg, #f0fdf4, #dcfce7)",
              }}
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold text-white flex-shrink-0"
                  style={{ background: "#166534" }}
                >
                  {selected.firstName?.[0]}
                  {selected.lastName?.[0]}
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-gray-900">
                    {selected.firstName} {selected.lastName}
                  </h2>
                  <p className="text-sm text-gray-500 capitalize">
                    {selected.gender} · {selected.dateOfBirth}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {selected.bloodType && selected.bloodType !== "unknown" && (
                    <span
                      className="text-sm font-bold px-3 py-1.5 rounded-full text-white"
                      style={{
                        background:
                          bloodTypeColor[selected.bloodType] ?? "#6b7280",
                      }}
                    >
                      {selected.bloodType}
                    </span>
                  )}
                  {patients.length > 1 && (
                    <button
                      onClick={() => {
                        setSelected(null);
                        setVisits([]);
                      }}
                      className="text-xs font-medium text-green-700 hover:underline"
                    >
                      ← Back to results
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Patient info grid */}
            <div className="px-6 py-4 grid grid-cols-2 gap-x-8 gap-y-3 text-sm border-b border-gray-100">
              {[
                { icon: Phone, label: "Phone", value: selected.phoneNumber },
                { icon: User, label: "NRC", value: selected.nationalId },
                { icon: Calendar, label: "DOB", value: selected.dateOfBirth },
                {
                  icon: Activity,
                  label: "Status",
                  value: activeVisit ? "Currently admitted" : "Not admitted",
                },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-2.5">
                  <Icon size={14} className="text-gray-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">
                      {label}
                    </p>
                    <p
                      className="text-gray-800 font-medium text-sm"
                      style={
                        label === "Status" && activeVisit
                          ? { color: "#dc2626", fontWeight: 700 }
                          : {}
                      }
                    >
                      {value ?? "—"}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Allergies */}
            {selected.allergies?.length > 0 && (
              <div className="px-6 py-3 bg-red-50 border-b border-red-100 flex items-start gap-2">
                <AlertCircle
                  size={14}
                  className="text-red-500 mt-0.5 flex-shrink-0"
                />
                <div>
                  <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-0.5">
                    Known Allergies
                  </p>
                  <p className="text-sm text-red-700">
                    {selected.allergies
                      .map((a: any) => `${a.allergen} (${a.severity})`)
                      .join(", ")}
                  </p>
                </div>
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
          </div>

          {/* Visit history */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100">
              <p className="text-sm font-bold text-gray-900">Visit History</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {visits.length} total visit{visits.length !== 1 ? "s" : ""}
              </p>
            </div>

            {loadingVisits ? (
              <div className="py-8 text-center">
                <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : visits.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-sm">
                No visits found
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {visits.map((v) => {
                  const ps =
                    PRIORITY_STYLE[v.priority] ?? PRIORITY_STYLE.routine;
                  const isActive = v.status === "in-progress";
                  return (
                    <button
                      key={v.id}
                      onClick={() =>
                        router.push(`/dashboard/doctor/visits/${v.id}`)
                      }
                      className="w-full px-5 py-3.5 flex items-center gap-4 hover:bg-gray-50 transition-colors text-left group"
                    >
                      {isActive && (
                        <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 animate-pulse" />
                      )}
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
                              style={{
                                background: "#fef2f2",
                                color: "#dc2626",
                              }}
                            >
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {v.chiefComplaint}
                        </p>
                        <p className="text-xs text-gray-400">
                          {v.admissionDate?.split("T")[0]} ·{" "}
                          {v.institution?.institutionName ?? "—"}
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
      )}
    </div>
  );
}
