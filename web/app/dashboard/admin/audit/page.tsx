"use client";
import { useEffect, useState, useCallback } from "react";
import { api, institutionApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import {
  Search,
  X,
  RefreshCw,
  Activity,
  ChevronDown,
  ChevronUp,
  User,
  Shield,
  AlertTriangle,
  Clock,
  Monitor,
  Building2,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

// ── Config ────────────────────────────────────────────────────────────────────
const ACTION_META: Record<
  string,
  { color: string; bg: string; border: string; label: string }
> = {
  view: { color: "#6b7280", bg: "#f9fafb", border: "#f3f4f6", label: "View" },
  create: {
    color: "#166534",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    label: "Create",
  },
  update: {
    color: "#2563eb",
    bg: "#eff6ff",
    border: "#bfdbfe",
    label: "Update",
  },
  delete: {
    color: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca",
    label: "Delete",
  },
  permission_grant: {
    color: "#d97706",
    bg: "#fffbeb",
    border: "#fde68a",
    label: "Grant Access",
  },
  permission_revoke: {
    color: "#7c3aed",
    bg: "#faf5ff",
    border: "#ddd6fe",
    label: "Revoke Access",
  },
  emergency_override: {
    color: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca",
    label: "Override",
  },
};

const ROLE_LABEL: Record<string, string> = {
  practitioner: "Doctor",
  nurse: "Nurse",
  lab_technician: "Lab Tech",
  radiologist: "Radiologist",
  pharmacist: "Pharmacist",
  admin: "Admin",
  receptionist: "Receptionist",
  patient: "Patient",
};

const ROLE_COLOR: Record<string, { color: string; bg: string }> = {
  practitioner: { color: "#7c3aed", bg: "#faf5ff" },
  nurse: { color: "#0e7490", bg: "#ecfeff" },
  lab_technician: { color: "#d97706", bg: "#fffbeb" },
  radiologist: { color: "#2563eb", bg: "#eff6ff" },
  pharmacist: { color: "#166534", bg: "#f0fdf4" },
  admin: { color: "#374151", bg: "#f9fafb" },
  receptionist: { color: "#be185d", bg: "#fdf2f8" },
  patient: { color: "#0369a1", bg: "#f0f9ff" },
};

// ── Expanded row ──────────────────────────────────────────────────────────────
function ExpandedRow({ log }: { log: any }) {
  return (
    <div
      className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t"
      style={{ background: "#fafbfc", borderColor: "#f3f4f6" }}
    >
      {log.resourceDetail && (
        <Detail
          icon={Activity}
          label="Resource Detail"
          value={log.resourceDetail}
        />
      )}
      {log.accessReason && (
        <Detail icon={Shield} label="Access Reason" value={log.accessReason} />
      )}
      {log.userAgent && (
        <Detail icon={Monitor} label="User Agent" value={log.userAgent} mono />
      )}
      {log.blockchainTransactionId && (
        <Detail
          icon={Shield}
          label="Transaction ID"
          value={log.blockchainTransactionId}
          mono
        />
      )}
      {log.resourceId && (
        <Detail
          icon={Activity}
          label="Resource ID"
          value={log.resourceId}
          mono
        />
      )}
      <Detail icon={User} label="User ID" value={log.userId} mono />
    </div>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon: any;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-3 h-3 text-gray-400" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">
          {label}
        </p>
        <p
          className={`text-xs text-gray-700 break-all leading-relaxed ${mono ? "font-mono" : "font-medium"}`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AuditPage() {
  const { user } = useAuthStore();
  const callerInstitutionId = (user as any)?.institutionId as string | undefined;
  const callerInstitutionName = (user as any)?.institutionName as string | undefined;
  const isSuperAdmin = !callerInstitutionId;

  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [institutionFilter, setInstitutionFilter] = useState("");
  const [institutions, setInstitutions] = useState<{ id: string; name: string }[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const PER_PAGE = 20;

  // Load institution list for super admin dropdown
  useEffect(() => {
    if (!isSuperAdmin) return;
    institutionApi.list().then((res) => {
      const list: any[] = res.data.data?.institutions ?? res.data.data ?? [];
      setInstitutions(list.map((i: any) => ({ id: i.id, name: i.institutionName })));
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
          ...(actionFilter ? { actionType: actionFilter } : {}),
          ...(roleFilter ? { userType: roleFilter } : {}),
          ...(isSuperAdmin && institutionFilter ? { institutionId: institutionFilter } : {}),
        });
        const res = await api.get(`/api/audit?${params}`);
        setLogs(res.data.data?.logs ?? []);
        setTotal(res.data.data?.total ?? 0);
      } catch {
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, actionFilter, roleFilter, institutionFilter, isSuperAdmin],
  );

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    setPage(1);
  }, [actionFilter, roleFilter, institutionFilter]);

  // client-side filter by name / resource / IP
  const filtered = search
    ? logs.filter((l) =>
        [
          l.actorName,
          l.patientName,
          l.resourceType,
          l.resourceDetail,
          l.actionType,
          l.ipAddress,
        ].some((f) => f?.toLowerCase().includes(search.toLowerCase())),
      )
    : logs;

  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", maxWidth: 1100 }}>
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1
            className="text-2xl font-bold text-gray-900 leading-tight"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Audit Log
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {total > 0
              ? `${total.toLocaleString()} recorded events`
              : "All system access events"}
          </p>
          {!isSuperAdmin && callerInstitutionName && (
            <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-100">
              <Building2 className="w-3 h-3 text-blue-500" />
              <span className="text-xs font-semibold text-blue-700">
                {callerInstitutionName}
              </span>
            </div>
          )}
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="w-9 h-9 rounded-xl border border-gray-200 bg-white flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors flex-shrink-0"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
        </button>
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="flex gap-2.5 mb-4 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search
            size={13}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, resource, action, IP…"
            className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 focus:outline-none focus:border-green-500 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Action filter */}
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:border-green-500"
        >
          <option value="">All Actions</option>
          {Object.entries(ACTION_META).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>

        {/* Role filter */}
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:border-green-500"
        >
          <option value="">All Roles</option>
          {Object.entries(ROLE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>

        {/* Institution filter — super admin only */}
        {isSuperAdmin && institutions.length > 0 && (
          <select
            value={institutionFilter}
            onChange={(e) => setInstitutionFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:border-green-500"
          >
            <option value="">All Institutions</option>
            {institutions.map((inst) => (
              <option key={inst.id} value={inst.id}>
                {inst.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Column headers */}
        <div
          className="hidden lg:grid px-5 py-3 border-b border-gray-50"
          style={{ gridTemplateColumns: "120px 1.3fr 1.3fr 1.5fr 1.1fr 32px" }}
        >
          {["Action", "Who", "Patient", "What", "When", ""].map((h, i) => (
            <p
              key={i}
              className="text-[10px] font-bold uppercase tracking-widest text-gray-400"
            >
              {h}
            </p>
          ))}
        </div>

        {/* Body */}
        {loading ? (
          <div className="py-16 text-center">
            <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-400">Loading audit events…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Activity className="w-9 h-9 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-400">
              No events found
            </p>
          </div>
        ) : (
          filtered.map((log) => {
            const am = ACTION_META[log.actionType] ?? ACTION_META.view;
            const role = ROLE_COLOR[log.actorRole ?? log.userType] ?? {
              color: "#6b7280",
              bg: "#f9fafb",
            };
            const isOpen = expanded === log.id;

            return (
              <div
                key={log.id}
                className="border-b border-gray-50 last:border-0"
              >
                {/* Main row */}
                <div
                  className="hidden lg:grid px-5 py-3.5 items-center hover:bg-gray-50/60 transition-colors cursor-pointer"
                  style={{
                    gridTemplateColumns: "120px 1.3fr 1.3fr 1.5fr 1.1fr 32px",
                  }}
                  onClick={() => setExpanded(isOpen ? null : log.id)}
                >
                  {/* Action badge */}
                  <div>
                    <span
                      className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full"
                      style={{
                        color: am.color,
                        background: am.bg,
                        border: `1px solid ${am.border}`,
                      }}
                    >
                      {log.isEmergencyOverride && (
                        <AlertTriangle className="w-2.5 h-2.5" />
                      )}
                      {am.label}
                    </span>
                  </div>

                  {/* Actor */}
                  <div className="min-w-0 pr-3">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {log.actorName}
                    </p>
                    <span
                      className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5"
                      style={{ color: role.color, background: role.bg }}
                    >
                      {ROLE_LABEL[log.actorRole ?? log.userType] ??
                        log.userType}
                    </span>
                  </div>

                  {/* Patient */}
                  <div className="min-w-0 pr-3">
                    <p className="text-sm text-gray-700 truncate">
                      {log.patientName}
                    </p>
                    <p className="text-[10px] text-gray-400 font-mono truncate">
                      {log.patientId?.slice(0, 8)}…
                    </p>
                  </div>

                  {/* Resource */}
                  <div className="min-w-0 pr-3">
                    <p className="text-sm font-medium text-gray-700 capitalize truncate">
                      {log.resourceType?.replace(/_/g, " ")}
                    </p>
                    {log.resourceDetail && (
                      <p className="text-[11px] text-gray-400 truncate mt-0.5">
                        {log.resourceDetail}
                      </p>
                    )}
                    {log.ipAddress && (
                      <p className="text-[10px] font-mono text-gray-300 mt-0.5">
                        {log.ipAddress}
                      </p>
                    )}
                  </div>

                  {/* Time */}
                  <div>
                    <p className="text-sm text-gray-700">
                      {log.timestamp
                        ? format(new Date(log.timestamp), "dd MMM, HH:mm")
                        : "—"}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {log.timestamp
                        ? formatDistanceToNow(new Date(log.timestamp), {
                            addSuffix: true,
                          })
                        : ""}
                    </p>
                  </div>

                  {/* Expand toggle */}
                  <div className="flex items-center justify-center text-gray-300">
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </div>

                {/* Mobile row */}
                <div
                  className="lg:hidden px-4 py-3.5 flex items-start gap-3 cursor-pointer hover:bg-gray-50/60"
                  onClick={() => setExpanded(isOpen ? null : log.id)}
                >
                  <span
                    className="inline-flex items-center text-[11px] font-bold px-2 py-1 rounded-full flex-shrink-0"
                    style={{ color: am.color, background: am.bg }}
                  >
                    {am.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">
                      {log.actorName}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {log.patientName} · {log.resourceType?.replace(/_/g, " ")}
                    </p>
                    {log.resourceDetail && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {log.resourceDetail}
                      </p>
                    )}
                    <p className="text-[11px] text-gray-400 mt-1">
                      {log.timestamp
                        ? formatDistanceToNow(new Date(log.timestamp), {
                            addSuffix: true,
                          })
                        : ""}
                    </p>
                  </div>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-gray-300 flex-shrink-0 mt-1" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-300 flex-shrink-0 mt-1" />
                  )}
                </div>

                {/* Expanded detail */}
                {isOpen && <ExpandedRow log={log} />}
              </div>
            );
          })
        )}
      </div>

      {/* ── Pagination ───────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
          <p className="text-sm text-gray-400">
            Page {page} of {totalPages} · {total.toLocaleString()} total events
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 disabled:text-gray-300 hover:bg-gray-50 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 disabled:text-gray-300 hover:bg-gray-50 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
