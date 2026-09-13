import React from 'react';
import { Icon } from '../core/Icon.jsx';

/* A single vital reading: label, value + unit, optional delta vs previous,
   and a critical flag (color + icon + position, never color alone). */
export function VitalStat({
  label, value, unit, delta, deltaDir, critical = false, icon, compact = false, style, ...rest
}) {
  const dirColor = deltaDir === 'up' ? 'var(--critical-ink)'
    : deltaDir === 'down' ? 'var(--success-ink)' : 'var(--text-muted)';
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', gap: 6,
        padding: compact ? 'var(--sp-3)' : 'var(--sp-4)',
        borderRadius: 'var(--r-md)',
        background: critical ? 'var(--critical-tint)' : 'var(--surface-card)',
        border: `1px solid ${critical ? 'color-mix(in srgb, var(--critical) 26%, transparent)' : 'var(--border)'}`,
        ...style,
      }}
      {...rest}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {icon && <Icon name={icon} size={15} color={critical ? 'var(--critical-ink)' : 'var(--text-muted)'} strokeWidth={2.2} />}
        <span style={{ font: 'var(--text-label)', letterSpacing: '0.02em', textTransform: 'uppercase', color: critical ? 'var(--critical-ink)' : 'var(--text-muted)' }}>{label}</span>
        {critical && <Icon name="alert-triangle" size={14} color="var(--critical)" strokeWidth={2.4} style={{ marginLeft: 'auto' }} />}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ font: `var(--fw-bold) ${compact ? 22 : 26}px/1 var(--font-sans)`, color: critical ? 'var(--critical-ink)' : 'var(--text-primary)', letterSpacing: '-0.02em' }}>{value}</span>
        {unit && <span style={{ font: 'var(--fw-medium) 13px/1 var(--font-sans)', color: 'var(--text-muted)' }}>{unit}</span>}
      </div>
      {delta != null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, font: 'var(--fw-semibold) 12px/1 var(--font-sans)', color: dirColor }}>
          {deltaDir && deltaDir !== 'flat' && <Icon name={deltaDir === 'up' ? 'trending-up' : 'trending-down'} size={14} strokeWidth={2.2} />}
          {delta}
        </div>
      )}
    </div>
  );
}
