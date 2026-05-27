/**
 * HealthChain Zambia — Database Seed
 * ------------------------------------
 * Run with:  bun run src/db/seed.ts
 *
 * KEY FIX: Does NOT pre-generate UUIDs for practitioners/institutions.
 * Instead inserts with explicit IDs using crypto.randomUUID(), then queries
 * them back by license number to get the real DB-stored IDs before inserting
 * visits and other dependent records.
 */

import { hash } from 'bcryptjs';
import crypto from 'crypto';
import { eq, inArray, sql } from 'drizzle-orm';
import { db } from './index';
import { encrypt } from '../services/crypto';
import {
    institutions, departments, wards,
    practitioners, patients,
    patientInstitutionRegistrations,
    visits, vitalSigns,
    consultations, diagnoses,
    labTestOrders, labTestResults,
    imagingOrders, imagingReports,
    prescriptions, prescriptionItems,
    allergies, medicalHistory,
    accessPermissions, accessRequests,
    auditLogs,
} from './schema';

// ── Helpers ───────────────────────────────────────────────────────────────────

const uid = () => crypto.randomUUID();
const addr = () => `0x${crypto.randomBytes(20).toString('hex')}`;
const txId = () => crypto.randomBytes(16).toString('hex');
const daysAgo = (d: number) => new Date(Date.now() - d * 86400000);
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600000);

const PASSWORD_HASH = await hash('Password123!', 12);

const recordHash = (data: object) =>
    crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');

// ── 1. INSTITUTIONS ───────────────────────────────────────────────────────────

console.log('🏥  Seeding institutions…');

const cbuhId = uid();
const ndolaId = uid();
const kitweId = uid();

await db.insert(institutions).values([
    {
        id: cbuhId,
        institutionCode: 'CBUH-001',
        institutionName: 'Copperbelt University Teaching Hospital',
        institutionType: 'teaching_hospital',
        blockchainAddress: addr(),
        addressEncrypted: encrypt('Jambo Drive, Kitwe, Copperbelt Province, Zambia'),
        phoneEncrypted: encrypt('+260212345678'),
        emailEncrypted: encrypt('info@cbuh.zm'),
        licenseNumber: 'ZMH-2024-001',
        accreditationStatus: 'accredited',
        accreditationExpiry: '2027-12-31',
        bedCapacity: 850,
        specialties: ['Cardiology', 'Neurology', 'Oncology', 'Orthopaedics', 'Paediatrics', 'Obstetrics'],
        services: ['Emergency', 'ICU', 'Laboratory', 'Radiology', 'Pharmacy', 'Physiotherapy'],
        isActive: true,
    },
    {
        id: ndolaId,
        institutionCode: 'NCH-001',
        institutionName: 'Ndola Central Hospital',
        institutionType: 'central_hospital',
        blockchainAddress: addr(),
        addressEncrypted: encrypt('Broadway Avenue, Ndola, Copperbelt Province, Zambia'),
        phoneEncrypted: encrypt('+260212456789'),
        emailEncrypted: encrypt('admin@ndolahospital.zm'),
        licenseNumber: 'ZMH-2024-002',
        accreditationStatus: 'accredited',
        accreditationExpiry: '2026-06-30',
        bedCapacity: 600,
        specialties: ['General Surgery', 'Internal Medicine', 'Paediatrics', 'Gynaecology'],
        services: ['Emergency', 'Laboratory', 'Radiology', 'Pharmacy'],
        isActive: true,
    },
    {
        id: kitweId,
        institutionCode: 'KCH-001',
        institutionName: 'Kitwe Central Hospital',
        institutionType: 'central_hospital',
        blockchainAddress: addr(),
        addressEncrypted: encrypt('Kantanshi Road, Kitwe, Copperbelt Province, Zambia'),
        phoneEncrypted: encrypt('+260212567890'),
        emailEncrypted: encrypt('admin@kitwehospital.zm'),
        licenseNumber: 'ZMH-2024-003',
        accreditationStatus: 'accredited',
        accreditationExpiry: '2026-12-31',
        bedCapacity: 500,
        specialties: ['Internal Medicine', 'Paediatrics', 'Obstetrics', 'Surgery'],
        services: ['Emergency', 'Laboratory', 'Pharmacy'],
        isActive: true,
    },
]).onConflictDoNothing();

// ── 2. DEPARTMENTS ────────────────────────────────────────────────────────────

console.log('🏢  Seeding departments…');

const deptEmergencyId = uid();
const deptInternalMedId = uid();
const deptPaediatricsId = uid();
const deptSurgeryId = uid();
const deptObstetricsId = uid();
const deptLaboratoryId = uid();
const deptRadiologyId = uid();
const deptPharmacyId = uid();
const deptOutpatientId = uid();

await db.insert(departments).values([
    { id: deptEmergencyId, institutionId: cbuhId, departmentCode: 'ED', departmentName: 'Emergency Department', departmentType: 'clinical', location: 'Ground Floor, Block A', phone: '+260212345679', isActive: true },
    { id: deptInternalMedId, institutionId: cbuhId, departmentCode: 'IM', departmentName: 'Internal Medicine', departmentType: 'clinical', location: 'Floor 2, Block B', phone: '+260212345680', isActive: true },
    { id: deptPaediatricsId, institutionId: cbuhId, departmentCode: 'PAED', departmentName: 'Paediatrics', departmentType: 'clinical', location: 'Floor 3, Block B', phone: '+260212345681', isActive: true },
    { id: deptSurgeryId, institutionId: cbuhId, departmentCode: 'SURG', departmentName: 'General Surgery', departmentType: 'clinical', location: 'Floor 1, Block C', phone: '+260212345682', isActive: true },
    { id: deptObstetricsId, institutionId: cbuhId, departmentCode: 'OBS', departmentName: 'Obstetrics & Gynaecology', departmentType: 'clinical', location: 'Floor 4, Block B', phone: '+260212345683', isActive: true },
    { id: deptLaboratoryId, institutionId: cbuhId, departmentCode: 'LAB', departmentName: 'Clinical Laboratory', departmentType: 'diagnostic', location: 'Ground Floor, Block D', phone: '+260212345684', isActive: true },
    { id: deptRadiologyId, institutionId: cbuhId, departmentCode: 'RAD', departmentName: 'Radiology & Imaging', departmentType: 'diagnostic', location: 'Ground Floor, Block D', phone: '+260212345685', isActive: true },
    { id: deptPharmacyId, institutionId: cbuhId, departmentCode: 'PHAR', departmentName: 'Pharmacy', departmentType: 'support', location: 'Ground Floor, Block E', phone: '+260212345686', isActive: true },
    { id: deptOutpatientId, institutionId: cbuhId, departmentCode: 'OPD', departmentName: 'Outpatient Department', departmentType: 'clinical', location: 'Ground Floor, Block A', phone: '+260212345687', isActive: true },
]).onConflictDoNothing();

// ── 3. WARDS ──────────────────────────────────────────────────────────────────

console.log('🛏️  Seeding wards…');

const wardMaleId = uid();
const wardFemaleId = uid();
const wardPaedId = uid();
const wardMatId = uid();
const wardIcuId = uid();
const wardSurgId = uid();

await db.insert(wards).values([
    { id: wardMaleId, departmentId: deptInternalMedId, institutionId: cbuhId, wardCode: 'WARD-M1', wardName: 'Male General Ward', wardType: 'general', bedCount: 40, availableBeds: 12, isActive: true },
    { id: wardFemaleId, departmentId: deptInternalMedId, institutionId: cbuhId, wardCode: 'WARD-F1', wardName: 'Female General Ward', wardType: 'general', bedCount: 40, availableBeds: 8, isActive: true },
    { id: wardPaedId, departmentId: deptPaediatricsId, institutionId: cbuhId, wardCode: 'WARD-P1', wardName: 'Paediatric Ward', wardType: 'paediatric', bedCount: 30, availableBeds: 15, isActive: true },
    { id: wardMatId, departmentId: deptObstetricsId, institutionId: cbuhId, wardCode: 'WARD-MAT', wardName: 'Maternity Ward', wardType: 'maternity', bedCount: 25, availableBeds: 6, isActive: true },
    { id: wardIcuId, departmentId: deptEmergencyId, institutionId: cbuhId, wardCode: 'WARD-ICU', wardName: 'Intensive Care Unit', wardType: 'icu', bedCount: 10, availableBeds: 3, isActive: true },
    { id: wardSurgId, departmentId: deptSurgeryId, institutionId: cbuhId, wardCode: 'WARD-S1', wardName: 'Surgical Ward', wardType: 'surgical', bedCount: 30, availableBeds: 10, isActive: true },
]).onConflictDoNothing();

// ── 4. PRACTITIONERS ──────────────────────────────────────────────────────────
// Insert with explicit IDs, then query back by licenseNumber to confirm
// the actual DB IDs before using them in foreign keys.

console.log('👨‍⚕️  Seeding practitioners…');

const pIds = {
    admin: uid(), rec1: uid(), rec2: uid(),
    nurse1: uid(), nurse2: uid(), nurse3: uid(),
    doc1: uid(), doc2: uid(), doc3: uid(), doc4: uid(),
    lab1: uid(), lab2: uid(),
    radio1: uid(),
    pharm1: uid(), pharm2: uid(),
};

