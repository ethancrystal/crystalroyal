import type { PriceBreakdown } from "@/lib/pricing";
import { formatNumber } from "@/lib/money";
import { PriceSummary } from "@/components/price-summary";

// The folio spine (canvas Reserve1-4 <aside>): midnight, gold eyebrow, the type name in Cormorant, the stay line and
// the price ledger. One component for every step; no hooks, so the client steps feed it live previews and the server
// steps feed it the authoritative quote.
//   variant "stay":   steps 1-3, "Your stay" with the 40px gold total.
//   variant "settle": step 4, "Amount to settle" with the 64px amount due and the reserve button (children).

export function FolioSpine({
  variant = "stay",
  typeName,
  stayLine,
  breakdown,
  taxLabel,
  extraAdultFee,
  extraChildFee,
  emptyMessage,
  note,
  children,
}: {
  variant?: "stay" | "settle";
  typeName: string;
  /** "2 – 5 November 2026 · 3 nights · 6 guests" */
  stayLine?: React.ReactNode;
  breakdown: PriceBreakdown | null;
  taxLabel: string;
  extraAdultFee?: number | null;
  extraChildFee?: number | null;
  /** Shown in place of the ledger while there is no price (no dates yet, or a problem to resolve). */
  emptyMessage?: string;
  note?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const settle = variant === "settle";
  return (
    <aside
      aria-label={settle ? "Amount to settle" : "Your stay"}
      // A muted note in the ledger ("[PKR __] Quoted separately") wraps in its own column instead of squeezing the
      // line labels.
      className="on-midnight flex flex-col [&_dd:has(>span)]:max-w-[150px]"
      style={{ padding: 32, gap: 18 }}
    >
      <p className="eyebrow" style={{ color: "var(--color-gold)" }}>
        {settle ? "Amount to settle" : "Your stay"}
      </p>
      {!settle ? (
        <>
          <p className="display" style={{ fontSize: 28, fontWeight: 400 }}>
            {typeName}
          </p>
          {stayLine ? (
            <p className="num m-0" style={{ fontSize: 15, color: "var(--color-on-dark-2)" }}>
              {stayLine}
            </p>
          ) : null}
        </>
      ) : null}

      {breakdown ? (
        settle ? (
          <>
            <PriceSummary
              breakdown={breakdown}
              taxLabel={taxLabel}
              tone="midnight"
              variant="card"
              extraAdultFee={extraAdultFee}
              extraChildFee={extraChildFee}
            />
            <div className="flex flex-col" style={{ borderTop: "1px solid var(--color-gold)", paddingTop: 18, gap: 4 }}>
              <span style={{ color: "var(--color-on-dark-2)", fontSize: 14 }}>Due now to confirm, PKR</span>
              <span
                className="num"
                style={{ fontFamily: "var(--font-display)", fontSize: 64, lineHeight: 1, color: "var(--color-gold)", fontWeight: 300 }}
              >
                {formatNumber(breakdown.amountDue)}
              </span>
            </div>
          </>
        ) : (
          <PriceSummary
            breakdown={breakdown}
            taxLabel={taxLabel}
            tone="midnight"
            variant="folio"
            extraAdultFee={extraAdultFee}
            extraChildFee={extraChildFee}
          />
        )
      ) : emptyMessage ? (
        <p className="m-0" style={{ fontSize: 15, color: "var(--color-on-dark-2)", borderTop: "1px solid var(--hair-gold)", paddingTop: 16 }}>
          {emptyMessage}
        </p>
      ) : null}

      {children}
      {note ? (
        <div className="m-0" style={{ fontSize: 13, color: "var(--color-on-dark-2)" }}>
          {note}
        </div>
      ) : null}
    </aside>
  );
}
