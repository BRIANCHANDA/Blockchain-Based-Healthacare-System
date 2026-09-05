/**
 * Audit log — who accessed which patient's records, and when.
 *
 * Entries originate from the AuditContract on-chain, so this is an append-only
 * record: nothing on this page can edit or delete an entry, and the institution
 * that produced a log cannot rewrite it. That is what makes the log evidence
 * rather than a report.
 *
 * Filtering and paging happen server-side because the log grows without bound —
 * every read of every record adds a row.
 */

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
  view: { color: "var(--text-secondary)", bg: "var(--surface-sunken)", border: "var(--surface-sunken)", label: "View" },
  create: {
    color: "var(--green-800)",
    bg: "var(--brand-tint)",
    border: "var(--green-100)",
    label: "Create",
  },
  update: {
    color: "var(--blue-600)",
    bg: "var(--info-tint)",
    border: "var(--blue-100)",
    label: "Update",
  },
  delete: {
    color: "var(--critical-ink)",
    bg: "var(--coral-050)",
    border: "var(--coral-100)",
    label: "Delete",
  },
  permission_grant: {
    color: "var(--urgent-ink)",
    bg: "var(--amber-050)",
    border: "var(--amber-100)",
    label: "Grant Access",
  },
  permission_revoke: {
    color: "var(--accent-ink)",
    bg: "var(--violet-050)",
    border: "var(--violet-100)",
    label: "Revoke Access",
  },
  emergency_override: {
    color: "var(--critical-ink)",
    bg: "var(--coral-050)",
    border: "var(--coral-100)",
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
  practitioner: { color: "var(--accent-ink)", bg: "var(--violet-050)" },
  nurse: { color: "var(--info-ink)", bg: "var(--info-tint)" },
  lab_technician: { color: "var(--urgent-ink)", bg: "var(--amber-050)" },
  radiologist: { color: "var(--blue-600)", bg: "var(--info-tint)" },
  pharmacist: { color: "var(--green-800)", bg: "var(--brand-tint)" },
  admin: { color: "var(--text-secondary)", bg: "var(--surface-sunken)" },
  receptionist: { color: "var(--critical-ink)", bg: "var(--coral-050)" },
  patient: { color: "var(--info-ink)", bg: "var(--info-tint)" },
};