await db.insert(practitioners).values([
    // Admin
    { id: pIds.admin, blockchainAddress: addr(), institutionId: cbuhId, firstNameEncrypted: encrypt('Chanda'), lastNameEncrypted: encrypt('Mwape'), licenseNumber: 'ADMIN-2024-001', institutionalId: 'CBUH-ADMIN-001', role: 'admin', specialization: 'Hospital Administration', department: 'Administration', phoneNumberEncrypted: encrypt('+260971000001'), emailEncrypted: encrypt('c.mwape@cbuh.zm'), passwordHash: PASSWORD_HASH, isVerified: true, isActive: true },
    // Receptionists
    { id: pIds.rec1, blockchainAddress: addr(), institutionId: cbuhId, firstNameEncrypted: encrypt('Namukolo'), lastNameEncrypted: encrypt('Sichone'), licenseNumber: 'REC-2024-001', institutionalId: 'CBUH-REC-001', role: 'receptionist', department: 'Outpatient Department', phoneNumberEncrypted: encrypt('+260971000002'), emailEncrypted: encrypt('n.sichone@cbuh.zm'), passwordHash: PASSWORD_HASH, isVerified: true, isActive: true },
    { id: pIds.rec2, blockchainAddress: addr(), institutionId: cbuhId, firstNameEncrypted: encrypt('Bwalya'), lastNameEncrypted: encrypt('Tembo'), licenseNumber: 'REC-2024-002', institutionalId: 'CBUH-REC-002', role: 'receptionist', department: 'Emergency Department', phoneNumberEncrypted: encrypt('+260971000003'), emailEncrypted: encrypt('b.tembo@cbuh.zm'), passwordHash: PASSWORD_HASH, isVerified: true, isActive: true },
    // Nurses
    { id: pIds.nurse1, blockchainAddress: addr(), institutionId: cbuhId, firstNameEncrypted: encrypt('Mutinta'), lastNameEncrypted: encrypt('Banda'), licenseNumber: 'NUR-2024-001', institutionalId: 'CBUH-NUR-001', role: 'nurse', department: 'Internal Medicine', phoneNumberEncrypted: encrypt('+260971000004'), emailEncrypted: encrypt('m.banda@cbuh.zm'), passwordHash: PASSWORD_HASH, isVerified: true, isActive: true },
    { id: pIds.nurse2, blockchainAddress: addr(), institutionId: cbuhId, firstNameEncrypted: encrypt('Chilufya'), lastNameEncrypted: encrypt('Mulenga'), licenseNumber: 'NUR-2024-002', institutionalId: 'CBUH-NUR-002', role: 'nurse', department: 'Paediatrics', phoneNumberEncrypted: encrypt('+260971000005'), emailEncrypted: encrypt('c.mulenga@cbuh.zm'), passwordHash: PASSWORD_HASH, isVerified: true, isActive: true },
    { id: pIds.nurse3, blockchainAddress: addr(), institutionId: cbuhId, firstNameEncrypted: encrypt('Kalinda'), lastNameEncrypted: encrypt('Phiri'), licenseNumber: 'NUR-2024-003', institutionalId: 'CBUH-NUR-003', role: 'nurse', department: 'Emergency Department', phoneNumberEncrypted: encrypt('+260971000006'), emailEncrypted: encrypt('k.phiri@cbuh.zm'), passwordHash: PASSWORD_HASH, isVerified: true, isActive: true },
    // Doctors
    { id: pIds.doc1, blockchainAddress: addr(), institutionId: cbuhId, firstNameEncrypted: encrypt('Mubanga'), lastNameEncrypted: encrypt('Kasonde'), licenseNumber: 'DOC-2024-001', institutionalId: 'CBUH-DOC-001', role: 'practitioner', specialization: 'Internal Medicine', department: 'Internal Medicine', phoneNumberEncrypted: encrypt('+260971000007'), emailEncrypted: encrypt('m.kasonde@cbuh.zm'), passwordHash: PASSWORD_HASH, isVerified: true, isActive: true, qualifications: 'MBChB, MMed (Internal Medicine)' },
    { id: pIds.doc2, blockchainAddress: addr(), institutionId: cbuhId, firstNameEncrypted: encrypt('Nchimunya'), lastNameEncrypted: encrypt('Mwanza'), licenseNumber: 'DOC-2024-002', institutionalId: 'CBUH-DOC-002', role: 'practitioner', specialization: 'Paediatrics', department: 'Paediatrics', phoneNumberEncrypted: encrypt('+260971000008'), emailEncrypted: encrypt('n.mwanza@cbuh.zm'), passwordHash: PASSWORD_HASH, isVerified: true, isActive: true, qualifications: 'MBChB, DCH, MMed (Paediatrics)' },
    { id: pIds.doc3, blockchainAddress: addr(), institutionId: cbuhId, firstNameEncrypted: encrypt('Kangwa'), lastNameEncrypted: encrypt('Chipimo'), licenseNumber: 'DOC-2024-003', institutionalId: 'CBUH-DOC-003', role: 'practitioner', specialization: 'General Surgery', department: 'Surgery', phoneNumberEncrypted: encrypt('+260971000009'), emailEncrypted: encrypt('k.chipimo@cbuh.zm'), passwordHash: PASSWORD_HASH, isVerified: true, isActive: true, qualifications: 'MBChB, FCS (ECSA)' },
    { id: pIds.doc4, blockchainAddress: addr(), institutionId: cbuhId, firstNameEncrypted: encrypt('Nkandu'), lastNameEncrypted: encrypt('Luo'), licenseNumber: 'DOC-2024-004', institutionalId: 'CBUH-DOC-004', role: 'practitioner', specialization: 'Obstetrics & Gynaecology', department: 'Obstetrics & Gynaecology', phoneNumberEncrypted: encrypt('+260971000010'), emailEncrypted: encrypt('n.luo@cbuh.zm'), passwordHash: PASSWORD_HASH, isVerified: true, isActive: true, qualifications: 'MBChB, MMed (OBS/GYN)' },
    // Lab Technicians
    { id: pIds.lab1, blockchainAddress: addr(), institutionId: cbuhId, firstNameEncrypted: encrypt('Mwila'), lastNameEncrypted: encrypt('Kapasa'), licenseNumber: 'LAB-2024-001', institutionalId: 'CBUH-LAB-001', role: 'lab_technician', department: 'Clinical Laboratory', phoneNumberEncrypted: encrypt('+260971000011'), emailEncrypted: encrypt('m.kapasa@cbuh.zm'), passwordHash: PASSWORD_HASH, isVerified: true, isActive: true, qualifications: 'BSc Medical Laboratory Sciences' },
    { id: pIds.lab2, blockchainAddress: addr(), institutionId: cbuhId, firstNameEncrypted: encrypt('Precious'), lastNameEncrypted: encrypt("Ng'ona"), licenseNumber: 'LAB-2024-002', institutionalId: 'CBUH-LAB-002', role: 'lab_technician', department: 'Clinical Laboratory', phoneNumberEncrypted: encrypt('+260971000012'), emailEncrypted: encrypt('p.ngona@cbuh.zm'), passwordHash: PASSWORD_HASH, isVerified: true, isActive: true, qualifications: 'BSc Medical Laboratory Sciences' },
    // Radiologist
    { id: pIds.radio1, blockchainAddress: addr(), institutionId: cbuhId, firstNameEncrypted: encrypt('Chisomo'), lastNameEncrypted: encrypt('Zimba'), licenseNumber: 'RAD-2024-001', institutionalId: 'CBUH-RAD-001', role: 'radiologist', department: 'Radiology & Imaging', phoneNumberEncrypted: encrypt('+260971000013'), emailEncrypted: encrypt('c.zimba@cbuh.zm'), passwordHash: PASSWORD_HASH, isVerified: true, isActive: true, qualifications: 'MBChB, MMed (Radiology)' },
    // Pharmacists
    { id: pIds.pharm1, blockchainAddress: addr(), institutionId: cbuhId, firstNameEncrypted: encrypt('Mwansa'), lastNameEncrypted: encrypt('Kabwe'), licenseNumber: 'PHAR-2024-001', institutionalId: 'CBUH-PHAR-001', role: 'pharmacist', department: 'Pharmacy', phoneNumberEncrypted: encrypt('+260971000014'), emailEncrypted: encrypt('m.kabwe@cbuh.zm'), passwordHash: PASSWORD_HASH, isVerified: true, isActive: true, qualifications: 'BPharm' },
    { id: pIds.pharm2, blockchainAddress: addr(), institutionId: cbuhId, firstNameEncrypted: encrypt('Taonga'), lastNameEncrypted: encrypt('Mbewe'), licenseNumber: 'PHAR-2024-002', institutionalId: 'CBUH-PHAR-002', role: 'pharmacist', department: 'Pharmacy', phoneNumberEncrypted: encrypt('+260971000015'), emailEncrypted: encrypt('t.mbewe@cbuh.zm'), passwordHash: PASSWORD_HASH, isVerified: true, isActive: true, qualifications: 'BPharm, MPharm' },
]).onConflictDoNothing();

// ── KEY FIX: Query back real IDs from DB by licenseNumber ─────────────────────
// This ensures we always use the actual stored UUIDs regardless of whether
// the insert used the pre-generated IDs or the DB generated its own.

console.log('🔑  Resolving real practitioner IDs from DB…');

const staffRows = await db
    .select({ id: practitioners.id, licenseNumber: practitioners.licenseNumber })
    .from(practitioners)
    .where(inArray(practitioners.licenseNumber, [
        'ADMIN-2024-001', 'REC-2024-001', 'REC-2024-002',
        'NUR-2024-001', 'NUR-2024-002', 'NUR-2024-003',
        'DOC-2024-001', 'DOC-2024-002', 'DOC-2024-003', 'DOC-2024-004',
        'LAB-2024-001', 'LAB-2024-002',
        'RAD-2024-001',
        'PHAR-2024-001', 'PHAR-2024-002',
    ]));

const S = Object.fromEntries(staffRows.map(r => [r.licenseNumber, r.id]));

// Verify all IDs resolved
const required = [
    'ADMIN-2024-001', 'REC-2024-001', 'REC-2024-002',
    'NUR-2024-001', 'NUR-2024-002', 'NUR-2024-003',
    'DOC-2024-001', 'DOC-2024-002', 'DOC-2024-003', 'DOC-2024-004',
    'LAB-2024-001', 'LAB-2024-002', 'RAD-2024-001',
    'PHAR-2024-001', 'PHAR-2024-002',
];
const missing = required.filter(k => !S[k]);
if (missing.length > 0) {
    throw new Error(`Missing practitioner IDs for: ${missing.join(', ')}`);
}

