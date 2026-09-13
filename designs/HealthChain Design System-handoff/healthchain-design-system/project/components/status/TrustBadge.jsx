import React from 'react';
import { Icon } from '../core/Icon.jsx';

/* Trust signals around consent + blockchain audit. Use purposefully, not gratuitously. */
const KINDS = {
  blockchain: { label: 'Logged to blockchain', icon: 'link', tone: 'accent' },
  verified:   { label: 'Verified', icon: 'shield-check', tone: 'success' },
  encrypted:  { label: 'Encrypted', icon: 'lock', tone: 'info' },
  audited:    { label: 'Audited', icon: 'shield', tone: 'accent' },
  'id-only':  { label: 'ID only — no medical data', icon: 'shield-check', tone: 'success' },
};

const TONES = {
  success: { bg: 'var(--success-tint)', fg: 'var(--success-ink)' },
  info:    { bg: 'var(--info-tint)', fg: 'var(--info-ink)' },
  accent:  { bg: 'var(--accent-tint)', fg: 'var(--accent-ink)' },
};

export function TrustBadge({ kind = 'verified', label, size = 'md', style, ...rest }) {
  const cfg = KINDS[kind] || KINDS.verified;
  const tone = TONES[cfg.tone];
  const sm = size === 'sm';
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        height: sm ? 24 : 28, padding: sm ? '0 9px' : '0 11px',
        borderRadius: 'var(--r-pill)', background: tone.bg, color: tone.fg,
        font: `var(--fw-semibold) ${sm ? 11 : 12}px/1 var(--font-sans)`,
        whiteSpace: 'nowrap', ...style,
      }}
      {...rest}
    >
      <Icon name={cfg.icon} size={sm ? 13 : 14} strokeWidth={2.2} />
      {label || cfg.label}
    </span>
  );
}
