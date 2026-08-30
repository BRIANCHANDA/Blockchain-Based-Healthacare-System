// web/src/app/dashboard/laboratory/history/page.tsx

"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { labApi } from "@/lib/api";
import {
  FlaskConical,
  Clock,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Search,
  TrendingUp,
  ClipboardList,
  User,
  X,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import {
  Page,
  PageHeader,
  Card,
  KpiCard,
  KpiGrid,
  Pill as Badge,
  MonoTag,
  Button,
  EmptyState,
  SectionLabel,
  SearchInput,
  SegmentedControl,
  TONES,
} from "@/components/dashboard/ui";
import { getUrgency } from "../vocab";

/* ==========================================================================
   My results — tests this technician has resulted, newest first.

   Grouped by day rather than paged: a technician looks for "what did I run
   this morning", not "record 41 of 300". The list appends in place via
   Load more, so scroll position survives.
   ========================================================================== */

interface ResultedTest {
  resultId: string;
  resultedAt: string;
  interpretation: string | null;
  hasAbnormal: boolean;
  abnormalFindings: string | null;
  parameterCount: number;
  order: {
    id: string;
    orderNumber: string;
    testName: string;
    testCategory: string | null;
    urgency: string;
    specimenType: string;
  };
  patient: { id: string; fullName: string };
  visit: { visitNumber: string };
}

function safeDistance(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return formatDistanceToNow(d, { addSuffix: true });
}

export default function LabHistoryPage() {
  const router = useRouter();
  const [results, setResults] = useState<ResultedTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "abnormal" | "normal">("all");

  const fetchPage = useCallback(
    async (silent = false, append = false) => {
      if (!append) {
        if (silent) setRefreshing(true);
        else setLoading(true);
      } else {
        setLoadingMore(true);
      }
      try {
        const res = await labApi.getMyResults({
          limit: 30,
          offset: append ? offset : 0,
        });
        const data = res.data?.data?.results ?? [];
        setHasMore(res.data?.data?.hasMore ?? false);
        if (append) {
          setResults((prev) => [...prev, ...data]);
          setOffset((o) => o + data.length);
        } else {
          setResults(data);
          setOffset(data.length);
        }
      } catch {
        if (!append) setResults([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [offset],
  );

  useEffect(() => {
    fetchPage();
  }, []);

  // Filter
  const filtered = useMemo(() => {
    let xs = results;
    if (filter === "abnormal") xs = xs.filter((r) => r.hasAbnormal);
    else if (filter === "normal") xs = xs.filter((r) => !r.hasAbnormal);
    if (search) {
      const q = search.toLowerCase();
      xs = xs.filter(
        (r) =>
          r.order.testName.toLowerCase().includes(q) ||
          r.patient.fullName.toLowerCase().includes(q) ||
          r.order.orderNumber.toLowerCase().includes(q) ||
          r.visit.visitNumber.toLowerCase().includes(q),
      );
    }
    return xs;
  }, [results, filter, search]);

  // Group by date
  const grouped = useMemo(() => {
    const map: Record<string, ResultedTest[]> = {};
    for (const r of filtered) {
      const d = new Date(r.resultedAt);
      const key = isNaN(d.getTime())
        ? "Unknown date"
        : format(d, "EEEE, d MMMM yyyy");
      (map[key] ??= []).push(r);
    }
    return Object.entries(map);
  }, [filtered]);

  const totalAbnormal = results.filter((r) => r.hasAbnormal).length;
  const today = results.filter((r) => {
    const d = new Date(r.resultedAt);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  }).length;

  const isFiltered = !!search || filter !== "all";

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
          Loading your results…
        </p>
      </div>
    );
  }

  return (
    <Page maxWidth={1000}>
      <PageHeader
        eyebrow="Laboratory"
        title="My results"
        subtitle="Tests you have resulted, newest first"
        actions={
          <Button icon={RefreshCw} onClick={() => fetchPage(true)} disabled={refreshing}>
            Refresh
          </Button>
        }
      />

      <KpiGrid min={220}>
        <KpiCard
          label="Total resulted"
          value={results.length}
          sub="Loaded so far"
          icon={CheckCircle2}
          tone="success"
        />
        <KpiCard
          label="Today"
          value={today}
          sub={format(new Date(), "EEEE, d MMMM")}
          icon={TrendingUp}
          tone="info"
        />
        <KpiCard
          label="Abnormal flagged"
          value={totalAbnormal}
          sub="Out of range"
          icon={AlertTriangle}
          tone={totalAbnormal > 0 ? "critical" : "neutral"}
        />
      </KpiGrid>

      {/* Search + filter */}
      <div className="flex items-center justify-between flex-wrap" style={{ gap: 12 }}>
        <SegmentedControl<"all" | "abnormal" | "normal">
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: results.length },
            { value: "abnormal", label: "Abnormal", count: totalAbnormal },
            {
              value: "normal",
              label: "Normal",
              count: results.length - totalAbnormal,
            },
          ]}
        />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search test, patient, order no…"
          icon={Search}
          clearIcon={X}
          style={{ flex: "1 1 220px", maxWidth: 340 }}
        />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardList}
            title={results.length === 0 ? "No resulted tests yet" : "No matches"}
            message={
              results.length === 0
                ? "Once you result a test, it appears here."
                : "Try a different search or filter."
            }
            pad={64}
          />
        </Card>
      ) : (
        <div className="flex flex-col" style={{ gap: 22 }}>
          {grouped.map(([date, items]) => (
            <div key={date}>
              <div
                className="flex items-center"
                style={{ gap: 10, marginBottom: 10, paddingLeft: 4 }}
              >
                <SectionLabel>{date}</SectionLabel>
                <span
                  className="flex-1"
                  style={{ height: 1, background: "var(--border-faint)" }}
                />
                <span
                  style={{
                    font: "700 11.5px/1 var(--font-mono)",
                    color: "var(--text-muted)",
                  }}
                >
                  {items.length}
                </span>
              </div>

              <div className="flex flex-col" style={{ gap: 10 }}>
                {items.map((r) => {
                  const u = getUrgency(r.order.urgency);
                  const uTone = TONES[u.tone];

                  return (
                    <button
                      key={r.resultId}
                      onClick={() =>
                        router.push(`/dashboard/laboratory/queue/${r.order.id}`)
                      }
                      className="w-full text-left"
                      style={{
                        background: "var(--surface-card)",
                        border: "1px solid var(--hc-border)",
                        borderLeft: `4px solid ${uTone.dot}`,
                        borderRadius: "var(--r-md)",
                        overflow: "hidden",
                        cursor: "pointer",
                        transition: "box-shadow var(--dur-base) var(--ease-standard)",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.boxShadow = "var(--elev-2)")
                      }
                      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
                    >
                      <div className="flex items-center" style={{ gap: 14, padding: 16 }}>
                        <span
                          className="inline-flex items-center justify-center flex-shrink-0"
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: "var(--r-sm)",
                            background: uTone.tint,
                            color: uTone.ink,
                          }}
                        >
                          <FlaskConical className="w-4 h-4" />
                        </span>

                        <span className="flex-1 min-w-0 flex flex-col" style={{ gap: 6 }}>
                          <span
                            className="flex items-center flex-wrap"
                            style={{ gap: 8 }}
                          >
                            <span
                              style={{
                                font: "700 13.5px/1 var(--font-sans)",
                                color: "var(--text-primary)",
                              }}
                            >
                              {r.order.testName}
                            </span>
                            <Badge tone={u.tone} style={{ height: 18, fontSize: 10 }}>
                              {u.label}
                            </Badge>
                            {r.hasAbnormal && (
                              <Badge
                                tone="critical"
                                icon={AlertTriangle}
                                style={{ height: 18, fontSize: 10 }}
                              >
                                Abnormal
                              </Badge>
                            )}
                          </span>

                          <span
                            className="flex items-center flex-wrap"
                            style={{
                              gap: 7,
                              font: "400 12px/1 var(--font-sans)",
                              color: "var(--text-secondary)",
                            }}
                          >
                            <User
                              className="w-3 h-3"
                              style={{ color: "var(--text-muted)" }}
                            />
                            <span style={{ fontWeight: 600 }}>
                              {r.patient.fullName}
                            </span>
                            <span style={{ color: "var(--text-disabled)" }}>·</span>
                            <span>{r.visit.visitNumber}</span>
                            <span style={{ color: "var(--text-disabled)" }}>·</span>
                            <MonoTag style={{ height: 17, fontSize: 10 }}>
                              {r.order.orderNumber}
                            </MonoTag>
                            <span style={{ color: "var(--text-disabled)" }}>·</span>
                            <span style={{ textTransform: "capitalize" }}>
                              {r.order.specimenType}
                            </span>
                          </span>

                          {r.interpretation && (
                            <span
                              className="truncate"
                              style={{
                                font: "400 12px/1.3 var(--font-sans)",
                                color: "var(--text-muted)",
                                fontStyle: "italic",
                              }}
                            >
                              “{r.interpretation}”
                            </span>
                          )}
                        </span>

                        <span
                          className="hidden sm:flex flex-col items-end flex-shrink-0"
                          style={{ gap: 6 }}
                        >
                          <span
                            style={{
                              font: "600 12px/1 var(--font-sans)",
                              color: "var(--text-secondary)",
                            }}
                          >
                            {r.parameterCount}{" "}
                            {r.parameterCount === 1 ? "parameter" : "parameters"}
                          </span>
                          <span
                            className="inline-flex items-center"
                            style={{
                              gap: 5,
                              font: "500 11.5px/1 var(--font-mono)",
                              color: "var(--text-muted)",
                            }}
                          >
                            <Clock className="w-3 h-3" />
                            {safeDistance(r.resultedAt)}
                          </span>
                        </span>

                        <ChevronRight
                          className="w-4 h-4 flex-shrink-0"
                          style={{ color: "var(--text-disabled)" }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {hasMore && (
            <Button
              full
              iconRight={ChevronRight}
              loading={loadingMore}
              onClick={() => fetchPage(false, true)}
            >
              {loadingMore ? "Loading…" : "Load more"}
            </Button>
          )}
        </div>
      )}
    </Page>
  );
}
