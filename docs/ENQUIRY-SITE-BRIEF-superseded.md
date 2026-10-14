# Build the Crystal Royal Apartment website

You are building the public website for **Crystal Royal Apartment**, a new serviced-apartment business in Karachi, Pakistan. The brand guidelines, logo and page designs are already decided; your job is to implement them as a fast, accessible, deployable website. Follow this brief exactly where it is specific, and use good judgement where it is silent. Do not invent facts about the property; every unknown is marked as a placeholder in square brackets and listed in the config block, so it can be filled in one place.

---

## 1. Project summary

- **Business:** Crystal Royal Apartment. Fully serviced apartments with lounges, Karachi. Two categories: a three-bedroom apartment with lounge, and a two-bedroom apartment with lounge.
- **Audience:** families and travelling groups (local and overseas Pakistanis, visiting relatives, small corporate groups) who want the privacy of a home with the standards of a fine hotel.
- **Positioning line:** *A royal address for unhurried stays.*
- **Tone:** calm, precise, warm. Royal means a standard of care, not a style of decoration. Never salesy: no countdowns, no "hurry", no exclamation marks, no urgency banners.
- **The one job of every page:** get the visitor to send an enquiry (WhatsApp or the short form). No online booking, no online payment. The property confirms occupancy and the exact rate in writing before anything is booked.

## 2. Config block (fill these before launch; use them everywhere via one constants file)

```js
export const SITE = {
  name: "Crystal Royal Apartment",
  domain: "[crystalroyalapartment.___]",          // e.g. crystalroyalapartment.com
  whatsappNumber: "[92XXXXXXXXXX]",               // E.164 digits only, no plus, for wa.me links
  phoneDisplay: "[+92 XXX XXXXXXX]",
  email: "[hello@crystalroyalapartment.___]",
  addressLine: "[Street address]",
  neighbourhood: "[Neighbourhood]",
  city: "Karachi, Pakistan",
  checkIn: "[time]",
  checkOut: "[time]",
  replyTime: "[__ hours]",
  ratesAsOf: "October 2026",
  minutesToAirport: "[__]",
  landmark1: "[landmark or business district]", minutesToLandmark1: "[__]",
  landmark2: "[shopping and dining]",            minutesToLandmark2: "[__]",
  formEndpoint: "",                               // optional: Formspree/Netlify/own endpoint. Empty = WhatsApp only.
};
```

Render any value still in square brackets exactly as written, so unfilled placeholders are visible during review rather than silently blank.

## 3. Stack and structure

**Default:** static site: plain HTML + CSS + a small amount of vanilla JavaScript. No framework, no CSS framework, no UI kit. Deploy to Vercel, Netlify or Cloudflare Pages.

**If the repository already uses Next.js (App Router):** build the same pages as routes with one global stylesheet and the same tokens; do not add Tailwind or a component library. Keep client JavaScript to the mobile menu and the enquiry form.

Files (static version):

```
/index.html                 Homepage
/three-bedroom.html         Three-Bedroom Apartment with Lounge
/two-bedroom.html           Two-Bedroom Apartment with Lounge
/styles.css                 All styles, built from the tokens in section 4
/site.js                    Mobile menu, enquiry form → WhatsApp, optional endpoint POST
/assets/mark-a.svg          Primary logo mark (section 5)
/assets/mark-b.svg          Hairline mark (watermark, foil)
/assets/mark-c.svg          Solid mark (favicon source)
/favicon.svg                Mark C, charcoal on transparent
/robots.txt, /sitemap.xml
```

Pretty URLs on the host (`/three-bedroom`, `/two-bedroom`). Shared header, footer and enquiry section are identical on every page; if the stack has no templating, keep them byte-identical by hand.

## 4. Brand tokens (use as CSS custom properties; no literal colours elsewhere)

