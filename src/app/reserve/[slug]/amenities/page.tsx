import type { Metadata } from "next";
import {
  checkAmenities,
  checkStay,
  loadAmenities,
  loadPreviewRates,
  loadSettings,
  loadType,
  redirectToProblem,
  reservableType,
} from "@/components/reserve/flow";
import { AmenitiesStep } from "@/components/reserve/amenities-step";
import { choicesFrom, parseAm, pricingSettings } from "@/components/reserve/shared";
import { nightsBetween } from "@/lib/dates";
import { continueAmenities } from "../actions";

// Step 2 · At your service. The stay from step 1 is checked again (dates, party, availability); a selection that no
// longer holds (an amenity withdrawn, a quantity above its maximum) is shown here with what to change.

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const type = await loadType((await params).slug);
  return { title: `At your service · Reserve · ${type?.name ?? "Crystal Royal Apartment"}` };
}

export default async function AmenitiesPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const type = await reservableType(slug);
  const [settings, amenities, rates] = await Promise.all([loadSettings(), loadAmenities(), loadPreviewRates(type.id)]);
  const c = choicesFrom(sp);

  const s1 = await checkStay(type, settings, c);
  if (!s1.ok) redirectToProblem(type.slug, c, s1.problem);
  const { stay } = s1;

  const s2 = checkAmenities(c.am, amenities);
  const problem = s2.ok ? null : s2.problem.message;
  // Keep what can still be offered, capped at each maximum, so the guest only adjusts what changed.
  const raw = parseAm(c.am);
  const initialQty: Record<string, number> = {};
  for (const a of amenities) if (raw[a.id]) initialQty[a.id] = Math.min(raw[a.id], a.max_quantity);

  return (
    <AmenitiesStep
      key={c.am}
      slug={type.slug}
      type={{
        slug: type.slug,
        name: type.name,
        standard_guests: type.standard_guests,
        max_guests: type.max_guests,
        min_nights: type.min_nights,
      }}
      rates={rates}
      currentRate={{
        nightly_rate: stay.rate.nightly_rate,
        extra_adult_per_night: stay.rate.extra_adult_per_night,
        effective_from: stay.rate.effective_from,
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
      stay={{
        arrive: stay.arrive,
        depart: stay.depart,
        adults: stay.adults,
        children: stay.children,
        nights: nightsBetween(stay.arrive, stay.depart),
      }}
      initialQty={initialQty}
      problem={problem}
      action={continueAmenities}
    />
  );
}
