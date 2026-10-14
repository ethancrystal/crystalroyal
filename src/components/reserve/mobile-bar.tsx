"use client";

import { useId, useState } from "react";
import { ledgerFor } from "@/components/calendar-logic";
import { PriceSummary } from "@/components/price-summary";
import { formatNumber } from "@/lib/money";
import type { PriceBreakdown } from "@/lib/pricing";

// The "Your stay" bar (canvas ReserveMobile): fixed to the bottom of the viewport below 1024px, midnight with a gold
// rule. It always shows the total, expands to the full breakdown, and carries the step's action (children).

export function MobileStayBar({
  summary,
  breakdown,
  taxLabel,
  extraAdultFee,
  extraChildFee,
  fallbackAmount,
  fallbackCaption,
  amountKind = "total",
  children,
}: {
  /** "3 nights · 7 guests" */
  summary: string;
  breakdown: PriceBreakdown | null;
  taxLabel: string;
  extraAdultFee?: number | null;
  extraChildFee?: number | null;
  /** Shown when there is no price yet, e.g. the nightly rate. */
  fallbackAmount?: string;
  fallbackCaption?: string;
  /** "due": step 4 shows the amount due now. */
  amountKind?: "total" | "due";
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const ledger = breakdown ? ledgerFor(breakdown, { taxLabel, extraAdultFee, extraChildFee }) : null;
  const extras = ledger ? ledger.lines.filter((l) => l.key.startsWith("extra") && l.amount !== null) : [];
  const caption = !breakdown
    ? fallbackCaption
    : amountKind === "due"
      ? "due now to confirm"
      : breakdown.taxRatePercent === null
        ? "before tax"
        : "including tax";
  const amount = breakdown ? formatNumber(amountKind === "due" ? breakdown.amountDue : breakdown.total) : fallbackAmount;

  return (
    <div
      className="on-midnight flex flex-col lg:hidden [&_dd:has(>span)]:max-w-[150px]"
      style={{
        position: "sticky",
        bottom: 0,
        zIndex: 20,
        borderTop: "1px solid var(--color-gold)",
        padding: "14px 16px 18px",
        gap: 12,
      }}
    >
      {breakdown && open ? (
        <div id={panelId} style={{ maxHeight: "50vh", overflowY: "auto" }}>
          <PriceSummary
            breakdown={breakdown}
            taxLabel={taxLabel}
            tone="midnight"
            variant="card"
            extraAdultFee={extraAdultFee}
            extraChildFee={extraChildFee}
          />
        </div>
      ) : (
        extras.map((l) => (
          <p key={l.key} className="m-0 flex justify-between" style={{ gap: 12, fontSize: 13, color: "var(--color-on-dark-2)" }}>
            <span>{l.label}</span>
            <span className="num">{l.amount}</span>
          </p>
        ))
      )}
      <div className="flex items-center justify-between" style={{ gap: 12 }}>
        {breakdown ? (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={open ? panelId : undefined}
            onClick={() => setOpen((o) => !o)}
            className="flex min-w-0 flex-col items-start text-left"
            style={{
              minHeight: 44,
              padding: 0,
              border: 0,
              background: "transparent",
              color: "var(--color-on-dark-2)",
              fontFamily: "inherit",
              fontSize: 14,
              lineHeight: 1.4,
              cursor: "pointer",
            }}
          >
            <span className="eyebrow" style={{ fontSize: 11, color: "var(--color-gold)" }}>
              Your stay <span aria-hidden="true">{open ? "▾" : "▴"}</span>
              <span className="sr-only">{open ? ", hide the breakdown" : ", show the breakdown"}</span>
            </span>
            <span>{summary}</span>
            <span>{caption}</span>
          </button>
        ) : (
          <p className="m-0 flex flex-col" style={{ fontSize: 14, lineHeight: 1.4, color: "var(--color-on-dark-2)" }}>
            <span className="eyebrow" style={{ fontSize: 11, color: "var(--color-gold)" }}>
              Your stay
            </span>
            <span>{summary}</span>
            {caption ? <span>{caption}</span> : null}
          </p>
        )}
        {amount ? (
          <span
            className="num shrink-0 whitespace-nowrap max-[360px]:text-[28px]!"
            style={{ fontFamily: "var(--font-display)", fontSize: 34, lineHeight: 1.1, color: "var(--color-gold)", fontWeight: 400 }}
          >
            PKR {amount}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}
