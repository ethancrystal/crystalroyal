import Link from "next/link";
import { getSettings } from "@/lib/db/queries";
import { BANK_FOOTER_NOTE, SITE } from "@/lib/site";
import { Wordmark } from "./brand";
import { Ph } from "./ph";

/** Footer from the canvas (identical on every guest page). Contact values come from settings. */
export async function SiteFooter() {
  const s = await getSettings();
  return (
    <footer style={{ background: "var(--color-midnight-2)", borderTop: "1px solid var(--hair-gold)", color: "var(--color-on-dark)" }}>
      <div className="container-site flex flex-wrap justify-between gap-12" style={{ paddingTop: 72, paddingBottom: 48 }}>
        <div className="flex flex-col items-start gap-2.5">
          <Wordmark />
          <p className="display" style={{ marginTop: 14, fontStyle: "italic", fontSize: 20, color: "var(--color-on-dark-2)" }}>
            {SITE.tagline}
          </p>
        </div>
        <div className="flex flex-col gap-2" style={{ fontSize: 15, color: "var(--color-on-dark-2)" }}>
          <span className="eyebrow" style={{ color: "var(--color-gold)" }}>
            At your service
          </span>
          <span>
            WhatsApp <Ph value={s.phone_display} />
          </span>
          <span>
            <Ph value={s.email} />
          </span>
          <span>
            <Ph value={SITE.addressLine} />, Karachi
          </span>
          <span>
            Check-in from <Ph value={s.check_in} /> · Check-out by <Ph value={s.check_out} />
          </span>
        </div>
        <nav aria-label="Legal" className="flex flex-col gap-2" style={{ fontSize: 15 }}>
          <span className="eyebrow" style={{ color: "var(--color-gold)" }}>
            The fine print
          </span>
          <Link href="/house-rules">House rules</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>
      </div>
      <div
        className="container-site flex flex-wrap justify-between gap-4"
        style={{ paddingTop: 24, paddingBottom: 40, borderTop: "1px solid rgba(197,168,128,.2)", fontSize: 13, color: "var(--color-on-dark-2)" }}
      >
        <span>{BANK_FOOTER_NOTE}</span>
        <span>© 2026 Crystal Royal Apartment, Karachi · Rates as of {SITE.ratesAsOf}, subject to change.</span>
      </div>
    </footer>
  );
}
