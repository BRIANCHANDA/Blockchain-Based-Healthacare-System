import {
    pgTable,
    uuid,
    text,
    timestamp,
    boolean,
    jsonb,
    pgEnum,
    index,
    integer,
    decimal,
    date,
    unique,
    varchar,
    serial
} from 'drizzle-orm/pg-core';

// ==================== ENUMS ====================

export const userTypeEnum = pgEnum('user_type', [
    'patient',
    'practitioner',
    'nurse',
    'lab_technician',
    'radiologist',
    'pharmacist',
    'admin',
    'receptionist'
]);

export const genderEnum = pgEnum('gender', ['male', 'female', 'other']);

export const bloodTypeEnum = pgEnum('blood_type', [
    'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown'
]);

export const maritalStatusEnum = pgEnum('marital_status', [
    'single', 'married', 'divorced', 'widowed'
]);

export const visitTypeEnum = pgEnum('visit_type', [
    'outpatient', 'inpatient', 'emergency', 'consultation'
]);

export const encounterStatusEnum = pgEnum('encounter_status', [
    'scheduled', 'in-progress', 'completed', 'cancelled'
]);

export const priorityLevelEnum = pgEnum('priority_level', [
    'routine', 'urgent', 'emergency', 'critical'
]);

export const diagnosisStatusEnum = pgEnum('diagnosis_status', [
    'provisional', 'confirmed', 'ruled_out', 'differential'
]);

export const allergyTypeEnum = pgEnum('allergy_type', [
    'drug', 'food', 'environmental', 'other'
]);

export const allergySeverityEnum = pgEnum('allergy_severity', [
    'mild', 'moderate', 'severe', 'life_threatening'
]);

export const labTestStatusEnum = pgEnum('lab_test_status', [
    'ordered',
    'sample_collected',
    'in_progress',
    'completed',
    'resulted',
    'cancelled'
]);

export const specimenTypeEnum = pgEnum('specimen_type', [
    'blood', 'urine', 'stool', 'sputum', 'csf', 'tissue', 'swab', 'other'
]);

export const imagingModalityEnum = pgEnum('imaging_modality', [
    'x-ray',
    'ct_scan',
    'mri',
    'ultrasound',
    'pet_scan',
    'mammogram',
    'fluoroscopy'
]);

export const imagingStatusEnum = pgEnum('imaging_status', [
    'ordered', 'scheduled', 'in_progress', 'completed', 'reported', 'cancelled'
]);

export const prescriptionStatusEnum = pgEnum('prescription_status', [
    'prescribed',
    'dispensing',
    'dispensed',
    'administered',
    'discontinued',
    'cancelled'
]);

export const medicationRouteEnum = pgEnum('medication_route', [
    'oral',
    'intravenous',
    'intramuscular',
    'subcutaneous',
    'topical',
    'inhalation',
    'rectal',
    'sublingual'
]);

export const dosageFormEnum = pgEnum('dosage_form', [
    'tablet',
    'capsule',
    'syrup',
    'injection',
    'cream',
    'ointment',
    'drops',
    'inhaler',
    'suppository'
]);

export const frequencyEnum = pgEnum('frequency', [
    'once_daily',
    'twice_daily',
    'three_times_daily',
    'four_times_daily',
    'every_4_hours',
    'every_6_hours',
    'every_8_hours',
    'as_needed',
    'stat'
]);

export const permissionTypeEnum = pgEnum('permission_type', ['read', 'write', 'full']);

export const actionTypeEnum = pgEnum('action_type', [
    'view',
    'create',
    'update',
    'delete',
    'permission_grant',
    'permission_revoke',
    'emergency_override'
]);

export const requestStatusEnum = pgEnum('request_status', [
    'pending', 'approved', 'rejected', 'expired'
]);

// ==================== INSTITUTIONS ====================

export const institutions = pgTable('institutions', {
    id: uuid('id').defaultRandom().primaryKey(),
    institutionCode: text('institution_code').notNull().unique(),
    institutionName: text('institution_name').notNull(),
    institutionType: text('institution_type').notNull(),
    blockchainAddress: text('blockchain_address').notNull().unique(),
    addressEncrypted: text('address_encrypted').notNull(),
    phoneEncrypted: text('phone_encrypted').notNull(),
    emailEncrypted: text('email_encrypted'),
    licenseNumber: text('license_number').notNull().unique(),
    accreditationStatus: text('accreditation_status'),
    accreditationExpiry: date('accreditation_expiry'),
    bedCapacity: integer('bed_capacity'),
    specialties: jsonb('specialties'),
    services: jsonb('services'),
    isActive: boolean('is_active').default(true).notNull(),
    adminUserId: uuid('admin_user_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    codeIdx: index('idx_institutions_code').on(table.institutionCode),
    blockchainIdx: index('idx_institutions_blockchain_address').on(table.blockchainAddress),
    activeIdx: index('idx_institutions_is_active').on(table.isActive),
}));

