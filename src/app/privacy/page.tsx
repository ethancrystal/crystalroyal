import type { Metadata } from "next";
import { RuledList, StaticPage, StaticSection } from "@/components/home/static-page";
import { Ph, PhText } from "@/components/ph";
import { getSettings } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Privacy — Crystal Royal Apartment, Karachi",
  description: "What Crystal Royal Apartment keeps about your stay, why, and for how long.",
  alternates: { canonical: "/privacy" },
};

export default async function PrivacyPage() {
  const s = await getSettings();
  const months = s.receipt_retention_months;
  return (
    <StaticPage title="Privacy" intro={<p className="m-0">We use your details only to manage your stay.</p>}>
      <StaticSection id="keep-h" title="What we keep">
        <p className="m-0">When you reserve, we keep only what we need to welcome you:</p>
        <RuledList
          items={[
            "Your full name",
            "Your mobile number, for WhatsApp",
            "Your email address",
            "Your expected arrival time",
            "Anything you choose to tell us about your stay",
            "Your dates, your party, what you add to your stay, and the payments you make",
            "The transfer receipt you upload",
          ]}
        />
      </StaticSection>

      <StaticSection id="never-h" title="What we never ask for">
        <p className="m-0">
          We do not collect CNIC or passport numbers online. A valid CNIC or passport for each adult is shown at check-in.
        </p>
        <p className="m-0">
          We never ask for card details. Payments are by bank transfer to our Meezan Bank account.
        </p>
      </StaticSection>

      <StaticSection id="long-h" title="How long we keep it">
        <p className="m-0">
          Transfer receipts are deleted {months} {months === 1 ? "month" : "months"} after check-out, and the deletion is
          recorded.
        </p>
        <p className="m-0">
          Reservation records are kept for <PhText text="[retention period to be confirmed by the property]" />.
        </p>
      </StaticSection>

      <StaticSection id="who-h" title="Who sees it">
        <p className="m-0">
          The property&apos;s team, to manage your stay. Receipts are stored privately and are opened only by the property.
        </p>
        <p className="m-0">
          Our email provider delivers the messages about your reservation, and our hosting and database providers store
          the records on our behalf. Your details are never sold or used for advertising.
        </p>
      </StaticSection>

      <StaticSection id="cookies-h" title="Cookies">
        <p className="m-0">
          While you reserve, one cookie remembers your choices between steps. It is signed, cannot be read by scripts on
          the page, and is not used for advertising. There are no advertising cookies on this website.
        </p>
      </StaticSection>

      <StaticSection id="contact-h" title="Your details">
        <p className="m-0">
          To see or correct the details we hold about you, write to us at <Ph value={s.email} /> or on WhatsApp{" "}
          <Ph value={s.phone_display} />.
        </p>
      </StaticSection>
    </StaticPage>
  );
}