```css
:root {
  /* Colour */
  --canvas: #F4F1EA;        /* page background */
  --paper: #FBFAF6;         /* cards, inputs */
  --royal-beige: #EBE5D9;   /* tinted sections, panels */
  --soft-taupe: #D9D4C7;    /* neutral hairlines, dividers */
  --royal-gold: #C5A880;    /* gold hairlines, rules, motif; NOT for small text on light grounds */
  --antique-bronze: #7A5F3B;/* eyebrows, labels, small gold-toned text on light grounds (passes 4.5:1) */
  --charcoal: #2C2C2C;      /* headings, body, dark sections, primary buttons */
  --charcoal-2: #595959;    /* secondary text */
  --on-dark: #F4F1EA;       /* text on charcoal */
  --on-dark-2: #D9D4C7;     /* secondary text on charcoal */

  /* Type */
  --font-display: 'Jost', 'Trebuchet MS', sans-serif;   /* weights 300, 400, 500 */
  --font-body: 'DM Sans', Verdana, sans-serif;          /* weights 400, 500, 600 */

  /* Scale (desktop / mobile) */
  --h1: 72px / 44px;  weight 300, line-height 1.08, letter-spacing -0.01em
  --h2: 44px / 32px;  weight 400, line-height 1.1
  --h3: 24px / 20px;  weight 500, line-height 1.2
  --body: 17px / 16px; line-height 1.6
  --small: 15px / 14px
  --eyebrow: 13px / 12px; weight 500; uppercase; letter-spacing 0.18em; colour --antique-bronze

  /* Layout */
  --container: 1280px; side gutter 48px desktop, 20px mobile
  --section-y: 96px desktop, 56px mobile
  --radius: 0;              /* sharp corners everywhere, no exceptions */
}
```

Rules that define the look:
- **No gradients, no drop shadows, no rounded corners.** Depth comes from flat tinted panels and 1px hairlines only.
- Hairlines: `1px solid var(--royal-gold)` for brand emphasis (section headers, rate rows); `1px solid var(--soft-taupe)` for neutral structure (card borders, inputs).
- Two background tones alternate down the page: `--canvas` and `--royal-beige`. One charcoal band per page (the occupancy-and-rates band on the homepage; the "also available" band on apartment pages).
- Fonts via Google Fonts: `https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500&family=DM+Sans:wght@400;500;600&display=swap`, with `preconnect` to `fonts.googleapis.com` and `fonts.gstatic.com`.
- Contrast: body text is charcoal on canvas (≈12:1). Royal Gold text is only allowed at 24px+ on charcoal (6:1). On light grounds, gold-toned text uses Antique Bronze.
- Motion: fades and short rises only, 200–300 ms, ease-out; no parallax, no scroll-jacking. Respect `prefers-reduced-motion`.

### Components

- **Primary button:** charcoal fill, `--on-dark` text, 1px charcoal border, 15px/500, min-height 52px (48px in the header), padding 0 28px. Hover: background `#1F1F1F`. Focus-visible: 2px gold outline, 2px offset.
- **Secondary button:** transparent fill, charcoal text, 1px `--royal-gold` border. On charcoal sections: `--on-dark` text. Hover: background `--royal-beige` (or `rgba(244,241,234,.08)` on dark).
- **Inputs:** height 52px, 1px `--soft-taupe` border, `--paper` background, 16px text, padding 0 16px, 8px gap below a 13px uppercase tracked label (`--charcoal-2`). Focus: 2px gold outline. Textarea min-height 128px.
- **Eyebrow:** 13px, 500, uppercase, 0.18em tracking, `--antique-bronze`.
- **Photo placeholder** (until real photos arrive): `--royal-beige` block with a 1px `--soft-taupe` border, the hairline mark (B) at 40–56px centred, and a caption in eyebrow style, e.g. "Photo · three-bedroom lounge". Always set explicit `width`/`height` or `aspect-ratio` so swapping in a real image causes no layout shift.
- **Header:** 88px tall (68px mobile), canvas background, 1px `--soft-taupe` bottom border. Left: mark A at 44px + wordmark "CRYSTAL ROYAL APARTMENT" in Jost 500, 15px, 0.22em tracking. Centre: nav (Apartments, Three-bedroom, Two-bedroom, Location, Enquire). Right: secondary "WhatsApp us" + primary "Check availability". On mobile: mark + two-line wordmark (12px, 0.2em), a 44px WhatsApp icon button, and a 44px charcoal menu button that opens a full-width panel with the nav links stacked. Not sticky.
- **Footer:** `--royal-beige`, 1px gold top border. Four columns on desktop (brand block with mark + wordmark + one sentence; Apartments links; Visit address; Contact links), stacked on mobile. Bottom row: "© 2026 Crystal Royal Apartment. All rights reserved." and "Rates as of {ratesAsOf}, exclusive of applicable taxes."

