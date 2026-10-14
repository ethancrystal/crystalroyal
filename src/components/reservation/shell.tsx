import Link from "next/link";
import { BANK_FOOTER_NOTE } from "@/lib/site";

// The frame of the guest reservation pages (canvas Payment, Status, Confirmed): a slim midnight band with the
// wordmark and at most one link, and a one-line footer. The reservation pages carry no site navigation.

/** Content column of the canvas: 1180 wide with 48px margins, 16px on phones. */
export const COLUMN = "mx-auto w-full max-w-[1180px] px-12 max-[900px]:px-4";

export function ReservationHeader({ link }: { link?: { href: string; label: string } }) {
  return (
    <header className="on-midnight no-print" style={{ borderBottom: "1px solid var(--hair-gold)" }}>
      <div className={`${COLUMN} flex items-center justify-between gap-4 h-[76px] max-[640px]:h-16`}>
        <Link
          href="/"
          className="no-underline min-h-11 inline-flex items-center text-[13px] tracking-[.22em] max-[640px]:text-[11px] max-[640px]:tracking-[.2em]"
          aria-label="Crystal Royal Apartment, home"
        >
          CRYSTAL ROYAL APARTMENT
        </Link>
        {link ? (
          <Link
            href={link.href}
            className="text-gold! hover:text-facet! underline underline-offset-4 min-h-11 inline-flex items-center text-right"
            style={{ fontSize: 14 }}
          >
            {link.label}
          </Link>
        ) : null}
      </div>
    </header>
  );
}

export function ReservationFooter() {
  return (
    <footer
      className="on-midnight no-print text-center max-[640px]:text-left"
      style={{ borderTop: "1px solid rgba(197,168,128,.2)", paddingTop: 24, paddingBottom: 28, fontSize: 13, color: "var(--color-on-dark-2)" }}
    >
      <div className={COLUMN}>{BANK_FOOTER_NOTE}</div>
    </footer>
  );
}
