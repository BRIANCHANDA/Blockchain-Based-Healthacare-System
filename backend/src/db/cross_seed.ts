/**
 * HealthChain Zambia — Cross-Institution Seed (ADDITIVE)
 * -------------------------------------------------------
 * Run AFTER the main seed.ts — does NOT drop existing data.
 *
 * Adds:
 *  1. Ndola Central Hospital staff:
 *     - Receptionist, Doctor, Nurse, Lab Tech, Pharmacist
 *  2. Completed visits for p1 (Fredrick Musonda) at Ndola
 *     - He was already registered at NCH in the main seed
 *  3. NO blockchain permissions granted to anyone
 *     - Dr Kasonde (DOC-2024-001, CBUH) must REQUEST permission from patient
 *     - Dr Mwanza  (DOC-2024-002, CBUH) must REQUEST permission from patient
 *     - Both will see "Access Required" and must send a request
 *     - Patient (Fredrick, 123456/78/1) approves/denies from the mobile app
 *
 * HOW TO TEST:
 *  1. Log in as DOC-2024-001 or DOC-2024-002 on the web dashboard
 *  2. Open Fredrick Musonda's visit → Patient History tab
 *  3. See "Access Required" → fill in reason → Send Access Request
 *  4. Log in as patient (123456/78/1) on mobile app
 *  5. See the pending request → Approve or Deny
 *  6. Web dashboard auto-refreshes and shows history (if approved)
 *
 * CREDENTIALS (all passwords: Password123!):
 *  Ndola Receptionist: REC-NDL-001   Thandiwe Ngoma
 *  Ndola Doctor:       DOC-NDL-001   Dr Chanda Phiri
 *  Ndola Nurse:        NUR-NDL-001   Sr Mutale Bwalya
 *  Ndola Lab Tech:     LAB-NDL-001   Moses Zulu
 *  Ndola Pharmacist:   PHAR-NDL-001  Charity Mumba
 */

import { hash } from 'bcryptjs';
import crypto from 'crypto';
import { eq, sql } from 'drizzle-orm';
import { db } from './index';
import { encrypt } from '../services/crypto';
import {
    institutions, departments, wards,
    practitioners, patients,
    patientInstitutionRegistrations,
    visits, vitalSigns,
    consultations, diagnoses,
    labTestOrders, labTestResults,
    prescriptions, prescriptionItems,
    auditLogs,
} from './schema';

// ── Helpers ───────────────────────────────────────────────────────────────────

const uid = () => crypto.randomUUID();
const addr = () => `0x${crypto.randomBytes(20).toString('hex')}`;
const txId = () => crypto.randomBytes(16).toString('hex');
const daysAgo = (d: number) => new Date(Date.now() - d * 86400000);

const PASSWORD_HASH = await hash('Password123!', 12);
const recordHash = (data: object) =>
    crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');

// ── Step 1: Resolve existing IDs from main seed ───────────────────────────────

console.log('🔑  Resolving existing institution and patient IDs…');

const ndolaRow = await db
    .select({ id: institutions.id })
    .from(institutions)
    .where(eq(institutions.institutionCode, 'NCH-001'))
    .limit(1);

if (!ndolaRow.length)
    throw new Error('Ndola Central Hospital not found — run main seed.ts first!');

const ndolaId = ndolaRow[0].id;
console.log(`✓ Ndola Central Hospital: ${ndolaId}`);

// Resolve patient p1 via his Ndola registration
const ndolaRegRow = await db
    .select({ patientId: patientInstitutionRegistrations.patientId })
    .from(patientInstitutionRegistrations)
    .where(eq(patientInstitutionRegistrations.institutionId, ndolaId))
    .limit(1);

if (!ndolaRegRow.length)
    throw new Error('No patient registered at Ndola — run main seed.ts first!');

const p1Id = ndolaRegRow[0].patientId;

const p1Row = await db
    .select({ blockchainAddress: patients.blockchainAddress })
    .from(patients)
    .where(eq(patients.id, p1Id))
    .limit(1);

console.log(`✓ Patient p1 (Fredrick Musonda): ${p1Id}`);
console.log(`  Blockchain address: ${p1Row[0].blockchainAddress}`);
console.log('');
console.log('  ⚠  No blockchain permissions will be seeded.');
console.log('     Doctors must request access and patient must approve on mobile app.');
console.log('');

// ── Step 2: Ndola Departments ─────────────────────────────────────────────────

console.log('🏢  Seeding Ndola departments…');

const ndolaDeptInternalId = uid();
const ndolaDeptLabId = uid();
const ndolaDeptPharmacyId = uid();
const ndolaDeptEmergId = uid();
const ndolaDeptOutpatientId = uid();

