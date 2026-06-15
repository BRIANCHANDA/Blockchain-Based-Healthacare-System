"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

export default function ChangePasswordPage() {
  const router = useRouter();
  const { user, clearAuth, setMustChange } = useAuthStore();

  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const isPatient = user?.type === "patient";
  const endpoint = isPatient
    ? "/api/auth/change-password/patient"
    : "/api/auth/change-password/staff";
  const isSuperAdmin = !(user as any)?.institutionId && user?.type === "admin";

  const validate = () => {
    if (!oldPw || !newPw || !confirmPw) return "Please fill in all fields.";
    if (newPw.length < 8) return "New password must be at least 8 characters.";
    if (newPw !== confirmPw) return "New passwords do not match.";
    if (newPw === oldPw)
      return "New password must differ from your current password.";
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api.post(endpoint, { oldPassword: oldPw, newPassword: newPw });
      setDone(true);
      setMustChange(false);
      setTimeout(() => {
        clearAuth();
        router.replace("/login");
      }, 2500);
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ??
          "Failed to change password. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const strength = (() => {
    if (!newPw) return 0;
    let s = 0;
    if (newPw.length >= 8) s++;
    if (/[A-Z]/.test(newPw)) s++;
    if (/[0-9]/.test(newPw)) s++;
    if (/[^A-Za-z0-9]/.test(newPw)) s++;
    return s;
  })();
  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"][strength];
  const strengthColor = ["", "#ef4444", "#f59e0b", "#3b82f6", "#4ade80"][
    strength
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        fontFamily: "'DM Sans', sans-serif",
        background: "#f0f2f5",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap');
        @keyframes fadeUp   { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes shimmer  { 0%,100%{opacity:0.6} 50%{opacity:1} }
        @keyframes badgePulse { 0%,100%{box-shadow:0 0 0 0 rgba(74,222,128,0.4)} 50%{box-shadow:0 0 0 5px rgba(74,222,128,0)} }
        @keyframes bounce3  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        .input-field {
          width:100%; padding:11px 14px; border-radius:12px;
          border:1.5px solid #e5e7eb; background:#f9fafb;
          font-size:14px; color:#111; outline:none; transition:all 0.18s;
          font-family:'DM Sans',sans-serif;
        }
        .input-field:focus { border-color:#166534; background:#fff; box-shadow:0 0 0 3px rgba(22,101,52,0.08); }
        .input-field::placeholder { color:#c4c9d4; }
        .submit-btn {
          width:100%; padding:13px; border-radius:13px; border:none;
          background:linear-gradient(135deg,#052e16,#166534,#15803d);
          color:#fff; font-size:14px; font-weight:700; cursor:pointer;
          letter-spacing:0.02em; transition:all 0.2s;
          box-shadow:0 4px 14px rgba(22,101,52,0.3);
          display:flex; align-items:center; justify-content:center; gap:8px;
        }
        .submit-btn:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 6px 20px rgba(22,101,52,0.4); }
        .submit-btn:active:not(:disabled) { transform:translateY(0) scale(0.99); }
        .submit-btn:disabled { opacity:0.6; cursor:not-allowed; }
      `}</style>

      {/* Left panel — decorative */}
      <div
        style={{
          width: 420,
          flexShrink: 0,
          display: "none",
          position: "relative",
          overflow: "hidden",
          background:
            "linear-gradient(160deg,#052e16 0%,#064e1f 40%,#0a5c26 70%,#0d6e2e 100%)",
        }}
        className="lg:block"
      >
        {/* Texture */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
            pointerEvents: "none",
          }}
        />

        {/* Floating circles */}
        <div
          style={{
            position: "absolute",
            top: -80,
            right: -80,
            width: 320,
            height: 320,
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: -30,
            right: -30,
            width: 180,
            height: 180,
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -60,
            left: -60,
            width: 280,
            height: 280,
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 1,
            padding: "48px 44px",
            display: "flex",
            flexDirection: "column",
            height: "100%",
          }}
        >
          {/* Logo */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: "auto",
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 11,
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <rect
                  x="8"
                  y="2"
                  width="4"
                  height="16"
                  rx="2"
                  fill="white"
                  opacity="0.9"
                />
                <rect
                  x="2"
                  y="8"
                  width="16"
                  height="4"
                  rx="2"
                  fill="white"
                  opacity="0.9"
                />
                <circle cx="10" cy="10" r="2.5" fill="white" />
              </svg>
            </div>
            <div>
              <p
                style={{
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 15,
                  fontFamily: "'Playfair Display',serif",
                }}
              >
                MedLink
              </p>
              <p
                style={{
                  color: "rgba(255,255,255,0.35)",
                  fontSize: 10.5,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Admin Portal
              </p>
            </div>
          </div>

          {/* Main text */}
          <div style={{ marginBottom: "auto", paddingTop: 60 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 24,
              }}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h2
              style={{
                fontFamily: "'Playfair Display',serif",
                fontSize: 32,
                fontWeight: 700,
                color: "#fff",
                lineHeight: 1.2,
                marginBottom: 16,
              }}
            >
              Secure your
              <br />
              account
            </h2>
            <p
              style={{
                color: "rgba(255,255,255,0.45)",
                fontSize: 14,
                lineHeight: 1.7,
              }}
            >
              Set a strong password to protect your MedLink account. Your
              security helps keep patient data safe.
            </p>

            {/* Security tips */}
            <div
              style={{
                marginTop: 32,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {[
                "Use at least 8 characters",
                "Mix uppercase, numbers and symbols",
                "Never share your password",
              ].map((tip, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    animation: `fadeUp 0.4s ease ${0.2 + i * 0.1}s both`,
                  }}
                >
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: "rgba(74,222,128,0.15)",
                      border: "1px solid rgba(74,222,128,0.3)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                      <path
                        d="M2 6l3 3 5-5"
                        stroke="#4ade80"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}>
                    {tip}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Admin badge at bottom */}
          <div style={{ marginTop: 48 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                fontSize: 10.5,
                fontWeight: 800,
                padding: "5px 12px",
                borderRadius: 999,
                background: isSuperAdmin
                  ? "rgba(239,68,68,0.15)"
                  : "rgba(59,130,246,0.15)",
                color: isSuperAdmin ? "#fca5a5" : "#93c5fd",
                border: `1px solid ${isSuperAdmin ? "rgba(239,68,68,0.2)" : "rgba(59,130,246,0.2)"}`,
                letterSpacing: "0.1em",
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: isSuperAdmin ? "#ef4444" : "#3b82f6",
                  animation: "badgePulse 2s ease infinite",
                }}
              />
              {isSuperAdmin ? "SUPER ADMIN" : "HOSPITAL ADMIN"}
            </span>
            <p
              style={{
                color: "rgba(255,255,255,0.25)",
                fontSize: 12,
                marginTop: 8,
              }}
            >
              {user?.firstName} {user?.lastName}
            </p>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 420,
            animation: "fadeUp 0.4s ease both",
          }}
        >
          {/* Mobile logo */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 32,
            }}
            className="lg:hidden"
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                background: "linear-gradient(135deg,#166534,#15803d)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <rect
                  x="8"
                  y="2"
                  width="4"
                  height="16"
                  rx="2"
                  fill="white"
                  opacity="0.9"
                />
                <rect
                  x="2"
                  y="8"
                  width="16"
                  height="4"
                  rx="2"
                  fill="white"
                  opacity="0.9"
                />
              </svg>
            </div>
            <p
              style={{
                fontWeight: 700,
                fontSize: 15,
                color: "#111",
                fontFamily: "'Playfair Display',serif",
              }}
            >
              MedLink
            </p>
          </div>

          {done ? (
            /* ── Success state ── */
            <div
              style={{
                textAlign: "center",
                animation: "fadeUp 0.35s ease both",
              }}
            >
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 20,
                  background: "linear-gradient(135deg,#052e16,#166534)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 24px",
                  boxShadow: "0 8px 24px rgba(22,101,52,0.3)",
                }}
              >
                <CheckCircle2 size={32} color="#fff" />
              </div>
              <h1
                style={{
                  fontFamily: "'Playfair Display',serif",
                  fontSize: 26,
                  fontWeight: 700,
                  color: "#111",
                  marginBottom: 8,
                }}
              >
                Password Updated
              </h1>
              <p style={{ fontSize: 14, color: "#9ca3af", marginBottom: 32 }}>
                Redirecting you to login…
              </p>
              <div
                style={{ display: "flex", justifyContent: "center", gap: 6 }}
              >
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#166534",
                      animation: `bounce3 1s ease ${i * 0.15}s infinite`,
                    }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Heading */}
              <div style={{ marginBottom: 28 }}>
                <h1
                  style={{
                    fontFamily: "'Playfair Display',serif",
                    fontSize: 28,
                    fontWeight: 700,
                    color: "#111827",
                    marginBottom: 6,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {user?.mustChangePassword
                    ? "Set your password"
                    : "Change password"}
                </h1>
                <p style={{ fontSize: 14, color: "#9ca3af" }}>
                  {user?.mustChangePassword
                    ? "Your account was created with a temporary password."
                    : "Update your MedLink account password."}
                </p>
              </div>

              {/* Forced change notice */}
              {user?.mustChangePassword && (
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    padding: "12px 14px",
                    borderRadius: 12,
                    background: "#fffbeb",
                    border: "1px solid #fde68a",
                    marginBottom: 20,
                  }}
                >
                  <AlertCircle
                    size={15}
                    style={{ color: "#d97706", flexShrink: 0, marginTop: 1 }}
                  />
                  <p
                    style={{ fontSize: 13, color: "#92400e", lineHeight: 1.5 }}
                  >
                    set a new one to continue.
                  </p>
                </div>
              )}

              {/* Form */}
              <div
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                {/* Current password */}
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: "#374151",
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                      marginBottom: 7,
                    }}
                  >
                    Current Password
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showOld ? "text" : "password"}
                      value={oldPw}
                      onChange={(e) => setOldPw(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                      placeholder="Your current password"
                      className="input-field"
                      style={{ paddingRight: 44 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowOld((v) => !v)}
                      style={{
                        position: "absolute",
                        right: 13,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#9ca3af",
                        display: "flex",
                      }}
                    >
                      {showOld ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* New password */}
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: "#374151",
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                      marginBottom: 7,
                    }}
                  >
                    New Password
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showNew ? "text" : "password"}
                      value={newPw}
                      onChange={(e) => setNewPw(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                      placeholder="Min. 8 characters"
                      className="input-field"
                      style={{ paddingRight: 44 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew((v) => !v)}
                      style={{
                        position: "absolute",
                        right: 13,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#9ca3af",
                        display: "flex",
                      }}
                    >
                      {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  {/* Strength bar */}
                  {newPw && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                        {[1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            style={{
                              flex: 1,
                              height: 4,
                              borderRadius: 999,
                              background:
                                i <= strength ? strengthColor : "#e5e7eb",
                              transition: "background 0.2s",
                            }}
                          />
                        ))}
                      </div>
                      <p
                        style={{
                          fontSize: 11.5,
                          fontWeight: 600,
                          color: strengthColor,
                        }}
                      >
                        {strengthLabel}
                      </p>
                    </div>
                  )}
                </div>

                {/* Confirm password */}
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: "#374151",
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                      marginBottom: 7,
                    }}
                  >
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    placeholder="Repeat new password"
                    className="input-field"
                    style={{
                      borderColor:
                        confirmPw && confirmPw !== newPw
                          ? "#ef4444"
                          : undefined,
                    }}
                  />
                  {confirmPw && confirmPw !== newPw && (
                    <p style={{ fontSize: 12, color: "#ef4444", marginTop: 4 }}>
                      Passwords do not match
                    </p>
                  )}
                </div>

                {/* Error */}
                {error && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "11px 14px",
                      borderRadius: 12,
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                    }}
                  >
                    <AlertCircle
                      size={15}
                      style={{ color: "#dc2626", flexShrink: 0 }}
                    />
                    <p style={{ fontSize: 13, color: "#dc2626" }}>{error}</p>
                  </div>
                )}

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="submit-btn"
                  style={{ marginTop: 4 }}
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Updating…
                    </>
                  ) : (
                    "Update Password"
                  )}
                </button>

                {/* Cancel — only for voluntary changes */}
                {!user?.mustChangePassword && (
                  <button
                    onClick={() => router.back()}
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: 12,
                      border: "1.5px solid #e5e7eb",
                      background: "#fff",
                      fontSize: 13.5,
                      fontWeight: 600,
                      color: "#6b7280",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#d1d5db";
                      e.currentTarget.style.background = "#f9fafb";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#e5e7eb";
                      e.currentTarget.style.background = "#fff";
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>

              <p
                style={{
                  fontSize: 12,
                  color: "#c4c9d4",
                  textAlign: "center",
                  marginTop: 28,
                }}
              >
                MedLink EMR · Copperbelt University
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
