/* App shell — navigation, tab bar, modals. */
const HCA = window.HealthChainDesignSystem_9f6dff;

function Sheet({ title, onClose, children }) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(10,14,26,0.45)', animation: 'hcFade var(--dur-base) var(--ease-standard)' }} />
      <div style={{ position: 'relative', background: 'var(--surface-card)', borderTopLeftRadius: 'var(--r-xl)', borderTopRightRadius: 'var(--r-xl)', padding: '10px var(--screen-pad) 24px', boxShadow: '0 -8px 40px rgba(10,14,26,0.2)', animation: 'hcSlide var(--dur-slow) var(--ease-out)' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border-200)', margin: '0 auto 16px' }} />
        {title && <div style={{ font: 'var(--text-h3)', color: 'var(--text-primary)', marginBottom: 16 }}>{title}</div>}
        {children}
      </div>
      <style>{`@keyframes hcFade{from{opacity:0}to{opacity:1}}@keyframes hcSlide{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
    </div>
  );
}

function ChangePassword({ onClose }) {
  const [cur, setCur] = React.useState('');
  const [nw, setNw] = React.useState('');
  const [cf, setCf] = React.useState('');
  const [saved, setSaved] = React.useState(false);
  const err = nw && nw.length < 8 ? 'Must be at least 8 characters' : (cf && cf !== nw ? 'Passwords do not match' : undefined);
  const ok = cur && nw.length >= 8 && cf === nw;
  return (
    <Sheet title="Change password" onClose={onClose}>
      {saved ? (
        <div style={{ textAlign: 'center', padding: '12px 0 8px' }}>
          <HCA.Icon name="check-circle" size={44} color="var(--success)" style={{ margin: '0 auto 12px' }} />
          <div style={{ font: 'var(--text-h3)', color: 'var(--text-primary)' }}>Password updated</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <HCA.Input label="Current password" type="password" icon="lock" value={cur} onChange={(e) => setCur(e.target.value)} />
          <HCA.Input label="New password" type="password" icon="lock" value={nw} onChange={(e) => setNw(e.target.value)} helper={!err ? 'Minimum 8 characters' : undefined} error={nw && nw.length < 8 ? err : undefined} />
          <HCA.Input label="Confirm new password" type="password" icon="lock" value={cf} onChange={(e) => setCf(e.target.value)} error={cf && cf !== nw ? 'Passwords do not match' : undefined} />
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <HCA.Button variant="secondary" fullWidth onClick={onClose}>Cancel</HCA.Button>
            <HCA.Button variant="primary" fullWidth disabled={!ok} onClick={() => setSaved(true)}>Update</HCA.Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function SignOut({ onClose, onConfirm }) {
  return (
    <Sheet title="Sign out?" onClose={onClose}>
      <p style={{ font: 'var(--text-body)', color: 'var(--text-secondary)', margin: '0 0 18px' }}>You'll need your National ID and password to sign back in.</p>
      <div style={{ display: 'flex', gap: 10 }}>
        <HCA.Button variant="secondary" fullWidth onClick={onClose}>Cancel</HCA.Button>
        <HCA.Button variant="destructive" fullWidth iconLeft="log-out" onClick={onConfirm}>Sign out</HCA.Button>
      </div>
    </Sheet>
  );
}

function Appointment({ onClose }) {
  return (
    <Sheet title="Book an appointment" onClose={onClose}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: 14, borderRadius: 'var(--r-md)', background: 'var(--brand-tint)', marginBottom: 16 }}>
        <HCA.Icon name="calendar" size={20} color="var(--brand-deep)" style={{ flexShrink: 0 }} />
        <span style={{ font: 'var(--text-body)', color: 'var(--brand-deep)', textWrap: 'pretty' }}>Choose an institution you've granted access to and request a time. Your doctor confirms the slot.</span>
      </div>
      <HCA.Button variant="primary" fullWidth iconLeft="plus" onClick={onClose}>Request appointment</HCA.Button>
    </Sheet>
  );
}

function App() {
  const [screen, setScreen] = React.useState('login');
  const [params, setParams] = React.useState({});
  const [modal, setModal] = React.useState(null);
  const nav = (s, pr = {}) => { setScreen(s); setParams(pr); };

  const TAB_OF = { records: 'records', access: 'access', trends: 'history', referrals: 'referrals' };
  const onTab = (id) => nav({ records: 'records', access: 'access', history: 'trends', referrals: 'referrals' }[id]);
  const showTabs = ['records', 'access', 'trends', 'referrals', 'profile'].includes(screen);

  let content;
  if (screen === 'login') content = <LoginScreen onLogin={() => nav('records')} />;
  else if (screen === 'records') content = <RecordsHome nav={nav} />;
  else if (screen === 'visit') content = <VisitDetail visitId={params.id} nav={nav} />;
  else if (screen === 'hospitalId') content = <HospitalId nav={nav} />;
  else if (screen === 'access') content = <AccessCenter />;
  else if (screen === 'trends') content = <HealthTrends nav={nav} />;
  else if (screen === 'referrals') content = <Referrals />;
  else if (screen === 'profile') content = <Profile nav={nav} setModal={setModal} />;

  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--surface-bg)' }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>{content}</div>
      {showTabs && (
        <HCA.TabBar active={TAB_OF[screen] || (screen === 'profile' ? '' : '')}
          tabs={[
            { id: 'records', label: 'Records', icon: 'file-text' },
            { id: 'access', label: 'Access', icon: 'shield-check', badge: window.HC.pendingRequests.length },
            { id: 'history', label: 'History', icon: 'activity' },
            { id: 'referrals', label: 'Referrals', icon: 'send' },
          ]}
          onSelect={onTab} onFab={() => setModal('appointment')} />
      )}
      {modal === 'password' && <ChangePassword onClose={() => setModal(null)} />}
      {modal === 'signout' && <SignOut onClose={() => setModal(null)} onConfirm={() => { setModal(null); nav('login'); }} />}
      {modal === 'appointment' && <Appointment onClose={() => setModal(null)} />}
    </div>
  );
}
window.HCApp = App;