export const departments = pgTable('departments', {
    id: uuid('id').defaultRandom().primaryKey(),
    institutionId: uuid('institution_id').notNull().references(() => institutions.id),
    departmentCode: text('department_code').notNull(),
    departmentName: text('department_name').notNull(),
    departmentType: text('department_type'),
    location: text('location'),
    phone: text('phone'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    institutionIdx: index('idx_departments_institution_id').on(table.institutionId),
    uniqueCode: unique('unique_dept_code').on(table.institutionId, table.departmentCode),
}));

export const wards = pgTable('wards', {
    id: uuid('id').defaultRandom().primaryKey(),
    departmentId: uuid('department_id').notNull().references(() => departments.id),
    institutionId: uuid('institution_id').notNull().references(() => institutions.id),
    wardCode: text('ward_code').notNull(),
    wardName: text('ward_name').notNull(),
    wardType: text('ward_type'),
    bedCount: integer('bed_count').notNull(),
    availableBeds: integer('available_beds').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    deptIdx: index('idx_wards_department_id').on(table.departmentId),
    instIdx: index('idx_wards_institution_id').on(table.institutionId),
    uniqueCode: unique('unique_ward_code').on(table.institutionId, table.wardCode),
}));

// ==================== CORE IDENTITY TABLES ====================

export const patients = pgTable('patients', {
    id: uuid('id').defaultRandom().primaryKey(),
    blockchainAddress: text('blockchain_address').notNull().unique(),
    firstNameEncrypted: text('first_name_encrypted').notNull(),
    lastNameEncrypted: text('last_name_encrypted').notNull(),
    middleNameEncrypted: text('middle_name_encrypted'),
    dateOfBirthEncrypted: text('date_of_birth_encrypted').notNull(),
    gender: genderEnum('gender').notNull(),
    bloodType: bloodTypeEnum('blood_type').default('unknown'),
    phoneNumberEncrypted: text('phone_number_encrypted').notNull(),
    emailEncrypted: text('email_encrypted'),
    addressEncrypted: text('address_encrypted').notNull(),
    emergencyContactEncrypted: text('emergency_contact_encrypted').notNull(),
    nationalIdEncrypted: text('national_id_encrypted').unique(),
    maritalStatus: maritalStatusEnum('marital_status'),
    occupation: text('occupation'),
    passwordHash: text('password_hash').notNull(),
    profilePhotoUrl: text('profile_photo_url'),
    isMinor: boolean('is_minor').default(false).notNull(),
    temporaryPatientId: text('temporary_patient_id').unique(),
    mustChangePassword: boolean('must_change_password').default(false).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    isDeceased: boolean('is_deceased').default(false).notNull(),
    deceasedDate: timestamp('deceased_date'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    blockchainIdx:      index('idx_patients_blockchain_address').on(table.blockchainAddress),
    nationalIdIdx:      index('idx_patients_national_id').on(table.nationalIdEncrypted),
    temporaryIdIdx:     index('idx_patients_temporary_id').on(table.temporaryPatientId),
    activeIdx:          index('idx_patients_is_active').on(table.isActive),
    isMinorIdx:         index('idx_patients_is_minor').on(table.isMinor),
}));

// ─── Patient guardians (for minor patients under 16) ──────────────
// guardianPatientId → FK to an existing adult patient account.
// relationship: 'mother' | 'father' | 'legal_guardian' | 'grandparent' | 'other'
// endsAt auto-set to the minor's 16th birthday at creation time.
// A minor must always have at least one canConsent=true guardian.
export const patientGuardians = pgTable('patient_guardians', {
    id:                  uuid('id').defaultRandom().primaryKey(),
    patientId:           uuid('patient_id').notNull().references(() => patients.id),
    guardianPatientId:   uuid('guardian_patient_id').notNull().references(() => patients.id),
    relationship:        text('relationship').notNull(),
    isPrimary:           boolean('is_primary').default(false).notNull(),
    canConsent:          boolean('can_consent').default(true).notNull(),
    startsAt:            timestamp('starts_at').defaultNow().notNull(),
    endsAt:              timestamp('ends_at'),
    documentReference:   text('document_reference'),
    verifiedByStaffId:   uuid('verified_by_staff_id').references(() => practitioners.id),
    createdAt:           timestamp('created_at').defaultNow().notNull(),
    updatedAt:           timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    patientIdx:         index('idx_patient_guardians_patient_id').on(table.patientId),
    guardianIdx:        index('idx_patient_guardians_guardian_patient_id').on(table.guardianPatientId),
}));

