import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const api = axios.create({
    baseURL: API_BASE,
    headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('hc_token');
        if (token) config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401 && typeof window !== 'undefined') {
            localStorage.removeItem('hc_token');
            localStorage.removeItem('hc_user');
            window.location.href = '/login';
        }
        return Promise.reject(err);
    }
);

// ── Auth ─────────────────────────────────────────────────
export const authApi = {
    loginPractitioner: (data: { licenseNumber: string; password: string }) =>
        api.post('/api/auth/login/practitioner', data),
    loginNurse: (data: { licenseNumber: string; password: string }) =>
        api.post('/api/auth/login/nurse', data),
    loginPatient: (data: { nationalId: string; password: string }) =>
        api.post('/api/auth/login/patient', data),
    loginStaff: (data: { licenseNumber: string; password: string }) =>
        api.post('/api/auth/login/staff', data),
    logout: () => api.post('/api/auth/logout'),
};
// ── Patient types ─────────────────────────────────────────
export interface PatientSummary {
    id: string;
    firstName: string;
    lastName: string;
    gender?: string;
    dateOfBirth?: string;
    nationalId?: string;
    phoneNumber?: string;
    bloodType?: string;
    blockchainAddress?: string;
}

export interface PatientDetail extends PatientSummary {
    middleName?: string | null;
    email?: string | null;
    maritalStatus?: string | null;
    occupation?: string | null;
    address?: string | null;
    nextOfKinName?: string | null;
    nextOfKinPhone?: string | null;
    allergies?: string | null;
    medicalHistory?: string | null;
}

interface ApiResponse<T> {
    success: boolean;
    data: T;
}

interface SearchResponse {
    patients: PatientSummary[];
    total?: number;
}

// ── Patients ─────────────────────────────────────────────
export const patientApi = {
    register: (data: any, institutionId?: string) =>
        api.post('/api/auth/register/patient', institutionId ? { ...data, institutionId } : data),

    search: (query: string) =>
        api.get<ApiResponse<SearchResponse>>(`/api/patients/search?q=${encodeURIComponent(query)}`),

    searchPaginated: (params: { q?: string; limit?: number; offset?: number }) => {
        const p = new URLSearchParams();
        if (params.q) p.set('q', params.q);
        if (params.limit) p.set('limit', String(params.limit));
        if (params.offset) p.set('offset', String(params.offset));
        return api.get<ApiResponse<SearchResponse>>(`/api/patients/search?${p}`);
    },

    getById: (id: string) =>
        api.get<ApiResponse<PatientDetail>>(`/api/patients/${id}`),

    getRegistration: (id: string) => api.get(`/api/patients/${id}/registration`),
    getVisits: (id: string) => api.get(`/api/records/visits/${id}`),
    getHistory: (patientId: string) => api.get(`/api/patients/${patientId}/history`),
    updateInfo: (id: string, data: any) => api.patch(`/api/patients/${id}/update`, data),
    resetPassword: (id: string, newPassword: string) =>
        api.post(`/api/patients/${id}/reset-password`, { newPassword }),
    getAllByInstitution: (institutionId: string, params?: { search?: string; limit?: number; offset?: number }) => {
        const p = new URLSearchParams();
        if (params?.search) p.set('search', params.search);
        if (params?.limit) p.set('limit', String(params.limit));
        if (params?.offset) p.set('offset', String(params.offset));
        const url = `/api/patients/institution/${institutionId}${p.toString() ? `?${p.toString()}` : ''}`;
        return api.get(url);
    },
};
// ── Add these methods to practitionersApi in web/src/lib/api.ts ──────────────
// Replace the existing practitionersApi block with this full version.

export const practitionersApi = {
    getOnlineStaff: (role?: string) => {
        const url = role ? `/api/practitioners/online?role=${role}` : '/api/practitioners/online';
        return api.get(url);
    },
    list: (params?: { limit?: number; offset?: number; role?: string; verified?: boolean; active?: boolean; search?: string; institutionId?: string }) => {
        const p = new URLSearchParams();
        if (params?.limit) p.set('limit', String(params.limit));
        if (params?.offset) p.set('offset', String(params.offset));
        if (params?.role) p.set('role', params.role);
        if (params?.verified !== undefined) p.set('verified', String(params.verified));
        if (params?.active !== undefined) p.set('active', String(params.active));
        if (params?.search) p.set('search', params.search);
        if (params?.institutionId) p.set('institutionId', params.institutionId);
        return api.get(`/api/practitioners?${p}`);
    },
    getById: (id: string) => api.get(`/api/practitioners/${id}`),
    updateProfile: (data: any) => api.patch('/api/practitioners/me', data),

    // ── Admin actions ──────────────────────────────────────────────────────────
    verify: (id: string) => api.patch(`/api/practitioners/${id}/verify`),
    toggleActive: (id: string) => api.patch(`/api/practitioners/${id}/toggle-active`),
    resetPassword: (id: string, newPassword: string) =>
        api.patch(`/api/practitioners/${id}/reset-password`, { newPassword }),
};

