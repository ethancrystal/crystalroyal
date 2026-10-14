"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { PAYMENT_METHODS, adminErrorMessage, recordPayment, type EmailHint } from "@/lib/db/admin-queries";
import {
  createReservation,
  getSettings,
  isTypeAvailable,
  listAmenities,
  listApartmentTypes,
  rateFor,
  type CreateReservationResult,
} from "@/lib/db/queries";
import { todayInKarachi } from "@/lib/dates";
import { notify } from "@/lib/notify";
import { PricingError, type PriceBreakdown } from "@/lib/pricing";
import { isReservable, quoteStay } from "@/lib/quote";
import { isoDate, phone } from "@/lib/validation";
import { attributeCreation } from "@/components/admin/reservations/data";
import { detailHref, type ActionState } from "@/components/admin/reservations/shared";

// Phone and walk-in bookings. requireAdmin(), zod on every field, the price recomputed with quoteStay() from
// database rows (the browser preview is never trusted), create_reservation() with source 'admin' (it assigns the
// unit and the reference under the type lock), then optionally recordPayment(), which confirms through transition().
// Emails go after the response through notify().

const intField = (min: number, max: number, message: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.coerce.number({ invalid_type_error: message }).int(message).min(min, message).max(max, message),
  );

const stayInput = z
  .object({
    typeId: z.string().uuid("Choose an apartment."),
    arrive: z.string().min(1, "Choose the arrival date.").pipe(isoDate),
    depart: z.string().min(1, "Choose the departure date.").pipe(isoDate),
    adults: intField(1, 30, "At least one adult is required."),
    children: intField(0, 30, "Enter the number of children, 0 or more."),
    name: z.string().trim().min(2, "Enter the guest's full name.").max(120, "Enter the name in 120 characters or fewer."),
    phone,
    email: z
      .string()
      .trim()
      .max(200, "Enter an email address, or leave it empty.")
      .refine((v) => v === "" || z.string().email().safeParse(v).success, "Enter an email address, or leave it empty.")
      .default(""),
    arrivalTime: z.string().trim().max(40, "Keep the arrival time under 40 characters.").default(""),
    requests: z.string().trim().max(1000, "Keep the requests to 1,000 characters.").default(""),
    recordNow: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  })
  .refine((v) => v.depart > v.arrive, { message: "Departure must be after arrival.", path: ["depart"] });

const paymentInput = z.object({
  method: z.enum(PAYMENT_METHODS, { errorMap: () => ({ message: "Choose how it was paid." }) }),
  amount: intField(1, 100_000_000, "Enter the amount received in whole rupees."),
  bankReference: z.string().trim().max(100, "Keep the reference under 100 characters.").default(""),
});

const quantity = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? "0" : v),
  z.coerce.number({ invalid_type_error: "Enter a whole number." }).int("Enter a whole number.").min(0, "Enter 0 or more.").max(30),
);

function fields(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

function invalid(error: z.ZodError): ActionState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { error: "Check the highlighted fields.", fieldErrors };
}

const fieldError = (field: string, message: string): ActionState => ({ error: message, fieldErrors: { [field]: message } });

