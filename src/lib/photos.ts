// City photography (Unsplash licence, credited under each image). These show Karachi, not the apartments: the
// apartment plates stay labelled placeholders until the property supplies its own photographs.

export type Photo = {
  src: string;
  alt: string;
  credit: { name: string; url: string };
  width: number;
  height: number;
};

const UTM = "?utm_source=crystal_royal&utm_medium=referral";

export const PHOTOS = {
  skylineDusk: {
    src: "https://images.unsplash.com/photo-1744182896518-fd1233b5c568?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=2000",
    alt: "The Karachi skyline at sunset under a golden sky",
    credit: { name: "Tahamie Farooqui", url: `https://unsplash.com/@tami171091${UTM}` },
    width: 2000,
    height: 1333,
  },
  coastline: {
    src: "https://images.unsplash.com/photo-1759323050124-eb669cec0b72?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=2000",
    alt: "Aerial view of Karachi's high-rises along the Arabian Sea coastline",
    credit: { name: "Tahamie Farooqui", url: `https://unsplash.com/@tami171091${UTM}` },
    width: 2000,
    height: 1125,
  },
} satisfies Record<string, Photo>;

export const UNSPLASH_URL = `https://unsplash.com/${UTM}`;