console.log(`✓ Resolved ${staffRows.length} practitioner IDs`);

// ── 5. PATIENTS ───────────────────────────────────────────────────────────────

console.log('🧑‍🤝‍🧑  Seeding patients…');

const patId = {
    p1: uid(), p2: uid(), p3: uid(), p4: uid(), p5: uid(),
};

const patBA = {
    p1: `patient:${crypto.createHash('sha256').update('123456/78/1salt').digest('hex')}`,
    p2: `patient:${crypto.createHash('sha256').update('234567/89/1salt').digest('hex')}`,
    p3: `patient:${crypto.createHash('sha256').update('345678/90/1salt').digest('hex')}`,
    p4: `patient:${crypto.createHash('sha256').update('456789/01/1salt').digest('hex')}`,
    p5: `patient:${crypto.createHash('sha256').update('567890/12/1salt').digest('hex')}`,
};

await db.insert(patients).values([
    { id: patId.p1, blockchainAddress: patBA.p1, firstNameEncrypted: encrypt('Fredrick'), lastNameEncrypted: encrypt('Musonda'), dateOfBirthEncrypted: encrypt('1989-03-14'), gender: 'male', bloodType: 'O+', phoneNumberEncrypted: encrypt('+260977100001'), emailEncrypted: encrypt('f.musonda@gmail.com'), addressEncrypted: encrypt('Plot 45, Parklands, Kitwe'), nationalIdEncrypted: encrypt('123456/78/1'), emergencyContactEncrypted: encrypt('Grace Musonda — +260977200001 — Wife'), maritalStatus: 'married', occupation: 'Mining Engineer', passwordHash: PASSWORD_HASH, isActive: true },
    { id: patId.p2, blockchainAddress: patBA.p2, firstNameEncrypted: encrypt('Chipo'), lastNameEncrypted: encrypt('Nkuwa'), dateOfBirthEncrypted: encrypt('1996-07-22'), gender: 'female', bloodType: 'A+', phoneNumberEncrypted: encrypt('+260977100002'), emailEncrypted: encrypt('c.nkuwa@gmail.com'), addressEncrypted: encrypt('House 12, Riverside, Ndola'), nationalIdEncrypted: encrypt('234567/89/1'), emergencyContactEncrypted: encrypt('James Nkuwa — +260977200002 — Husband'), maritalStatus: 'married', occupation: 'Teacher', passwordHash: PASSWORD_HASH, isActive: true },
    { id: patId.p3, blockchainAddress: patBA.p3, firstNameEncrypted: encrypt('Liam'), lastNameEncrypted: encrypt('Lungu'), dateOfBirthEncrypted: encrypt('2016-11-05'), gender: 'male', bloodType: 'B+', phoneNumberEncrypted: encrypt('+260977100003'), addressEncrypted: encrypt('Plot 89, Chipulukusu, Ndola'), nationalIdEncrypted: encrypt('345678/90/1'), emergencyContactEncrypted: encrypt('Mary Lungu — +260977200003 — Mother'), passwordHash: PASSWORD_HASH, isActive: true },
    { id: patId.p4, blockchainAddress: patBA.p4, firstNameEncrypted: encrypt('Agnes'), lastNameEncrypted: encrypt('Sakala'), dateOfBirthEncrypted: encrypt('1972-01-30'), gender: 'female', bloodType: 'AB+', phoneNumberEncrypted: encrypt('+260977100004'), emailEncrypted: encrypt('a.sakala@yahoo.com'), addressEncrypted: encrypt('Stand 7, Nkana East, Kitwe'), nationalIdEncrypted: encrypt('456789/01/1'), emergencyContactEncrypted: encrypt('Peter Sakala — +260977200004 — Son'), maritalStatus: 'widowed', occupation: 'Retired Civil Servant', passwordHash: PASSWORD_HASH, isActive: true },
    { id: patId.p5, blockchainAddress: patBA.p5, firstNameEncrypted: encrypt('Kalunga'), lastNameEncrypted: encrypt('Mumba'), dateOfBirthEncrypted: encrypt('2005-08-18'), gender: 'male', bloodType: 'O-', phoneNumberEncrypted: encrypt('+260977100005'), addressEncrypted: encrypt('Maluba Township, Chingola'), nationalIdEncrypted: encrypt('567890/12/1'), emergencyContactEncrypted: encrypt('Ruth Mumba — +260977200005 — Mother'), maritalStatus: 'single', occupation: 'Student', passwordHash: PASSWORD_HASH, isActive: true },
]).onConflictDoNothing();

// ── 6. PATIENT-INSTITUTION REGISTRATIONS ──────────────────────────────────────

console.log('📋  Seeding patient registrations…');

await db.insert(patientInstitutionRegistrations).values([
    { id: uid(), patientId: patId.p1, institutionId: cbuhId, hospitalPatientNumber: 'CBUH-2024-00001', registeredAt: new Date('2024-01-10'), lastVisitAt: new Date('2025-02-15'), isActive: true, isHomeInstitution: true },
    { id: uid(), patientId: patId.p2, institutionId: cbuhId, hospitalPatientNumber: 'CBUH-2024-00002', registeredAt: new Date('2024-03-05'), lastVisitAt: new Date('2025-01-20'), isActive: true, isHomeInstitution: true },
    { id: uid(), patientId: patId.p3, institutionId: cbuhId, hospitalPatientNumber: 'CBUH-2024-00003', registeredAt: new Date('2024-06-12'), lastVisitAt: new Date('2025-02-01'), isActive: true, isHomeInstitution: true },
    { id: uid(), patientId: patId.p4, institutionId: cbuhId, hospitalPatientNumber: 'CBUH-2024-00004', registeredAt: new Date('2023-09-20'), lastVisitAt: new Date('2025-03-01'), isActive: true, isHomeInstitution: true },
    { id: uid(), patientId: patId.p5, institutionId: cbuhId, hospitalPatientNumber: 'CBUH-2025-00005', registeredAt: new Date('2025-03-01'), isActive: true, isHomeInstitution: true },
    // p1 also registered at Ndola — away institution
    { id: uid(), patientId: patId.p1, institutionId: ndolaId, hospitalPatientNumber: 'NCH-2023-00101', registeredAt: new Date('2023-05-20'), lastVisitAt: new Date('2023-12-10'), isActive: true, isHomeInstitution: false },
]).onConflictDoNothing();

// ── 7. VISITS ─────────────────────────────────────────────────────────────────
// Uses S['DOC-2024-001'] etc. — real DB IDs queried back above

console.log('🚶  Seeding visits…');

const vId = {
    v1c: uid(), v2c: uid(), v3c: uid(), v4c: uid(),  // completed
    v1a: uid(), v4a: uid(), v5a: uid(),               // active
};

