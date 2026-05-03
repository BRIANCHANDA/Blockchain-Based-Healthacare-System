import { create } from 'zustand';

export interface User {
    id: string;
    type: 'patient' | 'practitioner' | 'nurse' | 'admin' | 'receptionist';
    blockchainAddress: string;
    firstName: string;
    lastName: string;
    institutionName?: string;
}

interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    setAuth: (user: User, token: string) => void;
    clearAuth: () => void;
    initFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    token: null,
    isAuthenticated: false,

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
}));