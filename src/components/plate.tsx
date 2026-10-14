import { MarkHairline } from "./brand";

/** Labelled photo plate until the property supplies photography. Set aspectRatio so a real image causes no layout shift. */
export function Plate({
  label,
  aspectRatio,
  className = "",
  style,
  mark = true,
}: {
  label: string;
  aspectRatio?: string;
  className?: string;
  style?: React.CSSProperties;
  mark?: boolean;
}) {
  return (
    <div className={`plate ${className}`} style={{ aspectRatio, ...style }} role="img" aria-label={label}>
      {mark ? <MarkHairline size={36} /> : null}
      <span>{label}</span>
    </div>
  );
}