await db.insert(visits).values([
    // ── Completed ──
    {
        id: vId.v1c,
        patientId: patId.p1, institutionId: cbuhId, departmentId: deptInternalMedId,
        visitNumber: 'VIS-2025-AA001', visitType: 'outpatient',
        admissionDate: daysAgo(60), dischargeDate: daysAgo(60),
        chiefComplaint: 'Headache, dizziness and elevated blood pressure readings at home',
        admittingDiagnosis: 'Hypertensive urgency', dischargeDiagnosis: 'Essential hypertension, stage 2',
        status: 'completed', priority: 'urgent',
        assignedNurseId: S['NUR-2024-001'],
        assignedDoctorId: S['DOC-2024-001'],
        dischargeSummary: 'BP improved from 178/110 to 142/88 mmHg. Antihypertensive therapy adjusted.',
        dischargeInstructions: 'Continue Amlodipine 10mg OD, Enalapril 10mg BD. Low-salt diet.',
        followUpDate: daysAgo(30),
        blockchainHash: recordHash({ v: 'v1c' }), dischargeBlockchainHash: recordHash({ d: 'v1c' }),
    },
    {
        id: vId.v2c,
        patientId: patId.p2, institutionId: cbuhId, departmentId: deptObstetricsId,
        visitNumber: 'VIS-2025-AA002', visitType: 'outpatient',
        admissionDate: daysAgo(45), dischargeDate: daysAgo(45),
        chiefComplaint: 'Routine antenatal check-up — 28 weeks gestation',
        dischargeDiagnosis: 'Normal pregnancy, 28 weeks',
        status: 'completed', priority: 'routine',
        assignedNurseId: S['NUR-2024-002'],
        assignedDoctorId: S['DOC-2024-004'],
        dischargeSummary: 'Fundal height 28cm. FHR 140 bpm. BP 110/72. Iron supplementation continued.',
        dischargeInstructions: 'Continue ferrous sulphate and folic acid. Return in 4 weeks.',
        blockchainHash: recordHash({ v: 'v2c' }), dischargeBlockchainHash: recordHash({ d: 'v2c' }),
    },
    {
        id: vId.v3c,
        patientId: patId.p3, institutionId: cbuhId, departmentId: deptPaediatricsId,
        visitNumber: 'VIS-2025-AA003', visitType: 'outpatient',
        admissionDate: daysAgo(30), dischargeDate: daysAgo(30),
        chiefComplaint: 'High grade fever 39.2°C, poor feeding and lethargy for 2 days',
        dischargeDiagnosis: 'Uncomplicated malaria (P. falciparum)',
        status: 'completed', priority: 'urgent',
        assignedNurseId: S['NUR-2024-002'],
        assignedDoctorId: S['DOC-2024-002'],
        dischargeSummary: 'Malaria RDT positive. AL commenced. Temperature settled to 37.4°C.',
        dischargeInstructions: 'Complete AL 3-day course. Return if fever persists beyond 48 hours.',
        blockchainHash: recordHash({ v: 'v3c' }), dischargeBlockchainHash: recordHash({ d: 'v3c' }),
    },
    {
        id: vId.v4c,
        patientId: patId.p4, institutionId: cbuhId, departmentId: deptInternalMedId,
        visitNumber: 'VIS-2025-AA004', visitType: 'outpatient',
        admissionDate: daysAgo(14), dischargeDate: daysAgo(14),
        chiefComplaint: 'Routine diabetes review — 3-monthly HbA1c check',
        dischargeDiagnosis: 'Type 2 Diabetes Mellitus — poorly controlled (HbA1c 9.2%)',
        status: 'completed', priority: 'routine',
        assignedNurseId: S['NUR-2024-001'],
        assignedDoctorId: S['DOC-2024-001'],
        dischargeSummary: 'HbA1c 9.2%. Metformin dose increased. Ophthalmology referral made.',
        dischargeInstructions: 'Metformin 1g BD, Glibenclamide 5mg OD. Eye review in 6 weeks.',
        blockchainHash: recordHash({ v: 'v4c' }), dischargeBlockchainHash: recordHash({ d: 'v4c' }),
    },
    // ── Active (in-progress) ──
    {
        id: vId.v1a,
        patientId: patId.p1, institutionId: cbuhId, departmentId: deptInternalMedId,
        wardId: wardMaleId,
        visitNumber: 'VIS-2026-BB001', visitType: 'inpatient',
        admissionDate: hoursAgo(6),   // admitted 6 hours ago — passes today filter
        chiefComplaint: 'Central chest pain radiating to left arm, diaphoresis, shortness of breath',
        admittingDiagnosis: 'Acute coronary syndrome — rule out NSTEMI',
        wardOrRoom: 'Male General Ward, Bed 5',
        status: 'in-progress', priority: 'emergency',
        assignedNurseId: S['NUR-2024-001'],  // ← real DB ID
        assignedDoctorId: S['DOC-2024-001'],  // ← real DB ID
        blockchainHash: recordHash({ v: 'v1a' }),
    },
    {
        id: vId.v4a,
        patientId: patId.p4, institutionId: cbuhId, departmentId: deptInternalMedId,
        wardId: wardFemaleId,
        visitNumber: 'VIS-2026-BB002', visitType: 'inpatient',
        admissionDate: hoursAgo(4),   // admitted 4 hours ago
        chiefComplaint: 'Increased thirst, frequent urination, blurred vision, BGL 24.6 mmol/L',
        admittingDiagnosis: 'Hyperglycaemic crisis — DKA vs HHS',
        wardOrRoom: 'Female General Ward, Bed 12',
        status: 'in-progress', priority: 'urgent',
        assignedNurseId: S['NUR-2024-001'],  // ← real DB ID
        assignedDoctorId: S['DOC-2024-001'],  // ← real DB ID
        blockchainHash: recordHash({ v: 'v4a' }),
    },
    {
        id: vId.v5a,
        patientId: patId.p5, institutionId: cbuhId, departmentId: deptEmergencyId,
        wardId: wardIcuId,
        visitNumber: 'VIS-2026-BB003', visitType: 'emergency',
        admissionDate: hoursAgo(3),   // admitted 3 hours ago
        chiefComplaint: 'Road traffic accident — pedestrian struck by vehicle, loss of consciousness',
        admittingDiagnosis: 'Poly-trauma: suspected closed head injury, multiple lacerations',
        wardOrRoom: 'ICU, Bed 2',
        status: 'in-progress', priority: 'critical',
        assignedNurseId: S['NUR-2024-003'],  // ← real DB ID
        assignedDoctorId: S['DOC-2024-003'],  // ← real DB ID
        blockchainHash: recordHash({ v: 'v5a' }),
    },
]).onConflictDoNothing();

// ── 8. VITAL SIGNS ────────────────────────────────────────────────────────────

console.log('💓  Seeding vital signs…');

const vitId = {
    v1c: uid(), v2c: uid(), v3c: uid(), v4c: uid(),
    v1a: uid(), v4a: uid(), v5a: uid(),
};

await db.insert(vitalSigns).values([
    { id: vitId.v1c, visitId: vId.v1c, patientId: patId.p1, recordedByNurseId: S['NUR-2024-001'], temperature: '37.1', bloodPressureSystolic: 178, bloodPressureDiastolic: 110, pulseRate: 92, respiratoryRate: 18, oxygenSaturation: 98, weight: '78.5', height: '172.0', painLevel: 5, nurseNotes: 'Patient anxious. Headache 7/10. No facial asymmetry.', blockchainHash: recordHash({ vs: vitId.v1c }), recordedAt: daysAgo(60) },
    { id: vitId.v2c, visitId: vId.v2c, patientId: patId.p2, recordedByNurseId: S['NUR-2024-002'], temperature: '36.8', bloodPressureSystolic: 110, bloodPressureDiastolic: 72, pulseRate: 84, respiratoryRate: 16, oxygenSaturation: 99, weight: '68.0', height: '160.0', painLevel: 0, nurseNotes: 'Patient comfortable. Foetal movement felt. FHR 140 bpm on doppler.', blockchainHash: recordHash({ vs: vitId.v2c }), recordedAt: daysAgo(45) },
    { id: vitId.v3c, visitId: vId.v3c, patientId: patId.p3, recordedByNurseId: S['NUR-2024-002'], temperature: '39.2', bloodPressureSystolic: 100, bloodPressureDiastolic: 62, pulseRate: 118, respiratoryRate: 24, oxygenSaturation: 97, weight: '22.5', height: '125.0', painLevel: 4, nurseNotes: 'Child febrile and irritable. Mother reports 2 days of fever.', blockchainHash: recordHash({ vs: vitId.v3c }), recordedAt: daysAgo(30) },
    { id: vitId.v4c, visitId: vId.v4c, patientId: patId.p4, recordedByNurseId: S['NUR-2024-001'], temperature: '36.9', bloodPressureSystolic: 136, bloodPressureDiastolic: 84, pulseRate: 78, respiratoryRate: 16, oxygenSaturation: 98, weight: '88.0', height: '158.0', painLevel: 2, nurseNotes: 'BMI 35.2. Blood glucose 14.3 mmol/L on glucometer.', blockchainHash: recordHash({ vs: vitId.v4c }), recordedAt: daysAgo(14) },
    // Active visits — vitals recorded so they pass the triaged check
    { id: vitId.v1a, visitId: vId.v1a, patientId: patId.p1, recordedByNurseId: S['NUR-2024-001'], temperature: '36.8', bloodPressureSystolic: 156, bloodPressureDiastolic: 98, pulseRate: 108, respiratoryRate: 22, oxygenSaturation: 94, weight: '79.0', height: '172.0', painLevel: 8, nurseNotes: 'Diaphoretic, pale. IV access established. O2 4L/min via nasal prongs.', blockchainHash: recordHash({ vs: vitId.v1a }), recordedAt: hoursAgo(5) },
    { id: vitId.v4a, visitId: vId.v4a, patientId: patId.p4, recordedByNurseId: S['NUR-2024-001'], temperature: '37.4', bloodPressureSystolic: 148, bloodPressureDiastolic: 90, pulseRate: 96, respiratoryRate: 20, oxygenSaturation: 97, weight: '87.5', height: '158.0', painLevel: 3, nurseNotes: 'BGL 24.6 mmol/L. Kussmaul breathing noted. IV access established.', blockchainHash: recordHash({ vs: vitId.v4a }), recordedAt: hoursAgo(3) },
    { id: vitId.v5a, visitId: vId.v5a, patientId: patId.p5, recordedByNurseId: S['NUR-2024-003'], temperature: '35.8', bloodPressureSystolic: 88, bloodPressureDiastolic: 54, pulseRate: 132, respiratoryRate: 28, oxygenSaturation: 88, weight: '65.0', height: '175.0', painLevel: 9, nurseNotes: 'GCS 10/15. Trauma collar in situ. Two large-bore IVs. Massive haematoma right temporal region.', blockchainHash: recordHash({ vs: vitId.v5a }), recordedAt: hoursAgo(2) },
]).onConflictDoNothing();

// ── 9. CONSULTATIONS ──────────────────────────────────────────────────────────

console.log('🩺  Seeding consultations…');

const cId = {
    v1c: uid(), v2c: uid(), v3c: uid(), v4c: uid(),
    v1a: uid(), v4a: uid(),
};

