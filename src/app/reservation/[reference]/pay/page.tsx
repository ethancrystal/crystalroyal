import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Ph } from "@/components/ph";
import { BankCard, BankPendingBanner } from "@/components/reservation/bank-card";
import { bankPending, guestsLine, pkt, receiptsOf, rejectedReceipt, stayRange } from "@/components/reservation/format";
import { HoldLine } from "@/components/reservation/hold-line";
import { loadGuestView, tokenFrom, type SearchParams } from "@/components/reservation/load";
import { ReceiptRejected } from "@/components/reservation/notice";
import { COLUMN, ReservationFooter, ReservationHeader } from "@/components/reservation/shell";
import { UploadZone } from "@/components/reservation/upload-zone";
import { WhatHappensNext } from "@/components/reservation/what-next";
import { WhatsAppLink } from "@/components/whatsapp-link";
import { formatNumber, formatPKR } from "@/lib/money";
import { RECEIPTS_PER_RESERVATION } from "@/lib/storage";
import { PhText } from "@/components/ph";

// Payment page (canvas Payment.dc.html and PaymentMobile.dc.html): midnight, the reference and the amount in gold
// numerals, the hold as a quiet line, the Meezan Bank card from settings with copy buttons, how to settle, the
// receipt upload and the WhatsApp alternative, and what happens next. While any bank detail is still a placeholder
// the "Not live" notice tells the guest not to transfer yet.

export const metadata: Metadata = { title: "Settle your stay by bank transfer — Crystal Royal Apartment" };

export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ reference }, sp] = await Promise.all([params, searchParams]);
  const v = await loadGuestView(reference, tokenFrom(sp));
  const { r, settings: s, money, links } = v;

  // Nothing to settle: the status page tells a confirmed, ended or cancelled reservation's story.
  if (r.status !== "reserved" && r.status !== "payment_submitted") redirect(links.status);

  const pending = bankPending(s);
  const receipts = receiptsOf(v.payments);
  const latest = receipts[0];
  const rejected = rejectedReceipt(r.status, v.payments);
  const received = r.status === "payment_submitted" && latest ? { label: `Uploaded ${pkt(latest.created_at)}` } : null;

  return (
    <div className="on-midnight flex min-h-screen flex-col">
      <ReservationHeader link={{ href: links.status, label: "View reservation status" }} />
      {pending ? <BankPendingBanner /> : null}

      <main id="main" className={`${COLUMN} flex flex-1 flex-col gap-14 pt-[72px] pb-[120px] max-[640px]:gap-8 max-[640px]:pt-8 max-[640px]:pb-16`}>
        <div className="flex flex-wrap items-end justify-between gap-12 max-[640px]:gap-3">
          <div className="flex min-w-0 flex-col gap-3.5 max-[640px]:gap-3">
            <p className="eyebrow" style={{ color: "var(--color-gold)" }}>
              Reservation{" "}
              <span className="num" style={{ letterSpacing: ".12em" }}>
                {r.reference}
              </span>
            </p>
            <h1 className="display text-[60px] max-[900px]:text-[44px] max-[640px]:text-[38px]">Settle your stay by bank transfer</h1>
            <p className="m-0 max-[640px]:text-[14px]" style={{ color: "var(--color-on-dark-2)" }}>
              {v.typeName} · {stayRange(r.check_in, r.check_out)} · {guestsLine(r.adults, r.children)}
            </p>
          </div>
          <div className="ml-auto max-w-[260px] text-right max-[640px]:mt-3 max-[640px]:ml-0 max-[640px]:max-w-none max-[640px]:w-full max-[640px]:border-t max-[640px]:border-gold max-[640px]:pt-4 max-[640px]:text-left">
            <p className="eyebrow max-[640px]:text-[11px]" style={{ margin: "0 0 6px", color: "var(--color-on-dark-2)" }}>
              {money.deposit ? "Due now" : "Total"}, PKR
            </p>
            <p
              className="num m-0 text-[96px] max-[640px]:text-[68px]"
              style={{ fontFamily: "var(--font-display)", fontWeight: 300, lineHeight: 0.95, color: "var(--color-gold)" }}
            >
              {formatNumber(money.due)}
            </p>
            {money.deposit ? (
              <p className="m-0" style={{ marginTop: 14, fontSize: 13, color: "var(--color-on-dark-2)" }}>
                50% of {formatPKR(money.total)} · balance at check-in
              </p>
            ) : null}
            <p className="m-0" style={{ marginTop: money.deposit ? 2 : 14, fontSize: 13, color: "var(--color-on-dark-2)" }}>
              {money.beforeTax ? (
                "Before tax · plus applicable taxes"
              ) : (
                <>
                  Including <PhText text={r.tax_label || "[Applicable taxes]"} />
                </>
              )}
            </p>
          </div>
        </div>

        {r.status === "reserved" && r.hold_expires_at ? <HoldLine expiresAt={r.hold_expires_at} /> : null}

        <div className="flex flex-wrap items-start gap-12 max-[640px]:gap-8">
          <BankCard settings={s} reference={r.reference} amountDue={money.due} />

          <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-8">
            <section aria-labelledby="how-h">
              <h2 id="how-h" className="eyebrow" style={{ margin: "0 0 14px", color: "var(--color-gold)" }}>
                How to settle
              </h2>
              <ol className="m-0 flex list-decimal flex-col pl-[22px] max-[640px]:text-[15px]" style={{ gap: 8, color: "var(--color-on-dark-2)" }}>
                <li>
                  Transfer exactly{" "}
                  <span className="num" style={{ color: "var(--color-on-dark)" }}>
                    {formatPKR(money.due)}
                  </span>{" "}
                  to the account shown.
                </li>
                <li>
                  Write{" "}
                  <span className="num" style={{ color: "var(--color-on-dark)" }}>
                    {r.reference}
                  </span>{" "}
                  in the transfer remarks.
                </li>
                <li>Upload the receipt here, or send it on WhatsApp.</li>
                <li>
                  We verify the transfer and confirm your stay, usually within <Ph value={s.confirm_within_hours} /> hours.
                </li>
              </ol>
            </section>

            <section aria-labelledby="up-h" className="flex flex-col" style={{ gap: 12 }}>
              <h2 id="up-h" className="eyebrow" style={{ color: "var(--color-gold)" }}>
                Upload your transfer receipt
              </h2>
              {rejected ? <ReceiptRejected reason={rejected.rejection_reason} holdExpiresAt={null} ground="midnight" /> : null}
              <UploadZone
                reference={r.reference}
                token={v.token}
                tone="midnight"
                received={received}
                canAddMore={receipts.length < RECEIPTS_PER_RESERVATION}
                labelledBy="up-h"
              />
              <WhatsAppLink
                number={s.whatsapp_number}
                text={`Receipt for reservation ${r.reference}`}
                className="self-start text-gold! underline underline-offset-4 hover:text-facet! min-h-11 inline-flex items-center max-[640px]:w-full max-[640px]:justify-center max-[640px]:border max-[640px]:border-gold max-[640px]:no-underline max-[640px]:min-h-[52px] max-[640px]:text-on-dark! max-[640px]:uppercase max-[640px]:tracking-[.16em] max-[640px]:text-[13px] max-[640px]:font-medium"
                plainClassName="text-[15px]"
              >
                Send the receipt on WhatsApp instead
              </WhatsAppLink>
            </section>

            <WhatHappensNext statusHref={links.status} whatsappNumber={s.whatsapp_number} reference={r.reference} />
          </div>
        </div>
      </main>

      <ReservationFooter />
    </div>
  );
}
