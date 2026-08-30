"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import {
  X,
  Building2,
  Search,
  CheckCircle2,
  Clock,
  Zap,
  AlertTriangle,
  Send,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import {
  Field,
  Textarea,
  Button,
  Pill as Badge,
  Banner,
  Modal,
  SectionLabel,
  SkeletonBlock,
  SearchInput,
  TONES,
  type Tone,
} from "@/components/dashboard/ui";

/* ==========================================================================
   External referral.

   Refers a patient to ANOTHER institution. Unlike the internal equivalent
   this is a cross-institution record anchored on the blockchain, and the
   patient carries the referral number to the receiving hospital — which is
   why the success screen makes that number the largest thing on it.
   ========================================================================== */

interface Institution {
  id: string;
  institutionName: string;
  institutionType: string;
  institutionCode: string;
}

interface CreateReferralModalProps {
  visitId: string;
  patientId: string;
  patientName: string;
  chiefComplaint: string;
  onClose: () => void;
  onSuccess: (referralNumber: string) => void;
}

type UrgencyValue = "routine" | "urgent" | "emergency" | "critical";

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
    desc: "Non-urgent, within days",
    tone: "success",
    icon: Clock,
  },
  {
    value: "urgent",
    label: "Urgent",
    desc: "Attention within hours",
    tone: "urgent",
    icon: AlertTriangle,
  },
  {
    value: "emergency",
    label: "Emergency",
    desc: "Prompt transfer today",
    tone: "critical",
    icon: AlertTriangle,
  },
  {
    value: "critical",
    label: "Critical",
    desc: "Immediate, life-threatening",
    tone: "accent",
    icon: Zap,
  },
];

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
export function CreateReferralModal({
  visitId,
  patientId,
  patientName,
  chiefComplaint,
  onClose,
  onSuccess,
}: CreateReferralModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loadingInst, setLoadingInst] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Institution | null>(null);
  const [urgency, setUrgency] = useState<UrgencyValue>("routine");
  const [reason, setReason] = useState("");
  const [clinicalSummary, setClinicalSummary] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [referralNumber, setReferralNumber] = useState<string | null>(null);

  // Pre-fill reason from chief complaint
  useEffect(() => {
    if (chiefComplaint) setReason(`Referral for: ${chiefComplaint}`);
  }, [chiefComplaint]);

  // Load institutions
  useEffect(() => {
    api
      .get("/api/institutions")
      .then((res) =>
        setInstitutions(
          res.data?.data?.institutions ?? res.data?.institutions ?? [],
        ),
      )
      .catch(() => setInstitutions([]))
      .finally(() => setLoadingInst(false));
  }, []);

  const filtered = institutions.filter(
    (i) =>
      i.institutionName.toLowerCase().includes(search.toLowerCase()) ||
      i.institutionCode.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSubmit = async () => {
    if (!selected) return;
    if (reason.trim().length < 10) {
      setError("Reason must be at least 10 characters.");
      return;
    }
    if (clinicalSummary.trim().length < 10) {
      setError("Clinical summary must be at least 10 characters.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const res = await api.post("/api/referrals", {
        patientId,
        visitId,
        receivingInstitutionId: selected.id,
        reason: reason.trim(),
        clinicalSummary: clinicalSummary.trim(),
        urgency,
      });
      const num = res.data.data.referralNumber;
      setReferralNumber(num);
      setStep(3); // show success screen first
      onSuccess(num); // notify parent (parent should NOT close modal immediately)
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ?? "Failed to create referral.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const urgencyCfg = URGENCY.find((u) => u.value === urgency)!;
  const uTone = TONES[urgencyCfg.tone];

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
          disabled={
            reason.trim().length < 10 || clinicalSummary.trim().length < 10
          }
          onClick={handleSubmit}
        >
          {submitting ? "Sending…" : "Send referral"}
        </Button>
      </>
    ) : (
      <Button variant="primary" full icon={CheckCircle2} onClick={onClose}>
        Done
      </Button>
    );

  return (
    <Modal
      title="Create referral"
      subtitle={`Referring ${patientName} to another institution`}
      icon={Building2}
      tone="info"
      width={620}
      scroll
      onClose={onClose}
      footer={footer}
    >
      {/* ── Step indicators ─────────────────────────────────────────────── */}
      <div className="flex items-center" style={{ gap: 8 }}>
        {[
          { n: 1, label: "Institution" },
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

      {/* ── Step 1 — institution picker ──────────────────────────────────── */}
      {step === 1 && (
        <>
          <p
            style={{
              margin: 0,
              font: "600 13px/1 var(--font-sans)",
              color: "var(--text-secondary)",
            }}
          >
            Select the receiving institution
          </p>

          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by name or code…"
            icon={Search}
            clearIcon={X}
            style={{ height: 40, boxShadow: "none" }}
          />

          <div
            className="flex flex-col"
            style={{ gap: 6, maxHeight: 288, overflowY: "auto" }}
          >
            {loadingInst ? (
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
                No institutions found
              </p>
            ) : (
              filtered.map((inst) => {
                const isSel = selected?.id === inst.id;
                return (
                  <button
                    key={inst.id}
                    onClick={() => setSelected(inst)}
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
                    <span
                      className="inline-flex items-center justify-center flex-shrink-0"
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "var(--r-sm)",
                        background: isSel ? "var(--blue-100)" : "var(--surface-card)",
                        color: isSel ? "var(--info-ink)" : "var(--text-muted)",
                      }}
                    >
                      <Building2 className="w-4 h-4" />
                    </span>
                    <span className="flex-1 min-w-0 flex flex-col" style={{ gap: 4 }}>
                      <span
                        className="truncate"
                        style={{
                          font: "600 13.5px/1 var(--font-sans)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {inst.institutionName}
                      </span>
                      <span
                        className="truncate"
                        style={{
                          font: "400 11.5px/1 var(--font-sans)",
                          color: "var(--text-muted)",
                        }}
                      >
                        {inst.institutionCode} · {inst.institutionType}
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

      {/* ── Step 2 — urgency + details ───────────────────────────────────── */}
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
            <Building2
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
                {selected?.institutionName}
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

          <Field
            label="Reason for referral"
            required
            hint={`${reason.length} characters — 10 minimum`}
          >
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Why is this patient being referred?"
              style={{ minHeight: 68 }}
            />
          </Field>

          <Field
            label="Clinical summary"
            required
            hint={`${clinicalSummary.length} characters — 10 minimum`}
          >
            <Textarea
              value={clinicalSummary}
              onChange={(e) => setClinicalSummary(e.target.value)}
              rows={4}
              placeholder="Relevant history, investigations done, current medications, allergies, working diagnosis…"
              style={{ minHeight: 110 }}
            />
          </Field>

          {error && (
            <Banner tone="critical" icon={AlertCircle}>
              {error}
            </Banner>
          )}
        </>
      )}

      {/* ── Step 3 — success ─────────────────────────────────────────────── */}
      {step === 3 && referralNumber && (
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
              Referral created
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
                {selected?.institutionName}
              </strong>
              .
            </p>
          </div>

          {/* The patient carries this number — it is the whole point. */}
          <div
            className="w-full"
            style={{
              padding: "20px 24px",
              borderRadius: "var(--r-md)",
              border: "1.5px dashed var(--blue-600)",
              background: "var(--info-tint)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <SectionLabel style={{ color: "var(--info-ink)" }}>
              Referral number
            </SectionLabel>
            <p
              style={{
                margin: 0,
                font: "700 22px/1 var(--font-mono)",
                letterSpacing: "0.02em",
                color: "var(--info-ink)",
              }}
            >
              {referralNumber}
            </p>
            <p
              style={{
                margin: 0,
                font: "400 11.5px/1.4 var(--font-sans)",
                color: "var(--info-ink)",
                opacity: 0.8,
              }}
            >
              Give this number to the patient — they present it at{" "}
              {selected?.institutionName}.
            </p>
          </div>

          <Badge tone={urgencyCfg.tone} dot style={{ height: 24 }}>
            {urgencyCfg.label} urgency
          </Badge>
        </div>
      )}
    </Modal>
  );
}
