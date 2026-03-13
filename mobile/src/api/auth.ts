import client from './client';

export type AuthUser = {
    id: string;
    type: string;
    blockchainAddress: string;
    firstName: string;
    lastName: string;
};

export type AuthResponse = {
    success: boolean;
    data: {
        token: string;
        user: AuthUser;
    };
};

// POST /auth/login/patient  — patients log in with nationalId + password
export const loginPatient = async (nationalId: string, password: string) => {
    const res = await client.post<AuthResponse>('/auth/login/patient', {
        nationalId,
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