## 5. Logo

Primary mark A (faceted), 200×200 viewBox. Use inline in the header and footer (so it scales crisply), and save as `/assets/mark-a.svg`.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" role="img" aria-label="Crystal Royal Apartment">
  <polygon points="56,78 56,44 78,62 100,30 122,62 144,44 144,78" fill="#C5A880"/>
  <rect x="56" y="78" width="88" height="12" fill="#7A5F3B"/>
  <g stroke="#7A5F3B" stroke-width="1.5" stroke-linejoin="round">
    <polygon points="76,100 124,100 136,124 64,124" fill="#D9D4C7"/>
    <polygon points="60,100 76,100 64,124 44,124" fill="#EBE5D9"/>
    <polygon points="124,100 140,100 156,124 136,124" fill="#EBE5D9"/>
    <polygon points="44,124 72,124 100,188" fill="#C5A880"/>
    <polygon points="72,124 100,124 100,188" fill="#B89C6E"/>
    <polygon points="100,124 128,124 100,188" fill="#A8905F"/>
    <polygon points="128,124 156,124 100,188" fill="#93784F"/>
  </g>
</svg>
```

Mark B (hairline, for placeholders and watermarks): the same silhouette drawn as a single gold line, `fill="none" stroke="#C5A880" stroke-width="2.5"`:
crown `56,78 56,44 78,62 100,30 122,62 144,44 144,78`; band line `56,90 → 144,90`; gem outline `60,100 140,100 156,124 100,188 44,124`; girdle `44,124 → 156,124`; facet lines `76,100 → 64,124`, `124,100 → 136,124`, `72,124 → 100,188`, `128,124 → 100,188`.

Mark C (solid, favicon): crown polygon, band rect at `y=80 h=10`, and gem outline polygon all filled `#2C2C2C`, with the girdle and four facet lines stroked in the background colour at width 3. For the favicon, omit the pavilion lines so it reads at 16px.

Wordmark: "CRYSTAL ROYAL" in Jost 400, uppercase, 0.22em tracking; "APARTMENT" beneath in Jost 500, 0.5em tracking, Antique Bronze, separated by a 1px gold rule. In the header use the single line "CRYSTAL ROYAL APARTMENT". Clear space around the mark equals the crown height. Never stretch, rotate, add shadows or gradients, or place over busy photography.

## 6. Pages and copy

Copy is final unless marked with square brackets. Keep sentence case and full stops. Do not add exclamation marks, emoji, testimonials or stock statistics.

### 6.1 Homepage (`/`)

**Hero** (centred, canvas background): hairline mark B at 40px; eyebrow "Serviced apartments · Karachi"; H1 "A royal address for unhurried stays."; paragraph (19px, `--charcoal-2`, max-width 680px): "Fully serviced two- and three-bedroom apartments, each with its own lounge, for families and travelling groups who want the privacy of a home with the standards of a fine hotel."; buttons: primary "Check availability" (→ `#enquire`), secondary "WhatsApp us" (→ WhatsApp link). Below: full-width photo slot, 2560×1240, caption "Photo · three-bedroom lounge in daylight".

**Apartments** (`#apartments`, canvas): eyebrow "Apartments"; H2 "Two ways to stay"; intro right-aligned on desktop: "Every apartment has its own lounge. Choose by the size of your party; we confirm occupancy and the exact rate before you arrive." Two equal cards (`--paper`, taupe border, photo slot 360px tall on top):

Card 1: H3 "Three-Bedroom Apartment with Lounge"; price "PKR 25,000" (Jost 400, 32px) with "per night, plus applicable taxes" beneath; list (hairline-separated): "Accommodates up to 6 guests as standard, with a maximum capacity of 8 guests" / "Each additional adult (guests 7 and 8): PKR 5,000 per night, plus applicable taxes" / "Three bedrooms, a lounge, [bathrooms and kitchen to confirm]"; primary button "See the apartment" → `/three-bedroom`.

Card 2: H3 "Two-Bedroom Apartment with Lounge"; price "PKR 17,000"; "per night, plus applicable taxes"; list: "Occupancy and availability should be confirmed directly with the property" / "Two bedrooms, a lounge, [bathrooms and kitchen to confirm]" / "Suited to smaller families and couples travelling together"; secondary button "See the apartment" → `/two-bedroom`.