await db.insert(departments).values([
    { id: ndolaDeptInternalId, institutionId: ndolaId, departmentCode: 'IM', departmentName: 'Internal Medicine', departmentType: 'clinical', location: 'Floor 1, Block A', phone: '+260212456790', isActive: true },
    { id: ndolaDeptLabId, institutionId: ndolaId, departmentCode: 'LAB', departmentName: 'Clinical Laboratory', departmentType: 'diagnostic', location: 'Ground Floor', phone: '+260212456791', isActive: true },
    { id: ndolaDeptPharmacyId, institutionId: ndolaId, departmentCode: 'PHAR', departmentName: 'Pharmacy', departmentType: 'support', location: 'Ground Floor', phone: '+260212456792', isActive: true },
    { id: ndolaDeptEmergId, institutionId: ndolaId, departmentCode: 'ED', departmentName: 'Emergency Department', departmentType: 'clinical', location: 'Ground Floor', phone: '+260212456793', isActive: true },
    { id: ndolaDeptOutpatientId, institutionId: ndolaId, departmentCode: 'OPD', departmentName: 'Outpatient Department', departmentType: 'clinical', location: 'Ground Floor', phone: '+260212456794', isActive: true },
]).onConflictDoNothing();

// ── Step 3: Ndola Ward ────────────────────────────────────────────────────────

console.log('🛏️  Seeding Ndola ward…');

const ndolaWardMaleId = uid();

await db.insert(wards).values([
    { id: ndolaWardMaleId, departmentId: ndolaDeptInternalId, institutionId: ndolaId, wardCode: 'NCH-M1', wardName: 'Male General Ward', wardType: 'general', bedCount: 30, availableBeds: 8, isActive: true },
]).onConflictDoNothing();

// ── Step 4: Ndola Staff ───────────────────────────────────────────────────────

console.log('👨‍⚕️  Seeding Ndola staff…');

const ndolaReceptionistId = uid();
const ndolaDoctorId = uid();
const ndolaNurseId = uid();
const ndolaLabTechId = uid();
const ndolaPharmacistId = uid();

await db.insert(practitioners).values([
    // Receptionist
    {
        id: ndolaReceptionistId,
        blockchainAddress: addr(),
        institutionId: ndolaId,
        firstNameEncrypted: encrypt('Thandiwe'),
        lastNameEncrypted: encrypt('Ngoma'),
        licenseNumber: 'REC-NDL-001',
        institutionalId: 'NCH-REC-001',
        role: 'receptionist',
        department: 'Outpatient Department',
        phoneNumberEncrypted: encrypt('+260976200001'),
        emailEncrypted: encrypt('t.ngoma@ndolahospital.zm'),
        passwordHash: PASSWORD_HASH,
        isVerified: true, isActive: true,
    },
    // Doctor
    {
        id: ndolaDoctorId,
        blockchainAddress: addr(),
        institutionId: ndolaId,
        firstNameEncrypted: encrypt('Chanda'),
        lastNameEncrypted: encrypt('Phiri'),
        licenseNumber: 'DOC-NDL-001',
        institutionalId: 'NCH-DOC-001',
        role: 'practitioner',
        specialization: 'Internal Medicine',
        department: 'Internal Medicine',
        qualifications: 'MBChB, MMed (Internal Medicine)',
        phoneNumberEncrypted: encrypt('+260976200002'),
        emailEncrypted: encrypt('c.phiri@ndolahospital.zm'),
        passwordHash: PASSWORD_HASH,
        isVerified: true, isActive: true,
    },
    // Nurse
    {
        id: ndolaNurseId,
        blockchainAddress: addr(),
        institutionId: ndolaId,
        firstNameEncrypted: encrypt('Mutale'),
        lastNameEncrypted: encrypt('Bwalya'),
        licenseNumber: 'NUR-NDL-001',
        institutionalId: 'NCH-NUR-001',
        role: 'nurse',
        department: 'Internal Medicine',
        phoneNumberEncrypted: encrypt('+260976200003'),
        emailEncrypted: encrypt('m.bwalya@ndolahospital.zm'),
        passwordHash: PASSWORD_HASH,
        isVerified: true, isActive: true,
    },
    // Lab Technician
    {
        id: ndolaLabTechId,
        blockchainAddress: addr(),
        institutionId: ndolaId,
        firstNameEncrypted: encrypt('Moses'),
        lastNameEncrypted: encrypt('Zulu'),
        licenseNumber: 'LAB-NDL-001',
        institutionalId: 'NCH-LAB-001',
        role: 'lab_technician',
        department: 'Clinical Laboratory',
        qualifications: 'BSc Medical Laboratory Sciences',
        phoneNumberEncrypted: encrypt('+260976200004'),
        emailEncrypted: encrypt('m.zulu@ndolahospital.zm'),
        passwordHash: PASSWORD_HASH,
        isVerified: true, isActive: true,
    },
    // Pharmacist
    {
        id: ndolaPharmacistId,
        blockchainAddress: addr(),
        institutionId: ndolaId,
        firstNameEncrypted: encrypt('Charity'),
        lastNameEncrypted: encrypt('Mumba'),
        licenseNumber: 'PHAR-NDL-001',
        institutionalId: 'NCH-PHAR-001',
        role: 'pharmacist',
        department: 'Pharmacy',
        qualifications: 'BPharm',
        phoneNumberEncrypted: encrypt('+260976200005'),
        emailEncrypted: encrypt('c.mumba@ndolahospital.zm'),
        passwordHash: PASSWORD_HASH,
        isVerified: true, isActive: true,
    },
]).onConflictDoNothing();

