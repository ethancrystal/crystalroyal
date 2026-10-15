import Image from "next/image";
import { UNSPLASH_URL, type Photo } from "@/lib/photos";

/** A sharp-cornered photograph in a fixed-ratio frame (no layout shift), with the photographer's credit beneath. */
export function PhotoFigure({
  photo,
  aspectRatio,
  sizes,
  priority = false,
  className = "",
  style,
  creditColor = "var(--color-ink-2)",
  objectPosition = "center",
}: {
  photo: Photo;
  aspectRatio: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  style?: React.CSSProperties;
  creditColor?: string;
  /** Which part of the photo stays in frame when the ratio crops it, e.g. "62% center" to keep the towers in a narrow crop. */
  objectPosition?: string;
}) {
  return (
    <figure className={`m-0 flex flex-col gap-2 ${className}`} style={style}>
      <div className="relative w-full overflow-hidden" style={{ aspectRatio }}>
        <Image src={photo.src} alt={photo.alt} fill sizes={sizes} priority={priority} className="object-cover" style={{ objectPosition }} />
      </div>
      <figcaption className="text-[12px]" style={{ color: creditColor }}>
        Photo by{" "}
        <a href={photo.credit.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
          {photo.credit.name}
        </a>{" "}
        on{" "}
        <a href={UNSPLASH_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
          Unsplash
        </a>
      </figcaption>
    </figure>
  );
}
