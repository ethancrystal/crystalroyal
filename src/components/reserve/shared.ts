import { monthName, ledgerDate, numberWord } from "@/components/calendar-logic";
import { isIsoDate } from "@/lib/dates";
import { formatNumber } from "@/lib/money";
import { PricingError, type PriceBreakdown } from "@/lib/pricing";
import { quoteStay } from "@/lib/quote";
import type { Amenity, ApartmentType, Rate, Settings } from "@/lib/types";

// Pure helpers shared by the reserve-flow pages (server) and their client components. No React, no server modules.
// The guest's choices travel in the URL: ?arrive=&depart=&adults=&children=&am=id:qty,id:qty

export const RESERVE_STEPS = [
  { n: 1, label: "Dates and guests", segment: "" },
  { n: 2, label: "At your service", segment: "amenities" },
  { n: 3, label: "Your details", segment: "details" },
  { n: 4, label: "Review", segment: "review" },
] as const;

export type StepNumber = 1 | 2 | 3 | 4;

/** Raw choices from the URL or a form, as strings. Validated on the server by flow.ts. */
export interface Choices {
  arrive: string;
  depart: string;
  adults: string;
  children: string;
  am: string;
}

/** The pricing settings a client preview needs. Never pass bank or contact settings to the browser. */
export type PricingSettings = Pick<
  Settings,
  "tax_rate_percent" | "tax_label" | "deposit_policy" | "child_extra_policy" | "child_extra_fee" | "min_nights" | "max_nights"
>;

export type RateLite = Pick<Rate, "nightly_rate" | "extra_adult_per_night" | "effective_from">;
export type AmenityLite = Pick<Amenity, "id" | "name" | "description" | "pricing_type" | "price" | "max_quantity">;
export type TypeLite = Pick<ApartmentType, "slug" | "name" | "standard_guests" | "max_guests" | "min_nights">;

export function pricingSettings(s: Settings): PricingSettings {
  return {
    tax_rate_percent: s.tax_rate_percent,
    tax_label: s.tax_label,
    deposit_policy: s.deposit_policy,
    child_extra_policy: s.child_extra_policy,
    child_extra_fee: s.child_extra_fee,
    min_nights: s.min_nights,
    max_nights: s.max_nights,
  };
}

type Params = Record<string, string | string[] | undefined> | URLSearchParams;

