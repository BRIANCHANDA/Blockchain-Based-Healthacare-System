"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import {
  LayoutDashboard,
  FlaskConical,
  ClipboardList,
  History,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Bell,
  Beaker,
} from "lucide-react";

const navItems = [
  { label: "Overview", href: "/dashboard/laboratory", icon: LayoutDashboard },
  {
    label: "Lab Queue",
    href: "/dashboard/laboratory/queue",
    icon: ClipboardList,
  },
  { label: "History", href: "/dashboard/laboratory/history", icon: History },
];

export default function LaboratoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, clearAuth, initFromStorage } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    initFromStorage();
  }, []);
  useEffect(() => {
    if (!isAuthenticated) router.push("/login");
  }, [isAuthenticated]);

  const handleLogout = () => {
    clearAuth();
    router.push("/login");
  };

  const pageLabel =
    navItems.find(
      (n) => n.href !== "/dashboard/laboratory" && pathname.startsWith(n.href),
    )?.label ??
    (pathname === "/dashboard/laboratory" ? "Overview" : "Laboratory");

  return (
    <div
      className="min-h-screen flex bg-gray-50"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-30 w-60 flex flex-col transition-transform duration-200
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        style={{
          background: "linear-gradient(180deg,#0d4a1f 0%,#166534 100%)",
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.15)" }}
          >
            <Beaker className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-none">
              HealthChain
            </p>
            <p className="text-green-300 text-xs mt-0.5">Zambia</p>
          </div>
          <button
            className="ml-auto lg:hidden text-white/60 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Role badge */}
        <div className="px-5 py-3 border-b border-white/10">
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: "rgba(110,231,183,0.2)", color: "#6ee7b7" }}
          >
            Lab Technician
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ label, href, icon: Icon }) => {
            const active =
              pathname === href ||
              (href !== "/dashboard/laboratory" && pathname.startsWith(href));
            return (
              <button
                key={href}
                onClick={() => {
                  router.push(href);
                  setSidebarOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left"
                style={
                  active
                    ? { background: "rgba(255,255,255,0.15)", color: "#ffffff" }
                    : { color: "rgba(187,247,208,0.7)" }
                }
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
                {active && <ChevronRight className="w-3.5 h-3.5 ml-auto" />}
              </button>
            );
          })}
        </nav>

        {/* User + logout */}
        <div className="px-3 py-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.2)" }}
            >
              {user?.firstName?.[0]}
              {user?.lastName?.[0]}
            </div>
            <div className="min-w-0">
              <p className="text-white text-xs font-semibold truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-green-300 text-xs opacity-70">
                Lab Technician
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
            style={{ color: "rgba(187,247,208,0.6)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "rgba(187,247,208,0.6)")
            }
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <button
            className="lg:hidden text-gray-500 hover:text-gray-700"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="hidden lg:block">
            <p className="text-sm font-semibold text-gray-900">{pageLabel}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date().toLocaleDateString("en-ZM", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <button className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <Bell className="w-4 h-4" />
            </button>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ background: "#166534" }}
            >
              {user?.firstName?.[0]}
              {user?.lastName?.[0]}
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