console.log('✓ Ndola staff: Receptionist, Doctor, Nurse, Lab Tech, Pharmacist');

// ── Step 5: Ndola Visits for p1 (Fredrick Musonda) ───────────────────────────
// These are the records that CBUH doctors will want to view but need permission for.

console.log('\n🚶  Seeding Ndola visits for Fredrick Musonda…');

const ndolaV1Id = uid(); // first hypertension presentation — 1 year ago
const ndolaV2Id = uid(); // hypertensive urgency emergency — 8 months ago
const ndolaV3Id = uid(); // routine follow-up — 6 months ago

await db.insert(visits).values([
    // ── Visit 1: First presentation — 1 year ago ──────────────────────────
    {
        id: ndolaV1Id,
        patientId: p1Id,
        institutionId: ndolaId,
        departmentId: ndolaDeptOutpatientId,
        visitNumber: 'NCH-2023-HT001',
        visitType: 'outpatient',
        admissionDate: daysAgo(365),
        dischargeDate: daysAgo(365),
        chiefComplaint: 'Headache and dizziness — first presentation',
        admittingDiagnosis: 'Newly diagnosed hypertension',
        dischargeDiagnosis: 'Essential hypertension — newly diagnosed. BP 168/108 at presentation.',
        status: 'completed',
        priority: 'urgent',
        assignedNurseId: ndolaNurseId,
        assignedDoctorId: ndolaDoctorId,
        dischargeSummary: 'First presentation with hypertension. BP 168/108. No end organ damage on baseline investigations. Commenced on Amlodipine 5mg OD. Baseline bloods taken.',
        dischargeInstructions: 'Start Amlodipine 5mg OD. Lifestyle modification — DASH diet, smoking cessation. Return in 4 weeks for BP check.',
        followUpDate: daysAgo(330),
        blockchainHash: recordHash({ v: 'ndola_v1' }),
        dischargeBlockchainHash: recordHash({ d: 'ndola_v1' }),
    },
    // ── Visit 2: Hypertensive urgency emergency — 8 months ago ───────────
    {
        id: ndolaV2Id,
        patientId: p1Id,
        institutionId: ndolaId,
        departmentId: ndolaDeptEmergId,
        visitNumber: 'NCH-2024-EM001',
        visitType: 'emergency',
        admissionDate: daysAgo(240),
        dischargeDate: daysAgo(239),
        chiefComplaint: 'Severe headache — BP 192/118 at workplace clinic',
        admittingDiagnosis: 'Hypertensive urgency',
        dischargeDiagnosis: 'Hypertensive urgency resolved. Medication non-compliance identified.',
        status: 'completed',
        priority: 'emergency',
        assignedNurseId: ndolaNurseId,
        assignedDoctorId: ndolaDoctorId,
        wardOrRoom: 'Emergency Bay 3',
        dischargeSummary: 'Presented with BP 192/118 and severe headache. No neurological deficit. IV Hydralazine 10mg given. BP settled to 144/88 after 6 hours observation. Medication non-compliance addressed — patient ran out of tablets.',
        dischargeInstructions: 'Strict medication compliance — do not skip doses. Amlodipine 10mg OD. Arrange repeat prescriptions proactively. Return immediately if headache recurs.',
        blockchainHash: recordHash({ v: 'ndola_v2' }),
        dischargeBlockchainHash: recordHash({ d: 'ndola_v2' }),
    },
    // ── Visit 3: Routine follow-up — 6 months ago ─────────────────────────
    {
        id: ndolaV3Id,
        patientId: p1Id,
        institutionId: ndolaId,
        departmentId: ndolaDeptOutpatientId,
        visitNumber: 'NCH-2025-HT001',
        visitType: 'outpatient',
        admissionDate: daysAgo(180),
        dischargeDate: daysAgo(180),
        chiefComplaint: 'Routine hypertension follow-up — 3-monthly review',
        admittingDiagnosis: 'Known hypertension on treatment',
        dischargeDiagnosis: 'Hypertension — moderately controlled. BP 152/96. Uptitrated.',
        status: 'completed',
        priority: 'routine',
        assignedNurseId: ndolaNurseId,
        assignedDoctorId: ndolaDoctorId,
        dischargeSummary: 'BP 152/96 on Amlodipine 10mg. Not at target < 140/90. Lipid profile shows elevated LDL — statin discussed. Patient still smoking 10 cigarettes/day.',
        dischargeInstructions: 'Continue Amlodipine 10mg OD. Start Atorvastatin 20mg ON. Urgent smoking cessation — refer to cessation clinic. Return in 3 months.',
        followUpDate: daysAgo(90),
        blockchainHash: recordHash({ v: 'ndola_v3' }),
        dischargeBlockchainHash: recordHash({ d: 'ndola_v3' }),
    },
]).onConflictDoNothing();

