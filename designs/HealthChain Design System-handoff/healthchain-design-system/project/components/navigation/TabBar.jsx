import React from 'react';
import { Icon } from '../core/Icon.jsx';

/* Primary bottom navigation. Four sections + a central floating action (Appointments).
   The FAB sits above the bar; tabs split around it. */
const DEFAULT_TABS = [
  { id: 'records', label: 'Records', icon: 'file-text' },
  { id: 'access', label: 'Access', icon: 'shield-check' },
  { id: 'history', label: 'History', icon: 'activity' },
  { id: 'referrals', label: 'Referrals', icon: 'send' },
];

function Tab({ tab, active, onSelect }) {
  return (
    <button
      type="button" onClick={() => onSelect(tab.id)} aria-label={tab.label} aria-current={active}
      style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 4, height: '100%', minHeight: 44, background: 'none', border: 'none', cursor: 'pointer',
        color: active ? 'var(--brand)' : 'var(--text-muted)',
        WebkitTapHighlightColor: 'transparent', position: 'relative',
      }}
    >
      <div style={{ position: 'relative' }}>
        <Icon name={tab.icon} size={23} strokeWidth={active ? 2.4 : 2} />
        {tab.badge ? (
          <span style={{
            position: 'absolute', top: -5, right: -8, minWidth: 16, height: 16, padding: '0 4px',
            borderRadius: 'var(--r-pill)', background: 'var(--critical)', color: '#fff',
            font: 'var(--fw-bold) 10px/16px var(--font-sans)', textAlign: 'center',
            border: '1.5px solid var(--surface-card)',
          }}>{tab.badge}</span>
        ) : null}
      </div>
      <span style={{ font: `${active ? 'var(--fw-semibold)' : 'var(--fw-medium)'} 11px/1 var(--font-sans)` }}>{tab.label}</span>
    </button>
  );
}

export function TabBar({ active = 'records', onSelect = () => {}, tabs = DEFAULT_TABS, onFab = () => {}, fabIcon = 'plus', style, ...rest }) {
  const left = tabs.slice(0, 2);
  const right = tabs.slice(2);
  return (
    <nav
      style={{
        position: 'relative', display: 'flex', alignItems: 'stretch',
        height: 'var(--tabbar-h)', background: 'var(--surface-card)',
        borderTop: '1px solid var(--border)', boxShadow: '0 -2px 12px rgba(10,14,26,0.05)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)', ...style,
      }}
      {...rest}
    >
      {left.map((t) => <Tab key={t.id} tab={t} active={active === t.id} onSelect={onSelect} />)}
      <div style={{ width: 72, flexShrink: 0, position: 'relative' }}>
        <button
          type="button" onClick={onFab} aria-label="New appointment"
          style={{
            position: 'absolute', top: -22, left: '50%', transform: 'translateX(-50%)',
            width: 56, height: 56, borderRadius: '50%', border: '4px solid var(--surface-bg)',
            background: 'var(--brand)', color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--elev-brand)', WebkitTapHighlightColor: 'transparent',
          }}
        >
          <Icon name={fabIcon} size={26} strokeWidth={2.4} />
        </button>
      </div>
      {right.map((t) => <Tab key={t.id} tab={t} active={active === t.id} onSelect={onSelect} />)}
    </nav>
  );
}
