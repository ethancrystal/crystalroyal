import "server-only";
import { getSettings, rateFor } from "@/lib/db/queries";
import { listTypesWithUnits } from "@/lib/db/admin-queries";
import { renderEmail, type EmailKind } from "@/lib/emails";
import { env } from "@/lib/env";
import { nightsBetween } from "@/lib/dates";
import { quoteStay } from "@/lib/quote";
import type { Reservation, Settings } from "@/lib/types";

// The sample reservation behind the email previews: the canvas's sample stay (CRA-2611-0042, Sana Ahmed,
// three-bedroom, 2 to 5 November 2026, 2 adults and 4 children), priced with quoteStay() from the current rate and
// settings, so tax and deposit lines read as guests would see them today. Nothing here is stored or sent.

export interface EmailPreview {
  kind: EmailKind;
  label: string;
  to: string;
  when: string;
  subject: string;
  text: string;
  html: string;
}

const CHECK_IN = "2026-11-02";
const CHECK_OUT = "2026-11-05";

const KINDS: { kind: EmailKind; label: string; to: "guest" | "owner"; when: string; extra?: Record<string, string> }[] = [
  { kind: "reservation_received", label: "Reservation received", to: "guest", when: "When a reservation is made. Carries the payment instructions." },
  { kind: "hold_reminder", label: "Hold reminder", to: "guest", when: "Two hours before an unpaid hold ends, when holds last four hours or more." },
  { kind: "receipt_received", label: "Receipt received", to: "guest", when: "When the guest uploads a transfer receipt." },
  { kind: "owner_receipt_uploaded", label: "Receipt received, to owner", to: "owner", when: "When the guest uploads a transfer receipt." },
  { kind: "confirmed", label: "Confirmed", to: "guest", when: "When the payment is verified or recorded and the stay is confirmed." },
  { kind: "receipt_rejected", label: "Receipt not matched", to: "guest", when: "When a receipt is rejected, with the reason given.", extra: { reason: "[Reason]." } },
  { kind: "hold_ended", label: "Hold expired", to: "guest", when: "When a hold ends without a payment.", extra: { slug: "three-bedroom" } },
  { kind: "cancelled", label: "Cancelled", to: "guest", when: "When a reservation is cancelled, with the reason given.", extra: { reason: "[Reason]" } },
  { kind: "owner_new_reservation", label: "New reservation, to owner", to: "owner", when: "When a guest reserves online." },
  {
    kind: "owner_cancellation_requested",
    label: "Cancellation requested, to owner",
    to: "owner",
    when: "When a guest asks to cancel from their reservation page.",
    extra: { reason: "[Reason]" },
  },
];

function sampleReservation(settings: Settings, priced: { nightlyRate: number; subtotal: number; extraAdults: number; extraAmount: number; amenities: number; tax: number; total: number; due: number }, typeId: string): Reservation {
  const created = "2026-10-31T16:40:00.000Z";
  const hold = new Date(Date.parse(created) + settings.hold_hours * 3_600_000).toISOString();
  return {
    id: "00000000-0000-4000-8000-000000000042",
    reference: "CRA-2611-0042",
    access_token: "sample-preview-link",
    apartment_type_id: typeId,
    unit_id: "00000000-0000-4000-8000-000000000001",
    check_in: CHECK_IN,
    check_out: CHECK_OUT,
    adults: 2,
    children: 4,
    guest_name: "Sana Ahmed",
    guest_phone: "[+92 XXX XXXXXXX]",
    guest_email: "[guest email]",
    arrival_time: "",
    requests: "",
    status: "reserved",
    source: "web",
    nightly_rate: priced.nightlyRate,
    nights: nightsBetween(CHECK_IN, CHECK_OUT),
    subtotal_nights: priced.subtotal,
    extra_adults: priced.extraAdults,
    extra_adults_amount: priced.extraAmount,
    amenities_amount: priced.amenities,
    tax_rate_percent: settings.tax_rate_percent,
    tax_label: settings.tax_label,
    tax_amount: priced.tax,
    total: priced.total,
    amount_due: priced.due,
    currency: "PKR",
    hold_expires_at: hold,
    hold_extended: false,
    confirmed_at: null,
    checked_in_at: null,
    completed_at: null,
    cancelled_at: null,
    cancel_reason: null,
    cancellation_requested_at: null,
    admin_notes: "",
    created_at: created,
    updated_at: created,
  };
}

export async function emailPreviews(): Promise<{ previews: EmailPreview[]; priced: boolean }> {
  const [settings, types] = await Promise.all([getSettings(), listTypesWithUnits()]);
  const type = types.find((t) => t.slug === "three-bedroom") ?? types[0];
  const rate = type ? await rateFor(type.id, CHECK_IN) : null;

  let priced = { nightlyRate: 25000, subtotal: 75000, extraAdults: 0, extraAmount: 0, amenities: 0, tax: 0, total: 75000, due: 75000 };
  let fromEngine = false;
  if (type && rate) {
    try {
      const q = quoteStay({ type, rate, settings, checkIn: CHECK_IN, checkOut: CHECK_OUT, adults: 2, children: 4, amenities: [] });
      priced = {
        nightlyRate: q.nightlyRate,
        subtotal: q.subtotalNights,
        extraAdults: q.extraAdults,
        extraAmount: q.extraAmount,
        amenities: q.amenitiesAmount,
        tax: q.taxAmount,
        total: q.total,
        due: q.amountDue,
      };
      fromEngine = true;
    } catch {
      // The sample stay could not be priced (for example the type is not reservable): keep the worked example.
    }
  }

  const reservation = sampleReservation(settings, priced, type?.id ?? "00000000-0000-4000-8000-000000000003");
  const previews = await Promise.all(
    KINDS.map(async (k) => {
      const msg = await renderEmail(k.kind, { reservation, settings, extra: k.extra ?? {}, siteUrl: env.siteUrl });
      return {
        kind: k.kind,
        label: k.label,
        to: k.to === "owner" ? `Owner alerts email, ${settings.owner_notify_email}` : "The guest’s email",
        when: k.when,
        ...msg,
      };
    }),
  );
  return { previews, priced: fromEngine };
}
