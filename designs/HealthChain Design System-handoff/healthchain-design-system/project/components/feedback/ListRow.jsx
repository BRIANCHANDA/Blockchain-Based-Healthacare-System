import React from 'react';
import { Icon } from '../core/Icon.jsx';

/* Tappable list row — settings, grant lists, navigation. Leading icon tile,
   title + meta, optional right content + chevron. */
export function ListRow({
  icon, iconTone = 'neutral', title, meta, right, chevron = false,
  destructive = false, onClick, style, ...rest
}) {
  const tones = {
    neutral: { bg: 'var(--surface-inset)', fg: 'var(--text-secondary)' },
    brand:   { bg: 'var(--brand-tint)', fg: 'var(--brand-deep)' },
    info:    { bg: 'var(--info-tint)', fg: 'var(--info-ink)' },
    accent:  { bg: 'var(--accent-tint)', fg: 'var(--accent-ink)' },
    critical:{ bg: 'var(--critical-tint)', fg: 'var(--critical-ink)' },
  };
  const t = tones[destructive ? 'critical' : iconTone] || tones.neutral;
  return (
    <button
      type="button" onClick={onClick} disabled={!onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
        minHeight: 56, padding: 'var(--sp-3) var(--sp-4)', textAlign: 'left',
        background: 'var(--surface-card)', border: 'none', cursor: onClick ? 'pointer' : 'default',
        WebkitTapHighlightColor: 'transparent', ...style,
      }}
      {...rest}
    >
      {icon && (
        <div style={{
          width: 38, height: 38, borderRadius: 'var(--r-md)', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: t.bg, color: t.fg,
        }}>
          <Icon name={icon} size={19} strokeWidth={2.1} />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: 'var(--fw-semibold) 15px/1.3 var(--font-sans)', color: destructive ? 'var(--critical-ink)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
        {meta && <div style={{ font: 'var(--text-meta)', fontWeight: 400, color: 'var(--text-secondary)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta}</div>}
      </div>
      {right && <div style={{ flexShrink: 0, color: 'var(--text-secondary)', font: 'var(--text-meta)' }}>{right}</div>}
      {chevron && <Icon name="chevron-right" size={20} color="var(--text-muted)" style={{ flexShrink: 0 }} />}
    </button>
  );
}
