# Crystal Royal Apartment

The booking website and owner's console for Crystal Royal Apartment, Karachi: two serviced apartment types reserved
by the night, paid by bank transfer to Meezan Bank, verified by the owner.

- Next.js 15 (App Router, React 19, TypeScript), Tailwind CSS v4, deployed on Vercel.
- Postgres (Supabase) through the `postgres` package; Supabase is used only for Storage (receipts) and Auth (the console).
- Email through Resend, bot protection with Cloudflare Turnstile, rate limits with Upstash Redis.
- How the code is organised and the rules every route follows: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
  What the site must do: [docs/BOOKING-SITE-BRIEF.md](docs/BOOKING-SITE-BRIEF.md). The approved design:
  `design/claude-design/*.dc.html`.

Contents: [Local setup](#local-setup) · [Tests](#tests) · [Deployment](#deployment) · [The first admin](#the-first-admin) ·
[Scheduled jobs](#scheduled-jobs) · [Backups](#backups) · [Owner's guide](#owners-guide) ·
[Placeholders still to fill](#placeholders-still-to-fill)

---

## Local setup

You need Node 22 and PostgreSQL 16 (`sudo apt-get install postgresql-16` on Ubuntu; the scripts expect
`/usr/lib/postgresql/16/bin`, or set `PGBIN`). No third-party accounts are needed locally: without their keys, emails
are written to `.data/outbox`, receipts to `.data/receipts`, Turnstile is skipped and rate limits are kept in memory.

```bash
git clone <this repository> crystalroyal && cd crystalroyal
npm ci
npm run db:up        # starts Postgres on 127.0.0.1:54329, loads supabase/migrations and seed.sql; wipes it if it exists
cat > .env.local <<EOF
SITE_URL=http://localhost:3000
DATABASE_URL=postgres://postgres@127.0.0.1:54329/crtest
DRAFT_COOKIE_SECRET=$(openssl rand -hex 32)
LOCAL_ADMIN_PASSWORD=choose-a-password
EOF
npm run dev          # http://localhost:3000 ; the console is at /admin/login (any email + LOCAL_ADMIN_PASSWORD)
```

`npm run db:up` gives you a fresh database every time you run it (two apartment types with one unit each, the
October 2026 rates, the eight sample amenities without prices, placeholder settings, no reservations).

## Tests

| Command | What it runs | Needs |
|---|---|---|
| `npm run typecheck` | TypeScript over the whole repository | nothing |
| `npm test` | Unit tests (`tests/*.test.ts`, `tests/unit/`): pricing and the worked totals, quotes, dates in Karachi time, money, signed cookies, receipt sniffing, email subjects, the cron guard, calendar logic | nothing |
| `npm run test:db` | Database tests (`tests/db/`): the no-double-booking constraint, unit assignment, blocks, every status transition, hold expiry, references, ten simultaneous reservations, and both cron routes | PostgreSQL 16 binaries |
| `npm run test:e2e` | Playwright, desktop and mobile: reserve, pay, upload, verify, "Not available", a party of nine, "Hold ended", the two-bedroom enquiry | a running site and its database |

**Database tests** start their own throwaway cluster (127.0.0.1:54330 in `/tmp/crystalroyal-pgtest-ops`; change
with `DBTEST_PORT` and `DBTEST_DIR`), load the migrations and seed, and stop it at the end. They never touch the
`npm run db:up` database.

**End-to-end tests** run against a site that is already running, by default `http://localhost:3100`
(`E2E_BASE_URL` to change), using the same database through `DATABASE_URL`. Run the site in development mode so the
development sign-in, local receipts and skipped Turnstile apply:

```bash
npx playwright install chromium                 # once
npm run dev -- -p 3100                          # in another terminal
npm run test:e2e
```

The tests create reservations with guest emails `e2e+…@example.com` on 2 to 5 November 2026 (three weeks ahead once
that date has passed) and remove them at the end (`E2E_KEEP=1` keeps them to look at). The three-bedroom must be free
on those nights. Against a deployed preview, set `E2E_BASE_URL`, `DATABASE_URL`, Turnstile test keys and an admin
sign-in that works there.

**CI** (`.github/workflows/ci.yml`): every push runs typecheck, unit tests, the production build and the database
tests; pull requests also run the end-to-end tests against a development server.

## Deployment

### 1. Supabase

1. Create a project (a region near Karachi, for example Mumbai).
2. Apply the schema: either `supabase link --project-ref <ref>` then `supabase db push`, or paste each file of
   `supabase/migrations/` into the SQL editor in name order. Then run `supabase/seed.sql` once.
3. Storage: the migration creates the bucket `receipts`. Check under Storage that it exists and is **not public**.
   Receipts are only ever read through 60-second signed links from the console.
4. Authentication > URL configuration: set the Site URL to your `SITE_URL` and add
   `https://<your domain>/admin/auth/callback` to the redirect URLs. The console signs in with an email magic link.
5. Note for `.env`: Project settings > API gives `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
   `SUPABASE_SERVICE_ROLE_KEY` (server only; never put it in a `NEXT_PUBLIC_` variable).
6. `DATABASE_URL`: Project settings > Database > Connection string > **Transaction pooler** (port 6543), with the
   database password filled in. The app is configured for the pooler (no prepared statements).

### 2. Resend (email)

Add your domain in Resend > Domains, create the DNS records it shows (SPF and DKIM, plus DMARC if you like) at your
DNS host, and wait for "Verified". Then set `RESEND_API_KEY` and
`EMAIL_FROM="Crystal Royal Apartment <reservations@yourdomain>"`. Until the domain is verified Resend only delivers to
your own Resend account address. Replies go to the property email set in the console.

### 3. Cloudflare Turnstile

Cloudflare dashboard > Turnstile > Add widget, with your domain (and the Vercel preview domain if you test there).
Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`. In production, reserving and uploading are refused
without the secret.

### 4. Upstash Redis (rate limits)

Create a Redis database at upstash.com and copy its REST URL and token to `UPSTASH_REDIS_REST_URL` and
`UPSTASH_REDIS_REST_TOKEN`. Without them each server instance counts on its own.

### 5. Vercel

Import the repository, then under Settings > Environment Variables add every variable from `.env.example`:

| Variable | Value |
|---|---|
| `SITE_URL` | `https://<your domain>` (used in emails and links) |
| `DATABASE_URL` | the Supabase transaction pooler string |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | from Supabase |
| `RESEND_API_KEY`, `EMAIL_FROM` | from Resend |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | from Cloudflare |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | from Upstash |
| `CRON_SECRET` | a long random string (`openssl rand -hex 32`); Vercel sends it to the scheduled jobs |
| `DRAFT_COOKIE_SECRET` | another long random string (`openssl rand -hex 32`) |
| `LOCAL_ADMIN_PASSWORD` | leave empty in production (development sign-in only) |

Deploy. `vercel.json` registers the scheduled jobs (below). For the custom domain: Vercel > Settings > Domains > Add,
then create the A or CNAME record Vercel shows at your DNS host; update `SITE_URL` and the Supabase Site URL to match.

## The first admin

The console's sign-in form never creates accounts: a link is sent only to an active admin. So create the person in
Supabase first, then make them an admin.

1. Supabase > Authentication > Users > Add user > Create new user (or Send invitation), with the owner's email.
2. In the SQL editor:

```sql
insert into public.admins (user_id, email)
select id, email from auth.users where lower(email) = lower('owner@yourdomain')
on conflict (user_id) do update set active = true, email = excluded.email;
```

3. The owner opens `/admin/login`, enters the email and follows the link. To remove someone:
   `update public.admins set active = false where lower(email) = lower('…');`

## Scheduled jobs

| Route | When (`vercel.json`) | What it does |
|---|---|---|
| `/api/cron/expire-holds` | every 15 minutes | Ends holds whose time has passed and emails "Your hold has ended"; sends the reminder 2 hours before a hold ends (when holds are 4 hours or longer); marks checked-in stays completed the day after check-out. |
| `/api/cron/receipt-retention` | the 1st of each month, 21:30 UTC (02:30 PKT on the 2nd) | Deletes transfer receipts "Keep receipts, months" after check-out and records each deletion on the reservation. The payment record stays. |

Both require `Authorization: Bearer <CRON_SECRET>` (Vercel adds it) and are safe to run again. To run one by hand:
`curl -H "Authorization: Bearer $CRON_SECRET" https://<your domain>/api/cron/expire-holds`.
Vercel's Hobby plan runs scheduled jobs at most once a day; the 15-minute hold expiry needs the Pro plan, or any
external scheduler calling the route with the secret.

## Backups

Supabase's daily backups depend on the plan. For a copy you keep yourself, export every reservation (with amenities,
payments and the owner's notes) as a CSV:

```bash
npm run -s export:reservations > reservations-$(date +%F).csv     # uses DATABASE_URL, or .env.local
# or: node scripts/export-reservations.mjs backups/reservations.csv
```

---

## Owner's guide

Everything below happens in the console at `https://<your domain>/admin`. Sign in with your email; you receive a
link that signs you in on that device. Every action you take is recorded on the reservation's activity list with
your name. All dates and times are Karachi time.

**Each morning**, the Dashboard shows today's arrivals and departures, receipts waiting for you (oldest first), holds
ending soon, the next 30 days' occupancy and this month's revenue before tax.

### Verifying a receipt

When a guest uploads a transfer receipt you receive the email "Receipt uploaded" and the reservation shows
"Payment received".

1. Open the reservation (from the Dashboard or Reservations).
2. Under Payments, open the receipt and compare it with your Meezan Bank statement: the amount, and the reservation
   reference in the payment note.
3. If the money has arrived, press **Verify and confirm**. The guest receives "Your stay is confirmed" with the
   voucher link.
4. If it does not match, open **Reject receipt** and write the reason in a sentence the guest will read (for example
   "The amount is PKR 5,000 short."). The guest receives "Receipt not matched" with your reason, and their hold is
   extended once by the hold hours so they can send a clearer copy.

### Recording a cash payment (or a transfer without a receipt)

Open the reservation, open **Record payment**, choose the method (cash, bank transfer or other), enter the amount in
rupees and, if there is one, the bank reference. If the reservation was still waiting, recording the payment confirms
it and the guest receives "Your stay is confirmed". With a 50% deposit policy the balance shows as "Balance due at
check-in"; record it the same way when it is paid.

For a booking taken by phone, use **New reservation**: same prices as the website; you can confirm it at once by
recording the payment.

### Changing rates (with effective dates)

Settings > Rates > **Schedule a new rate** for the apartment: the nightly rate, the extra adult per night (leave it
empty for no extra-guest charge) and **Effective from** (today or a later date). A stay is priced at the rate in force
on its arrival date, for the whole stay. Reservations already made keep the price they were given. A second rate
on the same date replaces the first; earlier rates stay in the history.

The rates statement on the home and apartment pages ("Three-Bedroom Apartment with Lounge — PKR 25,000 per night…",
"Rates as of October 2026") is your exact wording kept as text in `src/lib/site.ts`; ask your developer to update it
whenever the rates change, so the two always agree.

### Setting the two-bedroom occupancy

Until the two-bedroom's standard and maximum guests are set, it cannot be reserved online and guests are offered
"Ask on WhatsApp". In Settings > Rates, under the two-bedroom, fill **Standard guests** and **Maximum guests** (the
maximum at least the standard) and press **Save occupancy**. If guests above the standard number pay extra, schedule
a rate with the extra adult per night as well. The apartment then shows "Reservable online". Ask your developer to
replace its line "Occupancy and availability should be confirmed directly with the property." on the website.

### Updating bank details

Settings > Bank details: change the fields, press **Review before saving**, check the saved and new details side by
side, then **Save bank details**. The change is recorded (account numbers show only their last four characters in the
record). The new details appear at once on every payment page and in later emails, including for guests already
holding dates, so let anyone mid-transfer know.

### Blocking nights

Calendar and blocks: choose the month, then drag across the free nights on the apartment's row (or tap the first and
the last night). The **Block nights** form beside the calendar fills in: the unit, the first night, "free again on"
(the morning after the last blocked night), the reason (maintenance, owner use or other) and a note for yourself.
Press **Block selected nights**. Guests simply see those nights as unavailable. Nights that already have a reservation
cannot be blocked. To reopen them, remove the block from the list under the calendar.

### Moving a reservation to another unit

Guests reserve an apartment type and the system assigns a unit. When a type has more than one unit (Settings > Units
to add them), open the reservation, choose a **Free unit of the same type** and press **Move to another unit**. Only
units free for every night of the stay are offered. The guest sees nothing change.

### Cancelling

Open the reservation, open **Cancel the reservation**, write the reason and confirm. The nights become free and the
guest receives "Reservation cancelled" with your reason. Refunds are made from your bank outside the system; add a note
on the reservation when you have sent one.

When a guest asks to cancel from their reservation page you receive "Cancellation requested" and the reservation is
marked; nothing changes until you cancel it yourself.

### Check-in and check-out

On arrival press **Check in**; on departure **Check out**. A checked-in stay is marked completed automatically the day
after its check-out date.

### Exporting reservations

Reservations: filter by status, apartment, unit or arrival dates, or search by reference, name or phone, then press
**Export CSV** to download exactly that list (it opens in Excel). For a complete backup see [Backups](#backups).

### Other settings

- **Property**: hold hours (how long dates are held for the transfer), tax rate and its label, deposit policy (full or
  50%), check-in and check-out times, shortest and longest stay, cancellation wording and free-cancellation days,
  child age and how children above the standard number are charged, "receipts confirmed within" hours, how many months
  receipts are kept, the WhatsApp number, the phone and emails shown to guests, and the owner alerts email.
- **Amenities**: prices (leave empty and the guest sees "Quoted separately"), order, add, or deactivate. An amenity
  that a reservation has used can be deactivated but not deleted.
- **Units**: names, and active or not. A unit with reservations still to come cannot be deactivated.
- **Email previews**: every email below, rendered with sample details.

### What each email says

Every guest email carries the reservation reference, a link to the guest's reservation page and your WhatsApp
number. Owner emails go to the owner alerts email and link to the reservation in the console.

| Email (subject) | To | When | What it says |
|---|---|---|---|
| Your reservation CRA-2611-0042 — payment instructions | guest | a reservation is made | Thanks them; the dates and party; transfer the amount to the Meezan Bank account with the reference in the payment note; the dates are held until the hold ends. Button: Settle by transfer. |
| Your dates are held until Tue 3 Nov, 09:40 PKT | guest | 2 hours before the hold ends (holds of 4 hours or more) | A gentle note of the deadline; if they have transferred, upload the receipt or send it on WhatsApp. Button: Upload your receipt. |
| We have your receipt | guest | they upload a receipt | You confirm once the transfer arrives, usually within your "receipts confirmed within" hours. |
| Receipt uploaded: CRA-2611-0042, PKR 105,000 | owner | a guest uploads a receipt | Who, which stay, the amount due. Button: Verify the receipt. |
| Your stay is confirmed — 2 to 5 November | guest | you verify a receipt or record a payment that confirms | The arrival day and check-in time; bring a CNIC or passport for each adult; the voucher and directions. Button: Your voucher. |
| Receipt not matched — CRA-2611-0042 | guest | you reject a receipt | "We could not match this receipt to a transfer", your reason, upload a clearer copy or send it on WhatsApp, the new hold deadline. |
| Your hold on 2 to 5 November has ended | guest | the hold runs out | The dates may still be free; reserve again. Button: Reserve again, with the same dates and party filled in. |
| Reservation CRA-2611-0042 cancelled | guest | you cancel | The stay is cancelled, with your reason. |
| New reservation: CRA-2611-0042 | owner | a guest reserves online | Name and phone, the stay and party, the amount due, the hold deadline. |
| Cancellation requested: CRA-2611-0042 | owner | a guest asks to cancel | Who asked, which stay, the reason they gave. |

While an address is still a [placeholder] the email to it is skipped and the skip is recorded on the reservation.

---

## Placeholders still to fill

Anything written in `[brackets]` is an owner input not yet supplied. It shows on the site exactly as written, with
a dashed underline, so nothing is invented. Fill them where shown.

### In the console (Settings, no deploy needed)

Defaults come from `supabase/migrations/20261014000001_v3_schema.sql`.

| Setting | Where | Placeholder now |
|---|---|---|
| Tax rate, percent | Property | empty: pages say "plus applicable taxes" and add no tax line |
| Tax label | Property | `[Applicable taxes]` |
| Receipts confirmed within, hours | Property | `[__]` |
| Cancellation wording | Property | `[Free cancellation up to __ days before arrival. After that, the amount paid is retained.]` |
| Free cancellation, days before | Property | empty |
| Child age, up to | Property | empty (brief suggests `[12]`) |
| Child as guest 7 or 8 | Property | "same as adult" until you choose; reduced child rate empty |
| Check-in from / Check-out by | Property | `[15:00]` / `[11:00]` |
| WhatsApp number | Property | `[92XXXXXXXXXX]` (digits, country code first) |
| Phone, as guests see it | Property | `[+92 XXX XXXXXXX]` |
| Reservations email | Property | `[reservations@crystalroyalapartment.com]` |
| Owner alerts email | Property | `[owner@crystalroyalapartment.com]` (owner emails are skipped until set) |
| Hold hours, deposit policy, keep receipts | Property | 12 hours, full payment, 12 months: confirm |
| Account title | Bank details | `[Crystal Royal Apartment]` |
| Account number | Bank details | `[__________]` |
| IBAN | Bank details | `[PK__ MEZN ____ ____ ____ ____]` |
| Branch | Bank details | `[Branch name and code]` |
| SWIFT | Bank details | `[MEZNPKKA — confirm]` |
| Raast ID | Bank details | `[optional Raast ID or mobile number]` |
| Two-bedroom standard and maximum guests | Rates | empty: not reservable online until set |
| Two-bedroom extra adult per night | Rates | none (`[__ or none]` in the brief) |
| Bathrooms, bed configuration, size in sq ft (both apartments) | Rates | empty, shown as `[__]` |
| Unit names and how many units | Units | one unit each, named "Three-bedroom apartment" and "Two-bedroom apartment" |
| Amenity prices | Amenities | all eight empty, shown as `[PKR __]` · "Quoted separately": Airport transfer (per trip, up to 4), Breakfast for the party (per guest per night), Daily housekeeping (per night, `[PKR __ or included]`), Early check-in (per stay), Late check-out (per stay), Extra bedding or cot (per night, up to 2), Kitchen pre-stocked (per stay), Driver on call (per day, up to 30) |

### In the code (ask your developer; needs a deploy)

| Value | File | Placeholder now |
|---|---|---|
| Domain | `src/lib/site.ts` | `[crystalroyalapartment.com]` |
| Neighbourhood | `src/lib/site.ts` (also the home page description in `src/app/layout.tsx`) | `[Neighbourhood]` |
| Street address | `src/lib/site.ts` | `[Street address]` |
| Google Maps link ("Get directions") | `src/lib/site.ts` | `[Google Maps link]` |
| Minutes to Jinnah International Airport | `src/lib/site.ts` | `[__ minutes]` |
| House rules | `src/lib/site.ts` | `[Quiet hours __ to __]`, `[No smoking indoors]`, `[No parties or events]`, `[Occupancy as reserved]`, `[__]` |
| Apartment descriptions | `src/lib/site.ts` | `[Description of finishes, view and kitchen to be supplied by the property.]` (both) |
| Rooms | `src/lib/site.ts` | `[bed configuration]` per bedroom, `[seating and dining]`, `[kitchen equipment]`, bathrooms `[__]` |
| Rates wording and "Rates as of" | `src/lib/site.ts` | verbatim from the owner, October 2026; update with any rate change |
| Photographs | `src/lib/site.ts` (`photos`, `cardPhoto`) | captioned plates ("Photo · three-bedroom lounge at dusk · 2560 × 1240" and the others) until photographs are supplied |
| Terms | `src/app/terms/page.tsx` | `[Full terms to be reviewed and supplied by the property.]` |
| How long reservation records are kept | `src/app/privacy/page.tsx` | `[retention period to be confirmed by the property]` |

### Outside the code

- Sender domain verified in Resend, Turnstile keys, Upstash, `CRON_SECRET`, Supabase project (see [Deployment](#deployment)).
- The first admin (see [The first admin](#the-first-admin)).
