"use client";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  ClipboardList,
  RefreshCw,
  Clock,
  Search,
  X,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Users,
  FlaskConical,
  Scan,
  Hourglass,
  AlertCircle,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import {
  Page,
  PageHeader,
  Card,
  KpiCard,
  KpiGrid,
  Pill as Badge,
  Button,
  Banner,
  EmptyState,
  SkeletonRow,
  SearchInput,
  SegmentedControl,
  SectionLabel,
  LinkAction,
  hoverRow,
  TONES,
} from "@/components/dashboard/ui";
import { getPriority, PRIORITY_ORDER, getInitials } from "../vocab";

/* ==========================================================================
   Today's queue — every visit assigned to this doctor.

   Three things can be true of a patient here, and the Status column shows
   exactly one: they need a consult, they are waiting on lab/imaging results,
   or the doctor is done with them. The KPI row doubles as a filter — clicking
   a card narrows the table to that slice.
   ========================================================================== */

// ── Types — flat shape from assigned-to-me practitioner branch ────────────────
interface QueueVisit {
  id: string;
  visitNumber: string;
  chiefComplaint: string;
  priority: string;
  status: string;
  admissionDate: string;
  wardOrRoom: string | null;
  hasConsultation: boolean;
  pendingLabCount: number;
  pendingImagingCount: number;
  // Flat — already decrypted server-side
  patientName: string;
  gender: string;
  bloodType: string;
}

type FilterKey =
  | "all"
  | "critical"
  | "emergency"
  | "urgent"
  | "awaiting"
  | "pending_results";

