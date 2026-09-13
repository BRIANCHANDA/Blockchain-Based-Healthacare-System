import React from 'react';
import { Icon } from './Icon.jsx';

const SIZES = { sm: 36, md: 44, lg: 48 };

export function IconButton({
  icon, size = 'md', variant = 'ghost', label, onClick, badge = false, style, ...rest
}) {
  const dim = SIZES[size] || SIZES.md;
  const variants = {
    ghost: { background: 'transparent', color: 'var(--text-secondary)', border: '1px solid transparent' },
    surface: { background: 'var(--surface-card)', color: 'var(--text-primary)', border: '1px solid var(--border)' },
    tint: { background: 'var(--brand-fill)', color: 'var(--brand-deep)', border: '1px solid transparent' },
  };
  return (
    <button
      type="button" onClick={onClick} aria-label={label}
      style={{
        position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: dim, height: dim, borderRadius: 'var(--r-md)', cursor: 'pointer',
        transition: 'background var(--dur-fast) var(--ease-standard)',
        WebkitTapHighlightColor: 'transparent',
        ...(variants[variant] || variants.ghost), ...style,
      }}
      {...rest}
    >
      <Icon name={icon} size={size === 'sm' ? 18 : 20} />
      {badge && (
        <span style={{
          position: 'absolute', top: 8, right: 8, width: 8, height: 8,
          borderRadius: '50%', background: 'var(--critical)', border: '2px solid var(--surface-card)',
        }} />
      )}
    </button>
  );
}
