"use client";
// web/src/components/NotificationBell.tsx
//
// Drop this into the doctor dashboard header:
//   import { NotificationBell } from '@/components/NotificationBell';
//   <NotificationBell />

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell, FlaskConical, ScanLine, CheckCheck, Trash2, BedDouble, ArrowLeftRight, UserPlus } from "lucide-react";
import { useNotifications, AppNotification } from "@/hooks/useNotification";
import { useAuthStore } from "@/lib/store";
import { notificationRoute } from "@/lib/notificationMeta";
import { formatDistanceToNow } from "date-fns";

const EVENT_META: Record<
  string,
  { label: string; color: string; bg: string; Icon: any }
> = {
  lab_result_ready: {
    label: "Lab Result Ready",
    color: "var(--info-ink)",
    bg: "var(--blue-050)",
    Icon: FlaskConical,
  },
  imaging_result_ready: {
    label: "Imaging Report Ready",
    color: "var(--accent-ink)",
    bg: "var(--violet-050)",
    Icon: ScanLine,
  },
  patient_admitted: {
    label: "Patient Admitted — Needs Bed",
    color: "var(--urgent-ink)",
    bg: "var(--amber-050)",
    Icon: BedDouble,
  },
  internal_referral_received: {
    label: "New Internal Referral",
    color: "var(--accent-ink)",
    bg: "var(--violet-050)",
    Icon: ArrowLeftRight,
  },
  patient_assigned: {
    label: "Patient Assigned to You",
    color: "var(--info-ink)",
    bg: "var(--blue-050)",
    Icon: UserPlus,
  },
  external_referral_received: {
    label: "New Referral Received",
    color: "var(--accent-ink)",
    bg: "var(--violet-050)",
    Icon: ArrowLeftRight,
  },
};

function NotificationItem({
  n,
  onClose,
}: {
  n: AppNotification;
  onClose: () => void;
}) {
  const router = useRouter();
  const { user } = useAuthStore();
  const { markRead } = useNotifications();
  const meta = EVENT_META[n.event] ?? {
    label: n.event,
    color: "var(--text-secondary)",
    bg: "var(--surface-inset)",
    Icon: Bell,
  };
  const { Icon, color, bg, label } = meta;

  function handleClick() {
    onClose();
    markRead(n.id);
    const route = notificationRoute(n.event, n.data, user?.type);
    if (route) router.push(route);
  }

  return (
    <button
      onClick={handleClick}
      className="w-full flex items-start gap-3 px-4 py-3.5 hover:bg-[var(--surface-inset)] transition-colors text-left"
      style={{ opacity: n.read ? 0.6 : 1 }}
    >
      <div
        className="w-9 h-9 rounded-[var(--r-sm)] flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: bg }}
      >
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold" style={{ color }}>
          {label}
        </p>
        <p className="text-sm font-semibold text-[var(--text-primary)] mt-0.5 leading-snug">
          {n.data.patientName ?? "Patient"}
          {n.data.testName ? ` — ${n.data.testName}` : ""}
          {n.data.reason ? ` — ${n.data.reason}` : ""}
          {n.data.modality ? ` — ${n.data.modality}` : ""}
          {n.data.admittingDiagnosis ? ` — ${n.data.admittingDiagnosis}` : ""}
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">
          {n.data.orderNumber ? `${n.data.orderNumber} · ` : ""}
          {formatDistanceToNow(new Date(n.receivedAt), { addSuffix: true })}
        </p>
      </div>
      {!n.read && (
        <span className="w-2 h-2 rounded-full bg-[var(--info)] flex-shrink-0 mt-1.5" />
      )}
    </button>
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, markAllRead, clearAll } =
    useNotifications();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function handleOpen() { setOpen(v => !v); }

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        aria-label="Notifications"
        onClick={handleOpen}
        className="relative w-9 h-9 rounded-[var(--r-sm)] flex items-center justify-center transition-colors hover:bg-[var(--surface-inset)]"
      >
        <Bell className="w-5 h-5 text-[var(--text-secondary)]" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-[var(--critical)] text-[var(--white)] text-[10px] font-bold flex items-center justify-center px-1 leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute right-0 top-11 w-80 bg-[var(--surface-card)] rounded-[var(--r-lg)] shadow-[var(--elev-3)] border border-[var(--border-faint)] z-50 overflow-hidden"
          style={{ maxHeight: "70vh" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-faint)]">
            <p className="text-sm font-bold text-[var(--text-primary)]">
              Notifications
              {unreadCount > 0 && (
                <span className="ml-2 text-xs font-semibold text-[var(--critical-ink)] bg-[var(--coral-050)] px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </p>
            <div className="flex items-center gap-1">
              {notifications.length > 0 && (
                <>
                  <button
                    onClick={markAllRead}
                    title="Mark all read"
                    className="p-1.5 rounded-[var(--r-xs)] hover:bg-[var(--surface-inset)] transition-colors"
                  >
                    <CheckCheck className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  </button>
                  <button
                    onClick={clearAll}
                    title="Clear all"
                    className="p-1.5 rounded-[var(--r-xs)] hover:bg-[var(--surface-inset)] transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* List */}
          <div
            className="overflow-y-auto divide-y divide-[var(--border-faint)]"
            style={{ maxHeight: "calc(70vh - 52px)" }}
          >
            {notifications.length === 0 ? (
              <div className="py-12 text-center">
                <div className="w-10 h-10 rounded-[var(--r-lg)] bg-[var(--surface-inset)] flex items-center justify-center mx-auto mb-3">
                  <Bell className="w-4 h-4 text-[var(--text-disabled)]" />
                </div>
                <p className="text-sm font-semibold text-[var(--text-muted)]">
                  All caught up
                </p>
                <p className="text-xs text-[var(--text-disabled)] mt-1">
                  Assignments, referrals and results will appear here
                </p>
              </div>
            ) : (
              notifications.map((n: AppNotification) => (
                <NotificationItem
                  key={n.id}
                  n={n}
                  onClose={() => setOpen(false)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
