import React from 'react';
import { Icon } from '../core/Icon.jsx';

/* Screen header. Large title by default; pass onBack for a detail/back header.
   `right` slot takes IconButtons or a TrustBadge. */
export function ScreenHeader({
  title, subtitle, onBack, right, large = false, style, ...rest
}) {
  return (
    <header
      style={{
        display: 'flex', alignItems: large ? 'flex-end' : 'center', gap: 'var(--sp-3)',
        padding: large ? 'var(--sp-5) var(--screen-pad) var(--sp-3)' : '0 var(--screen-pad)',
        minHeight: large ? undefined : 56,
        background: 'var(--surface-bg)', ...style,
      }}
      {...rest}
    >
      {onBack && (
        <button
          type="button" onClick={onBack} aria-label="Back"
          style={{
            width: 40, height: 40, marginLeft: -8, flexShrink: 0, borderRadius: 'var(--r-md)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)',
          }}
        >
          <Icon name="arrow-left" size={22} strokeWidth={2.2} />
        </button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 style={{
          margin: 0, font: large ? 'var(--text-h1)' : 'var(--text-h2)',
          color: 'var(--text-primary)', letterSpacing: 'var(--ls-tight)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{title}</h1>
        {subtitle && (
          <div style={{ font: 'var(--text-meta)', color: 'var(--text-secondary)', marginTop: 2, fontWeight: 400 }}>{subtitle}</div>
        )}
      </div>
      {right && <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-1)', flexShrink: 0 }}>{right}</div>}
    </header>
  );
}