**The idea** (royal-beige): eyebrow "The idea"; H2 "What royal means here"; intro: "Royal is a standard of care, not a style of decoration. It shows in space, quiet, precision and warmth, never in ornament." Four columns with a gold top hairline each: Composed, "Restraint in every surface. Nothing flashy, nothing loud." / Generous, "A lounge in every apartment and room for the whole family." / Attentive, "Details settled before arrival. Service that anticipates." / Rooted, "Karachi hospitality, held to an international standard."

**How it works** (canvas): eyebrow "How it works"; H2 "Three steps to a confirmed stay"; three `--paper` cards numbered 01, 02, 03 in Jost 300, 40px, gold (these are a real sequence):
01 "Tell us your dates and party": "Use the form below or message us on WhatsApp with your arrival, departure and the number of adults and children."
02 "We confirm in writing": "You receive the apartment, the occupancy and the exact rate, taxes included, before anything is booked. No payment is taken online."
03 "Arrive to a prepared home": "Check-in from {checkIn}, check-out by {checkOut}. Your lounge, bedrooms and kitchen are ready when you walk in."

**Location** (`#location`, royal-beige, two columns): eyebrow "Location"; H2 "{neighbourhood}, Karachi"; paragraph "[Two sentences on the neighbourhood: the character of the streets, and what guests reach on foot.]"; hairline list: "{minutesToAirport} minutes to Jinnah International Airport" / "{minutesToLandmark1} minutes to {landmark1}" / "{minutesToLandmark2} minutes to {landmark2}". Right: map slot (link to Google Maps in a new tab once the address is known; no embedded iframe until the client approves third-party embeds), caption "Map · {neighbourhood}, Karachi".

**Occupancy and rates band** (charcoal, `--on-dark` text, gold eyebrow "Occupancy and rates"). This wording is contractual. Reproduce it exactly, in two columns with gold top hairlines:

> **Three-Bedroom Apartment with Lounge — PKR 25,000 per night, plus applicable taxes**
> Accommodates up to 6 guests as standard, with a maximum capacity of 8 guests. Each additional adult (guests 7 and 8) is charged PKR 5,000 per night, plus applicable taxes.
>
> **Two-Bedroom Apartment with Lounge — PKR 17,000 per night, plus applicable taxes**
> Occupancy and availability should be confirmed directly with the property.

Footnote: "Rates as of {ratesAsOf} and subject to change. All rates exclude applicable taxes."

**Enquire** (`#enquire`, canvas, two columns 2:1): eyebrow "Enquire"; H2 "Check availability"; intro "Tell us your dates and party size. We confirm the apartment, occupancy and the exact rate, including taxes, before anything is booked."
Form fields (all with visible `<label for>`): Arrival (date, required), Departure (date, required), Adults (number, 1–8, default 2), Children (number, 0–6, default 0), Apartment (select: Three-Bedroom Apartment with Lounge / Two-Bedroom Apartment with Lounge / Not sure yet), Your name (text, required), Phone or WhatsApp (tel, required), Anything we should know (textarea). Submit button "Send enquiry". Note beneath: "No payment is taken online. We reply by WhatsApp or phone, usually within {replyTime}."
Right column card (`#contact`, royal-beige): eyebrow "Prefer to talk?"; H3 "Message or call us directly"; "For quick questions about dates, occupancy or the apartments, WhatsApp is fastest."; primary "WhatsApp us"; secondary "Call {phoneDisplay}" (`tel:` link); hairline; "{email}" (mailto) and "Replies [__]:00 to [__]:00, seven days a week".

### 6.2 Three-bedroom page (`/three-bedroom`)

