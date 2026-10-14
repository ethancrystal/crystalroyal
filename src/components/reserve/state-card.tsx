import { forwardRef } from "react";

// A guest-facing state from the canvas "States and errors" board: an ivory-2 panel with a status pill (colour always
// with a word), a Cormorant heading, the explanation and the one thing to do next. No hooks.

export const StateCard = forwardRef<
  HTMLElement,
  {
    tone: "bad" | "wait" | "neutral";
    pill: string;
    heading?: string;
    children: React.ReactNode;
    actions?: React.ReactNode;
    /** Announce on render (for states that appear after an action). */
    alert?: boolean;
    id?: string;
  }
>(function StateCard({ tone, pill, heading, children, actions, alert, id }, ref) {
  const pillStyle: React.CSSProperties =
    tone === "neutral" ? { background: "var(--color-ink-2)", color: "var(--color-paper)" } : {};
  return (
    <section
      ref={ref}
      id={id}
      tabIndex={-1}
      role={alert ? "alert" : undefined}
      className="flex flex-col outline-none focus-visible:outline-2 focus-visible:outline-[var(--color-gold)]"
      style={{ background: "var(--color-ivory-2)", padding: "28px 24px", gap: 14, color: "var(--color-ink)" }}
    >
      <span className={`pill ${tone === "neutral" ? "" : `pill-${tone}`}`} style={{ alignSelf: "flex-start", ...pillStyle }}>
        {pill}
      </span>
      {heading ? (
        <h2 className="display" style={{ fontSize: 30, lineHeight: 1.1 }}>
          {heading}
        </h2>
      ) : null}
      <div style={{ color: "var(--color-ink-2)" }}>{children}</div>
      {actions ? (
        <div className="flex flex-wrap items-center" style={{ gap: 12 }}>
          {actions}
        </div>
      ) : null}
    </section>
  );
});
