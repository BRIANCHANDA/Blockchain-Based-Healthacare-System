"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import {
  LayoutDashboard,
  Users,
  Building2,
  ShieldCheck,
  ClipboardList,
  UserCog,
  LogOut,
  Menu,
  X,
  Bell,
  ChevronRight,
  Settings,
  Activity,
} from "lucide-react";

const navGroups = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard/admin", icon: LayoutDashboard },
    ],
  },
  {
    label: "People",
    items: [
      {
        label: "Staff Management",
        href: "/dashboard/admin/staff",
        icon: UserCog,
      },
      { label: "Patients", href: "/dashboard/admin/patients", icon: Users },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        label: "Institutions",
        href: "/dashboard/admin/institutions",
        icon: Building2,
      },
      {
        label: "Visits & Visits",
        href: "/dashboard/admin/visits",
        icon: ClipboardList,
      },
      {
        label: "Permissions",
        href: "/dashboard/admin/permissions",
        icon: ShieldCheck,
      },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Audit Logs", href: "/dashboard/admin/audit", icon: Activity },
      { label: "Settings", href: "/dashboard/admin/settings", icon: Settings },
    ],
  },
];

const allNav = navGroups.flatMap((g) => g.items);

export default function AdminLayout({
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

  const activeLabel =
    allNav.find(
      (n) => n.href !== "/dashboard/admin" && pathname.startsWith(n.href),
    )?.label ?? (pathname === "/dashboard/admin" ? "Dashboard" : "Admin");

  return (
    <div
      className="min-h-screen flex bg-[#f5f6f8]"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <style>{`
        .admin-nav-item {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 12px; border-radius: 10px;
          font-size: 13.5px; font-weight: 500;
          color: rgba(255,255,255,0.55);
          transition: background 0.15s, color 0.15s;
          cursor: pointer; text-decoration: none;
          width: 100%;
        }
        .admin-nav-item:hover {
          background: rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.9);
        }
        .admin-nav-item.active {
          background: rgba(255,255,255,0.13);
          color: #fff;
          font-weight: 600;
        }
        .admin-nav-item.active .nav-icon { opacity: 1; }
        .nav-icon { opacity: 0.6; transition: opacity 0.15s; width: 16px; height: 16px; flex-shrink: 0; }
        .admin-nav-item:hover .nav-icon { opacity: 0.85; }
        .admin-nav-item.active .nav-dot { display: block; }
        .nav-dot { display: none; width:5px; height:5px; border-radius:50%; background:#4ade80; margin-left:auto; flex-shrink:0; }
        .nav-group-label {
          font-size: 10px; font-weight: 700; letter-spacing: 0.1em;
          text-transform: uppercase; color: rgba(255,255,255,0.25);
          padding: 0 12px; margin-bottom: 4px; margin-top: 18px;
        }
        .nav-group-label:first-child { margin-top: 4px; }
      `}</style>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-30 flex flex-col transition-transform duration-200
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        style={{
          width: 232,
          background: "linear-gradient(180deg, #03350c 0%, #057c21 100%)",
          borderRight: "1px solid rgba(5, 150, 42, 0.06)",
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: "20px 20px 16px",
            borderBottom: "1px solid rgba(5, 151, 39, 0.07)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                background: "linear-gradient(135deg, #166534, #15803d)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                <rect
                  x="7"
                  y="2"
                  width="4"
                  height="14"
                  rx="1.5"
                  fill="white"
                  opacity="0.95"
                />
                <rect
                  x="2"
                  y="7"
                  width="14"
                  height="4"
                  rx="1.5"
                  fill="white"
                  opacity="0.95"
                />
              </svg>
            </div>
            <div>
              <p
                style={{
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 13.5,
                  lineHeight: 1,
                }}
              >
                HealthChain
              </p>
              <p
                style={{
                  color: "rgba(255,255,255,0.35)",
                  fontSize: 11,
                  marginTop: 2,
                }}
              >
                Admin Portal
              </p>
            </div>
            <button
              className="ml-auto lg:hidden text-white/40 hover:text-white"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Admin badge */}
        <div
          style={{
            padding: "10px 20px",
            borderBottom: "1px solid rgba(0, 102, 46, 0.06)",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              fontWeight: 700,
              padding: "3px 10px",
              borderRadius: 999,
              background: "rgba(239,68,68,0.15)",
              color: "#fca5a5",
              textTransform: "uppercase",
              letterSpacing: "0.07em",
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "#ef4444",
              }}
            />
            Administrator
          </span>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: "auto", padding: "8px 12px 20px" }}>
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="nav-group-label">{group.label}</p>
              {group.items.map(({ label, href, icon: Icon }) => {
                const isActive =
                  href === "/dashboard/admin"
                    ? pathname === href
                    : pathname.startsWith(href);
                return (
                  <button
                    key={href}
                    onClick={() => {
                      router.push(href);
                      setSidebarOpen(false);
                    }}
                    className={`admin-nav-item ${isActive ? "active" : ""}`}
                  >
                    <Icon className="nav-icon" />
                    {label}
                    <span className="nav-dot" />
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User card */}
        <div
          style={{
            padding: "12px",
            borderTop: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.05)",
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                flexShrink: 0,
                background: "linear-gradient(135deg, #166534, #15803d)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 700,
                color: "#fff",
              }}
            >
              {user?.firstName?.[0]}
              {user?.lastName?.[0]}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  color: "#fff",
                  fontSize: 12.5,
                  fontWeight: 600,
                  lineHeight: 1,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {user?.firstName} {user?.lastName}
              </p>
              <p
                style={{
                  color: "rgba(255,255,255,0.3)",
                  fontSize: 11,
                  marginTop: 2,
                }}
              >
                System Admin
              </p>
            </div>
            <button
              onClick={handleLogout}
              style={{
                color: "rgba(255,255,255,0.3)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 4,
                borderRadius: 6,
                display: "flex",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "rgba(255,255,255,0.3)")
              }
              title="Sign out"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header
          style={{
            height: 56,
            display: "flex",
            alignItems: "center",
            padding: "0 28px",
            gap: 16,
            background: "#fff",
            borderBottom: "1px solid #eaecf0",
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <button
            className="lg:hidden text-gray-500"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>

          {/* Breadcrumb */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
            }}
          >
            <span style={{ color: "#9ba3af" }}>Admin</span>
            <ChevronRight size={13} style={{ color: "#d1d5db" }} />
            <span style={{ color: "#112719", fontWeight: 600 }}>
              {activeLabel}
            </span>
          </div>

          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {/* Notification bell placeholder */}
            <button
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                border: "1px solid #e5e7eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#fff",
                cursor: "pointer",
                color: "#6b7280",
                transition: "background 0.12s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "#f9fafb")
              }
              onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
            >
              <Bell size={15} />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, padding: "28px 28px 40px", overflowY: "auto" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
