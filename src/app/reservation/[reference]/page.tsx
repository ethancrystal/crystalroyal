import type { Metadata } from "next";
import Link from "next/link";
import { PhText } from "@/components/ph";
import { CancelRequest } from "@/components/reservation/cancel-request";
import { ConfirmedHero } from "@/components/reservation/confirmed-hero";
import { pkt, receiptWords, receiptsOf, rejectedReceipt, stayRange, timelineSteps } from "@/components/reservation/format";
import { loadGuestView, SETTLED, tokenFrom, type GuestView, type SearchParams } from "@/components/reservation/load";
import { ReceiptRejected, StateNotice } from "@/components/reservation/notice";
import { COLUMN, ReservationFooter, ReservationHeader } from "@/components/reservation/shell";
import { StaySummary } from "@/components/reservation/summary";
import { Timeline } from "@/components/reservation/timeline";
import { UploadZone } from "@/components/reservation/upload-zone";
import { Voucher } from "@/components/reservation/voucher";
import { StatusPill } from "@/components/status-pill";
import { WhatsAppLink } from "@/components/whatsapp-link";
import { RECEIPTS_PER_RESERVATION } from "@/lib/storage";

// Reservation status page (canvas Status.dc.html): "Your stay", the reference, the status in words and colour, the
// vertical timeline from the status and the payments, the stay summary, the receipt upload while Reserved,
// "Request cancellation" and "Need help? WhatsApp us". Variants: "Hold ended" and "Cancelled" (States board), and
// once confirmed, the confirmation (canvas Confirmed.dc.html): the ceremonial band, the voucher, before you arrive.

export const metadata: Metadata = { title: "Your stay — Crystal Royal Apartment" };

const linkClass = "text-bronze! underline underline-offset-4 min-h-11 inline-flex items-center";

export default async function StatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ reference }, sp] = await Promise.all([params, searchParams]);
  const v = await loadGuestView(reference, tokenFrom(sp));
  return SETTLED.has(v.r.status) ? <Confirmed v={v} /> : <InProgress v={v} />;
}

function NeedHelp({ v }: { v: GuestView }) {
  return (
    <WhatsAppLink number={v.settings.whatsapp_number} text={`Reservation ${v.r.reference}`} className={linkClass} plainClassName="text-[15px]">
      Need help? WhatsApp us
    </WhatsAppLink>
  );
}

function Cancel({ v }: { v: GuestView }) {
  return (
    <CancelRequest
      reference={v.r.reference}
      token={v.token}
      requestedOn={v.r.cancellation_requested_at ? pkt(v.r.cancellation_requested_at) : null}
      policy={<PhText text={v.settings.cancellation_text} />}
    />
  );
}

