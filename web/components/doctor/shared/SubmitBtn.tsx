import { LogOut, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/dashboard/ui";

/**
 * Primary action button for a tab.
 *
 * `danger` is for actions that end something (discharge, cancel) — it swaps
 * both the colour and the icon, so the two never disagree.
 */
export function SubmitBtn({
  onClick,
  loading,
  label,
  disabled = false,
  danger = false,
}: any) {
  return (
    <Button
      variant="primary"
      icon={danger ? LogOut : CheckCircle2}
      loading={loading}
      disabled={disabled}
      onClick={onClick}
      style={
        danger
          ? { background: "var(--coral-600)", boxShadow: "none" }
          : undefined
      }
    >
      {label}
    </Button>
  );
}
