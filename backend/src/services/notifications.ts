import { Expo, ExpoPushMessage, ExpoPushTicket, ExpoPushReceiptId } from 'expo-server-sdk';

const expo = new Expo({
    accessToken: process.env.EXPO_ACCESS_TOKEN,   // optional but recommended for higher rate limits
    useFcmV1: true,                                // FCM v1 API (legacy HTTP API is deprecated June 2024)
});

export interface PushPayload {
    title: string;
    body: string;
    data?: Record<string, unknown>;
    sound?: 'default' | null;
    badge?: number;
    priority?: 'default' | 'normal' | 'high';
}

// ── Send to a single token ────────────────────────────────────────────────────
export async function sendPushNotification(
    pushToken: string,
    payload: PushPayload,
): Promise<void> {
    if (!Expo.isExpoPushToken(pushToken)) {
        console.warn(`sendPushNotification: invalid Expo push token — skipping. token=${pushToken}`);
        return;
    }

    const message: ExpoPushMessage = {
        to: pushToken,
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
        sound: payload.sound ?? 'default',
        badge: payload.badge,
        priority: payload.priority ?? 'high',
    };

    const [ticket] = await expo.sendPushNotificationsAsync([message]);

    if (ticket.status === 'error') {
        const { message: errMsg, details } = ticket as any;

        // DeviceNotRegistered means the token is stale — caller should
        // remove it from the DB so we stop sending to dead tokens.
        if (details?.error === 'DeviceNotRegistered') {
            throw new DeviceNotRegisteredError(pushToken);
        }

        throw new Error(`Expo push error: ${errMsg} (${details?.error ?? 'unknown'})`);
    }
}

// ── Send to multiple tokens at once (batched) ─────────────────────────────────
// Use this when notifying many patients/staff at once (e.g. broadcast alerts).
export async function sendPushNotifications(
    pushTokens: string[],
    payload: PushPayload,
): Promise<{ sent: number; failed: number; staleTokens: string[] }> {
    const validTokens = pushTokens.filter((t) => {
        const ok = Expo.isExpoPushToken(t);
        if (!ok) console.warn(`sendPushNotifications: skipping invalid token — ${t}`);
        return ok;
    });

    if (!validTokens.length) return { sent: 0, failed: 0, staleTokens: [] };

    const messages: ExpoPushMessage[] = validTokens.map((token) => ({
        to: token,
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
        sound: payload.sound ?? 'default',
        badge: payload.badge,
        priority: payload.priority ?? 'high',
    }));

    // Expo SDK handles chunking (max 100 per request) automatically
    const chunks = expo.chunkPushNotifications(messages);
    const tickets: ExpoPushTicket[] = [];

    for (const chunk of chunks) {
        const chunkTickets = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...chunkTickets);
    }

    const staleTokens: string[] = [];
    let failed = 0;

    tickets.forEach((ticket, i) => {
        if (ticket.status === 'error') {
            failed++;
            const details = (ticket as any).details;
            if (details?.error === 'DeviceNotRegistered') {
                staleTokens.push(validTokens[i]);
            } else {
                console.error(`Push failed for token ${validTokens[i]}:`, (ticket as any).message);
            }
        }
    });

    return { sent: tickets.length - failed, failed, staleTokens };
}

// ── Receipt polling (call this from a background job, not inline) ─────────────
// Expo receipts confirm final delivery. Tickets only confirm Expo accepted the message.
// Run this periodically (e.g. every 15 min) against ticket IDs you've stored.
export async function checkPushReceipts(
    receiptIds: ExpoPushReceiptId[],
): Promise<{ staleTokens: string[]; errors: string[] }> {
    const chunks = expo.chunkPushNotificationReceiptIds(receiptIds);
    const staleTokens: string[] = [];
    const errors: string[] = [];

    for (const chunk of chunks) {
        const receipts = await expo.getPushNotificationReceiptsAsync(chunk);
        for (const [id, receipt] of Object.entries(receipts)) {
            if (receipt.status === 'error') {
                const details = (receipt as any).details;
                if (details?.error === 'DeviceNotRegistered') {
                    // Store the receipt ID so the caller can map it back to a token
                    staleTokens.push(id);
                } else {
                    errors.push(`Receipt ${id}: ${receipt.message} (${details?.error ?? 'unknown'})`);
                    console.error(`Push receipt error — id=${id}`, receipt.message);
                }
            }
        }
    }

    return { staleTokens, errors };
}

// ── Custom errors ─────────────────────────────────────────────────────────────
export class DeviceNotRegisteredError extends Error {
    constructor(public readonly token: string) {
        super(`Push token is no longer registered: ${token}`);
        this.name = 'DeviceNotRegisteredError';
    }
}