// ─── Unified staff table (practitioners) ───────────────────────────
export const practitioners = pgTable('practitioners', {
    id: uuid('id').defaultRandom().primaryKey(),
    blockchainAddress: text('blockchain_address').notNull().unique(),
    institutionId: uuid('institution_id').references(() => institutions.id),
    firstNameEncrypted: text('first_name_encrypted').notNull(),
    lastNameEncrypted: text('last_name_encrypted').notNull(),
    licenseNumber: text('license_number').notNull().unique(),
    institutionalId: text('institutional_id').notNull(),
    specialization: text('specialization'),               // for practitioners, lab techs, radiologists
    department: text('department'),                        // department (any staff)
    shift: text('shift'),                                  // for nurses only
    phoneNumberEncrypted: text('phone_number_encrypted').notNull(),
    emailEncrypted: text('email_encrypted').notNull(),
    credentialsEncrypted: text('credentials_encrypted'),  // for practitioners
    qualifications: text('qualifications'),                // for practitioners
    role: userTypeEnum('role').notNull(),                  // e.g. 'nurse', 'practitioner', 'pharmacist', etc.
    isVerified: boolean('is_verified').default(false).notNull(),
    mustChangePassword: boolean('must_change_password').default(true).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    passwordHash: text('password_hash').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    lastSeenAt: timestamp('last_seen_at'),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    blockchainIdx: index('idx_practitioners_blockchain_address').on(table.blockchainAddress),
    licenseIdx: index('idx_practitioners_license_number').on(table.licenseNumber),
    institutionIdx: index('idx_practitioners_institution_id').on(table.institutionId),
    deptIdx: index('idx_practitioners_department').on(table.department),
    activeIdx: index('idx_practitioners_is_active').on(table.isActive),
    roleIdx: index('idx_practitioners_role').on(table.role),
}));

// ==================== PATIENT-INSTITUTION LINK ====================
export const patientInstitutionRegistrations = pgTable('patient_institution_registrations', {
    id: uuid('id').defaultRandom().primaryKey(),
    patientId: uuid('patient_id').notNull().references(() => patients.id),
    institutionId: uuid('institution_id').notNull().references(() => institutions.id),
    hospitalPatientNumber: text('hospital_patient_number').notNull(),
    registeredAt: timestamp('registered_at').defaultNow().notNull(),
    lastVisitAt: timestamp('last_visit_at'),
    isActive: boolean('is_active').default(true).notNull(),

    isHomeInstitution: boolean('is_home_institution').default(false).notNull(),
    // ─────────────────────────────────────────────────────────────────────────

    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    patientIdx: index('idx_patient_inst_reg_patient_id').on(table.patientId),
    institutionIdx: index('idx_patient_inst_reg_institution_id').on(table.institutionId),
    hospitalNumberIdx: index('idx_patient_inst_reg_hospital_number').on(table.hospitalPatientNumber),
    // Add index for fast home institution lookup
    homeIdx: index('idx_patient_inst_reg_is_home').on(table.patientId, table.isHomeInstitution),
    uniquePatientInst: unique('unique_patient_institution').on(table.patientId, table.institutionId),
    uniqueInstNumber: unique('unique_institution_number').on(table.institutionId, table.hospitalPatientNumber),
}));



export const visits = pgTable('visits', {
    id: uuid('id').defaultRandom().primaryKey(),
    patientId: uuid('patient_id').notNull().references(() => patients.id),
    institutionId: uuid('institution_id').references(() => institutions.id),
    departmentId: uuid('department_id').references(() => departments.id),
    wardId: uuid('ward_id').references(() => wards.id),
    visitNumber: text('visit_number').notNull().unique(),
    visitType: visitTypeEnum('visit_type').notNull(),
    admissionDate: timestamp('admission_date').notNull(),
    dischargeDate: timestamp('discharge_date'),
    chiefComplaint: text('chief_complaint'),
    admittingDiagnosis: text('admitting_diagnosis'),
    dischargeDiagnosis: text('discharge_diagnosis'),
    wardOrRoom: text('ward_or_room'),
    bedNumber: text('bed_number'),
    status: encounterStatusEnum('status').default('in-progress').notNull(),
    priority: priorityLevelEnum('priority').default('routine').notNull(),
    dischargeSummary: text('discharge_summary'),
    dischargeInstructions: text('discharge_instructions'),
    followUpDate: timestamp('follow_up_date'),
    blockchainHash: text('blockchain_hash').notNull(),
    dischargeBlockchainHash: text('discharge_blockchain_hash'),
    assignedNurseId: uuid('assigned_nurse_id').references(() => practitioners.id),
    assignedDoctorId: uuid('assigned_doctor_id').references(() => practitioners.id),
    createdByPractitionerId: uuid('created_by_practitioner_id').references(() => practitioners.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    patientIdx: index('idx_visits_patient_id').on(table.patientId),
    institutionIdx: index('idx_visits_institution_id').on(table.institutionId),
    visitNumberIdx: index('idx_visits_visit_number').on(table.visitNumber),
    statusIdx: index('idx_visits_status').on(table.status),
    admissionIdx: index('idx_visits_admission_date').on(table.admissionDate),
    nurseIdx: index('idx_visits_assigned_nurse').on(table.assignedNurseId),
    doctorIdx: index('idx_visits_assigned_doctor').on(table.assignedDoctorId),

}));

