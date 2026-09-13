/**
 * The web portal's API layer — one axios instance plus a typed module per
 * backend resource (authApi, patientApi, visitApi, permissionApi, ...).
 *
 * Components never call axios directly. Grouping calls here means a changed
 * endpoint is edited in one place, and every request automatically carries the
 * session token and the shared error handling below.
 *
 * REQUEST: the bearer token is read from localStorage on each call rather than
 * captured once, so a token refreshed in another tab is picked up immediately.
 *
 * RESPONSE: a 401 that is genuinely a dead session — the backend says "Session
 * expired", "Invalid token" or "Unauthorized" — clears the stored credentials
 * and sends the browser to /login. Two details are deliberate:
 *
 *   · The message is inspected, not just the status. A 401 also comes back when
 *     a clinician lacks CONSENT for a particular patient, and that must render
 *     as "you do not have access to this record", not as a forced sign-out.
 *   · _redirecting latches, so a page firing several requests at once produces
 *     one redirect instead of several competing navigations.
 *
 * The rejection is re-thrown after handling, so callers still see the failure
 * and can show their own message.
 */

import axios from 'axios';
import { requestDataRefresh } from './liveUpdates';

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

let _redirecting = false;
api.interceptors.response.use(
    (res) => {
        if (['post', 'put', 'patch', 'delete'].includes(res.config.method ?? '') && res.data?.success !== false) {
            requestDataRefresh();
        }
        return res;
    },
    (err) => {
        const status = err.response?.status;
        const msg: string = err.response?.data?.error?.message ?? '';
        const isSessionError = status === 401 && (
            msg.includes('Session expired') ||
            msg.includes('Invalid token') ||
            msg.includes('Unauthorized')
        );
        if (isSessionError && typeof window !== 'undefined' && !_redirecting) {
            _redirecting = true;
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

    search: (query: string, global = false) =>
        api.get<ApiResponse<SearchResponse>>(`/api/patients/search?q=${encodeURIComponent(query)}${global ? '&global=true' : ''}`),

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
    registerMinor: (data: {
        firstName: string; lastName: string; middleName?: string;
        dateOfBirth: string; gender: string; phoneNumber: string;
        email?: string; address: string; emergencyContact: string;
        isMinor: true;
        guardianPatientId: string;
        guardianRelationship: string;
        guardianDocumentReference?: string;
        institutionId?: string; hospitalPatientNumber?: string;
    }) => api.post('/api/patients', data),
};

export const guardiansApi = {
    create: (data: {
        patientId: string; guardianPatientId: string; relationship: string;
        isPrimary?: boolean; canConsent?: boolean; documentReference?: string;
    }) => api.post('/api/guardians', data),
    listForPatient: (patientId: string) => api.get(`/api/guardians/patient/${patientId}`),
    listDependents:  (guardianPatientId: string) => api.get(`/api/guardians/guardian/${guardianPatientId}/dependents`),
    update: (linkId: string, data: { relationship?: string; isPrimary?: boolean; canConsent?: boolean; documentReference?: string }) =>
        api.patch(`/api/guardians/${linkId}`, data),
    remove: (linkId: string) => api.delete(`/api/guardians/${linkId}`),
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
    admit: (visitId: string, data: { admittingDiagnosis: string; priority?: string; notes?: string }) =>
        api.patch(`/api/visits/${visitId}/admit`, data),

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
