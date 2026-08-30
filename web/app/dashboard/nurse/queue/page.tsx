"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  RefreshCw,
  ChevronRight,
  Activity,
  Users,
  Clock,
  Search,
  X,
  Zap,
  AlertTriangle,
  ClipboardList,
  CheckCircle2,
} from "lucide-react";
import { format } from "date-fns";
import {
  Page,
  PageHeader,
  Pill as Badge,
  Button,
} from "@/components/dashboard/ui";

interface AssignedVisit {
  id: string;
  visitNumber: string;
  patientName: string;
  chiefComplaint: string;
  priority: string;
  status: string;
  admissionDate: string;
  assignedDoctorId?: string;
  doctorName?: string | null;
  hasVitals: boolean; // returned by the updated /assigned-to-me endpoint
}

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  emergency: 1,
  urgent: 2,
  routine: 3,
};

const PC: Record<
  string,
  { color: string; bg: string; border: string; dot: string; label: string }
> = {
  critical: {
    color: "var(--critical-ink)",
    bg: "var(--coral-050)",
    border: "var(--coral-100)",
    dot: "var(--coral-500)",
    label: "Critical",
  },
  emergency: {
    color: "var(--critical-ink)",
    bg: "var(--coral-050)",
    border: "var(--coral-100)",
    dot: "var(--coral-500)",
    label: "Emergency",
  },
  urgent: {
    color: "var(--urgent-ink)",
    bg: "var(--amber-050)",
    border: "var(--amber-100)",
    dot: "var(--amber-500)",
    label: "Urgent",
  },
  routine: {
    color: "var(--success-ink)",
    bg: "var(--brand-tint)",
    border: "var(--green-100)",
    dot: "var(--green-600)",
    label: "Routine",
  },
};
const getP = (p: string) => PC[p] ?? PC.routine;

function timeSince(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}
function waitColor(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins > 60) return "var(--critical-ink)";
  if (mins > 30) return "var(--urgent-ink)";
  return "var(--text-muted)";
}

type FilterKey =
  | "all"
  | "critical"
  | "emergency"
  | "urgent"
  | "routine"
  | "pending"
  | "triaged";