export const wardBeds = pgTable('ward_beds', {
    id: uuid('id').defaultRandom().primaryKey(),
    wardId: uuid('ward_id').notNull().references(() => wards.id),
    institutionId: uuid('institution_id').notNull().references(() => institutions.id),
    bedCode: text('bed_code').notNull(),
    bedType: text('bed_type').default('general').notNull(),
    status: text('status').default('available').notNull(), // available | occupied | maintenance
    currentVisitId: uuid('current_visit_id').references(() => visits.id),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    wardIdx:        index('idx_ward_beds_ward_id').on(table.wardId),
    institutionIdx: index('idx_ward_beds_institution_id').on(table.institutionId),
    statusIdx:      index('idx_ward_beds_status').on(table.status),
    visitIdx:       index('idx_ward_beds_visit_id').on(table.currentVisitId),
    uniqueBedCode:  unique('unique_bed_code').on(table.wardId, table.bedCode),
}));

// ==================== NURSING RECORDS ====================

export const vitalSigns = pgTable('vital_signs', {
    id: uuid('id').defaultRandom().primaryKey(),
    visitId: uuid('visit_id').notNull().references(() => visits.id),
    patientId: uuid('patient_id').notNull().references(() => patients.id),
    recordedByNurseId: uuid('recorded_by_nurse_id').notNull().references(() => practitioners.id), // now references practitioners
    temperature: decimal('temperature', { precision: 4, scale: 1 }),
    bloodPressureSystolic: integer('blood_pressure_systolic'),
    bloodPressureDiastolic: integer('blood_pressure_diastolic'),
    pulseRate: integer('pulse_rate'),
    respiratoryRate: integer('respiratory_rate'),
    oxygenSaturation: integer('oxygen_saturation'),
    weight: decimal('weight', { precision: 5, scale: 2 }),
    height: decimal('height', { precision: 5, scale: 2 }),
    bmi: decimal('bmi', { precision: 4, scale: 1 }),
    painLevel: integer('pain_level'),
    nurseNotes: text('nurse_notes'),
    blockchainHash: text('blockchain_hash').notNull(),
    blockchainTransactionId: text('blockchain_transaction_id'),
    recordedAt: timestamp('recorded_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    visitIdx: index('idx_vital_signs_visit_id').on(table.visitId),
    patientIdx: index('idx_vital_signs_patient_id').on(table.patientId),
    recordedAtIdx: index('idx_vital_signs_recorded_at').on(table.recordedAt),
}));

// ==================== MEDICAL HISTORY ====================

export const allergies = pgTable('allergies', {
    id: uuid('id').defaultRandom().primaryKey(),
    patientId: uuid('patient_id').notNull().references(() => patients.id),
    allergen: text('allergen').notNull(),
    allergyType: allergyTypeEnum('allergy_type').notNull(),
    severity: allergySeverityEnum('severity').notNull(),
    reaction: text('reaction').notNull(),
    onsetDate: date('onset_date'),
    notes: text('notes'),
    recordedByPractitionerId: uuid('recorded_by_practitioner_id').references(() => practitioners.id),
    isActive: boolean('is_active').default(true).notNull(),
    blockchainHash: text('blockchain_hash').notNull(),
    blockchainTransactionId: text('blockchain_transaction_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    patientIdx: index('idx_allergies_patient_id').on(table.patientId),
    activeIdx: index('idx_allergies_is_active').on(table.isActive),
}));

export const medicalHistory = pgTable('medical_history', {
    id: uuid('id').defaultRandom().primaryKey(),
    patientId: uuid('patient_id').notNull().references(() => patients.id),
    condition: text('condition').notNull(),
    diagnosedDate: date('diagnosed_date'),
    status: text('status').notNull(),
    notes: text('notes'),
    recordedByPractitionerId: uuid('recorded_by_practitioner_id').references(() => practitioners.id),
    blockchainHash: text('blockchain_hash').notNull(),
    blockchainTransactionId: text('blockchain_transaction_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    patientIdx: index('idx_medical_history_patient_id').on(table.patientId),
}));

export const familyMedicalHistory = pgTable('family_medical_history', {
    id: uuid('id').defaultRandom().primaryKey(),
    patientId: uuid('patient_id').notNull().references(() => patients.id),
    relationship: text('relationship').notNull(),
    condition: text('condition').notNull(),
    ageAtDiagnosis: integer('age_at_diagnosis'),
    isDeceased: boolean('is_deceased').default(false),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    patientIdx: index('idx_family_medical_history_patient_id').on(table.patientId),
}));

// ==================== CONSULTATIONS ====================

export const consultations = pgTable('consultations', {
    id: uuid('id').defaultRandom().primaryKey(),
    visitId: uuid('visit_id').notNull().references(() => visits.id),
    patientId: uuid('patient_id').notNull().references(() => patients.id),
    practitionerId: uuid('practitioner_id').notNull().references(() => practitioners.id),
    chiefComplaint: text('chief_complaint').notNull(),
    historyOfPresentIllness: text('history_of_present_illness'),
    reviewOfSystems: text('review_of_systems'),
    physicalExamination: text('physical_examination'),
    clinicalFindings: text('clinical_findings'),
    assessment: text('assessment'),
    plan: text('plan'),
    followUpInstructions: text('follow_up_instructions'),
    nextAppointmentDate: timestamp('next_appointment_date'),
    consultationDate: timestamp('consultation_date').defaultNow().notNull(),
    blockchainHash: text('blockchain_hash').notNull(),
    blockchainTransactionId: text('blockchain_transaction_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    visitIdx: index('idx_consultations_visit_id').on(table.visitId),
    patientIdx: index('idx_consultations_patient_id').on(table.patientId),
    practitionerIdx: index('idx_consultations_practitioner_id').on(table.practitionerId),
    dateIdx: index('idx_consultations_consultation_date').on(table.consultationDate),
}));

