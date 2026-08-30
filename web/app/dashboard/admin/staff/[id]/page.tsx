"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/lib/api";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  KeyRound,
  Building2,
  Phone,
  Mail,
  BadgeCheck,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { format } from "date-fns";

const ROLE_META: Record<string, { label: string; color: string; bg: string }> =
  {
    practitioner: { label: "Doctor", color: "var(--blue-600)", bg: "var(--info-tint)" },
    nurse: { label: "Nurse", color: "var(--info-ink)", bg: "var(--info-tint)" },
    lab_technician: {
      label: "Lab Technician",
      color: "var(--urgent-ink)",
      bg: "var(--amber-050)",
    },
    radiologist: { label: "Radiologist", color: "var(--accent-ink)", bg: "var(--violet-050)" },
    pharmacist: { label: "Pharmacist", color: "var(--green-800)", bg: "var(--brand-tint)" },
    receptionist: { label: "Receptionist", color: "var(--info-ink)", bg: "var(--info-tint)" },
    admin: { label: "Admin", color: "var(--critical-ink)", bg: "var(--coral-050)" },
  };

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between py-3 border-b border-[var(--border-faint)] last:border-0">
      <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide w-36 flex-shrink-0">
        {label}
      </p>
      <p
        className={`text-sm text-[var(--text-primary)] text-right ${mono ? "font-mono" : "font-medium"}`}
      >
        {value ?? "—"}
      </p>
    </div>
  );
}

