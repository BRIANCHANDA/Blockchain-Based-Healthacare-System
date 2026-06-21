"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import { Logo } from "@/components/Logo";
import {
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  Mail,
  Hash,
  ArrowLeft,
} from "lucide-react";

type LoginMode = "license" | "email";

const licenseSchema = z.object({
  licenseNumber: z.string().min(1, "License number is required"),
  password: z.string().min(1, "Password is required"),
});
const emailSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});
const otpSchema = z.object({
  otp: z.string().length(6, "Code must be 6 digits"),
});

type LicenseForm = z.infer<typeof licenseSchema>;
type EmailForm = z.infer<typeof emailSchema>;
type OTPForm = z.infer<typeof otpSchema>;

const ROLE_ROUTES: Record<string, string> = {
  admin: "/dashboard/admin",
  practitioner: "/dashboard/doctor",
  nurse: "/dashboard/nurse",
  receptionist: "/dashboard/receptionist",
  lab_technician: "/dashboard/laboratory",
  radiologist: "/dashboard/radiology",
  pharmacist: "/dashboard/pharmacy",
};

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [mode, setMode] = useState<LoginMode>("license");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [otpStep, setOtpStep] = useState(false);
  const [otpData, setOtpData] = useState<{
    userId: string;
    maskedEmail: string;
  } | null>(null);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState("");

  const licenseForm = useForm<LicenseForm>({
    resolver: zodResolver(licenseSchema),
  });
  const emailForm = useForm<EmailForm>({ resolver: zodResolver(emailSchema) });
  const otpForm = useForm<OTPForm>({ resolver: zodResolver(otpSchema) });

  const onSubmitCredentials = async (data: LicenseForm | EmailForm) => {
    setLoading(true);
    setError("");
    try {
      const payload =
        mode === "license"
          ? {
              licenseNumber: (data as LicenseForm).licenseNumber,
              password: data.password,
            }
          : { email: (data as EmailForm).email, password: data.password };
      const res = await api.post("/api/auth/login/staff", payload);
      const d = res.data.data;
      if (d.requiresOTP) {
        setOtpData({ userId: d.userId, maskedEmail: d.maskedEmail });
        setOtpStep(true);
      } else {
        setAuth(d.user, d.token);
        if (d.user.mustChangePassword) {
          router.replace("/change-password");
          return;
        }
        router.replace(ROLE_ROUTES[d.user.type] ?? "/dashboard/admin");
      }
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ??
          "Invalid credentials. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const onSubmitOTP = async (data: OTPForm) => {
    if (!otpData) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/api/auth/verify-otp", {
        userId: otpData.userId,
        userType: "staff",
        otp: data.otp,
      });
      const d = res.data.data;
      setAuth(d.user, d.token);
      if (d.user.mustChangePassword) {
        router.replace("/change-password");
        return;
      }
      router.replace(ROLE_ROUTES[d.user.type] ?? "/dashboard/admin");
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ??
          "Invalid or expired code. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!otpData) return;
    setResending(true);
    setResendMsg("");
    try {
      const res = await api.post("/api/auth/resend-otp", {
        userId: otpData.userId,
        userType: "staff",
      });
      setResendMsg(res.data.data.message);
    } catch {
      setResendMsg("Failed to resend. Please try again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f8f9fc",
        fontFamily: "'DM Sans', sans-serif",
        padding: 24,
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap');
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .input-field { width:100%; padding:11px 14px; border-radius:10px; border:1.5px solid #e5e7eb; background:#fff; font-size:14px; color:#111827; outline:none; transition:all 0.15s; font-family:'DM Sans',sans-serif; box-sizing:border-box; }
        .input-field:focus { border-color:#166534; box-shadow:0 0 0 3px rgba(22,101,52,0.07); }
        .input-field::placeholder { color:#d1d5db; }
        .submit-btn { width:100%; padding:12px; border-radius:10px; border:none; background:#166534; color:#fff; font-size:14px; font-weight:700; cursor:pointer; transition:all 0.15s; display:flex; align-items:center; justify-content:center; gap:8px; font-family:'DM Sans',sans-serif; }
        .submit-btn:hover:not(:disabled) { background:#15803d; }
        .submit-btn:disabled { opacity:0.55; cursor:not-allowed; }
        .mode-btn { flex:1; padding:9px; border-radius:9px; border:1.5px solid #e5e7eb; background:#fff; font-size:13px; font-weight:600; color:#6b7280; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; transition:all 0.15s; font-family:'DM Sans',sans-serif; }
        .mode-btn.active { border-color:#166534; background:#f0fdf4; color:#166534; }
        .otp-input { width:100%; padding:14px; border-radius:10px; border:1.5px solid #e5e7eb; background:#fff; font-size:32px; font-weight:800; color:#111827; outline:none; transition:all 0.15s; font-family:monospace; text-align:center; letter-spacing:12px; box-sizing:border-box; }
        .otp-input:focus { border-color:#166534; box-shadow:0 0 0 3px rgba(22,101,52,0.07); }
      `}</style>

      <div
        style={{
          width: "100%",
          maxWidth: 400,
          animation: "fadeUp 0.3s ease both",
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              overflow: "hidden",
              margin: "0 auto 12px",
            }}
          >
            <Logo size={44} />
          </div>
          <p
            style={{
              fontFamily: "'Playfair Display',serif",
              fontSize: 20,
              fontWeight: 700,
              color: "#0A0E1A",
              margin: 0,
            }}
          >
            Med<span style={{ color: "#059669" }}>Link</span>
          </p>
          <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 3 }}>
            Staff Portal · Zambia
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            border: "1px solid #e5e7eb",
            padding: "32px 28px",
            boxShadow:
              "0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.04)",
          }}
        >
          {!otpStep ? (
            <>
              <h1
                style={{
                  fontFamily: "'Playfair Display',serif",
                  fontSize: 22,
                  fontWeight: 700,
                  color: "#111827",
                  marginBottom: 4,
                  marginTop: 0,
                }}
              >
                Sign in
              </h1>
              <p
                style={{
                  fontSize: 13.5,
                  color: "#9ca3af",
                  marginBottom: 24,
                  marginTop: 0,
                }}
              >
                Enter your credentials to continue
              </p>

              {/* Mode toggle */}
              <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                <button
                  className={`mode-btn ${mode === "license" ? "active" : ""}`}
                  onClick={() => {
                    setMode("license");
                    setError("");
                  }}
                >
                  <Hash size={13} /> License No.
                </button>
                <button
                  className={`mode-btn ${mode === "email" ? "active" : ""}`}
                  onClick={() => {
                    setMode("email");
                    setError("");
                  }}
                >
                  <Mail size={13} /> Email
                </button>
              </div>

              {/* License form */}
              {mode === "license" && (
                <form
                  onSubmit={licenseForm.handleSubmit(onSubmitCredentials)}
                  style={{ display: "flex", flexDirection: "column", gap: 14 }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: "#374151",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        marginBottom: 6,
                      }}
                    >
                      License Number
                    </label>
                    <input
                      {...licenseForm.register("licenseNumber")}
                      placeholder="e.g. LIC-2024-001"
                      className="input-field"
                      autoComplete="username"
                    />
                    {licenseForm.formState.errors.licenseNumber && (
                      <p
                        style={{ fontSize: 12, color: "#ef4444", marginTop: 4 }}
                      >
                        {licenseForm.formState.errors.licenseNumber.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: "#374151",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        marginBottom: 6,
                      }}
                    >
                      Password
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        {...licenseForm.register("password")}
                        type={showPw ? "text" : "password"}
                        placeholder="Enter your password"
                        className="input-field"
                        style={{ paddingRight: 42 }}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((v) => !v)}
                        style={{
                          position: "absolute",
                          right: 12,
                          top: "50%",
                          transform: "translateY(-50%)",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#9ca3af",
                          display: "flex",
                          padding: 0,
                        }}
                      >
                        {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {licenseForm.formState.errors.password && (
                      <p
                        style={{ fontSize: 12, color: "#ef4444", marginTop: 4 }}
                      >
                        {licenseForm.formState.errors.password.message}
                      </p>
                    )}
                  </div>
                  {error && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 9,
                        padding: "10px 13px",
                        borderRadius: 9,
                        background: "#fef2f2",
                        border: "1px solid #fecaca",
                      }}
                    >
                      <AlertCircle
                        size={14}
                        style={{ color: "#dc2626", flexShrink: 0 }}
                      />
                      <p style={{ fontSize: 13, color: "#dc2626", margin: 0 }}>
                        {error}
                      </p>
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="submit-btn"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={15} className="animate-spin" /> Signing
                        in…
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </button>
                </form>
              )}

              {/* Email form */}
              {mode === "email" && (
                <form
                  onSubmit={emailForm.handleSubmit(onSubmitCredentials)}
                  style={{ display: "flex", flexDirection: "column", gap: 14 }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: "#374151",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        marginBottom: 6,
                      }}
                    >
                      Email Address
                    </label>
                    <input
                      {...emailForm.register("email")}
                      type="email"
                      placeholder="your@email.com"
                      className="input-field"
                      autoComplete="email"
                    />
                    {emailForm.formState.errors.email && (
                      <p
                        style={{ fontSize: 12, color: "#ef4444", marginTop: 4 }}
                      >
                        {emailForm.formState.errors.email.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: "#374151",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        marginBottom: 6,
                      }}
                    >
                      Password
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        {...emailForm.register("password")}
                        type={showPw ? "text" : "password"}
                        placeholder="Enter your password"
                        className="input-field"
                        style={{ paddingRight: 42 }}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((v) => !v)}
                        style={{
                          position: "absolute",
                          right: 12,
                          top: "50%",
                          transform: "translateY(-50%)",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#9ca3af",
                          display: "flex",
                          padding: 0,
                        }}
                      >
                        {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {emailForm.formState.errors.password && (
                      <p
                        style={{ fontSize: 12, color: "#ef4444", marginTop: 4 }}
                      >
                        {emailForm.formState.errors.password.message}
                      </p>
                    )}
                  </div>
                  {error && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 9,
                        padding: "10px 13px",
                        borderRadius: 9,
                        background: "#fef2f2",
                        border: "1px solid #fecaca",
                      }}
                    >
                      <AlertCircle
                        size={14}
                        style={{ color: "#dc2626", flexShrink: 0 }}
                      />
                      <p style={{ fontSize: 13, color: "#dc2626", margin: 0 }}>
                        {error}
                      </p>
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="submit-btn"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={15} className="animate-spin" /> Signing
                        in…
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </button>
                </form>
              )}
            </>
          ) : (
            /* OTP step */
            <>
              <button
                onClick={() => {
                  setOtpStep(false);
                  setError("");
                  otpForm.reset();
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  fontSize: 13,
                  color: "#6b7280",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  marginBottom: 24,
                  padding: 0,
                  fontFamily: "'DM Sans',sans-serif",
                }}
              >
                <ArrowLeft size={14} /> Back
              </button>

              <div style={{ marginBottom: 24 }}>
                <h1
                  style={{
                    fontFamily: "'Playfair Display',serif",
                    fontSize: 22,
                    fontWeight: 700,
                    color: "#111827",
                    marginBottom: 4,
                    marginTop: 0,
                  }}
                >
                  Check your email
                </h1>
                <p
                  style={{
                    fontSize: 13.5,
                    color: "#9ca3af",
                    marginTop: 0,
                    lineHeight: 1.6,
                  }}
                >
                  We sent a 6-digit code to{" "}
                  <strong style={{ color: "#374151" }}>
                    {otpData?.maskedEmail}
                  </strong>
                </p>
              </div>

              <form
                onSubmit={otpForm.handleSubmit(onSubmitOTP)}
                style={{ display: "flex", flexDirection: "column", gap: 14 }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: "#374151",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: 6,
                    }}
                  >
                    Verification Code
                  </label>
                  <input
                    {...otpForm.register("otp")}
                    className="otp-input"
                    placeholder="000000"
                    maxLength={6}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                  />
                  {otpForm.formState.errors.otp && (
                    <p
                      style={{
                        fontSize: 12,
                        color: "#ef4444",
                        marginTop: 4,
                        textAlign: "center",
                      }}
                    >
                      {otpForm.formState.errors.otp.message}
                    </p>
                  )}
                </div>

                {error && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                      padding: "10px 13px",
                      borderRadius: 9,
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                    }}
                  >
                    <AlertCircle
                      size={14}
                      style={{ color: "#dc2626", flexShrink: 0 }}
                    />
                    <p style={{ fontSize: 13, color: "#dc2626", margin: 0 }}>
                      {error}
                    </p>
                  </div>
                )}
                {resendMsg && (
                  <p
                    style={{
                      fontSize: 12,
                      color: "#166534",
                      textAlign: "center",
                      margin: 0,
                    }}
                  >
                    {resendMsg}
                  </p>
                )}

                <button type="submit" disabled={loading} className="submit-btn">
                  {loading ? (
                    <>
                      <Loader2 size={15} className="animate-spin" /> Verifying…
                    </>
                  ) : (
                    "Verify Code"
                  )}
                </button>

                <p
                  style={{
                    fontSize: 13,
                    color: "#9ca3af",
                    textAlign: "center",
                    margin: 0,
                  }}
                >
                  Didn't receive it?{" "}
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resending}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#166534",
                      fontWeight: 700,
                      fontSize: 13,
                      textDecoration: "underline",
                      fontFamily: "'DM Sans',sans-serif",
                      padding: 0,
                    }}
                  >
                    {resending ? "Sending…" : "Resend"}
                  </button>
                </p>

                <p
                  style={{
                    fontSize: 11.5,
                    color: "#d1d5db",
                    textAlign: "center",
                    margin: 0,
                  }}
                >
                  Expires in 5 minutes
                </p>
              </form>
            </>
          )}
        </div>

        <p
          style={{
            fontSize: 12,
            color: "#d1d5db",
            textAlign: "center",
            marginTop: 20,
          }}
        >
          MedLink EMR · Copperbelt University · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
