"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { patientApi } from "@/lib/api";
import {
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Phone,
  Calendar,
  User,
  Activity,
  PlusCircle,
  MapPin,
  Heart,
  Briefcase,
  Users,
  Loader2,
} from "lucide-react";
import { format, differenceInYears } from "date-fns";
import { MinorBadge, ageFromDob } from "@/components/ui/MinorBadge";
import { PatientGuardiansSection } from "@/components/ui/PatientGuardiansSection";
import {
  Page,
  Card,
  CardHeader,
  Pill as Badge,
  MonoTag,
  Button,
  Banner,
  EmptyState,
  SectionLabel,
  LinkAction,
  hoverRow,
  TONES,
  type Tone,
} from "@/components/dashboard/ui";
import { getPriority } from "../../vocab";

/* ==========================================================================
   Patient record (doctor view).

   Reads the patient plus their full visit list. An in-progress visit is the
   thing a doctor almost always wants from here, so it is surfaced as a
   primary action rather than buried in the history list below.
   ========================================================================== */

/** Allergy severity climbs mild → life-threatening. */
const SEVERITY_TONE: Record<string, Tone> = {
  mild: "success",
  moderate: "urgent",
  severe: "critical",
  life_threatening: "accent",
};

export default function PatientDetailPage() {
  const { id: patientId } = useParams<{ id: string }>();
  const router = useRouter();
  const [patient, setPatient] = useState<any>(null);
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [patRes, visitsRes] = await Promise.all([
        patientApi.getById(patientId),
        patientApi.getVisits(patientId),
      ]);
      // The backend returns patient data directly under `data`
      setPatient(patRes.data.data);
      setVisits(visitsRes.data.data?.visits ?? []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? "Failed to load patient.");
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ minHeight: 256, gap: 12 }}
      >
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--brand)" }} />
        <p
          style={{
            margin: 0,
            font: "400 13px/1 var(--font-sans)",
            color: "var(--text-muted)",
          }}
        >
          Loading patient…
        </p>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <Page maxWidth={560}>
        <Banner
          tone="critical"
          icon={AlertCircle}
          title={error || "Patient not found"}
        >
          You may not have permission to view this patient's records.
        </Banner>
        <Button
          icon={ChevronLeft}
          onClick={() => router.back()}
          style={{ alignSelf: "flex-start" }}
        >
          Go back
        </Button>
      </Page>
    );
  }

  const activeVisit = visits.find((v) => v.status === "in-progress");
  const age = patient.dateOfBirth
    ? differenceInYears(new Date(), new Date(patient.dateOfBirth))
    : null;

  return (
    <Page maxWidth={900}>
      <Button
        variant="ghost"
        icon={ChevronLeft}
        onClick={() => router.back()}
        style={{ alignSelf: "flex-start" }}
      >
        Back
      </Button>

      {/* ── Patient header card ── */}
      <Card>
        <div style={{ padding: "20px 24px", background: "var(--brand-tint)" }}>
          <div className="flex items-start" style={{ gap: 16 }}>
            <span
              className="inline-flex items-center justify-center flex-shrink-0"
              style={{
                width: 60,
                height: 60,
                borderRadius: "50%",
                background: "var(--brand)",
                color: "var(--on-brand)",
                font: "700 19px/1 var(--font-sans)",
              }}
            >
              {patient.firstName?.[0]}
              {patient.lastName?.[0]}
            </span>

            <div className="flex-1 min-w-0">
              <div
                className="flex items-start justify-between flex-wrap"
                style={{ gap: 12 }}
              >
                <div className="min-w-0 flex flex-col" style={{ gap: 6 }}>
                  <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
                    <h1
                      style={{
                        margin: 0,
                        font: "700 20px/1.2 var(--font-sans)",
                        letterSpacing: "var(--ls-tight)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {patient.firstName} {patient.lastName}
                    </h1>
                    {patient.isMinor && (
                      <MinorBadge
                        age={
                          patient.dateOfBirth
                            ? ageFromDob(patient.dateOfBirth)
                            : undefined
                        }
                        primaryGuardianName={patient.guardians?.[0]?.guardianName}
                        primaryGuardianRelationship={
                          patient.guardians?.[0]?.relationship
                        }
                      />
                    )}
                  </div>
                  <p
                    style={{
                      margin: 0,
                      font: "400 13px/1 var(--font-sans)",
                      color: "var(--text-secondary)",
                      textTransform: "capitalize",
                    }}
                  >
                    {patient.gender}
                    {age ? ` · ${age} years old` : ""}
                  </p>
                </div>

                <div className="flex items-center flex-shrink-0" style={{ gap: 8 }}>
                  {patient.bloodType && patient.bloodType !== "unknown" && (
                    <span
                      className="inline-flex items-center"
                      style={{
                        height: 26,
                        padding: "0 12px",
                        borderRadius: "var(--r-pill)",
                        background: "var(--critical-tint)",
                        color: "var(--critical-ink)",
                        font: "700 12.5px/1 var(--font-mono)",
                      }}
                    >
                      {patient.bloodType}
                    </span>
                  )}
                  {activeVisit && (
                    <Badge tone="critical" dot style={{ height: 26 }}>
                      Currently admitted
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Info grid */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid var(--border-faint)",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 18,
          }}
        >
          {[
            { icon: User, label: "National ID", value: patient.nationalId },
            { icon: Phone, label: "Phone", value: patient.phoneNumber },
            {
              icon: Calendar,
              label: "Date of birth",
              value: patient.dateOfBirth
                ? format(new Date(patient.dateOfBirth), "dd MMM yyyy")
                : "—",
            },
            { icon: MapPin, label: "Address", value: patient.address },
            { icon: Briefcase, label: "Occupation", value: patient.occupation ?? "—" },
            { icon: Users, label: "Marital status", value: patient.maritalStatus ?? "—" },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start" style={{ gap: 10 }}>
              <Icon
                className="w-3.5 h-3.5 flex-shrink-0"
                style={{ color: "var(--text-muted)", marginTop: 2 }}
              />
              <div className="min-w-0 flex flex-col" style={{ gap: 4 }}>
                <SectionLabel>{label}</SectionLabel>
                <span
                  style={{
                    font: "500 13px/1.4 var(--font-sans)",
                    color: "var(--text-primary)",
                    wordBreak: "break-word",
                  }}
                >
                  {value ?? "—"}
                </span>
              </div>
            </div>
          ))}
        </div>

        {patient.emergencyContact && (
          <div
            className="flex items-center flex-wrap"
            style={{
              gap: 8,
              padding: "12px 24px",
              borderBottom: "1px solid var(--border-faint)",
            }}
          >
            <Phone className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
            <SectionLabel>Emergency contact</SectionLabel>
            <span
              style={{
                font: "600 13px/1 var(--font-sans)",
                color: "var(--text-primary)",
              }}
            >
              {patient.emergencyContact}
            </span>
          </div>
        )}

        {/* Active visit is the common destination, so it gets the primary action. */}
        <div style={{ padding: "16px 24px" }}>
          {activeVisit ? (
            <Button
              variant="primary"
              full
              size="lg"
              icon={Activity}
              iconRight={ChevronRight}
              onClick={() => router.push(`/dashboard/doctor/visit/${activeVisit.id}`)}
            >
              Open active visit — {activeVisit.visitNumber}
            </Button>
          ) : (
            <Button
              icon={PlusCircle}
              onClick={() =>
                router.push(`/dashboard/doctor/visit/new?patientId=${patientId}`)
              }
              style={{
                borderColor: "var(--green-200)",
                color: "var(--green-700)",
              }}
            >
              Create new visit
            </Button>
          )}
        </div>
      </Card>

      {/* ── Guardians (minor only) ── */}
      {patient.isMinor && (
        <PatientGuardiansSection patientId={patientId} canManage={false} />
      )}

      {/* ── Allergies ── */}
      {patient.allergies?.length > 0 && (
        <Card>
          <CardHeader icon={AlertCircle} title="Known allergies" tone="critical" />
          {patient.allergies.map((a: any) => {
            const tone = SEVERITY_TONE[a.severity] ?? "neutral";
            return (
              <div
                key={a.id}
                className="flex items-start"
                style={{
                  gap: 12,
                  padding: "12px 20px",
                  borderBottom: "1px solid var(--border-faint)",
                }}
              >
                <span
                  className="flex-shrink-0"
                  style={{
                    width: 8,
                    height: 8,
                    marginTop: 5,
                    borderRadius: "50%",
                    background: TONES[tone].dot,
                  }}
                />
                <div className="flex-1 min-w-0 flex flex-col" style={{ gap: 5 }}>
                  <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
                    <span
                      style={{
                        font: "600 13.5px/1 var(--font-sans)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {a.allergen}
                    </span>
                    <Badge tone={tone} style={{ height: 18, fontSize: 10 }}>
                      {a.severity?.replace("_", " ")}
                    </Badge>
                  </div>
                  <span
                    style={{
                      font: "400 12px/1 var(--font-sans)",
                      color: "var(--text-secondary)",
                      textTransform: "capitalize",
                    }}
                  >
                    {a.allergyType} · {a.reaction}
                  </span>
                  {a.notes && (
                    <span
                      style={{
                        font: "400 11.5px/1.4 var(--font-sans)",
                        color: "var(--text-muted)",
                        fontStyle: "italic",
                      }}
                    >
                      {a.notes}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {/* ── Medical history ── */}
      {patient.medicalHistory?.length > 0 && (
        <Card>
          <CardHeader icon={Heart} title="Medical history" tone="critical" />
          {patient.medicalHistory.map((m: any) => (
            <div
              key={m.id}
              className="flex flex-col"
              style={{
                gap: 5,
                padding: "12px 20px",
                borderBottom: "1px solid var(--border-faint)",
              }}
            >
              <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
                <span
                  style={{
                    font: "600 13.5px/1 var(--font-sans)",
                    color: "var(--text-primary)",
                  }}
                >
                  {m.condition}
                </span>
                <Badge
                  tone={m.status === "active" ? "critical" : "success"}
                  style={{ height: 18, fontSize: 10 }}
                >
                  {m.status}
                </Badge>
              </div>
              {m.diagnosedDate && (
                <span
                  style={{
                    font: "400 11.5px/1 var(--font-sans)",
                    color: "var(--text-muted)",
                  }}
                >
                  Diagnosed {m.diagnosedDate}
                </span>
              )}
              {m.notes && (
                <span
                  style={{
                    font: "400 12px/1.4 var(--font-sans)",
                    color: "var(--text-secondary)",
                  }}
                >
                  {m.notes}
                </span>
              )}
            </div>
          ))}
        </Card>
      )}

      {/* ── Visit history ── */}
      <Card>
        <CardHeader
          icon={Activity}
          title="Visit history"
          subtitle={`${visits.length} total visit${visits.length !== 1 ? "s" : ""}`}
          right={
            <LinkAction
              arrow={false}
              onClick={() =>
                router.push(`/dashboard/doctor/visit/new?patientId=${patientId}`)
              }
            >
              New visit
            </LinkAction>
          }
        />

        {visits.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No visits on record"
            message="This patient has not been seen at your institution yet."
            tone="neutral"
          />
        ) : (
          visits.map((v) => {
            const p = getPriority(v.priority);
            const isActive = v.status === "in-progress";
            return (
              <button
                key={v.id}
                onClick={() => router.push(`/dashboard/doctor/visit/${v.id}`)}
                className="w-full flex items-center text-left"
                style={{
                  gap: 14,
                  padding: "12px 20px",
                  border: "none",
                  borderBottom: "1px solid var(--border-faint)",
                  background: "transparent",
                  cursor: "pointer",
                  transition: "background var(--dur-fast) var(--ease-standard)",
                }}
                {...hoverRow}
              >
                <span
                  className="flex-shrink-0"
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: isActive
                      ? "var(--coral-500)"
                      : TONES[p.tone].dot,
                  }}
                />

                <span className="flex-1 min-w-0 flex flex-col" style={{ gap: 5 }}>
                  <span className="flex items-center flex-wrap" style={{ gap: 8 }}>
                    <MonoTag style={{ height: 17, fontSize: 10 }}>
                      {v.visitNumber}
                    </MonoTag>
                    <Badge tone={p.tone} style={{ height: 17, fontSize: 10 }}>
                      {p.label}
                    </Badge>
                    {isActive && (
                      <Badge tone="critical" style={{ height: 17, fontSize: 10 }}>
                        Active
                      </Badge>
                    )}
                  </span>
                  <span
                    className="truncate"
                    style={{
                      font: "600 13.5px/1 var(--font-sans)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {v.chiefComplaint}
                  </span>
                  <span
                    style={{
                      font: "400 11.5px/1 var(--font-sans)",
                      color: "var(--text-muted)",
                    }}
                  >
                    {v.admissionDate
                      ? format(new Date(v.admissionDate), "dd MMM yyyy")
                      : "—"}{" "}
                    · {v.institution?.institutionName ?? "—"}
                  </span>
                </span>

                <ChevronRight
                  className="w-4 h-4 flex-shrink-0"
                  style={{ color: "var(--text-disabled)" }}
                />
              </button>
            );
          })
        )}
      </Card>
    </Page>
  );
}
