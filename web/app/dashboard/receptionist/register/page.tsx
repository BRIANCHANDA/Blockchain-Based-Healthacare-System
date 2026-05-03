"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { patientApi } from "@/lib/api";
import {
  CheckCircle,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  User,
  Phone,
} from "lucide-react";

// ── Schema: no password fields ─────────────────────────────
const schema = z.object({
  firstName: z.string().min(2, "Required"),
  lastName: z.string().min(2, "Required"),
  middleName: z.string().optional(),
  dateOfBirth: z.string().min(1, "Required"),
  gender: z.enum(["male", "female", "other"]),
  bloodType: z
    .enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "unknown"])
    .optional(),
  phoneNumber: z.string().min(10, "Valid phone required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  address: z.string().min(5, "Full address required"),
  nationalId: z.string().min(1, "Required"),
  emergencyContact: z.string().min(5, "Required"),
  maritalStatus: z
    .enum(["single", "married", "divorced", "widowed"])
    .optional(),
  occupation: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const steps = [
  { title: "Personal Info", icon: User },
  { title: "Contact Details", icon: Phone },
];

export default function RegisterPatientPage() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{
    patientId: string;
    blockchainAddress: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    trigger,
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: "onBlur",
  });

  const stepFields: (keyof FormData)[][] = [
    [
      "firstName",
      "lastName",
      "middleName",
      "dateOfBirth",
      "gender",
      "bloodType",
    ],
    [
      "phoneNumber",
      "email",
      "address",
      "emergencyContact",
      "maritalStatus",
      "occupation",
      "nationalId",
    ],
  ];

  const next = async () => {
    const valid = await trigger(stepFields[step]);
    if (valid) setStep((s) => s + 1);
  };

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setError("");
    try {
      // Remove empty email
      const payload = { ...data };
      if (!payload.email) delete payload.email;
      // No password field is sent – backend will use default "test1234"
      const res = await patientApi.register(payload);
      setSuccess(res.data.data);
    } catch (err: any) {
      const msg = err.response?.data?.error?.message;
      setError(msg || "Registration failed. Please try again.");
      setStep(stepFields.length - 1); // jump to last step to show error
    } finally {
      setLoading(false);
    }
  };

  // ── Success screen ───────────────────────────────────────
  if (success) {
    return (
      <div
        className="max-w-lg mx-auto"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2
            className="text-xl font-bold text-gray-900 mb-1"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Patient Registered!
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            The patient account has been created successfully.
          </p>

          <div className="bg-gray-50 rounded-xl p-4 text-left space-y-3 mb-6">
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                Patient ID
              </p>
              <p className="font-mono text-sm text-gray-800 mt-0.5 break-all">
                {success.patientId}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                Blockchain Address
              </p>
              <p className="font-mono text-xs text-green-700 mt-0.5 break-all">
                {success.blockchainAddress}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setSuccess(null);
                setStep(0);
                reset();
              }}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Register Another
            </button>
            <button
              onClick={() =>
                (window.location.href = "/dashboard/receptionist/patients")
              }
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
              style={{ background: "#166534" }}
            >
              View All Patients
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Form ────────────────────────────────────────────────
  return (
    <div
      className="max-w-2xl mx-auto"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Page header */}
      <div className="mb-6">
        <h1
          className="text-2xl font-bold text-gray-900"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Register New Patient
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Create a new patient account – the default password is{" "}
          <strong className="font-mono">test1234</strong>. The patient will be
          asked to change it on first login.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Step indicator */}
        <div className="px-6 pt-6 pb-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            {steps.map(({ title, icon: Icon }, i) => (
              <div key={i} className="flex items-center gap-2 flex-1">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all"
                    style={
                      i < step
                        ? { background: "#166534", color: "#fff" }
                        : i === step
                          ? {
                              background: "#166534",
                              color: "#fff",
                              boxShadow: "0 0 0 4px #dcfce7",
                            }
                          : { background: "#f3f4f6", color: "#9ca3af" }
                    }
                  >
                    {i < step ? "✓" : <Icon className="w-3.5 h-3.5" />}
                  </div>
                  <span
                    className="text-xs font-medium hidden sm:block truncate"
                    style={{
                      color:
                        i === step
                          ? "#166534"
                          : i < step
                            ? "#374151"
                            : "#9ca3af",
                    }}
                  >
                    {title}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div
                    className="flex-1 h-px ml-2 transition-all"
                    style={{ background: i < step ? "#166534" : "#e5e7eb" }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">{steps[step].title}</h3>

            {/* ── Step 0: Personal Info ── */}
            {step === 0 && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="First Name *" error={errors.firstName?.message}>
                    <input
                      {...register("firstName")}
                      placeholder="John"
                      className={cls}
                    />
                  </Field>
                  <Field label="Last Name *" error={errors.lastName?.message}>
                    <input
                      {...register("lastName")}
                      placeholder="Banda"
                      className={cls}
                    />
                  </Field>
                </div>
                <Field label="Middle Name" error={errors.middleName?.message}>
                  <input
                    {...register("middleName")}
                    placeholder="Optional"
                    className={cls}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field
                    label="Date of Birth *"
                    error={errors.dateOfBirth?.message}
                  >
                    <input
                      {...register("dateOfBirth")}
                      type="date"
                      className={cls}
                    />
                  </Field>
                  <Field label="Gender *" error={errors.gender?.message}>
                    <select {...register("gender")} className={cls}>
                      <option value="">Select gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </Field>
                </div>
              </>
            )}

            {/* ── Step 1: Contact Details & National ID ── */}
            {step === 1 && (
              <>
                <Field
                  label="Phone Number *"
                  error={errors.phoneNumber?.message}
                >
                  <input
                    {...register("phoneNumber")}
                    placeholder="+260 977 123 456"
                    className={cls}
                  />
                </Field>
                <Field label="Email Address" error={errors.email?.message}>
                  <input
                    {...register("email")}
                    type="email"
                    placeholder="Optional"
                    className={cls}
                  />
                </Field>
                <Field label="Home Address *" error={errors.address?.message}>
                  <textarea
                    {...register("address")}
                    placeholder="Plot 45, Street, Town, Province"
                    className={`${cls} resize-none`}
                    rows={2}
                  />
                </Field>
                <Field
                  label="Emergency Contact *"
                  error={errors.emergencyContact?.message}
                >
                  <input
                    {...register("emergencyContact")}
                    placeholder="Name — +260 977 000 000"
                    className={cls}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field
                    label="Marital Status"
                    error={errors.maritalStatus?.message}
                  >
                    <select {...register("maritalStatus")} className={cls}>
                      <option value="">Select</option>
                      <option value="single">Single</option>
                      <option value="married">Married</option>
                      <option value="divorced">Divorced</option>
                      <option value="widowed">Widowed</option>
                    </select>
                  </Field>
                  <Field label="Occupation" error={errors.occupation?.message}>
                    <input
                      {...register("occupation")}
                      placeholder="e.g. Teacher"
                      className={cls}
                    />
                  </Field>
                </div>

                <Field label="National ID *" error={errors.nationalId?.message}>
                  <input
                    {...register("nationalId")}
                    placeholder="123456/78/1"
                    className={cls}
                  />
                </Field>

                {/* Info note about default password */}
                <div
                  className="p-3.5 rounded-xl text-sm"
                  style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}
                >
                  <p className="font-medium text-green-800 text-xs mb-1">
                    📋 Default password
                  </p>
                  <p className="text-green-700 text-xs leading-relaxed">
                    The patient will use <strong>test1234</strong> as their
                    initial password. They will be required to change it the
                    first time they log in.
                  </p>
                </div>

                {error && (
                  <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-100">
                    <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Navigation buttons */}
          <div className="px-6 pb-6 flex gap-3">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            )}
            {step < steps.length - 1 ? (
              <button
                type="button"
                onClick={next}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                style={{ background: "#166534" }}
              >
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
                style={{ background: "#166534" }}
              >
                {loading ? (
                  <svg
                    className="animate-spin w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"
                    />
                  </svg>
                ) : (
                  "Create Patient Account"
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────
const cls =
  "w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-sm outline-none transition-all focus:border-green-600 focus:ring-2 focus:ring-green-600/10 focus:bg-white placeholder:text-gray-400";

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
        {label}
      </label>
      {children}
      {error && (
        <p className="flex items-center gap-1 text-xs text-red-600 mt-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}
    </div>
  );
}