// ── Step 6: Vital Signs ───────────────────────────────────────────────────────

console.log('💓  Seeding Ndola vital signs…');

await db.insert(vitalSigns).values([
    {
        id: uid(), visitId: ndolaV1Id, patientId: p1Id, recordedByNurseId: ndolaNurseId,
        temperature: '37.2', bloodPressureSystolic: 168, bloodPressureDiastolic: 108,
        pulseRate: 94, respiratoryRate: 18, oxygenSaturation: 97,
        weight: '77.5', height: '172.0', painLevel: 6,
        nurseNotes: 'First time presentation. BP very elevated. Patient reports 3-week headaches. No prior hypertension diagnosis. Referred to doctor urgently.',
        blockchainHash: recordHash({ vs: 'ndola_v1' }), recordedAt: daysAgo(365),
    },
    {
        id: uid(), visitId: ndolaV2Id, patientId: p1Id, recordedByNurseId: ndolaNurseId,
        temperature: '37.1', bloodPressureSystolic: 192, bloodPressureDiastolic: 118,
        pulseRate: 98, respiratoryRate: 20, oxygenSaturation: 97,
        weight: '78.2', height: '172.0', painLevel: 8,
        nurseNotes: 'VERY HIGH BP on arrival. Severe headache. GCS 15/15. No focal neurology. IV access established. IV Hydralazine 10mg given stat. Repeat BP in 30 minutes.',
        blockchainHash: recordHash({ vs: 'ndola_v2' }), recordedAt: daysAgo(240),
    },
    {
        id: uid(), visitId: ndolaV3Id, patientId: p1Id, recordedByNurseId: ndolaNurseId,
        temperature: '37.0', bloodPressureSystolic: 152, bloodPressureDiastolic: 96,
        pulseRate: 82, respiratoryRate: 16, oxygenSaturation: 98,
        weight: '78.0', height: '172.0', painLevel: 2,
        nurseNotes: 'BP elevated but improved from last visit. Patient on Amlodipine 10mg. Admits occasional missed doses. Still smoking. Referred for smoking cessation.',
        blockchainHash: recordHash({ vs: 'ndola_v3' }), recordedAt: daysAgo(180),
    },
]).onConflictDoNothing();

// ── Step 7: Consultations ─────────────────────────────────────────────────────

console.log('🩺  Seeding Ndola consultations…');

const ndolaC1Id = uid();
const ndolaC2Id = uid();
const ndolaC3Id = uid();

await db.insert(consultations).values([
    {
        id: ndolaC1Id,
        visitId: ndolaV1Id, patientId: p1Id, practitionerId: ndolaDoctorId,
        chiefComplaint: 'Headache and dizziness — first presentation',
        historyOfPresentIllness: 'Mr Fredrick Musonda, 35-year-old mining engineer. 3-week history of frontal headaches and intermittent dizziness. High BP noted at workplace screening (170/105). No prior hypertension diagnosis. Smokes 10 cigarettes/day for 10 years. Drinks alcohol socially. Family history: father with hypertension.',
        physicalExamination: 'BP 168/108 mmHg (confirmed on repeat after 10 minutes rest: 165/106). HR 94. BMI 26.5. Fundoscopy: normal. Urine dipstick: negative. ECG: normal sinus rhythm, no LVH.',
        assessment: 'Newly diagnosed essential hypertension, stage 2. No evidence of end organ damage. Modifiable risk factors: smoking, occupational stress, elevated lipids.',
        plan: 'Start Amlodipine 5mg OD. Lifestyle modification: DASH diet, smoking cessation, reduce alcohol, aerobic exercise 30 min 5x/week. Baseline bloods: FBC, U&E, lipid profile, fasting glucose. Follow-up 4 weeks.',
        blockchainHash: recordHash({ c: 'ndola_c1' }),
    },
    {
        id: ndolaC2Id,
        visitId: ndolaV2Id, patientId: p1Id, practitionerId: ndolaDoctorId,
        chiefComplaint: 'Hypertensive urgency — BP 192/118',
        historyOfPresentIllness: 'Mr Musonda, known hypertensive on Amlodipine 10mg OD. BP 192/118 at workplace clinic after 2-day severe occipital headache. Ran out of medications 5 days ago. Has been under significant work stress at the mine. No chest pain, no visual disturbance, no limb weakness, no dysarthria.',
        physicalExamination: 'Distressed. BP 192/118 mmHg. HR 98. GCS 15/15. No focal neurological deficit. Fundoscopy: AV nipping — no haemorrhages, no papilloedema. Heart sounds normal, no bruits.',
        clinicalFindings: 'Hypertensive urgency without evidence of end organ damage. ECG: sinus tachycardia, no ischaemic changes. Urine dipstick: trace protein only.',
        assessment: 'Hypertensive urgency secondary to medication non-compliance. No target organ damage. Precipitated by running out of Amlodipine for 5 days.',
        plan: 'IV Hydralazine 10mg slow IV push. Restart Amlodipine 10mg OD. BP monitoring every 30 minutes. Discharge when BP < 160/100 sustained for 2 hours. Counselled strongly on medication compliance.',
        blockchainHash: recordHash({ c: 'ndola_c2' }),
    },
    {
        id: ndolaC3Id,
        visitId: ndolaV3Id, patientId: p1Id, practitionerId: ndolaDoctorId,
        chiefComplaint: 'Routine hypertension review',
        historyOfPresentIllness: 'Mr Musonda returns for 3-monthly review on Amlodipine 10mg OD. BP at home 145–158/88–98. Mild headaches 2x per week. Still smoking 10 cigarettes/day despite counselling. Fasting lipid profile from baseline visit shows LDL 3.9 mmol/L.',
        physicalExamination: 'BP 152/96 mmHg (right arm, sitting). HR 82. BMI 26.8. No JVP elevation. Heart sounds normal. No peripheral oedema. Mild AV nicking on fundoscopy — no haemorrhages.',
        assessment: 'Hypertension inadequately controlled — BP above target (< 140/90) despite maximum Amlodipine dose. Persistent smoking is a significant modifiable cardiovascular risk factor. Dyslipidaemia confirmed on previous bloods — statin indicated given 10-year CVD risk.',
        plan: 'Add Atorvastatin 20mg nocte. Refer to smoking cessation clinic — pharmacotherapy (varenicline or NRT) offered. Consider adding ACEi/ARB at next visit if BP remains above target. Repeat fasting lipids in 3 months.',
        followUpInstructions: 'Attend smoking cessation clinic. Take Atorvastatin at night. Home BP log — bring to next appointment.',
        blockchainHash: recordHash({ c: 'ndola_c3' }),
    },
]).onConflictDoNothing();

