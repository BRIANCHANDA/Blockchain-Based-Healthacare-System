import React from 'react';
import { Icon } from '../core/Icon.jsx';

/* Permission scopes a clinician can request / a patient can grant.
   Used as multi-select chips in access requests and grant summaries. */
const SCOPES = {
  visits:        { label: 'Visits', icon: 'file-text' },
  vitals:        { label: 'Vitals', icon: 'activity' },
  diagnoses:     { label: 'Diagnoses', icon: 'stethoscope' },
  prescriptions: { label: 'Prescriptions', icon: 'pill' },
  'lab-results': { label: 'Lab results', icon: 'flask' },
  imaging:       { label: 'Imaging', icon: 'scan' },
};

export function PermissionChip({
  scope, label, icon, selected = false, readOnly = false, onToggle, style, ...rest
}) {
  const cfg = SCOPES[scope] || { label: label || scope, icon: icon || 'check' };
  const interactive = !readOnly && onToggle;
  return (
    <button
      type="button"
      onClick={interactive ? () => onToggle(scope) : undefined}
      aria-pressed={selected}
      disabled={readOnly}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        height: 36, padding: '0 13px 0 11px', borderRadius: 'var(--r-pill)',
        cursor: interactive ? 'pointer' : 'default',
        background: selected ? 'var(--brand-fill)' : 'var(--surface-card)',
        color: selected ? 'var(--brand-deep)' : 'var(--text-secondary)',
        border: `1.5px solid ${selected ? 'var(--green-300)' : 'var(--border)'}`,
        font: 'var(--fw-semibold) 13px/1 var(--font-sans)',
        transition: 'all var(--dur-fast) var(--ease-standard)',
        WebkitTapHighlightColor: 'transparent', ...style,
      }}
      {...rest}
    >
      <Icon name={selected ? 'check' : cfg.icon} size={15} strokeWidth={2.2} />
      {label || cfg.label}
    </button>
  );
}
