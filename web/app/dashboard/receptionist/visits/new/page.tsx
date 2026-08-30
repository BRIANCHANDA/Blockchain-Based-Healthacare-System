"use client";
import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { visitApi, patientApi, practitionersApi } from "@/lib/api";
import type { PatientSummary } from "@/lib/api";
import PatientQRScanner from "@/components/PatientQRScanner";
import {
  Search,
  UserPlus,
  ChevronLeft,
  AlertCircle,
  CheckCircle2,
  Loader2,
  User,
  ClipboardList,
  Activity,
  ChevronRight,
  Stethoscope,
  QrCode,
} from "lucide-react";
import {
  Page,
  Card,
  CardHeader,
  Field,
  Input,
  Button,
  Banner,
  Avatar,
  MonoTag,
  DataRow,
  SegmentedControl,
  EmptyState,
  hoverRow,
  TONES,
  type Tone,
} from "@/components/dashboard/ui";

/* ==========================================================================
   New-visit wizard.

   Four steps, but only two of them write: step 2 creates the visit, step 3
   assigns a nurse. That ordering matters — the visit exists from step 3
   onward, so backing out after step 2 leaves a real record behind rather
   than discarding a draft. Step 3 can be skipped; a nurse can be assigned
   later from the visit page.
   ========================================================================== */

// ── Types ─────────────────────────────────────────────────────────────────────

interface NurseResult {
  id: string;
  name: string;
}

interface ActiveVisit {
  visitNumber: string;
  visitId: string;
}

// ── Schema ────────────────────────────────────────────────────────────────────
const visitSchema = z.object({
  visitType: z.enum(["outpatient", "inpatient", "emergency", "consultation"]),
  priority: z.enum(["routine", "urgent", "emergency", "critical"]).default("routine"),
  wardOrRoom: z.string().optional(),
});
type VisitForm = z.infer<typeof visitSchema>;

// ── Priority / visit type config ──────────────────────────────────────────────
const PRIORITIES: { value: string; label: string; tone: Tone }[] = [
  { value: "routine", label: "Routine", tone: "success" },
  { value: "urgent", label: "Urgent", tone: "urgent" },
  { value: "emergency", label: "Emergency", tone: "critical" },
  { value: "critical", label: "Critical", tone: "accent" },
];

const VISIT_TYPES = [
  { value: "outpatient", label: "Outpatient" },
  { value: "inpatient", label: "Inpatient" },
  { value: "emergency", label: "Emergency" },
  { value: "consultation", label: "Consultation" },
];

