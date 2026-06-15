import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types';

type AuthState = {
    token: string | null;
    user: User | null;
    isLoading: boolean;       // checking AsyncStorage on app boot
    isAuthenticated: boolean;

    // actions
    setAuth: (token: string, user: User) => Promise<void>;
    clearAuth: () => Promise<void>;
    loadFromStorage: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
    token: null,
    user: null,
    isLoading: true,
    isAuthenticated: false,

    setAuth: async (token, user) => {
        await AsyncStorage.setItem('auth_token', token);
        await AsyncStorage.setItem('auth_user', JSON.stringify(user));
        set({ token, user, isAuthenticated: true });
    },

    clearAuth: async () => {
        await AsyncStorage.removeItem('auth_token');
        await AsyncStorage.removeItem('auth_user');
        set({ token: null, user: null, isAuthenticated: false });
    },

    loadFromStorage: async () => {
        try {
            const token = await AsyncStorage.getItem('auth_token');
            const userStr = await AsyncStorage.getItem('auth_user');
            if (token && userStr) {
                const user = JSON.parse(userStr) as User;
                set({ token, user, isAuthenticated: true });
            }
        } catch {
            // corrupted storage — clear it
            await AsyncStorage.multiRemove(['auth_token', 'auth_user']);
        } finally {
            set({ isLoading: false });
        }
    },
}));


