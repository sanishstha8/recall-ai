import type { ComponentProps, ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Label + control + inline error, wired for accessibility. */
export function Field({
  id,
  label,
  error,
  hint,
  children,
  className,
  labelAction,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
  labelAction?: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        {labelAction}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextField({
  id,
  label,
  error,
  hint,
  labelAction,
  ...props
}: ComponentProps<typeof Input> & {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  labelAction?: ReactNode;
}) {
  return (
    <Field id={id} label={label} error={error} hint={hint} labelAction={labelAction}>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="h-9"
        {...props}
      />
    </Field>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
    >
      {message}
    </div>
  );
}
