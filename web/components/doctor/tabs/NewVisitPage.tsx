"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { visitApi, patientApi } from "@/lib/api";
import {
  ChevronLeft,
  AlertCircle,
  Loader2,
  Zap,
  AlertTriangle,
  Clock,
  FileText,
  Send,
  ShieldAlert,
} from "lucide-react";
import {
  Page,
  PageHeader,
  Card,
  Field,
  Input,
  Textarea,
  Button,
  Banner,
  SectionLabel,
  TONES,
  type Tone,
} from "@/components/dashboard/ui";

/* ==========================================================================
   Direct doctor admission.

   Creates a visit and assigns it to the admitting doctor in one call —
   visitApi.doctorAdmit handles creation, self-assignment, and (for
   emergency/critical) the placeholder vitals that let the visit skip triage.

   Skipping triage is a real transfer of responsibility, which is why the
   warning appears the moment such a priority is selected rather than at
   submit time.
   ========================================================================== */

type Priority = "routine" | "urgent" | "emergency" | "critical";
type VisitType = "outpatient" | "inpatient" | "emergency" | "consultation";

const PRIORITY: {
  value: Priority;
  label: string;
  desc: string;
  tone: Tone;
  icon: React.ElementType;
}[] = [
  {
    value: "routine",
    label: "Routine",
    desc: "Scheduled, non-urgent",
    tone: "success",
    icon: Clock,
  },
  {
    value: "urgent",
    label: "Urgent",
    desc: "Needs prompt attention",
    tone: "urgent",
    icon: AlertTriangle,
  },
  {
    value: "emergency",
    label: "Emergency",
    desc: "Immediate care required",
    tone: "critical",
    icon: AlertTriangle,
  },
  {
    value: "critical",
    label: "Critical",
    desc: "Life-threatening — direct to doctor",
    tone: "accent",
    icon: Zap,
  },
];

const VISIT_TYPES: { value: VisitType; label: string; desc: string }[] = [
  {
    value: "outpatient",
    label: "Outpatient",
    desc: "Patient visits and leaves the same day",
  },
  {
    value: "inpatient",
    label: "Inpatient",
    desc: "Patient admitted for an overnight stay",
  },
  { value: "emergency", label: "Emergency", desc: "Unscheduled urgent care" },
  {
    value: "consultation",
    label: "Consultation",
    desc: "Specialist opinion or review",
  },
];

// ── Skip-triage priorities — doctor assumes triage responsibility ─────────────
const SKIP_TRIAGE: Priority[] = ["emergency", "critical"];

