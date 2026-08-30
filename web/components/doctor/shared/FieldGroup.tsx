import { Field } from "@/components/dashboard/ui";

/**
 * Labelled field wrapper.
 *
 * A thin adapter over the design system's `Field` so the doctor tabs keep
 * their existing call signature while picking up token styling. New code
 * should import `Field` directly — it also supports hints and errors.
 */
export function FieldGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return <Field label={label}>{children}</Field>;
}
