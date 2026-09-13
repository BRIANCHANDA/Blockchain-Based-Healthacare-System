"use client";
import { useEffect, useRef } from "react";
import { DATA_CHANGED } from "@/lib/liveUpdates";

// Refresh read data silently. Callbacks must not initialise editable drafts.
// No navigation, remounts or browser reloads.
export function useLiveRefresh(refresh: () => unknown | Promise<unknown>, enabled = true) {
  const latest = useRef(refresh);
  useEffect(() => { latest.current = refresh; });
  useEffect(() => {
    if (!enabled) return;
    let running = false;
    let queued = false;
    let disposed = false;
    const run = async () => {
      if (disposed || document.visibilityState === "hidden") return;
      if (running) { queued = true; return; }
      running = true;
      try { await latest.current(); }
      catch { /* Retry on the next event/focus/interval; keep existing data. */ }
      finally {
        running = false;
        if (queued && !disposed) { queued = false; void run(); }
      }
    };
    window.addEventListener(DATA_CHANGED, run);
    window.addEventListener("focus", run);
    window.addEventListener("online", run);
    document.addEventListener("visibilitychange", run);
    const timer = setInterval(run, 30_000);
    return () => {
      disposed = true;
      clearInterval(timer);
      window.removeEventListener(DATA_CHANGED, run);
      window.removeEventListener("focus", run);
      window.removeEventListener("online", run);
      document.removeEventListener("visibilitychange", run);
    };
  }, [enabled]);
}
