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
    getTodayQueue: () => api.get('/api/visits/today'),
    getByVisitNumber: (visitNumber: string) =>
        api.get(`/api/visits/number/${encodeURIComponent(visitNumber)}`),
    getVisitInfo: (visitId: string) =>
        api.get(`/api/visits/${visitId}/info`),
    checkMyPermission: (visitId: string) =>
        api.get(`/api/visits/${visitId}/my-permission`),
    create: (data: any) => api.post('/api/visits', data),
    createVisit: (data: any) => api.post('/api/visits', data),
    getSummary: (visitId: string) => api.get(`/api/visits/${visitId}/summary`),
    recordVitals: (visitId: string, data: any) =>
        api.post(`/api/visits/${visitId}/vitals`, data),
    nursingAssessment: (visitId: string, data: any) =>
        api.post(`/api/visits/${visitId}/nursing-assessment`, data),
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
    getPendingLabOrders: () =>
        api.get('/api/visits/lab-orders/pending'),
    getResultedLabOrders: () =>
        api.get('/api/visits/lab-orders/resulted'),
    enterLabResult: (visitId: string, orderId: string, data: any) =>
        api.post(`/api/visits/${visitId}/lab-results/${orderId}`, data),
    getPendingPrescriptions: () => api.get('/api/visits/prescriptions/pending'),
    getPendingImagingOrders: () => api.get('/api/visits/imaging-orders/pending'),
    getPrescriptionDetail: (id: string) => api.get(`/api/visits/prescriptions/${id}/detail`),
    getDispensedPrescriptions: () => api.get('/api/visits/prescriptions/dispensed'),
    dispensePrescription: (visitId: string, prescriptionId: string, data: any) =>
        api.patch(`/api/visits/${visitId}/prescriptions/${prescriptionId}/dispense`, data),
    // Radiology methods
    getImagingReport: (orderId: string) =>
        api.get(`/api/visits/imaging-orders/${orderId}/report`),
    // The submit method now uses FormData (see the page component)

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