// ── Step 8: Diagnoses ─────────────────────────────────────────────────────────

console.log('📝  Seeding Ndola diagnoses…');

await db.insert(diagnoses).values([
    { id: uid(), consultationId: ndolaC1Id, visitId: ndolaV1Id, patientId: p1Id, practitionerId: ndolaDoctorId, icdCode: 'I10', diagnosisName: 'Essential (primary) hypertension — newly diagnosed', diagnosisType: 'confirmed', severity: 'moderate', blockchainHash: recordHash({ dx: 'ndola_v1_htn' }) },
    { id: uid(), consultationId: ndolaC1Id, visitId: ndolaV1Id, patientId: p1Id, practitionerId: ndolaDoctorId, icdCode: 'F17.210', diagnosisName: 'Nicotine dependence, cigarettes, uncomplicated', diagnosisType: 'confirmed', severity: 'mild', blockchainHash: recordHash({ dx: 'ndola_v1_smoking' }) },
    { id: uid(), consultationId: ndolaC2Id, visitId: ndolaV2Id, patientId: p1Id, practitionerId: ndolaDoctorId, icdCode: 'I16.0', diagnosisName: 'Hypertensive urgency', diagnosisType: 'confirmed', severity: 'severe', blockchainHash: recordHash({ dx: 'ndola_v2_urgency' }) },
    { id: uid(), consultationId: ndolaC3Id, visitId: ndolaV3Id, patientId: p1Id, practitionerId: ndolaDoctorId, icdCode: 'I10', diagnosisName: 'Essential hypertension — inadequately controlled', diagnosisType: 'confirmed', severity: 'moderate', blockchainHash: recordHash({ dx: 'ndola_v3_htn' }) },
    { id: uid(), consultationId: ndolaC3Id, visitId: ndolaV3Id, patientId: p1Id, practitionerId: ndolaDoctorId, icdCode: 'E78.5', diagnosisName: 'Hyperlipidaemia — LDL elevated, HDL low', diagnosisType: 'confirmed', severity: 'moderate', blockchainHash: recordHash({ dx: 'ndola_v3_lipid' }) },
]).onConflictDoNothing();

// ── Step 9: Lab Orders & Results ──────────────────────────────────────────────

console.log('🔬  Seeding Ndola lab orders and results…');

const ndolaLabFbcId = uid();
const ndolaLabUeId = uid();
const ndolaLabLipidId = uid();
const ndolaLabFbsId = uid();

