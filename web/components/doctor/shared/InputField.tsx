import { Input } from "@/components/dashboard/ui";

/** Text input. Adapter over the design system's `Input` (value-only onChange). */
export function InputField({ value, onChange, placeholder, type = "text" }: any) {
  return (
    <Input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}
