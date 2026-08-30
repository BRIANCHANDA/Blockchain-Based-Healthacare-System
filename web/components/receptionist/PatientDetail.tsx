"use client";
import { useState, useEffect } from "react";
import { patientApi, api } from "@/lib/api";
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Heart,
  Briefcase,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Hash,
  Users,
  Building2,
  Edit3,
  X,
  Save,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
} from "lucide-react";
import { MinorBadge, ageFromDob } from "@/components/ui/MinorBadge";
import { PatientGuardiansSection } from "@/components/ui/PatientGuardiansSection";
import {
  Page,
  Card,
  Field,
  Input,
  Select,
  Textarea,
  Button,
  Pill,
  MonoTag,
  Avatar,
  Banner,
  SectionLabel,
} from "@/components/dashboard/ui";

/* ==========================================================================
   Patient detail — registration and demographic data only.

   The same layout serves both view and edit mode; edit swaps the InfoRow
   readouts for form controls in the two editable sections. Identity and
   registration stay read-only in both, because a receptionist cannot change
   a national ID or which institution a patient is registered with.
   ========================================================================== */

// ── Types ─────────────────────────────────────────────────────────────────────
interface PatientRegistration {
  id: string;
  blockchainAddress: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth: string;
  gender: string;
  bloodType: string;
  phoneNumber: string;
  email?: string;
  address: string;
  emergencyContact: string;
  nationalId: string | null;
  maritalStatus?: string;
  occupation?: string;
  isActive: boolean;
  isMinor?: boolean;
  temporaryPatientId?: string;
  createdAt: string;
  registration?: {
    hospitalPatientNumber: string;
    isHomeInstitution: boolean;
    registeredAt: string;
  } | null;
}

interface EditForm {
  firstName: string;
  lastName: string;
  middleName: string;
  dateOfBirth: string;
  gender: string;
  phoneNumber: string;
  email: string;
  address: string;
  emergencyContact: string;
  maritalStatus: string;
  occupation: string;
}

