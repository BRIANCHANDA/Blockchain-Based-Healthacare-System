import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, Dependent } from '../types';

type AuthState = {
    token: string | null;
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    dependents: Dependent[];
    activePatientId: string | null;
    activeDependentName: string | null;

    setAuth: (token: string, user: User) => Promise<void>;
    clearAuth: () => Promise<void>;
    loadFromStorage: () => Promise<void>;
    setDependents: (deps: Dependent[]) => void;
    setActivePatient: (patientId: string, name: string) => Promise<void>;
    clearActivePatient: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
    token: null,
    user: null,
    isLoading: true,
    isAuthenticated: false,
    dependents: [],
    activePatientId: null,
    activeDependentName: null,

    setAuth: async (token, user) => {
        await AsyncStorage.setItem('auth_token', token);
        await AsyncStorage.setItem('auth_user', JSON.stringify(user));
        set({ token, user, isAuthenticated: true });
    },

    clearAuth: async () => {
        await AsyncStorage.multiRemove(['auth_token', 'auth_user', 'active_patient_id']);
        set({ token: null, user: null, isAuthenticated: false, dependents: [], activePatientId: null, activeDependentName: null });
    },

    loadFromStorage: async () => {
        try {
            const token = await AsyncStorage.getItem('auth_token');
            const userStr = await AsyncStorage.getItem('auth_user');
            const activePatientId = await AsyncStorage.getItem('active_patient_id');
            if (token && userStr) {
                const user = JSON.parse(userStr) as User;
                set({ token, user, isAuthenticated: true, activePatientId: activePatientId ?? null });
            }
        } catch {
            await AsyncStorage.multiRemove(['auth_token', 'auth_user', 'active_patient_id']);
        } finally {
            set({ isLoading: false });
        }
    },

    setDependents: (deps) => set({ dependents: deps }),

    setActivePatient: async (patientId, name) => {
        await AsyncStorage.setItem('active_patient_id', patientId);
        set({ activePatientId: patientId, activeDependentName: name });
    },

    clearActivePatient: async () => {
        await AsyncStorage.removeItem('active_patient_id');
        set({ activePatientId: null, activeDependentName: null });
    },
}));