function one(sp: Params, key: string): string {
  if (sp instanceof URLSearchParams) return sp.get(key) ?? "";
  const v = sp[key];
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export function choicesFrom(sp: Params): Choices {
  return {
    arrive: one(sp, "arrive").slice(0, 10),
    depart: one(sp, "depart").slice(0, 10),
    adults: one(sp, "adults").slice(0, 3),
    children: one(sp, "children").slice(0, 3),
    am: one(sp, "am").slice(0, 2000),
  };
}

export function choicesFromForm(fd: FormData): Choices {
  const s = (k: string) => {
    const v = fd.get(k);
    return typeof v === "string" ? v : "";
  };
  return {
    arrive: s("arrive").slice(0, 10),
    depart: s("depart").slice(0, 10),
    adults: s("adults").slice(0, 3),
    children: s("children").slice(0, 3),
    am: s("am").slice(0, 2000),
  };
}

export function stepPath(slug: string, step: StepNumber): string {
  const seg = RESERVE_STEPS[step - 1].segment;
  return `/reserve/${slug}${seg ? `/${seg}` : ""}`;
}

/** Query string for the choices, in a stable order; empty values are left out. */
export function choicesQuery(c: Partial<Choices>, extra: Record<string, string | undefined> = {}): string {
  const q = new URLSearchParams();
  for (const k of ["arrive", "depart", "adults", "children", "am"] as const) {
    const v = c[k];
    if (v) q.set(k, v);
  }
  for (const [k, v] of Object.entries(extra)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function stepHref(
  slug: string,
  step: StepNumber,
  c: Partial<Choices>,
  extra: Record<string, string | undefined> = {},
): string {
  return `${stepPath(slug, step)}${choicesQuery(c, extra)}`;
}

/** Lenient parse of "id:qty,id:qty" for the browser (the server validates with amenitySelection). */
export function parseAm(am: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const pair of am.split(",")) {
    const [id, qty] = pair.split(":");
    const n = Number(qty ?? "1");
    if (id && /^[0-9a-f-]{36}$/i.test(id) && Number.isInteger(n) && n > 0) out[id] = n;
  }
  return out;
}

/** "id:qty,..." in the amenities' display order, leaving out zero quantities. */
export function serializeAm(qty: Record<string, number>, order: { id: string }[]): string {
  return order
    .filter((a) => (qty[a.id] ?? 0) > 0)
    .map((a) => `${a.id}:${qty[a.id]}`)
    .join(",");
}

export function intOr(v: string, fallback: number): number {
  const n = v.trim() === "" ? NaN : Number(v);
  return Number.isInteger(n) ? n : fallback;
}

export function validIso(v: string): string {
  return v && isIsoDate(v) ? v : "";
}

/** The rate a stay is priced at: the latest row effective on its arrival (rateFor() on the server). */
export function rateForArrival<R extends Pick<Rate, "effective_from">>(rates: R[], arrive: string, fallback: R): R {
  if (!arrive) return fallback;
  let best: R | null = null;
  for (const r of rates) if (r.effective_from <= arrive && (!best || r.effective_from > best.effective_from)) best = r;
  return best ?? fallback;
}

/** Per-night fee for an additional child under the child policy (used to split the ledger line). */
export function childFee(
  s: Pick<Settings, "child_extra_policy" | "child_extra_fee">,
  rate: Pick<Rate, "extra_adult_per_night">,
): number | null {
  if (s.child_extra_policy === "free") return 0;
  if (s.child_extra_policy === "reduced") return s.child_extra_fee ?? rate.extra_adult_per_night;
  return rate.extra_adult_per_night;
}

/**
 * The browser preview of a stay's price with the same rows the server uses. The server recomputes it at every step;
 * this only keeps the spine and the bar current while the guest chooses.
 */
export function previewQuote(args: {
  type: TypeLite;
  rates: RateLite[];
  currentRate: RateLite;
  settings: PricingSettings;
  arrive: string;
  depart: string;
  adults: number;
  children: number;
  qty: Record<string, number>;
  amenities: AmenityLite[];
  today: string;
}): { breakdown: PriceBreakdown | null; error: string; rate: RateLite } {
  const rate = rateForArrival(args.rates, args.arrive, args.currentRate);
  if (!args.arrive || !args.depart) return { breakdown: null, error: "", rate };
  if (args.arrive < args.today) return { breakdown: null, error: "Choose an arrival from today on.", rate };
  try {
    const breakdown = quoteStay({
      type: args.type,
      rate,
      settings: args.settings,
      checkIn: args.arrive,
      checkOut: args.depart,
      adults: args.adults,
      children: args.children,
      amenities: args.amenities
        .filter((a) => (args.qty[a.id] ?? 0) > 0)
        .map((a) => ({ amenity: a, quantity: Math.min(args.qty[a.id], a.max_quantity) })),
    });
    return { breakdown, error: "", rate };
  } catch (e) {
    return {
      breakdown: null,
      error: e instanceof PricingError ? e.message : "The price could not be worked out for these dates.",
      rate,
    };
  }
}

// ---------- Words ----------

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const nightsWords = (n: number) => plural(n, "night", "nights");
export const guestsWords = (n: number) => plural(n, "guest", "guests");

/** "2 adults, 4 children" / "1 adult" */
export function partyWords(adults: number, children: number): string {
  const a = plural(adults, "adult", "adults");
  return children > 0 ? `${a}, ${plural(children, "child", "children")}` : a;
}

const year = (iso: string) => iso.slice(0, 4);
const day = (iso: string) => Number(iso.slice(8, 10));

/** "2 – 5 November 2026", "30 October – 2 November 2026", "30 December 2026 – 2 January 2027". */
export function stayRange(arrive: string, depart: string): string {
  if (year(arrive) !== year(depart)) {
    return `${day(arrive)} ${monthName(arrive)} ${year(arrive)} – ${day(depart)} ${monthName(depart)} ${year(depart)}`;
  }
  if (arrive.slice(0, 7) === depart.slice(0, 7)) return `${day(arrive)} – ${day(depart)} ${monthName(depart)} ${year(depart)}`;
  return `${day(arrive)} ${monthName(arrive)} – ${day(depart)} ${monthName(depart)} ${year(depart)}`;
}

/** "6 – 9 November" (canvas "See 6 – 9 November"); the year only when it is not the current one. */
export function shortRange(arrive: string, depart: string, today: string): string {
  const full = stayRange(arrive, depart);
  return year(depart) === year(today) && year(arrive) === year(today) ? full.replace(` ${year(depart)}`, "") : full;
}

/** "Mon 2 Nov → Thu 5 Nov" */
export function arrowRange(arrive: string, depart: string, today: string): string {
  return `${ledgerDate(arrive, today)} → ${ledgerDate(depart, today)}`;
}

/** The step 1 party lines (copy deck): the extra-guest charge past standard, the maximum at the limit. */
export function partyLines(
  guests: number,
  standard: number,
  max: number,
  extraFee: number | null,
): string[] {
  if (guests > max) return [];
  const lines: string[] = [];
  if (guests <= standard) {
    lines.push(`${guestsWords(guests)}, within the standard ${numberWord(standard)}.`);
  } else if (extraFee !== null) {
    const first = standard + 1;
    const who =
      max === first ? `Guest ${first} is` : max === first + 1 ? `Guests ${first} and ${max} are` : `Guests ${first} to ${max} are`;
    lines.push(`${who} charged PKR ${formatNumber(extraFee)} per adult per night.`);
  }
  if (guests === max) lines.push(`This apartment accommodates up to ${max} guests.`);
  return lines;
}

/** The copy deck's refusal for a party above the maximum (exact wording). */
export function partyTooLargeMessage(max: number): string {
  return `This apartment accommodates up to ${max} guests. For a larger party, write to us and we will suggest an arrangement.`;
}

/** Adults and Children stepper hints from settings.child_max_age (a guest this age or younger counts as a child). */
export function ageHints(childMaxAge: number | null): { adults: string; children: string } {
  const age = childMaxAge === null ? "[12]" : String(childMaxAge);
  return { adults: `Over ${age}`, children: `${age} and under, counted in the party` };
}

/** "three-bedroom" → "These dates are not available for the three-bedroom apartment." */
export function unavailableMessage(slug: string, withNearest: boolean): string {
  return withNearest
    ? `These dates are not available for the ${slug} apartment. The nearest available stays are below.`
    : `These dates are not available for the ${slug} apartment.`;
}
