"use client";

/*
 * The visual vocabulary shared by every dashboard overview.
 *
 * These were written for the admin portal and are the reference styling for the
 * rest: white surfaces on #f7f9f8, slate text, emerald accents, 2xl radii and a
 * single type scale. Roles should compose these rather than hand-rolling cards,
 * so the portals cannot drift apart again.
 */

import { useRouter } from "next/navigation";
import { ChevronRight, ArrowUpRight } from "lucide-react";

/** Headline figure. Becomes a link when `href` is supplied. */
export function KpiCard({
  label,
  value,
  description,
  icon: Icon,
  iconClass,
  href,
  trend,
}: {
  label: string;
  value: number | string | undefined;
  description?: string;
  icon: React.ElementType;
  iconClass: string;
  href?: string;
  trend?: string;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={!href}
      onClick={() => href && router.push(href)}
      className={`
        group relative w-full text-left bg-white border border-slate-200
        rounded-2xl p-5 transition-all duration-200
        ${
          href
            ? "hover:border-emerald-200 hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
            : "cursor-default"
        }
      `}
    >
      <div className="flex items-start justify-between">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconClass}`}
        >
          <Icon className="w-[18px] h-[18px]" />
        </div>

        {href && (
          <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 transition-colors" />
        )}
      </div>

      <div className="mt-5">
        <p className="text-[13px] font-medium text-slate-500">{label}</p>

        <p className="mt-1 text-[28px] leading-none font-bold tracking-tight text-slate-900">
          {value === undefined ? (
            <span className="inline-block w-16 h-7 rounded-md bg-slate-100 animate-pulse" />
          ) : typeof value === "number" ? (
            value.toLocaleString()
          ) : (
            value
          )}
        </p>

        {(description || trend) && (
          <div className="flex items-center gap-2 mt-2">
            {description && (
              <p className="text-[12.5px] text-slate-400">{description}</p>
            )}

            {trend && (
              <>
                {description && (
                  <span className="w-1 h-1 rounded-full bg-slate-300" />
                )}
                <span className="text-[12.5px] font-semibold text-emerald-600">
                  {trend}
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </button>
  );
}

/** White surface with a hairline border. The container for lists and charts. */
export function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-white border border-slate-200 rounded-2xl overflow-hidden ${className}`}
    >
      {children}
    </div>
  );
}

export function PanelHeader({
  title,
  icon: Icon,
  action,
  onAction,
  meta,
}: {
  title: string;
  icon?: React.ElementType;
  action?: string;
  onAction?: () => void;
  /** Small element on the right, e.g. a count badge or refresh control. */
  meta?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
      <div className="flex items-center gap-2.5 min-w-0">
        {Icon && (
          <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0">
            <Icon className="w-4 h-4 text-slate-500" />
          </div>
        )}

        <h3 className="text-[15px] font-bold text-slate-900 truncate">
          {title}
        </h3>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        {meta}

        {action && onAction && (
          <button
            onClick={onAction}
            className="flex items-center gap-1 text-[13px] font-semibold text-emerald-700 hover:text-emerald-800"
          >
            {action}
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

/** Loading placeholder shaped like a list row. */
export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-50">
      <div className="w-9 h-9 rounded-xl bg-slate-100 animate-pulse" />

      <div className="flex-1">
        <div className="w-2/5 h-3 rounded bg-slate-100 animate-pulse mb-2" />
        <div className="w-3/5 h-2.5 rounded bg-slate-100 animate-pulse" />
      </div>

      <div className="w-14 h-5 rounded-full bg-slate-100 animate-pulse" />
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  message,
}: {
  icon: React.ElementType;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-5 text-center">
      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-slate-300" />
      </div>

      <p className="text-[13px] text-slate-400">{message}</p>
    </div>
  );
}

/**
 * Page heading. Names what is being looked at rather than greeting the reader —
 * the date and time already appear in the shell's top bar.
 */
export function PageHeading({
  eyebrow,
  title,
  actions,
}: {
  eyebrow: string;
  title: string;
  actions?: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <p className="text-[12.5px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
              {eyebrow}
            </p>
          </div>

          <h1 className="text-[27px] sm:text-[30px] font-bold tracking-tight text-slate-900 truncate">
            {title}
          </h1>
        </div>

        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
        )}
      </div>
    </section>
  );
}