export const diagnoses = pgTable('diagnoses', {
    id: uuid('id').defaultRandom().primaryKey(),
    consultationId: uuid('consultation_id').notNull().references(() => consultations.id),
    visitId: uuid('visit_id').notNull().references(() => visits.id),
    patientId: uuid('patient_id').notNull().references(() => patients.id),
    practitionerId: uuid('practitioner_id').notNull().references(() => practitioners.id),
    icdCode: text('icd_code'),
    diagnosisName: text('diagnosis_name').notNull(),
    diagnosisType: diagnosisStatusEnum('diagnosis_type').notNull(),
    severity: text('severity'),
    notes: text('notes'),
    diagnosedAt: timestamp('diagnosed_at').defaultNow().notNull(),
    blockchainHash: text('blockchain_hash').notNull(),
    blockchainTransactionId: text('blockchain_transaction_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    consultationIdx: index('idx_diagnoses_consultation_id').on(table.consultationId),
    visitIdx: index('idx_diagnoses_visit_id').on(table.visitId),
    patientIdx: index('idx_diagnoses_patient_id').on(table.patientId),
}));

// ==================== LABORATORY ====================

export const labTestOrders = pgTable('lab_test_orders', {
    id: uuid('id').defaultRandom().primaryKey(),
    orderNumber: text('order_number').notNull().unique(),
    visitId: uuid('visit_id').notNull().references(() => visits.id),
    patientId: uuid('patient_id').notNull().references(() => patients.id),
    orderedByPractitionerId: uuid('ordered_by_practitioner_id').notNull().references(() => practitioners.id),
    testName: text('test_name').notNull(),
    testCode: text('test_code'),
    testCategory: text('test_category'),
    specimenType: specimenTypeEnum('specimen_type').notNull(),
    clinicalNotes: text('clinical_notes'),
    urgency: priorityLevelEnum('urgency').default('routine').notNull(),
    status: labTestStatusEnum('status').default('ordered').notNull(),
    orderedAt: timestamp('ordered_at').defaultNow().notNull(),
    sampleCollectedAt: timestamp('sample_collected_at'),
    collectedByNurseId: uuid('collected_by_nurse_id').references(() => practitioners.id), // now references practitioners
    assignedTo: uuid('assigned_to').references(() => practitioners.id),
    blockchainHash: text('blockchain_hash').notNull(),
    blockchainTransactionId: text('blockchain_transaction_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    orderNumberIdx: index('idx_lab_test_orders_order_number').on(table.orderNumber),
    visitIdx: index('idx_lab_test_orders_visit_id').on(table.visitId),
    patientIdx: index('idx_lab_test_orders_patient_id').on(table.patientId),
    statusIdx: index('idx_lab_test_orders_status').on(table.status),
}));

export const labTestResults = pgTable('lab_test_results', {
    id: uuid('id').defaultRandom().primaryKey(),
    labTestOrderId: uuid('lab_test_order_id').notNull().references(() => labTestOrders.id),
    performedByLabTechId: uuid('performed_by_lab_tech_id').notNull().references(() => practitioners.id), // now references practitioners
    resultsData: jsonb('results_data').notNull(),
    interpretation: text('interpretation'),
    abnormalFindings: text('abnormal_findings'),
    referenceRanges: jsonb('reference_ranges'),
    attachmentUrls: jsonb('attachment_urls'),
    resultedAt: timestamp('resulted_at').defaultNow().notNull(),
    verifiedAt: timestamp('verified_at'),
    blockchainHash: text('blockchain_hash').notNull(),
    blockchainTransactionId: text('blockchain_transaction_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    orderIdx: index('idx_lab_test_results_order_id').on(table.labTestOrderId),
}));

// ==================== RADIOLOGY / IMAGING ====================

export const imagingOrders = pgTable('imaging_orders', {
    id: uuid('id').defaultRandom().primaryKey(),
    orderNumber: text('order_number').notNull().unique(),
    visitId: uuid('visit_id').notNull().references(() => visits.id),
    patientId: uuid('patient_id').notNull().references(() => patients.id),
    orderedByPractitionerId: uuid('ordered_by_practitioner_id').notNull().references(() => practitioners.id),
    modality: imagingModalityEnum('modality').notNull(),
    bodyPart: text('body_part').notNull(),
    indication: text('indication').notNull(),
    urgency: priorityLevelEnum('urgency').default('routine').notNull(),
    status: imagingStatusEnum('status').default('ordered').notNull(),
    scheduledDateTime: timestamp('scheduled_date_time'),
    orderedAt: timestamp('ordered_at').defaultNow().notNull(),
    assignedTo: uuid('assigned_to').references(() => practitioners.id),
    blockchainHash: text('blockchain_hash').notNull(),
    blockchainTransactionId: text('blockchain_transaction_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    orderNumberIdx: index('idx_imaging_orders_order_number').on(table.orderNumber),
    visitIdx: index('idx_imaging_orders_visit_id').on(table.visitId),
    patientIdx: index('idx_imaging_orders_patient_id').on(table.patientId),
    statusIdx: index('idx_imaging_orders_status').on(table.status),
}));

