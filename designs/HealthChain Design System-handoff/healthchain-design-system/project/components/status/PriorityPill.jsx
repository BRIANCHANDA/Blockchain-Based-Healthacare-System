import React from 'react';
import { Icon } from '../core/Icon.jsx';

/* Priority escalates: routine -> urgent -> emergency -> critical.
   Icon weight + fill escalate with severity so it reads without color too. */
const PRIORITY = {
  routine:   { label: 'Routine', tone: 'neutral', icon: 'check' },
  urgent:    { label: 'Urgent', tone: 'urgent', icon: 'alert-triangle' },
  emergency: { label: 'Emergency', tone: 'critical', icon: 'alert-octagon' },
  critical:  { label: 'Critical', tone: 'critical', icon: 'alert-octagon' },
};

const TONES = {
  neutral:  { bg: 'var(--locked-tint)', fg: 'var(--locked)', solid: 'var(--locked)' },
  urgent:   { bg: 'var(--urgent-tint)', fg: 'var(--urgent-ink)', solid: 'var(--urgent)' },
  critical: { bg: 'var(--critical-tint)', fg: 'var(--critical-ink)', solid: 'var(--critical)' },
};

export function PriorityPill({ priority, size = 'md', style, ...rest }) {
  const cfg = PRIORITY[priority] || PRIORITY.routine;
  const tone = TONES[cfg.tone];
  const critical = priority === 'critical';
  const sm = size === 'sm';
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: sm ? 4 : 5,
        height: sm ? 22 : 26, padding: sm ? '0 8px' : '0 10px',
        borderRadius: 'var(--r-pill)',
        background: critical ? tone.solid : tone.bg,
        color: critical ? '#fff' : tone.fg,
        border: critical ? 'none' : `1px solid ${tone.bg}`,
        font: `var(--fw-bold) ${sm ? 11 : 12}px/1 var(--font-sans)`,
        letterSpacing: '0.01em', textTransform: 'uppercase',
        whiteSpace: 'nowrap', ...style,
      }}
      {...rest}
    >
      <Icon name={cfg.icon} size={sm ? 12 : 14} strokeWidth={critical ? 2.6 : 2.2} />
      {cfg.label}
    </span>
  );
}
