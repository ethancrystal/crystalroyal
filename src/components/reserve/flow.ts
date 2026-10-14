import "server-only";
import { createHmac } from "node:crypto";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { draftFingerprint, type Draft } from "@/lib/draft";
import { addDays, nightsBetween, todayInKarachi } from "@/lib/dates";
import { db } from "@/lib/db/sql";
import {
  getApartmentTypeBySlug,
  getSettings,
  isTypeAvailable,
  listAmenities,
  nearestFreeRange,
  rateFor,
  type TypeWithRate,
} from "@/lib/db/queries";
import { requireDraftSecret } from "@/lib/env";
import { PricingError, type PriceBreakdown } from "@/lib/pricing";
import { isReservable, quoteStay } from "@/lib/quote";
import type { Amenity, Rate, Settings } from "@/lib/types";
import { amenitySelection, guestDetails, stayQuery } from "@/lib/validation";
import {
  partyTooLargeMessage,
  serializeAm,
  shortRange,
  stepHref,
  unavailableMessage,
  type Choices,
  type RateLite,
  type StepNumber,
} from "./shared";

// Server side of the reserve flow: loading the type, and validating the URL choices step by step. Every step page
// and every action runs the same checks, so a guest who lands on a later step with an invalid choice is sent back
// to the earliest step that needs attention, with the problem shown there.

const SLUG = /^[a-z0-9-]{1,60}$/;

/** The active type with today's rate, or null. Cached per request (layout, page and metadata share it). */
export const loadType = cache(async (slug: string): Promise<TypeWithRate | null> =>
  SLUG.test(slug) ? getApartmentTypeBySlug(slug) : null,
);

export const loadSettings = cache(getSettings);
export const loadAmenities = cache(() => listAmenities(true));

/** Unknown slug → 404. A type that cannot be reserved online (two-bedroom today) → its apartment page. */
export async function reservableType(slug: string): Promise<TypeWithRate & { rate: Rate }> {
  const t = await loadType(slug);
  if (!t) notFound();
  if (!isReservable(t) || !t.rate) redirect(`/apartments/${t.slug}`);
  return t as TypeWithRate & { rate: Rate };
}

/**
 * The rate in force today and any later ones, for the browser preview (a stay is priced at the rate effective on
 * its arrival). Past rates are not sent.
 */
export const loadPreviewRates = cache(async (typeId: string): Promise<RateLite[]> => {
  const today = todayInKarachi();
  return db()<RateLite[]>`
    select nightly_rate, extra_adult_per_night, effective_from from rates
    where apartment_type_id = ${typeId}
      and effective_from >= coalesce(
        (select max(effective_from) from rates where apartment_type_id = ${typeId} and effective_from <= ${today}),
        ${today}::date)
    order by effective_from`;
});

/**
 * The earliest arrival: today while the Karachi time is before check-out time, otherwise tomorrow (brief, "Time and
 * money"). While check-out is still a placeholder, today.
 */
export function earliestArrival(s: Pick<Settings, "check_out">, now: Date = new Date()): string {
  const today = todayInKarachi(now);
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.check_out.trim());
  if (!m) return today;
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  return time < `${m[1].padStart(2, "0")}:${m[2]}` ? today : addDays(today, 1);
}

export function nightLimits(type: Pick<TypeWithRate, "min_nights">, s: Pick<Settings, "min_nights" | "max_nights">) {
  return { min: Math.max(type.min_nights, s.min_nights), max: s.max_nights };
}

// ---------- Step checks ----------

export interface Problem {
  step: StepNumber;
  code: string;
  message: string;
}

export interface Stay {
  arrive: string;
  depart: string;
  adults: number;
  children: number;
  rate: Rate;
}

export interface Selected {
  amenity: Amenity;
  quantity: number;
}

type Result<T> = ({ ok: true } & T) | { ok: false; problem: Problem };

const p1 = (code: string, message: string): { ok: false; problem: Problem } => ({
  ok: false,
  problem: { step: 1, code, message },
});