export const imagingReports = pgTable('imaging_reports', {
    id: uuid('id').defaultRandom().primaryKey(),
    imagingOrderId: uuid('imaging_order_id').notNull().references(() => imagingOrders.id),
    performedByRadiologistId: uuid('performed_by_radiologist_id').notNull().references(() => practitioners.id), // now references practitioners
    findings: text('findings').notNull(),
    impression: text('impression').notNull(),
    recommendations: text('recommendations'),
    imageUrls: jsonb('image_urls').notNull(),
    performedAt: timestamp('performed_at').defaultNow().notNull(),
    reportedAt: timestamp('reported_at').defaultNow().notNull(),
    blockchainHash: text('blockchain_hash').notNull(),
    blockchainTransactionId: text('blockchain_transaction_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    orderIdx: index('idx_imaging_reports_order_id').on(table.imagingOrderId),
}));

// ==================== PRESCRIPTIONS & PHARMACY ====================

export const prescriptions = pgTable('prescriptions', {
    id: uuid('id').defaultRandom().primaryKey(),
    prescriptionNumber: text('prescription_number').notNull().unique(),
    visitId: uuid('visit_id').notNull().references(() => visits.id),
    patientId: uuid('patient_id').notNull().references(() => patients.id),
    prescribedByPractitionerId: uuid('prescribed_by_practitioner_id').notNull().references(() => practitioners.id),
    status: prescriptionStatusEnum('status').default('prescribed').notNull(),
    prescribedAt: timestamp('prescribed_at').defaultNow().notNull(),
    blockchainHash: text('blockchain_hash').notNull(),
    blockchainTransactionId: text('blockchain_transaction_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    numberIdx: index('idx_prescriptions_number').on(table.prescriptionNumber),
    visitIdx: index('idx_prescriptions_visit_id').on(table.visitId),
    patientIdx: index('idx_prescriptions_patient_id').on(table.patientId),
    statusIdx: index('idx_prescriptions_status').on(table.status),
}));

export const prescriptionItems = pgTable('prescription_items', {
    id: uuid('id').defaultRandom().primaryKey(),
    prescriptionId: uuid('prescription_id').notNull().references(() => prescriptions.id),
    medicationName: text('medication_name').notNull(),
    genericName: text('generic_name'),
    strength: text('strength').notNull(),
    dosageForm: dosageFormEnum('dosage_form').notNull(),
    dose: text('dose').notNull(),
    frequency: frequencyEnum('frequency').notNull(),
    route: medicationRouteEnum('route').notNull(),
    duration: text('duration').notNull(),
    quantity: integer('quantity').notNull(),
    refillsAllowed: integer('refills_allowed').default(0),
    instructions: text('instructions'),
    isDispensed: boolean('is_dispensed').default(false).notNull(),
    dispensedByPharmacistId: uuid('dispensed_by_pharmacist_id').references(() => practitioners.id), // now references practitioners
    dispensedAt: timestamp('dispensed_at'),
    dispensedQuantity: integer('dispensed_quantity'),
    // Blockchain hash for dispense event (optional)
    blockchainHash: text('blockchain_hash'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    prescriptionIdx: index('idx_prescription_items_prescription_id').on(table.prescriptionId),
    dispensedIdx: index('idx_prescription_items_is_dispensed').on(table.isDispensed),
}));

export const medicationAdministration = pgTable('medication_administration', {
    id: uuid('id').defaultRandom().primaryKey(),
    prescriptionItemId: uuid('prescription_item_id').notNull().references(() => prescriptionItems.id),
    visitId: uuid('visit_id').notNull().references(() => visits.id),
    patientId: uuid('patient_id').notNull().references(() => patients.id),
    administeredByNurseId: uuid('administered_by_nurse_id').notNull().references(() => practitioners.id), // now references practitioners
    doseGiven: text('dose_given').notNull(),
    route: medicationRouteEnum('route').notNull(),
    scheduledTime: timestamp('scheduled_time').notNull(),
    administeredTime: timestamp('administered_time').notNull(),
    notes: text('notes'),
    adverseReaction: text('adverse_reaction'),
    blockchainHash: text('blockchain_hash').notNull(),
    blockchainTransactionId: text('blockchain_transaction_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    visitIdx: index('idx_medication_administration_visit_id').on(table.visitId),
    patientIdx: index('idx_medication_administration_patient_id').on(table.patientId),
}));

// ==================== BLOCKCHAIN & SECURITY ====================

