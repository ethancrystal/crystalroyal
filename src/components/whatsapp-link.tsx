import { whatsappLink } from "@/lib/site";
import { Ph } from "./ph";

// A wa.me deep link that opens in a new tab. While the number is still the "[92XXXXXXXXXX]" placeholder there is
// no working link to offer, so the words render as plain text followed by the bracketed number.

export function WhatsAppLink({
  number,
  text,
  children,
  className,
  style,
  plainClassName,
}: {
  /** settings.whatsapp_number: digits, country code first. */
  number: string;
  /** Prefilled message, e.g. "Receipt for reservation CRA-2611-0042". */
  text?: string;
  children: React.ReactNode;
  /** Classes for the link (e.g. "btn-dark"). Not applied to the plain-text fallback, so it never looks clickable. */
  className?: string;
  style?: React.CSSProperties;
  /** Classes for the plain-text fallback shown while the number is a placeholder. */
  plainClassName?: string;
}) {
  const href = whatsappLink(number, text);
  if (!href) {
    return (
      <span className={plainClassName}>
        {children} <Ph value={number} />
      </span>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className} style={style}>
      {children}
      <span className="sr-only"> (opens WhatsApp in a new tab)</span>
    </a>
  );
}
