// The final crown-diamond mark (variant A, faceted), the hairline variant and the stacked wordmark.
// Inline SVG so it scales crisply; colours are the mark's own and stay the same on midnight and ivory.

export function Mark({ size = 40, label }: { size?: number; label?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <polygon points="56,78 56,44 78,62 100,30 122,62 144,44 144,78" fill="#C5A880" />
      <rect x="56" y="78" width="88" height="12" fill="#7A5F3B" />
      <g stroke="#7A5F3B" strokeWidth="1.5" strokeLinejoin="round">
        <polygon points="76,100 124,100 136,124 64,124" fill="#D9D4C7" />
        <polygon points="60,100 76,100 64,124 44,124" fill="#EBE5D9" />
        <polygon points="124,100 140,100 156,124 136,124" fill="#EBE5D9" />
        <polygon points="44,124 72,124 100,188" fill="#C5A880" />
        <polygon points="72,124 100,124 100,188" fill="#B89C6E" />
        <polygon points="100,124 128,124 100,188" fill="#A8905F" />
        <polygon points="128,124 156,124 100,188" fill="#93784F" />
      </g>
    </svg>
  );
}

/** Mark B: one gold line. Used on photo plates and the folio. */
export function MarkHairline({ size = 36, stroke = "#C5A880" }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden="true">
      <g fill="none" stroke={stroke} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
        <polygon points="56,78 56,44 78,62 100,30 122,62 144,44 144,78" />
        <line x1="56" y1="90" x2="144" y2="90" />
        <polygon points="60,100 140,100 156,124 100,188 44,124" />
        <line x1="44" y1="124" x2="156" y2="124" />
        <line x1="76" y1="100" x2="64" y2="124" />
        <line x1="124" y1="100" x2="136" y2="124" />
        <line x1="72" y1="124" x2="100" y2="188" />
        <line x1="128" y1="124" x2="100" y2="188" />
      </g>
    </svg>
  );
}

/** Stacked wordmark: CRYSTAL ROYAL / gold rule / APARTMENT. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex flex-col items-start gap-2.5 ${className}`}>
      <span style={{ fontSize: 15, letterSpacing: ".22em" }}>CRYSTAL ROYAL</span>
      <span style={{ width: "100%", height: 1, background: "var(--color-gold)" }} />
      <span style={{ fontSize: 11, letterSpacing: ".5em", fontWeight: 500 }}>APARTMENT</span>
    </span>
  );
}

/** The faceted crystal (the mark's pavilion, large) with the one-time facet light sweep. Decorative. */
export function FacetedCrystal({ size = 440 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 440 440" role="img" aria-label="Faceted crystal, the pavilion of the brand mark">
      <defs>
        <clipPath id="gem">
          <polygon points="40,150 140,150 220,420" />
          <polygon points="140,150 220,150 220,420" />
          <polygon points="220,150 300,150 220,420" />
          <polygon points="300,150 400,150 220,420" />
          <polygon points="110,60 330,60 400,150 40,150" />
        </clipPath>
      </defs>
      <polygon points="110,60 330,60 400,150 40,150" fill="#221F1B" stroke="#C5A880" strokeWidth="1" />
      <polygon points="160,60 280,60 300,150 140,150" fill="#262219" stroke="#C5A880" strokeWidth="1" />
      <polygon points="40,150 140,150 220,420" fill="#1E1B17" stroke="#C5A880" strokeWidth="1" />
      <polygon points="140,150 220,150 220,420" fill="#25211C" stroke="#C5A880" strokeWidth="1" />
      <polygon points="220,150 300,150 220,420" fill="#2A251F" stroke="#C5A880" strokeWidth="1" />
      <polygon points="300,150 400,150 220,420" fill="#1C1915" stroke="#C5A880" strokeWidth="1" />
      <g clipPath="url(#gem)">
        <rect className="sweep" x="0" y="-40" width="3" height="520" fill="#E2C58F" />
      </g>
    </svg>
  );
}
