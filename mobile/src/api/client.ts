/**
 * The single axios instance every api/*.ts module calls through.
 *
 * Two interceptors carry session state so no screen has to think about it:
 *
 *   request  — attaches the bearer token, and X-Acting-As-Patient when a
 *              guardian is operating the app on a dependent's behalf. Both are
 *              read from AsyncStorage rather than the zustand store, so a
 *              request issued before React has rehydrated still authenticates.
 *   response — on 401, clears the stored credentials so the next launch starts
 *              at the login screen.
 *
 * KNOWN GAP: the 401 handler clears AsyncStorage but not the zustand store, and
 * AppNavigator switches stacks on the store's isAuthenticated. An expired token
 * therefore leaves the app on the main stack, failing every request, until it is
 * restarted. Calling useAuthStore.getState().clearAuth() here would sign the
 * user out immediately.
 *
 * BASE_URL is a local address, so it must be changed to the host machine's LAN
 * IP when running on a physical device — `localhost` on a phone means the phone.
 */

import axios, { AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * API host.
 *
 * Set EXPO_PUBLIC_API_URL to point the app at a backend. Expo inlines any
 * EXPO_PUBLIC_* variable at build time, so a production build carries the
 * deployed URL without editing source — which is what this previously required,
 * meaning every developer's machine held a different uncommitted edit and a
 * release build could easily ship someone's LAN address.
 *
 * The fallback is a development convenience only. On a physical device it must
 * be the host machine's LAN IP: `localhost` on a phone means the phone itself.
 *
 *   .env in mobile/:  EXPO_PUBLIC_API_URL=https://api.yourdomain.zm
 */
const DEV_FALLBACK = 'http://10.120.222.130:3000';

const HOST = (process.env.EXPO_PUBLIC_API_URL ?? DEV_FALLBACK).replace(/\/+$/, '');

export const BASE_URL = `${HOST}/api`;

if (!process.env.EXPO_PUBLIC_API_URL && !__DEV__) {
    // A release build pointing at a LAN address will fail for every user.
    console.warn(
        '[api] EXPO_PUBLIC_API_URL is not set — this build points at a ' +
        'development address and will not reach a real backend.',
    );
}
const client = axios.create({
    baseURL: BASE_URL,
    timeout: 30000,
    headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: attach JWT token to every request ──
interface AuthHeaders extends Record<string, string | undefined> {
    Authorization?: string;
}

client.interceptors.request.use(
    async (config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> => {
        const token: string | null = await AsyncStorage.getItem('auth_token');
        if (token) {
            if (!config.headers) {
                config.headers = {} as any;
            }
            (config.headers as any).Authorization = `Bearer ${token}`;
        }
        const activePatientId = await AsyncStorage.getItem('active_patient_id');
        if (activePatientId) {
            (config.headers as any)['X-Acting-As-Patient'] = activePatientId;
        }
        return config;
    }
);

// ── Response interceptor: handle 401 globally ──
client.interceptors.response.use(
    (res) => res,
    async (err) => {
        if (err.response?.status === 401) {
            await AsyncStorage.removeItem('auth_token');
            await AsyncStorage.removeItem('auth_user');
            // Navigation to login is handled by AppNavigator watching auth state
        }
        return Promise.reject(err);
    }
);

export default client;