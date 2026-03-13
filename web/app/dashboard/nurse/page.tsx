"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { visitApi } from "@/lib/api";
import {
  Activity,
  ClipboardList,
  ChevronRight,
  AlertTriangle,
  Users,
  ArrowRight,
  Zap,
  Clock,
  TrendingUp,
} from "lucide-react";

interface QueueVisit {
  id: string;
  visitNumber: string;
  chiefComplaint: string;
  priority: string;
  status: string;
  admissionDate: string;
  patient: {
    firstName: string;
    lastName: string;
    gender: string;
    bloodType: string;
  } | null;
}

const PC: Record<
  string,
  {
    color: string;
    bg: string;
    border: string;
    dot: string;
    label: string;
    ring: string;
  }
> = {
  critical: {
    color: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca",
    dot: "#ef4444",
    label: "Critical",
    ring: "rgba(220,38,38,0.06)",
  },
  emergency: {
    color: "#ea580c",
    bg: "#fff7ed",
    border: "#fed7aa",
    dot: "#f97316",
    label: "Emergency",
    ring: "rgba(234,88,12,0.06)",
  },
  urgent: {
    color: "#d97706",
    bg: "#fffbeb",
    border: "#fde68a",
    dot: "#f59e0b",
    label: "Urgent",
    ring: "rgba(217,119,6,0.06)",
  },
  routine: {
    color: "#16a34a",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    dot: "#22c55e",
    label: "Routine",
    ring: "rgba(22,163,74,0.05)",
  },
};
const getP = (p: string) => PC[p] ?? PC.routine;