- Breadcrumb: Home / Apartments / Three-bedroom with lounge.
- Eyebrow "Serviced apartment · Karachi"; H1 (Jost 300, 56px) "Three-Bedroom Apartment with Lounge"; lead "Accommodates up to 6 guests as standard, with a maximum capacity of 8 guests. Three bedrooms, a lounge of its own, and room for the whole family."; right-aligned price "PKR 25,000" + "per night, plus applicable taxes"; gold hairline beneath the whole block.
- Gallery: one large slot (2/3 width, 1600×1120, "Photo · the lounge") and two stacked slots (1/3 width, "Photo · master bedroom", "Photo · dining and kitchen"). On mobile: large slot, then the two side by side.
- Body, two columns 2:1 (stack on mobile with the enquiry card directly under the gallery):
  - "The apartment": H2 "Designed for six, with room for eight"; "The three-bedroom apartment is designed for six people: two adults and four children, or four adults and two children. A seventh and eighth guest can be accommodated; each additional adult is charged per night. Every stay is fully serviced, and the lounge is yours alone."; "[Two or three sentences on the character of the apartment: light, floor, outlook, finishes.]"
  - "Rooms" (hairline rows, name left, detail right): Bedroom one / Bedroom two / Bedroom three, each "[Bed size] · [en-suite or shared bathroom]"; Lounge, "Private to the apartment · [seating and television to confirm]"; Kitchen and dining, "[Equipment and seating to confirm]".
  - "Occupancy and nightly rate": H2 "What a night costs as the party grows"; three royal-beige tiles: "Standard · 6 guests — PKR 25,000 — per night, before tax" / "7 guests · one extra adult — PKR 30,000 — per night, before tax · 25,000 + 5,000" / "8 guests · two extra adults — PKR 35,000 — per night, before tax · 25,000 + 2 × 5,000". Footnote: "Each additional adult (guests 7 and 8) is charged PKR 5,000 per night, plus applicable taxes. [Children as guest 7 or 8: policy to be confirmed.] Rates as of {ratesAsOf} and subject to change."
  - "Good to know" (three hairline columns): Arrival and departure, "Check-in from {checkIn}. Check-out by {checkOut}. Early or late by arrangement." / Payment, "No payment is taken online. The rate is confirmed in writing, taxes included, before you commit." / House rules, "[Smoking, visitors, parking and quiet hours to confirm.]"
  - Enquiry card (`--paper`, gold border): "PKR 25,000 per night" + "plus applicable taxes · up to 6 guests as standard"; fields Arrival, Departure, Adults (default 2), Children (default 4), Phone or WhatsApp; primary "Check availability"; secondary "WhatsApp us instead"; note "6 guests: PKR 25,000 · 7 guests: PKR 30,000 · 8 guests: PKR 35,000, per night before tax." and "We confirm occupancy and the exact rate in writing, usually within {replyTime}. No payment is taken online." The form pre-selects this apartment.
- Charcoal band "Also available": "Two-Bedroom Apartment with Lounge — PKR 17,000 per night, plus applicable taxes" / "Occupancy and availability should be confirmed directly with the property." / secondary button "See the apartment" → `/two-bedroom`.

### 6.3 Two-bedroom page (`/two-bedroom`)

Same template as the three-bedroom page with: H1 "Two-Bedroom Apartment with Lounge"; price "PKR 17,000"; lead "Two bedrooms and a lounge of its own, for smaller families and couples travelling together. Occupancy and availability should be confirmed directly with the property."; Rooms: Bedroom one, Bedroom two, Lounge, Kitchen and dining (same placeholders); no rate ladder: instead a single royal-beige tile "PKR 17,000 — per night, before tax" and the line "Standard and maximum occupancy for this apartment are confirmed directly with the property. [Occupancy to be confirmed.]"; enquiry card defaults Adults 2, Children 0, apartment pre-selected; "Also available" band points to the three-bedroom page.

## 7. Behaviour

- **WhatsApp link:** `https://wa.me/{whatsappNumber}?text=` + URL-encoded "Hello Crystal Royal Apartment, I would like to enquire about a stay." Open in a new tab. Use a generic chat-bubble icon drawn as inline stroke SVG; the client may later substitute the official icon under WhatsApp's brand terms.
- **Enquiry form:** on submit, prevent default, validate natively (required fields, departure after arrival), then build this message and open `wa.me` with it:
  `Enquiry: {apartment}. Arrival {YYYY-MM-DD}, departure {YYYY-MM-DD}, {adults} adults, {children} children. Name: {name}. Phone: {phone}. Note: {message}`.
  If `SITE.formEndpoint` is set, also POST the fields as JSON to it (fetch, with a loading state on the button and an inline success or error message; never alert()). Show an inline confirmation: "Your enquiry is ready in WhatsApp. If it did not open, message us at {phoneDisplay}." Keep the form values on error.
