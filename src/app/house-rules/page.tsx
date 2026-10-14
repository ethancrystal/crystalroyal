import type { Metadata } from "next";
import Link from "next/link";
import { HouseRulesList } from "@/components/apartment/house-rules-list";
import { StaticPage, StaticSection } from "@/components/home/static-page";
import { Ph, PhText } from "@/components/ph";
import { getSettings } from "@/lib/db/queries";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "House rules — Crystal Royal Apartment, Karachi",
  description: "The house rules for both apartments at Crystal Royal Apartment, with check-in and check-out times.",
  alternates: { canonical: "/house-rules" },
};

export default async function HouseRulesPage() {
  const s = await getSettings();
  return (
    <StaticPage
      title="House rules"
      intro={<p className="m-0">The same rules apply to both apartments. You confirm you have read them when you reserve.</p>}
    >
      <StaticSection id="rules-h" title="In the apartment">
        <HouseRulesList />
      </StaticSection>

      <StaticSection id="times-h" title="Arrival and departure">
        <p className="m-0">
          Check-in from <Ph value={s.check_in} className="num" /> · Check-out by <Ph value={s.check_out} className="num" />
        </p>
        <p className="m-0">{SITE.idAtCheckIn}</p>
        <p className="m-0" style={{ color: "var(--color-ink-2)", fontSize: 15 }}>
          Every date and time is Karachi time (PKT).
        </p>
      </StaticSection>

      <StaticSection id="cancel-h" title="Cancellation">
        <p className="m-0">
          <PhText text={s.cancellation_text} />
        </p>
        <p className="m-0" style={{ color: "var(--color-ink-2)", fontSize: 15 }}>
          The full terms of a reservation are in our{" "}
          <Link href="/terms" className="text-bronze! underline underline-offset-[6px]">
            terms
          </Link>
          .
        </p>
      </StaticSection>
    </StaticPage>
  );
}
