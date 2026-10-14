import type { Metadata } from "next";
import Link from "next/link";
import { ResultRow, type ResultState } from "@/components/apartment/result-row";
import { spokenDate, spokenDay } from "@/components/calendar-logic";
import { AvailabilityBar } from "@/components/home/availability-bar";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  getSettings,
  isTypeAvailable,
  listApartmentTypes,
  nearestFreeRange,
  rateFor,
  type TypeWithRate,
} from "@/lib/db/queries";
import { nightsBetween, todayInKarachi } from "@/lib/dates";
import { PricingError } from "@/lib/pricing";
import { rateLimit } from "@/lib/protect";
import { isReservable, quoteStay } from "@/lib/quote";
import { SITE } from "@/lib/site";
import type { Settings } from "@/lib/types";
import { stayQuery, type StayQuery } from "@/lib/validation";

// Availability results for ?arrive=&depart=&adults=&children= (the home page's availability bar posts here by GET).
// Every figure is recomputed on the server: quoteStay() with the rate effective on the arrival date, and the
// database's unit availability. Nothing here is trusted from the browser.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Availability — Crystal Royal Apartment, Karachi",
  description: "See which apartment is free for your dates and the price for your party, before you reserve.",
  alternates: { canonical: "/availability" },
  robots: { index: false, follow: true },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function one(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s === undefined || s.trim() === "" ? undefined : s.trim().slice(0, 40);
}

/** "2 to 5 November", "30 November to 2 December", "30 December 2026 to 2 January 2027". */
function stayRange(arrive: string, depart: string, today: string): string {
  const [ay, am, ad] = arrive.split("-").map(Number);
  const [dy, dm, dd] = depart.split("-").map(Number);
  const withYear = ay !== dy || String(ay) !== today.slice(0, 4);
  if (withYear) return `${ad} ${MONTHS[am - 1]} ${ay} to ${dd} ${MONTHS[dm - 1]} ${dy}`;
  if (am === dm) return `${ad} to ${dd} ${MONTHS[dm - 1]}`;
  return `${ad} ${MONTHS[am - 1]} to ${dd} ${MONTHS[dm - 1]}`;
}

function partyWords(adults: number, children: number): string {
  const a = `${adults} ${adults === 1 ? "adult" : "adults"}`;
  return children > 0 ? `${a}, ${children} ${children === 1 ? "child" : "children"}` : a;
}

function stayParams(q: Pick<StayQuery, "adults" | "children">, arrive: string, depart: string): string {
  return new URLSearchParams({ arrive, depart, adults: String(q.adults), children: String(q.children) }).toString();
}

/** zod issues in the guest's words, one per field. */
function problemsFrom(raw: Record<string, string | undefined>): string[] {
  const parsed = stayQuery.safeParse(raw);
  if (parsed.success) return [];
  const out = new Map<string, string>();
  for (const issue of parsed.error.issues) {
    const field = String(issue.path[0] ?? "");
    if (out.has(field)) continue;
    if (field === "arrive") out.set(field, "Choose an arrival date.");
    else if (field === "depart")
      out.set(field, issue.message === "Departure must be after arrival." ? issue.message : "Choose a departure date.");
    else if (field === "adults")
      out.set(field, issue.message === "At least one adult is required." ? issue.message : "Choose the number of adults.");
    else if (field === "children") out.set(field, "Choose the number of children.");
    else out.set(field, issue.message);
  }
  return [...out.values()];
}

async function resultFor(type: TypeWithRate, q: StayQuery, settings: Settings, today: string): Promise<ResultState> {
  if (!isReservable(type)) return { kind: "enquire" };
  const rate = await rateFor(type.id, q.arrive);
  if (!rate) return { kind: "refused", message: "Rates for these dates are confirmed directly with the property." };

  let breakdown;
  try {
    breakdown = quoteStay({
      type,
      rate,
      settings,
      checkIn: q.arrive,
      checkOut: q.depart,
      adults: q.adults,
      children: q.children,
      amenities: [],
    });
  } catch (e) {
    if (!(e instanceof PricingError)) throw e;
    const tooMany = type.max_guests !== null && q.adults + q.children > type.max_guests;
    return tooMany ? { kind: "party", message: e.message } : { kind: "refused", message: e.message };
  }

  if (!(await isTypeAvailable(type.id, q.arrive, q.depart))) {
    const free = await nearestFreeRange(type.id, q.arrive, q.depart);
    const sameYear = free ? free.checkIn.slice(0, 4) === today.slice(0, 4) : true;
    return {
      kind: "unavailable",
      freeFrom: free ? (sameYear ? spokenDay(free.checkIn) : spokenDate(free.checkIn)) : null,
      seeHref: `/apartments/${type.slug}${free ? `?${stayParams(q, free.checkIn, free.checkOut)}` : ""}`,
    };
  }

  const childFee =
    settings.child_extra_policy === "free"
      ? 0
      : settings.child_extra_policy === "reduced"
        ? (settings.child_extra_fee ?? rate.extra_adult_per_night)
        : rate.extra_adult_per_night;
  return {
    kind: "available",
    breakdown,
    nightlyRate: rate.nightly_rate,
    adultFee: rate.extra_adult_per_night,
    childFee,
    reserveHref: `/reserve/${type.slug}?${stayParams(q, q.arrive, q.depart)}`,
  };
}

