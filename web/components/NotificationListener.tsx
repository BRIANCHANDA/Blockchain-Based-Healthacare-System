"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell, X } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { useNotifications, useNotificationStream, type AppNotification } from "@/hooks/useNotification";
import { notificationRoute, notificationTitles } from "@/lib/notificationMeta";

function Popup({ notice }: { notice: AppNotification }) {
  const { dismiss, markRead } = useNotifications();
  const role = useAuthStore(s => s.user?.type);
  const router = useRouter();
  const critical = notice.data.hasCritical || ["critical", "emergency"].includes(notice.data.priority ?? "");
  useEffect(() => {
    if (critical) return;
    const timer = setTimeout(() => dismiss(notice.id), 12_000);
    return () => clearTimeout(timer);
  }, [critical, dismiss, notice.id]);
  const route = notificationRoute(notice.event, notice.data, role);
  return (
    <div role={critical ? "alert" : "status"} className="flex items-start gap-3 rounded-xl border p-4 shadow-lg"
      style={{ background: "var(--surface-card)", borderColor: critical ? "var(--critical-ink)" : "var(--hc-border)" }}>
      <Bell className="h-5 w-5 shrink-0" style={{ color: critical ? "var(--critical-ink)" : "var(--brand)" }} />
      <button className="min-w-0 flex-1 text-left" onClick={() => {
        markRead(notice.id);
        if (route) router.push(route);
      }}>
        <p className="text-sm font-bold">{notificationTitles[notice.event] ?? "New notification"}</p>
        <p className="mt-1 text-sm break-words">{notice.data.patientName ?? "Patient"}</p>
        <p className="mt-1 text-xs break-words" style={{ color: "var(--text-secondary)" }}>
          {notice.data.reason ?? notice.data.testName ?? notice.data.admittingDiagnosis ?? notice.data.visitNumber}
        </p>
        {route && <p className="mt-2 text-xs font-semibold">View details</p>}
      </button>
      <button aria-label="Dismiss notification" onClick={() => dismiss(notice.id)}><X className="h-4 w-4" /></button>
    </div>
  );
}
export default function NotificationListener() {
  useNotificationStream();
  const { notifications } = useNotifications();
  return (
    <div className="fixed right-4 top-20 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {notifications.filter(n => !n.dismissed && !n.read).slice(0, 4).map(n => <Popup key={n.id} notice={n} />)}
    </div>
  );
}
