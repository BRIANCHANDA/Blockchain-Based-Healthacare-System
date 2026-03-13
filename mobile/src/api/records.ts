import client from './client';

// GET /records/visits/:patientId  — all visits for the logged-in patient
export const getMyVisits = async (patientId: string) => {
    const res = await client.get(`/records/visits/${patientId}`);
    return res.data; // { success, data: { visits: [] } }
};

// GET /records/visits/:patientId/:visitId  — full visit detail
export const getVisitDetail = async (patientId: string, visitId: string) => {
    const res = await client.get(`/records/visits/${patientId}/${visitId}`);
    return res.data;
    // data: { visit, consultations, diagnoses, vitalSigns, labOrders, imagingOrders, prescriptions }
};

// GET /records/labs/:visitId  — lab orders + results for a visit
export const getLabResults = async (visitId: string) => {
    const res = await client.get(`/records/labs/${visitId}`);
    return res.data; // { success, data: { orders, results } }
};