"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";
import { patientApi } from "@/lib/api";
import {
  Search,
  Users,
  UserPlus,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  Calendar,
  X,
} from "lucide-react";
import { MinorBadge } from "@/components/ui/MinorBadge";
import {
  Page,
  PageHeader,
  Card,
  Button,
  Avatar,
  Banner,
  EmptyState,
  SkeletonRow,
  SectionLabel,
  SearchInput,
  hoverRow,
} from "@/components/dashboard/ui";

/* ==========================================================================
   All-patients register.

   Paginated by offset rather than page number, because the list is appended
   in place ("Load more") instead of replaced — the receptionist keeps their
   scroll position while widening the result set.
   ========================================================================== */

// ── Types ─────────────────────────────────────────────────────────────────────
interface Patient {
  id: string;
  blockchainAddress: string;
  firstName: string;
  lastName: string;
  gender: string;
  createdAt: string;
  isMinor?: boolean;
  temporaryPatientId?: string;
}

interface PatientListProps {
  onSelectPatient: (patientId: string) => void;
  onRegister: () => void;
}

/* Shared column template for the header row and every body row. */
const GRID = "38px minmax(180px, 1fr) 110px 140px 32px";

// ── Component ─────────────────────────────────────────────────────────────────
export default function PatientList({
  onSelectPatient,
  onRegister,
}: PatientListProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const LIMIT = 20;

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input — one request per pause in typing.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setOffset(0);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  const fetchPatients = useCallback(
    async (reset = true) => {
      if (reset) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const currentOffset = reset ? 0 : offset;
        const res = await patientApi.searchPaginated({
          q: debouncedSearch || undefined,
          limit: LIMIT,
          offset: currentOffset,
        });
        const { patients: newPatients } = res.data.data;
        setPatients((prev) =>
          reset ? (newPatients as Patient[]) : [...prev, ...(newPatients as Patient[])],
        );
        // A short page means we have reached the end.
        setHasMore(newPatients.length === LIMIT);
        setOffset(currentOffset + newPatients.length);
      } catch (err: any) {
        setError(err.response?.data?.error?.message ?? "Failed to load patients.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [debouncedSearch, offset],
  );

  useEffect(() => {
    fetchPatients(true);
  }, [debouncedSearch]);

  useLiveRefresh(async () => {
    const limit = Math.max(LIMIT, patients.length);
    const res = await patientApi.searchPaginated({ q: debouncedSearch || undefined, limit, offset: 0 });
    const nextPatients = res.data.data.patients as Patient[];
    setPatients(nextPatients);
    setOffset(nextPatients.length);
    setHasMore(nextPatients.length === limit);
  }, !loading && !loadingMore && search === debouncedSearch);

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("en-ZM", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return iso;
    }
  };

  /* Patient names are stored encrypted, so a free-text query cannot match
     them server-side — only an exact UUID resolves. Say so rather than
     letting an empty result look like "no such patient". */
  const isUuidQuery = /^[0-9a-f-]{36}$/i.test(search);

  return (
    <Page>
      <PageHeader
        eyebrow="Records"
        title="All patients"
        subtitle="Patients registered at your institution"
        actions={
          <>
            <Button variant="primary" icon={UserPlus} onClick={onRegister}>
              Register patient
            </Button>
            <Button
              icon={RefreshCw}
              onClick={() => fetchPatients(true)}
              disabled={loading}
              style={{ padding: 0, width: 38 }}
            />
          </>
        }
      />

      <Card>
        {/* Search */}
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-faint)" }}>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by name, national ID, or patient ID…"
            icon={Search}
            clearIcon={X}
          />
        </div>

        {search && !isUuidQuery && (
          <div style={{ padding: "10px 20px", borderBottom: "1px solid var(--border-faint)" }}>
            <Banner tone="urgent" icon={AlertCircle}>
              Patient names are encrypted for privacy. Search by exact patient UUID to
              find a specific patient.
            </Banner>
          </div>
        )}

        {error && (
          <div style={{ padding: "10px 20px", borderBottom: "1px solid var(--border-faint)" }}>
            <Banner
              tone="critical"
              icon={AlertCircle}
              action={
                <Button variant="ghost" size="sm" onClick={() => fetchPatients(true)}>
                  Retry
                </Button>
              }
            >
              {error}
            </Banner>
          </div>
        )}

        {/* Column headers */}
        <div
          className="hidden md:grid items-center"
          style={{
            gridTemplateColumns: GRID,
            gap: 14,
            padding: "9px 20px",
            background: "var(--surface-sunken)",
            borderBottom: "1px solid var(--border-faint)",
          }}
        >
          <span />
          <SectionLabel>Patient</SectionLabel>
          <SectionLabel>Gender</SectionLabel>
          <SectionLabel>Registered</SectionLabel>
          <span />
        </div>

        {loading ? (
          Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
        ) : patients.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No patients found"
            message={
              search
                ? "No patient matches that query."
                : "No patients are registered at your institution yet."
            }
            pad={64}
            action={
              <Button variant="primary" size="sm" icon={UserPlus} onClick={onRegister}>
                Register patient
              </Button>
            }
          />
        ) : (
          patients.map((p, i) => (
            <div
              key={p.id}
              onClick={() => onSelectPatient(p.id)}
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
              <Avatar name={`${p.firstName} ${p.lastName}`} seed={i} />

              <div className="min-w-0 flex flex-col" style={{ gap: 4 }}>
                <div className="flex items-center flex-wrap" style={{ gap: 7 }}>
                  <span
                    className="truncate"
                    style={{
                      font: "600 14px/1.2 var(--font-sans)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {p.firstName} {p.lastName}
                  </span>
                  {p.isMinor && <MinorBadge />}
                </div>
                <span
                  style={{ font: "400 11px/1 var(--font-mono)", color: "var(--text-muted)" }}
                >
                  {p.temporaryPatientId ?? `${p.id.slice(0, 8)}…`}
                </span>
              </div>

              <span
                style={{
                  font: "500 12.5px/1 var(--font-sans)",
                  color: "var(--text-secondary)",
                  textTransform: "capitalize",
                }}
              >
                {p.gender}
              </span>

              <span
                className="inline-flex items-center"
                style={{
                  gap: 6,
                  font: "400 12.5px/1 var(--font-sans)",
                  color: "var(--text-secondary)",
                }}
              >
                <Calendar className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                {formatDate(p.createdAt)}
              </span>

              <ChevronRight
                className="w-4 h-4 justify-self-end"
                style={{ color: "var(--text-disabled)" }}
              />
            </div>
          ))
        )}

        {!loading && patients.length > 0 && (
          <div
            className="flex flex-col items-center"
            style={{ gap: 10, padding: "14px 20px" }}
          >
            {hasMore && (
              <Button size="sm" loading={loadingMore} onClick={() => fetchPatients(false)}>
                {loadingMore ? "Loading…" : "Load more"}
              </Button>
            )}
            <p
              style={{
                margin: 0,
                font: "400 12px/1 var(--font-sans)",
                color: "var(--text-muted)",
              }}
            >
              Showing {patients.length} patient{patients.length !== 1 ? "s" : ""}
              {!hasMore ? " · all loaded" : ""}
            </p>
          </div>
        )}
      </Card>
    </Page>
  );
}
