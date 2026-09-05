/**
 * Admin view of consent grants across the institution.
 *
 * Shows which practitioners currently hold access to which patients, and when
 * each grant expires. It is a WINDOW, NOT A CONTROL: an administrator cannot
 * grant access from here, because only the patient can grant it — that is the
 * property the AccessControl chaincode enforces and the reason this page is
 * read-oriented.
 *
 * Rows come from the backend's mirror of the ledger. Expiry is computed and
 * displayed client-side (isPast/formatDistanceToNow) so a grant that has lapsed
 * reads as expired without waiting for a refresh, but the authoritative check
 * always happens on the chain at the moment of access.
 */

"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import {
  ShieldCheck,
  RefreshCw,
  Search,
  X,
  Shield,
  ShieldOff,
} from "lucide-react";
import { format, formatDistanceToNow, isPast } from "date-fns";

const USER_TYPE_LABEL: Record<string, string> = {
  practitioner: "Doctor",
  nurse: "Nurse",
  lab_technician: "Lab Tech",
  radiologist: "Radiologist",
  pharmacist: "Pharmacist",
  admin: "Admin",
};

const PERM_TYPE_STYLE: Record<string, { bg: string; color: string }> = {
  read: { bg: "var(--info-tint)", color: "var(--blue-600)" },
  write: { bg: "var(--coral-050)", color: "var(--critical-ink)" },
  full: { bg: "var(--violet-050)", color: "var(--violet-500)" },
};

function SkeletonRow() {
  return (
    <tr className="border-b border-[var(--border-faint)]">
      {[1, 2, 3, 4, 5].map((i) => (
        <td key={i} className="py-4 px-3">
          <div
            className="h-4 bg-[var(--surface-sunken)] rounded animate-pulse"
            style={{ width: i === 1 ? "70%" : "55%" }}
          />
        </td>
      ))}
    </tr>
  );
}