function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function timeSince(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function NurseOverview() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [queue, setQueue] = useState<QueueVisit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    visitApi
      .getTodayQueue()
      .then((res) => setQueue(res.data.data.visits ?? []))
      .catch(() => setQueue([]))
      .finally(() => setLoading(false));
  }, []);

  const critical = queue.filter((v) =>
    ["critical", "emergency"].includes(v.priority),
  );
  const urgent = queue.filter((v) => v.priority === "urgent");
  const routine = queue.filter((v) => v.priority === "routine");
  const alertPts = queue.filter((v) =>
    ["critical", "emergency", "urgent"].includes(v.priority),
  );

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Hero banner */}
      <div
        className="relative rounded-3xl overflow-hidden mb-6 px-7 py-6"
        style={{
          background:
            "linear-gradient(130deg, #0d4a1f 0%, #166534 55%, #15803d 100%)",
        }}
      >
        <div
          className="absolute -right-8 -top-8 w-40 h-40 rounded-full opacity-10"
          style={{
            background: "radial-gradient(circle, #bbf7d0, transparent)",
          }}
        />
        <div
          className="absolute right-20 bottom-0 w-28 h-28 rounded-full opacity-5"
          style={{
            background: "radial-gradient(circle, #dcfce7, transparent)",
          }}
        />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-green-300/70 text-sm font-medium mb-1">
              {getGreeting()},
            </p>
            <h1
              className="text-white text-2xl font-bold leading-tight"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {user?.firstName} {user?.lastName}
            </h1>
            <p className="text-green-200/50 text-sm mt-1.5">
              {queue.length > 0
                ? `${queue.length} patient${queue.length !== 1 ? "s" : ""} in queue today${critical.length > 0 ? ` · ${critical.length} need immediate attention` : ""}`
                : "Queue is clear — great work!"}
            </p>
          </div>
          <div className="flex gap-2.5">
            <button
              onClick={() => router.push("/dashboard/nurse/triage")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105"
              style={{
                background: "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.2)",
              }}
            >
              <Activity className="w-4 h-4" /> Start Triage
            </button>
            <button
              onClick={() => router.push("/dashboard/nurse/queue")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: "rgba(0,0,0,0.2)",
                color: "#bbf7d0",
                border: "1px solid rgba(0,0,0,0.1)",
              }}
            >
              <ClipboardList className="w-4 h-4" /> View Queue
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          {
            label: "Total in Queue",
            value: queue.length,
            color: "#166534",
            bg: "linear-gradient(135deg,#f0fdf4,#dcfce7)",
            border: "#bbf7d0",
            icon: Users,
          },
          {
            label: "Critical/Emergency",
            value: critical.length,
            color: "#dc2626",
            bg: "linear-gradient(135deg,#fef2f2,#fee2e2)",
            border: "#fecaca",
            icon: AlertTriangle,
          },
          {
            label: "Urgent",
            value: urgent.length,
            color: "#d97706",
            bg: "linear-gradient(135deg,#fffbeb,#fef3c7)",
            border: "#fde68a",
            icon: Zap,
          },
          {
            label: "Routine",
            value: routine.length,
            color: "#1d4ed8",
            bg: "linear-gradient(135deg,#eff6ff,#dbeafe)",
            border: "#bfdbfe",
            icon: ClipboardList,
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
              {loading ? (
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

      {/* Bottom: quick actions + priority list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Quick actions */}
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">
            Quick Actions
          </p>
          {[
            {
              label: "Triage a Patient",
              desc: "Enter visit number to record vitals",
              href: "/dashboard/nurse/triage",
              icon: Activity,
              color: "#166534",
              bg: "linear-gradient(135deg,#f0fdf4,#dcfce7)",
              border: "#bbf7d0",
            },
            {
              label: "View Full Queue",
              desc: "All visits sorted by priority",
              href: "/dashboard/nurse/queue",
              icon: ClipboardList,
              color: "#1d4ed8",
              bg: "linear-gradient(135deg,#eff6ff,#dbeafe)",
              border: "#bfdbfe",
            },
            {
              label: "My Patients",
              desc: "Recently triaged patients",
              href: "/dashboard/nurse/patients",
              icon: Users,
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
                <p className="text-sm font-semibold text-gray-900">{label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
              </div>
              <ArrowRight
                className="w-4 h-4 flex-shrink-0 transition-transform group-hover:translate-x-0.5"
                style={{ color }}
              />
            </button>
          ))}
        </div>

        {/* Priority alerts — 2 cols */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
              {alertPts.length > 0 ? "⚠️  Needs Attention" : "Priority Queue"}
            </p>
            {alertPts.length > 0 && (
              <button
                onClick={() => router.push("/dashboard/nurse/queue")}
                className="text-xs font-semibold flex items-center gap-1 transition-colors"
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
                    className="flex items-center gap-3 px-5 py-4 animate-pulse"
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-gray-100 flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-32 bg-gray-100 rounded" />
                      <div className="h-3 w-48 bg-gray-100 rounded" />
                    </div>
                    <div className="w-16 h-6 bg-gray-100 rounded-full" />
                  </div>
                ))}
              </div>
            ) : alertPts.length === 0 && queue.length === 0 ? (
              <div className="py-16 text-center">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
                  style={{ background: "#f0fdf4" }}
                >
                  <TrendingUp className="w-5 h-5 text-green-400" />
                </div>
                <p className="text-sm font-semibold text-gray-500">
                  No patients yet today
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  New visits will appear here
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {(alertPts.length > 0 ? alertPts : queue)
                  .slice(0, 6)
                  .map((v, i) => {
                    const p = getP(v.priority);
                    const isTop =
                      i === 0 && ["critical", "emergency"].includes(v.priority);
                    return (
                      <button
                        key={v.id}
                        onClick={() =>
                          router.push(
                            `/dashboard/nurse/triage?visitNumber=${v.visitNumber}`,
                          )
                        }
                        className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors group"
                        style={{ background: isTop ? p.ring : undefined }}
                        onMouseEnter={(e) => {
                          if (!isTop)
                            e.currentTarget.style.background = "#f9fafb";
                        }}
                        onMouseLeave={(e) => {
                          if (!isTop)
                            e.currentTarget.style.background = "transparent";
                        }}
                      >
                        <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                          {isTop && (
                            <span
                              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-50"
                              style={{ background: p.dot }}
                            />
                          )}
                          <span
                            className="relative inline-flex rounded-full h-2.5 w-2.5"
                            style={{ background: p.dot }}
                          />
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">
                            {v.patient
                              ? `${v.patient.firstName} ${v.patient.lastName}`
                              : "Unknown Patient"}
                          </p>
                          <p className="text-xs text-gray-400 truncate mt-0.5">
                            {v.chiefComplaint}
                          </p>
                        </div>
                        <div className="flex items-center gap-2.5 flex-shrink-0">
                          <span className="hidden sm:inline-flex items-center gap-1 text-xs text-gray-400">
                            <Clock className="w-3 h-3" />{" "}
                            {timeSince(v.admissionDate)}
                          </span>
                          <span
                            className="text-xs font-semibold px-2.5 py-1 rounded-full"
                            style={{
                              background: p.bg,
                              color: p.color,
                              border: `1px solid ${p.border}`,
                            }}
                          >
                            {p.label}
                          </span>
                          <ChevronRight className="w-4 h-4 text-gray-200 group-hover:text-gray-400 transition-colors" />
                        </div>
                      </button>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
