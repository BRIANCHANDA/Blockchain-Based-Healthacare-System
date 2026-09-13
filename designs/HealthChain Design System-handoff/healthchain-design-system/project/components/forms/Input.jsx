import React from 'react';
import { Icon } from '../core/Icon.jsx';

/* Text input with label, optional leading icon, helper/error text.
   For passwords pass type="password" with an icon — toggle is built in. */
export function Input({
  label, value, onChange, placeholder, type = 'text', icon,
  error, helper, disabled = false, inputMode, maxLength, style, ...rest
}) {
  const [show, setShow] = React.useState(false);
  const [focus, setFocus] = React.useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (show ? 'text' : 'password') : type;
  const borderColor = error ? 'var(--critical)' : focus ? 'var(--brand)' : 'var(--border)';

  return (
    <label style={{ display: 'block', ...style }}>
      {label && (
        <span style={{
          display: 'block', font: 'var(--fw-semibold) 13px/1 var(--font-sans)',
          color: 'var(--text-secondary)', marginBottom: 7,
        }}>{label}</span>
      )}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        height: 52, padding: '0 14px', borderRadius: 'var(--r-md)',
        background: disabled ? 'var(--surface-inset)' : 'var(--surface-card)',
        border: `1.5px solid ${borderColor}`,
        boxShadow: focus && !error ? '0 0 0 4px var(--focus-ring)' : 'none',
        transition: 'border-color var(--dur-fast), box-shadow var(--dur-fast)',
      }}>
        {icon && <Icon name={icon} size={19} color="var(--text-muted)" />}
        <input
          type={inputType} value={value} onChange={onChange} placeholder={placeholder}
          disabled={disabled} inputMode={inputMode} maxLength={maxLength}
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          style={{
            flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
            font: 'var(--fw-medium) 16px/1.2 var(--font-sans)', color: 'var(--text-primary)',
          }}
          {...rest}
        />
        {isPassword && (
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide' : 'Show'}
            style={{ display: 'flex', padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <Icon name={show ? 'eye-off' : 'eye'} size={19} />
          </button>
        )}
      </div>
      {(error || helper) && (
        <span style={{
          display: 'flex', alignItems: 'center', gap: 5, marginTop: 7,
          font: 'var(--text-meta)', fontWeight: 500,
          color: error ? 'var(--critical-ink)' : 'var(--text-muted)',
        }}>
          {error && <Icon name="alert-triangle" size={13} strokeWidth={2.2} />}
          {error || helper}
        </span>
      )}
    </label>
  );
}
