/* Screen 7 — Referrals. Active first, with count badge. */
const HC7 = window.HealthChainDesignSystem_9f6dff;

function ReferralCard({ r }) {
  return (
    <HC7.Card padding="md" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ font: 'var(--fw-medium) 12px/1 var(--font-mono)', color: 'var(--text-muted)' }}>{r.number}</span>
        <div style={{ marginLeft: 'auto' }}><HC7.StatusPill status={r.status} size="sm" /></div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: 'var(--r-md)', background: 'var(--brand-tint)', color: 'var(--brand-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <HC7.Icon name="building" size={19} strokeWidth={2.1} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: 'var(--fw-semibold) 15px/1.25 var(--font-sans)', color: 'var(--text-primary)' }}>{r.institution}</div>
          <div style={{ font: 'var(--text-meta)', fontWeight: 400, color: 'var(--text-secondary)', marginTop: 3, textWrap: 'pretty' }}>{r.reason}</div>
        </div>
      </div>
      <div style={{ height: 1, background: 'var(--border-faint)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <HC7.PriorityPill priority={r.urgency} size="sm" />
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, font: 'var(--text-meta)', fontWeight: 400, color: 'var(--text-muted)' }}>
          <HC7.Icon name="calendar" size={14} />{r.date}
        </span>
      </div>
    </HC7.Card>
  );
}

function Referrals() {
  const order = { pending: 0, accepted: 1, completed: 2, rejected: 3, cancelled: 4 };
  const refs = [...window.HC.referrals].sort((a, b) => order[a.status] - order[b.status]);
  const active = refs.filter((r) => r.status === 'pending' || r.status === 'accepted').length;
  return (
    <div style={{ minHeight: '100%', background: 'var(--surface-bg)' }}>
      <HC7.ScreenHeader large title="Referrals" subtitle="Referrals to other institutions"
        right={active ? <span style={{ display: 'inline-flex', alignItems: 'center', height: 28, padding: '0 12px', borderRadius: 'var(--r-pill)', background: 'var(--brand-fill)', color: 'var(--brand-deep)', font: 'var(--fw-bold) 12px/1 var(--font-sans)' }}>{active} active</span> : null} />
      <div style={{ padding: '4px var(--screen-pad) 28px' }}>
        {refs.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {refs.map((r) => <ReferralCard key={r.number} r={r} />)}
          </div>
        ) : (
          <HC7.Card padding="lg"><HC7.EmptyState icon="send" title="No referrals yet" body="When your doctor refers you to another hospital, it'll appear here." /></HC7.Card>
        )}
      </div>
    </div>
  );
}
window.Referrals = Referrals;
