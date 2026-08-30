"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { visitApi } from "@/lib/api";
import {
  Pill,
  Clock,
  ChevronRight,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Search,
  AlertCircle,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  Page,
  PageHeader,
  Card,
  Pill as Badge,
  Button,
  Banner,
  EmptyState,
  SearchInput,
  SegmentedControl,
  type Tone,
} from "@/components/dashboard/ui";

/* ==========================================================================
   Dispensing queue — every prescription still awaiting the pharmacy.

   Wait time drives the whole visual hierarchy here: a prescription past 30
   minutes is tinted amber, past 60 it goes coral. Nothing else on the row
   competes for that attention.
   ========================================================================== */

const STATUS_CONFIG: Record<string, { tone: Tone; label: string }> = {
  prescribed: { tone: "urgent", label: "Prescribed" },
  dispensing: { tone: "info", label: "In progress" },
};
const getStatus = (s: string) => STATUS_CONFIG[s] ?? STATUS_CONFIG.prescribed;

const THIRTY_MIN = 30 * 60 * 1000;
const SIXTY_MIN = 60 * 60 * 1000;

type Filter = "all" | "prescribed" | "dispensing";

export default function PharmacyQueuePage() {
  const router = useRouter();
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await (visitApi as any).getPendingPrescriptions();
      setPrescriptions(res.data.data?.prescriptions ?? []);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const filtered = prescriptions
    .filter((p) => filter === "all" || p.status === filter)
    .filter(
      (p) =>
        !search ||
        p.prescriptionNumber?.toLowerCase().includes(search.toLowerCase()) ||
        p.visitNumber?.toLowerCase().includes(search.toLowerCase()),
    );

  const longWaiting = prescriptions.filter(
    (p) => Date.now() - new Date(p.prescribedAt).getTime() > THIRTY_MIN,
  ).length;

  const countFor = (f: Filter) =>
    f === "all"
      ? prescriptions.length
      : prescriptions.filter((p) => p.status === f).length;

  if (loading) {
    return (
      <div
        className="flex flex-col items-center justify-center"
        style={{ minHeight: 256, gap: 12 }}
      >
        <Loader2 className="w-7 h-7 animate-spin" style={{ color: "var(--brand)" }} />
        <p
          style={{
            margin: 0,
            font: "400 13px/1 var(--font-sans)",
            color: "var(--text-muted)",
          }}
        >
          Loading queue…
        </p>
      </div>
    );
  }

  return (
    <Page maxWidth={1000}>
      <PageHeader
        eyebrow="Pharmacy"
        title="Dispensing queue"
        subtitle={`${prescriptions.length} prescription${
          prescriptions.length !== 1 ? "s" : ""
        } pending · auto-refreshes every 60 seconds`}
        actions={
          <Button
            icon={RefreshCw}
            onClick={() => fetchData(true)}
            disabled={refreshing}
          >
            Refresh
          </Button>
        }
      />

      {longWaiting > 0 && (
        <Banner tone="urgent" icon={AlertCircle}>
          {longWaiting} prescription{longWaiting > 1 ? "s have" : " has"} been waiting
          over 30 minutes.
        </Banner>
      )}

      {/* Search + filter */}
      <div className="flex items-center justify-between flex-wrap" style={{ gap: 12 }}>
        <SegmentedControl<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: countFor("all") },
            { value: "prescribed", label: "Prescribed", count: countFor("prescribed") },
            { value: "dispensing", label: "In progress", count: countFor("dispensing") },
          ]}
        />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search prescription or visit number…"
          icon={Search}
          clearIcon={X}
          style={{ flex: "1 1 220px", maxWidth: 340 }}
        />
      </div>

      {/* Queue list */}
      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={CheckCircle2}
            title="Queue is clear"
            message={
              search || filter !== "all"
                ? "No prescriptions match the current filter."
                : "All prescriptions have been dispensed."
            }
            pad={64}
          />
        </Card>
      ) : (
        <div className="flex flex-col" style={{ gap: 12 }}>
          {filtered.map((rx) => {
            const cfg = getStatus(rx.status);
            const waited = Date.now() - new Date(rx.prescribedAt).getTime();
            const isOld = waited > THIRTY_MIN;
            const isVeryOld = waited > SIXTY_MIN;

            /* One decision drives border, chip and icon tint together. */
            const urgency = isVeryOld ? "critical" : isOld ? "urgent" : "brand";
            const edge =
              urgency === "critical"
                ? "var(--coral-500)"
                : urgency === "urgent"
                  ? "var(--amber-500)"
                  : "var(--brand)";
            const tint =
              urgency === "critical"
                ? "var(--critical-tint)"
                : urgency === "urgent"
                  ? "var(--urgent-tint)"
                  : "var(--brand-tint)";
            const ink =
              urgency === "critical"
                ? "var(--critical-ink)"
                : urgency === "urgent"
                  ? "var(--urgent-ink)"
                  : "var(--green-700)";

            const done = (rx.totalItems ?? 0) - (rx.pendingItems ?? 0);
            const pct = rx.totalItems > 0 ? (done / rx.totalItems) * 100 : 0;

            return (
              <button
                key={rx.id}
                onClick={() => router.push(`/dashboard/pharmacy/queue/${rx.id}`)}
                className="w-full text-left"
                style={{
                  background: "var(--surface-card)",
                  border: "1px solid var(--hc-border)",
                  borderLeft: `4px solid ${edge}`,
                  borderRadius: "var(--r-md)",
                  boxShadow: "var(--elev-1)",
                  overflow: "hidden",
                  cursor: "pointer",
                  transition: "box-shadow var(--dur-base) var(--ease-standard)",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.boxShadow = "var(--elev-2)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.boxShadow = "var(--elev-1)")
                }
              >
                <div className="flex items-center" style={{ gap: 14, padding: 16 }}>
                  <span
                    className="inline-flex items-center justify-center flex-shrink-0"
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "var(--r-sm)",
                      background: tint,
                      color: ink,
                    }}
                  >
                    <Pill className="w-5 h-5" />
                  </span>

                  <span className="flex-1 min-w-0 flex flex-col" style={{ gap: 5 }}>
                    <span className="flex items-center flex-wrap" style={{ gap: 8 }}>
                      <span
                        style={{
                          font: "700 13.5px/1 var(--font-mono)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {rx.prescriptionNumber}
                      </span>
                      {isVeryOld && (
                        <Badge tone="critical" icon={AlertCircle} style={{ height: 18, fontSize: 10 }}>
                          Urgent
                        </Badge>
                      )}
                      {isOld && !isVeryOld && (
                        <Badge tone="urgent" style={{ height: 18, fontSize: 10 }}>
                          Waiting long
                        </Badge>
                      )}
                    </span>

                    <span
                      className="flex items-center flex-wrap"
                      style={{
                        gap: 8,
                        font: "400 12.5px/1 var(--font-sans)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      <span>{rx.visitNumber}</span>
                      <span style={{ color: "var(--text-disabled)" }}>·</span>
                      <span>
                        {rx.pendingItems} of {rx.totalItems} item
                        {rx.totalItems != 1 ? "s" : ""} pending
                      </span>
                    </span>

                    {rx.chiefComplaint && (
                      <span
                        className="truncate"
                        style={{
                          font: "400 12px/1.3 var(--font-sans)",
                          color: "var(--text-muted)",
                          fontStyle: "italic",
                        }}
                      >
                        “{rx.chiefComplaint}”
                      </span>
                    )}
                  </span>

                  <span
                    className="flex flex-col items-end flex-shrink-0"
                    style={{ gap: 7 }}
                  >
                    <Badge tone={cfg.tone}>{cfg.label}</Badge>
                    <span
                      className="inline-flex items-center"
                      style={{
                        gap: 5,
                        font: "500 11.5px/1 var(--font-mono)",
                        color: isOld ? ink : "var(--text-muted)",
                      }}
                    >
                      <Clock className="w-3 h-3" />
                      {rx.prescribedAt && !isNaN(new Date(rx.prescribedAt).getTime())
                        ? formatDistanceToNow(new Date(rx.prescribedAt), {
                            addSuffix: true,
                          })
                        : "Unknown"}
                    </span>
                  </span>

                  <ChevronRight
                    className="w-4 h-4 flex-shrink-0"
                    style={{ color: "var(--text-disabled)" }}
                  />
                </div>

                {/* Item progress — only meaningful once some items exist. */}
                {rx.totalItems > 0 && (
                  <div style={{ padding: "0 16px 14px" }}>
                    <div
                      className="flex items-center justify-between"
                      style={{ marginBottom: 6 }}
                    >
                      <span
                        style={{
                          font: "400 11.5px/1 var(--font-sans)",
                          color: "var(--text-muted)",
                        }}
                      >
                        Dispensing progress
                      </span>
                      <span
                        style={{
                          font: "600 11.5px/1 var(--font-mono)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {done}/{rx.totalItems}
                      </span>
                    </div>
                    <div
                      style={{
                        height: 5,
                        borderRadius: "var(--r-pill)",
                        background: "var(--surface-sunken)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${pct}%`,
                          borderRadius: "var(--r-pill)",
                          background: "var(--brand)",
                          transition: "width var(--dur-slow) var(--ease-out)",
                        }}
                      />
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </Page>
  );
}
