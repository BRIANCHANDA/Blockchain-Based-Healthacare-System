"use client";
import { useState, useEffect } from "react";
import { appointmentApi, visitApi } from "@/lib/api";
import {
  Stethoscope,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Zap,
  Send,
  ArrowRight,
  AlertCircle,
  X,
} from "lucide-react";
import {
  Field,
  Input,
  Textarea,
  Button,
  Pill as Badge,
  Avatar,
  Banner,
  Modal,
  SectionLabel,
  SkeletonBlock,
  SearchInput,
  TONES,
  type Tone,
} from "@/components/dashboard/ui";

/* ==========================================================================
   Internal referral.

   Books an appointment with another practitioner at THIS institution — no
   blockchain involved, since the record never leaves the hospital. (The
   cross-institution equivalent is CreateReferalModal.)

   Urgency sets the default appointment time: routine lands tomorrow,
   anything higher lands an hour from now.
   ========================================================================== */

interface Specialist {
  id: string;
  name: string;
  specialization: string | null;
}

interface InternalReferralModalProps {
  visitId: string;
  patientId: string;
  patientName: string;
  chiefComplaint: string;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

const URGENCY: {
  value: UrgencyValue;
  label: string;
  desc: string;
  tone: Tone;
  icon: React.ElementType;
}[] = [
  {
    value: "routine",
    label: "Routine",
    desc: "Within the next few days",
    tone: "success",
    icon: Clock,
  },
  {
    value: "urgent",
    label: "Urgent",
    desc: "Same day, within hours",
    tone: "urgent",
    icon: AlertTriangle,
  },
  {
    value: "emergency",
    label: "Emergency",
    desc: "See specialist immediately",
    tone: "critical",
    icon: AlertTriangle,
  },
  {
    value: "critical",
    label: "Critical",
    desc: "Life-threatening — now",
    tone: "accent",
    icon: Zap,
  },
];

type UrgencyValue = "routine" | "urgent" | "emergency" | "critical";

// ── Step dot ──────────────────────────────────────────────────────────────────
function StepDot({ n, active, done }: { n: number; active: boolean; done: boolean }) {
  return (
    <span
      className="inline-flex items-center justify-center flex-shrink-0"
      style={{
        width: 26,
        height: 26,
        borderRadius: "50%",
        background: done
          ? "var(--brand)"
          : active
            ? "var(--blue-600)"
            : "var(--surface-sunken)",
        color: done || active ? "var(--on-brand)" : "var(--text-muted)",
        font: "700 11.5px/1 var(--font-sans)",
        transition: "all var(--dur-base) var(--ease-standard)",
      }}
    >
      {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : n}
    </span>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function InternalReferralModal({
  visitId, patientId, patientName, chiefComplaint, onClose, onSuccess,
}: InternalReferralModalProps) {
  const [step,         setStep]         = useState<1 | 2 | 3>(1);
  const [specialists,  setSpecialists]  = useState<Specialist[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [selected,     setSelected]     = useState<Specialist | null>(null);
  const [urgency,      setUrgency]      = useState<UrgencyValue>("routine");
  const [reason,       setReason]       = useState(`Internal referral: ${chiefComplaint}`);
  const [apptDate,     setApptDate]     = useState("");
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [apptNumber,   setApptNumber]   = useState<string | null>(null);

  // Load practitioners at this institution with role=practitioner
  useEffect(() => {
    visitApi.getStaffByRole("practitioner")
      .then(res => {
        const staff: Specialist[] = (res.data?.data ?? []).map((s: any) => ({
          id:             s.id,
          name:           s.name,
          specialization: s.specialization ?? null,
        }));
        setSpecialists(staff);
      })
      .catch(() => setSpecialists([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = specialists.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.specialization ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = async () => {
    if (!selected) return;
    if (reason.trim().length < 5) { setError("Reason must be at least 5 characters."); return; }

    // For urgent/emergency/critical — book for today if no date selected
    const bookDate = apptDate
      ? new Date(apptDate).toISOString()
      : (() => {
          const d = new Date();
          if (urgency === "routine") {
            d.setDate(d.getDate() + 1); // tomorrow for routine
          } else {
            d.setHours(d.getHours() + 1); // 1hr from now for urgent+
          }
          return d.toISOString();
        })();

    setError(null);
    setSubmitting(true);
    try {
      const res = await appointmentApi.book({
        patientId,
        appointmentDate:  bookDate,
        visitType:        "consultation",
        priority:         urgency,
        chiefComplaint:     reason.trim(),
        admittingDiagnosis: reason.trim(),
        assignedDoctorId: selected.id,
        originVisitId:    visitId,
      });
      setApptNumber(res.data.data.visitNumber);
      setStep(3);
      onSuccess(`Internal referral to Dr. ${selected.name} booked — ${res.data.data.visitNumber}`);
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? "Failed to create internal referral.");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedUrgency = URGENCY.find((u) => u.value === urgency)!;
  const suTone = TONES[selectedUrgency.tone];

  const footer =
    step === 1 ? (
      <>
        <Button full onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          full
          iconRight={ArrowRight}
          disabled={!selected}
          onClick={() => selected && setStep(2)}
          style={{ background: "var(--blue-600)", boxShadow: "none" }}
        >
          Next
        </Button>
      </>
    ) : step === 2 ? (
      <>
        <Button
          full
          onClick={() => {
            setStep(1);
            setError(null);
          }}
        >
          Back
        </Button>
        <Button
          variant="primary"
          full
          icon={Send}
          loading={submitting}
          disabled={reason.trim().length < 5}
          onClick={handleSubmit}
        >
          {submitting ? "Booking…" : "Book referral"}
        </Button>
      </>
    ) : (
      <Button variant="primary" full icon={CheckCircle2} onClick={onClose}>
        Done
      </Button>
    );

  return (
    <Modal
      title="Internal referral"
      subtitle={`Referring ${patientName} to a specialist`}
      icon={Stethoscope}
      tone="info"
      width={620}
      scroll
      onClose={onClose}
      footer={footer}
    >
      {/* ── Step indicators ─────────────────────────────────────────────── */}
      <div className="flex items-center" style={{ gap: 8 }}>
        {[
          { n: 1, label: "Specialist" },
          { n: 2, label: "Details" },
          { n: 3, label: "Done" },
        ].map(({ n, label }, i, arr) => (
          <div key={n} className="flex items-center flex-1" style={{ gap: 8 }}>
            <StepDot n={n} active={step === n} done={step > n} />
            <span
              className="hidden sm:block"
              style={{
                font: `${step === n ? 700 : 500} 12px/1 var(--font-sans)`,
                color:
                  step === n
                    ? "var(--info-ink)"
                    : step > n
                      ? "var(--green-800)"
                      : "var(--text-muted)",
              }}
            >
              {label}
            </span>
            {i < arr.length - 1 && (
              <span
                className="flex-1"
                style={{
                  height: 1,
                  margin: "0 6px",
                  background: step > n ? "var(--brand)" : "var(--hc-border)",
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* ── Step 1 — pick specialist ─────────────────────────────────────── */}
      {step === 1 && (
        <>
          <p
            style={{
              margin: 0,
              font: "600 13px/1 var(--font-sans)",
              color: "var(--text-secondary)",
            }}
          >
            Select a specialist at your institution
          </p>

          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by name or specialization…"
            icon={Search}
            clearIcon={X}
            style={{ height: 40, boxShadow: "none" }}
          />

          <div
            className="flex flex-col"
            style={{ gap: 6, maxHeight: 288, overflowY: "auto" }}
          >
            {loading ? (
              [...Array(4)].map((_, i) => (
                <SkeletonBlock key={i} height={56} radius="var(--r-sm)" />
              ))
            ) : filtered.length === 0 ? (
              <p
                style={{
                  margin: 0,
                  padding: "40px 0",
                  textAlign: "center",
                  font: "400 13px/1 var(--font-sans)",
                  color: "var(--text-muted)",
                }}
              >
                No specialists found at your institution
              </p>
            ) : (
              filtered.map((spec, i) => {
                const isSel = selected?.id === spec.id;
                return (
                  <button
                    key={spec.id}
                    onClick={() => setSelected(spec)}
                    className="w-full flex items-center text-left"
                    style={{
                      gap: 12,
                      padding: 12,
                      borderRadius: "var(--r-sm)",
                      border: `1px solid ${isSel ? "var(--blue-600)" : "var(--border-faint)"}`,
                      background: isSel ? "var(--info-tint)" : "var(--surface-sunken)",
                      cursor: "pointer",
                      transition: "all var(--dur-fast) var(--ease-standard)",
                    }}
                  >
                    <Avatar name={spec.name} size={34} seed={i} />
                    <span className="flex-1 min-w-0 flex flex-col" style={{ gap: 4 }}>
                      <span
                        className="truncate"
                        style={{
                          font: "600 13.5px/1 var(--font-sans)",
                          color: "var(--text-primary)",
                        }}
                      >
                        Dr. {spec.name}
                      </span>
                      <span
                        className="truncate"
                        style={{
                          font: "400 11.5px/1 var(--font-sans)",
                          color: "var(--text-muted)",
                        }}
                      >
                        {spec.specialization ?? "General practitioner"}
                      </span>
                    </span>
                    {isSel && (
                      <CheckCircle2
                        className="w-4 h-4 flex-shrink-0"
                        style={{ color: "var(--info-ink)" }}
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </>
      )}

      {/* ── Step 2 — urgency, reason, date ───────────────────────────────── */}
      {step === 2 && (
        <>
          <div
            className="flex items-center"
            style={{
              gap: 12,
              padding: "12px 16px",
              borderRadius: "var(--r-sm)",
              background: "var(--info-tint)",
              border: "1px solid var(--blue-100)",
            }}
          >
            <Stethoscope
              className="w-4 h-4 flex-shrink-0"
              style={{ color: "var(--info-ink)" }}
            />
            <span className="flex-1 min-w-0 flex flex-col" style={{ gap: 4 }}>
              <SectionLabel style={{ color: "var(--info-ink)" }}>
                Referring to
              </SectionLabel>
              <span
                className="truncate"
                style={{
                  font: "700 13.5px/1 var(--font-sans)",
                  color: "var(--info-ink)",
                }}
              >
                Dr. {selected?.name}
                {selected?.specialization ? ` · ${selected.specialization}` : ""}
              </span>
            </span>
            <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
              Change
            </Button>
          </div>

          <Field label="Urgency" required>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 8,
              }}
            >
              {URGENCY.map(({ value, label, desc, tone, icon: Icon }) => {
                const active = urgency === value;
                const t = TONES[tone];
                return (
                  <button
                    key={value}
                    onClick={() => setUrgency(value)}
                    className="flex items-start text-left"
                    style={{
                      gap: 10,
                      padding: 12,
                      borderRadius: "var(--r-sm)",
                      border: `1px solid ${active ? t.ink : "var(--border-faint)"}`,
                      background: active ? t.tint : "var(--surface-sunken)",
                      cursor: "pointer",
                      transition: "all var(--dur-fast) var(--ease-standard)",
                    }}
                  >
                    <Icon
                      className="w-4 h-4 flex-shrink-0"
                      style={{
                        marginTop: 2,
                        color: active ? t.ink : "var(--text-muted)",
                      }}
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
          </Field>

          <Field label="Reason for referral" required hint={`${reason.length} characters`}>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Clinical reason, working diagnosis, what you need the specialist to assess…"
            />
          </Field>

          {/* A date only makes sense when the referral is not immediate. */}
          {(urgency === "routine" || urgency === "urgent") && (
            <Field
              label="Preferred date & time"
              hint={
                urgency === "routine"
                  ? "Optional — defaults to tomorrow."
                  : "Optional — defaults to an hour from now."
              }
            >
              <Input
                type="datetime-local"
                value={apptDate}
                onChange={(e) => setApptDate(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
              />
            </Field>
          )}

          {(urgency === "emergency" || urgency === "critical") && (
            <Banner tone="critical" icon={AlertTriangle}>
              <strong style={{ textTransform: "capitalize" }}>{urgency}</strong>{" "}
              referral — the appointment is booked for an hour from now. Notify Dr.{" "}
              {selected?.name} directly if immediate attention is required.
            </Banner>
          )}

          {error && (
            <Banner tone="critical" icon={AlertCircle}>
              {error}
            </Banner>
          )}
        </>
      )}

      {/* ── Step 3 — success ─────────────────────────────────────────────── */}
      {step === 3 && apptNumber && (
        <div
          className="flex flex-col items-center text-center"
          style={{ padding: "16px 0", gap: 16 }}
        >
          <span
            className="inline-flex items-center justify-center"
            style={{
              width: 56,
              height: 56,
              borderRadius: "var(--r-md)",
              background: "var(--brand-tint)",
              color: "var(--green-700)",
            }}
          >
            <CheckCircle2 className="w-7 h-7" />
          </span>

          <div className="flex flex-col" style={{ gap: 6 }}>
            <p
              style={{
                margin: 0,
                font: "700 15px/1.2 var(--font-sans)",
                color: "var(--text-primary)",
              }}
            >
              Internal referral created
            </p>
            <p
              style={{
                margin: 0,
                font: "400 13px/1.5 var(--font-sans)",
                color: "var(--text-secondary)",
              }}
            >
              {patientName} has been referred to{" "}
              <strong style={{ color: "var(--text-primary)" }}>
                Dr. {selected?.name}
              </strong>
              .
            </p>
          </div>

          {/* The receptionist works from this number, so it is the payload. */}
          <div
            className="w-full"
            style={{
              padding: "20px 24px",
              borderRadius: "var(--r-md)",
              border: `1.5px dashed ${suTone.ink}`,
              background: suTone.tint,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <SectionLabel style={{ color: suTone.ink }}>
              Appointment number
            </SectionLabel>
            <p
              style={{
                margin: 0,
                font: "700 22px/1 var(--font-mono)",
                letterSpacing: "0.02em",
                color: suTone.ink,
              }}
            >
              {apptNumber}
            </p>
            <p
              style={{
                margin: 0,
                font: "400 11.5px/1.4 var(--font-sans)",
                color: suTone.ink,
                opacity: 0.8,
              }}
            >
              The receptionist will see this in the Appointments queue.
            </p>
          </div>

          <Badge tone={selectedUrgency.tone} dot style={{ height: 24 }}>
            {selectedUrgency.label} urgency
          </Badge>
        </div>
      )}
    </Modal>
  );
}

export default InternalReferralModal;
