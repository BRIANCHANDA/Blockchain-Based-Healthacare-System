import { Expo, ExpoPushMessage, ExpoPushTicket, ExpoPushReceiptId } from 'expo-server-sdk';
import { eq, inArray } from 'drizzle-orm';

import { db } from '../db';
import { deviceTokens } from '../db/schema';

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




type SSEStream = {
    write: (data: string) => void;
    close: () => void;
};

// userId → Set of open SSE connections
const connections = new Map<string, Set<SSEStream>>();

/** Register a new SSE connection for a user. Returns a cleanup fn. */
export function addConnection(userId: string, stream: SSEStream): () => void {
    if (!connections.has(userId)) connections.set(userId, new Set());
    connections.get(userId)!.add(stream);

    return () => {
        connections.get(userId)?.delete(stream);
        if (connections.get(userId)?.size === 0) connections.delete(userId);
    };
}

/** Push a notification to all active connections for a user. */
export function notifyUser(userId: string, event: string, data: object) {
    const streams = connections.get(userId);
    if (!streams || streams.size === 0) return; // user not online — that's fine

    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const stream of streams) {
        try {
            stream.write(payload);
        } catch {
            streams.delete(stream); // dead connection — remove silently
        }
    }
}

/**
 * Deliver a push notification to every device a user has registered.
 *
 * This is the function call sites should use. It owns the three things that
 * would otherwise be repeated (and eventually got wrong) at each one:
 *
 *   1. looking up the user's tokens — a person may have several devices;
 *   2. pruning tokens Expo reports as DeviceNotRegistered, so an uninstalled
 *      app stops costing a request on every future send;
 *   3. never throwing. A notification is an auxiliary effect: failing to reach
 *      a phone must not roll back the access request that triggered it, so the
 *      error is logged and swallowed. Call sites should still not await this on
 *      the response path.
 *
 * Returns the number of devices reached, which is 0 for a user who has never
 * opened the mobile app — an ordinary case, not an error.
 */
export async function pushToUser(
    userId: string,
    payload: PushPayload,
): Promise<number> {
    try {
        const rows = await db
            .select({ token: deviceTokens.token })
            .from(deviceTokens)
            .where(eq(deviceTokens.userId, userId));

        if (!rows.length) return 0;

        const { sent, staleTokens } = await sendPushNotifications(
            rows.map((r) => r.token),
            payload,
        );

        // Expo has told us these installs no longer exist. Drop them now rather
        // than retrying them forever.
        if (staleTokens.length) {
            await db.delete(deviceTokens).where(inArray(deviceTokens.token, staleTokens));
        }

        return sent;
    } catch (err) {
        console.error(`pushToUser: delivery to ${userId} failed —`, err);
        return 0;
    }
}

/** How many active connections exist (for health checks / debugging). */
export function activeConnectionCount(): number {
    let total = 0;
    for (const set of connections.values()) total += set.size;
    return total;
}