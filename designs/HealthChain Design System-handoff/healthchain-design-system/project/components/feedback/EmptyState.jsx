import React from 'react';
import { Icon } from '../core/Icon.jsx';

/* Empty / loading / error states. One component, three modes. */
export function EmptyState({
  mode = 'empty', icon = 'file-text', title, body, action, style, ...rest
}) {
  const tone = mode === 'error' ? 'var(--critical)' : 'var(--text-muted)';
  const bg = mode === 'error' ? 'var(--critical-tint)' : 'var(--surface-inset)';
  const showIcon = mode === 'loading' ? 'activity' : (mode === 'error' ? 'alert-triangle' : icon);
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
        padding: 'var(--sp-10) var(--sp-6)', gap: 'var(--sp-2)', ...style,
      }}
      {...rest}
    >
      <div style={{
        width: 64, height: 64, borderRadius: 'var(--r-xl)', marginBottom: 'var(--sp-2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: bg, color: tone,
        animation: mode === 'loading' ? 'hc-pulse 1.4s var(--ease-standard) infinite' : 'none',
      }}>
        <Icon name={showIcon} size={28} strokeWidth={1.8} />
      </div>
      <div style={{ font: 'var(--text-h3)', color: 'var(--text-primary)' }}>{title}</div>
      {body && (
        <div style={{ font: 'var(--text-body)', color: 'var(--text-secondary)', maxWidth: 280, textWrap: 'pretty' }}>{body}</div>
      )}
      {action && <div style={{ marginTop: 'var(--sp-3)' }}>{action}</div>}
      <style>{`@keyframes hc-pulse{0%,100%{opacity:1}50%{opacity:.45}}`}</style>
    </div>
  );
}
