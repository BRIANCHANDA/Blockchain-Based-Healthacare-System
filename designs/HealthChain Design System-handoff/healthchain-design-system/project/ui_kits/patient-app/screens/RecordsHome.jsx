/* Screen 2 — Records home. Quick actions + visit list. */
const HC2 = window.HealthChainDesignSystem_9f6dff;

function CountChip({ icon, n, label }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, font: 'var(--fw-semibold) 12px/1 var(--font-sans)', color: 'var(--text-secondary)' }} title={label}>
      <HC2.Icon name={icon} size={14} color="var(--text-muted)" strokeWidth={2.1} />{n}
    </span>
  );
}

const TYPE_LABEL = { outpatient: 'Outpatient', inpatient: 'Inpatient', emergency: 'Emergency', consultation: 'Consultation' };

function VisitCard({ visit, onOpen }) {
  return (
    <HC2.Card interactive onClick={onOpen} padding="md" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ font: 'var(--fw-medium) 12px/1 var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.02em' }}>{visit.id}</span>
        {visit.away && <HC2.Icon name="lock" size={13} color="var(--locked)" />}
        <div style={{ marginLeft: 'auto' }}><HC2.StatusPill status={visit.status} size="sm" /></div>
      </div>
      <div style={{ font: 'var(--fw-semibold) 16px/1.35 var(--font-sans)', color: 'var(--text-primary)', textWrap: 'pretty' }}>{visit.chiefComplaint}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, font: 'var(--text-meta)', fontWeight: 400, color: 'var(--text-secondary)' }}>
        <HC2.Icon name="building" size={14} color="var(--text-muted)" />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{visit.institution}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, font: 'var(--text-meta)', fontWeight: 400, color: 'var(--text-muted)' }}>
        <HC2.Icon name="calendar" size={14} color="var(--text-muted)" />
        {visit.admissionDate}{visit.dischargeDate ? ` – ${visit.dischargeDate}` : ' · ongoing'}
      </div>
      <div style={{ height: 1, background: 'var(--border-faint)', margin: '2px 0' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 9px', borderRadius: 'var(--r-pill)', background: 'var(--surface-inset)', font: 'var(--fw-semibold) 11px/1 var(--font-sans)', color: 'var(--text-secondary)' }}>{TYPE_LABEL[visit.visitType]}</span>
        <HC2.PriorityPill priority={visit.priority} size="sm" />
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <CountChip icon="stethoscope" n={visit.counts.diagnoses} label="Diagnoses" />
          <CountChip icon="pill" n={visit.counts.prescriptions} label="Prescriptions" />
          <CountChip icon="flask" n={visit.counts.labs} label="Lab orders" />
          <CountChip icon="scan" n={visit.counts.imaging} label="Imaging" />
        </div>
      </div>
    </HC2.Card>
  );
}

function QuickAction({ icon, title, sub, tone, onClick }) {
  const tones = { brand: ['var(--brand-tint)', 'var(--brand-deep)'], accent: ['var(--accent-tint)', 'var(--accent-ink)'] };
  const [bg, fg] = tones[tone] || tones.brand;
  return (
    <HC2.Card interactive onClick={onClick} padding="md" elevation="low" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ width: 40, height: 40, borderRadius: 'var(--r-md)', background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <HC2.Icon name={icon} size={21} strokeWidth={2.1} />
      </div>
      <div>
        <div style={{ font: 'var(--fw-semibold) 15px/1.2 var(--font-sans)', color: 'var(--text-primary)' }}>{title}</div>
        <div style={{ font: 'var(--text-meta)', fontWeight: 400, color: 'var(--text-secondary)', marginTop: 2 }}>{sub}</div>
      </div>
    </HC2.Card>
  );
}

function RecordsHome({ nav }) {
  const { patient, visits } = window.HC;
  return (
    <div style={{ minHeight: '100%', background: 'var(--surface-bg)', display: 'flex', flexDirection: 'column' }}>
      <HC2.ScreenHeader large title="Records" subtitle={`Welcome back, ${patient.fullName.split(' ')[0]}`}
        right={<>
          <HC2.IconButton icon="bell" label="Alerts" badge />
          <button onClick={() => nav('profile')} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer' }} aria-label="Profile">
            <HC2.Avatar name={patient.fullName} tone="brand" />
          </button>
        </>} />

      <div style={{ padding: '4px var(--screen-pad) 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Allergy safety banner — color + icon + position */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 'var(--r-md)', background: 'var(--critical-tint)', border: '1px solid color-mix(in srgb, var(--critical) 24%, transparent)' }}>
          <HC2.Icon name="alert-triangle" size={18} color="var(--critical)" strokeWidth={2.3} />
          <span style={{ font: 'var(--fw-semibold) 13px/1.3 var(--font-sans)', color: 'var(--critical-ink)' }}>Allergies: Penicillin, Sulfa drugs</span>
          <span style={{ marginLeft: 'auto', font: 'var(--fw-bold) 12px/1 var(--font-sans)', color: 'var(--critical-ink)' }}>Blood {patient.bloodType}</span>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <QuickAction icon="qr-code" title="My Hospital ID" sub="Show at reception" tone="brand" onClick={() => nav('hospitalId')} />
          <QuickAction icon="trending-up" title="Health Trends" sub="Vitals over time" tone="accent" onClick={() => nav('trends')} />
        </div>

        <div>
          <HC2.SectionHeader title="Medical visits" icon="file-text" count={visits.length} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {visits.map((v) => <VisitCard key={v.id} visit={v} onOpen={() => nav('visit', { id: v.id })} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
window.RecordsHome = RecordsHome;
