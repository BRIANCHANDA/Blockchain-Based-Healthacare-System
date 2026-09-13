import React from 'react';

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[parts.length - 1][0] || '')).toUpperCase();
}

const SIZES = { sm: 32, md: 44, lg: 56, xl: 72 };
const TONES = {
  brand: { bg: 'var(--brand-fill)', fg: 'var(--brand-deep)' },
  info: { bg: 'var(--info-tint)', fg: 'var(--info-ink)' },
  accent: { bg: 'var(--accent-tint)', fg: 'var(--accent-ink)' },
  neutral: { bg: 'var(--surface-inset)', fg: 'var(--text-secondary)' },
};

export function Avatar({ name, size = 'md', tone = 'brand', src, style, ...rest }) {
  const dim = SIZES[size] || SIZES.md;
  const t = TONES[tone] || TONES.brand;
  return (
    <div
      style={{
        width: dim, height: dim, borderRadius: '50%', flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: t.bg, color: t.fg, overflow: 'hidden',
        font: `var(--fw-semibold) ${Math.round(dim * 0.36)}px/1 var(--font-sans)`,
        ...style,
      }}
      {...rest}
    >
      {src ? <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(name)}
    </div>
  );
}
