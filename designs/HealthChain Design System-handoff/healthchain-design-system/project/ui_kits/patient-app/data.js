/* HealthChain — sample patient data for the UI kit (fictional). */
window.HC = {
  patient: {
    fullName: 'Mwila Banda',
    nationalId: '123456/78/9',
    gender: 'Female',
    dob: '12 Mar 1991',
    age: 35,
    phone: '+260 97 123 4567',
    bloodType: 'O+',
    maritalStatus: 'Married',
    occupation: 'Secondary school teacher',
    allergies: ['Penicillin', 'Sulfa drugs'],
  },

  visits: [
    {
      id: 'VIS-2026-A3F2', visitType: 'inpatient', priority: 'urgent', status: 'in-progress',
      admissionDate: '12 Jun 2026', dischargeDate: null,
      chiefComplaint: 'Shortness of breath and chest tightness for 3 days',
      institution: 'University Teaching Hospital',
      counts: { diagnoses: 2, prescriptions: 3, labs: 4, imaging: 1 },
      away: false,
      vitals: {
        temperature: 38.9, bpSys: 138, bpDia: 88, pulse: 102, resp: 22, spo2: 94,
        weight: 68, height: 164, pain: 4, recorded: '14 Jun 2026, 08:10',
      },
      consultation: {
        chiefComplaint: 'Shortness of breath and chest tightness for 3 days',
        hpi: 'Progressive dyspnoea on exertion, worse at night. Dry cough. No fever until today. No leg swelling.',
        exam: 'Mild respiratory distress. Bilateral wheeze. SpO₂ 94% on room air.',
        findings: 'Reduced air entry at both bases, expiratory wheeze.',
        assessment: 'Acute exacerbation of asthma, likely viral trigger.',
        plan: 'Nebulised salbutamol, oral prednisolone, monitor SpO₂. Chest X-ray.',
        followUp: 'Review in 48 hours; step-down if SpO₂ stable >95%.',
        nextAppointment: '16 Jun 2026',
      },
      diagnoses: [
        { icd: 'J45.909', name: 'Unspecified asthma with exacerbation', type: 'confirmed', severity: 'Moderate', notes: 'Responsive to bronchodilators.' },
        { icd: 'J06.9', name: 'Acute upper respiratory infection', type: 'provisional', severity: 'Mild', notes: 'Likely viral trigger.' },
      ],
      prescriptions: [
        {
          number: 'RX-2026-7741', status: 'dispensing',
          meds: [
            { name: 'Salbutamol', generic: 'Salbutamol sulfate', strength: '5 mg/mL', form: 'Nebuliser solution', dose: '2.5 mg', frequency: 'Every 6 hours', route: 'Inhaled', duration: '5 days', quantity: '20 vials', instructions: 'Via nebuliser. Stop if palpitations.', dispensed: true },
            { name: 'Prednisolone', generic: 'Prednisolone', strength: '5 mg', form: 'Tablet', dose: '40 mg', frequency: 'Once daily (morning)', route: 'Oral', duration: '5 days', quantity: '40 tablets', instructions: 'Take with food.', dispensed: false },
            { name: 'Paracetamol', generic: 'Paracetamol', strength: '500 mg', form: 'Tablet', dose: '1 g', frequency: 'Every 6 hours as needed', route: 'Oral', duration: '5 days', quantity: '24 tablets', instructions: 'Max 4 g per day.', dispensed: false },
          ],
        },
      ],
      labs: [
        { test: 'Full blood count', code: 'FBC', specimen: 'Whole blood', status: 'resulted', interpretation: 'Mild leukocytosis', abnormal: 'WBC 12.4 ×10⁹/L (high)', values: 'Hb 12.8 · WBC 12.4 · Plt 280' },
        { test: 'C-reactive protein', code: 'CRP', specimen: 'Serum', status: 'resulted', interpretation: 'Raised', abnormal: 'CRP 48 mg/L (high)', values: 'CRP 48 mg/L' },
        { test: 'Malaria RDT', code: 'mRDT', specimen: 'Whole blood', status: 'resulted', interpretation: 'Negative', abnormal: null, values: 'Negative' },
        { test: 'Arterial blood gas', code: 'ABG', specimen: 'Arterial blood', status: 'ordered', interpretation: null, abnormal: null, values: null },
      ],
      imaging: [
        { modality: 'x-ray', bodyPart: 'Chest', indication: 'Dyspnoea, rule out consolidation', status: 'resulted', findings: 'Hyperinflated lung fields. No focal consolidation or effusion.', impression: 'No acute consolidation. Findings consistent with airway disease.', recommendations: 'Clinical correlation; repeat if symptoms persist.' },
      ],
      discharge: null,
    },
    {
      id: 'VIS-2026-91C7', visitType: 'outpatient', priority: 'routine', status: 'completed',
      admissionDate: '02 May 2026', dischargeDate: '02 May 2026',
      chiefComplaint: 'Routine antenatal review',
      institution: 'Chilenje Clinic',
      counts: { diagnoses: 1, prescriptions: 1, labs: 2, imaging: 0 },
      away: false,
      vitals: { temperature: 36.7, bpSys: 118, bpDia: 76, pulse: 78, resp: 16, spo2: 99, weight: 67, height: 164, pain: 0, recorded: '02 May 2026, 10:20' },
      consultation: { chiefComplaint: 'Routine antenatal review', hpi: 'Well, no complaints. Good fetal movements.', exam: 'Fundal height appropriate. FHR 142 bpm.', findings: 'Normal antenatal examination.', assessment: 'Uncomplicated pregnancy at 28 weeks.', plan: 'Continue iron and folate. Routine bloods.', followUp: 'Review in 4 weeks.', nextAppointment: '30 May 2026' },
      diagnoses: [{ icd: 'Z34.8', name: 'Supervision of normal pregnancy', type: 'confirmed', severity: '—', notes: '28 weeks gestation.' }],
      prescriptions: [{ number: 'RX-2026-6620', status: 'dispensed', meds: [{ name: 'Ferrous + Folic acid', generic: 'Ferrous fumarate / folic acid', strength: '200 mg / 0.4 mg', form: 'Tablet', dose: '1 tablet', frequency: 'Once daily', route: 'Oral', duration: '30 days', quantity: '30 tablets', instructions: 'Take with food.', dispensed: true }] }],
      labs: [
        { test: 'Haemoglobin', code: 'Hb', specimen: 'Whole blood', status: 'resulted', interpretation: 'Normal', abnormal: null, values: 'Hb 11.6 g/dL' },
        { test: 'HIV screen', code: 'HIV', specimen: 'Serum', status: 'resulted', interpretation: 'Non-reactive', abnormal: null, values: 'Non-reactive' },
      ],
      imaging: [],
      discharge: { diagnosis: 'Normal antenatal review', summary: 'Reviewed and well at 28 weeks. No concerns.', instructions: 'Continue supplements. Return if reduced fetal movements.', followUp: '30 May 2026' },
    },
    {
      id: 'VIS-2025-44B8', visitType: 'emergency', priority: 'emergency', status: 'completed',
      admissionDate: '18 Nov 2025', dischargeDate: '20 Nov 2025',
      chiefComplaint: 'Road traffic accident — left forearm injury',
      institution: 'Ndola Teaching Hospital',
      counts: { diagnoses: 1, prescriptions: 2, labs: 1, imaging: 1 },
      away: true,
      vitals: { temperature: 36.9, bpSys: 126, bpDia: 80, pulse: 96, resp: 18, spo2: 98, weight: 66, height: 164, pain: 7, recorded: '18 Nov 2025, 19:42' },
    },
  ],

  trends: {
    bp:    [{ v: '118/76', s: 118, d: 76, date: '02 May', visit: 'VIS-2026-91C7' }, { v: '124/80', s: 124, d: 80, date: '28 May', visit: 'VIS-2026-91C7' }, { v: '132/86', s: 132, d: 86, date: '12 Jun', visit: 'VIS-2026-A3F2' }, { v: '138/88', s: 138, d: 88, date: '14 Jun', visit: 'VIS-2026-A3F2' }],
    pulse: [{ s: 78, date: '02 May', visit: 'VIS-2026-91C7' }, { s: 80, date: '28 May', visit: 'VIS-2026-91C7' }, { s: 98, date: '12 Jun', visit: 'VIS-2026-A3F2' }, { s: 102, date: '14 Jun', visit: 'VIS-2026-A3F2' }],
    temp:  [{ s: 36.7, date: '02 May', visit: 'VIS-2026-91C7' }, { s: 36.8, date: '28 May', visit: 'VIS-2026-91C7' }, { s: 38.4, date: '12 Jun', visit: 'VIS-2026-A3F2' }, { s: 38.9, date: '14 Jun', visit: 'VIS-2026-A3F2' }],
    spo2:  [{ s: 99, date: '02 May', visit: 'VIS-2026-91C7' }, { s: 98, date: '28 May', visit: 'VIS-2026-91C7' }, { s: 95, date: '12 Jun', visit: 'VIS-2026-A3F2' }, { s: 94, date: '14 Jun', visit: 'VIS-2026-A3F2' }],
    weight:[{ s: 67, date: '02 May', visit: 'VIS-2026-91C7' }, { s: 67.5, date: '28 May', visit: 'VIS-2026-91C7' }, { s: 68, date: '12 Jun', visit: 'VIS-2026-A3F2' }, { s: 68, date: '14 Jun', visit: 'VIS-2026-A3F2' }],
  },

  pendingRequests: [
    { id: 'req1', doctor: 'Dr. Chanda Mulenga', institution: 'Levy Mwanawasa Hospital', reason: 'Cardiology referral review — need prior asthma and BP history before consultation.', permissions: ['visits', 'vitals', 'diagnoses'], timestamp: '2 hours ago' },
    { id: 'req2', doctor: 'Dr. Grace Tembo', institution: 'Chainama Hills Hospital', reason: 'Medication reconciliation for new prescription.', permissions: ['prescriptions', 'diagnoses'], timestamp: 'Yesterday' },
  ],
  granted: [
    { id: 'g1', name: 'Dr. Joseph Phiri', institution: 'University Teaching Hospital', permissions: ['visits', 'vitals', 'diagnoses', 'prescriptions', 'lab-results', 'imaging'], granted: '12 Jun 2026', expiry: 'Expires 12 Sep 2026' },
    { id: 'g2', name: 'Chilenje Clinic', institution: 'Antenatal team', permissions: ['visits', 'vitals'], granted: '02 May 2026', expiry: 'Expires 02 Aug 2026' },
  ],
  overrides: [
    { id: 'o1', name: 'Dr. Emmanuel Zulu', institution: 'Ndola Teaching Hospital — Emergency', reason: 'Patient unconscious on arrival after RTA; emergency access used to retrieve blood type and allergies.', when: '18 Nov 2025, 19:38', tx: '0x7a3f…e91c' },
  ],

  referrals: [
    { number: 'REF-2026-0312', institution: 'Levy Mwanawasa Hospital', reason: 'Cardiology assessment for persistent tachycardia', urgency: 'urgent', status: 'pending', date: '13 Jun 2026' },
    { number: 'REF-2026-0298', institution: 'Cancer Diseases Hospital', reason: 'Routine screening referral', urgency: 'routine', status: 'accepted', date: '05 Jun 2026' },
    { number: 'REF-2026-0110', institution: 'Eye Clinic, UTH', reason: 'Diabetic retinopathy screening', urgency: 'routine', status: 'completed', date: '20 Apr 2026' },
    { number: 'REF-2025-0904', institution: 'Physiotherapy, Ndola', reason: 'Post-fracture rehabilitation', urgency: 'routine', status: 'rejected', date: '22 Nov 2025' },
  ],
};
