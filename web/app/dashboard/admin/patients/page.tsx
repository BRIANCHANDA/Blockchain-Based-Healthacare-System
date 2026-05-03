"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { patientApi } from "@/lib/api";
import { Search, X, Users, ChevronRight, RefreshCw } from "lucide-react";

const GENDER_COLOR: Record<string, { bg: string; color: string }> = {
  male: { bg: "#eff6ff", color: "#2563eb" },
  female: { bg: "#fdf2f8", color: "#db2777" },
  other: { bg: "#f5f3ff", color: "#7c3aed" },
};

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

export default function AdminPatientsPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [inputVal, setInputVal] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
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

  const handleSearch = () => setSearch(inputVal.trim());
  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl font-bold text-gray-900"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Patients
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {total} registered patient{total !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => load(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <RefreshCw
            className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
          />{" "}
          Refresh
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
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search by name, national ID…"
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
            onClick={handleSearch}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-md"
            style={{ background: "linear-gradient(135deg, #166534, #15803d)" }}
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
                {["Patient", "Gender", "Blood Type", "Status", ""].map(
                  (h, i) => (
                    <th
                      key={i}
                      className={`py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide ${i === 0 ? "pl-5 pr-3" : i === 4 ? "pl-3 pr-5" : "px-3"}`}
                    >
                      {h}
                    </th>
                  ),
                )}
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
                      No patients found
                    </p>
                  </td>
                </tr>
              ) : (
                patients.map((p, i) => {
                  const gc = GENDER_COLOR[p.gender] ?? {
                    bg: "#f3f4f6",
                    color: "#6b7280",
                  };
                  return (
                    <tr
                      key={p.id}
                      onClick={() =>
                        router.push(`/dashboard/admin/patients/${p.id}`)
                      }
                      className={`border-b border-gray-50 hover:bg-gray-50/60 transition-colors cursor-pointer group`}
                    >
                      <td className="py-3.5 pl-5 pr-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                            style={{
                              background:
                                "linear-gradient(135deg, #166534, #15803d)",
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
                      <td className="py-3.5 px-3">
                        <span
                          className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize"
                          style={{ background: gc.bg, color: gc.color }}
                        >
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
                      <td className="py-3.5 px-3">
                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full ${p.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}
                        >
                          {p.isActive ? "Active" : "Inactive"}
                        </span>
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

        {/* Pagination */}
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
