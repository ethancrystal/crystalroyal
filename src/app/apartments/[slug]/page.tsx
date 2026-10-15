import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { EnquiryCard } from "@/components/apartment/enquiry-card";
import { Gallery } from "@/components/apartment/gallery";
import { HouseRulesList } from "@/components/apartment/house-rules-list";
import { RateLadder, RateTile, ladderRows } from "@/components/apartment/rate-ladder";
import { CalendarWithUrl } from "@/components/calendar";
import { JsonLd } from "@/components/home/json-ld";
import { Ph, PhText } from "@/components/ph";
import { RatesBand } from "@/components/rates-band";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { StayCard, type StayCardSettings } from "@/components/stay-card";
import { WhatsAppLink } from "@/components/whatsapp-link";
import { listRates } from "@/lib/db/admin-queries";
import { getApartmentTypeBySlug, getSettings, type TypeWithRate } from "@/lib/db/queries";
import { todayInKarachi } from "@/lib/dates";
import { env } from "@/lib/env";
import { formatPKR } from "@/lib/money";
import { INTERIORS } from "@/lib/photos";
import { OCCUPANCY_UNCONFIRMED, isReservable } from "@/lib/quote";
import { APARTMENT_CONTENT, SITE } from "@/lib/site";

// Apartment page for both types (canvas: Apartment.dc.html at 1440, ApartmentMobile.dc.html at 390).
// Desktop: gallery, then the reading column with the reservation card sticky beside it. Below 1024px the card
// sits under the title, as the mobile canvas places it under the gallery.

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

const SLUG = /^[a-z0-9-]{1,60}$/;

/** One catalogue read per request, shared by generateMetadata and the page. */
const load = cache(async (slug: string): Promise<TypeWithRate | null> => {
  if (!SLUG.test(slug)) return null;
  return getApartmentTypeBySlug(slug);
});

