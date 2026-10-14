"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import {
  checkAmenities,
  checkGuest,
  checkStay,
  checkThrough2,
  draftFingerprint,
  draftFor,
  fingerprintKey,
  loadAmenities,
  loadSettings,
  payHref,
  recentReservation,
  redirectToProblem,
  reservableType,
  stayChoices,
} from "@/components/reserve/flow";
import { DETAIL_ORDER, type DetailField, type DetailsState } from "@/components/reserve/details-types";
import { choicesFromForm, stepHref } from "@/components/reserve/shared";
import { readDraft, writeDraft } from "@/lib/draft";
import { createReservation, type CreateReservationResult } from "@/lib/db/queries";
import { notify } from "@/lib/notify";
import { rateLimit, verifyTurnstile } from "@/lib/protect";
import { safeEqual } from "@/lib/security";
import { guestDetails } from "@/lib/validation";

// Server actions of the reserve flow. Each re-validates everything it is given (zod, then the database), prices
// with quoteStay() from database rows and never trusts a total from the browser. Choices travel in the URL (posted
// here as hidden fields); the guest's details live only in the signed draft cookie.

function field(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}

async function typeFrom(fd: FormData) {
  return reservableType(field(fd, "slug").slice(0, 60));
}

/** Step 1 → step 2: dates, party, nights, price and availability. */
export async function continueDates(formData: FormData): Promise<void> {
  const type = await typeFrom(formData);
  const settings = await loadSettings();
  const c = choicesFromForm(formData);
  const s1 = await checkStay(type, settings, c);
  if (!s1.ok) redirectToProblem(type.slug, c, s1.problem);
  // Amenities chosen earlier stay with the stay; step 2 checks them again.
  redirect(stepHref(type.slug, 2, stayChoices(s1.stay, c.am)));
}

/** Step 2 → step 3: the amenity selection, or none ("Skip for now"). */
export async function continueAmenities(formData: FormData): Promise<void> {
  const type = await typeFrom(formData);
  const settings = await loadSettings();
  const c = choicesFromForm(formData);
  if (field(formData, "skip") === "1") c.am = "";
  const s1 = await checkStay(type, settings, c);
  if (!s1.ok) redirectToProblem(type.slug, c, s1.problem);
  const s2 = checkAmenities(c.am, await loadAmenities());
  if (!s2.ok) redirectToProblem(type.slug, c, s2.problem);
  redirect(stepHref(type.slug, 3, stayChoices(s1.stay, s2.am)));
}

/** Step 3 → step 4: validates the guest's details and keeps them in the signed draft cookie only. */
export async function saveDetails(_prev: DetailsState, formData: FormData): Promise<DetailsState> {
  const type = await typeFrom(formData);
  const settings = await loadSettings();
  const c = choicesFromForm(formData);
  const through = await checkThrough2(type, settings, c);
  if (!through.ok) redirectToProblem(type.slug, c, through.problem);

  const values = {
    name: field(formData, "name").slice(0, 200),
    phone: field(formData, "phone").slice(0, 60),
    email: field(formData, "email").slice(0, 254),
    arrivalTime: field(formData, "arrivalTime").slice(0, 60),
    requests: field(formData, "requests").slice(0, 2000),
    acceptRules: formData.get("acceptRules") === "on",
  };
  const parsed = guestDetails.safeParse(values);
  if (!parsed.success) {
    const errors: DetailsState["errors"] = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "") as DetailField;
      if (!DETAIL_ORDER.includes(key) || errors[key]) continue;
      if (key === "arrivalTime") errors[key] = "Choose an arrival time from the list.";
      else if (key === "requests") errors[key] = "Keep this to 1,000 characters.";
      else if (key === "name" && issue.code === "too_big") errors[key] = "Enter your name in 120 characters or fewer.";
      else if (key === "email" && issue.code === "too_big") errors[key] = "Enter an email address we can write to.";
      else errors[key] = issue.message;
    }
    return { errors, values, attempt: (_prev?.attempt ?? 0) + 1 };
  }

  const { acceptRules: _accepted, ...guest } = parsed.data;
  const previous = await readDraft();
  await writeDraft({ ...draftFor(type.slug, through.stay, through.am, guest), created: previous?.created });
  redirect(stepHref(type.slug, 4, stayChoices(through.stay, through.am)));
}

