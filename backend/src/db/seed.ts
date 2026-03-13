/**
 * HealthChain Zambia — Database Seed
 * ------------------------------------
 * Run with:  npx tsx src/db/seed.ts
 *
 * Inserts realistic Zambian data in dependency order:
 *  1. institutions
 *  2. departments + wards
 *  3. practitioners  (admin, receptionist, nurses, doctors, lab, radiology, pharmacy)
 *  4. patients
 *  5. patient_institution_registrations
 *  6. visits  (one completed, one in-progress per patient)
 *  7. vital_signs + nursing_assessments
 *  8. consultations + diagnoses
 *  9. lab_test_orders + lab_test_results
 * 10. imaging_orders + imaging_reports
 * 11. prescriptions + prescription_items
 * 12. allergies + medical_history
 * 13. access_permissions + access_requests
 * 14. audit_logs
 *
 * Credentials (all passwords = "Password123!"):
 *  Patients   — login with nationalId
 *  Staff      — login with licenseNumber
 */

import { hash } from 'bcryptjs';
import crypto from 'crypto';
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
const hash32 = () => crypto.randomBytes(32).toString('hex');
const txId = () => crypto.randomBytes(16).toString('hex');
/** DATE columns require 'YYYY-MM-DD' string, not a JS Date object */
const dateStr = (s: string) => s;

/** Password hash — same cost factor as production */
const PASSWORD_HASH = await hash('Password123!', 12);

/** Deterministic but realistic blockchain hash for a record */
const recordHash = (data: object) =>
    crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');

// ── 1. INSTITUTIONS ───────────────────────────────────────────────────────────

console.log('🏥  Seeding institutions…');

const institutionIds = {
    cbuh: uid(),
    ndola: uid(),
    kitwe: uid(),
};

