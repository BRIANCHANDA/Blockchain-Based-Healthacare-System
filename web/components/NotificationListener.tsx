// web/src/components/NotificationListener.tsx
//
// Drop into the DOCTOR layout (web/src/app/dashboard/doctor/layout.tsx):
//   import NotificationListener from "@/components/NotificationListener";
//   ...
//   <main className="...">{children}</main>
//   <NotificationListener />          ← add just inside the root div
//
// Listens to your existing SSE endpoint and shows a toast when a lab result
// is ready. Critical results get a red persistent toast with a louder style.
//
// ASSUMPTION: your SSE endpoint is GET /api/notifications/stream with the JWT
// as a query param (EventSource can't send headers). If your endpoint differs,
// change SSE_URL below. Events arrive as JSON: { type, payload }.

"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, X, AlertTriangle } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface Notice {
  id: string;
  type: string;
  title: string;
  body: string;
  critical: boolean;
  visitId?: string;
  ts: number;
}

export default function NotificationListener() {
  const router = useRouter();
  const [notices, setNotices] = useState<Notice[]>([]);
  const esRef = useRef<EventSource | null>(null);

  const dismiss = useCallback((id: string) => {
    setNotices((p) => p.filter((n) => n.id !== id));
  }, []);

  useEffect(() => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("hc_token") : null;
    if (!token) return;

    const SSE_URL = `${API_BASE}/api/notifications/stream?token=${encodeURIComponent(token)}`;
    let es: EventSource | null = null;
    let retryTimer: any;

    const connect = () => {
      es = new EventSource(SSE_URL);
      esRef.current = es;

      es.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "lab_result_ready") {
            const p = msg.payload ?? msg;
            const critical = !!p.hasCritical;
            const notice: Notice = {
              id: `${Date.now()}-${Math.random()}`,
              type: msg.type,
              title: critical ? "⚠ CRITICAL lab result" : "Lab result ready",
              body: `${p.testName ?? "Test"} — ${p.patientName ?? "patient"}`,
              critical,
              visitId: p.visitId,
              ts: Date.now(),
            };
            setNotices((prev) => [notice, ...prev].slice(0, 4));
            // Non-critical auto-dismiss after 8s; critical stays until clicked
            if (!critical) setTimeout(() => dismiss(notice.id), 8000);
            // Audible ping for critical
            if (critical) {
              try {
                const ctx = new AudioContext();
                const o = ctx.createOscillator();
                const g = ctx.createGain();
                o.connect(g);
                g.connect(ctx.destination);
                o.frequency.value = 880;
                g.gain.value = 0.08;
                o.start();
                setTimeout(() => {
                  o.stop();
                  ctx.close();
                }, 350);
              } catch {}
            }
          }
        } catch {
          /* non-JSON keepalive */
        }
      };

      es.onerror = () => {
        es?.close();
        retryTimer = setTimeout(connect, 5000); // reconnect
      };
    };

    connect();
    return () => {
      es?.close();
      clearTimeout(retryTimer);
    };
  }, [dismiss]);

  if (notices.length === 0) return null;

  return (
    <div className="fixed top-5 right-5 z-[60] space-y-2 w-80" style={{ fontFamily: "var(--font-sans)" }}>
      {notices.map((n) => (
        <div
          key={n.id}
          className="rounded-[var(--r-lg)] shadow-[var(--elev-3)] border overflow-hidden cursor-pointer transition-transform hover:scale-[1.02]"
          style={
            n.critical
              ? { background: "var(--critical-ink)", borderColor: "var(--coral-600)" }
              : { background: "var(--surface-card)", borderColor: "var(--hc-border)" }
          }
          onClick={() => {
            if (n.visitId)
              router.push(`/dashboard/doctor/patients/${n.visitId}`); // adapt route if needed
            dismiss(n.id);
          }}
        >
          {n.critical && <div className="h-1 animate-pulse" style={{ background: "var(--coral-100)" }} />}
          <div className="flex items-start gap-3 p-3.5">
            <div
              className="w-9 h-9 rounded-[var(--r-sm)] flex items-center justify-center flex-shrink-0"
              style={{
                background: n.critical ? "var(--on-dark-raise)" : "var(--brand-tint)",
              }}
            >
              {n.critical ? (
                <AlertTriangle size={17} style={{ color: "var(--coral-100)" }} />
              ) : (
                <FlaskConical size={17} style={{ color: "var(--brand)" }} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="text-sm font-bold leading-tight"
                style={{ color: n.critical ? "var(--white)" : "var(--text-primary)" }}
              >
                {n.title}
              </p>
              <p
                className="text-xs mt-0.5 truncate"
                style={{ color: n.critical ? "var(--coral-100)" : "var(--text-secondary)" }}
              >
                {n.body}
              </p>
              <p
                className="text-[10px] mt-1 font-semibold"
                style={{ color: n.critical ? "var(--on-dark-text)" : "var(--text-muted)" }}
              >
                Tap to open visit
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                dismiss(n.id);
              }}
              className="p-1 rounded-[var(--r-xs)] flex-shrink-0"
              style={{
                color: n.critical ? "var(--on-dark-text-dim)" : "var(--text-muted)",
              }}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
