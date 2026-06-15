"use client";
// web/src/components/NotificationBell.tsx
//
// Drop this into the doctor dashboard header:
//   import { NotificationBell } from '@/components/NotificationBell';
//   <NotificationBell />

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell, FlaskConical, ScanLine, CheckCheck, Trash2 } from "lucide-react";
import { useNotifications, AppNotification } from "@/hooks/useNotification";
import { formatDistanceToNow } from "date-fns";

const EVENT_META: Record<
  string,
  { label: string; color: string; bg: string; Icon: any }
> = {
  lab_result_ready: {
    label: "Lab Result Ready",
    color: "#1d4ed8",
    bg: "#eff6ff",
    Icon: FlaskConical,
  },
  imaging_result_ready: {
    label: "Imaging Report Ready",
    color: "#7c3aed",
    bg: "#faf5ff",
    Icon: ScanLine,
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
  const meta = EVENT_META[n.event] ?? {
    label: n.event,
    color: "#374151",
    bg: "#f9fafb",
    Icon: Bell,
  };
  const { Icon, color, bg, label } = meta;

  function handleClick() {
    onClose();
    if (n.data.visitId) {
      router.push(`/dashboard/doctor/visits/${n.data.visitId}`);
    }
  }

  return (
    <button
      onClick={handleClick}
      className="w-full flex items-start gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors text-left"
      style={{ opacity: n.read ? 0.6 : 1 }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: bg }}
      >
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold" style={{ color }}>
          {label}
        </p>
        <p className="text-sm font-semibold text-gray-900 mt-0.5 leading-snug">
          {n.data.patientName ?? "Patient"}
          {n.data.testName ? ` — ${n.data.testName}` : ""}
          {n.data.modality ? ` — ${n.data.modality}` : ""}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          {n.data.orderNumber} ·{" "}
          {formatDistanceToNow(new Date(n.receivedAt), { addSuffix: true })}
        </p>
      </div>
      {!n.read && (
        <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
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

  // Mark all read when panel is opened
  function handleOpen() {
    setOpen((v) => {
      if (!v) setTimeout(markAllRead, 1500); // mark read after 1.5 s
      return !v;
    });
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-gray-100"
      >
        <Bell className="w-5 h-5 text-gray-500" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center px-1 leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute right-0 top-11 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden"
          style={{ maxHeight: "70vh" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
            <p className="text-sm font-bold text-gray-900">
              Notifications
              {unreadCount > 0 && (
                <span className="ml-2 text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
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
                    className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <CheckCheck className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                  <button
                    onClick={clearAll}
                    title="Clear all"
                    className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* List */}
          <div
            className="overflow-y-auto divide-y divide-gray-50"
            style={{ maxHeight: "calc(70vh - 52px)" }}
          >
            {notifications.length === 0 ? (
              <div className="py-12 text-center">
                <div className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
                  <Bell className="w-4 h-4 text-gray-300" />
                </div>
                <p className="text-sm font-semibold text-gray-400">
                  All caught up
                </p>
                <p className="text-xs text-gray-300 mt-1">
                  Lab results will appear here
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
