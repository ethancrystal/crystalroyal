"use client";

import { useEffect, useRef, useState } from "react";

// One tap copies the value; the button reads "Copied" for 2 seconds and the change is announced politely.
// Canvas: Payment.dc.html `.copy` (hairline, tracked capitals), 44px tall.

async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the selection fallback
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function CopyButton({
  value,
  label = "Copy",
  ariaLabel,
  tone = "midnight",
  className = "",
  style,
}: {
  value: string;
  /** Visible word; "Copy" by default. */
  label?: string;
  /** Spoken name, e.g. "Copy IBAN". Should start with the visible word. */
  ariaLabel?: string;
  tone?: "midnight" | "ivory";
  className?: string;
  style?: React.CSSProperties;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const onClick = async () => {
    const ok = await writeClipboard(value);
    setState(ok ? "copied" : "failed");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2000);
  };

  const toneClass =
    tone === "midnight"
      ? "border-[rgba(197,168,128,0.6)] text-[var(--color-on-dark)] hover:bg-[var(--color-gold)] hover:text-[var(--color-midnight)]"
      : "border-[var(--color-ink)] text-[var(--color-ink)] hover:bg-[var(--color-ink)] hover:text-[var(--color-ivory)]";

  const word = state === "copied" ? "Copied" : state === "failed" ? "Not copied" : label;

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        className={`shrink-0 cursor-pointer border border-solid bg-transparent ${toneClass} ${className}`}
        style={{
          minWidth: 88,
          minHeight: 44,
          padding: "0 14px",
          fontFamily: "var(--font-sans)",
          fontWeight: 500,
          fontSize: 12,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          transition: "background-color 200ms ease-out, color 200ms ease-out",
          ...style,
        }}
      >
        {word}
      </button>
      <span className="sr-only" aria-live="polite" role="status">
        {state === "copied" ? "Copied" : state === "failed" ? "Not copied. Select the text to copy it." : ""}
      </span>
    </>
  );
}
