import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '../store/authStore';

const context = () => {
    const s = useAuthStore.getState();
    return JSON.stringify([s.token, s.activePatientId]);
};

/** Only the latest request for the current session/patient may publish data. */
export function usePatientResource<T>(load: () => Promise<T>, empty: T) {
    const token = useAuthStore(s => s.token);
    const patient = useAuthStore(s => s.activePatientId);
    const key = JSON.stringify([token, patient]);
    const sequence = useRef(0);
    const [state, setState] = useState({ key: '', data: empty, loading: true, refreshing: false, error: false });
    const refresh = useCallback(async () => {
        const id = ++sequence.current;
        if (!token) return;
        setState(s => s.key === key ? { ...s, refreshing: true } : { key, data: empty, loading: true, refreshing: true, error: false });
        try {
            const data = await load();
            if (id === sequence.current && context() === key)
                setState({ key, data, loading: false, refreshing: false, error: false });
        } catch {
            if (id === sequence.current && context() === key)
                setState(s => ({ ...s, loading: false, refreshing: false, error: true }));
        }
    // Empty is only the initial fallback; callers may pass a literal array.
    }, [load, key, token]);

    useFocusEffect(useCallback(() => {
        void refresh();
        let previous = AppState.currentState;
        const app = AppState.addEventListener('change', next => {
            if (next === 'active' && previous !== 'active') void refresh();
            previous = next;
        });
        const received = Notifications.addNotificationReceivedListener(() => { void refresh(); });
        const tapped = Notifications.addNotificationResponseReceivedListener(() => { void refresh(); });
        return () => { ++sequence.current; app.remove(); received.remove(); tapped.remove(); };
    }, [refresh]));

    const update = useCallback((transform: (data: T) => T) => {
        if (context() !== key) return;
        ++sequence.current; // An older background fetch must not undo a decision.
        setState(s => s.key === key ? { ...s, data: transform(s.data), refreshing: false } : s);
    }, [key]);
    return { ...(state.key === key ? state : { data: empty, loading: true, refreshing: false, error: false }), refresh, update };
}
