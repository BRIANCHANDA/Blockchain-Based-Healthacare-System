"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { patientApi } from "@/lib/api";
import {
  Search,
  X,
  Scan,
  Users,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import { format } from "date-fns";

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

const STATUS_COLORS: Record<
  string,
  { bg: string; color: string; label: string }
> = {
  ordered: { bg: "#fef3c7", color: "#d97706", label: "Ordered" },
  scheduled: { bg: "#eff6ff", color: "#2563eb", label: "Scheduled" },
  completed: { bg: "#f0fdf4", color: "#16a34a", label: "Completed" },
  reported: { bg: "#faf5ff", color: "#7c3aed", label: "Reported" },
  cancelled: { bg: "#f3f4f6", color: "#6b7280", label: "Cancelled" },
};

function calcAge(dob?: string) {
  if (!dob) return "—";
  return (
    Math.floor(
      (Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25),
    ) + " yrs"
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-50">
      {[1, 2, 3, 4, 5].map((i) => (
        <td key={i} className="py-4 px-4">
          <div
            className="h-4 bg-gray-100 rounded animate-pulse"
            style={{ width: i === 1 ? "70%" : "55%" }}
          />
        </td>
      ))}
    </tr>
  );
}

// ── Patient list ──────────────────────────────────────────────────────────────
function PatientsList() {
  const router = useRouter();
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const PER_PAGE = 20;

  const load = useCallback(async () => {
    if (!search.trim()) {
      setPatients([]);
      setTotal(0);
      return;
    }
    setLoading(true);
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
    }
  }, [search, page]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    setPage(1);
  }, [search]);

  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif" }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl font-bold text-gray-900"
            style={{ fontFamily: "'Playfair Display',serif" }}
          >
            Patient Records
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Search patients to view their imaging history
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setSearch(inputVal.trim())}
              placeholder="Search by patient name or ID…"
              className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-600/10 focus:bg-white transition-all"
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
            style={{ background: "linear-gradient(135deg,#4c1d95,#7c3aed)" }}
          >
            Search
          </button>
        </div>
      </div>

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
                Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
              ) : !search ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <Scan className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-gray-400">
                      Search for a patient to view imaging records
                    </p>
                  </td>
                </tr>
              ) : patients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-gray-400">
                      No patients found
                    </p>
                  </td>
                </tr>
              ) : (
                patients.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() =>
                      router.push(`/dashboard/radiology/patients/${p.id}`)
                    }
                    className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 pl-5 pr-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                          style={{
                            background:
                              "linear-gradient(135deg,#4c1d95,#7c3aed)",
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
                      {calcAge(p.dateOfBirth)}
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
                ))
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

export default PatientsList;
