"use client";

/*
 * Shared chrome for every role's dashboard.
 *
 * Styling follows the HealthChain design system imported from
 * claude.ai/design ("MedLink EMR Sidebar Layout"): a deep-green sidebar
 * carrying the brand, against a near-white application surface. Values come
 * from the token layer in app/design-tokens.css — reference the semantic
 * aliases (--brand, --text-primary, --r-md) rather than raw hex, so a palette
 * change stays a one-line edit there.
 *
 * All seven portals share this one component. Each supplies only what differs:
 * its navigation, its portal label, and optionally a header element.
 */

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ChevronRight, LogOut, Menu, X, Building2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ProfileDrawer } from "@/components/ProfileDrawer";
import { NotificationBell } from "@/components/NotificationBell";
import NotificationListener from "@/components/NotificationListener";
import { useAuthStore } from "@/lib/store";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  /** Optional count shown as an amber pill, e.g. items awaiting action. */
  badge?: number;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export function DashboardShell({
  portalLabel,
  basePath,
  navGroups,
  roleLabel,
  headerExtra,
  children,
}: {
  /** Shown in the sidebar pill, e.g. "Reception portal". */
  portalLabel: string;
  /** Portal root, e.g. "/dashboard/receptionist". Matched exactly for its own item. */
  basePath: string;
  navGroups: NavGroup[];
  /** Shown beneath the user's name in the profile button. */
  roleLabel: string;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const { user, isAuthenticated, clearAuth, initFromStorage } = useAuthStore();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    initFromStorage();
  }, [initFromStorage]);

  useEffect(() => {
    if (!isAuthenticated) router.push("/login");
  }, [isAuthenticated, router]);

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const initials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`;
  const institutionName = (user as any)?.institutionName ?? null;

  /*
   * A bare startsWith let a route match a sibling sharing its prefix — for
   * example "/reports" also lighting up "/report". Requiring a path separator
   * keeps them distinct. The portal root matches exactly, or every page would
   * mark it active.
   */
  const isActiveHref = (href: string) => {
    if (href === basePath) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const allItems = navGroups.flatMap((g) => g.items);
  const activeItem = allItems.find((item) => isActiveHref(item.href));
  const activeLabel =
    activeItem?.label ?? (pathname === basePath ? "Overview" : portalLabel);

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
      style={{
        minHeight: "100vh",
        background: "var(--surface-app)",
        fontFamily: "var(--font-sans)",
        color: "var(--text-primary)",
      }}
    >
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: "var(--sidebar-scrim)", backdropFilter: "blur(2px)" }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          width: 274,
          background: "var(--sidebar-bg)",
          borderRight: "1px solid var(--sidebar-line)",
        }}
      >
        {/* Brand block */}
        <div
          style={{
            padding: "22px 20px 18px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            borderBottom: "1px solid var(--sidebar-line)",
          }}
        >
          <div className="flex items-center gap-3">
            <Logo size={38} />
            <div className="min-w-0 flex flex-col gap-[3px]">
              <p
                style={{
                  margin: 0,
                  font: "600 19px/1 var(--font-display)",
                  color: "var(--white)",
                  letterSpacing: "-0.01em",
                }}
              >
                MedLink
              </p>
              <p
                style={{
                  margin: 0,
                  font: "500 11px/1 var(--font-mono)",
                  color: "var(--sidebar-accent)",
                  letterSpacing: "0.06em",
                }}
              >
                ZAMBIA · EMR
              </p>
            </div>
          </div>

          {/* Portal pill — the pulse signals a live, auto-refreshing view. */}
          <div
            className="self-start flex items-center gap-[7px]"
            style={{
              height: 24,
              padding: "0 10px 0 8px",
              borderRadius: "var(--r-pill)",
              background: "var(--sidebar-active)",
              border: "1px solid var(--sidebar-active-line)",
            }}
          >
            <span className="relative flex" style={{ width: 6, height: 6 }}>
              <span
                className="absolute inset-0 rounded-full"
                style={{
                  background: "var(--green-300)",
                  animation: "hcPing 2.4s cubic-bezier(0,0,0.2,1) infinite",
                }}
              />
              <span
                className="relative rounded-full"
                style={{ width: 6, height: 6, background: "var(--green-300)" }}
              />
            </span>
            <span
              style={{
                font: "700 10px/1 var(--font-sans)",
                letterSpacing: "var(--ls-caps)",
                textTransform: "uppercase",
                color: "var(--green-200)",
              }}
            >
              {portalLabel}
            </span>
          </div>

          {/* Which institution the user is acting for — the scope of everything
              they see. Super admins have none, so it is hidden. */}
          {institutionName && (
            <div
              className="flex items-center gap-[10px]"
              style={{
                padding: "10px 12px",
                borderRadius: "var(--r-sm)",
                background: "var(--sidebar-raise)",
                border: "1px solid var(--sidebar-line)",
              }}
            >
              <Building2 className="w-4 h-4 flex-shrink-0" style={{ color: "var(--green-300)" }} />
              <div className="min-w-0 flex flex-col gap-[2px]">
                <p
                  style={{
                    margin: 0,
                    font: "600 9.5px/1 var(--font-sans)",
                    letterSpacing: "var(--ls-caps)",
                    textTransform: "uppercase",
                    color: "var(--sidebar-text-dim)",
                  }}
                >
                  Institution
                </p>
                <p
                  className="truncate"
                  style={{
                    margin: 0,
                    font: "600 13px/1.2 var(--font-sans)",
                    color: "var(--green-050)",
                  }}
                >
                  {institutionName}
                </p>
              </div>
            </div>
          )}

          <button
            className="absolute right-4 top-6 lg:hidden p-1.5 rounded-[var(--r-xs)]"
            style={{ color: "var(--sidebar-text-dim)" }}
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav
          className="flex-1 overflow-y-auto flex flex-col"
          style={{ padding: "16px 14px", gap: 18 }}
        >
          {navGroups.map((group, gi) => (
            <div
              key={group.label ?? `group-${gi}`}
              className="flex flex-col"
              style={{ gap: 4 }}
            >
              {group.label && (
                <p
                  style={{
                    margin: "0 0 4px 12px",
                    font: "700 9.5px/1 var(--font-sans)",
                    letterSpacing: "var(--ls-caps)",
                    textTransform: "uppercase",
                    color: "var(--sidebar-text-faint)",
                  }}
                >
                  {group.label}
                </p>
              )}

              {group.items.map(({ label, href, icon: Icon, badge }) => {
                const active = isActiveHref(href);

                return (
                  <div key={href} className="relative flex">
                    {active && (
                      <span
                        style={{
                          position: "absolute",
                          left: -14,
                          top: 12,
                          width: 3,
                          height: 20,
                          borderRadius: "0 2px 2px 0",
                          background: "var(--green-300)",
                        }}
                      />
                    )}

                    <button
                      onClick={() => {
                        router.push(href);
                        setSidebarOpen(false);
                      }}
                      className="flex-1 flex items-center text-left"
                      style={{
                        gap: 11,
                        height: 44,
                        padding: "0 10px 0 12px",
                        borderRadius: "var(--r-sm)",
                        border: active
                          ? "1px solid var(--sidebar-active-line)"
                          : "1px solid transparent",
                        background: active ? "var(--sidebar-active)" : "transparent",
                        color: active ? "var(--white)" : "var(--sidebar-text)",
                        font: `${active ? 600 : 500} 14px/1 var(--font-sans)`,
                        cursor: "pointer",
                        transition: "background var(--dur-fast) var(--ease-standard)",
                      }}
                      onMouseEnter={(e) => {
                        if (!active)
                          e.currentTarget.style.background = "var(--sidebar-raise)";
                      }}
                      onMouseLeave={(e) => {
                        if (!active) e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                      <span className="flex-1 min-w-0 truncate">{label}</span>

                      {badge ? (
                        <span
                          className="inline-flex items-center justify-center"
                          style={{
                            minWidth: 20,
                            height: 20,
                            padding: "0 6px",
                            borderRadius: "var(--r-pill)",
                            // Dark ink on the amber fill: --urgent-ink on
                            // --urgent is only ~2.4:1 and unreadable at 11px.
                            background: "var(--urgent)",
                            color: "var(--ink-900)",
                            font: "700 11px/1 var(--font-sans)",
                          }}
                        >
                          {badge}
                        </span>
                      ) : active ? (
                        <ChevronRight className="w-[15px] h-[15px]" />
                      ) : null}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Clock — mono numerals so the width does not jitter each minute. */}
        <div
          className="flex items-baseline justify-between"
          style={{
            margin: "0 14px",
            padding: "12px 14px",
            borderRadius: "var(--r-sm)",
            background: "var(--sidebar-raise)",
            gap: 8,
          }}
        >
          <p
            style={{
              margin: 0,
              font: "500 20px/1 var(--font-mono)",
              color: "var(--green-050)",
              letterSpacing: "-0.01em",
            }}
          >
            {timeStr}
          </p>
          <p
            style={{
              margin: 0,
              font: "500 11px/1 var(--font-sans)",
              color: "var(--sidebar-text-dim)",
            }}
          >
            {dateStr}
          </p>
        </div>

        {/* Profile + sign out */}
        <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 6 }}>
          <button
            onClick={() => setProfileOpen(true)}
            className="flex items-center text-left"
            style={{
              gap: 11,
              padding: "9px 10px",
              border: "1px solid var(--sidebar-line)",
              borderRadius: "var(--r-sm)",
              background: "var(--sidebar-raise)",
              cursor: "pointer",
            }}
          >
            <span
              className="inline-flex items-center justify-center rounded-full"
              style={{
                width: 36,
                height: 36,
                background: "var(--sidebar-avatar)",
                color: "var(--green-200)",
                font: "600 13px/1 var(--font-sans)",
              }}
            >
              {initials || "?"}
            </span>

            <div className="flex-1 min-w-0 flex flex-col gap-[3px]">
              <p
                className="truncate"
                style={{
                  margin: 0,
                  font: "600 13.5px/1.1 var(--font-sans)",
                  color: "var(--white)",
                }}
              >
                {user?.firstName} {user?.lastName}
              </p>
              <p
                style={{
                  margin: 0,
                  font: "500 11.5px/1 var(--font-sans)",
                  color: "var(--sidebar-text-dim)",
                }}
              >
                {roleLabel}
              </p>
            </div>

            <ChevronRight
              className="w-4 h-4"
              style={{ color: "var(--sidebar-text-faint)" }}
            />
          </button>

          <button
            onClick={() => {
              clearAuth();
              router.push("/login");
            }}
            className="flex items-center"
            style={{
              gap: 9,
              height: 40,
              padding: "0 12px",
              border: "none",
              borderRadius: "var(--r-sm)",
              background: "transparent",
              color: "var(--sidebar-text-dim)",
              font: "500 13px/1 var(--font-sans)",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--sidebar-danger)";
              e.currentTarget.style.color = "var(--coral-500)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--sidebar-text-dim)";
            }}
          >
            <LogOut className="w-[15px] h-[15px]" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ──────────────────────────────────────────────────────────── */}
      <div className="lg:pl-[274px] min-h-screen flex flex-col">
        <header
          className="sticky top-0 z-30 flex items-center"
          style={{
            height: 64,
            background: "var(--surface-glass)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid var(--hc-border)",
            padding: "0 var(--sp-6)",
            gap: "var(--sp-4)",
          }}
        >
          <button
            className="lg:hidden inline-flex items-center justify-center"
            style={{
              width: 38,
              height: 38,
              borderRadius: "var(--r-md)",
              border: "1px solid var(--hc-border)",
              background: "var(--white)",
              color: "var(--text-muted)",
            }}
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-4 h-4" />
          </button>

          <div className="min-w-0">
            <p
              className="truncate"
              style={{
                margin: 0,
                font: "600 15px/1.2 var(--font-sans)",
                color: "var(--text-primary)",
              }}
            >
              {activeLabel}
            </p>
            <p
              className="hidden sm:block"
              style={{
                margin: 0,
                font: "400 12px/1.2 var(--font-sans)",
                color: "var(--text-muted)",
                marginTop: 2,
              }}
            >
              {time.toLocaleDateString("en-ZM", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>

          <div className="flex-1" />

          {headerExtra}
          <NotificationBell />
        </header>

        <main key={pathname} className="flex-1" style={{ padding: "var(--sp-6)" }}>
          {children}
        </main>
        <NotificationListener />

        <footer
          style={{
            padding: "var(--sp-4) var(--sp-6)",
            borderTop: "1px solid var(--border-faint)",
          }}
        >
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 max-w-[1280px] mx-auto">
            <p style={{ margin: 0, font: "400 11.5px/1 var(--font-sans)", color: "var(--text-muted)" }}>
              MedLink EMR
            </p>
            <p style={{ margin: 0, font: "400 11.5px/1 var(--font-sans)", color: "var(--text-muted)" }}>
              Copperbelt University · {new Date().getFullYear()}
            </p>
          </div>
        </footer>
      </div>

      <ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
}
