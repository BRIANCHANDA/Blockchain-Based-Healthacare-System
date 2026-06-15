"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import {
  LayoutDashboard,
  ClipboardList,
  Search,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Stethoscope,
  Shield,
  Building2,
  ArrowLeftRight,
  QrCode,
} from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { ProfileDrawer } from "@/components/ProfileDrawer";

const navItems = [
  {
    label: "Overview",
    href: "/dashboard/doctor",
    icon: LayoutDashboard,
    badge: false,
  },

  // doctor layout
  { label: "Scan Patient", href: "/dashboard/doctor/scan", icon: QrCode },
  {
    label: "Today's Queue",
    href: "/dashboard/doctor/queue",
    icon: ClipboardList,
    badge: false,
  },
  {
    label: "Referrals",
    href: "/dashboard/doctor/referrals",
    icon: ArrowLeftRight,
    badge: true,
  },
  {
    label: "Permissions",
    href: "/dashboard/doctor/permissions",
    icon: Shield,
    badge: false,
  },
  {
    label: "Patients",
    href: "/dashboard/doctor/patients",
    icon: Search,
    badge: false,
  },
];

export default function DoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, clearAuth, initFromStorage } = useAuthStore();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [time, setTime] = useState(new Date());
  const [pendingReferrals, setPendingReferrals] = useState(0);
  const [incomingReferrals, setIncomingReferrals] = useState(0);

  useEffect(() => {
    initFromStorage();
  }, []);
  useEffect(() => {
    if (!isAuthenticated) router.push("/login");
  }, [isAuthenticated]);
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const fetchReferralCounts = useCallback(async () => {
    try {
      const userId = (user as any)?.id;
      const [outRes, inRes] = await Promise.all([
        api.get("/api/referrals/outgoing?status=pending&limit=50"),
        userId
          ? api.get(
              `/api/appointments?status=scheduled&doctorId=${userId}&limit=100`,
            )
          : Promise.resolve({ data: { data: { appointments: [] } } }),
      ]);
      setPendingReferrals(outRes.data?.data?.referrals?.length ?? 0);
      const appts: any[] = inRes.data?.data?.appointments ?? [];
      setIncomingReferrals(
        appts.filter(
          (a: any) => a.visitNumber?.startsWith("APT-") && a.admittingDiagnosis,
        ).length,
      );
    } catch {}
  }, [user]);

  useEffect(() => {
    fetchReferralCounts();
    const iv = setInterval(fetchReferralCounts, 60_000);
    return () => clearInterval(iv);
  }, [fetchReferralCounts]);

  const pageLabel =
    navItems.find(
      (n) => n.href !== "/dashboard/doctor" && pathname.startsWith(n.href),
    )?.label ??
    (pathname === "/dashboard/doctor" ? "Overview" : "Doctor Portal");

  const timeStr = time.toLocaleTimeString("en-ZM", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateStr = time.toLocaleDateString("en-ZM", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  const institutionName = (user as any)?.institutionName ?? null;
  const institutionId = (user as any)?.institutionId ?? null;
  const hasInstitution = !!institutionName || !!institutionId;
  const initials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`;

  return (
    <div
      className="min-h-screen flex bg-[#f8faf8]"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-30 w-64 flex flex-col transition-transform duration-300
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        style={{
          background:
            "linear-gradient(180deg,#052e16 0%,#064e23 40%,#0d5c2a 100%)",
        }}
      >
        {/* Branding */}
        <div className="px-5 pt-6 pb-5 border-b border-white/[0.07]">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: "rgba(134,239,172,0.15)",
                border: "1px solid rgba(134,239,172,0.2)",
              }}
            >
              <Stethoscope className="w-4 h-4 text-green-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm leading-tight tracking-tight">
                MedLink
              </p>
              <p className="text-green-400/70 text-xs">Zambia · EMR</p>
            </div>
            <button
              className="lg:hidden text-white/40 hover:text-white transition-colors"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Role pill */}
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold mb-3"
            style={{
              background: "rgba(167,139,250,0.15)",
              color: "#c4b5fd",
              border: "1px solid rgba(167,139,250,0.2)",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-violet-300" />
            Practitioner
          </div>

          {/* Institution badge */}
          {hasInstitution ? (
            <div
              className="flex items-start gap-2 px-3 py-2.5 rounded-xl"
              style={{
                background: "rgba(134,239,172,0.07)",
                border: "1px solid rgba(134,239,172,0.12)",
              }}
            >
              <Building2 className="w-3.5 h-3.5 text-green-400/70 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-green-400/50 leading-none mb-1">
                  Institution
                </p>
                <p className="text-green-100 text-xs font-semibold leading-snug truncate">
                  {institutionName ?? "Unknown Hospital"}
                </p>
              </div>
            </div>
          ) : (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{
                background: "rgba(239,68,68,0.07)",
                border: "1px solid rgba(239,68,68,0.12)",
              }}
            >
              <Building2 className="w-3.5 h-3.5 text-red-400/60 flex-shrink-0" />
              <p className="text-red-300/60 text-xs font-medium">
                No institution assigned
              </p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ label, href, icon: Icon, badge }) => {
            const active =
              pathname === href ||
              (href !== "/dashboard/doctor" && pathname.startsWith(href));
            const totalReferrals = pendingReferrals + incomingReferrals;
            const showBadge = badge && totalReferrals > 0;
            return (
              <button
                key={href}
                onClick={() => {
                  router.push(href);
                  setSidebarOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all text-left group"
                style={
                  active
                    ? {
                        background: "rgba(255,255,255,0.12)",
                        color: "#ffffff",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
                      }
                    : { color: "rgba(187,247,208,0.55)" }
                }
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                    e.currentTarget.style.color = "rgba(187,247,208,0.85)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "rgba(187,247,208,0.55)";
                  }
                }}
              >
                <Icon
                  className={`w-4 h-4 flex-shrink-0 ${!active ? "group-hover:scale-110 transition-transform" : ""}`}
                />
                <span className="flex-1">{label}</span>
                {showBadge && !active && (
                  <span
                    className="flex items-center justify-center text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1"
                    style={{
                      background: incomingReferrals > 0 ? "#16a34a" : "#f59e0b",
                      color: "#fff",
                    }}
                  >
                    {totalReferrals > 9 ? "9+" : totalReferrals}
                  </span>
                )}
                {active ? (
                  <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                ) : (
                  !showBadge && (
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400/0 group-hover:bg-green-400/30 transition-all" />
                  )
                )}
              </button>
            );
          })}
        </nav>

        {/* Clock */}
        <div
          className="mx-3 mb-3 px-3.5 py-3 rounded-xl"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <p className="text-white text-lg font-bold tabular-nums leading-none">
            {timeStr}
          </p>
          <p className="text-green-400/60 text-xs mt-0.5">{dateStr}</p>
        </div>

        {/* User card — clicking opens profile drawer */}
        <div className="px-3 pb-4 border-t border-white/[0.07] pt-3">
          <button
            onClick={() => setProfileOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl mb-1 transition-colors hover:bg-white/10 text-left"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: "linear-gradient(135deg,#16a34a,#15803d)" }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">
                Dr. {user?.firstName} {user?.lastName}
              </p>
              <p className="text-green-400/50 text-xs">View profile</p>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-green-400/30" />
          </button>
          <button
            onClick={() => {
              clearAuth();
              router.push("/login");
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
            style={{ color: "rgba(187,247,208,0.4)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#f87171";
              e.currentTarget.style.background = "rgba(239,68,68,0.08)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "rgba(187,247,208,0.4)";
              e.currentTarget.style.background = "transparent";
            }}
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header
          className="sticky top-0 z-10 flex items-center gap-3 px-6"
          style={{
            background: "rgba(255,255,255,0.85)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid #f1f2f4",
            minHeight: "52px",
          }}
        >
          <button
            className="lg:hidden text-gray-400 hover:text-gray-700 p-1 -ml-1 transition-colors rounded-lg hover:bg-gray-100"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Page title */}
          <div className="hidden lg:flex items-center gap-2.5">
            <div
              className="w-1 h-4 rounded-full flex-shrink-0"
              style={{ background: "linear-gradient(180deg,#16a34a,#15803d)" }}
            />
            <div>
              <p className="text-sm font-semibold text-gray-900 leading-none">
                {pageLabel}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {time.toLocaleDateString("en-ZM", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2 ml-auto">
            {/* Institution chip */}
            {hasInstitution ? (
              <div
                className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border"
                style={{ background: "#f0fdf4", borderColor: "#bbf7d0" }}
              >
                <Building2
                  className="w-3 h-3 flex-shrink-0"
                  style={{ color: "#15803d" }}
                />
                <span
                  className="text-xs font-semibold max-w-[160px] truncate"
                  style={{ color: "#15803d" }}
                >
                  {institutionName ?? institutionId?.slice(0, 8)}
                </span>
              </div>
            ) : (
              <div
                className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border"
                style={{ background: "#fef2f2", borderColor: "#fecaca" }}
              >
                <Building2 className="w-3 h-3 text-red-400 flex-shrink-0" />
                <span className="text-xs font-semibold text-red-500">
                  No institution
                </span>
              </div>
            )}

            {/* Referrals shortcut */}
            <button
              onClick={() => router.push("/dashboard/doctor/referrals")}
              className="relative p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              title="My Referrals"
            >
              <ArrowLeftRight className="w-4 h-4" />
              {pendingReferrals + incomingReferrals > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 flex items-center justify-center text-[9px] font-bold rounded-full min-w-[14px] h-[14px] px-0.5 text-white"
                  style={{
                    background: incomingReferrals > 0 ? "#16a34a" : "#f59e0b",
                  }}
                >
                  {pendingReferrals + incomingReferrals > 9
                    ? "9+"
                    : pendingReferrals + incomingReferrals}
                </span>
              )}
            </button>

            {/* Notification bell */}
            <NotificationBell />

            {/* ── Avatar — clicking opens profile drawer ── */}
            <button
              onClick={() => setProfileOpen(true)}
              className="flex items-center gap-2.5 pl-2.5 hover:opacity-80 transition-opacity"
              style={{ borderLeft: "1px solid #f1f2f4" }}
              title="My Profile"
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{
                  background: "linear-gradient(135deg,#166534,#15803d)",
                }}
              >
                {initials}
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold text-gray-900 leading-none">
                  Dr. {user?.firstName} {user?.lastName}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5 hidden md:block">
                  Practitioner
                </p>
              </div>
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>

      {/* ── Profile drawer ────────────────────────────────────────────────── */}
      <ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
}
