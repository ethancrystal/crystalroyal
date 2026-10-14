import Link from "next/link";
import { WhatsAppLink } from "@/components/whatsapp-link";
import { getSettings } from "@/lib/db/queries";
import { ReservationFooter, ReservationHeader, COLUMN } from "./shell";
import { StateNotice } from "./notice";

// Canvas States board, "Link not valid": what a guest sees when a reservation link has a wrong or missing token or
// an unknown reference. Meant for src/app/reservation/[reference]/not-found.tsx (every reservation route calls
// notFound() for an invalid link). Reads only the WhatsApp number; falls back to the placeholder if the database
// cannot be reached.

export async function LinkNotValid() {
  let whatsapp = "[92XXXXXXXXXX]";
  try {
    whatsapp = (await getSettings()).whatsapp_number;
  } catch {
    // keep the placeholder; the page must render regardless
  }
  return (
    <div className="flex min-h-screen flex-col on-ivory">
      <ReservationHeader />
      <main id="main" className="flex-1">
        <div className={`${COLUMN} py-[72px] max-[640px]:py-12`} style={{ maxWidth: 760 }}>
          <StateNotice
            level={1}
            tone="bad"
            pill="Link not valid"
            heading="We cannot open this reservation"
            headingId="invalid-h"
            actions={
              <>
                <WhatsAppLink number={whatsapp} text="My reservation link does not open" className="btn-light">
                  WhatsApp us
                </WhatsAppLink>
                <Link href="/" className="text-bronze! underline underline-offset-[6px] min-h-11 inline-flex items-center">
                  Return to the home page
                </Link>
              </>
            }
          >
            <p className="m-0">The link may be incomplete. Use the link in your email, or send us your reference and we will resend it.</p>
          </StateNotice>
        </div>
      </main>
      <ReservationFooter />
    </div>
  );
}