/** Step 1: dates, party, nights, price and availability. */
export async function checkStay(
  type: TypeWithRate,
  settings: Settings,
  c: Choices,
): Promise<Result<{ stay: Stay; breakdown: PriceBreakdown }>> {
  if (!c.arrive || !c.depart) return p1("dates", "Choose your arrival and departure to continue.");
  const parsed = stayQuery.safeParse({ arrive: c.arrive, depart: c.depart, adults: c.adults || "2", children: c.children || "0" });
  if (!parsed.success) {
    const path = String(parsed.error.issues[0]?.path[0] ?? "");
    const msg = parsed.error.issues[0]?.message ?? "";
    if (path === "adults" && /At least one adult/.test(msg)) return p1("adults", msg);
    if (path === "adults" || path === "children") return p1("party", partyTooLargeMessage(type.max_guests ?? 0));
    if (msg === "Departure must be after arrival.") return p1("order", msg);
    return p1("dates", "Choose your arrival and departure to continue.");
  }
  const { arrive, depart, adults, children } = parsed.data;
  const earliest = earliestArrival(settings);
  if (arrive < earliest) {
    return p1("past", earliest === todayInKarachi() ? "Choose an arrival from today on." : "Choose an arrival from tomorrow on.");
  }
  const limits = nightLimits(type, settings);
  const nights = nightsBetween(arrive, depart);
  if (nights < limits.min || nights > limits.max) return p1("length", `Stays are from ${limits.min} to ${limits.max} nights.`);
  if (type.max_guests !== null && adults + children > type.max_guests) {
    return p1("party", partyTooLargeMessage(type.max_guests));
  }
  const rate = await rateFor(type.id, arrive);
  if (!rate) return p1("rate", "These dates cannot be reserved online yet. Choose other dates, or write to us on WhatsApp.");
  let breakdown: PriceBreakdown;
  try {
    breakdown = quoteStay({ type, rate, settings, checkIn: arrive, checkOut: depart, adults, children, amenities: [] });
  } catch (e) {
    if (e instanceof PricingError) return p1("quote", e.message);
    throw e;
  }
  if (!(await isTypeAvailable(type.id, arrive, depart))) return p1("unavailable", unavailableMessage(type.slug, true));
  return { ok: true, stay: { arrive, depart, adults, children, rate }, breakdown };
}

/** Step 2: the amenity selection (active amenities, quantities within each maximum). */
export function checkAmenities(
  am: string,
  amenities: Amenity[],
): Result<{ selected: Selected[]; am: string }> {
  const p2 = (message: string) => ({ ok: false as const, problem: { step: 2 as const, code: "amenities", message } });
  const parsed = amenitySelection.safeParse(am);
  if (!parsed.success) return p2("Some of the services you chose could not be read. Please choose them again.");
  const seen = new Set<string>();
  const selected: Selected[] = [];
  for (const { id, quantity } of parsed.data) {
    const amenity = amenities.find((a) => a.id === id);
    if (!amenity || seen.has(id)) return p2("One of the services you chose is no longer offered. Please choose again.");
    if (quantity > amenity.max_quantity) return p2(`${amenity.name}: choose up to ${amenity.max_quantity}.`);
    seen.add(id);
    selected.push({ amenity, quantity });
  }
  const qty = Object.fromEntries(selected.map((s) => [s.amenity.id, s.quantity]));
  return { ok: true, selected, am: serializeAm(qty, amenities) };
}

export function quoteWith(type: TypeWithRate, settings: Settings, stay: Stay, selected: Selected[]): PriceBreakdown {
  return quoteStay({
    type,
    rate: stay.rate,
    settings,
    checkIn: stay.arrive,
    checkOut: stay.depart,
    adults: stay.adults,
    children: stay.children,
    amenities: selected.map((s) => ({ amenity: s.amenity, quantity: s.quantity })),
  });
}

export type GuestDraft = NonNullable<Draft["guest"]>;
const guestOnly = guestDetails.omit({ acceptRules: true });

