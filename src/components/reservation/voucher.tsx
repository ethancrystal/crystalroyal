import { HOUSE_RULES } from "@/components/apartment/house-rules-list";
import { Mark } from "@/components/brand";
import { Ph, PhText } from "@/components/ph";
import { formatPKR } from "@/lib/money";
import { SITE, isPlaceholder } from "@/lib/site";
import type { Payment, Reservation, ReservationAmenity, Settings } from "@/lib/types";
import { partyLine, shortDate, type MoneyView } from "./format";

// The stay voucher (canvas Confirmed.dc.html, lower section): a paper plate in a bronze hairline frame with the
// wordmark and mark, the reference, the stay, the amount paid, the address, "Before you arrive" and the house rules.
// The same component is the confirmation page's voucher and the printable A4 page (voucher/page.tsx adds the
// print stylesheet).

const dt: React.CSSProperties = { color: "var(--color-ink-2)", fontSize: 11 };

function Item({ term, children, num }: { term: string; children: React.ReactNode; num?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="eyebrow" style={dt}>
        {term}
      </dt>
      <dd className={`m-0 ${num ? "num" : ""}`} style={{ marginTop: 4 }}>
        {children}
      </dd>
    </div>
  );
}

function settledWords(payments: Payment[]): string {
  const verified = payments.filter((p) => p.receipt_status === "verified");
  const methods = new Set(verified.map((p) => p.method));
  if (methods.size === 1 && methods.has("bank_transfer")) return "bank transfer, verified";
  if (methods.size === 1 && methods.has("cash")) return "cash, received";
  return "verified";
}

export function Voucher({
  reservation: r,
  typeName,
  settings: s,
  payments,
  amenities,
  money,
}: {
  reservation: Reservation;
  typeName: string;
  settings: Pick<Settings, "check_in" | "check_out" | "phone_display" | "email">;
  payments: Payment[];
  amenities: ReservationAmenity[];
  money: MoneyView;
}) {
  const airport = amenities.some((a) => /airport/i.test(a.name_snapshot));
  const mapsSet = !isPlaceholder(SITE.mapsUrl);
  return (
    <article
      aria-labelledby="voucher-h"
      className="voucher mx-auto flex w-full max-w-[860px] flex-col max-[640px]:p-6! max-[640px]:gap-7!"
      style={{ background: "var(--color-paper)", border: "1px solid var(--color-bronze)", padding: 56, gap: 36, color: "var(--color-ink)" }}
    >
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex items-center gap-4">
          <Mark size={56} label="Crystal Royal Apartment" />
          <div className="inline-flex flex-col" style={{ gap: 6 }}>
            <span style={{ letterSpacing: ".22em" }}>CRYSTAL ROYAL</span>
            <span style={{ height: 1, background: "var(--color-bronze)" }} />
            <span style={{ fontSize: 10, letterSpacing: ".5em", fontWeight: 500 }}>APARTMENT</span>
          </div>
        </div>
        <div className="text-right max-[640px]:text-left">
          <h2 id="voucher-h" className="eyebrow" style={{ color: "var(--color-bronze)" }}>
            Stay voucher
          </h2>
          <p className="num m-0" style={{ marginTop: 4, fontSize: 22 }}>
            {r.reference}
          </p>
        </div>
      </div>

      <dl
        className="m-0 grid grid-cols-2 gap-x-10 gap-y-5 max-[640px]:grid-cols-1"
        style={{ borderTop: "1px solid var(--color-bronze)", paddingTop: 28 }}
      >
        <Item term="Guest">
          {r.guest_name} · {partyLine(r.adults, r.children)}
        </Item>
        <Item term="Apartment">{typeName}</Item>
        <Item term="Arrival">
          {shortDate(r.check_in)}, from <Ph value={s.check_in} />
        </Item>
        <Item term="Departure">
          {shortDate(r.check_out)}, by <Ph value={s.check_out} />
        </Item>
        <Item term="Address">
          <Ph value={SITE.addressLine} />, <Ph value={SITE.neighbourhood} />, Karachi
        </Item>
        <Item term={money.balance !== null ? "Paid" : "Settled"} num>
          {formatPKR(money.paid)} · {settledWords(payments)}
          {money.balance !== null ? (
            <span className="block" style={{ marginTop: 2 }}>
              Balance due at check-in: {formatPKR(money.balance)}
            </span>
          ) : null}
        </Item>
      </dl>

      <div className="grid grid-cols-2 gap-10 max-[640px]:grid-cols-1 max-[640px]:gap-7">
        <section aria-labelledby="arrive-h">
          <h3 id="arrive-h" className="eyebrow" style={{ margin: "0 0 10px", color: "var(--color-bronze)" }}>
            Before you arrive
          </h3>
          <ul className="m-0 flex list-disc flex-col pl-[18px]" style={{ gap: 4, fontSize: 15, color: "var(--color-ink-2)" }}>
            <li>{SITE.idAtCheckIn}</li>
            <li>This voucher, printed or on your phone.</li>
            <li>
              Check-in from <Ph value={s.check_in} />, check-out by <Ph value={s.check_out} />.
              {r.arrival_time ? ` Your expected arrival: ${r.arrival_time}.` : " Tell us your arrival time on WhatsApp."}
            </li>
            {airport ? <li>Airport transfer: your flight number by WhatsApp.</li> : null}
            <li>
              How to reach us: <Ph value={SITE.addressLine} />, <Ph value={SITE.neighbourhood} />, Karachi.
              {mapsSet ? (
                <>
                  {" "}
                  <a href={SITE.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-bronze! underline underline-offset-4">
                    Get directions
                  </a>
                </>
              ) : null}
            </li>
          </ul>
        </section>
        <section aria-labelledby="rules-h">
          <h3 id="rules-h" className="eyebrow" style={{ margin: "0 0 10px", color: "var(--color-bronze)" }}>
            House rules
          </h3>
          <ul className="m-0 flex list-disc flex-col pl-[18px]" style={{ gap: 4, fontSize: 15, color: "var(--color-ink-2)" }}>
            {HOUSE_RULES.map((rule, i) => (
              <li key={`${i}-${rule}`}>
                <PhText text={rule} />
              </li>
            ))}
          </ul>
        </section>
      </div>

      <p className="m-0" style={{ fontSize: 13, color: "var(--color-ink-2)", borderTop: "1px solid var(--color-taupe)", paddingTop: 16 }}>
        At your service: WhatsApp <Ph value={s.phone_display} /> · <Ph value={s.email} />
      </p>
    </article>
  );
}
