"use client";

import { useId } from "react";

// Minus, count, plus (canvas folio and reserve step 1). The buttons stay focusable at a limit (aria-disabled, not
// disabled) so keyboard focus is never lost, and the reason for the limit is shown in words and linked to them.

export interface StepperProps {
  label: string;
  hint?: React.ReactNode;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** Renders a hidden input so a plain <form> posts the value. */
  name?: string;
  /** midnight: the folio and reservation card. ivory: the reserve steps. */
  tone?: "midnight" | "ivory";
  /** Defaults: "Fewer adults" / "More adults" from the label. */
  decLabel?: string;
  incLabel?: string;
  /**
   * Shown when the value sits at `min` / `max` (defaults "The minimum is 1." / "The maximum is 8."; nothing at a
   * zero minimum). null hides it when the page explains the limit elsewhere (then pass `describedBy`).
   */
  minReason?: string | null;
  maxReason?: string | null;
  /** id of text elsewhere on the page that explains the limits (e.g. the party note). */
  describedBy?: string;
  className?: string;
}

export function Stepper({
  label,
  hint,
  value,
  min,
  max,
  onChange,
  name,
  tone = "midnight",
  decLabel,
  incLabel,
  minReason,
  maxReason,
  describedBy,
  className = "",
}: StepperProps) {
  const id = useId();
  const dark = tone === "midnight";
  const atMin = value <= min;
  const atMax = value >= max;
  const lower = label.toLowerCase();
  // Defaults: a plain statement of the limit; nothing for a zero minimum, which needs no explaining.
  const reason = atMax
    ? maxReason === undefined
      ? `The maximum is ${max}.`
      : maxReason
    : atMin
      ? minReason === undefined
        ? min > 0
          ? `The minimum is ${min}.`
          : null
        : minReason
      : null;
  const reasonId = `${id}-reason`;
  const hintId = `${id}-hint`;
  const described = [hint ? hintId : "", reason ? reasonId : "", describedBy ?? ""].filter(Boolean).join(" ") || undefined;

  const muted = dark ? "var(--color-on-dark-2)" : "var(--color-ink-2)";
  // Colours are set inline for both tones: globals.css recolours any .step inside an .on-ivory ancestor, and the
  // midnight folio card often sits on an ivory page.
  const btnStyle: React.CSSProperties = dark
    ? { borderColor: "rgba(197, 168, 128, 0.6)", color: "var(--color-on-dark)" }
    : { width: 48, height: 48, borderColor: "var(--color-ink)", color: "var(--color-ink)" };
  const disabledStyle: React.CSSProperties = { opacity: 0.3, cursor: "not-allowed" };

  const step = (next: number) => {
    const v = Math.min(max, Math.max(min, next));
    if (v !== value) onChange(v);
  };

  return (
    <div
      role="group"
      aria-labelledby={`${id}-label`}
      className={`flex items-center justify-between gap-4 ${className}`}
      style={dark ? undefined : { padding: "18px 0", borderBottom: "1px solid var(--color-taupe)" }}
    >
      <span className="min-w-0">
        <span id={`${id}-label`} style={dark ? undefined : { fontWeight: 500 }}>
          {label}
        </span>
        {hint ? (
          <span id={hintId} className="block" style={{ fontSize: dark ? 13 : 14, color: muted }}>
            {hint}
          </span>
        ) : null}
        {reason ? (
          <span id={reasonId} className="block" style={{ fontSize: 13, color: muted }}>
            {reason}
          </span>
        ) : null}
      </span>
      <span className="flex shrink-0 items-center" style={{ gap: dark ? 14 : 18 }}>
        <button
          type="button"
          className="step"
          aria-label={decLabel ?? `Fewer ${lower}`}
          aria-disabled={atMin || undefined}
          aria-describedby={atMin ? described : hint ? hintId : undefined}
          onClick={() => !atMin && step(value - 1)}
          style={{ ...btnStyle, ...(atMin ? disabledStyle : {}) }}
        >
          −
        </button>
        <span
          className="num"
          aria-live="polite"
          aria-atomic="true"
          style={{ minWidth: dark ? 20 : 24, textAlign: "center", fontSize: dark ? 18 : 20 }}
        >
          {value}
          <span className="sr-only"> {lower}</span>
        </span>
        <button
          type="button"
          className="step"
          aria-label={incLabel ?? `More ${lower}`}
          aria-disabled={atMax || undefined}
          aria-describedby={atMax ? described : hint ? hintId : undefined}
          onClick={() => !atMax && step(value + 1)}
          style={{ ...btnStyle, ...(atMax ? disabledStyle : {}) }}
        >
          +
        </button>
      </span>
      {name ? <input type="hidden" name={name} value={value} /> : null}
    </div>
  );
}