export default function AdminPermissionsPage() {
  const [permissions, setPermissions] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<"active" | "requests">("active");
  const [search, setSearch] = useState("");

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const [permsRes, reqsRes] = await Promise.allSettled([
        api.get("/api/permissions/all"),
        api.get("/api/permissions/requests/all"),
      ]);
      if (permsRes.status === "fulfilled")
        setPermissions(permsRes.value.data?.data?.permissions ?? []);
      if (reqsRes.status === "fulfilled")
        setRequests(reqsRes.value.data?.data?.requests ?? []);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredPerms = search
    ? permissions.filter((p) =>
        [p.permissionType, p.grantedToUserType].some((f) =>
          f?.toLowerCase().includes(search.toLowerCase()),
        ),
      )
    : permissions;

  const filteredReqs = search
    ? requests.filter((r) =>
        [r.reason, r.status, r.requestedByUserType].some((f) =>
          f?.toLowerCase().includes(search.toLowerCase()),
        ),
      )
    : requests;

  const activePerms = filteredPerms.filter(
    (p) => p.isActive && !isPast(new Date(p.expiresAt)),
  );
  const expiredPerms = filteredPerms.filter(
    (p) => !p.isActive || isPast(new Date(p.expiresAt)),
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ margin: 0, font: "700 27px/1.1 var(--font-sans)", letterSpacing: "var(--ls-tight)", color: "var(--text-primary)" }}>
            Permissions
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            Blockchain-backed access control overview
          </p>
        </div>
        <button
          onClick={() => load(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-[var(--r-sm)] border border-[var(--hc-border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] transition-colors"
        >
          <RefreshCw
            className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
          />{" "}
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          {
            label: "Active",
            value: activePerms.length,
            color: "var(--success-ink)",
            bg: "var(--brand-tint)",
          },
          {
            label: "Expired",
            value: expiredPerms.length,
            color: "var(--text-secondary)",
            bg: "var(--surface-sunken)",
          },
          {
            label: "Pending Requests",
            value: requests.filter((r) => r.status === "pending").length,
            color: "var(--urgent-ink)",
            bg: "var(--amber-050)",
          },
          {
            label: "Total Requests",
            value: requests.length,
            color: "var(--blue-600)",
            bg: "var(--info-tint)",
          },
        ].map(({ label, value, color, bg }) => (
          <div
            key={label}
            className="bg-[var(--surface-card)] rounded-[var(--r-sm)] border border-[var(--border-faint)] shadow-[var(--elev-1)] px-4 py-3"
          >
            <p
              className="text-xs font-semibold uppercase tracking-wide mb-1"
              style={{ color }}
            >
              {label}
            </p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
          </div>
        ))}
      </div>

      {/* Tabs + search */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex gap-1 bg-[var(--surface-card)] rounded-[var(--r-sm)] border border-[var(--border-faint)] shadow-[var(--elev-1)] p-1">
          {(
            [
              ["active", "Active Permissions"],
              ["requests", "Access Requests"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="px-4 py-1.5 rounded-[var(--r-xs)] text-sm font-semibold transition-all"
              style={
                tab === key
                  ? { background: "var(--green-800)", color: "var(--white)" }
                  : { color: "var(--text-secondary)" }
              }
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter…"
            className="w-full pl-10 pr-8 py-2 rounded-[var(--r-sm)] border border-[var(--hc-border)] bg-[var(--surface-sunken)] text-sm outline-none focus:border-[var(--green-600)] focus:ring-2 focus:ring-[var(--green-600)] focus:bg-[var(--surface-card)] transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-[var(--surface-card)] rounded-[var(--r-lg)] border border-[var(--border-faint)] shadow-[var(--elev-1)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[var(--border-faint)]">
                {tab === "active"
                  ? [
                      "Granted To",
                      "Type",
                      "Permission",
                      "Expires",
                      "Status",
                    ].map((h, i) => (
                      <th
                        key={i}
                        className={`py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide ${i === 0 ? "pl-5 pr-3" : "px-3"}`}
                      >
                        {h}
                      </th>
                    ))
                  : [
                      "Requested By",
                      "Reason",
                      "Permissions",
                      "Status",
                      "Created",
                    ].map((h, i) => (
                      <th
                        key={i}
                        className={`py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide ${i === 0 ? "pl-5 pr-3" : "px-3"}`}
                      >
                        {h}
                      </th>
                    ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
              ) : tab === "active" ? (
                filteredPerms.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center">
                      <ShieldCheck className="w-10 h-10 text-[var(--text-disabled)] mx-auto mb-3" />
                      <p className="text-sm font-semibold text-[var(--text-muted)]">
                        No permissions found
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredPerms.map((p) => {
                    const expired =
                      isPast(new Date(p.expiresAt)) || !p.isActive;
                    const ps =
                      PERM_TYPE_STYLE[p.permissionType] ?? PERM_TYPE_STYLE.read;
                    return (
                      <tr
                        key={p.id}
                        className="border-b border-[var(--border-faint)] hover:bg-[var(--surface-sunken)] transition-colors"
                      >
                        <td className="py-3.5 pl-5 pr-3">
                          <div className="flex items-center gap-2">
                            {expired ? (
                              <ShieldOff className="w-4 h-4 text-[var(--text-disabled)]" />
                            ) : (
                              <Shield className="w-4 h-4 text-[var(--green-700)]" />
                            )}
                            <span className="text-xs font-semibold text-[var(--text-secondary)]">
                              {USER_TYPE_LABEL[p.grantedToUserType] ??
                                p.grantedToUserType}
                            </span>
                          </div>
                          <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5 pl-6">
                            {p.grantedToUserId?.slice(0, 12)}…
                          </p>
                        </td>
                        <td className="py-3.5 px-3">
                          <span
                            className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize"
                            style={{ background: ps.bg, color: ps.color }}
                          >
                            {p.permissionType}
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          <p className="text-xs text-[var(--text-secondary)]">
                            {Array.isArray(p.allowedRecordTypes)
                              ? p.allowedRecordTypes.join(", ")
                              : "all"}
                          </p>
                        </td>
                        <td className="py-3.5 px-3">
                          <p className="text-xs text-[var(--text-secondary)]">
                            {p.expiresAt
                              ? format(
                                  new Date(p.expiresAt),
                                  "dd MMM yyyy, HH:mm",
                                )
                              : "—"}
                          </p>
                          {!expired && p.expiresAt && (
                            <p className="text-xs text-[var(--text-muted)]">
                              {formatDistanceToNow(new Date(p.expiresAt), {
                                addSuffix: true,
                              })}
                            </p>
                          )}
                        </td>
                        <td className="py-3.5 px-3">
                          <span
                            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${expired ? "bg-[var(--surface-sunken)] text-[var(--text-secondary)]" : "bg-[var(--brand-tint)] text-[var(--green-700)]"}`}
                          >
                            {expired ? "Expired" : "Active"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )
              ) : filteredReqs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <ShieldCheck className="w-10 h-10 text-[var(--text-disabled)] mx-auto mb-3" />
                    <p className="text-sm font-semibold text-[var(--text-muted)]">
                      No access requests found
                    </p>
                  </td>
                </tr>
              ) : (
                filteredReqs.map((r) => {
                  const statusStyle =
                    r.status === "approved"
                      ? "bg-[var(--brand-tint)] text-[var(--green-700)]"
                      : r.status === "rejected"
                        ? "bg-[var(--coral-050)] text-[var(--critical-ink)]"
                        : r.status === "expired"
                          ? "bg-[var(--surface-sunken)] text-[var(--text-secondary)]"
                          : "bg-[var(--amber-050)] text-[var(--urgent-ink)]";
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-[var(--border-faint)] hover:bg-[var(--surface-sunken)] transition-colors"
                    >
                      <td className="py-3.5 pl-5 pr-3">
                        <p className="text-xs font-semibold text-[var(--text-secondary)]">
                          {USER_TYPE_LABEL[r.requestedByUserType] ??
                            r.requestedByUserType}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] font-mono">
                          {r.requestedByUserId?.slice(0, 12)}…
                        </p>
                      </td>
                      <td className="py-3.5 px-3">
                        <p className="text-xs text-[var(--text-secondary)] max-w-[180px] truncate">
                          {r.reason}
                        </p>
                      </td>
                      <td className="py-3.5 px-3">
                        <p className="text-xs text-[var(--text-secondary)]">
                          {Array.isArray(r.requestedPermissions)
                            ? r.requestedPermissions.join(", ")
                            : "—"}
                        </p>
                      </td>
                      <td className="py-3.5 px-3">
                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${statusStyle}`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        <p className="text-xs text-[var(--text-muted)]">
                          {r.createdAt
                            ? formatDistanceToNow(new Date(r.createdAt), {
                                addSuffix: true,
                              })
                            : "—"}
                        </p>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
