"use client";
import { useEffect, useState, useRef } from "react";
import { ProfileDrawer } from "@/components/ProfileDrawer";
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
  FileText,
  Link2,
} from "lucide-react";

// ── Nav structure ─────────────────────────────────────────────────────────────
function getNavGroups(isSuperAdmin: boolean) {
  return [
    {
      label: "Overview",
      items: [
        { label: "Dashboard", href: "/dashboard/admin", icon: LayoutDashboard },
      ],
    },
    {
      label: "People",
      items: [
        { label: "Staff", href: "/dashboard/admin/staff", icon: UserCog },
        { label: "Patients", href: "/dashboard/admin/patients", icon: Users },
      ],
    },
    {
      label: "Operations",
      items: [
        ...(isSuperAdmin
          ? [
              {
                label: "Institutions",
                href: "/dashboard/admin/institutions",
                icon: Building2,
              },
            ]
          : []),
        {
          label: "Visits",
          href: "/dashboard/admin/visits",
          icon: ClipboardList,
        },
        {
          label: "Permissions",
          href: "/dashboard/admin/permissions",
          icon: ShieldCheck,
        },
        { label: "Reports", href: "/dashboard/admin/reports", icon: FileText },
      ],
    },
    {
      label: "System",
      items: [
        { label: "Audit Logs", href: "/dashboard/admin/audit", icon: Activity },
        // ── New: Super admin only ──
        ...(isSuperAdmin
          ? [
              {
                label: "Blockchain",
                href: "/dashboard/admin/blockchain",
                icon: Link2,
              },
            ]
          : []),
        {
          label: "Settings",
          href: "/dashboard/admin/settings",
          icon: Settings,
        },
      ],
    },
  ];
}

const allNavItems = getNavGroups(true).flatMap((g) => g.items);

