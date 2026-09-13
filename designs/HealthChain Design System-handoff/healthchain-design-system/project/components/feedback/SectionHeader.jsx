import React from 'react';
import { Icon } from '../core/Icon.jsx';

/* Section header inside a screen — small overline + count, optional action. */
export function SectionHeader({ title, count, icon, action, style, ...rest }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--sp-2)',
        margin: '0 0 var(--sp-3)', ...style,
      }}
      {...rest}
    >
      {icon && (
        <div style={{
          width: 28, height: 28, borderRadius: 'var(--r-sm)', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--brand-tint)', color: 'var(--brand-deep)',
        }}>
          <Icon name={icon} size={16} strokeWidth={2.2} />
        </div>
      )}
      <h2 style={{ margin: 0, font: 'var(--text-h3)', color: 'var(--text-primary)' }}>{title}</h2>
      {count != null && (
        <span style={{
          minWidth: 22, height: 22, padding: '0 7px', borderRadius: 'var(--r-pill)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--surface-inset)', color: 'var(--text-secondary)',
          font: 'var(--fw-bold) 12px/1 var(--font-sans)',
        }}>{count}</span>
      )}
      {action && <div style={{ marginLeft: 'auto' }}>{action}</div>}
    </div>
  );
}
