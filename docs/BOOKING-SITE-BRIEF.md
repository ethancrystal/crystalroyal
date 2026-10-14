# Crystal Royal Apartment — luxury per-night booking site
## Two prompts: design first (Claude Design), then build (Claude Code)

**Version 3 · 13 October 2026.** Changed from v2: the approved visual direction is **"Two stones, one gold line"** (Lapis for the three-bedroom, Jade for the two-bedroom), built strictly inside the brand guidelines deck (Jost and DM Sans, beige canvas, charcoal, gold hairlines, sharp corners, no gradients, shadows or glows). The earlier midnight-and-serif direction is withdrawn. A full copy deck is now part of Prompt 1, with alternatives for the lines that matter most. Prompt 2 carries the stone tokens and a per-type theme mechanism.

**Attach with the prompts**
- `Crystal_Royal_Apartment___Brand_Guidelines.pdf` (Edition 01). Where this file and the deck disagree, the deck wins, except for the two stones, which this file adds.
- `crystal-royal-mark-A-faceted.svg` (the final mark).
- The three reference boards from the design canvas: "Direction v2", "v2 Homepage" (desktop and mobile) and "v2 Three-bedroom page". Match them.

**How to use this file**
1. Fill the **Config block** (section 0) as far as you can. Anything left in `[brackets]` stays visible as a placeholder in the design and in the code, so nothing is silently invented.
2. Copy section 0 plus **Prompt 1** into Claude Design with the attachments above. Comment on the canvas, iterate, approve.
3. Copy section 0 plus **Prompt 2** into Claude Code in an empty repository, attach the approved design (canvas link or one PNG per artboard), and say "build this".
4. Each prompt repeats the facts it needs, so each works alone. Section 0 is the only place a number should be changed.

---

## 0. Config block (shared by both prompts)

```js
export const SITE = {
  name: "Crystal Royal Apartment",
  shortName: "Crystal Royal",
  tagline: "A royal address for unhurried stays.",
  domain: "[crystalroyalapartment.com]",
  city: "Karachi, Pakistan",
  neighbourhood: "[Neighbourhood]",
  addressLine: "[Street address]",
  mapsUrl: "[Google Maps link]",
  whatsappNumber: "[92XXXXXXXXXX]",        // digits only, country code first, no plus
  phoneDisplay: "[+92 XXX XXXXXXX]",
  email: "[reservations@crystalroyalapartment.com]",
  ownerNotifyEmail: "[owner@crystalroyalapartment.com]",   // receives new-reservation and receipt alerts
  timezone: "Asia/Karachi",                // every date and deadline is in Karachi time (PKT)
  locale: "en-PK",
  currency: "PKR",                         // whole rupees, no paisa; format "PKR 25,000"
  checkIn: "[15:00]",
  checkOut: "[11:00]",
  taxRatePercent: "[__]",                  // e.g. Sindh Sales Tax on services; confirm with the accountant
  taxLabel: "[Applicable taxes]",
  paymentHoldHours: 12,                    // reserved dates are held this long for the bank transfer
  confirmWithinHours: "[__]",              // the promise on the payment page: "usually within __ hours"
  depositPolicy: "full",                   // "full" = whole stay to confirm; "50" = 50% deposit now, balance at check-in
  freeCancellationDays: "[__]",            // days before arrival for free cancellation; 0 = non-refundable
  cancellationText: "[Free cancellation up to __ days before arrival. After that, the amount paid is retained.]",
  minNights: 1,
  maxNights: 30,
  childMaxAge: "[12]",                     // a guest this age or younger counts as a child
  idAtCheckIn: "A valid CNIC or passport for each adult is shown at check-in. It is not collected online.",
  bank: {
    bankName: "Meezan Bank Limited",
    accountTitle: "[Crystal Royal Apartment]",
    accountNumber: "[__________]",
    iban: "[PK__ MEZN ____ ____ ____ ____]",
    branch: "[Branch name and code]",
    swift: "[MEZNPKKA — confirm]",
    raastId: "[optional Raast ID or mobile number]"
  },
  apartmentTypes: [
    {
      slug: "three-bedroom",
      name: "Three-Bedroom Apartment with Lounge",
      shortName: "3-bed lounge",            // internal and admin label only
      stone: "lapis",                       // its colour world: Lapis
      unitCount: "[__]",                    // how many physical apartments of this type
      unitNames: ["[e.g. 3A]", "[3B]"],     // one per unit; shown only in admin
      nightlyRate: 25000,
      standardGuests: 6,
      maxGuests: 8,
      extraAdultPerNight: 5000,             // guests 7 and 8
      childAsExtraGuestPolicy: "[same_as_adult | reduced PKR __ | free]",
      bedrooms: 3, lounges: 1,
      bathrooms: "[__]",
      bedConfiguration: "[e.g. 1 king, 1 queen, 2 singles]",
      sizeSqFt: "[__]",
      highlights: ["[e.g. Dining for eight]", "[Fully fitted kitchen]", "[Two balconies]"]
    },
    {
      slug: "two-bedroom",
      name: "Two-Bedroom Apartment with Lounge",
      shortName: "2-bed lounge",
      stone: "jade",                        // its colour world: Jade
      unitCount: "[__]",
      unitNames: ["[e.g. 2A]"],
      nightlyRate: 17000,
      standardGuests: "[__]",
      maxGuests: "[__]",
      extraAdultPerNight: "[__ or none]",
      childAsExtraGuestPolicy: "[__]",
      bedrooms: 2, lounges: 1,
      bathrooms: "[__]",
      bedConfiguration: "[__]",
      sizeSqFt: "[__]",
      highlights: ["[__]", "[__]", "[__]"]
    }
  ],
  // Sample amenities. The client confirms the list and prices; keep the pricing types.
  amenities: [
    { slug: "airport-transfer",   name: "Airport transfer",        pricing: "per_trip",            price: "[PKR __]", maxQuantity: 4 },
    { slug: "breakfast",          name: "Breakfast for the party", pricing: "per_guest_per_night", price: "[PKR __]", maxQuantity: 1 },
    { slug: "housekeeping-daily", name: "Daily housekeeping",      pricing: "per_night",           price: "[PKR __ or included]", maxQuantity: 1 },
    { slug: "early-check-in",     name: "Early check-in",          pricing: "per_stay",            price: "[PKR __]", maxQuantity: 1 },
    { slug: "late-check-out",     name: "Late check-out",          pricing: "per_stay",            price: "[PKR __]", maxQuantity: 1 },
    { slug: "extra-bedding",      name: "Extra bedding or cot",    pricing: "per_night",           price: "[PKR __]", maxQuantity: 2 },
    { slug: "grocery-prestock",   name: "Kitchen pre-stocked",     pricing: "per_stay",            price: "[PKR __]", maxQuantity: 1 },
    { slug: "driver-on-call",     name: "Driver on call",          pricing: "per_day",             price: "[PKR __]", maxQuantity: 30 }
  ],
  houseRules: ["[Quiet hours __ to __]", "[No smoking indoors]", "[No parties or events]", "[Occupancy as reserved]", "[__]"],
  ratesAsOf: "October 2026"
};
```

**Shared vocabulary.** Use these words, exactly, in the design, the code and the copy.
- **Apartment type** — one of the two categories a guest chooses: the *Three-Bedroom Apartment with Lounge* ("3-bed lounge") and the *Two-Bedroom Apartment with Lounge* ("2-bed lounge"). Guests always see the full name; the short name is for admin screens only.
- **Stone** — the colour world of an apartment type: **Lapis** (deep blue) for the three-bedroom, **Jade** (deep green) for the two-bedroom. A stone is a ground, never a text colour.
- **Unit** — one physical apartment of a type (3-bed lounge, unit 3A). The guest chooses a type and dates; the property assigns the unit. Unit counts and names come from the config. Guests never see unit counts, "only 1 left" or any scarcity device.
- **Stay** — from the check-in date to the check-out date. Nights = check-out minus check-in. The check-out day is not charged, and another stay may begin that same day.
- **Reservation** — a stay held or confirmed on one unit, with the reference `CRA-YYMM-NNNN` (year, month, running number that month).
- **Hold** — the window after reserving in which the guest makes the bank transfer. It ends automatically.
- **Receipt** — the guest's proof of transfer (image or PDF). **Verification** — the property confirming the money arrived, which confirms the reservation.
- **Party** — adults plus children. **Standard occupancy** and **maximum occupancy** belong to the type; each guest above standard pays the extra-adult fee per night, subject to the child policy.
- **Folio** — the reservation summary that stays beside the guest through the flow, in the type's stone.

