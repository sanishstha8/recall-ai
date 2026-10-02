import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

import { ApiError } from "@/lib/api/client";

/**
 * Map an API validation error onto form fields. Returns a form-level message when the
 * error doesn't belong to any of the given fields, otherwise null.
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: Path<T>[],
): string | null {
  if (!(error instanceof ApiError)) return error instanceof Error ? error.message : "Something went wrong.";
  let matchedAny = false;
  for (const field of fields) {
    const message = error.fieldError(field as string);
    if (message) {
      setError(field, { type: "server", message });
      matchedAny = true;
    }
  }
  return matchedAny ? null : error.message;
}
