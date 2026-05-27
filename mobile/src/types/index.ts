// ── Auth ──────────────────────────────────────────────────
export type User = {
    id: string;
    type: 'patient';
    blockchainAddress: string;
    firstName: string;
    lastName: string;
};

// ── Visit ─────────────────────────────────────────────────
export type Visit = {
    id: string;
    visitNumber: string;
    patientId: string;
    visitType: 'outpatient' | 'inpatient' | 'emergency' | 'consultation';
    chiefComplaint: string;
    priority: 'routine' | 'urgent' | 'emergency' | 'critical';
    status: 'in-progress' | 'completed' | 'cancelled';
    admissionDate: string;
    dischargeDate?: string;
    dischargeDiagnosis?: string;
    dischargeSummary?: string;
    dischargeInstructions?: string;
    blockchainHash?: string;
};

// ── Vital Signs ───────────────────────────────────────────
export type VitalSigns = {
    id: string;
    visitId: string;
    temperature?: number;
    bloodPressureSystolic?: number;
    bloodPressureDiastolic?: number;
    pulseRate?: number;
    respiratoryRate?: number;
    oxygenSaturation?: number;
    weight?: number;
    height?: number;
    painLevel?: number;
    nurseNotes?: string;
    recordedAt: string;
};

// ── Consultation ──────────────────────────────────────────
export type Consultation = {
    id: string;
    visitId: string;
    chiefComplaint: string;
    historyOfPresentIllness?: string;
    physicalExamination?: string;
    clinicalFindings?: string;
    assessment?: string;
    plan?: string;
    followUpInstructions?: string;
    nextAppointmentDate?: string;
    consultationDate: string;
};

// ── Diagnosis ─────────────────────────────────────────────
export type Diagnosis = {
    id: string;
    visitId: string;
    icdCode: string;
    diagnosisName: string;
    diagnosisType: 'provisional' | 'confirmed' | 'ruled_out' | 'differential';
    severity?: string;
    notes?: string;
};

// ── Lab ───────────────────────────────────────────────────
export type LabOrder = {
    id: string;
    orderNumber: string;
    visitId: string;
    testName: string;
    testCode: string;
    specimenType: string;
    urgency: string;
    status: 'ordered' | 'collected' | 'processing' | 'resulted' | 'cancelled';
    clinicalNotes?: string;
};

export type LabResult = {
    id: string;
    labTestOrderId: string;
    resultsData: Record<string, unknown>;
    interpretation?: string;
    abnormalFindings?: string;
    referenceRanges?: Record<string, unknown>;
};

// ── Imaging ───────────────────────────────────────────────
export type ImagingOrder = {
    id: string;
    orderNumber: string;
    visitId: string;
    modality: string;
    bodyPart: string;
    indication: string;
    urgency: string;
    status: 'ordered' | 'scheduled' | 'completed' | 'reported' | 'cancelled';
};

// ── Prescription ──────────────────────────────────────────
export type Prescription = {
    id: string;
    prescriptionNumber: string;
    visitId: string;
    status: 'prescribed' | 'dispensed' | 'partially_dispensed' | 'cancelled';
};

export type PrescriptionItem = {
    id: string;
    prescriptionId: string;
    medicationName: string;
    genericName?: string;
    strength: string;
    dosageForm: string;
    dose: string;
    frequency: string;
    route: string;
    duration: string;
    quantity: number;
    instructions?: string;
    isDispensed: boolean;
};

// ── Permissions ───────────────────────────────────────────
export type Permission = {
    id: string;
    grantedToUserId: string;
    permissionType: 'read' | 'write' | 'full';
    allowedRecordTypes: string[];
    grantedAt: string;
    expiresAt: string;
    isActive: boolean;
    // enriched on frontend
    granteeName?: string;
    granteeRole?: string;
};

export type AccessRequest = {
    id: string;
    requestedByUserId: string;
    requestedByUserType: string;
    patientId: string;
    visitId?: string;
    requestedPermissions: string[];
    reason: string;
    status: 'pending' | 'approved' | 'rejected' | 'expired';
    expiresAt: string;
    createdAt: string;
    // enriched on frontend
    requesterName?: string;
};

// ── Audit ─────────────────────────────────────────────────
export type AuditLog = {
    id: string;
    userId: string;
    userType: string;
    actionType: string;
    resourceType: string;
    resourceId?: string;
    timestamp: string;
    ipAddress?: string;
};

// ── Navigation param types ────────────────────────────────
export type RootStackParamList = {
    Auth: undefined;
    Main: undefined;
};

export type AuthStackParamList = {
    Login: undefined;
    Register: undefined;
    ChangePassword: undefined;
};

export type MainTabParamList = {
    Records: undefined;
    Access: undefined;
    History: undefined;
    Referrals: undefined;
};

export type RecordsStackParamList = {
    RecordsList: undefined;
    RecordDetail: { visitId: string; visitNumber: string };
    Profile: undefined;
};

export type AccessStackParamList = {
    AccessRequests: undefined;
    WhoHasAccess: undefined;
    RevokeAccess: { permissionId: string; granteeName: string; practitionerId: string };
};


export type ReferralsStackParamList = {
    ReferralsList: undefined;
    Profile: undefined;
};