import { hash } from 'bcryptjs';
import crypto from 'crypto';
import { eq, inArray, sql, and } from 'drizzle-orm';
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
    medicationStock, stockMovements,
    referrals,
} from './schema';

// ── Helpers ──────────────────────────────────────────────────────────────────

const uid = () => crypto.randomUUID();
const addr = () => `0x${crypto.randomBytes(20).toString('hex')}`;
const txId = () => crypto.randomBytes(16).toString('hex');
const daysAgo = (d: number) => new Date(Date.now() - d * 86400000);
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600000);
const daysFromNow = (d: number) => new Date(Date.now() + d * 86400000);
const hoursFromNow = (h: number) => new Date(Date.now() + h * 3600000);

const run = async () => {
    const PASSWORD_HASH = await hash('Password123!', 12);
    const SUPER_ADMIN_HASH = await hash('SuperAdmin@123', 12);

    const recordHash = (data: object) =>
        crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');

    console.log('\n🌱 HealthChain Master Seed Starting...\n');

    // ── 0. SUPER ADMIN ───────────────────────────────────────────────────────────

    console.log('👑  Seeding super admin…');

    await db.insert(practitioners).values({
        blockchainAddress: addr(),
        firstNameEncrypted: encrypt('Super'),
        lastNameEncrypted: encrypt('Admin'),
        licenseNumber: 'SUPER-ADMIN-001',
        institutionalId: 'SUPER-ADMIN-001',
        institutionId: null,
        role: 'admin',
        specialization: 'System Administrator',
        phoneNumberEncrypted: encrypt('+260000000000'),
        emailEncrypted: encrypt('superadmin@healthchain.zm'),
        passwordHash: SUPER_ADMIN_HASH,
        mustChangePassword: false,
        isVerified: true,
        isActive: true,
    }).onConflictDoNothing();

    // ── 1. INSTITUTIONS ──────────────────────────────────────────────────────────

    console.log('🏥  Seeding institutions…');

    const cbuhId = uid();
    const ndolaId = uid();
    const kitweId = uid();

    await db.insert(institutions).values([
        { id: cbuhId, institutionCode: 'CBUH-001', institutionName: 'Copperbelt University Teaching Hospital', institutionType: 'teaching_hospital', blockchainAddress: addr(), addressEncrypted: encrypt('Jambo Drive, Kitwe, Copperbelt Province, Zambia'), phoneEncrypted: encrypt('+260212345678'), emailEncrypted: encrypt('info@cbuh.zm'), licenseNumber: 'ZMH-2024-001', accreditationStatus: 'accredited', accreditationExpiry: '2027-12-31', bedCapacity: 850, specialties: ['Cardiology', 'Neurology', 'Oncology', 'Orthopaedics', 'Paediatrics', 'Obstetrics'], services: ['Emergency', 'ICU', 'Laboratory', 'Radiology', 'Pharmacy', 'Physiotherapy'], isActive: true },
        { id: ndolaId, institutionCode: 'NCH-001', institutionName: 'Ndola Central Hospital', institutionType: 'central_hospital', blockchainAddress: addr(), addressEncrypted: encrypt('Broadway Avenue, Ndola, Copperbelt Province, Zambia'), phoneEncrypted: encrypt('+260212456789'), emailEncrypted: encrypt('admin@ndolahospital.zm'), licenseNumber: 'ZMH-2024-002', accreditationStatus: 'accredited', accreditationExpiry: '2026-06-30', bedCapacity: 600, specialties: ['General Surgery', 'Internal Medicine', 'Paediatrics', 'Gynaecology'], services: ['Emergency', 'Laboratory', 'Radiology', 'Pharmacy'], isActive: true },
        { id: kitweId, institutionCode: 'KCH-001', institutionName: 'Kitwe Central Hospital', institutionType: 'central_hospital', blockchainAddress: addr(), addressEncrypted: encrypt('Kantanshi Road, Kitwe, Copperbelt Province, Zambia'), phoneEncrypted: encrypt('+260212567890'), emailEncrypted: encrypt('admin@kitwehospital.zm'), licenseNumber: 'ZMH-2024-003', accreditationStatus: 'accredited', accreditationExpiry: '2026-12-31', bedCapacity: 500, specialties: ['Internal Medicine', 'Paediatrics', 'Obstetrics', 'Surgery'], services: ['Emergency', 'Laboratory', 'Pharmacy'], isActive: true },
    ]).onConflictDoNothing();

    // ── 2. DEPARTMENTS ───────────────────────────────────────────────────────────

    console.log('🏢  Seeding departments…');

    const dept = {
        cbuhEmerg: uid(), cbuhIM: uid(), cbuhPaed: uid(), cbuhSurg: uid(),
        cbuhObs: uid(), cbuhLab: uid(), cbuhRad: uid(), cbuhPharm: uid(), cbuhOPD: uid(),
        ndolaIM: uid(), ndolaLab: uid(), ndolaPharm: uid(), ndolaEmerg: uid(), ndolaOPD: uid(),
    };

    await db.insert(departments).values([
        { id: dept.cbuhEmerg, institutionId: cbuhId, departmentCode: 'ED', departmentName: 'Emergency Department', departmentType: 'clinical', location: 'Ground Floor, Block A', phone: '+260212345679', isActive: true },
        { id: dept.cbuhIM, institutionId: cbuhId, departmentCode: 'IM', departmentName: 'Internal Medicine', departmentType: 'clinical', location: 'Floor 2, Block B', phone: '+260212345680', isActive: true },
        { id: dept.cbuhPaed, institutionId: cbuhId, departmentCode: 'PAED', departmentName: 'Paediatrics', departmentType: 'clinical', location: 'Floor 3, Block B', phone: '+260212345681', isActive: true },
        { id: dept.cbuhSurg, institutionId: cbuhId, departmentCode: 'SURG', departmentName: 'General Surgery', departmentType: 'clinical', location: 'Floor 1, Block C', phone: '+260212345682', isActive: true },
        { id: dept.cbuhObs, institutionId: cbuhId, departmentCode: 'OBS', departmentName: 'Obstetrics & Gynaecology', departmentType: 'clinical', location: 'Floor 4, Block B', phone: '+260212345683', isActive: true },
        { id: dept.cbuhLab, institutionId: cbuhId, departmentCode: 'LAB', departmentName: 'Clinical Laboratory', departmentType: 'diagnostic', location: 'Ground Floor, Block D', phone: '+260212345684', isActive: true },
        { id: dept.cbuhRad, institutionId: cbuhId, departmentCode: 'RAD', departmentName: 'Radiology & Imaging', departmentType: 'diagnostic', location: 'Ground Floor, Block D', phone: '+260212345685', isActive: true },
        { id: dept.cbuhPharm, institutionId: cbuhId, departmentCode: 'PHAR', departmentName: 'Pharmacy', departmentType: 'support', location: 'Ground Floor, Block E', phone: '+260212345686', isActive: true },
        { id: dept.cbuhOPD, institutionId: cbuhId, departmentCode: 'OPD', departmentName: 'Outpatient Department', departmentType: 'clinical', location: 'Ground Floor, Block A', phone: '+260212345687', isActive: true },
        { id: dept.ndolaIM, institutionId: ndolaId, departmentCode: 'IM', departmentName: 'Internal Medicine', departmentType: 'clinical', location: 'Floor 1, Block A', phone: '+260212456790', isActive: true },
        { id: dept.ndolaLab, institutionId: ndolaId, departmentCode: 'LAB', departmentName: 'Clinical Laboratory', departmentType: 'diagnostic', location: 'Ground Floor', phone: '+260212456791', isActive: true },
        { id: dept.ndolaPharm, institutionId: ndolaId, departmentCode: 'PHAR', departmentName: 'Pharmacy', departmentType: 'support', location: 'Ground Floor', phone: '+260212456792', isActive: true },
        { id: dept.ndolaEmerg, institutionId: ndolaId, departmentCode: 'ED', departmentName: 'Emergency Department', departmentType: 'clinical', location: 'Ground Floor', phone: '+260212456793', isActive: true },
        { id: dept.ndolaOPD, institutionId: ndolaId, departmentCode: 'OPD', departmentName: 'Outpatient Department', departmentType: 'clinical', location: 'Ground Floor', phone: '+260212456794', isActive: true },
    ]).onConflictDoNothing();

    // ── 3. WARDS ─────────────────────────────────────────────────────────────────

    console.log('🛏️  Seeding wards…');

    const ward = {
        cbuhMale: uid(), cbuhFemale: uid(), cbuhPaed: uid(),
        cbuhMat: uid(), cbuhIcu: uid(), cbuhSurg: uid(),
        ndolaMale: uid(),
    };

    await db.insert(wards).values([
        { id: ward.cbuhMale, departmentId: dept.cbuhIM, institutionId: cbuhId, wardCode: 'WARD-M1', wardName: 'Male General Ward', wardType: 'general', bedCount: 40, availableBeds: 12, isActive: true },
        { id: ward.cbuhFemale, departmentId: dept.cbuhIM, institutionId: cbuhId, wardCode: 'WARD-F1', wardName: 'Female General Ward', wardType: 'general', bedCount: 40, availableBeds: 8, isActive: true },
        { id: ward.cbuhPaed, departmentId: dept.cbuhPaed, institutionId: cbuhId, wardCode: 'WARD-P1', wardName: 'Paediatric Ward', wardType: 'paediatric', bedCount: 30, availableBeds: 15, isActive: true },
        { id: ward.cbuhMat, departmentId: dept.cbuhObs, institutionId: cbuhId, wardCode: 'WARD-MAT', wardName: 'Maternity Ward', wardType: 'maternity', bedCount: 25, availableBeds: 6, isActive: true },
        { id: ward.cbuhIcu, departmentId: dept.cbuhEmerg, institutionId: cbuhId, wardCode: 'WARD-ICU', wardName: 'Intensive Care Unit', wardType: 'icu', bedCount: 10, availableBeds: 3, isActive: true },
        { id: ward.cbuhSurg, departmentId: dept.cbuhSurg, institutionId: cbuhId, wardCode: 'WARD-S1', wardName: 'Surgical Ward', wardType: 'surgical', bedCount: 30, availableBeds: 10, isActive: true },
        { id: ward.ndolaMale, departmentId: dept.ndolaIM, institutionId: ndolaId, wardCode: 'NCH-M1', wardName: 'Male General Ward', wardType: 'general', bedCount: 30, availableBeds: 8, isActive: true },
    ]).onConflictDoNothing();

    // ── 4. PRACTITIONERS ─────────────────────────────────────────────────────────

    console.log('👨‍⚕️  Seeding practitioners (CBUH + Ndola)…');

    await db.insert(practitioners).values([
        // CBUH
        { blockchainAddress: addr(), institutionId: cbuhId, firstNameEncrypted: encrypt('Chanda'), lastNameEncrypted: encrypt('Mwape'), licenseNumber: 'ADMIN-2024-001', institutionalId: 'CBUH-ADMIN-001', role: 'admin', specialization: 'Hospital Administration', department: 'Administration', phoneNumberEncrypted: encrypt('+260971000001'), emailEncrypted: encrypt('c.mwape@cbuh.zm'), passwordHash: PASSWORD_HASH, isVerified: true, isActive: true, mustChangePassword: false },
        { blockchainAddress: addr(), institutionId: cbuhId, firstNameEncrypted: encrypt('Namukolo'), lastNameEncrypted: encrypt('Sichone'), licenseNumber: 'REC-2024-001', institutionalId: 'CBUH-REC-001', role: 'receptionist', department: 'Outpatient Department', phoneNumberEncrypted: encrypt('+260971000002'), emailEncrypted: encrypt('n.sichone@cbuh.zm'), passwordHash: PASSWORD_HASH, isVerified: true, isActive: true, mustChangePassword: false },
        { blockchainAddress: addr(), institutionId: cbuhId, firstNameEncrypted: encrypt('Bwalya'), lastNameEncrypted: encrypt('Tembo'), licenseNumber: 'REC-2024-002', institutionalId: 'CBUH-REC-002', role: 'receptionist', department: 'Emergency Department', phoneNumberEncrypted: encrypt('+260971000003'), emailEncrypted: encrypt('b.tembo@cbuh.zm'), passwordHash: PASSWORD_HASH, isVerified: true, isActive: true, mustChangePassword: false },
        { blockchainAddress: addr(), institutionId: cbuhId, firstNameEncrypted: encrypt('Mutinta'), lastNameEncrypted: encrypt('Banda'), licenseNumber: 'NUR-2024-001', institutionalId: 'CBUH-NUR-001', role: 'nurse', department: 'Internal Medicine', phoneNumberEncrypted: encrypt('+260971000004'), emailEncrypted: encrypt('m.banda@cbuh.zm'), passwordHash: PASSWORD_HASH, isVerified: true, isActive: true, mustChangePassword: false },
        { blockchainAddress: addr(), institutionId: cbuhId, firstNameEncrypted: encrypt('Chilufya'), lastNameEncrypted: encrypt('Mulenga'), licenseNumber: 'NUR-2024-002', institutionalId: 'CBUH-NUR-002', role: 'nurse', department: 'Paediatrics', phoneNumberEncrypted: encrypt('+260971000005'), emailEncrypted: encrypt('c.mulenga@cbuh.zm'), passwordHash: PASSWORD_HASH, isVerified: true, isActive: true, mustChangePassword: false },
        { blockchainAddress: addr(), institutionId: cbuhId, firstNameEncrypted: encrypt('Kalinda'), lastNameEncrypted: encrypt('Phiri'), licenseNumber: 'NUR-2024-003', institutionalId: 'CBUH-NUR-003', role: 'nurse', department: 'Emergency Department', phoneNumberEncrypted: encrypt('+260971000006'), emailEncrypted: encrypt('k.phiri@cbuh.zm'), passwordHash: PASSWORD_HASH, isVerified: true, isActive: true, mustChangePassword: false },
        { blockchainAddress: addr(), institutionId: cbuhId, firstNameEncrypted: encrypt('Mubanga'), lastNameEncrypted: encrypt('Kasonde'), licenseNumber: 'DOC-2024-001', institutionalId: 'CBUH-DOC-001', role: 'practitioner', specialization: 'Internal Medicine', department: 'Internal Medicine', phoneNumberEncrypted: encrypt('+260971000007'), emailEncrypted: encrypt('m.kasonde@cbuh.zm'), passwordHash: PASSWORD_HASH, isVerified: true, isActive: true, mustChangePassword: false, qualifications: 'MBChB, MMed (Internal Medicine)' },
        { blockchainAddress: addr(), institutionId: cbuhId, firstNameEncrypted: encrypt('Nchimunya'), lastNameEncrypted: encrypt('Mwanza'), licenseNumber: 'DOC-2024-002', institutionalId: 'CBUH-DOC-002', role: 'practitioner', specialization: 'Paediatrics', department: 'Paediatrics', phoneNumberEncrypted: encrypt('+260971000008'), emailEncrypted: encrypt('n.mwanza@cbuh.zm'), passwordHash: PASSWORD_HASH, isVerified: true, isActive: true, mustChangePassword: false, qualifications: 'MBChB, DCH, MMed (Paediatrics)' },
        { blockchainAddress: addr(), institutionId: cbuhId, firstNameEncrypted: encrypt('Kangwa'), lastNameEncrypted: encrypt('Chipimo'), licenseNumber: 'DOC-2024-003', institutionalId: 'CBUH-DOC-003', role: 'practitioner', specialization: 'General Surgery', department: 'Surgery', phoneNumberEncrypted: encrypt('+260971000009'), emailEncrypted: encrypt('k.chipimo@cbuh.zm'), passwordHash: PASSWORD_HASH, isVerified: true, isActive: true, mustChangePassword: false, qualifications: 'MBChB, FCS (ECSA)' },
        { blockchainAddress: addr(), institutionId: cbuhId, firstNameEncrypted: encrypt('Nkandu'), lastNameEncrypted: encrypt('Luo'), licenseNumber: 'DOC-2024-004', institutionalId: 'CBUH-DOC-004', role: 'practitioner', specialization: 'Obstetrics & Gynaecology', department: 'Obstetrics & Gynaecology', phoneNumberEncrypted: encrypt('+260971000010'), emailEncrypted: encrypt('n.luo@cbuh.zm'), passwordHash: PASSWORD_HASH, isVerified: true, isActive: true, mustChangePassword: false, qualifications: 'MBChB, MMed (OBS/GYN)' },
        { blockchainAddress: addr(), institutionId: cbuhId, firstNameEncrypted: encrypt('Mwila'), lastNameEncrypted: encrypt('Kapasa'), licenseNumber: 'LAB-2024-001', institutionalId: 'CBUH-LAB-001', role: 'lab_technician', department: 'Clinical Laboratory', phoneNumberEncrypted: encrypt('+260971000011'), emailEncrypted: encrypt('m.kapasa@cbuh.zm'), passwordHash: PASSWORD_HASH, isVerified: true, isActive: true, mustChangePassword: false, qualifications: 'BSc Medical Laboratory Sciences' },
        { blockchainAddress: addr(), institutionId: cbuhId, firstNameEncrypted: encrypt('Precious'), lastNameEncrypted: encrypt("Ng'ona"), licenseNumber: 'LAB-2024-002', institutionalId: 'CBUH-LAB-002', role: 'lab_technician', department: 'Clinical Laboratory', phoneNumberEncrypted: encrypt('+260971000012'), emailEncrypted: encrypt('p.ngona@cbuh.zm'), passwordHash: PASSWORD_HASH, isVerified: true, isActive: true, mustChangePassword: false, qualifications: 'BSc Medical Laboratory Sciences' },
        { blockchainAddress: addr(), institutionId: cbuhId, firstNameEncrypted: encrypt('Chisomo'), lastNameEncrypted: encrypt('Zimba'), licenseNumber: 'RAD-2024-001', institutionalId: 'CBUH-RAD-001', role: 'radiologist', department: 'Radiology & Imaging', phoneNumberEncrypted: encrypt('+260971000013'), emailEncrypted: encrypt('c.zimba@cbuh.zm'), passwordHash: PASSWORD_HASH, isVerified: true, isActive: true, mustChangePassword: false, qualifications: 'MBChB, MMed (Radiology)' },
        { blockchainAddress: addr(), institutionId: cbuhId, firstNameEncrypted: encrypt('Mwansa'), lastNameEncrypted: encrypt('Kabwe'), licenseNumber: 'PHAR-2024-001', institutionalId: 'CBUH-PHAR-001', role: 'pharmacist', department: 'Pharmacy', phoneNumberEncrypted: encrypt('+260971000014'), emailEncrypted: encrypt('m.kabwe@cbuh.zm'), passwordHash: PASSWORD_HASH, isVerified: true, isActive: true, mustChangePassword: false, qualifications: 'BPharm' },
        { blockchainAddress: addr(), institutionId: cbuhId, firstNameEncrypted: encrypt('Taonga'), lastNameEncrypted: encrypt('Mbewe'), licenseNumber: 'PHAR-2024-002', institutionalId: 'CBUH-PHAR-002', role: 'pharmacist', department: 'Pharmacy', phoneNumberEncrypted: encrypt('+260971000015'), emailEncrypted: encrypt('t.mbewe@cbuh.zm'), passwordHash: PASSWORD_HASH, isVerified: true, isActive: true, mustChangePassword: false, qualifications: 'BPharm, MPharm' },
        // Ndola
        { blockchainAddress: addr(), institutionId: ndolaId, firstNameEncrypted: encrypt('Thandiwe'), lastNameEncrypted: encrypt('Ngoma'), licenseNumber: 'REC-NDL-001', institutionalId: 'NCH-REC-001', role: 'receptionist', department: 'Outpatient Department', phoneNumberEncrypted: encrypt('+260976200001'), emailEncrypted: encrypt('t.ngoma@ndolahospital.zm'), passwordHash: PASSWORD_HASH, isVerified: true, isActive: true, mustChangePassword: false },
        { blockchainAddress: addr(), institutionId: ndolaId, firstNameEncrypted: encrypt('Chanda'), lastNameEncrypted: encrypt('Phiri'), licenseNumber: 'DOC-NDL-001', institutionalId: 'NCH-DOC-001', role: 'practitioner', specialization: 'Internal Medicine', department: 'Internal Medicine', qualifications: 'MBChB, MMed (Internal Medicine)', phoneNumberEncrypted: encrypt('+260976200002'), emailEncrypted: encrypt('c.phiri@ndolahospital.zm'), passwordHash: PASSWORD_HASH, isVerified: true, isActive: true, mustChangePassword: false },
        { blockchainAddress: addr(), institutionId: ndolaId, firstNameEncrypted: encrypt('Mutale'), lastNameEncrypted: encrypt('Bwalya'), licenseNumber: 'NUR-NDL-001', institutionalId: 'NCH-NUR-001', role: 'nurse', department: 'Internal Medicine', phoneNumberEncrypted: encrypt('+260976200003'), emailEncrypted: encrypt('m.bwalya@ndolahospital.zm'), passwordHash: PASSWORD_HASH, isVerified: true, isActive: true, mustChangePassword: false },
        { blockchainAddress: addr(), institutionId: ndolaId, firstNameEncrypted: encrypt('Moses'), lastNameEncrypted: encrypt('Zulu'), licenseNumber: 'LAB-NDL-001', institutionalId: 'NCH-LAB-001', role: 'lab_technician', department: 'Clinical Laboratory', qualifications: 'BSc Medical Laboratory Sciences', phoneNumberEncrypted: encrypt('+260976200004'), emailEncrypted: encrypt('m.zulu@ndolahospital.zm'), passwordHash: PASSWORD_HASH, isVerified: true, isActive: true, mustChangePassword: false },
        { blockchainAddress: addr(), institutionId: ndolaId, firstNameEncrypted: encrypt('Charity'), lastNameEncrypted: encrypt('Mumba'), licenseNumber: 'PHAR-NDL-001', institutionalId: 'NCH-PHAR-001', role: 'pharmacist', department: 'Pharmacy', qualifications: 'BPharm', phoneNumberEncrypted: encrypt('+260976200005'), emailEncrypted: encrypt('c.mumba@ndolahospital.zm'), passwordHash: PASSWORD_HASH, isVerified: true, isActive: true, mustChangePassword: false },
    ]).onConflictDoNothing();

    console.log('🔑  Resolving practitioner IDs…');

    const staffRows = await db
        .select({ id: practitioners.id, licenseNumber: practitioners.licenseNumber })
        .from(practitioners)
        .where(inArray(practitioners.licenseNumber, [
            'ADMIN-2024-001', 'REC-2024-001', 'REC-2024-002',
            'NUR-2024-001', 'NUR-2024-002', 'NUR-2024-003',
            'DOC-2024-001', 'DOC-2024-002', 'DOC-2024-003', 'DOC-2024-004',
            'LAB-2024-001', 'LAB-2024-002', 'RAD-2024-001',
            'PHAR-2024-001', 'PHAR-2024-002',
            'REC-NDL-001', 'DOC-NDL-001', 'NUR-NDL-001', 'LAB-NDL-001', 'PHAR-NDL-001',
        ]));

    const S = Object.fromEntries(staffRows.map(r => [r.licenseNumber, r.id]));
    console.log(`✓ Resolved ${staffRows.length} practitioner IDs`);

    // ── 5. PATIENTS ──────────────────────────────────────────────────────────────

    console.log('🧑‍🤝‍🧑  Seeding patients…');

    const patId = { p1: uid(), p2: uid(), p3: uid(), p4: uid(), p5: uid() };

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

    // ── 6. PATIENT-INSTITUTION REGISTRATIONS ─────────────────────────────────────

    console.log('📋  Seeding patient registrations…');

    await db.insert(patientInstitutionRegistrations).values([
        { patientId: patId.p1, institutionId: cbuhId, hospitalPatientNumber: 'CBUH-2024-00001', registeredAt: daysAgo(400), lastVisitAt: daysAgo(60), isActive: true, isHomeInstitution: true },
        { patientId: patId.p2, institutionId: cbuhId, hospitalPatientNumber: 'CBUH-2024-00002', registeredAt: daysAgo(350), lastVisitAt: daysAgo(45), isActive: true, isHomeInstitution: true },
        { patientId: patId.p3, institutionId: cbuhId, hospitalPatientNumber: 'CBUH-2024-00003', registeredAt: daysAgo(300), lastVisitAt: daysAgo(30), isActive: true, isHomeInstitution: true },
        { patientId: patId.p4, institutionId: cbuhId, hospitalPatientNumber: 'CBUH-2024-00004', registeredAt: daysAgo(500), lastVisitAt: daysAgo(14), isActive: true, isHomeInstitution: true },
        { patientId: patId.p5, institutionId: cbuhId, hospitalPatientNumber: 'CBUH-2025-00005', registeredAt: daysAgo(60), isActive: true, isHomeInstitution: true },
        { patientId: patId.p1, institutionId: ndolaId, hospitalPatientNumber: 'NCH-2023-00101', registeredAt: daysAgo(450), lastVisitAt: daysAgo(240), isActive: true, isHomeInstitution: false },
    ]).onConflictDoNothing();

    // ── 7. VISITS ────────────────────────────────────────────────────────────────

    console.log('🚶  Seeding visits…');

    const vId = {
        v1c: uid(), v2c: uid(), v3c: uid(), v4c: uid(),
        v1a: uid(), v4a: uid(), v5a: uid(),
        ndolaV1: uid(), ndolaV2: uid(), ndolaV3: uid(),
    };

    await db.insert(visits).values([
        { id: vId.v1c, patientId: patId.p1, institutionId: cbuhId, departmentId: dept.cbuhIM, visitNumber: 'VIS-2025-AA001', visitType: 'outpatient', admissionDate: daysAgo(60), dischargeDate: daysAgo(60), chiefComplaint: 'Headache, dizziness and elevated blood pressure readings at home', admittingDiagnosis: 'Hypertensive urgency', dischargeDiagnosis: 'Essential hypertension, stage 2', status: 'completed', priority: 'urgent', assignedNurseId: S['NUR-2024-001'], assignedDoctorId: S['DOC-2024-001'], dischargeSummary: 'BP improved from 178/110 to 142/88 mmHg.', dischargeInstructions: 'Continue Amlodipine 10mg OD, Enalapril 10mg BD.', followUpDate: daysAgo(30), blockchainHash: recordHash({ v: 'v1c' }), dischargeBlockchainHash: recordHash({ d: 'v1c' }) },
        { id: vId.v2c, patientId: patId.p2, institutionId: cbuhId, departmentId: dept.cbuhObs, visitNumber: 'VIS-2025-AA002', visitType: 'outpatient', admissionDate: daysAgo(45), dischargeDate: daysAgo(45), chiefComplaint: 'Routine antenatal — 28 weeks', dischargeDiagnosis: 'Normal pregnancy, 28 weeks', status: 'completed', priority: 'routine', assignedNurseId: S['NUR-2024-002'], assignedDoctorId: S['DOC-2024-004'], dischargeSummary: 'Fundal height 28cm. FHR 140 bpm.', dischargeInstructions: 'Continue ferrous sulphate and folic acid.', blockchainHash: recordHash({ v: 'v2c' }), dischargeBlockchainHash: recordHash({ d: 'v2c' }) },
        { id: vId.v3c, patientId: patId.p3, institutionId: cbuhId, departmentId: dept.cbuhPaed, visitNumber: 'VIS-2025-AA003', visitType: 'outpatient', admissionDate: daysAgo(30), dischargeDate: daysAgo(30), chiefComplaint: 'Fever 39.2°C, poor feeding, lethargy', dischargeDiagnosis: 'Uncomplicated malaria (P. falciparum)', status: 'completed', priority: 'urgent', assignedNurseId: S['NUR-2024-002'], assignedDoctorId: S['DOC-2024-002'], dischargeSummary: 'Malaria RDT positive. AL commenced.', dischargeInstructions: 'Complete AL 3-day course.', blockchainHash: recordHash({ v: 'v3c' }), dischargeBlockchainHash: recordHash({ d: 'v3c' }) },
        { id: vId.v4c, patientId: patId.p4, institutionId: cbuhId, departmentId: dept.cbuhIM, visitNumber: 'VIS-2025-AA004', visitType: 'outpatient', admissionDate: daysAgo(14), dischargeDate: daysAgo(14), chiefComplaint: 'Routine diabetes review', dischargeDiagnosis: 'T2DM — poorly controlled (HbA1c 9.2%)', status: 'completed', priority: 'routine', assignedNurseId: S['NUR-2024-001'], assignedDoctorId: S['DOC-2024-001'], dischargeSummary: 'HbA1c 9.2%. Metformin dose increased.', dischargeInstructions: 'Metformin 1g BD, Glibenclamide 5mg OD.', blockchainHash: recordHash({ v: 'v4c' }), dischargeBlockchainHash: recordHash({ d: 'v4c' }) },
        { id: vId.v1a, patientId: patId.p1, institutionId: cbuhId, departmentId: dept.cbuhIM, wardId: ward.cbuhMale, visitNumber: 'VIS-2026-BB001', visitType: 'inpatient', admissionDate: hoursAgo(6), chiefComplaint: 'Central chest pain radiating to left arm, diaphoresis', admittingDiagnosis: 'ACS — rule out NSTEMI', wardOrRoom: 'Male General Ward, Bed 5', status: 'in-progress', priority: 'emergency', assignedNurseId: S['NUR-2024-001'], assignedDoctorId: S['DOC-2024-001'], blockchainHash: recordHash({ v: 'v1a' }) },
        { id: vId.v4a, patientId: patId.p4, institutionId: cbuhId, departmentId: dept.cbuhIM, wardId: ward.cbuhFemale, visitNumber: 'VIS-2026-BB002', visitType: 'inpatient', admissionDate: hoursAgo(4), chiefComplaint: 'Polyuria, polydipsia, blurred vision, BGL 24.6', admittingDiagnosis: 'Hyperglycaemic crisis — DKA', wardOrRoom: 'Female General Ward, Bed 12', status: 'in-progress', priority: 'urgent', assignedNurseId: S['NUR-2024-001'], assignedDoctorId: S['DOC-2024-001'], blockchainHash: recordHash({ v: 'v4a' }) },
        { id: vId.v5a, patientId: patId.p5, institutionId: cbuhId, departmentId: dept.cbuhEmerg, wardId: ward.cbuhIcu, visitNumber: 'VIS-2026-BB003', visitType: 'emergency', admissionDate: hoursAgo(3), chiefComplaint: 'RTA — pedestrian struck, LOC at scene', admittingDiagnosis: 'Poly-trauma: closed head injury, lacerations', wardOrRoom: 'ICU, Bed 2', status: 'in-progress', priority: 'critical', assignedNurseId: S['NUR-2024-003'], assignedDoctorId: S['DOC-2024-003'], blockchainHash: recordHash({ v: 'v5a' }) },
        { id: vId.ndolaV1, patientId: patId.p1, institutionId: ndolaId, departmentId: dept.ndolaOPD, visitNumber: 'NCH-2023-HT001', visitType: 'outpatient', admissionDate: daysAgo(365), dischargeDate: daysAgo(365), chiefComplaint: 'Headache and dizziness — first presentation', admittingDiagnosis: 'Newly diagnosed hypertension', dischargeDiagnosis: 'Essential HTN', status: 'completed', priority: 'urgent', assignedNurseId: S['NUR-NDL-001'], assignedDoctorId: S['DOC-NDL-001'], dischargeSummary: 'BP 168/108. Started on Amlodipine 5mg OD.', dischargeInstructions: 'DASH diet, return in 4 weeks.', followUpDate: daysAgo(330), blockchainHash: recordHash({ v: 'ndolaV1' }), dischargeBlockchainHash: recordHash({ d: 'ndolaV1' }) },
        { id: vId.ndolaV2, patientId: patId.p1, institutionId: ndolaId, departmentId: dept.ndolaEmerg, visitNumber: 'NCH-2024-EM001', visitType: 'emergency', admissionDate: daysAgo(240), dischargeDate: daysAgo(239), chiefComplaint: 'Severe headache — BP 192/118', admittingDiagnosis: 'Hypertensive urgency', dischargeDiagnosis: 'Hypertensive urgency resolved', status: 'completed', priority: 'emergency', assignedNurseId: S['NUR-NDL-001'], assignedDoctorId: S['DOC-NDL-001'], wardOrRoom: 'Emergency Bay 3', dischargeSummary: 'IV Hydralazine. BP settled.', dischargeInstructions: 'Amlodipine 10mg OD.', blockchainHash: recordHash({ v: 'ndolaV2' }), dischargeBlockchainHash: recordHash({ d: 'ndolaV2' }) },
        { id: vId.ndolaV3, patientId: patId.p1, institutionId: ndolaId, departmentId: dept.ndolaOPD, visitNumber: 'NCH-2024-FU001', visitType: 'outpatient', admissionDate: daysAgo(180), dischargeDate: daysAgo(180), chiefComplaint: 'Routine BP follow-up', dischargeDiagnosis: 'HTN — controlled', status: 'completed', priority: 'routine', assignedNurseId: S['NUR-NDL-001'], assignedDoctorId: S['DOC-NDL-001'], dischargeSummary: 'BP 138/86. Stable.', dischargeInstructions: 'Continue medication.', blockchainHash: recordHash({ v: 'ndolaV3' }), dischargeBlockchainHash: recordHash({ d: 'ndolaV3' }) },
    ]).onConflictDoNothing();

    // ── 8. VITAL SIGNS ───────────────────────────────────────────────────────────

    console.log('📊  Seeding vital signs…');

    const vitId = { v1a: uid(), v4a: uid(), v5a: uid() };

    await db.insert(vitalSigns).values([
        { id: vitId.v1a, visitId: vId.v1a, patientId: patId.p1, recordedByNurseId: S['NUR-2024-001'], bloodPressureSystolic: 168, bloodPressureDiastolic: 108, pulseRate: 96, respiratoryRate: 22, temperature: '36.8', oxygenSaturation: 95, weight: '82.5', height: '178', nurseNotes: 'On admission. Diaphoretic. Pain 7/10.', recordedAt: hoursAgo(5), blockchainHash: recordHash({ vit: 'v1a' }) },
        { id: vitId.v4a, visitId: vId.v4a, patientId: patId.p4, recordedByNurseId: S['NUR-2024-001'], bloodPressureSystolic: 132, bloodPressureDiastolic: 84, pulseRate: 112, respiratoryRate: 26, temperature: '37.2', oxygenSaturation: 97, weight: '78.3', height: '162', nurseNotes: 'Tachycardic. Kussmaul breathing. BGL 24.6.', recordedAt: hoursAgo(3), blockchainHash: recordHash({ vit: 'v4a' }) },
        { id: vitId.v5a, visitId: vId.v5a, patientId: patId.p5, recordedByNurseId: S['NUR-2024-003'], bloodPressureSystolic: 95, bloodPressureDiastolic: 60, pulseRate: 124, respiratoryRate: 28, temperature: '36.1', oxygenSaturation: 92, weight: '68', height: '175', nurseNotes: 'GCS 12/15. Multiple lacerations.', recordedAt: hoursAgo(2), blockchainHash: recordHash({ vit: 'v5a' }) },
    ]).onConflictDoNothing();

    // ── 9. CONSULTATIONS ─────────────────────────────────────────────────────────

    console.log('🩺  Seeding consultations…');

    const cId = { v1a: uid(), v4a: uid(), v5a: uid() };

    await db.insert(consultations).values([
        { id: cId.v1a, visitId: vId.v1a, patientId: patId.p1, practitionerId: S['DOC-2024-001'], chiefComplaint: 'Crushing central chest pain × 90 min, radiating to left jaw and arm.', historyOfPresentIllness: 'Sudden onset chest pain 90 minutes ago. Associated diaphoresis and dyspnoea. No previous cardiac history.', reviewOfSystems: 'No fever, no cough. Mild dyspnoea on exertion.', physicalExamination: 'Diaphoretic. JVP normal. HS dual no murmurs. Lungs clear bibasally.', clinicalFindings: 'ECG ST depression V4-V6. Vitals stable.', assessment: 'Likely NSTEMI. Awaiting troponin.', plan: 'Admit, IV access, aspirin 300mg + clopidogrel 300mg loading. Enoxaparin. Serial ECG/troponin. Cardiology referral.', followUpInstructions: 'Repeat troponin in 3h.', consultationDate: hoursAgo(4), blockchainHash: recordHash({ c: 'v1a' }) },
        { id: cId.v4a, visitId: vId.v4a, patientId: patId.p4, practitionerId: S['DOC-2024-001'], chiefComplaint: 'Polyuria, polydipsia, blurred vision × 3 days. Vomited twice.', historyOfPresentIllness: 'Known T2DM on metformin/glibenclamide. Compliance poor in last 48h.', reviewOfSystems: 'No chest pain. Generally unwell.', physicalExamination: 'Dehydrated. Kussmaul breathing. Acetone breath. Abdomen soft.', clinicalFindings: 'pH 7.22, HCO3 10, ketones 3+, BGL 24.6.', assessment: 'Diabetic ketoacidosis.', plan: 'Fluid resuscitation. IV insulin infusion 0.1 U/kg/h. K+ replacement. Hourly BGL.', followUpInstructions: 'Hourly BGL, 2-hourly U&E.', consultationDate: hoursAgo(3), blockchainHash: recordHash({ c: 'v4a' }) },
        { id: cId.v5a, visitId: vId.v5a, patientId: patId.p5, practitionerId: S['DOC-2024-003'], chiefComplaint: 'RTA — pedestrian struck. Brief LOC at scene.', historyOfPresentIllness: 'Hit by vehicle ~1 hour ago. Confused on arrival.', reviewOfSystems: 'Unable to fully assess due to confusion.', physicalExamination: 'GCS 12. Right temporal bruising. Multiple lacerations.', clinicalFindings: 'No long bone deformity. Stable haemodynamically.', assessment: 'Closed head injury — suspected EDH.', plan: 'CT head urgent. Neurosurgical consultation. IV fluids. Tetanus.', followUpInstructions: 'Hourly neuro obs.', consultationDate: hoursAgo(2), blockchainHash: recordHash({ c: 'v5a' }) },
    ]).onConflictDoNothing();

    // ── 10. DIAGNOSES ────────────────────────────────────────────────────────────

    console.log('🔍  Seeding diagnoses…');

    await db.insert(diagnoses).values([
        { id: uid(), consultationId: cId.v1a, visitId: vId.v1a, patientId: patId.p1, practitionerId: S['DOC-2024-001'], icdCode: 'I21.4', diagnosisName: 'Non-ST Elevation Myocardial Infarction', diagnosisType: 'confirmed', severity: 'severe', notes: 'Troponin 1.24 ng/mL. ECG changes V4-V6.', diagnosedAt: hoursAgo(4), blockchainHash: recordHash({ dx: 'v1a_nstemi' }) },
        { id: uid(), consultationId: cId.v1a, visitId: vId.v1a, patientId: patId.p1, practitionerId: S['DOC-2024-001'], icdCode: 'I10', diagnosisName: 'Essential Hypertension', diagnosisType: 'confirmed', severity: 'moderate', notes: 'Pre-existing. On Amlodipine + Enalapril.', diagnosedAt: hoursAgo(4), blockchainHash: recordHash({ dx: 'v1a_htn' }) },
        { id: uid(), consultationId: cId.v4a, visitId: vId.v4a, patientId: patId.p4, practitionerId: S['DOC-2024-001'], icdCode: 'E10.10', diagnosisName: 'Diabetic Ketoacidosis', diagnosisType: 'confirmed', severity: 'severe', notes: 'pH 7.22, HCO3 10, glucose 24.6, ketones 3+.', diagnosedAt: hoursAgo(3), blockchainHash: recordHash({ dx: 'v4a_dka' }) },
        { id: uid(), consultationId: cId.v5a, visitId: vId.v5a, patientId: patId.p5, practitionerId: S['DOC-2024-003'], icdCode: 'S06.4', diagnosisName: 'Epidural Haematoma', diagnosisType: 'provisional', severity: 'critical', notes: 'Awaiting CT confirmation.', diagnosedAt: hoursAgo(2), blockchainHash: recordHash({ dx: 'v5a_edh' }) },
        { id: uid(), consultationId: cId.v5a, visitId: vId.v5a, patientId: patId.p5, practitionerId: S['DOC-2024-003'], icdCode: 'S01.81', diagnosisName: 'Multiple Lacerations Face & Arms', diagnosisType: 'confirmed', severity: 'moderate', diagnosedAt: hoursAgo(2), blockchainHash: recordHash({ dx: 'v5a_lac' }) },
    ]).onConflictDoNothing();

    // ── 11. LAB ORDERS & RESULTS ─────────────────────────────────────────────────

    console.log('🧪  Seeding lab orders and results…');

    const lId = { fbc_v1a: uid(), troponin: uid(), urine_v4a: uid(), abg_v4a: uid(), ue_v4a: uid(), fbc_v3c: uid(), hba1c_v4c: uid() };

    await db.insert(labTestOrders).values([
        { id: lId.fbc_v1a, orderNumber: 'LAB-2026-00101', visitId: vId.v1a, patientId: patId.p1, orderedByPractitionerId: S['DOC-2024-001'], testName: 'Full Blood Count', testCategory: 'haematology', specimenType: 'blood', urgency: 'urgent', clinicalNotes: 'NSTEMI workup', status: 'resulted', assignedTo: S['LAB-2024-001'], orderedAt: hoursAgo(5), blockchainHash: recordHash({ l: 'fbc_v1a' }) },
        { id: lId.troponin, orderNumber: 'LAB-2026-00102', visitId: vId.v1a, patientId: patId.p1, orderedByPractitionerId: S['DOC-2024-001'], testName: 'Troponin-I (hs)', testCategory: 'biochemistry', specimenType: 'blood', urgency: 'emergency', clinicalNotes: 'Rule out NSTEMI', status: 'resulted', assignedTo: S['LAB-2024-001'], orderedAt: hoursAgo(5), blockchainHash: recordHash({ l: 'trop' }) },
        { id: lId.urine_v4a, orderNumber: 'LAB-2026-00201', visitId: vId.v4a, patientId: patId.p4, orderedByPractitionerId: S['DOC-2024-001'], testName: 'Urinalysis', testCategory: 'clinical_chemistry', specimenType: 'urine', urgency: 'urgent', clinicalNotes: 'DKA evaluation', status: 'resulted', assignedTo: S['LAB-2024-002'], orderedAt: hoursAgo(3), blockchainHash: recordHash({ l: 'urine' }) },
        { id: lId.abg_v4a, orderNumber: 'LAB-2026-00202', visitId: vId.v4a, patientId: patId.p4, orderedByPractitionerId: S['DOC-2024-001'], testName: 'Arterial Blood Gas', testCategory: 'biochemistry', specimenType: 'blood', urgency: 'emergency', clinicalNotes: 'DKA acid-base', status: 'resulted', assignedTo: S['LAB-2024-002'], orderedAt: hoursAgo(3), blockchainHash: recordHash({ l: 'abg' }) },
        { id: lId.ue_v4a, orderNumber: 'LAB-2026-00203', visitId: vId.v4a, patientId: patId.p4, orderedByPractitionerId: S['DOC-2024-001'], testName: 'Urea & Electrolytes', testCategory: 'biochemistry', specimenType: 'blood', urgency: 'urgent', clinicalNotes: 'DKA potassium monitoring', status: 'resulted', assignedTo: S['LAB-2024-002'], orderedAt: hoursAgo(3), blockchainHash: recordHash({ l: 'ue' }) },
        { id: lId.fbc_v3c, orderNumber: 'LAB-2025-00301', visitId: vId.v3c, patientId: patId.p3, orderedByPractitionerId: S['DOC-2024-002'], testName: 'Full Blood Count', testCategory: 'haematology', specimenType: 'blood', urgency: 'routine', clinicalNotes: 'Paediatric malaria', status: 'resulted', assignedTo: S['LAB-2024-001'], orderedAt: daysAgo(30), blockchainHash: recordHash({ l: 'fbc_v3c' }) },
        { id: lId.hba1c_v4c, orderNumber: 'LAB-2025-00401', visitId: vId.v4c, patientId: patId.p4, orderedByPractitionerId: S['DOC-2024-001'], testName: 'HbA1c', testCategory: 'biochemistry', specimenType: 'blood', urgency: 'routine', clinicalNotes: '3-monthly diabetes review', status: 'resulted', assignedTo: S['LAB-2024-001'], orderedAt: daysAgo(14), blockchainHash: recordHash({ l: 'hba1c' }) },
    ]).onConflictDoNothing();

    await db.insert(labTestResults).values([
        { id: uid(), labTestOrderId: lId.fbc_v1a, performedByLabTechId: S['LAB-2024-001'], resultsData: { WBC: '11.2', Hb: '13.9', PLT: '224' }, interpretation: 'Mild leucocytosis.', referenceRanges: { WBC: '4.5–11.0' }, resultedAt: hoursAgo(4), blockchainHash: recordHash({ r: 'fbc_v1a' }) },
        { id: uid(), labTestOrderId: lId.troponin, performedByLabTechId: S['LAB-2024-001'], resultsData: { TroponinI: '1.24 ng/mL' }, interpretation: 'Troponin elevated.', abnormalFindings: 'Troponin > 0.04', referenceRanges: { TroponinI: '< 0.04' }, resultedAt: hoursAgo(4), blockchainHash: recordHash({ r: 'trop' }) },
        { id: uid(), labTestOrderId: lId.urine_v4a, performedByLabTechId: S['LAB-2024-002'], resultsData: { glucose: '4+', ketones: '3+', protein: '1+' }, interpretation: 'Heavy glycosuria and ketonuria.', resultedAt: hoursAgo(2), blockchainHash: recordHash({ r: 'urine' }) },
        { id: uid(), labTestOrderId: lId.abg_v4a, performedByLabTechId: S['LAB-2024-002'], resultsData: { pH: '7.22', PaCO2: '22', HCO3: '10' }, interpretation: 'Severe metabolic acidosis.', resultedAt: hoursAgo(2), blockchainHash: recordHash({ r: 'abg' }) },
        { id: uid(), labTestOrderId: lId.ue_v4a, performedByLabTechId: S['LAB-2024-002'], resultsData: { Na: '131', K: '5.9', Cr: '148', Glu: '24.6' }, interpretation: 'AKI in DKA.', resultedAt: hoursAgo(2), blockchainHash: recordHash({ r: 'ue' }) },
        { id: uid(), labTestOrderId: lId.fbc_v3c, performedByLabTechId: S['LAB-2024-001'], resultsData: { WBC: '6.8', Hb: '8.4', PLT: '82' }, interpretation: 'Anaemia with thrombocytopaenia.', resultedAt: daysAgo(30), blockchainHash: recordHash({ r: 'fbc_v3c' }) },
        { id: uid(), labTestOrderId: lId.hba1c_v4c, performedByLabTechId: S['LAB-2024-001'], resultsData: { HbA1c_percent: '9.2' }, interpretation: 'Poor glycaemic control.', referenceRanges: { HbA1c: '< 7.0%' }, resultedAt: daysAgo(14), blockchainHash: recordHash({ r: 'hba1c' }) },
    ]).onConflictDoNothing();

    // ── 12. IMAGING ──────────────────────────────────────────────────────────────

    console.log('🩻  Seeding imaging…');

    const imgId = { cxr: uid(), ct: uid(), echo: uid() };

    await db.insert(imagingOrders).values([
        { id: imgId.cxr, orderNumber: 'IMG-2026-00101', visitId: vId.v1a, patientId: patId.p1, orderedByPractitionerId: S['DOC-2024-001'], modality: 'x-ray', bodyPart: 'Chest (PA)', indication: 'NSTEMI — assess for pulmonary oedema', urgency: 'emergency', status: 'reported', assignedTo: S['RAD-2024-001'], orderedAt: hoursAgo(5), blockchainHash: recordHash({ img: 'cxr' }) },
        { id: imgId.ct, orderNumber: 'IMG-2026-00201', visitId: vId.v5a, patientId: patId.p5, orderedByPractitionerId: S['DOC-2024-003'], modality: 'ct_scan', bodyPart: 'Head (non-contrast)', indication: 'Poly-trauma — rule out ICH', urgency: 'critical', status: 'reported', assignedTo: S['RAD-2024-001'], orderedAt: hoursAgo(2), blockchainHash: recordHash({ img: 'ct' }) },
        { id: imgId.echo, orderNumber: 'IMG-2026-00102', visitId: vId.v1a, patientId: patId.p1, orderedByPractitionerId: S['DOC-2024-001'], modality: 'ultrasound', bodyPart: 'Heart (Echo)', indication: 'Assess LV function in NSTEMI', urgency: 'urgent', status: 'ordered', assignedTo: S['RAD-2024-001'], orderedAt: hoursAgo(3), blockchainHash: recordHash({ img: 'echo' }) },
    ]).onConflictDoNothing();

    await db.insert(imagingReports).values([
        { id: uid(), imagingOrderId: imgId.cxr, performedByRadiologistId: S['RAD-2024-001'], findings: 'Cardiomegaly (CTR 0.56). Bilateral perihilar haziness — early pulmonary oedema.', impression: 'Cardiomegaly with early pulmonary oedema.', recommendations: 'Urgent cardiology review.', imageUrls: [], blockchainHash: recordHash({ rpt: 'cxr' }) },
        { id: uid(), imagingOrderId: imgId.ct, performedByRadiologistId: S['RAD-2024-001'], findings: 'Hyperdense right temporal collection 4.2 x 3.1 cm — EDH. Midline shift 5mm.', impression: 'Acute right temporal EDH with mass effect.', recommendations: 'URGENT neurosurgical referral.', imageUrls: [], blockchainHash: recordHash({ rpt: 'ct' }) },
    ]).onConflictDoNothing();

    // ── 13. PRESCRIPTIONS ────────────────────────────────────────────────────────

    console.log('💊  Seeding prescriptions…');

    const rxId = { v1c: uid(), v2c: uid(), v3c: uid(), v4c: uid(), v1a: uid() };

    await db.insert(prescriptions).values([
        { id: rxId.v1c, prescriptionNumber: 'RX-2025-00101', visitId: vId.v1c, patientId: patId.p1, prescribedByPractitionerId: S['DOC-2024-001'], status: 'dispensed', blockchainHash: recordHash({ rx: 'v1c' }), prescribedAt: daysAgo(60) },
        { id: rxId.v2c, prescriptionNumber: 'RX-2025-00201', visitId: vId.v2c, patientId: patId.p2, prescribedByPractitionerId: S['DOC-2024-004'], status: 'dispensed', blockchainHash: recordHash({ rx: 'v2c' }), prescribedAt: daysAgo(45) },
        { id: rxId.v3c, prescriptionNumber: 'RX-2025-00301', visitId: vId.v3c, patientId: patId.p3, prescribedByPractitionerId: S['DOC-2024-002'], status: 'dispensed', blockchainHash: recordHash({ rx: 'v3c' }), prescribedAt: daysAgo(30) },
        { id: rxId.v4c, prescriptionNumber: 'RX-2025-00401', visitId: vId.v4c, patientId: patId.p4, prescribedByPractitionerId: S['DOC-2024-001'], status: 'dispensed', blockchainHash: recordHash({ rx: 'v4c' }), prescribedAt: daysAgo(14) },
        { id: rxId.v1a, prescriptionNumber: 'RX-2026-00101', visitId: vId.v1a, patientId: patId.p1, prescribedByPractitionerId: S['DOC-2024-001'], status: 'prescribed', blockchainHash: recordHash({ rx: 'v1a' }), prescribedAt: hoursAgo(4) },
    ]).onConflictDoNothing();

    await db.insert(prescriptionItems).values([
        { id: uid(), prescriptionId: rxId.v1c, medicationName: 'Amlodipine', strength: '10mg', dosageForm: 'tablet', dose: '10mg', frequency: 'once_daily', route: 'oral', duration: '90 days', quantity: 90, instructions: 'Take in the morning.', isDispensed: true, dispensedByPharmacistId: S['PHAR-2024-001'], dispensedAt: daysAgo(60) },
        { id: uid(), prescriptionId: rxId.v1c, medicationName: 'Enalapril', strength: '10mg', dosageForm: 'tablet', dose: '10mg', frequency: 'twice_daily', route: 'oral', duration: '90 days', quantity: 180, instructions: 'Avoid potassium supplements.', isDispensed: true, dispensedByPharmacistId: S['PHAR-2024-001'], dispensedAt: daysAgo(60) },
        { id: uid(), prescriptionId: rxId.v3c, medicationName: 'Artemether-Lumefantrine', strength: '20/120mg', dosageForm: 'tablet', dose: '3 tablets', frequency: 'twice_daily', route: 'oral', duration: '3 days', quantity: 18, instructions: 'Take with food.', isDispensed: true, dispensedByPharmacistId: S['PHAR-2024-001'], dispensedAt: daysAgo(30) },
        { id: uid(), prescriptionId: rxId.v3c, medicationName: 'Paracetamol', strength: '500mg', dosageForm: 'tablet', dose: '500mg', frequency: 'four_times_daily', route: 'oral', duration: '3 days', quantity: 12, instructions: 'For fever > 38°C.', isDispensed: true, dispensedByPharmacistId: S['PHAR-2024-001'], dispensedAt: daysAgo(30) },
        { id: uid(), prescriptionId: rxId.v4c, medicationName: 'Metformin', strength: '500mg', dosageForm: 'tablet', dose: '1g', frequency: 'twice_daily', route: 'oral', duration: '90 days', quantity: 360, instructions: 'Take with meals.', isDispensed: true, dispensedByPharmacistId: S['PHAR-2024-002'], dispensedAt: daysAgo(14) },
        { id: uid(), prescriptionId: rxId.v4c, medicationName: 'Glibenclamide', strength: '5mg', dosageForm: 'tablet', dose: '5mg', frequency: 'once_daily', route: 'oral', duration: '90 days', quantity: 90, instructions: '30 min before breakfast.', isDispensed: true, dispensedByPharmacistId: S['PHAR-2024-002'], dispensedAt: daysAgo(14) },
        { id: uid(), prescriptionId: rxId.v1a, medicationName: 'Paracetamol', strength: '500mg', dosageForm: 'tablet', dose: '500mg', frequency: 'four_times_daily', route: 'oral', duration: '5 days', quantity: 20, instructions: 'PRN pain.', isDispensed: false },
        { id: uid(), prescriptionId: rxId.v1a, medicationName: 'Amlodipine', strength: '10mg', dosageForm: 'tablet', dose: '10mg', frequency: 'once_daily', route: 'oral', duration: '30 days', quantity: 30, instructions: 'Continue maintenance.', isDispensed: false },
    ]).onConflictDoNothing();

    // ── 14. ALLERGIES & MEDICAL HISTORY ──────────────────────────────────────────

    console.log('⚠️  Seeding allergies and medical history…');

    await db.insert(allergies).values([
        { id: uid(), patientId: patId.p1, allergen: 'Penicillin', allergyType: 'drug', severity: 'moderate', reaction: 'Generalised urticaria and facial angioedema', onsetDate: '2015-03-12', notes: 'Avoid all beta-lactam antibiotics', recordedByPractitionerId: S['DOC-2024-001'], isActive: true, blockchainHash: recordHash({ a: 'p1_pen' }) },
        { id: uid(), patientId: patId.p2, allergen: 'Sulphonamides (Septrin)', allergyType: 'drug', severity: 'severe', reaction: 'Stevens-Johnson syndrome', onsetDate: '2019-08-05', notes: 'Absolute contraindication.', recordedByPractitionerId: S['DOC-2024-004'], isActive: true, blockchainHash: recordHash({ a: 'p2_sulf' }) },
        { id: uid(), patientId: patId.p3, allergen: 'Groundnuts (Peanuts)', allergyType: 'food', severity: 'severe', reaction: 'Anaphylaxis — received adrenaline 2022', onsetDate: '2022-06-20', notes: 'Carries EpiPen.', isActive: true, blockchainHash: recordHash({ a: 'p3_nut' }) },
    ]).onConflictDoNothing();

    await db.insert(medicalHistory).values([
        { id: uid(), patientId: patId.p1, condition: 'Essential Hypertension', diagnosedDate: '2019-06-15', status: 'active', notes: 'Amlodipine 10mg + Enalapril 10mg BD', recordedByPractitionerId: S['DOC-2024-001'], blockchainHash: recordHash({ mh: 'p1_htn' }) },
        { id: uid(), patientId: patId.p2, condition: 'G1P0 — First Pregnancy', diagnosedDate: '2024-09-01', status: 'active', notes: 'LMP 01/09/2024.', recordedByPractitionerId: S['DOC-2024-004'], blockchainHash: recordHash({ mh: 'p2_preg' }) },
        { id: uid(), patientId: patId.p4, condition: 'Type 2 Diabetes Mellitus', diagnosedDate: '2015-04-10', status: 'active', notes: 'Metformin 1g BD + Glibenclamide.', recordedByPractitionerId: S['DOC-2024-001'], blockchainHash: recordHash({ mh: 'p4_dm' }) },
        { id: uid(), patientId: patId.p4, condition: 'Hypertension', diagnosedDate: '2018-07-14', status: 'active', recordedByPractitionerId: S['DOC-2024-001'], blockchainHash: recordHash({ mh: 'p4_htn' }) },
    ]).onConflictDoNothing();

    // ── 15. ACCESS PERMISSIONS & REQUESTS ────────────────────────────────────────

    console.log('🔐  Seeding access permissions & requests…');

    await db.insert(accessPermissions).values([
        { id: uid(), patientId: patId.p1, grantedToUserId: S['DOC-2024-001'], grantedToUserType: 'practitioner', permissionType: 'write', allowedRecordTypes: ['all'], grantedAt: daysAgo(180), expiresAt: daysFromNow(180), blockchainTransactionId: txId(), isActive: true },
        { id: uid(), patientId: patId.p4, grantedToUserId: S['DOC-2024-001'], grantedToUserType: 'practitioner', permissionType: 'write', allowedRecordTypes: ['all'], grantedAt: daysAgo(365), expiresAt: daysFromNow(180), blockchainTransactionId: txId(), isActive: true },
    ]).onConflictDoNothing();

    await db.insert(accessRequests).values([
        { id: uid(), requestedByUserId: S['LAB-2024-001'], requestedByUserType: 'lab_technician', patientId: patId.p5, visitId: vId.v5a, requestedPermissions: ['lab_order', 'lab_result'], reason: 'Emergency trauma labs urgently.', status: 'pending', createdAt: hoursAgo(1), expiresAt: hoursFromNow(47) },
        { id: uid(), requestedByUserId: S['PHAR-2024-001'], requestedByUserType: 'pharmacist', patientId: patId.p4, visitId: vId.v4a, requestedPermissions: ['prescription'], reason: 'Insulin for DKA management.', status: 'pending', createdAt: hoursAgo(1), expiresAt: hoursFromNow(47) },
    ]).onConflictDoNothing();

    // ── 16. AUDIT LOGS ───────────────────────────────────────────────────────────

    console.log('📋  Seeding audit logs…');

    await db.insert(auditLogs).values([
        { id: uid(), userId: S['REC-2024-001'], userType: 'receptionist', patientId: patId.p1, actionType: 'create', resourceType: 'patient', resourceId: patId.p1, timestamp: daysAgo(60), blockchainTransactionId: txId(), isEmergencyOverride: false, createdAt: daysAgo(60) },
        { id: uid(), userId: S['REC-2024-002'], userType: 'receptionist', patientId: patId.p4, actionType: 'create', resourceType: 'visit', resourceId: vId.v4a, timestamp: hoursAgo(4), blockchainTransactionId: txId(), isEmergencyOverride: false, createdAt: hoursAgo(4) },
        { id: uid(), userId: S['NUR-2024-001'], userType: 'nurse', patientId: patId.p1, actionType: 'create', resourceType: 'vital_signs', resourceId: vitId.v1a, timestamp: hoursAgo(5), blockchainTransactionId: txId(), isEmergencyOverride: false, createdAt: hoursAgo(5) },
        { id: uid(), userId: S['DOC-2024-001'], userType: 'practitioner', patientId: patId.p1, actionType: 'create', resourceType: 'consultation', resourceId: cId.v1a, timestamp: hoursAgo(4), blockchainTransactionId: txId(), isEmergencyOverride: false, createdAt: hoursAgo(4) },
        { id: uid(), userId: S['LAB-2024-001'], userType: 'lab_technician', patientId: patId.p1, actionType: 'create', resourceType: 'lab_result', resourceId: lId.troponin, timestamp: hoursAgo(4), blockchainTransactionId: txId(), isEmergencyOverride: false, createdAt: hoursAgo(4) },
    ]).onConflictDoNothing();

    // ══════════════════════════════════════════════════════════════════════════════
    // ── 17. APPOINTMENT REQUESTS (NEW FEATURE) ───────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════════════
    // Patient-initiated appointment requests via mobile app.
    // Stored as visits with visitNumber prefixed APT-REQ-, status='scheduled'.

    console.log('📅  Seeding patient appointment requests…');

    const aptBase = Date.now();
    await db.insert(visits).values([
        {
            patientId: patId.p2, institutionId: cbuhId, departmentId: dept.cbuhObs,
            visitNumber: `APT-REQ-${aptBase}-001`,
            visitType: 'outpatient', admissionDate: daysFromNow(5),
            chiefComplaint: 'Routine antenatal follow-up — 32 weeks. Some foot swelling.',
            admittingDiagnosis: 'Obstetrics & Gynaecology',
            status: 'scheduled', priority: 'routine',
            blockchainHash: recordHash({ apt: 'p2' }),
        },
        {
            patientId: patId.p1, institutionId: cbuhId, departmentId: dept.cbuhIM,
            visitNumber: `APT-REQ-${aptBase}-002`,
            visitType: 'outpatient', admissionDate: daysFromNow(7),
            chiefComplaint: 'BP check — running out of medication.',
            admittingDiagnosis: 'Internal Medicine',
            status: 'scheduled', priority: 'routine',
            blockchainHash: recordHash({ apt: 'p1' }),
        },
        {
            patientId: patId.p4, institutionId: cbuhId, departmentId: dept.cbuhIM,
            visitNumber: `APT-REQ-${aptBase}-003`,
            visitType: 'outpatient', admissionDate: daysFromNow(3),
            chiefComplaint: 'Diabetes review — sugars high, blurred vision returning.',
            admittingDiagnosis: 'Internal Medicine',
            status: 'scheduled', priority: 'urgent',
            blockchainHash: recordHash({ apt: 'p4' }),
        },
    ]).onConflictDoNothing();

    // ══════════════════════════════════════════════════════════════════════════════
    // ── 18. REFERRALS (NEW FEATURE) ──────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════════════

    console.log('🔄  Seeding referrals…');

    await db.insert(referrals).values([
        {
            id: uid(),
            referralNumber: 'REF-2026-00001',
            patientId: patId.p1, visitId: vId.v1a,
            referringInstitutionId: cbuhId,
            referringPractitionerId: S['DOC-2024-001'],
            receivingInstitutionId: ndolaId,
            receivingDepartmentId: dept.ndolaIM,
            urgency: 'urgent',
            reason: 'NSTEMI requiring cardiology workup and possible angiogram.',
            clinicalSummary: 'Mr Musonda, 36yo male, presented 6h ago with NSTEMI. Troponin 1.24, ECG changes V4-V6. Started on dual antiplatelet, LMWH. Requesting cardiology review.',
            status: 'pending',
            referredAt: hoursAgo(2),
            blockchainHash: recordHash({ ref: 'p1_card' }),
        },
        {
            id: uid(),
            referralNumber: 'REF-2026-00002',
            patientId: patId.p5, visitId: vId.v5a,
            referringInstitutionId: cbuhId,
            referringPractitionerId: S['DOC-2024-003'],
            receivingInstitutionId: ndolaId,
            receivingDepartmentId: dept.ndolaEmerg,
            urgency: 'emergency',
            reason: 'Acute epidural haematoma — neurosurgical emergency.',
            clinicalSummary: 'Mr Mumba, 19yo, RTA. CT head shows right temporal EDH 4.2x3.1cm with 5mm midline shift. GCS 12. Needs URGENT evacuation.',
            status: 'accepted',
            acceptedAt: hoursAgo(1),
            responseNotes: 'Accepting. Transfer immediately. Theatre being prepared.',
            referredAt: hoursAgo(1),
            blockchainHash: recordHash({ ref: 'p5_neuro' }),
        },
        {
            id: uid(),
            referralNumber: 'REF-2025-00103',
            patientId: patId.p4, visitId: vId.v4c,
            referringInstitutionId: cbuhId,
            referringPractitionerId: S['DOC-2024-001'],
            receivingInstitutionId: ndolaId,
            receivingDepartmentId: dept.ndolaOPD,
            urgency: 'routine',
            reason: 'Diabetic retinopathy screening — HbA1c 9.2%.',
            clinicalSummary: 'Mrs Sakala, 53yo, T2DM since 2015. Recent HbA1c 9.2%. Needs annual dilated fundus exam.',
            status: 'completed',
            acceptedAt: daysAgo(12),
            completedAt: daysAgo(5),
            referredAt: daysAgo(14),
            blockchainHash: recordHash({ ref: 'p4_eye' }),
        },
    ] as any).onConflictDoNothing();

    // ══════════════════════════════════════════════════════════════════════════════
    // ── 19. MEDICATION STOCK ─────────────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════════════

    console.log('💊  Seeding medication stock for all institutions…');

    type DrugSeed = {
        medicationName: string; genericName?: string; strength: string;
        dosageForm: string; unit: string; quantity: number; reorderLevel: number;
    };

    const DRUGS: DrugSeed[] = [
        { medicationName: 'Amoxicillin', genericName: 'Amoxicillin', strength: '500mg', dosageForm: 'capsule', unit: 'units', quantity: 480, reorderLevel: 100 },
        { medicationName: 'Amoxicillin', genericName: 'Amoxicillin', strength: '250mg', dosageForm: 'capsule', unit: 'units', quantity: 360, reorderLevel: 80 },
        { medicationName: 'Co-amoxiclav', genericName: 'Amoxicillin/Clavulanate', strength: '625mg', dosageForm: 'tablet', unit: 'units', quantity: 200, reorderLevel: 50 },
        { medicationName: 'Ciprofloxacin', genericName: 'Ciprofloxacin', strength: '500mg', dosageForm: 'tablet', unit: 'units', quantity: 240, reorderLevel: 60 },
        { medicationName: 'Metronidazole', genericName: 'Metronidazole', strength: '400mg', dosageForm: 'tablet', unit: 'units', quantity: 300, reorderLevel: 80 },
        { medicationName: 'Doxycycline', genericName: 'Doxycycline', strength: '100mg', dosageForm: 'capsule', unit: 'units', quantity: 180, reorderLevel: 40 },
        { medicationName: 'Azithromycin', genericName: 'Azithromycin', strength: '500mg', dosageForm: 'tablet', unit: 'units', quantity: 120, reorderLevel: 30 },
        { medicationName: 'Ceftriaxone', genericName: 'Ceftriaxone', strength: '1g', dosageForm: 'injection', unit: 'vials', quantity: 90, reorderLevel: 25 },
        { medicationName: 'Paracetamol', genericName: 'Acetaminophen', strength: '500mg', dosageForm: 'tablet', unit: 'units', quantity: 600, reorderLevel: 150 },
        { medicationName: 'Ibuprofen', genericName: 'Ibuprofen', strength: '400mg', dosageForm: 'tablet', unit: 'units', quantity: 420, reorderLevel: 100 },
        { medicationName: 'Diclofenac', genericName: 'Diclofenac Sodium', strength: '50mg', dosageForm: 'tablet', unit: 'units', quantity: 260, reorderLevel: 60 },
        { medicationName: 'Tramadol', genericName: 'Tramadol', strength: '50mg', dosageForm: 'capsule', unit: 'units', quantity: 140, reorderLevel: 40 },
        { medicationName: 'Morphine', genericName: 'Morphine Sulfate', strength: '10mg', dosageForm: 'injection', unit: 'vials', quantity: 40, reorderLevel: 15 },
        { medicationName: 'Artemether-Lumefantrine', genericName: 'Coartem', strength: '20/120mg', dosageForm: 'tablet', unit: 'units', quantity: 320, reorderLevel: 80 },
        { medicationName: 'Quinine', genericName: 'Quinine Sulfate', strength: '300mg', dosageForm: 'tablet', unit: 'units', quantity: 150, reorderLevel: 40 },
        { medicationName: 'Rifampicin', genericName: 'Rifampicin', strength: '150mg', dosageForm: 'tablet', unit: 'units', quantity: 200, reorderLevel: 50 },
        { medicationName: 'Isoniazid', genericName: 'Isoniazid', strength: '300mg', dosageForm: 'tablet', unit: 'units', quantity: 180, reorderLevel: 50 },
        { medicationName: 'Tenofovir-Lamivudine-Dolutegravir', genericName: 'TLD', strength: '300/300/50mg', dosageForm: 'tablet', unit: 'units', quantity: 280, reorderLevel: 70 },
        { medicationName: 'Amlodipine', genericName: 'Amlodipine', strength: '5mg', dosageForm: 'tablet', unit: 'units', quantity: 300, reorderLevel: 80 },
        { medicationName: 'Amlodipine', genericName: 'Amlodipine', strength: '10mg', dosageForm: 'tablet', unit: 'units', quantity: 250, reorderLevel: 70 },
        { medicationName: 'Lisinopril', genericName: 'Lisinopril', strength: '10mg', dosageForm: 'tablet', unit: 'units', quantity: 220, reorderLevel: 60 },
        { medicationName: 'Enalapril', genericName: 'Enalapril', strength: '10mg', dosageForm: 'tablet', unit: 'units', quantity: 220, reorderLevel: 60 },
        { medicationName: 'Hydrochlorothiazide', genericName: 'HCTZ', strength: '25mg', dosageForm: 'tablet', unit: 'units', quantity: 200, reorderLevel: 50 },
        { medicationName: 'Atenolol', genericName: 'Atenolol', strength: '50mg', dosageForm: 'tablet', unit: 'units', quantity: 160, reorderLevel: 40 },
        { medicationName: 'Furosemide', genericName: 'Furosemide', strength: '40mg', dosageForm: 'tablet', unit: 'units', quantity: 180, reorderLevel: 50 },
        { medicationName: 'Metformin', genericName: 'Metformin', strength: '500mg', dosageForm: 'tablet', unit: 'units', quantity: 400, reorderLevel: 100 },
        { medicationName: 'Glibenclamide', genericName: 'Glibenclamide', strength: '5mg', dosageForm: 'tablet', unit: 'units', quantity: 150, reorderLevel: 40 },
        { medicationName: 'Insulin (Soluble)', genericName: 'Human Insulin', strength: '100IU/ml', dosageForm: 'injection', unit: 'vials', quantity: 60, reorderLevel: 20 },
        { medicationName: 'Omeprazole', genericName: 'Omeprazole', strength: '20mg', dosageForm: 'capsule', unit: 'units', quantity: 340, reorderLevel: 80 },
        { medicationName: 'Oral Rehydration Salts', genericName: 'ORS', strength: 'sachet', dosageForm: 'syrup', unit: 'sachets', quantity: 500, reorderLevel: 120 },
        { medicationName: 'Salbutamol', genericName: 'Salbutamol', strength: '100mcg', dosageForm: 'inhaler', unit: 'units', quantity: 80, reorderLevel: 25 },
        { medicationName: 'Prednisolone', genericName: 'Prednisolone', strength: '5mg', dosageForm: 'tablet', unit: 'units', quantity: 220, reorderLevel: 60 },
        { medicationName: 'Chlorpheniramine', genericName: 'Chlorpheniramine Maleate', strength: '4mg', dosageForm: 'tablet', unit: 'units', quantity: 260, reorderLevel: 60 },
        { medicationName: 'Ferrous Sulphate', genericName: 'Ferrous Sulphate', strength: '200mg', dosageForm: 'tablet', unit: 'units', quantity: 400, reorderLevel: 100 },
        { medicationName: 'Folic Acid', genericName: 'Folic Acid', strength: '5mg', dosageForm: 'tablet', unit: 'units', quantity: 300, reorderLevel: 80 },
    ];

    const SUPPLIERS = ['Meddent Pharmaceuticals Ltd', 'Zampharm Distributors', 'Pharmanova Zambia', 'Missionpharma', 'Kanyama Medical Supplies'];

    const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    const randomBatch = () => {
        const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'.split('');
        return `B${pick(letters)}${pick(letters)}-${Math.floor(1000 + Math.random() * 9000)}`;
    };
    const randomExpiry = (i: number) => {
        const now = new Date();
        const monthsOut = (i % 10 === 0) ? 2 : 6 + Math.floor(Math.random() * 30);
        const d = new Date(now.getFullYear(), now.getMonth() + monthsOut, 15 + (i % 10));
        return d.toISOString().slice(0, 10);
    };

    const allInstitutions = await db.select({ id: institutions.id }).from(institutions);

    let stockInserted = 0;
    for (const inst of allInstitutions) {
        for (let i = 0; i < DRUGS.length; i++) {
            const drug = DRUGS[i];

            const existing = await db.select({ id: medicationStock.id })
                .from(medicationStock)
                .where(and(
                    eq(medicationStock.institutionId, inst.id),
                    sql`LOWER(${medicationStock.medicationName}) = LOWER(${drug.medicationName})`,
                    sql`LOWER(${medicationStock.strength}) = LOWER(${drug.strength})`,
                ))
                .limit(1);

            if (existing.length) continue;

            const [created] = await db.insert(medicationStock).values({
                institutionId: inst.id,
                medicationName: drug.medicationName,
                genericName: drug.genericName ?? null,
                strength: drug.strength,
                dosageForm: drug.dosageForm,
                unit: drug.unit,
                quantity: drug.quantity,
                reorderLevel: drug.reorderLevel,
                batchNumber: randomBatch(),
                expiryDate: randomExpiry(i),
                supplier: pick(SUPPLIERS),
            }).returning({ id: medicationStock.id });

            await db.insert(stockMovements).values({
                stockId: created.id,
                institutionId: inst.id,
                changeType: 'restock',
                quantityChange: drug.quantity,
                quantityAfter: drug.quantity,
                performedBy: S['PHAR-2024-001'],
                notes: 'Seeded initial stock',
            });

            stockInserted++;
        }
    }
    console.log(`✓ ${stockInserted} stock records across ${allInstitutions.length} institutions`);

    // ══════════════════════════════════════════════════════════════════════════════
    // ── DONE ─────────────────────────────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════════════

    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log(' ✅  HealthChain Master Seed Complete!');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('  SUPER ADMIN');
    console.log('  └─ SUPER-ADMIN-001  / SuperAdmin@123');
    console.log('');
    console.log('  CBUH STAFF (password: Password123!)');
    console.log('  ├─ ADMIN-2024-001   Chanda Mwape       (Hospital Admin)');
    console.log('  ├─ REC-2024-001     Namukolo Sichone   (Receptionist)');
    console.log('  ├─ DOC-2024-001     Mubanga Kasonde    (IM Doctor)');
    console.log('  ├─ DOC-2024-002     Nchimunya Mwanza   (Paediatrics)');
    console.log('  ├─ DOC-2024-003     Kangwa Chipimo     (Surgery)');
    console.log('  ├─ DOC-2024-004     Nkandu Luo         (OB/GYN)');
    console.log('  ├─ NUR-2024-001     Mutinta Banda      (Nurse)');
    console.log('  ├─ LAB-2024-001     Mwila Kapasa       (Lab Tech)');
    console.log('  ├─ RAD-2024-001     Chisomo Zimba      (Radiologist)');
    console.log('  └─ PHAR-2024-001    Mwansa Kabwe       (Pharmacist)');
    console.log('');
    console.log('  NDOLA STAFF (password: Password123!)');
    console.log('  ├─ REC-NDL-001      Thandiwe Ngoma');
    console.log('  ├─ DOC-NDL-001      Chanda Phiri');
    console.log('  ├─ NUR-NDL-001      Mutale Bwalya');
    console.log('  ├─ LAB-NDL-001      Moses Zulu');
    console.log('  └─ PHAR-NDL-001     Charity Mumba');
    console.log('');
    console.log('  PATIENTS (password: Password123!, login with nationalId)');
    console.log('  ├─ 123456/78/1   Fredrick Musonda  → NSTEMI (active)');
    console.log('  ├─ 234567/89/1   Chipo Nkuwa       → 28wk antenatal');
    console.log('  ├─ 345678/90/1   Liam Lungu        → malaria recovery');
    console.log('  ├─ 456789/01/1   Agnes Sakala      → DKA (active)');
    console.log('  └─ 567890/12/1   Kalunga Mumba     → poly-trauma (critical)');
    console.log('');
    console.log('  ACTIVE VISITS');
    console.log('  ├─ VIS-2026-BB001  Fredrick Musonda  NSTEMI');
    console.log('  ├─ VIS-2026-BB002  Agnes Sakala      DKA');
    console.log('  └─ VIS-2026-BB003  Kalunga Mumba     Trauma');
    console.log('');
    console.log('  NEW FEATURES');
    console.log('  ├─ 3 patient appointment requests (Receptionist → Requests tab)');
    console.log('  ├─ 3 referrals between CBUH ↔ Ndola');
    console.log('  └─ Medication stock at all 3 institutions');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    process.exit(0);
};

run().catch((err) => {
    console.error('Seeding failed:', err);
    process.exit(1);
});