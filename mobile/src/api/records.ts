import client from './client';

// GET /records/visits/:patientId  — all visits for the logged-in patient
export const getMyVisits = async (patientId: string) => {
    const res = await client.get(`/records/visits/${patientId}`);
    return res.data;
};

// GET /records/visits/:patientId/:visitId  — full visit detail
export const getVisitDetail = async (patientId: string, visitId: string) => {
    const res = await client.get(`/records/visits/${patientId}/${visitId}`);
    return res.data;
};

// GET /records/labs/:visitId  — lab orders + results for a visit
export const getLabResults = async (visitId: string) => {
    const res = await client.get(`/records/labs/${visitId}`);
    return res.data;
};

// GET /referrals/my  — all referrals for the logged-in patient
// ⚠ was /referrals — fixed to /referrals/my so backend filters by patientId
export async function getMyReferrals() {
    const res = await client.get('/referrals/my');
    return res.data;
}