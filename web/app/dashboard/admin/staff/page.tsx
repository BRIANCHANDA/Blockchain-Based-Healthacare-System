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
    color: "#2563eb",
    bg: "#eff6ff",
    icon: Stethoscope,
  },
  nurse: { label: "Nurse", color: "#0e7490", bg: "#ecfeff", icon: Users },
  lab_technician: {
    label: "Lab Tech",
    color: "#d97706",
    bg: "#fffbeb",
    icon: FlaskConical,
  },
  radiologist: {
    label: "Radiologist",
    color: "#7c3aed",
    bg: "#faf5ff",
    icon: Scan,
  },
  pharmacist: {
    label: "Pharmacist",
    color: "#166534",
    bg: "#f0fdf4",
    icon: Pill,
  },
  receptionist: {
    label: "Receptionist",
    color: "#0369a1",
    bg: "#f0f9ff",
    icon: UserCog,
  },
  admin: { label: "Admin", color: "#dc2626", bg: "#fef2f2", icon: Shield },
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
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PER_PAGE = 15;

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
          // Hospital admins only see their institution's staff
          ...(!isSuperAdmin && myInstitutionId
            ? { institutionId: myInstitutionId }
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
    [page, search, roleFilter, verifiedFilter],
  );

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, verifiedFilter]);

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
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "#111827",
              fontFamily: "'Playfair Display', serif",
              marginBottom: 4,
            }}
          >
            Staff Management
          </h1>
          <p style={{ fontSize: 13.5, color: "#9ca3af" }}>
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
              border: "1px solid #e5e7eb",
              background: "#fff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#6b7280",
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
              background: "linear-gradient(135deg,#166534,#15803d)",
              color: "#fff",
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
            background: "#fef2f2",
            border: "1px solid #fecaca",
            marginBottom: 20,
          }}
        >
          <AlertTriangle
            size={16}
            style={{ color: "#dc2626", flexShrink: 0 }}
          />
          <p style={{ fontSize: 13.5, color: "#b91c1c", fontWeight: 500 }}>
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
              color: "#dc2626",
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
              color: "#9ca3af",
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
              border: "1px solid #e5e7eb",
              background: "#fff",
              fontSize: 13.5,
              color: "#111",
              outline: "none",
              boxSizing: "border-box",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#166534")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
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
                color: "#9ca3af",
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
            border: "1px solid #e5e7eb",
            background: "#fff",
            fontSize: 13.5,
            color: "#374151",
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

        {/* Verified filter pills */}
        <div
          style={{
            display: "flex",
            gap: 6,
            padding: 4,
            borderRadius: 10,
            background: "#f1f5f9",
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
                background: verifiedFilter === f.k ? "#fff" : "none",
                color: verifiedFilter === f.k ? "#166534" : "#6b7280",
                border: "none",
                cursor: "pointer",
                boxShadow:
                  verifiedFilter === f.k
                    ? "0 1px 3px rgba(0,0,0,0.08)"
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
          background: "#fff",
          borderRadius: 16,
          border: "1px solid #eaecf0",
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
            borderBottom: "1px solid #f3f4f6",
          }}
        >
          {["Staff Member", "Role", "License", "Institution", "Status", ""].map(
            (h, i) => (
              <p
                key={i}
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#9ca3af",
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
                border: "2.5px solid #166534",
                borderTopColor: "transparent",
                borderRadius: "50%",
                animation: "spin 0.7s linear infinite",
                margin: "0 auto 10px",
              }}
            />
            <p style={{ color: "#9ca3af", fontSize: 13 }}>Loading staff…</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : staff.length === 0 ? (
          <div style={{ padding: "60px 20px", textAlign: "center" }}>
            <UserCog
              size={36}
              style={{ color: "#d1d5db", margin: "0 auto 12px" }}
            />
            <p style={{ fontWeight: 600, color: "#6b7280", fontSize: 14 }}>
              No staff found
            </p>
            <p style={{ color: "#9ca3af", fontSize: 13, marginTop: 4 }}>
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
                    i < staff.length - 1 ? "1px solid #f9fafb" : "none",
                  transition: "background 0.1s",
                  cursor: "default",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "#fafbfc")
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
                      background: "linear-gradient(135deg,#1e293b,#334155)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#fff",
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
                        color: "#111",
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
                          color: "#9ca3af",
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
                        color: "#9ca3af",
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
                    color: "#6b7280",
                    fontFamily: "monospace",
                  }}
                >
                  {s.licenseNumber}
                </p>

                {/* Institution */}
                <p
                  style={{
                    fontSize: 12.5,
                    color: "#9ca3af",
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
                        background: "#f0fdf4",
                        color: "#15803d",
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
                        background: "#fef2f2",
                        color: "#dc2626",
                        border: "1px solid #fecaca",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "#dc2626";
                        e.currentTarget.style.color = "#fff";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "#fef2f2";
                        e.currentTarget.style.color = "#dc2626";
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
                    border: "1px solid #e5e7eb",
                    background: "#fff",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#9ca3af",
                    transition: "all 0.12s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#166534";
                    e.currentTarget.style.color = "#166534";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#e5e7eb";
                    e.currentTarget.style.color = "#9ca3af";
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
          <p style={{ fontSize: 13, color: "#9ca3af" }}>
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
                border: "1px solid #e5e7eb",
                background: "#fff",
                fontSize: 13,
                cursor: "pointer",
                color: page === 1 ? "#d1d5db" : "#374151",
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
                    background: page === p ? "#166534" : "#fff",
                    color: page === p ? "#fff" : "#374151",
                    borderColor: page === p ? "#166534" : "#e5e7eb",
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
                border: "1px solid #e5e7eb",
                background: "#fff",
                fontSize: 13,
                cursor: "pointer",
                color: page === totalPages ? "#d1d5db" : "#374151",
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
        <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
          Loading…
        </div>
      }
    >
      <StaffPageInner />
    </Suspense>
  );
}