- **Mobile menu:** a real `<button aria-expanded>` toggling a panel; close on Escape and on link click; focus returns to the button.
- **Anchors:** header links scroll to `#apartments`, `#location`, `#enquire`; `scroll-behavior: smooth` unless reduced motion.
- No cookie banner, no chat widget, no pop-ups, no third-party scripts in v1. Analytics only if the client supplies a tag, loaded `defer`.

## 8. SEO and metadata

- Unique `<title>` and `<meta name="description">` per page:
  - Home: "Crystal Royal Apartment — Serviced apartments with lounges in Karachi" / "Fully serviced two- and three-bedroom apartments, each with its own lounge, in {neighbourhood}, Karachi. Check availability by WhatsApp or enquiry form."
  - Three-bedroom: "Three-Bedroom Apartment with Lounge — Crystal Royal Apartment, Karachi" / "Sleeps 6 as standard, up to 8. PKR 25,000 per night plus taxes; each additional adult PKR 5,000 per night. Serviced apartment in {neighbourhood}, Karachi."
  - Two-bedroom: "Two-Bedroom Apartment with Lounge — Crystal Royal Apartment, Karachi" / "Serviced two-bedroom apartment with lounge in {neighbourhood}, Karachi. PKR 17,000 per night plus taxes. Occupancy confirmed directly with the property."
- Open Graph and Twitter card tags on every page; `og:image` 1200×630 generated from the stacked lockup on charcoal until photography exists.
- One `<h1>` per page; landmarks `<header> <nav> <main> <footer>`; skip-to-content link.
- JSON-LD on the homepage: `LodgingBusiness` (name, address with `addressLocality: "Karachi"`, `addressCountry: "PK"`, telephone, url) and two `Accommodation` entries with `occupancy` (three-bedroom: value 6, maxValue 8) and `priceRange "PKR 17,000–25,000 per night"`.
- `sitemap.xml` with the three URLs; `robots.txt` allowing all; canonical on each page.
- `lang="en"`. Add `hreflang` only if an Urdu version is built later.

## 9. Performance and accessibility

- Target Lighthouse ≥ 95 on all four categories for every page.
- Images: AVIF/WebP with JPEG fallback, explicit `width`/`height`, `loading="lazy"` below the fold, `fetchpriority="high"` on the hero image once a real photo exists.
- Fonts: preconnect, `display=swap`; no other external resources.
- Total JavaScript under 10 KB; CSS under 30 KB.
- Keyboard operable throughout; visible focus states (2px gold outline); touch targets ≥ 44px; colour never the only carrier of meaning; `alt` text on real photos ("The lounge of the three-bedroom apartment, daylight"), `alt=""` on decorative marks.
- No horizontal scroll at 320px; test at 320, 390, 768, 1024, 1440.

## 10. Definition of done

- [ ] Three pages render with the copy above and the exact rates wording; placeholders still in brackets are listed in the final report.
- [ ] Shared header, footer and enquiry section are identical across pages.
- [ ] Enquiry form opens a correctly formed WhatsApp message with the sample input "arrive 2026-11-02, depart 2026-11-05, 2 adults, 4 children, Three-Bedroom"; validation blocks departure before arrival.
- [ ] Mobile menu opens, closes with Escape, and returns focus.
- [ ] Lighthouse ≥ 95 ×4 on each page (report the numbers you measured).
- [ ] No gradients, shadows or rounded corners anywhere; all colours come from the tokens.
- [ ] Deployed to a preview URL on free-tier hosting, with build settings documented.
- [ ] Final report lists: the preview URL, the placeholder values still needed, and anything you had to decide that this brief did not cover.

## 11. Facts you must not change

- Three-bedroom: PKR 25,000 per night; 6 guests as standard; maximum 8; each additional adult (guests 7 and 8) PKR 5,000 per night; all plus applicable taxes. Worked totals before tax: 6 guests 25,000; 7 guests 30,000; 8 guests 35,000.
- Two-bedroom: PKR 17,000 per night plus applicable taxes; occupancy and availability confirmed directly with the property.
- Standard six may be two adults and four children, or four adults and two children.
- Rates as of October 2026, subject to change; the booking page (this website's enquiry flow) is the source of truth.
- Open items the client still has to confirm: whether a child as guest 7 or 8 pays the adult rate; two-bedroom occupancy; address, neighbourhood, phone, email, domain; bed sizes and bathrooms; kitchen equipment; check-in and check-out times; reply time; house rules; photographs.
