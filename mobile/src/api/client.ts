import axios, { AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Change this to your machine's local IP when testing on a physical device
// e.g. 'http://192.168.1.100:3000' — NOT localhost (that points to the phone itself)
export const BASE_URL = 'http://192.168.0.126:3000/api'; // Android emulator → host machine

const client = axios.create({
    baseURL: BASE_URL,
    timeout: 10000,
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
            // cast to any to avoid mismatched Axios internal headers type
            (config.headers as any).Authorization = `Bearer ${token}`;
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