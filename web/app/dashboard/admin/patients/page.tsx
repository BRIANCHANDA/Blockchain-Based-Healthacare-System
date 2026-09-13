"use client";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { patientApi, api } from "@/lib/api";
import {
  Search, X, Users, ChevronRight, RefreshCw, Filter, SlidersHorizontal,
} from "lucide-react";
import { MinorBadge, ageFromDob } from "@/components/ui/MinorBadge";
import { format } from "date-fns";

const GENDER: Record<string, { bg: string; color: string; dot: string }> = {
  male:   { bg: "var(--info-tint)", color: "var(--blue-600)", dot: "var(--blue-500)" },
  female: { bg: "var(--coral-050)", color: "var(--critical-ink)", dot: "var(--coral-500)" },
  other:  { bg: "var(--violet-050)", color: "var(--accent-ink)", dot: "var(--violet-500)" },
};
const BLOOD: Record<string, string> = {
  "A+": "var(--blue-500)", "A-": "var(--blue-600)", "B+": "var(--violet-500)", "B-": "var(--coral-500)",
  "AB+": "var(--amber-500)", "AB-": "var(--coral-500)", "O+": "var(--green-600)", "O-": "var(--green-600)",
};
const AVATAR_BG: Record<string, string> = {
  male: "var(--blue-600)",
  female: "var(--coral-600)",
  other: "var(--accent-ink)",
};

function SkeletonRow() {
  return (
    <tr className="border-b border-[var(--border-faint)]">
      {[70, 55, 40, 50, 45, 24].map((w, i) => (
        <td key={i} className="py-4 px-4">
          <div className="h-3.5 bg-[var(--surface-sunken)] rounded-full animate-pulse" style={{ width: `${w}%` }} />
        </td>
      ))}
    </tr>
  );
}