// ── Visits ───────────────────────────────────────────────
export const visitApi = {
    getTodayQueue: () => api.get('/api/visits/today'),
    getByVisitNumber: (visitNumber: string) =>
        api.get(`/api/visits/number/${encodeURIComponent(visitNumber)}`),
    getVisitInfo: (visitId: string) =>
        api.get(`/api/visits/${visitId}/info`),
    checkMyPermission: (visitId: string) =>
        api.get(`/api/visits/${visitId}/my-permission`),
    getSummary: (visitId: string) =>
        api.get(`/api/visits/${visitId}/summary`),
    checkActiveVisit: (patientId: string) =>
        api.get(`/api/visits/patient/${patientId}/active`),

    // Receptionist/nurse admission flow — chiefComplaint filled during triage
    create: (body: {
        patientId: string;
        institutionId?: string;
        visitType: string;
        priority: string;
        wardOrRoom?: string;
        bedNumber?: string;
    }) => api.post('/api/visits', body),

    // Doctor direct admission — separate endpoint, bypasses nurse triage for
    // emergency/critical priority. chiefComplaint required, doctor self-assigns.
    doctorAdmit: (body: {
        patientId: string;
        visitType: string;
        priority: string;
        chiefComplaint: string;
        admittingDiagnosis?: string;
        wardOrRoom?: string;
    }) => api.post('/api/visits/doctor-admit', body),

    // ── Assignment ───────────────────────────────────────
    assignNurse: (visitId: string, nurseId: string) =>
        api.post(`/api/visits/${visitId}/assign-nurse`, { nurseId }),
    assignDoctor: (visitId: string, doctorId: string) =>
        api.post(`/api/visits/${visitId}/assign-doctor`, { doctorId }),

    // ── Clinical ─────────────────────────────────────────
    recordVitals: (visitId: string, data: any) =>
        api.post(`/api/visits/${visitId}/vitals`, data),
    nursingAssessment: (visitId: string, data: any) =>
        api.post(`/api/visits/${visitId}/nursing-assessment`, data),
    hasVitals: (visitId: string) =>
        api.get(`/api/visits/${visitId}/has-vitals`),
    consult: (visitId: string, data: any) =>
        api.post(`/api/visits/${visitId}/consultation`, data),
    addConsultation: (visitId: string, data: any) =>
        api.post(`/api/visits/${visitId}/consultation`, data),
    diagnose: (visitId: string, data: any) =>
        api.post(`/api/visits/${visitId}/diagnosis`, data),
    addDiagnosis: (visitId: string, data: any) =>
        api.post(`/api/visits/${visitId}/diagnosis`, data),
    orderLabs: (visitId: string, data: any) =>
        api.post(`/api/visits/${visitId}/lab-orders`, data),
    orderImaging: (visitId: string, data: any) =>
        api.post(`/api/visits/${visitId}/imaging-orders`, data),
    prescribe: (visitId: string, data: any) =>
        api.post(`/api/visits/${visitId}/prescriptions`, data),
    addPrescription: (visitId: string, data: any) =>
        api.post(`/api/visits/${visitId}/prescriptions`, data),
    discharge: (visitId: string, data: any) =>
        api.patch(`/api/visits/${visitId}/discharge`, data),

    // ── Lab ──────────────────────────────────────────────
    getPendingLabOrders: () => api.get('/api/visits/lab-orders/pending'),
    getResultedLabOrders: () => api.get('/api/visits/lab-orders/resulted'),
    enterLabResult: (visitId: string, orderId: string, data: any) =>
        api.post(`/api/visits/${visitId}/lab-results/${orderId}`, data),
    getLabResults: (visitId: string) =>
        api.get(`/api/visits/${visitId}/lab-orders/results`),

    // ── Pharmacy ─────────────────────────────────────────
    getPendingPrescriptions: () => api.get('/api/visits/prescriptions/pending'),
    getPrescriptionDetail: (id: string) =>
        api.get(`/api/visits/prescriptions/${id}/detail`),
    getDispensedPrescriptions: () => api.get('/api/visits/prescriptions/dispensed'),
    dispensePrescription: (visitId: string, prescriptionId: string, data: any) =>
        api.patch(`/api/visits/${visitId}/prescriptions/${prescriptionId}/dispense`, data),

    // ── Radiology ────────────────────────────────────────
    getPendingImagingOrders: () => api.get('/api/visits/imaging-orders/pending'),
    getImagingReport: (orderId: string) =>
        api.get(`/api/visits/imaging-orders/${orderId}/report`),

    // ── Staff dropdown ────────────────────────────────────
    getStaffByRole: (role: 'practitioner' | 'nurse' | 'lab_technician' | 'radiologist' | 'pharmacist') =>
        api.get('/api/visits/staff', { params: { role } }),
};

