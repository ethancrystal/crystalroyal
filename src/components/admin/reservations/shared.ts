import { whatsappLink } from "@/lib/site";
import type { ReservationStatus } from "@/lib/status";

// Shared, framework-free pieces of the reservations console (usable from server pages, client forms and actions).

/** What a console server action returns when it does not redirect (a refusal, with per-field messages). */
export interface ActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

export const EMPTY_STATE: ActionState = {};

export type ConsoleAction = (prev: ActionState, form: FormData) => Promise<ActionState>;

/** Filter values as they travel in the URL (GET form, CSV link). */
export interface FilterValues {
  q?: string;
  status?: string;
  type?: string;
  unit?: string;
  from?: string;
  to?: string;
}

/** The query string for a filter, dropping empty values: "status=confirmed&type=..." (no leading "?"). */
export function filterQuery(f: FilterValues): string {
  const p = new URLSearchParams();
  for (const k of ["q", "status", "type", "unit", "from", "to"] as const) {
    const v = f[k];
    if (v) p.set(k, v);
  }
  return p.toString();
}

/** Status filter options, in the canvas order ("All statuses", "Payment received", ...). */
export const STATUS_OPTIONS: { value: "" | ReservationStatus; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "payment_submitted", label: "Payment received" },
  { value: "reserved", label: "Reserved" },
  { value: "confirmed", label: "Confirmed" },
  { value: "checked_in", label: "Checked in" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "expired", label: "Expired" },
];

/**
 * The guest's number for wa.me: digits only, country code first. A Pakistani number written with a leading 0
 * (0300 1234567) becomes 92300 1234567; anything else is used as written.
 */
export function guestWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (/^0\d{10}$/.test(digits)) return `92${digits.slice(1)}`;
  if (digits.startsWith("00")) return digits.slice(2);
  return digits;
}

/** "Message guest on WhatsApp": a wa.me link to the guest with the reference prefilled, or null. */
export function guestWhatsAppHref(phone: string, reference: string): string | null {
  return whatsappLink(guestWhatsAppNumber(phone), `Crystal Royal Apartment, reservation ${reference}. `);
}

/** Codes the detail page turns into a "Saved." notice after an action redirects back to it. */
export const DONE_CODES = [
  "verified",
  "receipt_verified",
  "rejected",
  "rejected_quiet",
  "recorded",
  "recorded_confirmed",
  "cancelled",
  "checked_in",
  "checked_out",
  "note",
  "moved",
  "created",
  "created_confirmed",
  "created_payment_failed",
] as const;
export type DoneCode = (typeof DONE_CODES)[number];

export function detailHref(id: string, done?: DoneCode): string {
  // "n" changes on every redirect so the notice is announced (and focused) again after a repeated action.
  return done ? `/admin/reservations/${id}?done=${done}&n=${Date.now().toString(36)}` : `/admin/reservations/${id}`;
}
