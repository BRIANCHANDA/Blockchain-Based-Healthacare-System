import { Textarea } from "@/components/dashboard/ui";

/** Multi-line input. Adapter over the design system's `Textarea`. */
export function TextArea({ value, onChange, placeholder, rows = 3 }: any) {
  return (
    <Textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{ minHeight: rows * 22 + 20 }}
    />
  );
}
