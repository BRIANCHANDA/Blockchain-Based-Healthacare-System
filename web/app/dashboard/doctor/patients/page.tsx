"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { patientApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import {
  Search,
  User,
  Calendar,
  Phone,
  MapPin,
  ChevronRight,
  Loader2,
  AlertCircle,
  Users,
  Activity,
  FileText,
  X,
} from "lucide-react";
import { format } from "date-fns";
import {
  Page,
  PageHeader,
  Card,
  KpiCard,
  KpiGrid,
  Field,
  Select,
  Pill as Badge,
  MonoTag,
  Avatar,
  Button,
  Banner,
  EmptyState,
  SearchInput,
  SectionLabel,
  LinkAction,
  hoverRow,
} from "@/components/dashboard/ui";

/* ==========================================================================
   Patient directory (doctor view).

   Everything is filtered client-side: getAllByInstitution returns the whole
   roster once, so search and the two dropdowns narrow an in-memory list
   rather than re-querying.
   ========================================================================== */

/** Formats a date, or "—" if it is missing or unparseable. */
function safeFormatDate(d: any, fmt: string): string {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? "—" : format(dt, fmt);
}

/* Shared column template for the header row and every body row. */
const GRID =
  "minmax(180px, 1.6fr) 130px minmax(160px, 1.2fr) minmax(160px, 1.3fr) 90px 120px";

