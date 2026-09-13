/* Screen 3 — Visit detail. Collapsible clinical sections. */
const HC3 = window.HealthChainDesignSystem_9f6dff;

function Section({ icon, title, count, defaultOpen, accent, children }) {
  const [open, setOpen] = React.useState(!!defaultOpen);
  return (
    <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
      <button onClick={() => setOpen((o) => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: 'var(--sp-4)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        <div style={{ width: 32, height: 32, borderRadius: 'var(--r-sm)', background: accent || 'var(--brand-tint)', color: 'var(--brand-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <HC3.Icon name={icon} size={17} strokeWidth={2.1} />
        </div>
        <span style={{ font: 'var(--text-h3)', color: 'var(--text-primary)' }}>{title}</span>
        {count != null && <span style={{ minWidth: 20, height: 20, padding: '0 6px', borderRadius: 'var(--r-pill)', background: 'var(--surface-inset)', color: 'var(--text-secondary)', font: 'var(--fw-bold) 11px/20px var(--font-sans)', textAlign: 'center' }}>{count}</span>}
        <HC3.Icon name="chevron-down" size={20} color="var(--text-muted)" style={{ marginLeft: 'auto', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform var(--dur-base) var(--ease-standard)' }} />
      </button>
      {open && <div style={{ padding: '0 var(--sp-4) var(--sp-4)' }}>{children}</div>}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ font: 'var(--text-label)', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ font: 'var(--text-body)', color: 'var(--text-primary)', textWrap: 'pretty' }}>{children}</div>
    </div>
  );
}

const DXTYPE = { confirmed: 'success', provisional: 'info', 'ruled out': 'neutral', differential: 'accent' };
function DxTypePill({ type }) {
  const tones = { success: ['var(--success-tint)', 'var(--success-ink)'], info: ['var(--info-tint)', 'var(--info-ink)'], neutral: ['var(--locked-tint)', 'var(--locked)'], accent: ['var(--accent-tint)', 'var(--accent-ink)'] };
  const [bg, fg] = tones[DXTYPE[type] || 'neutral'];
  return <span style={{ display: 'inline-flex', height: 22, padding: '0 9px', alignItems: 'center', borderRadius: 'var(--r-pill)', background: bg, color: fg, font: 'var(--fw-semibold) 11px/1 var(--font-sans)', textTransform: 'capitalize' }}>{type}</span>;
}

function MedRow({ m }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden', marginBottom: 8 }}>
      <button onClick={() => setOpen((o) => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        <div style={{ width: 32, height: 32, borderRadius: 'var(--r-sm)', background: 'var(--brand-tint)', color: 'var(--brand-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><HC3.Icon name="pill" size={16} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: 'var(--fw-semibold) 14px/1.2 var(--font-sans)', color: 'var(--text-primary)' }}>{m.name} {m.strength}</div>
          <div style={{ font: 'var(--text-meta)', fontWeight: 400, color: 'var(--text-secondary)' }}>{m.dose} · {m.frequency}</div>
        </div>
        {m.dispensed
          ? <HC3.Icon name="check-circle" size={18} color="var(--success-ink)" />
          : <HC3.Icon name="clock" size={18} color="var(--urgent-ink)" />}
      </button>
      {open && (
        <div style={{ padding: '0 12px 12px', borderTop: '1px solid var(--border-faint)', paddingTop: 12 }}>
          {[['Generic', m.generic], ['Form', m.form], ['Route', m.route], ['Duration', m.duration], ['Quantity', m.quantity]].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 5, font: 'var(--text-meta)', fontWeight: 400 }}>
              <span style={{ color: 'var(--text-muted)' }}>{k}</span><span style={{ color: 'var(--text-primary)', textAlign: 'right' }}>{v}</span>
            </div>
          ))}
          <div style={{ marginTop: 8, padding: 10, borderRadius: 'var(--r-sm)', background: 'var(--surface-inset)', font: 'var(--text-meta)', fontWeight: 400, color: 'var(--text-secondary)' }}>{m.instructions}</div>
        </div>
      )}
    </div>
  );
}

function VitalsGrid({ v }) {
  const items = [
    { label: 'Temperature', value: v.temperature, unit: '°C', icon: 'alert-triangle', critical: v.temperature >= 38 },
    { label: 'Blood pressure', value: `${v.bpSys}/${v.bpDia}`, unit: 'mmHg', icon: 'heart-pulse', critical: v.bpSys >= 140 },
    { label: 'Pulse', value: v.pulse, unit: 'bpm', icon: 'activity', critical: v.pulse > 100 },
    { label: 'Resp. rate', value: v.resp, unit: '/min', icon: 'activity', critical: v.resp > 20 },
    { label: 'SpO₂', value: v.spo2, unit: '%', icon: 'activity', critical: v.spo2 < 95 },
    { label: 'Weight', value: v.weight, unit: 'kg', icon: 'activity', critical: false },
    { label: 'Height', value: v.height, unit: 'cm', icon: 'activity', critical: false },
    { label: 'Pain', value: `${v.pain}/10`, unit: '', icon: 'activity', critical: v.pain >= 7 },
  ];
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {items.map((it) => <HC3.VitalStat key={it.label} compact label={it.label} value={it.value} unit={it.unit} critical={it.critical} icon={it.critical ? 'alert-triangle' : undefined} />)}
      </div>
      <div style={{ font: 'var(--text-meta)', fontWeight: 400, color: 'var(--text-muted)', marginTop: 10 }}>Recorded {v.recorded}</div>
    </div>
  );
}

function VisitDetail({ visitId, nav }) {
  const visit = window.HC.visits.find((x) => x.id === visitId);
  const [phase, setPhase] = React.useState('locked');
  if (!visit) return null;
  const TYPE_LABEL = { outpatient: 'Outpatient', inpatient: 'Inpatient', emergency: 'Emergency', consultation: 'Consultation' };

  return (
    <div style={{ minHeight: '100%', background: 'var(--surface-bg)' }}>
      <HC3.ScreenHeader title={visit.id} onBack={() => nav('records')} right={<HC3.TrustBadge kind="encrypted" size="sm" />} />
      <div style={{ padding: '4px var(--screen-pad) 28px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* summary */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 9px', borderRadius: 'var(--r-pill)', background: 'var(--surface-inset)', font: 'var(--fw-semibold) 11px/1 var(--font-sans)', color: 'var(--text-secondary)' }}>{TYPE_LABEL[visit.visitType]}</span>
          <HC3.PriorityPill priority={visit.priority} size="sm" />
          <HC3.StatusPill status={visit.status} size="sm" />
        </div>
        <div style={{ font: 'var(--fw-semibold) 18px/1.35 var(--font-sans)', color: 'var(--text-primary)', textWrap: 'pretty' }}>{visit.chiefComplaint}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, font: 'var(--text-meta)', fontWeight: 400, color: 'var(--text-secondary)', marginBottom: 4 }}>
          <HC3.Icon name="building" size={14} color="var(--text-muted)" />{visit.institution}
          <span style={{ color: 'var(--ink-300)' }}>•</span>{visit.admissionDate}{visit.dischargeDate ? ` – ${visit.dischargeDate}` : ''}
        </div>

        {visit.away ? (
          <>
            <HC3.LockState phase={phase}
              onAction={phase === 'locked' ? () => setPhase('pending') : (phase === 'denied' ? () => setPhase('pending') : undefined)}
              title={phase === 'locked' ? 'Records held at another hospital' : undefined}
              body={phase === 'locked' ? `Full clinical detail for this visit is stored at ${visit.institution}. Request access to unlock it here.` : undefined} />
            {phase === 'granted' && <Section icon="heart-pulse" title="Vitals" defaultOpen><VitalsGrid v={visit.vitals} /></Section>}
          </>
        ) : (
          <>
            {visit.vitals && <Section icon="heart-pulse" title="Vitals" defaultOpen><VitalsGrid v={visit.vitals} /></Section>}
            {visit.consultation && (
              <Section icon="stethoscope" title="Consultation">
                <Field label="History of present illness">{visit.consultation.hpi}</Field>
                <Field label="Physical examination">{visit.consultation.exam}</Field>
                <Field label="Clinical findings">{visit.consultation.findings}</Field>
                <Field label="Assessment">{visit.consultation.assessment}</Field>
                <Field label="Plan">{visit.consultation.plan}</Field>
                <Field label="Follow-up">{visit.consultation.followUp}</Field>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, borderRadius: 'var(--r-sm)', background: 'var(--brand-tint)' }}>
                  <HC3.Icon name="calendar" size={16} color="var(--brand-deep)" />
                  <span style={{ font: 'var(--fw-semibold) 13px/1 var(--font-sans)', color: 'var(--brand-deep)' }}>Next appointment · {visit.consultation.nextAppointment}</span>
                </div>
              </Section>
            )}
            {visit.diagnoses && (
              <Section icon="stethoscope" title="Diagnoses" count={visit.diagnoses.length}>
                {visit.diagnoses.map((d) => (
                  <div key={d.icd} style={{ padding: '12px 0', borderTop: '1px solid var(--border-faint)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                      <span style={{ font: 'var(--fw-medium) 12px/1 var(--font-mono)', color: 'var(--accent-ink)', background: 'var(--accent-tint)', padding: '3px 7px', borderRadius: 6 }}>{d.icd}</span>
                      <DxTypePill type={d.type} />
                    </div>
                    <div style={{ font: 'var(--fw-semibold) 15px/1.3 var(--font-sans)', color: 'var(--text-primary)' }}>{d.name}</div>
                    <div style={{ font: 'var(--text-meta)', fontWeight: 400, color: 'var(--text-secondary)', marginTop: 3 }}>Severity: {d.severity} · {d.notes}</div>
                  </div>
                ))}
              </Section>
            )}
            {visit.prescriptions && (
              <Section icon="pill" title="Prescriptions" count={visit.prescriptions.reduce((a, p) => a + p.meds.length, 0)}>
                {visit.prescriptions.map((p) => (
                  <div key={p.number} style={{ marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ font: 'var(--fw-medium) 12px/1 var(--font-mono)', color: 'var(--text-muted)' }}>{p.number}</span>
                      <HC3.StatusPill status={p.status} size="sm" />
                    </div>
                    {p.meds.map((m, i) => <MedRow key={i} m={m} />)}
                  </div>
                ))}
              </Section>
            )}
            {visit.labs && (
              <Section icon="flask" title="Lab orders" count={visit.labs.length}>
                {visit.labs.map((l, i) => (
                  <div key={i} style={{ padding: '12px 0', borderTop: '1px solid var(--border-faint)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ font: 'var(--fw-semibold) 14px/1.2 var(--font-sans)', color: 'var(--text-primary)' }}>{l.test}</span>
                      <span style={{ font: 'var(--text-meta)', fontWeight: 400, color: 'var(--text-muted)' }}>{l.code}</span>
                      <div style={{ marginLeft: 'auto' }}><HC3.StatusPill status={l.status} size="sm" /></div>
                    </div>
                    {l.status === 'resulted' && (
                      <div style={{ marginTop: 8, padding: 10, borderRadius: 'var(--r-sm)', background: l.abnormal ? 'var(--critical-tint)' : 'var(--surface-inset)' }}>
                        {l.abnormal && <div style={{ display: 'flex', alignItems: 'center', gap: 6, font: 'var(--fw-semibold) 12px/1.2 var(--font-sans)', color: 'var(--critical-ink)', marginBottom: 5 }}><HC3.Icon name="alert-triangle" size={14} color="var(--critical)" strokeWidth={2.4} />Abnormal: {l.abnormal}</div>}
                        <div style={{ font: 'var(--text-meta)', fontWeight: 400, color: 'var(--text-secondary)' }}>{l.interpretation} · {l.values}</div>
                      </div>
                    )}
                  </div>
                ))}
              </Section>
            )}
            {visit.imaging && visit.imaging.length > 0 && (
              <Section icon="scan" title="Imaging" count={visit.imaging.length}>
                {visit.imaging.map((im, i) => (
                  <div key={i} style={{ padding: '12px 0', borderTop: '1px solid var(--border-faint)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ font: 'var(--fw-semibold) 14px/1.2 var(--font-sans)', color: 'var(--text-primary)', textTransform: 'uppercase' }}>{im.modality}</span>
                      <span style={{ font: 'var(--text-meta)', fontWeight: 400, color: 'var(--text-secondary)' }}>{im.bodyPart}</span>
                      <div style={{ marginLeft: 'auto' }}><HC3.StatusPill status={im.status} size="sm" /></div>
                    </div>
                    <Field label="Findings">{im.findings}</Field>
                    <Field label="Impression">{im.impression}</Field>
                  </div>
                ))}
              </Section>
            )}
            {visit.discharge && (
              <Section icon="file-text" title="Discharge summary" accent="var(--success-tint)">
                <Field label="Discharge diagnosis">{visit.discharge.diagnosis}</Field>
                <Field label="Summary">{visit.discharge.summary}</Field>
                <Field label="Instructions">{visit.discharge.instructions}</Field>
                <Field label="Follow-up date">{visit.discharge.followUp}</Field>
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
window.VisitDetail = VisitDetail;
