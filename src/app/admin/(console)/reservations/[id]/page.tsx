import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { getReservationDetail } from "@/lib/db/admin-queries";
import { getSettings } from "@/lib/db/queries";
import { formatDateTimeKarachi, todayInKarachi } from "@/lib/dates";
import { canTransition, OCCUPYING } from "@/lib/status";
import type { ActivityEntry, Payment, Reservation, ReservationAmenity, Settings } from "@/lib/types";
import {
  AdminPage,
  AdminStatusPill,
  DataTable,
  DetailList,
  DetailRow,
  Notice,
  PAYMENT_METHOD_LABEL,
  PhText,
  RECEIPT_STATUS_LABEL,
  Section,
  TypeMarker,
  describeActivity,
  fmtDay,
  fmtNights,
  fmtNum,
  fmtParty,
  fmtPKR,
  fmtStayLong,
  fmtWhen,
} from "@/components/admin/ui";
import { BreakdownTable, type BreakdownLine } from "@/components/admin/reservations/breakdown";
import { FilterBar } from "@/components/admin/reservations/filter-bar";
import { FocusOnMount, MoveUnitForm, NoteForm, ReservationActions, type ActionAvailability } from "@/components/admin/reservations/action-forms";
import { freeUnitsForMove } from "@/components/admin/reservations/data";
import { DONE_CODES, guestWhatsAppHref, type DoneCode } from "@/components/admin/reservations/shared";
import {
  addNoteAction,
  cancelAction,
  checkInAction,
  checkOutAction,
  moveUnitAction,
  recordPaymentAction,
  rejectReceiptAction,
  verifyReceiptAction,
} from "./actions";

// Reservation detail (canvas AdminReservation): the filter bar, the reference and guest over the status pill, then
// "Guest and stay", the stored breakdown (never recomputed) and notes on the left; the transfer receipt, actions,
// payments and activity on the right. Buttons appear only when the transition is allowed (canTransition).

type Params = Promise<{ id: string }>;

/** One read per request, shared by generateMetadata and the page. */
const loadDetail = cache(getReservationDetail);
type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const d = await loadDetail(id);
  return { title: d ? d.reservation.reference : "Reservation not found" };
}

