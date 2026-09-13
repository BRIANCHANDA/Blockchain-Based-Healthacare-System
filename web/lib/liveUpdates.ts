// Invalidate read views through their normal authenticated APIs; no PHI here.
export const DATA_CHANGED = "medlink:data-changed";
let pending: ReturnType<typeof setTimeout> | undefined;
export function requestDataRefresh() {
  if (typeof window === "undefined" || pending) return;
  pending = setTimeout(() => {
    pending = undefined;
    window.dispatchEvent(new Event(DATA_CHANGED));
  }, 350);
}
