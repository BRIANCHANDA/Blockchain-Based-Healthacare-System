import { CheckCircle2, AlertCircle } from "lucide-react";
import { Toast as BaseToast } from "@/components/dashboard/ui";

/** Transient confirmation. Adapter over the design system's `Toast`. */
export function Toast({
  message,
  type,
}: {
  message: string;
  type: "success" | "error";
}) {
  return (
    <BaseToast
      message={message}
      icon={type === "success" ? CheckCircle2 : AlertCircle}
      tone={type === "success" ? "success" : "critical"}
    />
  );
}