/**
 * Step 4: creates the reservation. Order: the idempotency check first (cookie only, no database write; a resubmitted
 * form carries a Turnstile token that cannot be verified twice), then Turnstile, the rate limit, validation of the
 * URL choices and the draft, the price from database rows, and create_reservation().
 */
export async function reserve(formData: FormData): Promise<void> {
  const type = await typeFrom(formData);
  const c = choicesFromForm(formData);
  const reviewHref = (error: string, extra: Record<string, string> = {}) =>
    stepHref(type.slug, 4, c, { error, ...extra });
  const postedKey = field(formData, "key");
  const draft = await readDraft();

  // The same draft reserved under a minute ago: return that reservation instead of creating a second one.
  const recent = recentReservation(draft);
  if (recent && postedKey && safeEqual(fingerprintKey(recent.fingerprint), postedKey)) redirect(payHref(recent));

  if (!(await verifyTurnstile(field(formData, "cf-turnstile-response") || null))) redirect(reviewHref("verify"));
  if (!(await rateLimit("reserve"))) redirect(reviewHref("busy"));

  const settings = await loadSettings();
  const through = await checkThrough2(type, settings, c);
  if (!through.ok) {
    // The stay was free when the review was shown: someone has reserved these nights since.
    const p = through.problem.code === "unavailable" ? { ...through.problem, code: "taken" } : through.problem;
    redirectToProblem(type.slug, c, p);
  }
  const g = checkGuest(draft);
  if (!g.ok) redirectToProblem(type.slug, stayChoices(through.stay, through.am), g.problem);

  const { stay, am, breakdown, selected } = through;
  const current = draftFor(type.slug, stay, am, g.guest);
  const fingerprint = draftFingerprint(current);
  if (recent && recent.fingerprint === fingerprint) redirect(payHref(recent));
  // The details or choices changed in another window since this page was shown: show the review again.
  if (postedKey && !safeEqual(fingerprintKey(fingerprint), postedKey)) redirect(reviewHref("changed"));
  // The amount was recalculated (a new rate or amenity price): the guest reviews it before reserving.
  const shown = Number(field(formData, "shown_total"));
  if (Number.isInteger(shown) && shown !== breakdown.total) redirect(reviewHref("price", { was: String(shown) }));

  let result: CreateReservationResult | null = null;
  try {
    result = await createReservation({
      apartment_type_id: type.id,
      check_in: stay.arrive,
      check_out: stay.depart,
      adults: stay.adults,
      children: stay.children,
      guest_name: g.guest.name,
      guest_phone: g.guest.phone,
      guest_email: g.guest.email,
      arrival_time: g.guest.arrivalTime,
      requests: g.guest.requests,
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
      source: "web",
      amenities: breakdown.amenityLines.map((l) => ({
        amenity_id: l.id,
        name: l.name,
        pricing_type: selected.find((s) => s.amenity.id === l.id)?.amenity.pricing_type ?? l.pricingType,
        quantity: l.quantity,
        unit_price: l.unitPrice,
        line_total: l.lineTotal,
      })),
    });
  } catch (e) {
    console.error("create_reservation failed", e);
  }
  if (!result) redirect(reviewHref("failed"));
  if (!result.ok) {
    const back = stayChoices(stay, am);
    if (result.error === "not_available") redirect(stepHref(type.slug, 1, back, { error: "taken" }));
    redirect(stepHref(type.slug, 1, back, { error: "dates" }));
  }

  const created = { fingerprint, reference: result.reference, token: result.access_token, at: Date.now() };
  // The guest's details are cleared from the cookie; only the idempotency record remains.
  await writeDraft({ ...current, guest: undefined, created });

  const id = result.id;
  // Emails go after the response; notify() never throws, and a failure is logged to activity_log.
  after(async () => {
    await notify("reservation_received", id);
    await notify("owner_new_reservation", id);
  });

  redirect(payHref(created));
}
