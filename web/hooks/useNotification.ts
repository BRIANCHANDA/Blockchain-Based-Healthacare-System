// web/src/hooks/useNotifications.ts
//
// Opens an SSE connection to /api/notifications/stream once the user is logged in.
// Returns { notifications, unreadCount, markAllRead, clearAll }
//
// Usage:
//   const { notifications, unreadCount, markAllRead } = useNotifications();

import { useEffect, useRef, useState, useCallback } from 'react';

export type AppNotification = {
    id: string;
    event: string;          // 'lab_result_ready' | 'imaging_result_ready' | …
    data: Record<string, any>;
    receivedAt: string;
    read: boolean;
};

const MAX_STORED = 50;
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export function useNotifications() {
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const esRef = useRef<EventSource | null>(null);
    const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const unreadCount = notifications.filter((n) => !n.read).length;

    const markAllRead = useCallback(() => {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }, []);

    const clearAll = useCallback(() => setNotifications([]), []);

    const push = useCallback((event: string, data: Record<string, any>) => {
        const notif: AppNotification = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            event,
            data,
            receivedAt: new Date().toISOString(),
            read: false,
        };
        setNotifications((prev) => [notif, ...prev].slice(0, MAX_STORED));
    }, []);

    useEffect(() => {
        const token = localStorage.getItem('hc_token');
        if (!token) return;

        function connect() {
            // EventSource doesn't support custom headers — pass token as query param
            // The auth middleware must read it from ?token= as a fallback.
            const url = `${BASE_URL}/api/notifications/stream?token=${encodeURIComponent(token!)}`;
            const es = new EventSource(url);
            esRef.current = es;

            es.addEventListener('connected', () => {
                console.log('[notifications] SSE connected');
            });

            es.addEventListener('lab_result_ready', (e) => {
                push('lab_result_ready', JSON.parse(e.data));
            });

            es.addEventListener('imaging_result_ready', (e) => {
                push('imaging_result_ready', JSON.parse(e.data));
            });

            es.addEventListener('patient_admitted', (e) => {
                push('patient_admitted', JSON.parse(e.data));
            });

            es.addEventListener('ping', () => {
                // heartbeat — no action needed
            });

            es.onerror = () => {
                es.close();
                esRef.current = null;
                // Reconnect after 5 s
                reconnectTimer.current = setTimeout(connect, 5_000);
            };
        }

        connect();

        return () => {
            esRef.current?.close();
            esRef.current = null;
            if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
        };
    }, [push]);

    return { notifications, unreadCount, markAllRead, clearAll };
}