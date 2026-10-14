# Architecture and conventions

Read this before adding a route. The approved design is the Claude Design canvas exported to
`design/claude-design/*.dc.html` ("Faceted Midnight"); the behaviour is `docs/BOOKING-SITE-BRIEF.md` (v3,
Prompt 2), except where this file says otherwise.

## Decisions that override the brief
- **Look:** the canvas as drawn (midnight #171512 and ivory grounds, Cormorant Garamond display, Jost body,
  gold hairlines). The brief's Lapis/Jade stones and DM Sans are NOT used. The `stone` column exists but is unused in UI.
- **Two apartments, one unit each:** three-bedroom and two-bedroom. Guests never see units.
- **Data access:** server code talks to Postgres directly through `postgres` (`src/lib/db/sql.ts`, `DATABASE_URL`),
  not supabase-js. Supabase is used only for Storage (receipts) and Auth (admin), both with local fallbacks.
- **Two-bedroom is not reservable online** until the owner sets its occupancy (`standard_guests`/`max_guests` null).
  Its CTAs are "Ask on WhatsApp" (canvas). `isReservable()` in `src/lib/quote.ts` decides.
- **Unpriced amenities** (price null) can be requested; the line shows "[PKR __]" / "Quoted separately" and is not
  added to the total.

## Layout
- `src/lib/` shared logic. Pure: `pricing.ts` (`priceStay`), `quote.ts` (`quoteStay`, `isReservable`), `dates.ts`
  (Karachi "today", ISO dates), `money.ts` (`formatPKR`), `status.ts`, `availability.ts`, `validation.ts` (zod).
  Server-only: `env.ts`, `db/sql.ts`, `db/queries.ts` (catalogue, availability, reservations, transitions, cron),
  `db/admin-queries.ts` (admin), `draft.ts` (signed reserve cookie), `protect.ts` (`rateLimit`, `verifyTurnstile`),
  `storage.ts` (receipts, magic-byte sniffing), `notify.ts` (`notify(kind, reservationId, extra)`), `emails.ts`.
- `src/components/` shared UI: `brand.tsx` (Mark, MarkHairline, Wordmark, FacetedCrystal), `site-header.tsx`,
  `site-footer.tsx`, `ph.tsx` (`<Ph value>` / `<PhText text>` placeholder treatment), `plate.tsx` (photo plates),
  `rates-band.tsx` (verbatim rates), `status-pill.tsx`.
- Styling: CSS classes and tokens in `src/app/globals.css` (`.eyebrow .display .num .ph .plate .btn-dark .btn-gold
  .btn-light .btn-ghost-light .step .field .inp .lbl .err .day[data-state] .pill-* .container-site .on-midnight
  .on-ivory .on-ivory-2 .hide-sm .show-sm`) plus Tailwind utilities. Colours only via the `--color-*` variables.
  Radius 0, no shadows, no gradients. Match the canvas artboard's spacing and type sizes.

## Rules every route follows
- Server Components by default; client components only for calendar, steppers, upload, copy buttons, forms.
- Every server action and route handler validates with zod (`src/lib/validation.ts`), recomputes prices with
  `quoteStay()` from database rows, and never trusts client totals.
- Status changes only through `transition()` in `db/queries.ts`. Emails only through `notify()`, called after the
  database work, never awaited in a way that can fail the action.
- Guest reservation pages: `getReservationForGuest(reference, token)` (constant-time). Unknown/invalid → `notFound()`.
- Dates are `YYYY-MM-DD` strings; "today" is `todayInKarachi()`; show instants with `formatDateTimeKarachi()`
  (replace " Karachi time" with " PKT" where the copy deck says PKT).
- Money is whole rupees, `formatPKR(n)` → "PKR 25,000".
- Placeholders: anything still `[bracketed]` renders through `<Ph>`/`<PhText>`; never invent values.
- Copy: concierge voice, sentence case, no exclamation marks, no urgency, no emoji. Use the canvas copy verbatim.
- Accessibility: real buttons/links/labels, `aria-describedby` for errors, 44px targets, visible 2px gold focus,
  status always in words, no horizontal scroll at 320px, `prefers-reduced-motion` respected.

## Local development
- `npm run db:up` starts a throwaway Postgres 16 on 127.0.0.1:54329, applies `supabase/migrations/*` and `seed.sql`.
  `.env.local` points `DATABASE_URL` at it. `LOCAL_ADMIN_PASSWORD` enables /admin/login without Supabase.
- `npm test` (unit), `npm run test:db` (database, its own cluster), `npx tsc --noEmit`, `npx next build`.