export const accessPermissions = pgTable('access_permissions', {
    id: uuid('id').defaultRandom().primaryKey(),
    patientId: uuid('patient_id').notNull().references(() => patients.id),
    grantedToUserId: uuid('granted_to_user_id').notNull(),
    grantedToUserType: userTypeEnum('granted_to_user_type').notNull(),
    permissionType: permissionTypeEnum('permission_type').notNull(),
    allowedRecordTypes: jsonb('allowed_record_types').notNull(),
    grantedAt: timestamp('granted_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    blockchainTransactionId: text('blockchain_transaction_id'),
    isActive: boolean('is_active').default(true).notNull(),
    isEmergencyOverride: boolean('is_emergency_override').default(false).notNull(),
    emergencyReason: text('emergency_reason'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    patientIdx: index('idx_access_permissions_patient_id').on(table.patientId),
    grantedToIdx: index('idx_access_permissions_granted_to').on(table.grantedToUserId),
    expiresIdx: index('idx_access_permissions_expires_at').on(table.expiresAt),
    activeIdx: index('idx_access_permissions_is_active').on(table.isActive),
}));

export const auditLogs = pgTable('audit_logs', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(),
    userType: userTypeEnum('user_type').notNull(),
    patientId: uuid('patient_id').notNull().references(() => patients.id),
    actionType: actionTypeEnum('action_type').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: uuid('resource_id'),
    timestamp: timestamp('timestamp').defaultNow().notNull(),
    blockchainTransactionId: text('blockchain_transaction_id').notNull(),
    isEmergencyOverride: boolean('is_emergency_override').default(false).notNull(),
    accessReason: text('access_reason'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    patientIdx: index('idx_audit_logs_patient_id').on(table.patientId),
    userIdx: index('idx_audit_logs_user_id').on(table.userId),
    timestampIdx: index('idx_audit_logs_timestamp').on(table.timestamp),
    actionIdx: index('idx_audit_logs_action_type').on(table.actionType),
}));

// ==================== AUTHENTICATION ====================

export const authSessions = pgTable('auth_sessions', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(),
    userType: userTypeEnum('user_type').notNull(),
    jwtToken: text('jwt_token').notNull(),
    refreshToken: text('refresh_token').notNull(),
    twoFaVerified: boolean('two_fa_verified').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
}, (table) => ({
    userIdx: index('idx_auth_sessions_user_id').on(table.userId),
    activeIdx: index('idx_auth_sessions_is_active').on(table.isActive),
    tokenIdx: index('idx_auth_sessions_jwt_token').on(table.jwtToken),
}));


export const otpCodes = pgTable('otp_codes', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    userType: varchar('user_type', { length: 20 }).notNull(), // 'staff' | 'patient'
    code: varchar('code', { length: 6 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    used: boolean('used').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});


export const twoFaSecrets = pgTable('two_fa_secrets', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(),
    userType: userTypeEnum('user_type').notNull(),
    secretEncrypted: text('secret_encrypted').notNull(),
    backupCodesEncrypted: text('backup_codes_encrypted').notNull(),
    isEnabled: boolean('is_enabled').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    userIdx: index('idx_two_fa_secrets_user_id').on(table.userId),
}));

export const accessRequests = pgTable('access_requests', {
    id: uuid('id').defaultRandom().primaryKey(),
    requestedByUserId: uuid('requested_by_user_id').notNull(),
    requestedByUserType: userTypeEnum('requested_by_user_type').notNull(),
    patientId: uuid('patient_id').notNull().references(() => patients.id),
    visitId: uuid('visit_id').references(() => visits.id),
    requestedPermissions: jsonb('requested_permissions').notNull(),
    reason: text('reason').notNull(),
    status: requestStatusEnum('status').default('pending').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    respondedAt: timestamp('responded_at'),
    expiresAt: timestamp('expires_at').notNull(),
    responseNote: text('response_note'),
    approvedByGuardianId: uuid('approved_by_guardian_id').references(() => patients.id),
}, (table) => ({
    patientIdx: index('idx_access_requests_patient_id').on(table.patientId),
    requestedByIdx: index('idx_access_requests_requested_by').on(table.requestedByUserId),
    statusIdx: index('idx_access_requests_status').on(table.status),
    visitIdx: index('idx_access_requests_visit_id').on(table.visitId),  // ← ADD THIS LINE
}));

// ==================== REFERRALS ====================

