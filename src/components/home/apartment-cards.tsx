import Link from "next/link";
import type { TypeWithRate } from "@/lib/db/queries";
import { formatPKR } from "@/lib/money";
import { isReservable } from "@/lib/quote";
import { APARTMENT_CONTENT } from "@/lib/site";
import { Ph } from "@/components/ph";
import { Plate } from "@/components/plate";
import { WhatsAppLink } from "@/components/whatsapp-link";

// "Two ways to stay" (Main.dc.html #apartments, HomeMobile). One card per active apartment type. A reservable
// type offers "Reserve"; one whose occupancy is still unconfirmed offers "Ask on WhatsApp" (ARCHITECTURE.md).
// On phones the canvas shortens the actions to "Ask us" and "See it" so two fit side by side.

export function ApartmentCards({ types, whatsappNumber }: { types: TypeWithRate[]; whatsappNumber: string }) {
  return (
    <section id="apartments" aria-labelledby="apartments-h" className="on-ivory" style={{ scrollMarginTop: 0 }}>
      <div className="container-site flex flex-col gap-14 py-[120px] max-[900px]:gap-8 max-[900px]:py-16">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex flex-col gap-4 max-[900px]:gap-2.5">
            <p className="eyebrow" style={{ color: "var(--color-bronze)" }}>
              The apartments
            </p>
            <h2 id="apartments-h" className="display text-[60px] max-[900px]:text-[40px]">
              Two ways to stay
            </h2>
          </div>
          <p className="hide-sm m-0" style={{ maxWidth: 440, color: "var(--color-ink-2)" }}>
            Both are fully serviced, with a lounge for the evenings you spend together. Choose by the size of your party.
          </p>
        </div>
        <div
          className="grid gap-10 max-[900px]:gap-8"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))" }}
        >
          {types.map((t) => (
            <ApartmentCard key={t.id} type={t} whatsappNumber={whatsappNumber} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ApartmentCard({ type, whatsappNumber }: { type: TypeWithRate; whatsappNumber: string }) {
  const content = APARTMENT_CONTENT[type.slug];
  const reservable = isReservable(type);
  const actionBase = "max-[900px]:px-3! max-[900px]:w-full";
  return (
    <article className="on-ivory-2 flex flex-col">
      <Plate
        label={content?.cardPhoto ?? `Photo · ${type.name}`}
        className="aspect-[16/10] max-[900px]:aspect-[4/3]"
        style={{ fontSize: 13, letterSpacing: ".08em" }}
      />
      <div className="flex flex-1 flex-col gap-5 p-9 max-[900px]:gap-3.5 max-[900px]:px-5 max-[900px]:py-6">
        {content ? (
          <p className="eyebrow" style={{ color: "var(--color-bronze)" }}>
            {content.eyebrow}
          </p>
        ) : null}
        <h3 className="display text-[38px] max-[900px]:text-[30px]">{type.name}</h3>
        <p className="m-0 flex flex-wrap items-baseline gap-x-2.5">
          <span className="num text-[28px] max-[900px]:text-[22px]">
            {type.rate ? formatPKR(type.rate.nightly_rate) : <Ph value="[PKR __]" />}
          </span>
          <span className="text-[15px] max-[900px]:text-[14px]" style={{ color: "var(--color-ink-2)" }}>
            per night, plus applicable taxes
          </span>
        </p>
        {content ? (
          <p className="m-0" style={{ color: "var(--color-ink-2)", fontSize: 15 }}>
            {content.summary}
          </p>
        ) : null}
        <div className="mt-auto flex flex-wrap gap-3 pt-2 max-[900px]:grid max-[900px]:grid-cols-2 max-[900px]:gap-2.5 max-[900px]:pt-0">
          {reservable ? (
            <Link href={`/reserve/${type.slug}`} className={`btn-light ${actionBase}`}>
              Reserve
              <span className="sr-only">: {type.name}</span>
            </Link>
          ) : (
            <WhatsAppLink
              number={whatsappNumber}
              text={type.name}
              className={`btn-light ${actionBase}`}
              plainClassName="self-center text-[14px] leading-snug text-[var(--color-ink-2)]"
            >
              <span className="hide-sm">Ask on WhatsApp</span>
              <span className="show-sm">Ask us</span>
            </WhatsAppLink>
          )}
          <Link href={`/apartments/${type.slug}`} className={`btn-ghost-light ${actionBase}`}>
            <span className="hide-sm">See the apartment</span>
            <span className="show-sm">See it</span>
            <span className="sr-only">: {type.name}</span>
          </Link>
        </div>
      </div>
    </article>
  );
}
