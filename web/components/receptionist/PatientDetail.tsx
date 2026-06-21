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

const genderColors: Record<string, string> = {
  male: "#3b82f6",
  female: "#ec4899",
  other: "#8b5cf6",
};

const inputCls =
  "w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-800 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-400/10 transition-colors";

const selectCls =
  "w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-800 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-400/10 transition-colors";

// ── Sub-components ────────────────────────────────────────────────────────────
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
    <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400 mb-0.5">{label}</p>
        <p
          className={`text-sm text-gray-800 break-all ${mono ? "font-mono text-xs" : "font-medium"}`}
        >
          {value || "—"}
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-2.5 border-b border-gray-50 last:border-0">
      <label className="text-xs text-gray-400 mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {title}
        </h2>
      </div>
      <div className="px-5">{children}</div>
    </div>
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
      setError(
        err.response?.data?.error?.message ?? "Failed to reset password.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <KeyRound className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Reset Password</p>
              <p className="text-xs text-gray-400">{patientName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5">
          {done ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <p className="text-sm font-semibold text-gray-800 text-center">
                Password reset successfully
              </p>
              <p className="text-xs text-gray-500 text-center">
                Advise the patient to log in with the new password and change it
                immediately after.
              </p>
              <button
                onClick={onClose}
                className="mt-2 px-5 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ background: "#166534" }}
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-500 mb-4">
                Set a temporary password for this patient. Hand it to them
                securely and advise them to change it after logging in.
              </p>

              {error && (
                <div className="mb-4 flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-100">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              )}

              {/* New password */}
              <div className="mb-3">
                <label className="text-xs text-gray-400 mb-1.5 block">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className={`${inputCls} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPw ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {tooShort && (
                  <p className="text-xs text-red-500 mt-1">
                    Must be at least 8 characters
                  </p>
                )}
              </div>

              {/* Confirm */}
              <div className="mb-5">
                <label className="text-xs text-gray-400 mb-1.5 block">
                  Confirm Password
                </label>
                <input
                  type={showPw ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter password"
                  className={inputCls}
                />
                {mismatch && (
                  <p className="text-xs text-red-500 mt-1">
                    Passwords do not match
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
                  style={{
                    background: "linear-gradient(135deg, #166534, #15803d)",
                  }}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <KeyRound className="w-4 h-4" />
                  )}
                  Reset Password
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function PatientDetail({
  patientId,
  onBack,
}: PatientDetailProps) {
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
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      setPatient(null);
      setEditing(false);

      try {
        const res = await patientApi.getRegistration(patientId);
        console.log("[PatientDetail] response:", res.data);
        if (cancelled) return;

        const payload = res.data?.data ?? res.data;
        if (!payload || typeof payload !== "object" || !payload.id) {
          setError("Unexpected response from server.");
          return;
        }
        setPatient(payload as PatientRegistration);
      } catch (err: any) {
        console.error(
          "[PatientDetail] error:",
          err.response?.status,
          err.response?.data,
        );
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
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!patient) return;
    setSaving(true);
    setSaveError(null);

    // Only send fields that actually changed
    const payload: Record<string, any> = {};
    if (form.firstName !== (patient.firstName ?? ""))
      payload.firstName = form.firstName;
    if (form.lastName !== (patient.lastName ?? ""))
      payload.lastName = form.lastName;
    if (form.middleName !== (patient.middleName ?? ""))
      payload.middleName = form.middleName || null;
    if (form.dateOfBirth !== (patient.dateOfBirth ?? ""))
      payload.dateOfBirth = form.dateOfBirth;
    if (form.gender !== (patient.gender ?? "")) payload.gender = form.gender;
    if (form.phoneNumber !== (patient.phoneNumber ?? ""))
      payload.phoneNumber = form.phoneNumber;
    if (form.email !== (patient.email ?? ""))
      payload.email = form.email || null;
    if (form.address !== (patient.address ?? ""))
      payload.address = form.address;
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
      const res = await api.patch(
        `/api/patients/${patient.id}/update`,
        payload,
      );
      const updated = res.data?.data ?? res.data;
      // Merge back, keep registration metadata untouched
      setPatient((prev) =>
        prev ? { ...prev, ...updated, registration: prev.registration } : prev,
      );
      setEditing(false);
    } catch (err: any) {
      setSaveError(
        err.response?.data?.error?.message ??
          err.message ??
          "Failed to save changes.",
      );
    } finally {
      setSaving(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-green-600" />
        <p className="text-sm text-gray-400">Loading patient details…</p>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error || !patient) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 gap-4">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className="text-sm text-red-600 font-medium">
          {error ?? "Patient not found"}
        </p>
        <button onClick={onBack} className="text-sm text-gray-500 underline">
          Go back
        </button>
      </div>
    );
  }

  const initials =
    `${patient.firstName?.[0] ?? ""}${patient.lastName?.[0] ?? ""}`.toUpperCase();
  const avatarColor = genderColors[patient.gender] ?? "#6b7280";
  const dobAge = patient.dateOfBirth ? age(patient.dateOfBirth) : null;
  const fullName = [patient.firstName, patient.middleName, patient.lastName]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      {showResetModal && (
        <PasswordResetModal
          patientId={patient.id}
          patientName={fullName}
          onClose={() => setShowResetModal(false)}
        />
      )}

      <div>
        {/* Top bar */}
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            All Patients
          </button>

          <div className="flex items-center gap-2">
            {!editing && (
              <button
                onClick={() => setShowResetModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
              >
                <KeyRound className="w-4 h-4" />
                Reset Password
              </button>
            )}
            {editing ? (
              <>
                <button
                  onClick={cancelEdit}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
                  style={{
                    background: "linear-gradient(135deg, #166534, #15803d)",
                  }}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save Changes
                </button>
              </>
            ) : (
              <button
                onClick={enterEdit}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Edit3 className="w-4 h-4" />
                Edit
              </button>
            )}
          </div>
        </div>

        {/* Save error */}
        {saveError && (
          <div className="mb-4 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-50 border border-red-100">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{saveError}</p>
          </div>
        )}

        {/* Hero card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-5">
          <div className="flex items-start gap-5">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold text-white flex-shrink-0"
              style={{ background: avatarColor }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900">{fullName}</h1>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${patient.isActive ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}
                >
                  {patient.isActive ? "Active" : "Inactive"}
                </span>
                {patient.isMinor && (
                  <MinorBadge
                    age={patient.dateOfBirth ? ageFromDob(patient.dateOfBirth) : undefined}
                  />
                )}
                {editing && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                    Editing
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-0.5">
                <span className="capitalize">{patient.gender}</span>
                {dobAge !== null ? ` · ${dobAge} years old` : ""}
                {patient.bloodType ? " · Blood type " : ""}
                {patient.bloodType && (
                  <span className="font-semibold text-gray-700">
                    {patient.bloodType}
                  </span>
                )}
              </p>
              {patient.registration?.hospitalPatientNumber && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-100">
                  <Building2 className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-xs font-mono text-gray-600">
                    {patient.registration.hospitalPatientNumber}
                  </span>
                  {patient.registration.isHomeInstitution && (
                    <span className="ml-1 text-xs font-semibold text-green-700 bg-green-50 px-1.5 py-0.5 rounded-md">
                      Home
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Minor ID display ────────────────────────────────────────────── */}
        {patient.isMinor && patient.temporaryPatientId && (
          <div className="mb-5 flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
            <span className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Minor Patient ID</span>
            <span className="font-mono font-bold text-amber-900 text-sm">{patient.temporaryPatientId}</span>
          </div>
        )}

        {/* ── Guardians section (minor only) ──────────────────────────────── */}
        {patient.isMinor && !editing && (
          <div className="mb-5">
            <PatientGuardiansSection patientId={patient.id} canManage />
          </div>
        )}

        {/* ── VIEW MODE ─────────────────────────────────────────────────────── */}
        {!editing && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Section title="Personal Information">
              <InfoRow
                icon={Calendar}
                label="Date of Birth"
                value={
                  patient.dateOfBirth
                    ? `${formatDate(patient.dateOfBirth)}${dobAge !== null ? ` (age ${dobAge})` : ""}`
                    : undefined
                }
              />
              <InfoRow
                icon={Users}
                label="Gender"
                value={capitalize(patient.gender)}
              />
              <InfoRow
                icon={Heart}
                label="Marital Status"
                value={capitalize(patient.maritalStatus)}
              />
              <InfoRow
                icon={Briefcase}
                label="Occupation"
                value={patient.occupation || "—"}
              />
            </Section>

            <Section title="Contact Details">
              <InfoRow
                icon={Phone}
                label="Phone Number"
                value={patient.phoneNumber}
              />
              <InfoRow
                icon={Mail}
                label="Email Address"
                value={patient.email || "—"}
              />
              <InfoRow
                icon={MapPin}
                label="Home Address"
                value={patient.address}
              />
              <InfoRow
                icon={AlertCircle}
                label="Emergency Contact"
                value={patient.emergencyContact}
              />
            </Section>

            <Section title="Identity">
              <InfoRow
                icon={Hash}
                label="National ID"
                value={patient.nationalId}
                mono
              />
            </Section>

            <Section title="Registration">
              <InfoRow
                icon={Calendar}
                label="Registered On"
                value={patient.createdAt ? formatDate(patient.createdAt) : "—"}
              />
              {patient.registration ? (
                <>
                  <InfoRow
                    icon={Building2}
                    label="Hospital Patient Number"
                    value={patient.registration.hospitalPatientNumber}
                    mono
                  />
                  <InfoRow
                    icon={ShieldCheck}
                    label="Home Institution"
                    value={
                      patient.registration.isHomeInstitution ? "Yes" : "No"
                    }
                  />
                </>
              ) : (
                <InfoRow
                  icon={Building2}
                  label="Hospital Patient Number"
                  value="Not registered at this institution"
                />
              )}
            </Section>
          </div>
        )}

        {/* ── EDIT MODE ─────────────────────────────────────────────────────── */}
        {editing && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Section title="Personal Information">
              <Field label="First Name">
                <input
                  className={inputCls}
                  value={form.firstName}
                  onChange={handleField("firstName")}
                />
              </Field>
              <Field label="Middle Name (optional)">
                <input
                  className={inputCls}
                  value={form.middleName}
                  onChange={handleField("middleName")}
                  placeholder="—"
                />
              </Field>
              <Field label="Last Name">
                <input
                  className={inputCls}
                  value={form.lastName}
                  onChange={handleField("lastName")}
                />
              </Field>
              <Field label="Date of Birth">
                <input
                  type="date"
                  className={inputCls}
                  value={form.dateOfBirth}
                  onChange={handleField("dateOfBirth")}
                />
              </Field>
              <Field label="Gender">
                <select
                  className={selectCls}
                  value={form.gender}
                  onChange={handleField("gender")}
                >
                  <option value="">Select…</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </Field>
              <Field label="Marital Status">
                <select
                  className={selectCls}
                  value={form.maritalStatus}
                  onChange={handleField("maritalStatus")}
                >
                  <option value="">Select…</option>
                  <option value="single">Single</option>
                  <option value="married">Married</option>
                  <option value="divorced">Divorced</option>
                  <option value="widowed">Widowed</option>
                </select>
              </Field>
              <Field label="Occupation (optional)">
                <input
                  className={inputCls}
                  value={form.occupation}
                  onChange={handleField("occupation")}
                  placeholder="—"
                />
              </Field>
            </Section>

            <Section title="Contact Details">
              <Field label="Phone Number">
                <input
                  className={inputCls}
                  value={form.phoneNumber}
                  onChange={handleField("phoneNumber")}
                />
              </Field>
              <Field label="Email Address (optional)">
                <input
                  type="email"
                  className={inputCls}
                  value={form.email}
                  onChange={handleField("email")}
                  placeholder="—"
                />
              </Field>
              <Field label="Home Address">
                <textarea
                  className={`${inputCls} resize-none`}
                  rows={3}
                  value={form.address}
                  onChange={handleField("address")}
                />
              </Field>
              <Field label="Emergency Contact">
                <input
                  className={inputCls}
                  value={form.emergencyContact}
                  onChange={handleField("emergencyContact")}
                />
              </Field>
            </Section>

            {/* Identity + Registration are read-only even in edit mode */}
            <Section title="Identity">
              <InfoRow
                icon={Hash}
                label="National ID"
                value={patient.nationalId}
                mono
              />
              <InfoRow icon={Hash} label="Patient ID" value={patient.id} mono />
            </Section>

            <Section title="Registration">
              <InfoRow
                icon={Calendar}
                label="Registered On"
                value={patient.createdAt ? formatDate(patient.createdAt) : "—"}
              />
              {patient.registration ? (
                <>
                  <InfoRow
                    icon={Building2}
                    label="Hospital Patient Number"
                    value={patient.registration.hospitalPatientNumber}
                    mono
                  />
                  <InfoRow
                    icon={ShieldCheck}
                    label="Home Institution"
                    value={
                      patient.registration.isHomeInstitution ? "Yes" : "No"
                    }
                  />
                </>
              ) : (
                <InfoRow
                  icon={Building2}
                  label="Hospital Patient Number"
                  value="Not registered at this institution"
                />
              )}
            </Section>
          </div>
        )}

        {/* Notice */}
        <div className="mt-5 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-blue-50 border border-blue-100">
          <ShieldCheck className="w-4 h-4 text-blue-500 flex-shrink-0" />
          <p className="text-xs text-blue-700">
            Clinical records are only accessible to authorised clinical staff.
            This view shows registration and demographic information only.
          </p>
        </div>
      </div>
    </>
  );
}
