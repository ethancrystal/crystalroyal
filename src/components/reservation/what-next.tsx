import Link from "next/link";
import { WhatsAppLink } from "@/components/whatsapp-link";

// "What happens next" on the payment page (copy deck list; canvas section style and "Go to your reservation").

export function WhatHappensNext({ statusHref, whatsappNumber, reference }: { statusHref: string; whatsappNumber: string; reference: string }) {
  return (
    <section aria-labelledby="next-h" style={{ borderTop: "1px solid var(--hair-gold)", paddingTop: 24 }}>
      <h2 id="next-h" className="eyebrow" style={{ margin: "0 0 10px", color: "var(--color-gold)" }}>
        What happens next
      </h2>
      <ul className="m-0 flex list-disc flex-col p-0 pl-[22px]" style={{ gap: 6, fontSize: 15, color: "var(--color-on-dark-2)" }}>
        <li>We match your transfer to the reference.</li>
        <li>You receive a confirmation by email.</li>
        <li>Your voucher and directions are ready on your reservation page.</li>
        <li>
          <WhatsAppLink
            number={whatsappNumber}
            text={`Reservation ${reference}`}
            className="text-gold! underline underline-offset-4 hover:text-facet!"
          >
            Need help? WhatsApp us.
          </WhatsAppLink>
        </li>
      </ul>
      <p className="m-0" style={{ marginTop: 20 }}>
        <Link href={statusHref} className="btn-dark max-[640px]:w-full">
          Go to your reservation
        </Link>
      </p>
    </section>
  );
}
