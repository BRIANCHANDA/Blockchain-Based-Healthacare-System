"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { patientApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { PhoneInput } from "@/components/ui/PhoneInput";
import {
  CheckCircle,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  User,
  Phone,
} from "lucide-react";

function formatNRC(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 9);
  if (digits.length <= 6) return digits;
  if (digits.length <= 8) return `${digits.slice(0, 6)}/${digits.slice(6)}`;
  return `${digits.slice(0, 6)}/${digits.slice(6, 8)}/${digits.slice(8)}`;
}

// ── Schema ────────────────────────────────────────────────────────────────────
const schema = z.object({
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
  const { user } = useAuthStore();
  const institutionId = (user as any)?.institutionId as string | undefined;
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ patientId: string } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    trigger,
    reset,
    setValue,
    watch,
  } = useForm<FormData>({ resolver: zodResolver(schema), mode: "onBlur" });

  const phoneValue = watch("phoneNumber") ?? "+260";

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
      const payload = { ...data };
      if (!payload.email) delete payload.email;
      // Include institutionId so the patient is linked to this institution on registration.
      // The backend will auto-generate a hospitalPatientNumber if not provided.
      const res = await patientApi.register({
        ...payload,
        institutionId,
      } as any);
      // Only store what we need — no blockchain address surfaced to the user
      setSuccess({ patientId: res.data.data.patientId });
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ||
          "Registration failed. Please try again.",
      );
      setStep(stepFields.length - 1);
    } finally {
      setLoading(false);
    }
  };

  // ── Success screen ────────────────────────────────────────────────────────
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
            Patient Registered
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            The patient account has been created. They can now log in using
            their National ID and the default password.
          </p>

          <div
            className="rounded-xl p-4 text-left mb-6"
            style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}
          >
            <p className="text-xs font-bold uppercase tracking-widest text-green-700 mb-1">
              Default Password
            </p>
            <p className="font-mono text-lg font-bold text-green-900">
              test1234
            </p>
            <p className="text-xs text-green-700 mt-1">
              The patient will be asked to change this on their first login.
            </p>
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

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <div
      className="max-w-2xl mx-auto"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <div className="mb-6">
        <h1
          className="text-2xl font-bold text-gray-900"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Register New Patient
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Creates a new patient account. Default password is{" "}
          <strong className="font-mono">test1234</strong> — patient changes it
          on first login.
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
                    style={{ background: i < step ? "#166634" : "#e5e7eb" }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">{steps[step].title}</h3>

            {/* Step 0 — Personal Info */}
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

                <Field label="Blood Type" error={errors.bloodType?.message}>
                  <select {...register("bloodType")} className={cls}>
                    <option value="">Unknown / not tested</option>
                    {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(
                      (bt) => (
                        <option key={bt} value={bt}>
                          {bt}
                        </option>
                      ),
                    )}
                  </select>
                </Field>
              </>
            )}

            {/* Step 1 — Contact & ID */}
            {step === 1 && (
              <>
                <Field
                  label="Phone Number *"
                  error={errors.phoneNumber?.message}
                >
                  <PhoneInput
                    value={phoneValue}
                    onChange={(v) =>
                      setValue("phoneNumber", v, { shouldValidate: true })
                    }
                    error={!!errors.phoneNumber}
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
                  {(() => {
                    const { ref, onChange, ...rest } = register("nationalId");
                    return (
                      <input
                        ref={ref}
                        {...rest}
                        onChange={(e) => {
                          e.target.value = formatNRC(e.target.value);
                          onChange(e);
                        }}
                        placeholder="123456/78/1"
                        className={cls}
                      />
                    );
                  })()}
                </Field>

                {error && (
                  <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-100">
                    <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Navigation */}
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
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: "#166634" }}
              >
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: "#166634" }}
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

// ── Helpers ───────────────────────────────────────────────────────────────────
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
          <AlertCircle className="w-3 h-3" /> {error}
        </p>
      )}
    </div>
  );
}
