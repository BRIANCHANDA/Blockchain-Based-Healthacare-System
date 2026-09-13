import React from 'react';

const PADS = { sm: 'var(--sp-3)', md: 'var(--sp-4)', lg: 'var(--sp-5)' };
const ELEV = { flat: 'none', low: 'var(--elev-1)', raised: 'var(--elev-2)' };

export function Card({
  children, padding = 'md', elevation = 'low', interactive = false,
  accent, onClick, style, ...rest
}) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      style={{
        position: 'relative',
        background: 'var(--surface-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)',
        padding: PADS[padding] || PADS.md,
        boxShadow: ELEV[elevation] ?? ELEV.low,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow var(--dur-base) var(--ease-standard), transform var(--dur-fast) var(--ease-standard)',
        overflow: 'hidden',
        ...style,
      }}
      onMouseDown={interactive ? (e) => { e.currentTarget.style.transform = 'scale(0.99)'; } : undefined}
      onMouseUp={interactive ? (e) => { e.currentTarget.style.transform = 'scale(1)'; } : undefined}
      onMouseLeave={interactive ? (e) => { e.currentTarget.style.transform = 'scale(1)'; } : undefined}
      {...rest}
    >
      {accent && (
        <span style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
          background: accent, borderTopLeftRadius: 'var(--r-lg)', borderBottomLeftRadius: 'var(--r-lg)',
        }} />
      )}
      {children}
    </div>
  );
}
