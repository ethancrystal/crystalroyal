import Link from "next/link";
import { Ph } from "@/components/ph";
import { SITE, isPlaceholder } from "@/lib/site";
import type { ReservationStatus } from "@/lib/status";
import { STATUS_WORD } from "@/components/status-pill";
import { dayMonth, longDate } from "./format";

// The ceremonial moment (canvas Confirmed.dc.html, upper section): midnight, the crown-diamond mark with one facet
// sweep (none under reduced motion), the reference with the status in words, "Your stay is confirmed.", the welcome
// line, the dates, and three gold hairline buttons: Add to calendar, Get directions, Print voucher.

function MarkWithSweep() {
  return (
    <svg width="140" height="140" viewBox="0 0 200 200" role="img" aria-label="Crystal Royal crown-diamond mark" className="max-[640px]:h-[104px] max-[640px]:w-[104px]">
      <defs>
        <clipPath id="confirmed-pavilion">
          <polygon points="44,124 156,124 100,188" />
        </clipPath>
      </defs>
      <polygon points="56,78 56,44 78,62 100,30 122,62 144,44 144,78" fill="#C5A880" />
      <rect x="56" y="78" width="88" height="12" fill="#7A5F3B" />
      <g stroke="#7A5F3B" strokeWidth="1.5">
        <polygon points="76,100 124,100 136,124 64,124" fill="#D9D4C7" />
        <polygon points="60,100 76,100 64,124 44,124" fill="#EBE5D9" />
        <polygon points="124,100 140,100 156,124 136,124" fill="#EBE5D9" />
        <polygon points="44,124 72,124 100,188" fill="#C5A880" />
        <polygon points="72,124 100,124 100,188" fill="#B89C6E" />
        <polygon points="100,124 128,124 100,188" fill="#A8905F" />
        <polygon points="128,124 156,124 100,188" fill="#93784F" />
      </g>
      <g clipPath="url(#confirmed-pavilion)">
        <rect className="sweep" x="0" y="80" width="3" height="140" fill="#E2C58F" />
      </g>
    </svg>
  );
}

const btn = "btn-dark max-[640px]:w-full";

export function ConfirmedHero({
  reference,
  status,
  guestName,
  checkIn,
  checkOut,
  checkInTime,
  checkOutTime,
  icsHref,
  voucherHref,
}: {
  reference: string;
  status: ReservationStatus;
  guestName: string;
  checkIn: string;
  checkOut: string;
  checkInTime: string;
  checkOutTime: string;
  icsHref: string;
  voucherHref: string;
}) {
  const completed = status === "completed";
  return (
    <section
      aria-labelledby="confirmed-h"
      className="on-midnight flex flex-col items-center text-center px-12 pt-[120px] pb-24 max-[640px]:px-4 max-[640px]:pt-16 max-[640px]:pb-16"
      style={{ gap: 26 }}
    >
      <MarkWithSweep />
      <p className="eyebrow num" style={{ color: "var(--color-gold)" }}>
        {reference} · {STATUS_WORD[status].toLowerCase()}
      </p>
      <h1 id="confirmed-h" className="display text-[76px] max-[900px]:text-[52px] max-[640px]:text-[40px]">
        Your stay is <em style={{ fontStyle: "italic" }}>confirmed</em>.
      </h1>
      <p className="m-0" style={{ color: "var(--color-on-dark-2)", maxWidth: 560 }}>
        {status === "confirmed" ? (
          <>
            Thank you, {guestName}. We look forward to welcoming you on {dayMonth(checkIn)} from <Ph value={checkInTime} />.
          </>
        ) : status === "checked_in" ? (
          <>
            Welcome, {guestName}. Check-out is by <Ph value={checkOutTime} /> on {dayMonth(checkOut)}.
          </>
        ) : (
          <>Thank you for staying with us, {guestName}.</>
        )}
      </p>
      <p className="display text-[32px] max-[640px]:text-[24px]" style={{ fontWeight: 400 }}>
        {checkIn.slice(0, 4) === checkOut.slice(0, 4) ? longDate(checkIn).replace(/ \d{4}$/, "") : longDate(checkIn)}{" "}
        <span style={{ color: "var(--color-gold)" }} aria-hidden="true">→</span>
        <span className="sr-only"> to </span> {longDate(checkOut)}
      </p>
      <div className="flex flex-wrap justify-center max-[640px]:w-full max-[640px]:flex-col" style={{ gap: 14 }}>
        {!completed ? (
          <a href={icsHref} download={`${reference}.ics`} className={btn}>
            Add to calendar
          </a>
        ) : null}
        {!completed ? (
          isPlaceholder(SITE.mapsUrl) ? (
            <span className={btn} style={{ opacity: 0.6, cursor: "default" }}>
              Get directions&nbsp;<Ph value={SITE.mapsUrl} className="normal-case tracking-normal" />
            </span>
          ) : (
            <a href={SITE.mapsUrl} target="_blank" rel="noopener noreferrer" className={btn}>
              Get directions<span className="sr-only"> (opens in a new tab)</span>
            </a>
          )
        ) : null}
        <Link href={voucherHref} className={btn}>
          Print voucher
        </Link>
      </div>
    </section>
  );
}
