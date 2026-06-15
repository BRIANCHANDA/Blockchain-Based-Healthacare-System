"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, institutionApi } from "@/lib/api";
import { PhoneInput } from "@/components/ui/PhoneInput";
import {
  ArrowLeft,
  UserPlus,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";

const ROLES = [
  { value: "practitioner", label: "Doctor / Practitioner" },
  { value: "nurse", label: "Nurse" },
  { value: "lab_technician", label: "Lab Technician" },
  { value: "radiologist", label: "Radiologist" },
  { value: "pharmacist", label: "Pharmacist" },
  { value: "receptionist", label: "Receptionist" },
  { value: "admin", label: "Admin" },
];

const DEPARTMENTS = [
  "Emergency Department",
  "Internal Medicine",
  "Surgery",
  "Pediatrics",
  "Obstetrics & Gynecology",
  "Cardiology",
  "Neurology",
  "Orthopedics",
  "Oncology",
  "Radiology",
  "Pathology & Laboratory",
  "Pharmacy",
  "Physiotherapy",
  "Anesthesiology",
  "Psychiatry",
  "Intensive Care Unit (ICU)",
  "Neonatal ICU",
  "Outpatient Department",
  "Administration",
  "Other",
];

const SPECIALIZATIONS: Record<string, string[]> = {
  practitioner: [
    "General Practice",
    "Internal Medicine",
    "Surgery",
    "Pediatrics",
    "Obstetrics & Gynecology",
    "Cardiology",
    "Neurology",
    "Orthopedics",
    "Dermatology",
    "Psychiatry",
    "Radiology",
    "Anesthesiology",
    "Emergency Medicine",
    "Other",
  ],
  lab_technician: [
    "Clinical Chemistry",
    "Hematology",
    "Microbiology",
    "Immunology",
    "Pathology",
    "Blood Bank",
    "Other",
  ],
  radiologist: [
    "Diagnostic Radiology",
    "Interventional Radiology",
    "Nuclear Medicine",
    "Neuroradiology",
    "Pediatric Radiology",
    "Other",
  ],
  pharmacist: [
    "Clinical Pharmacy",
    "Hospital Pharmacy",
    "Community Pharmacy",
    "Other",
  ],
};

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/10 focus:bg-white transition-all";

export default function NewStaffPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [emailError, setEmailError] = useState("");

  // Institutions
  const [institutions, setInstitutions] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [loadingInstitutions, setLoadingInstitutions] = useState(true);

  // Form state
  const [form, setForm] = useState({
    role: "practitioner",
    firstName: "",
    lastName: "",
    licenseNumber: "",
    institutionalId: "",
    institutionId: "",
    department: "",
    specialization: "",
    shift: "",
    phoneNumber: "+260",
    email: "",
    password: "test1234",
    confirmPassword: "test1234",
    qualifications: "",
  });

  const setFormField = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // Fetch institutions
  useEffect(() => {
    const fetchInstitutions = async () => {
      try {
        const res = await institutionApi.list();
        const list = res.data.data?.institutions || [];
        setInstitutions(
          list.map((inst: any) => ({
            id: inst.id,
            name: inst.institutionName,
          })),
        );
      } catch (err) {
        console.error(err);
        setError("Could not load hospital list. Please refresh.");
      } finally {
        setLoadingInstitutions(false);
      }
    };
    fetchInstitutions();
  }, []);

  const handleInstitutionSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormField("institutionId", e.target.value);
  };

  const handleDepartmentSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormField("department", e.target.value);
  };

  const handleSubmit = async () => {
    setError("");

    // Required fields validation
    if (
      !form.firstName ||
      !form.lastName ||
      !form.licenseNumber ||
      !form.email ||
      !form.institutionId
    ) {
      setError("Please fill in all required fields, including Hospital.");
      return;
    }

    if (!/^\+\d{10,13}$/.test(form.phoneNumber)) {
      setError("Enter a valid phone number (e.g. +260977123456).");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setEmailError("Enter a valid email address.");
      setError("Enter a valid email address.");
      return;
    }

    // Password is optional – if provided, must match and be >=8 characters
    if (form.password) {
      if (form.password !== form.confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      if (form.password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
    }

    // Ensure institutionalId is not empty – fallback to licenseNumber
    const finalInstitutionalId =
      form.institutionalId?.trim() || form.licenseNumber;

    setSubmitting(true);
    try {
      const payload = {
        role: form.role,
        firstName: form.firstName,
        lastName: form.lastName,
        licenseNumber: form.licenseNumber,
        institutionalId: finalInstitutionalId,
        institutionId: form.institutionId,
        department: form.department || undefined,
        specialization: form.specialization || undefined,
        shift: form.shift || undefined,
        phoneNumber: form.phoneNumber,
        email: form.email,
        password: form.password || undefined, // send only if provided
        qualifications: form.qualifications || undefined,
      };

      await api.post("/api/auth/register/staff", payload);
      setSuccess(true);
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message || "Failed to create staff member.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div
        className="max-w-lg mx-auto"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-10 text-center">
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h2
            className="text-xl font-bold text-gray-900 mb-2"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Staff Member Created
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            {form.firstName} {form.lastName} has been added to the system.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.push("/dashboard/admin/staff")}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-md"
              style={{
                background: "linear-gradient(135deg, #166534, #15803d)",
              }}
            >
              Back to Staff
            </button>
            <button
              onClick={() => {
                setSuccess(false);
                setEmailError("");
                setForm({
                  role: "practitioner",
                  firstName: "",
                  lastName: "",
                  licenseNumber: "",
                  institutionalId: "",
                  institutionId: "",
                  department: "",
                  specialization: "",
                  shift: "",
                  phoneNumber: "+260",
                  email: "",
                  password: "test1234",
                  confirmPassword: "test1234",
                  qualifications: "",
                });
              }}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              Add Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  const showSpecialization = [
    "practitioner",
    "lab_technician",
    "radiologist",
    "pharmacist",
  ].includes(form.role);
  const showShift = form.role === "nurse";
  const showQualifications = form.role === "practitioner";

  return (
    <div
      className="max-w-2xl mx-auto"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1
            className="text-2xl font-bold text-gray-900"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Add Staff Member
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Register a new clinical staff account
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100 mb-4">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Role selector */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">
          Role
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {ROLES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFormField("role", value)}
              className="px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all text-center"
              style={
                form.role === value
                  ? {
                      background: "#f0fdf4",
                      borderColor: "#166534",
                      color: "#166534",
                    }
                  : { borderColor: "#e5e7eb", color: "#6b7280" }
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Personal info */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">
          Personal Information
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="First Name" required>
            <input
              value={form.firstName}
              onChange={(e) => setFormField("firstName", e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Last Name" required>
            <input
              value={form.lastName}
              onChange={(e) => setFormField("lastName", e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Phone Number" required>
            <PhoneInput
              value={form.phoneNumber}
              onChange={(v) => setFormField("phoneNumber", v)}
            />
          </Field>
          <Field label="Email Address" required>
            <input
              type="email"
              value={form.email}
              onChange={(e) => {
                setFormField("email", e.target.value);
                if (emailError) setEmailError("");
              }}
              onBlur={() => {
                if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
                  setEmailError("Enter a valid email address.");
                else
                  setEmailError("");
              }}
              className={`${inputClass} ${emailError ? "border-red-300 focus:border-red-500 focus:ring-red-500/10" : ""}`}
            />
            {emailError && (
              <p className="mt-1 text-xs text-red-500">{emailError}</p>
            )}
          </Field>
        </div>
      </div>

      {/* Professional details */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">
          Professional Details
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="License Number" required>
            <input
              value={form.licenseNumber}
              onChange={(e) => setFormField("licenseNumber", e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Hospital / Institution" required>
            {loadingInstitutions ? (
              <div className="flex items-center gap-2 text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading
                hospitals...
              </div>
            ) : (
              <select
                value={form.institutionId}
                onChange={handleInstitutionSelect}
                className={inputClass}
              >
                <option value="">Select Hospital *</option>
                {institutions.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field label="Department">
            <select
              value={form.department}
              onChange={handleDepartmentSelect}
              className={inputClass}
            >
              <option value="">Select Department (optional)</option>
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </Field>

          {showShift && (
            <Field label="Shift">
              <select
                value={form.shift}
                onChange={(e) => setFormField("shift", e.target.value)}
                className={inputClass}
              >
                <option value="">Select shift</option>
                <option value="morning">Morning</option>
                <option value="afternoon">Afternoon</option>
                <option value="night">Night</option>
                <option value="rotating">Rotating</option>
              </select>
            </Field>
          )}

          {showSpecialization && (
            <Field label="Specialization">
              {SPECIALIZATIONS[form.role] ? (
                <select
                  value={form.specialization}
                  onChange={(e) =>
                    setFormField("specialization", e.target.value)
                  }
                  className={inputClass}
                >
                  <option value="">Select specialization</option>
                  {SPECIALIZATIONS[form.role].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={form.specialization}
                  onChange={(e) =>
                    setFormField("specialization", e.target.value)
                  }
                  placeholder="Specialization"
                  className={inputClass}
                />
              )}
            </Field>
          )}

          {showQualifications && (
            <Field label="Qualifications">
              <input
                value={form.qualifications}
                onChange={(e) => setFormField("qualifications", e.target.value)}
                placeholder="e.g. MBChB, MMED"
                className={inputClass}
              />
            </Field>
          )}
        </div>
      </div>

      {/* Password – optional with note */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">
          Account Password
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Password (optional)">
            <input
              type="password"
              value={form.password}
              onChange={(e) => setFormField("password", e.target.value)}
              placeholder="Password"
              className={inputClass}
            />
          </Field>
          <Field label="Confirm Password">
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(e) => setFormField("confirmPassword", e.target.value)}
              placeholder="Repeat password"
              className={inputClass}
            />
          </Field>
        </div>
        {form.password &&
          form.confirmPassword &&
          form.password !== form.confirmPassword && (
            <p className="text-xs text-red-500 mt-2">Passwords do not match</p>
          )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <button
          onClick={() => router.back()}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || loadingInstitutions}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all hover:shadow-md"
          style={{ background: "linear-gradient(135deg, #166534, #15803d)" }}
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <UserPlus className="w-4 h-4" />
          )}
          {submitting ? "Creating…" : "Create Staff Member"}
        </button>
      </div>
    </div>
  );
}