export default function NewVisitPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const patientId = searchParams.get("patientId") ?? "";

  const [patient, setPatient] = useState<any>(null);
  const [loadingPatient, setLoadingPatient] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [priority, setPriority] = useState<Priority>("routine");
  const [visitType, setVisitType] = useState<VisitType>("outpatient");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [wardOrRoom, setWardOrRoom] = useState("");
  const [notes, setNotes] = useState("");

  // Load patient info
  useEffect(() => {
    if (!patientId) {
      setLoadingPatient(false);
      return;
    }
    patientApi
      .getById(patientId)
      .then((res) => setPatient(res.data.data))
      .catch(() => setError("Could not load patient."))
      .finally(() => setLoadingPatient(false));
  }, [patientId]);

  // Auto-set visit type when priority changes
  useEffect(() => {
    if (priority === "emergency" || priority === "critical") {
      setVisitType("emergency");
    }
  }, [priority]);

  const skipsTriage = SKIP_TRIAGE.includes(priority);

  const handleSubmit = async () => {
    if (!chiefComplaint.trim() || chiefComplaint.trim().length < 5) {
      setError("Chief complaint must be at least 5 characters.");
      return;
    }
    if (!patientId) {
      setError("No patient selected.");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      // Single call — backend handles visit creation, self-assignment,
      // and placeholder vitals for emergency/critical priority.
      const res = await visitApi.doctorAdmit({
        patientId,
        visitType,
        priority,
        chiefComplaint: chiefComplaint.trim(),
        admittingDiagnosis: notes.trim() || undefined,
        wardOrRoom: wardOrRoom.trim() || undefined,
      });

      const { visitId } = res.data.data;

      router.replace(`/dashboard/doctor/visit/${visitId}`);
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? "Failed to create visit.");
      setSubmitting(false);
    }
  };

  // ── Loading patient ───────────────────────────────────────────────────────
  if (loadingPatient) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ minHeight: 256, gap: 12 }}
      >
        <Loader2 className="w-7 h-7 animate-spin" style={{ color: "var(--brand)" }} />
      </div>
    );
  }

  if (!patient) {
    return (
      <Page maxWidth={560}>
        <Banner
          tone="critical"
          icon={AlertCircle}
          title={patientId ? "Patient not found" : "No patient selected"}
        >
          {patientId
            ? "This patient may no longer be active, or you may not have access."
            : "Open this page from a patient's profile to create a visit."}
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

  const selectedPriority = PRIORITY.find((p) => p.value === priority)!;
  const spTone = TONES[selectedPriority.tone];

  return (
    <Page maxWidth={720}>
      <Button
        variant="ghost"
        icon={ChevronLeft}
        onClick={() => router.back()}
        style={{ alignSelf: "flex-start" }}
      >
        Back
      </Button>

      <PageHeader
        eyebrow="Clinical"
        title="New visit"
        subtitle={
          <>
            Creating a visit for{" "}
            <strong style={{ color: "var(--text-primary)" }}>
              {patient?.firstName} {patient?.lastName}
            </strong>
          </>
        }
      />

      {/* Skipping triage transfers responsibility — say so immediately. */}
      {skipsTriage && (
        <Banner tone="critical" icon={ShieldAlert} title="Triage bypassed">
          <span style={{ textTransform: "capitalize" }}>{priority}</span> priority
          visits go directly to the doctor. This visit will not appear in the nurse
          triage queue — you are assuming responsibility for the initial assessment.
        </Banner>
      )}

      {/* ── Priority ────────────────────────────────────────────────────── */}
      <Card pad={20}>
        <SectionLabel style={{ marginBottom: 12 }}>Priority *</SectionLabel>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 8,
          }}
        >
          {PRIORITY.map(({ value, label, desc, tone, icon: Icon }) => {
            const active = priority === value;
            const t = TONES[tone];
            return (
              <button
                key={value}
                onClick={() => setPriority(value)}
                className="flex items-start text-left"
                style={{
                  gap: 11,
                  padding: 14,
                  borderRadius: "var(--r-sm)",
                  border: `1px solid ${active ? t.ink : "var(--border-faint)"}`,
                  background: active ? t.tint : "var(--surface-sunken)",
                  cursor: "pointer",
                  transition: "all var(--dur-fast) var(--ease-standard)",
                }}
              >
                <Icon
                  className="w-4 h-4 flex-shrink-0"
                  style={{ marginTop: 2, color: active ? t.ink : "var(--text-muted)" }}
                />
                <span className="flex flex-col" style={{ gap: 4 }}>
                  <span
                    style={{
                      font: "700 13px/1 var(--font-sans)",
                      color: active ? t.ink : "var(--text-secondary)",
                    }}
                  >
                    {label}
                  </span>
                  <span
                    style={{
                      font: "400 10.5px/1.3 var(--font-sans)",
                      color: active ? t.ink : "var(--text-muted)",
                      opacity: active ? 0.85 : 1,
                    }}
                  >
                    {desc}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* ── Visit type ──────────────────────────────────────────────────── */}
      <Card pad={20}>
        <SectionLabel style={{ marginBottom: 12 }}>Visit type *</SectionLabel>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 8,
          }}
        >
          {VISIT_TYPES.map(({ value, label, desc }) => {
            const active = visitType === value;
            return (
              <button
                key={value}
                onClick={() => setVisitType(value)}
                className="flex flex-col text-left"
                style={{
                  gap: 4,
                  padding: 14,
                  borderRadius: "var(--r-sm)",
                  border: `1px solid ${active ? "var(--blue-600)" : "var(--border-faint)"}`,
                  background: active ? "var(--info-tint)" : "var(--surface-sunken)",
                  cursor: "pointer",
                  transition: "all var(--dur-fast) var(--ease-standard)",
                }}
              >
                <span
                  style={{
                    font: "700 13px/1 var(--font-sans)",
                    color: active ? "var(--info-ink)" : "var(--text-secondary)",
                  }}
                >
                  {label}
                </span>
                <span
                  style={{
                    font: "400 10.5px/1.3 var(--font-sans)",
                    color: active ? "var(--info-ink)" : "var(--text-muted)",
                    opacity: active ? 0.85 : 1,
                  }}
                >
                  {desc}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* ── Chief complaint ─────────────────────────────────────────────── */}
      <Card pad={20}>
        <Field
          label="Chief complaint"
          required
          hint={`${chiefComplaint.length} characters — 5 minimum`}
        >
          <Textarea
            value={chiefComplaint}
            onChange={(e) => setChiefComplaint(e.target.value)}
            rows={3}
            placeholder="Why is the patient presenting? What are the primary symptoms?"
          />
        </Field>
      </Card>

      {/* ── Initial notes (optional) ────────────────────────────────────── */}
      <Card pad={20}>
        <Field
          label="Initial clinical notes"
          hint="Optional — preliminary findings, relevant history, working diagnosis. Stored as the admitting diagnosis."
        >
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="e.g. 45yo male with 2hr chest pain radiating to left arm, diaphoresis, BP 160/100…"
          />
        </Field>
      </Card>

      {/* ── Ward / room (optional) ──────────────────────────────────────── */}
      <Card pad={20}>
        <Field label="Ward / room" hint="Optional">
          <Input
            value={wardOrRoom}
            onChange={(e) => setWardOrRoom(e.target.value)}
            placeholder="e.g. Emergency Bay 2, Ward 4 Bed 12"
          />
        </Field>
      </Card>

      {/* ── Summary before submit ───────────────────────────────────────── */}
      <div
        className="flex items-start"
        style={{
          gap: 12,
          padding: "14px 16px",
          borderRadius: "var(--r-md)",
          background: spTone.tint,
          border: "1px solid var(--border-faint)",
          borderLeft: `4px solid ${spTone.dot}`,
        }}
      >
        <FileText
          className="w-4 h-4 flex-shrink-0"
          style={{ marginTop: 2, color: spTone.ink }}
        />
        <div className="flex flex-col" style={{ gap: 4 }}>
          <p
            style={{
              margin: 0,
              font: "700 12.5px/1 var(--font-sans)",
              color: spTone.ink,
            }}
          >
            Visit summary
          </p>
          <p
            style={{
              margin: 0,
              font: "400 12px/1.5 var(--font-sans)",
              color: spTone.ink,
              opacity: 0.9,
              textTransform: "capitalize",
            }}
          >
            {visitType} · {priority} priority ·{" "}
            {skipsTriage ? "bypasses nurse triage" : "goes through nurse triage"}
          </p>
        </div>
      </div>

      {error && (
        <Banner tone="critical" icon={AlertCircle}>
          {error}
        </Banner>
      )}

      <Button
        variant="primary"
        full
        size="lg"
        icon={Send}
        loading={submitting}
        disabled={chiefComplaint.trim().length < 5}
        onClick={handleSubmit}
      >
        {submitting ? "Creating visit…" : "Create visit & open workspace"}
      </Button>

      <p
        className="text-center"
        style={{
          margin: 0,
          paddingBottom: 24,
          font: "400 11.5px/1 var(--font-sans)",
          color: "var(--text-muted)",
        }}
      >
        The visit will be assigned to you and appear in your queue immediately.
      </p>
    </Page>
  );
}