const pkt = (iso: string) => formatDateTimeKarachi(iso).replace(" Karachi time", " PKT");
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ReservationDetailPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  await requireAdmin();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const detail = await loadDetail(id);
  if (!detail) notFound();
  const { reservation: r, type, unit, units, amenities, payments, activity, amountPaid, balance } = detail;
  const [settings, freeUnits] = await Promise.all([getSettings(), freeUnitsForMove(r)]);

  const doneParam = one(sp.done);
  const doneCode = (DONE_CODES as readonly string[]).includes(doneParam ?? "") ? (doneParam as DoneCode) : null;
  const nonce = one(sp.n) ?? "";

  const submitted = payments.filter((p) => p.receipt_status === "submitted").sort((a, b) => a.created_at.localeCompare(b.created_at));
  const receipt = submitted[0] ?? null;
  const active = r.status !== "cancelled" && r.status !== "expired";
  const confirmable = canTransition(r.status, "confirmed");
  const can: ActionAvailability = {
    verify: receipt ? (confirmable ? "confirm" : ["confirmed", "checked_in", "completed"].includes(r.status) ? "receipt" : null) : null,
    reject: Boolean(receipt) && active,
    record: active && (confirmable || balance > 0),
    recordConfirms: confirmable,
    cancel: canTransition(r.status, "cancelled"),
    checkIn: canTransition(r.status, "checked_in"),
    checkOut: canTransition(r.status, "completed"),
  };
  const hasEmail = r.guest_email.trim() !== "";
  const wa = guestWhatsAppHref(r.guest_phone, r.reference);
  const movable = OCCUPYING.includes(r.status);
  const otherActiveUnits = units.filter((u) => u.active && u.id !== r.unit_id);
  const cancellationPending = Boolean(r.cancellation_requested_at) && canTransition(r.status, "cancelled");

  return (
    <AdminPage gap={28}>
      <FilterBar compact values={{}} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow num text-bronze">
            {r.reference} · {r.source === "admin" ? "manual" : "online"}
          </p>
          <h1 className="display break-words text-ink" style={{ fontSize: "clamp(32px, 7vw, 44px)" }}>
            {r.guest_name}
          </h1>
        </div>
        <AdminStatusPill status={r.status} size="md" />
      </div>

      {doneCode ? (
        <FocusOnMount key={`${doneCode}-${nonce}`}>
          <Notice tone={doneCode === "created_payment_failed" ? "bad" : "ok"} title={doneCode === "created_payment_failed" ? "Payment not recorded." : undefined}>
            {doneMessage(doneCode, r, hasEmail, unit.name)}
          </Notice>
        </FocusOnMount>
      ) : null}

      {cancellationPending ? (
        <Notice tone="wait" title="Cancellation requested.">
          The guest asked to cancel on {pkt(r.cancellation_requested_at!)}. To agree, choose Cancel below and give the reason.
        </Notice>
      ) : null}

      <div className="flex flex-wrap items-start gap-10">
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-7">
          <Section title="Guest and stay" id="guest" gap={6}>
            <DetailList>
              <DetailRow term="Phone">
                <span className="num">{r.guest_phone}</span>
                {wa ? (
                  <>
                    {" · "}
                    <a
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Message guest on WhatsApp (opens in a new tab)"
                      className="-my-2.5 inline-flex min-h-[44px] items-center text-bronze! underline underline-offset-2 hover:text-ink!"
                    >
                      WhatsApp
                    </a>
                  </>
                ) : null}
              </DetailRow>
              <DetailRow term="Email">{hasEmail ? r.guest_email : <span className="text-ink-2">None given</span>}</DetailRow>
              <DetailRow term="Apartment">
                <TypeMarker slug={type.slug}>{type.name}</TypeMarker>
              </DetailRow>
              <DetailRow term="Unit">
                {unit.name}
                {movable ? (
                  <MoveUnitForm
                    key={`move-${nonce}`}
                    reservationId={r.id}
                    units={freeUnits.map((u) => ({ id: u.id, name: u.name }))}
                    emptyText={
                      otherActiveUnits.length === 0
                        ? `There is no other active unit of the ${type.short_name} type.`
                        : "No other unit of this type is free for these nights."
                    }
                    action={moveUnitAction}
                  />
                ) : null}
              </DetailRow>
              <DetailRow term="Dates">
                {fmtStayLong(r.check_in, r.check_out)} · {fmtNights(r.nights)}
              </DetailRow>
              <DetailRow term="Party">{fmtParty(r.adults, r.children)}</DetailRow>
              <DetailRow term="Arrival time">{r.arrival_time || <span className="text-ink-2">Not given</span>}</DetailRow>
              <DetailRow term="Requests">
                {r.requests ? <span className="whitespace-pre-line">{r.requests}</span> : <span className="text-ink-2">None</span>}
              </DetailRow>
              {r.status === "reserved" && r.hold_expires_at ? (
                <DetailRow term="Held until">
                  {pkt(r.hold_expires_at)}
                  {r.hold_extended ? <span className="text-ink-2"> · extended once</span> : null}
                </DetailRow>
              ) : null}
              {r.cancellation_requested_at && !cancellationPending ? (
                <DetailRow term="Guest asked to cancel">{pkt(r.cancellation_requested_at)}</DetailRow>
              ) : null}
              {r.status === "cancelled" ? (
                <DetailRow term="Cancelled">
                  {r.cancelled_at ? pkt(r.cancelled_at) : null}
                  {r.cancel_reason ? <span className="block text-ink-2">{r.cancel_reason}</span> : null}
                </DetailRow>
              ) : null}
              <DetailRow term="Created">{pkt(r.created_at)}</DetailRow>
            </DetailList>
          </Section>

          <Section title="Breakdown" id="breakdown" gap={6}>
            <StoredBreakdown r={r} amenities={amenities} amountPaid={amountPaid} balance={balance} />
          </Section>

          {r.admin_notes ? (
            <Section title="Notes" id="notes" gap={8}>
              <p className="m-0 whitespace-pre-line break-words text-[15px]">{r.admin_notes}</p>
            </Section>
          ) : null}

          <Section title="Add a note" id="add-note" gap={8}>
            <NoteForm key={`note-${nonce}`} reservationId={r.id} action={addNoteAction} />
          </Section>
        </div>

        <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-6">
          {receipt ? <ReceiptPanel r={r} receipt={receipt} waiting={submitted.length} /> : null}

          <Section title="Actions" id="actions" gap={10}>
            <ReservationActions
              key={`actions-${nonce}`}
              reservationId={r.id}
              paymentId={receipt?.id ?? null}
              can={can}
              recordDefault={balance > 0 ? balance : r.amount_due}
              rejectNote={rejectNote(r, settings, submitted.length - 1)}
              hasEmail={hasEmail}
              checkInConfirm={
                r.check_in > todayInKarachi() ? `This stay starts on ${fmtDay(r.check_in)}. Check the guest in today?` : null
              }
              cancelNote={
                hasEmail
                  ? "The guest is emailed that the reservation is cancelled, with this reason."
                  : "There is no email address on this reservation, so no email is sent."
              }
              actions={{
                verify: verifyReceiptAction,
                reject: rejectReceiptAction,
                record: recordPaymentAction,
                cancel: cancelAction,
                checkIn: checkInAction,
                checkOut: checkOutAction,
              }}
            />
          </Section>

          <Section title="Payments" id="payments" gap={6}>
            <PaymentsTable payments={payments} reference={r.reference} />
          </Section>

          <Section title="Activity" id="activity" gap={6}>
            <ActivityList entries={activity} />
          </Section>
        </div>
      </div>
    </AdminPage>
  );
}