await db.insert(labTestOrders).values([
    { id: ndolaLabFbcId, orderNumber: 'NCH-LAB-2023-001', visitId: ndolaV1Id, patientId: p1Id, orderedByPractitionerId: ndolaDoctorId, testName: 'Full Blood Count (FBC)', testCode: 'FBC', specimenType: 'blood', urgency: 'routine', status: 'resulted', assignedTo: ndolaLabTechId, clinicalNotes: 'Baseline — newly diagnosed hypertension', blockchainHash: recordHash({ lab: 'ndola_fbc' }), orderedAt: daysAgo(365) },
    { id: ndolaLabUeId, orderNumber: 'NCH-LAB-2023-002', visitId: ndolaV1Id, patientId: p1Id, orderedByPractitionerId: ndolaDoctorId, testName: 'Urea & Electrolytes (U&E)', testCode: 'UE', specimenType: 'blood', urgency: 'routine', status: 'resulted', assignedTo: ndolaLabTechId, clinicalNotes: 'Renal function baseline', blockchainHash: recordHash({ lab: 'ndola_ue' }), orderedAt: daysAgo(365) },
    { id: ndolaLabLipidId, orderNumber: 'NCH-LAB-2023-003', visitId: ndolaV1Id, patientId: p1Id, orderedByPractitionerId: ndolaDoctorId, testName: 'Fasting Lipid Profile', testCode: 'LIPID', specimenType: 'blood', urgency: 'routine', status: 'resulted', assignedTo: ndolaLabTechId, clinicalNotes: 'Cardiovascular risk assessment', blockchainHash: recordHash({ lab: 'ndola_lipid' }), orderedAt: daysAgo(365) },
    { id: ndolaLabFbsId, orderNumber: 'NCH-LAB-2023-004', visitId: ndolaV1Id, patientId: p1Id, orderedByPractitionerId: ndolaDoctorId, testName: 'Fasting Blood Sugar (FBS)', testCode: 'FBS', specimenType: 'blood', urgency: 'routine', status: 'resulted', assignedTo: ndolaLabTechId, clinicalNotes: 'Screen for diabetes — CV risk', blockchainHash: recordHash({ lab: 'ndola_fbs' }), orderedAt: daysAgo(365) },
]).onConflictDoNothing();

await db.insert(labTestResults).values([
    {
        id: uid(), labTestOrderId: ndolaLabFbcId, performedByLabTechId: ndolaLabTechId,
        resultsData: { WBC: '7.2 x10⁹/L', RBC: '5.1 x10¹²/L', Hb: '15.2 g/dL', HCT: '46%', PLT: '198 x10⁹/L', MCV: '88 fL' },
        interpretation: 'Full blood count within normal limits. No anaemia.',
        referenceRanges: { WBC: '4.5–11.0', Hb: '13–17 g/dL (M)', PLT: '150–400' },
        blockchainHash: recordHash({ r: 'ndola_fbc' }), resultedAt: daysAgo(364),
    },
    {
        id: uid(), labTestOrderId: ndolaLabUeId, performedByLabTechId: ndolaLabTechId,
        resultsData: { sodium: '139 mmol/L', potassium: '4.1 mmol/L', urea: '5.8 mmol/L', creatinine: '88 µmol/L', eGFR: '86 mL/min/1.73m²' },
        interpretation: 'Renal function normal. eGFR 86 — no evidence of hypertensive nephropathy at this stage.',
        referenceRanges: { sodium: '136–145', potassium: '3.5–5.0', creatinine: '62–106 µmol/L (M)', eGFR: '> 60' },
        blockchainHash: recordHash({ r: 'ndola_ue' }), resultedAt: daysAgo(364),
    },
    {
        id: uid(), labTestOrderId: ndolaLabLipidId, performedByLabTechId: ndolaLabTechId,
        resultsData: { totalCholesterol: '5.8 mmol/L', LDL: '3.9 mmol/L', HDL: '1.0 mmol/L', triglycerides: '2.0 mmol/L', nonHDL: '4.8 mmol/L' },
        interpretation: 'Borderline elevated total cholesterol. LDL significantly elevated. HDL at lower limit. Combined with hypertension and active smoking — high 10-year cardiovascular risk. Statin therapy indicated.',
        abnormalFindings: 'LDL 3.9 mmol/L (elevated, target < 3.0), HDL 1.0 mmol/L (low-normal), Total cholesterol 5.8 (borderline elevated)',
        referenceRanges: { totalCholesterol: '< 5.0 mmol/L', LDL: '< 3.0 mmol/L', HDL: '> 1.0 mmol/L (M)', triglycerides: '< 1.7 mmol/L' },
        blockchainHash: recordHash({ r: 'ndola_lipid' }), resultedAt: daysAgo(364),
    },
    {
        id: uid(), labTestOrderId: ndolaLabFbsId, performedByLabTechId: ndolaLabTechId,
        resultsData: { fastingGlucose: '5.4 mmol/L', HbA1c: '5.6%' },
        interpretation: 'Fasting glucose and HbA1c normal. No evidence of diabetes mellitus. Pre-diabetes not yet present.',
        referenceRanges: { fastingGlucose: '3.9–5.6 mmol/L (normal)', HbA1c: '< 5.7% (normal)' },
        blockchainHash: recordHash({ r: 'ndola_fbs' }), resultedAt: daysAgo(364),
    },
]).onConflictDoNothing();

// ── Step 10: Prescriptions ────────────────────────────────────────────────────

console.log('💊  Seeding Ndola prescriptions…');

const ndolaRx1Id = uid(); // initial Amlodipine 5mg
const ndolaRx2Id = uid(); // Amlodipine 10mg after emergency
const ndolaRx3Id = uid(); // Amlodipine 10mg + Atorvastatin after follow-up