// ── Expanded row ──────────────────────────────────────────────────────────────
function ExpandedRow({ log }: { log: any }) {
  return (
    <div
      className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t"
      style={{ background: "var(--surface-app)", borderColor: "var(--surface-sunken)" }}
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
      <div className="w-6 h-6 rounded-[var(--r-xs)] bg-[var(--surface-sunken)] flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-3 h-3 text-[var(--text-muted)]" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-0.5">
          {label}
        </p>
        <p
          className={`text-xs text-[var(--text-secondary)] break-all leading-relaxed ${mono ? "font-mono" : "font-medium"}`}
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
    <div style={{ maxWidth: 1100 }}>
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 style={{ margin: 0, font: "700 27px/1.1 var(--font-sans)", letterSpacing: "var(--ls-tight)", color: "var(--text-primary)" }}>
            Audit Log
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {total > 0
              ? `${total.toLocaleString()} recorded events`
              : "All system access events"}
          </p>
          {!isSuperAdmin && callerInstitutionName && (
            <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full bg-[var(--info-tint)] border border-[var(--blue-100)]">
              <Building2 className="w-3 h-3 text-[var(--blue-500)]" />
              <span className="text-xs font-semibold text-[var(--info-ink)]">
                {callerInstitutionName}
              </span>
            </div>
          )}
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="w-9 h-9 rounded-[var(--r-sm)] border border-[var(--hc-border)] bg-[var(--surface-card)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] transition-colors flex-shrink-0"
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
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, resource, action, IP…"
            className="w-full pl-9 pr-8 py-2.5 rounded-[var(--r-sm)] border border-[var(--hc-border)] bg-[var(--surface-card)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)] transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Action filter */}
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-3 py-2.5 rounded-[var(--r-sm)] border border-[var(--hc-border)] bg-[var(--surface-card)] text-sm text-[var(--text-secondary)] focus:outline-none focus:border-[var(--brand)]"
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
          className="px-3 py-2.5 rounded-[var(--r-sm)] border border-[var(--hc-border)] bg-[var(--surface-card)] text-sm text-[var(--text-secondary)] focus:outline-none focus:border-[var(--brand)]"
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
            className="px-3 py-2.5 rounded-[var(--r-sm)] border border-[var(--hc-border)] bg-[var(--surface-card)] text-sm text-[var(--text-secondary)] focus:outline-none focus:border-[var(--brand)]"
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
      <div className="bg-[var(--surface-card)] rounded-[var(--r-lg)] border border-[var(--border-faint)] shadow-[var(--elev-1)] overflow-hidden">
        {/* Column headers */}
        <div
          className="hidden lg:grid px-5 py-3 border-b border-[var(--border-faint)]"
          style={{ gridTemplateColumns: "120px 1.3fr 1.3fr 1.5fr 1.1fr 32px" }}
        >
          {["Action", "Who", "Patient", "What", "When", ""].map((h, i) => (
            <p
              key={i}
              className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]"
            >
              {h}
            </p>
          ))}
        </div>

        {/* Body */}
        {loading ? (
          <div className="py-16 text-center">
            <div className="w-6 h-6 border-2 border-[var(--green-600)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-[var(--text-muted)]">Loading audit events…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Activity className="w-9 h-9 text-[var(--text-disabled)] mx-auto mb-3" />
            <p className="text-sm font-semibold text-[var(--text-muted)]">
              No events found
            </p>
          </div>
        ) : (
          filtered.map((log) => {
            const am = ACTION_META[log.actionType] ?? ACTION_META.view;
            const role = ROLE_COLOR[log.actorRole ?? log.userType] ?? {
              color: "var(--text-secondary)",
              bg: "var(--surface-sunken)",
            };
            const isOpen = expanded === log.id;

            return (
              <div
                key={log.id}
                className="border-b border-[var(--border-faint)] last:border-0"
              >
                {/* Main row */}
                <div
                  className="hidden lg:grid px-5 py-3.5 items-center hover:bg-[var(--surface-sunken)] transition-colors cursor-pointer"
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
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
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
                    <p className="text-sm text-[var(--text-secondary)] truncate">
                      {log.patientName}
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)] font-mono truncate">
                      {log.patientId?.slice(0, 8)}…
                    </p>
                  </div>

                  {/* Resource */}
                  <div className="min-w-0 pr-3">
                    <p className="text-sm font-medium text-[var(--text-secondary)] capitalize truncate">
                      {log.resourceType?.replace(/_/g, " ")}
                    </p>
                    {log.resourceDetail && (
                      <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">
                        {log.resourceDetail}
                      </p>
                    )}
                    {log.ipAddress && (
                      <p className="text-[10px] font-mono text-[var(--text-disabled)] mt-0.5">
                        {log.ipAddress}
                      </p>
                    )}
                  </div>

                  {/* Time */}
                  <div>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {log.timestamp
                        ? format(new Date(log.timestamp), "dd MMM, HH:mm")
                        : "—"}
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {log.timestamp
                        ? formatDistanceToNow(new Date(log.timestamp), {
                            addSuffix: true,
                          })
                        : ""}
                    </p>
                  </div>

                  {/* Expand toggle */}
                  <div className="flex items-center justify-center text-[var(--text-disabled)]">
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </div>

                {/* Mobile row */}
                <div
                  className="lg:hidden px-4 py-3.5 flex items-start gap-3 cursor-pointer hover:bg-[var(--surface-sunken)]"
                  onClick={() => setExpanded(isOpen ? null : log.id)}
                >
                  <span
                    className="inline-flex items-center text-[11px] font-bold px-2 py-1 rounded-full flex-shrink-0"
                    style={{ color: am.color, background: am.bg }}
                  >
                    {am.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      {log.actorName}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      {log.patientName} · {log.resourceType?.replace(/_/g, " ")}
                    </p>
                    {log.resourceDetail && (
                      <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
                        {log.resourceDetail}
                      </p>
                    )}
                    <p className="text-[11px] text-[var(--text-muted)] mt-1">
                      {log.timestamp
                        ? formatDistanceToNow(new Date(log.timestamp), {
                            addSuffix: true,
                          })
                        : ""}
                    </p>
                  </div>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-[var(--text-disabled)] flex-shrink-0 mt-1" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[var(--text-disabled)] flex-shrink-0 mt-1" />
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
          <p className="text-sm text-[var(--text-muted)]">
            Page {page} of {totalPages} · {total.toLocaleString()} total events
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-[var(--r-sm)] border border-[var(--hc-border)] bg-[var(--surface-card)] text-sm text-[var(--text-secondary)] disabled:text-[var(--text-disabled)] hover:bg-[var(--surface-sunken)] transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 rounded-[var(--r-sm)] border border-[var(--hc-border)] bg-[var(--surface-card)] text-sm text-[var(--text-secondary)] disabled:text-[var(--text-disabled)] hover:bg-[var(--surface-sunken)] transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