export default function StaffDetailPage() {
  const router = useRouter();
  const params = useParams();
  const staffId = params.id as string;

  const [staff, setStaff] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Password reset
  const [showResetForm, setShowResetForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState("");

  // Actions
  const [verifying, setVerifying] = useState(false);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        console.log(`[STAFF_DETAIL] Loading staff: ${staffId}`);
        const res = await api.get(`/api/practitioners/${staffId}`);
        const staffData = res.data.data?.practitioner ?? res.data.data;
        console.log("[STAFF_DETAIL] Loaded:", {
          id: staffData.id,
          name: `${staffData.firstName} ${staffData.lastName}`,
          institutionId: staffData.institutionId,
          institutionName: staffData.institutionName,
        });
        setStaff(staffData);
      } catch (err: any) {
        console.error("[STAFF_DETAIL] Error:", err.message);
        setError("Failed to load staff member.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [staffId]);

  const handleVerify = async () => {
    setVerifying(true);
    try {
      await api.patch(`/api/practitioners/${staffId}/verify`);
      setStaff((s: any) => ({ ...s, isVerified: true }));
    } catch {
    } finally {
      setVerifying(false);
    }
  };

  const handleToggleActive = async () => {
    setToggling(true);
    try {
      await api.patch(`/api/practitioners/${staffId}/toggle-active`);
      setStaff((s: any) => ({ ...s, isActive: !s.isActive }));
    } catch {
    } finally {
      setToggling(false);
    }
  };

  const handleResetPassword = async () => {
    setResetError("");
    if (!newPassword || newPassword !== confirmPassword) {
      setResetError("Passwords do not match or are empty.");
      return;
    }
    if (newPassword.length < 8) {
      setResetError("Password must be at least 8 characters.");
      return;
    }
    setResetLoading(true);
    try {
      await api.patch(`/api/practitioners/${staffId}/reset-password`, {
        newPassword,
      });
      setResetSuccess(true);
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setResetSuccess(false);
        setShowResetForm(false);
      }, 2500);
    } catch (err: any) {
      setResetError(
        err.response?.data?.error?.message || "Failed to reset password.",
      );
    } finally {
      setResetLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-[var(--green-600)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !staff) {
    return (
      <div className="max-w-lg mx-auto py-20 text-center">
        <AlertTriangle className="w-10 h-10 text-[var(--coral-500)] mx-auto mb-3" />
        <p className="text-[var(--text-secondary)] font-semibold">
          {error || "Staff member not found"}
        </p>
        <button
          onClick={() => router.back()}
          className="mt-4 text-sm text-[var(--green-700)] hover:underline"
        >
          Go back
        </button>
      </div>
    );
  }

  const meta = ROLE_META[staff.specialization] ?? ROLE_META.practitioner;

  return (
    <div
      className="max-w-2xl mx-auto"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-[var(--r-sm)] border border-[var(--hc-border)] flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 style={{ margin: 0, font: "700 27px/1.1 var(--font-sans)", letterSpacing: "var(--ls-tight)", color: "var(--text-primary)" }}>
            Staff Profile
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            View and manage staff account
          </p>
        </div>
      </div>

      {/* Profile card */}
      <div className="bg-[var(--surface-card)] rounded-[var(--r-lg)] border border-[var(--border-faint)] shadow-[var(--elev-1)] overflow-hidden mb-4">
        <div
          className="px-6 py-5 border-b border-[var(--border-faint)] flex items-center gap-4"
          style={{ background: "var(--surface-sunken)" }}
        >
          <div
            className="w-14 h-14 rounded-[var(--r-lg)] flex items-center justify-center text-xl font-bold text-[var(--white)] flex-shrink-0"
            style={{ background: "var(--sidebar-bg)" }}
          >
            {staff.firstName?.[0]}
            {staff.lastName?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-bold text-[var(--text-primary)]">
              {staff.firstName} {staff.lastName}
            </p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span
                className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                style={{ background: meta.bg, color: meta.color }}
              >
                {meta.label}
              </span>
              {staff.isVerified ? (
                <span className="flex items-center gap-1 text-xs font-semibold text-[var(--green-700)] bg-[var(--brand-tint)] px-2.5 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" /> Verified
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs font-semibold text-[var(--critical-ink)] bg-[var(--coral-050)] px-2.5 py-0.5 rounded-full">
                  <AlertTriangle className="w-3 h-3" /> Unverified
                </span>
              )}
              <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${staff.isActive ? "bg-[var(--brand-tint)] text-[var(--green-700)]" : "bg-[var(--surface-sunken)] text-[var(--text-secondary)]"}`}
              >
                {staff.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
        </div>

        <div className="px-6 py-2">
          <InfoRow label="License No." value={staff.licenseNumber} mono />
          <InfoRow
            label="Institutional ID"
            value={staff.institutionalId}
            mono
          />
          <InfoRow label="Specialization" value={staff.specialization} />
          <InfoRow label="Department" value={staff.department} />
          {/* FIXED: Show institution details from backend */}
          {staff.institutionName ? (
            <InfoRow label="Institution" value={staff.institutionName} />
          ) : (
            <InfoRow
              label="Institution"
              value={
                staff.institutionId ? "Assigned but not loaded" : "Not assigned"
              }
            />
          )}
          {staff.institutionCode && (
            <InfoRow
              label="Institution Code"
              value={staff.institutionCode}
              mono
            />
          )}
          {staff.institutionType && (
            <InfoRow label="Institution Type" value={staff.institutionType} />
          )}
          {staff.qualifications && (
            <InfoRow label="Qualifications" value={staff.qualifications} />
          )}
          <InfoRow
            label="Joined"
            value={
              staff.createdAt
                ? format(new Date(staff.createdAt), "dd MMM yyyy")
                : undefined
            }
          />
          <InfoRow label="Blockchain" value={staff.blockchainAddress} mono />
        </div>
      </div>

      {/* Contact */}
      <div className="bg-[var(--surface-card)] rounded-[var(--r-lg)] border border-[var(--border-faint)] shadow-[var(--elev-1)] p-6 mb-4">
        <h2 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide mb-4">
          Contact
        </h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-[var(--r-xs)] bg-[var(--surface-sunken)] flex items-center justify-center flex-shrink-0">
              <Mail className="w-4 h-4 text-[var(--text-muted)]" />
            </div>
            <p className="text-sm text-[var(--text-secondary)]">{staff.email ?? "—"}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-[var(--r-xs)] bg-[var(--surface-sunken)] flex items-center justify-center flex-shrink-0">
              <Phone className="w-4 h-4 text-[var(--text-muted)]" />
            </div>
            <p className="text-sm text-[var(--text-secondary)]">{staff.phoneNumber ?? "—"}</p>
          </div>
          {/* FIXED: Show institution info from backend data */}
          {staff.institutionName && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-[var(--r-xs)] bg-[var(--surface-sunken)] flex items-center justify-center flex-shrink-0">
                <Building2 className="w-4 h-4 text-[var(--text-muted)]" />
              </div>
              <div>
                <p className="text-sm text-[var(--text-secondary)] font-medium">
                  {staff.institutionName}
                </p>
                {staff.institutionCode && (
                  <p className="text-xs text-[var(--text-secondary)]">
                    Code: {staff.institutionCode}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="bg-[var(--surface-card)] rounded-[var(--r-lg)] border border-[var(--border-faint)] shadow-[var(--elev-1)] p-6 mb-4">
        <h2 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide mb-4">
          Account Actions
        </h2>
        <div className="space-y-3">
          {/* Verify */}
          {!staff.isVerified && (
            <div className="flex items-center justify-between p-4 rounded-[var(--r-sm)] bg-[var(--amber-050)] border border-[var(--amber-100)]">
              <div>
                <p className="text-sm font-semibold text-[var(--urgent-ink)]">
                  Verify Account
                </p>
                <p className="text-xs text-[var(--urgent-ink)] mt-0.5">
                  Allow this staff member to access the system
                </p>
              </div>
              <button
                onClick={handleVerify}
                disabled={verifying}
                className="flex items-center gap-2 px-4 py-2 rounded-[var(--r-sm)] text-sm font-semibold text-[var(--white)] disabled:opacity-50 transition-all hover:shadow-[var(--elev-2)]"
                style={{
                  background: "var(--brand)",
                }}
              >
                <BadgeCheck className="w-4 h-4" />
                {verifying ? "Verifying…" : "Verify"}
              </button>
            </div>
          )}

          {/* Toggle active */}
          <div className="flex items-center justify-between p-4 rounded-[var(--r-sm)] bg-[var(--surface-sunken)] border border-[var(--border-faint)]">
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                {staff.isActive ? "Deactivate Account" : "Activate Account"}
              </p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                {staff.isActive
                  ? "Prevent this staff member from logging in"
                  : "Allow this staff member to log in"}
              </p>
            </div>
            <button
              onClick={handleToggleActive}
              disabled={toggling}
              className={`flex items-center gap-2 px-4 py-2 rounded-[var(--r-sm)] text-sm font-semibold disabled:opacity-50 transition-all ${staff.isActive ? "bg-[var(--coral-050)] text-[var(--critical-ink)] border border-[var(--coral-100)] hover:bg-[var(--coral-100)]" : "bg-[var(--brand-tint)] text-[var(--green-700)] border border-[var(--green-100)] hover:bg-[var(--green-100)]"}`}
            >
              {staff.isActive ? (
                <ToggleLeft className="w-4 h-4" />
              ) : (
                <ToggleRight className="w-4 h-4" />
              )}
              {toggling
                ? "Updating…"
                : staff.isActive
                  ? "Deactivate"
                  : "Activate"}
            </button>
          </div>

          {/* Reset password */}
          <div className="p-4 rounded-[var(--r-sm)] bg-[var(--surface-sunken)] border border-[var(--border-faint)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  Reset Password
                </p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Set a new password for this account
                </p>
              </div>
              <button
                onClick={() => {
                  setShowResetForm(!showResetForm);
                  setResetError("");
                  setResetSuccess(false);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-[var(--r-sm)] text-sm font-semibold bg-[var(--surface-card)] border border-[var(--hc-border)] text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] transition-colors"
              >
                <KeyRound className="w-4 h-4" /> Reset
              </button>
            </div>

            {showResetForm && (
              <div className="mt-4 space-y-3">
                {resetSuccess && (
                  <div className="flex items-center gap-2 p-3 rounded-[var(--r-sm)] bg-[var(--brand-tint)] border border-[var(--green-200)]">
                    <CheckCircle2 className="w-4 h-4 text-[var(--green-700)] flex-shrink-0" />
                    <p className="text-sm text-[var(--green-700)]">
                      Password reset successfully.
                    </p>
                  </div>
                )}
                {resetError && (
                  <p className="text-sm text-[var(--critical-ink)]">{resetError}</p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      className="w-full px-3.5 py-2.5 rounded-[var(--r-sm)] border border-[var(--hc-border)] bg-[var(--surface-card)] text-sm outline-none focus:border-[var(--green-600)] focus:ring-2 focus:ring-[var(--green-600)] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      className="w-full px-3.5 py-2.5 rounded-[var(--r-sm)] border border-[var(--hc-border)] bg-[var(--surface-card)] text-sm outline-none focus:border-[var(--green-600)] focus:ring-2 focus:ring-[var(--green-600)] transition-all"
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShowResetForm(false)}
                    className="px-4 py-2 rounded-[var(--r-sm)] text-sm font-semibold border border-[var(--hc-border)] text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleResetPassword}
                    disabled={resetLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded-[var(--r-sm)] text-sm font-semibold text-[var(--white)] disabled:opacity-50"
                    style={{
                      background: "var(--brand)",
                    }}
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    {resetLoading ? "Resetting…" : "Set Password"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
