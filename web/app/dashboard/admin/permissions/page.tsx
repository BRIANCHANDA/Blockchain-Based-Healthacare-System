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
  read: { bg: "#eff6ff", color: "#2563eb" },
  write: { bg: "#fff7ed", color: "#ea580c" },
  full: { bg: "#fdf4ff", color: "#9333ea" },
};

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-50">
      {[1, 2, 3, 4, 5].map((i) => (
        <td key={i} className="py-4 px-3">
          <div
            className="h-4 bg-gray-100 rounded animate-pulse"
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
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl font-bold text-gray-900"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Permissions
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Blockchain-backed access control overview
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

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          {
            label: "Active",
            value: activePerms.length,
            color: "#16a34a",
            bg: "#f0fdf4",
          },
          {
            label: "Expired",
            value: expiredPerms.length,
            color: "#6b7280",
            bg: "#f3f4f6",
          },
          {
            label: "Pending Requests",
            value: requests.filter((r) => r.status === "pending").length,
            color: "#d97706",
            bg: "#fffbeb",
          },
          {
            label: "Total Requests",
            value: requests.length,
            color: "#2563eb",
            bg: "#eff6ff",
          },
        ].map(({ label, value, color, bg }) => (
          <div
            key={label}
            className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3"
          >
            <p
              className="text-xs font-semibold uppercase tracking-wide mb-1"
              style={{ color }}
            >
              {label}
            </p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      {/* Tabs + search */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex gap-1 bg-white rounded-xl border border-gray-100 shadow-sm p-1">
          {(
            [
              ["active", "Active Permissions"],
              ["requests", "Access Requests"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
              style={
                tab === key
                  ? { background: "#166534", color: "#fff" }
                  : { color: "#6b7280" }
              }
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter…"
            className="w-full pl-10 pr-8 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/10 focus:bg-white transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100">
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
                        className={`py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide ${i === 0 ? "pl-5 pr-3" : "px-3"}`}
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
                        className={`py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide ${i === 0 ? "pl-5 pr-3" : "px-3"}`}
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
                      <ShieldCheck className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                      <p className="text-sm font-semibold text-gray-400">
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
                        className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors"
                      >
                        <td className="py-3.5 pl-5 pr-3">
                          <div className="flex items-center gap-2">
                            {expired ? (
                              <ShieldOff className="w-4 h-4 text-gray-300" />
                            ) : (
                              <Shield className="w-4 h-4 text-green-600" />
                            )}
                            <span className="text-xs font-semibold text-gray-500">
                              {USER_TYPE_LABEL[p.grantedToUserType] ??
                                p.grantedToUserType}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 font-mono mt-0.5 pl-6">
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
                          <p className="text-xs text-gray-500">
                            {Array.isArray(p.allowedRecordTypes)
                              ? p.allowedRecordTypes.join(", ")
                              : "all"}
                          </p>
                        </td>
                        <td className="py-3.5 px-3">
                          <p className="text-xs text-gray-500">
                            {p.expiresAt
                              ? format(
                                  new Date(p.expiresAt),
                                  "dd MMM yyyy, HH:mm",
                                )
                              : "—"}
                          </p>
                          {!expired && p.expiresAt && (
                            <p className="text-xs text-gray-400">
                              {formatDistanceToNow(new Date(p.expiresAt), {
                                addSuffix: true,
                              })}
                            </p>
                          )}
                        </td>
                        <td className="py-3.5 px-3">
                          <span
                            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${expired ? "bg-gray-100 text-gray-500" : "bg-green-50 text-green-700"}`}
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
                    <ShieldCheck className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-gray-400">
                      No access requests found
                    </p>
                  </td>
                </tr>
              ) : (
                filteredReqs.map((r) => {
                  const statusStyle =
                    r.status === "approved"
                      ? "bg-green-50 text-green-700"
                      : r.status === "rejected"
                        ? "bg-red-50 text-red-600"
                        : r.status === "expired"
                          ? "bg-gray-100 text-gray-500"
                          : "bg-amber-50 text-amber-700";
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors"
                    >
                      <td className="py-3.5 pl-5 pr-3">
                        <p className="text-xs font-semibold text-gray-700">
                          {USER_TYPE_LABEL[r.requestedByUserType] ??
                            r.requestedByUserType}
                        </p>
                        <p className="text-xs text-gray-400 font-mono">
                          {r.requestedByUserId?.slice(0, 12)}…
                        </p>
                      </td>
                      <td className="py-3.5 px-3">
                        <p className="text-xs text-gray-600 max-w-[180px] truncate">
                          {r.reason}
                        </p>
                      </td>
                      <td className="py-3.5 px-3">
                        <p className="text-xs text-gray-500">
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
                        <p className="text-xs text-gray-400">
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