function doneMessage(code: DoneCode, r: Reservation, hasEmail: boolean, unitName: string): string {
  const emailed = (what: string) => (hasEmail ? ` ${what} is on its way to the guest.` : " No email was sent: there is no email address on this reservation.");
  switch (code) {
    case "verified":
      return `Payment verified, stay confirmed.${emailed("The confirmation email")}`;
    case "receipt_verified":
      return "Receipt verified and added to the amount received.";
    case "rejected":
      return `Receipt rejected.${emailed("An email with the reason")}`;
    case "rejected_quiet":
      return "Receipt rejected. The stay keeps its status and no email was sent.";
    case "recorded":
      return "Payment recorded and added to the amount received.";
    case "recorded_confirmed":
      return `Payment recorded, stay confirmed.${emailed("The confirmation email")}`;
    case "cancelled":
      return `Reservation cancelled.${emailed("The cancellation email")}`;
    case "checked_in":
      return "Guest checked in.";
    case "checked_out":
      return "Guest checked out. Stay completed.";
    case "note":
      return "Note added to the reservation.";
    case "moved":
      return `Moved to ${unitName}.`;
    case "created":
      return `Reservation added${r.hold_expires_at ? `, held until ${pkt(r.hold_expires_at)}` : ""}.${emailed("An email with the payment instructions")}`;
    case "created_confirmed":
      return `Reservation added, payment recorded and stay confirmed.${emailed("The confirmation email")}`;
    case "created_payment_failed":
      return "The reservation was added, but the payment could not be recorded. Record it below.";
  }
}

function rejectNote(r: Reservation, s: Settings, othersWaiting: number): string {
  if (othersWaiting > 0) return "Another receipt is still waiting, so the reservation stays at Payment received.";
  if (r.status === "payment_submitted") {
    return r.hold_extended
      ? "The reservation returns to Reserved. Its hold was extended once already, so the current deadline stands."
      : `The reservation returns to Reserved and the hold is extended by ${s.hold_hours} hours, once.`;
  }
  if (r.status === "reserved") return "The reservation stays Reserved and the guest is told why.";
  return "The stay keeps its status. No email is sent.";
}

function StoredBreakdown({
  r,
  amenities,
  amountPaid,
  balance,
}: {
  r: Reservation;
  amenities: ReservationAmenity[];
  amountPaid: number;
  balance: number;
}) {
  const lines: BreakdownLine[] = [
    { key: "nights", label: `${fmtNights(r.nights)} × ${fmtNum(r.nightly_rate)}`, amount: r.subtotal_nights },
    {
      key: "extra",
      label: r.extra_adults > 0 ? `Additional guests (${r.extra_adults})` : "Additional guests",
      amount: r.extra_adults_amount,
    },
    ...amenities.map((a) => ({
      key: `a-${a.amenity_id}`,
      label: `${a.name_snapshot} × ${a.quantity}`,
      amount: a.line_total,
      note: "to quote",
    })),
    r.tax_rate_percent === null
      ? { key: "tax", label: "Tax", amount: null, note: "rate not set" }
      : {
          key: "tax",
          label: (
            <>
              <PhText text={r.tax_label || "Tax"} /> ({r.tax_rate_percent}%)
            </>
          ),
          amount: r.tax_amount,
        },
  ];
  const deposit = r.amount_due !== r.total;
  const after = [
    ...(deposit ? [{ key: "due", label: "Due on reserving", amount: r.amount_due }] : []),
    { key: "paid", label: "Received", amount: amountPaid },
    { key: "balance", label: "Balance", amount: balance },
  ];
  return (
    <BreakdownTable
      label={`Stored price breakdown for ${r.reference}`}
      lines={lines}
      total={{ label: deposit ? "Total" : "Amount due", amount: r.total }}
      after={after}
    />
  );
}

