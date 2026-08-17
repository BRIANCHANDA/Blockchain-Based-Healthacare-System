"use client";

/*
 * Shared chrome for every role's dashboard.
 *
 * All seven portals previously carried their own near-identical copy of this
 * sidebar, top bar and footer — around 2,400 lines of duplicated markup that
 * had already drifted apart (different background shades, three different
 * active-state treatments, and an active-link bug fixed in one copy only).
 *
 * The admin portal's treatment is the reference design, so it lives here once
 * and each role supplies only what actually differs: its navigation, its portal
 * label, and optionally a context card or a header chip.
 */

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ChevronRight, LogOut, Menu, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ProfileDrawer } from "@/components/ProfileDrawer";
import { NotificationBell } from "@/components/NotificationBell";
import { useAuthStore } from "@/lib/store";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

export interface NavGroup {
  /** Omit for a single ungrouped list. */
  label?: string;
  items: NavItem[];
}

export function DashboardShell({
  portalLabel,
  basePath,
  navGroups,
  roleLabel,
  contextCard,
  headerExtra,
  children,
}: {
  /** Shown under the brand, e.g. "Nurse Portal". */
  portalLabel: string;
  /** The portal root, e.g. "/dashboard/nurse". Matched exactly for its own item. */
  basePath: string;
  navGroups: NavGroup[];
  /** Shown beneath the user's name in the sidebar footer. */
  roleLabel: string;
  /** Optional badge above the navigation (the admin portal's scope indicator). */
  contextCard?: React.ReactNode;
  /** Optional element in the top bar, before the clock. */
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
    <div className="min-h-screen bg-[#f7f9f8] text-slate-900">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[2px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-[250px]
          bg-white border-r border-slate-200
          flex flex-col
          transition-transform duration-300 ease-out
          lg:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Brand */}
        <div className="h-[72px] px-5 flex items-center border-b border-slate-100">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 shadow-sm">
              <Logo size={36} />
            </div>

            <div className="min-w-0">
              <p
                className="text-[16px] font-bold text-slate-900 leading-none"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                MedLink
              </p>

              <p className="mt-1 text-[10.5px] font-bold tracking-[0.14em] uppercase text-emerald-600">
                {portalLabel}
              </p>
            </div>
          </div>

          <button
            className="ml-auto lg:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {contextCard && <div className="px-4 pt-4 pb-3">{contextCard}</div>}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 pb-4 pt-2 scrollbar-thin">
          {navGroups.map((group, gi) => (
            <div key={group.label ?? `group-${gi}`} className="mb-5">
              {group.label && (
                <p className="px-3 py-2 text-[11px] font-bold uppercase tracking-[0.13em] text-slate-400">
                  {group.label}
                </p>
              )}

              <div className="space-y-0.5">
                {group.items.map(({ label, href, icon: Icon }) => {
                  const active = isActiveHref(href);

                  return (
                    <button
                      key={href}
                      onClick={() => {
                        router.push(href);
                        setSidebarOpen(false);
                      }}
                      className={`
                        relative w-full flex items-center gap-3
                        px-3 py-2.5 rounded-xl text-left
                        text-[13.5px] font-medium transition-all
                        ${
                          active
                            ? "bg-emerald-50 text-emerald-800"
                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                        }
                      `}
                    >
                      {active && (
                        <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-emerald-600" />
                      )}

                      <Icon
                        className={`w-[16px] h-[16px] flex-shrink-0 ${
                          active ? "text-emerald-600" : "text-slate-400"
                        }`}
                      />

                      <span className="flex-1">{label}</span>

                      {active && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User area */}
        <div className="border-t border-slate-100 p-3">
          <button
            onClick={() => setProfileOpen(true)}
            className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[12.5px] font-bold flex-shrink-0">
              {initials || "?"}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-slate-800 truncate">
                {user?.firstName} {user?.lastName}
              </p>

              <p className="text-[11.5px] text-slate-400 truncate mt-0.5">
                {roleLabel}
              </p>
            </div>

            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
          </button>

          <button
            onClick={() => {
              clearAuth();
              router.push("/login");
            }}
            className="w-full mt-1 flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ──────────────────────────────────────────────────────────── */}
      <div className="lg:pl-[250px] min-h-screen flex flex-col">
        <header className="sticky top-0 z-30 h-[64px] bg-white/90 backdrop-blur-xl border-b border-slate-200/80">
          <div className="h-full px-4 sm:px-6 flex items-center gap-4">
            <button
              className="lg:hidden w-9 h-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:bg-slate-50"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-4.5 h-4.5" />
            </button>

            <div className="flex items-center gap-3 min-w-0">
              <div className="hidden sm:block w-1 h-7 rounded-full bg-emerald-600" />

              <div className="min-w-0">
                <p className="text-[15px] font-bold text-slate-900 truncate">
                  {activeLabel}
                </p>

                <p className="hidden sm:block text-[12px] text-slate-400 mt-0.5">
                  {time.toLocaleDateString("en-ZM", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>

            <div className="flex-1" />

            {headerExtra}

            <div className="hidden xl:flex flex-col items-end pr-3 border-r border-slate-200">
              <span className="text-[13px] font-bold text-slate-700 tabular-nums">
                {timeStr}
              </span>
              <span className="text-[10.5px] text-slate-400">{dateStr}</span>
            </div>

            <NotificationBell />

            <button
              onClick={() => setProfileOpen(true)}
              className="flex items-center gap-2.5 pl-2 hover:opacity-80 transition-opacity"
            >
              <div className="w-8 h-8 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[11.5px] font-bold shadow-sm">
                {initials || "?"}
              </div>

              <div className="hidden sm:block text-left">
                <p className="text-[12.5px] font-semibold text-slate-800 leading-none">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">{roleLabel}</p>
              </div>

              <ChevronRight className="hidden sm:block w-3 h-3 text-slate-300" />
            </button>
          </div>
        </header>

        <main
          key={pathname}
          className="flex-1 px-4 sm:px-6 lg:px-7 py-6 overflow-y-auto"
        >
          {children}
        </main>

        <footer className="px-6 py-4 border-t border-slate-200/70 bg-white/50">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 max-w-[1280px] mx-auto">
            <p className="text-[11.5px] text-slate-400">MedLink EMR</p>
            <p className="text-[11.5px] text-slate-400">
              Copperbelt University · {new Date().getFullYear()}
            </p>
          </div>
        </footer>
      </div>

      <ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
}
