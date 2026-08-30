"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import { useAuthStore } from "@/lib/store";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import {
  Search,
  X,
  UserPlus,
  RefreshCw,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  UserCog,
  Stethoscope,
  FlaskConical,
  Scan,
  Pill,
  Shield,
  Users,
} from "lucide-react";

const ROLE_OPTIONS = [
  { value: "", label: "All Roles" },
  { value: "practitioner", label: "Doctor" },
  { value: "nurse", label: "Nurse" },
  { value: "lab_technician", label: "Lab Tech" },
  { value: "radiologist", label: "Radiologist" },
  { value: "pharmacist", label: "Pharmacist" },
  { value: "receptionist", label: "Receptionist" },
  { value: "admin", label: "Admin" },
];

const ROLE_META: Record<
  string,
  { label: string; color: string; bg: string; icon: any }
> = {
  practitioner: {
    label: "Doctor",
    color: "var(--blue-600)",
    bg: "var(--info-tint)",
    icon: Stethoscope,
  },
  nurse: { label: "Nurse", color: "var(--info-ink)", bg: "var(--info-tint)", icon: Users },
  lab_technician: {
    label: "Lab Tech",
    color: "var(--urgent-ink)",
    bg: "var(--amber-050)",
    icon: FlaskConical,
  },
  radiologist: {
    label: "Radiologist",
    color: "var(--accent-ink)",
    bg: "var(--violet-050)",
    icon: Scan,
  },
  pharmacist: {
    label: "Pharmacist",
    color: "var(--green-800)",
    bg: "var(--brand-tint)",
    icon: Pill,
  },
  receptionist: {
    label: "Receptionist",
    color: "var(--info-ink)",
    bg: "var(--info-tint)",
    icon: UserCog,
  },
  admin: { label: "Admin", color: "var(--critical-ink)", bg: "var(--coral-050)", icon: Shield },
};