function ReceiptPanel({ r, receipt, waiting }: { r: Reservation; receipt: Payment; waiting: number }) {
  const href = `/api/admin/receipt/${receipt.id}`;
  const pdf = receipt.receipt_path?.endsWith(".pdf") ?? false;
  const stated = receipt.amount !== null ? `Guest states ${fmtPKR(receipt.amount)}.` : "The guest did not state an amount.";
  return (
    <section aria-labelledby="receipt-h" className="flex flex-col gap-3 bg-ivory-2 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="receipt-h" className="eyebrow text-bronze">
          Transfer receipt
        </h2>
        <span className="text-[13px] text-ink-2">Link valid 60 seconds</span>
      </div>
      {receipt.receipt_path ? (
        pdf ? (
          <div className="flex min-h-[160px] flex-col items-center justify-center gap-1.5 border border-taupe bg-paper p-4 text-center text-[13px] text-ink-2">
            <span>PDF receipt</span>
            <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center text-bronze! underline underline-offset-2">
              Open the receipt<span className="sr-only"> (PDF, opens in a new tab)</span>
            </a>
          </div>
        ) : (
          <a href={href} target="_blank" rel="noopener noreferrer" className="block border border-taupe bg-paper">
            {/* eslint-disable-next-line @next/next/no-img-element -- a private, short-lived signed URL; not for next/image */}
            <img
              src={href}
              alt={`Transfer receipt uploaded for ${r.reference}. Opens full size in a new tab.`}
              className="block max-h-[420px] w-full object-contain"
              style={{ minHeight: 120 }}
            />
          </a>
        )
      ) : (
        <p className="m-0 border border-taupe bg-paper p-4 text-[13px] text-ink-2">No file is attached to this receipt.</p>
      )}
      <p className="num m-0 text-[13px] text-ink-2">Uploaded {fmtWhen(receipt.created_at)}</p>
      <p className="m-0 text-[14px] text-ink-2">
        {stated} Check the amount and the reference in the remarks.
        {waiting > 1 ? ` ${waiting - 1} more ${waiting - 1 === 1 ? "receipt is" : "receipts are"} waiting; each appears here in turn.` : ""}
      </p>
    </section>
  );
}

function PaymentsTable({ payments, reference }: { payments: Payment[]; reference: string }) {
  return (
    <DataTable
      label={`Payments for ${reference}`}
      dense
      minWidth={480}
      rows={[...payments].reverse()}
      rowKey={(p) => p.id}
      empty="No payments yet."
      columns={[
        { key: "when", header: "Date", cell: (p) => <span className="num whitespace-nowrap">{fmtWhen(p.created_at)}</span> },
        {
          key: "method",
          header: "Method",
          cell: (p) => (
            <>
              <span className="whitespace-nowrap">{PAYMENT_METHOD_LABEL[p.method]}</span>
              {p.bank_reference ? <span className="block text-[13px] text-ink-2">Ref. {p.bank_reference}</span> : null}
            </>
          ),
        },
        { key: "amount", header: "Amount", align: "right", num: true, cell: (p) => <span className="whitespace-nowrap">{p.amount !== null ? fmtPKR(p.amount) : "Not stated"}</span> },
        {
          key: "status",
          header: "Status",
          cell: (p) => (
            <>
              {p.receipt_path || p.receipt_status !== "verified" ? RECEIPT_STATUS_LABEL[p.receipt_status] : "Recorded"}
              {p.rejection_reason ? <span className="block text-[13px] text-ink-2">{p.rejection_reason}</span> : null}
              {p.verified_by ? <span className="block text-[13px] text-ink-2">by {p.verified_by}</span> : null}
            </>
          ),
        },
        {
          key: "receipt",
          header: "Receipt",
          srOnlyHeader: true,
          align: "right",
          cell: (p) =>
            p.receipt_path ? (
              <a
                href={`/api/admin/receipt/${p.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="-my-2.5 inline-flex min-h-[44px] items-center px-1 text-bronze! underline underline-offset-2 hover:text-ink!"
              >
                View<span className="sr-only"> the receipt from {fmtWhen(p.created_at)} (opens in a new tab)</span>
              </a>
            ) : null,
        },
      ]}
    />
  );
}

function ActivityList({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0) return <p className="m-0 text-[14px] text-ink-2">Nothing recorded yet.</p>;
  return (
    <ol className="m-0 list-none p-0 text-[14px]">
      {entries.map((e) => {
        const by = e.actor === "admin" && typeof e.detail?.by === "string" ? e.detail.by : null;
        return (
          <li key={e.id} className="grid gap-3 border-b border-taupe py-2 [grid-template-columns:110px_minmax(0,1fr)]">
            <span className="num text-ink-2">{fmtWhen(e.created_at)}</span>
            <span className="min-w-0 break-words">
              {describeActivity(e)}
              {by ? <span className="text-ink-2"> · {by}</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