export const referrals = pgTable('referrals', {
    id: uuid('id').defaultRandom().primaryKey(),
    referralNumber: text('referral_number').notNull().unique(),
    patientId: uuid('patient_id').notNull().references(() => patients.id),
    visitId: uuid('visit_id').references(() => visits.id),
    referringInstitutionId: uuid('referring_institution_id').notNull().references(() => institutions.id),
    referringPractitionerId: uuid('referring_practitioner_id').notNull().references(() => practitioners.id),
    receivingInstitutionId: uuid('receiving_institution_id').notNull().references(() => institutions.id),
    receivingDepartmentId: uuid('receiving_department_id').references(() => departments.id),
    receivingPractitionerId: uuid('receiving_practitioner_id').references(() => practitioners.id),
    reason: text('reason').notNull(),
    clinicalSummary: text('clinical_summary').notNull(),
    urgency: priorityLevelEnum('urgency').default('routine').notNull(),
    status: text('status').default('pending').notNull(),
    referredAt: timestamp('referred_at').defaultNow().notNull(),
    acceptedAt: timestamp('accepted_at'),
    completedAt: timestamp('completed_at'),
    responseNotes: text('response_notes'),
    blockchainHash: text('blockchain_hash').notNull(),
    blockchainTransactionId: text('blockchain_transaction_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    patientIdx: index('idx_referrals_patient_id').on(table.patientId),
    referringInstIdx: index('idx_referrals_referring_inst').on(table.referringInstitutionId),
    receivingInstIdx: index('idx_referrals_receiving_inst').on(table.receivingInstitutionId),
    statusIdx: index('idx_referrals_status').on(table.status),
}));









// Cross-institution access grants
export const crossInstitutionAccess = pgTable('cross_institution_access', {
    id: uuid('id').defaultRandom().primaryKey(),
    patientId: uuid('patient_id').notNull().references(() => patients.id),
    sourceInstitutionId: uuid('source_institution_id').notNull().references(() => institutions.id),
    targetInstitutionId: uuid('target_institution_id').notNull().references(() => institutions.id),
    accessType: text('access_type').notNull(), // 'referral', 'transfer', 'emergency', 'patient_consent'
    grantedBy: uuid('granted_by').notNull(),
    grantedAt: timestamp('granted_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at'),
    reason: text('reason').notNull(),
    status: text('status').default('active').notNull(), // 'active', 'expired', 'revoked'
    blockchainHash: text('blockchain_hash').notNull(),
    blockchainTransactionId: text('blockchain_transaction_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    patientIdx: index('idx_cross_access_patient').on(table.patientId),
    sourceIdx: index('idx_cross_access_source').on(table.sourceInstitutionId),
    targetIdx: index('idx_cross_access_target').on(table.targetInstitutionId),
    statusIdx: index('idx_cross_access_status').on(table.status),
    uniqueAccess: unique('unique_cross_access').on(table.patientId, table.sourceInstitutionId, table.targetInstitutionId),
}));

// Emergency access logs
export const emergencyAccessLogs = pgTable('emergency_access_logs', {
    id: uuid('id').defaultRandom().primaryKey(),
    patientId: uuid('patient_id').notNull().references(() => patients.id),
    accessedBy: uuid('accessed_by').notNull(),
    accessedByInstitutionId: uuid('accessed_by_institution_id').notNull().references(() => institutions.id),
    reason: text('reason').notNull(),
    accessedAt: timestamp('accessed_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    blockchainHash: text('blockchain_hash').notNull(),
    blockchainTransactionId: text('blockchain_transaction_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    patientIdx: index('idx_emergency_patient').on(table.patientId),
    accessedByIdx: index('idx_emergency_accessed_by').on(table.accessedBy),
}));



// ==================== SENSITIVE MEDICAL RECORDS (Doctor-only) ====================

export const patientSensitiveRecords = pgTable('patient_sensitive_records', {
    id: uuid('id').defaultRandom().primaryKey(),
    patientId: uuid('patient_id').notNull().references(() => patients.id),
    category: text('category').notNull(), // 'infectious_disease' | 'mental_health' | 'reproductive' | 'genetic' | 'substance_use' | 'other'
    condition: text('condition').notNull(),
    status: text('status').notNull(),     // 'positive' | 'negative' | 'carrier' | 'resolved' | 'active' | 'unknown'
    diagnosedDate: date('diagnosed_date'),
    notes: text('notes'),
    recordedByPractitionerId: uuid('recorded_by_practitioner_id').references(() => practitioners.id),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    patientIdx:   index('idx_sensitive_records_patient_id').on(table.patientId),
    categoryIdx:  index('idx_sensitive_records_category').on(table.category),
    activeIdx:    index('idx_sensitive_records_is_active').on(table.isActive),
}));

export const medicationStock = pgTable('medication_stock', {
    id: uuid('id').primaryKey().defaultRandom(),
    institutionId: uuid('institution_id').notNull(),
    medicationName: text('medication_name').notNull(),
    genericName: text('generic_name'),
    strength: text('strength').notNull(),
    dosageForm: text('dosage_form').notNull(),
    unit: text('unit').notNull().default('units'),
    quantity: integer('quantity').notNull().default(0),
    reorderLevel: integer('reorder_level').notNull().default(10),
    batchNumber: text('batch_number'),
    expiryDate: date('expiry_date'),
    supplier: text('supplier'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const stockMovements = pgTable('stock_movements', {
    id: uuid('id').primaryKey().defaultRandom(),
    stockId: uuid('stock_id').notNull(),
    institutionId: uuid('institution_id').notNull(),
    changeType: text('change_type').notNull(),
    quantityChange: integer('quantity_change').notNull(),
    quantityAfter: integer('quantity_after').notNull(),
    referenceId: uuid('reference_id'),
    performedBy: uuid('performed_by').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});