await db.insert(prescriptions).values([
    { id: ndolaRx1Id, prescriptionNumber: 'NCH-RX-2023-001', visitId: ndolaV1Id, patientId: p1Id, prescribedByPractitionerId: ndolaDoctorId, status: 'dispensed', blockchainHash: recordHash({ rx: ndolaRx1Id }), prescribedAt: daysAgo(365) },
    { id: ndolaRx2Id, prescriptionNumber: 'NCH-RX-2024-001', visitId: ndolaV2Id, patientId: p1Id, prescribedByPractitionerId: ndolaDoctorId, status: 'dispensed', blockchainHash: recordHash({ rx: ndolaRx2Id }), prescribedAt: daysAgo(240) },
    { id: ndolaRx3Id, prescriptionNumber: 'NCH-RX-2025-001', visitId: ndolaV3Id, patientId: p1Id, prescribedByPractitionerId: ndolaDoctorId, status: 'dispensed', blockchainHash: recordHash({ rx: ndolaRx3Id }), prescribedAt: daysAgo(180) },
]).onConflictDoNothing();

await db.insert(prescriptionItems).values([
    // rx1 — initial Amlodipine 5mg
    { id: uid(), prescriptionId: ndolaRx1Id, medicationName: 'Amlodipine', genericName: 'Amlodipine besylate', strength: '5mg', dosageForm: 'tablet', dose: '5mg', frequency: 'once_daily', route: 'oral', duration: '90 days', quantity: 90, instructions: 'Take in the morning. Monitor BP weekly. Return if headache worsens.', refillsAllowed: 2, isDispensed: true, dispensedByPharmacistId: ndolaPharmacistId, dispensedAt: daysAgo(365) },
    // rx2 — uptitrated after emergency + Hydralazine (stat, no repeat)
    { id: uid(), prescriptionId: ndolaRx2Id, medicationName: 'Amlodipine', genericName: 'Amlodipine besylate', strength: '10mg', dosageForm: 'tablet', dose: '10mg', frequency: 'once_daily', route: 'oral', duration: '90 days', quantity: 90, instructions: 'INCREASED DOSE. Do not skip doses. Home BP twice daily. See doctor if BP > 160 systolic.', refillsAllowed: 2, isDispensed: true, dispensedByPharmacistId: ndolaPharmacistId, dispensedAt: daysAgo(239) },
    // rx3 — continued Amlodipine + added Atorvastatin
    { id: uid(), prescriptionId: ndolaRx3Id, medicationName: 'Amlodipine', genericName: 'Amlodipine besylate', strength: '10mg', dosageForm: 'tablet', dose: '10mg', frequency: 'once_daily', route: 'oral', duration: '90 days', quantity: 90, instructions: 'Continue morning dose. Strict compliance required.', refillsAllowed: 2, isDispensed: true, dispensedByPharmacistId: ndolaPharmacistId, dispensedAt: daysAgo(180) },
    { id: uid(), prescriptionId: ndolaRx3Id, medicationName: 'Atorvastatin', genericName: 'Atorvastatin calcium', strength: '20mg', dosageForm: 'tablet', dose: '20mg', frequency: 'once_daily', route: 'oral', duration: '90 days', quantity: 90, instructions: 'Take at night (most effective when taken in evening). Report any muscle pain or weakness immediately.', refillsAllowed: 2, isDispensed: true, dispensedByPharmacistId: ndolaPharmacistId, dispensedAt: daysAgo(180) },
]).onConflictDoNothing();

// ── Step 11: Audit Logs ───────────────────────────────────────────────────────

console.log('📋  Seeding Ndola audit logs…');