/** Step 3: the guest's details from the signed draft cookie. */
export function checkGuest(draft: Draft | null): Result<{ guest: GuestDraft }> {
  if (!draft?.guest) return { ok: false, problem: { step: 3, code: "details", message: "Add your details to continue." } };
  const g = guestOnly.safeParse(draft.guest);
  if (!g.success) {
    return { ok: false, problem: { step: 3, code: "details", message: "Some of your details need attention." } };
  }
  return { ok: true, guest: g.data };
}

export interface Through2 {
  stay: Stay;
  selected: Selected[];
  am: string;
  breakdown: PriceBreakdown;
}

/** Steps 1 and 2 together, as every later step needs them. */
export async function checkThrough2(type: TypeWithRate, settings: Settings, c: Choices): Promise<Result<Through2>> {
  const s1 = await checkStay(type, settings, c);
  if (!s1.ok) return s1;
  const s2 = checkAmenities(c.am, await loadAmenities());
  if (!s2.ok) return s2;
  try {
    const breakdown = quoteWith(type, settings, s1.stay, s2.selected);
    return { ok: true, stay: s1.stay, selected: s2.selected, am: s2.am, breakdown };
  } catch (e) {
    if (e instanceof PricingError) return { ok: false, problem: { step: 2, code: "amenities", message: e.message } };
    throw e;
  }
}

/** Redirects to the step that needs attention, keeping every choice and naming the problem. */
export function redirectToProblem(slug: string, c: Choices, problem: Problem): never {
  redirect(stepHref(slug, problem.step, c, { error: problem.code }));
}

export function stayChoices(stay: Stay, am: string): Choices {
  return {
    arrive: stay.arrive,
    depart: stay.depart,
    adults: String(stay.adults),
    children: String(stay.children),
    am,
  };
}

// ---------- Nearest free stays ----------

export interface NearbyStay {
  arrive: string;
  depart: string;
  label: string;
}

/**
 * The nearest free stays of the same length: the closest earlier one (from the earliest arrival on) and the closest
 * later one, each within 60 days of the requested arrival.
 */
export async function nearestStays(type: TypeWithRate, settings: Settings, arrive: string, depart: string): Promise<NearbyStay[]> {
  const nights = nightsBetween(arrive, depart);
  const earliest = earliestArrival(settings);
  const today = todayInKarachi();
  const earlier = async () => {
    for (let i = 1; i <= 60; i++) {
      const start = addDays(arrive, -i);
      if (start < earliest) return null;
      const end = addDays(start, nights);
      if (await isTypeAvailable(type.id, start, end)) return { checkIn: start, checkOut: end };
    }
    return null;
  };
  const [before, after] = await Promise.all([earlier(), nearestFreeRange(type.id, arrive, depart, 60)]);
  return [before, after]
    .filter((r): r is { checkIn: string; checkOut: string } => r !== null && r.checkIn >= earliest)
    .map((r) => ({ arrive: r.checkIn, depart: r.checkOut, label: shortRange(r.checkIn, r.checkOut, today) }));
}

// ---------- Idempotency ----------

/** An opaque key for one draft (choices plus phone and email), posted with the review form. */
export function fingerprintKey(fingerprint: string): string {
  return createHmac("sha256", requireDraftSecret()).update(`reserve-idempotency:${fingerprint}`).digest("base64url");
}

export function draftFor(slug: string, stay: Stay, am: string, guest?: GuestDraft): Draft {
  return {
    slug,
    arrive: stay.arrive,
    depart: stay.depart,
    adults: stay.adults,
    children: stay.children,
    amenities: am,
    guest,
  };
}

export { draftFingerprint };

/** The reservation just made from this draft, while it is under a minute old. */
export function recentReservation(draft: Draft | null): NonNullable<Draft["created"]> | null {
  const c = draft?.created;
  if (!c) return null;
  const age = Date.now() - c.at;
  return age >= 0 && age < 60_000 ? c : null;
}

export function payHref(created: { reference: string; token: string }): string {
  return `/reservation/${created.reference}/pay?t=${encodeURIComponent(created.token)}`;
}