export default function AdminPatientsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const isSuperAdmin   = !(user as any)?.institutionId;
  const institutionId  = (user as any)?.institutionId ?? null;

  const [patients,          setPatients]         = useState<any[]>([]);
  const [loading,           setLoading]          = useState(true);
  const [refreshing,        setRefreshing]       = useState(false);
  const [search,            setSearch]           = useState("");
  const [inputVal,          setInputVal]         = useState("");
  const [institutionFilter, setInstitutionFilter]= useState("");
  const [institutions,      setInstitutions]     = useState<{ id: string; institutionName: string }[]>([]);
  const [total,             setTotal]            = useState(0);
  const [page,              setPage]             = useState(1);
  const [genderFilter,      setGenderFilter]     = useState("");
  const PER_PAGE = 20;

  useEffect(() => {
    if (!isSuperAdmin) return;
    api.get("/api/institutions").then((res) => {
      setInstitutions(res.data.data?.institutions ?? []);
    }).catch(() => {});
  }, [isSuperAdmin]);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      let res;
      const params = { search, limit: PER_PAGE, offset: (page - 1) * PER_PAGE };
      if (isSuperAdmin) {
        res = institutionFilter
          ? await patientApi.getAllByInstitution(institutionFilter, params)
          : await patientApi.searchPaginated({ q: search, limit: PER_PAGE, offset: (page - 1) * PER_PAGE });
      } else {
        res = await patientApi.getAllByInstitution(institutionId, params);
      }
      setPatients(res.data.data?.patients ?? []);
      setTotal(res.data.data?.total ?? 0);
    } catch {
      setPatients([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, page, isSuperAdmin, institutionId, institutionFilter]);

  useLiveRefresh(() => load(true));

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, institutionFilter, genderFilter]);

  const handleSearch = () => setSearch(inputVal.trim());
  const totalPages   = Math.ceil(total / PER_PAGE);
  const startIdx     = (page - 1) * PER_PAGE + 1;
  const endIdx       = Math.min(page * PER_PAGE, total);

  // Client-side gender filter (applied on top of server results)
  const displayed = genderFilter
    ? patients.filter((p) => p.gender === genderFilter)
    : patients;

  const hasFilters = search || institutionFilter || genderFilter;

  return (
    <div>

      {/* ── Page header ── */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 style={{ margin: 0, font: "700 27px/1.1 var(--font-sans)", letterSpacing: "var(--ls-tight)", color: "var(--text-primary)" }}>
            Patients
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {total > 0
              ? `${total.toLocaleString()} ${isSuperAdmin ? "registered" : "institution"} patient${total !== 1 ? "s" : ""}`
              : "Loading patients…"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasFilters && (
            <button
              onClick={() => { setInputVal(""); setSearch(""); setInstitutionFilter(""); setGenderFilter(""); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-[var(--r-sm)] text-xs font-semibold transition-colors"
              style={{ background: "var(--coral-050)", color: "var(--critical-ink)", border: "1px solid var(--coral-100)" }}
            >
              <X className="w-3 h-3" /> Clear filters
            </button>
          )}
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-[var(--r-sm)] border border-[var(--hc-border)] bg-[var(--surface-card)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Filters bar ── */}
      <div className="bg-[var(--surface-card)] rounded-[var(--r-lg)] border border-[var(--border-faint)] shadow-[var(--elev-1)] p-4 mb-4">
        <div className="flex gap-3 flex-wrap items-center">
          {/* Search input */}
          <div className="flex-1 relative" style={{ minWidth: 220 }}>
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search by name or national ID…"
              className="w-full pl-10 pr-10 py-2.5 rounded-[var(--r-sm)] border border-[var(--hc-border)] bg-[var(--surface-sunken)] text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)] focus:bg-[var(--surface-card)] transition-all placeholder:text-[var(--text-muted)]"
            />
            {inputVal && (
              <button
                onClick={() => { setInputVal(""); setSearch(""); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Gender filter pills */}
          <div className="flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            {[
              { value: "",       label: "All" },
              { value: "male",   label: "Male"   },
              { value: "female", label: "Female" },
              { value: "other",  label: "Other"  },
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setGenderFilter(value)}
                className="px-3 py-1.5 rounded-[var(--r-xs)] text-xs font-semibold transition-all"
                style={
                  genderFilter === value
                    ? { background: "var(--green-800)", color: "var(--white)" }
                    : { background: "var(--surface-sunken)", color: "var(--text-secondary)" }
                }
              >
                {label}
              </button>
            ))}
          </div>

          {/* Institution select — SuperAdmin only */}
          {isSuperAdmin && (
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)] pointer-events-none" />
              <select
                value={institutionFilter}
                onChange={(e) => setInstitutionFilter(e.target.value)}
                className="pl-8 pr-4 py-2.5 rounded-[var(--r-sm)] border border-[var(--hc-border)] bg-[var(--surface-sunken)] text-sm text-[var(--text-secondary)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)] transition-all cursor-pointer appearance-none"
                style={{ minWidth: 170 }}
              >
                <option value="">All Hospitals</option>
                {institutions.map((inst) => (
                  <option key={inst.id} value={inst.id}>{inst.institutionName}</option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={handleSearch}
            className="px-5 py-2.5 rounded-[var(--r-sm)] text-sm font-semibold text-[var(--white)] transition-all hover:shadow-[var(--elev-2)]"
            style={{ background: "var(--brand)" }}
          >
            Search
          </button>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-[var(--surface-card)] rounded-[var(--r-lg)] border border-[var(--border-faint)] shadow-[var(--elev-1)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--surface-sunken)" }}>
                {["Patient", "Gender", "Age / DOB", "Blood Type", ...(isSuperAdmin ? ["Hospital"] : []), "Status", ""].map((h, i, arr) => (
                  <th
                    key={i}
                    className="py-3 text-[10.5px] font-bold text-[var(--text-muted)] uppercase tracking-wider"
                    style={{
                      paddingLeft: i === 0 ? 20 : 12,
                      paddingRight: i === arr.length - 1 ? 20 : 12,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
              ) : displayed.length === 0 ? (
                <tr>
                  <td colSpan={isSuperAdmin ? 7 : 6} className="py-20 text-center">
                    <div
                      className="w-14 h-14 rounded-[var(--r-lg)] flex items-center justify-center mx-auto mb-3"
                      style={{ background: "var(--brand-tint)" }}
                    >
                      <Users className="w-7 h-7 text-[var(--green-300)]" />
                    </div>
                    <p className="text-sm font-semibold text-[var(--text-secondary)]">No patients found</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      {hasFilters ? "Try adjusting your search or filters" : "Patients will appear here once registered"}
                    </p>
                    {hasFilters && (
                      <button
                        onClick={() => { setInputVal(""); setSearch(""); setInstitutionFilter(""); setGenderFilter(""); }}
                        className="mt-3 text-xs font-semibold text-[var(--green-700)] hover:underline"
                      >
                        Clear all filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                displayed.map((p) => {
                  const gc  = GENDER[p.gender] ?? { bg: "var(--surface-sunken)", color: "var(--text-secondary)", dot: "var(--text-muted)" };
                  const age = p.dateOfBirth ? ageFromDob(p.dateOfBirth) : null;
                  const dob = p.dateOfBirth ? (() => { try { return format(new Date(p.dateOfBirth), "dd MMM yyyy"); } catch { return p.dateOfBirth; } })() : null;
                  return (
                    <tr
                      key={p.id}
                      onClick={() => router.push(`/dashboard/admin/patients/${p.id}`)}
                      className="border-b border-[var(--border-faint)] hover:bg-[var(--surface-sunken)] transition-colors cursor-pointer group"
                    >
                      {/* Patient */}
                      <td className="py-3.5 pl-5 pr-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-[var(--r-sm)] flex items-center justify-center text-xs font-bold text-[var(--white)] flex-shrink-0"
                            style={{ background: AVATAR_BG[p.gender] ?? "var(--brand)" }}
                          >
                            {p.firstName?.[0]}{p.lastName?.[0]}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-1.5 leading-snug">
                              {p.firstName} {p.lastName}
                              {p.isMinor && <MinorBadge />}
                            </p>
                            <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5">
                              {p.temporaryPatientId ?? (p.id?.slice(0, 8) + "…")}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Gender */}
                      <td className="py-3.5 px-3">
                        <span
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full capitalize"
                          style={{ background: gc.bg, color: gc.color }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: gc.dot }} />
                          {p.gender ?? "—"}
                        </span>
                      </td>

                      {/* Age / DOB */}
                      <td className="py-3.5 px-3">
                        {age !== null ? (
                          <div>
                            <p className="text-sm font-semibold text-[var(--text-secondary)]">{age} yrs</p>
                            {dob && <p className="text-xs text-[var(--text-muted)] mt-0.5">{dob}</p>}
                          </div>
                        ) : (
                          <span className="text-xs text-[var(--text-muted)]">—</span>
                        )}
                      </td>

                      {/* Blood type */}
                      <td className="py-3.5 px-3">
                        {p.bloodType && p.bloodType !== "unknown" ? (
                          <span
                            className="text-xs font-bold px-2.5 py-1 rounded-full text-[var(--white)]"
                            style={{ background: BLOOD[p.bloodType] ?? "var(--text-secondary)" }}
                          >
                            {p.bloodType}
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--text-muted)]">—</span>
                        )}
                      </td>

                      {/* Hospital — SuperAdmin only */}
                      {isSuperAdmin && (
                        <td className="py-3.5 px-3">
                          <p className="text-xs font-medium text-[var(--text-secondary)] max-w-[150px] truncate">
                            {p.institutionName ?? "—"}
                          </p>
                        </td>
                      )}

                      {/* Status */}
                      <td className="py-3.5 px-3">
                        <span
                          className="text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={
                            p.isActive
                              ? { background: "var(--brand-tint)", color: "var(--green-800)", border: "1px solid var(--green-100)" }
                              : { background: "var(--surface-sunken)", color: "var(--text-muted)", border: "1px solid var(--hc-border)" }
                          }
                        >
                          {p.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>

                      {/* Arrow */}
                      <td className="py-3.5 pl-3 pr-5">
                        <ChevronRight className="w-4 h-4 text-[var(--text-disabled)] group-hover:text-[var(--text-secondary)] transition-colors ml-auto" />
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
          <div
            className="flex items-center justify-between px-5 py-3.5"
            style={{ borderTop: "1px solid var(--surface-sunken)" }}
          >
            <p className="text-xs text-[var(--text-muted)]">
              Showing <span className="font-semibold text-[var(--text-secondary)]">{startIdx}–{endIdx}</span> of{" "}
              <span className="font-semibold text-[var(--text-secondary)]">{total.toLocaleString()}</span> patients
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-[var(--r-xs)] border border-[var(--hc-border)] text-xs font-medium text-[var(--text-secondary)] disabled:opacity-40 hover:bg-[var(--surface-sunken)] transition-colors"
              >
                ← Prev
              </button>
              {/* Page number pills */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p: number;
                if (totalPages <= 5)       p = i + 1;
                else if (page <= 3)        p = i + 1;
                else if (page >= totalPages - 2) p = totalPages - 4 + i;
                else                       p = page - 2 + i;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className="w-7 h-7 rounded-[var(--r-xs)] text-xs font-semibold transition-all"
                    style={
                      page === p
                        ? { background: "var(--green-800)", color: "var(--white)" }
                        : { background: "var(--surface-sunken)", color: "var(--text-secondary)" }
                    }
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded-[var(--r-xs)] border border-[var(--hc-border)] text-xs font-medium text-[var(--text-secondary)] disabled:opacity-40 hover:bg-[var(--surface-sunken)] transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
