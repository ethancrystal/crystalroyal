import Image from "next/image";
import type { Photo } from "@/lib/photos";
import { MarkHairline } from "./brand";

/**
 * Photo plate. With `photo`, the image fills the plate's frame (set aspectRatio or a class so it causes no layout
 * shift); a sample photo carries a visible "Sample photo" tag. Without one, the labelled placeholder plate.
 */
export function Plate({
  label,
  aspectRatio,
  className = "",
  style,
  mark = true,
  photo,
  sizes = "(max-width: 900px) 100vw, 50vw",
  priority = false,
}: {
  label: string;
  aspectRatio?: string;
  className?: string;
  style?: React.CSSProperties;
  mark?: boolean;
  photo?: Photo;
  sizes?: string;
  priority?: boolean;
}) {
  if (photo) {
    return (
      <div className={`relative overflow-hidden ${className}`} style={{ aspectRatio, ...style }}>
        <PlatePhoto photo={photo} sizes={sizes} priority={priority} />
      </div>
    );
  }
  return (
    <div className={`plate ${className}`} style={{ aspectRatio, ...style }} role="img" aria-label={label}>
      {mark ? <MarkHairline size={36} /> : null}
      <span>{label}</span>
    </div>
  );
}

/** The image and its sample tag, for a positioned parent. */
export function PlatePhoto({ photo, sizes, priority = false }: { photo: Photo; sizes: string; priority?: boolean }) {
  return (
    <>
      <Image src={photo.src} alt={photo.alt} fill sizes={sizes} priority={priority} className="object-cover" />
      {photo.sample ? (
        <span
          aria-hidden="true"
          className="absolute top-2.5 left-2.5 px-2 py-1 text-[10px] uppercase tracking-[.14em]"
          style={{ background: "rgba(20,18,16,.72)", color: "#F4F1EA" }}
        >
          Sample photo
        </span>
      ) : null}
    </>
  );
}
