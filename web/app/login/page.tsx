"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { Eye, EyeOff, AlertCircle } from "lucide-react";

const schema = z.object({
  licenseNumber: z.string().min(1, "License number is required"),
  password: z.string().min(1, "Password is required"),
});
type FormData = z.infer<typeof schema>;

const ROLE_ROUTES: Record<string, string> = {
  practitioner: "/dashboard/doctor",
  nurse: "/dashboard/nurse",
  lab_technician: "/dashboard/laboratory",
  radiologist: "/dashboard/radiology",
  pharmacist: "/dashboard/pharmacy",
  admin: "/dashboard/admin",
  receptionist: "/dashboard/receptionist",
};

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setError("");
    try {
      // Try practitioner first, then nurse
      let res;
      try {
        res = await authApi.loginStaff({
          licenseNumber: data.licenseNumber,
          password: data.password,
        });
      } catch {
        res = await authApi.loginNurse({
          licenseNumber: data.licenseNumber,
          password: data.password,
        });
      }
      const { token, user } = res.data.data;
      setAuth(user, token);
      router.push(ROLE_ROUTES[user.type] ?? "/dashboard");
    } catch (err: any) {
      const msg = err.response?.data?.error?.message;
      if (msg === "Account pending verification by administrator") {
        setError(
          "Your account is pending verification. Please contact your administrator.",
        );
      } else if (msg === "Invalid credentials") {
        setError("Incorrect license number or password.");
      } else {
        setError(msg || "Sign in failed. Please check your credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="hc-root" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600;700&display=swap');

        .hc-root {
          min-height: 100vh;
          display: flex;
          background: #f7f8f5;
          overflow: hidden;
          position: relative;
        }

        /* ── Decorative left panel ── */
        .hc-panel {
          width: 52%;
          position: relative;
          background: linear-gradient(160deg, #0a3d1f 0%, #166534 45%, #15803d 100%);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 52px 56px;
          overflow: hidden;
        }
        @media (max-width: 900px) { .hc-panel { display: none; } }

        /* Subtle dot-grid overlay */
        .hc-panel::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image: radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px);
          background-size: 28px 28px;
          pointer-events: none;
        }

        /* Large decorative ring */
        .hc-ring {
          position: absolute;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.08);
        }
        .hc-ring-1 { width: 520px; height: 520px; right: -160px; top: -100px; }
        .hc-ring-2 { width: 380px; height: 380px; right: -80px; bottom: 40px; border-color: rgba(255,255,255,0.05); }
        .hc-ring-3 { width: 220px; height: 220px; left: 60px; bottom: -60px; }

        /* Glowing orb */
        .hc-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
        }
        .hc-orb-1 { width: 340px; height: 340px; background: rgba(34,197,94,0.18); top: -80px; right: -80px; }
        .hc-orb-2 { width: 240px; height: 240px; background: rgba(20,83,45,0.5); bottom: 0; left: -40px; }

        /* Stat cards on panel */
        .hc-stat {
          display: flex;
          align-items: center;
          gap: 14px;
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 16px;
          padding: 16px 20px;
          backdrop-filter: blur(8px);
        }
        .hc-stat-icon {
          width: 40px; height: 40px;
          border-radius: 10px;
          background: rgba(255,255,255,0.12);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }

        /* ── Right form side ── */
        .hc-form-side {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px 32px;
        }
        .hc-form-wrap {
          width: 100%;
          max-width: 400px;
        }

        /* Input */
        .hc-input {
          width: 100%;
          padding: 13px 16px;
          border-radius: 12px;
          border: 1.5px solid #e2e8e0;
          background: #fff;
          font-size: 14px;
          color: #111;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
          font-family: 'DM Sans', sans-serif;
          box-sizing: border-box;
        }
        .hc-input::placeholder { color: #aab8ad; }
        .hc-input:focus {
          border-color: #166534;
          box-shadow: 0 0 0 3px rgba(22,101,52,0.1);
        }
        .hc-input-wrap { position: relative; }
        .hc-eye {
          position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer; color: #9aada3;
          display: flex; align-items: center; padding: 0;
        }
        .hc-eye:hover { color: #5a7a6a; }

        /* Submit button */
        .hc-btn {
          width: 100%;
          padding: 14px;
          border-radius: 12px;
          border: none;
          background: linear-gradient(135deg, #166534, #15803d);
          color: #fff;
          font-size: 14.5px;
          font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: opacity 0.15s, transform 0.1s, box-shadow 0.15s;
          box-shadow: 0 4px 16px rgba(22,101,52,0.25);
          letter-spacing: 0.01em;
        }
        .hc-btn:hover:not(:disabled) {
          opacity: 0.92;
          transform: translateY(-1px);
          box-shadow: 0 6px 24px rgba(22,101,52,0.3);
        }
        .hc-btn:active:not(:disabled) { transform: translateY(0); }
        .hc-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        /* Error banner */
        .hc-error {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 12px 14px;
          background: #fff5f5;
          border: 1px solid #fecaca;
          border-radius: 12px;
          color: #b91c1c;
          font-size: 13.5px;
        }

        /* Field error */
        .hc-field-err {
          display: flex; align-items: center; gap: 5px;
          font-size: 12px; color: #dc2626; margin-top: 4px;
        }

        /* Divider line */
        .hc-divider {
          display: flex; align-items: center; gap: 12px;
          color: #c5d0c8; font-size: 12px; margin: 8px 0;
        }
        .hc-divider::before, .hc-divider::after {
          content: ''; flex: 1; height: 1px; background: #e8ede9;
        }

        /* Spinner */
        @keyframes hc-spin { to { transform: rotate(360deg); } }
        .hc-spinner {
          width: 18px; height: 18px;
          border: 2.5px solid rgba(255,255,255,0.35);
          border-top-color: #fff;
          border-radius: 50%;
          animation: hc-spin 0.7s linear infinite;
        }

        /* Blockchain badge */
        .hc-badge {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 5px 12px;
          background: rgba(22,101,52,0.07);
          border: 1px solid rgba(22,101,52,0.15);
          border-radius: 999px;
          font-size: 11.5px;
          color: #166534;
          font-weight: 500;
        }
        .hc-badge-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 0 2px rgba(34,197,94,0.3);
          animation: hc-pulse 2s ease-in-out infinite;
        }
        @keyframes hc-pulse {
          0%, 100% { box-shadow: 0 0 0 2px rgba(34,197,94,0.3); }
          50%       { box-shadow: 0 0 0 5px rgba(34,197,94,0.1); }
        }

        /* Role pill */
        .hc-role {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 3px 10px;
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 999px;
          font-size: 11px; color: rgba(255,255,255,0.7);
          margin-bottom: 4px;
          text-transform: uppercase; letter-spacing: 0.06em;
        }
      `}</style>

      {/* ── Left decorative panel ── */}
      <div className="hc-panel">
        <div className="hc-ring hc-ring-1" />
        <div className="hc-ring hc-ring-2" />
        <div className="hc-ring hc-ring-3" />
        <div className="hc-orb hc-orb-1" />
        <div className="hc-orb hc-orb-2" />

        {/* Brand */}
        <div style={{ position: "relative", zIndex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 40,
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* Simple cross/health icon */}
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect
                  x="7"
                  y="2"
                  width="4"
                  height="14"
                  rx="1.5"
                  fill="white"
                  opacity="0.9"
                />
                <rect
                  x="2"
                  y="7"
                  width="14"
                  height="4"
                  rx="1.5"
                  fill="white"
                  opacity="0.9"
                />
              </svg>
            </div>
            <span
              style={{
                color: "rgba(255,255,255,0.9)",
                fontWeight: 700,
                fontSize: 15,
                letterSpacing: "0.01em",
              }}
            >
              MedLink
            </span>
          </div>

          <h1
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 42,
              fontWeight: 700,
              color: "#fff",
              lineHeight: 1.15,
              marginBottom: 16,
            }}
          >
            Zambia's
            <br />
            <span style={{ color: "rgba(255,255,255,0.55)" }}>
              Digital Health
            </span>
            <br />
            Healthcare
          </h1>
          <p
            style={{
              color: "rgba(255,255,255,0.5)",
              fontSize: 14,
              lineHeight: 1.6,
              maxWidth: 280,
            }}
          >
            Patient-consented, secure, and real-time access to medical records
            for better care coordination and outcomes.
          </p>
        </div>

        {/* Stats row */}
        <div style={{ position: "relative", zIndex: 1 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              marginBottom: 40,
            }}
          >
            {[
              {
                icon: "🔗",
                label: "MedLink secured",
                value: "Every record",
              },
              {
                icon: "📱",
                label: "Patient-controlled",
                value: "Consent via mobile",
              },
              {
                icon: "⚡",
                label: "Real-time access",
                value: "Instant approval",
              },
            ].map((s) => (
              <div key={s.label} className="hc-stat">
                <div className="hc-stat-icon">
                  <span style={{ fontSize: 17 }}>{s.icon}</span>
                </div>
                <div>
                  <p
                    style={{
                      color: "rgba(255,255,255,0.45)",
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                      marginBottom: 1,
                    }}
                  >
                    {s.label}
                  </p>
                  <p style={{ color: "#fff", fontSize: 13.5, fontWeight: 600 }}>
                    {s.value}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Fabric badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#4ade80",
                boxShadow: "0 0 0 3px rgba(74,222,128,0.2)",
              }}
            />
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
              Protected by MedLink Security
            </span>
          </div>
        </div>
      </div>

      {/* ── Right form side ── */}
      <div className="hc-form-side">
        <div className="hc-form-wrap">
          {/* Header */}
          <div style={{ marginBottom: 32 }}>
            {/* Mobile-only logo */}
            <div
              style={{
                display: "none",
                alignItems: "center",
                gap: 8,
                marginBottom: 24,
              }}
              className="hc-mobile-logo"
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "#166534",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="15" height="15" viewBox="0 0 18 18" fill="none">
                  <rect
                    x="7"
                    y="2"
                    width="4"
                    height="14"
                    rx="1.5"
                    fill="white"
                  />
                  <rect
                    x="2"
                    y="7"
                    width="14"
                    height="4"
                    rx="1.5"
                    fill="white"
                  />
                </svg>
              </div>
              <span style={{ fontWeight: 700, color: "#166534", fontSize: 15 }}>
                MedLink
              </span>
            </div>

            <h2
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 28,
                fontWeight: 600,
                color: "#111",
                marginBottom: 6,
              }}
            >
              Staff Sign In
            </h2>
            <p style={{ color: "#8a9e90", fontSize: 14 }}>
              Access the clinical portal with your credentials
            </p>
          </div>

          <form
            onSubmit={handleSubmit(onSubmit)}
            style={{ display: "flex", flexDirection: "column", gap: 18 }}
          >
            {/* License Number */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#3a4f42",
                  marginBottom: 7,
                }}
              >
                License / Staff Number
              </label>
              <input
                {...register("licenseNumber")}
                placeholder="e.g. LIC-DR-001"
                className="hc-input"
              />
              {errors.licenseNumber && (
                <p className="hc-field-err">
                  <AlertCircle size={12} /> {errors.licenseNumber.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#3a4f42",
                  marginBottom: 7,
                }}
              >
                Password
              </label>
              <div className="hc-input-wrap">
                <input
                  {...register("password")}
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  className="hc-input"
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  className="hc-eye"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="hc-field-err">
                  <AlertCircle size={12} /> {errors.password.message}
                </p>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="hc-error">
                <AlertCircle
                  size={15}
                  style={{ flexShrink: 0, marginTop: 1 }}
                />
                <span>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="hc-btn"
              style={{ marginTop: 4 }}
            >
              {loading ? (
                <div className="hc-spinner" />
              ) : (
                <>
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Sign in to Portal
                </>
              )}
            </button>
          </form>

          {/* Bottom badge */}
          <div
            style={{ display: "flex", justifyContent: "center", marginTop: 28 }}
          >
            <div className="hc-badge">
              <div className="hc-badge-dot" />
              Protected by MedLink Security
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
