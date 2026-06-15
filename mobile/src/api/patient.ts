// mobile/src/api/patients.ts
import client from './client';

// BASE_URL already includes /api — don't prefix with /api again
export const updatePatientProfile = async (data: {
    password?: string;
    firstName?: string;
    lastName?: string;
}) => {
    // ⚠ was '/api/patients/me' — fixed: BASE_URL already has /api
    const res = await client.patch('/patients/me', data);
    return res;
};

export const getPatientProfile = () =>
    client.get('/patients/me');

export const getMyVitalsTrends = () =>
    client.get("/api/patients/my-vitals-trends");

export const getMyHealth = () =>
    client.get("/patients/my-health");