/* Screen 5 — Access control center (signature). Approve/deny, grants, overrides. */
const HC5 = window.HealthChainDesignSystem_9f6dff;

function Segmented({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--surface-inset)', borderRadius: 'var(--r-pill)' }}>
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{
          flex: 1, height: 38, border: 'none', borderRadius: 'var(--r-pill)', cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          background: active === t.id ? 'var(--surface-card)' : 'transparent',
          boxShadow: active === t.id ? 'var(--elev-1)' : 'none',
          color: active === t.id ? 'var(--text-primary)' : 'var(--text-secondary)',
          font: 'var(--fw-semibold) 13px/1 var(--font-sans)',
        }}>
          {t.label}
          {t.count != null && <span style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 'var(--r-pill)', background: t.tone || 'var(--brand)', color: '#fff', font: 'var(--fw-bold) 10px/18px var(--font-sans)', textAlign: 'center' }}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

function RequestCard({ req, onApprove, onDeny }) {
  const [status, setStatus] = React.useState('idle'); // idle|approving|denying|approved|denied
  const act = (kind) => {
    setStatus(kind === 'approve' ? 'approving' : 'denying');
    setTimeout(() => {
      setStatus(kind === 'approve' ? 'approved' : 'denied');
      setTimeout(() => kind === 'approve' ? onApprove(req) : onDeny(req), 900);
    }, 1000);
  };
  const settled = status === 'approved' || status === 'denied';
  return (
    <HC5.Card padding="md" style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: settled ? 0.7 : 1, transition: 'opacity var(--dur-base)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <HC5.Avatar name={req.doctor} tone="info" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: 'var(--fw-semibold) 15px/1.2 var(--font-sans)', color: 'var(--text-primary)' }}>{req.doctor}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, font: 'var(--text-meta)', fontWeight: 400, color: 'var(--text-secondary)', marginTop: 2 }}>
            <HC5.Icon name="building" size={13} color="var(--text-muted)" />{req.institution}
          </div>
        </div>
        <span style={{ font: 'var(--text-meta)', fontWeight: 400, color: 'var(--text-muted)' }}>{req.timestamp}</span>
      </div>
      <div style={{ padding: 12, borderRadius: 'var(--r-md)', background: 'var(--surface-inset)', font: 'var(--text-body)', color: 'var(--text-secondary)', textWrap: 'pretty' }}>“{req.reason}”</div>
      <div>
        <div style={{ font: 'var(--text-label)', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>Requested access</div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {req.permissions.map((p) => <HC5.PermissionChip key={p} scope={p} readOnly selected />)}
        </div>
      </div>
      {settled ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0' }}>
          <HC5.StatusPill status={status} />
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 10 }}>
          <HC5.Button variant="secondary" fullWidth iconLeft="x" loading={status === 'denying'} onClick={() => act('deny')}>Deny</HC5.Button>
          <HC5.Button variant="primary" fullWidth iconLeft="shield-check" loading={status === 'approving'} onClick={() => act('approve')}>Approve</HC5.Button>
        </div>
      )}
    </HC5.Card>
  );
}

function GrantCard({ grant, onRevoke }) {
  const [confirming, setConfirming] = React.useState(false);
  return (
    <HC5.Card padding="md" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <HC5.Avatar name={grant.name} tone="brand" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: 'var(--fw-semibold) 15px/1.2 var(--font-sans)', color: 'var(--text-primary)' }}>{grant.name}</div>
          <div style={{ font: 'var(--text-meta)', fontWeight: 400, color: 'var(--text-secondary)', marginTop: 2 }}>{grant.institution}</div>
        </div>
        <HC5.StatusPill status="granted" size="sm" />
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {grant.permissions.map((p) => <HC5.PermissionChip key={p} scope={p} readOnly selected />)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, font: 'var(--text-meta)', fontWeight: 400, color: 'var(--text-muted)' }}>
        <HC5.Icon name="clock" size={13} />Granted {grant.granted} · {grant.expiry}
      </div>
      {confirming ? (
        <div style={{ display: 'flex', gap: 10 }}>
          <HC5.Button variant="secondary" fullWidth onClick={() => setConfirming(false)}>Keep access</HC5.Button>
          <HC5.Button variant="destructive" fullWidth iconLeft="x-circle" onClick={() => onRevoke(grant)}>Revoke</HC5.Button>
        </div>
      ) : (
        <button onClick={() => setConfirming(true)} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--critical-ink)', font: 'var(--fw-semibold) 13px/1 var(--font-sans)' }}>
          <HC5.Icon name="x-circle" size={15} strokeWidth={2.2} />Revoke access
        </button>
      )}
    </HC5.Card>
  );
}