**Facts that must not change (both prompts):**
- Two apartment types, each with one or more units (counts in the config). Guests reserve a type, never a specific unit.
- Three-bedroom: PKR 25,000 per night; 6 guests as standard; maximum 8; each additional adult (guests 7 and 8) PKR 5,000 per night; all plus applicable taxes. Worked totals before tax: 6 guests 25,000 · 7 guests 30,000 · 8 guests 35,000 per night.
- Two-bedroom: PKR 17,000 per night plus applicable taxes; occupancy and availability confirmed directly with the property until the config says otherwise.
- The standard six may be two adults and four children, or four adults and two children.
- Guests pay by bank transfer to the Meezan Bank account shown on the payment page. No card gateway in v1. A reservation is confirmed only after the property verifies the transfer.
- Rates as of October 2026, subject to change. The website is the source of truth for rates once live.
- Every date, deadline and time shown anywhere is Karachi time (PKT).

---

# PROMPT 1 — for Claude Design

You are the design lead for **Crystal Royal Apartment**, a new luxury serviced-apartment address in Karachi. It offers two apartment types by the night, the *Three-Bedroom Apartment with Lounge* and the *Two-Bedroom Apartment with Lounge*, with one or more units of each. Guests choose a type and dates; the property assigns the unit. Likely guests are families and small groups visiting for weddings and family occasions, and longer business stays. The brand guidelines deck (attached) is the source of truth for the mark, palette, type and rules; this brief adds two stones and three layout devices that were approved on the reference boards (attached). Your job is to carry all of it into a complete website and booking experience, desktop and mobile, ending with a bank transfer to the property's Meezan Bank account, that a family can complete on a phone in three minutes.

Read the config block and the shared vocabulary first. Use the config's words and numbers everywhere; show `[placeholders]` as written.

## What good looks like
The restraint of the best hospitality sites: one idea per screen, wide margins, typography doing the work, photography given room, and a single action at any moment. Reserving should feel like being attended to, not like checking out. Three tests every screen must pass:
1. Above the fold on the home page there are at most 40 words and one button.
2. Every screen still reads correctly with all photographs removed.
3. A first-time guest can find the nightly price for 7 guests without a calculator.