await db.insert(consultations).values([
    {
        id: cId.v1c, visitId: vId.v1c, patientId: patId.p1, practitionerId: S['DOC-2024-001'],
        chiefComplaint: 'Hypertensive urgency with headache and dizziness',
        historyOfPresentIllness: 'Mr Musonda, 35-year-old male with known hypertension on Amlodipine 5mg. 2-day history of severe frontal headache and dizziness. BP at home 175–185/105–112 mmHg.',
        physicalExamination: 'Alert and oriented. BP 178/110 mmHg, HR 92 bpm. No papilloedema. Heart sounds normal.',
        assessment: 'Hypertensive urgency — likely medication non-compliance.',
        plan: 'Uptitrate Amlodipine to 10mg OD. Add Enalapril 10mg BD. Dietary sodium restriction.',
        blockchainHash: recordHash({ c: cId.v1c }),
    },
    {
        id: cId.v2c, visitId: vId.v2c, patientId: patId.p2, practitionerId: S['DOC-2024-004'],
        chiefComplaint: 'Routine antenatal visit — 28 weeks',
        historyOfPresentIllness: 'Mrs Nkuwa, G1P0 at 28 weeks by LMP. No complications. Good foetal movements. Minor ankle swelling.',
        physicalExamination: 'BP 110/72. Fundal height 28cm. FHR 140 bpm. Cephalic presentation. Mild ankle oedema.',
        assessment: 'Normal intrauterine pregnancy at 28 weeks.',
        plan: 'Continue ferrous sulphate 200mg BD and folic acid 5mg OD. Next visit at 32 weeks.',
        blockchainHash: recordHash({ c: cId.v2c }),
    },
    {
        id: cId.v3c, visitId: vId.v3c, patientId: patId.p3, practitionerId: S['DOC-2024-002'],
        chiefComplaint: 'Fever and lethargy in 8-year-old child',
        historyOfPresentIllness: 'Liam Lungu, 8 years. 2-day high-grade fever, poor appetite, lethargy. No vomiting, no neck stiffness.',
        physicalExamination: 'Temp 39.2°C. HR 118. Sats 97%. Alert but irritable. Mild conjunctival pallor.',
        assessment: 'Uncomplicated malaria — P. falciparum on RDT. Mild anaemia.',
        plan: 'Artemether-Lumefantrine per weight. Paracetamol for fever. Return if no improvement in 48h.',
        blockchainHash: recordHash({ c: cId.v3c }),
    },
    {
        id: cId.v4c, visitId: vId.v4c, patientId: patId.p4, practitionerId: S['DOC-2024-001'],
        chiefComplaint: 'Quarterly diabetes review',
        historyOfPresentIllness: 'Mrs Sakala, 52-year-old T2DM x10 years. Metformin 500mg BD. HbA1c 9.2%. Poor dietary compliance.',
        physicalExamination: 'BP 136/84. BMI 35.2. Reduced monofilament sensation bilateral feet.',
        assessment: 'Poorly controlled T2DM. Peripheral neuropathy likely.',
        plan: 'Increase Metformin to 1g BD. Add Glibenclamide 5mg OD. Ophthalmology referral.',
        blockchainHash: recordHash({ c: cId.v4c }),
    },
    {
        id: cId.v1a, visitId: vId.v1a, patientId: patId.p1, practitionerId: S['DOC-2024-001'],
        chiefComplaint: 'Acute chest pain, diaphoresis, shortness of breath',
        historyOfPresentIllness: 'Mr Musonda presents with 6-hour history of central chest pain radiating to left arm and jaw. Diaphoresis and SOB. Background hypertension and smoking (10 pack-years).',
        physicalExamination: 'Distressed, diaphoretic. BP 156/98. HR 108 irregular. SpO2 94%. Bilateral basal crepitations. JVP elevated.',
        clinicalFindings: 'ECG: ST depression V4-V6. Troponin-I pending. CXR: mild pulmonary venous congestion.',
        assessment: 'NSTEMI most likely. Admit for monitoring, serial troponins and cardiology review.',
        plan: 'Aspirin 300mg + Clopidogrel 300mg stat. Enoxaparin 1mg/kg SC. GTN infusion. IV furosemide 40mg.',
        blockchainHash: recordHash({ c: cId.v1a }),
    },
    {
        id: cId.v4a, visitId: vId.v4a, patientId: patId.p4, practitionerId: S['DOC-2024-001'],
        chiefComplaint: 'Hyperglycaemia with Kussmaul breathing',
        historyOfPresentIllness: 'Mrs Sakala — 2 days polyuria, polydipsia, blurred vision. BGL 24.6 at home. Vomited x2. Background T2DM.',
        physicalExamination: 'Dry mucous membranes. BP 148/90. HR 96. Deep Kussmaul respirations. Fruity breath.',
        assessment: 'Diabetic ketoacidosis (DKA) in known T2DM.',
        plan: 'IV 0.9% NaCl 1L over 1h. IV insulin infusion 0.1u/kg/hr. 2-hourly BGL. U&E, ABG.',
        blockchainHash: recordHash({ c: cId.v4a }),
    },
]).onConflictDoNothing();

// ── 10. DIAGNOSES ─────────────────────────────────────────────────────────────

console.log('📝  Seeding diagnoses…');

await db.insert(diagnoses).values([
    { id: uid(), consultationId: cId.v1c, visitId: vId.v1c, patientId: patId.p1, practitionerId: S['DOC-2024-001'], icdCode: 'I10', diagnosisName: 'Essential (primary) hypertension', diagnosisType: 'confirmed', severity: 'moderate', blockchainHash: recordHash({ dx: 'v1c_htn' }) },
    { id: uid(), consultationId: cId.v2c, visitId: vId.v2c, patientId: patId.p2, practitionerId: S['DOC-2024-004'], icdCode: 'Z34.1', diagnosisName: 'Supervision of normal first pregnancy, second trimester', diagnosisType: 'confirmed', blockchainHash: recordHash({ dx: 'v2c_preg' }) },
    { id: uid(), consultationId: cId.v3c, visitId: vId.v3c, patientId: patId.p3, practitionerId: S['DOC-2024-002'], icdCode: 'B54', diagnosisName: 'Unspecified malaria (P. falciparum RDT positive)', diagnosisType: 'confirmed', severity: 'mild', blockchainHash: recordHash({ dx: 'v3c_mal' }) },
    { id: uid(), consultationId: cId.v4c, visitId: vId.v4c, patientId: patId.p4, practitionerId: S['DOC-2024-001'], icdCode: 'E11.9', diagnosisName: 'Type 2 diabetes mellitus — poorly controlled', diagnosisType: 'confirmed', severity: 'moderate', blockchainHash: recordHash({ dx: 'v4c_dm' }) },
    { id: uid(), consultationId: cId.v4c, visitId: vId.v4c, patientId: patId.p4, practitionerId: S['DOC-2024-001'], icdCode: 'E11.40', diagnosisName: 'Type 2 diabetes mellitus with diabetic neuropathy', diagnosisType: 'provisional', severity: 'mild', blockchainHash: recordHash({ dx: 'v4c_neuro' }) },
    { id: uid(), consultationId: cId.v1a, visitId: vId.v1a, patientId: patId.p1, practitionerId: S['DOC-2024-001'], icdCode: 'I21.4', diagnosisName: 'Non-ST elevation myocardial infarction (NSTEMI)', diagnosisType: 'provisional', severity: 'severe', blockchainHash: recordHash({ dx: 'v1a_nstemi' }) },
    { id: uid(), consultationId: cId.v4a, visitId: vId.v4a, patientId: patId.p4, practitionerId: S['DOC-2024-001'], icdCode: 'E11.10', diagnosisName: 'Type 2 diabetes mellitus with diabetic ketoacidosis', diagnosisType: 'confirmed', severity: 'severe', blockchainHash: recordHash({ dx: 'v4a_dka' }) },
]).onConflictDoNothing();

// ── 11. LAB ORDERS & RESULTS ──────────────────────────────────────────────────

console.log('🔬  Seeding lab orders and results…');

const lId = {
    fbc_v1a: uid(), troponin: uid(), lipids: uid(),
    urine_v4a: uid(), abg_v4a: uid(), ue_v4a: uid(),
    fbc_v3c: uid(), hba1c_v4c: uid(),
};

await db.insert(labTestOrders).values([
    { id: lId.fbc_v1a, orderNumber: 'LAB-2026-00101', visitId: vId.v1a, patientId: patId.p1, orderedByPractitionerId: S['DOC-2024-001'], testName: 'Full Blood Count (FBC)', testCode: 'FBC', specimenType: 'blood', urgency: 'emergency', status: 'resulted', assignedTo: S['LAB-2024-001'], clinicalNotes: 'NSTEMI workup', blockchainHash: recordHash({ lab: lId.fbc_v1a }), orderedAt: hoursAgo(5) },
    { id: lId.troponin, orderNumber: 'LAB-2026-00102', visitId: vId.v1a, patientId: patId.p1, orderedByPractitionerId: S['DOC-2024-001'], testName: 'Troponin-I (High Sensitivity)', testCode: 'HSTN', specimenType: 'blood', urgency: 'emergency', status: 'resulted', assignedTo: S['LAB-2024-001'], clinicalNotes: 'Chest pain — r/o NSTEMI', blockchainHash: recordHash({ lab: lId.troponin }), orderedAt: hoursAgo(5) },
    { id: lId.lipids, orderNumber: 'LAB-2026-00103', visitId: vId.v1a, patientId: patId.p1, orderedByPractitionerId: S['DOC-2024-001'], testName: 'Fasting Lipid Profile', testCode: 'LIPID', specimenType: 'blood', urgency: 'urgent', status: 'in_progress', assignedTo: S['LAB-2024-001'], clinicalNotes: 'Cardiovascular risk assessment', blockchainHash: recordHash({ lab: lId.lipids }), orderedAt: hoursAgo(4) },
    { id: lId.urine_v4a, orderNumber: 'LAB-2026-00201', visitId: vId.v4a, patientId: patId.p4, orderedByPractitionerId: S['DOC-2024-001'], testName: 'Urinalysis with Microscopy', testCode: 'URINE', specimenType: 'urine', urgency: 'urgent', status: 'resulted', assignedTo: S['LAB-2024-002'], clinicalNotes: 'DKA workup — ketones', blockchainHash: recordHash({ lab: lId.urine_v4a }), orderedAt: hoursAgo(3) },
    { id: lId.abg_v4a, orderNumber: 'LAB-2026-00202', visitId: vId.v4a, patientId: patId.p4, orderedByPractitionerId: S['DOC-2024-001'], testName: 'Arterial Blood Gas (ABG)', testCode: 'ABG', specimenType: 'blood', urgency: 'emergency', status: 'resulted', assignedTo: S['LAB-2024-002'], clinicalNotes: 'Assess metabolic acidosis', blockchainHash: recordHash({ lab: lId.abg_v4a }), orderedAt: hoursAgo(3) },
    { id: lId.ue_v4a, orderNumber: 'LAB-2026-00203', visitId: vId.v4a, patientId: patId.p4, orderedByPractitionerId: S['DOC-2024-001'], testName: 'Urea & Electrolytes (U&E)', testCode: 'UE', specimenType: 'blood', urgency: 'urgent', status: 'resulted', assignedTo: S['LAB-2024-002'], clinicalNotes: 'Renal function and electrolytes in DKA', blockchainHash: recordHash({ lab: lId.ue_v4a }), orderedAt: hoursAgo(3) },
    { id: lId.fbc_v3c, orderNumber: 'LAB-2025-00301', visitId: vId.v3c, patientId: patId.p3, orderedByPractitionerId: S['DOC-2024-002'], testName: 'Full Blood Count (FBC)', testCode: 'FBC', specimenType: 'blood', urgency: 'urgent', status: 'resulted', assignedTo: S['LAB-2024-001'], clinicalNotes: 'Febrile child — assess anaemia', blockchainHash: recordHash({ lab: lId.fbc_v3c }), orderedAt: daysAgo(30) },
    { id: lId.hba1c_v4c, orderNumber: 'LAB-2025-00401', visitId: vId.v4c, patientId: patId.p4, orderedByPractitionerId: S['DOC-2024-001'], testName: 'Glycated Haemoglobin (HbA1c)', testCode: 'HBA1C', specimenType: 'blood', urgency: 'routine', status: 'resulted', assignedTo: S['LAB-2024-001'], clinicalNotes: 'Quarterly diabetic monitoring', blockchainHash: recordHash({ lab: lId.hba1c_v4c }), orderedAt: daysAgo(14) },
]).onConflictDoNothing();