function OverrideCard({ o }) {
  return (
    <HC5.Card padding="md" accent="var(--critical)" style={{ display: 'flex', flexDirection: 'column', gap: 10, borderColor: 'color-mix(in srgb, var(--critical) 26%, transparent)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <HC5.Icon name="alert-octagon" size={18} color="var(--critical)" strokeWidth={2.3} />
        <span style={{ font: 'var(--fw-bold) 12px/1 var(--font-sans)', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--critical-ink)' }}>Emergency override</span>
        <span style={{ marginLeft: 'auto', font: 'var(--text-meta)', fontWeight: 400, color: 'var(--text-muted)' }}>{o.when}</span>
      </div>
      <div style={{ font: 'var(--fw-semibold) 15px/1.2 var(--font-sans)', color: 'var(--text-primary)' }}>{o.name}</div>
      <div style={{ font: 'var(--text-meta)', fontWeight: 400, color: 'var(--text-secondary)', marginTop: -4 }}>{o.institution}</div>
      <div style={{ font: 'var(--text-body)', color: 'var(--text-secondary)', textWrap: 'pretty' }}>{o.reason}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, borderRadius: 'var(--r-md)', background: 'var(--accent-tint)' }}>
        <HC5.Icon name="link" size={15} color="var(--accent-ink)" strokeWidth={2.2} />
        <span style={{ font: 'var(--text-meta)', color: 'var(--accent-ink)', flex: 1 }}>Permanently logged to blockchain · tx {o.tx}</span>
      </div>
      <div style={{ font: 'var(--text-meta)', fontWeight: 400, color: 'var(--text-muted)' }}>Shown to you for transparency. This access was audited and cannot be undone.</div>
    </HC5.Card>
  );
}

function AccessCenter() {
  const [tab, setTab] = React.useState('requests');
  const [requests, setRequests] = React.useState(window.HC.pendingRequests);
  const [grants, setGrants] = React.useState(window.HC.granted);
  const overrides = window.HC.overrides;

  const approve = (req) => {
    setGrants((g) => [{ id: 'g-' + req.id, name: req.doctor, institution: req.institution, permissions: req.permissions, granted: 'Just now', expiry: 'Expires in 90 days' }, ...g]);
    setRequests((r) => r.filter((x) => x.id !== req.id));
  };
  const deny = (req) => setRequests((r) => r.filter((x) => x.id !== req.id));
  const revoke = (grant) => setGrants((g) => g.filter((x) => x.id !== grant.id));

  return (
    <div style={{ minHeight: '100%', background: 'var(--surface-bg)' }}>
      <HC5.ScreenHeader large title="Access" subtitle="Control who sees your records" />
      <div style={{ padding: '4px var(--screen-pad) 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Segmented active={tab} onChange={setTab} tabs={[
          { id: 'requests', label: 'Requests', count: requests.length || null, tone: 'var(--urgent)' },
          { id: 'granted', label: 'Access', count: grants.length || null },
          { id: 'overrides', label: 'Overrides', count: overrides.length || null, tone: 'var(--critical)' },
        ]} />

        {tab === 'requests' && (requests.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {requests.map((r) => <RequestCard key={r.id} req={r} onApprove={approve} onDeny={deny} />)}
          </div>
        ) : (
          <HC5.Card padding="lg"><HC5.EmptyState icon="shield-check" title="No pending access requests" body="When a clinician requests access to your records, it will appear here for your approval." /></HC5.Card>
        ))}

        {tab === 'granted' && (grants.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {grants.map((g) => <GrantCard key={g.id} grant={g} onRevoke={revoke} />)}
          </div>
        ) : (
          <HC5.Card padding="lg"><HC5.EmptyState icon="lock" title="No one has access" body="You haven't granted anyone access to your records yet." /></HC5.Card>
        ))}

        {tab === 'overrides' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, font: 'var(--text-meta)', fontWeight: 400, color: 'var(--text-secondary)' }}>
              <HC5.Icon name="info" size={15} color="var(--text-muted)" />Emergency access used without your prior approval, logged for transparency.
            </div>
            {overrides.map((o) => <OverrideCard key={o.id} o={o} />)}
          </div>
        )}
      </div>
    </div>
  );
}
window.AccessCenter = AccessCenter;
