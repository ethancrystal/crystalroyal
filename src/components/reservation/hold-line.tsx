import { holdUntil } from "./format";

// The hold deadline as a quiet line, never a timer (copy deck: "Your dates are held until Tuesday 3 November,
// 09:40 PKT."). Payment page: between gold hairlines on midnight. Status page: plain on ivory.

export function HoldLine({ expiresAt, tone = "midnight" }: { expiresAt: string; tone?: "midnight" | "ivory" }) {
  const dark = tone === "midnight";
  return (
    <p
      className="m-0"
      style={{
        padding: dark ? "16px 0" : 0,
        borderTop: dark ? "1px solid var(--hair-gold)" : undefined,
        borderBottom: dark ? "1px solid var(--hair-gold)" : undefined,
        color: dark ? "var(--color-on-dark-2)" : "var(--color-ink-2)",
        fontSize: 15,
      }}
    >
      Your dates are held until{" "}
      <span style={{ color: dark ? "var(--color-on-dark)" : "var(--color-ink)" }}>{holdUntil(expiresAt)}</span>.
    </p>
  );
}
