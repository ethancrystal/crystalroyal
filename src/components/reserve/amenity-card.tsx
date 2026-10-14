"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Ph } from "@/components/ph";
import { formatPKR } from "@/lib/money";
import { PRICING_TYPE_LABEL } from "@/lib/pricing";
import type { AmenityLite } from "./shared";

// One "At your service" card (canvas Reserve2): name, pricing type in words, the property's line of copy, the price
// (or "[PKR __] · Quoted separately" while unconfirmed) and "Add". Once added, a quantity stepper, or "Remove" for
// services taken once. Focus follows the control that replaces the one just pressed.

const QTY_BTN: React.CSSProperties = {
  width: 44,
  height: 44,
  border: "1px solid var(--color-ink)",
  background: "transparent",
  color: "var(--color-ink)",
  fontSize: 18,
  fontFamily: "var(--font-sans)",
  cursor: "pointer",
};

const TEXT_BTN: React.CSSProperties = {
  minHeight: 44,
  padding: "0 18px",
  border: "1px solid var(--color-ink)",
  background: "transparent",
  color: "var(--color-ink)",
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
  fontSize: 12,
  letterSpacing: ".16em",
  textTransform: "uppercase",
  cursor: "pointer",
};

export function AmenityCard({
  amenity,
  quantity,
  onChange,
}: {
  amenity: AmenityLite;
  quantity: number;
  onChange: (quantity: number) => void;
}) {
  const id = useId();
  const [focusNext, setFocusNext] = useState<"add" | "dec" | "inc" | null>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const decRef = useRef<HTMLButtonElement>(null);
  const incRef = useRef<HTMLButtonElement>(null);
  const lower = amenity.name.toLowerCase();
  const single = amenity.max_quantity <= 1;
  const atMax = quantity >= amenity.max_quantity;
  const typeWords = PRICING_TYPE_LABEL[amenity.pricing_type];

  useEffect(() => {
    if (!focusNext) return;
    ({ add: addRef, dec: decRef, inc: incRef })[focusNext].current?.focus();
    setFocusNext(null);
  }, [focusNext, quantity]);

  const set = (q: number, then: "add" | "dec" | "inc") => {
    onChange(Math.max(0, Math.min(amenity.max_quantity, q)));
    setFocusNext(then);
  };

  return (
    <div
      className="flex flex-col"
      style={{
        background: "var(--color-ivory-2)",
        padding: 24,
        gap: 12,
        border: `1px solid ${quantity > 0 ? "var(--color-bronze)" : "transparent"}`,
      }}
    >
      <div className="flex items-baseline justify-between" style={{ gap: 12 }}>
        <h2 id={`${id}-name`} className="m-0" style={{ fontSize: 18, fontWeight: 500 }}>
          {amenity.name}
        </h2>
        <span
          className="whitespace-nowrap"
          style={{ fontSize: 12, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--color-bronze)" }}
        >
          {typeWords}
        </span>
      </div>
      {amenity.description ? (
        <p className="m-0" style={{ fontSize: 15, color: "var(--color-ink-2)" }}>
          {amenity.description}
        </p>
      ) : null}
      <div className="mt-auto flex items-center justify-between" style={{ gap: 12 }}>
        <span id={`${id}-price`} className="min-w-0" style={{ fontSize: 14, color: "var(--color-ink-2)" }}>
          {amenity.price === null ? (
            <>
              <Ph value="[PKR __]" /> · Quoted separately
            </>
          ) : (
            `${formatPKR(amenity.price)} ${typeWords}`
          )}
        </span>
        {quantity === 0 ? (
          <button
            ref={addRef}
            type="button"
            className="shrink-0"
            style={TEXT_BTN}
            aria-label={`Add ${lower}`}
            aria-describedby={`${id}-price`}
            onClick={() => set(1, single ? "dec" : "inc")}
          >
            Add
          </button>
        ) : single ? (
          <span className="flex shrink-0 items-center" style={{ gap: 14 }}>
            <span style={{ fontSize: 14, fontWeight: 500 }}>Added</span>
            <button ref={decRef} type="button" style={TEXT_BTN} aria-label={`Remove ${lower}`} onClick={() => set(0, "add")}>
              Remove
            </button>
          </span>
        ) : (
          <span className="flex shrink-0 items-center" style={{ gap: 8 }} role="group" aria-labelledby={`${id}-name`}>
            <button
              ref={decRef}
              type="button"
              style={QTY_BTN}
              aria-label={`Remove one ${lower}`}
              onClick={() => set(quantity - 1, quantity - 1 === 0 ? "add" : "dec")}
            >
              −
            </button>
            <span className="num" aria-live="polite" aria-atomic="true" style={{ minWidth: 18, textAlign: "center" }}>
              {quantity}
              <span className="sr-only"> added</span>
            </span>
            <button
              ref={incRef}
              type="button"
              style={{ ...QTY_BTN, ...(atMax ? { opacity: 0.3, cursor: "not-allowed" } : {}) }}
              aria-label={`Add another ${lower}`}
              aria-disabled={atMax || undefined}
              aria-describedby={atMax ? `${id}-max` : undefined}
              onClick={() => !atMax && set(quantity + 1, "inc")}
            >
              +
            </button>
          </span>
        )}
      </div>
      {!single && atMax ? (
        <p id={`${id}-max`} className="m-0" style={{ fontSize: 13, color: "var(--color-ink-2)", textAlign: "right" }}>
          Up to {amenity.max_quantity}.
        </p>
      ) : null}
    </div>
  );
}
