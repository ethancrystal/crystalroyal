import { formatNumber } from "@/lib/money";
import { OCCUPANCY_UNCONFIRMED } from "@/lib/quote";
import { Ph } from "@/components/ph";
import { WhatsAppLink } from "@/components/whatsapp-link";

// The reservation card's place for a type that cannot be reserved online yet (occupancy unconfirmed): the same
// midnight card as the stay card, with the rate, the occupancy line and "Ask on WhatsApp" (canvas copy).

export function EnquiryCard({
  name,
  nightlyRate,
  whatsappNumber,
  className = "",
}: {
  name: string;
  nightlyRate: number | null;
  whatsappNumber: string;
  className?: string;
}) {
  const muted = "var(--color-on-dark-2)";
  return (
    <aside
      aria-label="Ask about this apartment"
      className={`on-midnight flex flex-col gap-[22px] p-8 max-sm:gap-[18px] max-sm:px-4 max-sm:py-7 lg:sticky lg:top-6 ${className}`}
      style={{ alignSelf: "start" }}
    >
      <p className="m-0">
        {nightlyRate === null ? (
          <Ph value="[PKR __]" />
        ) : (
          <span
            className="num max-sm:text-[42px]!"
            style={{ fontFamily: "var(--font-display)", fontWeight: 300, fontSize: 48, lineHeight: 1.05, color: "var(--color-gold)" }}
          >
            {formatNumber(nightlyRate)}
          </span>
        )}{" "}
        <span className="max-sm:text-[13px]!" style={{ color: muted, fontSize: 14 }}>
          PKR per night, plus applicable taxes
        </span>
      </p>
      <p className="m-0" style={{ borderTop: "1px solid var(--hair-gold)", paddingTop: 18 }}>
        {OCCUPANCY_UNCONFIRMED}
      </p>
      <p className="m-0" style={{ fontSize: 14, color: muted }}>
        <Ph value="[Occupancy to be confirmed]" />
      </p>
      <WhatsAppLink
        number={whatsappNumber}
        text={name}
        className="btn-dark w-full max-sm:border-0! max-sm:bg-[var(--color-gold)]! max-sm:text-[var(--color-midnight)]!"
        plainClassName="block text-center text-[15px]"
      >
        Ask on WhatsApp
      </WhatsAppLink>
      <p className="m-0" style={{ fontSize: 13, color: muted, textAlign: "center" }}>
        Write to us with your dates and party.
      </p>
    </aside>
  );
}
