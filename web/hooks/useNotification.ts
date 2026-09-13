"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { useAuthStore } from "@/lib/store";
import { NOTIFICATION_EVENTS } from "@/lib/notificationMeta";
import { requestDataRefresh } from "@/lib/liveUpdates";

const STRING_FIELDS = [
  "notificationId", "visitId", "visitNumber", "patientName", "priority", "assignedRole",
  "testName", "orderNumber", "modality", "bodyPart", "reason", "admittingDiagnosis", "referralId", "referralNumber",
] as const;
type NotificationData = Partial<Record<typeof STRING_FIELDS[number], string>> & { hasCritical?: boolean };

export type AppNotification = {
  id: string;
  event: string;
  data: NotificationData;
  receivedAt: string;
  read: boolean;
  dismissed: boolean;
};

const useInbox = create<{
  owner: string | null;
  notifications: AppNotification[];
  reset: (owner: string | null) => void;
  push: (event: string, data: NotificationData) => void;
  markAllRead: () => void;
  markRead: (id: string) => void;
  dismiss: (id: string) => void;
  clearAll: () => void;
}>((set) => ({
  owner: null, notifications: [],
  reset: owner => set({ owner, notifications: [] }),
  push: (event, data) => set(state => {
    const id = typeof data.notificationId === "string" ? data.notificationId : crypto.randomUUID();
    if (state.notifications.some(n => n.id === id)) return state;
    return { notifications: [{
      id, event, data, receivedAt: new Date().toISOString(), read: false, dismissed: false,
    }, ...state.notifications].slice(0, 50) };
  }),
  markAllRead: () => set(s => ({ notifications: s.notifications.map(n => ({ ...n, read: true })) })),
  markRead: id => set(s => ({ notifications: s.notifications.map(n => n.id === id ? { ...n, read: true, dismissed: true } : n) })),
  dismiss: id => set(s => ({ notifications: s.notifications.map(n => n.id === id ? { ...n, dismissed: true } : n) })),
  clearAll: () => set({ notifications: [] }),
}));

export function useNotifications() {
  const inbox = useInbox();
  const userId = useAuthStore(s => s.user?.id);
  // Hide the previous user's data immediately, before effect cleanup.
  const notifications = inbox.owner === userId ? inbox.notifications : [];
  return { ...inbox, notifications, unreadCount: notifications.filter(n => !n.read).length };
}

/** Mounted once by the dashboard shell; bell and popups share this inbox. */
export function useNotificationStream() {
  const token = useAuthStore(s => s.token);
  const userId = useAuthStore(s => s.user?.id);
  useEffect(() => {
    useInbox.getState().reset(userId ?? null);
    if (!token || !userId) return;
    const base = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000").replace(/\/$/, "");
    const stream = new EventSource(`${base}/api/notifications/stream?token=${encodeURIComponent(token)}`);
    stream.addEventListener("connected", requestDataRefresh);
    stream.addEventListener("data_changed", requestDataRefresh);
    for (const event of NOTIFICATION_EVENTS) {
      stream.addEventListener(event, (message) => {
        try {
          const payload = JSON.parse((message as MessageEvent).data) as unknown;
          if (!payload || typeof payload !== "object" || Array.isArray(payload)) return;
          const values = payload as Record<string, unknown>;
          const data: NotificationData = {};
          for (const key of STRING_FIELDS) {
            if (typeof values[key] === "string") data[key] = values[key];
          }
          data.hasCritical = values.hasCritical === true;
          useInbox.getState().push(event, data);
          requestDataRefresh();
        } catch { /* A malformed event must not kill the connection. */ }
      });
    }
    // Native EventSource handles reconnection.
    return () => { stream.close(); useInbox.getState().reset(null); };
  }, [token, userId]);
}