await db.insert(labTestResults).values([
    { id: uid(), labTestOrderId: lId.fbc_v1a, performedByLabTechId: S['LAB-2024-001'], resultsData: { WBC: '11.2 x10⁹/L', Hb: '13.9 g/dL', PLT: '224 x10⁹/L', neutrophils: '78%' }, interpretation: 'Leucocytosis with neutrophilia — physiological stress in ACS.', abnormalFindings: 'WBC mildly elevated', referenceRanges: { WBC: '4.5–11.0', Hb: '13–17 g/dL', PLT: '150–400' }, blockchainHash: recordHash({ r: lId.fbc_v1a }), resultedAt: hoursAgo(4) },
    { id: uid(), labTestOrderId: lId.troponin, performedByLabTechId: S['LAB-2024-001'], resultsData: { TroponinI: '1.24 ng/mL', method: 'Abbott Architect hs-TnI' }, interpretation: 'Troponin-I significantly elevated. Serial measurement in 3h.', abnormalFindings: 'Troponin-I > 0.04 ng/mL — myocardial injury', referenceRanges: { TroponinI: '< 0.04 ng/mL' }, blockchainHash: recordHash({ r: lId.troponin }), resultedAt: hoursAgo(4) },
    { id: uid(), labTestOrderId: lId.urine_v4a, performedByLabTechId: S['LAB-2024-002'], resultsData: { glucose: '++++ (4+)', ketones: '+++ (3+)', protein: '+ (1+)', pH: '5.0' }, interpretation: 'Heavy glycosuria and ketonuria — consistent with DKA.', abnormalFindings: 'Glucose 4+, Ketones 3+, mild proteinuria', blockchainHash: recordHash({ r: lId.urine_v4a }), resultedAt: hoursAgo(2) },
    { id: uid(), labTestOrderId: lId.abg_v4a, performedByLabTechId: S['LAB-2024-002'], resultsData: { pH: '7.22', PaCO2: '22 mmHg', HCO3: '10 mmol/L', BE: '-14', lactate: '2.1 mmol/L' }, interpretation: 'Severe high anion-gap metabolic acidosis — consistent with DKA.', abnormalFindings: 'pH < 7.3, HCO3 < 15, significant base deficit', referenceRanges: { pH: '7.35–7.45', HCO3: '22–26 mmol/L' }, blockchainHash: recordHash({ r: lId.abg_v4a }), resultedAt: hoursAgo(2) },
    { id: uid(), labTestOrderId: lId.ue_v4a, performedByLabTechId: S['LAB-2024-002'], resultsData: { sodium: '131 mmol/L', potassium: '5.9 mmol/L', creatinine: '148 µmol/L', glucose: '24.6 mmol/L' }, interpretation: 'Hyponatraemia, hyperkalaemia, elevated creatinine — AKI in DKA.', abnormalFindings: 'Na low, K elevated, creatinine elevated', blockchainHash: recordHash({ r: lId.ue_v4a }), resultedAt: hoursAgo(2) },
    { id: uid(), labTestOrderId: lId.fbc_v3c, performedByLabTechId: S['LAB-2024-001'], resultsData: { WBC: '6.8 x10⁹/L', Hb: '8.4 g/dL', PLT: '82 x10⁹/L', MCV: '74 fL' }, interpretation: 'Mild anaemia with thrombocytopaenia — typical of falciparum malaria.', abnormalFindings: 'Hb low (8.4), thrombocytopaenia (82)', referenceRanges: { Hb: '11–14 g/dL (child)', PLT: '150–400' }, blockchainHash: recordHash({ r: lId.fbc_v3c }), resultedAt: daysAgo(30) },
    { id: uid(), labTestOrderId: lId.hba1c_v4c, performedByLabTechId: S['LAB-2024-001'], resultsData: { HbA1c_percent: '9.2', estimated_avg_glucose: '12.6 mmol/L' }, interpretation: 'HbA1c 9.2% — above target of < 7%. Poor glycaemic control.', abnormalFindings: 'HbA1c significantly above therapeutic target', referenceRanges: { HbA1c: '< 7.0% (diabetic target)' }, blockchainHash: recordHash({ r: lId.hba1c_v4c }), resultedAt: daysAgo(14) },
]).onConflictDoNothing();

// ── 12. IMAGING ORDERS & REPORTS ──────────────────────────────────────────────

console.log('🩻  Seeding imaging orders and reports…');

const imgId = { cxr: uid(), ct: uid(), echo: uid() };

await db.insert(imagingOrders).values([
    { id: imgId.cxr, orderNumber: 'IMG-2026-00101', visitId: vId.v1a, patientId: patId.p1, orderedByPractitionerId: S['DOC-2024-001'], modality: 'x-ray', bodyPart: 'Chest (PA)', indication: 'NSTEMI — assess for pulmonary oedema', urgency: 'emergency', status: 'reported', assignedTo: S['RAD-2024-001'], orderedAt: hoursAgo(5), blockchainHash: recordHash({ img: imgId.cxr }) },
    { id: imgId.ct, orderNumber: 'IMG-2026-00201', visitId: vId.v5a, patientId: patId.p5, orderedByPractitionerId: S['DOC-2024-003'], modality: 'ct_scan', bodyPart: 'Head (non-contrast)', indication: 'Poly-trauma — rule out intracranial haemorrhage', urgency: 'critical', status: 'reported', assignedTo: S['RAD-2024-001'], orderedAt: hoursAgo(2), blockchainHash: recordHash({ img: imgId.ct }) },
    { id: imgId.echo, orderNumber: 'IMG-2026-00102', visitId: vId.v1a, patientId: patId.p1, orderedByPractitionerId: S['DOC-2024-001'], modality: 'ultrasound', bodyPart: 'Heart (Echocardiogram)', indication: 'Assess LV function and wall motion in NSTEMI', urgency: 'urgent', status: 'ordered', assignedTo: S['RAD-2024-001'], orderedAt: hoursAgo(3), blockchainHash: recordHash({ img: imgId.echo }) },
]).onConflictDoNothing();

await db.insert(imagingReports).values([
    {
        id: uid(), imagingOrderId: imgId.cxr, performedByRadiologistId: S['RAD-2024-001'],
        findings: 'Cardiomegaly (CTR 0.56). Bilateral perihilar haziness consistent with early pulmonary oedema. No pleural effusion.',
        impression: 'Cardiomegaly with early pulmonary oedema — cardiac failure secondary to ACS.',
        recommendations: 'Urgent cardiology review. Echocardiogram recommended. Repeat CXR after diuresis.',
        imageUrls: [], blockchainHash: recordHash({ rpt: imgId.cxr }),
    },
    {
        id: uid(), imagingOrderId: imgId.ct, performedByRadiologistId: S['RAD-2024-001'],
        findings: 'Hyperdense collection right temporal region 4.2 x 3.1 cm — acute epidural haematoma. Midline shift 5mm left. Right temporal skull fracture.',
        impression: 'Acute right temporal epidural haematoma with 5mm midline shift and skull fracture.',
        recommendations: 'URGENT neurosurgical review. Emergency evacuation required. Transfer immediately.',
        imageUrls: [], blockchainHash: recordHash({ rpt: imgId.ct }),
    },
]).onConflictDoNothing();

// ── 13. PRESCRIPTIONS ─────────────────────────────────────────────────────────

console.log('💊  Seeding prescriptions…');

const rxId = { v1c: uid(), v2c: uid(), v3c: uid(), v4c: uid(), v1a: uid() };

await db.insert(prescriptions).values([
    { id: rxId.v1c, prescriptionNumber: 'RX-2025-00101', visitId: vId.v1c, patientId: patId.p1, prescribedByPractitionerId: S['DOC-2024-001'], status: 'dispensed', blockchainHash: recordHash({ rx: rxId.v1c }), prescribedAt: daysAgo(60) },
    { id: rxId.v2c, prescriptionNumber: 'RX-2025-00201', visitId: vId.v2c, patientId: patId.p2, prescribedByPractitionerId: S['DOC-2024-004'], status: 'dispensed', blockchainHash: recordHash({ rx: rxId.v2c }), prescribedAt: daysAgo(45) },
    { id: rxId.v3c, prescriptionNumber: 'RX-2025-00301', visitId: vId.v3c, patientId: patId.p3, prescribedByPractitionerId: S['DOC-2024-002'], status: 'dispensed', blockchainHash: recordHash({ rx: rxId.v3c }), prescribedAt: daysAgo(30) },
    { id: rxId.v4c, prescriptionNumber: 'RX-2025-00401', visitId: vId.v4c, patientId: patId.p4, prescribedByPractitionerId: S['DOC-2024-001'], status: 'dispensed', blockchainHash: recordHash({ rx: rxId.v4c }), prescribedAt: daysAgo(14) },
    { id: rxId.v1a, prescriptionNumber: 'RX-2026-00101', visitId: vId.v1a, patientId: patId.p1, prescribedByPractitionerId: S['DOC-2024-001'], status: 'prescribed', blockchainHash: recordHash({ rx: rxId.v1a }), prescribedAt: hoursAgo(4) },
]).onConflictDoNothing();

