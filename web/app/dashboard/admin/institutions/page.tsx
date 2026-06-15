"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { institutionApi } from "@/lib/api";
import { Building2, RefreshCw, Plus, X, ShieldAlert } from "lucide-react";
import { PhoneInput } from "@/components/ui/PhoneInput";

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
      <div className="h-5 bg-gray-100 rounded animate-pulse w-2/3" />
      <div className="h-4 bg-gray-100 rounded animate-pulse w-1/3" />
      <div className="h-4 bg-gray-100 rounded animate-pulse w-1/2" />
    </div>
  );
}

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  hospital: { bg: "#eff6ff", color: "#2563eb" },
  clinic: { bg: "#f0fdf4", color: "#16a34a" },
  laboratory: { bg: "#fdf4ff", color: "#9333ea" },
  pharmacy: { bg: "#fff7ed", color: "#ea580c" },
};

export default function AdminInstitutionsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const isSuperAdmin = !(user as any)?.institutionId;

  const [institutions, setInstitutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    institutionName: "",
    institutionCode: "",
    institutionType: "hospital",
    licenseNumber: "",
    address: "",
    phone: "+260",
    bedCapacity: "",
  });

  // Hard guard — hospital admins should not be on this page
  useEffect(() => {
    if (user && !isSuperAdmin) {
      router.replace("/dashboard/admin");
    }
  }, [user, isSuperAdmin]);

  const load = async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await institutionApi.list();
      setInstitutions(res.data.data?.institutions ?? res.data.data ?? []);
    } catch {
      setInstitutions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async () => {
    if (!form.institutionName || !form.institutionCode || !form.licenseNumber || !form.address || !form.phone) {
      setError("Name, institution code, license number, address, and phone are required.");
      return;
    }
    if (!/^\+\d{10,13}$/.test(form.phone)) {
      setError("Enter a valid phone number (e.g. +260977123456).");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await institutionApi.create({
        ...form,
        bedCapacity: form.bedCapacity ? parseInt(form.bedCapacity) : undefined,
      });
      setSuccess("Institution created successfully.");
      setShowForm(false);
      setForm({
        institutionName: "",
        institutionCode: "",
        institutionType: "hospital",
        licenseNumber: "",
        address: "",
        phone: "+260",
        bedCapacity: "",
      });
      await load(true);
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message || "Failed to create institution.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Show access denied if hospital admin somehow reaches this page
  if (user && !isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <ShieldAlert className="w-12 h-12 text-red-300" />
        <p className="text-sm font-semibold text-gray-500">
          Access restricted to Super Admins
        </p>
        <button
          onClick={() => router.replace("/dashboard/admin")}
          className="text-xs text-green-700 underline"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl font-bold text-gray-900"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Institutions
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {institutions.length} registered institution
            {institutions.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => load(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
            />
          </button>
          <button
            onClick={() => {
              setShowForm(true);
              setError("");
              setSuccess("");
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-md"
            style={{ background: "linear-gradient(135deg, #166534, #15803d)" }}
          >
            <Plus className="w-4 h-4" /> Add Institution
          </button>
        </div>
      </div>

      {success && (
        <div className="mb-4 p-3 rounded-xl bg-green-50 border border-green-200 text-sm text-green-700 flex items-center justify-between">
          {success}
          <button onClick={() => setSuccess("")}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-gray-900">
              New Institution
            </h2>
            <button
              onClick={() => setShowForm(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                key: "institutionName",
                label: "Institution Name",
                placeholder: "e.g. City General Hospital",
              },
              {
                key: "institutionCode",
                label: "Institution Code",
                placeholder: "e.g. CGH-001",
              },
              {
                key: "licenseNumber",
                label: "License Number",
                placeholder: "e.g. LIC-2024-001",
              },
              {
                key: "address",
                label: "Address",
                placeholder: "e.g. 123 Main St, Lusaka",
              },
              {
                key: "bedCapacity",
                label: "Bed Capacity",
                placeholder: "e.g. 200",
                type: "number",
              },
            ].map(({ key, label, placeholder, type }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  {label}
                </label>
                <input
                  type={type ?? "text"}
                  value={(form as any)[key]}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, [key]: e.target.value }))
                  }
                  placeholder={placeholder}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/10 focus:bg-white transition-all"
                />
              </div>
            ))}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                Phone
              </label>
              <PhoneInput
                value={form.phone}
                onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                Type
              </label>
              <select
                value={form.institutionType}
                onChange={(e) =>
                  setForm((f) => ({ ...f, institutionType: e.target.value }))
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/10 transition-all"
              >
                {["hospital", "clinic", "laboratory", "pharmacy"].map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 mt-5">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all hover:shadow-md"
              style={{
                background: "linear-gradient(135deg, #166534, #15803d)",
              }}
            >
              {submitting ? "Creating…" : "Create Institution"}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
        ) : institutions.length === 0 ? (
          <div className="col-span-3 py-20 text-center">
            <Building2 className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-400">
              No institutions found
            </p>
          </div>
        ) : (
          institutions.map((inst) => {
            const tc = TYPE_COLORS[inst.institutionType] ?? {
              bg: "#f3f4f6",
              color: "#6b7280",
            };
            return (
              <div
                key={inst.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: tc.bg }}
                  >
                    <Building2
                      className="w-5 h-5"
                      style={{ color: tc.color }}
                    />
                  </div>
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize"
                    style={{ background: tc.bg, color: tc.color }}
                  >
                    {inst.institutionType}
                  </span>
                </div>
                <h3 className="font-bold text-gray-900 text-sm mb-1">
                  {inst.institutionName}
                </h3>
                <p className="text-xs text-gray-400 font-mono mb-3">
                  {inst.institutionCode}
                </p>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>License: {inst.licenseNumber}</span>
                  {inst.bedCapacity && <span>{inst.bedCapacity} beds</span>}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-50">
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${inst.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}
                  >
                    {inst.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
