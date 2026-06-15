"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { visitApi, pharmacyStatsApi } from "@/lib/api";
import {
  Package,
  Pill,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  ArrowRight,
  RefreshCw,
  Building2,
  TrendingDown,
  ClipboardList,
  History,
  BarChart3,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function timeSince(dateStr: string) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function PharmacyOverviewPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [pending, setPending] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const [pendingRes, statsRes] = await Promise.allSettled([
        (visitApi as any).getPendingPrescriptions(),
        pharmacyStatsApi.getOverview(),
      ]);

      if (pendingRes.status === "fulfilled") {
        const rows = pendingRes.value.data.data?.prescriptions ?? [];
        setPending(rows);
      }
      if (statsRes.status === "fulfilled") {
        setStats(statsRes.value.data.data);
      }
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(() => load(true), 60_000);
    return () => clearInterval(iv);
  }, [load]);

  const longWaiting = pending.filter(
    (p) =>
      Date.now() - new Date(p.prescribedAt ?? p.prescribed_at).getTime() >
      30 * 60 * 1000,
  ).length;

  const totalPending = pending.length;
  const dispensedToday = stats?.dispensedToday ?? 0;
  const avgWaitMins = stats?.avgWaitMinutes ?? 0;

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif" }}>
      {/* Hero */}
      <div
        className="relative rounded-3xl overflow-hidden mb-6 px-7 py-6"
        style={{
          background:
            "linear-gradient(130deg,#052e16 0%,#166534 55%,#15803d 100%)",
        }}
      >
        <div
          className="absolute -right-8 -top-8 w-40 h-40 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle,#bbf7d0,transparent)" }}
        />
        <div
          className="absolute right-20 bottom-0 w-28 h-28 rounded-full opacity-5"
          style={{ background: "radial-gradient(circle,#dcfce7,transparent)" }}
        />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-green-300/70 text-sm font-medium mb-0.5">
              {getGreeting()},
            </p>
            <h1
              className="text-white text-2xl font-bold leading-tight"
              style={{ fontFamily: "'Playfair Display',serif" }}
            >
              {user?.firstName} {user?.lastName}
            </h1>
            {user?.institutionName ? (
              <p
                className="flex items-center gap-1.5 text-sm mt-1"
                style={{ color: "rgba(187,247,208,0.65)" }}
              >
                <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                {user.institutionName}
              </p>
            ) : (
              <p className="flex items-center gap-1.5 text-sm mt-1 text-red-300/70">
                <Building2 className="w-3.5 h-3.5" /> No institution assigned
              </p>
            )}
            <p className="text-green-200/50 text-sm mt-1.5">
              {loading
                ? "Loading…"
                : totalPending > 0
                  ? `${totalPending} prescription${totalPending !== 1 ? "s" : ""} waiting${longWaiting > 0 ? ` · ${longWaiting} over 30min` : ""}`
                  : "All prescriptions dispensed"}
            </p>
          </div>
          <div className="flex gap-2.5">
            <button
              onClick={() => router.push("/dashboard/pharmacy/queue")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105"
              style={{
                background: "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.2)",
              }}
            >
              <Pill className="w-4 h-4" /> Dispense Queue
            </button>
            <button
              onClick={() => router.push("/dashboard/pharmacy/inventory")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: "rgba(0,0,0,0.2)",
                color: "#bbf7d0",
                border: "1px solid rgba(0,0,0,0.1)",
              }}
            >
              <Package className="w-4 h-4" /> Inventory
            </button>
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="p-2.5 rounded-xl transition-all disabled:opacity-40"
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-green-300 ${refreshing ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Long wait alert */}
      {!loading && longWaiting > 0 && (
        <div className="flex items-center gap-3 p-3.5 rounded-2xl mb-5 bg-amber-50 border border-amber-200">
          <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <p className="text-sm font-semibold text-amber-800">
            {longWaiting} prescription{longWaiting > 1 ? "s have" : " has"} been
            waiting over 30 minutes
          </p>
          <button
            onClick={() => router.push("/dashboard/pharmacy/queue")}
            className="ml-auto text-xs font-bold text-amber-700 flex items-center gap-1 hover:underline whitespace-nowrap"
          >
            Dispense now <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          {
            label: "Pending Rx",
            value: loading ? null : totalPending,
            color: "#d97706",
            bg: "linear-gradient(135deg,#fffbeb,#fef3c7)",
            border: "#fde68a",
            icon: Pill,
          },
          {
            label: "Dispensed Today",
            value: loading ? null : dispensedToday,
            color: "#166534",
            bg: "linear-gradient(135deg,#f0fdf4,#dcfce7)",
            border: "#bbf7d0",
            icon: CheckCircle2,
          },
          {
            label: "Avg Wait",
            value: loading ? null : avgWaitMins > 0 ? `${avgWaitMins}m` : "—",
            color: "#1d4ed8",
            bg: "linear-gradient(135deg,#eff6ff,#dbeafe)",
            border: "#bfdbfe",
            icon: Clock,
          },
          {
            label: "Long Waiting",
            value: loading ? null : longWaiting,
            color: "#dc2626",
            bg: "linear-gradient(135deg,#fef2f2,#fee2e2)",
            border: "#fecaca",
            icon: AlertCircle,
          },
        ].map(({ label, value, color, bg, border, icon: Icon }) => (
          <div
            key={label}
            className="relative rounded-2xl border overflow-hidden p-4"
            style={{ background: bg, borderColor: border }}
          >
            <div
              className="absolute -right-2 -bottom-2 w-14 h-14 rounded-full opacity-10"
              style={{ background: color }}
            />
            <div className="flex items-start justify-between mb-3">
              <p
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color, opacity: 0.7 }}
              >
                {label}
              </p>
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: `${color}18` }}
              >
                <Icon className="w-3.5 h-3.5" style={{ color }} />
              </div>
            </div>
            <p
              className="text-3xl font-extrabold leading-none"
              style={{ color }}
            >
              {value === null ? (
                <span
                  className="inline-block w-7 h-7 rounded-lg animate-pulse"
                  style={{ background: `${color}20` }}
                />
              ) : (
                value
              )}
            </p>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pending prescriptions list */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
              Pending Prescriptions
            </p>
            {totalPending > 0 && (
              <button
                onClick={() => router.push("/dashboard/pharmacy/queue")}
                className="text-xs font-semibold flex items-center gap-1"
                style={{ color: "#166534" }}
              >
                View all <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {loading ? (
              <div className="divide-y divide-gray-50">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 px-5 py-4 animate-pulse"
                  >
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-36 bg-gray-100 rounded" />
                      <div className="h-3 w-52 bg-gray-100 rounded" />
                    </div>
                    <div className="w-16 h-6 bg-gray-100 rounded-full" />
                  </div>
                ))}
              </div>
            ) : pending.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                </div>
                <p className="text-sm font-semibold text-gray-500">All clear</p>
                <p className="text-xs text-gray-400 mt-1">
                  No pending prescriptions
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {pending.slice(0, 6).map((rx: any) => {
                  const prescribedAt = rx.prescribedAt ?? rx.prescribed_at;
                  const waited = Date.now() - new Date(prescribedAt).getTime();
                  const isOld = waited > 30 * 60 * 1000;
                  const rxNum = rx.prescriptionNumber ?? rx.prescription_number;
                  const visitNum = rx.visitNumber ?? rx.visit_number;
                  const patientName =
                    rx.patientName ?? rx.patient_name ?? "Unknown Patient";
                  const pendingItems = rx.pendingItems ?? rx.pending_items ?? 0;
                  const totalItems = rx.totalItems ?? rx.total_items ?? 0;

                  return (
                    <button
                      key={rx.id}
                      onClick={() =>
                        router.push(`/dashboard/pharmacy/queue/${rx.id}`)
                      }
                      className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left group border-l-4"
                      style={{ borderLeftColor: isOld ? "#f59e0b" : "#16a34a" }}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: isOld ? "#fffbeb" : "#f0fdf4" }}
                      >
                        <Pill
                          className="w-4 h-4"
                          style={{ color: isOld ? "#d97706" : "#16a34a" }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-gray-900">
                            {patientName}
                          </p>
                          <span className="text-xs font-mono text-gray-400">
                            {rxNum}
                          </span>
                          {isOld && (
                            <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                              Waiting long
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {visitNum} · {pendingItems} of {totalItems} item
                          {totalItems !== 1 ? "s" : ""} pending
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />{" "}
                          {timeSince(prescribedAt)}
                        </span>
                        <ChevronRight className="w-4 h-4 text-gray-200 group-hover:text-green-600 transition-colors" />
                      </div>
                    </button>
                  );
                })}
                {pending.length > 6 && (
                  <button
                    onClick={() => router.push("/dashboard/pharmacy/queue")}
                    className="w-full py-3 text-xs font-semibold text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5"
                  >
                    +{pending.length - 6} more{" "}
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Institution */}
          <div
            className="rounded-2xl border p-4"
            style={{
              background: "linear-gradient(135deg,#f0fdf4,#dcfce7)",
              borderColor: "#86efac",
            }}
          >
            <div className="flex items-center gap-2.5 mb-2">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(22,101,52,0.12)" }}
              >
                <Building2 className="w-4 h-4" style={{ color: "#166534" }} />
              </div>
              <p
                className="text-xs font-bold uppercase tracking-wide"
                style={{ color: "#166534" }}
              >
                Institution
              </p>
            </div>
            <p className="text-sm font-bold text-gray-900">
              {user?.institutionName ?? "—"}
            </p>
          </div>

          {/* Quick actions */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
              Quick Actions
            </p>
            <div className="space-y-2">
              {[
                {
                  label: "Dispense Queue",
                  desc: "Pending prescriptions",
                  href: "/dashboard/pharmacy/queue",
                  icon: Pill,
                  color: "#166534",
                  bg: "linear-gradient(135deg,#f0fdf4,#dcfce7)",
                  border: "#bbf7d0",
                },
                {
                  label: "Dispense History",
                  desc: "Previously dispensed Rx",
                  href: "/dashboard/pharmacy/dispensed",
                  icon: History,
                  color: "#1d4ed8",
                  bg: "linear-gradient(135deg,#eff6ff,#dbeafe)",
                  border: "#bfdbfe",
                },
                {
                  label: "Inventory",
                  desc: "Stock levels & medications",
                  href: "/dashboard/pharmacy/inventory",
                  icon: Package,
                  color: "#7c3aed",
                  bg: "linear-gradient(135deg,#faf5ff,#ede9fe)",
                  border: "#ddd6fe",
                },
              ].map(({ label, desc, href, icon: Icon, color, bg, border }) => (
                <button
                  key={href}
                  onClick={() => router.push(href)}
                  className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl border text-left transition-all hover:shadow-md hover:-translate-y-px group"
                  style={{ background: bg, borderColor: border }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${color}15` }}
                  >
                    <Icon className="w-4 h-4" style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">
                      {label}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                  </div>
                  <ArrowRight
                    className="w-4 h-4 flex-shrink-0 transition-transform group-hover:translate-x-0.5"
                    style={{ color }}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
