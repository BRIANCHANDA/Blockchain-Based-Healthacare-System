import { create } from 'zustand';

export interface User {
    id: string;
    type: 'patient' | 'practitioner' | 'nurse' | 'admin' | 'receptionist' | 'lab_technician' | 'radiologist' | 'pharmacist';
    blockchainAddress: string;
    firstName: string;
    lastName: string;
    institutionId?: string | null;
    institutionName?: string | null;
    mustChangePassword?: boolean;
}

interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;

    setAuth: (user: User, token: string) => void;
    clearAuth: () => void;
    initFromStorage: () => void;
    setMustChange: (val: boolean) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,

    setAuth: (user, token) => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('hc_token', token);
            localStorage.setItem('hc_user', JSON.stringify(user));
        }
        set({ user, token, isAuthenticated: true });
    },

    clearAuth: () => {
        if (typeof window !== 'undefined') {
            localStorage.removeItem('hc_token');
            localStorage.removeItem('hc_user');
        }
        set({ user: null, token: null, isAuthenticated: false });
    },

    initFromStorage: () => {
        if (typeof window !== 'undefined') {
            const token = localStorage.getItem('hc_token');
            const userStr = localStorage.getItem('hc_user');
            if (token && userStr) {
                try {
                    const user = JSON.parse(userStr) as User;
                    set({ user, token, isAuthenticated: true });
                } catch {
                    localStorage.removeItem('hc_token');
                    localStorage.removeItem('hc_user');
                }
            }
        }
    },

    // Called after password is successfully changed — clears the flag
    setMustChange: (val: boolean) => {
        const user = get().user;
        if (!user) return;
        const updated = { ...user, mustChangePassword: val };
        if (typeof window !== 'undefined') {
            localStorage.setItem('hc_user', JSON.stringify(updated));
        }
        set({ user: updated });
    },
}));