await db.insert(institutions).values([
    {
        id: institutionIds.cbuh,
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
        id: institutionIds.ndola,
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
        id: institutionIds.kitwe,
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

const deptIds = {
    emergency: uid(),
    internalMed: uid(),
    paediatrics: uid(),
    surgery: uid(),
    obstetrics: uid(),
    laboratory: uid(),
    radiology: uid(),
    pharmacy: uid(),
    outpatient: uid(),
};

await db.insert(departments).values([
    { id: deptIds.emergency, institutionId: institutionIds.cbuh, departmentCode: 'ED', departmentName: 'Emergency Department', departmentType: 'clinical', location: 'Ground Floor, Block A', phone: '+260212345679', isActive: true },
    { id: deptIds.internalMed, institutionId: institutionIds.cbuh, departmentCode: 'IM', departmentName: 'Internal Medicine', departmentType: 'clinical', location: 'Floor 2, Block B', phone: '+260212345680', isActive: true },
    { id: deptIds.paediatrics, institutionId: institutionIds.cbuh, departmentCode: 'PAED', departmentName: 'Paediatrics', departmentType: 'clinical', location: 'Floor 3, Block B', phone: '+260212345681', isActive: true },
    { id: deptIds.surgery, institutionId: institutionIds.cbuh, departmentCode: 'SURG', departmentName: 'General Surgery', departmentType: 'clinical', location: 'Floor 1, Block C', phone: '+260212345682', isActive: true },
    { id: deptIds.obstetrics, institutionId: institutionIds.cbuh, departmentCode: 'OBS', departmentName: 'Obstetrics & Gynaecology', departmentType: 'clinical', location: 'Floor 4, Block B', phone: '+260212345683', isActive: true },
    { id: deptIds.laboratory, institutionId: institutionIds.cbuh, departmentCode: 'LAB', departmentName: 'Clinical Laboratory', departmentType: 'diagnostic', location: 'Ground Floor, Block D', phone: '+260212345684', isActive: true },
    { id: deptIds.radiology, institutionId: institutionIds.cbuh, departmentCode: 'RAD', departmentName: 'Radiology & Imaging', departmentType: 'diagnostic', location: 'Ground Floor, Block D', phone: '+260212345685', isActive: true },
    { id: deptIds.pharmacy, institutionId: institutionIds.cbuh, departmentCode: 'PHAR', departmentName: 'Pharmacy', departmentType: 'support', location: 'Ground Floor, Block E', phone: '+260212345686', isActive: true },
    { id: deptIds.outpatient, institutionId: institutionIds.cbuh, departmentCode: 'OPD', departmentName: 'Outpatient Department', departmentType: 'clinical', location: 'Ground Floor, Block A', phone: '+260212345687', isActive: true },
]).onConflictDoNothing();

// ── 3. WARDS ──────────────────────────────────────────────────────────────────

console.log('🛏️  Seeding wards…');

const wardIds = {
    maleGeneral: uid(),
    femaleGeneral: uid(),
    paediatric: uid(),
    maternity: uid(),
    icu: uid(),
    surgical: uid(),
};

await db.insert(wards).values([
    { id: wardIds.maleGeneral, departmentId: deptIds.internalMed, institutionId: institutionIds.cbuh, wardCode: 'WARD-M1', wardName: 'Male General Ward', wardType: 'general', bedCount: 40, availableBeds: 12, isActive: true },
    { id: wardIds.femaleGeneral, departmentId: deptIds.internalMed, institutionId: institutionIds.cbuh, wardCode: 'WARD-F1', wardName: 'Female General Ward', wardType: 'general', bedCount: 40, availableBeds: 8, isActive: true },
    { id: wardIds.paediatric, departmentId: deptIds.paediatrics, institutionId: institutionIds.cbuh, wardCode: 'WARD-P1', wardName: 'Paediatric Ward', wardType: 'paediatric', bedCount: 30, availableBeds: 15, isActive: true },
    { id: wardIds.maternity, departmentId: deptIds.obstetrics, institutionId: institutionIds.cbuh, wardCode: 'WARD-MAT', wardName: 'Maternity Ward', wardType: 'maternity', bedCount: 25, availableBeds: 6, isActive: true },
    { id: wardIds.icu, departmentId: deptIds.emergency, institutionId: institutionIds.cbuh, wardCode: 'WARD-ICU', wardName: 'Intensive Care Unit', wardType: 'icu', bedCount: 10, availableBeds: 3, isActive: true },
    { id: wardIds.surgical, departmentId: deptIds.surgery, institutionId: institutionIds.cbuh, wardCode: 'WARD-S1', wardName: 'Surgical Ward', wardType: 'surgical', bedCount: 30, availableBeds: 10, isActive: true },
]).onConflictDoNothing();

// ── 4. PRACTITIONERS ──────────────────────────────────────────────────────────

console.log('👨‍⚕️  Seeding practitioners…');

const staffIds = {
    // Admin
    adminChief: uid(),
    // Receptionists
    receptionist1: uid(),
    receptionist2: uid(),
    // Nurses
    nurse1: uid(),
    nurse2: uid(),
    nurse3: uid(),
    // Doctors
    doctor1: uid(), // Internal Medicine
    doctor2: uid(), // Paediatrician
    doctor3: uid(), // Surgeon
    doctor4: uid(), // Gynaecologist
    // Lab technicians
    labTech1: uid(),
    labTech2: uid(),
    // Radiologists
    radiologist1: uid(),
    // Pharmacists
    pharmacist1: uid(),
    pharmacist2: uid(),
};

await db.insert(practitioners).values([
    // ── Admin ──
    {
        id: staffIds.adminChief,
        blockchainAddress: addr(),
        institutionId: institutionIds.cbuh,
        firstNameEncrypted: encrypt('Chanda'),
        lastNameEncrypted: encrypt('Mwape'),
        licenseNumber: 'ADMIN-2024-001',
        institutionalId: 'CBUH-ADMIN-001',
        role: 'admin',
        specialization: 'Hospital Administration',
        department: 'Administration',
        phoneNumberEncrypted: encrypt('+260971000001'),
        emailEncrypted: encrypt('c.mwape@cbuh.zm'),
        passwordHash: PASSWORD_HASH,
        isVerified: true, isActive: true,
    },

    // ── Receptionists ──
    {
        id: staffIds.receptionist1,
        blockchainAddress: addr(),
        institutionId: institutionIds.cbuh,
        firstNameEncrypted: encrypt('Namukolo'),
        lastNameEncrypted: encrypt('Sichone'),
        licenseNumber: 'REC-2024-001',
        institutionalId: 'CBUH-REC-001',
        role: 'receptionist',
        department: 'Outpatient Department',
        phoneNumberEncrypted: encrypt('+260971000002'),
        emailEncrypted: encrypt('n.sichone@cbuh.zm'),
        passwordHash: PASSWORD_HASH,
        isVerified: true, isActive: true,
    },
    {
        id: staffIds.receptionist2,
        blockchainAddress: addr(),
        institutionId: institutionIds.cbuh,
        firstNameEncrypted: encrypt('Bwalya'),
        lastNameEncrypted: encrypt('Tembo'),
        licenseNumber: 'REC-2024-002',
        institutionalId: 'CBUH-REC-002',
        role: 'receptionist',
        department: 'Emergency Department',
        phoneNumberEncrypted: encrypt('+260971000003'),
        emailEncrypted: encrypt('b.tembo@cbuh.zm'),
        passwordHash: PASSWORD_HASH,
        isVerified: true, isActive: true,
    },

    // ── Nurses ──
    {
        id: staffIds.nurse1,
        blockchainAddress: addr(),
        institutionId: institutionIds.cbuh,
        firstNameEncrypted: encrypt('Mutinta'),
        lastNameEncrypted: encrypt('Banda'),
        licenseNumber: 'NUR-2024-001',
        institutionalId: 'CBUH-NUR-001',
        role: 'nurse',
        department: 'Internal Medicine',
        phoneNumberEncrypted: encrypt('+260971000004'),
        emailEncrypted: encrypt('m.banda@cbuh.zm'),
        passwordHash: PASSWORD_HASH,
        isVerified: true, isActive: true,
    },
    {
        id: staffIds.nurse2,
        blockchainAddress: addr(),
        institutionId: institutionIds.cbuh,
        firstNameEncrypted: encrypt('Chilufya'),
        lastNameEncrypted: encrypt('Mulenga'),
        licenseNumber: 'NUR-2024-002',
        institutionalId: 'CBUH-NUR-002',
        role: 'nurse',
        department: 'Paediatrics',
        phoneNumberEncrypted: encrypt('+260971000005'),
        emailEncrypted: encrypt('c.mulenga@cbuh.zm'),
        passwordHash: PASSWORD_HASH,
        isVerified: true, isActive: true,
    },
    {
        id: staffIds.nurse3,
        blockchainAddress: addr(),
        institutionId: institutionIds.cbuh,
        firstNameEncrypted: encrypt('Kalinda'),
        lastNameEncrypted: encrypt('Phiri'),
        licenseNumber: 'NUR-2024-003',
        institutionalId: 'CBUH-NUR-003',
        role: 'nurse',
        department: 'Emergency Department',
        phoneNumberEncrypted: encrypt('+260971000006'),
        emailEncrypted: encrypt('k.phiri@cbuh.zm'),
        passwordHash: PASSWORD_HASH,
        isVerified: true, isActive: true,
    },

    // ── Doctors ──
    {
        id: staffIds.doctor1,
        blockchainAddress: addr(),
        institutionId: institutionIds.cbuh,
        firstNameEncrypted: encrypt('Mubanga'),
        lastNameEncrypted: encrypt('Kasonde'),
        licenseNumber: 'DOC-2024-001',
        institutionalId: 'CBUH-DOC-001',
        role: 'practitioner',
        specialization: 'Internal Medicine',
        department: 'Internal Medicine',
        qualifications: 'MBChB, MMed (Internal Medicine)',
        phoneNumberEncrypted: encrypt('+260971000007'),
        emailEncrypted: encrypt('m.kasonde@cbuh.zm'),
        passwordHash: PASSWORD_HASH,
        isVerified: true, isActive: true,
    },
    {
        id: staffIds.doctor2,
        blockchainAddress: addr(),
        institutionId: institutionIds.cbuh,
        firstNameEncrypted: encrypt('Nchimunya'),
        lastNameEncrypted: encrypt('Mwanza'),
        licenseNumber: 'DOC-2024-002',
        institutionalId: 'CBUH-DOC-002',
        role: 'practitioner',
        specialization: 'Paediatrics',
        department: 'Paediatrics',
        qualifications: 'MBChB, DCH, MMed (Paediatrics)',
        phoneNumberEncrypted: encrypt('+260971000008'),
        emailEncrypted: encrypt('n.mwanza@cbuh.zm'),
        passwordHash: PASSWORD_HASH,
        isVerified: true, isActive: true,
    },
    {
        id: staffIds.doctor3,
        blockchainAddress: addr(),
        institutionId: institutionIds.cbuh,
        firstNameEncrypted: encrypt('Kangwa'),
        lastNameEncrypted: encrypt('Chipimo'),
        licenseNumber: 'DOC-2024-003',
        institutionalId: 'CBUH-DOC-003',
        role: 'practitioner',
        specialization: 'General Surgery',
        department: 'Surgery',
        qualifications: 'MBChB, FCS (ECSA)',
        phoneNumberEncrypted: encrypt('+260971000009'),
        emailEncrypted: encrypt('k.chipimo@cbuh.zm'),
        passwordHash: PASSWORD_HASH,
        isVerified: true, isActive: true,
    },
    {
        id: staffIds.doctor4,
        blockchainAddress: addr(),
        institutionId: institutionIds.cbuh,
        firstNameEncrypted: encrypt('Nkandu'),
        lastNameEncrypted: encrypt('Luo'),
        licenseNumber: 'DOC-2024-004',
        institutionalId: 'CBUH-DOC-004',
        role: 'practitioner',
        specialization: 'Obstetrics & Gynaecology',
        department: 'Obstetrics & Gynaecology',
        qualifications: 'MBChB, MMed (OBS/GYN)',
        phoneNumberEncrypted: encrypt('+260971000010'),
        emailEncrypted: encrypt('n.luo@cbuh.zm'),
        passwordHash: PASSWORD_HASH,
        isVerified: true, isActive: true,
    },

    // ── Lab Technicians ──
    {
        id: staffIds.labTech1,
        blockchainAddress: addr(),
        institutionId: institutionIds.cbuh,
        firstNameEncrypted: encrypt('Mwila'),
        lastNameEncrypted: encrypt('Kapasa'),
        licenseNumber: 'LAB-2024-001',
        institutionalId: 'CBUH-LAB-001',
        role: 'lab_technician',
        department: 'Clinical Laboratory',
        qualifications: 'BSc Medical Laboratory Sciences',
        phoneNumberEncrypted: encrypt('+260971000011'),
        emailEncrypted: encrypt('m.kapasa@cbuh.zm'),
        passwordHash: PASSWORD_HASH,
        isVerified: true, isActive: true,
    },
    {
        id: staffIds.labTech2,
        blockchainAddress: addr(),
        institutionId: institutionIds.cbuh,
        firstNameEncrypted: encrypt('Precious'),
        lastNameEncrypted: encrypt('Ng\'ona'),
        licenseNumber: 'LAB-2024-002',
        institutionalId: 'CBUH-LAB-002',
        role: 'lab_technician',
        department: 'Clinical Laboratory',
        qualifications: 'BSc Medical Laboratory Sciences',
        phoneNumberEncrypted: encrypt('+260971000012'),
        emailEncrypted: encrypt('p.ngona@cbuh.zm'),
        passwordHash: PASSWORD_HASH,
        isVerified: true, isActive: true,
    },

    // ── Radiologist ──
    {
        id: staffIds.radiologist1,
        blockchainAddress: addr(),
        institutionId: institutionIds.cbuh,
        firstNameEncrypted: encrypt('Chisomo'),
        lastNameEncrypted: encrypt('Zimba'),
        licenseNumber: 'RAD-2024-001',
        institutionalId: 'CBUH-RAD-001',
        role: 'radiologist',
        department: 'Radiology & Imaging',
        qualifications: 'MBChB, MMed (Radiology)',
        phoneNumberEncrypted: encrypt('+260971000013'),
        emailEncrypted: encrypt('c.zimba@cbuh.zm'),
        passwordHash: PASSWORD_HASH,
        isVerified: true, isActive: true,
    },

    // ── Pharmacists ──
    {
        id: staffIds.pharmacist1,
        blockchainAddress: addr(),
        institutionId: institutionIds.cbuh,
        firstNameEncrypted: encrypt('Mwansa'),
        lastNameEncrypted: encrypt('Kabwe'),
        licenseNumber: 'PHAR-2024-001',
        institutionalId: 'CBUH-PHAR-001',
        role: 'pharmacist',
        department: 'Pharmacy',
        qualifications: 'BPharm',
        phoneNumberEncrypted: encrypt('+260971000014'),
        emailEncrypted: encrypt('m.kabwe@cbuh.zm'),
        passwordHash: PASSWORD_HASH,
        isVerified: true, isActive: true,
    },
    {
        id: staffIds.pharmacist2,
        blockchainAddress: addr(),
        institutionId: institutionIds.cbuh,
        firstNameEncrypted: encrypt('Taonga'),
        lastNameEncrypted: encrypt('Mbewe'),
        licenseNumber: 'PHAR-2024-002',
        institutionalId: 'CBUH-PHAR-002',
        role: 'pharmacist',
        department: 'Pharmacy',
        qualifications: 'BPharm, MPharm',
        phoneNumberEncrypted: encrypt('+260971000015'),
        emailEncrypted: encrypt('t.mbewe@cbuh.zm'),
        passwordHash: PASSWORD_HASH,
        isVerified: true, isActive: true,
    },
]).onConflictDoNothing();

// ── 5. PATIENTS ───────────────────────────────────────────────────────────────

console.log('🧑‍🤝‍🧑  Seeding patients…');

const patientIds = {
    p1: uid(), // Male, 35, hypertension history
    p2: uid(), // Female, 28, currently pregnant
    p3: uid(), // Male, 8 (paediatric)
    p4: uid(), // Female, 52, diabetic
    p5: uid(), // Male, 19, emergency case
};

const patientBlockchainAddresses = {
    p1: addr(), p2: addr(), p3: addr(), p4: addr(), p5: addr(),
};

await db.insert(patients).values([
    {
        id: patientIds.p1,
        blockchainAddress: patientBlockchainAddresses.p1,
        firstNameEncrypted: encrypt('Fredrick'),
        lastNameEncrypted: encrypt('Musonda'),
        dateOfBirthEncrypted: encrypt('1989-03-14'),
        gender: 'male',
        bloodType: 'O+',
        phoneNumberEncrypted: encrypt('+260977100001'),
        emailEncrypted: encrypt('f.musonda@gmail.com'),
        addressEncrypted: encrypt('Plot 45, Parklands, Kitwe, Copperbelt'),
        nationalIdEncrypted: encrypt('123456/78/1'),
        emergencyContactEncrypted: encrypt('Grace Musonda — +260977200001 — Wife'),
        maritalStatus: 'married',
        occupation: 'Mining Engineer',
        passwordHash: PASSWORD_HASH,
        isActive: true,
    },
    {
        id: patientIds.p2,
        blockchainAddress: patientBlockchainAddresses.p2,
        firstNameEncrypted: encrypt('Chipo'),
        lastNameEncrypted: encrypt('Nkuwa'),
        dateOfBirthEncrypted: encrypt('1996-07-22'),
        gender: 'female',
        bloodType: 'A+',
        phoneNumberEncrypted: encrypt('+260977100002'),
        emailEncrypted: encrypt('c.nkuwa@gmail.com'),
        addressEncrypted: encrypt('House 12, Riverside, Ndola, Copperbelt'),
        nationalIdEncrypted: encrypt('234567/89/1'),
        emergencyContactEncrypted: encrypt('James Nkuwa — +260977200002 — Husband'),
        maritalStatus: 'married',
        occupation: 'Teacher',
        passwordHash: PASSWORD_HASH,
        isActive: true,
    },
    {
        id: patientIds.p3,
        blockchainAddress: patientBlockchainAddresses.p3,
        firstNameEncrypted: encrypt('Liam'),
        lastNameEncrypted: encrypt('Lungu'),
        dateOfBirthEncrypted: encrypt('2016-11-05'),
        gender: 'male',
        bloodType: 'B+',
        phoneNumberEncrypted: encrypt('+260977100003'),
        addressEncrypted: encrypt('Plot 89, Chipulukusu, Ndola, Copperbelt'),
        nationalIdEncrypted: encrypt('345678/90/1'),
        emergencyContactEncrypted: encrypt('Mary Lungu — +260977200003 — Mother'),
        passwordHash: PASSWORD_HASH,
        isActive: true,
    },
    {
        id: patientIds.p4,
        blockchainAddress: patientBlockchainAddresses.p4,
        firstNameEncrypted: encrypt('Agnes'),
        lastNameEncrypted: encrypt('Sakala'),
        dateOfBirthEncrypted: encrypt('1972-01-30'),
        gender: 'female',
        bloodType: 'AB+',
        phoneNumberEncrypted: encrypt('+260977100004'),
        emailEncrypted: encrypt('a.sakala@yahoo.com'),
        addressEncrypted: encrypt('Stand 7, Nkana East, Kitwe, Copperbelt'),
        nationalIdEncrypted: encrypt('456789/01/1'),
        emergencyContactEncrypted: encrypt('Peter Sakala — +260977200004 — Son'),
        maritalStatus: 'widowed',
        occupation: 'Retired Civil Servant',
        passwordHash: PASSWORD_HASH,
        isActive: true,
    },
    {
        id: patientIds.p5,
        blockchainAddress: patientBlockchainAddresses.p5,
        firstNameEncrypted: encrypt('Kalunga'),
        lastNameEncrypted: encrypt('Mumba'),
        dateOfBirthEncrypted: encrypt('2005-08-18'),
        gender: 'male',
        bloodType: 'O-',
        phoneNumberEncrypted: encrypt('+260977100005'),
        addressEncrypted: encrypt('Maluba Township, Chingola, Copperbelt'),
        nationalIdEncrypted: encrypt('567890/12/1'),
        emergencyContactEncrypted: encrypt('Ruth Mumba — +260977200005 — Mother'),
        maritalStatus: 'single',
        occupation: 'Student',
        passwordHash: PASSWORD_HASH,
        isActive: true,
    },
]).onConflictDoNothing();

// ── 6. PATIENT-INSTITUTION REGISTRATIONS ──────────────────────────────────────

console.log('📋  Seeding patient registrations…');

await db.insert(patientInstitutionRegistrations).values([
    { id: uid(), patientId: patientIds.p1, institutionId: institutionIds.cbuh, hospitalPatientNumber: 'CBUH-2024-00001', registeredAt: new Date('2024-01-10'), lastVisitAt: new Date('2025-02-15'), isActive: true },
    { id: uid(), patientId: patientIds.p2, institutionId: institutionIds.cbuh, hospitalPatientNumber: 'CBUH-2024-00002', registeredAt: new Date('2024-03-05'), lastVisitAt: new Date('2025-01-20'), isActive: true },
    { id: uid(), patientId: patientIds.p3, institutionId: institutionIds.cbuh, hospitalPatientNumber: 'CBUH-2024-00003', registeredAt: new Date('2024-06-12'), lastVisitAt: new Date('2025-02-01'), isActive: true },
    { id: uid(), patientId: patientIds.p4, institutionId: institutionIds.cbuh, hospitalPatientNumber: 'CBUH-2024-00004', registeredAt: new Date('2023-09-20'), lastVisitAt: new Date('2025-03-01'), isActive: true },
    { id: uid(), patientId: patientIds.p5, institutionId: institutionIds.cbuh, hospitalPatientNumber: 'CBUH-2025-00005', registeredAt: new Date('2025-03-01'), isActive: true },
    // p1 also registered at Ndola
    { id: uid(), patientId: patientIds.p1, institutionId: institutionIds.ndola, hospitalPatientNumber: 'NCH-2023-00101', registeredAt: new Date('2023-05-20'), lastVisitAt: new Date('2023-12-10'), isActive: true },
]).onConflictDoNothing();

// ── 7. VISITS ─────────────────────────────────────────────────────────────────

console.log('🚶  Seeding visits…');

const visitIds = {
    // Completed visits
    v1_complete: uid(), // p1 — hypertension follow-up, completed
    v2_complete: uid(), // p2 — antenatal, completed
    v3_complete: uid(), // p3 — fever, completed
    v4_complete: uid(), // p4 — diabetes review, completed
    // Active visits (in-progress)
    v1_active: uid(), // p1 — chest pain
    v4_active: uid(), // p4 — hyperglycaemia
    v5_active: uid(), // p5 — trauma/emergency
};

const now = new Date();
const daysAgo = (d: number) => new Date(Date.now() - d * 86400000);

await db.insert(visits).values([
    // ── Completed visits ──
    {
        id: visitIds.v1_complete,
        patientId: patientIds.p1,
        institutionId: institutionIds.cbuh,
        departmentId: deptIds.internalMed,
        visitNumber: 'VIS-2025-AA001',
        visitType: 'outpatient',
        admissionDate: daysAgo(60),
        dischargeDate: daysAgo(60),
        chiefComplaint: 'Headache, dizziness and elevated blood pressure readings at home',
        admittingDiagnosis: 'Hypertensive urgency',
        dischargeDiagnosis: 'Essential hypertension, stage 2',
        status: 'completed',
        priority: 'urgent',
        dischargeSummary: 'Patient reviewed and antihypertensive therapy adjusted. BP improved from 178/110 to 142/88 mmHg prior to discharge.',
        dischargeInstructions: 'Continue Amlodipine 10mg OD, Enalapril 10mg BD. Low-salt diet. Avoid alcohol. Follow-up in 4 weeks.',
        followUpDate: daysAgo(30),
        blockchainHash: recordHash({ visit: 'v1_complete', ts: daysAgo(60) }),
        dischargeBlockchainHash: recordHash({ discharge: 'v1_complete', ts: daysAgo(60) }),
    },
    {
        id: visitIds.v2_complete,
        patientId: patientIds.p2,
        institutionId: institutionIds.cbuh,
        departmentId: deptIds.obstetrics,
        visitNumber: 'VIS-2025-AA002',
        visitType: 'outpatient',
        admissionDate: daysAgo(45),
        dischargeDate: daysAgo(45),
        chiefComplaint: 'Routine antenatal check-up — 28 weeks gestation',
        dischargeDiagnosis: 'Normal pregnancy, 28 weeks',
        status: 'completed',
        priority: 'routine',
        dischargeSummary: 'Antenatal visit completed. Fundal height 28cm. Foetal heart rate 140 bpm. BP 110/72. Iron supplementation continued.',
        dischargeInstructions: 'Continue ferrous sulphate and folic acid. Return in 4 weeks or earlier if reduced foetal movement.',
        blockchainHash: recordHash({ visit: 'v2_complete', ts: daysAgo(45) }),
        dischargeBlockchainHash: recordHash({ discharge: 'v2_complete', ts: daysAgo(45) }),
    },
    {
        id: visitIds.v3_complete,
        patientId: patientIds.p3,
        institutionId: institutionIds.cbuh,
        departmentId: deptIds.paediatrics,
        visitNumber: 'VIS-2025-AA003',
        visitType: 'outpatient',
        admissionDate: daysAgo(30),
        dischargeDate: daysAgo(30),
        chiefComplaint: 'High grade fever 39.2°C, poor feeding and lethargy for 2 days',
        dischargeDiagnosis: 'Uncomplicated malaria (P. falciparum)',
        status: 'completed',
        priority: 'urgent',
        dischargeSummary: 'Malaria RDT positive. AL commenced. Temperature settled to 37.4°C. Child tolerating oral feeds at discharge.',
        dischargeInstructions: 'Complete Artemether-Lumefantrine 3-day course. Return if fever persists beyond 48 hours.',
        blockchainHash: recordHash({ visit: 'v3_complete', ts: daysAgo(30) }),
        dischargeBlockchainHash: recordHash({ discharge: 'v3_complete', ts: daysAgo(30) }),
    },
    {
        id: visitIds.v4_complete,
        patientId: patientIds.p4,
        institutionId: institutionIds.cbuh,
        departmentId: deptIds.internalMed,
        visitNumber: 'VIS-2025-AA004',
        visitType: 'outpatient',
        admissionDate: daysAgo(14),
        dischargeDate: daysAgo(14),
        chiefComplaint: 'Routine diabetes review — 3-monthly HbA1c check',
        dischargeDiagnosis: 'Type 2 Diabetes Mellitus — poorly controlled (HbA1c 9.2%)',
        status: 'completed',
        priority: 'routine',
        dischargeSummary: 'HbA1c elevated at 9.2%. Metformin dose increased. Dietary counselling provided. Ophthalmology referral made for diabetic retinopathy screening.',
        dischargeInstructions: 'Metformin 1g BD, Glibenclamide 5mg OD. Strict dietary compliance. Eye review in 6 weeks.',
        blockchainHash: recordHash({ visit: 'v4_complete', ts: daysAgo(14) }),
        dischargeBlockchainHash: recordHash({ discharge: 'v4_complete', ts: daysAgo(14) }),
    },

    // ── Active visits ──
    {
        id: visitIds.v1_active,
        patientId: patientIds.p1,
        institutionId: institutionIds.cbuh,
        departmentId: deptIds.internalMed,
        wardId: wardIds.maleGeneral,
        visitNumber: 'VIS-2026-BB001',
        visitType: 'inpatient',
        admissionDate: daysAgo(2),
        chiefComplaint: 'Central chest pain radiating to left arm, diaphoresis, shortness of breath for 3 hours',
        admittingDiagnosis: 'Acute coronary syndrome — rule out NSTEMI',
        wardOrRoom: 'Male General Ward, Bed 5',
        status: 'in-progress',
        priority: 'emergency',
        blockchainHash: recordHash({ visit: 'v1_active', ts: daysAgo(2) }),
    },
    {
        id: visitIds.v4_active,
        patientId: patientIds.p4,
        institutionId: institutionIds.cbuh,
        departmentId: deptIds.internalMed,
        wardId: wardIds.femaleGeneral,
        visitNumber: 'VIS-2026-BB002',
        visitType: 'inpatient',
        admissionDate: daysAgo(1),
        chiefComplaint: 'Increased thirst, frequent urination, blurred vision and blood glucose of 24.6 mmol/L at home',
        admittingDiagnosis: 'Hyperglycaemic crisis — DKA vs HHS',
        wardOrRoom: 'Female General Ward, Bed 12',
        status: 'in-progress',
        priority: 'urgent',
        blockchainHash: recordHash({ visit: 'v4_active', ts: daysAgo(1) }),
    },
    {
        id: visitIds.v5_active,
        patientId: patientIds.p5,
        institutionId: institutionIds.cbuh,
        departmentId: deptIds.emergency,
        wardId: wardIds.icu,
        visitNumber: 'VIS-2026-BB003',
        visitType: 'emergency',
        admissionDate: new Date(Date.now() - 3 * 3600000), // 3 hours ago
        chiefComplaint: 'Road traffic accident — pedestrian struck by vehicle, loss of consciousness at scene',
        admittingDiagnosis: 'Poly-trauma: suspected closed head injury, multiple lacerations',
        wardOrRoom: 'ICU, Bed 2',
        status: 'in-progress',
        priority: 'critical',
        blockchainHash: recordHash({ visit: 'v5_active', ts: now }),
    },
]).onConflictDoNothing();

// ── 8. VITAL SIGNS ────────────────────────────────────────────────────────────

console.log('💓  Seeding vital signs…');

const vitalIds = {
    v1c: uid(), v2c: uid(), v3c: uid(), v4c: uid(), // completed
    v1a: uid(), v4a: uid(), v5a: uid(),             // active
};

await db.insert(vitalSigns).values([
    // Completed visit vitals
    { id: vitalIds.v1c, visitId: visitIds.v1_complete, patientId: patientIds.p1, recordedByNurseId: staffIds.nurse1, temperature: '37.1', bloodPressureSystolic: 178, bloodPressureDiastolic: 110, pulseRate: 92, respiratoryRate: 18, oxygenSaturation: 98, weight: '78.5', height: '172.0', painLevel: 5, nurseNotes: 'Patient anxious, states headache 7/10. No facial asymmetry.', blockchainHash: recordHash({ vitals: vitalIds.v1c }), recordedAt: daysAgo(60) },
    { id: vitalIds.v2c, visitId: visitIds.v2_complete, patientId: patientIds.p2, recordedByNurseId: staffIds.nurse2, temperature: '36.8', bloodPressureSystolic: 110, bloodPressureDiastolic: 72, pulseRate: 84, respiratoryRate: 16, oxygenSaturation: 99, weight: '68.0', height: '160.0', painLevel: 0, nurseNotes: 'Patient comfortable. Foetal movement felt. FHR 140 bpm on doppler.', blockchainHash: recordHash({ vitals: vitalIds.v2c }), recordedAt: daysAgo(45) },
    { id: vitalIds.v3c, visitId: visitIds.v3_complete, patientId: patientIds.p3, recordedByNurseId: staffIds.nurse2, temperature: '39.2', bloodPressureSystolic: 100, bloodPressureDiastolic: 62, pulseRate: 118, respiratoryRate: 24, oxygenSaturation: 97, weight: '22.5', height: '125.0', painLevel: 4, nurseNotes: 'Child febrile and irritable, crying. Mother reports 2 days of fever and poor feeding.', blockchainHash: recordHash({ vitals: vitalIds.v3c }), recordedAt: daysAgo(30) },
    { id: vitalIds.v4c, visitId: visitIds.v4_complete, patientId: patientIds.p4, recordedByNurseId: staffIds.nurse1, temperature: '36.9', bloodPressureSystolic: 136, bloodPressureDiastolic: 84, pulseRate: 78, respiratoryRate: 16, oxygenSaturation: 98, weight: '88.0', height: '158.0', painLevel: 2, nurseNotes: 'Patient obese (BMI 35.2). Blood glucose 14.3 mmol/L on glucometer.', blockchainHash: recordHash({ vitals: vitalIds.v4c }), recordedAt: daysAgo(14) },
    // Active visit vitals
    { id: vitalIds.v1a, visitId: visitIds.v1_active, patientId: patientIds.p1, recordedByNurseId: staffIds.nurse1, temperature: '36.8', bloodPressureSystolic: 156, bloodPressureDiastolic: 98, pulseRate: 108, respiratoryRate: 22, oxygenSaturation: 94, weight: '79.0', height: '172.0', painLevel: 8, nurseNotes: 'Diaphoretic, pale, clutching chest. IV access established in right antecubital vein. O2 at 4L/min via nasal prongs.', blockchainHash: recordHash({ vitals: vitalIds.v1a }), recordedAt: daysAgo(2) },
    { id: vitalIds.v4a, visitId: visitIds.v4_active, patientId: patientIds.p4, recordedByNurseId: staffIds.nurse1, temperature: '37.4', bloodPressureSystolic: 148, bloodPressureDiastolic: 90, pulseRate: 96, respiratoryRate: 20, oxygenSaturation: 97, weight: '87.5', height: '158.0', painLevel: 3, nurseNotes: 'Blood glucose 24.6 mmol/L on glucometer. Kussmaul breathing noted. IV access established. Urinalysis ordered.', blockchainHash: recordHash({ vitals: vitalIds.v4a }), recordedAt: daysAgo(1) },
    { id: vitalIds.v5a, visitId: visitIds.v5_active, patientId: patientIds.p5, recordedByNurseId: staffIds.nurse3, temperature: '35.8', bloodPressureSystolic: 88, bloodPressureDiastolic: 54, pulseRate: 132, respiratoryRate: 28, oxygenSaturation: 88, weight: '65.0', height: '175.0', painLevel: 9, nurseNotes: 'GCS 10/15 (E3V3M4). Trauma collar in situ. Two large-bore IVs established. 1L 0.9% NaCl running. Massive haematoma right temporal region.', blockchainHash: recordHash({ vitals: vitalIds.v5a }), recordedAt: new Date(Date.now() - 2.5 * 3600000) },
]).onConflictDoNothing();

// ── 9. CONSULTATIONS ──────────────────────────────────────────────────────────

console.log('🩺  Seeding consultations…');

const consultIds = {
    v1c: uid(), v2c: uid(), v3c: uid(), v4c: uid(),
    v1a: uid(), v4a: uid(),
};

await db.insert(consultations).values([
    {
        id: consultIds.v1c,
        visitId: visitIds.v1_complete, patientId: patientIds.p1, practitionerId: staffIds.doctor1,
        chiefComplaint: 'Hypertensive urgency with headache and dizziness',
        historyOfPresentIllness: 'Mr Musonda is a 35-year-old male with a known history of hypertension on Amlodipine 5mg. He presents with a 2-day history of severe frontal headache and dizziness. BP at home measuring 175–185/105–112 mmHg. No chest pain. No focal neurological deficit.',
        physicalExamination: 'Alert and oriented. BP 178/110 mmHg, HR 92 bpm. No papilloedema. Heart sounds normal. No peripheral oedema.',
        assessment: 'Hypertensive urgency — likely medication non-compliance and dietary indiscretion (reports high sodium intake over weekend).',
        plan: 'Uptitrate Amlodipine to 10mg OD. Add Enalapril 10mg BD. Dietary sodium restriction counselling. Repeat BP check in 30 minutes. Discharge if BP < 160/100.',
        blockchainHash: recordHash({ consult: consultIds.v1c }), consultationDate: daysAgo(60),
    },
    {
        id: consultIds.v2c,
        visitId: visitIds.v2_complete, patientId: patientIds.p2, practitionerId: staffIds.doctor4,
        chiefComplaint: 'Routine antenatal visit — 28 weeks',
        historyOfPresentIllness: 'Mrs Nkuwa is a 28-year-old G1P0 at 28 weeks by LMP. No complications. Good foetal movements. Minor ankle swelling. No headache, visual disturbance or epigastric pain.',
        physicalExamination: 'BP 110/72. Fundal height 28cm — consistent with dates. FHR 140 bpm. Presentation cephalic. Mild bilateral ankle oedema.',
        assessment: 'Normal intrauterine pregnancy at 28 weeks. Mild physiological oedema. Iron stores borderline.',
        plan: 'Continue ferrous sulphate 200mg BD and folic acid 5mg OD. TT booster given. Next visit at 32 weeks. Advise reduced standing and foot elevation.',
        blockchainHash: recordHash({ consult: consultIds.v2c }), consultationDate: daysAgo(45),
    },
    {
        id: consultIds.v3c,
        visitId: visitIds.v3_complete, patientId: patientIds.p3, practitionerId: staffIds.doctor2,
        chiefComplaint: 'Fever and lethargy in 8-year-old child',
        historyOfPresentIllness: 'Liam Lungu, 8 years old. 2-day history of high-grade fever up to 39.8°C, poor appetite, lethargy. No vomiting. No neck stiffness. Up to date on vaccinations.',
        physicalExamination: 'Temp 39.2°C. HR 118. RR 24. Sats 97%. Alert but irritable. Mild pallor of conjunctivae. No organomegaly. No meningism.',
        assessment: 'Uncomplicated malaria — P. falciparum on RDT. Mild anaemia likely secondary to malaria.',
        plan: 'Artemether-Lumefantrine (AL) as per weight (22.5kg) — 3-tab BD for 3 days. Paracetamol for fever. Oral rehydration. Return if no improvement in 48 hours.',
        blockchainHash: recordHash({ consult: consultIds.v3c }), consultationDate: daysAgo(30),
    },
    {
        id: consultIds.v4c,
        visitId: visitIds.v4_complete, patientId: patientIds.p4, practitionerId: staffIds.doctor1,
        chiefComplaint: 'Quarterly diabetes review',
        historyOfPresentIllness: 'Mrs Sakala, 52-year-old with type 2 DM for 10 years. On Metformin 500mg BD. HbA1c today 9.2% (target < 7%). Reports poor dietary compliance. Admits to missing medications. No hypoglycaemic episodes. Mild blurred vision for 3 months.',
        physicalExamination: 'BP 136/84. BMI 35.2. Peripheral pulses present. No foot ulcers. Monofilament sensation reduced bilateral feet.',
        assessment: 'Poorly controlled T2DM (HbA1c 9.2%). Peripheral neuropathy likely. Blurred vision — needs retinal screening.',
        plan: 'Increase Metformin to 1g BD. Add Glibenclamide 5mg OD. Ophthalmology referral. Dietary counselling. Foot care education. Repeat HbA1c in 3 months.',
        blockchainHash: recordHash({ consult: consultIds.v4c }), consultationDate: daysAgo(14),
    },
    {
        id: consultIds.v1a,
        visitId: visitIds.v1_active, patientId: patientIds.p1, practitionerId: staffIds.doctor1,
        chiefComplaint: 'Acute chest pain, diaphoresis, shortness of breath',
        historyOfPresentIllness: 'Mr Musonda presents with 3 hours of central chest pain, pressure-like, radiating to left arm and jaw. Associated diaphoresis and SOB. Background of hypertension and smoking (10 pack-years).',
        physicalExamination: 'Distressed, diaphoretic. BP 156/98. HR 108 irregular. SpO2 94% on room air. Bilateral basal crepitations. JVP elevated.',
        clinicalFindings: 'ECG: ST depression in V4-V6. Troponin-I pending. CXR: mild pulmonary venous congestion.',
        assessment: 'NSTEMI most likely. Admit for monitoring, serial troponins and cardiology review.',
        plan: 'Dual antiplatelet: Aspirin 300mg stat + Clopidogrel 300mg stat. Enoxaparin 1mg/kg SC. GTN infusion. IV furosemide 40mg. Cardiology referral. ICU/HDU bed.',
        blockchainHash: recordHash({ consult: consultIds.v1a }), consultationDate: daysAgo(2),
    },
    {
        id: consultIds.v4a,
        visitId: visitIds.v4_active, patientId: patientIds.p4, practitionerId: staffIds.doctor1,
        chiefComplaint: 'Hyperglycaemia with Kussmaul breathing',
        historyOfPresentIllness: 'Mrs Sakala presents with 2 days of polyuria, polydipsia, blurred vision. BGL 24.6 at home. Not eating well, vomited x2. Background T2DM on Metformin and Glibenclamide.',
        physicalExamination: 'Dry mucous membranes. BP 148/90. HR 96. Deep sighing Kussmaul respirations. Mild fruity odour on breath.',
        assessment: 'Diabetic ketoacidosis (DKA) in known T2DM. Precipitant likely poor medication compliance and intercurrent illness.',
        plan: 'IV fluid resuscitation: 0.9% NaCl 1L over 1 hour. IV insulin infusion 0.1 unit/kg/hr. 2-hourly BGL monitoring. U&E, ABG, urinalysis. ICU-level monitoring.',
        blockchainHash: recordHash({ consult: consultIds.v4a }), consultationDate: daysAgo(1),
    },
]).onConflictDoNothing();

// ── 10. DIAGNOSES ─────────────────────────────────────────────────────────────

console.log('📝  Seeding diagnoses…');

await db.insert(diagnoses).values([
    { id: uid(), consultationId: consultIds.v1c, visitId: visitIds.v1_complete, patientId: patientIds.p1, practitionerId: staffIds.doctor1, icdCode: 'I10', diagnosisName: 'Essential (primary) hypertension', diagnosisType: 'confirmed', severity: 'moderate', blockchainHash: recordHash({ dx: 'v1c_htn' }), diagnosedAt: daysAgo(60) },
    { id: uid(), consultationId: consultIds.v2c, visitId: visitIds.v2_complete, patientId: patientIds.p2, practitionerId: staffIds.doctor4, icdCode: 'Z34.1', diagnosisName: 'Supervision of normal first pregnancy, second trimester', diagnosisType: 'confirmed', blockchainHash: recordHash({ dx: 'v2c_preg' }), diagnosedAt: daysAgo(45) },
    { id: uid(), consultationId: consultIds.v3c, visitId: visitIds.v3_complete, patientId: patientIds.p3, practitionerId: staffIds.doctor2, icdCode: 'B54', diagnosisName: 'Unspecified malaria (P. falciparum RDT positive)', diagnosisType: 'confirmed', severity: 'mild', blockchainHash: recordHash({ dx: 'v3c_mal' }), diagnosedAt: daysAgo(30) },
    { id: uid(), consultationId: consultIds.v4c, visitId: visitIds.v4_complete, patientId: patientIds.p4, practitionerId: staffIds.doctor1, icdCode: 'E11.9', diagnosisName: 'Type 2 diabetes mellitus without complications — poorly controlled', diagnosisType: 'confirmed', severity: 'moderate', blockchainHash: recordHash({ dx: 'v4c_dm' }), diagnosedAt: daysAgo(14) },
    { id: uid(), consultationId: consultIds.v4c, visitId: visitIds.v4_complete, patientId: patientIds.p4, practitionerId: staffIds.doctor1, icdCode: 'E11.40', diagnosisName: 'Type 2 diabetes mellitus with diabetic neuropathy', diagnosisType: 'provisional', severity: 'mild', blockchainHash: recordHash({ dx: 'v4c_neuropathy' }), diagnosedAt: daysAgo(14) },
    { id: uid(), consultationId: consultIds.v1a, visitId: visitIds.v1_active, patientId: patientIds.p1, practitionerId: staffIds.doctor1, icdCode: 'I21.4', diagnosisName: 'Non-ST elevation myocardial infarction (NSTEMI)', diagnosisType: 'provisional', severity: 'severe', blockchainHash: recordHash({ dx: 'v1a_nstemi' }), diagnosedAt: daysAgo(2) },
    { id: uid(), consultationId: consultIds.v4a, visitId: visitIds.v4_active, patientId: patientIds.p4, practitionerId: staffIds.doctor1, icdCode: 'E11.10', diagnosisName: 'Type 2 diabetes mellitus with diabetic ketoacidosis', diagnosisType: 'confirmed', severity: 'severe', blockchainHash: recordHash({ dx: 'v4a_dka' }), diagnosedAt: daysAgo(1) },
]).onConflictDoNothing();

// ── 11. LAB ORDERS & RESULTS ──────────────────────────────────────────────────

console.log('🔬  Seeding lab orders and results…');

const labOrderIds = {
    fbc_v1a: uid(),
    troponin: uid(),
    lipids: uid(),
    urine_v4a: uid(),
    abg_v4a: uid(),
    ue_v4a: uid(),
    fbc_v3c: uid(),
    hba1c_v4c: uid(),
};

await db.insert(labTestOrders).values([
    // Active visit — Chest pain workup
    { id: labOrderIds.fbc_v1a, orderNumber: 'LAB-2026-00101', visitId: visitIds.v1_active, patientId: patientIds.p1, orderedByPractitionerId: staffIds.doctor1, testName: 'Full Blood Count (FBC)', testCode: 'FBC', testCategory: 'Haematology', specimenType: 'blood', urgency: 'emergency', status: 'resulted', clinicalNotes: 'NSTEMI workup', blockchainHash: recordHash({ lab: 'fbc_v1a' }), orderedAt: daysAgo(2) },
    { id: labOrderIds.troponin, orderNumber: 'LAB-2026-00102', visitId: visitIds.v1_active, patientId: patientIds.p1, orderedByPractitionerId: staffIds.doctor1, testName: 'Troponin-I (High Sensitivity)', testCode: 'HSTN', testCategory: 'Cardiology', specimenType: 'blood', urgency: 'emergency', status: 'resulted', clinicalNotes: 'Chest pain — r/o NSTEMI', blockchainHash: recordHash({ lab: 'troponin' }), orderedAt: daysAgo(2) },
    { id: labOrderIds.lipids, orderNumber: 'LAB-2026-00103', visitId: visitIds.v1_active, patientId: patientIds.p1, orderedByPractitionerId: staffIds.doctor1, testName: 'Fasting Lipid Profile', testCode: 'LIPID', testCategory: 'Biochemistry', specimenType: 'blood', urgency: 'urgent', status: 'in_progress', clinicalNotes: 'Cardiovascular risk assessment', blockchainHash: recordHash({ lab: 'lipids' }), orderedAt: daysAgo(2) },
    // Active visit — DKA workup
    { id: labOrderIds.urine_v4a, orderNumber: 'LAB-2026-00201', visitId: visitIds.v4_active, patientId: patientIds.p4, orderedByPractitionerId: staffIds.doctor1, testName: 'Urinalysis with Microscopy', testCode: 'URINE', testCategory: 'Urinalysis', specimenType: 'urine', urgency: 'urgent', status: 'resulted', clinicalNotes: 'DKA workup — ketones', blockchainHash: recordHash({ lab: 'urine_v4a' }), orderedAt: daysAgo(1) },
    { id: labOrderIds.abg_v4a, orderNumber: 'LAB-2026-00202', visitId: visitIds.v4_active, patientId: patientIds.p4, orderedByPractitionerId: staffIds.doctor1, testName: 'Arterial Blood Gas (ABG)', testCode: 'ABG', testCategory: 'Biochemistry', specimenType: 'blood', urgency: 'emergency', status: 'resulted', clinicalNotes: 'Assess metabolic acidosis', blockchainHash: recordHash({ lab: 'abg_v4a' }), orderedAt: daysAgo(1) },
    { id: labOrderIds.ue_v4a, orderNumber: 'LAB-2026-00203', visitId: visitIds.v4_active, patientId: patientIds.p4, orderedByPractitionerId: staffIds.doctor1, testName: 'Urea & Electrolytes (U&E)', testCode: 'UE', testCategory: 'Biochemistry', specimenType: 'blood', urgency: 'urgent', status: 'resulted', clinicalNotes: 'Renal function and electrolytes in DKA', blockchainHash: recordHash({ lab: 'ue_v4a' }), orderedAt: daysAgo(1) },
    // Completed visit — malaria
    { id: labOrderIds.fbc_v3c, orderNumber: 'LAB-2025-00301', visitId: visitIds.v3_complete, patientId: patientIds.p3, orderedByPractitionerId: staffIds.doctor2, testName: 'Full Blood Count (FBC)', testCode: 'FBC', testCategory: 'Haematology', specimenType: 'blood', urgency: 'urgent', status: 'resulted', clinicalNotes: 'Febrile child — assess anaemia', blockchainHash: recordHash({ lab: 'fbc_v3c' }), orderedAt: daysAgo(30) },
    // Completed visit — diabetes HbA1c
    { id: labOrderIds.hba1c_v4c, orderNumber: 'LAB-2025-00401', visitId: visitIds.v4_complete, patientId: patientIds.p4, orderedByPractitionerId: staffIds.doctor1, testName: 'Glycated Haemoglobin (HbA1c)', testCode: 'HBA1C', testCategory: 'Biochemistry', specimenType: 'blood', urgency: 'routine', status: 'resulted', clinicalNotes: 'Quarterly diabetic monitoring', blockchainHash: recordHash({ lab: 'hba1c_v4c' }), orderedAt: daysAgo(14) },
]).onConflictDoNothing();

await db.insert(labTestResults).values([
    // FBC — chest pain
    { id: uid(), labTestOrderId: labOrderIds.fbc_v1a, performedByLabTechId: staffIds.labTech1, resultsData: { WBC: '11.2 x10⁹/L', RBC: '4.8 x10¹²/L', Hb: '13.9 g/dL', HCT: '41%', PLT: '224 x10⁹/L', neutrophils: '78%' }, interpretation: 'Leucocytosis with neutrophilia — consistent with physiological stress response in ACS.', abnormalFindings: 'WBC mildly elevated', referenceRanges: { WBC: '4.5–11.0', Hb: '13–17 g/dL (M)', PLT: '150–400' }, blockchainHash: recordHash({ result: 'fbc_v1a' }), resultedAt: daysAgo(2) },
    // Troponin
    { id: uid(), labTestOrderId: labOrderIds.troponin, performedByLabTechId: staffIds.labTech1, resultsData: { TroponinI: '1.24 ng/mL', units: 'ng/mL', method: 'Abbott Architect hs-TnI' }, interpretation: 'Troponin-I significantly elevated. Serial measurement in 3 hours recommended.', abnormalFindings: 'Troponin-I > 0.04 ng/mL (upper reference limit) — consistent with myocardial injury', referenceRanges: { TroponinI: '< 0.04 ng/mL' }, blockchainHash: recordHash({ result: 'troponin' }), resultedAt: daysAgo(2) },
    // Urinalysis — DKA
    { id: uid(), labTestOrderId: labOrderIds.urine_v4a, performedByLabTechId: staffIds.labTech2, resultsData: { glucose: '++++ (4+)', ketones: '+++ (3+)', protein: '+ (1+)', blood: 'negative', pH: '5.0', specific_gravity: '1.030' }, interpretation: 'Heavy glycosuria and ketonuria consistent with diabetic ketoacidosis.', abnormalFindings: 'Glucose 4+, Ketones 3+, mild proteinuria', blockchainHash: recordHash({ result: 'urine_v4a' }), resultedAt: daysAgo(1) },
    // ABG — DKA
    { id: uid(), labTestOrderId: labOrderIds.abg_v4a, performedByLabTechId: staffIds.labTech2, resultsData: { pH: '7.22', PaCO2: '22 mmHg', PaO2: '96 mmHg', HCO3: '10 mmol/L', BE: '-14', SpO2: '97%', lactate: '2.1 mmol/L' }, interpretation: 'Severe high anion-gap metabolic acidosis with respiratory compensation — consistent with DKA.', abnormalFindings: 'pH < 7.3, HCO3 < 15, significant base deficit', referenceRanges: { pH: '7.35–7.45', HCO3: '22–26 mmol/L', PaCO2: '35–45 mmHg' }, blockchainHash: recordHash({ result: 'abg_v4a' }), resultedAt: daysAgo(1) },
    // U&E — DKA
    { id: uid(), labTestOrderId: labOrderIds.ue_v4a, performedByLabTechId: staffIds.labTech2, resultsData: { sodium: '131 mmol/L', potassium: '5.9 mmol/L', chloride: '98 mmol/L', bicarbonate: '10 mmol/L', urea: '12.4 mmol/L', creatinine: '148 µmol/L', eGFR: '42 mL/min/1.73m²', glucose: '24.6 mmol/L' }, interpretation: 'Hyponatraemia (likely dilutional), hyperkalaemia, elevated urea and creatinine suggesting acute kidney injury superimposed on DKA. Metabolic acidosis confirmed.', abnormalFindings: 'Na low, K elevated, creatinine elevated, severe hyperglycaemia', blockchainHash: recordHash({ result: 'ue_v4a' }), resultedAt: daysAgo(1) },
    // FBC malaria
    { id: uid(), labTestOrderId: labOrderIds.fbc_v3c, performedByLabTechId: staffIds.labTech1, resultsData: { WBC: '6.8 x10⁹/L', RBC: '3.2 x10¹²/L', Hb: '8.4 g/dL', HCT: '26%', PLT: '82 x10⁹/L', MCV: '74 fL' }, interpretation: 'Mild-moderate anaemia with thrombocytopaenia — typical of uncomplicated falciparum malaria.', abnormalFindings: 'Hb low (8.4 g/dL), thrombocytopaenia (82)', referenceRanges: { Hb: '11–14 g/dL (child)', PLT: '150–400' }, blockchainHash: recordHash({ result: 'fbc_v3c' }), resultedAt: daysAgo(30) },
    // HbA1c diabetes
    { id: uid(), labTestOrderId: labOrderIds.hba1c_v4c, performedByLabTechId: staffIds.labTech1, resultsData: { HbA1c_percent: '9.2', HbA1c_mmol_mol: '77', estimated_avg_glucose: '12.6 mmol/L' }, interpretation: 'HbA1c 9.2% — above target of < 7%. Reflects poor glycaemic control over past 3 months.', abnormalFindings: 'HbA1c significantly above therapeutic target', referenceRanges: { HbA1c: '< 7.0% (diabetic target)', normal: '< 5.7%' }, blockchainHash: recordHash({ result: 'hba1c_v4c' }), resultedAt: daysAgo(14) },
]).onConflictDoNothing();

// ── 12. IMAGING ORDERS & REPORTS ──────────────────────────────────────────────

console.log('🩻  Seeding imaging orders and reports…');

const imgOrderIds = {
    cxr_v1a: uid(),
    cthead: uid(),
    echo: uid(),
};

await db.insert(imagingOrders).values([
    { id: imgOrderIds.cxr_v1a, orderNumber: 'IMG-2026-00101', visitId: visitIds.v1_active, patientId: patientIds.p1, orderedByPractitionerId: staffIds.doctor1, modality: 'x-ray', bodyPart: 'Chest (PA)', indication: 'Suspected NSTEMI — assess for pulmonary oedema and cardiac silhouette', urgency: 'emergency', status: 'reported', orderedAt: daysAgo(2), blockchainHash: recordHash({ img: 'cxr_v1a' }) },
    { id: imgOrderIds.cthead, orderNumber: 'IMG-2026-00201', visitId: visitIds.v5_active, patientId: patientIds.p5, orderedByPractitionerId: staffIds.doctor3, modality: 'ct_scan', bodyPart: 'Head (non-contrast)', indication: 'Poly-trauma — rule out intracranial haemorrhage and skull fracture', urgency: 'critical', status: 'reported', orderedAt: new Date(Date.now() - 2 * 3600000), blockchainHash: recordHash({ img: 'cthead' }) },
    { id: imgOrderIds.echo, orderNumber: 'IMG-2026-00102', visitId: visitIds.v1_active, patientId: patientIds.p1, orderedByPractitionerId: staffIds.doctor1, modality: 'ultrasound', bodyPart: 'Heart (Echocardiogram)', indication: 'Assess LV function and regional wall motion abnormalities in NSTEMI', urgency: 'urgent', status: 'ordered', orderedAt: daysAgo(1), blockchainHash: recordHash({ img: 'echo' }) },
]).onConflictDoNothing();

await db.insert(imagingReports).values([
    {
        id: uid(),
        imagingOrderId: imgOrderIds.cxr_v1a,
        performedByRadiologistId: staffIds.radiologist1,
        findings: 'Cardiomegaly with cardiothoracic ratio 0.56. Bilateral perihilar haziness and increased interstitial markings consistent with early pulmonary oedema. No pleural effusion. No pneumothorax.',
        impression: 'Cardiomegaly with early pulmonary oedema. Findings in keeping with cardiac failure secondary to ACS.',
        recommendations: 'Urgent cardiology review. Echocardiogram recommended. Repeat CXR after diuresis.',
        imageUrls: ['https://pacs.cbuh.zm/studies/CXR-2026-00101-01.dcm', 'https://pacs.cbuh.zm/studies/CXR-2026-00101-02.dcm'],
        blockchainHash: recordHash({ rpt: 'cxr_v1a' }),
        performedAt: daysAgo(2), reportedAt: daysAgo(2),
    },
    {
        id: uid(),
        imagingOrderId: imgOrderIds.cthead,
        performedByRadiologistId: staffIds.radiologist1,
        findings: 'Hyperdense collection in the right temporal region measuring 4.2 x 3.1 cm — consistent with acute epidural haematoma. Midline shift of 5mm to the left. Skull fracture right temporal bone visible on bone window.',
        impression: 'Acute right temporal epidural haematoma with 5mm midline shift and right temporal skull fracture.',
        recommendations: 'URGENT neurosurgical review. Patient requires emergency evacuation of haematoma. Transfer to neurosurgical unit immediately.',
        imageUrls: ['https://pacs.cbuh.zm/studies/CT-2026-00201-01.dcm', 'https://pacs.cbuh.zm/studies/CT-2026-00201-02.dcm', 'https://pacs.cbuh.zm/studies/CT-2026-00201-03.dcm'],
        blockchainHash: recordHash({ rpt: 'cthead' }),
        performedAt: new Date(Date.now() - 1.5 * 3600000), reportedAt: new Date(Date.now() - 1 * 3600000),
    },
]).onConflictDoNothing();

// ── 13. PRESCRIPTIONS ─────────────────────────────────────────────────────────

console.log('💊  Seeding prescriptions…');

const rxIds = { v1c: uid(), v2c: uid(), v3c: uid(), v4c: uid(), v1a: uid() };

await db.insert(prescriptions).values([
    { id: rxIds.v1c, prescriptionNumber: 'RX-2025-00101', visitId: visitIds.v1_complete, patientId: patientIds.p1, prescribedByPractitionerId: staffIds.doctor1, status: 'dispensed', blockchainHash: recordHash({ rx: rxIds.v1c }), prescribedAt: daysAgo(60) },
    { id: rxIds.v2c, prescriptionNumber: 'RX-2025-00201', visitId: visitIds.v2_complete, patientId: patientIds.p2, prescribedByPractitionerId: staffIds.doctor4, status: 'dispensed', blockchainHash: recordHash({ rx: rxIds.v2c }), prescribedAt: daysAgo(45) },
    { id: rxIds.v3c, prescriptionNumber: 'RX-2025-00301', visitId: visitIds.v3_complete, patientId: patientIds.p3, prescribedByPractitionerId: staffIds.doctor2, status: 'dispensed', blockchainHash: recordHash({ rx: rxIds.v3c }), prescribedAt: daysAgo(30) },
    { id: rxIds.v4c, prescriptionNumber: 'RX-2025-00401', visitId: visitIds.v4_complete, patientId: patientIds.p4, prescribedByPractitionerId: staffIds.doctor1, status: 'dispensed', blockchainHash: recordHash({ rx: rxIds.v4c }), prescribedAt: daysAgo(14) },
    { id: rxIds.v1a, prescriptionNumber: 'RX-2026-00101', visitId: visitIds.v1_active, patientId: patientIds.p1, prescribedByPractitionerId: staffIds.doctor1, status: 'prescribed', blockchainHash: recordHash({ rx: rxIds.v1a }), prescribedAt: daysAgo(2) },
]).onConflictDoNothing();

await db.insert(prescriptionItems).values([
    // v1 completed — hypertension
    { id: uid(), prescriptionId: rxIds.v1c, medicationName: 'Amlodipine', genericName: 'Amlodipine besylate', strength: '10mg', dosageForm: 'tablet', dose: '10mg', frequency: 'once_daily', route: 'oral', duration: '90 days', quantity: 90, instructions: 'Take in the morning. Monitor BP weekly.', refillsAllowed: 2, isDispensed: true, dispensedByPharmacistId: staffIds.pharmacist1, dispensedAt: daysAgo(60) },
    { id: uid(), prescriptionId: rxIds.v1c, medicationName: 'Enalapril', genericName: 'Enalapril maleate', strength: '10mg', dosageForm: 'tablet', dose: '10mg', frequency: 'twice_daily', route: 'oral', duration: '90 days', quantity: 180, instructions: 'Take with or without food. Avoid potassium supplements.', refillsAllowed: 2, isDispensed: true, dispensedByPharmacistId: staffIds.pharmacist1, dispensedAt: daysAgo(60) },
    // v2 completed — antenatal
    { id: uid(), prescriptionId: rxIds.v2c, medicationName: 'Ferrous Sulphate', genericName: 'Ferrous sulphate', strength: '200mg', dosageForm: 'tablet', dose: '200mg', frequency: 'twice_daily', route: 'oral', duration: '90 days', quantity: 180, instructions: 'Take with orange juice to enhance absorption. Avoid antacids.', refillsAllowed: 1, isDispensed: true, dispensedByPharmacistId: staffIds.pharmacist2, dispensedAt: daysAgo(45) },
    { id: uid(), prescriptionId: rxIds.v2c, medicationName: 'Folic Acid', genericName: 'Folic acid', strength: '5mg', dosageForm: 'tablet', dose: '5mg', frequency: 'once_daily', route: 'oral', duration: '90 days', quantity: 90, instructions: 'Take daily throughout pregnancy.', refillsAllowed: 1, isDispensed: true, dispensedByPharmacistId: staffIds.pharmacist2, dispensedAt: daysAgo(45) },
    // v3 completed — malaria
    { id: uid(), prescriptionId: rxIds.v3c, medicationName: 'Artemether-Lumefantrine (Coartem)', genericName: 'Artemether/Lumefantrine', strength: '20/120mg', dosageForm: 'tablet', dose: '3 tablets', frequency: 'twice_daily', route: 'oral', duration: '3 days', quantity: 18, instructions: 'Take with food or milk. Complete the full course.', refillsAllowed: 0, isDispensed: true, dispensedByPharmacistId: staffIds.pharmacist1, dispensedAt: daysAgo(30) },
    { id: uid(), prescriptionId: rxIds.v3c, medicationName: 'Paracetamol', genericName: 'Paracetamol (Acetaminophen)', strength: '250mg', dosageForm: 'syrup', dose: '250mg (10mL)', frequency: 'four_times_daily', route: 'oral', duration: '3 days', quantity: 1, instructions: 'Shake before use. Give for fever > 38°C. Max 4 doses/day.', refillsAllowed: 0, isDispensed: true, dispensedByPharmacistId: staffIds.pharmacist1, dispensedAt: daysAgo(30) },
    // v4 completed — diabetes
    { id: uid(), prescriptionId: rxIds.v4c, medicationName: 'Metformin', genericName: 'Metformin hydrochloride', strength: '1000mg', dosageForm: 'tablet', dose: '1g', frequency: 'twice_daily', route: 'oral', duration: '90 days', quantity: 180, instructions: 'Take with meals to reduce GI side effects. Do not crush.', refillsAllowed: 2, isDispensed: true, dispensedByPharmacistId: staffIds.pharmacist2, dispensedAt: daysAgo(14) },
    { id: uid(), prescriptionId: rxIds.v4c, medicationName: 'Glibenclamide', genericName: 'Glibenclamide', strength: '5mg', dosageForm: 'tablet', dose: '5mg', frequency: 'once_daily', route: 'oral', duration: '90 days', quantity: 90, instructions: 'Take 30 minutes before breakfast. Monitor for hypoglycaemia.', refillsAllowed: 2, isDispensed: true, dispensedByPharmacistId: staffIds.pharmacist2, dispensedAt: daysAgo(14) },
    // v1 active — NSTEMI
    { id: uid(), prescriptionId: rxIds.v1a, medicationName: 'Aspirin', genericName: 'Acetylsalicylic acid', strength: '300mg', dosageForm: 'tablet', dose: '300mg', frequency: 'stat', route: 'oral', duration: '1 dose stat then 100mg OD', quantity: 1, instructions: 'Loading dose — give immediately. Continue 100mg OD thereafter.', refillsAllowed: 0, isDispensed: false },
    { id: uid(), prescriptionId: rxIds.v1a, medicationName: 'Clopidogrel', genericName: 'Clopidogrel bisulphate', strength: '75mg', dosageForm: 'tablet', dose: '300mg (loading)', frequency: 'stat', route: 'oral', duration: '1 dose stat then 75mg OD', quantity: 4, instructions: 'Loading dose 4 tablets (300mg) stat. Then 1 tablet (75mg) OD.', refillsAllowed: 0, isDispensed: false },
    { id: uid(), prescriptionId: rxIds.v1a, medicationName: 'Enoxaparin', genericName: 'Enoxaparin sodium', strength: '60mg/0.6mL', dosageForm: 'injection', dose: '1mg/kg', frequency: 'twice_daily', route: 'subcutaneous', duration: '5 days', quantity: 10, instructions: 'Weight-based dosing. Rotate injection sites. Monitor platelets.', refillsAllowed: 0, isDispensed: false },
    { id: uid(), prescriptionId: rxIds.v1a, medicationName: 'GTN (Glyceryl Trinitrate)', genericName: 'Glyceryl trinitrate', strength: '50mg/50mL', dosageForm: 'injection', dose: '10-200 mcg/min IV infusion', frequency: 'as_needed', route: 'intravenous', duration: 'Until chest pain resolves', quantity: 3, instructions: 'Titrate to pain relief and BP > 90 mmHg systolic. Monitor BP every 5 minutes.', refillsAllowed: 0, isDispensed: false },
]).onConflictDoNothing();

// ── 14. ALLERGIES ─────────────────────────────────────────────────────────────

console.log('⚠️  Seeding allergies…');

await db.insert(allergies).values([
    { id: uid(), patientId: patientIds.p1, allergen: 'Penicillin', allergyType: 'drug', severity: 'moderate', reaction: 'Generalised urticaria and facial angioedema within 30 minutes of dose', onsetDate: '2015-03-12', notes: 'Documented allergy — avoid all beta-lactam antibiotics', recordedByPractitionerId: staffIds.doctor1, isActive: true, blockchainHash: recordHash({ allergy: 'p1_pen' }) },
    { id: uid(), patientId: patientIds.p2, allergen: 'Sulphonamides (Septrin)', allergyType: 'drug', severity: 'severe', reaction: 'Stevens-Johnson syndrome — hospitalised for 2 weeks', onsetDate: '2019-08-05', notes: 'Life-threatening reaction. Absolute contraindication. Alert on notes.', recordedByPractitionerId: staffIds.doctor4, isActive: true, blockchainHash: recordHash({ allergy: 'p2_sulf' }) },
    { id: uid(), patientId: patientIds.p3, allergen: 'Groundnuts (Peanuts)', allergyType: 'food', severity: 'severe', reaction: 'Anaphylaxis — received adrenaline in 2022', onsetDate: '2022-06-20', notes: 'Carries EpiPen. Parents aware. School notified.', isActive: true, blockchainHash: recordHash({ allergy: 'p3_nut' }) },
    { id: uid(), patientId: patientIds.p4, allergen: 'ACE Inhibitors (Enalapril)', allergyType: 'drug', severity: 'moderate', reaction: 'Persistent dry cough requiring discontinuation', onsetDate: '2020-11-02', notes: 'Substitute with ARB if needed', recordedByPractitionerId: staffIds.doctor1, isActive: true, blockchainHash: recordHash({ allergy: 'p4_ace' }) },
]).onConflictDoNothing();

// ── 15. MEDICAL HISTORY ───────────────────────────────────────────────────────

console.log('📚  Seeding medical history…');

await db.insert(medicalHistory).values([
    { id: uid(), patientId: patientIds.p1, condition: 'Essential Hypertension', diagnosedDate: '2019-06-15', status: 'active', notes: 'Currently on Amlodipine 10mg and Enalapril 10mg BD', recordedByPractitionerId: staffIds.doctor1, blockchainHash: recordHash({ mh: 'p1_htn' }) },
    { id: uid(), patientId: patientIds.p1, condition: 'Hyperlipidaemia', diagnosedDate: '2021-02-20', status: 'active', notes: 'Diet-controlled. Lipid profile repeat due.', recordedByPractitionerId: staffIds.doctor1, blockchainHash: recordHash({ mh: 'p1_lipid' }) },
    { id: uid(), patientId: patientIds.p2, condition: 'G1P0 — First Pregnancy', diagnosedDate: '2024-09-01', status: 'active', notes: 'LMP 01/09/2024. EDD 08/06/2025. Currently 28 weeks. Normal pregnancy so far.', recordedByPractitionerId: staffIds.doctor4, blockchainHash: recordHash({ mh: 'p2_preg' }) },
    { id: uid(), patientId: patientIds.p3, condition: 'Peanut Allergy (Anaphylaxis history)', diagnosedDate: '2022-06-20', status: 'active', notes: 'Anaphylaxis 2022, now carries EpiPen', blockchainHash: recordHash({ mh: 'p3_allergy' }) },
    { id: uid(), patientId: patientIds.p4, condition: 'Type 2 Diabetes Mellitus', diagnosedDate: '2015-04-10', status: 'active', notes: 'On Metformin 1g BD and Glibenclamide 5mg OD. HbA1c 9.2% (poorly controlled)', recordedByPractitionerId: staffIds.doctor1, blockchainHash: recordHash({ mh: 'p4_dm' }) },
    { id: uid(), patientId: patientIds.p4, condition: 'Hypertension', diagnosedDate: '2018-07-14', status: 'active', notes: 'Currently not on specific antihypertensives — managed via diabetes treatment', recordedByPractitionerId: staffIds.doctor1, blockchainHash: recordHash({ mh: 'p4_htn' }) },
    { id: uid(), patientId: patientIds.p4, condition: 'Obesity (BMI 35.2)', diagnosedDate: '2020-01-01', status: 'active', notes: 'Dietary and exercise counselling ongoing', recordedByPractitionerId: staffIds.doctor1, blockchainHash: recordHash({ mh: 'p4_ob' }) },
]).onConflictDoNothing();

// ── 16. ACCESS PERMISSIONS ────────────────────────────────────────────────────

console.log('🔐  Seeding access permissions…');

// doctor1 has standing permission for p1 and p4 (existing patients)
await db.insert(accessPermissions).values([
    {
        id: uid(),
        patientId: patientIds.p1,
        grantedToUserId: staffIds.doctor1,
        grantedToUserType: 'practitioner',
        permissionType: 'write',
        allowedRecordTypes: ['all'],
        grantedAt: daysAgo(180),
        expiresAt: new Date(Date.now() + 180 * 86400000),
        blockchainTransactionId: txId(),
        isActive: true,
    },
    {
        id: uid(),
        patientId: patientIds.p4,
        grantedToUserId: staffIds.doctor1,
        grantedToUserType: 'practitioner',
        permissionType: 'write',
        allowedRecordTypes: ['all'],
        grantedAt: daysAgo(365),
        expiresAt: new Date(Date.now() + 180 * 86400000),
        blockchainTransactionId: txId(),
        isActive: true,
    },
    // nurse1 has visit-scoped permission for p1 active visit
    {
        id: uid(),
        patientId: patientIds.p1,
        grantedToUserId: staffIds.nurse1,
        grantedToUserType: 'nurse',
        permissionType: 'write',
        allowedRecordTypes: ['vital_signs', 'nursing_assessment'],
        visitId: visitIds.v1_active,
        grantedAt: daysAgo(2),
        expiresAt: new Date(Date.now() + 1 * 86400000),
        blockchainTransactionId: txId(),
        isActive: true,
    },
]).onConflictDoNothing();

// ── 17. ACCESS REQUESTS ───────────────────────────────────────────────────────

console.log('📨  Seeding access requests…');

await db.insert(accessRequests).values([
    // Nurse2 requesting access for p3 (paediatric active-ish visit via completed)
    {
        id: uid(),
        requestedByUserId: staffIds.nurse2,
        requestedByUserType: 'nurse',
        patientId: patientIds.p3,
        visitId: visitIds.v3_complete,
        requestedPermissions: ['vital_signs', 'nursing_assessment'],
        reason: 'Follow-up nursing assessment required for malaria recovery check. Need to record updated vitals and confirm child is recovering well.',
        status: 'approved',
        createdAt: daysAgo(29),
        respondedAt: daysAgo(29),
        expiresAt: daysAgo(27),
    },
    // lab tech requesting access for p5 trauma
    {
        id: uid(),
        requestedByUserId: staffIds.labTech1,
        requestedByUserType: 'lab_technician',
        patientId: patientIds.p5,
        visitId: visitIds.v5_active,
        requestedPermissions: ['lab_order', 'lab_result'],
        reason: 'Emergency trauma labs ordered by Dr Chipimo — FBC, UE, coagulation screen, blood group and cross-match urgently required.',
        status: 'pending',
        createdAt: new Date(Date.now() - 90 * 60000), // 90 minutes ago
        expiresAt: new Date(Date.now() + 46.5 * 3600000),
    },
    // pharmacist requesting access for p4 active visit prescriptions
    {
        id: uid(),
        requestedByUserId: staffIds.pharmacist1,
        requestedByUserType: 'pharmacist',
        patientId: patientIds.p4,
        visitId: visitIds.v4_active,
        requestedPermissions: ['prescription', 'prescription_dispense'],
        reason: 'Insulin and IV fluid orders need pharmacy verification and preparation for DKA management protocol.',
        status: 'pending',
        createdAt: new Date(Date.now() - 45 * 60000), // 45 minutes ago
        expiresAt: new Date(Date.now() + 47.25 * 3600000),
    },
    // Rejected request — example
    {
        id: uid(),
        requestedByUserId: staffIds.doctor3,
        requestedByUserType: 'practitioner',
        patientId: patientIds.p2,
        visitId: visitIds.v2_complete,
        requestedPermissions: ['consultation', 'diagnosis'],
        reason: 'Surgical consultation requested for evaluation of abdominal discomfort reported at antenatal visit.',
        status: 'rejected',
        createdAt: daysAgo(44),
        respondedAt: daysAgo(44),
        expiresAt: daysAgo(42),
        responseNote: 'Patient declined surgical review. Will discuss with primary OB at next visit.',
    },
]).onConflictDoNothing();

// ── 18. AUDIT LOGS ────────────────────────────────────────────────────────────

console.log('📋  Seeding audit logs…');

const auditEntries = [
    // Patient registrations
    { userId: staffIds.receptionist1, userType: 'receptionist', patientId: patientIds.p1, actionType: 'create', resourceType: 'patient', resourceId: patientIds.p1, timestamp: daysAgo(60) },
    { userId: staffIds.receptionist1, userType: 'receptionist', patientId: patientIds.p2, actionType: 'create', resourceType: 'patient', resourceId: patientIds.p2, timestamp: daysAgo(45) },
    // Visit creations
    { userId: staffIds.receptionist1, userType: 'receptionist', patientId: patientIds.p1, actionType: 'create', resourceType: 'visit', resourceId: visitIds.v1_active, timestamp: daysAgo(2) },
    { userId: staffIds.receptionist2, userType: 'receptionist', patientId: patientIds.p4, actionType: 'create', resourceType: 'visit', resourceId: visitIds.v4_active, timestamp: daysAgo(1) },
    { userId: staffIds.receptionist2, userType: 'receptionist', patientId: patientIds.p5, actionType: 'create', resourceType: 'visit', resourceId: visitIds.v5_active, timestamp: new Date(Date.now() - 3.1 * 3600000) },
    // Nurse vitals recording
    { userId: staffIds.nurse1, userType: 'nurse', patientId: patientIds.p1, actionType: 'create', resourceType: 'vital_signs', resourceId: vitalIds.v1a, timestamp: daysAgo(2) },
    { userId: staffIds.nurse1, userType: 'nurse', patientId: patientIds.p4, actionType: 'create', resourceType: 'vital_signs', resourceId: vitalIds.v4a, timestamp: daysAgo(1) },
    { userId: staffIds.nurse3, userType: 'nurse', patientId: patientIds.p5, actionType: 'create', resourceType: 'vital_signs', resourceId: vitalIds.v5a, timestamp: new Date(Date.now() - 2.5 * 3600000) },
    // Doctor consultations
    { userId: staffIds.doctor1, userType: 'practitioner', patientId: patientIds.p1, actionType: 'create', resourceType: 'consultation', resourceId: consultIds.v1a, timestamp: daysAgo(2) },
    { userId: staffIds.doctor1, userType: 'practitioner', patientId: patientIds.p4, actionType: 'create', resourceType: 'consultation', resourceId: consultIds.v4a, timestamp: daysAgo(1) },
    // Lab results
    { userId: staffIds.labTech1, userType: 'lab_technician', patientId: patientIds.p1, actionType: 'create', resourceType: 'lab_result', resourceId: labOrderIds.troponin, timestamp: daysAgo(2) },
    { userId: staffIds.labTech2, userType: 'lab_technician', patientId: patientIds.p4, actionType: 'create', resourceType: 'lab_result', resourceId: labOrderIds.abg_v4a, timestamp: daysAgo(1) },
    // Permission grants
    { userId: patientIds.p1, userType: 'patient', patientId: patientIds.p1, actionType: 'permission_grant', resourceType: 'access_permission', resourceId: staffIds.nurse1, timestamp: daysAgo(2) },
    // Record views
    { userId: staffIds.doctor1, userType: 'practitioner', patientId: patientIds.p1, actionType: 'view', resourceType: 'visit_summary', resourceId: visitIds.v1_active, timestamp: daysAgo(1) },
    { userId: staffIds.doctor1, userType: 'practitioner', patientId: patientIds.p4, actionType: 'view', resourceType: 'visit_summary', resourceId: visitIds.v4_active, timestamp: daysAgo(1) },
];

await db.insert(auditLogs).values(
    auditEntries.map(e => ({
        id: uid(),
        userId: e.userId,
        userType: e.userType as any,
        patientId: e.patientId,
        actionType: e.actionType as any,
        resourceType: e.resourceType,
        resourceId: e.resourceId as any,
        timestamp: e.timestamp,
        blockchainTransactionId: txId(),
        isEmergencyOverride: false,
        createdAt: e.timestamp,
    }))
).onConflictDoNothing();

// ── Done ──────────────────────────────────────────────────────────────────────

console.log('\n✅  Seed complete!\n');
console.log('═══════════════════════════════════════════════════════════════');
console.log('  LOGIN CREDENTIALS (all passwords: Password123!)');
console.log('═══════════════════════════════════════════════════════════════');
console.log('\n  STAFF (login with licenseNumber):');
console.log('  ├─ Admin          ADMIN-2024-001   Chanda Mwape');
console.log('  ├─ Receptionist   REC-2024-001     Namukolo Sichone');
console.log('  ├─ Receptionist   REC-2024-002     Bwalya Tembo');
console.log('  ├─ Nurse          NUR-2024-001     Mutinta Banda');
console.log('  ├─ Nurse          NUR-2024-002     Chilufya Mulenga');
console.log('  ├─ Nurse          NUR-2024-003     Kalinda Phiri');
console.log('  ├─ Doctor (IM)    DOC-2024-001     Mubanga Kasonde');
console.log('  ├─ Doctor (Paed)  DOC-2024-002     Nchimunya Mwanza');
console.log('  ├─ Doctor (Surg)  DOC-2024-003     Kangwa Chipimo');
console.log('  ├─ Doctor (OBG)   DOC-2024-004     Nkandu Luo');
console.log('  ├─ Lab Tech       LAB-2024-001     Mwila Kapasa');
console.log('  ├─ Lab Tech       LAB-2024-002     Precious Ng\'ona');
console.log('  ├─ Radiologist    RAD-2024-001     Chisomo Zimba');
console.log('  ├─ Pharmacist     PHAR-2024-001    Mwansa Kabwe');
console.log('  └─ Pharmacist     PHAR-2024-002    Taonga Mbewe');
console.log('\n  PATIENTS (login with nationalId):');
console.log('  ├─ 123456/78/1    Fredrick Musonda   (active: NSTEMI admission)');
console.log('  ├─ 234567/89/1    Chipo Nkuwa        (28wk pregnancy)');
console.log('  ├─ 345678/90/1    Liam Lungu         (paediatric, 8yrs)');
console.log('  ├─ 456789/01/1    Agnes Sakala       (active: DKA admission)');
console.log('  └─ 567890/12/1    Kalunga Mumba      (active: trauma/emergency)');
console.log('\n  ACTIVE VISITS:');
console.log('  ├─ VIS-2026-BB001  Fredrick Musonda   NSTEMI (emergency)');
console.log('  ├─ VIS-2026-BB002  Agnes Sakala       DKA (urgent)');
console.log('  └─ VIS-2026-BB003  Kalunga Mumba      Poly-trauma (critical)');
console.log('═══════════════════════════════════════════════════════════════\n');