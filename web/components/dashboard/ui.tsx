"use client";

import React, { useState, forwardRef } from "react";
import { ChevronRight, Loader2, X } from "lucide-react";

/* ==========================================================================
   Shared dashboard primitives — HealthChain design system.

   Every value here resolves to a token declared in app/design-tokens.css.
   Nothing in this file hard-codes a colour, radius or shadow, so restyling
   the product is a change to the token layer rather than to components.

   These are deliberately plain inline-style components rather than Tailwind
   classes: the design ships exact pixel values (a 274px sidebar, a 22px pill,
   a 38px control) that Tailwind's scale rounds off, and the token variables
   cannot be interpolated into class names at build time.
   ========================================================================== */

/* ── Tone system ──────────────────────────────────────────────────────────
   A tone maps a semantic meaning to a (text, tint, dot) triple. Components
   take a tone name instead of colours, so a status keeps the same meaning
   everywhere it is rendered.
   ─────────────────────────────────────────────────────────────────────── */
export type Tone =
  | "brand"
  | "success"
  | "info"
  | "urgent"
  | "critical"
  | "accent"
  | "neutral";

export const TONES: Record<Tone, { ink: string; tint: string; dot: string }> = {
  brand: { ink: "var(--green-700)", tint: "var(--brand-tint)", dot: "var(--brand)" },
  success: { ink: "var(--success-ink)", tint: "var(--success-tint)", dot: "var(--green-600)" },
  info: { ink: "var(--info-ink)", tint: "var(--info-tint)", dot: "var(--blue-500)" },
  urgent: { ink: "var(--urgent-ink)", tint: "var(--urgent-tint)", dot: "var(--amber-500)" },
  critical: { ink: "var(--critical-ink)", tint: "var(--critical-tint)", dot: "var(--coral-500)" },
  accent: { ink: "var(--accent-ink)", tint: "var(--accent-tint)", dot: "var(--violet-500)" },
  neutral: { ink: "var(--text-secondary)", tint: "var(--surface-sunken)", dot: "var(--ink-400)" },
};

/* ── Page scaffold ───────────────────────────────────────────────────────── */

/** Standard page wrapper: caps line length and sets the vertical rhythm. */
export function Page({
  children,
  maxWidth = 1360,
  gap = 18,
}: {
  children: React.ReactNode;
  maxWidth?: number;
  gap?: number;
}) {
  return (
    <div
      style={{
        maxWidth,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Page header. `eyebrow` names the section in small caps, `title` is the one
 * thing the page is about, `subtitle` carries live counts and timestamps.
 */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between flex-wrap" style={{ gap: 16 }}>
      <div className="min-w-0 flex flex-col" style={{ gap: 7 }}>
        {eyebrow && (
          <p
            style={{
              margin: 0,
              font: "700 10.5px/1 var(--font-sans)",
              letterSpacing: "var(--ls-caps)",
              textTransform: "uppercase",
              color: "var(--green-700)",
            }}
          >
            {eyebrow}
          </p>
        )}
        <h1
          style={{
            margin: 0,
            font: "700 27px/1.1 var(--font-sans)",
            letterSpacing: "var(--ls-tight)",
            color: "var(--text-primary)",
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              margin: 0,
              font: "400 13.5px/1.4 var(--font-sans)",
              color: "var(--text-secondary)",
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center flex-wrap" style={{ gap: 10 }}>
          {actions}
        </div>
      )}
    </div>
  );
}

/** Small uppercase label used above a group of fields or a list. */
export function SectionLabel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <p
      style={{
        margin: 0,
        font: "700 10px/1 var(--font-sans)",
        letterSpacing: "var(--ls-caps)",
        textTransform: "uppercase",
        color: "var(--text-muted)",
        ...style,
      }}
    >
      {children}
    </p>
  );
}

/* ── Surfaces ────────────────────────────────────────────────────────────── */

