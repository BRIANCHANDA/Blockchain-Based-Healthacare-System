"use client";
import { useState, useRef } from "react";
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
  const otpInFlight = useRef(false);
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
    if (!otpData || otpInFlight.current || resending) return;
    otpInFlight.current = true;
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
      otpInFlight.current = false;
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!otpData || otpInFlight.current || resending) return;
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
        background: "var(--surface-bg)",
        fontFamily: "var(--font-sans)",
        padding: 24,
      }}
    >
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .input-field { width:100%; padding:11px 14px; border-radius:var(--r-sm); border:1.5px solid var(--hc-border); background:var(--surface-card); font-size:14px; color:var(--text-primary); outline:none; transition:all 0.15s; font-family:var(--font-sans); box-sizing:border-box; }
        .input-field:focus { border-color:var(--brand); box-shadow:0 0 0 3px var(--focus-ring); }
        .input-field::placeholder { color:var(--text-disabled); }
        .submit-btn { width:100%; padding:12px; border-radius:var(--r-sm); border:none; background:var(--brand); color:var(--on-brand); font-size:14px; font-weight:700; cursor:pointer; transition:all 0.15s; display:flex; align-items:center; justify-content:center; gap:8px; font-family:var(--font-sans); }
        .submit-btn:hover:not(:disabled) { background:var(--brand-deep); }
        .submit-btn:disabled { opacity:0.55; cursor:not-allowed; }
        .mode-btn { flex:1; padding:9px; border-radius:var(--r-xs); border:1.5px solid var(--hc-border); background:var(--surface-card); font-size:13px; font-weight:600; color:var(--text-secondary); cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; transition:all 0.15s; font-family:var(--font-sans); }
        .mode-btn.active { border-color:var(--brand); background:var(--brand-tint); color:var(--success-ink); }
        .otp-input { width:100%; padding:14px; border-radius:var(--r-sm); border:1.5px solid var(--hc-border); background:var(--surface-card); font-size:32px; font-weight:800; color:var(--text-primary); outline:none; transition:all 0.15s; font-family:var(--font-mono); text-align:center; letter-spacing:12px; box-sizing:border-box; }
        .otp-input:focus { border-color:var(--brand); box-shadow:0 0 0 3px var(--focus-ring); }
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
              borderRadius: "var(--r-sm)",
              overflow: "hidden",
              margin: "0 auto 12px",
            }}
          >
            <Logo size={44} />
          </div>
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 20,
              fontWeight: 700,
              color: "var(--text-primary)",
              margin: 0,
            }}
          >
            Med<span style={{ color: "var(--brand)" }}>Link</span>
          </p>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
            Staff Portal · Zambia
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            background: "var(--surface-card)",
            borderRadius: "var(--r-lg)",
            border: "1px solid var(--hc-border)",
            padding: "32px 28px",
            boxShadow:
              "var(--elev-2)",
          }}
        >
          {!otpStep ? (
            <>
              <h1
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 22,
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  marginBottom: 4,
                  marginTop: 0,
                }}
              >
                Sign in
              </h1>
              <p
                style={{
                  fontSize: 13.5,
                  color: "var(--text-muted)",
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
                        color: "var(--text-secondary)",
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
                        style={{ fontSize: 12, color: "var(--critical)", marginTop: 4 }}
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
                        color: "var(--text-secondary)",
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
                          color: "var(--text-muted)",
                          display: "flex",
                          padding: 0,
                        }}
                      >
                        {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {licenseForm.formState.errors.password && (
                      <p
                        style={{ fontSize: 12, color: "var(--critical)", marginTop: 4 }}
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
                        borderRadius: "var(--r-xs)",
                        background: "var(--coral-050)",
                        border: "1px solid var(--coral-100)",
                      }}
                    >
                      <AlertCircle
                        size={14}
                        style={{ color: "var(--critical-ink)", flexShrink: 0 }}
                      />
                      <p style={{ fontSize: 13, color: "var(--critical-ink)", margin: 0 }}>
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
                        color: "var(--text-secondary)",
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
                        style={{ fontSize: 12, color: "var(--critical)", marginTop: 4 }}
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
                        color: "var(--text-secondary)",
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
                          color: "var(--text-muted)",
                          display: "flex",
                          padding: 0,
                        }}
                      >
                        {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {emailForm.formState.errors.password && (
                      <p
                        style={{ fontSize: 12, color: "var(--critical)", marginTop: 4 }}
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
                        borderRadius: "var(--r-xs)",
                        background: "var(--coral-050)",
                        border: "1px solid var(--coral-100)",
                      }}
                    >
                      <AlertCircle
                        size={14}
                        style={{ color: "var(--critical-ink)", flexShrink: 0 }}
                      />
                      <p style={{ fontSize: 13, color: "var(--critical-ink)", margin: 0 }}>
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
                disabled={loading || resending}
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
                  color: "var(--text-secondary)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  marginBottom: 24,
                  padding: 0,
                  fontFamily: "var(--font-sans)",
                }}
              >
                <ArrowLeft size={14} /> Back
              </button>

              <div style={{ marginBottom: 24 }}>
                <h1
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 22,
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    marginBottom: 4,
                    marginTop: 0,
                  }}
                >
                  Check your email
                </h1>
                <p
                  style={{
                    fontSize: 13.5,
                    color: "var(--text-muted)",
                    marginTop: 0,
                    lineHeight: 1.6,
                  }}
                >
                  We sent a 6-digit code to{" "}
                  <strong style={{ color: "var(--text-secondary)" }}>
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
                      color: "var(--text-secondary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: 6,
                    }}
                  >
                    Verification Code
                  </label>
                  <input
                    {...otpForm.register("otp", {
                      onChange: (e) => {
                        const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                        e.target.value = val;
                        otpForm.setValue("otp", val);
                        if (val.length === 6) {
                          otpForm.handleSubmit(onSubmitOTP)();
                        }
                      },
                    })}
                    className="otp-input"
                    disabled={loading || resending}
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
                        color: "var(--critical)",
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
                      borderRadius: "var(--r-xs)",
                      background: "var(--coral-050)",
                      border: "1px solid var(--coral-100)",
                    }}
                  >
                    <AlertCircle
                      size={14}
                      style={{ color: "var(--critical-ink)", flexShrink: 0 }}
                    />
                    <p style={{ fontSize: 13, color: "var(--critical-ink)", margin: 0 }}>
                      {error}
                    </p>
                  </div>
                )}
                {resendMsg && (
                  <p
                    style={{
                      fontSize: 12,
                      color: "var(--success-ink)",
                      textAlign: "center",
                      margin: 0,
                    }}
                  >
                    {resendMsg}
                  </p>
                )}

                <button type="submit" disabled={loading || resending} aria-busy={loading} className="submit-btn">
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
                    color: "var(--text-muted)",
                    textAlign: "center",
                    margin: 0,
                  }}
                >
                  Didn't receive it?{" "}
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resending || loading}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--success-ink)",
                      fontWeight: 700,
                      fontSize: 13,
                      textDecoration: "underline",
                      fontFamily: "var(--font-sans)",
                      padding: 0,
                    }}
                  >
                    {resending ? "Sending…" : "Resend"}
                  </button>
                </p>

                <p
                  style={{
                    fontSize: 11.5,
                    color: "var(--text-disabled)",
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
            color: "var(--text-disabled)",
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
