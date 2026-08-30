import { Select } from "@/components/dashboard/ui";

/** Dropdown built from `{ value, label }` options. */
export function SelectField({ value, onChange, options }: any) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o: any) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}
