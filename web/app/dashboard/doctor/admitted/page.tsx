"use client";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { differenceInHours } from "date-fns";
import {
  BedDouble,
  RefreshCw,
  Search,
  Clock,
  Stethoscope,
  ChevronRight,
  AlertTriangle,
  X,
} from "lucide-react";
import {
  Page,
  PageHeader,
  Card,
  KpiCard,
  KpiGrid,
  Pill as Badge,
  MonoTag,
  Avatar,
  Button,
  EmptyState,
  SkeletonRow,
  SearchInput,
  SectionLabel,
  hoverRow,
} from "@/components/dashboard/ui";
import { getPriority } from "../vocab";

/* ==========================================================================
   Admitted patients — every current inpatient at the institution.

   Length of stay is the column that matters here: a stay past 72 hours is
   worth a second look, so it earns colour while shorter stays stay quiet.
   ========================================================================== */

interface Inpatient {
  id: string;
  visitNumber: string;
  patientId: string;
  patientName: string;
  gender: string;
  bloodType: string | null;
  priority: string;
  admissionDate: string;
  admittingDiagnosis: string | null;
  wardName: string | null;
  bedCode: string | null;
  doctorName: string | null;
}

/* Shared column template for the header row and every body row. */
const GRID =
  "minmax(170px, 1.6fr) 110px 100px minmax(150px, 1.4fr) minmax(140px, 1fr) 110px 130px 32px";

function StayCell({ admissionDate }: { admissionDate: string }) {
  const hours = differenceInHours(new Date(), new Date(admissionDate));
  const days = Math.floor(hours / 24);
  const label = days >= 1 ? `${days}d ${hours % 24}h` : `${hours}h`;
  const color =
    hours > 72
      ? "var(--critical-ink)"
      : hours > 24
        ? "var(--urgent-ink)"
        : "var(--text-secondary)";

  return (
    <span className="inline-flex items-center" style={{ gap: 6 }}>
      <Clock className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
      <span style={{ font: "600 12.5px/1 var(--font-mono)", color }}>{label}</span>
    </span>
  );
}