/** "three-bedroom" → "Three-bedroom" (the canvas breadcrumb). */
function crumbName(slug: string): string {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const type = await load(slug);
  // Unknown slug: the segment's not-found page. Because loading.tsx streams the response, the status stays 200;
  // Next.js adds <meta name="robots" content="noindex"> so it is never indexed.
  if (!type) notFound();
  const content = APARTMENT_CONTENT[type.slug];
  const title = `${type.name} — Crystal Royal Apartment, Karachi`;
  const description = [
    content?.intro ?? type.description,
    type.rate ? `${formatPKR(type.rate.nightly_rate)} per night, plus applicable taxes.` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return {
    title,
    description,
    alternates: { canonical: `/apartments/${type.slug}` },
    openGraph: { title, description, url: `/apartments/${type.slug}`, type: "website" },
  };
}

export default async function ApartmentPage({ params }: { params: Params }) {
  const { slug } = await params;
  const [type, settings] = await Promise.all([load(slug), getSettings()]);
  if (!type) notFound();

  const content = APARTMENT_CONTENT[type.slug];
  const reservable = isReservable(type) && type.rate !== null;
  const standard = type.standard_guests;
  const max = type.max_guests;
  const minNights = Math.max(type.min_nights, settings.min_nights);

  // The stay card prices a stay at the rate effective on its arrival, so it gets the rate in force and any
  // scheduled ones (public figures only).
  const today = todayInKarachi();
  const rates = reservable
    ? (await listRates(type.id))
        .filter((r) => r.in_force || r.effective_from > today)
        .map((r) => ({ nightly_rate: r.nightly_rate, extra_adult_per_night: r.extra_adult_per_night, effective_from: r.effective_from }))
    : [];

  // Only the settings the price preview needs reach the browser (never bank or contact details).
  const cardSettings: StayCardSettings = {
    tax_rate_percent: settings.tax_rate_percent,
    tax_label: settings.tax_label,
    deposit_policy: settings.deposit_policy,
    child_extra_policy: settings.child_extra_policy,
    child_extra_fee: settings.child_extra_fee,
    min_nights: settings.min_nights,
    max_nights: settings.max_nights,
  };

  const sleeps =
    standard !== null && max !== null
      ? max > standard
        ? `Sleeps ${standard}, up to ${max}`
        : `Sleeps ${standard}`
      : "Occupancy confirmed with the property";
  const lounges = plural(type.lounges, "lounge", "lounges");
  const rooms = (content?.rooms ?? []).map((r) =>
    r.name === "Bathrooms" && type.bathrooms ? { ...r, detail: type.bathrooms } : r,
  );
  const url = `${env.siteUrl}/apartments/${type.slug}`;

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Accommodation",
          name: type.name,
          description: content?.intro ?? type.description,
          url,
          numberOfRooms: type.bedrooms + type.lounges,
          numberOfBedrooms: type.bedrooms,
          ...(reservable && max !== null
            ? { occupancy: { "@type": "QuantitativeValue", minValue: 1, maxValue: max, unitText: "guests" } }
            : {}),
          ...(type.rate
            ? {
                offers: {
                  "@type": "Offer",
                  url,
                  price: type.rate.nightly_rate,
                  priceCurrency: "PKR",
                  priceSpecification: {
                    "@type": "UnitPriceSpecification",
                    price: type.rate.nightly_rate,
                    priceCurrency: "PKR",
                    unitText: "night",
                    valueAddedTaxIncluded: false,
                  },
                },
              }
            : {}),
          containedInPlace: { "@type": "LodgingBusiness", name: SITE.name, url: `${env.siteUrl}/` },
        }}
      />
      <SiteHeader variant="crumb" crumb={{ label: "Home", current: crumbName(type.slug) }} />
      <main id="main" className="on-ivory" data-stone={type.stone}>
        {content ? <Gallery hero={content.photos.hero} small={content.photos.small} photos={INTERIORS[type.slug]} /> : null}

        <div className="container-site grid pt-14 pb-[120px] max-[900px]:pt-8 max-[900px]:pb-16 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-x-16 lg:gap-y-14">
          {/* Title and facts */}
          <div className="flex min-w-0 flex-col gap-14 pb-8 max-[900px]:gap-3.5 lg:col-start-1 lg:row-start-1 lg:pb-0">
            <div className="flex flex-col gap-[18px] max-[900px]:gap-3.5">
              <p className="eyebrow" style={{ color: "var(--color-bronze)" }}>
                Serviced apartment · <Ph value={SITE.neighbourhood} />
              </p>
              <h1 className="display text-[64px] max-[900px]:text-[40px]">{type.name}</h1>
            </div>
            <ul
              aria-label="At a glance"
              className="hide-sm m-0 flex list-none flex-wrap p-0"
              style={{
                gap: "12px 40px",
                padding: "20px 0",
                fontSize: 15,
                borderTop: "1px solid var(--color-bronze)",
                borderBottom: "1px solid var(--color-taupe)",
              }}
            >
              <li>{plural(type.bedrooms, "bedroom", "bedrooms")}</li>
              <li>{lounges}</li>
              <li>{sleeps}</li>
              <li>
                <Ph value={type.bathrooms} /> bathrooms
              </li>
              {type.size_sqft ? <li>{type.size_sqft.toLocaleString("en-US")} sq ft</li> : null}
              <li>
                Check-in <Ph value={settings.check_in} className="num" />
              </li>
              <li>
                Check-out <Ph value={settings.check_out} className="num" />
              </li>
            </ul>
            <p className="show-sm m-0" style={{ fontSize: 14, color: "var(--color-ink-2)" }}>
              {plural(type.bedrooms, "bedroom", "bedrooms")} · {type.lounges === 1 ? "lounge" : lounges} ·{" "}
              {sleeps.charAt(0).toLowerCase() + sleeps.slice(1)} · check-in <Ph value={settings.check_in} /> · check-out{" "}
              <Ph value={settings.check_out} />
            </p>
          </div>

          {/* Reservation card: sticky beside the column on desktop, under the title below 1024px */}
          {reservable && type.rate ? (
            <StayCard
              type={{ slug: type.slug, standard_guests: type.standard_guests, max_guests: type.max_guests, min_nights: type.min_nights }}
              rate={{ nightly_rate: type.rate.nightly_rate, extra_adult_per_night: type.rate.extra_adult_per_night }}
              rates={rates}
              settings={cardSettings}
              className="max-lg:static! max-[900px]:-mx-4 lg:col-start-2 lg:row-span-2 lg:row-start-1"
            />
          ) : (
            <EnquiryCard
              name={type.name}
              nightlyRate={type.rate?.nightly_rate ?? null}
              whatsappNumber={settings.whatsapp_number}
              className="max-[900px]:-mx-4 lg:col-start-2 lg:row-span-2 lg:row-start-1"
            />
          )}

          {/* Reading column */}
          <div className="flex min-w-0 flex-col gap-14 pt-10 max-[900px]:gap-10 lg:col-start-1 lg:row-start-2 lg:pt-0">
            <div className="flex flex-col gap-4 max-[900px]:gap-3.5" style={{ maxWidth: 640 }}>
              <p className="m-0">{content?.intro ?? type.description}</p>
              {content ? (
                <p className="m-0" style={{ color: "var(--color-ink-2)" }}>
                  <PhText text={content.description} />
                </p>
              ) : null}
            </div>

            {rooms.length > 0 ? (
              <section aria-labelledby="rooms-h" className="flex flex-col gap-[18px] max-[900px]:gap-1.5">
                <h2 id="rooms-h" className="display text-[38px] max-[900px]:text-[30px]">
                  The rooms
                </h2>
                <dl className="m-0 grid grid-cols-2 gap-x-10 max-[900px]:grid-cols-1">
                  {rooms.map((r) => (
                    <div
                      key={r.name}
                      className="py-4 max-[900px]:flex max-[900px]:flex-wrap max-[900px]:gap-x-1.5 max-[900px]:py-3"
                      style={{ borderBottom: "1px solid var(--color-taupe)" }}
                    >
                      <dt className="font-medium max-[900px]:font-normal">{r.name}</dt>
                      <span aria-hidden="true" className="show-sm">
                        ·
                      </span>
                      <dd className="m-0 text-[15px] max-[900px]:text-[16px]" style={{ color: "var(--color-ink-2)" }}>
                        <Ph value={r.detail} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}

            <section aria-labelledby="availability-h">
              {reservable ? (
                <CalendarWithUrl
                  typeSlug={type.slug}
                  minNights={minNights}
                  maxNights={settings.max_nights}
                  heading={
                    <h2 id="availability-h" className="display text-[38px] max-[900px]:text-[30px]">
                      Availability
                    </h2>
                  }
                />
              ) : (
                <div className="flex flex-col gap-4">
                  <h2 id="availability-h" className="display text-[38px] max-[900px]:text-[30px]">
                    Availability
                  </h2>
                  <p className="m-0" style={{ maxWidth: 640 }}>
                    {OCCUPANCY_UNCONFIRMED} Write to us with your dates and party.
                  </p>
                  <WhatsAppLink
                    number={settings.whatsapp_number}
                    text={type.name}
                    className="btn-light self-start"
                    plainClassName="text-[15px]"
                  >
                    Ask on WhatsApp
                  </WhatsAppLink>
                </div>
              )}
            </section>

            <section
              aria-labelledby="ladder-h"
              className="flex flex-col gap-5 max-[900px]:-mx-4 max-[900px]:gap-3 max-[900px]:bg-ivory-2 max-[900px]:px-4 max-[900px]:py-10"
            >
              <h2 id="ladder-h" className="display text-[38px] max-[900px]:text-[30px]">
                Rate by party size
              </h2>
              {reservable && type.rate && standard !== null && max !== null ? (
                <RateLadder rows={ladderRows(standard, max, type.rate.nightly_rate, type.rate.extra_adult_per_night)} />
              ) : (
                <RateTile nightlyRate={type.rate?.nightly_rate ?? null} />
              )}
              {/* The verbatim rates plate, drawn as the canvas's panel inside the reading column. */}
              <div
                className={[
                  "[&_.container-site]:max-w-none! [&_.container-site]:gap-2.5! [&_.container-site]:p-7!",
                  "[&_.display]:text-[24px]! [&_.grid]:gap-4! [&_.grid>div]:gap-2.5! [&_.grid>div]:border-t-0! [&_.grid>div]:pt-0!",
                  "[&_.grid_p+p]:text-[15px]!",
                  "max-[900px]:[&_.container-site]:px-0! max-[900px]:[&_.container-site]:pt-3! max-[900px]:[&_.container-site]:pb-0!",
                  "max-[900px]:[&_.display]:text-[22px]!",
                ].join(" ")}
                style={{ maxWidth: 760 }}
              >
                <RatesBand tone="ivory" only={type.slug} />
              </div>
            </section>

            <section aria-labelledby="rules-h" className="flex flex-col gap-[18px]" style={{ maxWidth: 640 }}>
              <h2 id="rules-h" className="display text-[38px] max-[900px]:text-[30px]">
                House rules
              </h2>
              <HouseRulesList />
              <p className="m-0" style={{ fontSize: 15, color: "var(--color-ink-2)" }}>
                Check-in from <Ph value={settings.check_in} className="num" /> · Check-out by{" "}
                <Ph value={settings.check_out} className="num" />.{" "}
                <Link href="/house-rules" className="text-bronze! underline underline-offset-[6px]">
                  All house rules
                </Link>
              </p>
            </section>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
