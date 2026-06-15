// mobile/src/api/appointments.ts
import client from './client'; // ⚠ was 'api' — fixed to 'client' to match the export

export const getMyAppointments = (status?: string) =>
    client.get('/appointments/my', { params: status ? { status } : {} });

export const requestAppointment = (data: {
    institutionId: string;
    preferredDate: string;
    reason: string;
    department?: string;
    visitType?: 'outpatient' | 'consultation';
    priority?: 'routine' | 'urgent';
}) => client.post('/appointments/request', data);

export const cancelAppointmentRequest = (appointmentId: string) =>
    client.patch(`/appointments/${appointmentId}/cancel-request`);

export const getMyInstitutions = () =>
    client.get('/patients/my-institutions');