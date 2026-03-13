"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import {
  Eye,
  EyeOff,
  Activity,
  Lock,
  ChevronRight,
  AlertCircle,
  Shield,
} from "lucide-react";

const schema = z.object({
  identifier: z.string().min(1, "This field is required"),
  password: z.string().min(1, "Password is required"),
  role: z.enum(["staff", "patient"]),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: "staff" },
  });

  const role = watch("role");

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setError("");
    try {
      let res;
      if (data.role === "patient") {
        res = await authApi.loginPatient({
          nationalId: data.identifier,
          password: data.password,
        });
      } else {
        // Try practitioner first, fall back to nurse
        try {
          res = await authApi.loginStaff({
            licenseNumber: data.identifier,
            password: data.password,
          });
        } catch {
          res = await authApi.loginNurse({
            licenseNumber: data.identifier,
            password: data.password,
          });
        }
      }

      const { token, user } = res.data.data;
      setAuth(user, token);

      switch (user.type) {
        case "practitioner":
          router.push("/dashboard/doctor");
          break;
        case "nurse":
          router.push("/dashboard/nurse");
          break;
        case "admin":
          router.push("/dashboard/admin");
          break;
        case "receptionist":
          router.push("/dashboard/receptionist");
          break;
        default:
          router.push("/login");
          break;
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message;
      if (msg === "Account pending verification by administrator") {
        setError(
          "Your account is pending verification. Please contact your administrator.",
        );
      } else if (msg === "Invalid credentials") {
        setError("Incorrect ID or password. Please try again.");
      } else {
        setError(msg || "Login failed. Please check your credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* ── Right: Login Form ── */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-[420px]">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2 mb-8 justify-center">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "#166534" }}
            >
              <Activity className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-800">HealthChain Zambia</span>
          </div>

          <div className="mb-7 justify-center">
            <h2 className="text-2xl font-bold  text-gray-900">Welcome</h2>
            <p className="text-gray-500 mt-1 text-sm">
              Sign in to access the healthcare portal
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Staff / Patient toggle */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700">
                Sign in as
              </label>
              <div className="flex rounded-xl overflow-hidden border border-gray-200 bg-white">
                {(["staff"] as const).map((type) => (
                  <label
                    key={type}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 cursor-pointer text-sm font-medium transition-all"
                    style={
                      role === type
                        ? { background: "#166534", color: "#fff" }
                        : { color: "#6b7280" }
                    }
                  >
                    <input
                      type="radio"
                      value={type}
                      {...register("role")}
                      className="sr-only"
                    />
                    {type === "staff" ? "Hospital Staff" : "Patient"}
                  </label>
                ))}
              </div>
            </div>

            {/* Identifier */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700">
                {role === "patient" ? "National ID" : "Staff License Number"}
              </label>
              <input
                {...register("identifier")}
                placeholder={
                  role === "patient" ? "e.g. 123456/78/9" : "e.g. LIC-DR-001"
                }
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 text-sm outline-none transition-all focus:border-green-600 focus:ring-2 focus:ring-green-600/10 placeholder:text-gray-400"
              />
              {errors.identifier && (
                <p className="flex items-center gap-1.5 text-xs text-red-600">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.identifier.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700">
                Password
              </label>
              <div className="relative">
                <input
                  {...register("password")}
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-200 bg-white text-gray-900 text-sm outline-none transition-all focus:border-green-600 focus:ring-2 focus:ring-green-600/10 placeholder:text-gray-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="flex items-center gap-1.5 text-xs text-red-600">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-100">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-60"
              style={{
                background: "linear-gradient(135deg, #166534, #15803d)",
              }}
            >
              {loading ? (
                <svg
                  className="animate-spin w-5 h-5"
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
                <>
                  <Lock className="w-4 h-4" />
                  Sign In Securely
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Security badge */}
          <div className="flex items-center justify-center gap-2 mt-6">
            <Shield className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-400">
              Protected by Hyperledger Fabric blockchain
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
