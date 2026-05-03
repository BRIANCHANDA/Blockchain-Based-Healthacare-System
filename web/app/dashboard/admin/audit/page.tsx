"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Search, X, RefreshCw, Activity, Filter, Shield } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

const ACTION_META: Record<
  string,
  { color: string; bg: string; label: string }
> = {
  view: { color: "#6b7280", bg: "#f9fafb", label: "View" },
  create: { color: "#166534", bg: "#f0fdf4", label: "Create" },
  update: { color: "#2563eb", bg: "#eff6ff", label: "Update" },
  delete: { color: "#dc2626", bg: "#fef2f2", label: "Delete" },
  permission_grant: { color: "#d97706", bg: "#fffbeb", label: "Grant Access" },
  permission_revoke: {
    color: "#7c3aed",
    bg: "#faf5ff",
    label: "Revoke Access",
  },
  emergency_override: { color: "#dc2626", bg: "#fef2f2", label: "Override" },
};

const USER_TYPE_LABEL: Record<string, string> = {
  practitioner: "Doctor",
  nurse: "Nurse",
  lab_technician: "Lab Tech",
  radiologist: "Radiologist",
  pharmacist: "Pharmacist",
  admin: "Admin",
  receptionist: "Receptionist",
  patient: "Patient",
};

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PER_PAGE = 20;

  const load = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(PER_PAGE),
          ...(actionFilter ? { actionType: actionFilter } : {}),
        });
        const res = await api.get(`/api/audit?${params}`);
        setLogs(res.data.data?.logs ?? []);
        setTotal(res.data.data?.total ?? 0);
      } catch (_) {
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, actionFilter],
  );

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    setPage(1);
  }, [actionFilter]);

  const filtered = search
    ? logs.filter((l) =>
        [l.resourceType, l.actionType, l.userType, l.ipAddress].some((f) =>
          f?.toLowerCase().includes(search.toLowerCase()),
        ),
      )
    : logs;

  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <div style={{ maxWidth: 1050 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 24,
          gap: 16,
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
            Audit Log
          </h1>
          <p style={{ fontSize: 13.5, color: "#9ca3af" }}>
            All system actions recorded on Hyperledger Fabric
          </p>
        </div>
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
      </div>

      {/* Filters */}
      <div
        style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}
      >
        <div style={{ position: "relative", flex: "1 1 220px" }}>
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
            placeholder="Filter by resource, action, user type…"
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

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          style={{
            padding: "9px 14px",
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            background: "#fff",
            fontSize: 13.5,
            color: "#374151",
            outline: "none",
          }}
        >
          <option value="">All Actions</option>
          {Object.entries(ACTION_META).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      {/* Log table */}
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          border: "1px solid #eaecf0",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1.2fr 1.4fr 1fr 1.4fr auto",
            gap: 12,
            padding: "10px 20px",
            borderBottom: "1px solid #f3f4f6",
          }}
        >
          {[
            "Action",
            "Resource",
            "User",
            "IP Address",
            "Time",
            "Blockchain",
          ].map((h, i) => (
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
          ))}
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
            <p style={{ color: "#9ca3af", fontSize: 13 }}>Loading audit log…</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "60px 20px", textAlign: "center" }}>
            <Activity
              size={36}
              style={{ color: "#d1d5db", margin: "0 auto 12px" }}
            />
            <p style={{ fontWeight: 600, color: "#6b7280", fontSize: 14 }}>
              No audit events found
            </p>
          </div>
        ) : (
          filtered.map((log, i) => {
            const am = ACTION_META[log.actionType] ?? ACTION_META.view;
            return (
              <div
                key={log.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1.2fr 1.4fr 1fr 1.4fr auto",
                  gap: 12,
                  padding: "13px 20px",
                  alignItems: "center",
                  borderBottom:
                    i < filtered.length - 1 ? "1px solid #f9fafb" : "none",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "#fafbfc")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "none")
                }
              >
                {/* Action */}
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "3px 9px",
                    borderRadius: 999,
                    background: am.bg,
                    color: am.color,
                    width: "fit-content",
                  }}
                >
                  {am.label}
                </span>

                {/* Resource */}
                <div>
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#374151",
                      textTransform: "capitalize",
                    }}
                  >
                    {log.resourceType?.replace(/_/g, " ")}
                  </p>
                  {log.isEmergencyOverride && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "1px 6px",
                        borderRadius: 4,
                        background: "#fef2f2",
                        color: "#dc2626",
                      }}
                    >
                      EMERGENCY
                    </span>
                  )}
                </div>

                {/* User type */}
                <p
                  style={{
                    fontSize: 12.5,
                    color: "#6b7280",
                    textTransform: "capitalize",
                  }}
                >
                  {USER_TYPE_LABEL[log.userType] ?? log.userType}
                </p>

                {/* IP */}
                <p
                  style={{
                    fontSize: 12,
                    color: "#9ca3af",
                    fontFamily: "monospace",
                  }}
                >
                  {log.ipAddress ?? "—"}
                </p>

                {/* Time */}
                <div>
                  <p style={{ fontSize: 12.5, color: "#374151" }}>
                    {log.timestamp
                      ? format(new Date(log.timestamp), "dd MMM yyyy, HH:mm")
                      : "—"}
                  </p>
                  <p style={{ fontSize: 11, color: "#c4c9d4", marginTop: 1 }}>
                    {log.timestamp
                      ? formatDistanceToNow(new Date(log.timestamp), {
                          addSuffix: true,
                        })
                      : ""}
                  </p>
                </div>

                {/* Blockchain TX */}
                <div title={log.blockchainTransactionId ?? ""}>
                  {log.blockchainTransactionId ? (
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 11,
                        color: "#166534",
                        fontFamily: "monospace",
                      }}
                    >
                      <Shield size={10} />
                      {log.blockchainTransactionId.slice(0, 8)}…
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: "#d1d5db" }}>—</span>
                  )}
                </div>
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
            Page {page} of {totalPages} · {total} total events
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
