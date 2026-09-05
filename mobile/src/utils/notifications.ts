/**
 * Notification plumbing for the patient app.
 *
 * Two things live here: permission/channel setup, and obtaining the Expo push
 * token that lets the backend reach this device when the app is closed.
 *
 * REMOTE PUSH NEEDS A DEVELOPMENT BUILD. Since Expo SDK 53, Expo Go on Android
 * no longer delivers remote push notifications, so getExpoPushToken() returns
 * null there. That is why expo-dev-client is a dependency — run the app with
 * `npx expo run:android` to test push. Local notifications still work in Expo
 * Go, which is what the old polling implementation relied on.
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// How the notification appears when app is in foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

// Request permission from the user
export async function requestNotificationPermission(): Promise<boolean> {
    if (!Device.isDevice) {
        // Simulators can't receive notifications
        return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') {
        console.log('Notification permission not granted');
        return false;
    }

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('access-requests', {
            name: 'Access Requests',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#0A6640',
            sound: 'default',
        });
    }

    return true;
}

/**
 * Fire a LOCAL notification for a new access request.
 *
 * Retained deliberately although the push path in hooks/useNotifications.ts no
 * longer calls it: local notifications are the only kind that work in Expo Go,
 * so this remains the fallback for demonstrating the consent flow without a
 * development build.
 */
export async function showAccessRequestNotification(
    requesterName: string,
    role: string,
    count: number
) {
    await Notifications.scheduleNotificationAsync({
        content: {
            title: count > 1
                ? `${count} New Access Requests`
                : '🔔 New Access Request',
            body: count > 1
                ? `${count} clinicians are requesting access to your records`
                : `${requesterName} (${role.replace('_', ' ')}) wants to access your records`,
            sound: 'default',
            data: { screen: 'Access' },
            ...(Platform.OS === 'android' && { channelId: 'access-requests' }),
        },
        trigger: null, // fire immediately
    });
}

// Clear the badge count
export async function clearBadge() {
    await Notifications.setBadgeCountAsync(0);
}
/**
 * Obtain this install's Expo push token, or null if push is unavailable.
 *
 * Returns null — rather than throwing — in the ordinary cases: an emulator, a
 * user who declined the permission prompt, or Expo Go on Android since SDK 53.
 * Callers treat null as "no push on this device" and carry on.
 *
 * getExpoPushTokenAsync needs the EAS projectId. It is read from app.json via
 * expo-constants rather than hard-coded, so it cannot drift from the project the
 * app is actually built against.
 */
export async function getExpoPushToken(): Promise<string | null> {
    if (!Device.isDevice) return null; // simulators cannot receive push

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return null;

    const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        (Constants as any).easConfig?.projectId;

    if (!projectId) {
        console.warn('getExpoPushToken: no EAS projectId in app config — push disabled');
        return null;
    }

    try {
        const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
        return data;
    } catch (err) {
        // Expected in Expo Go on Android (SDK 53+). Not an error worth surfacing.
        console.log('getExpoPushToken: push token unavailable —', err);
        return null;
    }
}
