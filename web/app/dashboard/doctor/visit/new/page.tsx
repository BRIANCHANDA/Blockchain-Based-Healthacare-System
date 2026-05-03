"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { visitApi, patientApi, institutionApi } from "@/lib/api";
import {
  ChevronLeft,
  Search,
  AlertCircle,
  CheckCircle2,
  User,
  Activity,
  Loader2,
} from "lucide-react";

const bloodTypeColor: Record<string, string> = {
  "A+": "#3b82f6",
  "A-": "#6366f1",
  "B+": "#8b5cf6",
  "B-": "#ec4899",
  "AB+": "#f59e0b",
  "AB-": "#ef4444",
  "O+": "#10b981",
  "O-": "#14b8a6",
  unknown: "#9ca3af",
};

function FieldGroup({
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
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}
function Input({
  value,
  onChange,
  placeholder,
  type = "text",
  disabled = false,
}: {
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 outline-none
        focus:border-green-600 focus:ring-2 focus:ring-green-600/10 focus:bg-white placeholder:text-gray-400
        transition-all disabled:opacity-60 disabled:cursor-not-allowed"
    />
  );
}
function Select({
  value,
  onChange,
  options,
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 outline-none
        focus:border-green-600 focus:ring-2 focus:ring-green-600/10 focus:bg-white transition-all
        disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export default function NewVisitPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillId = searchParams.get("patientId") ?? "";

  // Patient search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [patient, setPatient] = useState<any>(null);

  // Departments
  const [departments, setDepartments] = useState<any[]>([]);
  const [wards, setWards] = useState<any[]>([]);

  // Form
  const [form, setForm] = useState({
    visitType: "outpatient" as
      | "outpatient"
      | "inpatient"
      | "emergency"
      | "consultation",
    chiefComplaint: "",
    priority: "routine" as "routine" | "urgent" | "emergency" | "critical",
    departmentId: "",
    wardId: "",
    wardOrRoom: "",
    bedNumber: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const f = (field: keyof typeof form) => (v: string) =>
    setForm((prev) => ({ ...prev, [field]: v }));

  // Pre-fill patient if patientId in query
  useEffect(() => {
    if (!prefillId) return;
    patientApi
      .getById(prefillId)
      .then((res) => setPatient(res.data.data?.patient ?? null))
      .catch(() => {});
  }, [prefillId]);

  // Load departments when patient is set
  useEffect(() => {
    if (!patient) return;
    (institutionApi as any)
      .getDepartments()
      .then((res: any) => setDepartments(res.data.data?.departments ?? []))
      .catch(() => {});
  }, [patient]);

  // Load wards when department changes
  useEffect(() => {
    if (!form.departmentId) {
      setWards([]);
      return;
    }
    (institutionApi as any)
      .getWards(form.departmentId)
      .then((res: any) => setWards(res.data.data?.wards ?? []))
      .catch(() => {});
  }, [form.departmentId]);

  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setSearchLoading(true);
    setSearchError("");
    setSearchResults([]);
    try {
      const res = await patientApi.search(q);
      const list = res.data.data?.patients ?? [];
      if (!list.length) setSearchError(`No patients found for "${q}".`);
      else if (list.length === 1) setPatient(list[0]);
      else setSearchResults(list);
    } catch (err: any) {
      setSearchError(err.response?.data?.error?.message ?? "Search failed.");
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!patient) {
      setSubmitError("Select a patient first.");
      return;
    }
    if (!form.chiefComplaint.trim()) {
      setSubmitError("Chief complaint is required.");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await (visitApi as any).createVisit({
        patientId: patient.id,
        visitType: form.visitType,
        chiefComplaint: form.chiefComplaint,
        priority: form.priority,
        departmentId: form.departmentId || undefined,
        wardId: form.wardId || undefined,
        wardOrRoom: form.wardOrRoom || undefined,
        bedNumber: form.bedNumber || undefined,
      });
      const visitId = res.data.data?.visitId;
      router.push(`/dashboard/doctor/visit/${visitId}`);
    } catch (err: any) {
      setSubmitError(
        err.response?.data?.error?.message ?? "Failed to create visit.",
      );
      setSubmitting(false);
    }
  };

  return (
    <div
      className="max-w-2xl mx-auto"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5 transition-colors"
      >
        <ChevronLeft size={16} /> Back
      </button>

      <div className="mb-6">
        <h1
          className="text-2xl font-bold text-gray-900"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Create New Visit
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Register a new patient encounter and open the visit workspace
        </p>
      </div>

      {/* ── Step 1: Patient ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
          Step 1 — Patient
        </p>

        {patient ? (
          // Patient confirmed
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-green-50 border border-green-200">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
              style={{ background: "#166534" }}
            >
              {patient.firstName?.[0]}
              {patient.lastName?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900">
                {patient.firstName} {patient.lastName}
              </p>
              <p className="text-xs text-gray-500 capitalize">
                {patient.gender} · {patient.dateOfBirth}
              </p>
            </div>
            {patient.bloodType && patient.bloodType !== "unknown" && (
              <span
                className="text-xs font-bold px-2 py-1 rounded-full text-white flex-shrink-0"
                style={{
                  background: bloodTypeColor[patient.bloodType] ?? "#6b7280",
                }}
              >
                {patient.bloodType}
              </span>
            )}
            <button
              onClick={() => {
                setPatient(null);
                setSearchResults([]);
              }}
              className="text-xs text-gray-400 hover:text-gray-600 underline flex-shrink-0"
            >
              Change
            </button>
          </div>
        ) : (
          // Patient search
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Search by name or National ID…"
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900
                    outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/10 focus:bg-white placeholder:text-gray-400 transition-all"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={searchLoading || !searchQuery.trim()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
                style={{
                  background: "linear-gradient(135deg,#166534,#15803d)",
                }}
              >
                {searchLoading ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Search size={15} />
                )}
                Search
              </button>
            </div>

            {searchError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
                <AlertCircle size={14} className="flex-shrink-0" />{" "}
                {searchError}
              </div>
            )}

            {searchResults.length > 0 && (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPatient(p)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-100 last:border-0"
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ background: "#166534" }}
                    >
                      {p.firstName?.[0]}
                      {p.lastName?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">
                        {p.firstName} {p.lastName}
                      </p>
                      <p className="text-xs text-gray-400 capitalize">
                        {p.gender} · {p.dateOfBirth}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Step 2: Visit details ── */}
      <div
        className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4 transition-opacity ${!patient ? "opacity-40 pointer-events-none" : ""}`}
      >
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">
          Step 2 — Visit Details
        </p>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FieldGroup label="Visit Type" required>
              <Select
                value={form.visitType}
                onChange={f("visitType")}
                options={[
                  { value: "outpatient", label: "Outpatient (OPD)" },
                  { value: "inpatient", label: "Inpatient (IPD)" },
                  { value: "emergency", label: "Emergency" },
                  { value: "consultation", label: "Consultation" },
                ]}
              />
            </FieldGroup>

            <FieldGroup label="Priority" required>
              <Select
                value={form.priority}
                onChange={f("priority")}
                options={[
                  { value: "routine", label: "Routine" },
                  { value: "urgent", label: "Urgent" },
                  { value: "emergency", label: "Emergency" },
                  { value: "critical", label: "Critical" },
                ]}
              />
            </FieldGroup>
          </div>

          <FieldGroup label="Chief Complaint" required>
            <Input
              value={form.chiefComplaint}
              onChange={f("chiefComplaint")}
              placeholder="Primary reason for this visit (minimum 5 characters)"
            />
          </FieldGroup>

          <div className="grid grid-cols-2 gap-4">
            <FieldGroup label="Department">
              <Select
                value={form.departmentId}
                onChange={f("departmentId")}
                options={[
                  { value: "", label: "— Select department —" },
                  ...departments.map((d) => ({
                    value: d.id,
                    label: d.departmentName,
                  })),
                ]}
                disabled={!patient}
              />
            </FieldGroup>

            <FieldGroup label="Ward">
              <Select
                value={form.wardId}
                onChange={f("wardId")}
                options={[
                  {
                    value: "",
                    label: wards.length
                      ? "— Select ward —"
                      : "Select dept first",
                  },
                  ...wards.map((w) => ({ value: w.id, label: w.wardName })),
                ]}
                disabled={!form.departmentId}
              />
            </FieldGroup>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FieldGroup label="Ward / Room">
              <Input
                value={form.wardOrRoom}
                onChange={f("wardOrRoom")}
                placeholder="e.g. Male General Ward"
              />
            </FieldGroup>
            <FieldGroup label="Bed Number">
              <Input
                value={form.bedNumber}
                onChange={f("bedNumber")}
                placeholder="e.g. Bed 5"
              />
            </FieldGroup>
          </div>
        </div>
      </div>

      {/* Error */}
      {submitError && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700 mb-4">
          <AlertCircle size={15} className="flex-shrink-0" /> {submitError}
        </div>
      )}

      {/* Submit */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || !patient || !form.chiefComplaint.trim()}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-md disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,#166534,#15803d)" }}
        >
          {submitting ? (
            <>
              <Loader2 size={15} className="animate-spin" /> Creating visit…
            </>
          ) : (
            <>
              <CheckCircle2 size={15} /> Create Visit &amp; Open Workspace
            </>
          )}
        </button>
      </div>
    </div>
  );
}
