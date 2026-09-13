/* Screen 8 — Profile. Demographics, account, support, sign out. */
const HC8 = window.HealthChainDesignSystem_9f6dff;

function DemoItem({ label, value, critical }) {
  return (
    <div style={{ flex: '1 1 40%', minWidth: 0 }}>
      <div style={{ font: 'var(--text-label)', letterSpacing: '0.03em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, font: `${critical ? 'var(--fw-bold)' : 'var(--fw-semibold)'} 15px/1.2 var(--font-sans)`, color: critical ? 'var(--critical-ink)' : 'var(--text-primary)' }}>
        {critical && <HC8.Icon name="droplet" size={15} color="var(--critical)" strokeWidth={2.3} />}{value}
      </div>
    </div>
  );
}

function Profile({ nav, setModal }) {
  const p = window.HC.patient;
  const hr = { borderTop: '1px solid var(--border-faint)' };
  return (
    <div style={{ minHeight: '100%', background: 'var(--surface-bg)' }}>
      <HC8.ScreenHeader large title="Profile" />
      <div style={{ padding: '4px var(--screen-pad) 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <HC8.Avatar name={p.fullName} tone="brand" size="xl" />
          <div style={{ minWidth: 0 }}>
            <div style={{ font: 'var(--text-h2)', color: 'var(--text-primary)' }}>{p.fullName}</div>
            <div style={{ font: 'var(--fw-medium) 13px/1 var(--font-mono)', color: 'var(--text-secondary)', marginTop: 4 }}>NRC {p.nationalId}</div>
            <div style={{ marginTop: 8 }}><HC8.TrustBadge kind="verified" label="Verified patient" size="sm" /></div>
          </div>
        </div>

        {/* safety-critical: blood + allergies */}
        <HC8.Card padding="md" style={{ display: 'flex', flexDirection: 'column', gap: 12, borderColor: 'color-mix(in srgb, var(--critical) 22%, transparent)' }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <DemoItem label="Blood type" value={p.bloodType} critical />
            <DemoItem label="Allergies" value={p.allergies.join(', ')} critical />
          </div>
        </HC8.Card>

        {/* demographics */}
        <HC8.Card padding="md">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            <DemoItem label="Gender" value={p.gender} />
            <DemoItem label="Date of birth" value={`${p.dob} · ${p.age}y`} />
            <DemoItem label="Phone" value={p.phone} />
            <DemoItem label="Marital status" value={p.maritalStatus} />
            <DemoItem label="Occupation" value={p.occupation} />
          </div>
        </HC8.Card>

        {/* Account */}
        <div>
          <HC8.SectionHeader title="Account" icon="user" />
          <HC8.Card padding="sm" style={{ padding: 0, overflow: 'hidden' }}>
            <HC8.ListRow icon="lock" iconTone="brand" title="Change password" chevron onClick={() => setModal('password')} />
            <HC8.ListRow style={hr} icon="bell" iconTone="info" title="Notification settings" right="On" chevron onClick={() => {}} />
            <HC8.ListRow style={hr} icon="shield-check" iconTone="accent" title="Privacy & security" chevron onClick={() => {}} />
          </HC8.Card>
        </div>

        {/* Support */}
        <div>
          <HC8.SectionHeader title="Support" icon="help-circle" />
          <HC8.Card padding="sm" style={{ padding: 0, overflow: 'hidden' }}>
            <HC8.ListRow icon="help-circle" title="Help & FAQs" chevron onClick={() => {}} />
            <HC8.ListRow style={hr} icon="info" title="About HealthChain" meta="Version 1.0.0" chevron onClick={() => {}} />
            <HC8.ListRow style={hr} icon="log-out" title="Sign out" destructive onClick={() => setModal('signout')} />
          </HC8.Card>
        </div>

        <div style={{ textAlign: 'center', font: 'var(--text-meta)', fontWeight: 400, color: 'var(--text-muted)', marginTop: 4 }}>
          HealthChain · Zambia · v1.0.0
        </div>
      </div>
    </div>
  );
}
window.Profile = Profile;