interface PatientDetailProps {
  patientId: string;
  onBack: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function age(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  let a = now.getFullYear() - birth.getFullYear();
  // Birthday not yet reached this year.
  if (
    now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())
  )
    a--;
  return a;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-ZM", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function capitalize(s?: string | null) {
  if (!s) return "—";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** Read-only label/value pair with a leading icon chip. */
function InfoRow({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon: React.ElementType;
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  return (
    <div
      className="flex items-start"
      style={{ gap: 12, padding: "12px 0", borderBottom: "1px solid var(--border-faint)" }}
    >
      <span
        className="inline-flex items-center justify-center flex-shrink-0"
        style={{
          width: 30,
          height: 30,
          borderRadius: "var(--r-xs)",
          background: "var(--surface-sunken)",
          color: "var(--text-muted)",
        }}
      >
        <Icon className="w-4 h-4" />
      </span>
      <div className="flex-1 min-w-0 flex flex-col" style={{ gap: 4 }}>
        <span style={{ font: "400 11.5px/1 var(--font-sans)", color: "var(--text-muted)" }}>
          {label}
        </span>
        <span
          style={{
            font: mono
              ? "500 12px/1.4 var(--font-mono)"
              : "500 13.5px/1.4 var(--font-sans)",
            color: "var(--text-primary)",
            wordBreak: "break-word",
          }}
        >
          {value || "—"}
        </span>
      </div>
    </div>
  );
}

/** Titled card whose last child row loses its divider. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <SectionLabel
        style={{ padding: "13px 20px", borderBottom: "1px solid var(--border-faint)" }}
      >
        {title}
      </SectionLabel>
      <div
        style={{ padding: "4px 20px 14px" }}
        className="[&>*:last-child]:border-b-0"
      >
        {children}
      </div>
    </Card>
  );
}

// ── Password Reset Modal ──────────────────────────────────────────────────────
function PasswordResetModal({
  patientId,
  patientName,
  onClose,
}: {
  patientId: string;
  patientName: string;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validation only fires once the field has been touched, so the form does
  // not scold the user before they have typed anything.
  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = password.length >= 8 && password === confirm && !saving;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      await api.post(`/api/patients/${patientId}/reset-password`, {
        newPassword: password,
      });
      setDone(true);
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? "Failed to reset password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ padding: 16, background: "var(--scrim)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="w-full"
        style={{
          maxWidth: 440,
          background: "var(--surface-card)",
          borderRadius: "var(--r-md)",
          border: "1px solid var(--hc-border)",
          boxShadow: "var(--elev-3)",
          overflow: "hidden",
        }}
      >
        <div
          className="flex items-center justify-between"
          style={{
            gap: 12,
            padding: "14px 20px",
            borderBottom: "1px solid var(--border-faint)",
          }}
        >
          <div className="flex items-center min-w-0" style={{ gap: 11 }}>
            <span
              className="inline-flex items-center justify-center flex-shrink-0"
              style={{
                width: 32,
                height: 32,
                borderRadius: "var(--r-xs)",
                background: "var(--amber-050)",
                color: "var(--urgent-ink)",
              }}
            >
              <KeyRound className="w-4 h-4" />
            </span>
            <div className="min-w-0 flex flex-col" style={{ gap: 3 }}>
              <p
                style={{
                  margin: 0,
                  font: "700 14px/1 var(--font-sans)",
                  color: "var(--text-primary)",
                }}
              >
                Reset password
              </p>
              <p
                className="truncate"
                style={{
                  margin: 0,
                  font: "400 12px/1 var(--font-sans)",
                  color: "var(--text-muted)",
                }}
              >
                {patientName}
              </p>
            </div>
          </div>
          <Button icon={X} variant="ghost" size="sm" onClick={onClose} style={{ width: 30 }} />
        </div>

        <div style={{ padding: 20 }}>
          {done ? (
            <div className="flex flex-col items-center text-center" style={{ gap: 12 }}>
              <span
                className="inline-flex items-center justify-center"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "var(--r-sm)",
                  background: "var(--brand-tint)",
                  color: "var(--green-700)",
                }}
              >
                <CheckCircle2 className="w-6 h-6" />
              </span>
              <p
                style={{
                  margin: 0,
                  font: "600 13.5px/1 var(--font-sans)",
                  color: "var(--text-primary)",
                }}
              >
                Password reset successfully
              </p>
              <p
                style={{
                  margin: 0,
                  font: "400 12.5px/1.5 var(--font-sans)",
                  color: "var(--text-secondary)",
                }}
              >
                Advise the patient to log in with the new password and change it
                immediately after.
              </p>
              <Button variant="primary" onClick={onClose} style={{ marginTop: 4 }}>
                Done
              </Button>
            </div>
          ) : (
            <div className="flex flex-col" style={{ gap: 14 }}>
              <p
                style={{
                  margin: 0,
                  font: "400 12.5px/1.5 var(--font-sans)",
                  color: "var(--text-secondary)",
                }}
              >
                Set a temporary password for this patient. Hand it to them securely and
                advise them to change it after logging in.
              </p>

              {error && (
                <Banner tone="critical" icon={AlertCircle}>
                  {error}
                </Banner>
              )}

              <Field
                label="New password"
                error={tooShort ? "Must be at least 8 characters" : undefined}
              >
                <div className="relative">
                  <Input
                    type={showPw ? "text" : "password"}
                    value={password}
                    invalid={tooShort}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    style={{ paddingRight: 38 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute inline-flex items-center justify-center"
                    style={{
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: 26,
                      height: 26,
                      border: "none",
                      borderRadius: "var(--r-xs)",
                      background: "transparent",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                    }}
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </Field>

              <Field
                label="Confirm password"
                error={mismatch ? "Passwords do not match" : undefined}
              >
                <Input
                  type={showPw ? "text" : "password"}
                  value={confirm}
                  invalid={mismatch}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter password"
                />
              </Field>

              <div className="flex" style={{ gap: 12, marginTop: 4 }}>
                <Button full onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  full
                  icon={KeyRound}
                  loading={saving}
                  disabled={!canSubmit}
                  onClick={handleSubmit}
                >
                  Reset password
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function PatientDetail({ patientId, onBack }: PatientDetailProps) {
  const [patient, setPatient] = useState<PatientRegistration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditForm>({
    firstName: "",
    lastName: "",
    middleName: "",
    dateOfBirth: "",
    gender: "",
    phoneNumber: "",
    email: "",
    address: "",
    emergencyContact: "",
    maritalStatus: "",
    occupation: "",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!patientId) return;
    // Guard against a late response for a patient the user has navigated away from.
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      setPatient(null);
      setEditing(false);

      try {
        const res = await patientApi.getRegistration(patientId);
        if (cancelled) return;

        const payload = res.data?.data ?? res.data;
        if (!payload || typeof payload !== "object" || !payload.id) {
          setError("Unexpected response from server.");
          return;
        }
        setPatient(payload as PatientRegistration);
      } catch (err: any) {
        if (!cancelled)
          setError(
            err.response?.data?.error?.message ??
              err.message ??
              "Failed to load patient details.",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [patientId]);

  // ── Enter edit mode ────────────────────────────────────────────────────────
  const enterEdit = () => {
    if (!patient) return;
    setForm({
      firstName: patient.firstName ?? "",
      lastName: patient.lastName ?? "",
      middleName: patient.middleName ?? "",
      dateOfBirth: patient.dateOfBirth ?? "",
      gender: patient.gender ?? "",
      phoneNumber: patient.phoneNumber ?? "",
      email: patient.email ?? "",
      address: patient.address ?? "",
      emergencyContact: patient.emergencyContact ?? "",
      maritalStatus: patient.maritalStatus ?? "",
      occupation: patient.occupation ?? "",
    });
    setSaveError(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setSaveError(null);
  };

  const handleField =
    (key: keyof EditForm) =>
    (
      e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
    ) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!patient) return;
    setSaving(true);
    setSaveError(null);

    // Only send fields that actually changed — a PATCH of unchanged values
    // would still write an audit entry for each of them.
    const payload: Record<string, any> = {};
    if (form.firstName !== (patient.firstName ?? "")) payload.firstName = form.firstName;
    if (form.lastName !== (patient.lastName ?? "")) payload.lastName = form.lastName;
    if (form.middleName !== (patient.middleName ?? ""))
      payload.middleName = form.middleName || null;
    if (form.dateOfBirth !== (patient.dateOfBirth ?? ""))
      payload.dateOfBirth = form.dateOfBirth;
    if (form.gender !== (patient.gender ?? "")) payload.gender = form.gender;
    if (form.phoneNumber !== (patient.phoneNumber ?? ""))
      payload.phoneNumber = form.phoneNumber;
    if (form.email !== (patient.email ?? "")) payload.email = form.email || null;
    if (form.address !== (patient.address ?? "")) payload.address = form.address;
    if (form.emergencyContact !== (patient.emergencyContact ?? ""))
      payload.emergencyContact = form.emergencyContact;
    if (form.maritalStatus !== (patient.maritalStatus ?? ""))
      payload.maritalStatus = form.maritalStatus || null;
    if (form.occupation !== (patient.occupation ?? ""))
      payload.occupation = form.occupation || null;

    if (Object.keys(payload).length === 0) {
      setEditing(false);
      setSaving(false);
      return;
    }

    try {
      const res = await api.patch(`/api/patients/${patient.id}/update`, payload);
      const updated = res.data?.data ?? res.data;
      // Merge back, keeping registration metadata the PATCH does not return.
      setPatient((prev) =>
        prev ? { ...prev, ...updated, registration: prev.registration } : prev,
      );
      setEditing(false);
    } catch (err: any) {
      setSaveError(
        err.response?.data?.error?.message ?? err.message ?? "Failed to save changes.",
      );
    } finally {
      setSaving(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        className="flex flex-col items-center justify-center"
        style={{ minHeight: 256, gap: 12 }}
      >
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--brand)" }} />
        <p style={{ margin: 0, font: "400 13px/1 var(--font-sans)", color: "var(--text-muted)" }}>
          Loading patient details…
        </p>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error || !patient) {
    return (
      <Page maxWidth={560}>
        <Banner tone="critical" icon={AlertCircle} title="Could not load patient">
          {error ?? "Patient not found"}
        </Banner>
        <Button icon={ArrowLeft} onClick={onBack} style={{ alignSelf: "flex-start" }}>
          All patients
        </Button>
      </Page>
    );
  }

  const dobAge = patient.dateOfBirth ? age(patient.dateOfBirth) : null;
  const fullName = [patient.firstName, patient.middleName, patient.lastName]
    .filter(Boolean)
    .join(" ");

  /* Identity and registration are read-only in both modes, so the two blocks
     are built once and rendered by either branch. */
  const identitySection = (
    <Section title="Identity">
      <InfoRow icon={Hash} label="National ID" value={patient.nationalId} mono />
      {editing && <InfoRow icon={Hash} label="Patient ID" value={patient.id} mono />}
    </Section>
  );

  const registrationSection = (
    <Section title="Registration">
      <InfoRow
        icon={Calendar}
        label="Registered on"
        value={patient.createdAt ? formatDate(patient.createdAt) : "—"}
      />
      {patient.registration ? (
        <>
          <InfoRow
            icon={Building2}
            label="Hospital patient number"
            value={patient.registration.hospitalPatientNumber}
            mono
          />
          <InfoRow
            icon={ShieldCheck}
            label="Home institution"
            value={patient.registration.isHomeInstitution ? "Yes" : "No"}
          />
        </>
      ) : (
        <InfoRow
          icon={Building2}
          label="Hospital patient number"
          value="Not registered at this institution"
        />
      )}
    </Section>
  );

  return (
    <>
      {showResetModal && (
        <PasswordResetModal
          patientId={patient.id}
          patientName={fullName}
          onClose={() => setShowResetModal(false)}
        />
      )}

      <Page>
        {/* Top bar */}
        <div className="flex items-center justify-between flex-wrap" style={{ gap: 12 }}>
          <Button variant="ghost" icon={ArrowLeft} onClick={onBack}>
            All patients
          </Button>

          <div className="flex items-center" style={{ gap: 10 }}>
            {!editing && (
              <>
                <Button
                  icon={KeyRound}
                  onClick={() => setShowResetModal(true)}
                  style={{
                    background: "var(--amber-050)",
                    borderColor: "var(--amber-100)",
                    color: "var(--urgent-ink)",
                  }}
                >
                  Reset password
                </Button>
                <Button icon={Edit3} onClick={enterEdit}>
                  Edit
                </Button>
              </>
            )}
            {editing && (
              <>
                <Button icon={X} onClick={cancelEdit} disabled={saving}>
                  Cancel
                </Button>
                <Button variant="primary" icon={Save} loading={saving} onClick={handleSave}>
                  Save changes
                </Button>
              </>
            )}
          </div>
        </div>

        {saveError && (
          <Banner tone="critical" icon={AlertCircle}>
            {saveError}
          </Banner>
        )}

        {/* Hero card */}
        <Card pad={22}>
          <div className="flex items-start" style={{ gap: 18 }}>
            <Avatar name={fullName} size={60} seed={0} />

            <div className="flex-1 min-w-0 flex flex-col" style={{ gap: 8 }}>
              <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
                <h1
                  style={{
                    margin: 0,
                    font: "700 21px/1.2 var(--font-sans)",
                    letterSpacing: "var(--ls-tight)",
                    color: "var(--text-primary)",
                  }}
                >
                  {fullName}
                </h1>
                <Pill tone={patient.isActive ? "success" : "critical"} dot>
                  {patient.isActive ? "Active" : "Inactive"}
                </Pill>
                {patient.isMinor && (
                  <MinorBadge
                    age={patient.dateOfBirth ? ageFromDob(patient.dateOfBirth) : undefined}
                  />
                )}
                {editing && <Pill tone="info">Editing</Pill>}
              </div>

              <p
                style={{
                  margin: 0,
                  font: "400 13.5px/1.4 var(--font-sans)",
                  color: "var(--text-secondary)",
                }}
              >
                <span style={{ textTransform: "capitalize" }}>{patient.gender}</span>
                {dobAge !== null ? ` · ${dobAge} years old` : ""}
                {patient.bloodType ? " · blood type " : ""}
                {patient.bloodType && (
                  <span style={{ font: "700 13.5px/1.4 var(--font-mono)", color: "var(--text-primary)" }}>
                    {patient.bloodType}
                  </span>
                )}
              </p>

              <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
                {patient.registration?.hospitalPatientNumber && (
                  <MonoTag>
                    <Building2 className="w-3 h-3" style={{ marginRight: 5 }} />
                    {patient.registration.hospitalPatientNumber}
                  </MonoTag>
                )}
                {patient.registration?.isHomeInstitution && (
                  <Pill tone="success">Home institution</Pill>
                )}
                {/*
                 * A minor has no NRC — the temporary clinic ID is their only
                 * login credential, so it belongs next to their identity.
                 */}
                {patient.isMinor && patient.temporaryPatientId && (
                  <span
                    className="inline-flex items-center"
                    style={{
                      gap: 7,
                      height: 22,
                      padding: "0 10px",
                      borderRadius: "var(--r-pill)",
                      background: "var(--amber-050)",
                      border: "1px solid var(--amber-100)",
                    }}
                  >
                    <span
                      style={{
                        font: "700 9.5px/1 var(--font-sans)",
                        letterSpacing: "var(--ls-caps)",
                        textTransform: "uppercase",
                        color: "var(--urgent-ink)",
                      }}
                    >
                      Minor ID
                    </span>
                    <span
                      style={{ font: "700 11px/1 var(--font-mono)", color: "var(--urgent-ink)" }}
                    >
                      {patient.temporaryPatientId}
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Guardians (minors only) */}
        {patient.isMinor && !editing && (
          <PatientGuardiansSection patientId={patient.id} canManage />
        )}

        {/* ── Sections ─────────────────────────────────────────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 16,
            alignItems: "start",
          }}
        >
          {!editing ? (
            <>
              <Section title="Personal information">
                <InfoRow
                  icon={Calendar}
                  label="Date of birth"
                  value={
                    patient.dateOfBirth
                      ? `${formatDate(patient.dateOfBirth)}${dobAge !== null ? ` (age ${dobAge})` : ""}`
                      : undefined
                  }
                />
                <InfoRow icon={Users} label="Gender" value={capitalize(patient.gender)} />
                <InfoRow
                  icon={Heart}
                  label="Marital status"
                  value={capitalize(patient.maritalStatus)}
                />
                <InfoRow
                  icon={Briefcase}
                  label="Occupation"
                  value={patient.occupation || "—"}
                />
              </Section>

              <Section title="Contact details">
                <InfoRow icon={Phone} label="Phone number" value={patient.phoneNumber} />
                <InfoRow icon={Mail} label="Email address" value={patient.email || "—"} />
                <InfoRow icon={MapPin} label="Home address" value={patient.address} />
                <InfoRow
                  icon={AlertCircle}
                  label="Emergency contact"
                  value={patient.emergencyContact}
                />
              </Section>
            </>
          ) : (
            <>
              <Section title="Personal information">
                <div
                  style={{
                    padding: "10px 0",
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                  }}
                >
                  <Field label="First name">
                    <Input value={form.firstName} onChange={handleField("firstName")} />
                  </Field>
                  <Field label="Middle name" hint="Optional">
                    <Input value={form.middleName} onChange={handleField("middleName")} />
                  </Field>
                  <Field label="Last name">
                    <Input value={form.lastName} onChange={handleField("lastName")} />
                  </Field>
                  <Field label="Date of birth">
                    <Input
                      type="date"
                      value={form.dateOfBirth}
                      onChange={handleField("dateOfBirth")}
                    />
                  </Field>
                  <Field label="Gender">
                    <Select value={form.gender} onChange={handleField("gender")}>
                      <option value="">Select…</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </Select>
                  </Field>
                  <Field label="Marital status">
                    <Select value={form.maritalStatus} onChange={handleField("maritalStatus")}>
                      <option value="">Select…</option>
                      <option value="single">Single</option>
                      <option value="married">Married</option>
                      <option value="divorced">Divorced</option>
                      <option value="widowed">Widowed</option>
                    </Select>
                  </Field>
                  <Field label="Occupation" hint="Optional">
                    <Input value={form.occupation} onChange={handleField("occupation")} />
                  </Field>
                </div>
              </Section>

              <Section title="Contact details">
                <div
                  style={{
                    padding: "10px 0",
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                  }}
                >
                  <Field label="Phone number">
                    <Input value={form.phoneNumber} onChange={handleField("phoneNumber")} />
                  </Field>
                  <Field label="Email address" hint="Optional">
                    <Input type="email" value={form.email} onChange={handleField("email")} />
                  </Field>
                  <Field label="Home address">
                    <Textarea
                      rows={3}
                      value={form.address}
                      onChange={handleField("address")}
                    />
                  </Field>
                  <Field label="Emergency contact">
                    <Input
                      value={form.emergencyContact}
                      onChange={handleField("emergencyContact")}
                    />
                  </Field>
                </div>
              </Section>
            </>
          )}

          {identitySection}
          {registrationSection}
        </div>

        <Banner tone="info" icon={ShieldCheck}>
          Clinical records are only accessible to authorised clinical staff. This view
          shows registration and demographic information only.
        </Banner>
      </Page>
    </>
  );
}