// ── Step indicator ────────────────────────────────────────────────────────────
function Steps({ current }: { current: 1 | 2 | 3 | 4 }) {
  const steps = [
    { n: 1, label: "Find patient" },
    { n: 2, label: "Visit details" },
    { n: 3, label: "Assign nurse" },
    { n: 4, label: "Confirm" },
  ];
  return (
    <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
      {steps.map(({ n, label }, i) => {
        const done = current > n;
        const active = current === n;
        const reached = done || active;
        return (
          <div key={n} className="flex items-center" style={{ gap: 8 }}>
            <span
              className="inline-flex items-center justify-center flex-shrink-0"
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: reached ? "var(--brand)" : "var(--surface-sunken)",
                color: reached ? "var(--on-brand)" : "var(--text-muted)",
                font: "700 12px/1 var(--font-sans)",
                // Only the step in progress gets the focus halo.
                boxShadow: active ? "0 0 0 4px var(--brand-fill)" : undefined,
                transition: "all var(--dur-base) var(--ease-standard)",
              }}
            >
              {done ? <CheckCircle2 className="w-4 h-4" /> : n}
            </span>
            <span
              className="hidden sm:block"
              style={{
                font: `${active ? 700 : 500} 13px/1 var(--font-sans)`,
                color: active
                  ? "var(--text-primary)"
                  : done
                    ? "var(--text-secondary)"
                    : "var(--text-muted)",
              }}
            >
              {label}
            </span>
            {i < steps.length - 1 && (
              <span
                className="flex-shrink-0"
                style={{
                  width: 24,
                  height: 1,
                  background: done ? "var(--brand)" : "var(--hc-border)",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Selected-patient chip shown at the top of steps 1 and 2. */
function PatientChip({
  patient,
  onChange,
  tone = "brand",
}: {
  patient: PatientSummary;
  onChange: () => void;
  tone?: "brand" | "plain";
}) {
  return (
    <div
      className="flex items-center"
      style={{
        gap: 12,
        padding: 14,
        borderRadius: "var(--r-md)",
        background: tone === "brand" ? "var(--brand-tint)" : "var(--surface-card)",
        border: `1px solid ${tone === "brand" ? "var(--green-100)" : "var(--hc-border)"}`,
      }}
    >
      <Avatar name={`${patient.firstName} ${patient.lastName}`} size={38} seed={0} />
      <div className="flex-1 min-w-0 flex flex-col" style={{ gap: 4 }}>
        <p
          className="truncate"
          style={{
            margin: 0,
            font: "700 13.5px/1 var(--font-sans)",
            color: "var(--text-primary)",
          }}
        >
          {patient.firstName} {patient.lastName}
        </p>
        <p
          className="truncate"
          style={{
            margin: 0,
            font: "400 11px/1 var(--font-mono)",
            color: "var(--text-muted)",
          }}
        >
          {patient.id}
        </p>
      </div>
      <Button variant="ghost" size="sm" onClick={onChange}>
        Change
      </Button>
    </div>
  );
}

/** Radio group rendered as selectable chips (visit type / priority). */
function ChipRadio({
  options,
  selected,
  register,
  name,
}: {
  options: { value: string; label: string; tone?: Tone }[];
  selected: string;
  register: any;
  name: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
        gap: 8,
      }}
    >
      {options.map((o) => {
        const on = selected === o.value;
        const t = o.tone ? TONES[o.tone] : null;
        return (
          <label
            key={o.value}
            className="flex items-center justify-center"
            style={{
              height: 40,
              padding: "0 12px",
              borderRadius: "var(--r-sm)",
              cursor: "pointer",
              font: `${on ? 700 : 500} 12.5px/1 var(--font-sans)`,
              // A toned option colours itself when chosen; an untoned one
              // falls back to the brand fill.
              background: on ? (t ? t.tint : "var(--brand)") : "var(--surface-sunken)",
              color: on
                ? t
                  ? t.ink
                  : "var(--on-brand)"
                : "var(--text-secondary)",
              border: `1px solid ${on ? (t ? t.ink : "var(--brand)") : "var(--hc-border)"}`,
              transition: "all var(--dur-fast) var(--ease-standard)",
            }}
          >
            <input type="radio" value={o.value} {...register(name)} className="sr-only" />
            {o.label}
          </label>
        );
      })}
    </div>
  );
}

// ── Inner component ───────────────────────────────────────────────────────────
function NewVisitPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1 — find mode (search vs scan)
  const [findMode, setFindMode] = useState<"search" | "scan">("search");

  // Step 1 — patient search
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<PatientSummary[]>([]);
  const [searchError, setSearchError] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<PatientSummary | null>(null);

  // Active visit check
  const [activeVisit, setActiveVisit] = useState<ActiveVisit | null>(null);
  const [checkingVisit, setCheckingVisit] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 2 — visit form
  const {
    register,
    handleSubmit,
    watch,
  } = useForm<VisitForm>({
    resolver: zodResolver(visitSchema) as Resolver<VisitForm>,
    defaultValues: { visitType: "outpatient", priority: "routine" },
  });
  const priority = watch("priority");
  const visitType = watch("visitType");

  // Step 3 — nurse assignment
  const [createdVisit, setCreatedVisit] = useState<{
    visitId: string;
    visitNumber: string;
  } | null>(null);
  const [nurses, setNurses] = useState<NurseResult[]>([]);
  const [nursesLoading, setNursesLoading] = useState(false);
  const [selectedNurseId, setSelectedNurseId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState("");

  // Step 4 — done
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // ── Check whether the patient already has an active visit ─────────────────
  // shouldAdvance: auto-skip to step 2 when check passes (QR / URL flows only)
  const checkActiveVisit = useCallback(
    async (patientId: string, shouldAdvance = false) => {
      setCheckingVisit(true);
      setActiveVisit(null);
      try {
        const res = await visitApi.getTodayQueue();
        const visits: any[] = res.data.data?.visits ?? [];
        const existing = visits.find((v: any) => v.patientId === patientId);
        if (existing) {
          setActiveVisit({ visitNumber: existing.visitNumber, visitId: existing.id });
        } else if (shouldAdvance) {
          setStep(2);
        }
      } catch {
        // Fail silently — if the check errors and we should advance, still
        // advance so a network hiccup doesn't block the receptionist; the
        // server rejects duplicates anyway.
        if (shouldAdvance) setStep(2);
      } finally {
        setCheckingVisit(false);
      }
    },
    [],
  );

  // Pre-select patient from URL (?patientId=) — comes from the QR scan page
  useEffect(() => {
    const patientId = searchParams.get("patientId");
    if (patientId) {
      patientApi
        .getById(patientId)
        .then((res) => {
          const patient = res.data.data;
          setSelectedPatient(patient);
          // Auto-advance after check: the scan page already confirmed the patient
          checkActiveVisit(patient.id, true);
        })
        .catch(console.error);
    }
  }, [searchParams, checkActiveVisit]);

  // Load nurses when we reach step 3
  useEffect(() => {
    if (step !== 3) return;
    setNursesLoading(true);
    practitionersApi
      .getOnlineStaff("nurse")
      .then((res) => {
        const staff = res.data.data?.staff ?? [];
        setNurses(
          staff.map((n: any) => ({ id: n.id, name: `${n.firstName} ${n.lastName}` })),
        );
      })
      .catch(() => setNurses([]))
      .finally(() => setNursesLoading(false));
  }, [step]);

  // Search patients (debounced — one request per pause in typing)
  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    setSelectedPatient(null);
    setActiveVisit(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      setSearchError("");
      try {
        const res = await patientApi.search(q);
        setSearchResults(res.data.data.patients ?? []);
      } catch {
        setSearchError("Search failed. Try a patient UUID.");
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  }, []);

  // Switch between search / scan tabs — clear prior state
  const switchMode = (mode: "search" | "scan") => {
    setFindMode(mode);
    setSelectedPatient(null);
    setActiveVisit(null);
    setSearchQuery("");
    setSearchResults([]);
    setSearchError("");
  };

  // Step 2 → create visit → go to step 3
  const onSubmitVisit = async (data: VisitForm) => {
    if (!selectedPatient) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await visitApi.create({
        patientId: selectedPatient.id,
        visitType: data.visitType,
        priority: data.priority,
        wardOrRoom: data.wardOrRoom || undefined,
      });
      setCreatedVisit(res.data.data);
      setStep(3);
    } catch (err: any) {
      setSubmitError(
        err.response?.data?.error?.message ??
          "Failed to create visit. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Step 3 → assign nurse → go to step 4
  const handleAssignNurse = async () => {
    if (!createdVisit || !selectedNurseId) return;
    setAssigning(true);
    setAssignError("");
    try {
      await visitApi.assignNurse(createdVisit.visitId, selectedNurseId);
      setStep(4);
    } catch (err: any) {
      setAssignError(
        err.response?.data?.error?.message ??
          "Failed to assign nurse. You can assign later from the visit page.",
      );
    } finally {
      setAssigning(false);
    }
  };

  // Full reset back to step 1
  const handleReset = () => {
    setStep(1);
    setFindMode("search");
    setSelectedPatient(null);
    setActiveVisit(null);
    setCreatedVisit(null);
    setSelectedNurseId(null);
    setSearchQuery("");
    setSearchResults([]);
    setSubmitError("");
    setAssignError("");
  };

  return (
    <Page maxWidth={700}>
      {/* Header */}
      <div className="flex items-center" style={{ gap: 12 }}>
        <Button
          icon={ChevronLeft}
          onClick={() => (step > 1 ? setStep((step - 1) as 1 | 2 | 3 | 4) : router.back())}
          style={{ padding: 0, width: 38 }}
        />
        <div className="min-w-0 flex flex-col" style={{ gap: 5 }}>
          <h1
            style={{
              margin: 0,
              font: "700 22px/1.1 var(--font-sans)",
              letterSpacing: "var(--ls-tight)",
              color: "var(--text-primary)",
            }}
          >
            New visit
          </h1>
          <p
            style={{
              margin: 0,
              font: "400 13px/1.4 var(--font-sans)",
              color: "var(--text-secondary)",
            }}
          >
            Register a patient visit and assign them to a nurse
          </p>
        </div>
      </div>

      <Steps current={step} />

      {/* ── STEP 1: Find Patient ────────────────────────────────────────────── */}
      {step === 1 && (
        <>
          <Card>
            <CardHeader
              icon={findMode === "scan" ? QrCode : Search}
              title="Find patient"
              right={
                <SegmentedControl<"search" | "scan">
                  value={findMode}
                  onChange={switchMode}
                  options={[
                    { value: "search", label: "Search" },
                    { value: "scan", label: "Scan QR" },
                  ]}
                />
              }
            />

            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              {/* ── Search mode ── */}
              {findMode === "search" && !selectedPatient && (
                <>
                  <Field hint="Search by the patient's name or ID.">
                    <div className="relative">
                      <Search
                        className="absolute w-4 h-4"
                        style={{
                          left: 12,
                          top: "50%",
                          transform: "translateY(-50%)",
                          color: "var(--text-muted)",
                        }}
                      />
                      <Input
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                        placeholder="Enter patient ID or name…"
                        autoFocus
                        style={{ paddingLeft: 36, paddingRight: 36 }}
                      />
                      {searching && (
                        <Loader2
                          className="absolute w-4 h-4 animate-spin"
                          style={{
                            right: 12,
                            top: "50%",
                            transform: "translateY(-50%)",
                            color: "var(--text-muted)",
                          }}
                        />
                      )}
                    </div>
                  </Field>

                  {searchError && (
                    <Banner tone="critical" icon={AlertCircle}>
                      {searchError}
                    </Banner>
                  )}

                  {searchResults.length > 0 && (
                    <div className="flex flex-col" style={{ gap: 6 }}>
                      {searchResults.map((patient: PatientSummary) => (
                        <button
                          key={patient.id}
                          onClick={() => {
                            setSelectedPatient(patient);
                            // Manual selection: show Continue, don't auto-advance.
                            checkActiveVisit(patient.id, false);
                          }}
                          className="w-full flex items-center text-left"
                          style={{
                            gap: 12,
                            padding: 12,
                            borderRadius: "var(--r-sm)",
                            border: "1px solid var(--border-faint)",
                            background: "transparent",
                            cursor: "pointer",
                          }}
                          {...hoverRow}
                        >
                          <Avatar
                            name={`${patient.firstName} ${patient.lastName}`}
                            size={36}
                            seed={0}
                          />
                          <span
                            className="flex-1 min-w-0 truncate"
                            style={{
                              font: "600 13.5px/1 var(--font-sans)",
                              color: "var(--text-primary)",
                            }}
                          >
                            {patient.firstName} {patient.lastName}
                          </span>
                          <ChevronRight
                            className="w-4 h-4 flex-shrink-0"
                            style={{ color: "var(--text-disabled)" }}
                          />
                        </button>
                      ))}
                    </div>
                  )}

                  {searchQuery && !searching && searchResults.length === 0 && !searchError && (
                    <EmptyState
                      icon={User}
                      title="No patients found"
                      message="Check the spelling, or register the patient first."
                      tone="neutral"
                      pad={28}
                    />
                  )}
                </>
              )}

              {/* ── Scan mode ── */}
              {findMode === "scan" && !selectedPatient && (
                <PatientQRScanner
                  onFound={(patient) => {
                    setSelectedPatient(patient as PatientSummary);
                    // Auto-advance after check: QR already confirmed the patient
                    checkActiveVisit(patient.id, true);
                  }}
                  hint="Hold the patient's QR code steady in the frame. Once scanned you'll go straight to visit details — no extra tap needed."
                />
              )}

              {/* ── Active-visit check + Continue (shared for both modes) ── */}
              {selectedPatient && (
                <>
                  <PatientChip
                    patient={selectedPatient}
                    onChange={() => {
                      setSelectedPatient(null);
                      setActiveVisit(null);
                    }}
                  />

                  {checkingVisit && (
                    <div
                      className="flex items-center"
                      style={{
                        gap: 10,
                        padding: 14,
                        borderRadius: "var(--r-sm)",
                        background: "var(--surface-sunken)",
                      }}
                    >
                      <Loader2
                        className="w-4 h-4 animate-spin flex-shrink-0"
                        style={{ color: "var(--text-muted)" }}
                      />
                      <p
                        style={{
                          margin: 0,
                          font: "400 13px/1 var(--font-sans)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        Checking for active visits…
                      </p>
                    </div>
                  )}

                  {/*
                   * A patient can hold only one active visit, so an existing
                   * one blocks the wizard rather than warning about it.
                   */}
                  {!checkingVisit && activeVisit && (
                    <Banner
                      tone="urgent"
                      icon={AlertCircle}
                      title="Active visit already exists"
                      action={
                        <Button
                          variant="ghost"
                          size="sm"
                          iconRight={ChevronRight}
                          onClick={() =>
                            router.push(
                              `/dashboard/receptionist/visits/${activeVisit.visitId}`,
                            )
                          }
                          style={{ color: "var(--urgent-ink)" }}
                        >
                          View visit
                        </Button>
                      }
                    >
                      Visit {activeVisit.visitNumber} is currently in progress for{" "}
                      {selectedPatient.firstName} {selectedPatient.lastName}.
                    </Banner>
                  )}

                  {/* Search mode only: explicit Continue; scan mode auto-advances. */}
                  {!checkingVisit && !activeVisit && findMode === "search" && (
                    <Button
                      variant="primary"
                      full
                      iconRight={ChevronRight}
                      onClick={() => setStep(2)}
                    >
                      Continue with {selectedPatient.firstName} {selectedPatient.lastName}
                    </Button>
                  )}
                </>
              )}
            </div>
          </Card>

          <Card pad={18}>
            <p
              style={{
                margin: "0 0 12px",
                font: "400 13px/1 var(--font-sans)",
                color: "var(--text-secondary)",
              }}
            >
              Patient not in the system yet?
            </p>
            <button
              onClick={() => router.push("/dashboard/receptionist/register")}
              className="w-full inline-flex items-center justify-center"
              style={{
                gap: 8,
                height: 42,
                borderRadius: "var(--r-md)",
                border: "1.5px dashed var(--green-200)",
                background: "transparent",
                color: "var(--green-700)",
                font: "600 13.5px/1 var(--font-sans)",
                cursor: "pointer",
                transition: "background var(--dur-fast) var(--ease-standard)",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--brand-tint)")
              }
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <UserPlus className="w-4 h-4" />
              Register new patient first
            </button>
          </Card>
        </>
      )}

      {/* ── STEP 2: Visit Details ─────────────────────────────────────────── */}
      {step === 2 && selectedPatient && (
        <form
          onSubmit={handleSubmit(onSubmitVisit)}
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          <Card pad={14}>
            <PatientChip
              patient={selectedPatient}
              tone="plain"
              onChange={() => {
                setSelectedPatient(null);
                setActiveVisit(null);
                setStep(1);
              }}
            />
          </Card>

          <Card>
            <CardHeader icon={ClipboardList} title="Visit information" />
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
              <Field label="Visit type" required>
                <ChipRadio
                  options={VISIT_TYPES}
                  selected={visitType}
                  register={register}
                  name="visitType"
                />
              </Field>

              <Field label="Priority" required>
                <ChipRadio
                  options={PRIORITIES}
                  selected={priority}
                  register={register}
                  name="priority"
                />
              </Field>

              <Field label="Ward / room" hint="Optional — can be set later.">
                <Input placeholder="e.g. OPD Ward 3, Room 12B" {...register("wardOrRoom")} />
              </Field>
            </div>
          </Card>

          {submitError && (
            <Banner tone="critical" icon={AlertCircle}>
              {submitError}
            </Banner>
          )}

          <div className="flex items-center justify-between" style={{ gap: 12 }}>
            <Button onClick={() => setStep(1)}>Back</Button>
            <Button
              type="submit"
              variant="primary"
              icon={Activity}
              loading={submitting}
            >
              {submitting ? "Creating visit…" : "Create visit"}
            </Button>
          </div>
        </form>
      )}

      {/* ── STEP 3: Assign Nurse ────────────────────────────────────────────── */}
      {step === 3 && createdVisit && (
        <>
          <Banner
            tone="success"
            icon={CheckCircle2}
            title={`Visit ${createdVisit.visitNumber} created`}
          >
            Now assign a nurse so the patient appears in their triage queue.
          </Banner>

          <Card>
            <CardHeader icon={Stethoscope} title="Select a nurse" />

            {nursesLoading ? (
              <div
                className="flex items-center justify-center"
                style={{ padding: 48, gap: 9 }}
              >
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--brand)" }} />
                <span
                  style={{ font: "400 13px/1 var(--font-sans)", color: "var(--text-muted)" }}
                >
                  Loading nurses…
                </span>
              </div>
            ) : nurses.length === 0 ? (
              <EmptyState
                icon={Stethoscope}
                title="No nurses available"
                message="No nurses are online in your institution right now. You can skip this and assign one later."
                tone="neutral"
              />
            ) : (
              <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                {nurses.map((nurse) => {
                  const selected = selectedNurseId === nurse.id;
                  return (
                    <button
                      key={nurse.id}
                      onClick={() => setSelectedNurseId(nurse.id)}
                      className="w-full flex items-center text-left"
                      style={{
                        gap: 12,
                        padding: 12,
                        borderRadius: "var(--r-sm)",
                        border: `1px solid ${selected ? "var(--brand)" : "var(--border-faint)"}`,
                        background: selected ? "var(--brand-tint)" : "transparent",
                        cursor: "pointer",
                        transition: "all var(--dur-fast) var(--ease-standard)",
                      }}
                    >
                      <Avatar name={nurse.name} size={36} seed={2} />
                      <div className="flex-1 min-w-0 flex flex-col" style={{ gap: 4 }}>
                        <span
                          className="truncate"
                          style={{
                            font: "600 13.5px/1 var(--font-sans)",
                            color: "var(--text-primary)",
                          }}
                        >
                          {nurse.name}
                        </span>
                        <span
                          style={{
                            font: "400 11px/1 var(--font-mono)",
                            color: "var(--text-muted)",
                          }}
                        >
                          {nurse.id.slice(0, 12)}…
                        </span>
                      </div>
                      {selected && (
                        <CheckCircle2
                          className="w-4 h-4 flex-shrink-0"
                          style={{ color: "var(--green-700)" }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          {assignError && (
            <Banner tone="critical" icon={AlertCircle}>
              {assignError}
            </Banner>
          )}

          <div className="flex items-center justify-between" style={{ gap: 12 }}>
            <Button variant="ghost" onClick={() => setStep(4)}>
              Skip for now
            </Button>
            <Button
              variant="primary"
              icon={Stethoscope}
              loading={assigning}
              disabled={!selectedNurseId}
              onClick={handleAssignNurse}
            >
              {assigning ? "Assigning…" : "Assign nurse"}
            </Button>
          </div>
        </>
      )}

      {/* ── STEP 4: Success ─────────────────────────────────────────────────── */}
      {step === 4 && createdVisit && (
        <Card pad={32}>
          <div className="flex flex-col items-center text-center" style={{ gap: 14 }}>
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

            <h2
              style={{
                margin: 0,
                font: "700 22px/1.2 var(--font-sans)",
                letterSpacing: "var(--ls-tight)",
                color: "var(--text-primary)",
              }}
            >
              Visit created
            </h2>

            <p
              style={{
                margin: 0,
                maxWidth: 380,
                font: "400 13.5px/1.5 var(--font-sans)",
                color: "var(--text-secondary)",
              }}
            >
              {selectedNurseId
                ? "The patient has been added to the assigned nurse's triage queue."
                : "The visit is live. Assign a nurse from the visit page when ready."}
            </p>

            <div
              className="w-full text-left"
              style={{
                marginTop: 6,
                padding: "4px 16px 12px",
                borderRadius: "var(--r-sm)",
                background: "var(--surface-sunken)",
              }}
            >
              <DataRow
                label="Visit number"
                value={<MonoTag>{createdVisit.visitNumber}</MonoTag>}
              />
              <DataRow
                label="Patient"
                value={`${selectedPatient?.firstName ?? ""} ${selectedPatient?.lastName ?? ""}`}
              />
              {selectedNurseId && (
                <DataRow
                  label="Assigned nurse"
                  value={nurses.find((n) => n.id === selectedNurseId)?.name ?? "Assigned"}
                />
              )}
            </div>

            <div className="w-full" style={{ marginTop: 2 }}>
              <Banner tone="success" icon={Activity}>
                This visit is now live in the queue.
              </Banner>
            </div>

            <div className="w-full flex" style={{ gap: 12, marginTop: 6 }}>
              <Button full onClick={handleReset}>
                New visit
              </Button>
              <Button
                variant="primary"
                full
                onClick={() => router.push("/dashboard/receptionist/queue")}
              >
                View queue
              </Button>
            </div>
          </div>
        </Card>
      )}
    </Page>
  );
}

export default function NewVisitPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center" style={{ height: 256, gap: 10 }}>
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--brand)" }} />
          <span style={{ font: "400 13.5px/1 var(--font-sans)", color: "var(--text-secondary)" }}>
            Loading…
          </span>
        </div>
      }
    >
      <NewVisitPageInner />
    </Suspense>
  );
}
