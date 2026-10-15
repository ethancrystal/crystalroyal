import { HOW_IT_WORKS, SITE, isPlaceholder } from "@/lib/site";
import { Ph } from "@/components/ph";
import { PhotoFigure } from "@/components/photo";
import { PHOTOS } from "@/lib/photos";

// "How reserving works" and "Location" (Main.dc.html #how and #location, HomeMobile), plus the phone-only sticky
// bar from the brief ("Two apartments, by the night · Check availability").

export function HowItWorks({ holdHours }: { holdHours: number }) {
  return (
    <section id="how" aria-labelledby="how-h" className="on-ivory">
      <div className="container-site flex flex-col gap-14 py-28 max-[900px]:gap-7 max-[900px]:py-16">
        <div className="flex flex-col gap-4">
          <p className="eyebrow hide-sm" style={{ color: "var(--color-bronze)" }}>
            Four steps
          </p>
          <h2 id="how-h" className="display text-[60px] max-[900px]:text-[40px]">
            How reserving works
          </h2>
        </div>
        <ol
          className="m-0 grid list-none gap-10 p-0 max-[900px]:flex max-[900px]:flex-col max-[900px]:gap-6"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}
        >
          {HOW_IT_WORKS.map((s) => (
            <li
              key={s.n}
              className="flex flex-col gap-3.5 pt-6 max-[900px]:flex-row max-[900px]:gap-[18px] max-[900px]:pt-4"
              style={{ borderTop: "1px solid var(--color-bronze)" }}
            >
              <span
                aria-hidden="true"
                className="display text-[56px] max-[900px]:w-10 max-[900px]:shrink-0 max-[900px]:text-[34px]"
                style={{ color: "var(--color-bronze)" }}
              >
                {s.n}
              </span>
              <div className="flex flex-col gap-3.5 max-[900px]:gap-0">
                <h3 className="m-0 text-[19px] font-medium max-[900px]:text-[17px]">{s.title}</h3>
                <p className="m-0" style={{ fontSize: 15, color: "var(--color-ink-2)" }}>
                  {s.body.replace("{holdHours}", String(holdHours))}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function Location({ checkIn, checkOut }: { checkIn: string; checkOut: string }) {
  const directions = isPlaceholder(SITE.mapsUrl) ? null : SITE.mapsUrl;
  return (
    <section id="location" aria-labelledby="location-h" className="on-ivory-2">
      <div className="container-site flex flex-wrap items-stretch gap-16 py-28 max-[900px]:gap-[18px] max-[900px]:py-16">
        <div className="flex flex-col gap-[22px] max-[900px]:gap-[18px]" style={{ flex: "1 1 380px", minWidth: 0 }}>
          <p className="eyebrow" style={{ color: "var(--color-bronze)" }}>
            Location
          </p>
          <h2 id="location-h" className="display text-[60px] max-[900px]:text-[36px]">
            <Ph value={SITE.neighbourhood} className="text-[44px] max-[900px]:text-[36px]" />, Karachi
          </h2>
          <p className="m-0" style={{ color: "var(--color-ink-2)" }}>
            <Ph value={SITE.addressLine} />
            <span className="hide-sm">
              <br />
              {SITE.city}
            </span>
          </p>
          <dl
            className="hide-sm m-0 grid"
            style={{ gridTemplateColumns: "auto 1fr", gap: "10px 28px", fontSize: 15 }}
          >
            <dt style={{ color: "var(--color-ink-2)" }}>Check-in</dt>
            <dd className="num m-0">
              <Ph value={checkIn} />
            </dd>
            <dt style={{ color: "var(--color-ink-2)" }}>Check-out</dt>
            <dd className="num m-0">
              <Ph value={checkOut} />
            </dd>
            <dt style={{ color: "var(--color-ink-2)" }}>Airport</dt>
            <dd className="m-0">
              Jinnah International · <Ph value={SITE.minutesToAirport} />
            </dd>
          </dl>
          {directions ? (
            <a href={directions} target="_blank" rel="noopener noreferrer" className="self-start text-bronze! underline underline-offset-[6px]">
              Get directions<span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : null}
        </div>
        <PhotoFigure
          photo={PHOTOS.coastline}
          aspectRatio="16 / 9"
          sizes="(max-width: 900px) 100vw, 640px"
          style={{ flex: "1 1 560px", minWidth: 0 }}
        />
        <p className="show-sm m-0" style={{ fontSize: 15 }}>
          Check-in <Ph value={checkIn} className="num" /> · Check-out <Ph value={checkOut} className="num" />
        </p>
      </div>
    </section>
  );
}

/** Phone only: a quiet bar at the foot of the screen that takes the guest back to the availability bar. */
export function MobileCheckBar({ target = "#check-availability" }: { target?: string }) {
  return (
    <div className="show-sm on-midnight" style={{ position: "sticky", bottom: 0, zIndex: 30, borderTop: "1px solid var(--hair-gold-strong)" }}>
      <div className="flex items-center justify-between gap-3" style={{ padding: "10px 16px" }}>
        <span className="min-w-0 text-[13px] leading-snug" style={{ color: "var(--color-on-dark-2)" }}>
          Two apartments, by the night
        </span>
        <a href={target} className="btn-gold min-h-11! shrink-0 px-3.5! text-[12px]! tracking-[.12em]!">
          Check availability
        </a>
      </div>
    </div>
  );
}
