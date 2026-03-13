"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  ClipboardList,
  LogOut,
  Menu,
  X,
  Bell,
  ChevronRight,
  Heart,
} from "lucide-react";

const navItems = [
  { label: "Overview", href: "/dashboard/receptionist", icon: LayoutDashboard },
  {
    label: "Register Patient",
    href: "/dashboard/receptionist/register",
    icon: UserPlus,
  },
  {
    label: "Today's Queue",
    href: "/dashboard/receptionist/queue",
    icon: ClipboardList,
  },
  {
    label: "All Patients",
    href: "/dashboard/receptionist/patients",
    icon: Users,
  },
];

export default function ReceptionistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, clearAuth, initFromStorage } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [time, setTime] = useState(new Date());

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

  const handleLogout = () => {
    clearAuth();
    router.push("/login");
  };

  const activeLabel =
    navItems.find(
      (n) =>
        n.href !== "/dashboard/receptionist" && pathname.startsWith(n.href),
    )?.label ??
    (pathname === "/dashboard/receptionist" ? "Overview" : "Receptionist");

  const timeStr = time.toLocaleTimeString("en-ZM", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateStr = time.toLocaleDateString("en-ZM", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

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

      {/* ── Sidebar ── */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-30 w-64 flex flex-col transition-transform duration-300
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        style={{
          background:
            "linear-gradient(180deg, #052e16 0%, #064e23 40%, #0d5c2a 100%)",
        }}
      >
        {/* Logo area */}
        <div className="px-5 pt-6 pb-5 border-b border-white/[0.07]">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: "rgba(134,239,172,0.15)",
                border: "1px solid rgba(134,239,172,0.2)",
              }}
            >
              <Heart className="w-4 h-4 text-green-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm leading-tight tracking-tight">
                HealthChain
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
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{
              background: "rgba(251,191,36,0.12)",
              color: "#fbbf24",
              border: "1px solid rgba(251,191,36,0.2)",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Receptionist
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ label, href, icon: Icon }) => {
            const active =
              pathname === href ||
              (href !== "/dashboard/receptionist" && pathname.startsWith(href));
            return (
              <button
                key={href}
                onClick={() => {
                  router.push(href);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all text-left group`}
                style={
                  active
                    ? {
                        background: "rgba(255,255,255,0.12)",
                        color: "#ffffff",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
                      }
                    : { color: "rgba(187,247,208,0.55)" }
                }
              >
                <Icon
                  className={`w-4 h-4 flex-shrink-0 transition-transform ${active ? "" : "group-hover:scale-110"}`}
                />
                <span className="flex-1">{label}</span>
                {active ? (
                  <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400/0 group-hover:bg-green-400/30 transition-all" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Live clock */}
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

        {/* User card */}
        <div className="px-3 pb-4 border-t border-white/[0.07] pt-3">
          <div
            className="flex items-center gap-3 px-3 py-2 rounded-xl mb-1"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{
                background: "linear-gradient(135deg, #16a34a, #15803d)",
              }}
            >
              {user?.firstName?.[0]}
              {user?.lastName?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-green-400/50 text-xs">Front Desk</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
            style={{ color: "rgba(187,247,208,0.4)" }}
            onMouseEnter={(e) => (
              (e.currentTarget.style.color = "#f87171"),
              (e.currentTarget.style.background = "rgba(239,68,68,0.08)")
            )}
            onMouseLeave={(e) => (
              (e.currentTarget.style.color = "rgba(187,247,208,0.4)"),
              (e.currentTarget.style.background = "transparent")
            )}
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-3.5 flex items-center justify-between sticky top-0 z-10">
          <button
            className="lg:hidden text-gray-400 hover:text-gray-700 p-1 transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="hidden lg:flex items-center gap-2.5">
            <div
              className="w-1.5 h-4 rounded-full"
              style={{
                background: "linear-gradient(180deg, #16a34a, #15803d)",
              }}
            />
            <div>
              <p className="text-sm font-semibold text-gray-900 leading-none">
                {activeLabel}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {time.toLocaleDateString("en-ZM", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button className="relative p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <Bell className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2.5 pl-2 border-l border-gray-100">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{
                  background: "linear-gradient(135deg, #166534, #15803d)",
                }}
              >
                {user?.firstName?.[0]}
                {user?.lastName?.[0]}
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold text-gray-900 leading-none">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Receptionist</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
