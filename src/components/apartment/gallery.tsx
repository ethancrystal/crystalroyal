// Gallery plates (Apartment.dc.html: one wide plate over three; ApartmentMobile: a full-bleed 4:3 plate over three
// squares). Labelled placeholders until the property supplies photographs; each plate keeps its final shape so a
// real image will cause no layout shift.

/** "Photo · principal bedroom · 1280 × 960" → "Principal bedroom" for the small mobile squares. */
function shortLabel(label: string): string {
  const parts = label.split("·").map((p) => p.trim());
  const middle = parts.length >= 3 ? parts.slice(1, -1).join(" · ") : (parts[1] ?? parts[0]);
  return middle.charAt(0).toUpperCase() + middle.slice(1);
}

function GalleryPlate({ label, className = "", short }: { label: string; className?: string; short?: boolean }) {
  return (
    <div className={`plate ${className}`} role="img" aria-label={label}>
      {short ? (
        <>
          <span aria-hidden="true" className="hide-sm">
            {label}
          </span>
          <span aria-hidden="true" className="show-sm">
            {shortLabel(label)}
          </span>
        </>
      ) : (
        <span aria-hidden="true">{label}</span>
      )}
    </div>
  );
}

export function Gallery({ hero, small }: { hero: string; small: string[] }) {
  return (
    <section aria-label="Photographs" className="container-site pt-10 max-[900px]:px-0! max-[900px]:pt-0">
      <div className="grid grid-cols-3 gap-2 [grid-template-rows:300px_220px] max-[900px]:gap-1 max-[900px]:[grid-template-rows:auto]">
        <GalleryPlate label={hero} className="col-span-3 max-[900px]:aspect-[4/3]" />
        {small.slice(0, 3).map((s) => (
          <GalleryPlate key={s} label={s} short className="max-[900px]:aspect-square max-[900px]:p-2! max-[900px]:text-[11px]!" />
        ))}
      </div>
    </section>
  );
}