/* Shared column template for the header row and every body row. */
const GRID = "16px 34px minmax(160px, 1.3fr) minmax(180px, 1.6fr) 120px 150px";

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DoctorQueuePage() {
  const router = useRouter();
  const [queue, setQueue] = useState<QueueVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await api.get("/api/visits/assigned-to-me");
      const raw: any[] = res.data?.data ?? [];
      const sorted = [...raw].sort((a, b) => {
        const po =
          (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
        // Within a band, whoever arrived first goes first.
        return po !== 0
          ? po
          : new Date(a.admissionDate).getTime() -
              new Date(b.admissionDate).getTime();
      });
      setQueue(sorted as QueueVisit[]);
      setLastRefresh(new Date());
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? "Failed to load queue.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useLiveRefresh(() => load(true));

  useEffect(() => {
    load();
  }, [load]);

  const isAwaitingResults = (v: QueueVisit) =>
    v.hasConsultation && (v.pendingLabCount > 0 || v.pendingImagingCount > 0);

  const counts = {
    all: queue.length,
    critical: queue.filter((v) => v.priority === "critical").length,
    emergency: queue.filter((v) => v.priority === "emergency").length,
    urgent: queue.filter((v) => v.priority === "urgent").length,
    awaiting: queue.filter((v) => !v.hasConsultation).length,
    pending_results: queue.filter(isAwaitingResults).length,
  };

  const filtered = queue.filter((v) => {
    const matchFilter =
      filter === "all"
        ? true
        : filter === "awaiting"
          ? !v.hasConsultation
          : filter === "pending_results"
            ? isAwaitingResults(v)
            : v.priority === filter;

    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      [v.visitNumber, v.chiefComplaint, v.wardOrRoom, v.patientName].some((f) =>
        f?.toLowerCase().includes(q),
      );

    return matchFilter && matchSearch;
  });

  const isFiltered = !!search || filter !== "all";
  const clearFilters = () => {
    setSearch("");
    setFilter("all");
  };

  /** KPI cards toggle their filter — clicking the active one clears it. */
  const toggleFilter = (key: FilterKey) =>
    setFilter(filter === key ? "all" : key);

  return (
    <Page maxWidth={1200}>
      <PageHeader
        eyebrow="Clinical"
        title="Today's queue"
        subtitle={
          <>
            {format(new Date(), "EEEE, d MMMM yyyy")}
            {!loading && (
              <>
                {" · "}
                {queue.length} visit{queue.length !== 1 ? "s" : ""}
                {counts.awaiting > 0 && (
                  <span style={{ color: "var(--urgent-ink)", fontWeight: 600 }}>
                    {" "}
                    · {counts.awaiting} awaiting consult
                  </span>
                )}
                {counts.pending_results > 0 && (
                  <span style={{ color: "var(--accent-ink)", fontWeight: 600 }}>
                    {" "}
                    · {counts.pending_results} awaiting results
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

      {error && (
        <Banner
          tone="critical"
          icon={AlertCircle}
          action={
            <Button variant="ghost" size="sm" onClick={() => load(false)}>
              Retry
            </Button>
          }
        >
          {error}
        </Banner>
      )}

      {/* KPI row doubles as the primary filter. */}
      <KpiGrid min={175}>
        <KpiCard
          label="Critical"
          value={counts.critical}
          icon={Zap}
          tone="accent"
          loading={loading}
          onClick={() => toggleFilter("critical")}
        />
        <KpiCard
          label="Emergency"
          value={counts.emergency}
          icon={AlertTriangle}
          tone="critical"
          loading={loading}
          onClick={() => toggleFilter("emergency")}
        />
        <KpiCard
          label="Urgent"
          value={counts.urgent}
          icon={Clock}
          tone="urgent"
          loading={loading}
          onClick={() => toggleFilter("urgent")}
        />
        <KpiCard
          label="Needs consult"
          value={counts.awaiting}
          icon={ClipboardList}
          tone="info"
          loading={loading}
          onClick={() => toggleFilter("awaiting")}
        />
        <KpiCard
          label="Await results"
          value={counts.pending_results}
          icon={Hourglass}
          tone="accent"
          loading={loading}
          onClick={() => toggleFilter("pending_results")}
        />
        <KpiCard
          label="Total"
          value={counts.all}
          icon={Users}
          tone="brand"
          loading={loading}
          onClick={() => setFilter("all")}
        />
      </KpiGrid>

      {/* Filter tabs + search */}
      <div className="flex items-center justify-between flex-wrap" style={{ gap: 12 }}>
        <SegmentedControl<FilterKey>
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: counts.all },
            { value: "awaiting", label: "Needs consult", count: counts.awaiting },
            {
              value: "pending_results",
              label: "Await results",
              count: counts.pending_results,
            },
            { value: "critical", label: "Critical", count: counts.critical },
            { value: "emergency", label: "Emergency", count: counts.emergency },
            { value: "urgent", label: "Urgent", count: counts.urgent },
          ]}
        />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search patient, visit, complaint…"
          icon={Search}
          clearIcon={X}
          style={{ flex: "1 1 200px", maxWidth: 320 }}
        />
      </div>

      {/* Table */}
      <Card>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 900 }}>
            {!loading && filtered.length > 0 && (
              <div
                className="grid items-center"
                style={{
                  gridTemplateColumns: GRID,
                  gap: 14,
                  padding: "9px 20px",
                  background: "var(--surface-sunken)",
                  borderBottom: "1px solid var(--border-faint)",
                }}
              >
                <span />
                <span />
                <SectionLabel>Patient</SectionLabel>
                <SectionLabel>Chief complaint</SectionLabel>
                <SectionLabel>Admitted</SectionLabel>
                <SectionLabel>Status</SectionLabel>
              </div>
            )}

            {loading ? (
              [...Array(6)].map((_, i) => <SkeletonRow key={i} />)
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={Users}
                title={
                  queue.length === 0
                    ? "No patients assigned yet"
                    : "No patients match filters"
                }
                message={
                  queue.length === 0
                    ? "Patients appear here after nurse triage assigns you."
                    : "Try clearing your search or filters."
                }
                pad={64}
                action={
                  isFiltered ? (
                    <Button size="sm" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              filtered.map((v, i) => {
                const p = getPriority(v.priority);
                const pTone = TONES[p.tone];
                const isCrit = ["critical", "emergency"].includes(v.priority);
                const needsConsult = !v.hasConsultation;
                const hasPending =
                  v.pendingLabCount > 0 || v.pendingImagingCount > 0;
                const totalPending = v.pendingLabCount + v.pendingImagingCount;

                return (
                  <div
                    key={v.id}
                    onClick={() => router.push(`/dashboard/doctor/visit/${v.id}`)}
                    className="grid items-center"
                    style={{
                      gridTemplateColumns: GRID,
                      gap: 14,
                      padding: "12px 20px",
                      borderBottom: "1px solid var(--border-faint)",
                      cursor: "pointer",
                      transition: "background var(--dur-fast) var(--ease-standard)",
                    }}
                    {...hoverRow}
                  >
                    {/* Priority dot — only the most urgent patient at the top
                        of the list pulses, so the cue stays meaningful. */}
                    <span
                      className="relative flex justify-self-center"
                      style={{ width: 8, height: 8 }}
                    >
                      {isCrit && i === 0 && (
                        <span
                          className="absolute inset-0 rounded-full"
                          style={{
                            background: pTone.dot,
                            animation: "hcPing 2.4s cubic-bezier(0,0,0.2,1) infinite",
                          }}
                        />
                      )}
                      <span
                        className="relative rounded-full"
                        style={{ width: 8, height: 8, background: pTone.dot }}
                      />
                    </span>

                    <span
                      className="inline-flex items-center justify-center flex-shrink-0"
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: "var(--r-sm)",
                        background: isCrit ? pTone.tint : "var(--surface-sunken)",
                        color: isCrit ? pTone.ink : "var(--text-secondary)",
                        font: "700 12px/1 var(--font-sans)",
                      }}
                    >
                      {getInitials(v.patientName)}
                    </span>

                    <div className="min-w-0 flex flex-col" style={{ gap: 5 }}>
                      <span
                        className="truncate"
                        style={{
                          font: "600 13.5px/1 var(--font-sans)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {v.patientName}
                      </span>
                      <span className="flex items-center flex-wrap" style={{ gap: 6 }}>
                        <Badge tone={p.tone} style={{ height: 18, fontSize: 10 }}>
                          {p.label}
                        </Badge>
                        {v.bloodType && v.bloodType !== "unknown" && (
                          <span
                            className="inline-flex items-center"
                            style={{
                              height: 18,
                              padding: "0 7px",
                              borderRadius: "var(--r-pill)",
                              background: "var(--surface-sunken)",
                              color: "var(--text-secondary)",
                              font: "700 10px/1 var(--font-mono)",
                            }}
                          >
                            {v.bloodType}
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="min-w-0 flex flex-col" style={{ gap: 5 }}>
                      <span
                        className="truncate"
                        style={{
                          font: "500 13px/1 var(--font-sans)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {v.chiefComplaint || "No chief complaint recorded"}
                      </span>
                      <span
                        style={{
                          font: "400 11px/1 var(--font-mono)",
                          color: "var(--text-muted)",
                        }}
                      >
                        {v.visitNumber}
                      </span>
                    </div>

                    <div className="flex flex-col" style={{ gap: 4 }}>
                      <span
                        style={{
                          font: "600 12.5px/1 var(--font-mono)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {format(new Date(v.admissionDate), "HH:mm")}
                      </span>
                      <span
                        style={{
                          font: "400 11px/1 var(--font-sans)",
                          color: "var(--text-muted)",
                        }}
                      >
                        {formatDistanceToNow(new Date(v.admissionDate), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>

                    <div className="flex flex-col items-start" style={{ gap: 6 }}>
                      {needsConsult ? (
                        <Badge tone="urgent" dot>
                          Needs consult
                        </Badge>
                      ) : hasPending ? (
                        <Badge tone="accent" icon={Hourglass}>
                          {totalPending} pending
                        </Badge>
                      ) : (
                        <Badge tone="success" icon={CheckCircle2}>
                          Complete
                        </Badge>
                      )}

                      {hasPending && (
                        <span className="flex items-center" style={{ gap: 5 }}>
                          {v.pendingLabCount > 0 && (
                            <Badge
                              tone="urgent"
                              icon={FlaskConical}
                              style={{ height: 17, fontSize: 10, padding: "0 7px" }}
                            >
                              {v.pendingLabCount}
                            </Badge>
                          )}
                          {v.pendingImagingCount > 0 && (
                            <Badge
                              tone="accent"
                              icon={Scan}
                              style={{ height: 17, fontSize: 10, padding: "0 7px" }}
                            >
                              {v.pendingImagingCount}
                            </Badge>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {!loading && queue.length > 0 && (
          <div
            className="flex items-center justify-center"
            style={{ gap: 8, padding: "12px 20px" }}
          >
            <span
              style={{ font: "400 12px/1 var(--font-sans)", color: "var(--text-muted)" }}
            >
              Showing {filtered.length} of {queue.length} visit
              {queue.length !== 1 ? "s" : ""}
            </span>
            {isFiltered && (
              <LinkAction arrow={false} onClick={clearFilters}>
                Clear filters
              </LinkAction>
            )}
          </div>
        )}
      </Card>
    </Page>
  );
}
