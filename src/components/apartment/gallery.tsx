import type { Photo } from "@/lib/photos";
import { PlatePhoto } from "@/components/plate";

// Gallery plates (Apartment.dc.html: one wide plate over three; ApartmentMobile: a full-bleed 4:3 plate over three
// squares). Each plate shows its photo when one is supplied, otherwise a labelled placeholder; the plate keeps its
// shape either way, so swapping in a photograph causes no layout shift.

/** "Photo · principal bedroom · 1280 × 960" → "Principal bedroom" for the small mobile squares. */
function shortLabel(label: string): string {
  const parts = label.split("·").map((p) => p.trim());
  const middle = parts.length >= 3 ? parts.slice(1, -1).join(" · ") : (parts[1] ?? parts[0]);
  return middle.charAt(0).toUpperCase() + middle.slice(1);
}

function GalleryPlate({
  label,
  className = "",
  short,
  photo,
  sizes,
  priority,
}: {
  label: string;
  className?: string;
  short?: boolean;
  photo?: Photo;
  sizes: string;
  priority?: boolean;
}) {
  if (photo) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <PlatePhoto photo={photo} sizes={sizes} priority={priority} />
      </div>
    );
  }
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

export function Gallery({
  hero,
  small,
  photos,
}: {
  hero: string;
  small: string[];
  photos?: { hero: Photo; small: Photo[] };
}) {
  return (
    <section aria-label="Photographs" className="container-site pt-10 max-[900px]:px-0! max-[900px]:pt-0">
      <div className="grid grid-cols-3 gap-2 [grid-template-rows:300px_220px] max-[900px]:gap-1 max-[900px]:[grid-template-rows:auto]">
        <GalleryPlate
          label={hero}
          photo={photos?.hero}
          sizes="100vw"
          priority
          className="col-span-3 max-[900px]:aspect-[4/3]"
        />
        {small.slice(0, 3).map((s, i) => (
          <GalleryPlate
            key={s}
            label={s}
            short
            photo={photos?.small[i]}
            sizes="(max-width: 900px) 33vw, 440px"
            className="max-[900px]:aspect-square max-[900px]:p-2! max-[900px]:text-[11px]!"
          />
        ))}
      </div>
    </section>
  );
}