export function Card({
  children,
  pad = 0,
  style,
  className,
}: {
  children: React.ReactNode;
  pad?: number | string;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        background: "var(--surface-card)",
        border: "1px solid var(--hc-border)",
        borderRadius: "var(--r-md)",
        boxShadow: "var(--elev-1)",
        overflow: "hidden",
        padding: pad || undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Card header: icon chip, title, optional subtitle, right-aligned slot. */
export function CardHeader({
  icon: Icon,
  title,
  subtitle,
  tone = "brand",
  right,
}: {
  icon?: React.ElementType;
  title: string;
  subtitle?: React.ReactNode;
  tone?: Tone;
  right?: React.ReactNode;
}) {
  const t = TONES[tone];
  return (
    <div
      className="flex items-center justify-between"
      style={{
        gap: 16,
        padding: "16px 20px",
        borderBottom: "1px solid var(--border-faint)",
      }}
    >
      <div className="flex items-center min-w-0" style={{ gap: 12 }}>
        {Icon && (
          <span
            className="inline-flex items-center justify-center flex-shrink-0"
            style={{
              width: 34,
              height: 34,
              borderRadius: "var(--r-sm)",
              background: t.tint,
              color: t.ink,
            }}
          >
            <Icon className="w-[17px] h-[17px]" />
          </span>
        )}
        <div className="min-w-0 flex flex-col" style={{ gap: 4 }}>
          <p
            className="truncate"
            style={{
              margin: 0,
              font: "700 15px/1 var(--font-sans)",
              color: "var(--text-primary)",
            }}
          >
            {title}
          </p>
          {subtitle && (
            <p
              className="truncate"
              style={{
                margin: 0,
                font: "500 12px/1 var(--font-sans)",
                color: "var(--text-muted)",
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {right && <div className="flex items-center flex-shrink-0" style={{ gap: 14 }}>{right}</div>}
    </div>
  );
}

/* ── KPI ─────────────────────────────────────────────────────────────────── */

export function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "brand",
  loading,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon: React.ElementType;
  tone?: Tone;
  loading?: boolean;
  onClick?: () => void;
}) {
  const t = TONES[tone];
  return (
    <div
      onClick={onClick}
      style={{
        padding: "16px 18px 18px",
        background: "var(--surface-card)",
        border: "1px solid var(--hc-border)",
        borderRadius: "var(--r-md)",
        boxShadow: "var(--elev-1)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        cursor: onClick ? "pointer" : undefined,
        transition: "box-shadow var(--dur-base) var(--ease-standard)",
      }}
      onMouseEnter={(e) => {
        if (onClick) e.currentTarget.style.boxShadow = "var(--elev-2)";
      }}
      onMouseLeave={(e) => {
        if (onClick) e.currentTarget.style.boxShadow = "var(--elev-1)";
      }}
    >
      <div className="flex items-center justify-between" style={{ gap: 10 }}>
        <SectionLabel style={{ fontSize: 11 }}>{label}</SectionLabel>
        <span
          className="inline-flex items-center justify-center flex-shrink-0"
          style={{
            width: 30,
            height: 30,
            borderRadius: "var(--r-xs)",
            background: t.tint,
            color: t.ink,
          }}
        >
          <Icon className="w-4 h-4" />
        </span>
      </div>

      <p
        style={{
          margin: 0,
          font: "700 32px/1 var(--font-sans)",
          letterSpacing: "var(--ls-tight)",
          color: "var(--text-primary)",
        }}
      >
        {loading ? (
          <span
            className="inline-block animate-pulse"
            style={{
              width: 40,
              height: 28,
              borderRadius: 6,
              background: "var(--surface-sunken)",
            }}
          />
        ) : (
          value
        )}
      </p>

      {sub && (
        <p style={{ margin: 0, font: "400 12px/1 var(--font-sans)", color: "var(--text-muted)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

/** Responsive KPI row — cards reflow rather than squash on narrow screens. */
export function KpiGrid({
  children,
  min = 210,
}: {
  children: React.ReactNode;
  min?: number;
}) {
  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`,
        gap: 14,
      }}
    >
      {children}
    </section>
  );
}

/* ── Pills & badges ──────────────────────────────────────────────────────── */

export function Pill({
  children,
  tone = "neutral",
  dot = false,
  icon: Icon,
  style,
}: {
  children: React.ReactNode;
  tone?: Tone;
  dot?: boolean;
  icon?: React.ElementType;
  style?: React.CSSProperties;
}) {
  const t = TONES[tone];
  return (
    <span
      className="inline-flex items-center flex-shrink-0"
      style={{
        gap: 5,
        height: 22,
        padding: "0 10px",
        borderRadius: "var(--r-pill)",
        background: t.tint,
        color: t.ink,
        font: "700 11px/1 var(--font-sans)",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {dot && (
        <span
          style={{ width: 6, height: 6, borderRadius: "50%", background: t.dot, flexShrink: 0 }}
        />
      )}
      {Icon && <Icon className="w-3 h-3" />}
      {children}
    </span>
  );
}

/** Monospace tag for machine-readable values: IDs, visit numbers, hashes. */
export function MonoTag({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className="inline-flex items-center flex-shrink-0"
      style={{
        height: 20,
        padding: "0 8px",
        borderRadius: "var(--r-xs)",
        background: "var(--surface-sunken)",
        color: "var(--text-secondary)",
        font: "500 11px/1 var(--font-mono)",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/** Circular initials avatar. `seed` picks a stable tone per person. */
const AV_TINT = ["var(--blue-100)", "var(--green-100)", "var(--violet-100)", "var(--amber-100)"];
const AV_INK = ["var(--blue-600)", "var(--success-ink)", "var(--accent-ink)", "var(--urgent-ink)"];

export function Avatar({
  name,
  size = 32,
  seed = 0,
}: {
  name: string;
  size?: number;
  seed?: number;
}) {
  const initials =
    name
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";
  const i = Math.abs(seed) % AV_TINT.length;
  return (
    <span
      className="inline-flex items-center justify-center flex-shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: AV_TINT[i],
        color: AV_INK[i],
        font: `600 ${Math.round(size * 0.375)}px/1 var(--font-sans)`,
      }}
    >
      {initials}
    </span>
  );
}

/* ── Buttons ─────────────────────────────────────────────────────────────── */

type BtnVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  children,
  variant = "secondary",
  size = "md",
  icon: Icon,
  iconRight: IconRight,
  loading,
  disabled,
  onClick,
  type = "button",
  full,
  style,
}: {
  children?: React.ReactNode;
  variant?: BtnVariant;
  size?: "sm" | "md" | "lg";
  icon?: React.ElementType;
  iconRight?: React.ElementType;
  loading?: boolean;
  disabled?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: "button" | "submit";
  full?: boolean;
  style?: React.CSSProperties;
}) {
  const dims = {
    sm: { h: 30, px: 11, fs: 12 },
    md: { h: 38, px: 16, fs: 13.5 },
    lg: { h: 44, px: 20, fs: 14.5 },
  }[size];

  const skin: Record<BtnVariant, React.CSSProperties> = {
    primary: {
      background: "var(--brand)",
      color: "var(--on-brand)",
      border: "none",
      boxShadow: "var(--elev-brand)",
    },
    secondary: {
      background: "var(--surface-card)",
      color: "var(--text-primary)",
      border: "1px solid var(--hc-border)",
      boxShadow: "var(--elev-1)",
    },
    ghost: {
      background: "transparent",
      color: "var(--text-secondary)",
      border: "none",
      boxShadow: "none",
    },
    danger: {
      background: "var(--coral-050)",
      color: "var(--critical-ink)",
      border: "1px solid var(--coral-100)",
      boxShadow: "none",
    },
  };

  const isOff = disabled || loading;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isOff}
      className="inline-flex items-center justify-center"
      style={{
        gap: 7,
        height: dims.h,
        padding: children ? `0 ${dims.px}px` : 0,
        width: children ? (full ? "100%" : undefined) : dims.h,
        borderRadius: "var(--r-md)",
        font: `600 ${dims.fs}px/1 var(--font-sans)`,
        cursor: isOff ? "not-allowed" : "pointer",
        opacity: isOff ? 0.55 : 1,
        whiteSpace: "nowrap",
        transition: "opacity var(--dur-fast) var(--ease-standard)",
        ...skin[variant],
        ...style,
      }}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        Icon && <Icon className="w-4 h-4 flex-shrink-0" />
      )}
      {children}
      {IconRight && !loading && <IconRight className="w-4 h-4 flex-shrink-0" />}
    </button>
  );
}

/** Text link styled as the brand-green inline action used across the design. */
export function LinkAction({
  children,
  onClick,
  arrow = true,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  arrow?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center"
      style={{
        gap: 3,
        border: "none",
        background: "transparent",
        padding: 0,
        font: "600 12.5px/1 var(--font-sans)",
        color: "var(--green-700)",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {children}
      {arrow && <ChevronRight className="w-3.5 h-3.5" />}
    </button>
  );
}

/* ── Form controls ───────────────────────────────────────────────────────── */

/**
 * Field wrapper. `required` renders the asterisk; `error` replaces the hint
 * so a field never shows contradictory guidance and validation at once.
 */
export function Field({
  label,
  required,
  hint,
  error,
  children,
  style,
}: {
  label?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div className="flex flex-col" style={{ gap: 6, minWidth: 0, ...style }}>
      {label && (
        <label
          style={{
            font: "600 12px/1 var(--font-sans)",
            color: "var(--text-secondary)",
          }}
        >
          {label}
          {required && <span style={{ color: "var(--coral-500)", marginLeft: 3 }}>*</span>}
        </label>
      )}
      {children}
      {(error || hint) && (
        <p
          style={{
            margin: 0,
            font: "400 11.5px/1.3 var(--font-sans)",
            color: error ? "var(--critical-ink)" : "var(--text-muted)",
          }}
        >
          {error || hint}
        </p>
      )}
    </div>
  );
}

/* Shared control chrome. Focus is applied via React state rather than :focus
   because inline styles carry no pseudo-classes. */
function useFocusRing(invalid?: boolean) {
  const [focused, setFocused] = useState(false);
  const base: React.CSSProperties = {
    width: "100%",
    height: 40,
    padding: "0 12px",
    borderRadius: "var(--r-sm)",
    border: `1px solid ${
      invalid ? "var(--coral-500)" : focused ? "var(--brand)" : "var(--hc-border)"
    }`,
    background: "var(--surface-card)",
    font: "400 13.5px/1 var(--font-sans)",
    color: "var(--text-primary)",
    outline: "none",
    boxShadow: focused ? "0 0 0 3px var(--focus-ring)" : "none",
    transition: "border-color var(--dur-fast), box-shadow var(--dur-fast)",
  };
  return {
    base,
    handlers: { onFocus: () => setFocused(true), onBlur: () => setFocused(false) },
  };
}

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
>(function Input({ invalid, style, onFocus, onBlur, ...rest }, ref) {
  const { base, handlers } = useFocusRing(invalid);
  return (
    <input
      ref={ref}
      {...rest}
      onFocus={(e) => {
        handlers.onFocus();
        onFocus?.(e);
      }}
      onBlur={(e) => {
        handlers.onBlur();
        onBlur?.(e);
      }}
      style={{ ...base, ...style }}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
>(function Select({ invalid, style, onFocus, onBlur, children, ...rest }, ref) {
  const { base, handlers } = useFocusRing(invalid);
  return (
    <select
      ref={ref}
      {...rest}
      onFocus={(e) => {
        handlers.onFocus();
        onFocus?.(e);
      }}
      onBlur={(e) => {
        handlers.onBlur();
        onBlur?.(e);
      }}
      style={{ ...base, cursor: "pointer", appearance: "none", paddingRight: 30, ...style }}
    >
      {children}
    </select>
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ invalid, style, onFocus, onBlur, ...rest }, ref) {
  const { base, handlers } = useFocusRing(invalid);
  return (
    <textarea
      ref={ref}
      {...rest}
      onFocus={(e) => {
        handlers.onFocus();
        onFocus?.(e);
      }}
      onBlur={(e) => {
        handlers.onBlur();
        onBlur?.(e);
      }}
      style={{
        ...base,
        height: "auto",
        minHeight: 88,
        padding: "10px 12px",
        lineHeight: 1.5,
        resize: "vertical",
        ...style,
      }}
    />
  );
});

/** Search box with a leading icon and an optional clear affordance. */
export function SearchInput({
  value,
  onChange,
  onClear,
  placeholder,
  icon: Icon,
  clearIcon: ClearIcon,
  style,
}: {
  value: string;
  onChange: (v: string) => void;
  onClear?: () => void;
  placeholder?: string;
  icon: React.ElementType;
  clearIcon?: React.ElementType;
  style?: React.CSSProperties;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div
      className="relative flex items-center"
      style={{
        height: 38,
        borderRadius: "var(--r-md)",
        border: `1px solid ${focused ? "var(--brand)" : "var(--hc-border)"}`,
        background: "var(--surface-card)",
        boxShadow: focused ? `0 0 0 3px var(--focus-ring)` : "var(--elev-1)",
        transition: "border-color var(--dur-fast), box-shadow var(--dur-fast)",
        ...style,
      }}
    >
      <Icon
        className="w-4 h-4 flex-shrink-0"
        style={{ marginLeft: 12, color: "var(--text-muted)" }}
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        style={{
          flex: 1,
          minWidth: 0,
          height: "100%",
          padding: "0 10px",
          border: "none",
          outline: "none",
          background: "transparent",
          font: "400 13.5px/1 var(--font-sans)",
          color: "var(--text-primary)",
        }}
      />
      {value && ClearIcon && (
        <button
          onClick={() => (onClear ? onClear() : onChange(""))}
          className="inline-flex items-center justify-center flex-shrink-0"
          style={{
            width: 26,
            height: 26,
            marginRight: 6,
            border: "none",
            borderRadius: "var(--r-xs)",
            background: "transparent",
            color: "var(--text-muted)",
            cursor: "pointer",
          }}
        >
          <ClearIcon className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

/** Segmented filter control — replaces rows of loose pill buttons. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      className="inline-flex items-center flex-wrap"
      style={{
        gap: 2,
        padding: 3,
        borderRadius: "var(--r-md)",
        background: "var(--surface-sunken)",
        border: "1px solid var(--border-faint)",
      }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className="inline-flex items-center"
            style={{
              gap: 6,
              height: 30,
              padding: "0 12px",
              border: "none",
              borderRadius: "var(--r-xs)",
              background: on ? "var(--surface-card)" : "transparent",
              boxShadow: on ? "var(--elev-1)" : "none",
              color: on ? "var(--text-primary)" : "var(--text-muted)",
              font: `${on ? 700 : 500} 12.5px/1 var(--font-sans)`,
              cursor: "pointer",
              transition: "all var(--dur-fast) var(--ease-standard)",
            }}
          >
            {o.label}
            {o.count !== undefined && (
              <span
                style={{
                  minWidth: 18,
                  padding: "0 5px",
                  borderRadius: "var(--r-pill)",
                  background: on ? "var(--brand-tint)" : "var(--surface-card)",
                  color: on ? "var(--green-700)" : "var(--text-muted)",
                  font: "700 10.5px/18px var(--font-sans)",
                  textAlign: "center",
                }}
              >
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ── Feedback ────────────────────────────────────────────────────────────── */

/** Full-width notice. The left bar carries the tone at a glance. */
export function Banner({
  tone = "info",
  icon: Icon,
  title,
  children,
  action,
  onClick,
}: {
  tone?: Tone;
  icon?: React.ElementType;
  title?: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  onClick?: () => void;
}) {
  const t = TONES[tone];
  return (
    <div
      onClick={onClick}
      className="flex items-center"
      style={{
        gap: 12,
        padding: "14px 16px",
        border: "1px solid var(--border-faint)",
        borderLeft: `4px solid ${t.dot}`,
        borderRadius: "var(--r-md)",
        background: t.tint,
        cursor: onClick ? "pointer" : undefined,
      }}
    >
      {Icon && (
        <Icon className="w-[18px] h-[18px] flex-shrink-0" style={{ color: t.ink }} />
      )}
      <div className="flex-1 min-w-0 flex flex-col" style={{ gap: 3 }}>
        {title && (
          <p style={{ margin: 0, font: "700 13.5px/1.3 var(--font-sans)", color: t.ink }}>
            {title}
          </p>
        )}
        {children && (
          <p
            style={{
              margin: 0,
              font: "400 12.5px/1.45 var(--font-sans)",
              color: t.ink,
              opacity: 0.9,
            }}
          >
            {children}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  message,
  action,
  tone = "brand",
  pad = 48,
}: {
  icon: React.ElementType;
  title: string;
  message?: string;
  action?: React.ReactNode;
  tone?: Tone;
  pad?: number;
}) {
  const t = TONES[tone];
  return (
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{ padding: `${pad}px 20px` }}
    >
      <span
        className="inline-flex items-center justify-center"
        style={{
          width: 44,
          height: 44,
          borderRadius: "var(--r-sm)",
          background: t.tint,
          color: t.ink,
          marginBottom: 12,
        }}
      >
        <Icon className="w-5 h-5" />
      </span>
      <p style={{ margin: 0, font: "600 13.5px/1 var(--font-sans)", color: "var(--text-secondary)" }}>
        {title}
      </p>
      {message && (
        <p
          style={{
            margin: "6px 0 0",
            maxWidth: 340,
            font: "400 12.5px/1.5 var(--font-sans)",
            color: "var(--text-muted)",
          }}
        >
          {message}
        </p>
      )}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

/** Loading placeholder shaped like a list row, so layout does not jump. */
export function SkeletonRow({ height = 14 }: { height?: number }) {
  return (
    <div
      className="flex items-center animate-pulse"
      style={{
        gap: 14,
        padding: "14px 20px",
        borderBottom: "1px solid var(--border-faint)",
      }}
    >
      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--surface-sunken)" }} />
      <div className="flex-1 flex flex-col" style={{ gap: 6 }}>
        <div style={{ width: "40%", height: height - 3, borderRadius: 4, background: "var(--surface-sunken)" }} />
        <div style={{ width: "62%", height: height - 5, borderRadius: 4, background: "var(--surface-sunken)" }} />
      </div>
      <div style={{ width: 70, height: 20, borderRadius: 999, background: "var(--surface-sunken)" }} />
    </div>
  );
}

export function SkeletonBlock({
  height = 96,
  radius = "var(--r-sm)",
}: {
  height?: number;
  radius?: string;
}) {
  return (
    <div
      className="animate-pulse"
      style={{ height, borderRadius: radius, background: "var(--surface-sunken)" }}
    />
  );
}

/* ── Overlays ────────────────────────────────────────────────────────────── */

/**
 * Centred modal dialog. `scroll` caps the body at 90vh and scrolls it
 * internally so a long form keeps its header and footer visible.
 */
export function Modal({
  title,
  subtitle,
  icon: Icon,
  tone = "brand",
  width = 440,
  onClose,
  children,
  footer,
  scroll = false,
  closeOnBackdrop = false,
}: {
  title: string;
  subtitle?: React.ReactNode;
  icon?: React.ElementType;
  tone?: Tone;
  width?: number;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  scroll?: boolean;
  /**
   * Dismiss when the backdrop is clicked. Off by default: a modal holding a
   * part-filled form should not discard it on a stray click. Opt in for
   * dialogs where nothing is lost by closing.
   */
  closeOnBackdrop?: boolean;
}) {
  const t = TONES[tone];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={closeOnBackdrop ? onClose : undefined}
      style={{
        padding: 16,
        background: "var(--scrim)",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        className="w-full flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: width,
          maxHeight: scroll ? "90vh" : undefined,
          background: "var(--surface-card)",
          borderRadius: "var(--r-md)",
          border: "1px solid var(--hc-border)",
          boxShadow: "var(--elev-3)",
          overflow: "hidden",
        }}
      >
        <div
          className="flex items-center justify-between flex-shrink-0"
          style={{
            gap: 12,
            padding: "14px 20px",
            borderBottom: "1px solid var(--border-faint)",
          }}
        >
          <div className="flex items-center min-w-0" style={{ gap: 11 }}>
            {Icon && (
              <span
                className="inline-flex items-center justify-center flex-shrink-0"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "var(--r-xs)",
                  background: t.tint,
                  color: t.ink,
                }}
              >
                <Icon className="w-4 h-4" />
              </span>
            )}
            <div className="min-w-0 flex flex-col" style={{ gap: 3 }}>
              <p
                className="truncate"
                style={{
                  margin: 0,
                  font: "700 15px/1 var(--font-sans)",
                  color: "var(--text-primary)",
                }}
              >
                {title}
              </p>
              {subtitle && (
                <p
                  className="truncate"
                  style={{
                    margin: 0,
                    font: "400 12px/1 var(--font-sans)",
                    color: "var(--text-muted)",
                  }}
                >
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center flex-shrink-0"
            style={{
              width: 30,
              height: 30,
              border: "none",
              borderRadius: "var(--r-xs)",
              background: "transparent",
              color: "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div
          style={{
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 14,
            overflowY: scroll ? "auto" : undefined,
            flex: scroll ? 1 : undefined,
            minHeight: 0,
          }}
        >
          {children}
        </div>

        {footer && (
          <div
            className="flex flex-shrink-0"
            style={{
              gap: 12,
              padding: "14px 20px",
              borderTop: "1px solid var(--border-faint)",
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/** Transient confirmation, bottom-right. Callers own the dismiss timer. */
export function Toast({
  message,
  icon: Icon,
  tone = "success",
}: {
  message: string;
  icon?: React.ElementType;
  tone?: Tone;
}) {
  const t = TONES[tone];
  return (
    <div
      className="fixed z-50 flex items-center"
      style={{
        bottom: 24,
        right: 24,
        gap: 10,
        padding: "13px 18px",
        borderRadius: "var(--r-md)",
        background: "var(--surface-card)",
        border: "1px solid var(--hc-border)",
        boxShadow: "var(--elev-3)",
      }}
    >
      {Icon && <Icon className="w-4 h-4 flex-shrink-0" style={{ color: t.ink }} />}
      <p
        style={{
          margin: 0,
          font: "600 13.5px/1 var(--font-sans)",
          color: "var(--text-primary)",
        }}
      >
        {message}
      </p>
    </div>
  );
}

/* ── Data display ────────────────────────────────────────────────────────── */

/** Label/value pair used throughout patient and visit detail panels. */
export function DataRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div
      className="flex items-baseline justify-between"
      style={{ gap: 16, padding: "9px 0", borderBottom: "1px solid var(--border-faint)" }}
    >
      <span
        className="flex-shrink-0"
        style={{ font: "500 12.5px/1.3 var(--font-sans)", color: "var(--text-muted)" }}
      >
        {label}
      </span>
      <span
        className="text-right min-w-0"
        style={{
          font: mono
            ? "500 12.5px/1.3 var(--font-mono)"
            : "600 13px/1.3 var(--font-sans)",
          color: "var(--text-primary)",
          wordBreak: "break-word",
        }}
      >
        {value ?? "—"}
      </span>
    </div>
  );
}

/** Horizontal tab strip with an underline indicator. */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { value: T; label: string; icon?: React.ElementType; count?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      className="flex items-center overflow-x-auto"
      style={{ gap: 2, borderBottom: "1px solid var(--hc-border)" }}
    >
      {tabs.map((t) => {
        const on = t.value === value;
        return (
          <button
            key={t.value}
            onClick={() => onChange(t.value)}
            className="inline-flex items-center flex-shrink-0"
            style={{
              gap: 7,
              height: 42,
              padding: "0 14px",
              border: "none",
              borderBottom: `2px solid ${on ? "var(--brand)" : "transparent"}`,
              background: "transparent",
              color: on ? "var(--text-primary)" : "var(--text-muted)",
              font: `${on ? 700 : 500} 13px/1 var(--font-sans)`,
              cursor: "pointer",
              marginBottom: -1,
              transition: "color var(--dur-fast) var(--ease-standard)",
            }}
          >
            {t.icon && <t.icon className="w-4 h-4" />}
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span
                style={{
                  minWidth: 18,
                  padding: "0 5px",
                  borderRadius: "var(--r-pill)",
                  background: on ? "var(--brand-tint)" : "var(--surface-sunken)",
                  color: on ? "var(--green-700)" : "var(--text-muted)",
                  font: "700 10.5px/18px var(--font-sans)",
                  textAlign: "center",
                }}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Row hover tint, shared so every list in the product highlights alike. */
export const hoverRow = {
  onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.background = "var(--green-050)";
  },
  onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.background = "transparent";
  },
};
