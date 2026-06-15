"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { patientApi } from "@/lib/api";
import {
  Search,
  X,
  Users,
  ChevronRight,
  RefreshCw,
  FlaskConical,
} from "lucide-react";

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

const AVATAR_COLORS = [
  "#166534",
  "#15803d",
  "#0f766e",
  "#0d9488",
  "#1d4ed8",
  "#7c3aed",
  "#b45309",
  "#be185d",
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function calcAge(dob?: string) {
  if (!dob) return "—";
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25)) + " yrs";
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

const PER_PAGE = 25;

export default function LabPatientsPage() {
  const router = useRouter();

  // ── State ──────────────────────────────────────────────
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Load ───────────────────────────────────────────────
  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError("");
      try {
        const res = await patientApi.searchPaginated({
          q: search.trim() || undefined,
          limit: PER_PAGE,
          offset: (page - 1) * PER_PAGE,
        });
        setPatients(res.data.data?.patients ?? []);
        setTotal(res.data.data?.total ?? 0);
      } catch (err: any) {
        setError(
          err.response?.data?.error?.message ||
            "Failed to load patients. Please try again.",
        );
        setPatients([]);
        setTotal(0);
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

  // Reset to page 1 when search changes
  useEffect(() => {
    setPage(1);
  }, [search]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load(true);
  };

  const handleSearch = () => {
    setSearch(inputVal.trim());
  };

  const handleClear = () => {
    setInputVal("");
    setSearch("");
    inputRef.current?.focus();
  };

  const totalPages = Math.ceil(total / PER_PAGE);

  // ── Render ─────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* ── Page header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl font-bold text-gray-900"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Patient Records
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {loading
              ? "Loading patients…"
              : total > 0
                ? `${total} patient${total !== 1 ? "s" : ""} found`
                : "Search or browse all patients"}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      {/* ── Search bar ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={inputRef}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search by name, National ID, or patient ID…"
              className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/10 focus:bg-white transition-all"
            />
            {inputVal && (
              <button
                onClick={handleClear}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={handleSearch}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-md active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg,#166534,#15803d)" }}
          >
            Search
          </button>
        </div>

        {/* Active search indicator */}
        {search && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">Showing results for</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 border border-green-100 text-xs font-semibold text-green-700">
              {search}
              <button
                onClick={handleClear}
                className="hover:text-green-900 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          </div>
        )}
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="flex items-center gap-2.5 p-3.5 mb-4 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
          <FlaskConical className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                {[
                  { label: "Patient", width: "w-64" },
                  { label: "National ID", width: "w-36" },
                  { label: "Age", width: "w-20" },
                  { label: "Gender", width: "w-24" },
                  { label: "Blood Type", width: "w-24" },
                  { label: "", width: "w-10" },
                ].map(({ label, width }, i) => (
                  <th
                    key={i}
                    className={`py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide ${width} ${
                      i === 0 ? "pl-5 pr-3" : i === 5 ? "pl-3 pr-5" : "px-3"
                    }`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
              ) : patients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                      <Users className="w-7 h-7 text-gray-400" />
                    </div>
                    <p className="text-sm font-semibold text-gray-500 mb-1">
                      {search
                        ? "No patients match your search"
                        : "No patients found"}
                    </p>
                    <p className="text-xs text-gray-400">
                      {search
                        ? "Try a different name, National ID, or patient ID"
                        : "Patients will appear here once registered"}
                    </p>
                    {search && (
                      <button
                        onClick={handleClear}
                        className="mt-4 px-4 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        Clear search
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                patients.map((p) => {
                  const initials = `${p.firstName?.[0] ?? ""}${p.lastName?.[0] ?? ""}`;
                  const avatarColor = getAvatarColor(p.firstName + p.lastName);
                  return (
                    <tr
                      key={p.id}
                      onClick={() =>
                        router.push(`/dashboard/laboratory/patients/${p.id}`)
                      }
                      className="border-b border-gray-50 hover:bg-green-50/30 transition-colors cursor-pointer group"
                    >
                      {/* Patient name + ID */}
                      <td className="py-3.5 pl-5 pr-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                            style={{ backgroundColor: avatarColor }}
                          >
                            {initials}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">
                              {p.firstName} {p.lastName}
                            </p>
                            <p className="text-xs text-gray-400 font-mono mt-0.5">
                              {p.id?.slice(0, 8)}…
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* National ID */}
                      <td className="py-3.5 px-3">
                        <span className="text-xs font-mono text-gray-600 bg-gray-100 px-2 py-1 rounded-lg">
                          {p.nationalId ?? "—"}
                        </span>
                      </td>

                      {/* Age */}
                      <td className="py-3.5 px-3 text-sm text-gray-600">
                        {calcAge(p.dateOfBirth)}
                      </td>

                      {/* Gender */}
                      <td className="py-3.5 px-3">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize bg-gray-100 text-gray-600">
                          {p.gender ?? "—"}
                        </span>
                      </td>

                      {/* Blood type */}
                      <td className="py-3.5 px-3">
                        {p.bloodType && p.bloodType !== "unknown" ? (
                          <span
                            className="text-xs font-bold px-2.5 py-1 rounded-full text-white"
                            style={{
                              backgroundColor:
                                BLOOD_COLOR[p.bloodType] ?? "#6b7280",
                            }}
                          >
                            {p.bloodType}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>

                      {/* Arrow */}
                      <td className="py-3.5 pl-3 pr-5">
                        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-green-600 transition-colors ml-auto" />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100 bg-gray-50/30">
            <p className="text-xs text-gray-400">
              Showing{" "}
              <span className="font-semibold text-gray-600">
                {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)}
              </span>{" "}
              of <span className="font-semibold text-gray-600">{total}</span>{" "}
              patients
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                Previous
              </button>
              {/* Page number pills */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum =
                  totalPages <= 5
                    ? i + 1
                    : page <= 3
                      ? i + 1
                      : page >= totalPages - 2
                        ? totalPages - 4 + i
                        : page - 2 + i;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-8 h-7 rounded-lg text-xs font-medium transition-colors ${
                      pageNum === page
                        ? "bg-green-700 text-white border border-green-700"
                        : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 disabled:opacity-40 hover:bg-gray-50 transition-colors"
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