export default function AdmittedPatientsPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<Inpatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get("/api/visits/inpatients");
      setPatients(res.data?.data?.patients ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useLiveRefresh(() => load(true));

  useEffect(() => {
    load();
  }, [load]);

  const filtered = patients.filter((p) => {
    const q = search.toLowerCase();
    return (
      !q ||
      p.patientName.toLowerCase().includes(q) ||
      p.visitNumber.toLowerCase().includes(q) ||
      (p.admittingDiagnosis ?? "").toLowerCase().includes(q) ||
      (p.wardName ?? "").toLowerCase().includes(q)
    );
  });

  const critical = patients.filter(
    (p) => p.priority === "critical" || p.priority === "emergency",
  ).length;
  const noBed = patients.filter((p) => !p.bedCode).length;

  return (
    <Page maxWidth={1200}>
      <PageHeader
        eyebrow="Clinical"
        title="Admitted patients"
        subtitle="All current inpatients at your institution"
        actions={
          <Button icon={RefreshCw} onClick={() => load()} disabled={loading}>
            Refresh
          </Button>
        }
      />

      <KpiGrid min={220}>
        <KpiCard
          label="Total admitted"
          value={patients.length}
          sub="Currently inpatient"
          icon={BedDouble}
          tone="info"
          loading={loading}
        />
        <KpiCard
          label="Critical / emergency"
          value={critical}
          sub="Highest priority"
          icon={AlertTriangle}
          tone="critical"
          loading={loading}
        />
        <KpiCard
          label="Awaiting bed"
          value={noBed}
          sub="No bed assigned yet"
          icon={Clock}
          tone="urgent"
          loading={loading}
        />
      </KpiGrid>

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search by name, visit number, diagnosis, or ward…"
        icon={Search}
        clearIcon={X}
        style={{ maxWidth: 420 }}
      />

      <Card>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 1040 }}>
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
              <SectionLabel>Visit</SectionLabel>
              <SectionLabel>Priority</SectionLabel>
              <SectionLabel>Admitting diagnosis</SectionLabel>
              <SectionLabel>Ward / bed</SectionLabel>
              <SectionLabel>Stay</SectionLabel>
              <SectionLabel>Doctor</SectionLabel>
              <span />
            </div>

            {loading ? (
              [...Array(6)].map((_, i) => <SkeletonRow key={i} />)
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={BedDouble}
                title={
                  search ? "No patients match your search" : "No admitted patients"
                }
                message={
                  search
                    ? "Try a different name, visit number, diagnosis, or ward."
                    : "Nobody is currently admitted at your institution."
                }
                tone="neutral"
                pad={64}
              />
            ) : (
              filtered.map((p, i) => {
                const pr = getPriority(p.priority);
                return (
                  <div
                    key={p.id}
                    onClick={() => router.push(`/dashboard/doctor/visit/${p.id}`)}
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
                    <div className="flex items-center min-w-0" style={{ gap: 10 }}>
                      <Avatar name={p.patientName} size={30} seed={i} />
                      <div className="min-w-0 flex flex-col" style={{ gap: 4 }}>
                        <span
                          className="truncate"
                          style={{
                            font: "600 13px/1 var(--font-sans)",
                            color: "var(--text-primary)",
                          }}
                        >
                          {p.patientName}
                        </span>
                        <span
                          style={{
                            font: "400 11px/1 var(--font-sans)",
                            color: "var(--text-muted)",
                            textTransform: "capitalize",
                          }}
                        >
                          {p.gender}
                          {p.bloodType ? ` · ${p.bloodType}` : ""}
                        </span>
                      </div>
                    </div>

                    <MonoTag style={{ justifySelf: "start" }}>{p.visitNumber}</MonoTag>

                    <Badge tone={pr.tone} style={{ justifySelf: "start" }}>
                      {pr.label}
                    </Badge>

                    <span
                      className="truncate"
                      style={{
                        font: "400 12.5px/1 var(--font-sans)",
                        color: p.admittingDiagnosis
                          ? "var(--text-secondary)"
                          : "var(--text-disabled)",
                      }}
                    >
                      {p.admittingDiagnosis ?? "—"}
                    </span>

                    {p.wardName || p.bedCode ? (
                      <span
                        className="inline-flex items-center min-w-0"
                        style={{ gap: 6 }}
                      >
                        <BedDouble
                          className="w-3 h-3 flex-shrink-0"
                          style={{ color: "var(--info-ink)" }}
                        />
                        <span
                          className="truncate"
                          style={{
                            font: "600 12px/1 var(--font-sans)",
                            color: "var(--text-secondary)",
                          }}
                        >
                          {p.wardName ?? ""}
                          {p.bedCode ? ` · Bed ${p.bedCode}` : ""}
                        </span>
                      </span>
                    ) : (
                      <Badge tone="urgent" style={{ justifySelf: "start" }}>
                        Awaiting bed
                      </Badge>
                    )}

                    <StayCell admissionDate={p.admissionDate} />

                    {p.doctorName ? (
                      <span
                        className="inline-flex items-center min-w-0"
                        style={{ gap: 6 }}
                      >
                        <Stethoscope
                          className="w-3 h-3 flex-shrink-0"
                          style={{ color: "var(--text-muted)" }}
                        />
                        <span
                          className="truncate"
                          style={{
                            font: "400 12px/1 var(--font-sans)",
                            color: "var(--text-secondary)",
                          }}
                        >
                          Dr. {p.doctorName}
                        </span>
                      </span>
                    ) : (
                      <span
                        style={{
                          font: "400 12px/1 var(--font-sans)",
                          color: "var(--text-disabled)",
                        }}
                      >
                        Unassigned
                      </span>
                    )}

                    <ChevronRight
                      className="w-4 h-4 justify-self-end"
                      style={{ color: "var(--text-disabled)" }}
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Card>
    </Page>
  );
}
