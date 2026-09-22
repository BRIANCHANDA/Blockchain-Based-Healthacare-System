/**
 * Notification wiring for the patient app.
 *
 * Mounted once, inside NavigationContainer (see navigation/AppNavigator.tsx),
 * and responsible for three things:
 *
 *   1. registering this device's Expo push token with the backend, so a consent
 *      request reaches the phone even when the app is closed;
 *   2. refreshing the pending-request state when the app is brought forward;
 *   3. routing a tapped notification to the Access tab.
 *
 * WHY PUSH RATHER THAN POLLING. This previously polled GET /permissions/requests
 * every 30 seconds and raised a *local* notification on anything new. That could
 * not do the job it existed for: the poll was stopped whenever the app was
 * backgrounded, so a patient whose phone was in their pocket — the normal case
 * when a clinician is waiting on a consent decision — was told nothing until
 * they next opened the app. It also re-notified every pending request on each
 * cold start, because the set of already-seen ids lived only in memory, and it
 * cost 120 requests an hour on mobile data to learn, almost always, that nothing
 * had changed.
 *
 * The backend now sends a real push from routes/permissions.ts at the moment the
 * request is created, so delivery is immediate, survives the app being closed,
 * and costs nothing when idle.
 *
 * NO DUPLICATE ALERTS. The backend also emits an SSE event on the same action,
 * but that channel is consumed only by the web portal — this app has no
 * EventSource client — so a request produces exactly one notification here.
 */

import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useNavigation } from '@react-navigation/native';

import { registerPushToken } from '../api/access';
import { useAuthStore } from '../store/authStore';
import {
    requestNotificationPermission,
    getExpoPushToken,
} from '../utils/notifications';

export function useNotifications() {
    const isAuthenticated = useAuthStore(s => s.isAuthenticated);
    const sessionToken = useAuthStore(s => s.token);
    const isLoading = useAuthStore(s => s.isLoading);
    const navigation = useNavigation<any>();


    // ── Register this device for push ────────────────────────────────────────
    //
    // Runs on sign-in and on every launch of an already signed-in app. The
    // backend upserts on the token, so repeating it is cheap and is what keeps
    // the registration current when Expo reissues a token after a reinstall.
    useEffect(() => {
        if (!isAuthenticated) return;

        let cancelled = false;

        (async () => {
            const granted = await requestNotificationPermission();
            if (!granted || cancelled) return;

            const token = await getExpoPushToken();
            // null is ordinary here: an emulator, a declined prompt, or Expo Go
            // on Android since SDK 53. The app works without push.
            if (!token || cancelled || useAuthStore.getState().token !== sessionToken) return;

            try {
                await registerPushToken(token, Platform.OS === 'ios' ? 'ios' : 'android');
            } catch {
                // A failed registration must not break sign-in. The next launch
                // retries, and in-app consent screens still work meanwhile.
            }
        })().catch(() => { /* Permission services may be unavailable offline. */ });

        return () => { cancelled = true; };
    }, [isAuthenticated, sessionToken]);

    // Focused resource screens refresh themselves on foreground and push.
    // Do not clear unread badges merely because the app was opened.

    // ── Handle a tapped notification ─────────────────────────────────────────
    //
    // `screen` is set by the backend in the push payload (routes/permissions.ts)
    // and by any local notification, so both route the same way.
    useEffect(() => {
        if (!isAuthenticated || isLoading) return;
        let cancelled = false;
        const handleResponse = (response: Notifications.NotificationResponse | null) => {
            if (!response || cancelled || useAuthStore.getState().token !== sessionToken) return;
            const screen = response.notification.request.content.data?.screen;
            if (screen === 'Access') {
                navigation.navigate('Main', { screen: 'Access', params: { screen: 'AccessRequests' } });
                void Notifications.clearLastNotificationResponseAsync().catch(() => {});
            }
        };
        const sub = Notifications.addNotificationResponseReceivedListener(handleResponse);
        // A cold-start tap can precede navigation and session hydration.
        void Notifications.getLastNotificationResponseAsync().then(handleResponse).catch(() => {});

        return () => { cancelled = true; sub.remove(); };
    }, [navigation, isAuthenticated, isLoading, sessionToken]);
}
