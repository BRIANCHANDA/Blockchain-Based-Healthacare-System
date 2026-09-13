import React from 'react';
import { Icon } from '../core/Icon.jsx';

/* The product's core metaphor for away-institution records and access:
   locked -> requested (pending) -> granted. Renders a tactile state tile. */
const PHASES = {
  locked: {
    icon: 'lock', tone: 'locked',
    title: 'Records locked',
    body: 'These records are held at another institution. Request access to unlock.',
    cta: 'Request access',
  },
  pending: {
    icon: 'clock', tone: 'urgent',
    title: 'Request pending',
    body: 'Waiting for approval. You can revoke this request at any time.',
    cta: null,
  },
  granted: {
    icon: 'shield-check', tone: 'success',
    title: 'Access granted',
    body: 'You have approved access to these records.',
    cta: null,
  },
  denied: {
    icon: 'x-circle', tone: 'critical',
    title: 'Access denied',
    body: 'This request was declined.',
    cta: 'Request again',
  },
};

const TONES = {
  locked:   { bg: 'var(--locked-tint)', fg: 'var(--locked)', ring: 'var(--border)' },
  urgent:   { bg: 'var(--urgent-tint)', fg: 'var(--urgent-ink)', ring: 'var(--urgent)' },
  success:  { bg: 'var(--success-tint)', fg: 'var(--success-ink)', ring: 'var(--success)' },
  critical: { bg: 'var(--critical-tint)', fg: 'var(--critical-ink)', ring: 'var(--critical)' },
};

export function LockState({ phase = 'locked', title, body, onAction, actionLabel, style, ...rest }) {
  const cfg = PHASES[phase] || PHASES.locked;
  const tone = TONES[cfg.tone];
  return (
    <div
      style={{
        display: 'flex', gap: 'var(--sp-3)', alignItems: 'flex-start',
        padding: 'var(--sp-4)', borderRadius: 'var(--r-lg)',
        background: tone.bg, border: `1px solid color-mix(in srgb, ${tone.ring} 26%, transparent)`,
        ...style,
      }}
      {...rest}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 'var(--r-md)', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--surface-card)', color: tone.fg, boxShadow: 'var(--elev-1)',
      }}>
        <Icon name={cfg.icon} size={20} strokeWidth={2.2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: 'var(--fw-semibold) 15px/1.3 var(--font-sans)', color: 'var(--text-primary)' }}>
          {title || cfg.title}
        </div>
        <div style={{ font: 'var(--text-meta)', color: 'var(--text-secondary)', marginTop: 3, fontWeight: 400 }}>
          {body || cfg.body}
        </div>
        {(actionLabel || cfg.cta) && onAction && (
          <button
            type="button" onClick={onAction}
            style={{
              marginTop: 'var(--sp-3)', height: 38, padding: '0 14px',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'var(--surface-card)', color: tone.fg,
              border: `1px solid color-mix(in srgb, ${tone.ring} 40%, transparent)`,
              borderRadius: 'var(--r-md)', cursor: 'pointer',
              font: 'var(--fw-semibold) 13px/1 var(--font-sans)',
            }}
          >
            <Icon name={phase === 'locked' ? 'unlock' : 'arrow-right'} size={15} strokeWidth={2.2} />
            {actionLabel || cfg.cta}
          </button>
        )}
      </div>
    </div>
  );
}
