import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useNavigation } from '@react-navigation/native';

import { getAccessRequests } from '../api/access';
import { useAuthStore } from '../store/authStore';
import {
    requestNotificationPermission,
    showAccessRequestNotification,
    clearBadge,
} from '../utils/notifications';

const POLL_INTERVAL_MS = 30_000; // 30 seconds

export function useNotifications() {
    const isAuthenticated = useAuthStore(s => s.isAuthenticated);
    const navigation = useNavigation<any>();

    // Track request IDs we've already notified about so we don't spam
    const seenRequestIds = useRef<Set<string>>(new Set());
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const appStateRef = useRef<AppStateStatus>(AppState.currentState);

    const checkForNewRequests = useCallback(async () => {
        if (!isAuthenticated) return;

        try {
            const res = await getAccessRequests();
            const requests: any[] = res.data?.requests ?? [];
            const pending = requests.filter(r => r.status === 'pending');

            // Find ones we haven't notified about yet
            const newRequests = pending.filter(r => !seenRequestIds.current.has(r.id));

            if (newRequests.length > 0) {
                // Mark all as seen
                newRequests.forEach(r => seenRequestIds.current.add(r.id));

                // Fire one notification (consolidated if multiple)
                const first = newRequests[0];
                await showAccessRequestNotification(
                    first.requesterName ?? 'A clinician',
                    first.requestedByUserType ?? 'practitioner',
                    newRequests.length
                );
            }
        } catch {
            // Silently fail — don't crash the app if polling fails
        }
    }, [isAuthenticated]);

    const startPolling = useCallback(() => {
        if (intervalRef.current) return; // already running
        checkForNewRequests(); // immediate check on start
        intervalRef.current = setInterval(checkForNewRequests, POLL_INTERVAL_MS);
    }, [checkForNewRequests]);

    const stopPolling = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    // Start/stop polling based on auth state
    useEffect(() => {
        if (!isAuthenticated) {
            stopPolling();
            seenRequestIds.current.clear();
            return;
        }

        // Request notification permission then start polling
        requestNotificationPermission().then(granted => {
            if (granted) startPolling();
        });

        return () => stopPolling();
    }, [isAuthenticated]);

    // Pause polling when app is in background, resume when foregrounded
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
            if (
                appStateRef.current.match(/inactive|background/) &&
                nextState === 'active'
            ) {
                // App came to foreground — check immediately
                clearBadge();
                if (isAuthenticated) {
                    checkForNewRequests();
                    startPolling();
                }
            } else if (nextState.match(/inactive|background/)) {
                // App went to background — stop interval (battery saving)
                // Background polling won't work in Expo Go anyway
                stopPolling();
            }
            appStateRef.current = nextState;
        });

        return () => subscription.remove();
    }, [isAuthenticated, checkForNewRequests, startPolling, stopPolling]);

    // Handle tap on notification — navigate to Access tab
    useEffect(() => {
        const sub = Notifications.addNotificationResponseReceivedListener(response => {
            const screen = response.notification.request.content.data?.screen;
            if (screen === 'Access') {
                navigation.navigate('Main', { screen: 'Access' });
            }
        });

        return () => sub.remove();
    }, [navigation]);
}