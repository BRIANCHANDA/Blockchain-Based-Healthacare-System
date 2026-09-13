import React from 'react';
import { Icon } from '../core/Icon.jsx';

/* One status vocabulary, reused across visits, prescriptions, labs, referrals
   and access grants. Always color + icon + label — never color alone (a11y). */
const STATUS = {
  // visit / referral lifecycle
  'in-progress': { label: 'In progress', tone: 'info', icon: 'activity' },
  completed:     { label: 'Completed', tone: 'success', icon: 'check-circle' },
  cancelled:     { label: 'Cancelled', tone: 'neutral', icon: 'x-circle' },
  pending:       { label: 'Pending', tone: 'urgent', icon: 'clock' },
  accepted:      { label: 'Accepted', tone: 'info', icon: 'check' },
  rejected:      { label: 'Rejected', tone: 'critical', icon: 'x-circle' },
  // prescriptions
  prescribed:    { label: 'Prescribed', tone: 'info', icon: 'pill' },
  dispensing:    { label: 'Dispensing', tone: 'urgent', icon: 'clock' },
  dispensed:     { label: 'Dispensed', tone: 'success', icon: 'check-circle' },
  // labs / imaging
  ordered:       { label: 'Ordered', tone: 'info', icon: 'clock' },
  resulted:      { label: 'Resulted', tone: 'success', icon: 'check-circle' },
  // access / records
  locked:        { label: 'Locked', tone: 'neutral', icon: 'lock' },
  granted:       { label: 'Granted', tone: 'success', icon: 'shield-check' },
  revoked:       { label: 'Revoked', tone: 'critical', icon: 'x-circle' },
  expired:       { label: 'Expired', tone: 'neutral', icon: 'clock' },
  approved:      { label: 'Approved', tone: 'success', icon: 'check-circle' },
  denied:        { label: 'Denied', tone: 'critical', icon: 'x-circle' },
};

const TONES = {
  success:  { bg: 'var(--success-tint)', fg: 'var(--success-ink)' },
  info:     { bg: 'var(--info-tint)', fg: 'var(--info-ink)' },
  urgent:   { bg: 'var(--urgent-tint)', fg: 'var(--urgent-ink)' },
  critical: { bg: 'var(--critical-tint)', fg: 'var(--critical-ink)' },
  neutral:  { bg: 'var(--locked-tint)', fg: 'var(--locked)' },
};

export function StatusPill({ status, size = 'md', solid = false, style, ...rest }) {
  const cfg = STATUS[status] || { label: status, tone: 'neutral', icon: 'info' };
  const tone = TONES[cfg.tone];
  const sm = size === 'sm';
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: sm ? 4 : 5,
        height: sm ? 22 : 26, padding: sm ? '0 8px' : '0 10px',
        borderRadius: 'var(--r-pill)',
        background: solid ? tone.fg : tone.bg,
        color: solid ? '#fff' : tone.fg,
        font: `var(--fw-semibold) ${sm ? 11 : 12}px/1 var(--font-sans)`,
        whiteSpace: 'nowrap', ...style,
      }}
      {...rest}
    >
      <Icon name={cfg.icon} size={sm ? 12 : 13} strokeWidth={2.4} />
      {cfg.label}
    </span>
  );
}