export default function DoctorPatientsPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [patients, setPatients] = useState<any[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterGender, setFilterGender] = useState<string>("all");
  const [filterBloodType, setFilterBloodType] = useState<string>("all");
  const [error, setError] = useState("");

  const institutionId = (user as any)?.institutionId;
  const institutionName = (user as any)?.institutionName;

  useEffect(() => {
    const fetchPatients = async () => {
      if (!institutionId) {
        setError("No institution assigned to your account.");
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Fetch all patients from this institution
        const res = await patientApi.getAllByInstitution(institutionId);
        const patientsData = res.data.data?.patients ?? [];
        setPatients(patientsData);
        setFilteredPatients(patientsData);
      } catch (err: any) {
        setError(err.response?.data?.error?.message ?? "Failed to load patients.");
      } finally {
        setLoading(false);
      }
    };

    fetchPatients();
  }, [institutionId]);

  // Re-filter whenever a control or the underlying roster changes.
  useEffect(() => {
    let result = [...patients];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.firstName?.toLowerCase().includes(q) ||
          p.lastName?.toLowerCase().includes(q) ||
          p.medicalRecordNumber?.toLowerCase().includes(q) ||
          p.nationalId?.toLowerCase().includes(q) ||
          p.phoneNumber?.includes(q),
      );
    }

    if (filterGender !== "all") {
      result = result.filter((p) => p.gender === filterGender);
    }

    if (filterBloodType !== "all") {
      result = result.filter((p) => p.bloodType === filterBloodType);
    }

    setFilteredPatients(result);
  }, [searchQuery, filterGender, filterBloodType, patients]);

  const handleViewPatient = (patientId: string) =>
    router.push(`/dashboard/doctor/patients/${patientId}`);

  const isFiltered =
    !!searchQuery || filterGender !== "all" || filterBloodType !== "all";

  const clearAll = () => {
    setSearchQuery("");
    setFilterGender("all");
    setFilterBloodType("all");
  };

  if (!institutionId) {
    return (
      <Page maxWidth={560}>
        <Banner tone="critical" icon={AlertCircle} title="No institution assigned">
          Contact your administrator to assign you to an institution.
        </Banner>
      </Page>
    );
  }

  if (loading) {
    return (
      <div
        className="flex flex-col items-center justify-center"
        style={{ padding: 80, gap: 12 }}
      >
        <Loader2 className="w-7 h-7 animate-spin" style={{ color: "var(--brand)" }} />
        <p
          style={{
            margin: 0,
            font: "400 13px/1 var(--font-sans)",
            color: "var(--text-muted)",
          }}
        >
          Loading patients…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <Page maxWidth={560}>
        <Banner tone="critical" icon={AlertCircle} title="Could not load patients">
          {error}
        </Banner>
      </Page>
    );
  }

  return (
    <Page maxWidth={1280}>
      <PageHeader
        eyebrow="Clinical"
        title="Patient directory"
        subtitle={`${institutionName ?? "Your institution"} · ${filteredPatients.length} of ${patients.length} patients`}
      />

      <KpiGrid min={220}>
        <KpiCard
          label="Total patients"
          value={patients.length}
          sub="Registered here"
          icon={Users}
          tone="success"
        />
        <KpiCard
          label="Filtered results"
          value={filteredPatients.length}
          sub={isFiltered ? "Matching your filters" : "No filters applied"}
          icon={Activity}
          tone="info"
        />
        <KpiCard
          label="Total visits"
          value={patients.reduce((sum, p) => sum + (p.visitCount ?? 0), 0)}
          sub="Across all patients"
          icon={FileText}
          tone="accent"
        />
      </KpiGrid>

      {/* Search and filters */}
      <Card pad={20}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 16,
          }}
        >
          <div style={{ gridColumn: "span 2", minWidth: 0 }}>
            <Field label="Search patients">
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Name, MRN, National ID, phone…"
                icon={Search}
                clearIcon={X}
                style={{ height: 40, boxShadow: "none" }}
              />
            </Field>
          </div>

          <Field label="Gender">
            <Select
              value={filterGender}
              onChange={(e) => setFilterGender(e.target.value)}
            >
              <option value="all">All</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </Select>
          </Field>

          <Field label="Blood type">
            <Select
              value={filterBloodType}
              onChange={(e) => setFilterBloodType(e.target.value)}
            >
              <option value="all">All</option>
              {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bt) => (
                <option key={bt} value={bt}>
                  {bt}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {isFiltered && (
          <div
            className="flex items-center flex-wrap"
            style={{
              gap: 8,
              marginTop: 14,
              paddingTop: 14,
              borderTop: "1px solid var(--border-faint)",
            }}
          >
            <SectionLabel>Active filters</SectionLabel>
            {searchQuery && <Badge tone="brand">Search: “{searchQuery}”</Badge>}
            {filterGender !== "all" && (
              <Badge tone="info" style={{ textTransform: "capitalize" }}>
                {filterGender}
              </Badge>
            )}
            {filterBloodType !== "all" && (
              <Badge tone="critical">Blood: {filterBloodType}</Badge>
            )}
            <LinkAction arrow={false} onClick={clearAll}>
              Clear all
            </LinkAction>
          </div>
        )}
      </Card>

      {/* Patient list */}
      <Card>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 940 }}>
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
              <SectionLabel>MRN</SectionLabel>
              <SectionLabel>Demographics</SectionLabel>
              <SectionLabel>Contact</SectionLabel>
              <SectionLabel>Visits</SectionLabel>
              <SectionLabel style={{ textAlign: "right" }}>Actions</SectionLabel>
            </div>

            {filteredPatients.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No patients found"
                message={
                  isFiltered
                    ? "Try adjusting your filters."
                    : "No patients are registered at this institution yet."
                }
                tone="neutral"
                pad={64}
                action={
                  isFiltered ? (
                    <Button size="sm" onClick={clearAll}>
                      Clear filters
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              filteredPatients.map((patient, i) => (
                <div
                  key={patient.id}
                  onClick={() => handleViewPatient(patient.id)}
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
                  <div className="flex items-center min-w-0" style={{ gap: 11 }}>
                    <Avatar
                      name={`${patient.firstName ?? ""} ${patient.lastName ?? ""}`}
                      size={34}
                      seed={i}
                    />
                    <div className="min-w-0 flex flex-col" style={{ gap: 4 }}>
                      <span
                        className="truncate"
                        style={{
                          font: "600 13.5px/1 var(--font-sans)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {patient.firstName} {patient.lastName}
                      </span>
                      <span
                        style={{
                          font: "400 11px/1 var(--font-mono)",
                          color: "var(--text-muted)",
                        }}
                      >
                        {patient.nationalId ?? "—"}
                      </span>
                    </div>
                  </div>

                  <MonoTag style={{ justifySelf: "start" }}>
                    {patient.medicalRecordNumber}
                  </MonoTag>

                  <div className="min-w-0 flex flex-col" style={{ gap: 5 }}>
                    <span
                      className="inline-flex items-center"
                      style={{
                        gap: 6,
                        font: "400 12px/1 var(--font-sans)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      <User className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                      <span style={{ textTransform: "capitalize" }}>
                        {patient.gender}
                      </span>
                      {patient.bloodType && (
                        <>
                          <span style={{ color: "var(--text-disabled)" }}>·</span>
                          <span
                            style={{
                              font: "700 11.5px/1 var(--font-mono)",
                              color: "var(--critical-ink)",
                            }}
                          >
                            {patient.bloodType}
                          </span>
                        </>
                      )}
                    </span>
                    <span
                      className="inline-flex items-center"
                      style={{
                        gap: 6,
                        font: "400 11.5px/1 var(--font-sans)",
                        color: "var(--text-muted)",
                      }}
                    >
                      <Calendar
                        className="w-3 h-3"
                        style={{ color: "var(--text-muted)" }}
                      />
                      {safeFormatDate(patient.dateOfBirth, "dd MMM yyyy")}
                    </span>
                  </div>

                  <div className="min-w-0 flex flex-col" style={{ gap: 5 }}>
                    {patient.phoneNumber && (
                      <span
                        className="inline-flex items-center"
                        style={{
                          gap: 6,
                          font: "400 12px/1 var(--font-sans)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        <Phone
                          className="w-3 h-3 flex-shrink-0"
                          style={{ color: "var(--text-muted)" }}
                        />
                        {patient.phoneNumber}
                      </span>
                    )}
                    {patient.address && (
                      <span
                        className="inline-flex items-center min-w-0"
                        style={{
                          gap: 6,
                          font: "400 11.5px/1 var(--font-sans)",
                          color: "var(--text-muted)",
                        }}
                      >
                        <MapPin
                          className="w-3 h-3 flex-shrink-0"
                          style={{ color: "var(--text-muted)" }}
                        />
                        <span className="truncate">{patient.address}</span>
                      </span>
                    )}
                  </div>

                  <span className="inline-flex items-center" style={{ gap: 8 }}>
                    <span
                      className="inline-flex items-center justify-center"
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: "var(--r-xs)",
                        background: "var(--info-tint)",
                        color: "var(--info-ink)",
                        font: "700 12.5px/1 var(--font-sans)",
                      }}
                    >
                      {patient.visitCount ?? 0}
                    </span>
                  </span>

                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      iconRight={ChevronRight}
                      onClick={(e) => {
                        // The row already navigates — don't fire it twice.
                        e.stopPropagation();
                        handleViewPatient(patient.id);
                      }}
                    >
                      View
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Card>
    </Page>
  );
}