export default function NurseQueuePage() {
  const router = useRouter();
  const [visits, setVisits] = useState<AssignedVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await api.get("/api/visits/assigned-to-me");
      const data: AssignedVisit[] = res.data.data ?? [];
      const sorted = [...data].sort(
        (a, b) =>
          (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9),
      );
      setVisits(sorted);
      setLastRefresh(new Date());
    } catch (err) {
      console.error(err);
      setVisits([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const i = setInterval(() => load(true), 30_000);
    return () => clearInterval(i);
  }, [load]);

  const pendingCount = visits.filter((v) => !v.hasVitals).length;
  const triagedCount = visits.filter((v) => v.hasVitals).length;

  const counts = {
    all: visits.length,
    pending: pendingCount,
    triaged: triagedCount,
    critical: visits.filter((v) => v.priority === "critical").length,
    emergency: visits.filter((v) => v.priority === "emergency").length,
    urgent: visits.filter((v) => v.priority === "urgent").length,
    routine: visits.filter((v) => v.priority === "routine").length,
  };

  const filtered = visits.filter((v) => {
    const matchP =
      filter === "all"
        ? true
        : filter === "pending"
          ? !v.hasVitals
          : filter === "triaged"
            ? v.hasVitals
            : v.priority === filter;

    const q = search.toLowerCase();
    const matchS =
      !q ||
      [v.visitNumber, v.patientName, v.chiefComplaint, v.doctorName].some((f) =>
        f?.toLowerCase().includes(q),
      );
    return matchP && matchS;
  });

  const filterTabs: { key: FilterKey; label: string }[] = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "triaged", label: "Triaged" },
    { key: "critical", label: "Critical" },
    { key: "emergency", label: "Emergency" },
    { key: "urgent", label: "Urgent" },
    { key: "routine", label: "Routine" },
  ];

  return (
    <Page maxWidth={1100}>
      <PageHeader
        eyebrow="Nursing"
        title="My assigned patients"
        subtitle={
          <>
            {format(new Date(), "EEEE, d MMMM yyyy")}
            {!loading && (
              <>
                {" · "}
                {visits.length} patient{visits.length !== 1 ? "s" : ""}
                {pendingCount > 0 && (
                  <span style={{ color: "var(--urgent-ink)", fontWeight: 600 }}>
                    {" "}
                    · {pendingCount} awaiting triage
                  </span>
                )}
                {lastRefresh ? ` · updated ${format(lastRefresh, "HH:mm")}` : ""}
              </>
            )}
          </>
        }
        actions={
          <Button
            icon={RefreshCw}
            onClick={() => load(true)}
            disabled={refreshing}
            style={{ padding: 0, width: 38 }}
          />
        }
      />
      {/* ── Priority stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          {
            key: "critical",
            label: "Critical",
            icon: AlertTriangle,
            color: "var(--critical-ink)",
            bg: "var(--coral-050)",
            border: "var(--coral-100)",
          },
          {
            key: "emergency",
            label: "Emergency",
            icon: Zap,
            color: "var(--critical-ink)",
            bg: "var(--coral-050)",
            border: "var(--coral-100)",
          },
          {
            key: "urgent",
            label: "Urgent",
            icon: Clock,
            color: "var(--urgent-ink)",
            bg: "var(--amber-050)",
            border: "var(--amber-100)",
          },
          {
            key: "routine",
            label: "Routine",
            icon: ClipboardList,
            color: "var(--green-800)",
            bg: "var(--brand-tint)",
            border: "var(--green-100)",
          },
        ].map(({ key, label, icon: Icon, color, bg, border }) => (
          <button
            key={key}
            onClick={() =>
              setFilter(filter === key ? "all" : (key as FilterKey))
            }
            className="relative rounded-[var(--r-lg)] border overflow-hidden p-4 text-left transition-all hover:shadow-[var(--elev-2)] hover:-translate-y-px"
            style={{
              background: bg,
              borderColor: filter === key ? color : border,
              boxShadow: filter === key ? `0 0 0 2px color-mix(in srgb, ${color} 15%, transparent)` : undefined,
            }}
          >
            <div
              className="absolute -right-2 -bottom-2 w-12 h-12 rounded-full opacity-10"
              style={{ background: color }}
            />
            <Icon className="w-3.5 h-3.5 mb-2" style={{ color }} />
            <p
              className="text-2xl font-extrabold leading-none"
              style={{ color }}
            >
              {loading ? (
                <span
                  className="inline-block w-5 h-5 rounded animate-pulse"
                  style={{ background: `color-mix(in srgb, ${color} 13%, transparent)` }}
                />
              ) : (
                counts[key as FilterKey]
              )}
            </p>
            <p
              className="text-xs font-semibold mt-1"
              style={{ color, opacity: 0.65 }}
            >
              {label}
            </p>
          </button>
        ))}
      </div>

      {/* ── Filter tabs + search ── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4 flex-wrap">
        <div
          className="flex gap-1 p-1 rounded-[var(--r-sm)] w-fit overflow-x-auto"
          style={{ background: "var(--surface-sunken)" }}
        >
          {filterTabs.map(({ key, label }) => {
            const tabColor =
              key === "pending"
                ? "var(--urgent-ink)"
                : key === "triaged"
                  ? "var(--green-800)"
                  : key === "all"
                    ? "var(--green-800)"
                    : getP(key).color;
            const tabBg =
              key === "pending"
                ? "var(--amber-050)"
                : key === "triaged"
                  ? "var(--brand-tint)"
                  : key === "all"
                    ? "var(--brand-tint)"
                    : getP(key).bg;

            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--r-xs)] text-xs font-semibold transition-all whitespace-nowrap"
                style={
                  filter === key
                    ? {
                        background: "var(--white)",
                        color: tabColor,
                        boxShadow: "var(--elev-1)",
                      }
                    : { color: "var(--text-secondary)" }
                }
              >
                {label}
                {counts[key] > 0 && (
                  <span
                    className="text-xs font-bold px-1.5 rounded-full"
                    style={
                      filter === key
                        ? { background: tabBg, color: tabColor }
                        : { background: "var(--surface-inset)", color: "var(--text-muted)" }
                    }
                  >
                    {counts[key]}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="relative max-w-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patient, visit number, doctor…"
            className="w-full pl-9 pr-8 py-2 rounded-[var(--r-sm)] border border-[var(--hc-border)] bg-[var(--surface-card)] text-sm text-[var(--text-primary)] outline-none
              focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--focus-ring)] placeholder:text-[var(--text-muted)] transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Patient list ── */}
      <div className="bg-[var(--surface-card)] rounded-[var(--r-lg)] border border-[var(--border-faint)] shadow-[var(--elev-1)] overflow-hidden">
        {loading ? (
          <div className="divide-y divide-[var(--border-faint)]">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 px-5 py-4 animate-pulse"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-[var(--surface-sunken)] flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-36 bg-[var(--surface-sunken)] rounded" />
                  <div className="h-3 w-56 bg-[var(--surface-sunken)] rounded" />
                </div>
                <div className="w-16 h-6 bg-[var(--surface-sunken)] rounded-full" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <div
              className="w-14 h-14 rounded-[var(--r-lg)] flex items-center justify-center mx-auto mb-4"
              style={{ background: "var(--brand-tint)" }}
            >
              <Users className="w-6 h-6 text-[var(--green-300)]" />
            </div>
            <p className="text-sm font-semibold text-[var(--text-secondary)]">
              {visits.length === 0
                ? "No patients assigned to you"
                : "No patients match filters"}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              {visits.length === 0
                ? "The receptionist will assign patients to you"
                : "Try clearing your search or filter"}
            </p>
            {(search || filter !== "all") && (
              <button
                onClick={() => {
                  setSearch("");
                  setFilter("all");
                }}
                className="mt-4 text-xs font-semibold px-4 py-2 rounded-[var(--r-sm)] transition-all"
                style={{ background: "var(--brand-tint)", color: "var(--green-800)" }}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-faint)]/80">
            {filtered.map((v, i) => {
              const p = getP(v.priority);
              const isCritical = ["critical", "emergency"].includes(v.priority);
              const triageDone = v.hasVitals === true;

              return (
                <button
                  key={v.id}
                  onClick={() => router.push(`/dashboard/nurse/triage/${v.id}`)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left transition-all group"
                  style={{
                    background:
                      i === 0 && isCritical && !triageDone
                        ? `color-mix(in srgb, ${p.dot} 3%, transparent)`
                        : undefined,
                    opacity: triageDone ? 0.7 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!(i === 0 && isCritical && !triageDone))
                      e.currentTarget.style.background = "var(--surface-sunken)";
                  }}
                  onMouseLeave={(e) => {
                    if (!(i === 0 && isCritical && !triageDone))
                      e.currentTarget.style.background = "transparent";
                  }}
                >
                  {/* Priority dot */}
                  <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                    {isCritical && i === 0 && !triageDone && (
                      <span
                        className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-50"
                        style={{ background: p.dot }}
                      />
                    )}
                    <span
                      className="relative inline-flex rounded-full h-2.5 w-2.5"
                      style={{ background: triageDone ? "var(--text-disabled)" : p.dot }}
                    />
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        {v.patientName}
                      </p>
                      <span className="font-mono text-xs text-[var(--text-muted)]">
                        {v.visitNumber}
                      </span>
                      {triageDone && (
                        <span className="flex items-center gap-0.5 text-xs font-semibold text-[var(--green-700)]">
                          <CheckCircle2 className="w-3 h-3" /> Triaged
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-muted)] truncate mt-0.5 max-w-xs">
                      {v.chiefComplaint}
                    </p>
                    {v.doctorName && (
                      <p className="text-xs text-[var(--green-700)] mt-1">
                        Doctor: {v.doctorName}
                      </p>
                    )}
                  </div>

                  {/* Wait time */}
                  <div
                    className="hidden sm:flex items-center gap-1 text-xs whitespace-nowrap"
                    style={{
                      color: triageDone
                        ? "var(--text-muted)"
                        : waitColor(v.admissionDate),
                    }}
                  >
                    <Clock className="w-3 h-3" /> {timeSince(v.admissionDate)}
                  </div>

                  {/* Priority badge */}
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
                    style={{
                      background: triageDone ? "var(--surface-sunken)" : p.bg,
                      color: triageDone ? "var(--text-muted)" : p.color,
                      border: `1px solid ${triageDone ? "var(--hc-border)" : p.border}`,
                    }}
                  >
                    {p.label}
                  </span>

                  {/* Action indicator */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {triageDone ? (
                      // Already triaged — show view label on hover
                      <span
                        className="hidden lg:flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-[var(--r-xs)] opacity-0 group-hover:opacity-100 transition-all"
                        style={{ background: "var(--brand-tint)", color: "var(--green-800)" }}
                      >
                        <CheckCircle2 className="w-3 h-3" /> View
                      </span>
                    ) : (
                      // Pending triage — show triage label on hover
                      <span
                        className="hidden lg:flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-[var(--r-xs)] opacity-0 group-hover:opacity-100 transition-all"
                        style={{ background: "var(--green-800)", color: "var(--white)" }}
                      >
                        <Activity className="w-3 h-3" /> Triage
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-[var(--text-disabled)] group-hover:text-[var(--green-700)] transition-colors" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {!loading && visits.length > 0 && (
        <p className="text-xs text-center text-[var(--text-muted)] mt-4">
          Showing {filtered.length} of {visits.length} assigned patient
          {visits.length !== 1 ? "s" : ""}
          {(search || filter !== "all") && (
            <>
              {" "}
              ·{" "}
              <button
                onClick={() => {
                  setSearch("");
                  setFilter("all");
                }}
                className="underline hover:text-[var(--text-secondary)] transition-colors"
              >
                clear
              </button>
            </>
          )}
        </p>
      )}
    </Page>
  );
}