await db.insert(prescriptionItems).values([
    // v1c — hypertension
    { id: uid(), prescriptionId: rxId.v1c, medicationName: 'Amlodipine', genericName: 'Amlodipine besylate', strength: '10mg', dosageForm: 'tablet', dose: '10mg', frequency: 'once_daily', route: 'oral', duration: '90 days', quantity: 90, instructions: 'Take in the morning.', refillsAllowed: 2, isDispensed: true, dispensedByPharmacistId: S['PHAR-2024-001'], dispensedAt: daysAgo(60) },
    { id: uid(), prescriptionId: rxId.v1c, medicationName: 'Enalapril', genericName: 'Enalapril maleate', strength: '10mg', dosageForm: 'tablet', dose: '10mg', frequency: 'twice_daily', route: 'oral', duration: '90 days', quantity: 180, instructions: 'Avoid potassium supplements.', refillsAllowed: 2, isDispensed: true, dispensedByPharmacistId: S['PHAR-2024-001'], dispensedAt: daysAgo(60) },
    // v2c — antenatal
    { id: uid(), prescriptionId: rxId.v2c, medicationName: 'Ferrous Sulphate', genericName: 'Ferrous sulphate', strength: '200mg', dosageForm: 'tablet', dose: '200mg', frequency: 'twice_daily', route: 'oral', duration: '90 days', quantity: 180, instructions: 'Take with orange juice.', refillsAllowed: 1, isDispensed: true, dispensedByPharmacistId: S['PHAR-2024-002'], dispensedAt: daysAgo(45) },
    { id: uid(), prescriptionId: rxId.v2c, medicationName: 'Folic Acid', genericName: 'Folic acid', strength: '5mg', dosageForm: 'tablet', dose: '5mg', frequency: 'once_daily', route: 'oral', duration: '90 days', quantity: 90, instructions: 'Take daily.', refillsAllowed: 1, isDispensed: true, dispensedByPharmacistId: S['PHAR-2024-002'], dispensedAt: daysAgo(45) },
    // v3c — malaria
    { id: uid(), prescriptionId: rxId.v3c, medicationName: 'Artemether-Lumefantrine', genericName: 'Artemether/Lumefantrine', strength: '20/120mg', dosageForm: 'tablet', dose: '3 tablets', frequency: 'twice_daily', route: 'oral', duration: '3 days', quantity: 18, instructions: 'Take with food. Complete course.', refillsAllowed: 0, isDispensed: true, dispensedByPharmacistId: S['PHAR-2024-001'], dispensedAt: daysAgo(30) },
    { id: uid(), prescriptionId: rxId.v3c, medicationName: 'Paracetamol', genericName: 'Paracetamol', strength: '250mg', dosageForm: 'syrup', dose: '250mg (10mL)', frequency: 'four_times_daily', route: 'oral', duration: '3 days', quantity: 1, instructions: 'For fever > 38°C.', refillsAllowed: 0, isDispensed: true, dispensedByPharmacistId: S['PHAR-2024-001'], dispensedAt: daysAgo(30) },
    // v4c — diabetes
    { id: uid(), prescriptionId: rxId.v4c, medicationName: 'Metformin', genericName: 'Metformin hydrochloride', strength: '1000mg', dosageForm: 'tablet', dose: '1g', frequency: 'twice_daily', route: 'oral', duration: '90 days', quantity: 180, instructions: 'Take with meals.', refillsAllowed: 2, isDispensed: true, dispensedByPharmacistId: S['PHAR-2024-002'], dispensedAt: daysAgo(14) },
    { id: uid(), prescriptionId: rxId.v4c, medicationName: 'Glibenclamide', genericName: 'Glibenclamide', strength: '5mg', dosageForm: 'tablet', dose: '5mg', frequency: 'once_daily', route: 'oral', duration: '90 days', quantity: 90, instructions: '30 min before breakfast.', refillsAllowed: 2, isDispensed: true, dispensedByPharmacistId: S['PHAR-2024-002'], dispensedAt: daysAgo(14) },
    // v1a — NSTEMI (not yet dispensed)
    { id: uid(), prescriptionId: rxId.v1a, medicationName: 'Aspirin', genericName: 'Acetylsalicylic acid', strength: '300mg', dosageForm: 'tablet', dose: '300mg', frequency: 'stat', route: 'oral', duration: 'stat then 100mg OD', quantity: 1, instructions: 'Loading dose stat.', refillsAllowed: 0, isDispensed: false },
    { id: uid(), prescriptionId: rxId.v1a, medicationName: 'Clopidogrel', genericName: 'Clopidogrel bisulphate', strength: '75mg', dosageForm: 'tablet', dose: '300mg (loading)', frequency: 'stat', route: 'oral', duration: 'stat then 75mg OD', quantity: 4, instructions: '4 tabs stat, then 1 OD.', refillsAllowed: 0, isDispensed: false },
    { id: uid(), prescriptionId: rxId.v1a, medicationName: 'Enoxaparin', genericName: 'Enoxaparin sodium', strength: '60mg/0.6mL', dosageForm: 'injection', dose: '1mg/kg', frequency: 'twice_daily', route: 'subcutaneous', duration: '5 days', quantity: 10, instructions: 'Weight-based dosing.', refillsAllowed: 0, isDispensed: false },
]).onConflictDoNothing();

// ── 14. ALLERGIES ─────────────────────────────────────────────────────────────

console.log('⚠️  Seeding allergies…');

await db.insert(allergies).values([
    { id: uid(), patientId: patId.p1, allergen: 'Penicillin', allergyType: 'drug', severity: 'moderate', reaction: 'Generalised urticaria and facial angioedema', onsetDate: '2015-03-12', notes: 'Avoid all beta-lactam antibiotics', recordedByPractitionerId: S['DOC-2024-001'], isActive: true, blockchainHash: recordHash({ a: 'p1_pen' }) },
    { id: uid(), patientId: patId.p2, allergen: 'Sulphonamides (Septrin)', allergyType: 'drug', severity: 'severe', reaction: 'Stevens-Johnson syndrome', onsetDate: '2019-08-05', notes: 'Absolute contraindication.', recordedByPractitionerId: S['DOC-2024-004'], isActive: true, blockchainHash: recordHash({ a: 'p2_sulf' }) },
    { id: uid(), patientId: patId.p3, allergen: 'Groundnuts (Peanuts)', allergyType: 'food', severity: 'severe', reaction: 'Anaphylaxis — received adrenaline 2022', onsetDate: '2022-06-20', notes: 'Carries EpiPen.', isActive: true, blockchainHash: recordHash({ a: 'p3_nut' }) },
    { id: uid(), patientId: patId.p4, allergen: 'ACE Inhibitors (Enalapril)', allergyType: 'drug', severity: 'moderate', reaction: 'Persistent dry cough requiring discontinuation', onsetDate: '2020-11-02', notes: 'Substitute with ARB if needed.', recordedByPractitionerId: S['DOC-2024-001'], isActive: true, blockchainHash: recordHash({ a: 'p4_ace' }) },
]).onConflictDoNothing();

// ── 15. MEDICAL HISTORY ───────────────────────────────────────────────────────

console.log('📚  Seeding medical history…');

await db.insert(medicalHistory).values([
    { id: uid(), patientId: patId.p1, condition: 'Essential Hypertension', diagnosedDate: '2019-06-15', status: 'active', notes: 'Amlodipine 10mg + Enalapril 10mg BD', recordedByPractitionerId: S['DOC-2024-001'], blockchainHash: recordHash({ mh: 'p1_htn' }) },
    { id: uid(), patientId: patId.p1, condition: 'Hyperlipidaemia', diagnosedDate: '2021-02-20', status: 'active', notes: 'Diet-controlled. Lipid profile repeat due.', recordedByPractitionerId: S['DOC-2024-001'], blockchainHash: recordHash({ mh: 'p1_lipid' }) },
    { id: uid(), patientId: patId.p2, condition: 'G1P0 — First Pregnancy', diagnosedDate: '2024-09-01', status: 'active', notes: 'LMP 01/09/2024. EDD 08/06/2025. 28 weeks.', recordedByPractitionerId: S['DOC-2024-004'], blockchainHash: recordHash({ mh: 'p2_preg' }) },
    { id: uid(), patientId: patId.p3, condition: 'Peanut Allergy (Anaphylaxis)', diagnosedDate: '2022-06-20', status: 'active', notes: 'Anaphylaxis 2022. Now carries EpiPen.', blockchainHash: recordHash({ mh: 'p3_allergy' }) },
    { id: uid(), patientId: patId.p4, condition: 'Type 2 Diabetes Mellitus', diagnosedDate: '2015-04-10', status: 'active', notes: 'Metformin 1g BD + Glibenclamide 5mg OD.', recordedByPractitionerId: S['DOC-2024-001'], blockchainHash: recordHash({ mh: 'p4_dm' }) },
    { id: uid(), patientId: patId.p4, condition: 'Hypertension', diagnosedDate: '2018-07-14', status: 'active', notes: 'Not on specific antihypertensives currently.', recordedByPractitionerId: S['DOC-2024-001'], blockchainHash: recordHash({ mh: 'p4_htn' }) },
    { id: uid(), patientId: patId.p4, condition: 'Obesity (BMI 35.2)', diagnosedDate: '2020-01-01', status: 'active', notes: 'Dietary and exercise counselling ongoing.', recordedByPractitionerId: S['DOC-2024-001'], blockchainHash: recordHash({ mh: 'p4_ob' }) },
]).onConflictDoNothing();

// ── 16. ACCESS PERMISSIONS ────────────────────────────────────────────────────

