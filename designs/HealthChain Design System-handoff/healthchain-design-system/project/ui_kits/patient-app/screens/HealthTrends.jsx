/* Screen 6 — Health Trends. Line charts of vitals over time. */
const HC6 = window.HealthChainDesignSystem_9f6dff;

const METRICS = [
  { id: 'bp', label: 'Blood pressure', unit: 'mmHg', dual: true, icon: 'heart-pulse' },
  { id: 'pulse', label: 'Pulse', unit: 'bpm', icon: 'activity' },
  { id: 'temp', label: 'Temperature', unit: '°C', icon: 'alert-triangle' },
  { id: 'spo2', label: 'SpO₂', unit: '%', icon: 'activity' },
  { id: 'weight', label: 'Weight', unit: 'kg', icon: 'activity' },
];

function LineChart({ data, dual, color = 'var(--brand)' }) {
  const W = 320, H = 150, padX = 14, padY = 18;
  const series = dual ? [data.map((d) => d.s), data.map((d) => d.d)] : [data.map((d) => d.s)];
  const all = series.flat();
  const min = Math.min(...all), max = Math.max(...all);
  const range = max - min || 1;
  const x = (i) => padX + (i * (W - padX * 2)) / (data.length - 1);
  const y = (v) => padY + (H - padY * 2) * (1 - (v - min) / range);
  const colors = dual ? ['var(--brand)', 'var(--accent)'] : [color];
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      {[0.25, 0.5, 0.75].map((g) => <line key={g} x1={padX} x2={W - padX} y1={padY + (H - padY * 2) * g} y2={padY + (H - padY * 2) * g} stroke="var(--border-faint)" strokeWidth="1" />)}
      {series.map((s, si) => {
        const pts = s.map((v, i) => `${x(i)},${y(v)}`).join(' ');
        const area = `${padX},${H - padY} ${pts} ${W - padX},${H - padY}`;
        return (
          <g key={si}>
            {!dual && <polygon points={area} fill={color} opacity="0.08" />}
            <polyline points={pts} fill="none" stroke={colors[si]} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {s.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={i === s.length - 1 ? 5 : 3.5} fill="var(--surface-card)" stroke={colors[si]} strokeWidth="2.5" />)}
          </g>
        );
      })}
    </svg>
  );
}

function HealthTrends({ nav }) {
  const [metric, setMetric] = React.useState('bp');
  const m = METRICS.find((x) => x.id === metric);
  const data = window.HC.trends[metric];
  const last = data[data.length - 1], prev = data[data.length - 2];
  const latestVal = m.dual ? last.v : last.s;
  const delta = m.dual ? (last.s - prev.s) : +(last.s - prev.s).toFixed(1);
  const up = delta > 0;

  return (
    <div style={{ minHeight: '100%', background: 'var(--surface-bg)' }}>
      <HC6.ScreenHeader large title="Health Trends" subtitle="Your vitals over time" right={<HC6.IconButton icon="arrow-left" label="Back" variant="ghost" onClick={() => nav('records')} />} />
      <div style={{ padding: '4px var(--screen-pad) 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* metric toggle */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {METRICS.map((x) => (
            <button key={x.id} onClick={() => setMetric(x.id)} style={{
              flexShrink: 0, height: 36, padding: '0 14px', borderRadius: 'var(--r-pill)', cursor: 'pointer',
              border: `1.5px solid ${metric === x.id ? 'var(--green-300)' : 'var(--border)'}`,
              background: metric === x.id ? 'var(--brand-fill)' : 'var(--surface-card)',
              color: metric === x.id ? 'var(--brand-deep)' : 'var(--text-secondary)',
              font: 'var(--fw-semibold) 13px/1 var(--font-sans)',
            }}>{x.label}</button>
          ))}
        </div>

        {/* latest + chart */}
        <HC6.Card padding="md" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div>
              <div style={{ font: 'var(--text-label)', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>Latest · {m.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ font: 'var(--fw-bold) 30px/1 var(--font-sans)', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{latestVal}</span>
                <span style={{ font: 'var(--fw-medium) 14px/1 var(--font-sans)', color: 'var(--text-muted)' }}>{m.unit}</span>
              </div>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 26, padding: '0 10px', borderRadius: 'var(--r-pill)', background: up ? 'var(--critical-tint)' : 'var(--success-tint)', color: up ? 'var(--critical-ink)' : 'var(--success-ink)', font: 'var(--fw-semibold) 12px/1 var(--font-sans)' }}>
              <HC6.Icon name={up ? 'trending-up' : 'trending-down'} size={14} strokeWidth={2.3} />
              {up ? '+' : ''}{delta} since last
            </div>
          </div>
          <LineChart data={data} dual={m.dual} />
          <div style={{ display: 'flex', justifyContent: 'space-between', font: 'var(--text-meta)', fontWeight: 400, color: 'var(--text-muted)' }}>
            {data.map((d, i) => <span key={i}>{d.date}</span>)}
          </div>
          {m.dual && (
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: 'var(--text-meta)', color: 'var(--text-secondary)' }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--brand)' }} />Systolic</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: 'var(--text-meta)', color: 'var(--text-secondary)' }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent)' }} />Diastolic</span>
            </div>
          )}
        </HC6.Card>

        {/* readings list */}
        <div>
          <HC6.SectionHeader title="Readings" icon="activity" count={data.length} />
          <HC6.Card padding="sm" style={{ padding: 0, overflow: 'hidden' }}>
            {[...data].reverse().map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderTop: i ? '1px solid var(--border-faint)' : 'none' }}>
                <span style={{ font: 'var(--fw-bold) 16px/1 var(--font-sans)', color: 'var(--text-primary)', minWidth: 64 }}>{m.dual ? d.v : d.s}<span style={{ font: 'var(--fw-medium) 11px/1 var(--font-sans)', color: 'var(--text-muted)', marginLeft: 3 }}>{m.unit}</span></span>
                <span style={{ font: 'var(--text-meta)', fontWeight: 400, color: 'var(--text-secondary)' }}>{d.date}</span>
                <span style={{ marginLeft: 'auto', font: 'var(--fw-medium) 11px/1 var(--font-mono)', color: 'var(--text-muted)' }}>{d.visit}</span>
              </div>
            ))}
          </HC6.Card>
        </div>
      </div>
    </div>
  );
}
window.HealthTrends = HealthTrends;
