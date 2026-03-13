"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  Search,
  Users,
  UserPlus,
  ChevronRight,
  Loader2,
  AlertCircle,
  RefreshCw,
  Calendar,
  Activity,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Patient {
  id: string;
  blockchainAddress: string;
  firstName: string;
  lastName: string;
  gender: string;
  createdAt: string;
}

// ── Skeleton row ──────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr className="border-b border-gray-50">
      <td className="py-3.5 pl-5 pr-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-100 animate-pulse flex-shrink-0" />
          <div>
            <div className="h-4 w-32 bg-gray-100 rounded animate-pulse mb-1" />
            <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
          </div>
        </div>
      </td>
      <td className="py-3.5 px-3 hidden sm:table-cell">
        <div className="h-4 w-16 bg-gray-100 rounded animate-pulse" />
      </td>
      <td className="py-3.5 px-3 hidden md:table-cell">
        <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
      </td>
      <td className="py-3.5 pl-3 pr-5">
        <div className="h-4 w-8 bg-gray-100 rounded animate-pulse ml-auto" />
      </td>
    </tr>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AllPatientsPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const LIMIT = 20;

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setOffset(0);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  const fetchPatients = useCallback(
    async (reset = true) => {
      if (reset) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const currentOffset = reset ? 0 : offset;
        const params = new URLSearchParams({
          limit: String(LIMIT),
          offset: String(currentOffset),
        });
        if (debouncedSearch) params.set("q", debouncedSearch);
        const res = await api.get(`/api/patients/search?${params}`);
        const { patients: newPatients } = res.data.data;
        setPatients((prev) =>
          reset ? newPatients : [...prev, ...newPatients],
        );
        setHasMore(newPatients.length === LIMIT);
        if (!reset) setOffset(currentOffset + LIMIT);
      } catch (err: any) {
        setError(
          err.response?.data?.error?.message ?? "Failed to load patients.",
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [debouncedSearch, offset],
  );

  useEffect(() => {
    fetchPatients(true);
  }, [debouncedSearch]);

  const genderColors: Record<string, string> = {
    male: "#3b82f6",
    female: "#ec4899",
    other: "#8b5cf6",
  };

  const getInitials = (first: string, last: string) =>
    `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase();

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-ZM", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">All Patients</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Search and manage registered patients
          </p>
        </div>
        <button
          onClick={() => router.push("/dashboard/receptionist/register")}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold shadow-sm hover:shadow-md transition-all"
          style={{ background: "linear-gradient(135deg, #166534, #15803d)" }}
        >
          <UserPlus className="w-4 h-4" />
          Register Patient
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Search bar */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, national ID, or patient ID…"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-50 border border-gray-100 text-sm text-gray-700 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-400/10 placeholder:text-gray-400"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-medium"
              >
                Clear
              </button>
            )}
          </div>
          <button
            onClick={() => fetchPatients(true)}
            className="p-2.5 rounded-xl border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Note about search limitations */}
        {search && !search.match(/^[0-9a-f-]{36}$/i) && (
          <div className="px-5 py-2.5 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            <p className="text-xs text-amber-700">
              Patient names are encrypted for privacy. Search by exact patient
              UUID to find a specific patient.
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-5 py-4 flex items-center gap-2.5 bg-red-50 border-b border-red-100">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700 flex-1">{error}</p>
            <button
              onClick={() => fetchPatients(true)}
              className="text-xs font-semibold text-red-700 underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100">
                {["Patient", "Gender", "Registered", ""].map((h, i) => (
                  <th
                    key={i}
                    className={`py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide
                    ${i === 0 ? "pl-5 pr-3" : i === 3 ? "pl-3 pr-5" : "px-3"}
                    ${i === 1 ? "hidden sm:table-cell" : i === 2 ? "hidden md:table-cell" : ""}`}
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
                  <td colSpan={4} className="py-16 text-center">
                    <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-gray-500">
                      No patients found
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Register a new patient to get started
                    </p>
                    <button
                      onClick={() =>
                        router.push("/dashboard/receptionist/register")
                      }
                      className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold text-white inline-flex items-center gap-2"
                      style={{ background: "#166534" }}
                    >
                      <UserPlus className="w-4 h-4" /> Register Patient
                    </button>
                  </td>
                </tr>
              ) : (
                patients.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() =>
                      router.push(`/dashboard/receptionist/patients/${p.id}`)
                    }
                    className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 pl-5 pr-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                          style={{
                            background: genderColors[p.gender] ?? "#6b7280",
                          }}
                        >
                          {getInitials(p.firstName, p.lastName)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">
                            {p.firstName} {p.lastName}
                          </p>
                          <p className="text-xs text-gray-400 font-mono">
                            {p.id.slice(0, 8)}…
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 hidden sm:table-cell">
                      <span className="text-sm text-gray-600 capitalize">
                        {p.gender}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 hidden md:table-cell">
                      <div className="flex items-center gap-1.5 text-sm text-gray-500">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        {formatDate(p.createdAt)}
                      </div>
                    </td>
                    <td className="py-3.5 pl-3 pr-5 text-right">
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors ml-auto" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Load more */}
        {!loading && hasMore && patients.length > 0 && (
          <div className="px-5 py-4 border-t border-gray-100 flex justify-center">
            <button
              onClick={() => fetchPatients(false)}
              disabled={loadingMore}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold border border-gray-200 hover:bg-gray-50 transition-colors text-gray-700 disabled:opacity-50"
            >
              {loadingMore ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading…
                </>
              ) : (
                "Load more"
              )}
            </button>
          </div>
        )}

        {!loading && patients.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50">
            <p className="text-xs text-gray-400 text-center">
              Showing {patients.length} patient
              {patients.length !== 1 ? "s" : ""}
              {!hasMore ? " · All loaded" : ""}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