// ── Layout ────────────────────────────────────────────────────────────────────
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, clearAuth, initFromStorage } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initFromStorage();
    setMounted(true);
  }, []);
  useEffect(() => {
    if (!isAuthenticated) router.push("/login");
  }, [isAuthenticated]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node))
        setNotifOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isSuperAdmin = !(user as any)?.institutionId;
  const navGroups = getNavGroups(isSuperAdmin);
  const handleLogout = () => {
    clearAuth();
    router.push("/login");
  };

  const activeLabel =
    allNavItems.find(
      (n) => n.href !== "/dashboard/admin" && pathname.startsWith(n.href),
    )?.label ?? (pathname === "/dashboard/admin" ? "Dashboard" : "Admin");

  const initials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        background: "#f0f2f5",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap');
        * { box-sizing: border-box; }
        .anav { display: flex; align-items: center; gap: 10px; padding: 9px 14px; border-radius: 11px; font-size: 13.5px; font-weight: 500; color: rgba(255,255,255,0.5); cursor: pointer; text-align: left; width: 100%; background: transparent; border: none; transition: background 0.18s, color 0.18s, transform 0.12s; position: relative; overflow: hidden; }
        .anav::before { content: ''; position: absolute; inset: 0; background: rgba(255,255,255,0.06); opacity: 0; border-radius: 11px; transition: opacity 0.18s; }
        .anav:hover::before { opacity: 1; }
        .anav:hover { color: rgba(255,255,255,0.88); transform: translateX(2px); }
        .anav:active { transform: translateX(2px) scale(0.98); }
        .anav.active { background: rgba(255,255,255,0.12); color: #fff; font-weight: 600; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08); }
        .anav.active::after { content: ''; position: absolute; left: 0; top: 25%; bottom: 25%; width: 3px; background: #4ade80; border-radius: 0 3px 3px 0; }
        .anav-icon { opacity: 0.55; transition: opacity 0.18s; width: 15px; height: 15px; flex-shrink: 0; }
        .anav:hover .anav-icon { opacity: 0.8; }
        .anav.active .anav-icon { opacity: 1; }
        .agroup-label { font-size: 9.5px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.2); padding: 0 14px; margin-bottom: 3px; margin-top: 22px; }
        .agroup-label:first-child { margin-top: 6px; }
        .sidebar-item { animation: slideIn 0.35s ease both; }
        @keyframes slideIn { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }
        .page-content { animation: fadeUp 0.3s ease both; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes badgePulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); } 50% { box-shadow: 0 0 0 4px rgba(239,68,68,0); } }
        .topbar-btn { width: 34px; height: 34px; border-radius: 9px; border: 1px solid #e8eaed; background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #6b7280; transition: background 0.15s, border-color 0.15s, transform 0.1s; }
        .topbar-btn:hover { background: #f3f4f6; border-color: #d1d5db; transform: translateY(-1px); }
        .topbar-btn:active { transform: translateY(0) scale(0.97); }
        @keyframes overlayIn { from { opacity: 0; } to { opacity: 1; } }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 99px; }
        @keyframes dropIn { from { opacity: 0; transform: translateY(-8px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .notif-dropdown { animation: dropIn 0.18s ease both; }
      `}</style>

      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(2px)",
            zIndex: 20,
            animation: "overlayIn 0.2s ease",
          }}
          className="lg:hidden"
        />
      )}

      <aside
        className={`${sidebarOpen ? "" : "sidebar-hidden"}`}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: 240,
          zIndex: 30,
          display: "flex",
          flexDirection: "column",
          background:
            "linear-gradient(160deg, #052e16 0%, #064e1f 35%, #0a5c26 70%, #0d6e2e 100%)",
          borderRight: "1px solid rgba(255,255,255,0.04)",
          boxShadow: "4px 0 24px rgba(0,0,0,0.18)",
          transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
          transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.015'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
            pointerEvents: "none",
            opacity: 0.5,
          }}
        />

        <div
          style={{
            padding: "22px 20px 18px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            position: "relative",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background:
                  "linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05))",
                border: "1px solid rgba(255,255,255,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <rect
                  x="8"
                  y="2"
                  width="4"
                  height="16"
                  rx="2"
                  fill="white"
                  opacity="0.9"
                />
                <rect
                  x="2"
                  y="8"
                  width="16"
                  height="4"
                  rx="2"
                  fill="white"
                  opacity="0.9"
                />
                <circle cx="10" cy="10" r="2.5" fill="white" />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 14,
                  lineHeight: 1,
                  fontFamily: "'Playfair Display', serif",
                  letterSpacing: "-0.01em",
                }}
              >
                MedLink
              </p>
              <p
                style={{
                  color: "rgba(255,255,255,0.3)",
                  fontSize: 10.5,
                  marginTop: 3,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Admin Portal
              </p>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden"
              style={{
                color: "rgba(255,255,255,0.35)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 4,
                borderRadius: 6,
                display: "flex",
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "rgba(255,255,255,0.8)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "rgba(255,255,255,0.35)")
              }
            >
              <X size={15} />
            </button>
          </div>

          <div style={{ marginTop: 14 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 10,
                fontWeight: 800,
                padding: "4px 10px",
                borderRadius: 999,
                letterSpacing: "0.1em",
                background: isSuperAdmin
                  ? "rgba(239,68,68,0.15)"
                  : "rgba(59,130,246,0.15)",
                color: isSuperAdmin ? "#fca5a5" : "#93c5fd",
                border: `1px solid ${isSuperAdmin ? "rgba(239,68,68,0.2)" : "rgba(59,130,246,0.2)"}`,
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: isSuperAdmin ? "#ef4444" : "#3b82f6",
                  animation: "badgePulse 2s ease infinite",
                }}
              />
              {isSuperAdmin ? "SUPER ADMIN" : "HOSPITAL ADMIN"}
            </span>
          </div>
        </div>

        <nav style={{ flex: 1, overflowY: "auto", padding: "4px 10px 20px" }}>
          {navGroups.map((group, gi) => (
            <div key={group.label}>
              <p
                className="agroup-label"
                style={{ animationDelay: `${gi * 50}ms` }}
              >
                {group.label}
              </p>
              {group.items.map(({ label, href, icon: Icon }, ii) => {
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
                    className={`anav sidebar-item ${isActive ? "active" : ""}`}
                    style={{ animationDelay: `${(gi * 4 + ii) * 40 + 80}ms` }}
                  >
                    <Icon className="anav-icon" />
                    <span style={{ flex: 1 }}>{label}</span>
                    {isActive && (
                      <span
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: "50%",
                          background: "#4ade80",
                          flexShrink: 0,
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div
          style={{
            padding: "10px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.06)",
              transition: "background 0.15s",
              cursor: "default",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,0.08)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,0.05)")
            }
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                flexShrink: 0,
                background: "linear-gradient(135deg, #15803d, #166534)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 800,
                color: "#fff",
                border: "1.5px solid rgba(255,255,255,0.15)",
                boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
              }}
            >
              {initials || "?"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  color: "#fff",
                  fontSize: 12.5,
                  fontWeight: 600,
                  lineHeight: 1.2,
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
                  fontSize: 10.5,
                  marginTop: 2,
                }}
              >
                {isSuperAdmin ? "System Administrator" : "Hospital Admin"}
              </p>
            </div>
            <button
              onClick={handleLogout}
              style={{
                color: "rgba(255,255,255,0.25)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "5px",
                borderRadius: 7,
                display: "flex",
                transition: "color 0.15s, background 0.15s",
              }}
              title="Sign out"
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#ef4444";
                e.currentTarget.style.background = "rgba(239,68,68,0.12)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "rgba(255,255,255,0.25)";
                e.currentTarget.style.background = "none";
              }}
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      <div className="hidden lg:block" style={{ width: 240, flexShrink: 0 }} />

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          minHeight: "100vh",
        }}
      >
        <header
          style={{
            height: 58,
            display: "flex",
            alignItems: "center",
            padding: "0 24px",
            gap: 14,
            background: "rgba(255,255,255,0.85)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderBottom: "1px solid rgba(0,0,0,0.06)",
            position: "sticky",
            top: 0,
            zIndex: 10,
            boxShadow: "0 1px 0 rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.04)",
          }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="topbar-btn lg:hidden"
          >
            <Menu size={17} />
          </button>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
            }}
          >
            <span style={{ color: "#9ca3af", fontWeight: 500 }}>Admin</span>
            <ChevronRight size={12} style={{ color: "#d1d5db" }} />
            <span style={{ color: "#111827", fontWeight: 700 }}>
              {activeLabel}
            </span>
          </div>

          <div style={{ flex: 1 }} />

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {!isSuperAdmin && user?.institutionName && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 12px",
                  borderRadius: 8,
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                }}
              >
                <Building2 size={11} style={{ color: "#166534" }} />
                <p
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#166534",
                    whiteSpace: "nowrap",
                  }}
                >
                  {user.institutionName}
                </p>
              </div>
            )}

            <div style={{ position: "relative" }} ref={notifRef}>
              <button
                onClick={() => setNotifOpen((v) => !v)}
                className="topbar-btn"
                style={{ position: "relative" }}
              >
                <Bell size={15} />
                <span
                  style={{
                    position: "absolute",
                    top: 7,
                    right: 7,
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "#ef4444",
                    border: "1.5px solid #fff",
                    animation: "badgePulse 2s ease infinite",
                  }}
                />
              </button>

              {notifOpen && (
                <div
                  className="notif-dropdown"
                  style={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    right: 0,
                    width: 300,
                    background: "#fff",
                    borderRadius: 14,
                    border: "1px solid #e5e7eb",
                    boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
                    overflow: "hidden",
                    zIndex: 50,
                  }}
                >
                  <div
                    style={{
                      padding: "14px 16px",
                      borderBottom: "1px solid #f3f4f6",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <p
                      style={{ fontSize: 13.5, fontWeight: 700, color: "#111" }}
                    >
                      Notifications
                    </p>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: "#fef2f2",
                        color: "#dc2626",
                      }}
                    >
                      1 new
                    </span>
                  </div>
                  <div style={{ padding: "8px 0" }}>
                    {[
                      {
                        title: "Unverified staff pending",
                        sub: "Review new staff registrations",
                        time: "Just now",
                        dot: "#ef4444",
                      },
                      {
                        title: "System running normally",
                        sub: "All services operational",
                        time: "2m ago",
                        dot: "#16a34a",
                      },
                    ].map((n, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          gap: 12,
                          padding: "10px 16px",
                          cursor: "pointer",
                          transition: "background 0.12s",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = "#f9fafb")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "none")
                        }
                      >
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: n.dot,
                            flexShrink: 0,
                            marginTop: 5,
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: "#111",
                              marginBottom: 2,
                            }}
                          >
                            {n.title}
                          </p>
                          <p style={{ fontSize: 11.5, color: "#9ca3af" }}>
                            {n.sub}
                          </p>
                        </div>
                        <p
                          style={{
                            fontSize: 11,
                            color: "#c4c9d4",
                            flexShrink: 0,
                          }}
                        >
                          {n.time}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div
                    style={{
                      padding: "10px 16px",
                      borderTop: "1px solid #f3f4f6",
                    }}
                  >
                    <button
                      style={{
                        width: "100%",
                        padding: "7px",
                        borderRadius: 8,
                        border: "none",
                        background: "#f3f4f6",
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: "#6b7280",
                        cursor: "pointer",
                        transition: "background 0.12s",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "#e5e7eb")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "#f3f4f6")
                      }
                    >
                      View all notifications
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div
              onClick={() => setProfileOpen(true)}
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                background: "linear-gradient(135deg,#15803d,#166534)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 800,
                color: "#fff",
                cursor: "pointer",
                border: "2px solid rgba(22,101,52,0.2)",
                transition: "transform 0.15s, box-shadow 0.15s",
                boxShadow: "0 2px 6px rgba(22,101,52,0.25)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.05)";
                e.currentTarget.style.boxShadow =
                  "0 4px 12px rgba(22,101,52,0.35)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow =
                  "0 2px 6px rgba(22,101,52,0.25)";
              }}
            >
              {initials || "?"}
            </div>
          </div>
        </header>

        <style>{`
          @media (min-width: 1024px) { .sidebar-hidden { transform: translateX(0) !important; } }
          @media (max-width: 1023px) { .sidebar-hidden { transform: translateX(-100%) !important; } }
        `}</style>

        <main
          key={pathname}
          className="page-content"
          style={{ flex: 1, padding: "28px 28px 48px", overflowY: "auto" }}
        >
          {children}
        </main>

        <footer
          style={{
            padding: "12px 28px",
            borderTop: "1px solid rgba(0,0,0,0.05)",
            background: "rgba(255,255,255,0.6)",
            backdropFilter: "blur(8px)",
          }}
        >
          <p style={{ fontSize: 11.5, color: "#c4c9d4", textAlign: "center" }}>
            MedLink EMR · Copperbelt University · {new Date().getFullYear()}
          </p>
        </footer>
      </div>

      <ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
}
