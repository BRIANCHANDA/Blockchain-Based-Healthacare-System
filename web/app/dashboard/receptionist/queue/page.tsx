"use client";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { api, practitionersApi, visitApi } from "@/lib/api";
import { receptionistQueueItem, queueWaitLabel } from '@/lib/receptionist-queue';
import {
  Clock,
  Users,
  RefreshCw,
  Activity,
  UserPlus,
  CheckCircle2,
  Loader2,
  Play,
  Zap,
  Search,
  X,
  User,
  UserCheck,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import {
  Page,
  PageHeader,
  Card,
  CardHeader,
  KpiCard,
  KpiGrid,
  Pill,
  MonoTag,
  Avatar,
  Button,
  LinkAction,
  SearchInput,
  SegmentedControl,
  Banner,
  EmptyState,
  SkeletonRow,
  SectionLabel,
  hoverRow,
  type Tone,
} from "@/components/dashboard/ui";

/* ==========================================================================
   Today's queue — the full, filterable view behind the overview's short list.

   Data comes from /api/dashboard/receptionist, which (unlike
   /api/visits/today) returns real lifecycle statuses, so waiting /
   in-progress / completed are all meaningful here.
   ========================================================================== */

interface QueueItem {
  id: string;
  ticket: string;
  name: string;
  age?: number;
  reason: string;
  priority: string;
  doctor?: string | null;
  waitMins: number | null;
  status: string;
  assignedNurseId?: string;
  assignedNurseName?: string;
}

interface Nurse {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  specialization: string | null;
  lastSeenAt: string | null;
}

/* Priority → tone. Ordering the map by clinical severity keeps the sort
   comparator below and the visual weight in agreement. */
const PRIORITY: Record<string, { tone: Tone; label: string }> = {
  critical: { tone: "accent", label: "Critical" },
  emergency: { tone: "critical", label: "Emergency" },
  urgent: { tone: "urgent", label: "Urgent" },
  elderly: { tone: "urgent", label: "Elderly" },
  normal: { tone: "success", label: "Normal" },
  routine: { tone: "success", label: "Routine" },
};
const getP = (p: string) => PRIORITY[p] ?? { tone: "neutral" as Tone, label: p || "—" };

/* Waits only earn colour once they are worth acting on. */
const waitInk = (m: number | null) =>
  (m ?? 0) > 60 ? "var(--critical-ink)" : (m ?? 0) > 30 ? "var(--urgent-ink)" : "var(--text-secondary)";

function StatusPill({ status }: { status: string }) {
  if (status === "in-progress") return <Pill tone="success" dot>In care</Pill>;
  if (status === "completed")
    return (
      <Pill tone="neutral" icon={CheckCircle2}>
        Done
      </Pill>
    );
  return (
    <Pill tone="neutral" icon={Clock}>
      Waiting
    </Pill>
  );
}

type FilterStatus = "all" | "waiting" | "in-progress" | "completed";

/* Shared grid template — the header row and every body row use this one
   definition, so columns cannot drift apart. */
const GRID = "44px 36px minmax(190px, 1fr) 96px 108px 96px 150px";

export default function QueuePage() {
  const router = useRouter();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [search, setSearch] = useState("");
  const [assigning, setAssigning] = useState<string | null>(null);
  const [onlineNurses, setOnlineNurses] = useState<Nurse[]>([]);
  const [showNurseDropdown, setShowNurseDropdown] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // ── Fetch queue only (used for silent refresh and initial load) ────────────
  const fetchQueue = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const res = await api.get("/api/dashboard/receptionist");
      // Handle both { data: { queue: [] } } and { queue: [] } shapes
      const q = res.data?.data?.queue ?? res.data?.queue ?? [];
      setQueue(q.map((row: Parameters<typeof receptionistQueueItem>[0]) => receptionistQueueItem(row)));
      setLastRefresh(new Date());
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ?? err.message ?? "Failed to load queue.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // ── Fetch nurses separately so a nurse API failure doesn't block the queue ─
  const fetchNurses = useCallback(async () => {
    try {
      const res = await practitionersApi.getOnlineStaff("nurse");
      setOnlineNurses(res.data?.data?.staff ?? res.data?.staff ?? []);
    } catch {
      // Non-fatal — the queue still works without the nurse list.
    }
  }, []);

  // ── Initial load: run both independently so neither blocks the other ───────
  useLiveRefresh(() => Promise.all([fetchQueue(true), fetchNurses()]));

  useEffect(() => {
    fetchQueue(false);
    fetchNurses();
  }, [fetchQueue, fetchNurses]);

  // ── Assign nurse ───────────────────────────────────────────────────────────
  const assignNurse = async (visitId: string, nurseId: string) => {
    if (!nurseId) return;
    setAssigning(visitId);
    try {
      await visitApi.assignNurse(visitId, nurseId);
      await fetchQueue(true);
      setShowNurseDropdown(null);
    } catch {
      alert("Failed to assign nurse. Please try again.");
    } finally {
      setAssigning(null);
    }
  };

  // ── Derived counts ─────────────────────────────────────────────────────────
  const counts = {
    waiting: queue.filter((q) => q.status === "waiting").length,
    inProgress: queue.filter((q) => q.status === "in-progress").length,
    done: queue.filter((q) => q.status === "completed").length,
    urgent: queue.filter((q) =>
      ["urgent", "emergency", "critical"].includes(q.priority),
    ).length,
  };

  const filtered = queue.filter((item) => {
    const matchStatus = filterStatus === "all" || item.status === filterStatus;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      [item.ticket, item.name, item.reason, item.priority].some((f) =>
        f?.toLowerCase().includes(q),
      );
    return matchStatus && matchSearch;
  });

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        const order: Record<string, number> = {
          critical: 0,
          emergency: 1,
          urgent: 2,
          elderly: 3,
          normal: 4,
          routine: 4,
        };
        const po = (order[a.priority] ?? 5) - (order[b.priority] ?? 5);
        // Within a band, whoever has waited longest goes first.
        return po !== 0 ? po : (b.waitMins ?? 0) - (a.waitMins ?? 0);
      }),
    [filtered],
  );

  const isFiltered = filterStatus !== "all" || !!search;

  return (
    <Page>
      <PageHeader
        eyebrow="Front desk"
        title="Today's queue"
        subtitle={
          <>
            {format(new Date(), "EEEE, dd MMMM yyyy")} ·{" "}
            {loading
              ? "Loading…"
              : `${queue.length} visit${queue.length !== 1 ? "s" : ""} registered`}
            {refreshing
              ? " · refreshing…"
              : lastRefresh && !loading
                ? ` · updated ${format(lastRefresh, "HH:mm")}`
                : ""}
          </>
        }
        actions={
          <>
            <Button
              variant="primary"
              icon={UserPlus}
              onClick={() => router.push("/dashboard/receptionist/visits/new")}
            >
              New visit
            </Button>
            <Button
              icon={RefreshCw}
              onClick={() => fetchQueue(true)}
              disabled={refreshing || loading}
              style={{ padding: 0, width: 38 }}
            />
          </>
        }
      />

      {error && (
        <Banner
          tone="critical"
          icon={AlertCircle}
          action={
            <Button variant="ghost" size="sm" onClick={() => fetchQueue(false)}>
              Retry
            </Button>
          }
        >
          {error}
        </Banner>
      )}

      <KpiGrid>
        <KpiCard
          label="Waiting"
          value={counts.waiting}
          sub="Not yet seen"
          icon={Clock}
          tone="urgent"
          loading={loading}
          onClick={() => setFilterStatus("waiting")}
        />
        <KpiCard
          label="In progress"
          value={counts.inProgress}
          sub="Currently in care"
          icon={Activity}
          tone="info"
          loading={loading}
          onClick={() => setFilterStatus("in-progress")}
        />
        <KpiCard
          label="Completed"
          value={counts.done}
          sub="Discharged today"
          icon={CheckCircle2}
          tone="success"
          loading={loading}
          onClick={() => setFilterStatus("completed")}
        />
        <KpiCard
          label="Urgent+"
          value={counts.urgent}
          sub="Urgent, emergency or critical"
          icon={Zap}
          tone="critical"
          loading={loading}
        />
      </KpiGrid>

      <Card>
        <CardHeader
          icon={Users}
          title="Patient queue"
          subtitle="Priority-sorted · longest wait first"
          right={
            <div className="hidden sm:flex items-center" style={{ gap: 6 }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background:
                    onlineNurses.length > 0 ? "var(--green-600)" : "var(--ink-300)",
                }}
              />
              <span style={{ font: "500 12px/1 var(--font-sans)", color: "var(--text-secondary)" }}>
                {onlineNurses.length} nurse{onlineNurses.length !== 1 ? "s" : ""} online
              </span>
            </div>
          }
        />

        {/* Filters */}
        <div
          className="flex items-center justify-between flex-wrap"
          style={{
            gap: 12,
            padding: "12px 20px",
            borderBottom: "1px solid var(--border-faint)",
          }}
        >
          <SegmentedControl<FilterStatus>
            value={filterStatus}
            onChange={setFilterStatus}
            options={[
              { value: "all", label: "All", count: queue.length },
              { value: "waiting", label: "Waiting", count: counts.waiting },
              { value: "in-progress", label: "In progress", count: counts.inProgress },
              { value: "completed", label: "Completed", count: counts.done },
            ]}
          />
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search ticket, name, reason…"
            icon={Search}
            clearIcon={X}
            style={{ flex: "1 1 220px", maxWidth: 320 }}
          />
        </div>

        {/* Column headers */}
        <div
          className="hidden lg:grid items-center"
          style={{
            gridTemplateColumns: GRID,
            gap: 14,
            padding: "9px 20px",
            background: "var(--surface-sunken)",
            borderBottom: "1px solid var(--border-faint)",
          }}
        >
          <SectionLabel>Ticket</SectionLabel>
          <span />
          <SectionLabel>Patient</SectionLabel>
          <SectionLabel style={{ textAlign: "right" }}>Wait</SectionLabel>
          <SectionLabel>Priority</SectionLabel>
          <SectionLabel>Status</SectionLabel>
          <SectionLabel style={{ textAlign: "right" }}>Action</SectionLabel>
        </div>

        {loading ? (
          [...Array(6)].map((_, i) => <SkeletonRow key={i} />)
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={Users}
            title={isFiltered ? "No patients match" : "Queue is empty"}
            message={
              isFiltered
                ? "Try a different status or clear the search."
                : "Register the first visit of the day to get started."
            }
            pad={64}
            action={
              isFiltered ? (
                <Button
                  size="sm"
                  onClick={() => {
                    setFilterStatus("all");
                    setSearch("");
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  icon={UserPlus}
                  onClick={() => router.push("/dashboard/receptionist/visits/new")}
                >
                  Create first visit
                </Button>
              )
            }
          />
        ) : (
          sorted.map((item, idx) => {
            const p = getP(item.priority);
            const isDone = item.status === "completed";
            const isActive = item.status === "in-progress";
            const isWaiting = item.status === "waiting";

            return (
              <div
                key={item.id}
                className="grid items-center"
                style={{
                  gridTemplateColumns: GRID,
                  gap: 14,
                  padding: "12px 20px",
                  borderBottom: "1px solid var(--border-faint)",
                  opacity: isDone ? 0.55 : 1,
                  transition: "background var(--dur-fast) var(--ease-standard)",
                }}
                {...hoverRow}
              >
                {/* Queue position + ticket */}
                <div className="flex flex-col items-start" style={{ gap: 4 }}>
                  <span
                    className="inline-flex items-center justify-center"
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "var(--r-xs)",
                      background: isActive ? "var(--brand-tint)" : "var(--surface-sunken)",
                      color: isActive ? "var(--green-700)" : "var(--text-muted)",
                      font: "700 12px/1 var(--font-sans)",
                    }}
                  >
                    {idx + 1}
                  </span>
                  <MonoTag style={{ height: 16, padding: "0 5px", fontSize: 10 }}>
                    {item.ticket}
                  </MonoTag>
                </div>

                <Avatar name={item.name} seed={idx} />

                <div className="min-w-0 flex flex-col" style={{ gap: 4 }}>
                  <div className="flex items-baseline min-w-0" style={{ gap: 7 }}>
                    <button
                      onClick={() =>
                        router.push(`/dashboard/receptionist/visits/${item.id}`)
                      }
                      className="truncate text-left"
                      style={{
                        margin: 0,
                        border: "none",
                        background: "transparent",
                        padding: 0,
                        cursor: "pointer",
                        font: "600 14px/1.2 var(--font-sans)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {item.name}
                    </button>
                    {item.age ? (
                      <span
                        className="flex-shrink-0"
                        style={{ font: "400 12px/1 var(--font-sans)", color: "var(--text-muted)" }}
                      >
                        {item.age} yrs
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center min-w-0" style={{ gap: 10 }}>
                    {item.doctor && (
                      <span
                        className="flex-shrink-0"
                        style={{ font: "500 11.5px/1 var(--font-sans)", color: "var(--text-muted)" }}
                      >
                        Dr. {item.doctor}
                      </span>
                    )}
                    {item.assignedNurseName && (
                      <span
                        className="inline-flex items-center flex-shrink-0"
                        style={{
                          gap: 4,
                          font: "500 11.5px/1 var(--font-sans)",
                          color: "var(--green-800)",
                        }}
                      >
                        <UserCheck className="w-3 h-3" />
                        {item.assignedNurseName}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right flex flex-col" style={{ gap: 3 }}>
                  <span style={{ font: "600 13px/1 var(--font-mono)", color: waitInk(item.waitMins) }}>
                    {queueWaitLabel(item.waitMins)}
                  </span>
                  {item.waitMins !== null && item.waitMins > 45 && !isDone && (
                    <span
                      style={{ font: "500 10.5px/1 var(--font-sans)", color: "var(--critical-ink)" }}
                    >
                      overdue
                    </span>
                  )}
                </div>

                <Pill tone={p.tone} dot={["critical", "emergency"].includes(item.priority) && !isDone}>
                  {p.label}
                </Pill>

                <StatusPill status={item.status} />

                {/* Actions */}
                <div className="relative flex items-center justify-end" style={{ gap: 10 }}>
                  {isWaiting && (
                    <>
                      <Button
                        size="sm"
                        icon={assigning === item.id ? undefined : User}
                        loading={assigning === item.id}
                        onClick={() =>
                          setShowNurseDropdown(
                            showNurseDropdown === item.id ? null : item.id,
                          )
                        }
                      >
                        Assign
                      </Button>

                      {showNurseDropdown === item.id && (
                        <div
                          className="absolute right-0 z-20"
                          style={{
                            top: 34,
                            width: 210,
                            background: "var(--surface-card)",
                            borderRadius: "var(--r-sm)",
                            border: "1px solid var(--hc-border)",
                            boxShadow: "var(--elev-3)",
                            overflow: "hidden",
                          }}
                        >
                          <SectionLabel
                            style={{
                              padding: "9px 12px",
                              borderBottom: "1px solid var(--border-faint)",
                            }}
                          >
                            Assign nurse
                          </SectionLabel>

                          <div style={{ maxHeight: 200, overflowY: "auto", padding: 4 }}>
                            {onlineNurses.length === 0 ? (
                              <p
                                style={{
                                  margin: 0,
                                  padding: "14px 12px",
                                  textAlign: "center",
                                  font: "400 12.5px/1.3 var(--font-sans)",
                                  color: "var(--text-muted)",
                                }}
                              >
                                No nurses online
                              </p>
                            ) : (
                              onlineNurses.map((nurse) => (
                                <button
                                  key={nurse.id}
                                  onClick={() => assignNurse(item.id, nurse.id)}
                                  disabled={assigning === item.id}
                                  className="w-full flex items-center text-left"
                                  style={{
                                    gap: 9,
                                    padding: "8px 9px",
                                    border: "none",
                                    borderRadius: "var(--r-xs)",
                                    background: "transparent",
                                    cursor: "pointer",
                                  }}
                                  {...hoverRow}
                                >
                                  <Avatar
                                    name={`${nurse.firstName} ${nurse.lastName}`}
                                    size={26}
                                    seed={1}
                                  />
                                  <span
                                    className="flex-1 min-w-0 truncate"
                                    style={{
                                      font: "500 12.5px/1 var(--font-sans)",
                                      color: "var(--text-primary)",
                                    }}
                                  >
                                    {nurse.firstName} {nurse.lastName}
                                  </span>
                                  {assigning === item.id && (
                                    <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />
                                  )}
                                </button>
                              ))
                            )}
                          </div>

                          <button
                            onClick={() => setShowNurseDropdown(null)}
                            className="w-full"
                            style={{
                              padding: 8,
                              border: "none",
                              borderTop: "1px solid var(--border-faint)",
                              background: "transparent",
                              font: "500 11.5px/1 var(--font-sans)",
                              color: "var(--text-muted)",
                              cursor: "pointer",
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </>
                  )}

                  {isActive && (
                    <Button
                      variant="primary"
                      size="sm"
                      icon={Play}
                      onClick={() => router.push(`/dashboard/receptionist/visits/${item.id}`)}
                    >
                      Continue
                    </Button>
                  )}

                  {isDone && (
                    <LinkAction
                      onClick={() =>
                        router.push(`/dashboard/receptionist/visits/${item.id}`)
                      }
                    >
                      Details
                    </LinkAction>
                  )}
                </div>
              </div>
            );
          })
        )}

        {!loading && queue.length > 0 && (
          <div
            className="flex items-center justify-center"
            style={{ gap: 8, padding: "12px 20px" }}
          >
            <span style={{ font: "400 12px/1 var(--font-sans)", color: "var(--text-muted)" }}>
              Showing {sorted.length} of {queue.length} visit
              {queue.length !== 1 ? "s" : ""}
            </span>
            {isFiltered && (
              <LinkAction
                arrow={false}
                onClick={() => {
                  setFilterStatus("all");
                  setSearch("");
                }}
              >
                Clear filters
              </LinkAction>
            )}
          </div>
        )}
      </Card>
    </Page>
  );
}
