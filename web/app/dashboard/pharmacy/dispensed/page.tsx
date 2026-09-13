"use client";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { visitApi } from "@/lib/api";
import {
  Package,
  Search,
  X,
  RefreshCw,
  CheckCircle2,
  Clock,
  Pill,
  ChevronRight,
  Calendar,
  History,
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
  EmptyState,
  SkeletonRow,
  SearchInput,
  SectionLabel,
  hoverRow,
} from "@/components/dashboard/ui";

/* ==========================================================================
   Dispense history.

   Grouped by day rather than paged: a pharmacist looks for "what went out
   this morning", not "record 41 of 300". The endpoint returns both
   camelCase and snake_case depending on which query path served it, so
   normalize() reads every field both ways before anything else touches it.
   ========================================================================== */

function normalize(p: any) {
  return {
    id: p.id ?? p.prescription_id,
    prescriptionNumber: p.prescriptionNumber ?? p.prescription_number ?? "—",
    visitNumber: p.visitNumber ?? p.visit_number ?? "—",
    patientName: p.patientName ?? p.patient_name ?? "Unknown Patient",
    itemCount: p.itemCount ?? p.item_count ?? 0,
    dispensedAt: p.dispensedAt ?? p.dispensed_at ?? null,
    dispensedBy: p.dispensedBy ?? p.dispensed_by_name ?? null,
    status: p.status ?? "dispensed",
  };
}

export default function PharmacyDispensedPage() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await (visitApi as any).getDispensedPrescriptions();
      const raw: any[] = res.data.data?.prescriptions ?? res.data.data ?? [];
      const normalized = raw
        .map(normalize)
        .sort(
          (a, b) =>
            new Date(b.dispensedAt ?? 0).getTime() -
            new Date(a.dispensedAt ?? 0).getTime(),
        );
      setItems(normalized);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useLiveRefresh(() => load(true));

  useEffect(() => {
    load();
  }, [load]);

  const filtered = items.filter((p) => {
    const q = search.toLowerCase();
    return (
      !q ||
      [p.patientName, p.prescriptionNumber, p.visitNumber].some((f) =>
        f?.toLowerCase().includes(q),
      )
    );
  });

  // Group by day. Insertion order is preserved, and `filtered` is already
  // sorted newest-first, so the groups come out newest-first too.
  const grouped = filtered.reduce((acc: Record<string, any[]>, p) => {
    const key = p.dispensedAt
      ? format(new Date(p.dispensedAt), "dd MMM yyyy")
      : "Unknown date";
    (acc[key] = acc[key] ?? []).push(p);
    return acc;
  }, {});

  const todayCount = items.filter(
    (p) =>
      p.dispensedAt &&
      format(new Date(p.dispensedAt), "yyyy-MM-dd") ===
        format(new Date(), "yyyy-MM-dd"),
  ).length;

  return (
    <Page maxWidth={1000}>
      <PageHeader
        eyebrow="Pharmacy"
        title="Dispense history"
        subtitle={
          loading ? "Loading…" : `${items.length} dispensed · ${todayCount} today`
        }
        actions={
          <Button
            icon={RefreshCw}
            onClick={() => load(true)}
            disabled={refreshing || loading}
          >
            Refresh
          </Button>
        }
      />

      <KpiGrid min={240}>
        <KpiCard
          label="Total dispensed"
          value={items.length}
          sub="All time"
          icon={Package}
          tone="success"
          loading={loading}
        />
        <KpiCard
          label="Dispensed today"
          value={todayCount}
          sub={format(new Date(), "EEEE, d MMMM")}
          icon={CheckCircle2}
          tone="info"
          loading={loading}
        />
      </KpiGrid>

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search patient, prescription, visit…"
        icon={Search}
        clearIcon={X}
        style={{ maxWidth: 380 }}
      />

      {loading ? (
        <Card>
          {[...Array(6)].map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={History}
            title={
              items.length === 0
                ? "No dispensed prescriptions yet"
                : "No results match your search"
            }
            message={
              items.length === 0
                ? "Dispensed prescriptions will appear here."
                : "Try a different search term."
            }
            tone="neutral"
            pad={64}
          />
        </Card>
      ) : (
        <div className="flex flex-col" style={{ gap: 20 }}>
          {Object.entries(grouped).map(([date, group]) => (
            <div key={date}>
              <div
                className="flex items-center"
                style={{ gap: 8, marginBottom: 8, paddingLeft: 4 }}
              >
                <Calendar className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                <SectionLabel>{date}</SectionLabel>
                <span
                  style={{
                    font: "500 11.5px/1 var(--font-mono)",
                    color: "var(--text-disabled)",
                  }}
                >
                  · {group.length}
                </span>
              </div>

              <Card>
                {group.map((p, i) => (
                  <button
                    key={p.id}
                    onClick={() => router.push(`/dashboard/pharmacy/queue/${p.id}`)}
                    className="w-full flex items-center text-left"
                    style={{
                      gap: 14,
                      padding: "12px 20px",
                      border: "none",
                      borderBottom:
                        i < group.length - 1
                          ? "1px solid var(--border-faint)"
                          : "none",
                      background: "transparent",
                      cursor: "pointer",
                      transition: "background var(--dur-fast) var(--ease-standard)",
                    }}
                    {...hoverRow}
                  >
                    <span
                      className="inline-flex items-center justify-center flex-shrink-0"
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "var(--r-sm)",
                        background: "var(--brand-tint)",
                        color: "var(--green-700)",
                      }}
                    >
                      <Package className="w-4 h-4" />
                    </span>

                    <span className="flex-1 min-w-0 flex flex-col" style={{ gap: 5 }}>
                      <span className="flex items-center flex-wrap" style={{ gap: 8 }}>
                        <span
                          className="truncate"
                          style={{
                            font: "600 13.5px/1 var(--font-sans)",
                            color: "var(--text-primary)",
                          }}
                        >
                          {p.patientName}
                        </span>
                        <span
                          style={{
                            font: "500 11px/1 var(--font-mono)",
                            color: "var(--text-muted)",
                          }}
                        >
                          {p.prescriptionNumber}
                        </span>
                      </span>

                      <span
                        className="flex items-center flex-wrap"
                        style={{
                          gap: 12,
                          font: "400 11.5px/1 var(--font-sans)",
                          color: "var(--text-muted)",
                        }}
                      >
                        <span className="inline-flex items-center" style={{ gap: 5 }}>
                          <Pill className="w-3 h-3" />
                          {p.itemCount} item{p.itemCount !== 1 ? "s" : ""}
                        </span>
                        {p.dispensedAt && (
                          <span className="inline-flex items-center" style={{ gap: 5 }}>
                            <Clock className="w-3 h-3" />
                            {formatDistanceToNow(new Date(p.dispensedAt), {
                              addSuffix: true,
                            })}
                          </span>
                        )}
                      </span>
                    </span>

                    <Badge tone="success" icon={CheckCircle2}>
                      Dispensed
                    </Badge>

                    <ChevronRight
                      className="w-4 h-4 flex-shrink-0"
                      style={{ color: "var(--text-disabled)" }}
                    />
                  </button>
                ))}
              </Card>
            </div>
          ))}
        </div>
      )}
    </Page>
  );
}
