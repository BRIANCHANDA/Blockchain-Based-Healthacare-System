
import client from './client';

export type AuthUser = {
    id: string;
    type: string;
    blockchainAddress: string;
    firstName: string;
    lastName: string;
    isMinor?: boolean;
    temporaryPatientId?: string;
};

export type AuthResponse = {
    success: boolean;
    data: {
        token: string;
        user: AuthUser;
    };
};

// POST /auth/login/patient  — identifier is NRC for adults, HC-MINOR-* for minors
export const loginPatient = async (identifier: string, password: string) => {
    const res = await client.post<AuthResponse>('/auth/login/patient', {
        identifier,
        password,
    });
    return res.data;
};

// POST /auth/register/patient  — self-registration
export const registerPatient = async (payload: {
    firstName: string;
    lastName: string;
    middleName?: string;
    dateOfBirth: string;       // YYYY-MM-DD
    gender: 'male' | 'female' | 'other';
    bloodType?: string;
    phoneNumber: string;
    email?: string;
    address: string;
    nationalId: string;
    emergencyContact: string;
    maritalStatus?: string;
    occupation?: string;
    password: string;
}) => {
    const res = await client.post('/auth/register/patient', payload);
    return res.data;
};

// POST /auth/logout
export const logout = async () => {
    const res = await client.post('/auth/logout');
    return res.data;
};



// POST /auth/change-password/patient
// oldPassword: the default 'test1234' on forced first-login change,
// or the actual current password for voluntary changes.
export const changePassword = async (oldPassword: string, newPassword: string) => {
    const res = await client.post('/auth/change-password/patient', {
        oldPassword,
        newPassword,
    });
    return res.data;
};