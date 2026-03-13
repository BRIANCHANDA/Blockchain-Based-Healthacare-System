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

// ── Patients ─────────────────────────────────────────────
export const patientApi = {
    register: (data: any) => api.post('/api/auth/register/patient', data),
    search: (query: string) => api.get(`/api/patients/search?q=${encodeURIComponent(query)}`),
    searchPaginated: (params: { q?: string; limit?: number; offset?: number }) => {
        const p = new URLSearchParams();
        if (params.q) p.set('q', params.q);
        if (params.limit) p.set('limit', String(params.limit));
        if (params.offset) p.set('offset', String(params.offset));
        return api.get(`/api/patients/search?${p}`);
    },
    getById: (id: string) => api.get(`/api/patients/${id}`),
    getVisits: (id: string) => api.get(`/api/records/visits/${id}`),
};

// ── Visits ───────────────────────────────────────────────
export const visitApi = {
    // Queue
    getTodayQueue: () => api.get('/api/visits/today'),
    getByVisitNumber: (visitNumber: string) =>
        api.get(`/api/visits/number/${encodeURIComponent(visitNumber)}`),

    // Check if the current logged-in nurse has permission for a visit's patient
    checkMyPermission: (visitId: string) =>
        api.get(`/api/visits/${visitId}/my-permission`),

    create: (data: any) => api.post('/api/visits', data),
    getSummary: (visitId: string) => api.get(`/api/visits/${visitId}/summary`),

    // Nurse triage
    recordVitals: (visitId: string, data: any) =>
        api.post(`/api/visits/${visitId}/vitals`, data),
    nursingAssessment: (visitId: string, data: any) =>
        api.post(`/api/visits/${visitId}/nursing-assessment`, data),

    // Doctor
    consult: (visitId: string, data: any) =>
        api.post(`/api/visits/${visitId}/consultation`, data),
    diagnose: (visitId: string, data: any) =>
        api.post(`/api/visits/${visitId}/diagnosis`, data),
    orderLabs: (visitId: string, data: any) =>
        api.post(`/api/visits/${visitId}/lab-orders`, data),
    orderImaging: (visitId: string, data: any) =>
        api.post(`/api/visits/${visitId}/imaging-orders`, data),
    prescribe: (visitId: string, data: any) =>
        api.post(`/api/visits/${visitId}/prescriptions`, data),
    discharge: (visitId: string, data: any) =>
        api.patch(`/api/visits/${visitId}/discharge`, data),
};

// ── Permissions ──────────────────────────────────────────
export const permissionApi = {
    // Patient grants access to a practitioner/nurse
    grant: (data: { practitionerId: string; durationHours: number; permissionType?: string; allowedRecordTypes?: string[] }) =>
        api.post('/api/permissions/grant', data),

    // Patient revokes access
    revoke: (data: { practitionerId: string }) =>
        api.post('/api/permissions/revoke', data),

    // Clinical staff requests access from a patient
    requestAccess: (data: {
        patientId: string;
        visitId?: string;
        reason: string;
        requestedPermissions: string[];
    }) => api.post('/api/permissions/request', data),

    // Patient views who has access
    getMine: () => api.get('/api/permissions/mine'),

    // Check permission by blockchain addresses
    check: (patientBlockchainAddress: string, staffBlockchainAddress: string) =>
        api.get(`/api/permissions/check/${patientBlockchainAddress}/${staffBlockchainAddress}`),
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
};