/** Reserved, receipt received, hold ended, cancelled. */
function InProgress({ v }: { v: GuestView }) {
  const { r, settings: s, links } = v;
  const active = r.status === "reserved" || r.status === "payment_submitted";
  const receipts = receiptsOf(v.payments);
  const rejected = rejectedReceipt(r.status, v.payments);

  return (
    <div className="on-ivory flex min-h-screen flex-col">
      <ReservationHeader />
      <main
        id="main"
        className={`${COLUMN} flex flex-1 flex-wrap items-start gap-[72px] pt-[72px] pb-[120px] max-[900px]:gap-12 max-[640px]:pt-10 max-[640px]:pb-16`}
      >
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-9">
          <div className="flex flex-col gap-3">
            <p className="eyebrow num" style={{ color: "var(--color-bronze)" }}>
              Reservation {r.reference}
            </p>
            <h1 className="display text-[56px] max-[640px]:text-[40px]">Your stay</h1>
            {/* A hold that ended or a cancellation is named by the notice below, pill and all. */}
            {active ? (
              <p className="m-0">
                <StatusPill status={r.status} />
              </p>
            ) : null}
          </div>

          {r.status === "expired" ? (
            <StateNotice
              tone="bad"
              pill="Hold ended"
              heading="Your hold on these dates has ended"
              headingId="ended-h"
              actions={
                <>
                  <Link href={links.reserveAgain} className="btn-light">
                    Reserve again
                  </Link>
                  <NeedHelp v={v} />
                </>
              }
            >
              <p className="m-0">Your hold has ended. The dates may still be free; reserve again to hold them.</p>
            </StateNotice>
          ) : null}

          {r.status === "cancelled" ? (
            <StateNotice
              tone="bad"
              pill="Cancelled"
              heading="This reservation has been cancelled"
              headingId="cancelled-h"
              actions={
                <>
                  <Link href={links.apartment} className="btn-light">
                    See the apartment
                  </Link>
                  <NeedHelp v={v} />
                </>
              }
            >
              <p className="m-0">
                Reservation {r.reference} for {stayRange(r.check_in, r.check_out)} was cancelled
                {r.cancelled_at ? ` on ${pkt(r.cancelled_at)}` : ""}.
              </p>
              {r.cancel_reason ? <p className="m-0">Reason: {r.cancel_reason}</p> : null}
            </StateNotice>
          ) : null}

          {rejected ? <ReceiptRejected reason={rejected.rejection_reason} holdExpiresAt={r.hold_expires_at} /> : null}

          {active ? <Timeline steps={timelineSteps(r, v.payments, s)} /> : null}

          {/* Upload while Reserved. Once a receipt is in, the same place says so (and keeps the guest's
              "Receipt received" in view after an upload from here); further copies go through the payment page. */}
          {active ? (
            <section aria-labelledby="up-h" className="flex flex-col" style={{ gap: 12 }}>
              <h2 id="up-h" className="eyebrow" style={{ color: "var(--color-bronze)" }}>
                {r.status === "reserved" ? "Upload receipt" : "Your receipt"}
              </h2>
              <UploadZone
                reference={r.reference}
                token={v.token}
                tone="ivory"
                received={r.status === "payment_submitted" && receipts[0] ? { label: `Uploaded ${pkt(receipts[0].created_at)}` } : null}
                canAddMore={r.status === "reserved" && receipts.length < RECEIPTS_PER_RESERVATION}
                labelledBy="up-h"
              />
            </section>
          ) : null}

          {active ? (
            <div className="flex flex-wrap items-center gap-4">
              <Link href={links.pay} className="btn-light max-[640px]:w-full">
                Payment instructions
              </Link>
              <NeedHelp v={v} />
            </div>
          ) : null}

          {active ? <Cancel v={v} /> : null}
        </div>

        <StaySummary
          reservation={r}
          typeName={v.typeName}
          amenities={v.amenities}
          money={v.money}
          receipt={r.status === "cancelled" || r.status === "expired" ? null : receiptWords(r.status, v.payments)}
        />
      </main>
      <ReservationFooter />
    </div>
  );
}

/** Confirmed, checked in, completed. */
function Confirmed({ v }: { v: GuestView }) {
  const { r, settings: s, links } = v;
  return (
    <div className="on-midnight flex min-h-screen flex-col">
      <ReservationHeader />
      <main id="main" className="flex flex-1 flex-col">
        <ConfirmedHero
          reference={r.reference}
          status={r.status}
          guestName={r.guest_name}
          checkIn={r.check_in}
          checkOut={r.check_out}
          checkInTime={s.check_in}
          checkOutTime={s.check_out}
          icsHref={links.ics}
          voucherHref={links.voucher}
        />
        <div className="on-ivory flex-1 px-12 py-24 max-[640px]:px-4 max-[640px]:py-12">
          <Voucher reservation={r} typeName={v.typeName} settings={s} payments={v.payments} amenities={v.amenities} money={v.money} />
          <div className="mx-auto mt-16 flex w-full max-w-[860px] flex-wrap items-start gap-12 max-[640px]:mt-12">
            <section aria-labelledby="progress-h" className="min-w-0 flex-[1_1_360px]">
              <h2 id="progress-h" className="eyebrow" style={{ margin: "0 0 20px", color: "var(--color-bronze)" }}>
                Your reservation
              </h2>
              <Timeline steps={timelineSteps(r, v.payments, s)} />
            </section>
            <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-6">
              <NeedHelp v={v} />
              {r.status === "confirmed" ? <Cancel v={v} /> : null}
            </div>
          </div>
        </div>
      </main>
      <ReservationFooter />
    </div>
  );
}
