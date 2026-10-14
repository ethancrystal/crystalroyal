import "server-only";
import type { z } from "zod";
import { AdminError, adminErrorMessage } from "@/lib/db/admin-queries";
import type { FormState } from "./form-state";

// Server-side helpers for the settings and calendar actions: read a FormData into plain strings, and turn a zod
// failure or an AdminError into the FormState the form shows (the typed values are echoed back).

/** Every string field of the form (files are ignored). The Next.js action id fields are dropped. */
export function fieldsOf(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) {
    if (typeof v !== "string" || k.startsWith("$ACTION")) continue;
    out[k] = v;
  }
  return out;
}

export function invalid(error: z.ZodError, values: Record<string, string>): FormState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { error: error.issues[0]?.message ?? "Check the form and try again.", fieldErrors, values, nonce: Date.now() };
}

export function refused(e: unknown, values: Record<string, string>): FormState {
  if (e instanceof AdminError) return { error: e.message, fieldErrors: e.fieldErrors, values, nonce: Date.now() };
  return { error: adminErrorMessage(e), values, nonce: Date.now() };
}

export function saved(message: string): FormState {
  return { ok: message, nonce: Date.now() };
}
