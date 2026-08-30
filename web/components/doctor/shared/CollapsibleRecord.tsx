import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { hoverRow } from "@/components/dashboard/ui";

/**
 * Expandable record row.
 *
 * `onOpen` fires only on the opening edge, so callers can lazy-load a
 * record's detail without refetching every time it is collapsed and reopened.
 */
export function CollapsibleRecord({ title, subtitle, children, onOpen }: any) {
  const [open, setOpen] = useState(false);

  const handleToggle = () => {
    const newOpen = !open;
    if (newOpen && onOpen) onOpen();
    setOpen(newOpen);
  };

  return (
    <div
      style={{
        border: "1px solid var(--hc-border)",
        borderRadius: "var(--r-sm)",
        overflow: "hidden",
      }}
    >
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between text-left"
        style={{
          gap: 12,
          padding: "12px 16px",
          border: "none",
          background: open ? "var(--green-050)" : "var(--surface-sunken)",
          cursor: "pointer",
          transition: "background var(--dur-fast) var(--ease-standard)",
        }}
        {...(open ? {} : hoverRow)}
      >
        <span className="min-w-0 flex flex-col" style={{ gap: 4 }}>
          <span
            className="truncate"
            style={{
              font: "600 13.5px/1 var(--font-sans)",
              color: "var(--text-primary)",
            }}
          >
            {title}
          </span>
          {subtitle && (
            <span
              className="truncate"
              style={{
                font: "400 11.5px/1 var(--font-sans)",
                color: "var(--text-muted)",
              }}
            >
              {subtitle}
            </span>
          )}
        </span>
        {open ? (
          <ChevronUp
            className="w-4 h-4 flex-shrink-0"
            style={{ color: "var(--text-muted)" }}
          />
        ) : (
          <ChevronDown
            className="w-4 h-4 flex-shrink-0"
            style={{ color: "var(--text-muted)" }}
          />
        )}
      </button>

      {open && (
        <div style={{ padding: 16, borderTop: "1px solid var(--border-faint)" }}>
          {children}
        </div>
      )}
    </div>
  );
}

export default CollapsibleRecord;