console.log('🔐  Seeding access permissions…');

await db.insert(accessPermissions).values([
    { id: uid(), patientId: patId.p1, grantedToUserId: S['DOC-2024-001'], grantedToUserType: 'practitioner', permissionType: 'write', allowedRecordTypes: ['all'], grantedAt: daysAgo(180), expiresAt: new Date(Date.now() + 180 * 86400000), blockchainTransactionId: txId(), isActive: true },
    { id: uid(), patientId: patId.p4, grantedToUserId: S['DOC-2024-001'], grantedToUserType: 'practitioner', permissionType: 'write', allowedRecordTypes: ['all'], grantedAt: daysAgo(365), expiresAt: new Date(Date.now() + 180 * 86400000), blockchainTransactionId: txId(), isActive: true },
    { id: uid(), patientId: patId.p1, grantedToUserId: S['NUR-2024-001'], grantedToUserType: 'nurse', permissionType: 'write', allowedRecordTypes: ['vital_signs'], visitId: vId.v1a, grantedAt: hoursAgo(5), expiresAt: new Date(Date.now() + 86400000), blockchainTransactionId: txId(), isActive: true },
]).onConflictDoNothing();

// ── 17. ACCESS REQUESTS ───────────────────────────────────────────────────────

console.log('📨  Seeding access requests…');

await db.insert(accessRequests).values([
    { id: uid(), requestedByUserId: S['NUR-2024-002'], requestedByUserType: 'nurse', patientId: patId.p3, visitId: vId.v3c, requestedPermissions: ['vital_signs'], reason: 'Follow-up nursing assessment for malaria recovery.', status: 'approved', createdAt: daysAgo(29), respondedAt: daysAgo(29), expiresAt: daysAgo(27) },
    { id: uid(), requestedByUserId: S['LAB-2024-001'], requestedByUserType: 'lab_technician', patientId: patId.p5, visitId: vId.v5a, requestedPermissions: ['lab_order', 'lab_result'], reason: 'Emergency trauma labs — FBC, UE, coagulation screen urgently.', status: 'pending', createdAt: hoursAgo(1), expiresAt: new Date(Date.now() + 47 * 3600000) },
    { id: uid(), requestedByUserId: S['PHAR-2024-001'], requestedByUserType: 'pharmacist', patientId: patId.p4, visitId: vId.v4a, requestedPermissions: ['prescription'], reason: 'Insulin and IV fluid orders for DKA management.', status: 'pending', createdAt: hoursAgo(1), expiresAt: new Date(Date.now() + 47 * 3600000) },
    { id: uid(), requestedByUserId: S['DOC-2024-003'], requestedByUserType: 'practitioner', patientId: patId.p2, visitId: vId.v2c, requestedPermissions: ['consultation', 'diagnosis'], reason: 'Surgical consultation for abdominal discomfort at antenatal visit.', status: 'rejected', createdAt: daysAgo(44), respondedAt: daysAgo(44), expiresAt: daysAgo(42), responseNote: 'Patient declined surgical review.' },
]).onConflictDoNothing();

// ── 18. AUDIT LOGS ────────────────────────────────────────────────────────────

console.log('📋  Seeding audit logs…');

await db.insert(auditLogs).values([
    { id: uid(), userId: S['REC-2024-001'], userType: 'receptionist', patientId: patId.p1, actionType: 'create', resourceType: 'patient', resourceId: patId.p1, timestamp: daysAgo(60), blockchainTransactionId: txId(), isEmergencyOverride: false, createdAt: daysAgo(60) },
    { id: uid(), userId: S['REC-2024-001'], userType: 'receptionist', patientId: patId.p2, actionType: 'create', resourceType: 'patient', resourceId: patId.p2, timestamp: daysAgo(45), blockchainTransactionId: txId(), isEmergencyOverride: false, createdAt: daysAgo(45) },
    { id: uid(), userId: S['REC-2024-001'], userType: 'receptionist', patientId: patId.p1, actionType: 'create', resourceType: 'visit', resourceId: vId.v1a, timestamp: hoursAgo(6), blockchainTransactionId: txId(), isEmergencyOverride: false, createdAt: hoursAgo(6) },
    { id: uid(), userId: S['REC-2024-002'], userType: 'receptionist', patientId: patId.p4, actionType: 'create', resourceType: 'visit', resourceId: vId.v4a, timestamp: hoursAgo(4), blockchainTransactionId: txId(), isEmergencyOverride: false, createdAt: hoursAgo(4) },
    { id: uid(), userId: S['REC-2024-002'], userType: 'receptionist', patientId: patId.p5, actionType: 'create', resourceType: 'visit', resourceId: vId.v5a, timestamp: hoursAgo(3), blockchainTransactionId: txId(), isEmergencyOverride: false, createdAt: hoursAgo(3) },
    { id: uid(), userId: S['NUR-2024-001'], userType: 'nurse', patientId: patId.p1, actionType: 'create', resourceType: 'vital_signs', resourceId: vitId.v1a, timestamp: hoursAgo(5), blockchainTransactionId: txId(), isEmergencyOverride: false, createdAt: hoursAgo(5) },
    { id: uid(), userId: S['NUR-2024-001'], userType: 'nurse', patientId: patId.p4, actionType: 'create', resourceType: 'vital_signs', resourceId: vitId.v4a, timestamp: hoursAgo(3), blockchainTransactionId: txId(), isEmergencyOverride: false, createdAt: hoursAgo(3) },
    { id: uid(), userId: S['NUR-2024-003'], userType: 'nurse', patientId: patId.p5, actionType: 'create', resourceType: 'vital_signs', resourceId: vitId.v5a, timestamp: hoursAgo(2), blockchainTransactionId: txId(), isEmergencyOverride: false, createdAt: hoursAgo(2) },
    { id: uid(), userId: S['DOC-2024-001'], userType: 'practitioner', patientId: patId.p1, actionType: 'create', resourceType: 'consultation', resourceId: cId.v1a, timestamp: hoursAgo(4), blockchainTransactionId: txId(), isEmergencyOverride: false, createdAt: hoursAgo(4) },
    { id: uid(), userId: S['DOC-2024-001'], userType: 'practitioner', patientId: patId.p4, actionType: 'create', resourceType: 'consultation', resourceId: cId.v4a, timestamp: hoursAgo(3), blockchainTransactionId: txId(), isEmergencyOverride: false, createdAt: hoursAgo(3) },
    { id: uid(), userId: S['LAB-2024-001'], userType: 'lab_technician', patientId: patId.p1, actionType: 'create', resourceType: 'lab_result', resourceId: lId.troponin, timestamp: hoursAgo(4), blockchainTransactionId: txId(), isEmergencyOverride: false, createdAt: hoursAgo(4) },
    { id: uid(), userId: S['DOC-2024-001'], userType: 'practitioner', patientId: patId.p1, actionType: 'view', resourceType: 'visit_summary', resourceId: vId.v1a, timestamp: hoursAgo(3), blockchainTransactionId: txId(), isEmergencyOverride: false, createdAt: hoursAgo(3) },
]).onConflictDoNothing();

// ── Done ──────────────────────────────────────────────────────────────────────

console.log('\n✅  Seed complete!\n');
console.log('═══════════════════════════════════════════════════════════════════');
console.log('  LOGIN CREDENTIALS  (password: Password123!)');
console.log('═══════════════════════════════════════════════════════════════════');
console.log('  STAFF  (login with licenseNumber)');
console.log('  ├─ Admin        ADMIN-2024-001   Chanda Mwape');
console.log('  ├─ Reception    REC-2024-001     Namukolo Sichone');
console.log('  ├─ Reception    REC-2024-002     Bwalya Tembo');
console.log('  ├─ Nurse        NUR-2024-001     Mutinta Banda');
console.log('  ├─ Nurse        NUR-2024-002     Chilufya Mulenga');
console.log('  ├─ Nurse        NUR-2024-003     Kalinda Phiri');
console.log('  ├─ Doctor (IM)  DOC-2024-001     Mubanga Kasonde    ← 2 active patients');
console.log('  ├─ Doctor (Pd)  DOC-2024-002     Nchimunya Mwanza');
console.log('  ├─ Doctor (Sx)  DOC-2024-003     Kangwa Chipimo     ← 1 active patient');
console.log('  ├─ Doctor (OB)  DOC-2024-004     Nkandu Luo');
console.log('  ├─ Lab Tech     LAB-2024-001     Mwila Kapasa');
console.log("  ├─ Lab Tech     LAB-2024-002     Precious Ng'ona");
console.log('  ├─ Radiologist  RAD-2024-001     Chisomo Zimba');
console.log('  ├─ Pharmacist   PHAR-2024-001    Mwansa Kabwe');
console.log('  └─ Pharmacist   PHAR-2024-002    Taonga Mbewe');
console.log('');
console.log('  PATIENTS  (login with nationalId)');
console.log('  ├─ 123456/78/1  Fredrick Musonda  → ACTIVE: NSTEMI (emergency)');
console.log('  ├─ 234567/89/1  Chipo Nkuwa       → completed: 28wk antenatal');
console.log('  ├─ 345678/90/1  Liam Lungu        → completed: malaria (paediatric)');
console.log('  ├─ 456789/01/1  Agnes Sakala      → ACTIVE: DKA (urgent)');
console.log('  └─ 567890/12/1  Kalunga Mumba     → ACTIVE: poly-trauma (critical)');
console.log('');
console.log('  ACTIVE VISITS');
console.log('  ├─ VIS-2026-BB001  Fredrick Musonda  NSTEMI     → Dr Kasonde (DOC-2024-001)');
console.log('  ├─ VIS-2026-BB002  Agnes Sakala       DKA        → Dr Kasonde (DOC-2024-001)');
console.log('  └─ VIS-2026-BB003  Kalunga Mumba      Trauma     → Dr Chipimo (DOC-2024-003)');
console.log('═══════════════════════════════════════════════════════════════════\n');