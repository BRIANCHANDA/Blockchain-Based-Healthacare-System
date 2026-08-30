"use client";
import { useState, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { patientApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { PhoneInput } from "@/components/ui/PhoneInput";
import {
  CheckCircle,
  AlertCircle,
  User,
  Baby,
  Shield,
  Search,
  X,
  Loader2,
  Phone,
  UserPlus,
} from "lucide-react";
import {
  Page,
  PageHeader,
  Card,
  CardHeader,
  Field,
  Input,
  Select,
  Button,
  Banner,
  Pill,
  SectionLabel,
  hoverRow,
} from "@/components/dashboard/ui";

/* ==========================================================================
   Patient registration.

   Two registration paths share one form: adults are identified by NRC,
   minors by a guardian who must already exist as an adult patient. The
   `isMinor` toggle switches which block of fields is required, and the zod
   refinements below enforce that — the UI never relies on the toggle alone.
   ========================================================================== */

/** Renders a raw NRC as the Zambian 123456/78/9 form while the user types. */
function formatNRC(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 9);
  if (digits.length <= 6) return digits;
  if (digits.length <= 8) return `${digits.slice(0, 6)}/${digits.slice(6)}`;
  return `${digits.slice(0, 6)}/${digits.slice(6, 8)}/${digits.slice(8)}`;
}

function calcAge(dob: string): number {
  const d = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  // Birthday not yet reached this year.
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

const RELATIONSHIPS = [
  { value: "mother", label: "Mother" },
  { value: "father", label: "Father" },
  { value: "legal_guardian", label: "Legal Guardian" },
  { value: "grandparent", label: "Grandparent" },
  { value: "other", label: "Other" },
] as const;

// ── Schema ────────────────────────────────────────────────────────────────────
const schema = z
  .object({
    isMinor: z.boolean(),
    firstName: z.string().min(2, "Required"),
    lastName: z.string().min(2, "Required"),
    middleName: z.string().optional(),
    dateOfBirth: z.string().min(1, "Required"),
    gender: z.enum(["male", "female", "other"]),
    bloodType: z
      .enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "unknown"])
      .optional(),
    phoneNumber: z
      .string()
      .regex(/^\+\d{10,13}$/, "Enter a valid phone number (e.g. +260977123456)"),
    email: z.string().email({ message: "Invalid email" }).optional().or(z.literal("")),
    address: z.string().min(5, "Full address required"),
    nationalId: z.string().optional(),
    emergencyContact: z.string().min(5, "Required"),
    maritalStatus: z.enum(["single", "married", "divorced", "widowed"]).optional(),
    occupation: z.string().optional(),
    // Minor guardian fields
    guardianPatientId: z.string().uuid().optional(),
    guardianRelationship: z
      .enum(["mother", "father", "legal_guardian", "grandparent", "other"])
      .optional(),
    guardianDocumentReference: z.string().optional(),
  })
  .superRefine((d, ctx) => {
    if (!d.isMinor && !d.nationalId?.trim())
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "National ID is required for adult patients",
        path: ["nationalId"],
      });
    if (d.isMinor && d.dateOfBirth) {
      const age = calcAge(d.dateOfBirth);
      if (age >= 16)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Patient is ${age} years old — minor registration requires age under 16`,
          path: ["dateOfBirth"],
        });
    }
    if (d.isMinor && !d.guardianPatientId)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select an existing adult patient as guardian",
        path: ["guardianPatientId"],
      });
    if (d.isMinor && !d.guardianRelationship)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Relationship is required",
        path: ["guardianRelationship"],
      });
  });

type FormData = z.infer<typeof schema>;

type GuardianCandidate = {
  id: string;
  firstName: string;
  lastName: string;
  nationalId: string | null;
  dateOfBirth: string;
  gender: string;
};

/* Two-column field row that collapses to one column on narrow screens. */
function Row({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 16,
      }}
    >
      {children}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function RegisterPatientPage() {
  const user = useAuthStore((s) => s.user);
  const institutionId = user?.institutionId;

  const [submitted, setSubmitted] = useState<null | {
    patientId: string;
    isMinor: boolean;
    temporaryPatientId?: string | null;
    name: string;
  }>(null);
  const [serverError, setServerError] = useState("");

  // Guardian search state
  const [guardianQuery, setGuardianQuery] = useState("");
  const [guardianResults, setGuardianResults] = useState<GuardianCandidate[]>([]);
  const [guardianSearching, setGuardianSearching] = useState(false);
  const [selectedGuardian, setSelectedGuardian] = useState<GuardianCandidate | null>(
    null,
  );

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { isMinor: false, bloodType: "unknown", gender: "male" },
  });

  const isMinor = watch("isMinor");

  // ── Guardian search ──────────────────────────────────────────────────────
  const searchGuardians = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setGuardianResults([]);
      return;
    }
    setGuardianSearching(true);
    try {
      const res = await patientApi.search(q, true);
      const all: any[] = (res.data as any)?.data?.patients ?? [];
      // A minor cannot stand as guardian, so filter them out before display.
      setGuardianResults(
        all
          .filter((p: any) => !p.isMinor)
          .slice(0, 8)
          .map((p: any) => ({
            id: p.id,
            firstName: p.firstName,
            lastName: p.lastName,
            nationalId: p.nationalId ?? null,
            dateOfBirth: p.dateOfBirth,
            gender: p.gender,
          })),
      );
    } catch {
      /* ignore */
    } finally {
      setGuardianSearching(false);
    }
  }, []);

  const selectGuardian = (g: GuardianCandidate) => {
    setSelectedGuardian(g);
    setValue("guardianPatientId", g.id);
    setGuardianResults([]);
    setGuardianQuery(`${g.firstName} ${g.lastName}`);
  };

  const clearGuardian = () => {
    setSelectedGuardian(null);
    setValue("guardianPatientId", undefined);
    setGuardianQuery("");
    setGuardianResults([]);
  };

  // ── Submit ───────────────────────────────────────────────────────────────
  const onSubmit = async (data: FormData) => {
    setServerError("");
    try {
      const payload: any = {
        firstName: data.firstName,
        lastName: data.lastName,
        middleName: data.middleName || undefined,
        dateOfBirth: data.dateOfBirth,
        gender: data.gender,
        bloodType: data.bloodType || "unknown",
        phoneNumber: data.phoneNumber,
        email: data.email || undefined,
        address: data.address,
        emergencyContact: data.emergencyContact,
        maritalStatus: data.maritalStatus || undefined,
        occupation: data.occupation || undefined,
        isMinor: data.isMinor,
        institutionId: institutionId || undefined,
      };

      // The two paths are mutually exclusive — send only the relevant fields.
      if (data.isMinor) {
        payload.guardianPatientId = data.guardianPatientId;
        payload.guardianRelationship = data.guardianRelationship;
        payload.guardianDocumentReference = data.guardianDocumentReference || undefined;
      } else {
        payload.nationalId = data.nationalId;
      }

      const res = await patientApi.registerMinor(payload);
      const d = (res as any).data?.data;
      setSubmitted({
        patientId: d.patientId,
        isMinor: d.isMinor,
        temporaryPatientId: d.temporaryPatientId,
        name: `${data.firstName} ${data.lastName}`,
      });
    } catch (e: any) {
      setServerError(
        e?.response?.data?.error?.message ?? "Registration failed. Please try again.",
      );
    }
  };

  // ── Success screen ────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <Page maxWidth={560}>
        <div style={{ marginTop: 48 }}>
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
                <CheckCircle className="w-7 h-7" />
              </span>

              <h2
                style={{
                  margin: 0,
                  font: "700 22px/1.2 var(--font-sans)",
                  letterSpacing: "var(--ls-tight)",
                  color: "var(--text-primary)",
                }}
              >
                Patient registered
              </h2>

              <p
                style={{
                  margin: 0,
                  font: "400 14px/1.5 var(--font-sans)",
                  color: "var(--text-secondary)",
                }}
              >
                <strong style={{ color: "var(--text-primary)" }}>{submitted.name}</strong>{" "}
                has been added to the register.
              </p>

              {/*
               * A minor has no NRC, so the clinic issues a temporary ID that
               * doubles as their login until they turn 16. It is shown once,
               * prominently — the receptionist has to hand it over now.
               */}
              {submitted.isMinor && submitted.temporaryPatientId ? (
                <div
                  className="w-full text-left"
                  style={{
                    marginTop: 6,
                    padding: 18,
                    borderRadius: "var(--r-md)",
                    background: "var(--amber-050)",
                    border: "1px solid var(--amber-100)",
                    borderLeft: "4px solid var(--amber-500)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 7,
                  }}
                >
                  <SectionLabel style={{ color: "var(--urgent-ink)" }}>
                    Minor patient · clinic ID
                  </SectionLabel>
                  <p
                    style={{
                      margin: 0,
                      font: "700 24px/1 var(--font-mono)",
                      letterSpacing: "0.02em",
                      color: "var(--urgent-ink)",
                    }}
                  >
                    {submitted.temporaryPatientId}
                  </p>
                  <p
                    style={{
                      margin: 0,
                      font: "400 12px/1.5 var(--font-sans)",
                      color: "var(--urgent-ink)",
                      opacity: 0.85,
                    }}
                  >
                    Used for login until the patient turns 16 and receives an NRC.
                  </p>
                </div>
              ) : (
                <p
                  style={{
                    margin: 0,
                    font: "500 12.5px/1 var(--font-mono)",
                    color: "var(--text-muted)",
                  }}
                >
                  {submitted.patientId}
                </p>
              )}

              <Button
                variant="primary"
                icon={UserPlus}
                style={{ marginTop: 8 }}
                onClick={() => {
                  setSubmitted(null);
                  setSelectedGuardian(null);
                  setGuardianQuery("");
                }}
              >
                Register another patient
              </Button>
            </div>
          </Card>
        </div>
      </Page>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  const errMsg = (e?: { message?: string }) => e?.message;

  return (
    <Page maxWidth={860}>
      <PageHeader
        eyebrow="Front desk"
        title="Register patient"
        subtitle="Add a new patient to the register. Fields marked with an asterisk are required."
      />

      {/* ── Adult / Minor path selector ───────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 12,
        }}
      >
        {[
          {
            minor: false,
            icon: User,
            title: "Adult patient",
            sub: "Identified by NRC",
            active: "var(--brand)",
            tint: "var(--brand-tint)",
            ink: "var(--green-800)",
          },
          {
            minor: true,
            icon: Baby,
            title: "Minor patient",
            sub: "Under 16 · needs a guardian",
            active: "var(--amber-500)",
            tint: "var(--amber-050)",
            ink: "var(--urgent-ink)",
          },
        ].map((opt) => {
          const on = isMinor === opt.minor;
          return (
            <button
              key={opt.title}
              type="button"
              onClick={() => {
                setValue("isMinor", opt.minor);
                if (!opt.minor) clearGuardian();
              }}
              className="flex items-center text-left"
              style={{
                gap: 12,
                padding: "14px 16px",
                borderRadius: "var(--r-md)",
                border: `1.5px solid ${on ? opt.active : "var(--hc-border)"}`,
                background: on ? opt.tint : "var(--surface-card)",
                boxShadow: on ? "none" : "var(--elev-1)",
                cursor: "pointer",
                transition: "all var(--dur-fast) var(--ease-standard)",
              }}
            >
              <span
                className="inline-flex items-center justify-center flex-shrink-0"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "var(--r-sm)",
                  background: on ? "var(--surface-card)" : "var(--surface-sunken)",
                  color: on ? opt.ink : "var(--text-muted)",
                }}
              >
                <opt.icon className="w-[17px] h-[17px]" />
              </span>
              <span className="flex flex-col" style={{ gap: 3 }}>
                <span
                  style={{
                    font: "700 14px/1 var(--font-sans)",
                    color: on ? opt.ink : "var(--text-primary)",
                  }}
                >
                  {opt.title}
                </span>
                <span
                  style={{
                    font: "400 12px/1 var(--font-sans)",
                    color: on ? opt.ink : "var(--text-muted)",
                    opacity: on ? 0.85 : 1,
                  }}
                >
                  {opt.sub}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        style={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
        {/* ── Personal details ── */}
        <Card>
          <CardHeader icon={User} title="Personal details" />
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            <Row>
              <Field label="First name" required error={errMsg(errors.firstName)}>
                <Input invalid={!!errors.firstName} {...register("firstName")} />
              </Field>
              <Field label="Last name" required error={errMsg(errors.lastName)}>
                <Input invalid={!!errors.lastName} {...register("lastName")} />
              </Field>
            </Row>

            <Field label="Middle name">
              <Input {...register("middleName")} />
            </Field>

            <Row>
              <Field label="Date of birth" required error={errMsg(errors.dateOfBirth)}>
                <Input
                  type="date"
                  invalid={!!errors.dateOfBirth}
                  max={new Date().toISOString().split("T")[0]}
                  {...register("dateOfBirth")}
                />
              </Field>
              <Field label="Gender" required>
                <Select {...register("gender")}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </Select>
              </Field>
            </Row>

            <Row>
              <Field label="Blood type">
                <Select {...register("bloodType")}>
                  {["unknown", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(
                    (bt) => (
                      <option key={bt} value={bt}>
                        {bt}
                      </option>
                    ),
                  )}
                </Select>
              </Field>
              <Field label="Marital status">
                <Select {...register("maritalStatus")}>
                  <option value="">— select —</option>
                  <option value="single">Single</option>
                  <option value="married">Married</option>
                  <option value="divorced">Divorced</option>
                  <option value="widowed">Widowed</option>
                </Select>
              </Field>
            </Row>

            <Field label="Occupation">
              <Input {...register("occupation")} />
            </Field>
          </div>
        </Card>

        {/* ── NRC (adults only) ── */}
        {!isMinor && (
          <Card>
            <CardHeader icon={Shield} title="National ID" />
            <div style={{ padding: 20 }}>
              <Field
                label="NRC number"
                required
                error={errMsg(errors.nationalId)}
                hint="Formatted automatically as you type."
              >
                <Controller
                  control={control}
                  name="nationalId"
                  render={({ field }) => (
                    <Input
                      placeholder="123456/78/1"
                      invalid={!!errors.nationalId}
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(formatNRC(e.target.value))}
                      style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.02em" }}
                    />
                  )}
                />
              </Field>
            </div>
          </Card>
        )}

        {/* ── Guardian section (minors only) ── */}
        {isMinor && (
          <Card style={{ borderColor: "var(--amber-100)" }}>
            <CardHeader
              icon={Baby}
              title="Guardian details"
              subtitle="The guardian must already be a registered adult patient"
              tone="urgent"
            />
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Guardian search */}
              <Field
                label="Search guardian by name or NRC"
                required
                error={errMsg((errors as any).guardianPatientId)}
              >
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
                    placeholder="Type a name or NRC…"
                    value={guardianQuery}
                    invalid={!!(errors as any).guardianPatientId}
                    onChange={(e) => {
                      setGuardianQuery(e.target.value);
                      // Editing the query invalidates any prior selection.
                      if (selectedGuardian) clearGuardian();
                      searchGuardians(e.target.value);
                    }}
                    style={{ paddingLeft: 36, paddingRight: 36 }}
                  />
                  {guardianSearching && (
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
                  {selectedGuardian && !guardianSearching && (
                    <button
                      type="button"
                      onClick={clearGuardian}
                      className="absolute inline-flex items-center justify-center"
                      style={{
                        right: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: 24,
                        height: 24,
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
              </Field>

              {/* Search results */}
              {guardianResults.length > 0 && (
                <div
                  style={{
                    marginTop: -8,
                    borderRadius: "var(--r-sm)",
                    border: "1px solid var(--hc-border)",
                    boxShadow: "var(--elev-2)",
                    overflow: "hidden",
                  }}
                >
                  {guardianResults.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => selectGuardian(g)}
                      className="w-full text-left"
                      style={{
                        padding: "11px 14px",
                        border: "none",
                        borderBottom: "1px solid var(--border-faint)",
                        background: "transparent",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                      }}
                      {...hoverRow}
                    >
                      <span
                        style={{
                          font: "600 13.5px/1 var(--font-sans)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {g.firstName} {g.lastName}
                      </span>
                      <span
                        style={{
                          font: "400 11.5px/1 var(--font-sans)",
                          color: "var(--text-muted)",
                        }}
                      >
                        {g.nationalId ?? "No NRC"} · {g.gender} · age{" "}
                        {g.dateOfBirth ? calcAge(g.dateOfBirth) : "?"}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Selected guardian confirmation */}
              {selectedGuardian && (
                <div
                  className="flex items-center justify-between"
                  style={{
                    gap: 12,
                    padding: "12px 16px",
                    borderRadius: "var(--r-md)",
                    background: "var(--brand-tint)",
                    border: "1px solid var(--green-100)",
                  }}
                >
                  <div className="min-w-0 flex flex-col" style={{ gap: 4 }}>
                    <span
                      className="truncate"
                      style={{
                        font: "700 13.5px/1 var(--font-sans)",
                        color: "var(--green-800)",
                      }}
                    >
                      {selectedGuardian.firstName} {selectedGuardian.lastName}
                    </span>
                    <span
                      className="truncate"
                      style={{
                        font: "400 11.5px/1 var(--font-sans)",
                        color: "var(--green-800)",
                        opacity: 0.85,
                      }}
                    >
                      {selectedGuardian.nationalId ?? "No NRC"} · {selectedGuardian.gender}{" "}
                      · age {calcAge(selectedGuardian.dateOfBirth)}
                    </span>
                  </div>
                  <Pill tone="success" icon={CheckCircle}>
                    Linked
                  </Pill>
                </div>
              )}

              <Field
                label="Relationship to patient"
                required
                error={errMsg(errors.guardianRelationship)}
              >
                <Select
                  invalid={!!errors.guardianRelationship}
                  {...register("guardianRelationship")}
                >
                  <option value="">— select relationship —</option>
                  {RELATIONSHIPS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label="Document reference"
                hint="Birth certificate number, court order, or similar."
              >
                <Input {...register("guardianDocumentReference")} />
              </Field>
            </div>
          </Card>
        )}

        {/* ── Contact ── */}
        <Card>
          <CardHeader icon={Phone} title="Contact & address" />
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            <Field label="Phone number" required error={errMsg(errors.phoneNumber)}>
              <Controller
                control={control}
                name="phoneNumber"
                render={({ field }) => (
                  <PhoneInput value={field.value ?? ""} onChange={field.onChange} />
                )}
              />
            </Field>

            <Field label="Email" error={errMsg(errors.email)}>
              <Input type="email" invalid={!!errors.email} {...register("email")} />
            </Field>

            <Field label="Address" required error={errMsg(errors.address)}>
              <Input
                placeholder="Street, city, province"
                invalid={!!errors.address}
                {...register("address")}
              />
            </Field>

            <Field
              label="Emergency contact"
              required
              error={errMsg(errors.emergencyContact)}
            >
              <Input
                placeholder="+260977123456"
                invalid={!!errors.emergencyContact}
                {...register("emergencyContact")}
              />
            </Field>
          </div>
        </Card>

        {serverError && (
          <Banner tone="critical" icon={AlertCircle}>
            {serverError}
          </Banner>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          full
          loading={isSubmitting}
          icon={UserPlus}
        >
          {isSubmitting ? "Registering…" : "Register patient"}
        </Button>
      </form>
    </Page>
  );
}
