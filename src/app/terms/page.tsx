import type { Metadata } from "next";
import Link from "next/link";
import { StaticPage, StaticSection } from "@/components/home/static-page";
import { Ph, PhText } from "@/components/ph";
import { getSettings } from "@/lib/db/queries";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Terms — Crystal Royal Apartment, Karachi",
  description: "How reserving, payment by bank transfer, cancellation and your stay work at Crystal Royal Apartment.",
  alternates: { canonical: "/terms" },
};

export default async function TermsPage() {
  const s = await getSettings();
  const hours = `${s.hold_hours} ${s.hold_hours === 1 ? "hour" : "hours"}`;
  return (
    <StaticPage
      title="Terms"
      intro={
        <>
          <p className="m-0">How reserving, payment and your stay work at {SITE.name}.</p>
          <p className="m-0 mt-3">
            <PhText text="[Full terms to be reviewed and supplied by the property.]" />
          </p>
        </>
      }
    >
      <StaticSection id="reserving-h" title="Reserving">
        <p className="m-0">
          You reserve an apartment for your dates and party, and the property assigns it. When you reserve, we hold your
          dates for {hours} while you make the transfer. If the transfer has not reached us by then, the hold ends and the
          dates are released.
        </p>
        <p className="m-0">A reservation is confirmed once the property has verified your transfer.</p>
      </StaticSection>

      <StaticSection id="payment-h" title="Rates and payment">
        <p className="m-0">
          Rates are per night, plus applicable taxes, and every amount is shown before you reserve. The price shown when you
          reserve is the price of your stay; later rate changes do not affect it. Rates as of {SITE.ratesAsOf}, subject to
          change.
        </p>
        <p className="m-0">
          {s.deposit_policy === "50"
            ? "Half of the total is due by transfer to confirm your stay; the balance is due at check-in."
            : "The full amount is due by transfer to confirm your stay."}{" "}
          Payment is by bank transfer to the Meezan Bank account shown on your reservation page. We never ask for card
          details.
        </p>
        {s.tax_rate_percent !== null ? (
          <p className="m-0">
            <PhText text={s.tax_label} /> at {s.tax_rate_percent}% is added to the total.
          </p>
        ) : null}
      </StaticSection>

      <StaticSection id="occupancy-h" title="Occupancy">
        <p className="m-0">
          Each apartment is reserved for the party on the reservation. Guests above the standard occupancy are charged the
          additional guest fee per night shown on the apartment page.
        </p>
        <p className="m-0">{SITE.idAtCheckIn}</p>
      </StaticSection>

      <StaticSection id="stay-h" title="Arrival and departure">
        <p className="m-0">
          Check-in from <Ph value={s.check_in} className="num" /> · Check-out by <Ph value={s.check_out} className="num" />.
          Stays are from {s.min_nights} to {s.max_nights} nights. Every date and time is Karachi time (PKT).
        </p>
        <p className="m-0">
          Please follow the{" "}
          <Link href="/house-rules" className="text-bronze! underline underline-offset-[6px]">
            house rules
          </Link>{" "}
          during your stay.
        </p>
      </StaticSection>

      <StaticSection id="cancellation-h" title="Cancellation">
        <p className="m-0">
          <PhText text={s.cancellation_text} />
        </p>
        <p className="m-0">
          To cancel, use &ldquo;Request cancellation&rdquo; on your reservation page or write to us. The property confirms
          the cancellation, and any refund is arranged directly with you.
        </p>
      </StaticSection>
    </StaticPage>
  );
}
