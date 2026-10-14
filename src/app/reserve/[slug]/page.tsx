import type { Metadata } from "next";
import {
  checkStay,
  loadAmenities,
  loadPreviewRates,
  loadSettings,
  loadType,
  nearestStays,
  nightLimits,
  reservableType,
  type NearbyStay,
} from "@/components/reserve/flow";
import { DatesStep, type DatesProblem } from "@/components/reserve/dates-step";
import { choicesFrom, intOr, parseAm, pricingSettings, unavailableMessage, validIso } from "@/components/reserve/shared";
import { continueDates } from "./actions";

// Step 1 · Dates and guests. Arrives from the apartment card (?arrive=&depart=&adults=&children=) or back from a
// later step with ?error= naming what needs attention; the problem is worked out again here so it is always current.

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const type = await loadType((await params).slug);
  return { title: `Dates and guests · Reserve · ${type?.name ?? "Crystal Royal Apartment"}` };
}

export default async function DatesPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const type = await reservableType(slug);
  const [settings, amenities, rates] = await Promise.all([loadSettings(), loadAmenities(), loadPreviewRates(type.id)]);
  const c = choicesFrom(sp);
  const errorCode = typeof sp.error === "string" ? sp.error.slice(0, 20) : "";

  let problem: DatesProblem | null = null;
  if (errorCode) {
    const check = await checkStay(type, settings, c);
    if (!check.ok && check.problem.step === 1) {
      let nearby: NearbyStay[] = [];
      let message = check.problem.message;
      let code = check.problem.code;
      if (code === "unavailable") {
        nearby = await nearestStays(type, settings, c.arrive, c.depart);
        message = unavailableMessage(type.slug, nearby.length > 0);
        if (errorCode === "taken") code = "taken";
      }
      problem = { code, message, nearby };
    }
  }

  const limits = nightLimits(type, settings);
  const maxGuests = type.max_guests ?? 1;
  const adults = Math.min(20, Math.max(1, intOr(c.adults, 2)));
  const children = Math.min(20, Math.max(0, intOr(c.children, 0)));
  // Only amenities that still exist travel on; step 2 checks quantities again.
  const qty = parseAm(c.am);
  const am = amenities
    .filter((a) => qty[a.id])
    .map((a) => `${a.id}:${qty[a.id]}`)
    .join(",");
  const initial = { arrive: validIso(c.arrive), depart: validIso(c.depart), adults, children, am };

  return (
    <DatesStep
      key={`${initial.arrive}|${initial.depart}|${adults}|${children}|${errorCode}`}
      slug={type.slug}
      type={{
        slug: type.slug,
        name: type.name,
        standard_guests: type.standard_guests ?? maxGuests,
        max_guests: maxGuests,
        min_nights: type.min_nights,
      }}
      rates={rates}
      currentRate={{
        nightly_rate: type.rate.nightly_rate,
        extra_adult_per_night: type.rate.extra_adult_per_night,
        effective_from: type.rate.effective_from,
      }}
      settings={pricingSettings(settings)}
      amenities={amenities.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        pricing_type: a.pricing_type,
        price: a.price,
        max_quantity: a.max_quantity,
      }))}
      minNights={limits.min}
      maxNights={limits.max}
      initial={initial}
      problem={problem}
      whatsappNumber={settings.whatsapp_number}
      childMaxAge={settings.child_max_age}
      action={continueDates}
    />
  );
}
