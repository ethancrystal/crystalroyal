import { holdUntil } from "./format";

// Guest-facing states from the canvas "States and errors" board, in both grounds: a status pill (colour always with
// a word), a Cormorant heading, the explanation and the one thing to do next. On midnight (payment page) it is a
// hairline frame in the state's colour, as the canvas upload "rejected" state; on ivory it is the ivory-2 panel.

export function StateNotice({
  tone,
  pill,
  heading,
  headingId,
  ground = "ivory",
  children,
  actions,
  level = 2,
}: {
  /** Heading level: 1 when the notice is the whole page (an invalid link). */
  level?: 1 | 2;
  tone: "bad" | "wait" | "ok" | "neutral";
  pill: string;
  heading: string;
  headingId?: string;
  ground?: "ivory" | "midnight";
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const dark = ground === "midnight";
  const H = level === 1 ? "h1" : "h2";
  const frame = { bad: "var(--color-bad)", wait: "var(--color-wait)", ok: "var(--color-ok)", neutral: "var(--color-ink-2)" }[tone];
  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col"
      style={{
        gap: 14,
        padding: dark ? 24 : "32px 32px",
        background: dark ? "transparent" : "var(--color-ivory-2)",
        border: dark ? `1px solid ${frame}` : undefined,
        color: dark ? "var(--color-on-dark)" : "var(--color-ink)",
      }}
    >
      <span
        className={`pill ${tone === "neutral" ? "pill-neutral" : `pill-${tone}`}`}
        style={{ alignSelf: "flex-start", ...(tone === "neutral" ? { background: "var(--color-ink-2)", color: "var(--color-paper)" } : {}) }}
      >
        {pill}
      </span>
      <H id={headingId} className="display" style={{ fontSize: 30, lineHeight: 1.1 }}>
        {heading}
      </H>
      <div className="flex flex-col" style={{ gap: 8, color: dark ? "var(--color-on-dark-2)" : "var(--color-ink-2)" }}>
        {children}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center" style={{ gap: "12px 20px" }}>
          {actions}
        </div>
      ) : null}
    </section>
  );
}

/** "We could not match this receipt to a transfer. {Reason}. Upload a clearer copy, or send it on WhatsApp." */
export function rejectionSentence(reason: string | null): string {
  const r = (reason ?? "").trim().replace(/[.\s]+$/, "");
  return `We could not match this receipt to a transfer.${r ? ` ${r}.` : ""} Upload a clearer copy, or send it on WhatsApp.`;
}

export function ReceiptRejected({
  reason,
  holdExpiresAt,
  ground = "ivory",
}: {
  reason: string | null;
  holdExpiresAt: string | null;
  ground?: "ivory" | "midnight";
}) {
  const dark = ground === "midnight";
  return (
    <StateNotice tone="bad" pill="Receipt not accepted" heading="We could not match your receipt" headingId="rejected-h" ground={ground}>
      <p className="m-0" style={{ color: dark ? "var(--color-on-dark)" : "var(--color-ink)" }}>
        {rejectionSentence(reason)}
      </p>
      {holdExpiresAt ? <p className="m-0" style={{ fontSize: 15 }}>Your dates are held until {holdUntil(holdExpiresAt)}.</p> : null}
    </StateNotice>
  );
}