await db.insert(auditLogs).values([
    { id: uid(), userId: ndolaReceptionistId, userType: 'receptionist', patientId: p1Id, actionType: 'create', resourceType: 'visit', resourceId: ndolaV1Id, timestamp: daysAgo(365), blockchainTransactionId: txId(), isEmergencyOverride: false, createdAt: daysAgo(365) },
    { id: uid(), userId: ndolaReceptionistId, userType: 'receptionist', patientId: p1Id, actionType: 'create', resourceType: 'visit', resourceId: ndolaV2Id, timestamp: daysAgo(240), blockchainTransactionId: txId(), isEmergencyOverride: false, createdAt: daysAgo(240) },
    { id: uid(), userId: ndolaReceptionistId, userType: 'receptionist', patientId: p1Id, actionType: 'create', resourceType: 'visit', resourceId: ndolaV3Id, timestamp: daysAgo(180), blockchainTransactionId: txId(), isEmergencyOverride: false, createdAt: daysAgo(180) },
    { id: uid(), userId: ndolaNurseId, userType: 'nurse', patientId: p1Id, actionType: 'create', resourceType: 'vital_signs', resourceId: ndolaV1Id, timestamp: daysAgo(365), blockchainTransactionId: txId(), isEmergencyOverride: false, createdAt: daysAgo(365) },
    { id: uid(), userId: ndolaNurseId, userType: 'nurse', patientId: p1Id, actionType: 'create', resourceType: 'vital_signs', resourceId: ndolaV2Id, timestamp: daysAgo(240), blockchainTransactionId: txId(), isEmergencyOverride: false, createdAt: daysAgo(240) },
    { id: uid(), userId: ndolaDoctorId, userType: 'practitioner', patientId: p1Id, actionType: 'create', resourceType: 'consultation', resourceId: ndolaC1Id, timestamp: daysAgo(365), blockchainTransactionId: txId(), isEmergencyOverride: false, createdAt: daysAgo(365) },
    { id: uid(), userId: ndolaDoctorId, userType: 'practitioner', patientId: p1Id, actionType: 'create', resourceType: 'consultation', resourceId: ndolaC2Id, timestamp: daysAgo(240), blockchainTransactionId: txId(), isEmergencyOverride: false, createdAt: daysAgo(240) },
    { id: uid(), userId: ndolaDoctorId, userType: 'practitioner', patientId: p1Id, actionType: 'create', resourceType: 'consultation', resourceId: ndolaC3Id, timestamp: daysAgo(180), blockchainTransactionId: txId(), isEmergencyOverride: false, createdAt: daysAgo(180) },
    { id: uid(), userId: ndolaLabTechId, userType: 'lab_technician', patientId: p1Id, actionType: 'create', resourceType: 'lab_result', resourceId: ndolaLabFbcId, timestamp: daysAgo(364), blockchainTransactionId: txId(), isEmergencyOverride: false, createdAt: daysAgo(364) },
    { id: uid(), userId: ndolaLabTechId, userType: 'lab_technician', patientId: p1Id, actionType: 'create', resourceType: 'lab_result', resourceId: ndolaLabLipidId, timestamp: daysAgo(364), blockchainTransactionId: txId(), isEmergencyOverride: false, createdAt: daysAgo(364) },
]).onConflictDoNothing();

// ── Done ──────────────────────────────────────────────────────────────────────

console.log('\n✅  Cross-institution seed complete!\n');
console.log('═══════════════════════════════════════════════════════════════════════');
console.log('  NDOLA CENTRAL HOSPITAL STAFF  (password: Password123!)');
console.log('  Login with licenseNumber:');
console.log('  ├─ Receptionist  REC-NDL-001    Thandiwe Ngoma');
console.log('  ├─ Doctor        DOC-NDL-001    Dr Chanda Phiri (Internal Medicine)');
console.log('  ├─ Nurse         NUR-NDL-001    Sr Mutale Bwalya');
console.log('  ├─ Lab Tech      LAB-NDL-001    Moses Zulu');
console.log('  └─ Pharmacist    PHAR-NDL-001   Charity Mumba');
console.log('');
console.log('  NDOLA VISITS FOR Fredrick Musonda (123456/78/1):');
console.log('  ├─ NCH-2023-HT001  First hypertension presentation  (1 year ago)');
console.log('  │   Vitals, Consultation, Diagnoses (HTN + smoking)');
console.log('  │   Labs: FBC, U&E, Lipid Profile, FBS — all resulted');
console.log('  │   Rx: Amlodipine 5mg OD (dispensed)');
console.log('  ├─ NCH-2024-EM001  Hypertensive urgency — emergency (8 months ago)');
console.log('  │   Vitals, Consultation, Diagnosis');
console.log('  │   Rx: Amlodipine 10mg OD (dispensed)');
console.log('  └─ NCH-2025-HT001  Routine follow-up               (6 months ago)');
console.log('      Vitals, Consultation, Diagnoses (HTN + dyslipidaemia)');
console.log('      Rx: Amlodipine 10mg + Atorvastatin 20mg ON (dispensed)');
console.log('');
console.log('  ⚠  NO BLOCKCHAIN PERMISSIONS SEEDED');
console.log('  Both CBUH doctors must REQUEST access from the patient.');
console.log('');
console.log('  HOW TO TEST PERMISSION FLOW:');
console.log('  ┌─ Web Dashboard (CBUH Doctor) ──────────────────────────────────┐');
console.log('  │  1. Log in as DOC-2024-001 (Dr Kasonde) or DOC-2024-002        │');
console.log('  │  2. Open Fredrick Musonda\'s visit → Patient History tab        │');
console.log('  │  3. See "Access Required" screen                                │');
console.log('  │  4. Fill in clinical reason → Send Access Request               │');
console.log('  └─────────────────────────────────────────────────────────────────┘');
console.log('  ┌─ Mobile App (Patient) ──────────────────────────────────────────┐');
console.log('  │  5. Log in as patient: 123456/78/1 / Password123!              │');
console.log('  │  6. See pending permission request notification                  │');
console.log('  │  7. Approve → web dashboard auto-refreshes, shows history ✅    │');
console.log('  │     Deny  → web dashboard shows "Request Declined" ❌           │');
console.log('  └─────────────────────────────────────────────────────────────────┘');
console.log('═══════════════════════════════════════════════════════════════════════\n');