// Photography (Unsplash licence). City photos show Karachi and are credited under each image. Interior photos are
// SAMPLES of other properties, shown with a "Sample photo" tag until the property supplies its own: replace each
// entry in INTERIORS with the real photograph (and set `sample: false`) to remove the tag.

export type Photo = {
  src: string;
  alt: string;
  credit: { name: string; url: string };
  width: number;
  height: number;
  /** A stand-in, not a photograph of this property: rendered with a visible "Sample photo" tag. */
  sample?: boolean;
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

const u = (id: string) => `https://images.unsplash.com/${id}?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=2000`;
const by = (name: string, user: string) => ({ name, url: `https://unsplash.com/@${user}${UTM}` });

function sample(id: string, alt: string, credit: Photo["credit"], width: number, height: number): Photo {
  return { src: u(id), alt: `Sample photo: ${alt}`, credit, width, height, sample: true };
}

/** Per apartment type (keyed by slug): the card photo, the gallery hero and the three small gallery photos. */
export const INTERIORS: Record<string, { card: Photo; hero: Photo; small: [Photo, Photo, Photo] }> = {
  "three-bedroom": {
    card: sample("photo-1644057501622-dfa7dd26dbfb", "a bedroom with a large bed and an armchair", by("Ali Moradi", "3dartistmoradi"), 2000, 1486),
    hero: sample("photo-1648881806148-e5c51179c826", "a lounge with sofas under a chandelier", by("Ali Moradi", "3dartistmoradi"), 2000, 1531),
    small: [
      sample("photo-1644057501622-dfa7dd26dbfb", "the principal bedroom", by("Ali Moradi", "3dartistmoradi"), 2000, 1486),
      sample("photo-1560448075-cbc16bb4af8e", "a dining table beside the kitchen", by("Francesca Tosolini", "fromitaly"), 2000, 1333),
      sample("photo-1512918728675-ed5a9ecdebfd", "a second bedroom with a wooden bed and nightstand", by("Frames For Your Heart", "framesforyourheart"), 2000, 1333),
    ],
  },
  "two-bedroom": {
    card: sample("photo-1560185893-a55cbc8c57e8", "a bedroom with dark grey walls and a large bed", by("Francesca Tosolini", "fromitaly"), 2000, 1333),
    hero: sample("photo-1704040686413-2c607dbd2f06", "a lounge with a sofa and coffee table", by("Ariel Domenden", "hypvisual"), 2000, 1333),
    small: [
      sample("photo-1560185893-a55cbc8c57e8", "the principal bedroom", by("Francesca Tosolini", "fromitaly"), 2000, 1333),
      sample("photo-1789381566177-d8878d6f9f59", "a dining table in a bright kitchen", by("Paintit.ai Interior Design", "paintit_ai"), 2000, 1333),
      sample("photo-1552858725-2758b5fb1286", "a second bedroom lit by a bedside lamp", by("Jp Valery", "jpvalery"), 2000, 1333),
    ],
  },
};
