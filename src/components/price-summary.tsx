import { Fragment } from "react";
import type { PriceBreakdown } from "@/lib/pricing";
import { ledgerFor } from "./calendar-logic";
import { Ph, PhText } from "./ph";

// The canvas ledger for a PriceBreakdown (reservation card, folio spine, payment and status pages).
// Server-safe: no hooks, so it renders in Server Components and inside the client stay card alike.
//   variant "card":  the apartment-page card; the total closes the list, "PKR 75,000" at 20px.
//   variant "folio": the reserve spine; the total sits under a gold rule as a 40px Cormorant numeral.

export function PriceSummary({
  breakdown,
  taxLabel,
  tone = "midnight",
  variant = "card",
  extraAdultFee,
  extraChildFee,
  className = "",
  style,
}: {
  breakdown: PriceBreakdown;
  /** settings.tax_label; may still be the "[Applicable taxes]" placeholder. */
  taxLabel: string;
  tone?: "midnight" | "ivory";
  variant?: "card" | "folio";
  /** Per-night fees, needed only to split additional adults and children when the child policy differs. */
  extraAdultFee?: number | null;
  extraChildFee?: number | null;
  className?: string;
  style?: React.CSSProperties;
}) {
  const dark = tone === "midnight";
  const muted = dark ? "var(--color-on-dark-2)" : "var(--color-ink-2)";
  const rule = dark ? "var(--hair-gold)" : "var(--color-taupe)";
  const strongRule = dark ? "var(--color-gold)" : "var(--color-bronze)";
  const numeral = dark ? "var(--color-gold)" : "var(--color-bronze)";
  const ledger = ledgerFor(breakdown, { taxLabel, extraAdultFee, extraChildFee });
  const folio = variant === "folio";

  return (
    <div className={`flex flex-col ${className}`} style={{ gap: 16, ...style }}>
      <dl
        className="m-0 grid"
        style={{
          gridTemplateColumns: "minmax(0, 1fr) auto",
          gap: folio ? "10px 16px" : "8px 16px",
          fontSize: 15,
          borderTop: `1px solid ${rule}`,
          paddingTop: folio ? 16 : 18,
        }}
      >
        {ledger.lines.map((line) => (
          <Fragment key={line.key}>
            <dt style={{ color: muted }}>
              <PhText text={line.label} />
            </dt>
            <dd className={line.amount !== null ? "num whitespace-nowrap" : undefined} style={{ margin: 0, textAlign: "right" }}>
              {line.amount !== null ? (
                line.amount
              ) : (
                <span style={{ fontSize: 13, color: muted, display: "inline-block", maxWidth: 150 }}>
                  {line.placeholder ? (
                    <>
                      <Ph value={line.placeholder} />{" "}
                    </>
                  ) : null}
                  {line.note}
                </span>
              )}
            </dd>
          </Fragment>
        ))}
        {!folio ? (
          <>
            <div aria-hidden="true" style={{ gridColumn: "1 / -1", borderTop: `1px solid ${rule}`, height: 0 }} />
            <dt style={{ fontWeight: 500 }}>{ledger.totalLabel}</dt>
            <dd className="num whitespace-nowrap" style={{ margin: 0, textAlign: "right", fontSize: 20 }}>
              PKR {ledger.total}
            </dd>
            {ledger.due ? (
              <>
                <dt style={{ color: muted }}>{ledger.due.label}</dt>
                <dd className="num whitespace-nowrap" style={{ margin: 0, textAlign: "right" }}>
                  PKR {ledger.due.amount}
                </dd>
              </>
            ) : null}
          </>
        ) : null}
      </dl>
      {folio ? (
        <>
          <p
            className="m-0 flex items-baseline justify-between gap-4"
            style={{ borderTop: `1px solid ${strongRule}`, paddingTop: 16 }}
          >
            <span>{ledger.totalLabel}</span>
            <span
              className="num"
              style={{ fontFamily: "var(--font-display)", fontSize: 40, lineHeight: 1.1, color: numeral, fontWeight: 400 }}
            >
              <span className="sr-only">PKR </span>
              {ledger.total}
            </span>
          </p>
          {ledger.due ? (
            <p className="m-0 flex justify-between gap-4" style={{ fontSize: 15 }}>
              <span style={{ color: muted }}>{ledger.due.label}</span>
              <span className="num whitespace-nowrap">PKR {ledger.due.amount}</span>
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
