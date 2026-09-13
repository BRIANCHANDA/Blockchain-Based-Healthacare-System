/* Screen 1 — Login. National ID + password, idle/loading/error. */
const { Button: HCButton, Input: HCInput, TrustBadge: HCTrust } = window.HealthChainDesignSystem_9f6dff;

function LoginScreen({ onLogin }) {
  const [nid, setNid] = React.useState('123456/78/9');
  const [pw, setPw] = React.useState('');
  const [state, setState] = React.useState('idle'); // idle | loading | error
  const submit = () => {
    if (state === 'loading') return;
    setState('loading');
    setTimeout(() => {
      if (pw && pw.length >= 4) { onLogin(); }
      else { setState('error'); }
    }, 1100);
  };
  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', background: 'var(--surface-card)', padding: '8px var(--screen-pad) 28px' }}>
      {/* Brand block */}
      <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', paddingTop: 40, paddingBottom: 36 }}>
        <div style={{ width: 84, height: 84, borderRadius: 24, background: 'var(--brand-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <img src="../../assets/logo-mark.svg" width="56" height="56" alt="HealthChain" />
        </div>
        <div style={{ font: 'var(--fw-semibold) 30px/1.1 var(--font-display)', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
          Health<span style={{ color: 'var(--brand)' }}>Chain</span>
        </div>
        <div style={{ font: 'var(--text-body)', color: 'var(--text-secondary)', marginTop: 8, maxWidth: 260, textWrap: 'pretty' }}>
          Your medical records, owned by you and unlocked only with your permission.
        </div>
      </div>

      {/* Form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <HCInput label="National ID" icon="fingerprint" value={nid} inputMode="text"
          onChange={(e) => { setNid(e.target.value); if (state === 'error') setState('idle'); }}
          placeholder="000000/00/0" />
        <HCInput label="Password" type="password" icon="lock" value={pw}
          onChange={(e) => { setPw(e.target.value); if (state === 'error') setState('idle'); }}
          placeholder="Enter your password"
          error={state === 'error' ? 'Invalid credentials. Please try again.' : undefined} />

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -4 }}>
          <button style={{ background: 'none', border: 'none', color: 'var(--text-link)', font: 'var(--fw-semibold) 13px/1 var(--font-sans)', cursor: 'pointer' }}>Forgot password?</button>
        </div>

        <HCButton variant="primary" size="lg" fullWidth loading={state === 'loading'} onClick={submit}>
          {state === 'loading' ? 'Signing in…' : 'Sign in'}
        </HCButton>
      </div>

      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 28 }}>
        <HCTrust kind="encrypted" label="Protected by blockchain-secured records" size="sm" />
      </div>
      <div style={{ textAlign: 'center', font: 'var(--text-meta)', fontWeight: 400, color: 'var(--text-muted)', marginTop: 14 }}>
        HealthChain · Zambia · v1.0.0
      </div>
    </div>
  );
}
window.LoginScreen = LoginScreen;