## Positioning and tone
- Line: *A royal address for unhurried stays.*
- Royal means a standard of care, not a style of decoration. Composed, generous, attentive, rooted (the deck's four words).
- Concierge language, never e-commerce language. Say "Reserve your stay", "Your stay", "At your service", "Settle by transfer". Never "Book now", "Deal", "From PKR", "Hurry", "Only 1 left", countdown timers, urgency banners, pop-ups, star ratings, testimonials or "trusted by" badges.
- Sentence case, full stops, no exclamation marks, no emoji, no questions in headlines, no puns.
- Say: guests, apartment, lounge, stay, home, family. Avoid: units (to guests), pax, deal, cheapest, hurry, limited offer.
- Numbers: "PKR 25,000", "6 guests", "3 nights", "15:00". Dates as "Tuesday 3 November".

## Aesthetic direction: "Two stones, one gold line"
Crystal Royal, read literally. Each apartment type is a stone. Gold stays a hairline. Beige stays the canvas. Royal is the crown at the seam, nothing more.

- **Grounds.** *Canvas* `#F4F1EA` with panels in Royal Beige `#EBE5D9` for every reading surface. *Lapis* for the three-bedroom: ground `#0E1B35`, panels and plates `#16294F`, facet highlight `#24407A`. *Jade* for the two-bedroom: ground `#0C2622`, panels and plates `#163A34`, facet highlight `#245A51`. *Charcoal* `#2C2C2C` for the footer and for buttons on canvas. Never a mid-grey, never a third stone.
- **Where each stone appears.** Lapis: the three-bedroom panel of the diptych, its apartment page band, its folio, its payment spine and confirmation. Jade: the same for the two-bedroom. The two stones meet only on the home-page diptych, joined by one gold seam. On canvas a stone appears only as a 3px marker bar beside the type's name (rates plate, admin). A stone is never a text colour.
- **Gold.** Royal Gold `#C5A880` for hairlines, rules, the crown, large numerals and amounts on a stone. On canvas, small gold-toned text uses Antique Bronze `#7A5F3B` (gold fails contrast there). Gold is a line or a numeral, never a fill, except the hover state of a button on a stone.
- **Text.** Charcoal `#2C2C2C` on canvas, secondary `#595959`. On a stone: beige `#F4F1EA`, secondary `#C9C3B6`.
- **Semantic colours**, each always paired with a word: confirmed `#3F7A5A`, awaiting `#B4862B`, problem `#9E3B3B`.
- **Type.** Display: *Jost Light 300*. Headings: *Jost Medium 500*. Body and captions: *DM Sans 400 and 500*. Fallbacks Trebuchet MS and Verdana. Never a serif, never a script face, never a third family, never an icon font.
- **Geometry.** Sharp corners everywhere, radius 0. Depth from flat tinted panels and 1px hairlines only; no drop shadows; no gradients; no glows; no bevels. The crystal motif is a flat faceted gem drawn in the stone's three tints with gold hairlines (the reference boards show it), cropped at a panel's outer corner.
- **Motion.** Fades and short rises, 200 to 300 ms, ease-out, as the deck says. One ceremonial exception: on first load the gold seam and the hairline under the headline draw themselves once (600 ms). No parallax, no scroll-jacking, no auto-playing carousels, no moving light. Reduced-motion users get none of it and lose nothing.
- **Imagery.** Daylight or dusk photography of the real apartments, uncluttered rooms, sharp-cornered crops. Ratios: diptych plate 12:5, gallery 4:3, mobile 3:4. Until the client supplies photographs, use labelled placeholder plates ("Photo · 3-bed lounge at dusk · 1440 × 600") in the panel's tint. No stock interiors of other properties.
- **Icons.** None as a system. Where a glyph is unavoidable (copy, upload, menu, close), draw it as a 1px hairline on a 20px grid in the text colour.
- **Brand mark.** The final crown-diamond, variant A faceted, from the attached SVG (200 × 200 viewBox: crown polygon `56,78 56,44 78,62 100,30 122,62 144,44 144,78` fill `#C5A880`; band rect `x=56 y=78 w=88 h=12` fill `#7A5F3B`; gem facets with `#7A5F3B` 1.5px strokes: table `76,100 124,100 136,124 64,124` fill `#D9D4C7`; left `60,100 76,100 64,124 44,124` and right `124,100 140,100 156,124 136,124` fill `#EBE5D9`; pavilion `44,124 72,124 100,188` `#C5A880`, `72,124 100,124 100,188` `#B89C6E`, `100,124 128,124 100,188` `#A8905F`, `128,124 156,124 100,188` `#93784F`). On a stone it keeps its colours. The hairline variant (one gold line) marks the seam and the folio. Wordmark "CRYSTAL ROYAL APARTMENT" in Jost 500, 0.26em tracking, centred under the mark in the header. Clear space equal to the crown's height on every side.

## Three layout devices
These are what make the site its own. Follow the reference boards.
1. **The diptych (home).** After a slim centred masthead (nav split left and right of the mark) and the centred statement, the viewport splits into two tall panels of equal weight: Lapis on the left for the three-bedroom, Jade on the right for the two-bedroom, joined by one 1px gold seam with the hairline crown sitting on it at the top, in a small canvas square. Each panel: eyebrow with the full type name, a Jost 300 headline, the facts line, the rate in gold numerals, "Reserve" (gold hairline button) and "See the apartment" (underlined link), and a photo plate in the panel's tint along the bottom, with the faceted crystal cropped at the outer corner. On mobile the panels stack, the seam becomes a horizontal hairline with the crown centred on it.
2. **The stone world (apartment pages).** The page belongs to its stone: a stone band at the top (eyebrow, headline, facts strip with gold rules), canvas for the gallery and reading, and the **folio** in the same stone pinned beside the content on desktop (sticky), placed under the gallery on mobile.
3. **The folio (reserve, payment, status).** A hotel-register feel. The stay summary lives in a stone spine on the left (desktop) that never scrolls away: the hairline crown, the type name, ledger fields for dates and party, the running breakdown, the total in gold. The steps and the payment page unfold on canvas to the right. Fields everywhere are **ledger fields**: a tracked-capitals label and one hairline beneath, no boxes (charcoal hairline on canvas, gold hairline on a stone). On a phone the spine becomes a bar at the top showing the total, expanding to the breakdown; the primary action sits in a sticky bottom bar in the stone.

## Layout, type and spacing
- **Desktop artboards 1440 wide.** Content column 1280, 12 columns, 24px gutters, 80px side margins; the diptych and stone bands run edge to edge. Section padding 96px top and bottom. Reading measure 560 to 640px.
- **Mobile artboards 390 wide.** 4 columns, 16px gutters, 20px side margins. Section padding 64px. Tap targets at least 44px.
- **Spacing scale** 4, 8, 12, 16, 24, 32, 48, 64, 96, 120.
- **Type scale (desktop / mobile).** Display: Jost 300, 64/1.06 / 40/1.06, the statement and page titles. Display L: Jost 300, 44 / 32, panel and section headlines. H2: Jost 300, 36 / 30. H3: Jost 500, 20 / 18. Body: DM Sans 400, 17/1.6 / 16/1.6. Small: DM Sans 400, 14/1.5 and 13. Eyebrow: DM Sans 500, 12 (11 mobile), uppercase, 0.18em tracking. Numerals: Jost 500, tabular, 30 / 26 for rates, 48 / 36 for the step numerals in bronze, 56 / 40 for the amount due in gold on a stone. Admin body 14/1.5.
- **Buttons.** 52px tall, 24 to 28px side padding, Jost 500 15px, 0.04em tracking, sentence case. On canvas: charcoal fill, beige text; hover adds a gold hairline underneath. On a stone: 1px gold hairline, beige text; hover fills gold with the stone-deep text. Secondary: an underlined link, gold underline, 6px offset. Never two primaries on one screen.
- **Ledger fields.** 48px tall (44 inside the folio), label above in eyebrow style, helper or error text below in Small; focus: 2px gold outline, 2px offset. Steppers: minus, count in Jost 500 18px, plus, inside a hairline.

## Copy deck
Use the copy below verbatim. Where alternatives are given, use the first unless the client picks another; keep the rest out of the design. Placeholders render as written.

**Masthead and footer**
- Navigation: "Apartments" · "At your service" · "How it works" · "Location" · "WhatsApp" · button "Reserve a stay". Mobile: menu button "Menu", link "Reserve".
- Footer: name and address line; "WhatsApp [+92 XXX XXXXXXX]" · "[reservations@crystalroyalapartment.com]" · "Replies within [__] hours, seven days a week"; "Check-in from [15:00] · Check-out by [11:00]"; "Payments by bank transfer to Meezan Bank. We never ask for card details."; links "House rules · Privacy · Terms"; "© 2026 Crystal Royal Apartment, Karachi" · "Rates as of October 2026, subject to change."

**Home**
- Eyebrow: "Serviced apartments · Karachi".
- Statement (H1): "A royal address for unhurried stays." — the brand line, not negotiable.
- Sub-line: "Two- and three-bedroom apartments with lounges, fully serviced and reserved by the night." Alternatives: "Fully serviced apartments, each with its own lounge, reserved by the night." / "The privacy of a home, the standards of a fine hotel, reserved by the night."
- Diptych, three-bedroom: eyebrow "Three-Bedroom Apartment with Lounge"; headline "Three bedrooms, a lounge, and room to breathe." (alternatives: "Room for the whole family, and then some." / "Six as standard, eight at most, all at home."); facts "3 bedrooms · 1 lounge · Sleeps 6 as standard, up to 8 · [__] bathrooms"; rate "PKR 25,000" + "per night, plus applicable taxes"; buttons "Reserve" and "See the apartment".
- Diptych, two-bedroom: eyebrow "Two-Bedroom Apartment with Lounge"; headline "Two bedrooms, a lounge, your Karachi home." (alternatives: "Quieter, closer, still a lounge of your own." / "Two bedrooms and a lounge, kept for you."); facts "2 bedrooms · 1 lounge · Occupancy confirmed with the property · [__] bathrooms"; rate "PKR 17,000" + "per night, plus applicable taxes".
- Availability ledger: H2 "Check availability"; note "Reserve online, then settle by bank transfer to our Meezan Bank account. No card details are ever requested."; fields Arrival · Departure · Adults · Children · Apartment (Any / Three-bedroom / Two-bedroom); button "Check availability".
- How reserving works: eyebrow "How reserving works"; H2 "Four unhurried steps, and your dates are held."; 01 "Choose your dates" — "See what is free for the apartment you prefer, for the whole party." · 02 "Add what you need" — "An airport transfer, breakfast, an early arrival. Or nothing at all." · 03 "Reserve" — "We hold your dates for [12] hours while you make the transfer." · 04 "Settle by transfer" — "Pay to our Meezan Bank account and send us the receipt. We confirm once it arrives, usually within [__] hours."
- At your service: eyebrow "At your service"; H2 "Add what you need when you reserve."; sub "Or ask us at any time during your stay. Prices are shown before you confirm."; rows: amenity name + "PKR [__] per trip / per guest, per night / per stay / per night / per day" or "[Included]".
- Location: eyebrow "Where you will find us"; H2 "[Neighbourhood], Karachi."; address; rows "Jinnah International Airport — [__] minutes", "[Landmark or business district] — [__] minutes", "[Shopping and dining] — [__] minutes"; link "Get directions".
- Rates plate (verbatim, on the home page and both apartment pages): **Three-Bedroom Apartment with Lounge — PKR 25,000 per night, plus applicable taxes.** Accommodates up to 6 guests as standard, with a maximum capacity of 8 guests. Each additional adult (guests 7 and 8) is charged PKR 5,000 per night, plus applicable taxes. **Two-Bedroom Apartment with Lounge — PKR 17,000 per night, plus applicable taxes.** Occupancy and availability should be confirmed directly with the property. Footer line: "Rates as of October 2026, subject to change. Standard occupancy of six may be two adults and four children, or four adults and two children."

**Availability results**
- Eyebrow with the search: "3 nights · 2 to 5 November · 2 adults, 4 children" and link "Edit".
- Available: "PKR 25,000 per night · PKR 75,000 for 3 nights, plus applicable taxes" (+ "Includes 1 additional adult at PKR 5,000 per night" when it applies); button "Reserve".
- Not available: "Not available for these dates." + "Free from Friday 6 November." + link "See the apartment".
- Party too large: "This apartment accommodates up to 8 guests. For a larger party, write to us and we will suggest an arrangement."

**Apartment page (three-bedroom; the two-bedroom reuses it)**
- Eyebrow "Apartments · Three-Bedroom Apartment with Lounge"; H1 "Three bedrooms, a lounge, and room to breathe."; facts strip "3 bedrooms · 1 lounge · Sleeps 6 as standard, up to 8 · [__] bathrooms · [__] sq ft · Check-in from [15:00] · Check-out by [11:00]".
- Sections: "The apartment" (description placeholder: "[Two or three sentences by the property: the lounge, the light, the dining table for the whole family, the kitchen, the quiet.]" and "Daily housekeeping, fresh linen and towels, and a host on call during your stay."); "The rooms" (Bedroom one — [King bed] · [en-suite]; Bedroom two — [Queen bed]; Bedroom three — [Two single beds]; Lounge — Seating for the whole party · [television]; Dining and kitchen — [Dining for eight] · [fully fitted kitchen]); "Availability" (legend "Available · Selected · Unavailable", note "Tap a night for arrival and another for departure. Stays are from [1] to [30] nights. Every date is Karachi time."); "Rates for this apartment" ("6 guests · standard — PKR 25,000", "7 guests · one additional adult — PKR 30,000", "8 guests · two additional adults — PKR 35,000", each "per night, plus applicable taxes"); "House rules" (from the config, plus "Occupancy as reserved; a valid CNIC or passport is shown at check-in.").
- Folio: eyebrow "Your stay"; type name; ledger fields Arrival, Departure; steppers Adults, Children; lines "3 nights × PKR 25,000 — PKR 75,000", "Additional adults — None · 6 guests", "Applicable taxes — Shown at review", total "Your stay — PKR 75,000"; button "Reserve this stay"; notes "No payment is taken online. Pay by bank transfer after reserving; we hold your dates for [12] hours." and "Guests 7 and 8 are charged PKR 5,000 per adult per night."

**Reserve flow** (header "Reserve · Three-Bedroom Apartment with Lounge"; steps "1 Dates and guests · 2 At your service · 3 Your details · 4 Review")
- Step 1: "Guests 7 and 8 are charged PKR 5,000 per adult per night." appears past six; at eight: "This apartment accommodates up to 8 guests."; min-stay hint "Stays are from [1] to [30] nights."; "Continue".
- Step 2: card copy = amenity name, one line each ("A driver meets you at arrivals and brings you to the door." for the airport transfer; "Served in the apartment at the hour you choose." for breakfast; "Arrive from [__]:00 instead of [15:00]." for early check-in; "Leave by [__]:00 instead of [11:00]." for late check-out; "A cot or an extra bed made up before you arrive." for bedding; "Essentials and your list, in the kitchen before you arrive." for the pre-stock; "A car and driver for the day, at your call." for the driver; "Every day of your stay, at a time that suits you." for housekeeping), price with its type in words; "Add" / quantity stepper; "Continue" and "Skip for now".
- Step 3: fields "Full name", "Mobile number (WhatsApp)", "Email", "Expected arrival time", "Anything we should know?" (optional); checkbox "I have read the house rules and understand that a valid CNIC or passport is shown at check-in."; privacy line "We use your details only to manage your stay."; "Continue".
- Step 4: H2 "Review your reservation"; "Change" links; hold line "We hold these dates for [12] hours while you make the transfer."; cancellation text from the config; button "Reserve and continue to payment".

**Payment page** (folio spine in the type's stone; main column on canvas)
- Eyebrow "Reservation CRA-2611-0042"; H2 "Settle your stay by bank transfer" (alternative: "Your dates are held. Settle by transfer to confirm."); amount in gold numerals in the spine with caption "Due now" or "Total".
- Bank card (a beige plate with a gold hairline frame): "Meezan Bank Limited"; rows Account title · Account number · IBAN · Branch · SWIFT · Raast ID (optional), each with "Copy" and a "Copied" state; "Copy all details".
- Instructions: "1 Transfer the exact amount from any bank or through Raast." · "2 Put your reservation reference in the payment note." · "3 Upload the receipt below, or send it on WhatsApp." · "4 We confirm once the transfer arrives, usually within [__] hours."
- Hold line: "Your dates are held until Tuesday 3 November, 09:40 PKT." (a quiet line, never a timer).
- Upload: "Upload your transfer receipt" · "JPG, PNG or PDF up to 10 MB" · done "Receipt received. We will confirm shortly." · link "Send the receipt on WhatsApp instead".
- What happens next: "We match your transfer to the reference." · "You receive a confirmation by email." · "Your voucher and directions are ready on your reservation page." · "Need help? WhatsApp us."

**Status page** · "Your stay" · timeline "Reserved → Receipt received → Confirmed → Checked in" · "Upload receipt" (while Reserved) · "Request cancellation" · "Need help? WhatsApp us". Variants "Hold ended" and "Cancelled".

**Confirmation** · "Your stay is confirmed." · "We look forward to welcoming you on Tuesday 3 November from 15:00." · buttons "Add to calendar" · "Get directions" · "Print voucher" · "Before you arrive" (ID at check-in, arrival time, how to reach us) · house rules. Voucher: one A4 page, ivory, mark, reference, stay, amount paid, address.

**Status words** (always with the colour): "Reserved" (awaiting) · "Receipt received" (awaiting) · "Confirmed" (confirmed) · "Checked in" (confirmed) · "Completed" (neutral) · "Hold ended" (problem) · "Cancelled" (problem).

**Errors and empty states**: "These dates are not available for the three-bedroom apartment. The nearest available stays are below." · "This apartment accommodates up to 8 guests. For a larger party, write to us and we will suggest an arrangement." · "Your hold has ended. The dates may still be free; reserve again to hold them." · "We could not match this receipt to a transfer. [Reason]. Upload a clearer copy, or send it on WhatsApp." · "Enter a mobile number we can reach on WhatsApp." · "Departure must be after arrival." · "Stays are from [1] to [30] nights." · "We could not upload the file. Check your connection and try again, or send it on WhatsApp."

**Email subjects**: "Your reservation CRA-2611-0042 — payment instructions" · "Your dates are held until 09:40 PKT tomorrow" · "We have your receipt" · "Receipt uploaded: CRA-2611-0042, PKR 105,000" (owner) · "Your stay is confirmed — 2 to 5 November" · "Receipt not matched — CRA-2611-0042" · "Your hold on 2 to 5 November has ended" · "Reservation CRA-2611-0042 cancelled" · "New reservation: CRA-2611-0042" (owner).

**Meta**: home title "Crystal Royal Apartment — Serviced apartments in Karachi, reserved by the night"; description "Fully serviced two- and three-bedroom apartments with lounges in [Neighbourhood], Karachi. Reserve online and settle by bank transfer. PKR 17,000 and PKR 25,000 per night, plus applicable taxes."; apartment title "Three-Bedroom Apartment with Lounge — Crystal Royal Apartment, Karachi".

## Artboards
Desktop (D) and mobile (M) for every guest screen; admin at desktop only; emails at 600px. Name every artboard as numbered ("03 Apartment · D"). Rows: Guest site · Reserve flow · Payment and status · Admin · Emails · Components and tokens. Link screens into a clickable prototype where arrows are drawn (→).

**Guest site**
1. **Home (D, M).** As the reference board: masthead, statement, the diptych, the availability ledger (→ 2), how reserving works, at your service, location, the rates plate, footer. Mobile adds a sticky bottom bar "Two apartments, by the night · Check availability".
2. **Availability results (D, M).** The search eyebrow with "Edit"; one row per type on canvas with its 3px stone marker: photo plate, name, facts, the price for this party or "Not available for these dates" with the nearest free range; "Reserve" → 4.
3. **Apartment page (D, M)**, three-bedroom; the two-bedroom reuses it in Jade. As the reference board: stone band, gallery (one large 4:3, three small), the apartment, the rooms, availability calendar (two months side by side on desktop, stacked on mobile; selected nights in the stone; unavailable struck through on beige), rates ladder, house rules, the folio; the rates plate and footer.

**Reserve flow** (the folio layout; the spine in the type's stone)
4. **Step 1 · Dates and guests (D, M).** Calendar with the chosen range, nights count, steppers with the extra-adult and maximum messages, "Continue" → 5.
5. **Step 2 · At your service (D, M).** One card per amenity (copy deck), "Add" or a quantity stepper, the spine updating; "Continue" → 6, "Skip for now" → 6.
6. **Step 3 · Your details (D, M).** Fields, checkbox, privacy line; the spine shows the full breakdown including "[Applicable taxes]" and "Due now" when the deposit policy is 50%; "Continue" → 7.
7. **Step 4 · Review (D, M).** Everything on one screen with "Change" links, the hold line, the cancellation text, "Reserve and continue to payment" → 8.

**Payment and status**
8. **Payment page (D, M).** The spine with the reference and the amount in gold; the bank card plate with copy affordances; instructions; the hold line; the upload zone (idle, uploading, done, rejected); the WhatsApp link; what happens next.
9. **Reservation status page (D, M).** "Your stay", the reference, the vertical timeline with the current step marked by word and colour, the stay summary (paid so far, balance due at check-in if any), receipt status, "Upload receipt" while Reserved, "Request cancellation", "Need help? WhatsApp us". Also the "Hold ended" and "Cancelled" variants.
10. **Confirmation (D, M) and voucher (A4).** The stone band with the hairline crown and "Your stay is confirmed."; the stay summary; the three buttons; "Before you arrive"; house rules. The voucher as a print layout.
11. **States and errors (D, and M for the first three).** Dates unavailable with nearest alternatives; party exceeds maximum; hold ended; receipt rejected with reason; form validation on step 3; empty calendar month; failed upload.

**Admin — the owner's console at /admin** (canvas work surface, charcoal sidebar, admin type scale, dense tables, no crystal motif; stones only as 3px markers beside type names; short names and unit names appear here)
12. **Dashboard.** Today's arrivals and departures with unit names; "Awaiting verification" (count, oldest first, amount, time since upload); next-30-day occupancy as one strip per unit; revenue this month before tax; holds ending in the next 2 hours.
13. **Reservations list and detail.** Filters (status, type, unit, date range), search (reference, phone, name), CSV export. Detail: guest, party, dates, unit with "Move to another unit", breakdown, payments with the receipt and the actions "Verify and confirm", "Reject receipt" (reason), "Record payment" (method, amount, reference), "Cancel" (reason), "Check in", "Check out", "Add note"; activity log; "Message guest on WhatsApp".
14. **Calendar and blocks.** Month view with one row per unit; bars labelled by guest name and status colour; drag to block (maintenance, owner use, other); "New reservation" (phone booking) using the same pricing.
15. **Settings.** Tabs: Amenities; Rates (per type, with "effective from" and history); Units; Property (check-in and check-out, hold hours, deposit policy, cancellation, tax rate and label, child policy and age, WhatsApp number, emails); Bank details (with a "Review before saving" step); Email previews.

**Emails**
16. **Email templates (600px).** Text-first, ivory ground, the mark as a small image, Jost and DM Sans with Arial fallback, one charcoal button, the reference and the status link in every email. The nine emails from the copy deck's subjects.

**Components and tokens**
17. **Components.** Calendar (available, selected range in the stone, unavailable, past, min-stay hint, keyboard focus), ledger field (canvas and stone), stepper, amenity card, price breakdown, status pill with word, bank card plate with copy affordance, upload zone (four states), buttons (canvas and stone, all states), masthead and footer, folio spine and mobile bar, the faceted crystal in both stones, the seam crown.
18. **Tokens.** Colours with hex and where each is used, type scale, spacing, grid, buttons, fields, the mark and lockups.

## Interaction notes
- Calendar: tap once for arrival, again for departure; the second tap on a night before the first swaps them; unavailable nights cannot sit inside a range. Keyboard: arrows move, Enter selects, Escape clears.
- Steppers: disabled with a reason at the limits. Copy affordances: one tap copies the row, "Copied" for 2 seconds. Upload: drop or tap, file name and size shown, progress as a gold hairline that fills, errors inline.
- The spine never hides the total; on mobile the "Your stay" bar shows the total and expands to the breakdown. Hover states exist on desktop only; nothing depends on hover.

## Accessibility
Contrast at least 4.5:1 for text and 3:1 for hairlines that carry meaning; visible focus everywhere; every input labelled; status conveyed in words; tap targets 44px; the calendar operable by keyboard; reduced motion honoured; no text in images.

## Deliverables and naming
- Every artboard above, named "NN Name · D/M", in the rows listed. If you must cut, cut emails and admin screens last and never the reserve flow or the payment page.
- Prototype links for the reserve steps, from the home ledger and from the results screen.
- The tokens board, and a "Decisions" note beside the canvas listing every choice this brief did not cover.
- Do not invent amenity prices, tax rates, bank details, policies or unit counts: show the config placeholders.

## Do not
Emoji; exclamation marks; star ratings, testimonials, "trusted by" badges; scarcity or urgency devices; card-payment imagery; stock interiors; mid-greys; gradients, shadows or glows; rounded corners; a serif or a third typeface; icon fonts; auto-playing carousels; pop-ups; unit counts shown to guests; a stone used as a text colour; both stones on one surface other than the diptych.

---

# PROMPT 2 — for Claude Code

You are building the production website and booking system for **Crystal Royal Apartment**, a luxury serviced-apartment business in Karachi offering two apartment types by the night, the *Three-Bedroom Apartment with Lounge* and the *Two-Bedroom Apartment with Lounge*, each with one or more physical units. Guests choose a type and dates, reserve online, pay by bank transfer to the property's Meezan Bank account, upload the transfer receipt, and the owner verifies and confirms from an admin console; the system assigns the unit. The approved design is attached (Claude Design canvas or exported screens): implement it faithfully. Read the config block and the shared vocabulary first and use their words and numbers everywhere. Follow this brief exactly where it is specific; where it is silent, choose the simplest robust option and list the choice in your final report.

## Order of work
Build in this order, run the tests after each step, commit each step with a clear message, and post a one-paragraph progress note after steps 3, 6 and 9.
1. Scaffold, tokens, fonts, layout shell (masthead, footer), placeholder pages.
2. Supabase migrations, RLS, functions, seed; `.env.example`.
3. `priceStay()`, availability and unit assignment, reference generation, with unit and database tests.
4. Public pages: home (the diptych), availability results, apartment pages (the stone world), static pages, SEO.
5. Reserve flow (the folio), steps 1 to 4, draft state, server action creating the reservation.
6. Payment page, receipt upload, status page, confirmation and voucher.
7. Admin console: auth, dashboard, reservations, calendar and blocks, settings.
8. Emails, cron (hold expiry, reminders, completion), notifications.
9. Accessibility, performance and SEO pass; Lighthouse; Playwright end-to-end tests.
10. Deployment to a Vercel preview, README and handover notes, final report.

## Stack
- **Next.js 15 (App Router, TypeScript, React 19)** on Vercel. Server Components by default; client components only for the calendar, steppers, upload, copy buttons and forms. pnpm.
- **Supabase**: Postgres with Row Level Security; Auth for admins only (guests never create accounts); Storage with a private `receipts` bucket; `btree_gist` extension.
- **Styling**: Tailwind CSS v4 with the brand tokens as CSS variables in `globals.css`; no component library. Fonts through `next/font/google` (Jost 300, 400, 500; DM Sans 400, 500), self-hosted by Next. No serif anywhere.
- **Validation**: zod on every server action and route handler. **Dates**: `date-fns` and `date-fns-tz` with `Asia/Karachi`. **Email**: Resend with React Email templates. **Bot protection**: Cloudflare Turnstile on the reserve action and the upload action. **Rate limiting**: Upstash Ratelimit (or Vercel's), per IP. **Tests**: Vitest, Playwright.
- No card gateway, no chat widgets, no analytics unless the client supplies a tag (then `@vercel/analytics` or the tag, nothing else).

Repository layout:
```
app/                      routes (below), each with its own loading and error boundaries
components/ui             buttons, ledger fields, calendar, stepper, pill, copy-row, upload, crystal (inline SVG)
components/booking        availability ledger, results, folio, steps
components/admin          tables, filters, calendar grid, forms
lib/pricing.ts            priceStay() — pure, shared by client preview and server
lib/availability.ts       server-only queries and the create_reservation call
lib/dates.ts, lib/money.ts  Karachi-time helpers; "PKR 25,000" formatting
lib/supabase/{server,client,admin}.ts
lib/validation/           zod schemas
emails/                   React Email templates, one file per email
supabase/migrations, supabase/seed.sql
tests/unit, tests/db, tests/e2e
public/brand/             mark SVGs (A faceted, B hairline, C solid), OG image source
```

## Brand tokens (globals.css)
```css
:root {
  --canvas: #F4F1EA; --beige: #EBE5D9; --taupe: #D9D4C7; --paper: #FBFAF6;
  --ink: #2C2C2C; --ink-2: #595959;
  --gold: #C5A880; --bronze: #7A5F3B;
  --lapis-deep: #0E1B35; --lapis: #16294F; --lapis-lit: #24407A;
  --jade-deep: #0C2622; --jade: #163A34; --jade-lit: #245A51;
  --on-stone: #F4F1EA; --on-stone-2: #C9C3B6;
  --ok: #3F7A5A; --wait: #B4862B; --bad: #9E3B3B;
  --font-display: 'Jost', 'Trebuchet MS', sans-serif;
  --font-body: 'DM Sans', Verdana, sans-serif;
  --radius: 0;
}
[data-stone="lapis"] { --stone-deep: var(--lapis-deep); --stone: var(--lapis); --stone-lit: var(--lapis-lit); }
[data-stone="jade"]  { --stone-deep: var(--jade-deep);  --stone: var(--jade);  --stone-lit: var(--jade-lit); }
```
Rules: every apartment-type surface (diptych panel, page band, folio, payment spine, confirmation) sets `data-stone` from the type's `stone` column and styles itself with `--stone-*`, so components are written once; radius 0 everywhere; no box-shadows, gradients or glows; hairlines 1px `--gold` (on a stone, and brand rules on canvas) or `--taupe` (neutral); display and headings in Jost 300 and 500, body in DM Sans; prices in Jost 500 with `font-variant-numeric: tabular-nums`; small gold-toned text on canvas uses `--bronze`; a stone is never a text colour; every colour comes from a token; the type scale, spacing scale, button (52px) and ledger-field (48px) specs follow the design's tokens board. Motion: 200 to 300 ms fades and rises; the seam and headline hairlines draw once on first load (600 ms); all removed under `prefers-reduced-motion`. The faceted crystal is one inline SVG component taking the stone tints as props.

## Routes
```
/                                   Home: the diptych and the availability ledger
/availability                       Results for arrive, depart, adults, children (query string)
/apartments/[slug]                  Apartment page in its stone, with calendar and folio
/reserve/[slug]                     Step 1 dates and guests (query: arrive, depart, adults, children)
/reserve/[slug]/amenities           Step 2
/reserve/[slug]/details             Step 3
/reserve/[slug]/review              Step 4 → creates the reservation
/reservation/[reference]/pay?t=     Payment page (public; reference plus access token)
/reservation/[reference]?t=         Status page (same token); receipt upload and cancellation request live here too
/reservation/[reference]/voucher?t= Printable confirmation (only when confirmed)
/house-rules, /privacy, /terms      Static pages (copy from the config and placeholders)
/admin                              Dashboard (auth required, user present in admins)
/admin/reservations, /admin/reservations/new, /admin/reservations/[id]
/admin/calendar
/admin/settings/{amenities,rates,units,property,bank,emails}
/admin/login
/api/availability?type=&from=&to=   GET: unavailable nights for a type in a window (no guest data), cached 60 s
/api/cron/expire-holds              Vercel Cron every 15 min: expire holds, send hold reminders, complete stays
/opengraph-image                    Generated OG image (stacked lockup on canvas with the gold rule)
```
Reservation links carry a 32-byte random `access_token` (base64url) so guests need no account; the token is checked server-side on every read and write, and compared in constant time.

## Data model (Supabase, SQL migrations in `/supabase/migrations`)
Money columns are `integer` whole rupees. Dates are `date` (calendar days in Karachi); instants are `timestamptz`. Every table has `created_at` and `updated_at` with a trigger.
- `apartment_types` (id, slug unique, name, short_name, stone enum `lapis | jade`, description, bedrooms, lounges, bathrooms, bed_configuration, size_sqft, highlights text[], standard_guests, max_guests, min_nights default 1, sort, active).
- `units` (id, apartment_type_id, name, sort, active). Seeded from `unitCount` and `unitNames`.
- `rates` (id, apartment_type_id, nightly_rate, extra_adult_per_night, effective_from date). Pricing uses the latest row with `effective_from <= check_in`; the whole stay is priced at that rate.
- `amenities` (id, slug unique, name, description, pricing_type enum `per_stay | per_night | per_guest_per_night | per_trip | per_day`, price, max_quantity default 1, sort, active).
- `unit_blocks` (id, unit_id, starts_on, ends_on, reason enum `maintenance | owner_use | other`, note) occupying nights `[starts_on, ends_on)`, with an exclusion constraint against overlapping blocks on the same unit.
- `reservations` (id, reference unique, access_token, apartment_type_id, unit_id, check_in, check_out, adults, children, guest_name, guest_phone, guest_email, arrival_time, requests, status, source enum `web | admin`, subtotal_nights, extra_adults, extra_adults_amount, amenities_amount, tax_rate_percent, tax_label, tax_amount, total, amount_due, currency, hold_expires_at, hold_extended boolean default false, confirmed_at, checked_in_at, completed_at, cancelled_at, cancel_reason, cancellation_requested_at, admin_notes). The stored breakdown is immutable after creation; later rate changes never touch existing reservations.
- `reservation_amenities` (reservation_id, amenity_id, name_snapshot, pricing_type_snapshot, quantity, unit_price, line_total).
- `payments` (id, reservation_id, method enum `bank_transfer | cash | other`, amount, receipt_path, receipt_status enum `submitted | verified | rejected | none`, rejection_reason, bank_reference, recorded_by, verified_by, verified_at, note). A reservation may have several payments. `amount_paid` = sum of verified payments.
- `settings` (singleton row: tax_rate_percent, tax_label, hold_hours, confirm_within_hours, deposit_policy, free_cancellation_days, cancellation_text, child_max_age, child_extra_policy enum `same_as_adult | reduced | free`, child_extra_fee, bank_name, account_title, account_number, iban, branch, swift, raast_id, whatsapp_number, phone_display, email, owner_notify_email, check_in, check_out, min_nights, max_nights, receipt_retention_months default 12).
- `reference_counters` (yymm text primary key, last integer) for `CRA-YYMM-NNNN`, incremented inside the reservation transaction.
- `admins` (user_id references auth.users, email, role, active).
- `activity_log` (id, reservation_id, actor enum `guest | admin | system`, actor_id, action, detail jsonb, created_at).

**Double-booking is impossible at the database level.** Add the exclusion constraint and keep it in every migration:
```sql
create extension if not exists btree_gist;
alter table reservations add constraint reservations_no_overlap
  exclude using gist (unit_id with =, daterange(check_in, check_out, '[)') with &&)
  where (status in ('reserved','payment_submitted','confirmed','checked_in'));
```
Adjacent stays on one unit (check-out day equals the next check-in day) are allowed by the half-open range; overlapping nights are rejected by Postgres even if application code has a bug.

## Reservation status machine
`reserved` → `payment_submitted` → `confirmed` → `checked_in` → `completed`; terminal `cancelled`, `expired`. Enforce transitions in one database function `transition_reservation(id, to_status, actor, detail)` that also writes `activity_log`; the application never updates `status` directly.

| From | To | Who | Side effects |
|---|---|---|---|
| — | reserved | guest (step 4) or admin (manual) | unit assigned, reference, `hold_expires_at = now() + hold_hours`, email *Reservation received* |
| reserved | payment_submitted | guest (receipt upload) | payment row `submitted`, emails *We have your receipt* (guest) and *Receipt uploaded* (owner) |
| reserved | expired | system (cron) | nights freed, email *Your hold has ended* |
| reserved, payment_submitted, confirmed | cancelled | admin (with reason; a guest can only request) | email *Reservation cancelled*; refunds handled outside the system and noted |
| payment_submitted | confirmed | admin (verify receipt, or record a payment) | payment `verified`, `confirmed_at`, email *Your stay is confirmed* |
| payment_submitted | reserved | admin (reject receipt with reason) | payment `rejected`, hold extended once by `hold_hours` (`hold_extended = true`), email *Receipt not matched* |
| reserved | confirmed | admin (record cash or transfer without a receipt) | as confirm |
| confirmed | checked_in | admin | `checked_in_at` |
| checked_in | completed | admin, or cron on the day after check-out | `completed_at` |

With `deposit_policy = "50"`, `amount_due` is the deposit; the balance (`total − amount_paid`) is shown on the status page, the voucher and the admin detail as "Balance due at check-in", and "Record payment" settles it.

## Availability and unit assignment
- A unit is free for a stay when no active reservation (`reserved`, `payment_submitted`, `confirmed`, `checked_in`) and no block overlaps the nights `[check_in, check_out)`.
- A type is available when at least one of its active units is free for every night of the stay. `GET /api/availability` returns, per night in the window, whether the type has a free unit; it never returns who holds what.
- `create_reservation(...)` runs in one transaction: `SELECT ... FOR UPDATE` on the `apartment_types` row to serialise reservations of that type, validate dates, party and amenities, recompute the price from the database (never from client totals), pick the lowest-sorted free unit, increment `reference_counters`, insert the reservation and its amenities, log, and return the reference and token. Two simultaneous requests for the last free unit produce exactly one success; the second gets a clear "not available" result, not an exception.
- Admin can move a reservation to another free unit of the same type ("Move to another unit").
- The cron expires `reserved` reservations whose `hold_expires_at` has passed, sends the hold reminder 2 hours before expiry when `hold_hours >= 4`, and marks `checked_in` stays `completed` the day after check-out. It is idempotent.

## Pricing
One pure function `priceStay(input, config)` in `lib/pricing.ts`, used by the client preview and, authoritatively, by the server:
```
nights             = check_out − check_in, in days; require min_nights ≤ nights ≤ max_nights
party              = adults + children; require 1 ≤ party ≤ max_guests
extra_guests       = max(0, party − standard_guests)
extra_adults       = extra guests counted as adults; children above standard follow
                     settings.child_extra_policy: same_as_adult → the adult fee;
                     reduced → child_extra_fee; free → 0 (adults are counted first)
subtotal_nights    = nights × nightly_rate
extra_adults_amount= Σ extra guests' fee × nights
amenities_amount   = Σ per pricing_type: per_stay → price × qty; per_night → price × qty × nights;
                     per_guest_per_night → price × qty × party × nights; per_trip, per_day → price × qty
taxable            = subtotal_nights + extra_adults_amount + amenities_amount
tax_amount         = round(taxable × tax_rate_percent / 100)
total              = taxable + tax_amount
amount_due         = total when deposit_policy = "full"; round(total × 0.5) when "50"
```
Whole rupees throughout; round half up once, at the end of each line. Until `tax_rate_percent` is set, show "plus applicable taxes" and no tax line; once set, show the tax line with `tax_label`. Worked checks the tests must pass for the three-bedroom at 25,000: 6 guests 25,000, 7 guests 30,000, 8 guests 35,000 per night before tax; 3 nights for 2 adults and 4 children = 75,000.

## Time and money
- "Today" and every date comparison use `Asia/Karachi`. A stay may start today if the current Karachi time is before check-out time; otherwise tomorrow at the earliest. `hold_expires_at` is an instant; display it as "Tuesday 3 November, 09:40 PKT".
- Format money as "PKR 25,000" (Western grouping; switch to lakh grouping only if the owner asks). Never show decimals.
- Store the reservation's breakdown at creation and never recompute it for display.

## Guest flows
1. **Availability ledger, results and calendar** read `/api/availability`. The results page prices each type for the given party with `priceStay()` and shows the nearest free range for an unavailable type (search forward up to 60 days).
2. **Reserve steps** keep draft state in the URL and a signed, httpOnly cookie, never in the database, until step 4. Each step validates with zod and redirects back to the earliest invalid step. The folio spine is one component fed by the draft.
3. **Step 4 "Reserve and continue to payment"** runs a server action: Turnstile check, rate limit, zod validation, `create_reservation`, email *Reservation received* with the pay link, then redirect to `/reservation/[ref]/pay?t=token`. Re-submitting the same draft within a minute returns the existing reservation rather than creating a second one (idempotency key in the cookie).
4. **Payment page** reads the bank details from `settings` and shows them on the bank card plate with copy buttons, the amount due in the spine, the hold deadline, the four instructions, the upload and the WhatsApp link `https://wa.me/{whatsapp_number}?text=Receipt%20for%20reservation%20{ref}`. **Receipt upload**: JPG, PNG, WEBP or PDF up to 10 MB; validate type by magic bytes and size on the server; store at `receipts/{reservation_id}/{uuid}.{ext}` in the private bucket; at most 3 receipts per reservation; strip image EXIF if a library is already present, otherwise note it. Upload moves the status to `payment_submitted`.
5. **Status page** renders the timeline from `status` and `payments`, allows upload while `reserved`, and carries "Request cancellation" (a short form that sets `cancellation_requested_at` and emails the owner; the status does not change until the admin acts).
6. **Confirmation** page and email when the admin confirms; the voucher route prints cleanly (print stylesheet, A4) and includes the house rules and the address. "Add to calendar" is an `.ics` download; "Get directions" opens `mapsUrl`.
7. **Expiry** email links to the apartment page with the same dates prefilled.

## Emails and notifications
All through Resend from `reservations@{domain}` (domain verified in Resend; until then the Resend test sender), reply-to the property email, each with the reference, the status link and the WhatsApp number. Text-first React Email templates in the design's email style; subjects from the copy deck.

| Email | To | Trigger |
|---|---|---|
| Reservation received — payment instructions (bank card, amount due, hold deadline) | guest | status → reserved |
| Your dates are held until … (reminder) | guest | 2 h before `hold_expires_at` |
| We have your receipt | guest | status → payment_submitted |
| Receipt uploaded: {ref}, {amount} (link to admin detail) | owner | status → payment_submitted, and on cancellation requests |
| Your stay is confirmed (voucher link, directions, what to bring) | guest | status → confirmed |
| Receipt not matched: {reason} | guest | receipt rejected |
| Your hold has ended | guest | status → expired |
| Reservation cancelled | guest | status → cancelled |
| New reservation: {ref} | owner | status → reserved (web) |

Sending never blocks the user action: send after the transaction commits, log failures to `activity_log`, and retry once. The owner's WhatsApp is reached only through deep links from the admin console in v1 (no WhatsApp API).

## Admin console
- Supabase Auth with email magic link or OTP; `@supabase/ssr` cookies; middleware allows `/admin/*` only to active users in `admins`. Login is rate limited (5 attempts per 15 minutes per IP).
- **Dashboard**: today's arrivals and departures with unit names; awaiting verification, oldest first, with time since upload; next-30-day occupancy per unit; revenue this month before tax; holds ending within 2 hours.
- **Reservations**: list with filters (status, type, unit, date range) and search (reference, phone, name); CSV export of the current filter. Detail: guest, party, dates, unit with "Move to another unit", breakdown, payments with the receipt rendered from a 60-second signed URL, actions "Verify and confirm", "Reject receipt" (reason), "Record payment" (method, amount, reference), "Cancel" (reason), "Check in", "Check out", "Add note"; activity log; "Message guest on WhatsApp" deep link with the reference prefilled.
- **New reservation** (phone bookings): same steps on one page, same pricing engine, `source = admin`; may be confirmed immediately by recording a payment.
- **Calendar**: month view with one row per unit; drag to block nights with a reason; click a bar to open the reservation.
- **Settings**: amenities (CRUD, reorder, deactivate; never delete one used by a reservation), rates with effective dates and history, units (name, active; a unit with future reservations cannot be deactivated), property settings, bank details with a "Review before saving" step and a log entry, email previews rendered from the templates with sample data.
- Every admin action goes through a server action that writes `activity_log` with the admin's user id.

## Security and privacy
- RLS on every table. Anonymous users can read nothing directly; all public reads go through server code using the service role, which exposes only `apartment_types`, `amenities`, current `rates` and per-night availability. Reservations and payments are read or written only by server code holding a valid access token, or by admins through their session.
- Service-role key only in server code, never in a `NEXT_PUBLIC_` variable. `.env.example` lists `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `CRON_SECRET`, `DRAFT_COOKIE_SECRET`, `SITE_URL`.
- Rate limits per IP: reserve 5 per 10 minutes; upload 10 per hour; availability API 60 per minute; admin login 5 per 15 minutes. Turnstile on reserve and upload.
- Receipts are private objects served only through signed URLs to admins; never public. Retention: a monthly cron deletes receipts `receipt_retention_months` after check-out and records the deletion.
- Guest data is minimal: name, phone, email, arrival time, requests. CNIC or passport numbers are never collected online. A one-line privacy notice sits at step 3 and `/privacy` explains what is kept and for how long.
- Server-side validation of everything: dates (Karachi "today", check_out > check_in, min and max nights), party (1 to max), amenities (active, quantity ≤ max), and full price recomputation. Client totals are previews only.
- Bank details appear only on reservation pages reached with a valid token and in emails to that guest; the public site names "Meezan Bank" and nothing more.
- Security headers (CSP allowing self, Supabase, Turnstile and Resend assets only; `frame-ancestors 'none'`; HSTS), `/api/cron/*` protected by `Authorization: Bearer CRON_SECRET`, access tokens compared in constant time, no stack traces to users, errors logged server-side.

## Content and copy
Use the approved design's copy deck and the config's words. The occupancy and rates wording below must appear verbatim on the home page plate and both apartment pages:

> **Three-Bedroom Apartment with Lounge — PKR 25,000 per night, plus applicable taxes.** Accommodates up to 6 guests as standard, with a maximum capacity of 8 guests. Each additional adult (guests 7 and 8) is charged PKR 5,000 per night, plus applicable taxes.
> **Two-Bedroom Apartment with Lounge — PKR 17,000 per night, plus applicable taxes.** Occupancy and availability should be confirmed directly with the property.

Add "Rates as of October 2026, subject to change." wherever a rate appears. Placeholders in `[brackets]` render as written. No emoji, no exclamation marks, no urgency devices, no unit counts shown to guests.

## SEO, performance, accessibility
- Unique title and description per public page (from the copy deck's meta lines); canonical URLs; `lang="en"`; sitemap and robots through the App Router metadata routes; reservation and admin routes `noindex`. Open Graph image 1200 × 630 from `/opengraph-image`. JSON-LD: `LodgingBusiness` on the home page (name, address placeholders, telephone, `checkinTime`, `checkoutTime`, `priceRange`) and `Accommodation` on each apartment page (`occupancy`, `numberOfRooms`, `offers` with `priceCurrency` PKR).
- Lighthouse ≥ 90 on every public page for performance, accessibility, best practices and SEO, measured on the Vercel preview, mobile profile. LCP under 2.5 s on the home page; images through `next/image` with explicit sizes and the diptych plates marked `priority`; fonts self-hosted; no layout shift from the calendar.
- Semantic landmarks, one `h1` per page, keyboard-operable calendar (arrows, Enter, Escape), visible focus (2px gold), labels on every input, errors linked with `aria-describedby`, status conveyed in words, contrast ≥ 4.5:1, `prefers-reduced-motion` respected, no horizontal scroll at 320px.

## Tests and CI
- **Unit (Vitest)**: `priceStay()` — the three worked nightly totals, the 3-night family example, each amenity pricing type, tax rounding, both deposit policies, each child policy, min and max nights, party limits. Money and date formatting in Karachi time. Reference generation format.
- **Database** (against a local Supabase via the CLI, or a disposable schema): the exclusion constraint rejects overlapping nights and allows adjacent stays; `create_reservation` assigns the lowest-sorted free unit; blocks make a unit unavailable; `transition_reservation` rejects every disallowed transition; the cron expires only past-due `reserved` rows.
- **Concurrency**: ten simultaneous `create_reservation` calls for the same nights with one free unit produce exactly one success and nine clean "not available" results.
- **End-to-end (Playwright, mobile and desktop projects)**: (1) reserve 2026-11-02 → 2026-11-05 for 2 adults and 4 children in the three-bedroom, add one amenity, reach the payment page showing the Meezan Bank card and the reference, upload a PNG receipt, see "Receipt received"; then as admin verify it and see "Confirmed" on the status page and the voucher. (2) The same dates again for the three-bedroom when all its units are taken shows "Not available" and the nearest free range. (3) A party of nine is refused with the exact message. (4) An expired hold shows "Hold ended" and the re-reserve link. (5) The three-bedroom pages render with `data-stone="lapis"` and the two-bedroom with `data-stone="jade"`.
- **CI (GitHub Actions)**: lint, typecheck, unit tests and build on every push; database and end-to-end tests on pull requests against a preview deployment.
- Report the measured Lighthouse numbers and the preview URL.

## Deployment and handover
- Vercel project with the environment variables from `.env.example`; `vercel.json` with the cron schedule; custom domain instructions; Resend domain verification steps; Supabase project with migrations applied from the repo, the `receipts` bucket created private, and the first admin inserted by a documented SQL statement.
- `supabase/seed.sql` seeds both apartment types with their stones and units from the config, the current rates, the sample amenities with placeholder prices, settings with placeholder bank details and tax, and no reservations.
- `README.md`: local setup in under ten commands, how to run each test suite, and an **owner's guide** in plain language: changing rates (with effective dates), updating bank details, blocking nights, verifying a receipt, recording a cash payment, moving a reservation to another unit, cancelling, exporting reservations, and what each email says.
- Backups: note that Supabase's daily backups depend on the plan, and provide a `pnpm export:reservations` script that writes a CSV as a manual backup.

## Final report (post this when done)
1. Preview URL and admin login instructions.
2. Lighthouse scores per public page (mobile), and the LCP of the home page.
3. Test results: unit, database, concurrency, end-to-end, with counts.
4. Every `[placeholder]` still to be filled, grouped by where it appears (config, settings, copy, photos).
5. Every decision this brief did not cover, each in one line with the choice made.
6. Known limitations and the recommended next steps (for example a card gateway, WhatsApp Business API notifications, Urdu).

## Definition of done
- [ ] All routes above exist and match the approved design on desktop and mobile; the diptych, the stone world and the folio are implemented as designed; no horizontal scroll at 320px; reduced motion respected.
- [ ] Two apartment types with their stones and units seeded from the config; guests reserve a type and the system assigns a unit; the exclusion constraint is in place and tested.
- [ ] Availability, pricing, hold expiry, unit assignment and status transitions behave as specified and are covered by the tests above, including the concurrency test.
- [ ] Payment page shows the Meezan Bank details from settings with copy buttons, the amount due, the hold deadline and a working receipt upload; admin can verify, confirm, reject, record payments, move units, block nights and cancel.
- [ ] All nine emails send with the right trigger and content; sending never blocks a user action.
- [ ] RLS on every table; no secrets in client code; rate limits and Turnstile active; `.env.example` present; cron protected; receipts private.
- [ ] Lighthouse ≥ 90 on every public page; JSON-LD valid; sitemap and robots present.
- [ ] Deployed to a Vercel preview with a Supabase project; migrations and seed run from the repo; README with the owner's guide.
- [ ] Final report posted in the format above.
