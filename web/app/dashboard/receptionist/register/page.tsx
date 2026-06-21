"use client";
import { useState, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { patientApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { PhoneInput } from "@/components/ui/PhoneInput";
import {
  CheckCircle, AlertCircle, User, Baby, Shield,
  Search, X, Loader2, Phone,
} from "lucide-react";

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

type Relationship = typeof RELATIONSHIPS[number]["value"];

// ── Schema ────────────────────────────────────────────────────────────────────
const schema = z.object({
  isMinor: z.boolean().default(false),
  firstName: z.string().min(2, "Required"),
  lastName: z.string().min(2, "Required"),
  middleName: z.string().optional(),
  dateOfBirth: z.string().min(1, "Required"),
  gender: z.enum(["male", "female", "other"]),
  bloodType: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "unknown"]).optional(),
  phoneNumber: z.string().regex(/^\+\d{10,13}$/, "Enter a valid phone number (e.g. +260977123456)"),
  email: z.string().email({ message: "Invalid email" }).optional().or(z.literal("")),
  address: z.string().min(5, "Full address required"),
  nationalId: z.string().optional(),
  emergencyContact: z.string().min(5, "Required"),
  maritalStatus: z.enum(["single", "married", "divorced", "widowed"]).optional(),
  occupation: z.string().optional(),
  // Minor guardian fields
  guardianPatientId: z.string().uuid().optional(),
  guardianRelationship: z.enum(["mother", "father", "legal_guardian", "grandparent", "other"]).optional(),
  guardianDocumentReference: z.string().optional(),
}).superRefine((d, ctx) => {
  if (!d.isMinor && !d.nationalId?.trim())
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "National ID is required for adult patients", path: ["nationalId"] });
  if (d.isMinor && d.dateOfBirth) {
    const age = calcAge(d.dateOfBirth);
    if (age >= 16) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Patient is ${age} years old — minor registration requires age under 16`, path: ["dateOfBirth"] });
  }
  if (d.isMinor && !d.guardianPatientId)
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Select an existing adult patient as guardian", path: ["guardianPatientId"] });
  if (d.isMinor && !d.guardianRelationship)
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Relationship is required", path: ["guardianRelationship"] });
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

// ── Component ─────────────────────────────────────────────────────────────────
export default function RegisterPatientPage() {
  const user = useAuthStore((s) => s.user);
  const institutionId = user?.institutionId;

  const [submitted, setSubmitted] = useState<null | { patientId: string; isMinor: boolean; temporaryPatientId?: string | null; name: string }>(null);
  const [serverError, setServerError] = useState("");

  // Guardian search state
  const [guardianQuery, setGuardianQuery] = useState("");
  const [guardianResults, setGuardianResults] = useState<GuardianCandidate[]>([]);
  const [guardianSearching, setGuardianSearching] = useState(false);
  const [selectedGuardian, setSelectedGuardian] = useState<GuardianCandidate | null>(null);

  const { register, handleSubmit, watch, setValue, control, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { isMinor: false, bloodType: "unknown", gender: "male" },
  });

  const isMinor = watch("isMinor");

  // ── Guardian search ──────────────────────────────────────────────────────
  const searchGuardians = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setGuardianResults([]); return; }
    setGuardianSearching(true);
    try {
      const res = await patientApi.search(q, true);
      const all: any[] = (res.data as any)?.data?.patients ?? [];
      // Only show adult non-minor patients
      setGuardianResults(all.filter((p: any) => !p.isMinor).slice(0, 8).map((p: any) => ({
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        nationalId: p.nationalId ?? null,
        dateOfBirth: p.dateOfBirth,
        gender: p.gender,
      })));
    } catch { /* ignore */ } finally { setGuardianSearching(false); }
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
        firstName: data.firstName, lastName: data.lastName,
        middleName: data.middleName || undefined,
        dateOfBirth: data.dateOfBirth, gender: data.gender,
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
      setServerError(e?.response?.data?.error?.message ?? "Registration failed. Please try again.");
    }
  };

  // ── Success screen ────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="max-w-lg mx-auto mt-20 text-center space-y-4">
        <CheckCircle className="mx-auto text-emerald-500" size={56} />
        <h2 className="text-2xl font-bold text-gray-900">Patient Registered</h2>
        <p className="text-gray-600">
          <strong>{submitted.name}</strong> has been successfully registered.
        </p>
        {submitted.isMinor && submitted.temporaryPatientId ? (
          <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-5 text-left space-y-1">
            <p className="text-sm font-semibold text-amber-800">Minor Patient — Clinic ID</p>
            <p className="text-2xl font-mono font-bold text-amber-700">{submitted.temporaryPatientId}</p>
            <p className="text-xs text-amber-600">
              This temporary ID is used for login until the patient turns 16 and receives an NRC.
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Patient ID: {submitted.patientId}</p>
        )}
        <button
          onClick={() => { setSubmitted(null); setSelectedGuardian(null); setGuardianQuery(""); }}
          className="mt-4 px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700"
        >
          Register Another Patient
        </button>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  const inp = "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";
  const lbl = "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1";
  const err = (msg?: string) => msg ? <p className="mt-1 text-xs text-red-500">{msg}</p> : null;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Register Patient</h1>
        <p className="text-sm text-gray-500 mt-1">Add a new patient to the system</p>
      </div>

      {/* ── Adult / Minor toggle ── */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => { setValue("isMinor", false); clearGuardian(); }}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-semibold text-sm transition-all ${
            !isMinor ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-gray-200 text-gray-500 hover:border-gray-300"
          }`}
        >
          <User size={16} /> Adult Patient (has NRC)
        </button>
        <button
          type="button"
          onClick={() => setValue("isMinor", true)}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-semibold text-sm transition-all ${
            isMinor ? "border-amber-500 bg-amber-50 text-amber-700" : "border-gray-200 text-gray-500 hover:border-gray-300"
          }`}
        >
          <Baby size={16} /> Minor Patient (under 16)
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* ── Personal details ── */}
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
          <h3 className="font-semibold text-gray-700 flex items-center gap-2"><User size={16} /> Personal Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>First Name *</label>
              <input className={inp} {...register("firstName")} />
              {err(errors.firstName?.message)}
            </div>
            <div>
              <label className={lbl}>Last Name *</label>
              <input className={inp} {...register("lastName")} />
              {err(errors.lastName?.message)}
            </div>
          </div>
          <div>
            <label className={lbl}>Middle Name</label>
            <input className={inp} {...register("middleName")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Date of Birth *</label>
              <input type="date" className={inp} {...register("dateOfBirth")} max={new Date().toISOString().split("T")[0]} />
              {err(errors.dateOfBirth?.message)}
            </div>
            <div>
              <label className={lbl}>Gender *</label>
              <select className={inp} {...register("gender")}>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Blood Type</label>
              <select className={inp} {...register("bloodType")}>
                {["unknown","A+","A-","B+","B-","AB+","AB-","O+","O-"].map(bt => <option key={bt} value={bt}>{bt}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Marital Status</label>
              <select className={inp} {...register("maritalStatus")}>
                <option value="">— select —</option>
                <option value="single">Single</option>
                <option value="married">Married</option>
                <option value="divorced">Divorced</option>
                <option value="widowed">Widowed</option>
              </select>
            </div>
          </div>
          <div>
            <label className={lbl}>Occupation</label>
            <input className={inp} {...register("occupation")} />
          </div>
        </div>

        {/* ── NRC (adults only) ── */}
        {!isMinor && (
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2"><Shield size={16} /> National ID</h3>
            <div>
              <label className={lbl}>NRC Number *</label>
              <Controller
                control={control}
                name="nationalId"
                render={({ field }) => (
                  <input
                    className={inp}
                    placeholder="123456/78/1"
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(formatNRC(e.target.value))}
                  />
                )}
              />
              {err(errors.nationalId?.message)}
            </div>
          </div>
        )}

        {/* ── Guardian section (minors only) ── */}
        {isMinor && (
          <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-6 shadow-sm space-y-4">
            <h3 className="font-semibold text-amber-800 flex items-center gap-2"><Baby size={16} /> Guardian Details</h3>
            <p className="text-xs text-amber-700">The guardian must already be a registered adult patient in this system.</p>

            {/* Guardian search */}
            <div>
              <label className={lbl + " text-amber-700"}>Search Guardian by Name or NRC *</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400" size={16} />
                <input
                  className="w-full rounded-xl border-2 border-amber-300 bg-white pl-9 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="Type name or NRC…"
                  value={guardianQuery}
                  onChange={(e) => {
                    setGuardianQuery(e.target.value);
                    if (selectedGuardian) clearGuardian();
                    searchGuardians(e.target.value);
                  }}
                />
                {guardianSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-amber-400" size={16} />}
                {selectedGuardian && !guardianSearching && (
                  <button type="button" onClick={clearGuardian} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X size={16} className="text-amber-500" />
                  </button>
                )}
              </div>

              {/* Search results dropdown */}
              {guardianResults.length > 0 && (
                <div className="mt-1 rounded-xl border border-amber-200 bg-white shadow-lg overflow-hidden">
                  {guardianResults.map((g) => (
                    <button
                      key={g.id} type="button"
                      onClick={() => selectGuardian(g)}
                      className="w-full text-left px-4 py-3 hover:bg-amber-50 border-b border-amber-100 last:border-0"
                    >
                      <p className="font-semibold text-gray-900 text-sm">{g.firstName} {g.lastName}</p>
                      <p className="text-xs text-gray-500">{g.nationalId ?? "—"} · {g.gender} · Age {g.dateOfBirth ? calcAge(g.dateOfBirth) : "?"}</p>
                    </button>
                  ))}
                </div>
              )}

              {/* Selected guardian confirmation card */}
              {selectedGuardian && (
                <div className="mt-3 rounded-xl border-2 border-emerald-400 bg-emerald-50 p-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-emerald-800">{selectedGuardian.firstName} {selectedGuardian.lastName}</p>
                    <p className="text-xs text-emerald-600">{selectedGuardian.nationalId ?? "No NRC"} · {selectedGuardian.gender} · Age {calcAge(selectedGuardian.dateOfBirth)}</p>
                  </div>
                  <CheckCircle className="text-emerald-500" size={22} />
                </div>
              )}
              {err((errors as any).guardianPatientId?.message)}
            </div>

            {/* Relationship */}
            <div>
              <label className={lbl + " text-amber-700"}>Relationship to Patient *</label>
              <select className="w-full rounded-xl border-2 border-amber-300 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" {...register("guardianRelationship")}>
                <option value="">— select relationship —</option>
                {RELATIONSHIPS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              {err(errors.guardianRelationship?.message)}
            </div>

            {/* Document reference */}
            <div>
              <label className={lbl + " text-amber-700"}>Document Reference (optional)</label>
              <input className="w-full rounded-xl border-2 border-amber-300 bg-white px-4 py-3 text-sm focus:outline-none" placeholder="Birth certificate number, court order, etc." {...register("guardianDocumentReference")} />
            </div>
          </div>
        )}

        {/* ── Contact ── */}
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
          <h3 className="font-semibold text-gray-700 flex items-center gap-2"><Phone size={16} /> Contact & Address</h3>
          <div>
            <label className={lbl}>Phone Number *</label>
            <Controller
              control={control}
              name="phoneNumber"
              render={({ field }) => (
                <PhoneInput value={field.value ?? ""} onChange={field.onChange} />
              )}
            />
            {err(errors.phoneNumber?.message)}
          </div>
          <div>
            <label className={lbl}>Email</label>
            <input type="email" className={inp} {...register("email")} />
            {err(errors.email?.message)}
          </div>
          <div>
            <label className={lbl}>Address *</label>
            <input className={inp} {...register("address")} placeholder="Street, City, Province" />
            {err(errors.address?.message)}
          </div>
          <div>
            <label className={lbl}>Emergency Contact *</label>
            <input className={inp} {...register("emergencyContact")} placeholder="+260977123456" />
            {err(errors.emergencyContact?.message)}
          </div>
        </div>

        {serverError && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle size={16} /> {serverError}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-4 rounded-2xl bg-emerald-600 text-white font-bold text-base hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSubmitting ? <><Loader2 size={18} className="animate-spin" /> Registering…</> : "Register Patient"}
        </button>
      </form>
    </div>
  );
}
