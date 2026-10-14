import { formatPKR } from "@/lib/money";
import { PRICING_TYPE_LABEL } from "@/lib/pricing";
import type { Amenity } from "@/lib/types";
import { Ph } from "@/components/ph";

// "At your service" (Main.dc.html #service, HomeMobile). Desktop: a hairline grid of cards with the description.
// At 900px and below: a list, name on the left and the price with its unit in words on the right.
// An amenity without a confirmed price shows the bracketed [PKR __] placeholder, never a number.

export function ServiceList({ amenities }: { amenities: Amenity[] }) {
  return (
    <section id="service" aria-labelledby="service-h" className="on-ivory-2">
      <div className="container-site flex flex-col gap-12 py-28 max-[900px]:gap-6 max-[900px]:py-16">
        <div className="flex flex-col gap-4 max-[900px]:gap-6" style={{ maxWidth: 640 }}>
          <p className="eyebrow" style={{ color: "var(--color-bronze)" }}>
            Add to your stay
          </p>
          <h2 id="service-h" className="display text-[60px] max-[900px]:text-[40px]">
            At your service
          </h2>
          <p className="hide-sm m-0" style={{ color: "var(--color-ink-2)" }}>
            Arrange any of these when you reserve, or ask us later. Prices are confirmed by the property.
          </p>
        </div>
        <ul
          className="m-0 grid list-none border-t border-l p-0 max-[900px]:block max-[900px]:border-l-0"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", borderColor: "var(--color-taupe)" }}
        >
          {amenities.map((a) => (
            <li
              key={a.id}
              className="flex min-h-[170px] flex-col gap-2.5 border-r border-b p-7 max-[900px]:min-h-0 max-[900px]:flex-row max-[900px]:items-start max-[900px]:justify-between max-[900px]:gap-3 max-[900px]:border-r-0 max-[900px]:px-0 max-[900px]:py-4"
              style={{ borderColor: "var(--color-taupe)" }}
            >
              <h3 className="m-0 text-[18px] font-medium max-[900px]:text-[16px] max-[900px]:font-normal">{a.name}</h3>
              <p className="hide-sm m-0 flex-1" style={{ fontSize: 15, color: "var(--color-ink-2)" }}>
                {a.description}
              </p>
              <p
                className="m-0 text-[13px] tracking-[.06em] max-[900px]:shrink-0 max-[900px]:text-right max-[900px]:tracking-normal"
                style={{ color: "var(--color-bronze)" }}
              >
                {a.price === null ? <Ph value="[PKR __]" /> : <span className="num">{formatPKR(a.price)}</span>}
                <span className="hide-sm"> · </span>
                <span className="max-[900px]:block"> {PRICING_TYPE_LABEL[a.pricing_type]}</span>
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
