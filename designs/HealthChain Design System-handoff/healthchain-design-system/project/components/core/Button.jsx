import React from 'react';
import { Icon } from './Icon.jsx';

const SIZES = {
  sm: { height: 38, fontSize: 14, padding: '0 14px', gap: 7, icon: 16 },
  md: { height: 48, fontSize: 15, padding: '0 18px', gap: 8, icon: 18 },
  lg: { height: 54, fontSize: 16, padding: '0 22px', gap: 9, icon: 20 },
};

const VARIANTS = {
  primary: {
    background: 'var(--brand)', color: 'var(--on-brand)',
    border: '1px solid var(--brand)', boxShadow: 'var(--elev-brand)',
  },
  secondary: {
    background: 'var(--surface-card)', color: 'var(--text-primary)',
    border: '1px solid var(--border)', boxShadow: 'var(--elev-1)',
  },
  ghost: {
    background: 'transparent', color: 'var(--brand-deep)',
    border: '1px solid transparent', boxShadow: 'none',
  },
  tint: {
    background: 'var(--brand-fill)', color: 'var(--brand-deep)',
    border: '1px solid transparent', boxShadow: 'none',
  },
  destructive: {
    background: 'var(--critical)', color: '#fff',
    border: '1px solid var(--critical)', boxShadow: 'none',
  },
};

export function Button({
  children, variant = 'primary', size = 'md', iconLeft, iconRight,
  loading = false, disabled = false, fullWidth = false, onClick, style, ...rest
}) {
  const s = SIZES[size] || SIZES.md;
  const v = VARIANTS[variant] || VARIANTS.primary;
  const isDisabled = disabled || loading;

  return (
    <button
      type="button"
      onClick={isDisabled ? undefined : onClick}
      disabled={isDisabled}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        gap: s.gap, height: s.height, minHeight: s.height, padding: s.padding,
        width: fullWidth ? '100%' : undefined,
        font: `var(--fw-semibold) ${s.fontSize}px/1 var(--font-sans)`,
        borderRadius: 'var(--r-md)', cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.5 : 1,
        transition: 'transform var(--dur-fast) var(--ease-standard), filter var(--dur-fast) var(--ease-standard)',
        WebkitTapHighlightColor: 'transparent', whiteSpace: 'nowrap',
        ...v, ...style,
      }}
      onMouseDown={(e) => { if (!isDisabled) e.currentTarget.style.transform = 'scale(0.97)'; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      {...rest}
    >
      {loading
        ? <Icon name="activity" size={s.icon} />
        : (iconLeft && <Icon name={iconLeft} size={s.icon} />)}
      {children && <span>{children}</span>}
      {!loading && iconRight && <Icon name={iconRight} size={s.icon} />}
    </button>
  );
}
