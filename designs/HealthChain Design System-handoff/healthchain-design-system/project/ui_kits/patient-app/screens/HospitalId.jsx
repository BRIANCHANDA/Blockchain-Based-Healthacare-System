/* Screen 4 — My Hospital ID. Secure digital ID card with QR. */
const HC4 = window.HealthChainDesignSystem_9f6dff;

/* Stylized QR matrix (illustrative — encodes the shape of {t:'hc-patient',id}).
   Real builds use a QR library; this is a visual mock for the design system. */
function qrMatrix(payload, n = 25) {
  let h = 2166136261;
  for (let i = 0; i < payload.length; i++) { h ^= payload.charCodeAt(i); h = Math.imul(h, 16777619); }
  const rand = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1000) / 1000; };
  const g = Array.from({ length: n }, () => Array(n).fill(0));
  const finder = (r, c) => {
    for (let i = -1; i <= 7; i++) for (let j = -1; j <= 7; j++) {
      const rr = r + i, cc = c + j; if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
      const edge = i === 0 || i === 6 || j === 0 || j === 6;
      const core = i >= 2 && i <= 4 && j >= 2 && j <= 4;
      g[rr][cc] = (i >= 0 && i <= 6 && j >= 0 && j <= 6 && (edge || core)) ? 1 : 0;
    }
  };
  finder(0, 0); finder(0, n - 7); finder(n - 7, 0);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const inFinder = (r < 8 && c < 8) || (r < 8 && c >= n - 8) || (r >= n - 8 && c < 8);
    if (!inFinder && rand() > 0.5) g[r][c] = 1;
  }
  return g;
}

function QR({ payload, size = 200 }) {
  const m = React.useMemo(() => qrMatrix(payload), [payload]);
  const n = m.length, cell = size / n;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      <rect width={size} height={size} fill="#fff" />
      {m.map((row, r) => row.map((on, c) => on ? <rect key={`${r}-${c}`} x={c * cell} y={r * cell} width={cell + 0.5} height={cell + 0.5} fill="var(--ink-900)" rx={cell * 0.18} /> : null))}
    </svg>
  );
}

function HospitalId({ nav }) {
  const { patient } = window.HC;
  const payload = JSON.stringify({ t: 'hc-patient', id: patient.nationalId });
  return (
    <div style={{ minHeight: '100%', background: 'var(--surface-bg)' }}>
      <HC4.ScreenHeader title="My Hospital ID" onBack={() => nav('records')} />
      <div style={{ padding: '8px var(--screen-pad) 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* ID card */}
        <div style={{ borderRadius: 'var(--r-xl)', overflow: 'hidden', boxShadow: 'var(--elev-3)', background: 'var(--brand-deep)' }}>
          <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--brand)' }}>
            <img src="../../assets/logo-mark.svg" width="30" height="30" alt="" style={{ filter: 'brightness(0) invert(1)' }} />
            <span style={{ font: 'var(--fw-semibold) 17px/1 var(--font-display)', color: '#fff' }}>HealthChain Zambia</span>
            <span style={{ marginLeft: 'auto', font: 'var(--fw-bold) 10px/1 var(--font-sans)', letterSpacing: '0.1em', color: '#fff', background: 'rgba(255,255,255,0.18)', padding: '5px 9px', borderRadius: 'var(--r-pill)' }}>PATIENT</span>
          </div>
          <div style={{ background: '#fff', margin: '20px', padding: 16, borderRadius: 'var(--r-lg)', display: 'flex', justifyContent: 'center' }}>
            <QR payload={payload} size={196} />
          </div>
          <div style={{ padding: '0 20px 22px', textAlign: 'center' }}>
            <div style={{ font: 'var(--fw-bold) 22px/1.1 var(--font-sans)', color: '#fff' }}>{patient.fullName}</div>
            <div style={{ font: 'var(--fw-medium) 13px/1 var(--font-mono)', color: 'rgba(255,255,255,0.7)', marginTop: 6 }}>NRC {patient.nationalId}</div>
          </div>
        </div>

        {/* Reassurance */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: 'var(--sp-4)', borderRadius: 'var(--r-lg)', background: 'var(--success-tint)', border: '1px solid color-mix(in srgb, var(--success) 22%, transparent)' }}>
          <HC4.Icon name="shield-check" size={22} color="var(--success-ink)" strokeWidth={2.1} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ font: 'var(--text-body)', color: 'var(--success-ink)', textWrap: 'pretty' }}>
            This code contains only your patient ID — <strong>no medical information</strong>. Staff still need your permission to view your records.
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <HC4.TrustBadge kind="id-only" />
        </div>
      </div>
    </div>
  );
}
window.HospitalId = HospitalId;
