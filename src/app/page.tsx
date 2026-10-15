import type { Metadata } from "next";
import { AvailabilityBar } from "@/components/home/availability-bar";
import { ApartmentCards } from "@/components/home/apartment-cards";
import { JsonLd } from "@/components/home/json-ld";
import { HowItWorks, Location, MobileCheckBar } from "@/components/home/sections";
import { ServiceList } from "@/components/home/service-list";
import { Ph } from "@/components/ph";
import { PhotoFigure } from "@/components/photo";
import { RatesBand } from "@/components/rates-band";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getSettings, listAmenities, listApartmentTypes } from "@/lib/db/queries";
import { PHOTOS } from "@/lib/photos";
import { env } from "@/lib/env";
import { formatNumber, formatPKR } from "@/lib/money";
import { SITE } from "@/lib/site";

// Home (canvas: Main.dc.html at 1440, HomeMobile.dc.html at 390). Rates, amenities and settings come from the
// database; owner inputs that are still [bracketed] render through <Ph>.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function int(v: string | undefined): number | undefined {
  const n = v === undefined || v.trim() === "" ? NaN : Number(v);
  return Number.isInteger(n) ? n : undefined;
}

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const [types, amenities, settings] = await Promise.all([listApartmentTypes(), listAmenities(), getSettings()]);

  const rates = types.flatMap((t) => (t.rate ? [t.rate.nightly_rate] : []));
  const maxGuests = Math.max(1, ...types.map((t) => t.max_guests ?? 0)) || 8;
  const priceRange =
    rates.length > 0
      ? `PKR ${formatNumber(Math.min(...rates))}–${formatNumber(Math.max(...rates))} per night`
      : undefined;

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "LodgingBusiness",
          name: SITE.name,
          slogan: SITE.tagline,
          url: `${env.siteUrl}/`,
          image: `${env.siteUrl}/opengraph-image`,
          address: {
            "@type": "PostalAddress",
            streetAddress: SITE.addressLine,
            addressLocality: "Karachi",
            addressCountry: "PK",
          },
          telephone: settings.phone_display,
          email: settings.email,
          checkinTime: settings.check_in,
          checkoutTime: settings.check_out,
          currenciesAccepted: SITE.currency,
          paymentAccepted: "Bank transfer",
          ...(priceRange ? { priceRange } : {}),
        }}
      />
      <SiteHeader />
      <main id="main">
        {/* Hero */}
        <section className="on-midnight relative overflow-hidden" aria-labelledby="home-h">
          <div className="container-site flex flex-wrap items-center gap-16 pt-[120px] pb-24 max-[900px]:pt-14 max-[900px]:pb-[34px]">
            <div className="flex min-w-0 flex-col gap-7 max-[900px]:gap-[22px]" style={{ flex: "1 1 520px" }}>
              <p className="eyebrow" style={{ color: "var(--color-gold)" }}>
                Serviced apartments · Karachi
              </p>
              <h1
                id="home-h"
                className="display text-[88px] max-[900px]:text-[50px] max-[360px]:text-[44px]"
                style={{ letterSpacing: "-.01em" }}
              >
                A royal address for <em style={{ fontStyle: "italic", fontWeight: 300 }}>unhurried</em> stays.
              </h1>
              <div
                className="draw w-[120px] max-[900px]:w-20"
                aria-hidden="true"
                style={{ height: 1, background: "var(--color-gold)" }}
              />
              <p className="m-0 max-[900px]:text-[16px]" style={{ maxWidth: 520, color: "var(--color-on-dark-2)" }}>
                Two fully serviced apartments with lounges in <Ph value={SITE.neighbourhood} />,{" "}
                <span className="hide-sm">kept </span>for families and small parties who would rather settle in than
                check in.<span className="hide-sm"> Reserve by the night; we take care of the rest.</span>
              </p>
            </div>
            <PhotoFigure
              photo={PHOTOS.skylineDusk}
              aspectRatio="4 / 5"
              sizes="(max-width: 900px) 100vw, 480px"
              priority
              objectPosition="62% center"
              creditColor="var(--color-on-dark-2)"
              className="max-[900px]:[&>div]:aspect-[4/3]!"
              style={{ flex: "1 1 400px", maxWidth: 520 }}
            />
          </div>

          {/* Availability bar */}
          <div className="container-site pb-[120px] max-[900px]:pb-12">
            <AvailabilityBar
              maxGuests={maxGuests}
              defaults={{
                arrive: one(sp.arrive),
                depart: one(sp.depart),
                adults: int(one(sp.adults)),
                children: int(one(sp.children)),
              }}
            />
            <p className="m-0 mt-3.5 text-[14px] max-[900px]:mt-[22px] max-[900px]:text-[13px]" style={{ color: "var(--color-on-dark-2)" }}>
              {rates.length > 0 ? `${rates.map(formatPKR).join(" and ")} per night, plus applicable taxes. ` : null}
              Rates as of {SITE.ratesAsOf}, subject to change.
            </p>
          </div>
        </section>

        <ApartmentCards types={types} whatsappNumber={settings.whatsapp_number} />
        <ServiceList amenities={amenities} />
        <HowItWorks holdHours={settings.hold_hours} />
        <Location checkIn={settings.check_in} checkOut={settings.check_out} />
        <RatesBand />
      </main>
      <SiteFooter />
      <MobileCheckBar />
    </>
  );
}
