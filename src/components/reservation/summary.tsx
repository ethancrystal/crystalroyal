import { Fragment } from "react";
import { PhText } from "@/components/ph";
import { formatPKR } from "@/lib/money";
import type { Reservation, ReservationAmenity } from "@/lib/types";
import { longDate, partyLine, type MoneyView } from "./format";

// The stay summary of the status page (canvas Status.dc.html <aside>): midnight, gold eyebrow, the type name in
// Cormorant, and a two-column ledger. Amounts are the breakdown stored at reservation, never recomputed.

export function StaySummary({
  reservation: r,
  typeName,
  amenities,
  money,
  receipt,
}: {
  reservation: Reservation;
  typeName: string;
  amenities: ReservationAmenity[];
  money: MoneyView;
  /** Words for the receipt row, or null to leave the row out. */
  receipt: string | null;
}) {
  const settled = r.status === "confirmed" || r.status === "checked_in" || r.status === "completed";
  const rows: [string, React.ReactNode, boolean?][] = [
    ["Arrival", longDate(r.check_in)],
    ["Departure", longDate(r.check_out)],
    ["Guests", partyLine(r.adults, r.children)],
  ];
  if (amenities.length > 0) {
    rows.push([
      "At your service",
      amenities.map((a) => `${a.name_snapshot}${a.quantity > 1 ? ` × ${a.quantity}` : ""}`).join(", "),
    ]);
  }
  rows.push([
    "Amount",
    money.beforeTax ? (
      `${formatPKR(money.total)} before tax`
    ) : (
      <>
        {formatPKR(money.total)} including <PhText text={r.tax_label || "[Applicable taxes]"} />
      </>
    ),
    true,
  ]);
  // A stay that ended before it began (hold ended, cancelled) owes nothing more; only money received is shown.
  const ended = r.status === "cancelled" || r.status === "expired";
  if (money.deposit && !settled && !ended) rows.push(["Due now", formatPKR(money.due), true]);
  if (!ended || money.paid > 0) rows.push(["Paid so far", formatPKR(money.paid), true]);
  if (!ended && money.balance !== null && (settled || money.deposit)) rows.push(["Balance due at check-in", formatPKR(money.balance), true]);
  if (receipt) rows.push(["Receipt", receipt]);

  return (
    <aside
      aria-labelledby="summary-h"
      className="on-midnight flex min-w-0 flex-[1_1_420px] flex-col self-start max-[640px]:p-6!"
      style={{ padding: 36, gap: 18 }}
    >
      <h2 id="summary-h" className="eyebrow" style={{ color: "var(--color-gold)" }}>
        Summary
      </h2>
      <p className="display" style={{ fontSize: 30, fontWeight: 400 }}>
        {typeName}
      </p>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 max-[400px]:grid-cols-1 max-[400px]:gap-y-0" style={{ fontSize: 15 }}>
        {rows.map(([term, value, num]) => (
          <Fragment key={term}>
            <dt className="max-[400px]:mt-2.5" style={{ color: "var(--color-on-dark-2)" }}>
              {term}
            </dt>
            <dd className={`m-0 min-w-0 ${num ? "num" : ""}`}>{value}</dd>
          </Fragment>
        ))}
      </dl>
    </aside>
  );
}
