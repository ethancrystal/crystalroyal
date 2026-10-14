// Static brand and content configuration (config block, section 0 of docs/BOOKING-SITE-BRIEF.md).
// Values in [brackets] are unresolved owner inputs and render exactly as written, with the dashed placeholder
// treatment (components/ph.tsx). Operational values (tax, bank, hold hours, contact, times) live in the
// `settings` table so the owner changes them from /admin/settings without a deploy.

export const SITE = {
  name: "Crystal Royal Apartment",
  shortName: "Crystal Royal",
  tagline: "A royal address for unhurried stays.",
  domain: "[crystalroyalapartment.com]",
  city: "Karachi, Pakistan",
  neighbourhood: "[Neighbourhood]",
  addressLine: "[Street address]",
  mapsUrl: "[Google Maps link]",
  minutesToAirport: "[__ minutes]",
  timeZone: "Asia/Karachi",
  currency: "PKR",
  ratesAsOf: "October 2026",
  idAtCheckIn: "A valid CNIC or passport for each adult is shown at check-in. It is not collected online.",
  houseRules: ["[Quiet hours __ to __]", "[No smoking indoors]", "[No parties or events]", "[Occupancy as reserved]", "[__]"],
} as const;

/** Exact occupancy and rates wording from the owner (voice note, 8 October 2026). Render verbatim. */
export const RATES_WORDING = [
  {
    slug: "three-bedroom",
    title: "Three-Bedroom Apartment with Lounge — PKR 25,000 per night, plus applicable taxes",
    body: "Accommodates up to 6 guests as standard, with a maximum capacity of 8 guests. Each additional adult (guests 7 and 8) is charged PKR 5,000 per night, plus applicable taxes.",
  },
  {
    slug: "two-bedroom",
    title: "Two-Bedroom Apartment with Lounge — PKR 17,000 per night, plus applicable taxes",
    body: "Occupancy and availability should be confirmed directly with the property.",
  },
] as const;

export const RATES_FOOTNOTE =
  "The standard six may be two adults and four children, or four adults and two children. Rates as of October 2026, subject to change.";

export const BANK_FOOTER_NOTE = "Payments by bank transfer to Meezan Bank; no card details are ever requested.";

/** Descriptive content per apartment type, from the design canvas. Commercial values live in the database. */
export const APARTMENT_CONTENT: Record<
  string,
  {
    eyebrow: string;
    summary: string;
    intro: string;
    description: string;
    rooms: { name: string; detail: string }[];
    photos: { hero: string; small: string[] };
    cardPhoto: string;
  }
> = {
  "three-bedroom": {
    eyebrow: "3 bedrooms · lounge",
    summary: "Sleeps 6 as standard, up to 8. Each additional adult (guests 7 and 8) PKR 5,000 per night.",
    intro:
      "A fully serviced apartment with three bedrooms and a lounge, arranged so a family or a small party can share long evenings and still keep their own rooms.",
    description: "[Description of finishes, view and kitchen to be supplied by the property.]",
    rooms: [
      { name: "Bedroom one", detail: "[bed configuration]" },
      { name: "Bedroom two", detail: "[bed configuration]" },
      { name: "Bedroom three", detail: "[bed configuration]" },
      { name: "Lounge", detail: "[seating and dining]" },
      { name: "Kitchen", detail: "[kitchen equipment]" },
      { name: "Bathrooms", detail: "[__]" },
    ],
    photos: {
      hero: "Photo · three-bedroom lounge at dusk · 2560 × 1240",
      small: [
        "Photo · principal bedroom · 1280 × 960",
        "Photo · dining and kitchen · 1280 × 960",
        "Photo · second bedroom · 1280 × 960",
      ],
    },
    cardPhoto: "Photo · three-bedroom lounge at dusk · 1600 × 1000",
  },
  "two-bedroom": {
    eyebrow: "2 bedrooms · lounge",
    summary: "Occupancy and availability are confirmed directly with the property.",
    intro: "A fully serviced apartment with two bedrooms and a lounge, a quieter address for smaller parties.",
    description: "[Description of finishes, view and kitchen to be supplied by the property.]",
    rooms: [
      { name: "Bedroom one", detail: "[bed configuration]" },
      { name: "Bedroom two", detail: "[bed configuration]" },
      { name: "Lounge", detail: "[seating and dining]" },
      { name: "Kitchen", detail: "[kitchen equipment]" },
      { name: "Bathrooms", detail: "[__]" },
    ],
    photos: {
      hero: "Photo · two-bedroom lounge at dusk · 2560 × 1240",
      small: [
        "Photo · principal bedroom · 1280 × 960",
        "Photo · dining and kitchen · 1280 × 960",
        "Photo · second bedroom · 1280 × 960",
      ],
    },
    cardPhoto: "Photo · two-bedroom lounge at dusk · 1600 × 1000",
  },
};

/** How reserving works (canvas copy). */
export const HOW_IT_WORKS = [
  { n: "i", title: "Choose dates", body: "Pick your nights and your party. The calendar shows only what is free." },
  { n: "ii", title: "Add what you need", body: "Airport transfer, breakfast, a driver. Everything is optional." },
  { n: "iii", title: "Reserve", body: "We hold your dates for {holdHours} hours while you arrange the transfer." },
  { n: "iv", title: "Settle by transfer", body: "Transfer to our Meezan Bank account and send the receipt. Confirmed within hours." },
] as const;

/** True when a configured value is still an unresolved [bracketed] placeholder or empty. */
export function isPlaceholder(value: string | number | null | undefined): boolean {
  if (value === null || value === undefined) return true;
  const s = String(value).trim();
  return s === "" || (s.startsWith("[") && s.endsWith("]"));
}

/** wa.me link, or null while the number is still a placeholder (never render a broken link). */
export function whatsappLink(number: string, text?: string): string | null {
  const digits = number.replace(/\D/g, "");
  if (isPlaceholder(number) || digits.length < 10) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
