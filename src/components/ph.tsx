import { isPlaceholder } from "@/lib/site";

/**
 * Renders an owner-supplied value. While it is still an unresolved [bracketed] placeholder (or empty), it keeps
 * its brackets inside a dashed hairline so it never reads as confirmed fact.
 */
export function Ph({ value, fallback, className = "" }: { value: string | number | null | undefined; fallback?: string; className?: string }) {
  const text = value === null || value === undefined || String(value).trim() === "" ? (fallback ?? "[__]") : String(value);
  if (isPlaceholder(text)) return <span className={`ph ${className}`}>{text}</span>;
  return <span className={className}>{text}</span>;
}

/** Splits free text and wraps each [bracketed] run in the placeholder treatment. */
export function PhText({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]*\])/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("[") && p.endsWith("]") ? (
          <span key={i} className="ph">
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}
