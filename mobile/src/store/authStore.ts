/**
 * Authentication state for the patient app.
 *
 * Two copies of the session exist and they serve different purposes:
 *
 *   AsyncStorage  — survives app restarts, and is what api/client.ts reads on
 *                   every outgoing request. This is the durable copy.
 *   this store    — the in-memory copy React renders from. AppNavigator swaps
 *                   the auth stack for the main stack purely on isAuthenticated.
 *
 * Writes must go through setAuth/clearAuth so the two stay in step; setting one
 * without the other produces a session that renders as signed in but sends no
 * token, or the reverse.
 *
 * `isLoading` starts true so the navigator shows a spinner instead of flashing
 * the login screen while loadFromStorage() reads the persisted session.
 *
 * ACTING AS A DEPENDENT: a guardian can operate the app on behalf of a child or
 * other dependent. activePatientId is persisted (client.ts sends it as the
 * X-Acting-As-Patient header on every request), while activeDependentName is
 * display-only and is deliberately not persisted — after a restart the header
 * still applies but the banner name is empty until setDependents/
 * setActivePatient runs again.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, Dependent } from '../types';
import { unregisterPushToken } from '../api/access';
import { getExpoPushToken } from '../utils/notifications';

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
        // Drop this device's push registration BEFORE the token is cleared —
        // the endpoint is authenticated, so it has to go out while the session
        // is still valid. Skipping it would leave the handset receiving the
        // previous user's consent requests, which in this system means one
        // patient being notified about another patient's records.
        try {
            const pushToken = await getExpoPushToken();
            if (pushToken) await unregisterPushToken(pushToken);
        } catch {
            // Offline, or push was never available on this device. Signing out
            // must not be blocked by it; the backend also prunes a token once
            // Expo reports the install as gone.
        }

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
