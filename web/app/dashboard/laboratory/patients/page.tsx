"use client";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { patientApi } from "@/lib/api";
import {
  Search,
  X,
  Users,
  ChevronRight,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import {
  Page,
  PageHeader,
  Card,
  Pill as Badge,
  MonoTag,
  Avatar,
  Button,
  Banner,
  EmptyState,
  SkeletonRow,
  SectionLabel,
  hoverRow,
} from "@/components/dashboard/ui";

/* ==========================================================================
   Patient records (laboratory view).

   Search is submit-driven rather than live: patient names are stored
   encrypted, so a partial query cannot match server-side and firing a request
   per keystroke would return nothing useful. The user presses Enter or the
   button when they have a complete name, NRC, or patient ID.
   ========================================================================== */

const PER_PAGE = 25;

/* Shared column template for the header row and every body row. */
const GRID = "minmax(200px, 2fr) 150px 90px 110px 110px 32px";

function calcAge(dob?: string) {
  if (!dob) return "—";
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25)) + " yrs";
}

export default function LabPatientsPage() {
  const router = useRouter();

  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError("");
      try {
        const res = await patientApi.searchPaginated({
          q: search.trim() || undefined,
          limit: PER_PAGE,
          offset: (page - 1) * PER_PAGE,
        });
        setPatients(res.data.data?.patients ?? []);
        setTotal(res.data.data?.total ?? 0);
      } catch (err: any) {
        setError(
          err.response?.data?.error?.message ||
            "Failed to load patients. Please try again.",
        );
        setPatients([]);
        setTotal(0);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [search, page],
  );

  useLiveRefresh(() => load(true));

  useEffect(() => {
    load();
  }, [load]);

  // A new query invalidates the current page position.
  useEffect(() => {
    setPage(1);
  }, [search]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load(true);
  };

  const handleSearch = () => setSearch(inputVal.trim());

  const handleClear = () => {
    setInputVal("");
    setSearch("");
    inputRef.current?.focus();
  };

  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <Page maxWidth={1100}>
      <PageHeader
        eyebrow="Laboratory"
        title="Patient records"
        subtitle={
          loading
            ? "Loading patients…"
            : total > 0
              ? `${total} patient${total !== 1 ? "s" : ""} found`
              : "Search or browse all patients"
        }
        actions={
          <Button
            icon={RefreshCw}
            onClick={handleRefresh}
            disabled={refreshing || loading}
          >
            Refresh
          </Button>
        }
      />

      {/* Search */}
      <Card pad={16}>
        <div className="flex flex-wrap" style={{ gap: 10 }}>
          <div
            className="relative flex items-center"
            style={{
              flex: "1 1 240px",
              minWidth: 0,
              height: 40,
              borderRadius: "var(--r-sm)",
              border: `1px solid ${focused ? "var(--brand)" : "var(--hc-border)"}`,
              background: "var(--surface-card)",
              boxShadow: focused ? "0 0 0 3px var(--focus-ring)" : "none",
              transition: "border-color var(--dur-fast), box-shadow var(--dur-fast)",
            }}
          >
            <Search
              className="w-4 h-4 flex-shrink-0"
              style={{ marginLeft: 12, color: "var(--text-muted)" }}
            />
            <input
              ref={inputRef}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Search by name, National ID, or patient ID…"
              style={{
                flex: 1,
                minWidth: 0,
                height: "100%",
                padding: "0 10px",
                border: "none",
                outline: "none",
                background: "transparent",
                font: "400 13.5px/1 var(--font-sans)",
                color: "var(--text-primary)",
              }}
            />
            {inputVal && (
              <button
                onClick={handleClear}
                className="inline-flex items-center justify-center flex-shrink-0"
                style={{
                  width: 26,
                  height: 26,
                  marginRight: 6,
                  border: "none",
                  borderRadius: "var(--r-xs)",
                  background: "transparent",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <Button variant="primary" onClick={handleSearch} style={{ height: 40 }}>
            Search
          </Button>
        </div>

        {search && (
          <div
            className="flex items-center flex-wrap"
            style={{
              gap: 8,
              marginTop: 12,
              paddingTop: 12,
              borderTop: "1px solid var(--border-faint)",
            }}
          >
            <span
              style={{
                font: "400 12px/1 var(--font-sans)",
                color: "var(--text-muted)",
              }}
            >
              Showing results for
            </span>
            <span
              className="inline-flex items-center"
              style={{
                gap: 6,
                height: 22,
                padding: "0 10px",
                borderRadius: "var(--r-pill)",
                background: "var(--brand-tint)",
                color: "var(--green-800)",
                font: "600 11.5px/1 var(--font-sans)",
              }}
            >
              {search}
              <button
                onClick={handleClear}
                style={{
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  color: "inherit",
                  cursor: "pointer",
                  display: "inline-flex",
                }}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          </div>
        )}
      </Card>

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

      {/* Table */}
      <Card>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 780 }}>
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
              <SectionLabel>Patient</SectionLabel>
              <SectionLabel>National ID</SectionLabel>
              <SectionLabel>Age</SectionLabel>
              <SectionLabel>Gender</SectionLabel>
              <SectionLabel>Blood type</SectionLabel>
              <span />
            </div>

            {loading ? (
              Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
            ) : patients.length === 0 ? (
              <EmptyState
                icon={Users}
                title={search ? "No patients match your search" : "No patients found"}
                message={
                  search
                    ? "Try a different name, National ID, or patient ID."
                    : "Patients will appear here once registered."
                }
                tone="neutral"
                pad={64}
                action={
                  search ? (
                    <Button size="sm" onClick={handleClear}>
                      Clear search
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              patients.map((p, i) => (
                <div
                  key={p.id}
                  onClick={() => router.push(`/dashboard/laboratory/patients/${p.id}`)}
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
                  <div className="flex items-center min-w-0" style={{ gap: 12 }}>
                    <Avatar name={`${p.firstName ?? ""} ${p.lastName ?? ""}`} seed={i} />
                    <div className="min-w-0 flex flex-col" style={{ gap: 4 }}>
                      <span
                        className="truncate"
                        style={{
                          font: "600 13.5px/1 var(--font-sans)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {p.firstName} {p.lastName}
                      </span>
                      <span
                        style={{
                          font: "400 11px/1 var(--font-mono)",
                          color: "var(--text-muted)",
                        }}
                      >
                        {p.id?.slice(0, 8)}…
                      </span>
                    </div>
                  </div>

                  <MonoTag style={{ justifySelf: "start" }}>
                    {p.nationalId ?? "—"}
                  </MonoTag>

                  <span
                    style={{
                      font: "400 12.5px/1 var(--font-sans)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {calcAge(p.dateOfBirth)}
                  </span>

                  <span
                    style={{
                      font: "500 12.5px/1 var(--font-sans)",
                      color: "var(--text-secondary)",
                      textTransform: "capitalize",
                    }}
                  >
                    {p.gender ?? "—"}
                  </span>

                  {p.bloodType && p.bloodType !== "unknown" ? (
                    <Badge tone="critical" style={{ justifySelf: "start" }}>
                      {p.bloodType}
                    </Badge>
                  ) : (
                    <span style={{ color: "var(--text-disabled)" }}>—</span>
                  )}

                  <ChevronRight
                    className="w-4 h-4 justify-self-end"
                    style={{ color: "var(--text-disabled)" }}
                  />
                </div>
              ))
            )}
          </div>
        </div>

        {totalPages > 1 && (
          <div
            className="flex items-center justify-between flex-wrap"
            style={{
              gap: 12,
              padding: "12px 20px",
              borderTop: "1px solid var(--border-faint)",
              background: "var(--surface-sunken)",
            }}
          >
            <span
              style={{
                font: "400 12px/1 var(--font-sans)",
                color: "var(--text-muted)",
              }}
            >
              Showing{" "}
              <strong style={{ color: "var(--text-secondary)" }}>
                {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)}
              </strong>{" "}
              of <strong style={{ color: "var(--text-secondary)" }}>{total}</strong>
            </span>

            <div className="flex items-center" style={{ gap: 6 }}>
              <Button
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>

              {/* Window of 5 page numbers, kept centred on the current page. */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum =
                  totalPages <= 5
                    ? i + 1
                    : page <= 3
                      ? i + 1
                      : page >= totalPages - 2
                        ? totalPages - 4 + i
                        : page - 2 + i;
                const on = pageNum === page;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: "var(--r-xs)",
                      border: `1px solid ${on ? "var(--brand)" : "var(--hc-border)"}`,
                      background: on ? "var(--brand)" : "var(--surface-card)",
                      color: on ? "var(--on-brand)" : "var(--text-secondary)",
                      font: `${on ? 700 : 500} 12px/1 var(--font-sans)`,
                      cursor: "pointer",
                      transition: "all var(--dur-fast) var(--ease-standard)",
                    }}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <Button
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </Page>
  );
}
