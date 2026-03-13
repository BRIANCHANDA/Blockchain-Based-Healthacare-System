"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import {
  LayoutDashboard,
  ClipboardList,
  Activity,
  Users,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Bell,
  Heart,
} from "lucide-react";

const navItems = [
  { label: "Overview", href: "/dashboard/nurse", icon: LayoutDashboard },
  {
    label: "Today's Queue",
    href: "/dashboard/nurse/queue",
    icon: ClipboardList,
  },
  { label: "Triage Patient", href: "/dashboard/nurse/triage", icon: Activity },
  { label: "My Patients", href: "/dashboard/nurse/patients", icon: Users },
];

export default function NurseLayout({
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
    const t = setInterval(() => setTime(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const handleLogout = () => {
    clearAuth();
    router.push("/login");
  };

  const activeItem = navItems.find((n) =>
    n.href !== "/dashboard/nurse"
      ? pathname.startsWith(n.href)
      : pathname === n.href,
  );

  return (
    <div
      className="min-h-screen flex"
      style={{ fontFamily: "'DM Sans', sans-serif", background: "#f7f9f7" }}
    >
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 lg:hidden"
          style={{
            background: "rgba(5,46,22,0.5)",
            backdropFilter: "blur(4px)",
          }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-30 w-56 flex flex-col transition-transform duration-300 ease-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        style={{
          background: "linear-gradient(180deg, #0d4a1f 0%, #166534 100%)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* Logo */}
        <div className="px-5 pt-6 pb-5">
          <div className="flex items-center gap-3 mb-5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: "rgba(255,255,255,0.13)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <Heart className="w-4 h-4 text-green-200" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm leading-tight">
                HealthChain
              </p>
              <p
                className="text-xs mt-0.5"
                style={{ color: "rgba(187,247,208,0.5)" }}
              >
                Zambia · EMR
              </p>
            </div>
            <button
              className="lg:hidden"
              style={{ color: "rgba(255,255,255,0.4)" }}
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {/* Role badge */}
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
            style={{
              background: "rgba(147,197,253,0.15)",
              color: "#93c5fd",
              border: "1px solid rgba(147,197,253,0.2)",
              letterSpacing: "0.06em",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-300" />
            NURSING STAFF
          </div>
        </div>

        <div
          className="mx-5 mb-3 h-px"
          style={{
            background:
              "linear-gradient(90deg, rgba(255,255,255,0.1), transparent)",
          }}
        />

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-0.5">
          {navItems.map(({ label, href, icon: Icon }) => {
            const active =
              href !== "/dashboard/nurse"
                ? pathname.startsWith(href)
                : pathname === href;
            return (
              <button
                key={href}
                onClick={() => {
                  router.push(href);
                  setSidebarOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all text-left relative"
                style={
                  active
                    ? {
                        background: "rgba(255,255,255,0.15)",
                        color: "#fff",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
                      }
                    : { color: "rgba(187,247,208,0.6)" }
                }
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-green-300" />
                )}
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{label}</span>
                {active && <ChevronRight className="w-3.5 h-3.5 opacity-40" />}
              </button>
            );
          })}
        </nav>

        {/* Clock */}
        <div
          className="mx-4 mb-3 px-4 py-3 rounded-2xl"
          style={{
            background: "rgba(0,0,0,0.15)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <p className="text-white font-bold text-xl tabular-nums leading-none">
            {time.toLocaleTimeString("en-ZM", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          <p
            className="text-xs mt-1"
            style={{ color: "rgba(187,247,208,0.45)" }}
          >
            {time.toLocaleDateString("en-ZM", {
              weekday: "short",
              day: "numeric",
              month: "short",
            })}
          </p>
        </div>

        {/* User */}
        <div
          className="px-3 pb-4 pt-2"
          style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1"
            style={{ background: "rgba(0,0,0,0.15)" }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.2)" }}
            >
              {user?.firstName?.[0]}
              {user?.lastName?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p
                className="text-xs"
                style={{ color: "rgba(187,247,208,0.45)" }}
              >
                Nursing Staff
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all"
            style={{ color: "rgba(187,247,208,0.45)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#fca5a5";
              e.currentTarget.style.background = "rgba(239,68,68,0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "rgba(187,247,208,0.45)";
              e.currentTarget.style.background = "transparent";
            }}
          >
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header
          className="sticky top-0 z-10 flex items-center justify-between px-6 py-3.5"
          style={{
            background: "rgba(247,249,247,0.88)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid rgba(0,0,0,0.06)",
          }}
        >
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden text-gray-400 hover:text-gray-700 p-1.5 rounded-lg transition-colors"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden lg:flex items-center gap-3">
              <div
                className="w-1 h-8 rounded-full"
                style={{
                  background: "linear-gradient(180deg,#166534,#15803d)",
                }}
              />
              <div>
                <p className="text-sm font-bold text-gray-900 leading-none">
                  {activeItem?.label ?? "Nurse Portal"}
                </p>
                <p className="text-xs mt-0.5 text-gray-400">
                  {time.toLocaleDateString("en-ZM", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <Bell className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2.5 pl-3 border-l border-gray-100">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ background: "#166534" }}
              >
                {user?.firstName?.[0]}
                {user?.lastName?.[0]}
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold text-gray-900 leading-none">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Nurse</p>
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