// ── Permissions ──────────────────────────────────────────
export const permissionApi = {
    grant: (data: { practitionerId: string; durationHours: number; permissionType?: string; allowedRecordTypes?: string[] }) =>
        api.post('/api/permissions/grant', data),
    revoke: (data: { practitionerId: string }) =>
        api.post('/api/permissions/revoke', data),
    requestAccess: (data: { patientId: string; visitId?: string; reason: string; requestedPermissions: string[] }) =>
        api.post('/api/permissions/request', data),
    getMine: () => api.get('/api/permissions/mine'),
    check: (patientBlockchainAddress: string, staffBlockchainAddress: string) =>
        api.get(`/api/permissions/check/${patientBlockchainAddress}/${staffBlockchainAddress}`),
    getRequestStatus: (requestId: string) =>
        api.get(`/api/permissions/requests/${requestId}`),
    emergencyOverride: (data: any) => api.post('/api/permissions/emergency-override', data),
};

// ── Audit ────────────────────────────────────────────────
export const auditApi = {
    getMyLog: () => api.get('/api/audit/my-log'),
    getPatientLog: (patientId: string) => api.get(`/api/audit/patient/${patientId}`),
};

// ── Institutions ─────────────────────────────────────────
export const institutionApi = {
    list: () => api.get('/api/institutions'),
    create: (data: any) => api.post('/api/institutions', data),
    getDepartments: (institutionId?: string) => {
        const url = institutionId
            ? `/api/departments?institutionId=${institutionId}`
            : '/api/departments';
        return api.get(url);
    },
    getById: (id: string) => api.get(`/api/institutions/${id}`),
    update: (id: string, data: any) => api.patch(`/api/institutions/${id}`, data),
    deactivate: (id: string) => api.delete(`/api/institutions/${id}`),
};

// ── Appointments ─────────────────────────────────────────
export const appointmentApi = {
    list: (params?: { status?: string; doctorId?: string; from?: string; to?: string; limit?: number; offset?: number }) => {
        const p = new URLSearchParams();
        if (params?.status) p.set("status", params.status);
        if (params?.doctorId) p.set("doctorId", params.doctorId);
        if (params?.from) p.set("from", params.from);
        if (params?.to) p.set("to", params.to);
        if (params?.limit) p.set("limit", String(params.limit));
        if (params?.offset) p.set("offset", String(params.offset));
        return api.get(`/api/appointments?${p}`);
    },
    today: () => api.get("/api/appointments/today"),
    followUps: (days = 30) => api.get(`/api/appointments/follow-ups?days=${days}`),
    book: (body: Record<string, unknown>) => api.post("/api/appointments", body),
    confirm: (id: string, body: Record<string, unknown> = {}) => api.patch(`/api/appointments/${id}/confirm`, body),
    cancel: (id: string, reason: string) => api.patch(`/api/appointments/${id}/cancel`, { reason }),
    reschedule: (id: string, body: Record<string, unknown>) => api.patch(`/api/appointments/${id}/reschedule`, body),
};

// ── Stats ─────────────────────────────────────────────────
export const labStatsApi = {
    getOverview: () => api.get('/api/lab-stats'),
    getMyStats: () => api.get('/api/lab-stats/my-stats'),
    getPendingOrders: () => api.get('/api/lab-stats/pending'),
};

export const radiologyStatsApi = {
    getOverview: () => api.get('/api/radiology-stats/overview'),
    getMyStats: () => api.get('/api/radiology-stats/my-stats'),
};

export const pharmacyStatsApi = {
    getOverview: () => api.get('/api/pharmacy-stats/overview'),
    getMyStats: () => api.get('/api/pharmacy-stats/my-stats'),
};

export const adminStatsApi = {
    getOverview: () => api.get('/api/dashboard/admin'),
};



// ── Lab (extras: patient context, specimen rejection, my results) ────────
export const labApi = {
    getPatientContext: (patientId: string) =>
        api.get(`/api/lab/patient-context/${patientId}`),
    rejectSpecimen: (orderId: string, data: { reason: string; notes?: string }) =>
        api.post(`/api/lab/reject-specimen/${orderId}`, data),
    getMyResults: (params?: { limit?: number; offset?: number }) => {
        const p = new URLSearchParams();
        if (params?.limit) p.set('limit', String(params.limit));
        if (params?.offset) p.set('offset', String(params.offset));
        return api.get(`/api/lab/my-results?${p}`);
    },
};
// Add this to web/lib/api.ts

export const stockApi = {
    list: (params?: { search?: string; lowOnly?: boolean }) => {
        const p = new URLSearchParams();
        if (params?.search) p.set('search', params.search);
        if (params?.lowOnly) p.set('lowOnly', 'true');
        return api.get(`/api/stock?${p}`);
    },
    add: (data: any) => api.post('/api/stock', data),
    update: (id: string, data: any) => api.patch(`/api/stock/${id}`, data),
    restock: (id: string, data: { quantity: number; batchNumber?: string; expiryDate?: string; notes?: string }) =>
        api.post(`/api/stock/${id}/restock`, data),
    remove: (id: string) => api.delete(`/api/stock/${id}`),
};