export default async function AvailabilityPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const raw = { arrive: one(sp.arrive), depart: one(sp.depart), adults: one(sp.adults), children: one(sp.children) };
  const fresh = Object.values(raw).every((v) => v === undefined);
  const today = todayInKarachi();
  const [types, settings] = await Promise.all([listApartmentTypes(), getSettings()]);
  const maxGuests = Math.max(1, ...types.map((t) => t.max_guests ?? 0)) || 8;

  let problems = fresh ? [] : problemsFrom(raw);
  const parsed = stayQuery.safeParse(raw);
  const q = parsed.success ? parsed.data : null;
  if (q) {
    const nights = nightsBetween(q.arrive, q.depart);
    if (q.arrive < today) problems = ["Choose an arrival from today on."];
    else if (nights < settings.min_nights || nights > settings.max_nights)
      problems = [`Stays are from ${settings.min_nights} to ${settings.max_nights} nights.`];
  }
  // Each search runs several availability queries (and up to 60 for the nearest free stay), so it shares the
  // per-IP availability limit with /api/availability.
  if (q !== null && problems.length === 0 && !(await rateLimit("availability"))) {
    problems = ["Too many searches in a short time. Please wait a minute and try again."];
  }
  const ready = q !== null && problems.length === 0;

  const barDefaults = {
    arrive: raw.arrive,
    depart: raw.depart,
    adults: raw.adults !== undefined ? Number(raw.adults) || undefined : undefined,
    children: raw.children !== undefined ? Number(raw.children) || 0 : undefined,
  };

  if (!ready || !q) {
    return (
      <>
        <SiteHeader />
        <main id="main" className="on-ivory">
          <div className="container-site flex flex-col gap-8 py-24 max-[900px]:gap-6 max-[900px]:py-16">
            <div className="flex flex-col gap-4">
              <p className="eyebrow" style={{ color: "var(--color-bronze)" }}>
                Two apartments, by the night
              </p>
              <h1 className="display text-[52px] max-[900px]:text-[40px]">Check availability</h1>
              {fresh ? (
                <p className="m-0" style={{ maxWidth: 640, color: "var(--color-ink-2)" }}>
                  Choose your dates and party to see which apartment is free and the price for your stay.
                </p>
              ) : (
                <div id="search-problems" className="flex flex-col gap-1" style={{ maxWidth: 640, borderTop: "1px solid var(--color-bad)", paddingTop: 10 }}>
                  {problems.map((p) => (
                    <p key={p} className="m-0" style={{ fontSize: 15 }}>
                      {p}
                    </p>
                  ))}
                </div>
              )}
            </div>
            <AvailabilityBar
              id="check-availability"
              maxGuests={maxGuests}
              defaults={barDefaults}
              describedBy={fresh ? undefined : "search-problems"}
            />
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  const results = await Promise.all(types.map((t) => resultFor(t, q, settings, today)));
  const nights = nightsBetween(q.arrive, q.depart);
  const range = stayRange(q.arrive, q.depart, today);
  const party = partyWords(q.adults, q.children);
  const editHref = `/?${stayParams(q, q.arrive, q.depart)}#check-availability`;

  return (
    <>
      <SiteHeader />
      <main id="main" className="on-ivory">
        <div className="container-site flex flex-col gap-10 py-24 max-[900px]:gap-8 max-[900px]:py-16">
          <div className="flex flex-col gap-4">
            <p className="flex flex-wrap items-center gap-x-4">
              <span className="eyebrow" style={{ color: "var(--color-bronze)" }}>
                {nights} {nights === 1 ? "night" : "nights"} · {range} · {party}
              </span>
              <Link
                href={editHref}
                className="inline-flex min-h-11 items-center text-bronze! underline underline-offset-[6px]"
                style={{ fontSize: 15 }}
              >
                Edit<span className="sr-only"> your dates and party</span>
              </Link>
            </p>
            <h1 className="display text-[52px] max-[900px]:text-[40px]">Two ways to stay</h1>
          </div>
          <div className="flex flex-col gap-6">
            {types.map((t, i) => (
              <ResultRow
                key={t.id}
                type={t}
                state={results[i]}
                taxLabel={settings.tax_label}
                whatsappNumber={settings.whatsapp_number}
                enquiryText={`${t.name}, ${range}, ${party}`}
              />
            ))}
          </div>
          <p className="m-0" style={{ fontSize: 14, color: "var(--color-ink-2)" }}>
            Every date is Karachi time. Rates as of {SITE.ratesAsOf}, subject to change.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
