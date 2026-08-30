"use client";
import {
  User,
  AlertTriangle,
  ShieldAlert,
  Droplets,
  History as HistoryIcon,
} from "lucide-react";
import { Card, Pill, SectionLabel } from "@/components/dashboard/ui";

/* ==========================================================================
   Patient context banner.

   The at-a-glance safety strip shown above a patient's clinical record:
   who they are, what they are allergic to, what they are being treated for.

   Fed by /api/lab/patient-context, which permits radiologists as well as lab
   staff — the endpoint name predates the sharing.

   Severe allergies get their own full-width bar above everything else. That
   is deliberate: a life-threatening allergy must be impossible to miss, so it
   does not compete for attention inside the chip rows below.
   ========================================================================== */

const SEVERE = ["severe", "life_threatening"];

export default function PatientBanner({
  context,
  loading,
  error,
}: {
  context: any;
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return (
      <Card pad={18}>
        <div className="flex items-center animate-pulse" style={{ gap: 16 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "var(--r-md)",
              background: "var(--surface-sunken)",
              flexShrink: 0,
            }}
          />
          <div className="flex-1 flex flex-col" style={{ gap: 8 }}>
            <div
              style={{
                width: 192,
                height: 14,
                borderRadius: 4,
                background: "var(--surface-sunken)",
              }}
            />
            <div
              style={{
                width: 256,
                height: 11,
                borderRadius: 4,
                background: "var(--surface-sunken)",
              }}
            />
          </div>
        </div>
      </Card>
    );
  }

  if (error || !context) {
    return (
      <div
        className="flex items-start"
        style={{
          gap: 12,
          padding: 16,
          borderRadius: "var(--r-md)",
          background: "var(--amber-050)",
          border: "1px solid var(--amber-100)",
          borderLeft: "4px solid var(--amber-500)",
        }}
      >
        <AlertTriangle
          className="w-[18px] h-[18px] flex-shrink-0"
          style={{ color: "var(--urgent-ink)", marginTop: 1 }}
        />
        <div className="flex flex-col" style={{ gap: 4 }}>
          <p
            style={{
              margin: 0,
              font: "700 13.5px/1 var(--font-sans)",
              color: "var(--urgent-ink)",
            }}
          >
            Patient details unavailable
          </p>
          <p
            style={{
              margin: 0,
              font: "400 12px/1.4 var(--font-sans)",
              color: "var(--urgent-ink)",
              opacity: 0.85,
            }}
          >
            {error ?? "Could not load patient context for this order."}
          </p>
        </div>
      </div>
    );
  }

  const { patient, allergies, medicalHistory, recentDiagnoses } = context;

  const severeAllergies =
    allergies?.filter((a: any) => SEVERE.includes(a.severity)) ?? [];
  const otherAllergies =
    allergies?.filter((a: any) => !SEVERE.includes(a.severity)) ?? [];
  const activeConditions =
    medicalHistory?.filter((h: any) => h.status === "active") ?? [];

  /** Column in the banner body — label above a row of chips. */
  const Column = ({
    label,
    children,
    empty,
  }: {
    label: string;
    children?: React.ReactNode;
    empty: string;
  }) => (
    <div style={{ flex: "1 1 180px", minWidth: 180 }}>
      <SectionLabel style={{ marginBottom: 7 }}>{label}</SectionLabel>
      {children ?? (
        <p
          style={{
            margin: 0,
            font: "400 12px/1 var(--font-sans)",
            color: "var(--text-muted)",
            fontStyle: "italic",
          }}
        >
          {empty}
        </p>
      )}
    </div>
  );

  return (
    <Card>
      {/* Severe allergies — the one thing that must never be scrolled past. */}
      {severeAllergies.length > 0 && (
        <div
          className="flex items-center"
          style={{
            gap: 8,
            padding: "8px 20px",
            background: "var(--critical-tint)",
            borderBottom: "1px solid var(--coral-100)",
          }}
        >
          <ShieldAlert
            className="w-3.5 h-3.5 flex-shrink-0"
            style={{ color: "var(--critical-ink)" }}
          />
          <p
            style={{
              margin: 0,
              font: "700 11.5px/1.3 var(--font-sans)",
              letterSpacing: "var(--ls-wide)",
              color: "var(--critical-ink)",
            }}
          >
            SEVERE ALLERGY — {severeAllergies.map((a: any) => a.allergen).join(", ")}
          </p>
        </div>
      )}

      <div style={{ padding: 20 }}>
        <div className="flex flex-wrap items-center" style={{ gap: 20 }}>
          {/* Identity */}
          <div className="flex items-center flex-shrink-0" style={{ gap: 12 }}>
            <span
              className="inline-flex items-center justify-center"
              style={{
                width: 52,
                height: 52,
                borderRadius: "var(--r-md)",
                background: "var(--brand-tint)",
                color: "var(--green-700)",
              }}
            >
              <User className="w-6 h-6" />
            </span>
            <div className="flex flex-col" style={{ gap: 5 }}>
              <p
                style={{
                  margin: 0,
                  font: "700 17px/1.2 var(--font-sans)",
                  letterSpacing: "var(--ls-tight)",
                  color: "var(--text-primary)",
                }}
              >
                {patient.fullName}
              </p>
              <div
                className="flex items-center flex-wrap"
                style={{
                  gap: 7,
                  font: "400 12px/1 var(--font-sans)",
                  color: "var(--text-muted)",
                }}
              >
                {patient.age != null && (
                  <span style={{ fontWeight: 600 }}>{patient.age} yrs</span>
                )}
                {patient.gender && (
                  <>
                    <span style={{ color: "var(--text-disabled)" }}>·</span>
                    <span style={{ textTransform: "capitalize" }}>{patient.gender}</span>
                  </>
                )}
                {patient.bloodType && patient.bloodType !== "unknown" && (
                  <>
                    <span style={{ color: "var(--text-disabled)" }}>·</span>
                    <span
                      className="inline-flex items-center"
                      style={{
                        gap: 4,
                        font: "700 11.5px/1 var(--font-mono)",
                        color: "var(--critical-ink)",
                      }}
                    >
                      <Droplets className="w-3 h-3" />
                      {patient.bloodType}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div
            className="hidden md:block flex-shrink-0"
            style={{ width: 1, height: 44, background: "var(--border-faint)" }}
          />

          <Column label="Allergies" empty="No known allergies">
            {allergies && allergies.length > 0 ? (
              <div className="flex flex-wrap" style={{ gap: 6 }}>
                {severeAllergies.map((a: any) => (
                  <Pill key={a.id} tone="critical" icon={AlertTriangle}>
                    {a.allergen}
                  </Pill>
                ))}
                {otherAllergies.map((a: any) => (
                  <Pill key={a.id} tone="urgent">
                    {a.allergen}
                  </Pill>
                ))}
              </div>
            ) : undefined}
          </Column>

          <div
            className="hidden md:block flex-shrink-0"
            style={{ width: 1, height: 44, background: "var(--border-faint)" }}
          />

          <Column label="Active conditions" empty="None recorded">
            {activeConditions.length > 0 ? (
              <div className="flex flex-wrap" style={{ gap: 6 }}>
                {activeConditions.slice(0, 4).map((h: any) => (
                  <Pill key={h.id} tone="info">
                    {h.condition}
                  </Pill>
                ))}
              </div>
            ) : undefined}
          </Column>

          {recentDiagnoses && recentDiagnoses.length > 0 && (
            <>
              <div
                className="hidden md:block flex-shrink-0"
                style={{ width: 1, height: 44, background: "var(--border-faint)" }}
              />
              <Column label="Recent diagnoses" empty="None recorded">
                <div className="flex flex-wrap" style={{ gap: 6 }}>
                  {recentDiagnoses.slice(0, 3).map((d: any) => (
                    <Pill key={d.id} tone="accent" icon={HistoryIcon}>
                      {d.diagnosisName}
                      {d.icdCode && (
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 9,
                            opacity: 0.75,
                          }}
                        >
                          · {d.icdCode}
                        </span>
                      )}
                    </Pill>
                  ))}
                </div>
              </Column>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
