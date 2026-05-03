// src/api/patients.ts
import api from './client'; // your axios instance (make sure path matches your project)

export const updatePatientProfile = async (data: { password?: string; firstName?: string; lastName?: string }) => {
    const res = await api.patch('/api/patients/me', data);
    return res;
};

// You can also add other patient-related API calls here, e.g.:
// export const getPatientProfile = () => api.get('/api/patients/me');
// export const registerPatient = (data) => api.post('/api/auth/register/patient', data);