export async function createPhoneReservation(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const raw = fields(form);

  const parsed = stayInput.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;

  let payment: z.output<typeof paymentInput> | null = null;
  if (v.recordNow) {
    const p = paymentInput.safeParse(raw);
    if (!p.success) return invalid(p.error);
    payment = p.data;
  }

  const [types, settings, active] = await Promise.all([listApartmentTypes(), getSettings(), listAmenities(true)]);
  const type = types.find((t) => t.id === v.typeId);
  if (!type) return fieldError("typeId", "Choose an apartment.");
  if (!isReservable(type)) {
    return fieldError("typeId", `Set the standard and maximum guests for the ${type.short_name} in Settings before reserving it.`);
  }
  if (v.arrive < todayInKarachi()) return fieldError("arrive", "Choose an arrival from today on.");

  // Services: "am_<id>" quantities; only active amenities, within each maximum.
  const chosen: { amenity: (typeof active)[number]; quantity: number }[] = [];
  for (const [key, value] of Object.entries(raw)) {
    if (!key.startsWith("am_")) continue;
    const amenityId = key.slice(3);
    const q = quantity.safeParse(value);
    if (!q.success) return fieldError(key, q.error.issues[0]?.message ?? "Enter a whole number.");
    if (q.data === 0) continue;
    const amenity = active.find((a) => a.id === amenityId);
    if (!amenity) return fieldError("amenities", "One of the services is no longer offered. Reload the page.");
    if (q.data > amenity.max_quantity) return fieldError(key, `${amenity.name}: choose up to ${amenity.max_quantity}.`);
    chosen.push({ amenity, quantity: q.data });
  }

  const rate = await rateFor(type.id, v.arrive);
  if (!rate) return fieldError("arrive", "There is no rate for these dates yet. Add one in Settings first.");

  let breakdown: PriceBreakdown;
  try {
    breakdown = quoteStay({
      type,
      rate,
      settings,
      checkIn: v.arrive,
      checkOut: v.depart,
      adults: v.adults,
      children: v.children,
      amenities: chosen,
    });
  } catch (e) {
    if (!(e instanceof PricingError)) return { error: adminErrorMessage(e) };
    const field = /nights|night/.test(e.message) ? "depart" : /guests|adult|Children/.test(e.message) ? "adults" : "_";
    return field === "_" ? { error: e.message } : fieldError(field, e.message);
  }

  if (!(await isTypeAvailable(type.id, v.arrive, v.depart))) {
    return fieldError("arrive", `These dates are not available for the ${type.short_name}. Choose other dates.`);
  }

  let result: CreateReservationResult;
  try {
    result = await createReservation({
      apartment_type_id: type.id,
      check_in: v.arrive,
      check_out: v.depart,
      adults: v.adults,
      children: v.children,
      guest_name: v.name,
      guest_phone: v.phone,
      guest_email: v.email,
      arrival_time: v.arrivalTime,
      requests: v.requests,
      nightly_rate: breakdown.nightlyRate,
      nights: breakdown.nights,
      subtotal_nights: breakdown.subtotalNights,
      extra_adults: breakdown.extraGuests,
      extra_adults_amount: breakdown.extraAmount,
      amenities_amount: breakdown.amenitiesAmount,
      tax_rate_percent: breakdown.taxRatePercent,
      tax_label: settings.tax_label,
      tax_amount: breakdown.taxAmount,
      total: breakdown.total,
      amount_due: breakdown.amountDue,
      status: "reserved",
      source: "admin",
      amenities: breakdown.amenityLines.map((l) => ({
        amenity_id: l.id,
        name: l.name,
        pricing_type: l.pricingType,
        quantity: l.quantity,
        unit_price: l.unitPrice,
        line_total: l.lineTotal,
      })),
    });
  } catch (e) {
    return { error: adminErrorMessage(e) };
  }
  if (!result.ok) {
    if (result.error === "not_available") {
      return fieldError("arrive", `These dates are not available for the ${type.short_name}. Choose other dates.`);
    }
    if (result.error === "bad_dates") return fieldError("depart", "Departure must be after arrival.");
    return fieldError("typeId", "That apartment cannot be reserved just now.");
  }

  const id = result.id;
  try {
    await attributeCreation(id, admin);
  } catch (e) {
    console.error("could not attribute the new reservation to the admin", e);
  }

  let email: EmailHint = { kind: "reservation_received" };
  let done: "created" | "created_confirmed" | "created_payment_failed" = "created";
  if (payment) {
    try {
      const out = await recordPayment(
        { reservationId: id, method: payment.method, amount: payment.amount, bankReference: payment.bankReference || null },
        admin,
      );
      if (out.email) email = out.email;
      done = "created_confirmed";
    } catch (e) {
      console.error("payment for a new phone reservation was not recorded", e);
      done = "created_payment_failed";
    }
  }

  const mail = email;
  after(() => notify(mail.kind, id, mail.extra ?? {}));
  revalidatePath("/admin", "layout");
  redirect(detailHref(id, done));
}
