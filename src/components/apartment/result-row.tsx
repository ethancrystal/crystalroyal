import Link from "next/link";
import { formatPKR } from "@/lib/money";
import { INTERIORS } from "@/lib/photos";
import type { PriceBreakdown } from "@/lib/pricing";
import { OCCUPANCY_UNCONFIRMED } from "@/lib/quote";
import { APARTMENT_CONTENT } from "@/lib/site";
import type { TypeWithRate } from "@/lib/db/queries";
import { Ph, PhText } from "@/components/ph";
import { Plate } from "@/components/plate";
import { WhatsAppLink } from "@/components/whatsapp-link";

// One apartment type on the availability results page, on an ivory panel in the States.dc.html style: a pill
// that names the state in words, the type, its facts, then the price for this party, the reason it cannot be
// reserved, or the way to ask.

export type ResultState =
  | {
      kind: "available";
      breakdown: PriceBreakdown;
      nightlyRate: number;
      adultFee: number | null;
      childFee: number | null;
      reserveHref: string;
    }
  | { kind: "unavailable"; freeFrom: string | null; seeHref: string }
  | { kind: "party"; message: string }
  | { kind: "refused"; message: string }
  | { kind: "enquire" };

const PILL: Record<ResultState["kind"], { tone: string; word: string }> = {
  available: { tone: "ok", word: "Available" },
  unavailable: { tone: "bad", word: "Unavailable" },
  party: { tone: "wait", word: "Party too large" },
  refused: { tone: "bad", word: "Unavailable" },
  enquire: { tone: "neutral", word: "Reserved directly with the property" },
};

function guestsWord(n: number, kind: "adult" | "child"): string {
  if (kind === "adult") return `${n} additional ${n === 1 ? "adult" : "adults"}`;
  return `${n} additional ${n === 1 ? "child" : "children"}`;
}

export function factsLine(type: TypeWithRate): string {
  const lounges = `${type.lounges} ${type.lounges === 1 ? "lounge" : "lounges"}`;
  const occupancy =
    type.standard_guests !== null && type.max_guests !== null
      ? type.max_guests > type.standard_guests
        ? `Sleeps ${type.standard_guests} as standard, up to ${type.max_guests}`
        : `Sleeps ${type.standard_guests}`
      : "Occupancy confirmed with the property";
  return `${type.bedrooms} bedrooms · ${lounges} · ${occupancy}`;
}

export function ResultRow({
  type,
  state,
  taxLabel,
  whatsappNumber,
  enquiryText,
}: {
  type: TypeWithRate;
  state: ResultState;
  taxLabel: string;
  whatsappNumber: string;
  /** Prefilled WhatsApp message: the type, the dates and the party. */
  enquiryText: string;
}) {
  const content = APARTMENT_CONTENT[type.slug];
  const pill = PILL[state.kind];
  const headingId = `result-${type.slug}`;
  const muted = { color: "var(--color-ink-2)" };
  const seeLink = (href: string) => (
    <Link href={href} className="self-center text-bronze! underline underline-offset-[6px]" style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }}>
      See the apartment<span className="sr-only">: {type.name}</span>
    </Link>
  );

  return (
    <article
      aria-labelledby={headingId}
      className="on-ivory-2 grid md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
    >
      <Plate
        label={content?.cardPhoto ?? `Photo · ${type.name}`}
        photo={INTERIORS[type.slug]?.card}
        sizes="(max-width: 768px) 100vw, 540px"
        className="aspect-[4/3] h-full md:aspect-auto md:min-h-[300px]"
      />
      <div className="flex min-w-0 flex-col gap-3.5 p-8 max-[900px]:px-5 max-[900px]:py-6">
        <span className={`pill pill-${pill.tone} self-start`}>{pill.word}</span>
        {content ? (
          <p className="eyebrow" style={{ color: "var(--color-bronze)" }}>
            {content.eyebrow}
          </p>
        ) : null}
        <h2 id={headingId} className="display text-[34px] max-[900px]:text-[28px]">
          {type.name}
        </h2>
        <p className="m-0" style={{ ...muted, fontSize: 15 }}>
          {factsLine(type)}
        </p>

        <div className="flex flex-col gap-2 pt-3.5" style={{ borderTop: "1px solid var(--color-taupe)" }}>
          {state.kind === "available" ? (
            <>
              <p className="m-0">
                <span className="num">{formatPKR(state.nightlyRate)}</span> per night ·{" "}
                <span className="num">{formatPKR(state.breakdown.subtotalNights + state.breakdown.extraAmount)}</span> for{" "}
                {state.breakdown.nights} {state.breakdown.nights === 1 ? "night" : "nights"},{" "}
                {state.breakdown.taxRatePercent === null ? (
                  "plus applicable taxes"
                ) : (
                  <>
                    plus <PhText text={taxLabel} />
                  </>
                )}
              </p>
              {state.breakdown.extraAdults > 0 && state.adultFee !== null ? (
                <p className="m-0" style={{ ...muted, fontSize: 15 }}>
                  Includes {guestsWord(state.breakdown.extraAdults, "adult")} at {formatPKR(state.adultFee)} per night
                </p>
              ) : null}
              {state.breakdown.extraChildren > 0 ? (
                <p className="m-0" style={{ ...muted, fontSize: 15 }}>
                  Includes {guestsWord(state.breakdown.extraChildren, "child")}
                  {state.childFee ? ` at ${formatPKR(state.childFee)} per night` : ", no charge"}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                <Link href={state.reserveHref} className="btn-light">
                  Reserve<span className="sr-only">: {type.name}</span>
                </Link>
                {seeLink(`/apartments/${type.slug}`)}
              </div>
            </>
          ) : null}

          {state.kind === "unavailable" ? (
            <>
              <p className="m-0">Not available for these dates.</p>
              {state.freeFrom ? (
                <p className="m-0" style={muted}>
                  Free from {state.freeFrom}.
                </p>
              ) : null}
              <div className="mt-1 flex">{seeLink(state.seeHref)}</div>
            </>
          ) : null}

          {state.kind === "party" ? (
            <>
              <p className="m-0">{state.message}</p>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                <WhatsAppLink number={whatsappNumber} text={enquiryText} className="btn-light" plainClassName="self-center text-[15px]">
                  Ask on WhatsApp
                </WhatsAppLink>
                {seeLink(`/apartments/${type.slug}`)}
              </div>
            </>
          ) : null}

          {state.kind === "refused" ? (
            <>
              <p className="m-0">{state.message}</p>
              <div className="mt-1 flex">{seeLink(`/apartments/${type.slug}`)}</div>
            </>
          ) : null}

          {state.kind === "enquire" ? (
            <>
              <p className="m-0">
                {type.rate ? <span className="num">{formatPKR(type.rate.nightly_rate)}</span> : <Ph value="[PKR __]" />} per
                night, plus applicable taxes
              </p>
              <p className="m-0" style={muted}>
                {OCCUPANCY_UNCONFIRMED} Write to us with your dates and party.
              </p>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                <WhatsAppLink number={whatsappNumber} text={enquiryText} className="btn-light" plainClassName="self-center text-[15px]">
                  Ask on WhatsApp
                </WhatsAppLink>
                {seeLink(`/apartments/${type.slug}`)}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </article>
  );
}