// ── Inner component (uses useSearchParams — must be inside Suspense) ───────────
function StaffPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initFilter = searchParams.get("filter") ?? "";
  const { user } = useAuthStore();
  const isSuperAdmin = !(user as any)?.institutionId;
  const myInstitutionId = (user as any)?.institutionId ?? null;

  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [verifiedFilter, setVerifiedFilter] = useState(
    initFilter === "unverified" ? "unverified" : "",
  );
  const [institutionFilter, setInstitutionFilter] = useState("");
  const [institutions, setInstitutions] = useState<{ id: string; institutionName: string }[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PER_PAGE = 15;

  // SuperAdmin: load all institutions for the filter dropdown
  useEffect(() => {
    if (!isSuperAdmin) return;
    api.get("/api/institutions").then((res) => {
      setInstitutions(res.data.data?.institutions ?? []);
    }).catch(() => {});
  }, [isSuperAdmin]);

  const load = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(PER_PAGE),
          ...(search ? { search } : {}),
          ...(roleFilter ? { role: roleFilter } : {}),
          ...(verifiedFilter
            ? { verified: verifiedFilter === "verified" ? "true" : "false" }
            : {}),
          // Hospital admins are locked to their own institution
          ...(!isSuperAdmin && myInstitutionId
            ? { institutionId: myInstitutionId }
            : {}),
          // SuperAdmin can filter by a selected institution
          ...(isSuperAdmin && institutionFilter
            ? { institutionId: institutionFilter }
            : {}),
        });
        const res = await api.get(`/api/practitioners?${params}`);
        setStaff(res.data.data?.practitioners ?? []);
        setTotal(res.data.data?.total ?? 0);
      } catch (_) {
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, search, roleFilter, verifiedFilter, institutionFilter],
  );

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, verifiedFilter, institutionFilter]);

  const handleVerify = async (staffId: string) => {
    try {
      await api.patch(`/api/practitioners/${staffId}/verify`);
      setStaff((prev) =>
        prev.map((s) => (s.id === staffId ? { ...s, isVerified: true } : s)),
      );
    } catch (_) {}
  };

  const totalPages = Math.ceil(total / PER_PAGE);
  const unverifiedCount = staff.filter((s) => !s.isVerified).length;

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 24,
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ margin: 0, font: "700 27px/1.1 var(--font-sans)", letterSpacing: "var(--ls-tight)", color: "var(--text-primary)" }}>
            Staff Management
          </h1>
          <p style={{ fontSize: 13.5, color: "var(--text-muted)" }}>
            Manage and verify all clinical staff across the system
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            style={{
              width: 36,
              height: 36,
              borderRadius: 9,
              border: "1px solid var(--hc-border)",
              background: "var(--white)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-secondary)",
            }}
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => router.push("/dashboard/admin/staff/new")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "9px 18px",
              borderRadius: 10,
              background: "var(--brand)",
              color: "var(--white)",
              fontSize: 13.5,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
            }}
          >
            <UserPlus size={15} /> Add Staff
          </button>
        </div>
      </div>

      {/* Unverified alert */}
      {!loading && unverifiedCount > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 16px",
            borderRadius: 12,
            background: "var(--coral-050)",
            border: "1px solid var(--coral-100)",
            marginBottom: 20,
          }}
        >
          <AlertTriangle
            size={16}
            style={{ color: "var(--critical-ink)", flexShrink: 0 }}
          />
          <p style={{ fontSize: 13.5, color: "var(--coral-600)", fontWeight: 500 }}>
            <strong>
              {unverifiedCount} staff member{unverifiedCount !== 1 ? "s" : ""}
            </strong>{" "}
            on this page pending verification.
          </p>
          <button
            onClick={() => setVerifiedFilter("unverified")}
            style={{
              marginLeft: "auto",
              fontSize: 12.5,
              fontWeight: 600,
              color: "var(--critical-ink)",
              background: "none",
              border: "none",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Show only unverified
          </button>
        </div>
      )}

      {/* Filters */}
      <div
        style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}
      >
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 220px", minWidth: 0 }}>
          <Search
            size={14}
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
            }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, license, specialization…"
            style={{
              width: "100%",
              padding: "9px 36px",
              borderRadius: 10,
              border: "1px solid var(--hc-border)",
              background: "var(--white)",
              fontSize: 13.5,
              color: "var(--text-primary)",
              outline: "none",
              boxSizing: "border-box",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--green-800)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--hc-border)")}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--text-muted)",
              }}
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Role filter */}
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          style={{
            padding: "9px 14px",
            borderRadius: 10,
            border: "1px solid var(--hc-border)",
            background: "var(--white)",
            fontSize: 13.5,
            color: "var(--text-secondary)",
            outline: "none",
            cursor: "pointer",
          }}
        >
          {ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {/* Hospital filter — SuperAdmin only */}
        {isSuperAdmin && (
          <select
            value={institutionFilter}
            onChange={(e) => setInstitutionFilter(e.target.value)}
            style={{
              padding: "9px 14px",
              borderRadius: 10,
              border: "1px solid var(--hc-border)",
              background: "var(--white)",
              fontSize: 13.5,
              color: "var(--text-secondary)",
              outline: "none",
              cursor: "pointer",
              minWidth: 160,
            }}
          >
            <option value="">All Hospitals</option>
            {institutions.map((inst) => (
              <option key={inst.id} value={inst.id}>
                {inst.institutionName}
              </option>
            ))}
          </select>
        )}

        {/* Verified filter pills */}
        <div
          style={{
            display: "flex",
            gap: 6,
            padding: 4,
            borderRadius: 10,
            background: "var(--surface-sunken)",
          }}
        >
          {[
            { k: "", l: "All" },
            { k: "verified", l: "Verified" },
            { k: "unverified", l: "Unverified" },
          ].map((f) => (
            <button
              key={f.k}
              onClick={() => setVerifiedFilter(f.k)}
              style={{
                padding: "5px 14px",
                borderRadius: 8,
                fontSize: 12.5,
                fontWeight: 600,
                background: verifiedFilter === f.k ? "var(--white)" : "none",
                color: verifiedFilter === f.k ? "var(--green-800)" : "var(--text-secondary)",
                border: "none",
                cursor: "pointer",
                boxShadow:
                  verifiedFilter === f.k
                    ? "var(--elev-1)"
                    : "none",
                transition: "all 0.12s",
              }}
            >
              {f.l}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div
        style={{
          background: "var(--white)",
          borderRadius: 16,
          border: "1px solid var(--hc-border)",
          overflow: "hidden",
        }}
      >
        {/* Table header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1.2fr 1.2fr 1fr 0.8fr 36px",
            gap: 12,
            padding: "10px 20px",
            borderBottom: "1px solid var(--surface-sunken)",
          }}
        >
          {["Staff Member", "Role", "License", "Institution", "Status", ""].map(
            (h, i) => (
              <p
                key={i}
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                {h}
              </p>
            ),
          )}
        </div>

        {loading ? (
          <div style={{ padding: "60px 20px", textAlign: "center" }}>
            <div
              style={{
                width: 24,
                height: 24,
                border: "2.5px solid var(--green-800)",
                borderTopColor: "transparent",
                borderRadius: "50%",
                animation: "spin 0.7s linear infinite",
                margin: "0 auto 10px",
              }}
            />
            <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading staff…</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : staff.length === 0 ? (
          <div style={{ padding: "60px 20px", textAlign: "center" }}>
            <UserCog
              size={36}
              style={{ color: "var(--text-disabled)", margin: "0 auto 12px" }}
            />
            <p style={{ fontWeight: 600, color: "var(--text-secondary)", fontSize: 14 }}>
              No staff found
            </p>
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>
              Try adjusting your filters
            </p>
          </div>
        ) : (
          staff.map((s, i) => {
            const meta = ROLE_META[s.role];
            const Icon = meta?.icon ?? UserCog;
            return (
              <div
                key={s.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1.2fr 1.2fr 1fr 0.8fr 36px",
                  gap: 12,
                  padding: "14px 20px",
                  alignItems: "center",
                  borderBottom:
                    i < staff.length - 1 ? "1px solid var(--surface-sunken)" : "none",
                  transition: "background 0.1s",
                  cursor: "default",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--surface-app)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "none")
                }
              >
                {/* Name */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      flexShrink: 0,
                      background: "var(--sidebar-bg)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "var(--white)",
                    }}
                  >
                    {s.firstName?.[0]}
                    {s.lastName?.[0]}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: 13.5,
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {s.firstName} {s.lastName}
                    </p>
                    {s.specialization && (
                      <p
                        style={{
                          fontSize: 11.5,
                          color: "var(--text-muted)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {s.specialization}
                      </p>
                    )}
                  </div>
                </div>

                {/* Role */}
                <div>
                  {meta ? (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        fontSize: 12,
                        fontWeight: 600,
                        padding: "3px 9px",
                        borderRadius: 999,
                        background: meta.bg,
                        color: meta.color,
                      }}
                    >
                      <Icon size={11} /> {meta.label}
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--text-muted)",
                        textTransform: "capitalize",
                      }}
                    >
                      {s.role}
                    </span>
                  )}
                </div>

                {/* License */}
                <p
                  style={{
                    fontSize: 12.5,
                    color: "var(--text-secondary)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {s.licenseNumber}
                </p>

                {/* Institution */}
                <p
                  style={{
                    fontSize: 12.5,
                    color: "var(--text-muted)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {s.institutionName ?? "—"}
                </p>

                {/* Status */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {s.isVerified ? (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        fontSize: 11.5,
                        fontWeight: 700,
                        padding: "3px 9px",
                        borderRadius: 999,
                        background: "var(--brand-tint)",
                        color: "var(--green-700)",
                      }}
                    >
                      <CheckCircle2 size={11} /> Verified
                    </span>
                  ) : (
                    <button
                      onClick={() => handleVerify(s.id)}
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        padding: "3px 9px",
                        borderRadius: 999,
                        background: "var(--coral-050)",
                        color: "var(--critical-ink)",
                        border: "1px solid var(--coral-100)",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--critical-ink)";
                        e.currentTarget.style.color = "var(--white)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "var(--coral-050)";
                        e.currentTarget.style.color = "var(--critical-ink)";
                      }}
                    >
                      <AlertTriangle size={11} /> Verify
                    </button>
                  )}
                </div>

                {/* Arrow */}
                <button
                  onClick={() => router.push(`/dashboard/admin/staff/${s.id}`)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 7,
                    border: "1px solid var(--hc-border)",
                    background: "var(--white)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--text-muted)",
                    transition: "all 0.12s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--green-800)";
                    e.currentTarget.style.color = "var(--green-800)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--hc-border)";
                    e.currentTarget.style.color = "var(--text-muted)";
                  }}
                >
                  <ChevronRight size={13} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 16,
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Showing {(page - 1) * PER_PAGE + 1}–
            {Math.min(page * PER_PAGE, total)} of {total} staff
          </p>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                border: "1px solid var(--hc-border)",
                background: "var(--white)",
                fontSize: 13,
                cursor: "pointer",
                color: page === 1 ? "var(--text-disabled)" : "var(--text-secondary)",
              }}
            >
              Previous
            </button>
            {[...Array(Math.min(5, totalPages))].map((_, i) => {
              const p = i + Math.max(1, page - 2);
              if (p > totalPages) return null;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    border: "1px solid",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    background: page === p ? "var(--green-800)" : "var(--white)",
                    color: page === p ? "var(--white)" : "var(--text-secondary)",
                    borderColor: page === p ? "var(--green-800)" : "var(--hc-border)",
                  }}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                border: "1px solid var(--hc-border)",
                background: "var(--white)",
                fontSize: 13,
                cursor: "pointer",
                color: page === totalPages ? "var(--text-disabled)" : "var(--text-secondary)",
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Suspense wrapper — required for useSearchParams in Next.js 16 ─────────────
export default function StaffPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
          Loading…
        </div>
      }
    >
      <StaffPageInner />
    </Suspense>
  );
}
